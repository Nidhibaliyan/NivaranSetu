/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { fetchWithTimeout } from './aiClientUtils';
import { getValidAccessToken } from './authSession';
import type { LegalAnalysisResponse } from '../types';

export const LEGAL_ANALYSIS_CLIENT_TIMEOUT_MS = 45000;
export const LEGAL_ANALYSIS_ENDPOINT = '/api/gemini/legal-analysis';

export interface LegalAnalysisClientOptions {
  caseId: string;
  token?: string;
  signal?: AbortSignal;
  language?: string;
}

/**
 * Requests statutory legal analysis from the backend for a saved grievance case.
 * - POSTs to /api/gemini/legal-analysis with Authorization: Bearer <token>.
 * - Sends { caseId } in the request body (plus optional language when provided).
 * - Reuses getValidAccessToken() if token is not passed explicitly.
 * - Uses fetchWithTimeout with a 45-second client timeout.
 * - Forwards AbortSignal for immediate caller-triggered cancellation.
 * - Validates non-2xx HTTP responses and malformed or invalid response payloads.
 *
 * @param options Object containing caseId, and optional token, signal, or language.
 * @param explicitToken Optional access token (overrides options.token if provided).
 * @param explicitSignal Optional AbortSignal (overrides options.signal if provided).
 */
export async function requestLegalAnalysis(
  options: LegalAnalysisClientOptions,
  explicitToken?: string,
  explicitSignal?: AbortSignal
): Promise<LegalAnalysisResponse> {
  if (!options || typeof options !== 'object') {
    throw new Error('Invalid options: Options object is required.');
  }

  const caseId = typeof options.caseId === 'string' ? options.caseId.trim() : '';
  if (!caseId) {
    throw new Error('Invalid caseId: caseId must be a non-empty string.');
  }

  // Resolve authorization token: caller explicit token -> options.token -> getValidAccessToken()
  const rawToken = explicitToken ?? options.token;
  let token = typeof rawToken === 'string' ? rawToken.trim() : '';

  if (!token) {
    const fetchedToken = await getValidAccessToken();
    if (typeof fetchedToken === 'string' && fetchedToken.trim()) {
      token = fetchedToken.trim();
    }
  }

  if (!token) {
    throw new Error('Authentication required: No valid session token available. Please sign in.');
  }

  const signal = explicitSignal ?? options.signal;
  const payload: Record<string, string> = { caseId };
  if (typeof options.language === 'string' && options.language.trim()) {
    payload.language = options.language.trim();
  }

  // Dispatch HTTP request using existing fetchWithTimeout utility with 45s timeout
  const response = await fetchWithTimeout(
    LEGAL_ANALYSIS_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal,
    },
    LEGAL_ANALYSIS_CLIENT_TIMEOUT_MS
  );

  // Handle non-2xx responses
  if (!response.ok) {
    let errorMessage = `Legal analysis request failed with HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody === 'object') {
        if (typeof errorBody.message === 'string' && errorBody.message.trim()) {
          errorMessage = errorBody.message.trim();
        } else if (typeof errorBody.error === 'string' && errorBody.error.trim()) {
          errorMessage = errorBody.error.trim();
        }
      }
    } catch {
      // Body is not JSON
      try {
        const text = await response.text();
        if (text && text.trim() && text.length < 200) {
          errorMessage = `${errorMessage}: ${text.trim()}`;
        }
      } catch {
        // Ignore text read error
      }
    }
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    throw error;
  }

  // Parse and validate response JSON
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error('Failed to parse legal analysis response: Server returned malformed JSON.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid legal analysis response: Response body must be an object.');
  }

  if (data.success !== true) {
    const errMsg =
      typeof data.message === 'string' && data.message.trim()
        ? data.message.trim()
        : 'Legal analysis failed: Server returned success = false.';
    throw new Error(errMsg);
  }

  if (typeof data.synthesis !== 'string') {
    throw new Error('Invalid legal analysis response: Missing or invalid "synthesis" string.');
  }

  if (!data.findings || typeof data.findings !== 'object') {
    throw new Error('Invalid legal analysis response: Missing "findings" object.');
  }

  const {
    temporalJurisdiction,
    rbiCommercialBanksProtection,
    consumerProtectionAct,
    criminalOffencesAssessment,
  } = data.findings;

  if (
    !temporalJurisdiction ||
    typeof temporalJurisdiction !== 'object' ||
    !rbiCommercialBanksProtection ||
    typeof rbiCommercialBanksProtection !== 'object' ||
    !consumerProtectionAct ||
    typeof consumerProtectionAct !== 'object' ||
    !criminalOffencesAssessment ||
    typeof criminalOffencesAssessment !== 'object'
  ) {
    throw new Error('Invalid legal analysis response: Incomplete statutory findings payload.');
  }

  return data as LegalAnalysisResponse;
}
