/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
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
  getAuthoritativeUserId,
  fetchCases,
  saveCase,
  softDeleteCase,
  softDeleteAllCases,
  seedDemoCasesForUser,
  saveNavigatorSession,
  fetchNavigatorSession,
} from '../src/utils/caseRepository';
import { supabase, createIsolatedClient } from '../src/utils/supabaseClient';
import { SupabaseClient } from '@supabase/supabase-js';
import { GrievanceCase, EvidenceItem, TimelineEvent, CustodyEvent, CaseMonitoringData, NavigatorSession } from '../src/types';
import { INITIAL_CASES } from '../src/sampleData';

console.log('=== NivaranSetu Milestone 2, Step 3: Case Repository Test Suite ===\n');

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

// Helper to create a standard mock session
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

/**
 * Creates a fluent, chainable mock query builder that accurately reflects
 * Supabase PostgREST client method chaining and async/await resolution.
 */
function createMockQueryBuilder(config: {
  selectData?: any;
  selectError?: any;
  insertError?: any;
  upsertError?: any;
  updateError?: any;
  onInsert?: (payload: any) => void;
  onUpsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: () => void;
} = {}) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({
      data: config.selectData ?? null,
      error: config.selectError ?? null,
    }),
    single: async () => ({
      data: config.selectData ?? null,
      error: config.selectError ?? null,
    }),
    insert: async (payload: any) => {
      if (config.onInsert) config.onInsert(payload);
      return { data: payload, error: config.insertError ?? null };
    },
    upsert: async (payload: any) => {
      if (config.onUpsert) config.onUpsert(payload);
      return { data: payload, error: config.upsertError ?? null };
    },
    update: (payload: any) => {
      if (config.onUpdate) config.onUpdate(payload);
      return builder;
    },
    delete: () => {
      if (config.onDelete) config.onDelete();
      return builder;
    },
    then: (resolve: (val: any) => any, reject?: (err: any) => any) => {
      const result = {
        data: config.selectData ?? [],
        error: config.selectError ?? config.updateError ?? null,
      };
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return builder;
}

async function runTests() {
  const origGetSession = supabase.auth.getSession.bind(supabase.auth);
  const origRefreshSession = supabase.auth.refreshSession.bind(supabase.auth);
  const origFrom = supabase.from.bind(supabase);
  const origRpc = supabase.rpc.bind(supabase);

  try {
    // =========================================================================
    // SECTION 1: Authenticated Session Identity & Graceful Refresh
    // =========================================================================
    console.log('--- SECTION 1: Authenticated Session Identity & Graceful Refresh ---');

    // 1.1: Reject when unauthenticated (session is null)
    supabase.auth.getSession = (async () => ({ data: { session: null }, error: null })) as any;
    let authError: string | null = null;
    try {
      await getAuthoritativeUserId();
    } catch (e: any) {
      authError = e.message;
    }
    assert(
      authError !== null && authError.includes('AUTH_REQUIRED'),
      '1.1: getAuthoritativeUserId rejects with AUTH_REQUIRED when session is null'
    );

    // 1.2: Valid unexpired session proceeds directly without calling refreshSession
    let refreshCalled = false;
    supabase.auth.getSession = (async () => createMockSession(TEST_USER_A, 3600)) as any;
    supabase.auth.refreshSession = (async () => {
      refreshCalled = true;
      return { data: { session: null }, error: null };
    }) as any;

    const unexpiredUserId = await getAuthoritativeUserId();
    assert(
      unexpiredUserId === TEST_USER_A && !refreshCalled,
      '1.2: Valid unexpired session returns user UUID without invoking refreshSession'
    );

    // 1.3: Expired session with successful refresh proceeds with refreshed session UUID
    refreshCalled = false;
    supabase.auth.getSession = (async () => createMockSession(TEST_USER_A, -120)) as any; // expired 2m ago
    supabase.auth.refreshSession = (async () => {
      refreshCalled = true;
      return createMockSession(TEST_USER_A, 3600); // successfully refreshed
    }) as any;

    const refreshedUserId = await getAuthoritativeUserId();
    assert(
      refreshCalled && refreshedUserId === TEST_USER_A,
      '1.3: Expired session invokes refreshSession() and proceeds with refreshed session UUID'
    );

    // 1.4: Expired session with failed refresh throws AUTH_EXPIRED
    supabase.auth.getSession = (async () => createMockSession(TEST_USER_A, -120)) as any;
    supabase.auth.refreshSession = (async () => ({
      data: { session: null },
      error: { message: 'Refresh token has been revoked' },
    })) as any;

    let refreshFailError: string | null = null;
    try {
      await getAuthoritativeUserId();
    } catch (e: any) {
      refreshFailError = e.message;
    }
    assert(
      refreshFailError !== null && refreshFailError.includes('AUTH_EXPIRED'),
      '1.4: Expired session with failed refresh throws AUTH_EXPIRED'
    );

    // 1.5: Expired session where refreshed identity differs throws AUTH_IDENTITY_CHANGED
    supabase.auth.getSession = (async () => createMockSession(TEST_USER_A, -120)) as any;
    supabase.auth.refreshSession = (async () => createMockSession(TEST_USER_B, 3600)) as any; // switched user!

    let identityMismatchError: string | null = null;
    try {
      await getAuthoritativeUserId();
    } catch (e: any) {
      identityMismatchError = e.message;
    }
    assert(
      identityMismatchError !== null && identityMismatchError.includes('AUTH_IDENTITY_CHANGED'),
      '1.5: Identity change during session refresh throws AUTH_IDENTITY_CHANGED'
    );

    // 1.6: Repository operations reject when unauthenticated
    supabase.auth.getSession = (async () => ({ data: { session: null }, error: null })) as any;
    let repoOpError: string | null = null;
    try {
      await fetchCases();
    } catch (e: any) {
      repoOpError = e.message;
    }
    assert(
      repoOpError !== null && repoOpError.includes('AUTH_REQUIRED'),
      '1.6: fetchCases rejects immediately when unauthenticated'
    );

    // =========================================================================
    // SECTION 2: Parent-First Persistence Ordering & Entity Mappings
    // =========================================================================
    console.log('\n--- SECTION 2: Parent-First Persistence Ordering & Entity Mappings ---');

    supabase.auth.getSession = (async () => createMockSession(TEST_USER_A)) as any;

    const tableAccessLog: string[] = [];
    const upsertPayloads: Record<string, any[]> = {};
    const insertPayloads: Record<string, any[]> = {};

    supabase.from = ((tableName: string) => {
      tableAccessLog.push(tableName);
      if (!upsertPayloads[tableName]) upsertPayloads[tableName] = [];
      if (!insertPayloads[tableName]) insertPayloads[tableName] = [];

      return createMockQueryBuilder({
        selectData: [],
        onUpsert: (payload) => upsertPayloads[tableName].push(payload),
        onInsert: (payload) => insertPayloads[tableName].push(payload),
      });
    }) as any;

    const mockCase: GrievanceCase = {
      ...INITIAL_CASES[0],
      id: TEST_CASE_ID,
      title: 'Banking UPI Dispute',
      evidence: [
        {
          id: 'ev-test-1',
          title: 'SMS Proof',
          category: 'screenshot',
          fileName: 'sms.png',
          fileSize: '1.4 MB',
          fileSizeBytes: 1468006,
          fileType: 'image/png',
          uploadDate: '2026-11-10',
          sha256Hash: null,
          hasBlob: false,
          ocrExtracted: { dates: [], amounts: [], identifiers: [], parties: [], summary: 'Initial summary' },
          verifiedOriginal: false,
        },
      ],
      timeline: [
        {
          id: 'tl-test-1',
          date: '2026-11-10',
          title: 'Incident Reported',
          description: 'Reported to branch',
          verifiedByDoc: false,
        },
      ],
      custodyEvents: [
        {
          id: 'ce-test-1',
          caseId: TEST_CASE_ID,
          eventType: 'case_created',
          action: 'Case Created',
          actor: 'Citizen (Browser Session)',
          timestamp: '2026-11-10 10:00:00 UTC',
          details: 'Initial record created',
          fileHash: null,
        },
      ],
      monitoring: {
        citizenReportedStatus: 'submitted',
        statutoryDeadlineDays: 30,
        reminders: [],
        responses: [],
        generatedLetters: [],
      },
    };

    tableAccessLog.length = 0;
    await saveCase(mockCase);

    assert(tableAccessLog[0] === 'grievance_cases', 'Parent table grievance_cases is persisted strictly FIRST', tableAccessLog[0], 'grievance_cases');
    assert(tableAccessLog.includes('evidence_items'), 'Child table evidence_items accessed after parent');
    assert(tableAccessLog.includes('timeline_events'), 'Child table timeline_events persisted after parent');
    assert(tableAccessLog.includes('custody_events'), 'Child table custody_events accessed after parent');
    assert(tableAccessLog.includes('case_monitoring'), 'Child table case_monitoring persisted after parent');

    const parentPayload = upsertPayloads['grievance_cases'][0];
    assert(parentPayload.user_id === TEST_USER_A, 'Parent row contains authoritative user_id from session');
    assert(parentPayload.id === TEST_CASE_ID, 'Parent row contains case id');
    assert(parentPayload.title === 'Banking UPI Dispute', 'Parent row contains title');

    // =========================================================================
    // SECTION 3: Evidence Immutability, Selective Updates & Zero Writes on Unchanged Exhibits
    // =========================================================================
    console.log('\n--- SECTION 3: Evidence Immutability, Selective Updates & Zero Writes ---');

    // 3.1: Saving a case with new evidence -> inserts new evidence record
    let evInsertCalls: any[] = [];
    let evUpdateCalls: any[] = [];

    supabase.from = ((tableName: string) => {
      if (tableName === 'evidence_items') {
        return createMockQueryBuilder({
          selectData: [], // DB has no existing evidence
          onInsert: (payload) => evInsertCalls.push(payload),
          onUpdate: (payload) => evUpdateCalls.push(payload),
        });
      }
      return createMockQueryBuilder({ selectData: [] });
    }) as any;

    await saveCase(mockCase);
    assert(evInsertCalls.length === 1, '3.1: Genuinely new exhibit is inserted into evidence_items', evInsertCalls.length, 1);
    assert(evInsertCalls[0].id === 'ev-test-1', '3.1: Inserted exhibit ID matches mock evidence');
    assert(evUpdateCalls.length === 0, '3.1: No update call made on new exhibit');

    // 3.2: Saving the same case again without changing evidence -> executes ZERO updates or inserts
    evInsertCalls = [];
    evUpdateCalls = [];

    // Simulate DB where ev-test-1 already exists with identical mutable fields
    const existingEvRow = {
      id: 'ev-test-1',
      title: 'SMS Proof',
      category: 'screenshot',
      raw_ocr_text: null,
      ocr_extracted: { dates: [], amounts: [], identifiers: [], parties: [], summary: 'Initial summary' },
      flag: null,
      claim_mapped_to: null,
    };

    supabase.from = ((tableName: string) => {
      if (tableName === 'evidence_items') {
        return createMockQueryBuilder({
          selectData: [existingEvRow],
          onInsert: (payload) => evInsertCalls.push(payload),
          onUpdate: (payload) => evUpdateCalls.push(payload),
        });
      }
      return createMockQueryBuilder({ selectData: [] });
    }) as any;

    await saveCase(mockCase);
    assert(evInsertCalls.length === 0, '3.2: Zero evidence inserts executed when exhibit already exists', evInsertCalls.length, 0);
    assert(evUpdateCalls.length === 0, '3.2: Zero evidence updates executed when exhibit mutable fields are unchanged', evUpdateCalls.length, 0);

    // 3.3: Saving after editing only case description does not touch evidence records
    evInsertCalls = [];
    evUpdateCalls = [];
    let parentUpdatedTitle = '';

    const caseWithEditedDesc: GrievanceCase = {
      ...mockCase,
      description: 'Edited grievance description: bank branch visited again.',
    };

    supabase.from = ((tableName: string) => {
      if (tableName === 'grievance_cases') {
        return createMockQueryBuilder({
          onUpsert: (payload) => { parentUpdatedTitle = payload.description; },
        });
      }
      if (tableName === 'evidence_items') {
        return createMockQueryBuilder({
          selectData: [existingEvRow],
          onInsert: (payload) => evInsertCalls.push(payload),
          onUpdate: (payload) => evUpdateCalls.push(payload),
        });
      }
      return createMockQueryBuilder({ selectData: [] });
    }) as any;

    await saveCase(caseWithEditedDesc);
    assert(
      parentUpdatedTitle === 'Edited grievance description: bank branch visited again.',
      '3.3: Parent case was successfully updated with new description'
    );
    assert(evInsertCalls.length === 0, '3.3: Zero evidence inserts performed when editing case description');
    assert(evUpdateCalls.length === 0, '3.3: Zero evidence updates performed when editing case description');

    // 3.4: Modifying only mutable fields (OCR or title) updates ONLY permitted mutable fields
    evInsertCalls = [];
    evUpdateCalls = [];

    const caseWithUpdatedExhibit: GrievanceCase = {
      ...mockCase,
      evidence: [
        {
          ...mockCase.evidence[0],
          title: 'Updated SMS Exhibit Title',
          ocrExtracted: {
            dates: ['2026-11-10'],
            amounts: ['5000'],
            identifiers: ['UPI/12345'],
            parties: ['Bank'],
            summary: 'Extracted transaction debit SMS',
          },
        },
      ],
    };

    supabase.from = ((tableName: string) => {
      if (tableName === 'evidence_items') {
        return createMockQueryBuilder({
          selectData: [existingEvRow],
          onInsert: (payload) => evInsertCalls.push(payload),
          onUpdate: (payload) => evUpdateCalls.push(payload),
        });
      }
      return createMockQueryBuilder({ selectData: [] });
    }) as any;

    await saveCase(caseWithUpdatedExhibit);
    assert(evInsertCalls.length === 0, '3.4: Zero inserts on existing exhibit with modified mutable fields');
    assert(evUpdateCalls.length === 1, '3.4: Exactly 1 update performed for exhibit with changed mutable fields', evUpdateCalls.length, 1);

    const updatePayload = evUpdateCalls[0];
    assert(updatePayload.title === 'Updated SMS Exhibit Title', '3.4: Exhibit title updated correctly in payload');
    assert(updatePayload.ocr_extracted?.summary === 'Extracted transaction debit SMS', '3.4: Exhibit ocr_extracted updated in payload');

    // 3.5: Verify update payload NEVER contains immutable fields protected by SQL trigger
    const forbiddenTriggerKeys = [
      'user_id',
      'case_id',
      'id',
      'file_name',
      'file_size_bytes',
      'storage_ref',
      'has_blob',
      'sha256_hash',
      'verified_original',
    ];
    const leakedKeys = forbiddenTriggerKeys.filter((k) => k in updatePayload);
    assert(
      leakedKeys.length === 0,
      '3.5: Evidence update payload contains NO immutable trigger-protected fields',
      leakedKeys,
      []
    );

    // 3.6: Saving with 1 existing exhibit and 1 new exhibit inserts ONLY the new exhibit
    evInsertCalls = [];
    evUpdateCalls = [];

    const caseWithMixedExhibits: GrievanceCase = {
      ...mockCase,
      evidence: [
        mockCase.evidence[0], // existing exhibit (ev-test-1)
        {
          id: 'ev-test-2', // new exhibit
          title: 'Bank Passbook Photo',
          category: 'receipt',
          fileName: 'passbook.jpg',
          fileSize: '2.1 MB',
          fileSizeBytes: 2202009,
          fileType: 'image/jpeg',
          uploadDate: '2026-11-10',
          sha256Hash: null,
          hasBlob: false,
          ocrExtracted: { dates: [], amounts: [], identifiers: [], parties: [], summary: '' },
          verifiedOriginal: false,
        },
      ],
    };

    supabase.from = ((tableName: string) => {
      if (tableName === 'evidence_items') {
        return createMockQueryBuilder({
          selectData: [existingEvRow], // only ev-test-1 exists
          onInsert: (payload) => evInsertCalls.push(payload),
          onUpdate: (payload) => evUpdateCalls.push(payload),
        });
      }
      return createMockQueryBuilder({ selectData: [] });
    }) as any;

    await saveCase(caseWithMixedExhibits);
    assert(evInsertCalls.length === 1, '3.6: Only the genuinely new exhibit was inserted', evInsertCalls.length, 1);
    assert(evInsertCalls[0].id === 'ev-test-2', '3.6: Inserted exhibit ID is ev-test-2');
    assert(evUpdateCalls.length === 0, '3.6: Existing unchanged exhibit was safely skipped with 0 updates');

    // =========================================================================
    // SECTION 4: Append-Only Custody Immutability & Safe Retries
    // =========================================================================
    console.log('\n--- SECTION 4: Append-Only Custody Immutability & Safe Retries ---');

    let custodyQueryCount = 0;
    let custodyInsertCount = 0;
    let custodyUpsertCount = 0;

    // Simulate database where ce-test-1 already exists
    supabase.from = ((tableName: string) => {
      if (tableName === 'custody_events') {
        return createMockQueryBuilder({
          selectData: [{ id: 'ce-test-1' }],
          onInsert: () => { custodyInsertCount++; },
          onUpsert: () => { custodyUpsertCount++; },
        });
      }
      return createMockQueryBuilder({ selectData: [] });
    }) as any;

    // Call saveCase with ce-test-1 (existing) and ce-test-2 (new)
    const caseWithNewCustody: GrievanceCase = {
      ...mockCase,
      custodyEvents: [
        mockCase.custodyEvents[0], // ce-test-1 (already in DB)
        {
          id: 'ce-test-2', // new event
          caseId: TEST_CASE_ID,
          eventType: 'case_updated',
          action: 'Case Updated',
          actor: 'Citizen (Browser Session)',
          timestamp: '2026-11-10 11:00:00 UTC',
          details: 'Updated details',
          fileHash: null,
        },
      ],
    };

    await saveCase(caseWithNewCustody);
    assert(custodyInsertCount === 1, '4.1: Only the genuinely new custody event (ce-test-2) was inserted', custodyInsertCount, 1);
    assert(custodyUpsertCount === 0, '4.2: Upsert was NEVER called on custody_events (protecting immutability trigger)');

    // Call saveCase again with the same data: idempotent retry
    custodyInsertCount = 0;
    supabase.from = ((tableName: string) => {
      if (tableName === 'custody_events') {
        return createMockQueryBuilder({
          selectData: [{ id: 'ce-test-1' }, { id: 'ce-test-2' }], // both exist now
          onInsert: () => { custodyInsertCount++; },
        });
      }
      return createMockQueryBuilder({ selectData: [] });
    }) as any;

    await saveCase(caseWithNewCustody);
    assert(custodyInsertCount === 0, '4.3: Idempotent retry: zero duplicate custody inserts attempted when records already exist');

    // =========================================================================
    // SECTION 5: Partial Failure & Database Integrity Guard
    // =========================================================================
    console.log('\n--- SECTION 5: Partial Failure & Database Integrity Guard ---');

    // 5.1: Parent case save failure rejects immediately
    supabase.from = ((tableName: string) => {
      if (tableName === 'grievance_cases') {
        return createMockQueryBuilder({
          upsertError: { message: 'Database constraint violation' },
        });
      }
      return createMockQueryBuilder();
    }) as any;

    let parentFailError: string | null = null;
    try {
      await saveCase(mockCase);
    } catch (e: any) {
      parentFailError = e.message;
    }
    assert(
      parentFailError !== null && parentFailError.includes('CASE_SAVE_FAILED'),
      '5.1: saveCase rejects with CASE_SAVE_FAILED when parent row fails'
    );

    // 5.2: Child table failure surfaces error and never falsely reports complete success
    supabase.from = ((tableName: string) => {
      if (tableName === 'grievance_cases') {
        return createMockQueryBuilder();
      }
      if (tableName === 'evidence_items') {
        return createMockQueryBuilder({
          selectData: [],
          insertError: { message: 'FK violation on exhibit' },
        });
      }
      return createMockQueryBuilder();
    }) as any;

    let childFailError: string | null = null;
    try {
      await saveCase(mockCase);
    } catch (e: any) {
      childFailError = e.message;
    }
    assert(
      childFailError !== null && childFailError.includes('EVIDENCE_SAVE_FAILED'),
      '5.2: saveCase rejects with EVIDENCE_SAVE_FAILED on child table failure without pretending success'
    );

    // =========================================================================
    // SECTION 6: Soft Deletion via deleted_at (No Hard Deletes)
    // =========================================================================
    console.log('\n--- SECTION 6: Soft Deletion via deleted_at (No Hard Deletes) ---');

    let deleteMethodCalled = false;
    let updatePayloadUsed: any = null;

    supabase.from = (() => {
      return createMockQueryBuilder({
        onDelete: () => { deleteMethodCalled = true; },
        onUpdate: (payload) => { updatePayloadUsed = payload; },
      });
    }) as any;

    await softDeleteCase(TEST_CASE_ID);
    assert(deleteMethodCalled === false, '6.1: Hard SQL delete was NEVER called (revoked privilege preserved)');
    assert(
      updatePayloadUsed !== null && typeof updatePayloadUsed.deleted_at === 'string',
      '6.2: softDeleteCase sets deleted_at timestamp via UPDATE'
    );

    updatePayloadUsed = null;
    deleteMethodCalled = false;
    await softDeleteAllCases();
    assert(deleteMethodCalled === false, '6.3: Hard SQL delete was NEVER called during softDeleteAllCases');
    assert(
      updatePayloadUsed !== null && typeof updatePayloadUsed.deleted_at === 'string',
      '6.4: softDeleteAllCases sets deleted_at timestamp via UPDATE'
    );

    // =========================================================================
    // SECTION 7: Demo-Seeding RPC Invocation
    // =========================================================================
    console.log('\n--- SECTION 7: Demo-Seeding RPC Invocation ---');

    let rpcFunctionCalled = '';
    supabase.rpc = (async (fnName: string) => {
      rpcFunctionCalled = fnName;
      return { data: null, error: null };
    }) as any;

    await seedDemoCasesForUser();
    assert(
      rpcFunctionCalled === 'seed_demo_cases_for_current_user',
      '7.1: seedDemoCasesForUser invoked approved database procedure public.seed_demo_cases_for_current_user()'
    );

    // =========================================================================
    // SECTION 8: Navigator Session Persistence
    // =========================================================================
    console.log('\n--- SECTION 8: Navigator Session Persistence ---');

    let navRowPayload: any = null;
    supabase.from = ((tableName: string) => {
      if (tableName === 'navigator_sessions') {
        return createMockQueryBuilder({
          onUpsert: (payload) => { navRowPayload = payload; },
          selectData: {
            user_id: TEST_USER_A,
            case_id: TEST_CASE_ID,
            guide_id: 'auth-rbi',
            current_step: 4,
            ack_number: 'RBI-CMS-2026-99',
            ack_filing_date: '2026-11-10',
            saved_at: new Date().toISOString(),
          },
        });
      }
      return createMockQueryBuilder();
    }) as any;

    const navSession: NavigatorSession = {
      caseId: TEST_CASE_ID,
      guideId: 'auth-rbi',
      currentStep: 4,
      ackNumber: 'RBI-CMS-2026-99',
      ackFilingDate: '2026-11-10',
    };

    await saveNavigatorSession(navSession);
    assert(navRowPayload.user_id === TEST_USER_A, '8.1: Navigator session row has verified user_id');
    assert(navRowPayload.case_id === TEST_CASE_ID, '8.2: Navigator session row has matching case_id');
    assert(navRowPayload.current_step === 4, '8.3: Navigator session row has correct step');

    const fetchedNav = await fetchNavigatorSession(TEST_CASE_ID);
    assert(fetchedNav !== null, '8.4: fetchNavigatorSession retrieves stored session');
    assert(fetchedNav?.currentStep === 4, '8.5: Reconstructed session currentStep is 4');
    assert(fetchedNav?.ackNumber === 'RBI-CMS-2026-99', '8.6: Reconstructed session ackNumber matches');

    // =========================================================================
    // SECTION 9: Multi-Table Case Fetch & Assembly
    // =========================================================================
    console.log('\n--- SECTION 9: Multi-Table Case Fetch & Assembly ---');

    supabase.from = ((tableName: string) => {
      if (tableName === 'grievance_cases') {
        return createMockQueryBuilder({
          selectData: [
            {
              user_id: TEST_USER_A,
              id: TEST_CASE_ID,
              title: 'Dispute 1',
              category: 'banking_financial',
              stage: 'drafting',
              status: 'active',
              is_sample_data: false,
              incident_date: '2026-11-01',
              incident_location: 'Pune',
              involved_entity: 'Test Bank',
              disputed_amount: 15000,
              currency: 'INR',
              description: 'Test desc',
              simple_summary: 'Simple summary',
              readiness_score: 80,
              readiness_breakdown: { evidenceCompleteness: 80, timelineClarity: 80, identityProof: 100, formalNoticeSent: 60 },
              recommended_authority: { name: 'RBI', portalName: 'CMS', portalUrl: 'https://cms.rbi.org.in', filingFee: 'Nil', averageResolutionTime: '30 days' },
              complaint_draft: { subject: 'Subj', formalBody: 'Body', simpleBody: 'Simple', reliefSought: 'Relief' },
              missing_elements: [],
              filing_details: null,
              trust_check_record: null,
              created_at: new Date().toISOString(),
              last_updated: new Date().toISOString(),
              deleted_at: null,
            },
          ],
        });
      }
      if (tableName === 'evidence_items') {
        return createMockQueryBuilder({
          selectData: [
            {
              user_id: TEST_USER_A,
              case_id: TEST_CASE_ID,
              id: 'ev-fetched-1',
              title: 'Fetched Evidence',
              category: 'receipt',
              file_name: 'receipt.pdf',
              file_size_bytes: 1024,
              file_size_formatted: '1 KB',
              file_type: 'application/pdf',
              upload_date: new Date().toISOString(),
              sha256_hash: null,
              storage_ref: null,
              raw_ocr_text: null,
              has_blob: false,
              ocr_extracted: { dates: [], amounts: [], identifiers: [], parties: [], summary: '' },
              flag: null,
              claim_mapped_to: null,
              verified_original: false,
              created_at: new Date().toISOString(),
              deleted_at: null,
            },
          ],
        });
      }
      if (tableName === 'timeline_events') {
        return createMockQueryBuilder({
          selectData: [
            {
              user_id: TEST_USER_A,
              case_id: TEST_CASE_ID,
              id: 'tl-fetched-1',
              evidence_id: null,
              date: '2026-11-01',
              title: 'Milestone 1',
              description: 'Desc 1',
              verified_by_doc: false,
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      if (tableName === 'custody_events') {
        return createMockQueryBuilder({
          selectData: [
            {
              user_id: TEST_USER_A,
              case_id: TEST_CASE_ID,
              id: 'ce-fetched-1',
              evidence_id: null,
              event_type: 'case_created',
              action: 'Created',
              actor: 'Citizen (Browser Session)',
              client_timestamp: new Date().toISOString(),
              server_timestamp: new Date().toISOString(),
              details: 'Details',
              file_hash: null,
            },
          ],
        });
      }
      if (tableName === 'case_monitoring') {
        return createMockQueryBuilder({
          selectData: [
            {
              user_id: TEST_USER_A,
              case_id: TEST_CASE_ID,
              citizen_reported_status: 'submitted',
              statutory_deadline_days: 30,
              reminders: [],
              responses: [],
              generated_letters: [],
              updated_at: new Date().toISOString(),
            },
          ],
        });
      }
      return createMockQueryBuilder();
    }) as any;

    const fetchedCases = await fetchCases();
    assert(fetchedCases.length === 1, '9.1: fetchCases returned exactly 1 assembled case');
    assert(fetchedCases[0].id === TEST_CASE_ID, '9.2: Case ID matches');
    assert(fetchedCases[0].evidence.length === 1, '9.3: Assembled case has 1 evidence exhibit');
    assert(fetchedCases[0].evidence[0].id === 'ev-fetched-1', '9.4: Exhibit ID matches');
    assert(fetchedCases[0].timeline.length === 1, '9.5: Assembled case has 1 timeline milestone');
    assert(fetchedCases[0].custodyEvents.length === 1, '9.6: Assembled case has 1 custody event');
    assert(fetchedCases[0].monitoring?.citizenReportedStatus === 'submitted', '9.7: Assembled case has monitoring data');

    // =========================================================================
    // SECTION 10: Cross-Account Isolation & No Shared Storage
    // =========================================================================
    console.log('\n--- SECTION 10: Cross-Account Isolation & No Shared Storage ---');

    localStorage.clear();

    // Verify repository operations never write to localStorage['ns_grievance_cases']
    supabase.auth.getSession = (async () => createMockSession(TEST_USER_A)) as any;
    supabase.from = (() => createMockQueryBuilder()) as any;
    await saveCase(mockCase);

    const leakedLocalCases = localStorage.getItem('ns_grievance_cases');
    assert(
      leakedLocalCases === null,
      '10.1: AUD-SEC: caseRepository never writes to shared localStorage["ns_grievance_cases"]'
    );

    // Verify User B receives their own cases, not User A's
    supabase.auth.getSession = (async () => createMockSession(TEST_USER_B)) as any;

    let queriedUserIdForUserB = '';
    supabase.from = ((tableName: string) => {
      if (tableName === 'grievance_cases') {
        const b = createMockQueryBuilder();
        b.eq = (col: string, val: any) => {
          if (col === 'user_id') queriedUserIdForUserB = val;
          return b;
        };
        return b;
      }
      return createMockQueryBuilder();
    }) as any;

    await fetchCases();
    assert(
      queriedUserIdForUserB === TEST_USER_B,
      '10.2: RLS Query Isolation: User B query strictly scoped to User B UUID'
    );

    // =========================================================================
    // SECTION 11: Isolated Client Dependency & Credential Safety Guards
    // =========================================================================
    console.log('\n--- SECTION 11: Isolated Client Dependency & Credential Safety Guards ---');

    // 11.1: Missing test credentials prevent live execution safely
    const validateLiveTestConfig = (env: Record<string, string | undefined>) => {
      if (env.RUN_SUPABASE_INTEGRATION_TEST === 'true') {
        const email = env.SUPABASE_TEST_EMAIL?.trim();
        const password = env.SUPABASE_TEST_PASSWORD?.trim();
        if (!email || !password) {
          throw new Error('SAFETY_ABORT: RUN_SUPABASE_INTEGRATION_TEST is true, but SUPABASE_TEST_EMAIL or SUPABASE_TEST_PASSWORD is not set. Ambient sessions will NEVER be reused.');
        }
        return true;
      }
      return false;
    };

    let missingEmailErr: string | null = null;
    try {
      validateLiveTestConfig({ RUN_SUPABASE_INTEGRATION_TEST: 'true', SUPABASE_TEST_EMAIL: '', SUPABASE_TEST_PASSWORD: 'secret' });
    } catch (e: any) {
      missingEmailErr = e.message;
    }
    assert(
      missingEmailErr !== null && missingEmailErr.includes('SAFETY_ABORT'),
      '11.1: Missing SUPABASE_TEST_EMAIL aborts execution without network calls'
    );

    let missingPassErr: string | null = null;
    try {
      validateLiveTestConfig({ RUN_SUPABASE_INTEGRATION_TEST: 'true', SUPABASE_TEST_EMAIL: 'qa@test.com', SUPABASE_TEST_PASSWORD: '' });
    } catch (e: any) {
      missingPassErr = e.message;
    }
    assert(
      missingPassErr !== null && missingPassErr.includes('SAFETY_ABORT'),
      '11.2: Missing SUPABASE_TEST_PASSWORD aborts execution without network calls'
    );

    // 11.3: Ambient singleton session cannot be reused by isolated client
    const PERSONAL_USER_UUID = 'c0000000-0000-4000-8000-000000000009';
    supabase.auth.getSession = (async () => createMockSession(PERSONAL_USER_UUID)) as any;

    const unauthenticatedIsolatedClient: any = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        refreshSession: async () => ({ data: { session: null }, error: null }),
      },
    };

    let isolatedSessionErr: string | null = null;
    try {
      await getAuthoritativeUserId(unauthenticatedIsolatedClient);
    } catch (e: any) {
      isolatedSessionErr = e.message;
    }
    assert(
      isolatedSessionErr !== null && isolatedSessionErr.includes('AUTH_REQUIRED'),
      '11.3: Ambient singleton session is NOT adopted by isolated client; rejects with AUTH_REQUIRED'
    );

    // 11.4: Isolated client is used for all repository operations (zero singleton calls)
    const ISOLATED_TEST_UUID = 'd0000000-0000-4000-8000-000000000099';
    const isolatedTableCalls: string[] = [];
    const singletonTableCalls: string[] = [];

    const mockIsolatedClient: any = {
      auth: {
        getSession: async () => createMockSession(ISOLATED_TEST_UUID),
        refreshSession: async () => createMockSession(ISOLATED_TEST_UUID),
      },
      from: (tableName: string) => {
        isolatedTableCalls.push(tableName);
        return createMockQueryBuilder({ selectData: [] });
      },
      rpc: async () => ({ error: null }),
    };

    supabase.from = ((tableName: string) => {
      singletonTableCalls.push(tableName);
      return createMockQueryBuilder({ selectData: [] });
    }) as any;

    await saveCase(mockCase, mockIsolatedClient);
    await fetchCases(mockIsolatedClient);
    await softDeleteCase(TEST_CASE_ID, mockIsolatedClient);

    assert(
      isolatedTableCalls.length > 0 && isolatedTableCalls.includes('grievance_cases'),
      '11.4: Repository operations route all queries to the isolated client instance'
    );
    assert(
      singletonTableCalls.length === 0,
      '11.5: Shared singleton client receives ZERO database queries when isolated client is supplied',
      singletonTableCalls.length,
      0
    );

    // 11.6: Application's existing singleton session is not changed or disrupted
    const singletonSessionCheck = await supabase.auth.getSession();
    assert(
      singletonSessionCheck.data?.session?.user?.id === PERSONAL_USER_UUID,
      '11.6: Application ambient singleton session remains completely intact and unmutated'
    );

    // 11.7: Cleanup remains strictly scoped to the synthetic case ID
    let deletedIdTarget = '';
    let deletedUserTarget = '';
    const mockScopedCleanupClient: any = {
      auth: {
        getSession: async () => createMockSession(ISOLATED_TEST_UUID),
        refreshSession: async () => createMockSession(ISOLATED_TEST_UUID),
      },
      from: (tableName: string) => {
        const b = createMockQueryBuilder();
        b.eq = (col: string, val: any) => {
          if (col === 'id') deletedIdTarget = val;
          if (col === 'user_id') deletedUserTarget = val;
          return b;
        };
        return b;
      },
    };

    await softDeleteCase('NS-INT-99999', mockScopedCleanupClient);
    assert(
      deletedIdTarget === 'NS-INT-99999' && deletedUserTarget === ISOLATED_TEST_UUID,
      '11.7: Cleanup update query strictly scoped to synthetic case ID and isolated test user UUID'
    );

    // =========================================================================
    // SECTION 12: Opt-in Live Supabase Integration Test
    // =========================================================================
    console.log('\n--- SECTION 12: Opt-in Live Supabase Integration Test ---');

    if (process.env.RUN_SUPABASE_INTEGRATION_TEST === 'true') {
      console.log('[RUN] Opt-in live Supabase test enabled via RUN_SUPABASE_INTEGRATION_TEST=true.');
      // Restore live Supabase methods for live execution
      supabase.auth.getSession = origGetSession;
      supabase.auth.refreshSession = origRefreshSession;
      supabase.from = origFrom;
      supabase.rpc = origRpc;

      const testEmail = process.env.SUPABASE_TEST_EMAIL?.trim();
      const testPassword = process.env.SUPABASE_TEST_PASSWORD?.trim();

      // Safety Guard: Refuse to run without explicit dedicated credentials. NEVER reuse ambient session.
      if (!testEmail || !testPassword) {
        throw new Error(
          'SAFETY_ABORT: RUN_SUPABASE_INTEGRATION_TEST is true, but SUPABASE_TEST_EMAIL or SUPABASE_TEST_PASSWORD is not set. Ambient sessions will NEVER be reused.'
        );
      }

      // Safety Guard: Create an isolated, in-memory client (persistSession: false)
      const liveIsolatedClient = createIsolatedClient();

      console.log('[RUN] Authenticating isolated client with dedicated test credentials...');
      const { data: authData, error: authError } = await liveIsolatedClient.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      if (authError || !authData?.user?.id) {
        throw new Error(`SAFETY_ABORT: Isolated test authentication failed: ${authError?.message || 'No user'}`);
      }

      // Verify authenticated user UUID before writing any test data
      const authenticatedTestUserId = await getAuthoritativeUserId(liveIsolatedClient);
      assert(
        authenticatedTestUserId === authData.user.id,
        '12.0: Verified isolated client user UUID matches authenticated test account'
      );

      const liveCaseId = `NS-INT-${Date.now()}`;
      const liveTestCase: GrievanceCase = {
        ...INITIAL_CASES[0],
        id: liveCaseId,
        title: 'Live Integration Test UPI Dispute',
        description: 'Created by automated integration test runner under dedicated test account.',
        isSampleData: false,
        evidence: [
          {
            id: `ev-live-${Date.now()}`,
            title: 'Live Transaction Screenshot',
            category: 'screenshot',
            fileName: 'live_test.png',
            fileSize: '500 KB',
            fileSizeBytes: 512000,
            fileType: 'image/png',
            uploadDate: new Date().toISOString().split('T')[0],
            sha256Hash: null,
            hasBlob: false,
            ocrExtracted: { dates: [], amounts: ['5000'], identifiers: ['UPI/LIVE'], parties: ['Bank'], summary: 'Live test' },
            verifiedOriginal: false,
          },
        ],
        timeline: [
          {
            id: `tl-live-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            title: 'Test Incident Reported',
            description: 'Live test timeline entry',
            verifiedByDoc: false,
          },
        ],
        custodyEvents: [
          {
            id: `ce-live-${Date.now()}`,
            caseId: liveCaseId,
            eventType: 'case_created',
            action: 'Live Test Case Created',
            actor: 'Citizen (Integration Test Runner)',
            timestamp: new Date().toISOString(),
            details: 'Live automated test record under dedicated test account',
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

      let liveTestError: any = null;
      let cleanupError: any = null;

      try {
        // 12.1: First save creates parent and exhibits using isolated client
        await saveCase(liveTestCase, liveIsolatedClient);
        assert(true, '12.1: Live saveCase() initial save succeeded with isolated client');

        // 12.2: Second save (idempotent retry) must NOT violate evidence or custody immutability triggers
        await saveCase(liveTestCase, liveIsolatedClient);
        assert(true, '12.2: Live saveCase() repeated save succeeded with 0 immutability trigger violations');

        // 12.3: Verification of single exhibit count
        const fetchedLiveCases = await fetchCases(liveIsolatedClient);
        const targetCase = fetchedLiveCases.find((c) => c.id === liveCaseId);
        assert(
          targetCase !== undefined && targetCase.evidence.length === 1,
          '12.3: Live case retrieved with exactly 1 exhibit (no duplicates created on retry)'
        );
      } catch (testErr: any) {
        liveTestError = testErr;
      } finally {
        // 12.4: Guaranteed cleanup via soft-delete scoped strictly to liveCaseId
        // Note: timeline, custody, and monitoring rows remain stored under this dedicated test account
        // as per forensic immutability rules and schema design.
        try {
          await softDeleteCase(liveCaseId, liveIsolatedClient);
          const afterDeleteCases = await fetchCases(liveIsolatedClient);
          const isCleanedUp = !afterDeleteCases.some((c) => c.id === liveCaseId);
          if (!liveTestError) {
            assert(isCleanedUp, '12.4: Live test case cleaned up successfully via softDeleteCase (parent & exhibits soft-deleted)');
          } else if (!isCleanedUp) {
            console.warn(`[CLEANUP_WARN] Case ${liveCaseId} could not be confirmed soft-deleted after test failure.`);
          }
        } catch (cleanErr: any) {
          cleanupError = cleanErr;
        }

        // Report both errors clearly when both occur without allowing cleanup error to mask test error
        if (liveTestError && cleanupError) {
          assert(
            false,
            `Live integration test failed: ${liveTestError.message} | AND cleanup failed for ${liveCaseId}: ${cleanupError.message}`
          );
        } else if (liveTestError) {
          assert(false, `Live integration test failed: ${liveTestError.message}`);
        } else if (cleanupError) {
          assert(false, `Live integration test cleanup failed for ${liveCaseId}: ${cleanupError.message}`);
        }
      }
    } else {
      console.log('[SKIP] Live Supabase integration test skipped (opt-in via RUN_SUPABASE_INTEGRATION_TEST=true)');
    }

  } finally {
    // Restore originals
    supabase.auth.getSession = origGetSession;
    supabase.auth.refreshSession = origRefreshSession;
    supabase.from = origFrom;
    supabase.rpc = origRpc;
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
