/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — Focused OCR Status Persistence Unit Tests
 *
 * Verifies that all four OCR status values ('pending', 'processed', 'no_text', 'failed')
 * persist cleanly through saveCase (insert & update) and hydrate accurately via rowToEvidence / fetchCases,
 * including PostgreSQL JSONB key-order-insensitive diffing and status transitions.
 */

import assert from 'node:assert/strict';
import { saveCase, fetchCases } from '../src/utils/caseRepository';
import { evidenceToRow, rowToEvidence } from '../src/utils/caseMappers';
import { supabase } from '../src/utils/supabaseClient';
import { EvidenceItem, GrievanceCase, OcrStatus } from '../src/types';
import { INITIAL_CASES } from '../src/sampleData';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };
}

const TEST_USER_ID = 'a1111111-2222-4333-8444-555555555555';
const TEST_CASE_ID = 'NS-2026-OCR-PERSIST';
const VALID_SHA256 = 'c'.repeat(64);

function toPostgresJsonbOrder(obj: Record<string, any>) {
  const sorted: Record<string, any> = {};
  Object.keys(obj)
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .forEach((k) => {
      sorted[k] = obj[k];
    });
  return sorted;
}

function createMockQueryBuilder(config: {
  selectData?: any;
  onInsert?: (payload: any) => void;
  onUpsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
} = {}) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: config.selectData ?? null, error: null }),
    single: async () => ({ data: config.selectData ?? null, error: null }),
    insert: async (payload: any) => {
      if (config.onInsert) config.onInsert(payload);
      return { data: payload, error: null };
    },
    upsert: async (payload: any) => {
      if (config.onUpsert) config.onUpsert(payload);
      return { data: payload, error: null };
    },
    update: (payload: any) => {
      if (config.onUpdate) config.onUpdate(payload);
      return builder;
    },
    then: (resolve: (val: any) => any, reject?: (err: any) => any) => {
      return Promise.resolve({ data: config.selectData ?? [], error: null }).then(resolve, reject);
    },
  };
  return builder;
}

function buildExhibit(status: OcrStatus, overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  const isProcessed = status === 'processed';
  return {
    id: `ev-${status}`,
    title: `Exhibit (${status})`,
    category: 'receipt',
    fileName: `${status}.jpg`,
    fileSize: '420 KB',
    fileSizeBytes: 430080,
    fileType: 'image/jpeg',
    uploadDate: '2026-11-13',
    sha256Hash: VALID_SHA256,
    storageRef: `${TEST_USER_ID}/${TEST_CASE_ID}/ev-${status}/${status}.jpg`,
    hasBlob: true,
    rawOcrText: isProcessed ? 'Payment Ref #889900 INR 2,400.00' : undefined,
    ocrStatus: status,
    ocrExtracted: isProcessed
      ? {
          dates: ['2026-11-13'],
          amounts: ['₹2,400.00'],
          identifiers: ['889900'],
          parties: ['Apex Utility'],
          summary: 'Verified payment receipt',
          status,
        }
      : {
          dates: [],
          amounts: [],
          identifiers: [],
          parties: [],
          summary: '',
          status,
        },
    claimMappedTo: isProcessed ? 'rec_receipt' : undefined,
    flag: isProcessed ? { type: 'verified', message: 'Confirmed match' } : undefined,
    verifiedOriginal: false,
    ...overrides,
  };
}

function buildCase(evidence: EvidenceItem[]): GrievanceCase {
  return {
    ...INITIAL_CASES[0],
    id: TEST_CASE_ID,
    title: 'OCR Status Persistence Test Case',
    isSampleData: false,
    evidence,
    timeline: [],
    custodyEvents: [
      {
        id: 'ce-ocr-1',
        caseId: TEST_CASE_ID,
        evidenceId: evidence[0]?.id,
        eventType: 'evidence_uploaded',
        action: 'Uploaded Exhibit',
        actor: 'Citizen (Browser Session)',
        timestamp: '2026-11-13T06:00:00.000Z',
        details: 'Initial ingestion with SHA-256',
        fileHash: VALID_SHA256,
      },
    ],
    monitoring: undefined,
  };
}

async function runTests() {
  const origGetSession = supabase.auth.getSession.bind(supabase.auth);
  const origFrom = supabase.from.bind(supabase);

  let passed = 0;
  const check = (name: string, fn: () => void | Promise<void>) =>
    Promise.resolve(fn()).then(() => {
      passed++;
      console.log(`PASS: ${name}`);
    });

  try {
    supabase.auth.getSession = (async () => ({
      data: {
        session: {
          access_token: 'mock-jwt',
          user: { id: TEST_USER_ID, email: 'citizen@example.com' },
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      error: null,
    })) as any;

    const allStatuses: OcrStatus[] = ['pending', 'processed', 'no_text', 'failed'];

    // 1. Direct mapper round-trip for all 4 statuses (uploaded binary + non-blob)
    for (const status of allStatuses) {
      await check(`evidenceToRow -> rowToEvidence round-trips "${status}" for hasBlob=true`, () => {
        const item = buildExhibit(status);
        const row = evidenceToRow(item, TEST_USER_ID, TEST_CASE_ID);
        assert.equal(row.ocr_extracted.status, status);

        const hydrated = rowToEvidence({
          ...row,
          ocr_extracted: toPostgresJsonbOrder(row.ocr_extracted) as any,
        });
        assert.equal(hydrated.ocrStatus, status);
        assert.equal(hydrated.ocrExtracted.status, status);
      });

      await check(`evidenceToRow -> rowToEvidence round-trips "${status}" for hasBlob=false`, () => {
        const item = buildExhibit(status, {
          hasBlob: false,
          sha256Hash: null,
          storageRef: undefined,
          verifiedOriginal: false,
        });
        const row = evidenceToRow(item, TEST_USER_ID, TEST_CASE_ID);
        assert.equal(row.ocr_extracted.status, status);

        const hydrated = rowToEvidence(row);
        assert.equal(hydrated.ocrStatus, status);
        assert.equal(hydrated.ocrExtracted.status, status);
      });
    }

    // 2. Full saveCase (insert) -> saveCase (unrelated update) -> fetchCases (rowToEvidence) cycle
    for (const status of allStatuses) {
      await check(`saveCase (insert -> update -> fetchCases) preserves "${status}" with zero spurious writes`, async () => {
        let storedCaseRow: any = null;
        let storedEvidenceRows: any[] = [];
        let storedCustodyRows: any[] = [];
        let insertCalls = 0;
        let updateCalls = 0;

        supabase.from = ((tableName: string) => {
          if (tableName === 'grievance_cases') {
            return createMockQueryBuilder({
              selectData: storedCaseRow ? [storedCaseRow] : [],
              onUpsert: (p) => {
                storedCaseRow = p;
              },
            });
          }
          if (tableName === 'evidence_items') {
            return createMockQueryBuilder({
              selectData: storedEvidenceRows.map((r) => ({
                ...r,
                ocr_extracted: toPostgresJsonbOrder(r.ocr_extracted || {}),
              })),
              onInsert: (p) => {
                insertCalls++;
                storedEvidenceRows.push({
                  ...p,
                  ocr_extracted: toPostgresJsonbOrder(p.ocr_extracted || {}),
                });
              },
              onUpdate: (p) => {
                updateCalls++;
                storedEvidenceRows = storedEvidenceRows.map((r) => ({
                  ...r,
                  ...p,
                  ocr_extracted: toPostgresJsonbOrder(p.ocr_extracted || r.ocr_extracted || {}),
                }));
              },
            });
          }
          if (tableName === 'custody_events') {
            return createMockQueryBuilder({
              selectData: storedCustodyRows,
              onInsert: (p) => storedCustodyRows.push(p),
            });
          }
          return createMockQueryBuilder({ selectData: [] });
        }) as any;

        const exhibit = buildExhibit(status);
        const testCase = buildCase([exhibit]);

        // Initial insert
        await saveCase(testCase);
        assert.equal(insertCalls, 1);
        assert.equal(updateCalls, 0);
        assert.equal(storedEvidenceRows[0].ocr_extracted.status, status);

        // Unrelated case update (exhibit unchanged, DB returns JSONB-reordered keys)
        insertCalls = 0;
        updateCalls = 0;
        await saveCase({
          ...testCase,
          description: `Edited narrative without changing exhibit (${status})`,
        });
        assert.equal(insertCalls, 0);
        assert.equal(updateCalls, 0);
        assert.equal(storedEvidenceRows[0].ocr_extracted.status, status);

        // Reload via fetchCases (uses rowToEvidence)
        const fetched = await fetchCases();
        assert.equal(fetched.length, 1);
        const hydrated = fetched[0].evidence[0];
        assert.equal(hydrated.ocrStatus, status);
        assert.equal(hydrated.ocrExtracted.status, status);
        assert.equal(hydrated.sha256Hash, VALID_SHA256);
        assert.equal(hydrated.storageRef, exhibit.storageRef);
        assert.equal(fetched[0].custodyEvents.length, 1);
        assert.equal(fetched[0].custodyEvents[0].fileHash, VALID_SHA256);
      });
    }

    // 3. Status transitions during saveCase update cycle + nested ocrExtracted.status fallback
    await check('saveCase update persists transitions (pending -> no_text -> failed -> processed) cleanly', async () => {
      let storedCaseRow: any = null;
      let storedEvidenceRows: any[] = [];
      let updatePayloads: any[] = [];

      supabase.from = ((tableName: string) => {
        if (tableName === 'grievance_cases') {
          return createMockQueryBuilder({
            selectData: storedCaseRow ? [storedCaseRow] : [],
            onUpsert: (p) => {
              storedCaseRow = p;
            },
          });
        }
        if (tableName === 'evidence_items') {
          return createMockQueryBuilder({
            selectData: storedEvidenceRows.map((r) => ({
              ...r,
              ocr_extracted: toPostgresJsonbOrder(r.ocr_extracted || {}),
            })),
            onInsert: (p) => {
              storedEvidenceRows.push({
                ...p,
                ocr_extracted: toPostgresJsonbOrder(p.ocr_extracted || {}),
              });
            },
            onUpdate: (p) => {
              updatePayloads.push(p);
              storedEvidenceRows = storedEvidenceRows.map((r) => ({
                ...r,
                ...p,
                ocr_extracted: toPostgresJsonbOrder(p.ocr_extracted || r.ocr_extracted || {}),
              }));
            },
          });
        }
        return createMockQueryBuilder({ selectData: [] });
      }) as any;

      const base = buildExhibit('pending', { id: 'ev-trans' });
      const baseCase = buildCase([base]);
      await saveCase(baseCase);

      // Transition 1: pending -> no_text via top-level ocrStatus (takes precedence over stale nested status)
      updatePayloads = [];
      await saveCase({
        ...baseCase,
        evidence: [
          {
            ...base,
            ocrStatus: 'no_text',
            ocrExtracted: { ...base.ocrExtracted, status: 'pending' },
          },
        ],
      });
      assert.equal(updatePayloads.length, 1);
      assert.equal(updatePayloads[0].ocr_extracted.status, 'no_text');
      assert.equal('sha256_hash' in updatePayloads[0], false);
      assert.equal('verified_original' in updatePayloads[0], false);
      assert.equal((await fetchCases())[0].evidence[0].ocrStatus, 'no_text');

      // Transition 2: no_text -> failed via nested ocrExtracted.status when top-level ocrStatus is undefined
      updatePayloads = [];
      await saveCase({
        ...baseCase,
        evidence: [
          {
            ...base,
            ocrStatus: undefined,
            ocrExtracted: { ...base.ocrExtracted, status: 'failed' },
          },
        ],
      });
      assert.equal(updatePayloads.length, 1);
      assert.equal(updatePayloads[0].ocr_extracted.status, 'failed');
      assert.equal((await fetchCases())[0].evidence[0].ocrStatus, 'failed');

      // Transition 3: failed -> processed with extracted text and structured fields
      updatePayloads = [];
      await saveCase({
        ...baseCase,
        evidence: [
          {
            ...base,
            rawOcrText: 'UTR 445566 Amount ₹9,900',
            ocrStatus: 'processed',
            ocrExtracted: {
              dates: ['2026-11-13'],
              amounts: ['₹9,900'],
              identifiers: ['UTR 445566'],
              parties: ['Bank Z'],
              summary: 'Debit alert',
              status: 'processed',
            },
          },
        ],
      });
      assert.equal(updatePayloads.length, 1);
      assert.equal(updatePayloads[0].ocr_extracted.status, 'processed');
      assert.equal(updatePayloads[0].raw_ocr_text, 'UTR 445566 Amount ₹9,900');

      const finalLoaded = (await fetchCases())[0].evidence[0];
      assert.equal(finalLoaded.ocrStatus, 'processed');
      assert.equal(finalLoaded.ocrExtracted.status, 'processed');
      assert.equal(finalLoaded.rawOcrText, 'UTR 445566 Amount ₹9,900');
      assert.deepEqual(finalLoaded.ocrExtracted.identifiers, ['UTR 445566']);
    });

    // 4. Legacy fallback check in rowToEvidence
    await check('rowToEvidence defaults legacy has_blob=true empty OCR row without status to "pending"', () => {
      const legacyRow = evidenceToRow(buildExhibit('pending'), TEST_USER_ID, TEST_CASE_ID);
      delete legacyRow.ocr_extracted.status;
      const hydrated = rowToEvidence(legacyRow);
      assert.equal(hydrated.ocrStatus, 'pending');
      assert.equal(hydrated.ocrExtracted.status, 'pending');
    });

    console.log(`\nOCR Persistence Results: ${passed} passed, 0 failed.`);
  } finally {
    supabase.auth.getSession = origGetSession;
    supabase.from = origFrom;
  }
}

runTests().catch((err) => {
  console.error('OCR persistence test suite failed:', err);
  process.exit(1);
});
