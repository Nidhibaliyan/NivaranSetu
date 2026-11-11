/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { getAuthoritativeUserId } from './caseRepository';
import { assertValidUserUuid, assertValidCaseId } from './caseMappers';
import { calculateSha256, formatFileSize } from './caseStorage';
import { EvidenceItem } from '../types';

/**
 * Storage configuration matching the Supabase migration definition in 01_fresh_install.sql.
 */
export const EVIDENCE_BUCKET = 'evidence';
export const MAX_FILE_SIZE_BYTES = 26_214_400; // 25 MiB (25 * 1024 * 1024)

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_EXTENSIONS = ['.pdf', '.jpeg', '.jpg', '.png', '.webp'] as const;

export interface UploadEvidenceParams {
  caseId: string;
  evidenceId: string;
  file: File | Blob;
  fileName: string;
  category?: EvidenceItem['category'];
  title?: string;
  client?: SupabaseClient;
}

export interface UploadEvidenceResult {
  storageRef: string;
  sha256Hash: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  fileType: string;
  fileName: string;
}

export interface VerifyEvidenceBytesResult {
  verified: boolean;
  computedHash: string;
  status: 'matched' | 'mismatched' | 'blob_not_found' | 'no_expected_hash';
}

/**
 * Sanitizes a file name to strictly conform to the PostgreSQL storage policy regex:
 *   ^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127}$
 * and ensures the path does not contain '..' traversal sequences.
 */
export function sanitizeStorageFileName(rawFileName: string): string {
  if (!rawFileName || !rawFileName.trim()) {
    return 'evidence_file.bin';
  }

  // Remove any directory traversal or path prefixes
  const baseOnly = rawFileName.replace(/^.*[\\/]/, '').trim();

  // Extract base name and extension
  const lastDotIndex = baseOnly.lastIndexOf('.');
  let baseName = lastDotIndex >= 0 ? baseOnly.substring(0, lastDotIndex) : baseOnly;
  let ext = lastDotIndex >= 0 ? baseOnly.substring(lastDotIndex).toLowerCase() : '';

  // Sanitize baseName: replace any character not in [a-zA-Z0-9_-] with '_'
  baseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  // Collapse multiple underscores and trim leading/trailing underscores
  baseName = baseName.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!baseName) baseName = 'evidence_file';

  // Sanitize extension: allow only alphanumeric characters
  ext = ext.replace(/[^a-zA-Z0-9.]/g, '').replace(/\.+/g, '.');

  let sanitized = `${baseName}${ext}`;

  // Ensure no '..' sequence exists
  while (sanitized.includes('..')) {
    sanitized = sanitized.replace(/\.\./g, '.');
  }

  // Ensure starts with [a-zA-Z0-9_-]
  if (!/^[a-zA-Z0-9_-]/.test(sanitized)) {
    sanitized = `file_${sanitized}`;
  }

  // Bound length to at most 128 characters to satisfy {0,127} following the first char
  if (sanitized.length > 128) {
    const extLen = ext.length;
    const maxBaseLen = Math.max(1, 128 - extLen);
    sanitized = `${baseName.substring(0, maxBaseLen)}${ext}`;
  }

  return sanitized;
}

/**
 * Validates file size and format against client-side and server-side policy constraints.
 */
export function validateEvidenceFile(file: { name: string; size: number; type: string }): void {
  if (!file) {
    throw new Error('FILE_REQUIRED: No file provided for evidence upload.');
  }

  // Enforce 25 MiB maximum file size limit
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `FILE_TOO_LARGE: File size (${formatFileSize(file.size)}) exceeds the maximum allowed limit of 25 MiB (${formatFileSize(
        MAX_FILE_SIZE_BYTES
      )}).`
    );
  }

  if (file.size <= 0) {
    throw new Error('FILE_EMPTY: Cannot upload an empty (0 byte) evidence file.');
  }

  // Enforce allowed MIME types and extensions
  const mime = file.type?.toLowerCase() || '';
  const ext = ('.' + (file.name.split('.').pop() || '')).toLowerCase();

  const isAllowedMime = ALLOWED_MIME_TYPES.some((allowed) => mime === allowed);
  const isAllowedExt = ALLOWED_EXTENSIONS.some((allowed) => ext === allowed);

  if (!isAllowedMime && !isAllowedExt) {
    throw new Error(
      `UNSUPPORTED_FILE_TYPE: File format "${file.type || ext}" is not permitted. Allowed formats: PDF, JPEG, PNG, WebP.`
    );
  }
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Builds the canonical private storage path following the exact database constraint:
 *   {user_id}/{case_id}/{evidence_id}/{file_name}
 */
export function buildEvidenceStoragePath(
  userId: string,
  caseId: string,
  evidenceId: string,
  fileName: string
): string {
  if (!userId || typeof userId !== 'string' || !UUID_REGEX.test(userId.trim())) {
    throw new Error(`INVALID_UUID: User ID "${userId}" must match standard UUID format.`);
  }
  if (!caseId || typeof caseId !== 'string' || !caseId.trim()) {
    throw new Error('INVALID_CASE_ID: A valid caseId is required.');
  }

  const cleanUserId = userId.trim();
  const cleanCaseId = caseId.trim();

  const cleanEvidenceId = (evidenceId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
  if (!cleanEvidenceId || cleanEvidenceId.length < 3) {
    throw new Error(`INVALID_EVIDENCE_ID: Evidence ID "${evidenceId}" must be at least 3 valid characters.`);
  }

  const cleanFileName = sanitizeStorageFileName(fileName);
  return `${cleanUserId}/${cleanCaseId}/${cleanEvidenceId}/${cleanFileName}`;
}

/**
 * Uploads a physical binary file to the private Supabase 'evidence' storage bucket.
 * - Obtains the authoritative user UUID strictly from the verified session (never UI input).
 * - Enforces the 25 MiB file size limit and allowed MIME types.
 * - Computes genuine SHA-256 digest on client bytes before upload.
 * - Uses the canonical storage path format {user_id}/{case_id}/{evidence_id}/{file_name}.
 * - Rejects partial failures without silently falling back to insecure or shared storage.
 */
export async function uploadEvidenceBlob(params: UploadEvidenceParams): Promise<UploadEvidenceResult> {
  const client = params.client || supabase;
  const userId = await getAuthoritativeUserId(client);

  validateEvidenceFile({
    name: params.fileName,
    size: params.file.size,
    type: params.file.type,
  });

  const sha256Hash = await calculateSha256(params.file);
  const storagePath = buildEvidenceStoragePath(userId, params.caseId, params.evidenceId, params.fileName);

  const contentType = params.file.type || 'application/octet-stream';

  const { error: uploadError } = await client.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, params.file, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(
      `EVIDENCE_UPLOAD_FAILED: Failed to upload file "${params.fileName}" to private storage: ${uploadError.message}`
    );
  }

  return {
    storageRef: storagePath,
    sha256Hash,
    fileSizeBytes: params.file.size,
    fileSizeFormatted: formatFileSize(params.file.size),
    fileType: contentType,
    fileName: params.fileName,
  };
}

/**
 * Downloads a private evidence file from Supabase Storage as a binary Blob.
 * - Strictly verifies tenant ownership before issuing the storage request.
 * - Prevents User A from attempting to access User B's storage paths.
 */
export async function downloadEvidenceBlob(
  storageRef: string,
  client: SupabaseClient = supabase
): Promise<Blob> {
  if (!storageRef || !storageRef.trim()) {
    throw new Error('STORAGE_REF_REQUIRED: storageRef must be provided to download evidence.');
  }

  const cleanRef = storageRef.trim();
  const userId = await getAuthoritativeUserId(client);

  // Tenant boundary verification: Prevent cross-user path traversal attempts
  if (!cleanRef.startsWith(`${userId}/`)) {
    throw new Error('EVIDENCE_ACCESS_DENIED: Cannot download evidence belonging to another user.');
  }

  const { data, error } = await client.storage.from(EVIDENCE_BUCKET).download(cleanRef);

  if (error || !data) {
    throw new Error(
      `EVIDENCE_DOWNLOAD_FAILED: Failed to download evidence file "${cleanRef}": ${error?.message || 'No data returned'}`
    );
  }

  return data;
}

/**
 * Generates an authorized, time-limited signed URL for viewing or previewing private evidence.
 * - Strictly enforces tenant boundary matching auth.uid().
 */
export async function createEvidenceSignedUrl(
  storageRef: string,
  expiresInSeconds: number = 3600,
  client: SupabaseClient = supabase
): Promise<string> {
  if (!storageRef || !storageRef.trim()) {
    throw new Error('STORAGE_REF_REQUIRED: storageRef must be provided to create signed URL.');
  }

  const cleanRef = storageRef.trim();
  const userId = await getAuthoritativeUserId(client);

  if (!cleanRef.startsWith(`${userId}/`)) {
    throw new Error('EVIDENCE_ACCESS_DENIED: Cannot create signed URL for evidence belonging to another user.');
  }

  const { data, error } = await client.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(cleanRef, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(
      `EVIDENCE_SIGNED_URL_FAILED: Failed to create signed URL for "${cleanRef}": ${error?.message || 'No URL returned'}`
    );
  }

  return data.signedUrl;
}

/**
 * Re-reads binary bytes directly from private Supabase Storage, re-computes the SHA-256 digest,
 * and matches it against the recorded digest.
 * - Does NOT mark verified_original = true on the database (which is reserved for server-side verification).
 */
export async function verifyEvidenceBytes(
  storageRef: string | undefined,
  expectedHash: string | null,
  client: SupabaseClient = supabase
): Promise<VerifyEvidenceBytesResult> {
  if (!expectedHash || !expectedHash.trim()) {
    return { verified: false, computedHash: '', status: 'no_expected_hash' };
  }

  if (!storageRef || !storageRef.trim()) {
    return { verified: false, computedHash: expectedHash, status: 'blob_not_found' };
  }

  try {
    const blob = await downloadEvidenceBlob(storageRef, client);
    const computedHash = await calculateSha256(blob);
    const verified = computedHash.toLowerCase() === expectedHash.trim().toLowerCase();

    return {
      verified,
      computedHash,
      status: verified ? 'matched' : 'mismatched',
    };
  } catch (err) {
    return {
      verified: false,
      computedHash: expectedHash,
      status: 'blob_not_found',
    };
  }
}
