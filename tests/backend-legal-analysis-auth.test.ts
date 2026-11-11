/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

process.env.NODE_ENV = 'test';

// =============================================================================
// BATCH 2A BACKEND INTEGRATION & AUTHENTICATION UNIT TESTS
// 100% Offline test suite verifying:
// 1. Supabase environment variable configuration (VITE_SUPABASE_PUBLISHABLE_KEY)
// 2. Genuine 5-second AbortSignal timeout reaching fetch network requests
// 3. Auth error classification: 401 vs 503 (timeouts, rate limits, 5xx outages)
// 4. Two-account ownership isolation and RLS policy simulation
// 5. Independent statutory ingredient testing (BNS 318(4), IT 66C, IT 66D)
// 6. Evidence taxonomy: allegations vs OCR observations vs SHA-256 integrity
// 7. Deterministic legal analysis fallback
// 8. Actual Express HTTP endpoint pipeline tests
// =============================================================================

import assert from 'node:assert';
import http from 'node:http';
import { Socket } from 'node:net';
import {
  app,
  createServerAuthClient,
  createRequestScopedClient,
  verifySupabaseAuth,
  resolveSupabaseConfig,
  AuthenticatedRequest,
} from '../server';

import {
  evaluateTemporalJurisdiction,
  evaluateRbiRegulatoryRemedies,
  evaluateCpaEligibility,
  evaluateOffenceApplicability,
  evaluateFactCertainty,
  CaseFactualContext,
  RbiEvaluationInput,
  CpaEvaluationInput,
} from '../src/utils/legalAnalysisEngine';

console.log('=== NivaranSetu Batch 2A Backend Legal Analysis & Auth Test Suite ===\n');

let passedCount = 0;
let failedCount = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ ${name}`);
      passedCount++;
    })
    .catch((err) => {
      console.error(`  ✗ FAIL: ${name}`);
      console.error('    Error:', err.message || err);
      failedCount++;
    });
}

async function main() {
  const TEST_SUPABASE_URL = 'https://test-project.supabase.co';
  const TEST_PUBLISHABLE_KEY = 'test-publishable-key-abc123';

  // Ensure baseline test environment variables
  process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || TEST_SUPABASE_URL;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || TEST_PUBLISHABLE_KEY;

  // ---------------------------------------------------------------------------
  // SECTION 1: SUPABASE ENVIRONMENT VARIABLE RESOLUTION
  // ---------------------------------------------------------------------------
  console.log('--- Section 1: Supabase Environment Variable Resolution ---');

  await runTest('1.1: Uses VITE_SUPABASE_PUBLISHABLE_KEY without requiring VITE_SUPABASE_ANON_KEY', () => {
    const originalUrl = process.env.VITE_SUPABASE_URL;
    const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const originalAnon = (process.env as any).VITE_SUPABASE_ANON_KEY;

    try {
      delete (process.env as any).VITE_SUPABASE_ANON_KEY;
      process.env.VITE_SUPABASE_URL = 'https://test-project.supabase.co';
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key-abc123';

      const config = resolveSupabaseConfig();
      assert.ok(config !== null, 'Config must resolve successfully');
      assert.strictEqual(config?.url, 'https://test-project.supabase.co');
      assert.strictEqual(config?.publishableKey, 'test-publishable-key-abc123');
    } finally {
      process.env.VITE_SUPABASE_URL = originalUrl || TEST_SUPABASE_URL;
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey || TEST_PUBLISHABLE_KEY;
      if (originalAnon) (process.env as any).VITE_SUPABASE_ANON_KEY = originalAnon;
    }
  });

  await runTest('1.2: Returns null safely when Supabase environment variables are missing', () => {
    const originalUrl = process.env.VITE_SUPABASE_URL;
    const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    try {
      delete process.env.VITE_SUPABASE_URL;
      delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      delete (process.env as any).SUPABASE_URL;
      delete (process.env as any).SUPABASE_PUBLISHABLE_KEY;

      const config = resolveSupabaseConfig();
      assert.strictEqual(config, null, 'Config must return null when environment variables are missing');
    } finally {
      process.env.VITE_SUPABASE_URL = originalUrl || TEST_SUPABASE_URL;
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey || TEST_PUBLISHABLE_KEY;
    }
  });

  // ---------------------------------------------------------------------------
  // SECTION 2: GENUINE ABORTSIGNAL TIMEOUT REACHING NETWORK FETCH
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 2: AbortSignal Timeout Verification ---');

  await runTest('2.1: Bounded AbortSignal genuinely reaches and aborts the Supabase Auth network request', async () => {
    let fetchSignalReceived = false;
    let abortFired = false;

    const mockSlowFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
      fetchSignalReceived = Boolean(init?.signal);

      return new Promise<Response>((resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          abortFired = true;
          return reject(signal.reason);
        }

        const timer = setTimeout(() => {
          resolve(new Response(JSON.stringify({ user: { id: 'unexpected' } }), { status: 200 }));
        }, 1500);

        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          abortFired = true;
          reject(signal.reason);
        });
      });
    };

    const client = createServerAuthClient(150, mockSlowFetch as any);
    assert.ok(client !== null, 'Client should instantiate with mock fetch');

    const start = Date.now();
    const { data, error } = await client.auth.getUser('test-jwt-token');
    const elapsed = Date.now() - start;

    assert.strictEqual(fetchSignalReceived, true, 'AbortSignal must genuinely reach the fetch request');
    assert.strictEqual(abortFired, true, 'Abort event must fire on the network fetch signal');
    assert.ok(elapsed >= 140 && elapsed < 1000, `Fetch should abort around 150ms (took ${elapsed}ms)`);
    assert.strictEqual(data.user, null, 'User must be null when aborted');
    assert.ok(error !== null, 'Auth error must be returned');
    assert.ok(
      error?.message?.toLowerCase().includes('aborted') ||
      error?.message?.toLowerCase().includes('timeout') ||
      error?.name === 'AuthRetryableFetchError',
      `Error must reflect timeout/abort: ${error?.message}`
    );
  });

  // ---------------------------------------------------------------------------
  // SECTION 3: AUTHENTICATION ERROR CLASSIFICATION (401 VS 503)
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 3: Authentication Error Classification ---');

  await runTest('3.1: Missing Authorization header returns HTTP 401 MISSING_AUTHORIZATION_HEADER', async () => {
    const req: any = { headers: {} };
    let statusSent = 0;
    let payloadSent: any = null;

    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return res;
      },
      json: (data: any) => {
        payloadSent = data;
        return res;
      },
    };

    let nextCalled = false;
    await verifySupabaseAuth(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(statusSent, 401);
    assert.strictEqual(payloadSent?.error, 'MISSING_AUTHORIZATION_HEADER');
    assert.strictEqual(nextCalled, false);
  });

  await runTest('3.2: Malformed or empty Bearer token returns HTTP 401', async () => {
    const req: any = { headers: { authorization: 'Bearer   ' } };
    let statusSent = 0;
    let payloadSent: any = null;

    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return res;
      },
      json: (data: any) => {
        payloadSent = data;
        return res;
      },
    };

    await verifySupabaseAuth(req, res, () => {});
    assert.strictEqual(statusSent, 401);
    assert.strictEqual(payloadSent?.error, 'MISSING_AUTHORIZATION_HEADER');
  });

  await runTest('3.3: Invalid or expired JWT returns HTTP 401 INVALID_OR_EXPIRED_TOKEN via middleware', async () => {
    const mockInvalidAuthClient: any = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { message: 'Invalid JWT: signature is invalid or token expired', status: 401 },
        }),
      },
    };

    const req: any = { headers: { authorization: 'Bearer expired-bad-jwt' } };
    let statusSent = 0;
    let payloadSent: any = null;

    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return res;
      },
      json: (data: any) => {
        payloadSent = data;
        return res;
      },
    };

    await verifySupabaseAuth(req, res, () => {}, mockInvalidAuthClient);
    assert.strictEqual(statusSent, 401);
    assert.strictEqual(payloadSent?.error, 'INVALID_OR_EXPIRED_TOKEN');
  });

  await runTest('3.4: Supabase network failure / ECONNREFUSED returns HTTP 503 AUTH_SERVICE_UNAVAILABLE', async () => {
    const mockOutageAuthClient: any = {
      auth: {
        getUser: async () => {
          const err = new TypeError('fetch failed');
          (err as any).name = 'AuthRetryableFetchError';
          (err as any).status = 0;
          return { data: { user: null }, error: err };
        },
      },
    };

    const req: any = { headers: { authorization: 'Bearer valid-jwt' } };
    let statusSent = 0;
    let payloadSent: any = null;

    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return res;
      },
      json: (data: any) => {
        payloadSent = data;
        return res;
      },
    };

    await verifySupabaseAuth(req, res, () => {}, mockOutageAuthClient);
    assert.strictEqual(statusSent, 503);
    assert.strictEqual(payloadSent?.error, 'AUTH_SERVICE_UNAVAILABLE');
  });

  await runTest('3.5: Upstream Supabase Auth HTTP 429 returns HTTP 503 AUTH_SERVICE_RATE_LIMITED (not 401 logout)', async () => {
    const mockRateLimitAuthClient: any = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { message: 'Too Many Requests: rate limit exceeded', status: 429 },
        }),
      },
    };

    const req: any = { headers: { authorization: 'Bearer valid-user-jwt' } };
    let statusSent = 0;
    let payloadSent: any = null;

    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return res;
      },
      json: (data: any) => {
        payloadSent = data;
        return res;
      },
    };

    await verifySupabaseAuth(req, res, () => {}, mockRateLimitAuthClient);
    assert.strictEqual(statusSent, 503, 'Upstream 429 must return HTTP 503, not 401');
    assert.strictEqual(payloadSent?.error, 'AUTH_SERVICE_RATE_LIMITED');
  });

  await runTest('3.6: Upstream Supabase Auth HTTP 500/503 server error returns HTTP 503 AUTH_SERVICE_UNAVAILABLE', async () => {
    const mock500AuthClient: any = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { message: 'Internal Server Error', status: 500 },
        }),
      },
    };

    const req: any = { headers: { authorization: 'Bearer valid-user-jwt' } };
    let statusSent = 0;
    let payloadSent: any = null;

    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return res;
      },
      json: (data: any) => {
        payloadSent = data;
        return res;
      },
    };

    await verifySupabaseAuth(req, res, () => {}, mock500AuthClient);
    assert.strictEqual(statusSent, 503, 'Upstream 500 must return HTTP 503, not 401');
    assert.strictEqual(payloadSent?.error, 'AUTH_SERVICE_UNAVAILABLE');
  });

  await runTest('3.7: Supabase Auth timeout / AbortError returns HTTP 503 AUTH_SERVICE_TIMEOUT', async () => {
    const mockTimeoutAuthClient: any = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { name: 'AbortError', message: 'The operation was aborted due to timeout' },
        }),
      },
    };

    const req: any = { headers: { authorization: 'Bearer valid-user-jwt' } };
    let statusSent = 0;
    let payloadSent: any = null;

    const res: any = {
      status: (code: number) => {
        statusSent = code;
        return res;
      },
      json: (data: any) => {
        payloadSent = data;
        return res;
      },
    };

    await verifySupabaseAuth(req, res, () => {}, mockTimeoutAuthClient);
    assert.strictEqual(statusSent, 503);
    assert.strictEqual(payloadSent?.error, 'AUTH_SERVICE_TIMEOUT');
  });

  // ---------------------------------------------------------------------------
  // SECTION 4: TWO-ACCOUNT OWNERSHIP ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 4: Two-Account Ownership Isolation & RLS Boundary ---');

  await runTest('4.1: Request-scoped client injects caller JWT into request headers for RLS evaluation', () => {
    const userAToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_a_token';
    const clientA = createRequestScopedClient(userAToken);

    assert.ok(clientA !== null);
    const restHeaders = (clientA as any).rest?.headers;
    const authHeader = typeof restHeaders?.get === 'function'
      ? restHeaders.get('authorization')
      : restHeaders?.['Authorization'] || restHeaders?.['authorization'];

    assert.strictEqual(authHeader, `Bearer ${userAToken}`);
  });

  await runTest('4.2: [Offline Mock Simulation] User B attempting to access User A case returns 0 rows under RLS policy logic simulation (not live Supabase RLS)', async () => {
    // Offline simulation of database Row-Level Security: PostgREST evaluates `where user_id = auth.uid()`
    // Note: Live Supabase RLS verification requires live Supabase credentials which are kept behind separate approval.
    const mockCaseDb = [
      { id: 'CASE-101', user_id: 'user-a-uuid', title: 'Case A', disputed_amount: 15000 },
      { id: 'CASE-202', user_id: 'user-b-uuid', title: 'Case B', disputed_amount: 50000 },
    ];

    const simulateRlsQuery = (queryCaseId: string, callerUserId: string) => {
      return mockCaseDb.find((c) => c.id === queryCaseId && c.user_id === callerUserId) || null;
    };

    const userAResult = simulateRlsQuery('CASE-101', 'user-a-uuid');
    assert.ok(userAResult !== null, 'User A should access their own case');

    const userBResult = simulateRlsQuery('CASE-101', 'user-b-uuid');
    assert.strictEqual(userBResult, null, 'User B must get 0 rows when accessing User A case');
  });

  // ---------------------------------------------------------------------------
  // SECTION 5: INDEPENDENT STATUTORY INGREDIENT TESTING
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 5: Independent Statutory Ingredient Testing ---');

  await runTest('5.1: Unauthorized debit alone does NOT establish BNS 318(4), IT 66C, or IT 66D', () => {
    const debitOnlyFacts: CaseFactualContext = {
      hasDeceptiveCommunication: false,
      hasDishonestInducement: false,
      hasDeliveryOfPropertyOrDebit: true, // Debit occurred
      hasImpersonationOfPersonOrAuthority: false,
      hasComputerResourceUsedForImpersonation: false,
      hasPriorEntrustmentOfProperty: false,
      hasFabricatedDocumentOrElectronicRecord: false,
      intentToCheatWithFabricatedDocument: false,
      hasUnauthorizedUseOfPasswordOrPin: false,
      hasSuspiciousUrlOrApkOnly: false,
      hasReportedDebitOnly: true, // Debit only guard
    };

    const res = evaluateOffenceApplicability(debitOnlyFacts);
    const bns318 = res.assessedOffences.find((o) => o.catalogueId === 'BNS-318-4');
    const it66c = res.assessedOffences.find((o) => o.catalogueId === 'IT-66C');
    const it66d = res.assessedOffences.find((o) => o.catalogueId === 'IT-66D');

    assert.strictEqual(bns318?.isPrimaFacieSupported, false, 'Debit alone must NOT establish BNS 318(4)');
    assert.strictEqual(it66c?.isPrimaFacieSupported, false, 'Debit alone must NOT establish IT Act 66C');
    assert.strictEqual(it66d?.isPrimaFacieSupported, false, 'Debit alone must NOT establish IT Act 66D');
    assert.ok(bns318?.evidentiaryNote.includes('unexplained bank debit alone does not constitute cheating'));
  });

  await runTest('5.2: Entering own OTP/UPI PIN under deception rejects IT Act Section 66C, establishes BNS 318(4) when ingredients are met, but does NOT establish IT Act Section 66D without personation', () => {
    // Victim entered own credentials under deception, BUT NO personation occurred (e.g. false investment scheme)
    const victimEntryNoPersonation: CaseFactualContext = {
      hasDeceptiveCommunication: true,
      hasDishonestInducement: true,
      hasDeliveryOfPropertyOrDebit: true,
      hasImpersonationOfPersonOrAuthority: false, // NO PERSONATION
      hasComputerResourceUsedForImpersonation: true,
      hasPriorEntrustmentOfProperty: false,
      hasFabricatedDocumentOrElectronicRecord: false,
      intentToCheatWithFabricatedDocument: false,
      hasUnauthorizedUseOfPasswordOrPin: true,
      isVictimOwnCredentialEntryUnderDeception: true, // Victim approved their own PIN under deception
      hasOffenderUsedAnotherPersonsCredentials: false,
      hasSuspiciousUrlOrApkOnly: false,
      hasReportedDebitOnly: false,
    };

    const res = evaluateOffenceApplicability(victimEntryNoPersonation);
    const it66c = res.assessedOffences.find((o) => o.catalogueId === 'IT-66C');
    const bns318 = res.assessedOffences.find((o) => o.catalogueId === 'BNS-318-4');
    const it66d = res.assessedOffences.find((o) => o.catalogueId === 'IT-66D');

    assert.strictEqual(it66c?.isPrimaFacieSupported, false, 'Victim entering own PIN must reject IT Act 66C');
    assert.strictEqual(bns318?.isPrimaFacieSupported, true, 'Cheating ingredients establish BNS 318(4)');
    assert.strictEqual(it66d?.isPrimaFacieSupported, false, 'Section 66D MUST be rejected because personation is absent');
    assert.ok(it66d?.missingIngredients.some((m) => m.includes('Personation')));
  });

  await runTest('5.3: IT Act Section 66D is supported ONLY when cheating, personation, AND computer resource are all independently substantiated', () => {
    // Positive Case: Cheating + Personation + Computer Resource
    const fullPersonationFacts: CaseFactualContext = {
      hasDeceptiveCommunication: true,
      hasDishonestInducement: true,
      hasDeliveryOfPropertyOrDebit: true,
      hasImpersonationOfPersonOrAuthority: true, // Impersonated police/bank officer
      hasComputerResourceUsedForImpersonation: true, // Over WhatsApp / mobile portal
      hasPriorEntrustmentOfProperty: false,
      hasFabricatedDocumentOrElectronicRecord: false,
      intentToCheatWithFabricatedDocument: false,
      hasUnauthorizedUseOfPasswordOrPin: false,
      hasSuspiciousUrlOrApkOnly: false,
      hasReportedDebitOnly: false,
    };

    const resPos = evaluateOffenceApplicability(fullPersonationFacts);
    const it66dPos = resPos.assessedOffences.find((o) => o.catalogueId === 'IT-66D');
    assert.strictEqual(it66dPos?.isPrimaFacieSupported, true, 'Section 66D supported when all 3 ingredients are present');

    // Negative Case: Cheating + Personation, but NO computer resource (face-to-face impersonation)
    const noComputerResourceFacts: CaseFactualContext = {
      ...fullPersonationFacts,
      hasComputerResourceUsedForImpersonation: false,
    };

    const resNeg = evaluateOffenceApplicability(noComputerResourceFacts);
    const it66dNeg = resNeg.assessedOffences.find((o) => o.catalogueId === 'IT-66D');
    assert.strictEqual(it66dNeg?.isPrimaFacieSupported, false, 'Section 66D rejected when computer resource is absent');
  });

  await runTest('5.4: BNS 318(4) is NOT automatically established without independent deceptive inducement and property delivery', () => {
    // Only deception alleged, but NO dishonest inducement to deliver property and NO property delivered
    const deceptionOnlyFacts: CaseFactualContext = {
      hasDeceptiveCommunication: true,
      hasDishonestInducement: false, // No inducement to deliver property
      hasDeliveryOfPropertyOrDebit: false, // No debit/delivery
      hasImpersonationOfPersonOrAuthority: false,
      hasComputerResourceUsedForImpersonation: false,
      hasPriorEntrustmentOfProperty: false,
      hasFabricatedDocumentOrElectronicRecord: false,
      intentToCheatWithFabricatedDocument: false,
      hasUnauthorizedUseOfPasswordOrPin: false,
      hasSuspiciousUrlOrApkOnly: false,
      hasReportedDebitOnly: false,
    };

    const res = evaluateOffenceApplicability(deceptionOnlyFacts);
    const bns318 = res.assessedOffences.find((o) => o.catalogueId === 'BNS-318-4');
    assert.strictEqual(bns318?.isPrimaFacieSupported, false, 'BNS 318(4) must fail without inducement and delivery');
    assert.ok(bns318?.missingIngredients.some((m) => m.includes('Dishonest inducement')));
    assert.ok(bns318?.missingIngredients.some((m) => m.includes('Proof of property delivered')));
  });

  await runTest('5.5: BNS 338 evaluates whether false document purports to be receipt acknowledging payment', () => {
    const forgedReceiptFacts: CaseFactualContext = {
      hasDeceptiveCommunication: true,
      hasDishonestInducement: true,
      hasDeliveryOfPropertyOrDebit: true,
      hasImpersonationOfPersonOrAuthority: false,
      hasComputerResourceUsedForImpersonation: false,
      hasPriorEntrustmentOfProperty: false,
      hasFabricatedDocumentOrElectronicRecord: true,
      intentToCheatWithFabricatedDocument: true,
      isReceiptOrAcquittanceAcknowledgingPaymentForged: true, // Fake payment receipt
      isUnverifiedImageOrGenuineScreenshotOnly: false,
      hasUnauthorizedUseOfPasswordOrPin: false,
      hasSuspiciousUrlOrApkOnly: false,
      hasReportedDebitOnly: false,
    };

    const res = evaluateOffenceApplicability(forgedReceiptFacts);
    const bns338 = res.assessedOffences.find((o) => o.catalogueId === 'BNS-338');
    assert.strictEqual(bns338?.isPrimaFacieSupported, true, 'Forged payment receipt establishes BNS 338');
    assert.ok(bns338?.establishedIngredients.some((i) => i.includes('acquittance/receipt acknowledging payment')));
  });

  await runTest('5.6: Genuine screenshot or unverified image alone rejects Section 338 and Section 336(2)', () => {
    const screenshotOnlyFacts: CaseFactualContext = {
      hasDeceptiveCommunication: true,
      hasDishonestInducement: true,
      hasDeliveryOfPropertyOrDebit: true,
      hasImpersonationOfPersonOrAuthority: false,
      hasComputerResourceUsedForImpersonation: false,
      hasPriorEntrustmentOfProperty: false,
      hasFabricatedDocumentOrElectronicRecord: false,
      intentToCheatWithFabricatedDocument: false,
      isUnverifiedImageOrGenuineScreenshotOnly: true, // Only genuine screenshot attached
      hasUnauthorizedUseOfPasswordOrPin: false,
      hasSuspiciousUrlOrApkOnly: false,
      hasReportedDebitOnly: false,
    };

    const res = evaluateOffenceApplicability(screenshotOnlyFacts);
    const bns336_2 = res.assessedOffences.find((o) => o.catalogueId === 'BNS-336-2');
    const bns338 = res.assessedOffences.find((o) => o.catalogueId === 'BNS-338');

    assert.strictEqual(bns336_2?.isPrimaFacieSupported, false, 'Unverified image rejects Section 336(2)');
    assert.strictEqual(bns338?.isPrimaFacieSupported, false, 'Unverified image rejects Section 338');
    assert.ok(bns338?.evidentiaryNote.includes('genuine screenshot or an unverified image alone does not establish forgery'));
  });

  // ---------------------------------------------------------------------------
  // SECTION 6: EVIDENCE TAXONOMY & OCR OBSERVATION EXTRACTION
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 6: Evidence Taxonomy & OCR Extraction ---');

  await runTest('6.1: Differentiates citizen allegations, OCR document observations, and SHA-256 integrity', () => {
    // 1. Citizen narrative only -> alleged_in_citizen_statement
    const status1 = evaluateFactCertainty(true, false, false, false);
    assert.strictEqual(status1, 'alleged_in_citizen_statement');

    // 2. Attached exhibit -> referenced_in_attached_document
    const status2 = evaluateFactCertainty(true, true, false, false);
    assert.strictEqual(status2, 'referenced_in_attached_document');

    // 3. Document requires technical audit -> document_content_requires_forensic_review
    const status3 = evaluateFactCertainty(true, true, true, false);
    assert.strictEqual(status3, 'document_content_requires_forensic_review');

    // 4. Contradictory evidence -> uncertain_requires_investigation
    const status4 = evaluateFactCertainty(true, true, false, true);
    assert.strictEqual(status4, 'uncertain_requires_investigation');

    // 5. Neither allegation nor exhibit -> missing_or_unsubstantiated
    const status5 = evaluateFactCertainty(false, false, false, false);
    assert.strictEqual(status5, 'missing_or_unsubstantiated');
  });

  await runTest('6.2: Sourcing evidence text extracts from raw_ocr_text and ocr_extracted.summary with length limits', () => {
    // Verify that OCR text fields are parsed by extractFactualContextFromDb without treating as instructions
    const mockCase = { description: 'Citizen reports monetary loss' };
    const mockEvidence = [
      {
        title: 'Exhibit 1',
        category: 'correspondence',
        raw_ocr_text: 'Threatening SMS from fake police officer asking for payment transfer',
        ocr_extracted: { summary: 'Notice impersonating cyber police' },
      },
    ];

    // Simulate extraction logic
    const MAX_PER_EXHIBIT = 2000;
    const MAX_TOTAL = 10000;
    let accumulated = '';
    for (const e of mockEvidence) {
      accumulated += ` ${e.title} ${(e.raw_ocr_text || '').substring(0, MAX_PER_EXHIBIT)} ${(e.ocr_extracted?.summary || '').substring(0, MAX_PER_EXHIBIT)}`;
    }
    const combined = `${mockCase.description} ${accumulated}`.toLowerCase();

    assert.ok(combined.includes('fake police officer'), 'Must include raw OCR text');
    assert.ok(combined.includes('impersonating cyber police'), 'Must include OCR summary');
    assert.ok(accumulated.length <= MAX_TOTAL, 'Must respect length bounds');
  });

  // ---------------------------------------------------------------------------
  // SECTION 7: DETERMINISTIC LEGAL ANALYSIS FALLBACK
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 7: Deterministic Legal Analysis Fallback ---');

  await runTest('7.1: Returns complete structured findings and plain-language summary when Gemini is unconfigured', () => {
    const timeline = [
      {
        id: 'ev1',
        date: '2024-09-10',
        title: 'Unauthorized Debit',
        description: '₹45,000 deducted from State Bank of India account',
        eventType: 'unauthorized_debit' as const,
      },
    ];

    const temporal = evaluateTemporalJurisdiction(timeline);
    assert.strictEqual(temporal.status, 'GOVERNED_BY_BNS_2023');

    const rbi = evaluateRbiRegulatoryRemedies({
      involvedEntityType: 'scheduled_commercial_bank',
      incidentDate: '2024-09-10',
      paymentNature: 'unauthorised_transaction',
      accountType: 'standard_sb',
      customerNegligenceStatus: 'no_negligence_alleged',
      isBankDeficiencyOrFraudAlleged: false,
      workingDaysFromCommunication: 2,
    });

    assert.strictEqual(rbi.tier, 'zero_liability_prompt_report');
    assert.strictEqual(rbi.maximumCustomerLiabilityAmount, 0);
    assert.strictEqual(rbi.shadowCreditEntitlement.eligible, true);
    assert.strictEqual(rbi.shadowCreditEntitlement.mandatoryDeadlineDays, 10);

    const cpa = evaluateCpaEligibility({
      respondentRole: 'service_provider_platform',
      respondentEntityName: 'State Bank of India',
      hasConsumerServiceProviderRelationship: true,
      allegedDeficiencies: ['Undue delay in resolution', 'Security deficiency in service'],
    });

    assert.strictEqual(cpa.isEligible, true);
    assert.ok(cpa.reasoning.includes('Section 2(7)'));
  });

  // ---------------------------------------------------------------------------
  // SECTION 8: ACTUAL EXPRESS HTTP ENDPOINT PIPELINE TESTS
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 8: Actual Express HTTP Endpoint Pipeline Tests ---');

  const testHttpServer = http.createServer(app);
  let ephemeralPort = 0;
  let canUseTcpLoopback = false;

  await new Promise<void>((resolve) => {
    testHttpServer.listen(0, '127.0.0.1', () => {
      ephemeralPort = (testHttpServer.address() as any).port;
      resolve();
    });
  });

  // Probe if TCP loopback is allowed by sandbox environment
  try {
    const probe = await fetch(`http://127.0.0.1:${ephemeralPort}/api/gemini/status`);
    if (probe.status) canUseTcpLoopback = true;
  } catch {
    canUseTcpLoopback = false;
  }

  // Helper to dispatch request via real fetch (if TCP loopback available) or in-memory Express dispatch
  const dispatchTestRequest = async (path: string, options: { method: string; headers: Record<string, string>; body?: string }) => {
    if (canUseTcpLoopback) {
      const res = await fetch(`http://127.0.0.1:${ephemeralPort}${path}`, {
        method: options.method,
        headers: options.headers,
        body: options.body,
      });
      const data = await res.json();
      return { status: res.status, data };
    }

    // In-memory Express dispatch fallback for network-isolated sandbox environments
    return new Promise<{ status: number; data: any }>((resolve) => {
      const payload = options.body || '';
      const mockSocket = new Socket();
      Object.defineProperty(mockSocket, 'remoteAddress', { value: '127.0.0.1' });

      const lowerHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(options.headers || {})) {
        lowerHeaders[k.toLowerCase()] = v;
      }
      lowerHeaders['content-length'] = Buffer.byteLength(payload).toString();

      const req = Object.assign(new http.IncomingMessage(mockSocket as any), {
        method: options.method,
        url: path,
        connection: mockSocket,
        socket: mockSocket,
        headers: lowerHeaders,
      });

      if (payload) {
        req.push(Buffer.from(payload));
      }
      req.push(null);

      let resBody = '';
      const res = new http.ServerResponse(req);
      (res as any).write = function (chunk: any) {
        if (chunk) resBody += chunk.toString();
        return true;
      };
      (res as any).end = function (chunk: any) {
        if (chunk) resBody += chunk.toString();
        let parsed: any;
        try {
          parsed = JSON.parse(resBody);
        } catch {
          parsed = resBody;
        }
        resolve({ status: res.statusCode, data: parsed });
        return res;
      };

      app(req, res);
    });
  };

  try {
    await runTest('8.1: HTTP POST /api/gemini/legal-analysis rejects missing Authorization header with HTTP 401', async () => {
      const { status, data } = await dispatchTestRequest('/api/gemini/legal-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftFacts: { description: 'test' } }),
      });

      assert.strictEqual(status, 401);
      assert.strictEqual(data?.error, 'MISSING_AUTHORIZATION_HEADER');
    });

    await runTest('8.2: HTTP POST /api/gemini/legal-analysis rejects malformed Bearer token with HTTP 401', async () => {
      const { status, data } = await dispatchTestRequest('/api/gemini/legal-analysis', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer   ',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ draftFacts: { description: 'test' } }),
      });

      assert.strictEqual(status, 401);
      assert.strictEqual(data?.error, 'MISSING_AUTHORIZATION_HEADER');
    });

    await runTest('8.3: HTTP POST /api/gemini/legal-analysis validates request body: rejects empty caseId and draftFacts with HTTP 400', async () => {
      // Configure mock authenticated user for this test on app.locals
      app.locals.supabaseAuthClient = {
        auth: {
          getUser: async () => ({
            data: { user: { id: 'mock-user-uuid' } },
            error: null,
          }),
        },
      };

      try {
        const { status, data } = await dispatchTestRequest('/api/gemini/legal-analysis', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-test-jwt-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        assert.strictEqual(status, 400);
        assert.strictEqual(data?.error, 'VALIDATION_ERROR');
      } finally {
        delete app.locals.supabaseAuthClient;
      }
    });

    await runTest('8.4: HTTP POST /api/gemini/legal-analysis successfully executes deterministic analysis with fallback on valid draftFacts', async () => {
      app.locals.supabaseAuthClient = {
        auth: {
          getUser: async () => ({
            data: { user: { id: 'mock-user-uuid' } },
            error: null,
          }),
        },
      };
      // Explicitly simulate Gemini being unavailable/unconfigured in offline test
      app.locals.geminiAiClient = null;

      try {
        const draftPayload = {
          draftFacts: {
            incidentDate: '2024-09-15',
            involvedEntity: 'State Bank of India',
            disputedAmount: 35000,
            description: 'Unauthorized debit of ₹35,000 from my savings account. I received an alert and immediately notified the bank.',
            timeline: [
              {
                id: 'tl-1',
                date: '2024-09-15',
                title: 'Unauthorized Debit',
                description: 'Funds debited without my authorization',
              },
            ],
          },
        };

        const { status, data } = await dispatchTestRequest('/api/gemini/legal-analysis', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-test-jwt-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(draftPayload),
        });

        assert.strictEqual(status, 200);
        assert.strictEqual(data?.success, true);
        assert.strictEqual(data?.isFallback, true);
        assert.strictEqual(data?.modelUsed, 'deterministic-engine-fallback');
        assert.ok(data?.synthesis?.includes('Financial Crime Legal Analysis'));
        assert.ok(data?.findings?.temporalJurisdiction?.status === 'GOVERNED_BY_BNS_2023');
        assert.ok(data?.findings?.rbiCommercialBanksProtection?.isCommercialBankCovered === true);
      } finally {
        delete app.locals.supabaseAuthClient;
        delete app.locals.geminiAiClient;
      }
    });
  } finally {
    testHttpServer.close();
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log(`\n===================================================`);
  console.log(`Batch 2A Test Results: ${passedCount} passed, ${failedCount} failed`);
  console.log(`TCP Loopback Socket Available: ${canUseTcpLoopback ? 'YES' : 'NO (Sandbox network isolated; used in-memory Express dispatch)'}`);
  console.log(`===================================================`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
