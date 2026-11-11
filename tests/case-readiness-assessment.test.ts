/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — Case Readiness Assessment (Step 3) Regression Test Suite
 *
 * Scope:
 * 1. URL & Domain Indicator Rejection (isUrlOrDomainIndicator):
 *    - Rejects URLs, bare domains, domains with paths, and APK links as legal respondents.
 *    - Preserves legitimate corporate, utility, and bank entity names.
 * 2. Prerequisite Notice Truthfulness (evaluatePrerequisiteNotice):
 *    - State A (0%): No prior communication attached ("No prior dispute ticket or notice attached").
 *    - State B (40%): Customer correspondence attached ("Customer correspondence attached (formal dispute ticket unverified)").
 *    - State C (60%): Notice document attached ("Notice document attached (delivery / service not independently established)").
 *    - State D (85%): Formal complaint ticket/acknowledgement attached ("Complaint acknowledgement / formal ticket attached").
 *    - Strict precedence: Highest verified communication state governs.
 * 3. Evidence-Gated Readiness Calculation (calculateCaseReadiness):
 *    - 0 evidence exhibits strictly prevents 'ready' tier and caps score <= 45%.
 *    - Arbitrary unmapped files cannot bypass readiness to unlock 'ready'.
 *    - Primary + secondary corroborating evidence properly unlocks 'ready' (score >= 80%).
 * 4. Respondent Entity Identification:
 *    - Prevents suspicious URLs from earning identity proof score.
 * 5. Case Hydration & Readiness Determinism:
 *    - Deterministic evaluation on initial mount, rehydration, and exhibit updates.
 *
 * Execution: Strictly offline. Zero external network, Gemini, or Supabase requests.
 */

import fs from 'fs';
import path from 'path';
import {
  isUrlOrDomainIndicator,
  isUnknownEntity,
  evaluatePrerequisiteNotice,
  calculateCaseReadiness,
} from '../src/components/CaseBuilder';
import { EvidenceItem } from '../src/types';
import { SAMPLE_TRUST_CHECK_RECORDS } from '../src/sampleData';

console.log('=== NivaranSetu Case Readiness Assessment (Step 3) Test Suite ===\n');

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

// Helper to create mock evidence items
function createMockEvidenceItem(overrides: Partial<EvidenceItem>): EvidenceItem {
  return {
    id: `ev-${Math.random().toString(36).slice(2, 7)}`,
    title: 'Evidence Exhibit',
    category: 'screenshot',
    fileName: 'exhibit.png',
    fileSize: '120 KB',
    fileType: 'image/png',
    uploadDate: '2026-11-10',
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    ocrExtracted: {
      dates: [],
      amounts: [],
      identifiers: [],
      parties: [],
      summary: 'Mock OCR summary text',
    },
    verifiedOriginal: true,
    ...overrides,
  };
}

// =========================================================================
// SECTION 1: URL & Domain Indicator Rejection (isUrlOrDomainIndicator)
// =========================================================================
console.log('--- Section 1: URL & Domain Indicator Rejection ---');

// 1.1 Full URLs with protocol
assert(
  isUrlOrDomainIndicator('https://fast-ebill-update.xyz/pay.apk') === true,
  '1.1a Rejects full HTTPS URL with APK path'
);
assert(
  isUrlOrDomainIndicator('http://scam-billing.net/login.php') === true,
  '1.1b Rejects HTTP URL'
);

// 1.2 Bare domains and domains with paths
assert(
  isUrlOrDomainIndicator('fast-ebill-update.xyz/pay.apk') === true,
  '1.2a Rejects bare domain with APK path'
);
assert(
  isUrlOrDomainIndicator('fast-ebill-update.xyz') === true,
  '1.2b Rejects bare domain without protocol'
);
assert(
  isUrlOrDomainIndicator('www.fake-discom.com') === true,
  '1.2c Rejects www domain prefix'
);
assert(
  isUrlOrDomainIndicator('scam-site.top') === true,
  '1.2d Rejects .top suspicious TLD'
);

// 1.3 Executable / APK file indicators
assert(
  isUrlOrDomainIndicator('pay.apk') === true,
  '1.3a Rejects standalone APK filename'
);
assert(
  isUrlOrDomainIndicator('malicious-installer.exe') === true,
  '1.3b Rejects Windows executable file indicator'
);

// 1.4 Legitimate entity names preserved
assert(
  isUrlOrDomainIndicator('Tata Power - DDL') === false,
  '1.4a Preserves legitimate utility entity "Tata Power - DDL"'
);
assert(
  isUrlOrDomainIndicator('State Bank of India') === false,
  '1.4b Preserves legitimate public sector bank "State Bank of India"'
);
assert(
  isUrlOrDomainIndicator('Flipkart India Pvt Ltd') === false,
  '1.4c Preserves corporate entity "Flipkart India Pvt Ltd"'
);
assert(
  isUrlOrDomainIndicator('BSES Rajdhani Power Ltd') === false,
  '1.4d Preserves discom name "BSES Rajdhani Power Ltd"'
);
assert(
  isUrlOrDomainIndicator('HDFC Bank Ltd.') === false,
  '1.4e Preserves bank name with period "HDFC Bank Ltd."'
);
assert(
  isUrlOrDomainIndicator('Airtel Payments Bank') === false,
  '1.4f Preserves payments bank "Airtel Payments Bank"'
);
assert(
  isUrlOrDomainIndicator('BSES') === false,
  '1.4g Preserves single-word utility acronym "BSES"'
);
assert(
  isUrlOrDomainIndicator('SBI') === false,
  '1.4h Preserves single-word bank acronym "SBI"'
);

// 1.5 Falsy & null safety
assert(
  isUrlOrDomainIndicator('') === false,
  '1.5a Safe on empty string'
);
assert(
  isUrlOrDomainIndicator(null as any) === false,
  '1.5b Safe on null'
);
assert(
  isUrlOrDomainIndicator(undefined as any) === false,
  '1.5c Safe on undefined'
);

// 1.6 Unknown entity detection (isUnknownEntity)
assert(
  isUnknownEntity('unknown') === true,
  '1.6a Identifies "unknown" as unverified entity'
);
assert(
  isUnknownEntity('Unknown') === true,
  '1.6b Case-insensitive: "Unknown" is recognized as unverified'
);
assert(
  isUnknownEntity('UNKNOWN') === true,
  '1.6c Case-insensitive: "UNKNOWN" is recognized as unverified'
);
assert(
  isUnknownEntity('unknown party') === true,
  '1.6d Identifies "unknown party" as unverified entity'
);
assert(
  isUnknownEntity('unspecified') === true,
  '1.6e Identifies "unspecified" as unverified entity'
);
assert(
  isUnknownEntity('opposite party') === true,
  '1.6f Identifies placeholder "opposite party" as unverified entity'
);
assert(
  isUnknownEntity('') === true,
  '1.6g Empty string evaluates as unknown entity'
);
assert(
  isUnknownEntity(null as any) === true,
  '1.6h Null evaluates as unknown entity'
);
assert(
  isUnknownEntity(undefined as any) === true,
  '1.6i Undefined evaluates as unknown entity'
);
assert(
  isUnknownEntity('Tata Power - DDL') === false,
  '1.6j Preserves legitimate entity "Tata Power - DDL" as valid'
);
assert(
  isUnknownEntity('State Bank of India') === false,
  '1.6k Preserves legitimate entity "State Bank of India" as valid'
);

// =========================================================================
// SECTION 2: Prerequisite Notice Truthfulness (evaluatePrerequisiteNotice)
// =========================================================================
console.log('\n--- Section 2: Prerequisite Notice Truthfulness (All 4 States) ---');

// 2.1 State A: No prior communication attached
const noticeResultEmpty = evaluatePrerequisiteNotice([]);
assert(
  noticeResultEmpty.state === 'none',
  '2.1a Empty exhibits evaluates to State A (none)',
  noticeResultEmpty.state,
  'none'
);
assert(
  noticeResultEmpty.score === 0,
  '2.1b Empty exhibits receives 0% prerequisite notice score',
  noticeResultEmpty.score,
  0
);
assert(
  noticeResultEmpty.note === 'No prior dispute ticket or notice attached',
  '2.1c Empty exhibits note is truthful: "No prior dispute ticket or notice attached"',
  noticeResultEmpty.note,
  'No prior dispute ticket or notice attached'
);

// 2.2 State A: Unrelated evidence attached (e.g. only receipt / screenshot)
const unrelatedItem = createMockEvidenceItem({
  category: 'receipt',
  title: 'UPI Transaction Receipt',
  fileName: 'upi_receipt_450.jpg',
});
const noticeResultUnrelated = evaluatePrerequisiteNotice([unrelatedItem]);
assert(
  noticeResultUnrelated.state === 'none' && noticeResultUnrelated.score === 0,
  '2.2 Unrelated payment receipt does NOT earn notice score (stays 0% State A)'
);

// 2.3 State B: Customer correspondence attached
const correspondenceItem = createMockEvidenceItem({
  category: 'correspondence',
  title: 'Customer Support Chat Transcript',
  fileName: 'chat_support.pdf',
});
const noticeResultB = evaluatePrerequisiteNotice([correspondenceItem]);
assert(
  noticeResultB.state === 'correspondence',
  '2.3a Customer correspondence evaluates to State B (correspondence)',
  noticeResultB.state,
  'correspondence'
);
assert(
  noticeResultB.score === 40,
  '2.3b Customer correspondence receives 40% prerequisite score',
  noticeResultB.score,
  40
);
assert(
  noticeResultB.note === 'Customer correspondence attached (formal dispute ticket unverified)',
  '2.3c State B note correctly reflects unverified formal ticket',
  noticeResultB.note,
  'Customer correspondence attached (formal dispute ticket unverified)'
);

// 2.4 State C: Notice document attached, delivery unverified
const noticeDocItem = createMockEvidenceItem({
  category: 'notice',
  title: 'Discom Disconnection Warning Notice',
  fileName: 'fake_disconnection_notice.pdf',
});
const noticeResultC = evaluatePrerequisiteNotice([noticeDocItem]);
assert(
  noticeResultC.state === 'notice',
  '2.4a Notice document evaluates to State C (notice)',
  noticeResultC.state,
  'notice'
);
assert(
  noticeResultC.score === 60,
  '2.4b Notice document receives 60% prerequisite score (not 85%)',
  noticeResultC.score,
  60
);
assert(
  noticeResultC.note === 'Notice document attached (delivery / service not independently established)',
  '2.4c State C note truthfully states delivery/service not independently established',
  noticeResultC.note,
  'Notice document attached (delivery / service not independently established)'
);

// 2.5 State D: Formal complaint acknowledgement / ticket attached
const ticketItem = createMockEvidenceItem({
  category: 'correspondence',
  title: 'Bank Dispute Grievance Acknowledgement',
  fileName: 'bank_acknowledgement.pdf',
  claimMappedTo: 'rec_bank_complaint',
});
const noticeResultD = evaluatePrerequisiteNotice([ticketItem]);
assert(
  noticeResultD.state === 'complaint_ticket',
  '2.5a Mapped bank complaint evaluates to State D (complaint_ticket)',
  noticeResultD.state,
  'complaint_ticket'
);
assert(
  noticeResultD.score === 85,
  '2.5b Formal complaint ticket receives 85% prerequisite score',
  noticeResultD.score,
  85
);
assert(
  noticeResultD.note === 'Complaint acknowledgement / formal ticket attached',
  '2.5c State D note accurately describes formal ticket attached',
  noticeResultD.note,
  'Complaint acknowledgement / formal ticket attached'
);

// 2.6 Precedence: Ticket (State D) overrides generic Notice (State C)
const multiNoticeList = [noticeDocItem, ticketItem];
const noticeResultPrecedence = evaluatePrerequisiteNotice(multiNoticeList);
assert(
  noticeResultPrecedence.state === 'complaint_ticket' && noticeResultPrecedence.score === 85,
  '2.6 When both notice doc and complaint ticket exist, highest verified State D (85%) governs'
);

// 2.7 Keyword fallback: Ticket number in title/summary reaches State D
const keywordTicketItem = createMockEvidenceItem({
  category: 'correspondence',
  title: 'Telecom Docket Escalation Acknowledgement',
  fileName: 'docket_123456.png',
});
const noticeResultKeyword = evaluatePrerequisiteNotice([keywordTicketItem]);
assert(
  noticeResultKeyword.state === 'complaint_ticket',
  '2.7 Docket / ticket keywords in title/fileName evaluate to State D'
);

// =========================================================================
// SECTION 3: Evidence-Gated Readiness Calculation (calculateCaseReadiness)
// =========================================================================
console.log('\n--- Section 3: Evidence-Gated Readiness Calculation ---');

// 3.1 Browser Test Scenario Baseline (0 exhibits)
const baselineTestScenario = calculateCaseReadiness({
  description:
    'Citizen received an urgent SMS threatening electricity disconnection unless payment was completed via APK link https://fast-ebill-update.xyz/pay.apk. Disputed loss of INR 450.',
  involvedEntity: 'Tata Power - DDL',
  incidentDate: '2026-11-10',
  disputedAmount: 450,
  evidenceList: [],
});

assert(
  baselineTestScenario.breakdown.evidenceCompleteness === 0,
  '3.1a Evidence completeness is strictly 0% when 0 exhibits exist',
  baselineTestScenario.breakdown.evidenceCompleteness,
  0
);
assert(
  baselineTestScenario.breakdown.formalNoticeSent === 0,
  '3.1b Prerequisite notice score is strictly 0% when 0 exhibits exist',
  baselineTestScenario.breakdown.formalNoticeSent,
  0
);
assert(
  baselineTestScenario.score <= 45,
  '3.1c Overall readiness score cannot exceed 45% with 0 exhibits (got ' + baselineTestScenario.score + '%)',
  baselineTestScenario.score,
  45
);
assert(
  baselineTestScenario.tier === 'incomplete',
  '3.1d Case with 0 exhibits is strictly marked "incomplete" (never "ready")',
  baselineTestScenario.tier,
  'incomplete'
);

// 3.2 URL as Respondent Entity Protection
const urlEntityScenario = calculateCaseReadiness({
  description:
    'Citizen received an urgent SMS threatening electricity disconnection unless payment was completed via APK link https://fast-ebill-update.xyz/pay.apk. Disputed loss of INR 450.',
  involvedEntity: 'https://fast-ebill-update.xyz/pay.apk',
  incidentDate: '2026-11-10',
  disputedAmount: 450,
  evidenceList: [],
});

assert(
  urlEntityScenario.breakdown.identityProof === 0,
  '3.2a URL entered as involvedEntity yields 0% identity proof score',
  urlEntityScenario.breakdown.identityProof,
  0
);
assert(
  urlEntityScenario.score <= 25,
  '3.2b Overall readiness score with URL entity and 0 evidence drops to <= 25% (got ' + urlEntityScenario.score + '%)',
  urlEntityScenario.score,
  25
);

// 3.2c Unknown Entity yields 0% identification credit
const unknownEntityScenario = calculateCaseReadiness({
  description:
    'Citizen received an urgent SMS threatening electricity disconnection unless payment was completed via APK link https://fast-ebill-update.xyz/pay.apk. Disputed loss of INR 450.',
  involvedEntity: 'unknown',
  incidentDate: '2026-11-10',
  disputedAmount: 450,
  evidenceList: [],
});

assert(
  unknownEntityScenario.breakdown.identityProof === 0,
  '3.2c Respondent "unknown" strictly yields 0% identity proof score',
  unknownEntityScenario.breakdown.identityProof,
  0
);
assert(
  unknownEntityScenario.score <= 25,
  '3.2d Overall score with unknown respondent and 0 exhibits drops to <= 25% (got ' + unknownEntityScenario.score + '%)',
  unknownEntityScenario.score,
  25
);
assert(
  unknownEntityScenario.tier === 'incomplete',
  '3.2e Tier remains strictly "incomplete" when respondent is unknown with 0 exhibits'
);

// 3.2f Unknown Respondent cannot unlock 'ready' tier even with 2 mapped exhibits
const unknownWithFullEvidenceScenario = calculateCaseReadiness({
  description: 'Detailed grievance incident statement with extensive narrative regarding fraudulent transaction.',
  involvedEntity: 'unknown',
  incidentDate: '2026-11-10',
  disputedAmount: 450,
  evidenceList: [
    createMockEvidenceItem({
      category: 'receipt',
      title: 'Bank Statement / Payment Receipt',
      fileName: 'bank_statement.pdf',
      claimMappedTo: 'rec_bank_statement',
    }),
    createMockEvidenceItem({
      category: 'correspondence',
      title: 'Bank Formal Grievance Acknowledgement',
      fileName: 'bank_acknowledgement.pdf',
      claimMappedTo: 'rec_bank_complaint',
    }),
  ],
});

assert(
  unknownWithFullEvidenceScenario.breakdown.identityProof === 0,
  '3.2f Full evidence case with unknown respondent has 0% identity credit'
);
assert(
  unknownWithFullEvidenceScenario.score === 74,
  '3.2g Full evidence case with unknown respondent caps at 74% (cannot reach 80%)',
  unknownWithFullEvidenceScenario.score,
  74
);
assert(
  unknownWithFullEvidenceScenario.tier === 'needs_info',
  '3.2h Full evidence case with unknown respondent remains "needs_info" (cannot unlock "ready")'
);

// 3.3 Anti-Bypass Guard: 2 Arbitrary Unmapped Screenshots cannot unlock 'ready'
const arbitraryExhibits = [
  createMockEvidenceItem({ category: 'screenshot', title: 'Random Photo 1', fileName: 'photo1.jpg' }),
  createMockEvidenceItem({ category: 'screenshot', title: 'Random Photo 2', fileName: 'photo2.jpg' }),
];
const arbitraryScenario = calculateCaseReadiness({
  description: 'Detailed grievance incident statement with extensive narrative regarding fraudulent transaction.',
  involvedEntity: 'State Bank of India',
  incidentDate: '2026-11-10',
  disputedAmount: 450,
  evidenceList: arbitraryExhibits,
});

assert(
  arbitraryScenario.score < 80,
  '3.3a Arbitrary unmapped screenshots without dispute notice cannot reach 80% (got ' + arbitraryScenario.score + '%)'
);
assert(
  arbitraryScenario.tier === 'needs_info',
  '3.3b Arbitrary unmapped screenshots cannot unlock "ready" tier (got ' + arbitraryScenario.tier + ')'
);

// 3.4 Single Primary Mapped Evidence Exhibit
const singlePrimaryExhibit = [
  createMockEvidenceItem({
    category: 'screenshot',
    title: 'Original SMS Threat Screenshot',
    fileName: 'sms_threat.png',
    claimMappedTo: 'rec_sms_screenshot',
  }),
];
const singlePrimaryScenario = calculateCaseReadiness({
  description: 'Detailed grievance incident statement with extensive narrative regarding fraudulent transaction.',
  involvedEntity: 'Tata Power - DDL',
  incidentDate: '2026-11-10',
  disputedAmount: 450,
  evidenceList: singlePrimaryExhibit,
});

assert(
  singlePrimaryScenario.breakdown.evidenceCompleteness === 45,
  '3.4a Single mapped primary exhibit provides 45% evidence completeness',
  singlePrimaryScenario.breakdown.evidenceCompleteness,
  45
);
assert(
  singlePrimaryScenario.score >= 50 && singlePrimaryScenario.score < 80,
  '3.4b Single primary exhibit earns 50-79% score (got ' + singlePrimaryScenario.score + '%)'
);
assert(
  singlePrimaryScenario.tier === 'needs_info',
  '3.4c Single primary exhibit advances tier to "needs_info" (awaiting corroborating notice)'
);

// 3.5 Fully Prepared Case: Primary Evidence + Complaint Ticket Acknowledgement
const fullyPreparedExhibits = [
  createMockEvidenceItem({
    category: 'receipt',
    title: 'Bank Statement / Payment Receipt',
    fileName: 'bank_statement.pdf',
    claimMappedTo: 'rec_bank_statement',
  }),
  createMockEvidenceItem({
    category: 'correspondence',
    title: 'Bank Formal Grievance Acknowledgement',
    fileName: 'bank_acknowledgement.pdf',
    claimMappedTo: 'rec_bank_complaint',
  }),
];
const fullyPreparedScenario = calculateCaseReadiness({
  description: 'Detailed grievance incident statement with extensive narrative regarding fraudulent transaction.',
  involvedEntity: 'Tata Power - DDL',
  incidentDate: '2026-11-10',
  disputedAmount: 450,
  evidenceList: fullyPreparedExhibits,
});

assert(
  fullyPreparedScenario.breakdown.evidenceCompleteness === 90,
  '3.5a Two mapped exhibits achieve 90% evidence completeness',
  fullyPreparedScenario.breakdown.evidenceCompleteness,
  90
);
assert(
  fullyPreparedScenario.breakdown.formalNoticeSent === 85,
  '3.5b Prerequisite notice reflects 85% formal ticket acknowledgement',
  fullyPreparedScenario.breakdown.formalNoticeSent,
  85
);
assert(
  fullyPreparedScenario.score >= 80,
  '3.5c Fully prepared case achieves >= 80% readiness score (got ' + fullyPreparedScenario.score + '%)'
);
assert(
  fullyPreparedScenario.tier === 'ready',
  '3.5d Fully prepared case unlocks "ready" tier'
);

// =========================================================================
// SECTION 4: Hydration & Deterministic Assessment
// =========================================================================
console.log('\n--- Section 4: Hydration & Deterministic Assessment ---');

// 4.1 Rehydrating empty case is consistent across multiple calculations
const run1 = calculateCaseReadiness({
  description: 'Disputed transaction incident description.',
  involvedEntity: 'State Bank of India',
  incidentDate: '2026-11-10',
  disputedAmount: 5000,
  evidenceList: [],
});
const run2 = calculateCaseReadiness({
  description: 'Disputed transaction incident description.',
  involvedEntity: 'State Bank of India',
  incidentDate: '2026-11-10',
  disputedAmount: 5000,
  evidenceList: [],
});

assert(
  run1.score === run2.score && run1.tier === run2.tier,
  '4.1 Readiness calculation is strictly deterministic across runs'
);
assert(
  run1.tier === 'incomplete',
  '4.2 Rehydrated case with zero exhibits remains strictly "incomplete"'
);

// 4.3 Rehydrated case with sanitized involvedEntity
const runSanitized = calculateCaseReadiness({
  description: 'Disputed transaction incident description.',
  involvedEntity: '', // After sanitization of URL
  incidentDate: '2026-11-10',
  disputedAmount: 5000,
  evidenceList: [],
});

assert(
  runSanitized.breakdown.identityProof === 0,
  '4.3 Sanitized empty entity correctly reports 0% identity proof'
);

// =========================================================================
// SECTION 5: TrustCheck Provenance & Truthfulness Verification
// =========================================================================
console.log('\n--- Section 5: TrustCheck Provenance & Truthfulness Verification ---');

// 5.1 Verification of tc-3 (fast-ebill-update.xyz/pay.apk) in SAMPLE_TRUST_CHECK_RECORDS
const tc3Record = SAMPLE_TRUST_CHECK_RECORDS.find((r) => r.id === 'tc-3');
assert(Boolean(tc3Record), '5.1a tc-3 record exists in SAMPLE_TRUST_CHECK_RECORDS');

if (tc3Record) {
  assert(
    tc3Record.input === 'https://fast-ebill-update.xyz/pay.apk',
    '5.1b tc-3 preserves the original test APK URL',
    tc3Record.input,
    'https://fast-ebill-update.xyz/pay.apk'
  );
  assert(
    tc3Record.riskLevel === 'high_risk',
    '5.1c tc-3 preserves high_risk classification',
    tc3Record.riskLevel,
    'high_risk'
  );
  assert(
    tc3Record.type === 'url',
    '5.1d tc-3 type is "url"',
    tc3Record.type,
    'url'
  );
  assert(
    tc3Record.resultStatus === 'Adverse catalog match',
    '5.1e tc-3 resultStatus reflects catalog match rather than verified government finding',
    tc3Record.resultStatus,
    'Adverse catalog match'
  );
  assert(
    tc3Record.description.includes('Pre-compiled illustrative pattern-catalog reference') &&
      tc3Record.description.includes('not a live police or government database lookup'),
    '5.1f tc-3 description clearly discloses offline illustrative pattern nature'
  );

  const officialFindingsJoined = (tc3Record.officialFindings || []).join(' ');
  assert(
    !officialFindingsJoined.includes('CERT-In Alert CIET-2026-0419'),
    '5.1g tc-3 removes fabricated CERT-In alert CIET-2026-0419 identifier'
  );
  assert(
    !officialFindingsJoined.includes('Google Play Protect blacklisted'),
    '5.1h tc-3 removes fabricated Google Play Protect blacklisted claim'
  );
  assert(
    officialFindingsJoined.includes('Illustrative catalog pattern') &&
      officialFindingsJoined.includes('General advisory awareness'),
    '5.1i tc-3 officialFindings truthfully cites illustrative catalog markers and general public caution'
  );

  const sourceReferencesJoined = (tc3Record.sourceReferences || []).join(' ');
  assert(
    !sourceReferencesJoined.includes('Malware Signature Registry'),
    '5.1j tc-3 sourceReferences removes fabricated malware signature registry claim'
  );
  assert(
    sourceReferencesJoined.includes('Curated Threat Pattern Catalog') &&
      sourceReferencesJoined.includes('General Guidance'),
    '5.1k tc-3 sourceReferences truthfully cites curated threat pattern catalog'
  );

  assert(
    Boolean(tc3Record.governmentAdvisories?.[0]?.title.includes('General Public Guidance')),
    '5.1l tc-3 advisory title clarifies general public guidance'
  );
}

// 5.2 Verification of TrustCheck UI templates
const trustCheckFileContent = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/TrustCheck.tsx'),
  'utf-8'
);

assert(
  trustCheckFileContent.includes('Try illustrative test patterns:'),
  '5.2a TrustCheck UI displays "Try illustrative test patterns:" preset label'
);
assert(
  trustCheckFileContent.includes('Public Safety Portals (General Guidance & Awareness)'),
  '5.2b TrustCheck UI features "Public Safety Portals (General Guidance & Awareness)" heading'
);
assert(
  trustCheckFileContent.includes(
    'Reference to a public safety portal does not establish that this specific identifier or URL was investigated or blacklisted by the authority'
  ),
  '5.2c TrustCheck UI explains that portal links do NOT establish specific URL investigation or blacklisting'
);
assert(
  trustCheckFileContent.includes(
    'Offline Catalog Reference · Not a live police or government DB lookup'
  ),
  '5.2d TrustCheck UI displays explicit offline catalog provenance pill for catalog items'
);

// =========================================================================
// SECTION 6: Unknown Respondent & Workflow Unblocking Verification
// =========================================================================
console.log('\n--- Section 6: Unknown Respondent & Workflow Unblocking ---');

// 6.1 Readiness score and tier behavior with unknown respondent
const unknownRespondentFullEvidence = calculateCaseReadiness({
  description: 'Complainant was deceived into downloading an APK from an unverified utility update message.',
  involvedEntity: 'unknown',
  incidentDate: '2026-11-06',
  disputedAmount: 42500,
  evidenceList: [
    createMockEvidenceItem({
      id: 'ev-1',
      title: 'SMS Threat Message',
      category: 'notice',
      claimMappedTo: 'rec_sms_screenshot',
    }),
    createMockEvidenceItem({
      id: 'ev-2',
      title: 'Police Complaint Docket Acknowledgement Slip',
      category: 'notice',
      claimMappedTo: 'rec_bank_complaint',
    }),
  ],
});

assert(
  unknownRespondentFullEvidence.breakdown.identityProof === 0,
  '6.1a Unknown respondent receives strictly 0% Entity Identification credit',
  unknownRespondentFullEvidence.breakdown.identityProof,
  0
);
assert(
  unknownRespondentFullEvidence.score === 74,
  '6.1b Unknown respondent caps readiness score at 74% with full evidence and notice',
  unknownRespondentFullEvidence.score,
  74
);
assert(
  unknownRespondentFullEvidence.tier === 'needs_info',
  '6.1c Unknown respondent keeps tier at "needs_info" (does NOT unlock "ready")',
  unknownRespondentFullEvidence.tier,
  'needs_info'
);
assert(
  ['ready', 'needs_info', 'incomplete'].includes(unknownRespondentFullEvidence.tier),
  '6.1d Tier strictly adheres to existing enum without inventing an unapproved "factual_ready" tier'
);

// 6.2 CaseBuilder UI template verification
const caseBuilderFileContent = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/CaseBuilder.tsx'),
  'utf-8'
);

assert(
  caseBuilderFileContent.includes('⚠ Needs Info · Respondent Unidentified'),
  '6.2a CaseBuilder UI renders "⚠ Needs Info · Respondent Unidentified" status badge when entity is unknown'
);
assert(
  caseBuilderFileContent.includes(
    'Factual details are recorded. The respondent is unidentified and can be determined later — this does not prevent you from continuing.'
  ),
  '6.2b CaseBuilder UI clarifies that unknown respondent does not prevent citizen from continuing'
);
assert(
  caseBuilderFileContent.includes(
    'Identify legal respondent (bank, utility, or company) when known (can be determined later; does not block drafting)'
  ),
  '6.2c CaseBuilder Recommended Next Steps explains respondent can be determined later and does not block drafting'
);
assert(
  !caseBuilderFileContent.includes('• Opposite party identity pending / unknown (0% credit)</li>'),
  '6.2d CaseBuilder Completed Requirements omits pending opposite party from completed checklist'
);

// =========================================================================
// SUMMARY
// =========================================================================
console.log('\n------------------------------------------------------------');
console.log(`Case Readiness Assessment Suite: ${passedCount} passed, ${failedCount} failed`);
console.log('------------------------------------------------------------\n');

if (failedCount > 0) {
  process.exit(1);
}
