/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple in-memory localStorage polyfill for Node test runner
class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null { return this.store[key] ?? null; }
  setItem(key: string, value: string): void { this.store[key] = String(value); }
  removeItem(key: string): void { delete this.store[key]; }
  clear(): void { this.store = {}; }
}
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new MockLocalStorage();
}

import {
  EVIDENCE_BUCKET,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  sanitizeStorageFileName,
  validateEvidenceFile,
  buildEvidenceStoragePath,
  uploadEvidenceBlob,
  downloadEvidenceBlob,
  createEvidenceSignedUrl,
  verifyEvidenceBytes,
} from '../src/utils/evidenceStorage';
import { supabase, createIsolatedClient } from '../src/utils/supabaseClient';
import { saveCase, softDeleteCase, getAuthoritativeUserId } from '../src/utils/caseRepository';
import { calculateSha256 } from '../src/utils/caseStorage';
import { GrievanceCase, EvidenceItem, CustodyEvent } from '../src/types';
import { INITIAL_CASES } from '../src/sampleData';
import { executeEvidenceUploadWithParentPersistence } from '../src/components/CaseBuilder';

console.log('=== NivaranSetu Milestone 2, Step 4: Private Evidence Storage Test Suite ===\n');

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName} | Expected: ${JSON.stringify(expected)} | Got: ${JSON.stringify(actual)}`);
    failedCount++;
  }
}

const TEST_USER_A = 'a0000000-0000-4000-8000-000000000001';
const TEST_USER_B = 'b0000000-0000-4000-8000-000000000002';
const TEST_CASE_ID = 'NS-2026-TEST';
const TEST_EVID_ID = 'ev-test-1001';

// Standard storage regex defined in 01_fresh_install.sql (lines 790, 810, 840, 856)
const STORAGE_PATH_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\/[a-zA-Z0-9_-]{3,64}\/[a-zA-Z0-9_-]{3,64}\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127}$/;
const FILE_NAME_REGEX = /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127}$/;

function createMockSession(userId: string, expiresInSec = 3600) {
  return {
    data: {
      session: {
        access_token: `mock_jwt_${userId}`,
        user: { id: userId, email: `${userId}@example.com` },
        expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
      },
    },
    error: null,
  };
}

async function runTests() {
  const origGetSession = supabase.auth.getSession.bind(supabase.auth);
  const origFrom = supabase.from.bind(supabase);
  const origStorage = supabase.storage;

  try {
    // =========================================================================
    // SECTION 1: Policy Configuration & Client Validation
    // =========================================================================
    console.log('--- SECTION 1: Policy Configuration & Client Validation ---');

    assert(EVIDENCE_BUCKET === 'evidence', '1.1: Storage bucket is configured strictly as "evidence"');
    assert(MAX_FILE_SIZE_BYTES === 26_214_400, '1.2: Maximum file size limit is strictly 25 MiB (26,214,400 bytes)');
    assert(ALLOWED_MIME_TYPES.includes('application/pdf'), '1.3: Allowed MIME types include application/pdf');
    assert(ALLOWED_MIME_TYPES.includes('image/png'), '1.4: Allowed MIME types include image/png');
    assert(ALLOWED_MIME_TYPES.includes('image/jpeg'), '1.5: Allowed MIME types include image/jpeg');
    assert(ALLOWED_MIME_TYPES.includes('image/webp'), '1.6: Allowed MIME types include image/webp');

    // Valid files pass validation
    let validationPassed = true;
    try {
      validateEvidenceFile({ name: 'bill.pdf', size: 1024 * 1024, type: 'application/pdf' });
      validateEvidenceFile({ name: 'receipt.png', size: 500 * 1024, type: 'image/png' });
      validateEvidenceFile({ name: 'photo.jpg', size: 2 * 1024 * 1024, type: 'image/jpeg' });
      validateEvidenceFile({ name: 'scan.webp', size: 3 * 1024 * 1024, type: 'image/webp' });
    } catch {
      validationPassed = false;
    }
    assert(validationPassed, '1.7: Valid PDF, PNG, JPEG, and WebP files within 25 MiB pass validation');

    // Reject file exceeding 25 MiB
    let sizeError: string | null = null;
    try {
      validateEvidenceFile({ name: 'oversized.pdf', size: 26_214_401, type: 'application/pdf' });
    } catch (e: any) {
      sizeError = e.message;
    }
    assert(
      sizeError !== null && sizeError.includes('FILE_TOO_LARGE'),
      '1.8: File exceeding 25 MiB is rejected with FILE_TOO_LARGE'
    );

    // Reject empty (0-byte) file
    let emptyError: string | null = null;
    try {
      validateEvidenceFile({ name: 'empty.pdf', size: 0, type: 'application/pdf' });
    } catch (e: any) {
      emptyError = e.message;
    }
    assert(
      emptyError !== null && emptyError.includes('FILE_EMPTY'),
      '1.9: Empty file (0 bytes) is rejected with FILE_EMPTY'
    );

    // Reject unsupported MIME types
    let mimeError: string | null = null;
    try {
      validateEvidenceFile({ name: 'malicious.exe', size: 1024, type: 'application/x-msdownload' });
    } catch (e: any) {
      mimeError = e.message;
    }
    assert(
      mimeError !== null && mimeError.includes('UNSUPPORTED_FILE_TYPE'),
      '1.10: Disallowed MIME type (.exe) is rejected with UNSUPPORTED_FILE_TYPE'
    );

    let scriptError: string | null = null;
    try {
      validateEvidenceFile({ name: 'attack.js', size: 1024, type: 'text/javascript' });
    } catch (e: any) {
      scriptError = e.message;
    }
    assert(
      scriptError !== null && scriptError.includes('UNSUPPORTED_FILE_TYPE'),
      '1.11: Disallowed MIME type (.js) is rejected with UNSUPPORTED_FILE_TYPE'
    );

    // =========================================================================
    // SECTION 2: Safe Filename Sanitization & Path Regex Compliance
    // =========================================================================
    console.log('\n--- SECTION 2: Safe Filename Sanitization & Path Regex Compliance ---');

    const testNames = [
      { input: 'simple.pdf', expected: 'simple.pdf' },
      { input: 'bank passbook (oct 2026) [copy].pdf', expected: 'bank_passbook_oct_2026_copy.pdf' },
      { input: 'threat sms header & log.png', expected: 'threat_sms_header_log.png' },
      { input: '../../etc/passwd.png', expected: 'etc_passwd.png' },
      { input: '..//..//file..name.pdf', expected: 'file.name.pdf' },
      { input: '___leading_and_trailing___receipt.jpg', expected: 'leading_and_trailing_receipt.jpg' },
      { input: 'a'.repeat(200) + '.pdf', maxLen: 128 },
    ];

    for (const t of testNames) {
      const sanitized = sanitizeStorageFileName(t.input);
      assert(
        FILE_NAME_REGEX.test(sanitized),
        `2.1: Sanitized name "${sanitized}" matches PostgreSQL storage policy regex`
      );
      assert(!sanitized.includes('..'), `2.2: Sanitized name "${sanitized}" contains no ".." sequence`);
      assert(sanitized.length <= 128, `2.3: Sanitized name "${sanitized}" is within 128 chars limit`);
    }

    // =========================================================================
    // SECTION 3: Storage Path Construction & RLS Boundary Matching
    // =========================================================================
    console.log('\n--- SECTION 3: Storage Path Construction & RLS Boundary Matching ---');

    const constructedPath = buildEvidenceStoragePath(
      TEST_USER_A,
      TEST_CASE_ID,
      TEST_EVID_ID,
      'bank statement (oct 2026).pdf'
    );

    assert(
      STORAGE_PATH_REGEX.test(constructedPath),
      '3.1: Constructed storage path strictly satisfies PostgreSQL storage.objects RLS regex',
      constructedPath
    );
    assert(!constructedPath.includes('..'), '3.2: Storage path contains no ".." traversal sequences');
    assert(
      constructedPath.startsWith(`${TEST_USER_A}/${TEST_CASE_ID}/${TEST_EVID_ID}/`),
      '3.3: Storage path strictly follows {user_id}/{case_id}/{evidence_id}/{file_name}'
    );

    // Rejection of invalid user UUID
    let badUserErr: string | null = null;
    try {
      buildEvidenceStoragePath('not-a-uuid', TEST_CASE_ID, TEST_EVID_ID, 'receipt.pdf');
    } catch (e: any) {
      badUserErr = e.message;
    }
    assert(
      badUserErr !== null && badUserErr.includes('INVALID_UUID'),
      '3.4: buildEvidenceStoragePath rejects invalid user UUID format'
    );

    // Rejection of invalid case ID
    let badCaseErr: string | null = null;
    try {
      buildEvidenceStoragePath(TEST_USER_A, '', TEST_EVID_ID, 'receipt.pdf');
    } catch (e: any) {
      badCaseErr = e.message;
    }
    assert(
      badCaseErr !== null && badCaseErr.includes('INVALID_CASE_ID'),
      '3.5: buildEvidenceStoragePath rejects empty case ID'
    );

    // =========================================================================
    // SECTION 4: Cross-Tenant Access Boundary & Ownership Protection
    // =========================================================================
    console.log('\n--- SECTION 4: Cross-Tenant Access Boundary & Ownership Protection ---');

    supabase.auth.getSession = (async () => createMockSession(TEST_USER_A)) as any;

    // User A attempting to download User B's file path
    const userBStorageRef = `${TEST_USER_B}/NS-2026-OTHER/ev-secret/statement.pdf`;

    let crossDownloadErr: string | null = null;
    try {
      await downloadEvidenceBlob(userBStorageRef);
    } catch (e: any) {
      crossDownloadErr = e.message;
    }
    assert(
      crossDownloadErr !== null && crossDownloadErr.includes('EVIDENCE_ACCESS_DENIED'),
      '4.1: downloadEvidenceBlob strictly rejects access to another user storage path with EVIDENCE_ACCESS_DENIED'
    );

    // User A attempting to generate signed URL for User B's file path
    let crossSignedUrlErr: string | null = null;
    try {
      await createEvidenceSignedUrl(userBStorageRef);
    } catch (e: any) {
      crossSignedUrlErr = e.message;
    }
    assert(
      crossSignedUrlErr !== null && crossSignedUrlErr.includes('EVIDENCE_ACCESS_DENIED'),
      '4.2: createEvidenceSignedUrl strictly rejects cross-tenant URL generation with EVIDENCE_ACCESS_DENIED'
    );

    // =========================================================================
    // SECTION 5: Upload Operations & Cryptographic Hash Integrity
    // =========================================================================
    console.log('\n--- SECTION 5: Upload Operations & Cryptographic Hash Integrity ---');

    const fakePdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]); // %PDF-1.5 header
    const mockFile = new Blob([fakePdfBytes], { type: 'application/pdf' });
    const expectedHash = await calculateSha256(mockFile);

    let storageUploadedPath = '';
    let storageUploadedBucket = '';
    let storageUploadedOptions: any = null;

    const mockStorageClient: any = {
      auth: {
        getSession: async () => createMockSession(TEST_USER_A),
        refreshSession: async () => createMockSession(TEST_USER_A),
      },
      storage: {
        from: (bucket: string) => {
          storageUploadedBucket = bucket;
          return {
            upload: async (path: string, file: any, options: any) => {
              storageUploadedPath = path;
              storageUploadedOptions = options;
              return { data: { path }, error: null };
            },
          };
        },
      },
    };

    const uploadRes = await uploadEvidenceBlob({
      caseId: TEST_CASE_ID,
      evidenceId: TEST_EVID_ID,
      file: mockFile,
      fileName: 'bank_statement.pdf',
      client: mockStorageClient,
    });

    assert(storageUploadedBucket === 'evidence', '5.1: Upload targeted bucket "evidence"');
    assert(storageUploadedPath.startsWith(`${TEST_USER_A}/${TEST_CASE_ID}/${TEST_EVID_ID}/`), '5.2: Upload path contains verified user ID and case ID');
    assert(uploadRes.sha256Hash === expectedHash, '5.3: Calculated SHA-256 digest matches exact binary stream hash');
    assert(uploadRes.storageRef === storageUploadedPath, '5.4: Returned storageRef matches storage path exactly');
    assert(storageUploadedOptions?.upsert === false, '5.5: Storage upload enforces upsert: false (preventing accidental overwrites)');

    // Failure during storage upload rejects without pretend success or fallback to localStorage
    const failingStorageClient: any = {
      auth: {
        getSession: async () => createMockSession(TEST_USER_A),
        refreshSession: async () => createMockSession(TEST_USER_A),
      },
      storage: {
        from: () => ({
          upload: async () => ({ data: null, error: { message: 'Cloud storage connection timeout' } }),
        }),
      },
    };

    let uploadFailErr: string | null = null;
    try {
      await uploadEvidenceBlob({
        caseId: TEST_CASE_ID,
        evidenceId: TEST_EVID_ID,
        file: mockFile,
        fileName: 'bank_statement.pdf',
        client: failingStorageClient,
      });
    } catch (e: any) {
      uploadFailErr = e.message;
    }

    assert(
      uploadFailErr !== null && uploadFailErr.includes('EVIDENCE_UPLOAD_FAILED'),
      '5.6: Storage upload failure rejects with EVIDENCE_UPLOAD_FAILED without silent fallback'
    );

    // =========================================================================
    // SECTION 6: Download & Binary Byte Verification
    // =========================================================================
    console.log('\n--- SECTION 6: Download & Binary Byte Verification ---');

    const downloadMockClient: any = {
      auth: {
        getSession: async () => createMockSession(TEST_USER_A),
        refreshSession: async () => createMockSession(TEST_USER_A),
      },
      storage: {
        from: () => ({
          download: async (path: string) => {
            if (path.includes('tampered')) {
              // Return altered bytes
              return { data: new Blob([new Uint8Array([0x99, 0x99])], { type: 'application/pdf' }), error: null };
            }
            // Return authentic bytes
            return { data: mockFile, error: null };
          },
        }),
      },
    };

    const validStorageRef = `${TEST_USER_A}/${TEST_CASE_ID}/${TEST_EVID_ID}/bank_statement.pdf`;

    // 6.1: Successful download returns authentic binary Blob
    const downloadedBlob = await downloadEvidenceBlob(validStorageRef, downloadMockClient);
    assert(downloadedBlob !== null && downloadedBlob.size === mockFile.size, '6.1: downloadEvidenceBlob returns downloaded Blob');

    // 6.2: Byte verification matching authentic stream
    const verifyMatch = await verifyEvidenceBytes(validStorageRef, expectedHash, downloadMockClient);
    assert(verifyMatch.verified === true && verifyMatch.status === 'matched', '6.2: verifyEvidenceBytes confirms cryptographic match on authentic bytes');

    // 6.3: Byte verification detecting tampering
    const tamperedStorageRef = `${TEST_USER_A}/${TEST_CASE_ID}/${TEST_EVID_ID}/tampered_statement.pdf`;
    const verifyTampered = await verifyEvidenceBytes(tamperedStorageRef, expectedHash, downloadMockClient);
    assert(verifyTampered.verified === false && verifyTampered.status === 'mismatched', '6.3: verifyEvidenceBytes detects byte alteration and flags "mismatched"');

    // 6.4: Byte verification on absent hash
    const verifyNoHash = await verifyEvidenceBytes(validStorageRef, null, downloadMockClient);
    assert(verifyNoHash.verified === false && verifyNoHash.status === 'no_expected_hash', '6.4: verifyEvidenceBytes returns "no_expected_hash" when expected hash is null');

    // =========================================================================
    // SECTION 7: Authorized Signed URL Generation
    // =========================================================================
    console.log('\n--- SECTION 7: Authorized Signed URL Generation ---');

    let signedUrlExpiryRequested = 0;
    const signedUrlMockClient: any = {
      auth: {
        getSession: async () => createMockSession(TEST_USER_A),
        refreshSession: async () => createMockSession(TEST_USER_A),
      },
      storage: {
        from: (bucket: string) => ({
          createSignedUrl: async (path: string, expiresIn: number) => {
            signedUrlExpiryRequested = expiresIn;
            return {
              data: { signedUrl: `https://project.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=signed_token_123` },
              error: null,
            };
          },
        }),
      },
    };

    const signedUrl = await createEvidenceSignedUrl(validStorageRef, 3600, signedUrlMockClient);
    assert(signedUrl.includes('signed_token_123'), '7.1: createEvidenceSignedUrl returns authorized signed URL');
    assert(signedUrlExpiryRequested === 3600, '7.2: Signed URL requested with requested expiration window (3600s)');

    // =========================================================================
    // SECTION 8: Soft-Deletion & Immutable Custody Preservation
    // =========================================================================
    console.log('\n--- SECTION 8: Soft-Deletion & Immutable Custody Preservation ---');

    let storageDeleteCalled = false;
    let evidenceItemUpdatePayload: any = null;

    const deletionTrackingClient: any = {
      auth: {
        getSession: async () => createMockSession(TEST_USER_A),
        refreshSession: async () => createMockSession(TEST_USER_A),
      },
      from: (tableName: string) => {
        return {
          update: (payload: any) => {
            if (tableName === 'evidence_items') {
              evidenceItemUpdatePayload = payload;
            }
            return {
              eq: () => ({
                eq: () => ({
                  is: () => Promise.resolve({ error: null }),
                }),
                is: () => Promise.resolve({ error: null }),
              }),
            };
          },
        };
      },
      storage: {
        from: () => ({
          remove: async () => {
            storageDeleteCalled = true;
            return { data: [], error: null };
          },
        }),
      },
    };

    // Soft-deleting a case soft-deletes evidence_items metadata via deleted_at
    await softDeleteCase(TEST_CASE_ID, deletionTrackingClient);
    assert(
      evidenceItemUpdatePayload !== null && typeof evidenceItemUpdatePayload.deleted_at === 'string',
      '8.1: softDeleteCase updates evidence_items with deleted_at timestamp'
    );
    assert(
      storageDeleteCalled === false,
      '8.2: Direct client storage DELETE is NEVER called (preserving forensic audit trail and obeying restrictive policy)'
    );

    // =========================================================================
    // SECTION 9: Parent-Before-Upload Sequencing & Regression Tests
    // =========================================================================
    console.log('\n--- SECTION 9: Parent-Before-Upload Sequencing & Regression Tests ---');

    // 9.1: New case: parent save completes strictly before Storage upload
    const executionTrace: string[] = [];
    const mockCaseIdNew = 'NS-2026-NEW-999';
    const mockFile1 = { name: 'bank_statement.pdf', size: 1024, type: 'application/pdf' };

    const mockBuildCaseRecord = (evidence: EvidenceItem[], custody: CustodyEvent[]): GrievanceCase => ({
      ...INITIAL_CASES[0],
      id: mockCaseIdNew,
      title: 'New Complaint for Testing',
      evidence,
      custodyEvents: custody,
    });

    const resNewCase = await executeEvidenceUploadWithParentPersistence({
      caseId: mockCaseIdNew,
      files: [mockFile1],
      existingEvidence: [],
      existingCustodyEvents: [],
      incidentDate: '2026-11-01',
      disputedAmount: 4500,
      involvedEntity: 'HDFC Bank',
      buildCaseRecord: mockBuildCaseRecord,
      onSaveCase: async (c) => {
        executionTrace.push(`onSaveCase:caseId=${c.id}:evCount=${c.evidence?.length ?? 0}`);
        return true;
      },
      uploadBlobFn: async (params) => {
        executionTrace.push(`uploadBlobFn:evId=${params.evidenceId}`);
        return {
          storageRef: `${TEST_USER_A}/${params.caseId}/${params.evidenceId}/${params.fileName}`,
          sha256Hash: 'a'.repeat(64),
          fileSizeBytes: 1024,
          fileSizeFormatted: '1.0 KB',
          fileType: 'application/pdf',
          fileName: params.fileName,
        };
      },
    });

    assert(resNewCase.parentSaved === true, '9.1: New case: parent save marked as succeeded');
    assert(resNewCase.uploadedCount === 1, '9.1: New case: 1 file uploaded');
    assert(
      executionTrace[0] === `onSaveCase:caseId=${mockCaseIdNew}:evCount=0`,
      '9.1: New case: parent save completed strictly before first Storage upload'
    );
    assert(
      executionTrace[1].startsWith('uploadBlobFn:evId='),
      '9.1: New case: Storage upload occurred after parent save'
    );
    assert(
      executionTrace[2] === `onSaveCase:caseId=${mockCaseIdNew}:evCount=1`,
      '9.1: New case: exhibit metadata persisted after Storage upload'
    );

    // 9.2: Existing case: upload works with an already-persisted parent
    const resExistingCase = await executeEvidenceUploadWithParentPersistence({
      caseId: TEST_CASE_ID,
      files: [mockFile1],
      existingEvidence: [],
      existingCustodyEvents: [],
      incidentDate: '2026-11-01',
      disputedAmount: 4500,
      involvedEntity: 'HDFC Bank',
      buildCaseRecord: mockBuildCaseRecord,
      onSaveCase: async () => true,
      uploadBlobFn: async (params) => ({
        storageRef: `${TEST_USER_A}/${params.caseId}/${params.evidenceId}/${params.fileName}`,
        sha256Hash: 'b'.repeat(64),
        fileSizeBytes: 1024,
        fileSizeFormatted: '1.0 KB',
        fileType: 'application/pdf',
        fileName: params.fileName,
      }),
    });
    assert(resExistingCase.success === true, '9.2: Existing case: upload succeeds cleanly');
    assert(resExistingCase.parentSaved === true, '9.2: Existing case: parent verified/saved');
    assert(resExistingCase.uploadedCount === 1, '9.2: Existing case: uploaded count matches');

    // 9.3: Parent save failure: zero Storage uploads attempted
    let uploadAttemptCount = 0;
    let noticeMessage: string | null = null;
    const resParentFail = await executeEvidenceUploadWithParentPersistence({
      caseId: 'NS-FAIL-001',
      files: [mockFile1],
      existingEvidence: [],
      existingCustodyEvents: [],
      incidentDate: '2026-11-01',
      disputedAmount: 4500,
      involvedEntity: 'HDFC Bank',
      buildCaseRecord: mockBuildCaseRecord,
      onSaveCase: async () => false, // Database refuses save
      uploadBlobFn: async () => {
        uploadAttemptCount++;
        return {} as any;
      },
      onNotice: (n) => { noticeMessage = n; },
    });

    assert(uploadAttemptCount === 0, '9.3: Parent save failure: zero Storage uploads attempted');
    assert(resParentFail.success === false, '9.3: Parent save failure returns success = false');
    assert(resParentFail.parentSaved === false, '9.3: parentSaved flag is false');
    assert(
      typeof noticeMessage === 'string' && (noticeMessage as string).includes('Upload aborted'),
      '9.3: Understandable error notice displayed when parent save fails'
    );

    // 9.4: Multiple files: parent is saved once before first upload, not inconsistently between files
    const multiTrace: string[] = [];
    const multiFiles = [
      { name: 'file1.pdf', size: 100, type: 'application/pdf' },
      { name: 'file2.png', size: 200, type: 'image/png' },
      { name: 'file3.pdf', size: 300, type: 'application/pdf' },
    ];

    const resMulti = await executeEvidenceUploadWithParentPersistence({
      caseId: 'NS-MULTI-001',
      files: multiFiles,
      existingEvidence: [],
      existingCustodyEvents: [],
      incidentDate: '2026-11-01',
      disputedAmount: 4500,
      involvedEntity: 'HDFC Bank',
      buildCaseRecord: mockBuildCaseRecord,
      onSaveCase: async (c) => {
        multiTrace.push(`saveCase:${c.evidence?.length ?? 0}`);
        return true;
      },
      uploadBlobFn: async (params) => {
        multiTrace.push(`upload:${params.fileName}`);
        return {
          storageRef: `${TEST_USER_A}/NS-MULTI-001/${params.evidenceId}/${params.fileName}`,
          sha256Hash: 'c'.repeat(64),
          fileSizeBytes: 100,
          fileSizeFormatted: '100 B',
          fileType: 'application/pdf',
          fileName: params.fileName,
        };
      },
    });

    assert(
      multiTrace[0] === 'saveCase:0',
      '9.4: Multiple files: parent saved exactly once before first upload'
    );
    assert(
      multiTrace[1] === 'upload:file1.pdf' &&
      multiTrace[2] === 'upload:file2.png' &&
      multiTrace[3] === 'upload:file3.pdf',
      '9.4: Multiple files: all 3 files uploaded sequentially without duplicate parent saves in between'
    );
    assert(
      multiTrace[4] === 'saveCase:3',
      '9.4: Multiple files: metadata persisted once after all uploads finish'
    );
    assert(resMulti.uploadedCount === 3, '9.4: Multiple files: 3 uploaded files recorded');

    // 9.5: Upload failure: no false success
    let partialNotice: string | null = null;
    const mixedFiles = [
      { name: 'good_file.pdf', size: 100, type: 'application/pdf' },
      { name: 'bad_file.pdf', size: 200, type: 'application/pdf' },
    ];

    const resMixed = await executeEvidenceUploadWithParentPersistence({
      caseId: 'NS-MIXED-001',
      files: mixedFiles,
      existingEvidence: [],
      existingCustodyEvents: [],
      incidentDate: '2026-11-01',
      disputedAmount: 4500,
      involvedEntity: 'HDFC Bank',
      buildCaseRecord: mockBuildCaseRecord,
      onSaveCase: async () => true,
      uploadBlobFn: async (params) => {
        if (params.fileName === 'bad_file.pdf') {
          throw new Error('STORAGE_TIMEOUT: Private storage timed out.');
        }
        return {
          storageRef: `${TEST_USER_A}/NS-MIXED-001/${params.evidenceId}/${params.fileName}`,
          sha256Hash: 'd'.repeat(64),
          fileSizeBytes: 100,
          fileSizeFormatted: '100 B',
          fileType: 'application/pdf',
          fileName: params.fileName,
        };
      },
      onNotice: (n) => { partialNotice = n; },
    });

    assert(resMixed.uploadedCount === 1, '9.5: Mixed files: uploadedCount reflects only successful upload');
    assert(resMixed.failedCount === 1, '9.5: Mixed files: failedCount reflects failed upload');
    assert(resMixed.newEvidence.length === 1, '9.5: Only 1 exhibit registered in newEvidence');
    assert(resMixed.newEvidence[0].fileName === 'good_file.pdf', '9.5: Failed exhibit is NOT in newEvidence');
    assert(
      typeof partialNotice === 'string' && (partialNotice as string).includes('Partially preserved'),
      '9.5: Notice explicitly reports partial failure rather than false complete success'
    );

    // 9.6: Existing draft content remains intact after failure
    const existingExhibits: EvidenceItem[] = [
      {
        id: 'ev-prev-1',
        title: 'Original Statement',
        category: 'bank_statement',
        fileName: 'orig.pdf',
        fileSize: '500 KB',
        fileSizeBytes: 512000,
        fileType: 'application/pdf',
        uploadDate: '2026-10-15',
        sha256Hash: 'e'.repeat(64),
        storageRef: `${TEST_USER_A}/NS-INTACT/ev-prev-1/orig.pdf`,
        hasBlob: true,
        ocrExtracted: { dates: [], amounts: [], identifiers: [], parties: [], summary: 'test' },
        verifiedOriginal: false,
      },
    ];

    let stateUpdatedEvidence: EvidenceItem[] | null = null;
    const resDraftIntact = await executeEvidenceUploadWithParentPersistence({
      caseId: 'NS-INTACT-001',
      files: [{ name: 'failing_file.pdf', size: 100, type: 'application/pdf' }],
      existingEvidence: existingExhibits,
      existingCustodyEvents: [],
      incidentDate: '2026-11-01',
      disputedAmount: 4500,
      involvedEntity: 'HDFC Bank',
      buildCaseRecord: mockBuildCaseRecord,
      onSaveCase: async () => false, // Parent save fails
      uploadBlobFn: async () => ({} as any),
      onUpdateEvidence: (items) => { stateUpdatedEvidence = items; },
    });

    assert(resDraftIntact.success === false, '9.6: Failed upload reports failure');
    assert(stateUpdatedEvidence === null, '9.6: onUpdateEvidence not called with corrupted data on parent failure');
    assert(existingExhibits.length === 1, '9.6: Existing exhibits array remains completely intact');
    assert(existingExhibits[0].id === 'ev-prev-1', '9.6: Existing exhibit fields unaffected by upload failure');

    // =========================================================================
    // SECTION 10: Opt-in Live Supabase Storage Test
    // =========================================================================
    console.log('\n--- SECTION 10: Opt-in Live Supabase Storage Test ---');

    if (process.env.RUN_SUPABASE_INTEGRATION_TEST === 'true') {
      console.log('[RUN] Executing live Supabase storage integration test...');
      const testEmail = process.env.SUPABASE_TEST_EMAIL?.trim();
      const testPassword = process.env.SUPABASE_TEST_PASSWORD?.trim();

      if (!testEmail || !testPassword) {
        throw new Error('SAFETY_ABORT: Credentials required for live storage test.');
      }

      const liveClient = createIsolatedClient();
      const { data: authData, error: authErr } = await liveClient.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      if (authErr || !authData?.user?.id) {
        throw new Error(`Live test authentication failed: ${authErr?.message}`);
      }

      const liveUserId = authData.user.id;
      const liveCaseId = `NS-INT-${Date.now()}`;
      const liveEvidId = `ev-live-${Date.now()}`;

      // 1. First ensure parent case exists in grievance_cases (required by storage policy RLS)
      const liveCase: GrievanceCase = {
        ...INITIAL_CASES[0],
        id: liveCaseId,
        title: 'Live Storage Test Case',
        isSampleData: true,
      };
      await saveCase(liveCase, liveClient);

      let liveTestError: any = null;
      let cleanupError: any = null;

      try {
        // 2. Upload synthetic PDF bytes
        const uploadResult = await uploadEvidenceBlob({
          caseId: liveCaseId,
          evidenceId: liveEvidId,
          file: mockFile,
          fileName: 'live_test_receipt.pdf',
          client: liveClient,
        });

        assert(uploadResult.storageRef.startsWith(`${liveUserId}/${liveCaseId}/${liveEvidId}/`), '9.1: Live upload succeeded with canonical path');

        // 3. Download bytes and verify match
        const downloadedBytes = await downloadEvidenceBlob(uploadResult.storageRef, liveClient);
        const downloadedHash = await calculateSha256(downloadedBytes);
        assert(downloadedHash === uploadResult.sha256Hash, '9.2: Live downloaded bytes SHA-256 matches uploaded hash');

        // 4. Generate signed URL
        const liveSignedUrl = await createEvidenceSignedUrl(uploadResult.storageRef, 600, liveClient);
        assert(liveSignedUrl.startsWith('https://'), '9.3: Live signed URL generated successfully');
      } catch (err: any) {
        liveTestError = err;
      } finally {
        // Cleanup via soft delete
        try {
          await softDeleteCase(liveCaseId, liveClient);
          assert(true, '9.4: Live storage test case soft-deleted in finally block');
        } catch (cErr: any) {
          cleanupError = cErr;
        }

        if (liveTestError && cleanupError) {
          assert(false, `Live storage test failed: ${liveTestError.message} | Cleanup error: ${cleanupError.message}`);
        } else if (liveTestError) {
          assert(false, `Live storage test failed: ${liveTestError.message}`);
        } else if (cleanupError) {
          assert(false, `Live storage cleanup failed: ${cleanupError.message}`);
        }
      }
    } else {
      console.log('[SKIP] Live Supabase Storage integration test skipped (opt-in via RUN_SUPABASE_INTEGRATION_TEST=true)');
    }

  } finally {
    supabase.auth.getSession = origGetSession;
    supabase.from = origFrom;
    (supabase as any).storage = origStorage;
  }
}

runTests().then(() => {
  console.log(`\n======================================================`);
  console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
  console.log(`======================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}).catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
