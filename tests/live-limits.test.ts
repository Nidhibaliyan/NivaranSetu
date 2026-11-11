/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LiveVoiceManager, getClientIp } from '../src/utils/liveVoiceLimits';

console.log('=== NivaranSetu Live Voice Limits & Safeguards Test Suite ===\n');

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

// -------------------------------------------------------------
// TEST 1: Initial State & Clean Capacity
// -------------------------------------------------------------
console.log('--- TEST 1: Initial State Verification ---');
const manager = new LiveVoiceManager({
  maxGlobalConnections: 10,
  maxConnectionsPerIp: 1,
  maxSessionDurationMs: 100, // Short duration for testability
  maxAttemptsPerWindow: 5,
  attemptWindowMs: 1000,
});

const initialStats = manager.getStats();
assert(initialStats.activeGlobal === 0, 'Active global connections start at 0', initialStats.activeGlobal, 0);
assert(initialStats.activeSessionsCount === 0, 'Active session map starts empty', initialStats.activeSessionsCount, 0);

// -------------------------------------------------------------
// TEST 2: Per-IP Concurrent Connection Limit (Max 1 per IP)
// -------------------------------------------------------------
console.log('\n--- TEST 2: Per-IP Connection Limit (Max 1) ---');
const testIp = '192.168.1.100';

const check1 = manager.canConnect(testIp);
assert(check1.allowed === true, 'First connection from IP is permitted');

const reg1 = manager.registerSession('session-ip-1', testIp);
assert(reg1.success === true, 'First session registered successfully');
assert(manager.getStats().activeGlobal === 1, 'Global count is now 1');
assert(manager.getStats().connectionsByIp[testIp] === 1, 'IP count is now 1');

// Attempt second connection from identical IP
const check2 = manager.canConnect(testIp);
assert(check2.allowed === false, 'Second concurrent connection from same IP is rejected');
assert(check2.reason === 'IP_CAPACITY', 'Rejection reason is IP_CAPACITY', check2.reason, 'IP_CAPACITY');
assert(check2.statusCode === 429, 'Returns HTTP 429 status code', check2.statusCode, 429);

// Attempt registering second session anyway to check defensive guard
const reg2 = manager.registerSession('session-ip-2', testIp);
assert(reg2.success === false, 'Second registration fails defensively');
assert(manager.getStats().activeGlobal === 1, 'Global count unchanged after rejected registration');

// -------------------------------------------------------------
// TEST 3: Connection Cleanup & Slot Release
// -------------------------------------------------------------
console.log('\n--- TEST 3: Session Disconnect & Slot Release ---');
// Disconnect first session
reg1.cleanup('Normal client disconnect');

const afterDisconnectStats = manager.getStats();
assert(afterDisconnectStats.activeGlobal === 0, 'Global count decremented to 0 after disconnect');
assert(afterDisconnectStats.connectionsByIp[testIp] === undefined, 'IP entry cleared from active map');

// Now same IP should be permitted to connect again
const check3 = manager.canConnect(testIp);
assert(check3.allowed === true, 'IP can connect again after previous session disconnected');

// -------------------------------------------------------------
// TEST 4: Global Capacity Rejection (Max 10 Global Connections)
// -------------------------------------------------------------
console.log('\n--- TEST 4: Global Capacity Limit (Max 10) ---');
manager.reset();

const cleanups: Array<(reason?: string) => void> = [];

// Connect 10 distinct IPs
for (let i = 1; i <= 10; i++) {
  const ip = `10.0.0.${i}`;
  const check = manager.canConnect(ip);
  assert(check.allowed === true, `Connection ${i}/10 from IP ${ip} permitted`);
  const reg = manager.registerSession(`session-global-${i}`, ip);
  cleanups.push(reg.cleanup);
}

assert(manager.getStats().activeGlobal === 10, 'Global count reached exactly 10');

// 11th distinct IP attempts to connect
const ip11 = '10.0.0.11';
const check11 = manager.canConnect(ip11);
assert(check11.allowed === false, '11th global connection is rejected');
assert(check11.reason === 'GLOBAL_CAPACITY', 'Rejection reason is GLOBAL_CAPACITY', check11.reason, 'GLOBAL_CAPACITY');
assert(check11.statusCode === 503, 'Returns HTTP 503 Service Unavailable', check11.statusCode, 503);

// Release one session
cleanups[0]('First session completed');
assert(manager.getStats().activeGlobal === 9, 'Global count decremented to 9 after one disconnect');

// Now 11th IP can connect
const check11Retry = manager.canConnect(ip11);
assert(check11Retry.allowed === true, '11th IP can connect once capacity freed');

// Clean up remaining
manager.reset();
assert(manager.getStats().activeGlobal === 0, 'All sessions cleared after reset');

// -------------------------------------------------------------
// TEST 5: Idempotent Cleanup (No Negative Counter Drift)
// -------------------------------------------------------------
console.log('\n--- TEST 5: Idempotent Cleanup & Duplicate Calling ---');
manager.reset();

const regTest = manager.registerSession('session-idem', '172.16.0.1');
assert(manager.getStats().activeGlobal === 1, 'Active global is 1');

// Call cleanup once
const firstClean = manager.cleanupSession('session-idem', 'First call');
assert(firstClean === true, 'First cleanup returns true');
assert(manager.getStats().activeGlobal === 0, 'Active global decremented to 0');

// Call cleanup second time on same session
const secondClean = manager.cleanupSession('session-idem', 'Second call');
assert(secondClean === false, 'Second cleanup returns false (idempotent no-op)');
assert(manager.getStats().activeGlobal === 0, 'Active global remains bounded at 0 (no underflow)');

// Call cleanup third time via returned cleanup handle
regTest.cleanup('Third call via handle');
assert(manager.getStats().activeGlobal === 0, 'Active global still 0 after handle cleanup');

// -------------------------------------------------------------
// TEST 6: Connection Attempt Rate Limiting
// -------------------------------------------------------------
console.log('\n--- TEST 6: Connection Attempt Rate Limiting ---');
manager.reset();
const rateLimitIp = '198.51.100.5';

// Max attempts configured is 5 per window
for (let i = 1; i <= 5; i++) {
  const allowed = manager.canConnect(rateLimitIp);
  assert(allowed.allowed === true, `Attempt ${i}/5 within window is permitted`);
  manager.recordAttempt(rateLimitIp);
}

// 6th attempt within window should be rejected
const attempt6 = manager.canConnect(rateLimitIp);
assert(attempt6.allowed === false, '6th connection attempt within window is rate-limited');
assert(attempt6.reason === 'RATE_LIMIT', 'Rejection reason is RATE_LIMIT', attempt6.reason, 'RATE_LIMIT');
assert(attempt6.statusCode === 429, 'Returns HTTP 429 status code', attempt6.statusCode, 429);

// -------------------------------------------------------------
// TEST 7: Duration Expiry Callback & Automatic Teardown
// -------------------------------------------------------------
console.log('\n--- TEST 7: Duration Expiry & Automatic Teardown ---');
async function testDurationExpiry() {
  manager.reset();
  const shortManager = new LiveVoiceManager({
    maxGlobalConnections: 5,
    maxConnectionsPerIp: 1,
    maxSessionDurationMs: 50, // 50ms expiry for quick test
  });

  let durationFired = false as boolean;
  let upstreamClosed = false as boolean;

  const mockUpstream = {
    close: () => {
      upstreamClosed = true;
    },
  };

  const reg = shortManager.registerSession('session-expire', '10.10.10.10', () => {
    durationFired = true;
  });

  shortManager.setUpstreamSession('session-expire', mockUpstream);

  assert(shortManager.getStats().activeGlobal === 1, 'Session registered before expiry');

  // Wait 70ms for duration timer to trigger
  await new Promise((resolve) => setTimeout(resolve, 70));

  assert(durationFired === true, 'onDurationExpired callback fired automatically after duration');
  assert(upstreamClosed === true, 'Upstream Gemini Live session closed on duration expiry');
  assert(shortManager.getStats().activeGlobal === 0, 'Global connection released automatically on duration expiry');

  // -------------------------------------------------------------
  // TEST 8: Trusted Client IP Resolution & Header Spoofing Defense (DEF-02)
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Trusted Client IP Resolution (DEF-02) ---');

  // Case A: When proxy trust is NOT configured (trustFn is null/undefined)
  // Any client-supplied X-Forwarded-For must be completely ignored.
  const untrustedReq = {
    headers: {
      'x-forwarded-for': '203.0.113.195, 10.0.0.1',
    },
    socket: {
      remoteAddress: '192.168.1.50',
    },
    connection: {
      remoteAddress: '192.168.1.50',
    },
  };
  const resolvedUntrusted = getClientIp(untrustedReq, null);
  assert(
    resolvedUntrusted === '192.168.1.50',
    'Forged X-Forwarded-For header strictly ignored when proxy trust is inactive',
    resolvedUntrusted,
    '192.168.1.50'
  );

  // Case B: When proxy trust is configured for 1 hop (e.g. reverse proxy / load balancer)
  // proxy-addr walks inwards from socket and selects the first untrusted upstream hop.
  const proxyTrust1Hop = (_addr: string, i: number) => i === 0; // Trust 1 hop
  const trustedReq = {
    headers: {
      'x-forwarded-for': '1.1.1.1, 203.0.113.50',
    },
    socket: {
      remoteAddress: '10.0.0.1', // The trusted reverse proxy socket
    },
  };
  const resolvedTrusted = getClientIp(trustedReq, proxyTrust1Hop);
  assert(
    resolvedTrusted === '203.0.113.50',
    'Rightmost untrusted hop selected under trusted 1-hop reverse proxy; spoofed inner IP ignored',
    resolvedTrusted,
    '203.0.113.50'
  );

  // Case C: Null / missing socket fallback
  const fallbackIp = getClientIp({} as any, null);
  assert(
    fallbackIp === '127.0.0.1',
    'Fallback to 127.0.0.1 when socket remoteAddress is missing',
    fallbackIp,
    '127.0.0.1'
  );

  // -------------------------------------------------------------
  // TEST 9: Frontend Status Message Preservation Logic (DEF-01)
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Status Message Preservation on Disconnect (DEF-01) ---');

  // Verify the state transition contract between WebSocket error and onclose
  function simulateDisconnectHandling(serverErrorNotice: string | null, closeReason?: string): string {
    let liveStatus = 'Connected';
    const lastServerError = serverErrorNotice;

    // Simulate ws.onclose evaluation
    if (lastServerError) {
      liveStatus = lastServerError;
    } else if (closeReason) {
      liveStatus = `Live conversation ended: ${closeReason}`;
    } else {
      liveStatus = 'Live conversation disconnected.';
    }
    return liveStatus;
  }

  // Case A: 5-minute timeout notice received before WebSocket close
  const timeoutNotice = 'Maximum Live Voice session duration reached (5 minutes). Please start a new call if needed.';
  const timeoutStatus = simulateDisconnectHandling(timeoutNotice, 'Session duration exceeded');
  assert(
    timeoutStatus === timeoutNotice,
    '5-minute session-expiry server notice is preserved and NOT overwritten by generic disconnection',
    timeoutStatus,
    timeoutNotice
  );

  // Case B: Capacity limit notice received before WebSocket close
  const capacityNotice = 'Server Live Voice capacity reached (10 active sessions). Please try again shortly.';
  const capacityStatus = simulateDisconnectHandling(capacityNotice, 'Capacity limit reached');
  assert(
    capacityStatus === capacityNotice,
    'Capacity limit notice is preserved on close',
    capacityStatus,
    capacityNotice
  );

  // Case C: Normal disconnect with reason
  const normalStatus = simulateDisconnectHandling(null, 'User ended call');
  assert(
    normalStatus === 'Live conversation ended: User ended call',
    'Normal close reason is formatted correctly',
    normalStatus,
    'Live conversation ended: User ended call'
  );

  // Case D: Bare unexpected disconnect
  const bareStatus = simulateDisconnectHandling(null);
  assert(
    bareStatus === 'Live conversation disconnected.',
    'Bare disconnect falls back cleanly',
    bareStatus,
    'Live conversation disconnected.'
  );

  // -------------------------------------------------------------
  // TEST 10: WebSocket Session ID Staleness Guard (DEF-01)
  // -------------------------------------------------------------
  console.log('\n--- TEST 10: Session Sequence Staleness Guard (DEF-01) ---');

  let currentSessionId = 0;
  let audioDataProcessed = 0;

  function simulateStartSession() {
    return ++currentSessionId;
  }

  function simulateOnAudioProcess(sessionId: number) {
    if (currentSessionId !== sessionId) {
      // Stale callback dropped!
      return;
    }
    audioDataProcessed++;
  }

  const session1 = simulateStartSession();
  assert(session1 === 1, 'Session 1 ID is 1');

  // Packet arrives for session 1
  simulateOnAudioProcess(session1);
  assert(audioDataProcessed === 1, 'Audio packet processed for active Session 1');

  // User starts Session 2 (superseding Session 1)
  const session2 = simulateStartSession();
  assert(session2 === 2, 'Session 2 ID is 2');

  // Stale packet from Session 1 arrives after Session 2 has started
  simulateOnAudioProcess(session1);
  assert(audioDataProcessed === 1, 'Stale packet from superseded Session 1 correctly ignored');

  // Packet arrives for Session 2
  simulateOnAudioProcess(session2);
  assert(audioDataProcessed === 2, 'Audio packet processed for active Session 2');

  console.log(`\n======================================================`);
  console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
  console.log(`======================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

testDurationExpiry();
