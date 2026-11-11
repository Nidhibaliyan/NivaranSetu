/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — Milestone 2, Step 7, Step C3
 * Live Two-Account Cross-Tenant Row-Level Security (RLS) Isolation Test Suite
 *
 * Scope:
 * - Runs only when explicitly opted in via RUN_SUPABASE_INTEGRATION_TEST=true.
 * - Authenticates two independent in-memory clients: QA Account A and QA Account B.
 * - Encloses both authentication and test execution in a master try/finally lifecycle.
 * - Uses dedicated credentials:
 *     Account A: SUPABASE_TEST_EMAIL, SUPABASE_TEST_PASSWORD
 *     Account B: SUPABASE_TEST_EMAIL_2, SUPABASE_TEST_PASSWORD_2
 * - Strictly verifies:
 *     C3.0: Account A and Account B authenticate with distinct Supabase UUIDs (aborts if identical)
 *     C3.1: Account A persists synthetic case with read-back verification of parent & 4 child records
 *     C3.2: Account B fetchCases() cannot see Account A active case in list
 *     C3.3: Account B targeted SELECT on grievance_cases returns 0 rows
 *     C3.4: Account B unauthorized UPDATE with .select('id') returns 0 rows without error (Account A title unchanged)
 *     C3.5: Account B unauthorized soft-delete with .select('id') returns 0 rows without error (Account A case remains active)
 *     C3.6: Account B SELECT on evidence_items returns 0 rows
 *     C3.7: Account B SELECT on timeline_events returns 0 rows
 *     C3.8: Account B SELECT on custody_events returns 0 rows
 *     C3.9: Account B SELECT on case_monitoring returns 0 rows
 *     C3.10: Account A can read its own case with exhibit
 *     C3.11: Account A soft-deletes synthetic case, confirming deleted_at is a non-empty string and absent from active list
 *     C3.12: Both clients sign out cleanly without ambient token retention (inspected & never swallowed)
 *
 * Safety Invariants:
 * - NEVER uses service-role credentials.
 * - NEVER touches real citizen records or past synthetic test fixtures.
 * - Partial writes during saveCase() safely handled by scoped cleanup.
 * - All writes scoped strictly to timestamped ID: NS-C3-<timestamp>.
 * - Permanent audit records (custody, timeline) documented under dedicated test account.
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
import { createIsolatedClient } from '../src/utils/supabaseClient';
import { assertValidUserUuid } from '../src/utils/caseMappers';
import { GrievanceCase } from '../src/types';
import { INITIAL_CASES } from '../src/sampleData';

console.log('=== NivaranSetu Milestone 2, Step 7, C3: Two-Account Live RLS Isolation Suite ===\n');

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
      `SAFETY_ABORT: QA Account A and QA Account B resolved to the same UUID (${uuidA}). Live cross-tenant test aborted to prevent invalid test execution.`
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
  // SECTION 2: Opt-in Live Two-Account Cross-Tenant RLS Test
  // =========================================================================
  console.log('\n--- SECTION 2: Live Two-Account Cross-Tenant RLS Isolation Test ---');

  if (process.env.RUN_SUPABASE_INTEGRATION_TEST === 'true') {
    console.log('[RUN] Opt-in live cross-tenant test enabled via RUN_SUPABASE_INTEGRATION_TEST=true.');

    // Validate configuration
    validateTwoAccountLiveConfig(process.env as Record<string, string | undefined>);

    const emailA = process.env.SUPABASE_TEST_EMAIL!.trim();
    const passA = process.env.SUPABASE_TEST_PASSWORD!.trim();
    const emailB = process.env.SUPABASE_TEST_EMAIL_2!.trim();
    const passB = process.env.SUPABASE_TEST_PASSWORD_2!.trim();

    let clientA: ReturnType<typeof createIsolatedClient> | null = null;
    let clientB: ReturnType<typeof createIsolatedClient> | null = null;

    const testTimestamp = Date.now();
    const testCaseId = `NS-C3-${testTimestamp}`;
    const testEvidId = `ev-c3-${testTimestamp}`;
    const testTlId = `tl-c3-${testTimestamp}`;
    const testCeId = `ce-c3-${testTimestamp}`;

    let persistenceAttempted = false;
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

      // C3.0: Abort immediately if both accounts resolve to the same user UUID
      assertDistinctUserUuids(userUuidA, userUuidB);
      assert(
        true,
        'C3.0: Verified QA Account A and QA Account B authenticated with distinct Supabase UUIDs'
      );

      // Verify authoritative helper matches session for both clients
      const authoritativeA = await getAuthoritativeUserId(clientA);
      const authoritativeB = await getAuthoritativeUserId(clientB);
      assert(
        authoritativeA === userUuidA && authoritativeB === userUuidB,
        'C3.0b: Authoritative user IDs match respective isolated sessions'
      );

      // 2. Define synthetic test case owned exclusively by Account A
      const syntheticTestCaseA: GrievanceCase = {
        ...INITIAL_CASES[0],
        id: testCaseId,
        title: 'C3 Cross-Tenant Isolation UPI Dispute',
        description: 'Automated two-account cross-tenant RLS isolation test fixture.',
        isSampleData: false,
        evidence: [
          {
            id: testEvidId,
            title: 'C3 Transaction Receipt',
            category: 'receipt',
            fileName: 'c3_receipt.pdf',
            fileSize: '250 KB',
            fileSizeBytes: 256000,
            fileType: 'application/pdf',
            uploadDate: new Date().toISOString().split('T')[0],
            sha256Hash: null,
            hasBlob: false,
            ocrExtracted: { dates: [], amounts: ['2500'], identifiers: ['UPI/C3'], parties: ['Merchant'], summary: 'C3 test exhibit' },
            verifiedOriginal: false,
          },
        ],
        timeline: [
          {
            id: testTlId,
            date: new Date().toISOString().split('T')[0],
            title: 'C3 Incident Reported',
            description: 'C3 cross-tenant isolation timeline entry',
            verifiedByDoc: false,
          },
        ],
        custodyEvents: [
          {
            id: testCeId,
            caseId: testCaseId,
            eventType: 'case_created',
            action: 'C3 Test Case Created',
            actor: 'Citizen (Integration Test Runner)',
            timestamp: new Date().toISOString(),
            details: 'C3 automated cross-tenant test record under QA Account A',
            fileHash: null,
          },
        ],
        monitoring: {
          citizenReportedStatus: 'not_submitted',
          statutoryDeadlineDays: 30,
          reminders: [],
          responses: [],
          generatedLetters: [],
        },
      };

      // 3. Account A persists the synthetic case fixture
      console.log(`[RUN] Account A persisting synthetic case ${testCaseId}...`);
      persistenceAttempted = true;
      await saveCase(syntheticTestCaseA, clientA);

      // Read-back verification of the expected synthetic parent and child records
      console.log('[RUN] Performing read-back verification of parent and child records...');
      const [readCase, readEv, readTl, readCe, readMon] = await Promise.all([
        clientA.from('grievance_cases').select('id, user_id, title, deleted_at').eq('id', testCaseId).single(),
        clientA.from('evidence_items').select('id, user_id, deleted_at').eq('case_id', testCaseId).eq('id', testEvidId).single(),
        clientA.from('timeline_events').select('id, user_id').eq('case_id', testCaseId).eq('id', testTlId).single(),
        clientA.from('custody_events').select('id, user_id').eq('case_id', testCaseId).eq('id', testCeId).single(),
        clientA.from('case_monitoring').select('case_id, user_id').eq('case_id', testCaseId).single(),
      ]);

      const parentOk = !readCase.error && readCase.data?.id === testCaseId && readCase.data?.user_id === userUuidA && readCase.data?.deleted_at === null;
      const evOk = !readEv.error && readEv.data?.id === testEvidId && readEv.data?.user_id === userUuidA && readEv.data?.deleted_at === null;
      const tlOk = !readTl.error && readTl.data?.id === testTlId && readTl.data?.user_id === userUuidA;
      const ceOk = !readCe.error && readCe.data?.id === testCeId && readCe.data?.user_id === userUuidA;
      const monOk = !readMon.error && readMon.data?.case_id === testCaseId && readMon.data?.user_id === userUuidA;

      const readBackOk = Boolean(parentOk && evOk && tlOk && ceOk && monOk);
      assert(
        readBackOk,
        'C3.1: Account A persisted synthetic case with read-back verification of parent, exhibit, timeline, custody, and monitoring records',
        { parentOk, evOk, tlOk, ceOk, monOk },
        { parentOk: true, evOk: true, tlOk: true, ceOk: true, monOk: true }
      );

      if (!readBackOk) {
        throw new Error(`READ_BACK_FAILED: Synthetic records verification failed on case "${testCaseId}"`);
      }

      // 4. Cross-Tenant Probe by Client B (Unauthorized Operations)
      console.log('[RUN] Executing cross-tenant isolation checks via Client B...');

      // C3.2: Account B fetchCases() cannot see Account A active case in list
      const bCases = await fetchCases(clientB);
      const bFoundCaseInList = bCases.some((c) => c.id === testCaseId);
      assert(!bFoundCaseInList, 'C3.2: Account B fetchCases() cannot see Account A active case in case list');

      // C3.3: Account B targeted SELECT on grievance_cases returns 0 rows
      const { data: bTargetCase, error: bReadErr } = await clientB
        .from('grievance_cases')
        .select('*')
        .eq('id', testCaseId);
      assert(
        !bReadErr && (bTargetCase?.length ?? 0) === 0,
        'C3.3: Account B targeted SELECT on grievance_cases returns exactly 0 rows'
      );

      // C3.4: Account B unauthorized UPDATE with .select('id') must modify 0 rows and leave Account A title intact
      const { data: bUpdData, error: bUpdErr } = await clientB
        .from('grievance_cases')
        .update({ title: 'TAMPERED_BY_B' })
        .eq('id', testCaseId)
        .select('id');

      const { data: aCaseAfterUpd } = await clientA
        .from('grievance_cases')
        .select('title')
        .eq('id', testCaseId)
        .single();

      const bUpdRejected = !bUpdErr && Array.isArray(bUpdData) && bUpdData.length === 0;
      const aTitleUntouched = aCaseAfterUpd?.title === 'C3 Cross-Tenant Isolation UPI Dispute';
      assert(
        bUpdRejected && aTitleUntouched,
        'C3.4: Account B unauthorized UPDATE returned 0 rows without error and left Account A title unchanged',
        { bUpdErr, bUpdRows: bUpdData?.length, title: aCaseAfterUpd?.title },
        { bUpdErr: null, bUpdRows: 0, title: 'C3 Cross-Tenant Isolation UPI Dispute' }
      );

      // C3.5: Account B unauthorized soft-delete with .select('id') must modify 0 rows and leave case active
      const { data: bDelData, error: bDelErr } = await clientB
        .from('grievance_cases')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', testCaseId)
        .select('id');

      const { data: aCaseAfterDel } = await clientA
        .from('grievance_cases')
        .select('deleted_at')
        .eq('id', testCaseId)
        .single();

      const bDelRejected = !bDelErr && Array.isArray(bDelData) && bDelData.length === 0;
      const aCaseStillActive = aCaseAfterDel?.deleted_at === null;
      assert(
        bDelRejected && aCaseStillActive,
        'C3.5: Account B unauthorized soft-delete returned 0 rows without error and left Account A case active',
        { bDelErr, bDelRows: bDelData?.length, deleted_at: aCaseAfterDel?.deleted_at },
        { bDelErr: null, bDelRows: 0, deleted_at: null }
      );

      // C3.6: Account B SELECT on evidence_items returns 0 rows
      const { data: bEvidence, error: bEvErr } = await clientB
        .from('evidence_items')
        .select('*')
        .eq('case_id', testCaseId);
      assert(
        !bEvErr && (bEvidence?.length ?? 0) === 0,
        'C3.6: Account B query on evidence_items returns exactly 0 rows'
      );

      // C3.7: Account B SELECT on timeline_events returns 0 rows
      const { data: bTimeline, error: bTlErr } = await clientB
        .from('timeline_events')
        .select('*')
        .eq('case_id', testCaseId);
      assert(
        !bTlErr && (bTimeline?.length ?? 0) === 0,
        'C3.7: Account B query on timeline_events returns exactly 0 rows'
      );

      // C3.8: Account B SELECT on custody_events returns 0 rows
      const { data: bCustody, error: bCeErr } = await clientB
        .from('custody_events')
        .select('*')
        .eq('case_id', testCaseId);
      assert(
        !bCeErr && (bCustody?.length ?? 0) === 0,
        'C3.8: Account B query on custody_events returns exactly 0 rows'
      );

      // C3.9: Account B SELECT on case_monitoring returns 0 rows
      const { data: bMonitoring, error: bCmErr } = await clientB
        .from('case_monitoring')
        .select('*')
        .eq('case_id', testCaseId);
      assert(
        !bCmErr && (bMonitoring?.length ?? 0) === 0,
        'C3.9: Account B query on case_monitoring returns exactly 0 rows'
      );

      // 5. Authorized Operation: Account A reads its own case with exhibit
      console.log('[RUN] Verifying Account A authorized read access...');
      const aCases = await fetchCases(clientA);
      const targetCaseA = aCases.find((c) => c.id === testCaseId);
      assert(
        targetCaseA !== undefined && targetCaseA.evidence.length === 1,
        'C3.10: Account A can fetch its own case with exactly 1 exhibit'
      );
    } catch (err: any) {
      liveTestError = err;
    } finally {
      // 6. Guaranteed cleanup strictly scoped to testCaseId
      console.log('[RUN] Executing guaranteed cleanup and sign-out...');
      if (persistenceAttempted && clientA) {
        try {
          // Attempt soft-delete of synthetic case and evidence items
          // Even if saveCase failed midway (e.g. parent saved, exhibit failed),
          // soft-deleting strictly by testCaseId ensures no orphaned active records remain.
          await softDeleteCase(testCaseId, clientA);

          // Direct read to verify deleted_at is populated
          const { data: directCase, error: directErr } = await clientA
            .from('grievance_cases')
            .select('id, deleted_at')
            .eq('id', testCaseId)
            .single();

          // Query active cases to verify exclusion from active citizen view
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
              'C3.11: Account A confirmed synthetic case is absent from active list and deleted_at is a non-empty string',
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

      // Guaranteed sign-out of both clients with rigorous error evaluation
      const [signOutResA, signOutResB] = await Promise.allSettled([
        clientA ? clientA.auth.signOut() : Promise.resolve({ error: null }),
        clientB ? clientB.auth.signOut() : Promise.resolve({ error: null }),
      ]);

      const signOutEval = evaluateSignOutResults(signOutResA, signOutResB);
      if (signOutEval.success) {
        assert(true, 'C3.12: Both isolated clients signed out cleanly without ambient token retention');
      } else {
        assert(false, `C3.12: Client sign-out failed: ${signOutEval.errorDetails}`);
      }

      // Propagate errors without masking original failure
      if (liveTestError && cleanupError) {
        assert(
          false,
          `Live cross-tenant test failed: ${liveTestError.message} | AND cleanup failed for ${testCaseId}: ${cleanupError.message}`
        );
      } else if (liveTestError) {
        assert(false, `Live cross-tenant test failed: ${liveTestError.message}`);
      } else if (cleanupError) {
        assert(false, `Live cross-tenant test cleanup failed for ${testCaseId}: ${cleanupError.message}`);
      }
    }
  } else {
    console.log('[SKIP] Live Two-Account Cross-Tenant RLS test skipped (opt-in via RUN_SUPABASE_INTEGRATION_TEST=true)');
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
