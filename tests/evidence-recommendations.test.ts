/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — Evidence Intelligence Recommendations Regression Test Suite
 *
 * Scope:
 * 1. Current Test Scenario (Malicious APK Disconnection Phishing Scam):
 *    - Category: banking_financial
 *    - Loss: ₹450
 *    - TrustCheck: https://fast-ebill-update.xyz/pay.apk
 *    - Confirms all 5 practical recommendations generated:
 *      1. Original SMS / threat message screenshot (recommended)
 *      2. Suspicious URL / APK download link record (recommended)
 *      3. Bank / UPI transaction statement (conditional on debit)
 *      4. Bank / payment provider written complaint record (recommended)
 *      5. Legitimate electricity bill / discom record (optional)
 * 2. Reported Loss vs. Confirmed Debit Conditioning:
 *    - Entering ₹450 without confirmed debit keeps bank statement condition 'unconfirmed'.
 *    - Confirming debit transitions condition to 'active'.
 *    - Confirming no debit occurred transitions condition to 'inactive'.
 * 3. Strict Evidence Matching & Anti-False-Completion:
 *    - Exhibits with matching filenames or categories do NOT auto-complete recommendations.
 *    - Only explicit citizen association (via claimMappedTo) with compatible category satisfies recommendation.
 *    - Unlinking an exhibit sets isSatisfied back to false.
 * 4. All 8 Categories Baseline Coverage:
 *    - Asserts practical recommendations for banking_financial, consumer_ecommerce, real_estate_rera,
 *      insurance_claims, telecom_isp, utilities_power, municipal_civic, and employment_labour.
 *    - Confirms zero unverified statutory 'required' claims.
 * 5. Dynamic Reactivity:
 *    - Switching categories immediately recomputes recommendations.
 *    - Updating narrative dynamically triggers or removes threat overlays.
 *
 * Execution: Strictly offline. Zero external network, Gemini, or Supabase requests.
 */

import {
  getEvidenceRecommendations,
  associateExhibitWithRecommendation,
  unlinkExhibitFromRecommendation,
  DebitStatus,
} from '../src/utils/evidenceRecommendations';
import { EvidenceItem, TrustCheckRecord } from '../src/types';
import {
  executeEvidenceUploadWithParentPersistence,
  computeEvidenceMappingKey,
  hasCaseChangedFromBaseline,
  CaseBaselineState,
} from '../src/components/CaseBuilder';
import {
  mapEvidenceItemToDbRow,
  mapDbRowToEvidenceItem,
} from '../src/utils/caseMappers';

console.log('=== NivaranSetu Evidence Intelligence Recommendations Suite ===\n');

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

// ------------------------------------------------------------------------------------------------
// Section 1: Current Browser Test Scenario
// ------------------------------------------------------------------------------------------------
console.log('--- Section 1: Malicious APK Disconnection Phishing Scam ---');

const mockApkTrustRecord: TrustCheckRecord = {
  id: 'tc-3',
  input: 'https://fast-ebill-update.xyz/pay.apk',
  type: 'url',
  riskLevel: 'high_risk',
  resultStatus: 'Adverse catalog match',
  flagTitle: 'Malicious Android APK Delivery Endpoint',
  description: 'Domain registered 4 days ago. Delivers remote-access trojan that intercepts incoming SMS OTPs.',
  officialFindings: ['CERT-In Public Vulnerability Advisory on Fake Utility APK Sideloading.'],
  governmentAdvisories: [],
  sourceReferences: ['CERT-In Public Advisory'],
  recommendedActions: ['Do not install APK payload', 'Report to 1930'],
  timestamp: '2026-11-10T00:00:00Z',
  isAiObservation: false,
};

const apkDescription =
  'I received an urgent SMS warning that my electricity power would be disconnected tonight at 9:30 PM. The message directed me to visit https://fast-ebill-update.xyz/pay.apk to pay my unpaid bill of ₹450.';

const recs1 = getEvidenceRecommendations({
  category: 'banking_financial',
  description: apkDescription,
  disputedAmount: 450,
  debitStatus: 'unconfirmed',
  trustRecord: mockApkTrustRecord,
  evidenceList: [],
});

assert(
  recs1.some((r) => r.id === 'rec_sms_screenshot' && r.priority === 'recommended'),
  '1a. Generates original SMS / threat message screenshot recommendation (recommended)',
  true,
  true
);

assert(
  recs1.some((r) => r.id === 'rec_suspicious_url' && r.priority === 'recommended'),
  '1b. Generates suspicious URL / APK download link recommendation (recommended)',
  true,
  true
);

const bankDebitRec = recs1.find((r) => r.id === 'rec_bank_statement');
assert(
  Boolean(bankDebitRec && bankDebitRec.priority === 'conditional'),
  '1c. Generates bank / UPI transaction statement as conditional',
  bankDebitRec?.priority,
  'conditional'
);

assert(
  recs1.some((r) => r.id === 'rec_bank_complaint' && r.priority === 'recommended'),
  '1d. Generates bank / payment provider written complaint record (recommended)',
  true,
  true
);

assert(
  recs1.some((r) => r.id === 'rec_discom_utility_notice' && r.priority === 'optional'),
  '1e. Generates legitimate electricity bill / discom record recommendation (optional)',
  true,
  true
);

// ------------------------------------------------------------------------------------------------
// Section 2: Reported Loss vs. Confirmed Debit Conditioning
// ------------------------------------------------------------------------------------------------
console.log('\n--- Section 2: Reported Loss vs. Confirmed Debit Conditioning ---');

// Case A: Unconfirmed debit (citizen entered ₹450, but debit status is not yet verified)
assert(
  bankDebitRec?.conditionStatus === 'unconfirmed',
  '2a. Unconfirmed debit status keeps conditionStatus as "unconfirmed"',
  bankDebitRec?.conditionStatus,
  'unconfirmed'
);
assert(
  bankDebitRec?.instruction.includes('If ₹450 was actually debited') === true,
  '2b. Instruction advises verifying if ₹450 was debited before attaching statement',
  true,
  true
);

// Case B: Confirmed debit (citizen confirms money was debited from account)
const recsConfirmed = getEvidenceRecommendations({
  category: 'banking_financial',
  description: apkDescription,
  disputedAmount: 450,
  debitStatus: 'confirmed_debit',
  trustRecord: mockApkTrustRecord,
  evidenceList: [],
});
const confirmedDebitRec = recsConfirmed.find((r) => r.id === 'rec_bank_statement');
assert(
  confirmedDebitRec?.conditionStatus === 'active',
  '2c. Confirmed debit transitions conditionStatus to "active"',
  confirmedDebitRec?.conditionStatus,
  'active'
);
assert(
  confirmedDebitRec?.instruction.includes('confirming the ₹450 transaction') === true,
  '2d. Instruction specifically requests ₹450 transaction and UTR verification',
  true,
  true
);

// Case C: No debit occurred (citizen averted the scam; attempted threat only)
const recsNoDebit = getEvidenceRecommendations({
  category: 'banking_financial',
  description: apkDescription,
  disputedAmount: 450,
  debitStatus: 'no_debit',
  trustRecord: mockApkTrustRecord,
  evidenceList: [],
});
const noDebitRec = recsNoDebit.find((r) => r.id === 'rec_bank_statement');
assert(
  noDebitRec?.conditionStatus === 'inactive',
  '2e. Citizen confirming no debit occurred transitions conditionStatus to "inactive"',
  noDebitRec?.conditionStatus,
  'inactive'
);
assert(
  noDebitRec?.instruction.includes('not applicable') === true,
  '2f. Instruction states transaction proof is not applicable when no money was lost',
  true,
  true
);

// ------------------------------------------------------------------------------------------------
// Section 3: Strict Evidence Matching & Anti-False-Completion
// ------------------------------------------------------------------------------------------------
console.log('\n--- Section 3: Strict Evidence Matching & Anti-False-Completion ---');

// Unrelated exhibit with matching filename substring must NOT satisfy recommendation
const unrelatedExhibit: EvidenceItem = {
  id: 'ev-dummy-1',
  title: 'Agreement Document with electricity in title',
  fileName: 'sms_threat_notice.pdf',
  fileSize: '120 KB',
  fileType: 'application/pdf',
  category: 'agreement',
  uploadDate: '2026-11-10',
  sha256Hash: 'abc123hash',
  verifiedOriginal: false,
  ocrExtracted: { dates: [], amounts: [], identifiers: [], parties: [], summary: 'dummy' },
};

const recsWithUnrelated = getEvidenceRecommendations({
  category: 'banking_financial',
  description: apkDescription,
  disputedAmount: 450,
  debitStatus: 'unconfirmed',
  trustRecord: mockApkTrustRecord,
  evidenceList: [unrelatedExhibit],
});

const smsRecUnsatisfied = recsWithUnrelated.find((r) => r.id === 'rec_sms_screenshot');
assert(
  smsRecUnsatisfied?.isSatisfied === false,
  '3a. Unrelated exhibit with matching filename does NOT satisfy recommendation without explicit association',
  smsRecUnsatisfied?.isSatisfied,
  false
);

// Unlinked bank statement exhibit must NOT satisfy recommendation without explicit association
const unlinkedBankStatement: EvidenceItem = {
  id: 'ev-stmt-1',
  title: 'Bank Statement of Account',
  fileName: 'passbook_oct2026.pdf',
  fileSize: '450 KB',
  fileType: 'application/pdf',
  category: 'bank_statement',
  uploadDate: '2026-11-10',
  sha256Hash: 'bank123hash',
  verifiedOriginal: false,
  ocrExtracted: { dates: [], amounts: ['₹450'], identifiers: [], parties: [], summary: 'bank statement' },
};

const recsWithUnlinked = getEvidenceRecommendations({
  category: 'banking_financial',
  description: apkDescription,
  disputedAmount: 450,
  debitStatus: 'confirmed_debit',
  trustRecord: mockApkTrustRecord,
  evidenceList: [unlinkedBankStatement],
});
const bankRecUnlinked = recsWithUnlinked.find((r) => r.id === 'rec_bank_statement');
assert(
  bankRecUnlinked?.isSatisfied === false,
  '3b. Bank statement exhibit without claimMappedTo does NOT automatically satisfy recommendation',
  bankRecUnlinked?.isSatisfied,
  false
);

// Explicit citizen association (via claimMappedTo)
const associatedExhibit: EvidenceItem = associateExhibitWithRecommendation(
  {
    id: 'ev-sms-1',
    title: 'Screenshot of Fake Disconnection SMS',
    fileName: 'sms_screenshot.png',
    fileSize: '240 KB',
    fileType: 'image/png',
    category: 'screenshot',
    uploadDate: '2026-11-10',
    sha256Hash: 'smshash123',
    verifiedOriginal: true,
    ocrExtracted: { dates: [], amounts: [], identifiers: [], parties: [], summary: 'VM-POWURG threat' },
  },
  'rec_sms_screenshot'
);

const recsWithAssociated = getEvidenceRecommendations({
  category: 'banking_financial',
  description: apkDescription,
  disputedAmount: 450,
  debitStatus: 'unconfirmed',
  trustRecord: mockApkTrustRecord,
  evidenceList: [associatedExhibit],
});

const smsRecSatisfied = recsWithAssociated.find((r) => r.id === 'rec_sms_screenshot');
assert(
  smsRecSatisfied?.isSatisfied === true,
  '3c. Explicitly associated exhibit satisfies recommendation',
  smsRecSatisfied?.isSatisfied,
  true
);
assert(
  smsRecSatisfied?.matchedExhibitId === 'ev-sms-1',
  '3d. Correctly tracks matched exhibit ID',
  smsRecSatisfied?.matchedExhibitId,
  'ev-sms-1'
);

// Unlinking exhibit sets isSatisfied back to false
const unlinkedExhibit = unlinkExhibitFromRecommendation(associatedExhibit);
const recsAfterUnlink = getEvidenceRecommendations({
  category: 'banking_financial',
  description: apkDescription,
  disputedAmount: 450,
  debitStatus: 'unconfirmed',
  trustRecord: mockApkTrustRecord,
  evidenceList: [unlinkedExhibit],
});
const smsRecAfterUnlink = recsAfterUnlink.find((r) => r.id === 'rec_sms_screenshot');
assert(
  smsRecAfterUnlink?.isSatisfied === false,
  '3e. Unlinking exhibit sets isSatisfied back to false',
  smsRecAfterUnlink?.isSatisfied,
  false
);

// ------------------------------------------------------------------------------------------------
// Section 4: All 8 Categories Baseline Practical Coverage
// ------------------------------------------------------------------------------------------------
console.log('\n--- Section 4: All 8 Categories Practical Recommendations ---');

const categories: Array<import('../src/types').GrievanceCategory> = [
  'banking_financial',
  'consumer_ecommerce',
  'real_estate_rera',
  'insurance_claims',
  'telecom_isp',
  'utilities_power',
  'municipal_civic',
  'employment_labour',
];

for (const cat of categories) {
  const catRecs = getEvidenceRecommendations({
    category: cat,
    description: `Filing dispute under ${cat}`,
    disputedAmount: 0,
    evidenceList: [],
  });

  assert(
    catRecs.length > 0,
    `4. Category ${cat} generates practical recommendations (${catRecs.length} items)`,
    catRecs.length > 0,
    true
  );

  // Assert that zero items claim to be legally 'required'
  const hasRequired = catRecs.some((r) => (r.priority as string) === 'required');
  assert(
    !hasRequired,
    `4. Category ${cat} does NOT claim unverified statutory 'required' status for recommendations`,
    hasRequired,
    false
  );
}

// ------------------------------------------------------------------------------------------------
// Section 5: Dynamic Reactivity on Parameter Changes
// ------------------------------------------------------------------------------------------------
console.log('\n--- Section 5: Dynamic Reactivity on Parameter Changes ---');

// Switching category to consumer_ecommerce
const ecommerceRecs = getEvidenceRecommendations({
  category: 'consumer_ecommerce',
  description: 'Purchased a television online that arrived damaged.',
  disputedAmount: 25000,
  debitStatus: 'confirmed_debit',
  evidenceList: [],
});

assert(
  ecommerceRecs.some((r) => r.id === 'rec_retail_invoice'),
  '5a. Switching to consumer_ecommerce generates retail invoice recommendation',
  true,
  true
);

assert(
  ecommerceRecs.some((r) => r.id === 'rec_delivery_courier_proof'),
  '5b. Switching to consumer_ecommerce generates delivery / damage proof recommendation',
  true,
  true
);

// Switching to utilities_power
const powerRecs = getEvidenceRecommendations({
  category: 'utilities_power',
  description: 'Frequent unannounced voltage fluctuations and high meter reading.',
  disputedAmount: 0,
  evidenceList: [],
});

assert(
  powerRecs.some((r) => r.id === 'rec_electricity_bill'),
  '5c. Switching to utilities_power generates electricity bill recommendation',
  true,
  true
);

// ------------------------------------------------------------------------------------------------
// Section 6: Targeted Upload Exhibit Creation & Parameter Population
// ------------------------------------------------------------------------------------------------
console.log('\n--- Section 6: Targeted Upload Exhibit Creation & Parameter Population ---');

const mockTargetedFile = {
  name: 'threat_sms_screenshot.png',
  size: 154200,
  type: 'image/png',
};

const targetedResult = await executeEvidenceUploadWithParentPersistence({
  caseId: 'NS-TARGET-001',
  files: [mockTargetedFile as any],
  existingEvidence: [],
  existingCustodyEvents: [],
  incidentDate: '2026-11-10',
  disputedAmount: 450,
  involvedEntity: 'Discom Impersonator',
  buildCaseRecord: (ev, cust) => ({
    id: 'NS-TARGET-001',
    title: 'Fake Disconnection Threat',
    category: 'banking_financial',
    stage: 'drafting',
    status: 'active',
    lastUpdated: '2026-11-10',
    incidentDate: '2026-11-10',
    incidentLocation: 'Noida',
    involvedEntity: 'Discom Impersonator',
    currency: 'INR',
    description: apkDescription,
    simpleSummary: 'Fake electricity disconnection SMS',
    readinessScore: 50,
    readinessBreakdown: { evidenceCompleteness: 50, timelineClarity: 50, identityProof: 50, formalNoticeSent: 50 },
    recommendedAuthority: { name: 'RBI', portalName: 'CMS', portalUrl: 'https://cms.rbi.org.in', filingFee: 'Nil', averageResolutionTime: '30 days' },
    timeline: [],
    evidence: ev,
    missingElements: [],
    complaintDraft: { subject: 'Test', formalBody: 'Test', simpleBody: 'Test', reliefSought: 'Test' },
    custodyEvents: cust,
  }),
  onSaveCase: async () => true,
  uploadBlobFn: async (params) => ({
    storageRef: `mock-user/NS-TARGET-001/${params.evidenceId}/${params.fileName}`,
    sha256Hash: 'a'.repeat(64),
    fileSizeBytes: 154200,
    fileSizeFormatted: '150.6 KB',
    fileType: 'image/png',
    fileName: params.fileName,
  }),
  claimMappedTo: 'rec_sms_screenshot',
  targetCategory: 'screenshot',
});

assert(
  targetedResult.success === true,
  '6a. Targeted upload completes successfully',
  targetedResult.success,
  true
);

assert(
  targetedResult.newEvidence.length === 1,
  '6b. Targeted upload produces exactly 1 new EvidenceItem',
  targetedResult.newEvidence.length,
  1
);

assert(
  targetedResult.newEvidence[0].claimMappedTo === 'rec_sms_screenshot',
  '6c. Targeted upload populates claimMappedTo with recommendation ID ("rec_sms_screenshot")',
  targetedResult.newEvidence[0].claimMappedTo,
  'rec_sms_screenshot'
);

assert(
  targetedResult.newEvidence[0].category === 'screenshot',
  '6d. Targeted upload populates category with targetCategory ("screenshot")',
  targetedResult.newEvidence[0].category,
  'screenshot'
);

// ------------------------------------------------------------------------------------------------
// Section 7: Supabase Mapper Recommendation ID Round-Trip
// ------------------------------------------------------------------------------------------------
console.log('\n--- Section 7: Supabase Mapper Recommendation ID Round-Trip ---');

const recommendationExhibit: EvidenceItem = {
  id: 'ev-rec-test-1',
  title: 'Threat SMS Screenshot',
  fileName: 'threat_sms.png',
  fileSize: '150 KB',
  fileSizeBytes: 154200,
  fileType: 'image/png',
  category: 'screenshot',
  uploadDate: '2026-11-10',
  sha256Hash: 'c'.repeat(64),
  storageRef: 'user-1/NS-2026-001/ev-rec-test-1/threat_sms.png',
  hasBlob: true,
  claimMappedTo: 'rec_sms_screenshot',
  verifiedOriginal: false,
  ocrExtracted: {
    dates: ['2026-11-10'],
    amounts: ['₹450'],
    identifiers: ['REF-123456'],
    parties: ['Discom Impersonator'],
    summary: 'SMS message preview',
  },
};

const mappedRow = mapEvidenceItemToDbRow('NS-2026-001', recommendationExhibit);
assert(
  mappedRow.claim_mapped_to === 'rec_sms_screenshot',
  '7a. mapEvidenceItemToDbRow maps claimMappedTo ("rec_sms_screenshot") to claim_mapped_to',
  mappedRow.claim_mapped_to,
  'rec_sms_screenshot'
);

const rehydratedExhibit = mapDbRowToEvidenceItem(mappedRow);
assert(
  rehydratedExhibit.claimMappedTo === 'rec_sms_screenshot',
  '7b. mapDbRowToEvidenceItem rehydrates claim_mapped_to to claimMappedTo ("rec_sms_screenshot")',
  rehydratedExhibit.claimMappedTo,
  'rec_sms_screenshot'
);

// Verify other recommendation IDs as well
const bankExhibit: EvidenceItem = {
  ...recommendationExhibit,
  id: 'ev-rec-bank-1',
  category: 'bank_statement',
  claimMappedTo: 'rec_bank_statement',
};
const bankDbRow = mapEvidenceItemToDbRow('NS-2026-001', bankExhibit);
const rehydratedBank = mapDbRowToEvidenceItem(bankDbRow);
assert(
  rehydratedBank.claimMappedTo === 'rec_bank_statement',
  '7c. mapDbRowToEvidenceItem preserves rec_bank_statement recommendation ID',
  rehydratedBank.claimMappedTo,
  'rec_bank_statement'
);

// ------------------------------------------------------------------------------------------------
// Section 8: Existing Exhibit Linking / Unlinking Autosave Trigger
// ------------------------------------------------------------------------------------------------
console.log('\n--- Section 8: Existing Exhibit Linking / Unlinking Autosave Trigger ---');

const baseExhibit1: EvidenceItem = {
  id: 'ev-1',
  title: 'Document 1',
  fileName: 'doc1.pdf',
  fileSize: '100 KB',
  fileType: 'application/pdf',
  category: 'receipt',
  uploadDate: '2026-11-10',
  sha256Hash: 'd'.repeat(64),
  verifiedOriginal: false,
  ocrExtracted: { dates: [], amounts: [], identifiers: [], parties: [], summary: '' },
};

const baseExhibit2: EvidenceItem = {
  id: 'ev-2',
  title: 'Document 2',
  fileName: 'doc2.png',
  fileSize: '200 KB',
  fileType: 'image/png',
  category: 'screenshot',
  uploadDate: '2026-11-10',
  sha256Hash: 'e'.repeat(64),
  verifiedOriginal: false,
  ocrExtracted: { dates: [], amounts: [], identifiers: [], parties: [], summary: '' },
};

const initialEvidenceList = [baseExhibit1, baseExhibit2];
const initialEvidenceKey = computeEvidenceMappingKey(initialEvidenceList);

const baselineCaseState: CaseBaselineState = {
  caseId: 'NS-2026-001',
  title: 'Test Dispute Title',
  description: 'Test description of sufficient length for grievance',
  category: 'banking_financial',
  disputedAmount: 450,
  involvedEntity: 'Discom Impersonator',
  evidenceCount: 2,
  currentStep: 2,
  evidenceMappingKey: initialEvidenceKey,
};

// 8a. Linking exhibit 2 to rec_sms_screenshot triggers change from baseline
const linkedList = [
  baseExhibit1,
  associateExhibitWithRecommendation(baseExhibit2, 'rec_sms_screenshot'),
];
const linkedKey = computeEvidenceMappingKey(linkedList);
const linkedState: CaseBaselineState = {
  ...baselineCaseState,
  evidenceMappingKey: linkedKey,
};

assert(
  hasCaseChangedFromBaseline(linkedState, baselineCaseState) === true,
  '8a. Linking existing exhibit flags case as changed from baseline (triggers autosave)',
  true,
  true
);

// 8b. After autosave completes, state matches new baseline (no redundant autosave)
const updatedBaselineState: CaseBaselineState = {
  ...linkedState,
};
assert(
  hasCaseChangedFromBaseline(linkedState, updatedBaselineState) === false,
  '8b. Hydrated/saved state with linked exhibit matches baseline (no redundant save)',
  false,
  false
);

// 8c. Unlinking exhibit 2 triggers change from baseline
const unlinkedList = [
  baseExhibit1,
  unlinkExhibitFromRecommendation(linkedList[1]),
];
const unlinkedKey = computeEvidenceMappingKey(unlinkedList);
const unlinkedState: CaseBaselineState = {
  ...updatedBaselineState,
  evidenceMappingKey: unlinkedKey,
};

assert(
  hasCaseChangedFromBaseline(unlinkedState, updatedBaselineState) === true,
  '8c. Unlinking existing exhibit flags case as changed from baseline (triggers autosave)',
  true,
  true
);

// 8d. Metadata preservation on linking and unlinking
assert(
  linkedList[1].id === baseExhibit2.id &&
  linkedList[1].sha256Hash === baseExhibit2.sha256Hash &&
  linkedList[1].fileName === baseExhibit2.fileName,
  '8d. Linking preserves all exhibit metadata (id, hash, fileName)'
);

assert(
  unlinkedList[1].id === baseExhibit2.id &&
  unlinkedList[1].sha256Hash === baseExhibit2.sha256Hash &&
  unlinkedList[1].fileName === baseExhibit2.fileName &&
  unlinkedList[1].claimMappedTo === undefined,
  '8e. Unlinking preserves all exhibit metadata and clears claimMappedTo to undefined'
);

// ------------------------------------------------------------------------------------------------
// Summary
// ------------------------------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Results: ${passedCount} PASSED, ${failedCount} FAILED out of ${passedCount + failedCount} assertions`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('ALL EVIDENCE INTELLIGENCE RECOMMENDATION TESTS PASSED.');
  process.exit(0);
}
