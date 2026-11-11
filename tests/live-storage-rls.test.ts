/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — Milestone 2, Step 7, Step C4
 * Live Two-Account Cross-Tenant Storage Row-Level Security (RLS) Isolation Test Suite
 *
 * Scope:
 * - Runs only when explicitly opted in via RUN_SUPABASE_INTEGRATION_TEST=true.
 * - Authenticates two independent in-memory clients: QA Account A and QA Account B.
 * - Encloses both authentication and test execution in a master try/finally lifecycle.
 * - Uses dedicated credentials:
 *     Account A: SUPABASE_TEST_EMAIL, SUPABASE_TEST_PASSWORD
 *     Account B: SUPABASE_TEST_EMAIL_2, SUPABASE_TEST_PASSWORD_2
 * - Strictly verifies:
 *     C4.0: Account A and Account B authenticate with distinct Supabase UUIDs (aborts if identical)
 *     C4.1: Account A persists active parent case (isSampleData: false, satisfying storage RLS foreign key)
 *     C4.2: Account A uploads synthetic PDF with canonical path and verified client SHA-256
 *     C4.3: Account A downloads blob and verifies byte SHA-256 matches uploaded hash
 *     C4.4: Account A generates authorized signed URL with 60s expiry (URL unexposed)
 *     C4.5: Account B helper calls rejected by client-side tenant boundary guards
 *     C4.6: Account B direct Storage API download rejected by database RLS (error returned, null data)
 *     C4.7: Account B direct Storage API signed URL request rejected by database RLS
 *     C4.8: Account B direct Storage API list returns 0 objects (Account A objects hidden by RLS)
 *     C4.9: Account B direct Storage upload into Account A path rejected by database RLS
 *     C4.10: Account A soft-deletes parent case in finally, confirming deleted_at is a non-empty string
 *     C4.11: Direct download by Account A revoked after parent case soft-delete (evidence_bucket_restrict_select)
 *     C4.12: Generating NEW signed URL by Account A blocked after parent case soft-delete
 *     C4.13: Both clients sign out cleanly without ambient token retention (inspected & never swallowed)
 *
 * Safety Invariants:
 * - NEVER uses service-role credentials.
 * - NEVER calls storage.from('evidence').remove() or any physical deletion operation.
 * - NEVER touches real citizen records or past synthetic test fixtures.
 * - Partial writes safely handled by scoped cleanup in finally block.
 * - All writes scoped strictly to timestamped ID: NS-C4-<timestamp>.
 */

// Simple in-memory localStorage polyfill for Node test runner
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new MockLocalStorage();
}

import {
  saveCase,
  fetchCases,
  softDeleteCase,
  getAuthoritativeUserId,
} from '../src/utils/caseRepository';
import {
  uploadEvidenceBlob,
  downloadEvidenceBlob,
  createEvidenceSignedUrl,
  EVIDENCE_BUCKET,
} from '../src/utils/evidenceStorage';
import { createIsolatedClient } from '../src/utils/supabaseClient';
import { assertValidUserUuid } from '../src/utils/caseMappers';
import { calculateSha256 } from '../src/utils/caseStorage';
import { GrievanceCase } from '../src/types';
import { INITIAL_CASES } from '../src/sampleData';

console.log('=== NivaranSetu Milestone 2, Step 7, C4: Two-Account Live Storage RLS Isolation Suite ===\n');

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

/**
 * Validates that all four required QA credentials are non-empty strings.
 * Throws a descriptive error without logging or printing sensitive credentials.
 */
export function validateTwoAccountLiveConfig(env: Record<string, string | undefined>): boolean {
  if (env.RUN_SUPABASE_INTEGRATION_TEST !== 'true') {
    return false;
  }

  const emailA = env.SUPABASE_TEST_EMAIL?.trim();
  const passA = env.SUPABASE_TEST_PASSWORD?.trim();
  const emailB = env.SUPABASE_TEST_EMAIL_2?.trim();
  const passB = env.SUPABASE_TEST_PASSWORD_2?.trim();

  if (!emailA || !passA) {
    throw new Error(
      'SAFETY_ABORT: RUN_SUPABASE_INTEGRATION_TEST is true, but SUPABASE_TEST_EMAIL or SUPABASE_TEST_PASSWORD is not set. Ambient sessions will NEVER be reused.'
    );
  }

  if (!emailB || !passB) {
    throw new Error(
      'SAFETY_ABORT: RUN_SUPABASE_INTEGRATION_TEST is true, but SUPABASE_TEST_EMAIL_2 or SUPABASE_TEST_PASSWORD_2 is not set. Two-account live isolation requires two dedicated test accounts.'
    );
  }

  return true;
}

/**
 * Validates that Account A and Account B authenticated UUIDs are both valid and distinct.
 * Aborts immediately if both accounts resolve to the same user ID.
 */
export function assertDistinctUserUuids(uuidA: string, uuidB: string): void {
  assertValidUserUuid(uuidA);
  assertValidUserUuid(uuidB);

  if (uuidA === uuidB) {
    throw new Error(
      `SAFETY_ABORT: QA Account A and QA Account B resolved to the same UUID (${uuidA}). Live storage isolation test aborted to prevent invalid test execution.`
    );
  }
}

/**
 * Evaluates sign-out results for both clients.
 * Never swallows errors; accurately extracts rejection reasons or returned Supabase errors.
 */
export function evaluateSignOutResults(
  resA: PromiseSettledResult<any>,
  resB: PromiseSettledResult<any>
): { success: boolean; errorDetails: string | null } {
  const getSignOutError = (res: PromiseSettledResult<any>) => {
    if (res.status === 'rejected') return res.reason?.message || String(res.reason);
    if (res.value?.error) return res.value.error.message || String(res.value.error);
    return null;
  };

  const errA = getSignOutError(resA);
  const errB = getSignOutError(resB);

  if (!errA && !errB) {
    return { success: true, errorDetails: null };
  }

  const details = [
    errA ? `Account A: ${errA}` : null,
    errB ? `Account B: ${errB}` : null,
  ]
    .filter(Boolean)
    .join('; ');

  return { success: false, errorDetails: details };
}

async function runTests() {
  console.log('--- SECTION 1: Offline Pre-flight Validation ---');

  // Test 1.1: Missing Account A aborts execution
  let missingAccountAErr = '';
  try {
    validateTwoAccountLiveConfig({
      RUN_SUPABASE_INTEGRATION_TEST: 'true',
      SUPABASE_TEST_EMAIL: '',
      SUPABASE_TEST_PASSWORD: 'secret',
      SUPABASE_TEST_EMAIL_2: 'b@test.com',
      SUPABASE_TEST_PASSWORD_2: 'secret',
    });
  } catch (e: any) {
    missingAccountAErr = e.message;
  }
  assert(
    missingAccountAErr.includes('SUPABASE_TEST_EMAIL or SUPABASE_TEST_PASSWORD is not set'),
    '1.1: Missing QA Account A credentials aborts execution before network requests'
  );

  // Test 1.2: Missing Account B aborts execution
  let missingAccountBErr = '';
  try {
    validateTwoAccountLiveConfig({
      RUN_SUPABASE_INTEGRATION_TEST: 'true',
      SUPABASE_TEST_EMAIL: 'a@test.com',
      SUPABASE_TEST_PASSWORD: 'secret',
      SUPABASE_TEST_EMAIL_2: '',
      SUPABASE_TEST_PASSWORD_2: 'secret',
    });
  } catch (e: any) {
    missingAccountBErr = e.message;
  }
  assert(
    missingAccountBErr.includes('SUPABASE_TEST_EMAIL_2 or SUPABASE_TEST_PASSWORD_2 is not set'),
    '1.2: Missing QA Account B credentials aborts execution before network requests'
  );

  // Test 1.3: Disabled flag returns false without throwing
  const isEnabledWhenFalse = validateTwoAccountLiveConfig({
    RUN_SUPABASE_INTEGRATION_TEST: 'false',
  });
  assert(
    isEnabledWhenFalse === false,
    '1.3: RUN_SUPABASE_INTEGRATION_TEST=false cleanly skips live execution'
  );

  // Test 1.4: Matching UUIDs throws SAFETY_ABORT
  let identicalUuidErr = '';
  try {
    assertDistinctUserUuids('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
  } catch (e: any) {
    identicalUuidErr = e.message;
  }
  assert(
    identicalUuidErr.includes('resolved to the same UUID'),
    '1.4: Identical user UUIDs abort immediately before any database writes'
  );

  // Test 1.5: Distinct valid UUIDs pass
  let distinctUuidThrew = false;
  try {
    assertDistinctUserUuids('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
  } catch {
    distinctUuidThrew = true;
  }
  assert(
    !distinctUuidThrew,
    '1.5: Distinct valid UUIDs pass pre-write safety check'
  );

  // Test 1.6: evaluateSignOutResults detects errors and never swallows
  const failedSignOutEval = evaluateSignOutResults(
    { status: 'fulfilled', value: { error: { message: 'Network timeout during signout' } } },
    { status: 'fulfilled', value: { error: null } }
  );
  assert(
    !failedSignOutEval.success && failedSignOutEval.errorDetails?.includes('Network timeout during signout') === true,
    '1.6: evaluateSignOutResults captures client errors and returns false'
  );

  // Test 1.7: evaluateSignOutResults passes when both succeed
  const okSignOutEval = evaluateSignOutResults(
    { status: 'fulfilled', value: { error: null } },
    { status: 'fulfilled', value: { error: null } }
  );
  assert(
    okSignOutEval.success && okSignOutEval.errorDetails === null,
    '1.7: evaluateSignOutResults returns success when both clients sign out cleanly'
  );

  // =========================================================================
  // SECTION 2: Opt-in Live Two-Account Storage RLS Isolation Test
  // =========================================================================
  console.log('\n--- SECTION 2: Live Two-Account Storage RLS Isolation Test ---');

  if (process.env.RUN_SUPABASE_INTEGRATION_TEST === 'true') {
    console.log('[RUN] Opt-in live storage RLS test enabled via RUN_SUPABASE_INTEGRATION_TEST=true.');

    // Validate configuration
    validateTwoAccountLiveConfig(process.env as Record<string, string | undefined>);

    const emailA = process.env.SUPABASE_TEST_EMAIL!.trim();
    const passA = process.env.SUPABASE_TEST_PASSWORD!.trim();
    const emailB = process.env.SUPABASE_TEST_EMAIL_2!.trim();
    const passB = process.env.SUPABASE_TEST_PASSWORD_2!.trim();

    let clientA: ReturnType<typeof createIsolatedClient> | null = null;
    let clientB: ReturnType<typeof createIsolatedClient> | null = null;

    const testTimestamp = Date.now();
    const testCaseId = `NS-C4-${testTimestamp}`;
    const testEvidId = `ev-c4-${testTimestamp}`;
    const testFileName = 'c4_receipt.pdf';
    let uploadedStorageRef = '';

    let persistenceAttempted = false;
    let uploadAttempted = false;
    let liveTestError: any = null;
    let cleanupError: any = null;

    try {
      // 1. Authenticate two independent, isolated in-memory clients inside guaranteed try/finally
      clientA = createIsolatedClient();
      clientB = createIsolatedClient();

      console.log('[RUN] Authenticating isolated Client A and Client B independently...');

      const [authResA, authResB] = await Promise.all([
        clientA.auth.signInWithPassword({ email: emailA, password: passA }),
        clientB.auth.signInWithPassword({ email: emailB, password: passB }),
      ]);

      if (authResA.error || !authResA.data?.user?.id) {
        throw new Error(`SAFETY_ABORT: QA Account A authentication failed: ${authResA.error?.message || 'No user'}`);
      }
      if (authResB.error || !authResB.data?.user?.id) {
        throw new Error(`SAFETY_ABORT: QA Account B authentication failed: ${authResB.error?.message || 'No user'}`);
      }

      const userUuidA = authResA.data.user.id;
      const userUuidB = authResB.data.user.id;

      // C4.0: Abort immediately if both accounts resolve to the same user UUID
      assertDistinctUserUuids(userUuidA, userUuidB);
      assert(
        true,
        'C4.0: Verified QA Account A and QA Account B authenticated with distinct Supabase UUIDs'
      );

      // Verify authoritative helper matches session for both clients
      const authoritativeA = await getAuthoritativeUserId(clientA);
      const authoritativeB = await getAuthoritativeUserId(clientB);
      assert(
        authoritativeA === userUuidA && authoritativeB === userUuidB,
        'C4.0b: Authoritative user IDs match respective isolated sessions'
      );

      // 2. Define synthetic test case owned exclusively by Account A (isSampleData: false required)
      const syntheticTestCaseA: GrievanceCase = {
        ...INITIAL_CASES[0],
        id: testCaseId,
        title: 'C4 Storage Isolation UPI Dispute',
        description: 'Automated two-account Storage RLS isolation test fixture.',
        isSampleData: false,
        timeline: [],
        custodyEvents: [],
        monitoring: undefined,
        evidence: [
          {
            id: testEvidId,
            title: 'C4 Transaction Receipt',
            category: 'receipt',
            fileName: testFileName,
            fileSize: '300 B',
            fileSizeBytes: 300,
            fileType: 'application/pdf',
            uploadDate: new Date().toISOString().split('T')[0],
            sha256Hash: null,
            hasBlob: false,
            ocrExtracted: { dates: [], amounts: ['1200'], identifiers: ['UPI/C4'], parties: ['Merchant'], summary: 'C4 storage exhibit' },
            verifiedOriginal: false,
          },
        ],
      };

      // 3. Account A persists the parent case fixture (satisfying storage RLS foreign key constraint)
      console.log(`[RUN] Account A persisting parent case ${testCaseId}...`);
      persistenceAttempted = true;
      await saveCase(syntheticTestCaseA, clientA);
      assert(true, 'C4.1: Account A successfully persisted active parent case (isSampleData: false)');

      // 4. Construct minimal valid synthetic PDF blob (~300 bytes)
      const fakePdfBytes = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, // %PDF-1.4\n
        0x25, 0xd0, 0xd4, 0xc5, 0xd8, 0x0a,                   // binary comment
        0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a,       // 1 0 obj
        0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c, 0x6f, 0x67, 0x2f, 0x50, 0x61, 0x67, 0x65, 0x73, 0x20, 0x32, 0x20, 0x30, 0x20, 0x52, 0x3e, 0x3e, 0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,
        0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72, 0x0a,       // trailer
        0x3c, 0x3c, 0x2f, 0x52, 0x6f, 0x6f, 0x74, 0x20, 0x31, 0x20, 0x30, 0x20, 0x52, 0x3e, 0x3e, 0x0a,
        0x25, 0x25, 0x45, 0x4f, 0x46                           // %%EOF
      ]);
      const mockPdfBlob = new Blob([fakePdfBytes], { type: 'application/pdf' });
      const expectedSha256 = await calculateSha256(mockPdfBlob);

      // 5. Account A uploads synthetic PDF via uploadEvidenceBlob()
      console.log('[RUN] Account A uploading synthetic PDF blob...');
      uploadAttempted = true;
      const uploadResult = await uploadEvidenceBlob({
        caseId: testCaseId,
        evidenceId: testEvidId,
        file: mockPdfBlob,
        fileName: testFileName,
        client: clientA,
      });

      uploadedStorageRef = uploadResult.storageRef;
      const canonicalExpectedPrefix = `${userUuidA}/${testCaseId}/${testEvidId}/`;
      assert(
        uploadedStorageRef.startsWith(canonicalExpectedPrefix) && uploadResult.sha256Hash === expectedSha256,
        'C4.2: Account A uploaded synthetic PDF with canonical path and verified client SHA-256'
      );

      // 6. Account A authorized download & SHA-256 match
      console.log('[RUN] Verifying Account A authorized download...');
      const downloadedBlob = await downloadEvidenceBlob(uploadedStorageRef, clientA);
      const downloadedHash = await calculateSha256(downloadedBlob);
      assert(
        downloadedHash === expectedSha256,
        'C4.3: Account A downloaded blob and verified byte SHA-256 matches uploaded hash'
      );

      // 7. Account A authorized signed URL generation (60s expiry; URL unexposed)
      console.log('[RUN] Verifying Account A authorized signed URL generation...');
      const signedUrlA = await createEvidenceSignedUrl(uploadedStorageRef, 60, clientA);
      const isSignedUrlValid = typeof signedUrlA === 'string' && signedUrlA.startsWith('https://');
      assert(
        isSignedUrlValid,
        'C4.4: Account A generated authorized signed URL with 60s expiry (URL unexposed)'
      );

      // 8. Account B Helper Guards Rejected
      console.log('[RUN] Executing cross-tenant isolation probes via Client B...');
      let helperDownloadBlocked = false;
      try {
        await downloadEvidenceBlob(uploadedStorageRef, clientB);
      } catch (e: any) {
        helperDownloadBlocked = e.message.includes('EVIDENCE_ACCESS_DENIED');
      }

      let helperSignedUrlBlocked = false;
      try {
        await createEvidenceSignedUrl(uploadedStorageRef, 60, clientB);
      } catch (e: any) {
        helperSignedUrlBlocked = e.message.includes('EVIDENCE_ACCESS_DENIED');
      }

      assert(
        helperDownloadBlocked && helperSignedUrlBlocked,
        'C4.5: Account B helper calls rejected by client-side tenant boundary guards'
      );

      // 9. Account B Direct Storage API Download Rejected (Storage RLS)
      const { data: bRawDownData, error: bRawDownErr } = await clientB.storage
        .from(EVIDENCE_BUCKET)
        .download(uploadedStorageRef);

      assert(
        bRawDownErr !== null && bRawDownData === null,
        'C4.6: Account B direct Storage API download rejected by database RLS (error returned, null data)',
        { hasError: bRawDownErr !== null, dataNull: bRawDownData === null },
        { hasError: true, dataNull: true }
      );

      // 10. Account B Direct Signed URL Request Rejected (Storage RLS)
      const { data: bRawSignData, error: bRawSignErr } = await clientB.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(uploadedStorageRef, 60);

      const bRawSignUrl = (bRawSignData as { signedUrl?: string } | null)?.signedUrl;
      assert(
        bRawSignErr !== null && !bRawSignUrl,
        'C4.7: Account B direct Storage API signed URL request rejected by database RLS',
        { hasError: bRawSignErr !== null, hasSignedUrl: Boolean(bRawSignUrl) },
        { hasError: true, hasSignedUrl: false }
      );

      // 11. Account B Direct Storage Listing Returns 0 Objects (Storage RLS)
      // PostgreSQL RLS silently filters out rows that fail the SELECT policy; list returns empty array []
      const { data: bListData, error: bListErr } = await clientB.storage
        .from(EVIDENCE_BUCKET)
        .list(userUuidA);

      assert(
        !bListErr && Array.isArray(bListData) && bListData.length === 0,
        'C4.8: Account B direct Storage API list returns 0 objects (Account A objects hidden by RLS)',
        { bListErr, objectCount: bListData?.length },
        { bListErr: null, objectCount: 0 }
      );

      // 12. Account B Direct Upload Attack Rejected (Storage RLS)
      const tamperPath = `${userUuidA}/${testCaseId}/${testEvidId}/b_tamper.pdf`;
      const { data: bUpData, error: bUpErr } = await clientB.storage
        .from(EVIDENCE_BUCKET)
        .upload(tamperPath, mockPdfBlob, { upsert: false });

      assert(
        bUpErr !== null && bUpData === null,
        'C4.9: Account B direct Storage upload into Account A path rejected by database RLS',
        { hasError: bUpErr !== null, dataNull: bUpData === null },
        { hasError: true, dataNull: true }
      );
    } catch (err: any) {
      liveTestError = err;
    } finally {
      console.log('[RUN] Executing guaranteed cleanup and post-cleanup access checks...');

      // C4.10: Guaranteed Cleanup via soft-delete in finally block
      if (persistenceAttempted && clientA) {
        try {
          await softDeleteCase(testCaseId, clientA);

          const { data: directCase, error: directErr } = await clientA
            .from('grievance_cases')
            .select('id, deleted_at')
            .eq('id', testCaseId)
            .single();

          const afterCleanupCases = await fetchCases(clientA);
          const isAbsentFromList = !afterCleanupCases.some((c) => c.id === testCaseId);
          const isDeletedAtSet =
            !directErr &&
            typeof directCase?.deleted_at === 'string' &&
            directCase.deleted_at.trim().length > 0;
          const cleanupVerified = isAbsentFromList && isDeletedAtSet;

          if (!liveTestError) {
            assert(
              cleanupVerified,
              'C4.10: Account A confirmed synthetic case is absent from active list and deleted_at is a non-empty string',
              { isAbsentFromList, isDeletedAtSet, deleted_at: directCase?.deleted_at },
              { isAbsentFromList: true, isDeletedAtSet: true, deleted_at: 'non-empty string' }
            );
          } else if (!cleanupVerified) {
            console.warn(`[CLEANUP_WARN] Case ${testCaseId} cleanup could not be fully verified after test failure.`);
          }
        } catch (cleanErr: any) {
          cleanupError = cleanErr;
        }
      }

      // C4.11 & C4.12: Post-Cleanup Access Revocation Checks (only if file was uploaded and clientA exists)
      if (uploadAttempted && uploadedStorageRef && clientA) {
        // C4.11: Direct download by Account A is now revoked because gc.deleted_at IS NOT NULL
        const { data: postDelDownData, error: postDelDownErr } = await clientA.storage
          .from(EVIDENCE_BUCKET)
          .download(
            uploadedStorageRef,
            { cacheNonce: crypto.randomUUID() },
            { cache: 'no-store' }
          );

        assert(
          postDelDownErr !== null && postDelDownData === null,
          'C4.11: Direct download by Account A revoked after parent case soft-delete (evidence_bucket_restrict_select)',
          { hasError: postDelDownErr !== null, dataNull: postDelDownData === null },
          { hasError: true, dataNull: true }
        );

        // C4.12: Generating a NEW signed URL by Account A is now blocked
        const { data: postDelSignData, error: postDelSignErr } = await clientA.storage
          .from(EVIDENCE_BUCKET)
          .createSignedUrl(uploadedStorageRef, 60);

        const postDelSignUrl = (postDelSignData as { signedUrl?: string } | null)?.signedUrl;
        assert(
          postDelSignErr !== null && !postDelSignUrl,
          'C4.12: Generating NEW signed URL by Account A blocked after parent case soft-delete',
          { hasError: postDelSignErr !== null, hasSignedUrl: Boolean(postDelSignUrl) },
          { hasError: true, hasSignedUrl: false }
        );
      }

      // C4.13: Guaranteed Clean Sign-Out of both clients
      const [signOutResA, signOutResB] = await Promise.allSettled([
        clientA ? clientA.auth.signOut() : Promise.resolve({ error: null }),
        clientB ? clientB.auth.signOut() : Promise.resolve({ error: null }),
      ]);

      const signOutEval = evaluateSignOutResults(signOutResA, signOutResB);
      if (signOutEval.success) {
        assert(true, 'C4.13: Both isolated clients signed out cleanly without ambient token retention');
      } else {
        assert(false, `C4.13: Client sign-out failed: ${signOutEval.errorDetails}`);
      }

      // Propagate errors without masking original failure
      if (liveTestError && cleanupError) {
        assert(
          false,
          `Live storage test failed: ${liveTestError.message} | AND cleanup failed for ${testCaseId}: ${cleanupError.message}`
        );
      } else if (liveTestError) {
        assert(false, `Live storage test failed: ${liveTestError.message}`);
      } else if (cleanupError) {
        assert(false, `Live storage cleanup failed for ${testCaseId}: ${cleanupError.message}`);
      }
    }
  } else {
    console.log('[SKIP] Live Two-Account Storage RLS test skipped (opt-in via RUN_SUPABASE_INTEGRATION_TEST=true)');
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
