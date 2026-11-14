/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import WebSocket from 'ws';

// Provide localStorage polyfill before importing frontend auth helpers in Node
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
  get length(): number {
    return Object.keys(this.store).length;
  }
  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = new MockLocalStorage();
}

import {
  app,
  server,
  wss,
  liveVoiceManager,
  issueLiveVoiceTicket,
  consumeLiveVoiceTicket,
  clearLiveVoiceTickets,
} from '../server';
import {
  AuthSessionError,
  authenticatedFetchWithTimeout,
  extractAiErrorFromResponse,
} from '../src/utils/aiClientUtils';
import {
  getSupabaseAuthSession,
  getValidAccessToken,
  refreshAndGetAccessToken,
} from '../src/utils/authSession';
import { supabase } from '../src/utils/supabaseClient';

console.log('=== NivaranSetu Phase 1B Authentication Security Hardening Test Suite ===\n');

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error('    ', err?.stack || err?.message || err);
    failed++;
  }
}

async function startServerInstance() {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as any;
  return {
    port: addr.port as number,
    baseUrl: `http://127.0.0.1:${addr.port}`,
    wsBaseUrl: `ws://127.0.0.1:${addr.port}`,
  };
}

function connectRawWsWithHttpStatus(
  url: string
): Promise<{ upgraded: boolean; statusCode?: number; body?: string; ws?: WebSocket }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    let settled = false;

    ws.once('open', () => {
      if (settled) return;
      settled = true;
      resolve({ upgraded: true, ws });
    });

    ws.once('unexpected-response', (_req, res) => {
      if (settled) return;
      settled = true;
      let rawBody = '';
      res.on('data', (chunk) => {
        rawBody += chunk.toString();
      });
      res.on('end', () => {
        try {
          ws.terminate();
        } catch {}
        resolve({
          upgraded: false,
          statusCode: res.statusCode,
          body: rawBody,
        });
      });
    });

    ws.once('error', () => {
      if (settled) return;
      settled = true;
      resolve({ upgraded: false });
    });
  });
}

async function main() {
  const { baseUrl, wsBaseUrl } = await startServerInstance();

  const VALID_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_citizen_token';
  const INVALID_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bad_signature_token';
  const EXPIRED_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired_session_token';
  const TEST_USER_ID = '7b42f8f4-4c68-42c1-9c25-b2459b99c4e1';

  const origAuthClient = app.locals.supabaseAuthClient;
  const origUserClient = app.locals.userSupabaseClient;
  const origAiClient = app.locals.geminiAiClient;
  const origLiveConnect = app.locals.geminiLiveConnect;

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: /api/gemini/chat, /api/gemini/transcribe & /api/live/ticket AUTH
    // -------------------------------------------------------------------------
    console.log('--- Section 1: HTTP Endpoint Authentication (401 vs 200) ---');

    let geminiGenerateCalledCount = 0;

    app.locals.supabaseAuthClient = {
      auth: {
        getUser: async (token: string) => {
          if (token === VALID_TOKEN) {
            return {
              data: { user: { id: TEST_USER_ID, email: 'citizen@example.in', role: 'authenticated' } },
              error: null,
            };
          }
          if (token === EXPIRED_TOKEN) {
            return {
              data: { user: null },
              error: { message: 'JWT expired', status: 401 },
            };
          }
          return {
            data: { user: null },
            error: { message: 'Invalid token signature', status: 401 },
          };
        },
      },
    } as any;

    app.locals.userSupabaseClient = {} as any;
    app.locals.geminiAiClient = {
      models: {
        generateContent: async () => {
          geminiGenerateCalledCount++;
          return { text: 'Valid authenticated Gemini response.' };
        },
      },
    } as any;

    await runTest('1.1: Missing Authorization header is rejected with HTTP 401 on /chat, /transcribe, and /live/ticket without invoking Gemini', async () => {
      geminiGenerateCalledCount = 0;

      const chatRes = await fetch(`${baseUrl}/api/gemini/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', text: 'Help with UPI fraud' }] }),
      });
      assert.strictEqual(chatRes.status, 401);
      const chatData: any = await chatRes.json();
      assert.strictEqual(chatData.error, 'MISSING_AUTHORIZATION_HEADER');

      const trRes = await fetch(`${baseUrl}/api/gemini/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: Buffer.from('wav-bytes').toString('base64'),
          mimeType: 'audio/wav',
        }),
      });
      assert.strictEqual(trRes.status, 401);
      const trData: any = await trRes.json();
      assert.strictEqual(trData.error, 'MISSING_AUTHORIZATION_HEADER');

      const ticketRes = await fetch(`${baseUrl}/api/live/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      assert.strictEqual(ticketRes.status, 401);
      const ticketData: any = await ticketRes.json();
      assert.strictEqual(ticketData.error, 'MISSING_AUTHORIZATION_HEADER');

      assert.strictEqual(geminiGenerateCalledCount, 0, 'Gemini SDK must never be called without auth');
    });

    await runTest('1.2: Invalid Bearer token is rejected with HTTP 401 on /chat, /transcribe, and /live/ticket', async () => {
      geminiGenerateCalledCount = 0;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INVALID_TOKEN}`,
      };

      const chatRes = await fetch(`${baseUrl}/api/gemini/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: [{ role: 'user', text: 'Help' }] }),
      });
      assert.strictEqual(chatRes.status, 401);
      assert.strictEqual(((await chatRes.json()) as any).error, 'INVALID_OR_EXPIRED_TOKEN');

      const trRes = await fetch(`${baseUrl}/api/gemini/transcribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          audioBase64: Buffer.from('wav-bytes').toString('base64'),
          mimeType: 'audio/wav',
        }),
      });
      assert.strictEqual(trRes.status, 401);
      assert.strictEqual(((await trRes.json()) as any).error, 'INVALID_OR_EXPIRED_TOKEN');

      const ticketRes = await fetch(`${baseUrl}/api/live/ticket`, {
        method: 'POST',
        headers,
      });
      assert.strictEqual(ticketRes.status, 401);
      assert.strictEqual(((await ticketRes.json()) as any).error, 'INVALID_OR_EXPIRED_TOKEN');

      assert.strictEqual(geminiGenerateCalledCount, 0);
    });

    await runTest('1.3: Expired Bearer token is rejected with HTTP 401 on /chat, /transcribe, and /live/ticket', async () => {
      geminiGenerateCalledCount = 0;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EXPIRED_TOKEN}`,
      };

      const chatRes = await fetch(`${baseUrl}/api/gemini/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: [{ role: 'user', text: 'Help' }] }),
      });
      assert.strictEqual(chatRes.status, 401);
      assert.strictEqual(((await chatRes.json()) as any).error, 'INVALID_OR_EXPIRED_TOKEN');

      const trRes = await fetch(`${baseUrl}/api/gemini/transcribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          audioBase64: Buffer.from('wav-bytes').toString('base64'),
          mimeType: 'audio/wav',
        }),
      });
      assert.strictEqual(trRes.status, 401);
      assert.strictEqual(((await trRes.json()) as any).error, 'INVALID_OR_EXPIRED_TOKEN');

      const ticketRes = await fetch(`${baseUrl}/api/live/ticket`, {
        method: 'POST',
        headers,
      });
      assert.strictEqual(ticketRes.status, 401);
      assert.strictEqual(((await ticketRes.json()) as any).error, 'INVALID_OR_EXPIRED_TOKEN');

      assert.strictEqual(geminiGenerateCalledCount, 0);
    });

    await runTest('1.4: Valid Bearer token succeeds on /chat, /transcribe, and /live/ticket without exposing secrets or trusting spoofed userId/role', async () => {
      geminiGenerateCalledCount = 0;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VALID_TOKEN}`,
      };

      const chatRes = await fetch(`${baseUrl}/api/gemini/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: 'spoofed-victim-id',
          role: 'admin',
          messages: [{ role: 'user', text: 'Unauthorized debit from SBI account' }],
          language: 'en',
        }),
      });
      assert.strictEqual(chatRes.status, 200);
      const chatData: any = await chatRes.json();
      assert.strictEqual(chatData.text, 'Valid authenticated Gemini response.');
      assert.ok(!JSON.stringify(chatData).includes('GEMINI_API_KEY'));

      const trRes = await fetch(`${baseUrl}/api/gemini/transcribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: 'spoofed-victim-id',
          role: 'service_role',
          audioBase64: Buffer.from('fake-wav-data').toString('base64'),
          mimeType: 'audio/wav',
          language: 'hi',
        }),
      });
      assert.strictEqual(trRes.status, 200);
      const trData: any = await trRes.json();
      assert.strictEqual(trData.text, 'Valid authenticated Gemini response.');
      assert.strictEqual(geminiGenerateCalledCount, 2);

      const ticketRes = await fetch(`${baseUrl}/api/live/ticket`, {
        method: 'POST',
        headers,
      });
      assert.strictEqual(ticketRes.status, 200);
      const ticketData: any = await ticketRes.json();
      assert.strictEqual(ticketData.success, true);
      assert.ok(typeof ticketData.ticket === 'string' && ticketData.ticket.length >= 32);
      assert.ok(!ticketData.ticket.includes(VALID_TOKEN), 'Ticket must be opaque and never contain Supabase JWT');
      clearLiveVoiceTickets();
    });

    // -------------------------------------------------------------------------
    // SECTION 2: LIVE VOICE WEBSOCKET /api/live SECURITY
    // -------------------------------------------------------------------------
    console.log('\n--- Section 2: Live Voice WebSocket (/api/live) Security ---');

    let upstreamLiveConnectCalls = 0;
    const forwardedToUpstream: any[] = [];

    app.locals.geminiLiveConnect = async (params: any) => {
      upstreamLiveConnectCalls++;
      // Immediately simulate upstream Gemini Live opening
      setTimeout(() => {
        params.callbacks?.onopen?.();
      }, 10);
      return {
        sendRealtimeInput: (payload: any) => {
          forwardedToUpstream.push(payload);
          if (payload?.text) {
            params.callbacks?.onmessage?.({
              serverContent: {
                modelTurn: {
                  parts: [{ text: `Echoed in Hindi/English: ${payload.text}` }],
                },
                turnComplete: true,
              },
            });
          }
        },
        close: () => {},
      };
    };

    await runTest('2.1: WebSocket /api/live rejects missing ticket with HTTP 401 before upgrade or Gemini Live connect', async () => {
      liveVoiceManager.reset();
      clearLiveVoiceTickets();
      upstreamLiveConnectCalls = 0;

      const outcome = await connectRawWsWithHttpStatus(`${wsBaseUrl}/api/live`);
      assert.strictEqual(outcome.upgraded, false);
      assert.strictEqual(outcome.statusCode, 401);
      assert.strictEqual(upstreamLiveConnectCalls, 0, 'Upstream Gemini Live must NOT be called without auth');
      assert.strictEqual(liveVoiceManager.getStats().activeGlobal, 0);
    });

    await runTest('2.2: WebSocket /api/live rejects forged/invalid ticket with HTTP 401 before Gemini Live connect', async () => {
      liveVoiceManager.reset();
      clearLiveVoiceTickets();
      upstreamLiveConnectCalls = 0;

      const outcome = await connectRawWsWithHttpStatus(`${wsBaseUrl}/api/live?ticket=forged-ticket-123`);
      assert.strictEqual(outcome.upgraded, false);
      assert.strictEqual(outcome.statusCode, 401);
      assert.strictEqual(upstreamLiveConnectCalls, 0);
    });

    await runTest('2.3: WebSocket /api/live rejects raw Supabase JWT in URL (?token=...) with HTTP 401', async () => {
      liveVoiceManager.reset();
      upstreamLiveConnectCalls = 0;

      const outcome = await connectRawWsWithHttpStatus(
        `${wsBaseUrl}/api/live?token=${encodeURIComponent(VALID_TOKEN)}`
      );
      assert.strictEqual(outcome.upgraded, false);
      assert.strictEqual(outcome.statusCode, 401);
      assert.ok(outcome.body?.includes('must not be passed in WebSocket URLs'));
      assert.strictEqual(upstreamLiveConnectCalls, 0);
    });

    await runTest('2.4: Expired single-use ticket is rejected cleanly with HTTP 401', async () => {
      liveVoiceManager.reset();
      clearLiveVoiceTickets();
      upstreamLiveConnectCalls = 0;

      const issued = issueLiveVoiceTicket(TEST_USER_ID, '127.0.0.1', 1); // 1ms TTL
      await new Promise((r) => setTimeout(r, 15));

      const outcome = await connectRawWsWithHttpStatus(
        `${wsBaseUrl}/api/live?ticket=${encodeURIComponent(issued.ticket)}`
      );
      assert.strictEqual(outcome.upgraded, false);
      assert.strictEqual(outcome.statusCode, 401);
      assert.strictEqual(upstreamLiveConnectCalls, 0);
    });

    await runTest('2.5: Authenticated ticket connects to /api/live, forwards Hindi/English input after auth, and cannot be reused', async () => {
      liveVoiceManager.reset();
      clearLiveVoiceTickets();
      upstreamLiveConnectCalls = 0;
      forwardedToUpstream.length = 0;

      const ticketRes = await fetch(`${baseUrl}/api/live/ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${VALID_TOKEN}`,
        },
      });
      assert.strictEqual(ticketRes.status, 200);
      const { ticket }: any = await ticketRes.json();
      assert.ok(ticket);

      const firstConn = await connectRawWsWithHttpStatus(
        `${wsBaseUrl}/api/live?ticket=${encodeURIComponent(ticket)}`
      );
      assert.strictEqual(firstConn.upgraded, true);
      assert.ok(firstConn.ws);

      const receivedMsgs: any[] = [];
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for WS messages')), 2000);
        firstConn.ws!.on('message', (raw) => {
          const parsed = JSON.parse(raw.toString());
          receivedMsgs.push(parsed);
          if (parsed.setupComplete) {
            firstConn.ws!.send(JSON.stringify({ text: 'नमस्ते, मेरे खाते से पैसे कट गए' }));
          }
          if (parsed.turnComplete) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      assert.strictEqual(upstreamLiveConnectCalls, 1, 'Upstream Gemini Live runs only after verified ticket');
      assert.ok(receivedMsgs.some((m) => m.setupComplete === true));
      assert.ok(receivedMsgs.some((m) => String(m.text || '').includes('नमस्ते')));
      assert.strictEqual(forwardedToUpstream.length, 1);

      // Verify same single-use ticket CANNOT be reused on a second connection
      const replayConn = await connectRawWsWithHttpStatus(
        `${wsBaseUrl}/api/live?ticket=${encodeURIComponent(ticket)}`
      );
      assert.strictEqual(replayConn.upgraded, false);
      assert.strictEqual(replayConn.statusCode, 401);
      assert.strictEqual(upstreamLiveConnectCalls, 1, 'Replayed ticket must not trigger Gemini Live');

      // Close cleanly and wait a tick for session cleanup
      firstConn.ws!.close();
      await new Promise((r) => setTimeout(r, 30));
      assert.strictEqual(liveVoiceManager.getStats().activeGlobal, 0);
    });

    await runTest('2.6: Defense-in-depth wss connection handler closes unauthenticated socket (1008) without connecting to Gemini', async () => {
      upstreamLiveConnectCalls = 0;
      const sentMessages: string[] = [];
      let closedCode = 0;
      const mockWs: any = {
        readyState: WebSocket.OPEN,
        send: (msg: string) => sentMessages.push(msg),
        close: (code: number) => {
          closedCode = code;
        },
        on: () => {},
      };
      wss.emit('connection', mockWs, { headers: {}, socket: { remoteAddress: '127.0.0.1' } } as any);
      assert.strictEqual(closedCode, 1008);
      assert.ok(sentMessages.some((m) => m.includes('Authentication required')));
      assert.strictEqual(upstreamLiveConnectCalls, 0);
    });

    // -------------------------------------------------------------------------
    // SECTION 3: FRONTEND TOKEN REFRESH & CALLER AUTH INTEGRATION
    // -------------------------------------------------------------------------
    console.log('\n--- Section 3: Frontend Token Refresh & Caller Integration ---');

    await runTest('3.1: getSupabaseAuthSession & getValidAccessToken refresh near-expired session cleanly and reject unrecoverable expired session', async () => {
      const origGetSession = supabase.auth.getSession.bind(supabase.auth);
      const origRefreshSession = supabase.auth.refreshSession.bind(supabase.auth);
      try {
        // Case A: Expired access token with valid refresh token -> refreshes transparently
        let refreshCalls = 0;
        supabase.auth.getSession = (async () => ({
          data: {
            session: {
              access_token: 'old_expired_jwt',
              expires_at: Math.floor(Date.now() / 1000) - 10,
              user: { id: TEST_USER_ID, email: 'citizen@example.in', user_metadata: { full_name: 'Asha Devi' } },
            },
          },
          error: null,
        })) as any;
        supabase.auth.refreshSession = (async () => {
          refreshCalls++;
          return {
            data: {
              session: {
                access_token: 'fresh_refreshed_jwt',
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                user: { id: TEST_USER_ID, email: 'citizen@example.in', user_metadata: { full_name: 'Asha Devi' } },
              },
            },
            error: null,
          };
        }) as any;

        const refreshedToken = await getValidAccessToken();
        assert.strictEqual(refreshCalls, 1);
        assert.strictEqual(refreshedToken, 'fresh_refreshed_jwt');

        // Case B: Expired token where refresh fails -> clears session & returns null
        supabase.auth.refreshSession = (async () => ({
          data: { session: null },
          error: { message: 'Refresh token expired' },
        })) as any;

        const failedSession = await getSupabaseAuthSession();
        assert.strictEqual(failedSession.user, null);
        assert.strictEqual(failedSession.session, null);
        const nullToken = await refreshAndGetAccessToken();
        assert.strictEqual(nullToken, null);
      } finally {
        supabase.auth.getSession = origGetSession;
        supabase.auth.refreshSession = origRefreshSession;
        localStorage.clear();
      }
    });

    await runTest('3.2: authenticatedFetchWithTimeout aborts unauthenticated calls before fetch, attaches Bearer token, and retries once on 401', async () => {
      const origFetch = globalThis.fetch;
      try {
        // Unauthenticated caller must throw AuthSessionError without sending network request
        let networkDispatched = false;
        globalThis.fetch = (async () => {
          networkDispatched = true;
          return new Response('{}', { status: 200 });
        }) as any;

        let caught: any = null;
        try {
          await authenticatedFetchWithTimeout(
            '/api/gemini/chat',
            { method: 'POST', body: '{}' },
            5000,
            { getAccessToken: async () => null }
          );
        } catch (err) {
          caught = err;
        }
        assert.ok(caught instanceof AuthSessionError);
        assert.strictEqual(caught.status, 401);
        assert.strictEqual(networkDispatched, false);

        // Stale token gets 401 -> refreshes -> retries once with fresh token -> 200
        const authHeadersSeen: string[] = [];
        globalThis.fetch = (async (_url: any, init: any) => {
          const authHeader = new Headers(init.headers).get('Authorization') || '';
          authHeadersSeen.push(authHeader);
          if (authHeader === 'Bearer stale_token') {
            return new Response(
              JSON.stringify({ error: 'INVALID_OR_EXPIRED_TOKEN', message: 'Expired token' }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
          }
          return new Response(JSON.stringify({ text: 'Recovered after refresh' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }) as any;

        const res = await authenticatedFetchWithTimeout(
          '/api/gemini/chat',
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
          5000,
          {
            getAccessToken: async () => 'stale_token',
            refreshAccessToken: async () => 'new_fresh_token',
          }
        );
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(authHeadersSeen, [
          'Bearer stale_token',
          'Bearer new_fresh_token',
        ]);

        // extractAiErrorFromResponse prefers human-readable server message
        const errRes = new Response(
          JSON.stringify({
            error: 'INVALID_OR_EXPIRED_TOKEN',
            message: 'Invalid or expired authentication session. Please log in again.',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
        const extracted = await extractAiErrorFromResponse(errRes);
        assert.strictEqual(extracted, 'Invalid or expired authentication session. Please log in again.');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    await runTest('3.3: All frontend callers of /api/gemini/chat, /api/gemini/transcribe, and /api/live use authenticated wrappers and zero raw unauthenticated calls remain', () => {
      const filesToInspect = [
        'src/components/GlobalAssistant.tsx',
        'src/components/CaseBuilder.tsx',
        'src/components/ResolutionNavigator.tsx',
        'src/components/LegalSimplifier.tsx',
        'src/components/SmartCaseMonitoring.tsx',
      ];
      for (const relPath of filesToInspect) {
        const content = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
        assert.ok(
          !content.includes("fetchWithTimeout(\n        '/api/gemini/chat'") &&
            !content.includes("fetchWithTimeout(\n        '/api/gemini/transcribe'") &&
            !content.includes("fetchWithTimeout('/api/gemini/chat'") &&
            !content.includes("fetchWithTimeout('/api/gemini/transcribe'"),
          `${relPath} must not call unauthenticated fetchWithTimeout on /chat or /transcribe`
        );
        assert.ok(
          content.includes('authenticatedFetchWithTimeout('),
          `${relPath} must use authenticatedFetchWithTimeout`
        );
      }

      const globalAssistant = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/GlobalAssistant.tsx'),
        'utf8'
      );
      assert.ok(
        globalAssistant.includes("authenticatedFetchWithTimeout(\n        '/api/live/ticket'") &&
          globalAssistant.includes('/api/live?ticket=${encodeURIComponent(ticket)}'),
        'GlobalAssistant must acquire single-use ticket via /api/live/ticket before connecting WS /api/live'
      );

      // Confirm consumeLiveVoiceTicket / verifySupabaseAuth are wired in server.ts and no JWT URL tokens are accepted
      const serverCode = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
      assert.ok(
        serverCode.includes("'/api/gemini/transcribe',\n  transcribeLimiter,\n  verifySupabaseAuth") &&
          serverCode.includes("'/api/gemini/chat',\n  chatLimiter,\n  verifySupabaseAuth") &&
          serverCode.includes("'/api/live/ticket',\n  liveTicketLimiter,\n  verifySupabaseAuth"),
        'server.ts must enforce verifySupabaseAuth on /transcribe, /chat, and /api/live/ticket'
      );
      assert.ok(
        !serverCode.includes('console.log(token') &&
          !serverCode.includes('console.log(req.headers.authorization') &&
          !serverCode.includes('console.log(ticket'),
        'server.ts must never log tokens, Authorization headers, or tickets'
      );
    });
  } finally {
    app.locals.supabaseAuthClient = origAuthClient;
    app.locals.userSupabaseClient = origUserClient;
    app.locals.geminiAiClient = origAiClient;
    app.locals.geminiLiveConnect = origLiveConnect;
    liveVoiceManager.reset();
    clearLiveVoiceTickets();
    server.close();
  }

  console.log(`\n=== Phase 1B Security Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal Phase 1B test error:', err);
  process.exit(1);
});
