/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { fetchWithTimeout } from './aiClientUtils';
import { getValidAccessToken } from './authSession';
import {
  TRUSTCHECK_ALLOWED_IMAGE_MIMES,
  TRUSTCHECK_MAX_SCREENSHOT_BYTES,
} from './trustCheckAnalysis';
import type {
  GroundingSource,
  SuspiciousTransactionAnalysisRequest,
  SuspiciousTransactionAnalysisResult,
  TrustCheckEnhancedRiskLevel,
  TrustCheckScreenshotPayload,
  TrustCheckWarningSign,
  UpiCollectAnalysisRequest,
  UpiCollectAnalysisResult,
} from '../types';

export const TRUSTCHECK_CLIENT_TIMEOUT_MS = 45000;
export const TRUSTCHECK_UPI_COLLECT_ENDPOINT = '/api/gemini/trustcheck/upi-collect';
export const TRUSTCHECK_TRANSACTION_ENDPOINT = '/api/gemini/trustcheck/transaction';
export const TRUSTCHECK_WEB_VERIFY_ENDPOINT = '/api/gemini/trustcheck/web-verify';

export interface TrustCheckWebVerifyResult {
  modelUsed: string;
  summary: string;
  groundingSources: GroundingSource[];
  webSearchQueries: string[];
  sensitiveDataRedacted: boolean;
  disclaimer: string;
  verifiedAt: string;
}

export interface DeterministicFallbackPayload {
  minRiskLevel: TrustCheckEnhancedRiskLevel;
  observedEvidence: string[];
  warningSigns: TrustCheckWarningSign[];
  pinSafetyNotice?: string;
  recommendedImmediateActions: string[];
  safeNextSteps?: string[];
  suggestedNextSteps?: string[];
  aiDisclaimer?: string;
}

export class TrustCheckApiError extends Error {
  status: number;
  code: string;
  deterministicObservations?: DeterministicFallbackPayload;

  constructor(
    message: string,
    status: number,
    code = 'TRUSTCHECK_ERROR',
    deterministicObservations?: DeterministicFallbackPayload
  ) {
    super(message);
    this.name = 'TrustCheckApiError';
    this.status = status;
    this.code = code;
    this.deterministicObservations = deterministicObservations;
  }
}

/**
 * Validates and encodes a browser image File into a bounded TrustCheckScreenshotPayload.
 */
export async function readTrustCheckScreenshotFile(
  file: File
): Promise<TrustCheckScreenshotPayload> {
  if (!file) {
    throw new Error('Please choose a valid screenshot file.');
  }

  const mime = (file.type || '').toLowerCase();
  const normalizedMime = mime === 'image/jpg' ? 'image/jpeg' : mime;
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const validByExt = ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp';

  if (!TRUSTCHECK_ALLOWED_IMAGE_MIMES.has(normalizedMime) && !validByExt) {
    throw new Error('Unsupported screenshot format. Please upload a PNG, JPEG, or WebP image.');
  }

  if (file.size <= 0) {
    throw new Error('Selected screenshot file is empty.');
  }

  if (file.size > TRUSTCHECK_MAX_SCREENSHOT_BYTES) {
    throw new Error('Screenshot exceeds the 5 MiB limit. Please upload a smaller image.');
  }

  const resolvedMime = TRUSTCHECK_ALLOWED_IMAGE_MIMES.has(normalizedMime)
    ? normalizedMime
    : ext === 'png'
    ? 'image/png'
    : ext === 'webp'
    ? 'image/webp'
    : 'image/jpeg';

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const cleaned = result.replace(/^data:[^;]+;base64,/i, '').trim();
      if (!cleaned) {
        reject(new Error('Could not read image contents from the selected file.'));
        return;
      }
      resolve(cleaned);
    };
    reader.onerror = () => reject(new Error('Failed to read the selected screenshot file.'));
    reader.readAsDataURL(file);
  });

  return {
    mimeType: resolvedMime,
    dataBase64: base64,
    fileName: file.name,
    fileSizeBytes: file.size,
  };
}

async function resolveBearerToken(explicitToken?: string): Promise<string> {
  let token = typeof explicitToken === 'string' ? explicitToken.trim() : '';
  if (!token) {
    const sessionToken = await getValidAccessToken();
    if (typeof sessionToken === 'string' && sessionToken.trim()) {
      token = sessionToken.trim();
    }
  }
  if (!token) {
    throw new TrustCheckApiError(
      'Please sign in to run live AI TrustCheck analysis.',
      401,
      'AUTH_REQUIRED'
    );
  }
  return token;
}

async function postTrustCheckRequest<T>(
  endpoint: string,
  payload: unknown,
  options?: { token?: string; signal?: AbortSignal }
): Promise<T> {
  const token = await resolveBearerToken(options?.token);

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: options?.signal,
    },
    TRUSTCHECK_CLIENT_TIMEOUT_MS
  );

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errMsg =
      data && typeof data.message === 'string' && data.message.trim()
        ? data.message.trim()
        : `TrustCheck request failed with HTTP ${response.status}.`;
    const errCode =
      data && typeof data.error === 'string' && data.error.trim()
        ? data.error.trim()
        : 'TRUSTCHECK_HTTP_ERROR';
    const deterministicObs =
      data && typeof data.deterministicObservations === 'object'
        ? (data.deterministicObservations as DeterministicFallbackPayload)
        : undefined;

    throw new TrustCheckApiError(errMsg, response.status, errCode, deterministicObs);
  }

  if (!data || data.success !== true || !data.result || typeof data.result !== 'object') {
    throw new TrustCheckApiError(
      'Received an incomplete response from the TrustCheck analysis service.',
      502,
      'INVALID_RESPONSE'
    );
  }

  return data.result as T;
}

export async function analyzeUpiCollectRequest(
  payload: UpiCollectAnalysisRequest,
  options?: { token?: string; signal?: AbortSignal }
): Promise<UpiCollectAnalysisResult> {
  const result = await postTrustCheckRequest<UpiCollectAnalysisResult>(
    TRUSTCHECK_UPI_COLLECT_ENDPOINT,
    payload,
    options
  );

  if (
    result.mode !== 'upi_collect' ||
    (result.riskLevel !== 'low' && result.riskLevel !== 'medium' && result.riskLevel !== 'high') ||
    typeof result.summary !== 'string' ||
    !Array.isArray(result.warningSigns)
  ) {
    throw new TrustCheckApiError(
      'Received a malformed UPI collect analysis payload.',
      502,
      'MALFORMED_CLIENT_PAYLOAD'
    );
  }

  return result;
}

export async function analyzeSuspiciousTransaction(
  payload: SuspiciousTransactionAnalysisRequest,
  options?: { token?: string; signal?: AbortSignal }
): Promise<SuspiciousTransactionAnalysisResult> {
  const result = await postTrustCheckRequest<SuspiciousTransactionAnalysisResult>(
    TRUSTCHECK_TRANSACTION_ENDPOINT,
    payload,
    options
  );

  if (
    result.mode !== 'suspicious_transaction' ||
    (result.riskLevel !== 'low' && result.riskLevel !== 'medium' && result.riskLevel !== 'high') ||
    typeof result.summary !== 'string' ||
    !Array.isArray(result.warningSigns)
  ) {
    throw new TrustCheckApiError(
      'Received a malformed transaction analysis payload.',
      502,
      'MALFORMED_CLIENT_PAYLOAD'
    );
  }

  return result;
}

export async function verifyIdentifierWithWebSearch(
  payload: { identifier: string; identifierType: string },
  options?: { token?: string; signal?: AbortSignal }
): Promise<TrustCheckWebVerifyResult> {
  const token = await resolveBearerToken(options?.token);

  const response = await fetchWithTimeout(
    TRUSTCHECK_WEB_VERIFY_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: options?.signal,
    },
    TRUSTCHECK_CLIENT_TIMEOUT_MS
  );

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errMsg =
      data && typeof data.message === 'string' && data.message.trim()
        ? data.message.trim()
        : `Google Search verification failed with HTTP ${response.status}.`;
    const errCode =
      data && typeof data.error === 'string' && data.error.trim()
        ? data.error.trim()
        : 'WEB_VERIFY_HTTP_ERROR';
    throw new TrustCheckApiError(errMsg, response.status, errCode);
  }

  if (!data || data.success !== true || typeof data.summary !== 'string') {
    throw new TrustCheckApiError(
      'Received an incomplete Google Search verification response.',
      502,
      'INVALID_RESPONSE'
    );
  }

  return {
    modelUsed: data.modelUsed || 'gemini-4-hydrogen',
    summary: data.summary,
    groundingSources: Array.isArray(data.groundingSources) ? data.groundingSources : [],
    webSearchQueries: Array.isArray(data.webSearchQueries) ? data.webSearchQueries : [],
    sensitiveDataRedacted: Boolean(data.sensitiveDataRedacted),
    disclaimer: data.disclaimer || '',
    verifiedAt: data.verifiedAt || new Date().toISOString(),
  };
}
