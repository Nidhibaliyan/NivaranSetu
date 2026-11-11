/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — Milestone 2, Step 7, Step D
 * Live Two-Account Navigator Persistence & Cross-Tenant RLS Test Suite
 *
 * Scope:
 * - Runs only when explicitly opted in via RUN_SUPABASE_INTEGRATION_TEST=true.
 * - Authenticates two independent in-memory clients: QA Account A and QA Account B.
 * - Encloses both authentication and test execution in a master try/finally lifecycle.
 * - Uses dedicated credentials:
 *     Account A: SUPABASE_TEST_EMAIL, SUPABASE_TEST_PASSWORD
 *     Account B: SUPABASE_TEST_EMAIL_2, SUPABASE_TEST_PASSWORD_2
 * - Strictly verifies:
 *     D.0: Pre-flight check confirms QA Account A and B authenticate with distinct Supabase UUIDs
 *     D.1: Account A persists minimal active parent case (evidence/timeline/custody empty)
 *     D.2: Account A saves Navigator session at Step 2
 *     D.3: Account A reads back Navigator session (step 2 & ack verified)
 *     D.4: Account A updates Navigator session to Step 5
 *     D.5: Account A reads back updated Navigator session (step 5 & updated ack verified)
 *     D.6: Account B helper fetchNavigatorSession returns null via client guard
 *     D.7: Account B direct SELECT on navigator_sessions returns 0 rows via database RLS
 *     D.8: Account B unauthorized UPDATE on navigator_sessions returns 0 rows modified
 *     D.9: Account B unauthorized DELETE on navigator_sessions returns 0 rows deleted
 *     D.10: Account B unauthorized INSERT into Account A's case rejected by database RLS (42501)
 *     D.11: Account A session remains intact and unchanged after Account B unauthorized probes
 *     D.12: Physical DELETE in finally removes exact synthetic session (0 rows remain in navigator_sessions)
 *     D.13: Account A soft-deletes parent case (deleted_at non-empty string & absent from active list)
 *     D.14: Both isolated clients sign out cleanly without ambient token retention
 *
 * Safety Invariants:
 * - NEVER uses service-role credentials.
 * - NEVER touches real citizen records or past synthetic test fixtures.
 * - Partial writes safely handled by scoped cleanup in finally block.
 * - All writes scoped strictly to timestamped ID: NS-NAV-<timestamp>.
 * - Leaves 0 residual records in public.navigator_sessions (physically deleted).
 * - Leaves 0 residual records in evidence_items, timeline_events, custody_events, case_monitoring.
 * - Leaves 0 files in Supabase Storage.
 * - Leaves exactly 1 soft-deleted parent case row in public.grievance_cases.
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
  saveNavigatorSession,
  fetchNavigatorSession,
} from '../src/utils/caseRepository';
import { createIsolatedClient } from '../src/utils/supabaseClient';
import { assertValidUserUuid } from '../src/utils/caseMappers';
import { GrievanceCase, NavigatorSession } from '../src/types';
import { INITIAL_CASES } from '../src/sampleData';

console.log('=== NivaranSetu Milestone 2, Step 7, Step D: Two-Account Live Navigator RLS Suite ===\n');

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
      `SAFETY_ABORT: QA Account A and QA Account B resolved to the same UUID (${uuidA}). Live navigator test aborted to prevent invalid test execution.`
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
  // SECTION 2: Opt-in Live Two-Account Navigator Persistence & RLS Test
  // =========================================================================
  console.log('\n--- SECTION 2: Live Two-Account Navigator Persistence & RLS Isolation Test ---');

  if (process.env.RUN_SUPABASE_INTEGRATION_TEST === 'true') {
    console.log('[RUN] Opt-in live navigator RLS test enabled via RUN_SUPABASE_INTEGRATION_TEST=true.');

    // 1. Validate dedicated test credentials
    validateTwoAccountLiveConfig(process.env);

    const emailA = process.env.SUPABASE_TEST_EMAIL!.trim();
    const passA = process.env.SUPABASE_TEST_PASSWORD!.trim();
    const emailB = process.env.SUPABASE_TEST_EMAIL_2!.trim();
    const passB = process.env.SUPABASE_TEST_PASSWORD_2!.trim();

    let clientA: ReturnType<typeof createIsolatedClient> | null = null;
    let clientB: ReturnType<typeof createIsolatedClient> | null = null;

    const testTimestamp = Date.now();
    const testCaseId = `NS-NAV-${testTimestamp}`;
    const testGuideId = 'rbi_banking_ombudsman';

    let persistenceAttempted = false;
    let sessionPersisted = false;
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

      // D.0: Abort immediately if both accounts resolve to the same user UUID
      assertDistinctUserUuids(userUuidA, userUuidB);
      assert(
        userUuidA !== userUuidB,
        'D.0: Pre-flight check confirms QA Account A and B authenticate with distinct Supabase UUIDs'
      );

      // 2. Minimal synthetic parent case (satisfying foreign key constraint fk_navigator_parent_case)
      // Explicitly empty children: evidence [], timeline [], custodyEvents [], monitoring undefined
      const syntheticTestCaseA: GrievanceCase = {
        ...INITIAL_CASES[0],
        id: testCaseId,
        title: 'Milestone 2 Step D Navigator Live Isolation Case',
        description: 'Synthetic parent case fixture for testing Resolution Navigator persistence & RLS isolation.',
        isSampleData: false,
        evidence: [],
        timeline: [],
        custodyEvents: [],
        monitoring: undefined,
      };

      // D.1: Account A persists the minimal parent case fixture
      console.log(`[RUN] Account A persisting minimal parent case ${testCaseId}...`);
      persistenceAttempted = true;
      await saveCase(syntheticTestCaseA, clientA);
      assert(true, 'D.1: Account A persists minimal active parent case (evidence/timeline/custody empty)');

      // D.2: Account A saves Navigator session at Step 2
      console.log('[RUN] Account A saving initial Navigator session at Step 2...');
      const sessionStep2: NavigatorSession = {
        caseId: testCaseId,
        guideId: testGuideId,
        currentStep: 2,
        ackNumber: 'ACK-NAV-1001',
        ackFilingDate: '2026-11-10',
      };
      await saveNavigatorSession(sessionStep2, clientA);
      sessionPersisted = true;
      assert(true, 'D.2: Account A saves Navigator session at Step 2');

      // D.3: Account A reads back Navigator session (step 2 & ack verified)
      console.log('[RUN] Account A verifying read-back of Step 2 session...');
      const fetchedSession1 = await fetchNavigatorSession(testCaseId, clientA);
      assert(
        fetchedSession1 !== null &&
          fetchedSession1.caseId === testCaseId &&
          fetchedSession1.currentStep === 2 &&
          fetchedSession1.ackNumber === 'ACK-NAV-1001' &&
          fetchedSession1.ackFilingDate === '2026-11-10' &&
          fetchedSession1.guideId === testGuideId,
        'D.3: Account A reads back Navigator session (step 2 & ack verified)',
        fetchedSession1,
        { caseId: testCaseId, currentStep: 2, ackNumber: 'ACK-NAV-1001', guideId: testGuideId }
      );

      // D.4: Account A updates Navigator session to Step 5
      console.log('[RUN] Account A updating Navigator session to Step 5...');
      const sessionStep5: NavigatorSession = {
        caseId: testCaseId,
        guideId: testGuideId,
        currentStep: 5,
        ackNumber: 'ACK-NAV-5005',
        ackFilingDate: '2026-11-11',
      };
      await saveNavigatorSession(sessionStep5, clientA);
      assert(true, 'D.4: Account A updates Navigator session to Step 5');

      // D.5: Account A reads back updated Navigator session (step 5 & updated ack verified)
      console.log('[RUN] Account A verifying read-back of updated Step 5 session...');
      const fetchedSession2 = await fetchNavigatorSession(testCaseId, clientA);
      assert(
        fetchedSession2 !== null &&
          fetchedSession2.caseId === testCaseId &&
          fetchedSession2.currentStep === 5 &&
          fetchedSession2.ackNumber === 'ACK-NAV-5005' &&
          fetchedSession2.ackFilingDate === '2026-11-11',
        'D.5: Account A reads back updated Navigator session (step 5 & updated ack verified)',
        fetchedSession2,
        { caseId: testCaseId, currentStep: 5, ackNumber: 'ACK-NAV-5005' }
      );

      // D.6: Account B helper fetchNavigatorSession returns null via client guard
      console.log('[RUN] Testing Account B cross-tenant isolation probes...');
      const bHelperFetch = await fetchNavigatorSession(testCaseId, clientB);
      assert(
        bHelperFetch === null,
        'D.6: Account B helper fetchNavigatorSession returns null via client guard',
        bHelperFetch,
        null
      );

      // D.7: Account B direct SELECT on navigator_sessions returns 0 rows via database RLS
      const { data: bDirectSelect, error: bSelectErr } = await clientB
        .from('navigator_sessions')
        .select('*')
        .eq('case_id', testCaseId);

      assert(
        bSelectErr === null && Array.isArray(bDirectSelect) && bDirectSelect.length === 0,
        'D.7: Account B direct SELECT on navigator_sessions returns 0 rows via database RLS',
        { error: bSelectErr, rowCount: bDirectSelect?.length },
        { error: null, rowCount: 0 }
      );

      // D.8: Account B unauthorized UPDATE on navigator_sessions returns 0 rows modified
      const { data: bUpdateData, error: bUpdateErr } = await clientB
        .from('navigator_sessions')
        .update({ current_step: 8, ack_number: 'HIJACKED' })
        .eq('case_id', testCaseId)
        .select('case_id');

      assert(
        bUpdateErr === null && Array.isArray(bUpdateData) && bUpdateData.length === 0,
        'D.8: Account B unauthorized UPDATE on navigator_sessions returns 0 rows modified',
        { error: bUpdateErr, updatedRows: bUpdateData?.length },
        { error: null, updatedRows: 0 }
      );

      // D.9: Account B unauthorized DELETE on navigator_sessions returns 0 rows deleted
      const { data: bDeleteData, error: bDeleteErr } = await clientB
        .from('navigator_sessions')
        .delete()
        .eq('case_id', testCaseId)
        .select('case_id');

      assert(
        bDeleteErr === null && Array.isArray(bDeleteData) && bDeleteData.length === 0,
        'D.9: Account B unauthorized DELETE on navigator_sessions returns 0 rows deleted',
        { error: bDeleteErr, deletedRows: bDeleteData?.length },
        { error: null, deletedRows: 0 }
      );

      // D.10: Account B unauthorized INSERT into Account A's case rejected by database RLS (42501)
      const { data: bInsertData, error: bInsertErr } = await clientB
        .from('navigator_sessions')
        .insert({
          user_id: userUuidB,
          case_id: testCaseId,
          guide_id: testGuideId,
          current_step: 3,
          ack_number: 'UNAUTHORIZED_B',
        })
        .select('case_id');

      const bInsertRows = (bInsertData as Array<{ case_id?: string }> | null) ?? [];
      assert(
        bInsertErr !== null && bInsertErr.code === '42501' && bInsertRows.length === 0,
        "D.10: Account B unauthorized INSERT into Account A's case rejected by database RLS (42501)",
        { hasError: bInsertErr !== null, errorCode: bInsertErr?.code, insertedRows: bInsertRows.length },
        { hasError: true, errorCode: '42501', insertedRows: 0 }
      );

      // D.11: Account A session remains intact and unchanged after Account B unauthorized probes
      const fetchedSessionAfterProbes = await fetchNavigatorSession(testCaseId, clientA);
      assert(
        fetchedSessionAfterProbes !== null &&
          fetchedSessionAfterProbes.currentStep === 5 &&
          fetchedSessionAfterProbes.ackNumber === 'ACK-NAV-5005',
        'D.11: Account A session remains intact and unchanged after Account B unauthorized probes',
        fetchedSessionAfterProbes,
        { currentStep: 5, ackNumber: 'ACK-NAV-5005' }
      );

    } catch (err: any) {
      liveTestError = err;
      console.error('[LIVE_TEST_ERROR] Error encountered during live test execution:', err.message || err);
    } finally {
      console.log('\n--- Guaranteed Scoped Cleanup ---');

      // D.12: Physical DELETE in finally removes exact synthetic session (0 rows remain)
      if (sessionPersisted && clientA) {
        try {
          console.log(`[CLEANUP] Account A physically deleting synthetic navigator session for case ${testCaseId}...`);
          const { error: delErr } = await clientA
            .from('navigator_sessions')
            .delete()
            .eq('case_id', testCaseId);

          if (delErr) {
            console.warn(`[CLEANUP_WARN] Failed to delete navigator session: ${delErr.message}`);
          }

          // Verify 0 rows remain in navigator_sessions
          const { data: postDelData, error: postDelErr } = await clientA
            .from('navigator_sessions')
            .select('*')
            .eq('case_id', testCaseId);

          const isSessionDeleted = postDelErr === null && Array.isArray(postDelData) && postDelData.length === 0;

          assert(
            isSessionDeleted,
            'D.12: Physical DELETE in finally removes exact synthetic session (0 rows remain in navigator_sessions)',
            { isSessionDeleted, rowCount: postDelData?.length, error: postDelErr },
            { isSessionDeleted: true, rowCount: 0, error: null }
          );
        } catch (delCatch: any) {
          console.error('[CLEANUP_ERROR] Exception deleting navigator session:', delCatch.message);
          cleanupError = cleanupError || delCatch;
        }
      }

      // D.13: Account A soft-deletes parent case (deleted_at non-empty string & absent from active list)
      if (persistenceAttempted && clientA) {
        try {
          console.log(`[CLEANUP] Soft-deleting synthetic parent case ${testCaseId}...`);
          await softDeleteCase(testCaseId, clientA);

          const [activeCases, directCaseRes] = await Promise.all([
            fetchCases(clientA),
            clientA.from('grievance_cases').select('id, deleted_at').eq('id', testCaseId).single(),
          ]);

          const directCase = directCaseRes.data;
          const isAbsentFromList = !activeCases.some((c) => c.id === testCaseId);
          const isDeletedAtSet =
            directCaseRes.error === null &&
            typeof directCase?.deleted_at === 'string' &&
            directCase.deleted_at.trim().length > 0;

          assert(
            isAbsentFromList && isDeletedAtSet,
            'D.13: Account A soft-deletes parent case (deleted_at non-empty string & absent from active list)',
            { isAbsentFromList, isDeletedAtSet, deleted_at: directCase?.deleted_at },
            { isAbsentFromList: true, isDeletedAtSet: true, deleted_at: 'non-empty string' }
          );
        } catch (cleanErr: any) {
          console.error('[CLEANUP_ERROR] Exception soft-deleting parent case:', cleanErr.message);
          cleanupError = cleanupError || cleanErr;
        }
      }

      // D.14: Clean client sign-out for both clients (never swallowed)
      if (clientA || clientB) {
        console.log('[CLEANUP] Signing out Client A and Client B...');
        const [signOutA, signOutB] = await Promise.allSettled([
          clientA ? clientA.auth.signOut() : Promise.resolve({ error: null }),
          clientB ? clientB.auth.signOut() : Promise.resolve({ error: null }),
        ]);

        const signOutEval = evaluateSignOutResults(signOutA, signOutB);
        assert(
          signOutEval.success,
          'D.14: Both isolated clients sign out cleanly without ambient token retention',
          signOutEval.errorDetails,
          null
        );
      }

      if (liveTestError && cleanupError) {
        console.error(`\n[FATAL] Both live test and cleanup failed: ${liveTestError.message} | Cleanup: ${cleanupError.message}`);
      } else if (liveTestError) {
        console.error(`\n[FATAL] Live test failed: ${liveTestError.message}`);
      } else if (cleanupError) {
        console.error(`\n[FATAL] Cleanup failed: ${cleanupError.message}`);
      }
    }
  } else {
    console.log('[SKIP] Live Two-Account Navigator RLS test skipped (opt-in via RUN_SUPABASE_INTEGRATION_TEST=true)');
  }

  // Summary
  console.log('\n======================================================');
  console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled fatal error in test runner:', err);
  process.exit(1);
});
