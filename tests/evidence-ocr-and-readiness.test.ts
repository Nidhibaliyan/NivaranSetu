/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — Evidence OCR & Case Readiness Integrity Regression Suite
 *
 * Proves all confirmed fixes:
 * 1. Blank/unrelated uploaded image (e.g. dont dlt.jpg) initializes empty OCR fields,
 *    ocrStatus='pending', verifiedOriginal=false, and zero fabricated identifiers.
 * 2. Original grievance details (incidentDate, disputedAmount, involvedEntity, narrative)
 *    never leak into uploaded exhibit OCR fields, while remaining intact on GrievanceCase.
 * 3. Neither EvidenceIntelligence nor CaseBuilder Step 2 runs hardcoded SMS/phishing,
 *    bank statement, or cybercrime OCR fixtures on actual uploaded files (hasBlob=true).
 * 4. Zero fabricated threat classifications or bounding boxes (boundingBoxes.length === 0,
 *    confidence === 0) are emitted for uploaded files without genuine OCR data.
 * 5. Real SHA-256 matches actual uploaded image bytes and canonical Supabase Storage upload path.
 * 6. Case Readiness distinguishes uploaded, processed, relevant, and verified evidence;
 *    unrelated/blank/pending/no_text photos award 0 completeness/notice/verified points
 *    and cannot increase readiness score or unlock needs_info/ready.
 * 7. Pre-seeded demo exhibits in INITIAL_CASES preserve their walkthrough OCR fixtures.
 * 8. evidenceToRow / rowToEvidence round-trips ocrStatus cleanly without DB schema changes.
 *
 * Execution: Strictly offline.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  executeEvidenceUploadWithParentPersistence,
  calculateCaseReadiness,
  evaluateEvidenceMaturity,
  evaluatePrerequisiteNotice,
} from '../src/components/CaseBuilder';
import {
  resolveExhibitOcrData,
  hasGenuineOcrContent,
} from '../src/utils/evidenceOcr';
import {
  evidenceToRow,
  rowToEvidence,
} from '../src/utils/caseMappers';
import { calculateSha256 } from '../src/utils/caseStorage';
import { buildEvidenceStoragePath } from '../src/utils/evidenceStorage';
import { INITIAL_CASES } from '../src/sampleData';
import { EvidenceItem, GrievanceCase } from '../src/types';

console.log('=== NivaranSetu Evidence OCR & Case Readiness Integrity Suite ===\n');

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

async function runTests() {
  const TEST_USER_ID = '11111111-2222-4333-8444-555555555555';
  const TEST_CASE_ID = 'NS-2026-9901';

  // Synthetic blank JPEG payload (valid JPEG SOI/EOI header bytes with zero text)
  const blankJpgBytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  const expectedSha256 = crypto.createHash('sha256').update(blankJpgBytes).digest('hex');

  const computedAppSha256 = await calculateSha256(
    new Blob([blankJpgBytes], { type: 'image/jpeg' })
  );
  assert(
    computedAppSha256 === expectedSha256,
    '1.1 calculateSha256 computes exact SHA-256 matching uploaded image bytes',
    computedAppSha256,
    expectedSha256
  );

  // =========================================================================
  // SECTION 1: Upload Metadata Initialization & Zero Grievance Leakage
  // =========================================================================
  console.log('\n--- Section 1: Upload Metadata & Zero Grievance Leakage ---');

  const grievanceNarrative =
    'I received a deceptive SMS claiming power disconnection and lost money via an unauthorized UPI link.';
  const grievanceDate = '2026-11-10';
  const grievanceAmount = 18500;
  const grievanceEntity = 'Tata Power - DDL';

  const blankJpgFile = new File([blankJpgBytes], 'dont dlt.jpg', { type: 'image/jpeg' });

  let savedCaseSnapshot: GrievanceCase | null = null;
  const buildMockCaseRecord = (evidence: EvidenceItem[], custody: any[]): GrievanceCase => ({
    id: TEST_CASE_ID,
    title: 'Disputed transaction claim',
    category: 'utilities_power',
    stage: 'evidence_gathering',
    status: 'active',
    lastUpdated: new Date().toISOString(),
    incidentDate: grievanceDate,
    incidentLocation: 'Delhi',
    involvedEntity: grievanceEntity,
    disputedAmount: grievanceAmount,
    currency: 'INR',
    description: grievanceNarrative,
    simpleSummary: '',
    readinessScore: 45,
    readinessBreakdown: {
      evidenceCompleteness: 0,
      timelineClarity: 100,
      identityProof: 100,
      formalNoticeSent: 0,
    },
    recommendedAuthority: {
      name: 'CGRF',
      portalName: 'CGRF',
      portalUrl: 'https://cgrf.gov.in',
      filingFee: 'Nil',
      averageResolutionTime: '30 days',
    },
    timeline: [],
    evidence,
    missingElements: [],
    complaintDraft: { subject: '', formalBody: '', simpleBody: '', reliefSought: '' },
    custodyEvents: custody,
  });

  const uploadRes = await executeEvidenceUploadWithParentPersistence({
    caseId: TEST_CASE_ID,
    files: [blankJpgFile],
    existingEvidence: [],
    existingCustodyEvents: [],
    incidentDate: grievanceDate,
    disputedAmount: grievanceAmount,
    involvedEntity: grievanceEntity,
    buildCaseRecord: buildMockCaseRecord,
    onSaveCase: async (c) => {
      savedCaseSnapshot = c;
      return true;
    },
    uploadBlobFn: async (params) => {
      const hash = await calculateSha256(params.file);
      const storageRef = buildEvidenceStoragePath(
        TEST_USER_ID,
        params.caseId,
        params.evidenceId,
        params.fileName
      );
      return {
        storageRef,
        sha256Hash: hash,
        fileSizeBytes: blankJpgBytes.byteLength,
        fileSizeFormatted: `${blankJpgBytes.byteLength} B`,
        fileType: 'image/jpeg',
        fileName: params.fileName,
      };
    },
  });

  assert(uploadRes.success === true, '1.2 Upload workflow completes cleanly');
  assert(uploadRes.newEvidence.length === 1, '1.3 Exactly 1 exhibit created');

  const uploadedExhibit = uploadRes.newEvidence[0];
  assert(uploadedExhibit.hasBlob === true, '1.4 Uploaded exhibit has hasBlob=true');
  assert(
    uploadedExhibit.sha256Hash === expectedSha256,
    '1.5 Uploaded exhibit SHA-256 matches actual uploaded image bytes'
  );
  assert(
    Boolean(uploadedExhibit.storageRef?.startsWith(`${TEST_USER_ID}/${TEST_CASE_ID}/${uploadedExhibit.id}/`)),
    '1.6 Canonical storageRef generated for private evidence bucket'
  );
  assert(
    uploadedExhibit.ocrStatus === 'pending' && uploadedExhibit.ocrExtracted.status === 'pending',
    '1.7 Newly uploaded file initialized with ocrStatus="pending"'
  );
  assert(
    uploadedExhibit.rawOcrText === undefined,
    '1.8 rawOcrText is undefined before OCR extraction'
  );
  assert(
    uploadedExhibit.verifiedOriginal === false,
    '1.9 SHA-256 calculation / upload does NOT mark verifiedOriginal=true'
  );
  assert(
    uploadedExhibit.ocrExtracted.dates.length === 0 &&
      !uploadedExhibit.ocrExtracted.dates.includes(grievanceDate),
    '1.10 Grievance incidentDate does NOT leak into ocrExtracted.dates'
  );
  assert(
    uploadedExhibit.ocrExtracted.amounts.length === 0 &&
      !JSON.stringify(uploadedExhibit.ocrExtracted.amounts).includes('18,500'),
    '1.11 Grievance disputedAmount does NOT leak into ocrExtracted.amounts'
  );
  assert(
    uploadedExhibit.ocrExtracted.parties.length === 0 &&
      !uploadedExhibit.ocrExtracted.parties.includes(grievanceEntity),
    '1.12 Grievance involvedEntity does NOT leak into ocrExtracted.parties'
  );
  assert(
    uploadedExhibit.ocrExtracted.identifiers.length === 0,
    '1.13 No fabricated REF-XXXXXX identifiers generated on upload'
  );
  assert(
    uploadedExhibit.ocrExtracted.summary === '',
    '1.14 No fabricated summary generated on upload'
  );
  assert(
    hasGenuineOcrContent(uploadedExhibit) === false,
    '1.15 hasGenuineOcrContent returns false for newly uploaded file'
  );
  assert(
    savedCaseSnapshot !== null &&
      (savedCaseSnapshot as GrievanceCase).incidentDate === grievanceDate &&
      (savedCaseSnapshot as GrievanceCase).disputedAmount === grievanceAmount &&
      (savedCaseSnapshot as GrievanceCase).involvedEntity === grievanceEntity &&
      (savedCaseSnapshot as GrievanceCase).description === grievanceNarrative,
    '1.16 Original grievance details remain preserved separately on GrievanceCase'
  );

  // =========================================================================
  // SECTION 2: OCR Viewer Resolution — Zero Phishing/Mock Fixtures on Real Blobs
  // =========================================================================
  console.log('\n--- Section 2: OCR Viewer Resolution on Uploaded Files ---');

  const resolvedBlankJpg = resolveExhibitOcrData(uploadedExhibit);
  assert(
    resolvedBlankJpg.status === 'pending',
    '2.1 Uploaded blank JPG resolves to status="pending"',
    resolvedBlankJpg.status,
    'pending'
  );
  assert(
    resolvedBlankJpg.hasGenuineOcr === false,
    '2.2 Uploaded blank JPG reports hasGenuineOcr=false'
  );
  assert(
    resolvedBlankJpg.confidence === 0,
    '2.3 Uploaded blank JPG reports confidence=0'
  );
  assert(
    resolvedBlankJpg.boundingBoxes.length === 0,
    '2.4 Uploaded blank JPG emits 0 fabricated bounding boxes'
  );
  assert(
    resolvedBlankJpg.rawText.toLowerCase().includes('ocr scan pending'),
    '2.5 Uploaded blank JPG displays honest "OCR scan pending" message'
  );

  const forbiddenStrings = [
    'VM-POWURG',
    'quick-bill-pay.apk',
    'quick-pay.apk',
    'APEX BANK OF INDIA',
    '42,500',
    'cybercrime.gov.in',
    'Tata Power',
    '18,500',
    'Deceptive impersonation script',
  ];
  for (const forbidden of forbiddenStrings) {
    assert(
      !resolvedBlankJpg.rawText.includes(forbidden),
      `2.6 Uploaded blank JPG OCR output does NOT contain "${forbidden}"`
    );
  }

  // Test uploaded bank statement PDF and uploaded screenshot with no_text
  const uploadedBankPdf: EvidenceItem = {
    ...uploadedExhibit,
    id: 'ev-pdf-1',
    title: 'Bank Statement October',
    category: 'bank_statement',
    fileName: 'statement.pdf',
    fileType: 'application/pdf',
  };
  const resolvedBankPdf = resolveExhibitOcrData(uploadedBankPdf);
  assert(
    resolvedBankPdf.status === 'pending' &&
      !resolvedBankPdf.rawText.includes('APEX BANK') &&
      resolvedBankPdf.boundingBoxes.length === 0,
    '2.7 Uploaded bank_statement PDF (hasBlob=true) never falls back to APEX BANK demo fixture'
  );

  const noTextPhoto: EvidenceItem = {
    ...uploadedExhibit,
    id: 'ev-notext-1',
    ocrStatus: 'no_text',
    ocrExtracted: {
      dates: [],
      amounts: [],
      identifiers: [],
      parties: [],
      summary: '',
      status: 'no_text',
    },
  };
  const resolvedNoText = resolveExhibitOcrData(noTextPhoto);
  assert(
    resolvedNoText.status === 'no_text' &&
      resolvedNoText.rawText === 'No text detected in this exhibit.' &&
      resolvedNoText.boundingBoxes.length === 0 &&
      resolvedNoText.confidence === 0,
    '2.8 Uploaded exhibit with ocrStatus="no_text" displays "No text detected in this exhibit."'
  );

  // Real processed uploaded file (with genuine OCR text) resolves properly without fake bounding boxes
  const genuinelyProcessedUpload: EvidenceItem = {
    ...uploadedExhibit,
    id: 'ev-real-ocr-1',
    category: 'receipt',
    claimMappedTo: 'rec_bank_statement',
    ocrStatus: 'processed',
    rawOcrText: 'UPI Receipt #88442211 Amount INR 450 Paid on 2026-11-10',
    ocrExtracted: {
      dates: ['2026-11-10'],
      amounts: ['₹450'],
      identifiers: ['88442211'],
      parties: ['Merchant XYZ'],
      summary: 'Payment receipt for ₹450',
      status: 'processed',
    },
  };
  const resolvedRealOcr = resolveExhibitOcrData(genuinelyProcessedUpload);
  assert(
    resolvedRealOcr.status === 'processed' &&
      resolvedRealOcr.hasGenuineOcr === true &&
      resolvedRealOcr.rawText.includes('UPI Receipt #88442211') &&
      resolvedRealOcr.boundingBoxes.length === 0,
    '2.9 Uploaded file with genuine OCR displays real extracted text without fabricated bounding boxes'
  );

  // =========================================================================
  // SECTION 3: Case Readiness Scoring & Evidence Maturity Truthfulness
  // =========================================================================
  console.log('\n--- Section 3: Case Readiness Scoring & Evidence Maturity ---');

  const readinessZero = calculateCaseReadiness({
    description: grievanceNarrative,
    involvedEntity: grievanceEntity,
    incidentDate: grievanceDate,
    disputedAmount: grievanceAmount,
    evidenceList: [],
  });

  const readinessOneBlank = calculateCaseReadiness({
    description: grievanceNarrative,
    involvedEntity: grievanceEntity,
    incidentDate: grievanceDate,
    disputedAmount: grievanceAmount,
    evidenceList: [uploadedExhibit],
  });

  assert(
    readinessOneBlank.evidenceMaturity.uploaded === 1 &&
      readinessOneBlank.evidenceMaturity.processed === 0 &&
      readinessOneBlank.evidenceMaturity.relevant === 0 &&
      readinessOneBlank.evidenceMaturity.verified === 0,
    '3.1 Maturity distinguishes 1 uploaded vs 0 processed, 0 relevant, 0 verified'
  );
  assert(
    readinessOneBlank.breakdown.evidenceCompleteness === 0,
    '3.2 Blank/pending uploaded file awards 0% evidenceCompleteness',
    readinessOneBlank.breakdown.evidenceCompleteness,
    0
  );
  assert(
    readinessOneBlank.breakdown.formalNoticeSent === 0,
    '3.3 Blank/pending uploaded file awards 0% formalNoticeSent',
    readinessOneBlank.breakdown.formalNoticeSent,
    0
  );
  assert(
    readinessOneBlank.score === readinessZero.score,
    '3.4 Uploading an unrelated/blank photograph does NOT increase readiness score',
    readinessOneBlank.score,
    readinessZero.score
  );
  assert(
    readinessOneBlank.tier === 'incomplete',
    '3.5 Case with only pending/blank photograph remains strictly "incomplete"',
    readinessOneBlank.tier,
    'incomplete'
  );

  // Uploading multiple unrelated/no_text/pending exhibits — even named "notice" — must still give 0 completeness/notice
  const sneakilyNamedBlankNotice: EvidenceItem = {
    ...noTextPhoto,
    id: 'ev-blank-notice',
    title: 'Formal Acknowledgement Notice',
    category: 'notice',
    fileName: 'notice_docket.jpg',
    claimMappedTo: 'rec_bank_complaint',
  };
  const readinessMultipleBlanks = calculateCaseReadiness({
    description: grievanceNarrative,
    involvedEntity: grievanceEntity,
    incidentDate: grievanceDate,
    disputedAmount: grievanceAmount,
    evidenceList: [uploadedExhibit, noTextPhoto, sneakilyNamedBlankNotice],
  });

  assert(
    readinessMultipleBlanks.breakdown.evidenceCompleteness === 0 &&
      readinessMultipleBlanks.breakdown.formalNoticeSent === 0 &&
      readinessMultipleBlanks.score === readinessZero.score &&
      readinessMultipleBlanks.tier === 'incomplete',
    '3.6 Multiple blank/pending/no_text files (even mapped or named notice) yield 0 evidence/notice points and stay "incomplete"'
  );

  // Notice evaluation guard
  const noticeCheck = evaluatePrerequisiteNotice([uploadedExhibit, sneakilyNamedBlankNotice]);
  assert(
    noticeCheck.state === 'none' && noticeCheck.score === 0,
    '3.7 evaluatePrerequisiteNotice refuses notice/ticket credit for pending or no_text files'
  );

  // Genuine processed unverified file increases processed/relevant, while keeping verified=0
  const maturityRealOcr = evaluateEvidenceMaturity([genuinelyProcessedUpload]);
  assert(
    maturityRealOcr.uploaded === 1 &&
      maturityRealOcr.processed === 1 &&
      maturityRealOcr.relevant === 1 &&
      maturityRealOcr.verified === 0,
    '3.8 Processed relevant file counts in uploaded/processed/relevant without falsely claiming verified=1'
  );

  // =========================================================================
  // SECTION 4: Demo Exhibits & DB Mapper Round-Trip Preservation
  // =========================================================================
  console.log('\n--- Section 4: Demo Fixtures & Mapper Round-Trip ---');

  const demoExhibit1 = INITIAL_CASES[0].evidence[0];
  const resolvedDemo1 = resolveExhibitOcrData(demoExhibit1);
  assert(
    demoExhibit1.hasBlob === false &&
      resolvedDemo1.status === 'demo' &&
      resolvedDemo1.rawText.includes('VM-POWURG') &&
      resolvedDemo1.boundingBoxes.length > 0,
    '4.1 Pre-seeded demo exhibits preserve demonstration OCR walkthrough fixtures'
  );

  const demoReadiness = calculateCaseReadiness({
    description: INITIAL_CASES[0].description,
    involvedEntity: INITIAL_CASES[0].involvedEntity,
    incidentDate: INITIAL_CASES[0].incidentDate,
    disputedAmount: INITIAL_CASES[0].disputedAmount,
    evidenceList: INITIAL_CASES[0].evidence,
  });
  assert(
    demoReadiness.tier === 'ready' && demoReadiness.score >= 80,
    '4.2 Pre-seeded demo case readiness remains "ready"',
    { score: demoReadiness.score, tier: demoReadiness.tier }
  );

  // Round-trip uploaded pending exhibit through evidenceToRow -> rowToEvidence
  const mappedRow = evidenceToRow(uploadedExhibit, TEST_USER_ID, TEST_CASE_ID);
  assert(
    mappedRow.ocr_extracted.status === 'pending' &&
      mappedRow.ocr_extracted.dates.length === 0 &&
      mappedRow.ocr_extracted.identifiers.length === 0 &&
      mappedRow.verified_original === false &&
      mappedRow.sha256_hash === expectedSha256,
    '4.3 evidenceToRow persists pending status and empty extracted fields cleanly'
  );

  const hydratedExhibit = rowToEvidence(mappedRow);
  assert(
    hydratedExhibit.ocrStatus === 'pending' &&
      hydratedExhibit.ocrExtracted.status === 'pending' &&
      hydratedExhibit.ocrExtracted.dates.length === 0 &&
      hydratedExhibit.ocrExtracted.amounts.length === 0 &&
      hydratedExhibit.verifiedOriginal === false &&
      hydratedExhibit.hasBlob === true &&
      hydratedExhibit.sha256Hash === expectedSha256,
    '4.4 rowToEvidence restores ocrStatus="pending" and empty OCR fields cleanly'
  );

  // Legacy DB row with has_blob=true and empty OCR without explicit status defaults to pending
  const legacyEmptyRow = {
    ...mappedRow,
    ocr_extracted: {
      dates: [],
      amounts: [],
      identifiers: [],
      parties: [],
      summary: '',
    },
  };
  const hydratedLegacy = rowToEvidence(legacyEmptyRow);
  assert(
    hydratedLegacy.ocrStatus === 'pending' &&
      resolveExhibitOcrData(hydratedLegacy).status === 'pending',
    '4.5 Legacy uploaded binary row with empty OCR defaults safely to ocrStatus="pending"'
  );

  // =========================================================================
  // SECTION 5: Static Guard Verification in UI Components
  // =========================================================================
  console.log('\n--- Section 5: Static Source Guards ---');

  const caseBuilderSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/CaseBuilder.tsx'), 'utf-8');
  const evidenceIntelSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/EvidenceIntelligence.tsx'),
    'utf-8'
  );

  assert(
    !caseBuilderSrc.includes('getSelectedOcrData') &&
      !caseBuilderSrc.includes('REF-${Math.floor') &&
      !caseBuilderSrc.includes('Pending OCR scan'),
    '5.1 CaseBuilder.tsx contains no hardcoded mock OCR generator or fabricated REF-/Pending amounts'
  );
  assert(
    !evidenceIntelSrc.includes('getMockOcrData') &&
      !evidenceIntelSrc.includes("'DOC-2026-REF'") &&
      !evidenceIntelSrc.includes("'₹42,500.00'"),
    '5.2 EvidenceIntelligence.tsx removes inline getMockOcrData and hardcoded fallback values'
  );

  console.log('\n======================================================');
  console.log(`OCR & Readiness Results: ${passedCount} passed, ${failedCount} failed.`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
