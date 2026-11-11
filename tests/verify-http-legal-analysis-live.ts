import assert from 'assert';
import http from 'http';
import { app, server } from '../server';
import { supabase } from '../src/utils/supabaseClient';

async function testHttpEndpoint() {
  console.log('=== NivaranSetu HTTP Legal Analysis Endpoint Live Auth Verification ===\n');

  // Start HTTP server on dynamic port for testing
  const testServer = http.createServer(app);
  await new Promise<void>((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const port = (testServer.address() as any).port;
  console.log(`[Setup] In-process test server listening on http://127.0.0.1:${port}`);

  try {
    // 1. Missing Token Test
    console.log('\n[Check 1] Testing HTTP request with MISSING authorization header:');
    const resNoToken = await fetch(`http://127.0.0.1:${port}/api/gemini/legal-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftFacts: { description: 'test' } }),
    });
    assert.strictEqual(resNoToken.status, 401, 'Must return HTTP 401 when Authorization header is missing');
    const bodyNoToken = await resNoToken.json();
    assert.strictEqual(bodyNoToken.error, 'MISSING_AUTHORIZATION_HEADER');
    console.log('  ✓ Correctly rejected with HTTP 401 MISSING_AUTHORIZATION_HEADER');

    // 2. Invalid Token Test
    console.log('\n[Check 2] Testing HTTP request with INVALID Bearer token:');
    const resBadToken = await fetch(`http://127.0.0.1:${port}/api/gemini/legal-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid_garbage_token_12345',
      },
      body: JSON.stringify({ draftFacts: { description: 'test' } }),
    });
    assert.strictEqual(resBadToken.status, 401, 'Must return HTTP 401 when token is invalid');
    const bodyBadToken = await resBadToken.json();
    assert.strictEqual(bodyBadToken.error, 'INVALID_OR_EXPIRED_TOKEN');
    console.log('  ✓ Correctly rejected with HTTP 401 INVALID_OR_EXPIRED_TOKEN');

    // 3. Live Token Authenticated Request Test
    console.log('\n[Check 3] Testing HTTP request with GENUINE authenticated Supabase token:');
    const testEmail = process.env.SUPABASE_TEST_EMAIL;
    const testPassword = process.env.SUPABASE_TEST_PASSWORD;

    if (!testEmail || !testPassword) {
      console.log('  [NOTICE] No test credentials available to obtain live token. Skipping live request.');
      return;
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError || !signInData?.session?.access_token) {
      console.log(`  [NOTICE] Live sign-in failed: ${signInError?.message || 'No token'}`);
      return;
    }

    const liveToken = signInData.session.access_token;
    console.log('  ✓ Obtained live citizen token. Dispatching to POST /api/gemini/legal-analysis...');

    const resAuth = await fetch(`http://127.0.0.1:${port}/api/gemini/legal-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${liveToken}`,
      },
      body: JSON.stringify({
        draftFacts: {
          title: 'Unauthorized UPI debit of Rs 42500',
          description: 'Citizen received phishing call and Rs 42,500 was debited without authorization via UPI.',
          category: 'banking_financial',
          disputedAmount: 42500,
          incidentDate: '2026-10-15',
          involvedEntity: 'QuickPay Payments Bank',
          timeline: [
            {
              id: 't-1',
              date: '2026-10-15',
              title: 'Unauthorized debit occurred',
              description: 'UPI transaction SMS received for Rs 42500',
            },
          ],
          evidence: [],
        },
      }),
    });

    console.log(`  HTTP Response Status: ${resAuth.status}`);
    const resBody = await resAuth.json();

    assert.notStrictEqual(
      resAuth.status,
      503,
      `Should NOT return HTTP 503 AUTH_SERVICE_UNCONFIGURED! Error: ${JSON.stringify(resBody)}`
    );
    assert.strictEqual(resAuth.status, 200, `Expected HTTP 200, got ${resAuth.status}: ${JSON.stringify(resBody)}`);
    assert.strictEqual(resBody.success, true, 'Response must indicate success: true');
    assert(typeof resBody.synthesis === 'string', 'Response must contain synthesis string');
    assert(resBody.findings !== null, 'Response must contain findings object');

    console.log('  ✓ Authenticated request successfully passed verifySupabaseAuth!');
    console.log(`  ✓ Legal analysis completed! Model used: ${resBody.modelUsed}, isFallback: ${resBody.isFallback}`);
    console.log(`  ✓ Statutory jurisdiction: ${resBody.findings.temporalJurisdiction?.status || 'assessed'}`);
    console.log(`  ✓ Synthesis snippet: "${resBody.synthesis.substring(0, 100)}..."`);

    console.log('\n===================================================');
    console.log('HTTP Endpoint Live Auth Verification: 100% SUCCESS');
    console.log('===================================================');
  } finally {
    testServer.close();
  }
}

testHttpEndpoint().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
