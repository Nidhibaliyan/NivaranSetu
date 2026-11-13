/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { Socket } from 'node:net';
import {
  app,
  classifyEvidenceForLegalAnalysis,
  extractFactualContextFromDb,
  extractFactualContextFromDraft,
} from '../server';
import { evaluateOffenceApplicability } from '../src/utils/legalAnalysisEngine';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`  \x1b[31m✗\x1b[0m ${name}`);
    console.error(`    ${err?.stack || err?.message || String(err)}`);
  }
}

const VALID_SHA256 = 'a'.repeat(64);
const VALID_STORAGE_REF = '00000000-0000-0000-0000-000000000001/case-1/ev-1/exhibit.pdf';

interface MockDbOptions {
  caseRow: Record<string, any> | null;
  evidenceRows: any[];
  timelineRows?: any[];
  respectDeletedFilter?: boolean;
}

function createMockSupabaseAndRecorder(options: MockDbOptions) {
  const capturedQueries: Array<{ table: string; filters: Array<{ op: string; col: string; val: any }> }> = [];

  const client = {
    from(table: string) {
      const filters: Array<{ op: string; col: string; val: any }> = [];
      const queryRecord = { table, filters };
      capturedQueries.push(queryRecord);

      const builder: any = {
        select() {
          return builder;
        },
        eq(col: string, val: any) {
          filters.push({ op: 'eq', col, val });
          return builder;
        },
        is(col: string, val: any) {
          filters.push({ op: 'is', col, val });
          return builder;
        },
        order() {
          return Promise.resolve({
            data: table === 'timeline_events' ? options.timelineRows || [] : [],
            error: null,
          });
        },
        maybeSingle() {
          if (table === 'grievance_cases') {
            return Promise.resolve({ data: options.caseRow, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve: any, reject: any) {
          let resultData: any[] = [];
          if (table === 'evidence_items') {
            resultData = options.evidenceRows;
            if (options.respectDeletedFilter !== false) {
              const hasDeletedNullFilter = filters.some((f) => f.op === 'is' && f.col === 'deleted_at' && f.val === null);
              if (hasDeletedNullFilter) {
                resultData = resultData.filter((r) => r?.deleted_at == null);
              }
            }
          } else if (table === 'timeline_events') {
            resultData = options.timelineRows || [];
          }
          return Promise.resolve({ data: resultData, error: null }).then(resolve, reject);
        },
      };

      return builder;
    },
  };

  return { client, capturedQueries };
}

function createMockAuthClient(userId = '00000000-0000-0000-0000-000000000001') {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: userId } },
        error: null,
      }),
    },
  };
}

function dispatchInMemory(
  path: string,
  options: { method: string; headers: Record<string, string>; body?: string }
): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
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
}

async function main() {
  console.log('\n===================================================');
  console.log('Legal Analysis Fail-Closed Evidence Gating Tests');
  console.log('===================================================');

  await runTest('1. Excludes stored raw_ocr_text and ocr_extracted even when status="processed", has_blob=true, storage_ref, and sha256_hash are valid', async () => {
    const caseRow = {
      id: 'case-processed-ocr',
      is_sample_data: false,
      involved_entity: 'Apex Bank of India',
      disputed_amount: 10000,
      incident_date: '2025-02-10',
      description: 'Unexplained debit of ₹10,000 from my savings account.',
    };

    const poisonedProcessedExhibit = {
      id: 'ev-proc-1',
      title: 'Statement Exhibit',
      category: 'correspondence',
      file_name: 'bank_alert.pdf',
      has_blob: true,
      storage_ref: VALID_STORAGE_REF,
      sha256_hash: VALID_SHA256,
      deleted_at: null,
      raw_ocr_text:
        'Threatening SMS from fake police officer pretending to be bank manager asking to transfer via WhatsApp with fake receipt and stolen credentials OTP entered under deception',
      ocr_extracted: {
        status: 'processed',
        summary: 'Deceptive impersonation script from fake executive requesting payment transfer',
        dates: ['2025-02-10'],
        amounts: ['₹10,000'],
        identifiers: ['REF-999999'],
        parties: ['Fake Bank Manager'],
      },
    };

    const eligibility = classifyEvidenceForLegalAnalysis(poisonedProcessedExhibit, caseRow);
    assert.strictEqual(eligibility.includeOcrInLegalAnalysis, false);
    assert.strictEqual(eligibility.isDeleted, false);
    assert.strictEqual(eligibility.exclusionReason, 'untrusted_client_or_historical_ocr_provenance');

    const ctx = extractFactualContextFromDb(caseRow, [poisonedProcessedExhibit]);
    assert.strictEqual(ctx.hasDeceptiveCommunication, false);
    assert.strictEqual(ctx.hasDishonestInducement, false);
    assert.strictEqual(ctx.hasImpersonationOfPersonOrAuthority, false);
    assert.strictEqual(ctx.hasComputerResourceUsedForImpersonation, false);
    assert.strictEqual(ctx.hasFabricatedDocumentOrElectronicRecord, false);
    assert.strictEqual(ctx.intentToCheatWithFabricatedDocument, false);
    assert.strictEqual(ctx.isReceiptOrAcquittanceAcknowledgingPaymentForged, false);
    assert.strictEqual(ctx.hasUnauthorizedUseOfPasswordOrPin, false);
    assert.strictEqual(ctx.isVictimOwnCredentialEntryUnderDeception, false);
    assert.strictEqual(ctx.hasReportedDebitOnly, true);
    assert.strictEqual(ctx.isUnverifiedImageOrGenuineScreenshotOnly, false);

    // Full HTTP POST /api/gemini/legal-analysis pipeline check with Gemini prompt capture
    let capturedPromptText = '';
    const { client } = createMockSupabaseAndRecorder({
      caseRow,
      evidenceRows: [poisonedProcessedExhibit],
      timelineRows: [
        {
          id: 'tl-1',
          date: '2025-02-10',
          title: 'Debit',
          description: 'Debit of ₹10,000',
        },
      ],
    });

    app.locals.supabaseAuthClient = createMockAuthClient();
    app.locals.userSupabaseClient = client;
    app.locals.geminiAiClient = {
      models: {
        generateContent: async (params: any) => {
          capturedPromptText = params.contents?.[0]?.parts?.[0]?.text || '';
          return { text: 'Objective summary without untrusted OCR.' };
        },
      },
    };

    try {
      const { status, data } = await dispatchInMemory('/api/gemini/legal-analysis', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-jwt',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ caseId: 'case-processed-ocr' }),
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);

      const offences = data.findings.criminalOffencesAssessment.assessedOffences;
      for (const id of ['BNS-318-4', 'BNS-319-2', 'BNS-336-2', 'BNS-336-3', 'BNS-338', 'IT-66C', 'IT-66D']) {
        const item = offences.find((o: any) => o.catalogueId === id);
        assert.strictEqual(item?.isPrimaFacieSupported, false, `${id} must not be supported by excluded OCR`);
      }

      assert.strictEqual(data.findings.assessmentMetadata.evidenceTaxonomySummary.documentObservationsCount, 0);
      assert.strictEqual(data.findings.assessmentMetadata.evidenceTaxonomySummary.forensicAuditRequiredCount, 0);

      assert.ok(!capturedPromptText.includes('REF-999999'), 'Prompt must not include OCR identifier');
      assert.ok(!capturedPromptText.includes('Fake Bank Manager'), 'Prompt must not include OCR party');
      assert.ok(!capturedPromptText.includes('Deceptive impersonation script'), 'Prompt must not include OCR summary');
      assert.ok(!capturedPromptText.includes('Statement Exhibit'), 'Prompt must not include exhibit title');
      assert.ok(!capturedPromptText.includes('bank_alert.pdf'), 'Prompt must not include exhibit filename');
    } finally {
      delete app.locals.supabaseAuthClient;
      delete app.locals.userSupabaseClient;
      delete app.locals.geminiAiClient;
    }
  });

  await runTest('2. Excludes pending, no_text, failed, missing-status, legacy synthetic, and sample-case OCR (even when has_blob=true) while preserving sample narrative/timeline', () => {
    const sampleCase = {
      id: 'NS-SAMPLE-1',
      is_sample_data: true,
      involved_entity: 'Apex Bank of India',
      disputed_amount: 42500,
      incident_date: '2026-10-28',
      description: 'Unexplained debit of ₹42,500 on account.',
    };

    const statuses = ['pending', 'no_text', 'failed', undefined] as const;
    for (const status of statuses) {
      const ev = {
        id: `ev-${status ?? 'missing'}`,
        title: 'Legacy Synthetic Exhibit',
        category: 'bank_statement',
        has_blob: true,
        storage_ref: VALID_STORAGE_REF,
        sha256_hash: VALID_SHA256,
        deleted_at: null,
        raw_ocr_text: 'REF-839201 DOC-2026-REF fake police officer induced transfer forged receipt',
        ocr_extracted: {
          ...(status ? { status } : {}),
          summary: 'Deceptive impersonation script VM-POWURG quick-bill-pay.apk',
          dates: ['2026-10-28'],
          amounts: ['₹42,500'],
          identifiers: ['REF-839201'],
          parties: ['Sample Fraudster'],
        },
      };

      const eligibility = classifyEvidenceForLegalAnalysis(ev, sampleCase);
      assert.strictEqual(eligibility.includeOcrInLegalAnalysis, false);
      assert.strictEqual(eligibility.exclusionReason, 'sample_case_fixture');

      const ctx = extractFactualContextFromDb(sampleCase, [ev]);
      assert.strictEqual(ctx.hasDeceptiveCommunication, false);
      assert.strictEqual(ctx.hasDishonestInducement, false);
      assert.strictEqual(ctx.hasImpersonationOfPersonOrAuthority, false);
      assert.strictEqual(ctx.hasFabricatedDocumentOrElectronicRecord, false);
      assert.strictEqual(ctx.hasReportedDebitOnly, true);
    }
  });

  await runTest('3. Prevents exhibit title, filename, and receipt category (or benign "payment receipt" narrative) from creating forgery or other statutory ingredients', () => {
    const debitCase = {
      id: 'case-receipt-cat',
      description: 'Unauthorized debit of ₹5,000 from my bank account.',
      disputed_amount: 5000,
    };

    const poisonedMetadataExhibit = {
      id: 'ev-receipt-1',
      title: 'Fake Forged Bank Manager Impersonation Receipt',
      category: 'receipt',
      file_name: 'fake_forged_receipt_impersonation_whatsapp_otp_sms.pdf',
      has_blob: true,
      storage_ref: VALID_STORAGE_REF,
      sha256_hash: VALID_SHA256,
      deleted_at: null,
      raw_ocr_text: 'fake receipt forged document',
      ocr_extracted: { status: 'processed', summary: 'forged receipt' },
    };

    const ctx1 = extractFactualContextFromDb(debitCase, [poisonedMetadataExhibit]);
    assert.strictEqual(ctx1.hasFabricatedDocumentOrElectronicRecord, false);
    assert.strictEqual(ctx1.intentToCheatWithFabricatedDocument, false);
    assert.strictEqual(ctx1.isReceiptOrAcquittanceAcknowledgingPaymentForged, false);
    assert.strictEqual(ctx1.hasImpersonationOfPersonOrAuthority, false);
    assert.strictEqual(ctx1.hasDeceptiveCommunication, false);
    assert.strictEqual(ctx1.hasComputerResourceUsedForImpersonation, false);

    const res1 = evaluateOffenceApplicability(ctx1);
    for (const id of ['BNS-336-2', 'BNS-336-3', 'BNS-338']) {
      assert.strictEqual(
        res1.assessedOffences.find((o) => o.catalogueId === id)?.isPrimaFacieSupported,
        false,
        `${id} must not trigger from receipt category or filename/title`
      );
    }

    // Benign mention of "receipt" in citizen narrative must not set receipt forgery flag
    const benignReceiptMentionCase = {
      description: 'Unauthorized debit of ₹5,000 occurred; I attached my genuine payment receipt.',
      disputed_amount: 5000,
    };
    const ctx2 = extractFactualContextFromDb(benignReceiptMentionCase, [poisonedMetadataExhibit]);
    assert.strictEqual(ctx2.hasFabricatedDocumentOrElectronicRecord, false);
    assert.strictEqual(ctx2.isReceiptOrAcquittanceAcknowledgingPaymentForged, false);
    const res2 = evaluateOffenceApplicability(ctx2);
    assert.strictEqual(res2.assessedOffences.find((o) => o.catalogueId === 'BNS-338')?.isPrimaFacieSupported, false);
  });

  await runTest('4. Narrative forgery allegation passes into factual context without screenshot suppression, preserves existing ingredient guards, and keeps forensicAuditRequiredCount purely category-driven', async () => {
    const activeScreenshot = {
      id: 'ev-ss-1',
      category: 'screenshot',
      title: 'Screenshot',
      file_name: 'ss.png',
      has_blob: true,
      storage_ref: VALID_STORAGE_REF,
      sha256_hash: VALID_SHA256,
      deleted_at: null,
      raw_ocr_text: null,
      ocr_extracted: { status: 'pending', summary: '' },
    };

    // 4a. Forged receipt in full deception/transfer narrative + active screenshot
    const forgedReceiptCase = {
      id: 'case-forged-receipt-ss',
      involved_entity: 'Apex Bank of India',
      disputed_amount: 15000,
      incident_date: '2025-03-01',
      description: 'The fraudster impersonated a bank manager over WhatsApp, sent a forged receipt, and induced me to transfer ₹15,000.',
    };
    const ctxReceipt = extractFactualContextFromDb(forgedReceiptCase, [activeScreenshot]);
    assert.strictEqual(ctxReceipt.hasFabricatedDocumentOrElectronicRecord, true);
    assert.strictEqual(ctxReceipt.intentToCheatWithFabricatedDocument, true);
    assert.strictEqual(ctxReceipt.isReceiptOrAcquittanceAcknowledgingPaymentForged, true);
    assert.strictEqual(ctxReceipt.isUnverifiedImageOrGenuineScreenshotOnly, false);

    const evalReceipt = evaluateOffenceApplicability(ctxReceipt);
    for (const id of ['BNS-336-2', 'BNS-336-3', 'BNS-338']) {
      const item = evalReceipt.assessedOffences.find((o) => o.catalogueId === id);
      assert.strictEqual(item?.isPrimaFacieSupported, true, `${id} should not be suppressed by screenshot category`);
      assert.ok(
        !item?.evidentiaryNote.includes('genuine screenshot or an unverified image alone'),
        `${id} evidentiaryNote must not be overridden by screenshot category`
      );
    }
    assert.ok(evalReceipt.cautionaryNotice.includes('BNSS Section 173'));

    // HTTP check: forensicAuditRequiredCount === 1 even when forgery is alleged; documentObservationsCount === 0
    const { client } = createMockSupabaseAndRecorder({
      caseRow: forgedReceiptCase,
      evidenceRows: [activeScreenshot],
    });
    app.locals.supabaseAuthClient = createMockAuthClient();
    app.locals.userSupabaseClient = client;
    app.locals.geminiAiClient = null;
    try {
      const { status, data } = await dispatchInMemory('/api/gemini/legal-analysis', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-jwt', 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: 'case-forged-receipt-ss' }),
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.findings.assessmentMetadata.evidenceTaxonomySummary.documentObservationsCount, 0);
      assert.strictEqual(data.findings.assessmentMetadata.evidenceTaxonomySummary.forensicAuditRequiredCount, 1);
    } finally {
      delete app.locals.supabaseAuthClient;
      delete app.locals.userSupabaseClient;
      delete app.locals.geminiAiClient;
    }

    // 4b. "forged document" without receipt/valuable security does NOT satisfy BNS 338
    const forgedDocOnlyCase = {
      description: 'The fraudster used a forged document to deceive and induce me to transfer ₹15,000.',
      disputed_amount: 15000,
    };
    const ctxDocOnly = extractFactualContextFromDb(forgedDocOnlyCase, [activeScreenshot]);
    assert.strictEqual(ctxDocOnly.hasFabricatedDocumentOrElectronicRecord, true);
    assert.strictEqual(ctxDocOnly.isReceiptOrAcquittanceAcknowledgingPaymentForged, false);
    const evalDocOnly = evaluateOffenceApplicability(ctxDocOnly);
    assert.strictEqual(evalDocOnly.assessedOffences.find((o) => o.catalogueId === 'BNS-336-2')?.isPrimaFacieSupported, true);
    assert.strictEqual(evalDocOnly.assessedOffences.find((o) => o.catalogueId === 'BNS-336-3')?.isPrimaFacieSupported, true);
    const bns338DocOnly = evalDocOnly.assessedOffences.find((o) => o.catalogueId === 'BNS-338');
    assert.strictEqual(bns338DocOnly?.isPrimaFacieSupported, false);
    assert.ok(bns338DocOnly?.evidentiaryNote.includes('not of a description covered under Section 338'));

    // 4c. Debit-only negative guard still blocks BNS 336/338 even if narrative mentions "forged receipt" without deception/fraud/inducement
    const debitGuardCase = {
      description: 'Unexplained debit of ₹5,000 with forged receipt.',
      disputed_amount: 5000,
    };
    const ctxDebitGuard = extractFactualContextFromDb(debitGuardCase, []);
    assert.strictEqual(ctxDebitGuard.hasFabricatedDocumentOrElectronicRecord, true);
    assert.strictEqual(ctxDebitGuard.hasReportedDebitOnly, true);
    const evalDebitGuard = evaluateOffenceApplicability(ctxDebitGuard);
    for (const id of ['BNS-336-2', 'BNS-336-3', 'BNS-338']) {
      assert.strictEqual(evalDebitGuard.assessedOffences.find((o) => o.catalogueId === id)?.isPrimaFacieSupported, false);
    }

    // 4d. Suspicious URL-only negative guard still blocks BNS 336/338
    const urlGuardCase = {
      description: 'Received http://example.test link with forged receipt.',
      disputed_amount: 0,
    };
    const ctxUrlGuard = extractFactualContextFromDb(urlGuardCase, []);
    assert.strictEqual(ctxUrlGuard.hasFabricatedDocumentOrElectronicRecord, true);
    assert.strictEqual(ctxUrlGuard.hasSuspiciousUrlOrApkOnly, true);
    const evalUrlGuard = evaluateOffenceApplicability(ctxUrlGuard);
    for (const id of ['BNS-336-2', 'BNS-336-3', 'BNS-338']) {
      assert.strictEqual(evalUrlGuard.assessedOffences.find((o) => o.catalogueId === id)?.isPrimaFacieSupported, false);
    }
  });

  await runTest('5. Unsaved draftFacts path enforces identical OCR exclusion, metadata immunity, and screenshot forensic count', async () => {
    const draftPayload = {
      incidentDate: '2025-04-01',
      involvedEntity: 'Apex Bank of India',
      disputedAmount: 20000,
      description: 'Unexplained debit of ₹20,000 from my account.',
      isSampleData: false,
      evidence: [
        {
          id: 'draft-ev-1',
          title: 'Fake Forged Bank Manager Impersonation Receipt',
          category: 'receipt',
          fileName: 'fake_forged_receipt_impersonation.pdf',
          hasBlob: true,
          storageRef: VALID_STORAGE_REF,
          sha256Hash: VALID_SHA256,
          rawOcrText: 'Threatening SMS from fake bank manager with forged receipt and stolen OTP',
          ocrStatus: 'processed',
          ocrExtracted: {
            status: 'processed',
            summary: 'Impersonation scam with fake receipt',
            dates: ['2025-04-01'],
            amounts: ['₹20,000'],
            identifiers: ['REF-7777'],
            parties: ['Scammer'],
          },
          deletedAt: null,
        },
      ],
    };

    const draftCtx = extractFactualContextFromDraft(draftPayload);
    assert.strictEqual(draftCtx.hasDeceptiveCommunication, false);
    assert.strictEqual(draftCtx.hasImpersonationOfPersonOrAuthority, false);
    assert.strictEqual(draftCtx.hasFabricatedDocumentOrElectronicRecord, false);
    assert.strictEqual(draftCtx.isReceiptOrAcquittanceAcknowledgingPaymentForged, false);
    assert.strictEqual(draftCtx.hasReportedDebitOnly, true);
    assert.strictEqual(draftCtx.isUnverifiedImageOrGenuineScreenshotOnly, false);

    // HTTP draftFacts with one active screenshot + one soft-deleted receipt
    app.locals.supabaseAuthClient = createMockAuthClient();
    app.locals.geminiAiClient = null;
    try {
      const { status, data } = await dispatchInMemory('/api/gemini/legal-analysis', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-jwt', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftFacts: {
            ...draftPayload,
            evidence: [
              {
                id: 'draft-ss-1',
                title: 'Fake Receipt Screenshot',
                category: 'screenshot',
                fileName: 'ss.png',
                hasBlob: true,
                storageRef: VALID_STORAGE_REF,
                sha256Hash: VALID_SHA256,
                ocrStatus: 'processed',
                rawOcrText: 'Fake bank manager induced transfer',
                ocrExtracted: { status: 'processed', summary: 'Impersonation' },
                deletedAt: null,
              },
              {
                ...draftPayload.evidence[0],
                deletedAt: '2025-04-02T00:00:00.000Z',
              },
            ],
          },
        }),
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.findings.assessmentMetadata.isUnsavedDraft, true);
      assert.strictEqual(data.findings.assessmentMetadata.evidenceTaxonomySummary.documentObservationsCount, 0);
      assert.strictEqual(data.findings.assessmentMetadata.evidenceTaxonomySummary.forensicAuditRequiredCount, 1);

      const offences = data.findings.criminalOffencesAssessment.assessedOffences;
      for (const id of ['BNS-318-4', 'BNS-319-2', 'BNS-336-2', 'BNS-336-3', 'BNS-338', 'IT-66C', 'IT-66D']) {
        assert.strictEqual(offences.find((o: any) => o.catalogueId === id)?.isPrimaFacieSupported, false);
      }
    } finally {
      delete app.locals.supabaseAuthClient;
      delete app.locals.geminiAiClient;
    }
  });

  await runTest('6. Soft-deleted evidence is excluded both by Supabase query .is("deleted_at", null) and in-memory filter', async () => {
    const caseRow = {
      id: 'case-deleted-ev',
      involved_entity: 'State Bank of India',
      disputed_amount: 12000,
      incident_date: '2025-05-01',
      description: 'Unauthorized debit of ₹12,000.',
    };

    const softDeletedScreenshot = {
      id: 'ev-del-1',
      category: 'screenshot',
      title: 'Deleted Screenshot',
      deleted_at: '2025-05-02T10:00:00Z',
      raw_ocr_text: 'Fake bank manager',
      ocr_extracted: { status: 'processed', summary: 'Impersonation' },
    };

    const elig = classifyEvidenceForLegalAnalysis(softDeletedScreenshot, caseRow);
    assert.strictEqual(elig.isDeleted, true);
    assert.strictEqual(elig.isActiveScreenshotExhibit, false);
    assert.strictEqual(elig.exclusionReason, 'deleted_evidence');

    // Simulate a DB client returning deleted rows (e.g. if RLS/filter were bypassed) -> in-memory filter must still drop it
    const { client, capturedQueries } = createMockSupabaseAndRecorder({
      caseRow,
      evidenceRows: [softDeletedScreenshot],
      respectDeletedFilter: false,
    });

    app.locals.supabaseAuthClient = createMockAuthClient();
    app.locals.userSupabaseClient = client;
    app.locals.geminiAiClient = null;
    try {
      const { status, data } = await dispatchInMemory('/api/gemini/legal-analysis', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-jwt', 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: 'case-deleted-ev' }),
      });

      assert.strictEqual(status, 200);
      const evQuery = capturedQueries.find((q) => q.table === 'evidence_items');
      assert.ok(evQuery, 'Must query evidence_items');
      assert.ok(
        evQuery!.filters.some((f) => f.op === 'is' && f.col === 'deleted_at' && f.val === null),
        'evidence_items query must include .is("deleted_at", null)'
      );
      assert.strictEqual(
        data.findings.assessmentMetadata.evidenceTaxonomySummary.forensicAuditRequiredCount,
        0,
        'Soft-deleted screenshot must not trigger forensicAuditRequiredCount'
      );
      assert.strictEqual(data.findings.assessmentMetadata.evidenceTaxonomySummary.documentObservationsCount, 0);
    } finally {
      delete app.locals.supabaseAuthClient;
      delete app.locals.userSupabaseClient;
      delete app.locals.geminiAiClient;
    }
  });

  await runTest('7. Preserves legitimate citizen narrative, temporal jurisdiction (IPC vs BNS), RBI, and CPA analysis without evidence', async () => {
    const caseRow = {
      id: 'case-legit-ipc',
      involved_entity: 'State Bank of India',
      disputed_amount: 50000,
      incident_date: '2024-05-15',
      description:
        'I am a customer of State Bank of India. A fraudster impersonated a bank manager over WhatsApp and deceived and induced me to transfer ₹50,000. There was a security deficiency and delayed reversal.',
    };

    const { client } = createMockSupabaseAndRecorder({
      caseRow,
      evidenceRows: [],
      timelineRows: [
        {
          id: 'tl-pre-bns',
          date: '2024-05-15',
          title: 'Deceptive inducement and transfer',
          description: 'Induced to transfer funds on WhatsApp',
        },
      ],
    });

    app.locals.supabaseAuthClient = createMockAuthClient();
    app.locals.userSupabaseClient = client;
    app.locals.geminiAiClient = null;
    try {
      const { status, data } = await dispatchInMemory('/api/gemini/legal-analysis', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-jwt', 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: 'case-legit-ipc' }),
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.findings.temporalJurisdiction.status, 'GOVERNED_BY_IPC_1860');
      assert.strictEqual(data.findings.rbiCommercialBanksProtection.isCommercialBankCovered, true);
      assert.strictEqual(data.findings.consumerProtectionAct.isEligible, true);

      const offences = data.findings.criminalOffencesAssessment.assessedOffences;
      assert.strictEqual(offences.find((o: any) => o.catalogueId === 'BNS-318-4')?.isPrimaFacieSupported, true);
      assert.strictEqual(offences.find((o: any) => o.catalogueId === 'BNS-319-2')?.isPrimaFacieSupported, true);
      assert.strictEqual(offences.find((o: any) => o.catalogueId === 'IT-66D')?.isPrimaFacieSupported, true);
    } finally {
      delete app.locals.supabaseAuthClient;
      delete app.locals.userSupabaseClient;
      delete app.locals.geminiAiClient;
    }
  });

  console.log('\n===================================================');
  console.log(`Evidence Gating Tests: ${passed} passed, ${failed} failed`);
  console.log('===================================================');
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
