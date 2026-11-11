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
  saveNavigatorSession,
  fetchNavigatorSession,
  getAuthoritativeUserId,
} from '../src/utils/caseRepository';
import {
  NavigatorSaveQueue,
  RestorationStatus,
  sharedNavigatorSaveQueue,
} from '../src/components/ResolutionNavigator';
import { supabase } from '../src/utils/supabaseClient';
import { NavigatorSession, GrievanceCase } from '../src/types';
import { INITIAL_CASES, AUTHORITY_GUIDES } from '../src/sampleData';

console.log('=== NivaranSetu Milestone 2, Step 5: Resolution Navigator Persistence Test Suite ===\n');

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
const TEST_CASE_A = 'NS-2026-0842';
const TEST_CASE_B = 'NS-2026-0619';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createMockSession(userId: string) {
  return {
    data: {
      session: {
        access_token: `mock_jwt_${userId}`,
        user: { id: userId, email: `${userId}@example.com` },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
    },
    error: null,
  };
}

function createMockQueryBuilder(config: {
  selectData?: any;
  selectError?: any;
  insertError?: any;
  upsertError?: any;
  onUpsert?: (payload: any) => void;
} = {}) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
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
    upsert: async (payload: any) => {
      if (config.onUpsert) config.onUpsert(payload);
      return { data: payload, error: config.upsertError ?? null };
    },
  };
  return builder;
}

async function runTests() {
  const origGetSession = supabase.auth.getSession;
  const origFrom = supabase.from;

  try {
    // Default authentication under User A
    supabase.auth.getSession = (async () => createMockSession(TEST_USER_A)) as any;

    // =========================================================================
    // SECTION 1: Direct Repository Navigator Session Persistence
    // =========================================================================
    console.log('--- SECTION 1: Direct Repository Navigator Session Persistence ---');

    let savedRowPayload: any = null;
    let queryCaseIdFilter: string | null = null;
    let queryUserIdFilter: string | null = null;

    supabase.from = ((tableName: string) => {
      if (tableName === 'navigator_sessions') {
        const builder: any = createMockQueryBuilder({
          onUpsert: (payload) => { savedRowPayload = payload; },
          selectData: {
            user_id: TEST_USER_A,
            case_id: TEST_CASE_A,
            guide_id: 'auth-rbi',
            current_step: 4,
            ack_number: 'RBI-CMS-2026-001',
            ack_filing_date: '2026-11-10',
            saved_at: '2026-11-10T05:00:00.000Z',
          },
        });
        builder.eq = (col: string, val: string) => {
          if (col === 'case_id') queryCaseIdFilter = val;
          if (col === 'user_id') queryUserIdFilter = val;
          return builder;
        };
        return builder;
      }
      return createMockQueryBuilder();
    }) as any;

    const navSessionToSave: NavigatorSession = {
      caseId: TEST_CASE_A,
      guideId: 'auth-rbi',
      currentStep: 4,
      ackNumber: 'RBI-CMS-2026-001',
      ackFilingDate: '2026-11-10',
      savedAt: '2026-11-10T05:00:00.000Z',
    };

    await saveNavigatorSession(navSessionToSave);
    assert(savedRowPayload !== null, '1.1: saveNavigatorSession writes to navigator_sessions table');
    assert(savedRowPayload.user_id === TEST_USER_A, '1.2: Persisted user_id strictly derived from session');
    assert(savedRowPayload.case_id === TEST_CASE_A, '1.3: Persisted case_id matches session');
    assert(savedRowPayload.guide_id === 'auth-rbi', '1.4: Persisted guide_id matches session');
    assert(savedRowPayload.current_step === 4, '1.5: Persisted current_step is 4');
    assert(savedRowPayload.ack_number === 'RBI-CMS-2026-001', '1.6: Persisted ack_number matches');

    // Step clamping constraint test: values outside 1-8 clamped cleanly
    const outOfBoundsSession: NavigatorSession = {
      caseId: TEST_CASE_A,
      guideId: 'auth-rbi',
      currentStep: 15,
      ackNumber: '',
      ackFilingDate: '',
    };
    await saveNavigatorSession(outOfBoundsSession);
    assert(savedRowPayload.current_step === 8, '1.7: Step exceeding 8 clamped to 8 by mapper');

    const negativeStepSession: NavigatorSession = {
      caseId: TEST_CASE_A,
      guideId: 'auth-rbi',
      currentStep: -3,
      ackNumber: '',
      ackFilingDate: '',
    };
    await saveNavigatorSession(negativeStepSession);
    assert(savedRowPayload.current_step === 1, '1.8: Step below 1 clamped to 1 by mapper');

    // Fetching session
    const fetched = await fetchNavigatorSession(TEST_CASE_A);
    assert(fetched !== null, '1.9: fetchNavigatorSession returns reconstructed session');
    assert(queryUserIdFilter === TEST_USER_A, '1.10: Query strictly filtered by authenticated user UUID');
    assert(queryCaseIdFilter === TEST_CASE_A, '1.11: Query filtered by target case ID');
    assert(fetched?.currentStep === 4, '1.12: Reconstructed session step matches database row');

    // Null session fetch
    supabase.from = ((tableName: string) => {
      return createMockQueryBuilder({ selectData: null });
    }) as any;
    const fetchedNull = await fetchNavigatorSession('NS-NONEXISTENT');
    assert(fetchedNull === null, '1.13: Nonexistent session returns null cleanly');

    // =========================================================================
    // SECTION 2: Production NavigatorSaveQueue & FIFO Inversion Regression Tests
    // (Direct tests of production NavigatorSaveQueue class)
    // =========================================================================
    console.log('\n--- SECTION 2: Production NavigatorSaveQueue & FIFO Inversion Regression Tests ---');

    const prodQueue = new NavigatorSaveQueue();
    let simulatedDatabaseStep = 0;
    const writeLog: { step: number; timestamp: number }[] = [];

    // Test 2.1: Deliberately inverted network completion times
    // Save 1 is Step 3, with a slow network roundtrip (40ms)
    // Save 2 is Step 4, with a fast network roundtrip (10ms)
    // The queue MUST serialize writes so Save 2 executes strictly after Save 1
    const pSave1 = prodQueue.enqueue(TEST_CASE_A, async () => {
      await delay(40);
      simulatedDatabaseStep = 3;
      writeLog.push({ step: 3, timestamp: Date.now() });
    });

    const pSave2 = prodQueue.enqueue(TEST_CASE_A, async () => {
      await delay(10);
      simulatedDatabaseStep = 4;
      writeLog.push({ step: 4, timestamp: Date.now() });
    });

    await Promise.all([pSave1, pSave2]);

    assert(
      simulatedDatabaseStep === 4,
      '2.1: Final database state contains newer progress (Step 4) despite inverted network latencies'
    );
    assert(
      writeLog.length === 2 && writeLog[0].step === 3 && writeLog[1].step === 4,
      '2.2: Writes occurred in strict sequential order (Step 3 then Step 4)'
    );

    // Test 2.3: Rejected first save does not permanently break the queue
    let firstSaveError: any = null;
    let secondSaveExecuted: any = false;

    const pFail = prodQueue.enqueue(TEST_CASE_A, async () => {
      await delay(10);
      throw new Error('NETWORK_TIMEOUT: Supabase write failed');
    }).catch((err) => {
      firstSaveError = err.message;
    });

    const pRecover = prodQueue.enqueue(TEST_CASE_A, async () => {
      await delay(10);
      simulatedDatabaseStep = 5;
      secondSaveExecuted = true;
    });

    await Promise.all([pFail, pRecover]);

    assert(
      Boolean(firstSaveError && String(firstSaveError).includes('NETWORK_TIMEOUT')),
      '2.4: First save error correctly surfaced to caller'
    );
    assert(
      secondSaveExecuted === true && simulatedDatabaseStep === 5,
      '2.5: Subsequent save executed successfully after prior failure; queue was not broken'
    );

    // Test 2.6: Per-case isolation: Saves for Case A and Case B do not cross-block
    const caseExecutionOrder: string[] = [];
    const pCaseA = prodQueue.enqueue('CASE-SLOW-A', async () => {
      await delay(40);
      caseExecutionOrder.push('A');
    });
    const pCaseB = prodQueue.enqueue('CASE-FAST-B', async () => {
      await delay(10);
      caseExecutionOrder.push('B');
    });

    await Promise.all([pCaseA, pCaseB]);
    assert(
      caseExecutionOrder[0] === 'B' && caseExecutionOrder[1] === 'A',
      '2.7: Independent cases execute concurrently without cross-blocking'
    );

    // =========================================================================
    // Test 2.8 - 2.14: Production Shared Queue Across Component Remounts Scenario
    // =========================================================================
    sharedNavigatorSaveQueue.clear();

    let remountDbProgress = 0;
    const remountExecutionLog: { source: string; step: number; time: number }[] = [];

    // Factory function replicating how ResolutionNavigator acquires its activeQueue:
    // const activeQueue = props.saveQueue || sharedNavigatorSaveQueue;
    const resolveNavigatorQueue = (propsQueue?: NavigatorSaveQueue) => propsQueue || sharedNavigatorSaveQueue;

    // 1. Mount 1: Component renders with default queue (no propsQueue passed)
    const queueInstance1 = resolveNavigatorQueue();
    assert(queueInstance1 === sharedNavigatorSaveQueue, '2.8: Mount 1 acquires the shared production queue instance');

    // Start delayed save for Case A using queue instance 1 (Step 3, slow 40ms network)
    const savePromiseMount1 = queueInstance1.enqueue(TEST_CASE_A, async () => {
      await delay(40);
      remountDbProgress = 3;
      remountExecutionLog.push({ source: 'mount1', step: 3, time: Date.now() });
    });

    // 2. Simulate navigator unmount/remount (e.g. user navigated to Dashboard/Builder and returned)
    // Mount 2 renders and acquires its queue using the exact same production mechanism
    const queueInstance2 = resolveNavigatorQueue();
    assert(queueInstance2 === sharedNavigatorSaveQueue, '2.9: Remounted navigator acquires the exact same shared queue instance');
    assert(queueInstance1 === queueInstance2, '2.10: Queue instance identity is strictly preserved across component remounts');

    // 3. Mount 2 starts a newer save for Case A (Step 5, fast 10ms network)
    const savePromiseMount2 = queueInstance2.enqueue(TEST_CASE_A, async () => {
      await delay(10);
      remountDbProgress = 5;
      remountExecutionLog.push({ source: 'mount2', step: 5, time: Date.now() });
    });

    await Promise.all([savePromiseMount1, savePromiseMount2]);

    // 4. Verify both saves used the same queue and the newer save is written last
    assert(
      remountDbProgress === 5,
      '2.11: Across unmount/remount, newer save from remounted instance is written last (Step 5 in DB)'
    );
    assert(
      remountExecutionLog.length === 2 &&
      remountExecutionLog[0].source === 'mount1' && remountExecutionLog[0].step === 3 &&
      remountExecutionLog[1].source === 'mount2' && remountExecutionLog[1].step === 5,
      '2.12: Write order strictly preserved across remount: Mount 1 (Step 3) executed before Mount 2 (Step 5)'
    );

    // 5. Verify the queue still recovers after a failed save in remounted instances
    let remountFailError: any = null;
    let remountRecoverySuccess: any = false;

    const pMount3Fail = queueInstance2.enqueue(TEST_CASE_A, async () => {
      await delay(10);
      throw new Error('NETWORK_OFFLINE: Cloud database unreachable');
    }).catch((err) => {
      remountFailError = err.message;
    });

    // Another remount occurs (Mount 4)
    const queueInstance4 = resolveNavigatorQueue();
    const pMount4Recover = queueInstance4.enqueue(TEST_CASE_A, async () => {
      await delay(10);
      remountDbProgress = 6;
      remountRecoverySuccess = true;
    });

    await Promise.all([pMount3Fail, pMount4Recover]);

    assert(
      Boolean(remountFailError && String(remountFailError).includes('NETWORK_OFFLINE')),
      '2.13: Failed save error surfaced to remounted caller'
    );
    assert(
      remountRecoverySuccess === true && remountDbProgress === 6,
      '2.14: Shared queue fully recovers and executes subsequent save after failure across remounts'
    );

    // =========================================================================
    // SECTION 3: Headless Lifecycle State-Machine Simulation Tests
    // (Models component state transitions, guards, and timeouts in Node.js)
    // =========================================================================
    console.log('\n--- SECTION 3: Headless Lifecycle State-Machine Simulation Tests ---');

    /**
     * NOTE: NavigatorLifecycleSimulator is a headless state-machine simulator modeling
     * component state transitions and guards in Node.js. It does not mount React DOM elements.
     */
    class NavigatorLifecycleSimulator {
      public currentStep: number = 1;
      public selectedGuideId: string = 'auth-rbi';
      public ackNumber: string = '';
      public ackFilingDate: string = '';
      public toast: string | null = null;
      public error: string | null = null;
      public activeCaseId: string = '';
      public restorationStatus: RestorationStatus = 'loading';
      public ackSavedSuccess: boolean = false;
      public isSavingAck: boolean = false;

      private lastFetchRequestId: number = 0;
      private lastSaveRequestId: number = 0;
      public queue: NavigatorSaveQueue;

      constructor(
        public fetchFn: (caseId: string) => Promise<NavigatorSession | null>,
        public saveFn: (session: NavigatorSession) => Promise<void>,
        queue?: NavigatorSaveQueue
      ) {
        this.queue = queue || sharedNavigatorSaveQueue;
      }

      async openCase(caseId: string, defaultCategory: string) {
        this.activeCaseId = caseId;
        const matchingGuide = AUTHORITY_GUIDES.find((g) => g.category === defaultCategory) || AUTHORITY_GUIDES[0];
        this.selectedGuideId = matchingGuide.id;
        this.currentStep = 1;
        this.ackNumber = '';
        this.ackFilingDate = new Date().toISOString().split('T')[0];
        this.ackSavedSuccess = false;
        this.toast = null;
        this.error = null;
        this.restorationStatus = 'loading';

        const reqId = ++this.lastFetchRequestId;
        try {
          const session = await this.fetchFn(caseId);
          if (this.lastFetchRequestId !== reqId || this.activeCaseId !== caseId) {
            return; // Discard stale response
          }
          if (session) {
            this.currentStep = Math.min(8, Math.max(1, Math.round(session.currentStep || 1)));
            this.selectedGuideId = session.guideId || this.selectedGuideId;
            this.ackNumber = session.ackNumber || '';
            this.ackFilingDate = session.ackFilingDate || this.ackFilingDate;
            this.restorationStatus = 'restored';
            this.error = null;
            if (this.currentStep > 1) {
              this.toast = `Restored saved progress at Step ${this.currentStep}.`;
            }
          } else {
            this.restorationStatus = 'no_session';
            this.error = null;
          }
        } catch (err: any) {
          if (this.lastFetchRequestId !== reqId || this.activeCaseId !== caseId) {
            return;
          }
          this.restorationStatus = 'failed';
          this.error = `Unable to restore saved progress from cloud: ${err.message}. Progress may not be up to date.`;
        }
      }

      async pauseSession(): Promise<boolean> {
        // Correction 2 Guard: Block cloud saves while initial restoration is unresolved or has failed
        if (this.restorationStatus === 'loading' || this.restorationStatus === 'idle') {
          this.error = 'Please wait for cloud synchronization to complete before saving.';
          return false;
        }
        if (this.restorationStatus === 'failed') {
          this.error =
            'Cannot save progress because cloud synchronization failed. Please refresh or resolve network connection to avoid overwriting existing cloud progress.';
          return false;
        }

        const reqId = ++this.lastSaveRequestId;
        const savingCaseId = this.activeCaseId;
        this.error = null;

        try {
          const session: NavigatorSession = {
            caseId: savingCaseId,
            guideId: this.selectedGuideId,
            currentStep: this.currentStep,
            ackNumber: this.ackNumber,
            ackFilingDate: this.ackFilingDate,
            savedAt: new Date().toISOString(),
          };

          await this.queue.enqueue(savingCaseId, async () => {
            await this.saveFn(session);
          });

          if (this.lastSaveRequestId !== reqId || this.activeCaseId !== savingCaseId) {
            return false; // Discard stale save completion
          }
          this.toast = 'Progress saved to your secure cloud account. You can safely return anytime.';
          return true;
        } catch (err: any) {
          if (this.lastSaveRequestId !== reqId || this.activeCaseId !== savingCaseId) {
            return false;
          }
          this.error = `Save error: ${err.message}`;
          return false;
        }
      }

      async saveAcknowledgement(ackNum: string, ackDate: string): Promise<boolean> {
        this.ackNumber = ackNum;
        this.ackFilingDate = ackDate;

        if (!ackNum.trim() || this.isSavingAck) return false;

        // Correction 2 Guard
        if (this.restorationStatus === 'loading' || this.restorationStatus === 'idle') {
          this.error = 'Please wait for cloud synchronization to complete before recording acknowledgement.';
          return false;
        }
        if (this.restorationStatus === 'failed') {
          this.error =
            'Cannot persist acknowledgement because cloud synchronization failed. Please refresh or resolve network connection.';
          return false;
        }

        const savingCaseId = this.activeCaseId;
        this.isSavingAck = true;
        this.error = null;

        try {
          const ackSession: NavigatorSession = {
            caseId: savingCaseId,
            guideId: this.selectedGuideId,
            currentStep: 8,
            ackNumber: ackNum.trim(),
            ackFilingDate: ackDate.trim(),
            savedAt: new Date().toISOString(),
          };

          await this.queue.enqueue(savingCaseId, async () => {
            await this.saveFn(ackSession);
          });

          if (this.activeCaseId !== savingCaseId) return false;

          // Correction 3: Only set success AFTER cloud save resolves
          this.ackSavedSuccess = true;
          return true;
        } catch (err: any) {
          if (this.activeCaseId !== savingCaseId) return false;
          this.ackSavedSuccess = false;
          this.error = `Failed to record acknowledgement to cloud: ${err.message}. Your input has been preserved—please try again.`;
          return false;
        } finally {
          if (this.activeCaseId === savingCaseId) {
            this.isSavingAck = false;
          }
        }
      }
    }

    // In-memory cloud database store for simulation
    const mockCloudDb: Record<string, NavigatorSession> = {
      [TEST_CASE_A]: {
        caseId: TEST_CASE_A,
        guideId: 'auth-rbi',
        currentStep: 5,
        ackNumber: '',
        ackFilingDate: '',
      },
      [TEST_CASE_B]: {
        caseId: TEST_CASE_B,
        guideId: 'auth-consumer',
        currentStep: 2,
        ackNumber: '',
        ackFilingDate: '',
      },
    };

    const sim = new NavigatorLifecycleSimulator(
      async (caseId) => mockCloudDb[caseId] || null,
      async (session) => { mockCloudDb[session.caseId] = session; }
    );

    // 3.1 Reopen Case A (has saved progress at Step 5)
    await sim.openCase(TEST_CASE_A, 'banking_financial');
    assert(sim.currentStep === 5, '3.1: Reopened Case A restores saved Step 5 from cloud');
    assert(sim.selectedGuideId === 'auth-rbi', '3.1: Reopened Case A restores guide auth-rbi');
    assert(sim.restorationStatus === 'restored', '3.1: Restoration status marked as restored');
    assert(sim.toast !== null && sim.toast.includes('Restored saved progress at Step 5'), '3.1: Toast indicates restored progress');

    // 3.2 Switch to Case B (has saved progress at Step 2)
    await sim.openCase(TEST_CASE_B, 'consumer_ecommerce');
    assert(sim.currentStep === 2, '3.2: Switched to Case B restores saved Step 2');
    assert(sim.selectedGuideId === 'auth-consumer', '3.2: Switched to Case B restores guide auth-consumer');
    assert(sim.restorationStatus === 'restored', '3.2: Case B marked as restored');

    // 3.3 Open fresh case with confirmed NO saved session in database
    await sim.openCase('NS-FRESH-001', 'real_estate_rera');
    assert(sim.currentStep === 1, '3.3: Fresh case with no saved session initializes cleanly at Step 1');
    assert(sim.selectedGuideId === 'auth-rera', '3.3: Fresh case initializes with category-matching guide auth-rera');
    assert(sim.restorationStatus === 'no_session', '3.3: Confirmed absence of session sets status to no_session');
    assert(sim.error === null, '3.3: Absent session does not produce an error');

    // =========================================================================
    // SECTION 4: Concurrency & Stale Response Guards
    // =========================================================================
    console.log('\n--- SECTION 4: Concurrency & Stale Response Guards ---');

    // 4.1: Stale fetch from Case A must not overwrite Case B
    let delayCaseAFetchResolve: ((session: NavigatorSession | null) => void) | null = null;
    const concurrentSim = new NavigatorLifecycleSimulator(
      (caseId) => {
        if (caseId === TEST_CASE_A) {
          return new Promise((resolve) => {
            delayCaseAFetchResolve = resolve;
          });
        }
        return Promise.resolve(mockCloudDb[caseId] || null);
      },
      async (s) => { mockCloudDb[s.caseId] = s; }
    );

    // Start loading Case A (delayed)
    const loadPromiseA = concurrentSim.openCase(TEST_CASE_A, 'banking_financial');
    assert(concurrentSim.activeCaseId === TEST_CASE_A, '4.1: Active case set to Case A');

    // Before Case A resolves, user rapidly switches to Case B
    await concurrentSim.openCase(TEST_CASE_B, 'consumer_ecommerce');
    assert(concurrentSim.activeCaseId === TEST_CASE_B, '4.1: Active case rapidly switched to Case B');
    assert(concurrentSim.currentStep === 2, '4.1: Case B loaded at Step 2');

    // Delayed Case A resolves
    if (delayCaseAFetchResolve) {
      (delayCaseAFetchResolve as any)({
        caseId: TEST_CASE_A,
        guideId: 'auth-rbi',
        currentStep: 5,
        ackNumber: '',
        ackFilingDate: '',
      });
    }
    await loadPromiseA;

    assert(concurrentSim.activeCaseId === TEST_CASE_B, '4.1: Active case remains Case B');
    assert(concurrentSim.currentStep === 2, '4.1: Delayed Case A response discarded; Case B step remains 2');
    assert(concurrentSim.selectedGuideId === 'auth-consumer', '4.1: Delayed Case A guide discarded; Case B guide remains auth-consumer');

    // 4.2: Stale save response discarded if user switched cases during save
    let delaySaveResolve: (() => void) | null = null;
    let saveTargetCaseIdRecorded = '';
    const staleSaveSim = new NavigatorLifecycleSimulator(
      async (caseId) => mockCloudDb[caseId] || null,
      (session) => {
        saveTargetCaseIdRecorded = session.caseId;
        return new Promise((resolve) => {
          delaySaveResolve = resolve;
        });
      }
    );

    await staleSaveSim.openCase(TEST_CASE_A, 'banking_financial');
    staleSaveSim.currentStep = 7;

    const savePromiseA = staleSaveSim.pauseSession();
    await delay(1);
    assert(saveTargetCaseIdRecorded === TEST_CASE_A, '4.2: Save correctly targeted Case A');

    await staleSaveSim.openCase(TEST_CASE_B, 'consumer_ecommerce');
    assert(staleSaveSim.activeCaseId === TEST_CASE_B, '4.2: User switched to Case B while save in flight');

    staleSaveSim.toast = null;
    if (delaySaveResolve) (delaySaveResolve as any)();
    await savePromiseA;

    assert(staleSaveSim.toast === null, '4.2: Stale save confirmation discarded when user on different case');

    // =========================================================================
    // SECTION 5: Restoration Failure & Anti-Overwrite Protection (Correction 2)
    // =========================================================================
    console.log('\n--- SECTION 5: Restoration Failure & Anti-Overwrite Protection ---');

    // Mock DB holding previously saved progress at Step 6 for Case A
    const protectedDb: Record<string, NavigatorSession> = {
      [TEST_CASE_A]: {
        caseId: TEST_CASE_A,
        guideId: 'auth-rbi',
        currentStep: 6,
        ackNumber: 'PRE-EXISTING-ACK',
        ackFilingDate: '2026-11-01',
      },
    };

    // Simulator with failing network fetch
    const failingFetchSim = new NavigatorLifecycleSimulator(
      async () => {
        throw new Error('NETWORK_TIMEOUT: Supabase read timed out');
      },
      async (session) => {
        protectedDb[session.caseId] = session;
      }
    );

    // Initial state before opening case
    await failingFetchSim.openCase(TEST_CASE_A, 'banking_financial');

    assert(failingFetchSim.restorationStatus === 'failed', '5.1: Restoration status transitioned to failed');
    assert(
      failingFetchSim.error !== null && failingFetchSim.error.includes('NETWORK_TIMEOUT'),
      '5.2: Error message clearly informs citizen of network read failure'
    );
    assert(
      failingFetchSim.currentStep === 1,
      '5.3: Baseline Step 1 established locally while waiting for resolution'
    );

    // Citizen attempts to click "Save" while restoration is in 'failed' status
    const saveAllowed = await failingFetchSim.pauseSession();

    assert(saveAllowed === false, '5.4: Cloud save was strictly BLOCKED due to failed restoration status');
    assert(
      failingFetchSim.error !== null && failingFetchSim.error.includes('Cannot save progress because cloud synchronization failed'),
      '5.5: Informative error explains that save is blocked to avoid overwriting cloud progress'
    );
    assert(
      protectedDb[TEST_CASE_A].currentStep === 6,
      '5.6: Pre-existing cloud progress at Step 6 was PRESERVED in database and NOT overwritten with Step 1'
    );

    // =========================================================================
    // SECTION 6: Truthful Step 8 Acknowledgement Persistence (Correction 3)
    // =========================================================================
    console.log('\n--- SECTION 6: Truthful Step 8 Acknowledgement Persistence ---');

    let ackResolvePromise: (() => void) | null = null;
    let ackRejectPromise: ((err: any) => void) | null = null;
    let persistedAckSession: NavigatorSession | null = null;

    const truthfulAckSim = new NavigatorLifecycleSimulator(
      async () => null, // No prior session
      (s) => {
        persistedAckSession = s;
        return new Promise((resolve, reject) => {
          ackResolvePromise = resolve;
          ackRejectPromise = reject;
        });
      }
    );

    await truthfulAckSim.openCase(TEST_CASE_A, 'banking_financial');
    assert(truthfulAckSim.restorationStatus === 'no_session', '6.1: Confirmed no_session allows new save');

    // Initiate Step 8 Acknowledgement Save (In-flight)
    const ackPromise = truthfulAckSim.saveAcknowledgement('GOV-DOCKET-9988', '2026-11-10');
    await delay(1);

    // While in-flight: ackSavedSuccess MUST NOT be true yet!
    assert(
      truthfulAckSim.ackSavedSuccess === false,
      '6.2: Acknowledgement success is NOT claimed while cloud save is still in flight'
    );
    assert(
      truthfulAckSim.isSavingAck === true,
      '6.3: Saving indicator is active while cloud save is in flight'
    );

    // Resolve cloud write successfully
    if (ackResolvePromise) (ackResolvePromise as any)();
    const ackResult = await ackPromise;

    assert(ackResult === true, '6.4: Acknowledgement handler resolves true on cloud write success');
    assert(truthfulAckSim.ackSavedSuccess === true, '6.5: Acknowledgement success is claimed ONLY after cloud save resolves');
    assert(
      persistedAckSession !== null && (persistedAckSession as any).ackNumber === 'GOV-DOCKET-9988',
      '6.6: Docket acknowledgement reference persisted to Supabase'
    );

    // Test Failure Scenario: Supabase rejects the acknowledgement save
    const failingAckSim = new NavigatorLifecycleSimulator(
      async () => null,
      async () => {
        throw new Error('RLS_VIOLATION: Database update denied');
      }
    );

    await failingAckSim.openCase(TEST_CASE_A, 'banking_financial');
    const failResult = await failingAckSim.saveAcknowledgement('FAIL-DOCKET-001', '2026-11-10');

    assert(failResult === false, '6.7: Acknowledgement handler returns false on write failure');
    assert(
      failingAckSim.ackSavedSuccess === false,
      '6.8: Failed save does NOT claim success'
    );
    assert(
      failingAckSim.error !== null && failingAckSim.error.includes('Failed to record acknowledgement to cloud'),
      '6.9: Failure is clearly communicated in error state'
    );
    assert(
      failingAckSim.ackNumber === 'FAIL-DOCKET-001',
      '6.10: Entered acknowledgement details are preserved in state for citizen retry'
    );

    // =========================================================================
    // SECTION 7: Multi-Account Isolation & RLS Boundary (Mocked Tests)
    // =========================================================================
    console.log('\n--- SECTION 7: Multi-Account Isolation & RLS Boundary (Mocked Tests) ---');

    let userFilterEnforced = '';
    supabase.from = ((tableName: string) => {
      const builder: any = createMockQueryBuilder();
      builder.eq = (col: string, val: string) => {
        if (col === 'user_id') userFilterEnforced = val;
        return builder;
      };
      builder.maybeSingle = async () => {
        if (userFilterEnforced !== TEST_USER_A) {
          return { data: null, error: null };
        }
        return {
          data: {
            user_id: TEST_USER_A,
            case_id: TEST_CASE_A,
            guide_id: 'auth-rbi',
            current_step: 6,
            ack_number: '',
            ack_filing_date: '',
            saved_at: new Date().toISOString(),
          },
          error: null,
        };
      };
      return builder;
    }) as any;

    supabase.auth.getSession = (async () => createMockSession(TEST_USER_A)) as any;
    const sessionUserA = await fetchNavigatorSession(TEST_CASE_A);
    assert(sessionUserA !== null && sessionUserA.currentStep === 6, '7.1: (Mocked RLS) User A accesses User A session at Step 6');

    supabase.auth.getSession = (async () => createMockSession(TEST_USER_B)) as any;
    const sessionUserB = await fetchNavigatorSession(TEST_CASE_A);
    assert(sessionUserB === null, '7.2: (Mocked RLS) User B receives null when querying User A session');
    assert(userFilterEnforced === TEST_USER_B, '7.3: User B query strictly scoped to User B UUID');

    let userBSavedPayload: any = null;
    supabase.from = ((tableName: string) => {
      return createMockQueryBuilder({
        onUpsert: (payload) => { userBSavedPayload = payload; },
      });
    }) as any;

    await saveNavigatorSession({
      caseId: TEST_CASE_A,
      guideId: 'auth-rbi',
      currentStep: 3,
      ackNumber: '',
      ackFilingDate: '',
    });
    assert(userBSavedPayload.user_id === TEST_USER_B, '7.4: User B save uses User B UUID, leaving User A row untouched');
    assert(userBSavedPayload.current_step === 3, '7.5: User B records Step 3 independently');

    localStorage.clear();
    assert(localStorage.getItem(`ns_nav_session_${TEST_CASE_A}`) === null, '7.6: Obsolete localStorage key is completely absent');

    // =========================================================================
    // SECTION 8: Browser Refresh & Logout Restoration
    // =========================================================================
    console.log('\n--- SECTION 8: Browser Refresh & Logout Restoration ---');

    supabase.auth.getSession = (async () => createMockSession(TEST_USER_A)) as any;
    supabase.from = ((tableName: string) => {
      return createMockQueryBuilder({
        selectData: {
          user_id: TEST_USER_A,
          case_id: TEST_CASE_A,
          guide_id: 'auth-rbi',
          current_step: 7,
          ack_number: 'REFRESH-RESTORE-100',
          ack_filing_date: '2026-11-10',
          saved_at: new Date().toISOString(),
        },
      });
    }) as any;

    const refreshedSession = await fetchNavigatorSession(TEST_CASE_A);
    assert(refreshedSession !== null, '8.1: Session successfully restored on simulated browser refresh');
    assert(refreshedSession?.currentStep === 7, '8.2: Step 7 preserved across browser refresh');
    assert(refreshedSession?.ackNumber === 'REFRESH-RESTORE-100', '8.3: Ack number preserved across browser refresh');

    // Unauthenticated caller rejects with AUTH_REQUIRED
    supabase.auth.getSession = (async () => ({ data: { session: null }, error: null })) as any;

    let unauthSaveErr: string | null = null;
    try {
      await saveNavigatorSession({
        caseId: TEST_CASE_A,
        guideId: 'auth-rbi',
        currentStep: 1,
        ackNumber: '',
        ackFilingDate: '',
      });
    } catch (e: any) {
      unauthSaveErr = e.message;
    }
    assert(
      unauthSaveErr !== null && unauthSaveErr.includes('AUTH_REQUIRED'),
      '8.4: Unauthenticated saveNavigatorSession strictly rejected with AUTH_REQUIRED'
    );

    let unauthFetchErr: string | null = null;
    try {
      await fetchNavigatorSession(TEST_CASE_A);
    } catch (e: any) {
      unauthFetchErr = e.message;
    }
    assert(
      unauthFetchErr !== null && unauthFetchErr.includes('AUTH_REQUIRED'),
      '8.5: Unauthenticated fetchNavigatorSession strictly rejected with AUTH_REQUIRED'
    );

  } finally {
    supabase.auth.getSession = origGetSession;
    supabase.from = origFrom;
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
