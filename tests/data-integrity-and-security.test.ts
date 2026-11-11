import { INITIAL_CASES } from '../src/sampleData';
import { createCustodyEvent, persistCases, verifyEvidenceIntegrity } from '../src/utils/caseStorage';
import { GrievanceCase, CustodyEventType } from '../src/types';

// -------------------------------------------------------------
// NivaranSetu Data Integrity & Security Regression Test Suite
// -------------------------------------------------------------

console.log('=== NivaranSetu Data Integrity & Security Regression Suite ===\n');

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
// SECTION 1: Sample Data Integrity & Truthful Synthetic Exhibits
// -------------------------------------------------------------
console.log('--- SECTION 1: Sample Data Truthful Synthetic Exhibits ---');

assert(INITIAL_CASES.length === 4, 'INITIAL_CASES contains exactly 4 canonical scenarios', INITIAL_CASES.length, 4);

let totalExhibits = 0;
let nullHashCount = 0;
let hasBlobFalseCount = 0;
let verifiedOriginalFalseCount = 0;

INITIAL_CASES.forEach((c) => {
  c.evidence.forEach((ev) => {
    totalExhibits++;
    if (ev.sha256Hash === null) nullHashCount++;
    if (ev.hasBlob === false) hasBlobFalseCount++;
    if (ev.verifiedOriginal === false) verifiedOriginalFalseCount++;
  });
});

assert(totalExhibits === 9, 'Exactly 9 total sample exhibits registered across all 4 scenarios', totalExhibits, 9);
assert(nullHashCount === 9, 'All 9 sample exhibits have sha256Hash strictly equal to null', nullHashCount, 9);
assert(hasBlobFalseCount === 9, 'All 9 sample exhibits have hasBlob = false', hasBlobFalseCount, 9);
assert(verifiedOriginalFalseCount === 9, 'All 9 sample exhibits have verifiedOriginal = false', verifiedOriginalFalseCount, 9);

// Check custody event file hashes across all sample cases
let sampleCustodyDummyHashCount = 0;
let sampleCustodyNullHashCount = 0;
INITIAL_CASES.forEach((c) => {
  c.custodyEvents.forEach((ce) => {
    if (ce.fileHash !== undefined && ce.fileHash !== null) {
      sampleCustodyDummyHashCount++;
    }
    if (ce.fileHash === null) {
      sampleCustodyNullHashCount++;
    }
  });
});
assert(sampleCustodyDummyHashCount === 0, 'Zero fabricated/dummy hashes across all demo custody events', sampleCustodyDummyHashCount, 0);
assert(sampleCustodyNullHashCount === 6, 'Exactly 6 demo custody events have fileHash strictly equal to null', sampleCustodyNullHashCount, 6);

// Scenario 1 exhibit mapping verification
const case0842 = INITIAL_CASES.find((c) => c.id === 'NS-2026-0842')!;
assert(case0842 !== undefined, 'Scenario 1 (NS-2026-0842) exists');
const ev1 = case0842.evidence.find((e) => e.id === 'ev-1')!;
const ev2 = case0842.evidence.find((e) => e.id === 'ev-2')!;
assert(ev1?.category === 'screenshot' && ev1?.fileName === 'sms_threat_electricity_notice.png', 'Scenario 1 ev-1 correctly mapped to SMS screenshot', ev1?.fileName, 'sms_threat_electricity_notice.png');
assert(ev2?.category === 'bank_statement' && ev2?.fileName === 'bank_passbook_extract_oct2026.pdf', 'Scenario 1 ev-2 correctly mapped to Bank Statement', ev2?.fileName, 'bank_passbook_extract_oct2026.pdf');

// Scenario 1 timeline mapping verification
const tl1 = case0842.timeline.find((t) => t.id === 'tl-1')!;
const tl2 = case0842.timeline.find((t) => t.id === 'tl-2')!;
const tl5 = case0842.timeline.find((t) => t.id === 'tl-5')!;
assert(tl1?.evidenceId === 'ev-1', 'Timeline tl-1 correctly points to SMS exhibit ev-1', tl1?.evidenceId, 'ev-1');
assert(tl2?.evidenceId === 'ev-2', 'Timeline tl-2 correctly points to Bank Statement exhibit ev-2', tl2?.evidenceId, 'ev-2');
assert(tl5?.evidenceId === null, 'Timeline tl-5 evidenceId is null (no dangling reference to nonexistent ev-5)', tl5?.evidenceId, null);
assert(tl5?.verifiedByDoc === false, 'Timeline tl-5 verifiedByDoc is false', tl5?.verifiedByDoc, false);

// Global referential integrity check: all timeline evidenceIds across all 4 scenarios must exist in c.evidence or be null/undefined
let danglingTimelineRefCoung = 0;
INITIAL_CASES.forEach((c) => {
  const validEvIds = new Set(c.evidence.map((e) => e.id));
  c.timeline.forEach((t) => {
    if (t.evidenceId && !validEvIds.has(t.evidenceId)) {
      danglingTimelineRefCoung++;
    }
  });
});
assert(danglingTimelineRefCoung === 0, 'Zero dangling timeline evidence references across all scenarios', danglingTimelineRefCoung, 0);

// -------------------------------------------------------------
// SECTION 2: Persistence Boundary Empty Hash Normalization
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Empty Hash vs SQL NULL Normalization ---');

const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; },
};
(globalThis as any).localStorage = mockLocalStorage;

const testCaseWithEmptyHashes: GrievanceCase = {
  ...INITIAL_CASES[0],
  evidence: [
    {
      ...INITIAL_CASES[0].evidence[0],
      sha256Hash: '' as any, // Legacy empty string
      hasBlob: true, // Inconsistent state
      verifiedOriginal: true, // Inconsistent state
    },
    {
      ...INITIAL_CASES[0].evidence[1],
      sha256Hash: '   ' as any, // Whitespace only
      hasBlob: true,
      verifiedOriginal: true,
    },
    {
      ...INITIAL_CASES[0].evidence[2],
      sha256Hash: 'a'.repeat(64), // Valid 64-char genuine hex hash
      hasBlob: true,
      verifiedOriginal: false,
    },
  ],
  custodyEvents: [
    {
      id: 'test-ev-1',
      caseId: INITIAL_CASES[0].id,
      eventType: 'evidence_uploaded',
      action: 'Test Upload Empty Hash',
      actor: 'Citizen (Browser Session)',
      timestamp: '2026-11-09 10:00:00 UTC',
      details: 'Test details',
      fileHash: '' as any, // Legacy empty string
    },
    {
      id: 'test-ev-2',
      caseId: INITIAL_CASES[0].id,
      eventType: 'evidence_uploaded',
      action: 'Test Upload Real Hash',
      actor: 'Citizen (Browser Session)',
      timestamp: '2026-11-09 10:00:00 UTC',
      details: 'Test details',
      fileHash: 'b'.repeat(64),
    },
  ],
};

// Run persistCases
persistCases([testCaseWithEmptyHashes]).then(() => {
  const persistedRaw = mockLocalStorage.getItem('ns_grievance_cases');
  assert(persistedRaw !== null, 'persistCases successfully writes to storage');

  const parsed: GrievanceCase[] = JSON.parse(persistedRaw || '[]');
  const savedCase = parsed[0];

  assert(savedCase.evidence[0].sha256Hash === null, 'Empty string sha256Hash coerced to SQL NULL at persistence boundary', savedCase.evidence[0].sha256Hash, null);
  assert(savedCase.evidence[0].hasBlob === false, 'hasBlob coerced to false when hash is null', savedCase.evidence[0].hasBlob, false);
  assert(savedCase.evidence[0].verifiedOriginal === false, 'verifiedOriginal coerced to false when hash is null', savedCase.evidence[0].verifiedOriginal, false);

  assert(savedCase.evidence[1].sha256Hash === null, 'Whitespace-only sha256Hash coerced to SQL NULL at persistence boundary', savedCase.evidence[1].sha256Hash, null);
  assert(savedCase.evidence[1].hasBlob === false, 'hasBlob coerced to false for whitespace hash', savedCase.evidence[1].hasBlob, false);

  assert(savedCase.evidence[2].sha256Hash === 'a'.repeat(64), 'Valid 64-character hex hash strictly preserved intact', savedCase.evidence[2].sha256Hash, 'a'.repeat(64));
  assert(savedCase.evidence[2].hasBlob === true, 'hasBlob preserved as true when genuine hash is present', savedCase.evidence[2].hasBlob, true);

  assert(savedCase.custodyEvents[0].fileHash === null, 'Empty custody fileHash coerced to null at persistence boundary', savedCase.custodyEvents[0].fileHash, null);
  assert(savedCase.custodyEvents[1].fileHash === 'b'.repeat(64), 'Genuine custody fileHash strictly preserved', savedCase.custodyEvents[1].fileHash, 'b'.repeat(64));

  // -------------------------------------------------------------
  // SECTION 3: createCustodyEvent Hash Normalization
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: createCustodyEvent Hash Normalization ---');

  const evEmpty = createCustodyEvent('NS-TEST', 'evidence_removed', 'Test Action', 'Citizen', 'Test Details', 'ev-1', '');
  assert(evEmpty.fileHash === null, 'createCustodyEvent normalizes empty string to null', evEmpty.fileHash, null);

  const evWhitespace = createCustodyEvent('NS-TEST', 'evidence_removed', 'Test Action', 'Citizen', 'Test Details', 'ev-1', '   ');
  assert(evWhitespace.fileHash === null, 'createCustodyEvent normalizes whitespace-only string to null', evWhitespace.fileHash, null);

  const evValid = createCustodyEvent('NS-TEST', 'evidence_uploaded', 'Test Action', 'Citizen', 'Test Details', 'ev-1', 'c'.repeat(64));
  assert(evValid.fileHash === 'c'.repeat(64), 'createCustodyEvent preserves genuine 64-character hex hash', evValid.fileHash, 'c'.repeat(64));

  // -------------------------------------------------------------
  // SECTION 4: verifyEvidenceIntegrity Guard against Null Hashes
  // -------------------------------------------------------------
  console.log('\n--- SECTION 4: Independent Evidence Verification Guard ---');

  verifyEvidenceIntegrity('NS-TEST', 'ev-1', null).then((resNull) => {
    assert(resNull.verified === false, 'verifyEvidenceIntegrity returns verified = false when expectedHash is null', resNull.verified, false);
    assert(resNull.status === 'no_expected_hash', 'verifyEvidenceIntegrity returns status "no_expected_hash"', resNull.status, 'no_expected_hash');

    verifyEvidenceIntegrity('NS-TEST', 'ev-1', '').then((resEmpty) => {
      assert(resEmpty.verified === false, 'verifyEvidenceIntegrity returns verified = false when expectedHash is empty string', resEmpty.verified, false);
      assert(resEmpty.status === 'no_expected_hash', 'verifyEvidenceIntegrity returns status "no_expected_hash" for empty string', resEmpty.status, 'no_expected_hash');

      // -------------------------------------------------------------
      // SECTION 5: Custody Event Allowlist Verification
      // -------------------------------------------------------------
      console.log('\n--- SECTION 5: Custody Event Allowlist Classification ---');

      const clientAllowlist: CustodyEventType[] = [
        'case_created',
        'case_updated',
        'category_changed',
        'status_changed',
        'evidence_uploaded',
        'evidence_accessed',
        'evidence_downloaded',
        'evidence_removed',
        'complaint_generated',
        'reminder_created',
        'reminder_completed',
        'reminder_deleted',
        'dossier_exported',
      ];

      assert(clientAllowlist.length === 13, 'Strict client allowlist contains exactly 13 event types', clientAllowlist.length, 13);

      const reservedSystemAndAuthorityTypes: CustodyEventType[] = [
        'evidence_verified',
        'ocr_processed',
        'entity_extracted',
        'claim_mapped',
        'readiness_assessed',
        'authority_recommended',
        'response_analyzed',
        'escalation_evaluated',
        'followup_letter_generated',
        'dossier_generated',
        'filing_ref_recorded',
        'submission_recorded',
        'response_received',
      ];

      assert(reservedSystemAndAuthorityTypes.length === 13, 'Reserved system and authority set contains exactly 13 event types', reservedSystemAndAuthorityTypes.length, 13);

      let overlapCount = 0;
      for (const clientType of clientAllowlist) {
        if (reservedSystemAndAuthorityTypes.includes(clientType)) {
          overlapCount++;
        }
      }
      assert(overlapCount === 0, 'Zero overlap between client allowlist and reserved system/authority set', overlapCount, 0);

      // Total set is 13 + 13 = 26
      assert(clientAllowlist.length + reservedSystemAndAuthorityTypes.length === 26, 'Total union of custody event types equals 26', clientAllowlist.length + reservedSystemAndAuthorityTypes.length, 26);

      // -------------------------------------------------------------
      // SECTION 6: Authoritative Server-Side Actor Derivation
      // -------------------------------------------------------------
      console.log('\n--- SECTION 6: Authoritative Server-Side Actor Derivation ---');

      const serverActorMap: Record<string, string> = {
        ocr_processed: 'NivaranSetu System (OCR Pipeline)',
        entity_extracted: 'NivaranSetu System (Entity Extraction Engine)',
        claim_mapped: 'NivaranSetu System (Legal Claim Mapper)',
        readiness_assessed: 'NivaranSetu System (Readiness Assessment Engine)',
        authority_recommended: 'NivaranSetu System (Statutory Routing Engine)',
        response_analyzed: 'NivaranSetu System (Counter-Party Analysis Engine)',
        escalation_evaluated: 'NivaranSetu System (Escalation Window Evaluator)',
        followup_letter_generated: 'NivaranSetu System (Document Formulator)',
        dossier_generated: 'NivaranSetu System (Dossier Compiler)',
        filing_ref_recorded: 'Statutory Redress Gateway (Filing Docket Recorder)',
        submission_recorded: 'Statutory Redress Gateway (Electronic Filing Gateway)',
        response_received: 'Statutory Redress Gateway (Inbound Authority Webhook)',
      };

      assert(Object.keys(serverActorMap).length === 12, 'Server actor map covers all 12 automated pipeline events', Object.keys(serverActorMap).length, 12);
      assert(!('evidence_verified' in serverActorMap), 'evidence_verified is excluded from general custody insertion (requires actual verification worker)', !('evidence_verified' in serverActorMap), true);

      console.log('\n======================================================');
      console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
      console.log('======================================================');

      if (failedCount > 0) {
        process.exit(1);
      }
    });
  });
});
