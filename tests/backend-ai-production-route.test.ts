/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — Milestone 2, Step 7, Step E
 * Production AI Route Validation Suite (Child Process Execution)
 *
 * Scope:
 * - Tests the actual `/api/gemini/chat` route implementation by starting the real
 *   production `server.ts` as a controlled child process.
 * - DOES NOT duplicate the route or its validation logic in a separate Express harness.
 * - Binds STRICTLY to loopback `HOST=127.0.0.1` on dedicated non-colliding ports.
 * - Explicitly prevents external network exposure: NEVER listens on `0.0.0.0`.
 * - Port collision protection: verifies port is vacant with Node's `net` module before spawning.
 * - Readiness probe uses GET `/api/gemini/status` with server-identity verification,
 *   guaranteeing 0 chatLimiter requests are consumed during readiness.
 * - Strict rate-limit accounting: accounts for exactly 7 chat requests from Tests 3-9,
 *   sends exactly 18 fill requests (asserting 400), then verifies request #26 triggers HTTP 429.
 * - Never uses or inherits real Gemini API credentials.
 * - All tests use invalid payloads that terminate at input validation or body parsing
 *   before the Gemini SDK is invoked. Zero outbound calls to Google occur.
 * - Zero Supabase or database interactions.
 * - Guaranteed process tree termination via native Windows taskkill in `finally` and `catch` blocks.
 * - Post-termination verification confirms loopback ports refuse connections.
 */

import { spawn, ChildProcess, execSync } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';

console.log('=== NivaranSetu Step 7, Step E: Production Gemini Route Test Suite ===\n');

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

interface TestServerInstance {
  process: ChildProcess;
  port: number;
  host: string;
  baseUrl: string;
}

/**
 * Pre-spawn port collision protection:
 * Probes host:port to verify that the port is NOT in use before spawning.
 * - If connection succeeds -> Port is already in use -> aborts with PORT_COLLISION_ABORT.
 * - If ECONNREFUSED -> Positive confirmation of no listener -> resolves safely.
 * - If timeout, EHOSTUNREACH, or any other error -> Ambiguous status -> aborts with PORT_COLLISION_ABORT.
 */
function verifyPortAvailable(host: string, port: number, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      settled = true;
      socket.destroy();
      reject(
        new Error(
          `PORT_COLLISION_ABORT: Port ${port} on ${host} is already in use by another active service. Refusing to spawn test server.`
        )
      );
    });

    socket.on('timeout', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(
          new Error(
            `PORT_COLLISION_ABORT: Socket timed out probing port ${port} on ${host}. Ambiguous listener status, aborting for safety.`
          )
        );
      }
    });

    socket.on('error', (err: any) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        if (err.code === 'ECONNREFUSED') {
          resolve(); // Positive OS kernel confirmation of no listener
        } else {
          reject(
            new Error(
              `PORT_COLLISION_ABORT: Unexpected socket error probing ${host}:${port} (${err.code || err.message}). Aborting for safety.`
            )
          );
        }
      }
    });

    socket.connect(port, host);
  });
}

/**
 * Safely terminates a child process and its entire process tree on Windows or POSIX.
 * Avoids executing taskkill if the child process has already confirmed exited.
 */
function terminateProcessTree(child: ChildProcess): void {
  const pid = child.pid;
  if (!pid || child.exitCode !== null) {
    return; // Child already confirmed exited or PID invalid
  }

  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } catch {
      // Process may have already terminated in race
    }
  } else {
    try {
      execSync(`pkill -P ${pid} 2>/dev/null || true; kill -9 ${pid} 2>/dev/null || true`, { stdio: 'ignore' });
    } catch {}
  }
}

/**
 * Verifies that a loopback port is closed and actively refuses connections.
 */
async function verifyPortClosed(host: string, port: number, timeoutMs = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const isClosed = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(250);
      socket.on('connect', () => {
        socket.destroy();
        resolve(false); // Still accepting connections
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(true); // Timed out, not accepting
      });
      socket.on('error', (err: any) => {
        socket.destroy();
        if (err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH') {
          resolve(true); // Connection refused -> port is closed
        } else {
          resolve(false);
        }
      });
      socket.connect(port, host);
    });

    if (isClosed) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

/**
 * Starts the actual production server.ts in an isolated child process bound strictly to loopback (127.0.0.1).
 * Features:
 * - Pre-spawn vacancy check using Node net socket.
 * - Sanitized environment overriding real Gemini and Supabase credentials.
 * - Readiness polling against GET /api/gemini/status with production signature verification.
 * - Guaranteed child process termination if any startup or readiness error occurs.
 */
async function startProductionServer(options: {
  port: number;
  geminiApiKey: string;
  timeoutMs?: number;
}): Promise<TestServerInstance> {
  const { port, geminiApiKey, timeoutMs = 20000 } = options;
  const host = '127.0.0.1';
  const cliPath = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
  const serverPath = path.resolve(process.cwd(), 'server.ts');

  // Step 1: Pre-spawn port vacancy check
  await verifyPortAvailable(host, port);

  // Step 2: Strip real credentials from environment to prevent accidental inheritance
  const sanitizedEnv = { ...process.env };
  delete sanitizedEnv.GEMINI_API_KEY;
  delete sanitizedEnv.SUPABASE_TEST_PASSWORD;
  delete sanitizedEnv.SUPABASE_TEST_PASSWORD_2;
  delete sanitizedEnv.SUPABASE_SERVICE_ROLE_KEY;
  delete sanitizedEnv.VITE_SUPABASE_ANON_KEY;

  const child = spawn(process.execPath, [cliPath, serverPath], {
    cwd: process.cwd(),
    env: {
      ...sanitizedEnv,
      HOST: host,
      PORT: String(port),
      GEMINI_API_KEY: geminiApiKey,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const pid = child.pid;
  if (!pid) {
    throw new Error('SAFETY_ABORT: Failed to spawn production server child process.');
  }

  // Wrap all startup and readiness handling in try-catch to guarantee child termination on any failure
  try {
    let serverOutput = '';
    child.stdout?.on('data', (chunk) => {
      serverOutput += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      serverOutput += chunk.toString();
    });

    // Step 3: Poll GET /api/gemini/status to establish readiness and verify server ownership
    // This does NOT touch chatLimiter (which is mounted exclusively on /api/gemini/chat).
    const start = Date.now();
    let isReady = false;

    while (Date.now() - start < timeoutMs) {
      if (child.exitCode !== null) {
        throw new Error(`Server process exited prematurely (code: ${child.exitCode}). Logs:\n${serverOutput}`);
      }

      try {
        const res = await fetch(`http://${host}:${port}/api/gemini/status`, {
          method: 'GET',
          signal: AbortSignal.timeout(500),
        });

        if (res.status === 200) {
          const data = await res.json().catch(() => null);
          // Confirm server ownership: response must match NivaranSetu server.ts status signature
          if (data?.status === 'ok' && data?.models?.default === 'gemini-3.8-flash') {
            // Confirm the spawned child is still actively running
            if (child.exitCode === null) {
              isReady = true;
              break;
            }
          }
        }
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    if (!isReady) {
      throw new Error(
        `Server failed to become ready on ${host}:${port} within ${timeoutMs}ms or ownership unconfirmed. Logs:\n${serverOutput}`
      );
    }

    return {
      process: child,
      port,
      host,
      baseUrl: `http://${host}:${port}`,
    };
  } catch (err) {
    // If any failure occurs during readiness detection, immediately terminate child process tree
    terminateProcessTree(child);
    throw err;
  }
}

/**
 * Stops the server and guarantees process termination and port closure.
 */
async function stopProductionServer(instance: TestServerInstance | null): Promise<boolean> {
  if (!instance?.process) return true;

  terminateProcessTree(instance.process);
  const closed = await verifyPortClosed(instance.host, instance.port);
  return closed;
}

async function runTests() {
  const PORT_UNCONFIGURED = 3198;
  const PORT_VALIDATION = 3199;

  // -------------------------------------------------------------
  // PHASE 1: Missing API Key Verification (Server 1)
  // -------------------------------------------------------------
  console.log('--- PHASE 1: Missing API Key (503) ---');
  let server1: TestServerInstance | null = null;
  try {
    console.log(`[SPAWN] Starting production server on 127.0.0.1:${PORT_UNCONFIGURED} with missing GEMINI_API_KEY...`);
    server1 = await startProductionServer({
      port: PORT_UNCONFIGURED,
      geminiApiKey: '',
    });

    const res1 = await fetch(`${server1.baseUrl}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', text: 'Hello' }] }),
    });
    const data1 = await res1.json().catch(() => ({}));

    assert(
      res1.status === 503 && data1.configured === false && typeof data1.error === 'string' && data1.error.includes('not configured'),
      '1: Missing API key returns HTTP 503 with configured: false',
      { status: res1.status, configured: data1.configured },
      { status: 503, configured: false }
    );
  } finally {
    console.log('[CLEANUP] Stopping Server 1...');
    const closed = await stopProductionServer(server1);
    assert(closed, 'Cleanup 1: Server 1 process terminated and loopback port 3198 closed');
  }

  // -------------------------------------------------------------
  // PHASE 2: Placeholder API Key Verification (Server 2)
  // -------------------------------------------------------------
  console.log('\n--- PHASE 2: Placeholder API Key (503) ---');
  let server2: TestServerInstance | null = null;
  try {
    console.log(`[SPAWN] Starting production server on 127.0.0.1:${PORT_UNCONFIGURED} with placeholder key...`);
    server2 = await startProductionServer({
      port: PORT_UNCONFIGURED,
      geminiApiKey: 'your-gemini-api-key-here',
    });

    const res2 = await fetch(`${server2.baseUrl}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', text: 'Hello' }] }),
    });
    const data2 = await res2.json().catch(() => ({}));

    assert(
      res2.status === 503 && data2.configured === false,
      '2: Placeholder API key returns HTTP 503 with configured: false',
      { status: res2.status, configured: data2.configured },
      { status: 503, configured: false }
    );
  } finally {
    console.log('[CLEANUP] Stopping Server 2...');
    const closed = await stopProductionServer(server2);
    assert(closed, 'Cleanup 2: Server 2 process terminated and loopback port 3198 closed');
  }

  // -------------------------------------------------------------
  // PHASE 3: Request Validation & Limits with Dummy Key (Server 3)
  // -------------------------------------------------------------
  console.log('\n--- PHASE 3: Request Validation & Rate Limits (400, 413, 429) ---');
  let server3: TestServerInstance | null = null;
  const DUMMY_NON_SECRET_KEY = 'test-dummy-non-secret-key-for-validation-only';

  try {
    console.log(`[SPAWN] Starting production server on 127.0.0.1:${PORT_VALIDATION} with dummy validation key...`);
    server3 = await startProductionServer({
      port: PORT_VALIDATION,
      geminiApiKey: DUMMY_NON_SECRET_KEY,
    });

    // Test 3: Missing messages field -> 400 (Request #1 to /api/gemini/chat)
    const res3 = await fetch(`${server3.baseUrl}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data3 = await res3.json().catch(() => ({}));
    assert(
      res3.status === 400 && data3.error?.includes('"messages" must be a non-empty array'),
      '3: Missing messages field returns HTTP 400 Bad Request',
      { status: res3.status, error: data3.error },
      { status: 400, error: 'Validation Error: "messages" must be a non-empty array.' }
    );

    // Test 4: Empty messages array -> 400 (Request #2 to /api/gemini/chat)
    const res4 = await fetch(`${server3.baseUrl}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    const data4 = await res4.json().catch(() => ({}));
    assert(
      res4.status === 400 && data4.error?.includes('"messages" must be a non-empty array'),
      '4: Empty messages array returns HTTP 400 Bad Request',
      { status: res4.status, error: data4.error },
      { status: 400, error: 'Validation Error: "messages" must be a non-empty array.' }
    );

    // Test 5: More than 50 messages -> 400 (Request #3 to /api/gemini/chat)
    const fiftyOneMessages = Array.from({ length: 51 }, (_, i) => ({
      role: 'user',
      text: `Message ${i + 1}`,
    }));
    const res5 = await fetch(`${server3.baseUrl}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: fiftyOneMessages }),
    });
    const data5 = await res5.json().catch(() => ({}));
    assert(
      res5.status === 400 && data5.error?.includes('cannot exceed 50 conversation turns'),
      '5: More than 50 messages returns HTTP 400 Bad Request',
      { status: res5.status, error: data5.error },
      { status: 400, error: 'Validation Error: "messages" array cannot exceed 50 conversation turns.' }
    );

    // Test 6: Invalid role -> 400 (Request #4 to /api/gemini/chat)
    const res6 = await fetch(`${server3.baseUrl}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'admin', text: 'Hello' }] }),
    });
    const data6 = await res6.json().catch(() => ({}));
    assert(
      res6.status === 400 && data6.error?.includes('Invalid role "admin"'),
      '6: Invalid role returns HTTP 400 Bad Request',
      { status: res6.status, error: data6.error },
      { status: 400, error: 'contains Invalid role "admin"' }
    );

    // Test 7: Empty or whitespace text -> 400 (Request #5 to /api/gemini/chat)
    const res7 = await fetch(`${server3.baseUrl}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', text: '     ' }] }),
    });
    const data7 = await res7.json().catch(() => ({}));
    assert(
      res7.status === 400 && data7.error?.includes('empty or non-string "text"'),
      '7: Empty or whitespace text returns HTTP 400 Bad Request',
      { status: res7.status, error: data7.error },
      { status: 400, error: 'contains empty or non-string "text"' }
    );

    // Test 8: Message text exceeding 10,000 characters -> 400 (Request #6 to /api/gemini/chat)
    const oversizedText = 'A'.repeat(10001);
    const res8 = await fetch(`${server3.baseUrl}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', text: oversizedText }] }),
    });
    const data8 = await res8.json().catch(() => ({}));
    assert(
      res8.status === 400 && data8.error?.includes('exceeds maximum limit of 10,000 characters'),
      '8: Message text exceeding 10,000 characters returns HTTP 400 Bad Request',
      { status: res8.status, error: data8.error },
      { status: 400, error: 'contains exceeds maximum limit of 10,000 characters' }
    );

    // Test 9: JSON body exceeding 256 KB -> 413 (Request #7 to /api/gemini/chat)
    // Note: In server.ts, chatLimiter runs before chatBodyParser, so this consumes the 7th slot.
    console.log('[PROBE] Sending oversized JSON body (>256 KB) to test chatBodyParser limit...');
    const largePayload = JSON.stringify({
      messages: [{ role: 'user', text: 'Hello' }],
      padding: 'X'.repeat(300 * 1024), // 300 KB string
    });
    const res9 = await fetch(`${server3.baseUrl}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: largePayload,
    });
    assert(
      res9.status === 413,
      '9: JSON body exceeding 256 KB returns HTTP 413 Payload Too Large',
      res9.status,
      413
    );

    // Test 10: Strict rate-limit accounting (25 chat messages per minute per IP)
    // - Readiness probe used /api/gemini/status -> 0 chatLimiter requests consumed.
    // - Tests 3 through 9 issued exactly 7 requests to /api/gemini/chat.
    // - We now send exactly 18 additional requests (7 + 18 = 25 total requests).
    // - Every single one of these 18 requests must return HTTP 400 (not 429).
    // - Then we send request #19 (overall #26), which must trigger HTTP 429.
    console.log('[PROBE] Sending exactly 18 requests to exhaust chatLimiter threshold (25 total)...');
    let all18Passed = true;
    for (let i = 0; i < 18; i++) {
      const fillRes = await fetch(`${server3.baseUrl}/api/gemini/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      });

      if (fillRes.status !== 400) {
        all18Passed = false;
        assert(
          false,
          `10a: Fill request #${i + 1}/18 returned HTTP 400 without premature rate limiting`,
          fillRes.status,
          400
        );
        break; // Do not continue sending requests after first unexpected response
      }
    }

    if (all18Passed) {
      assert(
        true,
        '10a: Exactly 18 fill requests returned HTTP 400 without premature rate limiting (25 total chat requests received)',
        25,
        25
      );

      // Now send the 19th request (overall request #26) which must trigger rate limiting (HTTP 429)
      console.log('[PROBE] Sending request #19 (overall #26) to verify rate limiter rejection (HTTP 429)...');
      const res10 = await fetch(`${server3.baseUrl}/api/gemini/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      });
      const data10 = await res10.json().catch(() => ({}));

      assert(
        res10.status === 429 && typeof data10.error === 'string' && data10.error.includes('Too many chat requests'),
        '10b: Request #26 returns HTTP 429 Too Many Requests',
        { status: res10.status, error: data10.error },
        { status: 429, error: 'contains Too many chat requests' }
      );
    }

  } finally {
    console.log('[CLEANUP] Stopping Server 3...');
    const closed = await stopProductionServer(server3);
    assert(closed, 'Cleanup 3: Server 3 process terminated and loopback port 3199 closed');
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
  console.error('Fatal error during test runner execution:', err);
  process.exit(1);
});
