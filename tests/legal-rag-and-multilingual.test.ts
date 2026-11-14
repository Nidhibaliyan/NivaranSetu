/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import { jsPDF } from 'jspdf';
import { app } from '../server';
import {
  createLegalRagRouter,
  extractPdfPagesFromBase64,
  splitPagesIntoChunks,
  detectSectionReference,
} from '../src/server/legalRagRouter';
import {
  APP_TRANSLATIONS,
  LANGUAGE_METADATA,
  VALID_LANGUAGE_CODES,
  normalizeLanguageCode,
  getSpeechLocale,
  getLanguageMeta,
} from '../src/i18n/appTranslations';
import { LEGAL_RAG_COPY, LEGAL_RAG_LANGUAGES } from '../src/i18n/legalRagTranslations';
import { SUPPORTED_LANGUAGES } from '../src/sampleData';
import type { LanguageCode } from '../src/types';

console.log('=== NivaranSetu Legal RAG & 12-Language End-to-End Test Suite ===\n');

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error('    Error:', err?.stack || err?.message || err);
    failed++;
  }
}

async function startTestServer(expressApp: express.Express): Promise<{
  server: http.Server;
  baseUrl: string;
}> {
  return new Promise((resolve) => {
    const server = expressApp.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function buildMultiPageLegalPdfBase64(): string {
  const doc = new jsPDF();
  doc.text(
    'Reserve Bank of India Integrated Ombudsman Scheme 2021. Section 11(1): A complainant may file a complaint before the Ombudsman if the regulated entity rejects the complaint or fails to reply within 30 days of receipt.',
    10,
    20,
    { maxWidth: 180 }
  );
  doc.addPage();
  doc.text(
    'Clause 17.4 of RBI Master Directions on Digital Payment Frauds: Zero liability of a customer applies where unauthorized electronic transaction occurs due to contributory fraud or third-party breach reported within three working days.',
    10,
    20,
    { maxWidth: 180 }
  );
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer).toString('base64');
}

function buildEmptyImageOnlyPdfBase64(): string {
  const doc = new jsPDF();
  doc.text('   ', 10, 10);
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer).toString('base64');
}

async function main() {
  // ---------------------------------------------------------------------------
  // SECTION 1: PDF TEXT EXTRACTION & PAGE/SECTION METADATA CHUNKING
  // ---------------------------------------------------------------------------
  console.log('--- Section 1: Legal RAG PDF Extraction & Chunking ---');

  const multiPagePdfBase64 = buildMultiPageLegalPdfBase64();

  await runTest('1.1: Extracts selectable text page-by-page with SHA-256 and totalPages from multi-page PDF', async () => {
    const extracted = await extractPdfPagesFromBase64(multiPagePdfBase64);
    assert.strictEqual(extracted.totalPages, 2);
    assert.strictEqual(extracted.pages.length, 2);
    assert.ok(extracted.sha256.length === 64, 'Expected 64-char SHA-256 hex digest');
    assert.ok(extracted.pages[0].includes('Section 11(1)'));
    assert.ok(extracted.pages[1].includes('Clause 17.4'));
  });

  await runTest('1.2: splitPagesIntoChunks retains pageNumber and detects sectionRef across pages', async () => {
    const extracted = await extractPdfPagesFromBase64(multiPagePdfBase64);
    const chunks = splitPagesIntoChunks(extracted.pages, 1400, 180, null);
    assert.ok(chunks.length >= 2, 'Expected at least one chunk per PDF page');
    assert.strictEqual(chunks[0].pageNumber, 1);
    assert.strictEqual(chunks[0].sectionRef, 'Section 11(1)');
    assert.strictEqual(chunks[1].pageNumber, 2);
    assert.strictEqual(chunks[1].sectionRef, 'Clause 17.4');
  });

  await runTest('1.3: Rejects blank/non-text PDF with PDF_NO_EXTRACTABLE_TEXT', async () => {
    const blankBase64 = buildEmptyImageOnlyPdfBase64();
    await assert.rejects(
      () => extractPdfPagesFromBase64(blankBase64),
      /PDF_NO_EXTRACTABLE_TEXT/
    );
  });

  await runTest('1.4: Detects statutory references including Hindi धारा', () => {
    assert.strictEqual(detectSectionReference('Pursuant to Section 35(1)(a) of CPA 2019'), 'Section 35(1)(a)');
    assert.strictEqual(detectSectionReference('BNS धारा 318(4) के अंतर्गत'), 'धारा 318(4)');
  });

  // ---------------------------------------------------------------------------
  // SECTION 2: LEGAL RAG ROUTER INGESTION & RETRIEVAL WORKFLOWS
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 2: Legal RAG Router (Ingest, Isolation, Grounding, Multilingual) ---');

  await runTest('2.1: Real mounted /api/legal-rag/status on app reports expected model & dimension metadata', async () => {
    const { server, baseUrl } = await startTestServer(app);
    try {
      const res = await fetch(`${baseUrl}/api/legal-rag/status`);
      assert.strictEqual(res.status, 200);
      const body: any = await res.json();
      assert.strictEqual(body.status, 'ok');
      assert.strictEqual(body.embeddingModel, 'gemini-embedding-2');
      assert.strictEqual(body.generationModel, 'gemini-4-hydrogen');
      assert.strictEqual(body.embeddingDimension, 3072);
    } finally {
      server.close();
    }
  });

  await runTest('2.2: Ingest rejects unauthorized token (401), invalid URL (400), and blank PDF (422)', async () => {
    const insertedDocs: any[] = [];
    const insertedChunks: any[] = [];
    const uploadedPaths: string[] = [];

    const mockAdminSupabase: any = {
      storage: {
        from: () => ({
          upload: async (path: string) => {
            uploadedPaths.push(path);
            return { error: null };
          },
        }),
      },
      from: (table: string) => {
        if (table === 'legal_documents') {
          return {
            insert: (payload: any) => ({
              select: () => ({
                single: async () => {
                  const id = `doc-${insertedDocs.length + 1}`;
                  insertedDocs.push({ id, ...payload });
                  return { data: { id }, error: null };
                },
              }),
            }),
            update: (patch: any) => ({
              eq: async (_col: string, id: string) => {
                const target = insertedDocs.find((d) => d.id === id);
                if (target) Object.assign(target, patch);
                return { error: null };
              },
            }),
          };
        }
        return {
          insert: async (rows: any[]) => {
            insertedChunks.push(...rows);
            return { error: null };
          },
        };
      },
    };

    const embedRequests: Array<{ model: string; dim?: number; text: string }> = [];
    const mockAi: any = {
      models: {
        embedContent: async ({ model, contents, config }: any) => {
          embedRequests.push({
            model,
            dim: config?.outputDimensionality,
            text: String(contents),
          });
          return {
            embeddings: [{ values: Array(3072).fill(0.01) }],
          };
        },
        generateContent: async () => ({ text: 'mocked' }),
      },
    };

    const routerApp = express();
    routerApp.use(
      '/api/legal-rag',
      createLegalRagRouter({
        ai: mockAi,
        adminSupabase: mockAdminSupabase,
        ingestToken: 'secret-ingest-token-1234',
        verifySupabaseAuth: (req: any, _res, next) => {
          req.userSupabase = {};
          next();
        },
      })
    );

    const { server, baseUrl } = await startTestServer(routerApp);
    try {
      // 401 unauthorized
      const unauth = await fetch(`${baseUrl}/api/legal-rag/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-legal-rag-token': 'wrong' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(unauth.status, 401);

      // 400 non-HTTPS URL
      const badUrl = await fetch(`${baseUrl}/api/legal-rag/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-legal-rag-token': 'secret-ingest-token-1234',
        },
        body: JSON.stringify({
          title: 'RBI Master Direction',
          sourceUrl: 'http://insecure.example.com/doc.pdf',
          authority: 'Reserve Bank of India',
          language: 'en',
          pdfBase64: multiPagePdfBase64,
        }),
      });
      assert.strictEqual(badUrl.status, 400);

      // 422 blank PDF
      const blankRes = await fetch(`${baseUrl}/api/legal-rag/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-legal-rag-token': 'secret-ingest-token-1234',
        },
        body: JSON.stringify({
          title: 'Blank Scan',
          sourceUrl: 'https://rbi.org.in/blank.pdf',
          authority: 'Reserve Bank of India',
          language: 'en',
          pdfBase64: buildEmptyImageOnlyPdfBase64(),
        }),
      });
      assert.strictEqual(blankRes.status, 422);
      const blankBody: any = await blankRes.json();
      assert.strictEqual(blankBody.error, 'PDF_NO_EXTRACTABLE_TEXT');

      // 201 Valid multi-page PDF ingestion
      const okRes = await fetch(`${baseUrl}/api/legal-rag/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-legal-rag-token': 'secret-ingest-token-1234',
        },
        body: JSON.stringify({
          title: 'RBI Integrated Ombudsman Scheme 2021',
          sourceUrl: 'https://rbi.org.in/Scripts/bs_viewcontent.aspx?Id=4070',
          authority: 'Reserve Bank of India',
          actTitle: 'RBI Integrated Ombudsman Scheme, 2021',
          language: 'en',
          sourceVerified: true,
          fileName: 'rbi-ombudsman-2021.pdf',
          pdfBase64: multiPagePdfBase64,
        }),
      });
      assert.strictEqual(okRes.status, 201);
      const okBody: any = await okRes.json();
      assert.strictEqual(okBody.success, true);
      assert.strictEqual(okBody.totalPages, 2);
      assert.strictEqual(okBody.embeddingModel, 'gemini-embedding-2');
      assert.strictEqual(insertedDocs[0].total_pages, 2);
      assert.strictEqual(insertedDocs[0].source_verified, true);
      assert.strictEqual(uploadedPaths.length, 1);
      assert.strictEqual(insertedChunks[0].page_number, 1);
      assert.strictEqual(insertedChunks[1].page_number, 2);
      assert.ok(embedRequests.every((e) => e.model === 'gemini-embedding-2' && e.dim === 3072));
    } finally {
      server.close();
    }
  });

  await runTest('2.3: Ingest rolls back document is_active=false if embedding fails mid-way', async () => {
    const docs: any[] = [];
    const mockAdmin: any = {
      from: () => ({
        insert: (p: any) => ({
          select: () => ({
            single: async () => {
              docs.push({ id: 'doc-rollback', ...p });
              return { data: { id: 'doc-rollback' }, error: null };
            },
          }),
        }),
        update: (patch: any) => ({
          eq: async () => {
            Object.assign(docs[0], patch);
            return { error: null };
          },
        }),
      }),
    };
    const failingAi: any = {
      models: {
        embedContent: async () => {
          throw new Error('Embedding quota exceeded');
        },
      },
    };
    const routerApp = express();
    routerApp.use(
      '/api/legal-rag',
      createLegalRagRouter({
        ai: failingAi,
        adminSupabase: mockAdmin,
        ingestToken: 'secret-token',
        verifySupabaseAuth: (_req, _res, next) => next(),
      })
    );
    const { server, baseUrl } = await startTestServer(routerApp);
    try {
      const res = await fetch(`${baseUrl}/api/legal-rag/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-legal-rag-token': 'secret-token' },
        body: JSON.stringify({
          title: 'Consumer Act Extract',
          sourceUrl: 'https://consumeraffairs.nic.in/cpa-2019',
          authority: 'Ministry of Consumer Affairs',
          language: 'en',
          text: 'Section 35 of the Consumer Protection Act 2019 allows filing a complaint electronically from the complainant residence or workplace.',
        }),
      });
      assert.strictEqual(res.status, 500);
      assert.strictEqual(docs[0].is_active, false, 'Expected failed ingest to deactivate doc');
    } finally {
      server.close();
    }
  });

  await runTest('2.4: Query handles missing RPC (503), filters unverified docs, supports cross-lingual Hindi retrieval & strips invalid citations', async () => {
    let rpcMode: 'missing_rpc' | 'unverified_only' | 'empty' | 'verified_match' = 'missing_rpc';
    const generationCalls: Array<{ model: string; contents: string; config: any }> = [];

    const mockAi: any = {
      models: {
        embedContent: async () => ({
          embeddings: [{ values: Array(3072).fill(0.02) }],
        }),
        generateContent: async (args: any) => {
          const text = String(args.contents || '');
          generationCalls.push({ model: args.model, contents: text, config: args.config });
          if (text.includes('Translate and distill')) {
            return { text: 'RBI Integrated Ombudsman rejection 30 days complaint procedure' };
          }
          // Return grounded answer WITH an invalid [S99] marker to assert sanitization
          return {
            text: 'आरबीआई एकीकृत लोकपाल योजना 2021 की धारा 11(1) के अनुसार, बैंक द्वारा शिकायत खारिज किए जाने पर आप लोकपाल के समक्ष शिकायत दर्ज कर सकते हैं [S1]। (अमान्य संदर्भ [S99] हटाया जाना चाहिए।)',
          };
        },
      },
    };

    const routerApp = express();
    routerApp.use(
      '/api/legal-rag',
      createLegalRagRouter({
        ai: mockAi,
        adminSupabase: null,
        verifySupabaseAuth: (req: any, _res, next) => {
          req.userSupabase = {
            rpc: async (fnName: string) => {
              assert.strictEqual(fnName, 'match_legal_chunks');
              if (rpcMode === 'missing_rpc') {
                return {
                  data: null,
                  error: {
                    code: 'PGRST202',
                    message: 'Could not find the function public.match_legal_chunks in schema cache',
                  },
                };
              }
              if (rpcMode === 'unverified_only') {
                return {
                  data: [
                    {
                      id: 'chunk-unverified',
                      title: 'Draft Unverified Blog',
                      authority: 'Unverified',
                      source_url: 'https://example.com/unverified',
                      content: 'Draft',
                      similarity: 0.9,
                      source_verified: false,
                      is_active: true,
                    },
                  ],
                  error: null,
                };
              }
              if (rpcMode === 'empty') {
                return { data: [], error: null };
              }
              return {
                data: [
                  {
                    id: 'chunk-rbi-1',
                    document_id: 'doc-rbi-1',
                    title: 'RBI Integrated Ombudsman Scheme 2021',
                    authority: 'Reserve Bank of India',
                    act_title: 'RBI Integrated Ombudsman Scheme, 2021',
                    section_ref: 'Section 11(1)',
                    page_number: 1,
                    source_url: 'https://rbi.org.in/ombudsman-2021',
                    language: 'en',
                    content:
                      'Section 11(1): A complainant may file before the Ombudsman if the complaint is rejected or unresolved within 30 days.',
                    similarity: 0.87,
                    source_verified: true,
                    is_active: true,
                  },
                ],
                error: null,
              };
            },
          };
          next();
        },
      })
    );

    const { server, baseUrl } = await startTestServer(routerApp);
    try {
      // A. Missing RPC -> 503 honest error
      rpcMode = 'missing_rpc';
      const dbErrRes = await fetch(`${baseUrl}/api/legal-rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'RBI Ombudsman limit', language: 'en' }),
      });
      assert.strictEqual(dbErrRes.status, 503);
      const dbErrBody: any = await dbErrRes.json();
      assert.strictEqual(dbErrBody.error, 'LEGAL_RAG_DB_ERROR');

      // B. Unverified rows excluded -> insufficientEvidence = true
      rpcMode = 'unverified_only';
      const unverifiedRes = await fetch(`${baseUrl}/api/legal-rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'RBI Ombudsman limit', language: 'en' }),
      });
      assert.strictEqual(unverifiedRes.status, 200);
      const unverifiedBody: any = await unverifiedRes.json();
      assert.strictEqual(unverifiedBody.insufficientEvidence, true);
      assert.strictEqual(unverifiedBody.sources.length, 0);

      // C. Zero matches in Tamil -> honest Tamil insufficient-evidence message (no Gemini call!)
      rpcMode = 'empty';
      const callsBeforeEmpty = generationCalls.length;
      const emptyTaRes = await fetch(`${baseUrl}/api/legal-rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'வங்கி புகார் விதிகள் என்ன?', language: 'ta' }),
      });
      assert.strictEqual(emptyTaRes.status, 200);
      const emptyTaBody: any = await emptyTaRes.json();
      assert.strictEqual(emptyTaBody.insufficientEvidence, true);
      assert.strictEqual(emptyTaBody.language, 'ta');
      assert.ok(emptyTaBody.answer.includes('சரிபார்க்கப்பட்ட'), 'Expected localized Tamil fallback message');
      // Only cross-lingual query translator ran (never final answer fabrication)
      assert.ok(
        generationCalls.slice(callsBeforeEmpty).every((c) => c.contents.includes('Translate and distill')),
        'Must not fabricate an answer when 0 passages match'
      );

      // D. Cross-lingual Hindi question retrieves English RBI source, verifies NO temperature & ThinkingLevel.LOW, strips [S99]
      rpcMode = 'verified_match';
      const hiRes = await fetch(`${baseUrl}/api/legal-rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'बैंक ने शिकायत खारिज कर दी तो आरबीआई लोकपाल के नियम क्या हैं?',
          language: 'hi',
        }),
      });
      assert.strictEqual(hiRes.status, 200);
      const hiBody: any = await hiRes.json();
      assert.strictEqual(hiBody.insufficientEvidence, false);
      assert.strictEqual(hiBody.language, 'hi');
      assert.strictEqual(hiBody.verifiedRetrievalCount, 1);
      assert.ok(hiBody.answer.includes('[S1]'), 'Valid [S1] citation should remain');
      assert.ok(!hiBody.answer.includes('[S99]'), 'Fabricated [S99] citation must be stripped');
      assert.strictEqual(hiBody.sources[0].pageNumber, 1);
      assert.strictEqual(hiBody.sources[0].sectionRef, 'Section 11(1)');
      assert.strictEqual(hiBody.sources[0].title, 'RBI Integrated Ombudsman Scheme 2021');

      const finalGen = generationCalls[generationCalls.length - 1];
      assert.strictEqual(finalGen.model, 'gemini-4-hydrogen');
      assert.strictEqual(finalGen.config?.temperature, undefined, 'Never set temperature on Gemini 4 models');
      assert.ok(finalGen.config?.thinkingConfig?.thinkingLevel, 'Should pass thinkingLevel');
    } finally {
      server.close();
    }
  });

  // ---------------------------------------------------------------------------
  // SECTION 3: END-TO-END MULTILINGUAL BACKEND ROUTES ON REAL EXPRESS APP
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 3: Multilingual Backend API Routes ---');

  await runTest('3.1: /api/gemini/chat & /api/gemini/transcribe respect selected language codes (ta, bn)', async () => {
    const capturedCalls: Array<{ model: string; systemInstruction?: string; prompt?: string }> = [];
    const origAiOverride = app.locals.geminiAiClient;
    const origAuthOverride = app.locals.supabaseAuthClient;
    app.locals.supabaseAuthClient = {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'user-multilingual-1', email: 'citizen@example.in' } },
          error: null,
        }),
      },
    } as any;
    app.locals.geminiAiClient = {
      models: {
        generateContent: async (args: any) => {
          const textParts = Array.isArray(args.contents)
            ? JSON.stringify(args.contents)
            : String(args.contents || '');
          capturedCalls.push({
            model: args.model,
            systemInstruction: args.config?.systemInstruction,
            prompt: textParts,
          });
          return { text: 'வணக்கம், இது தமிழ் பதில்.' };
        },
      },
    };

    const { server, baseUrl } = await startTestServer(app);
    try {
      const chatRes = await fetch(`${baseUrl}/api/gemini/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer header.payload.signature',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', text: 'என் UPI பணம் திரும்பப் பெற வழி என்ன?' }],
          requestedModel: 'gemini-4-hydrogen',
          language: 'ta',
        }),
      });
      assert.strictEqual(chatRes.status, 200);
      const chatBody: any = await chatRes.json();
      assert.strictEqual(chatBody.language, 'ta');
      assert.ok(capturedCalls[0].systemInstruction?.includes('Tamil'));

      const trRes = await fetch(`${baseUrl}/api/gemini/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer header.payload.signature',
        },
        body: JSON.stringify({
          audioBase64: Buffer.from('fake-audio').toString('base64'),
          mimeType: 'audio/wav',
          language: 'bn',
        }),
      });
      assert.strictEqual(trRes.status, 200);
      const trBody: any = await trRes.json();
      assert.strictEqual(trBody.language, 'bn');
      assert.ok(capturedCalls[1].prompt?.includes('Bengali'));
    } finally {
      app.locals.supabaseAuthClient = origAuthOverride;
      app.locals.geminiAiClient = origAiOverride;
      server.close();
    }
  });

  await runTest('3.2: /api/gemini/legal-analysis handles Hindi grievance facts + Gemini Hindi synthesis + deterministic Hindi fallback', async () => {
    const origAuthOverride = app.locals.supabaseAuthClient;
    const origReqOverride = app.locals.userSupabaseClient;
    const origAiOverride = app.locals.geminiAiClient;

    let aiCallInstruction = '';
    const hindiCaseRecord = {
      id: 'NS-2026-HI-01',
      title: 'एसबीआई खाते से अनधिकृत यूपीआई धोखाधड़ी',
      category: 'banking_financial',
      involved_entity: 'State Bank of India',
      incident_date: '2026-10-15',
      disputed_amount: 42500,
      description:
        '15 अक्टूबर 2026 को एक फर्जी लिंक के बाद मुझे ओटीपी आया और बिना अनुमति मेरे खाते से 42,500 रुपये कट गए। बैंक ने अभी तक खाता फ्रीज नहीं किया और जवाब में देरी की।',
      simple_summary: 'बैंक धोखाधड़ी',
      complaint_draft: { timeline: [], custodyEvents: [] },
    };

    const mockSupabaseForUser = {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'user-hi-1', email: 'citizen@example.in' } },
          error: null,
        }),
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (table === 'grievance_cases') return { data: hindiCaseRecord, error: null };
              return { data: null, error: null };
            },
            single: async () => ({ data: hindiCaseRecord, error: null }),
            is: async () => ({ data: [], error: null }),
            order: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    };

    app.locals.supabaseAuthClient = mockSupabaseForUser;
    app.locals.userSupabaseClient = mockSupabaseForUser;
    app.locals.geminiAiClient = {
      models: {
        generateContent: async (args: any) => {
          aiCallInstruction = args.config?.systemInstruction || '';
          return { text: 'हिंदी विधिक विश्लेषण: यह मामला RBI और BNS धारा 318(4) के अंतर्गत आता है।' };
        },
      },
    };

    const { server, baseUrl } = await startTestServer(app);
    try {
      const liveRes = await fetch(`${baseUrl}/api/gemini/legal-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer header.payload.signature',
        },
        body: JSON.stringify({ caseId: 'NS-2026-HI-01', language: 'hi' }),
      });
      assert.strictEqual(liveRes.status, 200);
      const liveBody: any = await liveRes.json();
      assert.strictEqual(liveBody.success, true);
      assert.strictEqual(liveBody.language, 'hi');
      assert.strictEqual(liveBody.isFallback, false);
      assert.ok(aiCallInstruction.includes('Hindi'), 'System instruction must require Hindi output');
      assert.strictEqual(
        liveBody.findings.temporalJurisdiction.status,
        'GOVERNED_BY_BNS_2023',
        'Hindi case date 2026-10-15 must trigger GOVERNED_BY_BNS_2023'
      );

      // Now test deterministic fallback in Hindi when Gemini AI is unavailable
      app.locals.geminiAiClient = null;
      const fallbackRes = await fetch(`${baseUrl}/api/gemini/legal-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer header.payload.signature',
        },
        body: JSON.stringify({ caseId: 'NS-2026-HI-01', language: 'hi' }),
      });
      assert.strictEqual(fallbackRes.status, 200);
      const fallbackBody: any = await fallbackRes.json();
      assert.strictEqual(fallbackBody.isFallback, true);
      assert.strictEqual(fallbackBody.language, 'hi');
      assert.ok(fallbackBody.synthesis.includes('वित्तीय अपराध विधिक विश्लेषण'));
    } finally {
      app.locals.supabaseAuthClient = origAuthOverride;
      app.locals.userSupabaseClient = origReqOverride;
      app.locals.geminiAiClient = origAiOverride;
      server.close();
    }
  });

  // ---------------------------------------------------------------------------
  // SECTION 4: 12-LANGUAGE DICTIONARY & METADATA COMPLETENESS
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 4: 12-Language UI Dictionary & Speech Metadata Parity ---');

  await runTest('4.1: All 12 languages are enabled, normalized, mapped to -IN speech locales, and complete in APP_TRANSLATIONS + LEGAL_RAG_COPY', () => {
    const expectedCodes: LanguageCode[] = [
      'en', 'hi', 'bn', 'mr', 'ta', 'te', 'kn', 'ml', 'gu', 'pa', 'or', 'ur',
    ];
    assert.strictEqual(SUPPORTED_LANGUAGES.length, 12);
    assert.ok(SUPPORTED_LANGUAGES.every((l) => l.supported === true), 'All 12 languages must be supported: true');

    const enKeys = Object.keys(APP_TRANSLATIONS.en);
    const ragEnKeys = Object.keys(LEGAL_RAG_COPY.en);

    for (const code of expectedCodes) {
      assert.ok(VALID_LANGUAGE_CODES.has(code), `Missing code in VALID_LANGUAGE_CODES: ${code}`);
      assert.ok(LANGUAGE_METADATA[code].speechLocale.endsWith('-IN'));
      assert.strictEqual(getSpeechLocale(code), LANGUAGE_METADATA[code].speechLocale);
      assert.ok(LEGAL_RAG_LANGUAGES[code].nativeName.length > 0);
      assert.ok(getLanguageMeta(code).nativeLabel.length > 0);

      for (const k of enKeys) {
        const val = APP_TRANSLATIONS[code]?.[k];
        assert.ok(typeof val === 'string' && val.trim().length > 0, `Missing APP_TRANSLATIONS[${code}].${k}`);
      }
      for (const k of ragEnKeys) {
        const val = (LEGAL_RAG_COPY[code] as any)?.[k];
        assert.ok(typeof val === 'string' && val.trim().length > 0, `Missing LEGAL_RAG_COPY[${code}].${k}`);
      }
    }

    assert.strictEqual(normalizeLanguageCode(' HI '), 'hi');
    assert.strictEqual(normalizeLanguageCode('invalid-code'), 'en');
  });

  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test harness error:', err);
  process.exit(1);
});
