/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — TrustCheck Classification, Badges, and Truthful Advisory Test Suite
 *
 * Scope:
 * - 1. Classification & Heuristic Boundaries:
 *      - Confirms removal of broad 'care' from HIGH_RISK.
 *      - Confirms 'customer-care-support.xyz' is classified as SUSPICIOUS.
 *      - Preserves high-risk classification for malware/payload vectors (.apk, urgent, disconnect, refund).
 *      - Preserves suspicious classification for handle impersonation (care, support, help, .xyz, .top, http).
 *      - Preserves low-risk classification for unflagged identifiers.
 * - 2. Curated Catalog vs Heuristic Inputs:
 *      - Verifies the 4 standard browser test identifiers:
 *        * refund-desk99@oksbi (HIGH RISK, catalog)
 *        * https://fast-ebill-update.xyz/pay.apk (HIGH RISK, catalog)
 *        * support-claims@refunds-portal.in (SUSPICIOUS, catalog)
 *        * quickbazaar.verified@icici (LOW RISK, catalog)
 * - 3. Risk Badges & source of truth:
 *      - Confirms HIGH RISK renders in red with pulsing indicator.
 *      - Confirms SUSPICIOUS renders in amber with static indicator.
 *      - Confirms LOW RISK renders in green with static indicator.
 *      - Confirms riskLevel enum is the strict source of truth.
 * - 4. Truthfulness & Observation Separation:
 *      - Confirms heuristic matches are flagged with isAiObservation = true.
 *      - Confirms heuristic matches never claim official police or 1930 Cybercrime Portal findings.
 *      - Confirms absence of match warning is preserved for low-risk results.
 *
 * Execution: Strictly offline. Zero external network, Gemini, or Supabase requests.
 */

import {
  evaluateTrustCheckInput,
  getTrustCheckBadgeConfig,
  getTrustCheckSourceLabel,
} from '../src/components/TrustCheck';
import { SAMPLE_TRUST_CHECK_RECORDS } from '../src/sampleData';

console.log('=== NivaranSetu TrustCheck Classification, Badge & Truthfulness Suite ===\n');

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

// =========================================================================
// SECTION 1: Reproduction Issue — 'customer-care-support.xyz'
// =========================================================================
console.log('\n--- Section 1: Browser E2E Reproduction Identifier ---');

const reproResult = evaluateTrustCheckInput('customer-care-support.xyz', 'url');

assert(
  reproResult.riskLevel === 'suspicious',
  'Reproduction: customer-care-support.xyz is classified as SUSPICIOUS (not high_risk)',
  reproResult.riskLevel,
  'suspicious'
);

assert(
  reproResult.resultStatus === 'Suspicious indicator',
  'Reproduction: customer-care-support.xyz has status "Suspicious indicator"',
  reproResult.resultStatus,
  'Suspicious indicator'
);

assert(
  reproResult.isAiObservation === true,
  'Reproduction: customer-care-support.xyz is labeled as an AI Heuristic Observation (isAiObservation = true)',
  reproResult.isAiObservation,
  true
);

const badgeRepro = getTrustCheckBadgeConfig(reproResult.riskLevel, reproResult.resultStatus);
assert(
  badgeRepro.text === 'SUSPICIOUS',
  'Reproduction: Badge text is SUSPICIOUS',
  badgeRepro.text,
  'SUSPICIOUS'
);
assert(
  badgeRepro.badgeClass.includes('bg-amber-100') && badgeRepro.badgeClass.includes('text-amber-800'),
  'Reproduction: Badge uses amber styling',
  badgeRepro.badgeClass,
  'amber styling'
);
assert(
  badgeRepro.pulseDot === false,
  'Reproduction: Amber badge does not pulse',
  badgeRepro.pulseDot,
  false
);

// Check truthfulness for customer-care-support.xyz
const reproFindingsJoined = (reproResult.officialFindings || []).join(' ');
assert(
  !reproFindingsJoined.includes('1930') && !reproFindingsJoined.includes('cybercrime portal'),
  'Reproduction: Findings do not claim official 1930 Cybercrime Portal filing',
  reproFindingsJoined,
  'No 1930 claim'
);
assert(
  reproResult.description.includes('algorithmic heuristics') || reproResult.description.includes('heuristic scanner'),
  'Reproduction: Description clearly discloses heuristic observation nature',
  reproResult.description,
  'heuristic disclosure'
);

const sourceLabelRepro = getTrustCheckSourceLabel(reproResult);
assert(
  sourceLabelRepro.text === 'AI Heuristic Observation',
  'Reproduction: Source label is "AI Heuristic Observation"',
  sourceLabelRepro.text,
  'AI Heuristic Observation'
);

// =========================================================================
// SECTION 2: Browser Test Identifiers (Curated Catalog)
// =========================================================================
console.log('\n--- Section 2: Browser Test Identifiers from Catalog ---');

// Test Identifier 1: refund-desk99@oksbi (HIGH_RISK)
const id1 = evaluateTrustCheckInput('refund-desk99@oksbi', 'upi');
assert(
  id1.riskLevel === 'high_risk',
  'Catalog ID 1: refund-desk99@oksbi is HIGH RISK',
  id1.riskLevel,
  'high_risk'
);
assert(
  id1.isAiObservation === false,
  'Catalog ID 1: Curated catalog match has verified source (isAiObservation = false)',
  id1.isAiObservation,
  false
);
const badgeId1 = getTrustCheckBadgeConfig(id1.riskLevel, id1.resultStatus);
assert(
  badgeId1.text === 'HIGH RISK',
  'Catalog ID 1: Badge text is HIGH RISK',
  badgeId1.text,
  'HIGH RISK'
);
assert(
  badgeId1.badgeClass.includes('bg-red-100') && badgeId1.badgeClass.includes('text-red-700'),
  'Catalog ID 1: Badge uses red styling',
  badgeId1.badgeClass,
  'red styling'
);
assert(
  badgeId1.pulseDot === true,
  'Catalog ID 1: High risk badge pulses',
  badgeId1.pulseDot,
  true
);
const sourceLabelId1 = getTrustCheckSourceLabel(id1);
assert(
  sourceLabelId1.text === 'Curated Catalog Match',
  'Catalog ID 1: Source label is "Curated Catalog Match" (not Official Public Advisory Finding)',
  sourceLabelId1.text,
  'Curated Catalog Match'
);
assert(
  !sourceLabelId1.text.includes('Official'),
  'Catalog ID 1: Source label does not claim official authority finding',
  sourceLabelId1.text,
  'No "Official" in label'
);

// Test Identifier 2: https://fast-ebill-update.xyz/pay.apk (HIGH_RISK)
const id2 = evaluateTrustCheckInput('https://fast-ebill-update.xyz/pay.apk', 'url');
assert(
  id2.riskLevel === 'high_risk',
  'Catalog ID 2: https://fast-ebill-update.xyz/pay.apk is HIGH RISK',
  id2.riskLevel,
  'high_risk'
);
assert(
  id2.isAiObservation === false,
  'Catalog ID 2: Curated catalog match has verified CERT-In source (isAiObservation = false)',
  id2.isAiObservation,
  false
);
const badgeId2 = getTrustCheckBadgeConfig(id2.riskLevel, id2.resultStatus);
assert(
  badgeId2.text === 'HIGH RISK',
  'Catalog ID 2: Badge text is HIGH RISK',
  badgeId2.text,
  'HIGH RISK'
);
assert(
  badgeId2.badgeClass.includes('bg-red-100'),
  'Catalog ID 2: Badge uses red styling',
  badgeId2.badgeClass,
  'red styling'
);
const sourceLabelId2 = getTrustCheckSourceLabel(id2);
assert(
  sourceLabelId2.text === 'Curated Catalog Match',
  'Catalog ID 2: Source label is "Curated Catalog Match"',
  sourceLabelId2.text,
  'Curated Catalog Match'
);
assert(
  !sourceLabelId2.text.includes('Official'),
  'Catalog ID 2: Source label does not claim official authority finding',
  sourceLabelId2.text,
  'No "Official" in label'
);

// Test Identifier 3: support-claims@refunds-portal.in (SUSPICIOUS)
const id3 = evaluateTrustCheckInput('support-claims@refunds-portal.in', 'email');
assert(
  id3.riskLevel === 'suspicious',
  'Catalog ID 3: support-claims@refunds-portal.in is SUSPICIOUS',
  id3.riskLevel,
  'suspicious'
);
const badgeId3 = getTrustCheckBadgeConfig(id3.riskLevel, id3.resultStatus);
assert(
  badgeId3.text === 'SUSPICIOUS',
  'Catalog ID 3: Badge text is SUSPICIOUS',
  badgeId3.text,
  'SUSPICIOUS'
);
assert(
  badgeId3.badgeClass.includes('bg-amber-100'),
  'Catalog ID 3: Badge uses amber styling',
  badgeId3.badgeClass,
  'amber styling'
);
const sourceLabelId3 = getTrustCheckSourceLabel(id3);
assert(
  sourceLabelId3.text === 'AI Heuristic Observation',
  'Catalog ID 3: Source label is "AI Heuristic Observation"',
  sourceLabelId3.text,
  'AI Heuristic Observation'
);

// Test Identifier 4: quickbazaar.verified@icici (LOW_RISK)
const id4 = evaluateTrustCheckInput('quickbazaar.verified@icici', 'upi');
assert(
  id4.riskLevel === 'low_risk',
  'Catalog ID 4: quickbazaar.verified@icici is LOW RISK',
  id4.riskLevel,
  'low_risk'
);
const badgeId4 = getTrustCheckBadgeConfig(id4.riskLevel, id4.resultStatus);
assert(
  badgeId4.text === 'LOW RISK',
  'Catalog ID 4: Badge text is LOW RISK',
  badgeId4.text,
  'LOW RISK'
);
assert(
  badgeId4.badgeClass.includes('bg-emerald-100') && badgeId4.badgeClass.includes('text-emerald-700'),
  'Catalog ID 4: Badge uses green/emerald styling',
  badgeId4.badgeClass,
  'emerald styling'
);
assert(
  id4.description.includes('absence of adverse record does not guarantee safety'),
  'Catalog ID 4: Preserves absence of adverse record caution notice',
  id4.description,
  'safety caution'
);
const sourceLabelId4 = getTrustCheckSourceLabel(id4);
assert(
  sourceLabelId4.text === 'Curated Catalog Check',
  'Catalog ID 4: Source label is "Curated Catalog Check" (never "Official Public Advisory Finding")',
  sourceLabelId4.text,
  'Curated Catalog Check'
);
assert(
  !sourceLabelId4.text.includes('Official'),
  'Catalog ID 4: Source label does not contain "Official"',
  sourceLabelId4.text,
  'No "Official" in label'
);

// =========================================================================
// SECTION 3: Heuristic Classification & Risk Boundaries
// =========================================================================
console.log('\n--- Section 3: Non-Catalog Heuristic Evaluation ---');

// Heuristic High Risk: APK delivery
const apkResult = evaluateTrustCheckInput('https://unknown-domain-update.com/download.apk', 'url');
assert(
  apkResult.riskLevel === 'high_risk',
  'Heuristic: .apk payload triggers HIGH RISK',
  apkResult.riskLevel,
  'high_risk'
);
assert(
  apkResult.isAiObservation === true,
  'Heuristic: Non-catalog high risk is truthfully flagged as isAiObservation = true',
  apkResult.isAiObservation,
  true
);
const apkBadge = getTrustCheckBadgeConfig(apkResult.riskLevel, apkResult.resultStatus);
assert(
  apkBadge.text === 'HIGH RISK' && apkBadge.badgeClass.includes('bg-red-100'),
  'Heuristic: High risk badge renders HIGH RISK in red',
  apkBadge.text,
  'HIGH RISK'
);
const apkFindingsJoined = (apkResult.officialFindings || []).join(' ');
assert(
  !apkFindingsJoined.includes('1930'),
  'Heuristic: High risk match does not falsely claim 1930 Cybercrime Portal reporting',
  apkFindingsJoined,
  'no 1930 claim'
);

// Heuristic High Risk: Urgent Disconnection threats
const discomResult = evaluateTrustCheckInput('power-bill-urgent-disconnect-helpdesk', 'other');
assert(
  discomResult.riskLevel === 'high_risk',
  'Heuristic: urgent + disconnect triggers HIGH RISK',
  discomResult.riskLevel,
  'high_risk'
);
assert(
  discomResult.isAiObservation === true,
  'Heuristic: urgent disconnection heuristic is flagged as isAiObservation = true',
  discomResult.isAiObservation,
  true
);

// Heuristic Suspicious: Other customer-care variations
const careResult1 = evaluateTrustCheckInput('airtel-customer-care.xyz', 'url');
assert(
  careResult1.riskLevel === 'suspicious',
  'Heuristic: airtel-customer-care.xyz is classified as SUSPICIOUS (not high_risk)',
  careResult1.riskLevel,
  'suspicious'
);

const helpResult = evaluateTrustCheckInput('amazon-delivery-help.top', 'url');
assert(
  helpResult.riskLevel === 'suspicious',
  'Heuristic: .top domain with "help" is classified as SUSPICIOUS',
  helpResult.riskLevel,
  'suspicious'
);

// Heuristic Low Risk: Non-matching innocent identifier
const benignResult = evaluateTrustCheckInput('grocery-mart-official-store', 'other');
assert(
  benignResult.riskLevel === 'low_risk',
  'Heuristic: Innocent handle is classified as LOW RISK',
  benignResult.riskLevel,
  'low_risk'
);
assert(
  benignResult.isAiObservation === true,
  'Heuristic: Non-catalog low-risk is labeled as isAiObservation = true',
  benignResult.isAiObservation,
  true
);
const benignBadge = getTrustCheckBadgeConfig(benignResult.riskLevel, benignResult.resultStatus);
assert(
  benignBadge.text === 'LOW RISK' && benignBadge.badgeClass.includes('bg-emerald-100'),
  'Heuristic: Low risk badge renders LOW RISK in green',
  benignBadge.text,
  'LOW RISK'
);
assert(
  benignResult.description.includes('absence of records does not confirm the entity is authentic'),
  'Heuristic: Low risk description preserves transparency warning',
  benignResult.description,
  'absence warning'
);

// =========================================================================
// SECTION 4: Badge Source of Truth & Palette Mapping
// =========================================================================
console.log('\n--- Section 4: Badge Configuration & Source of Truth ---');

// Direct riskLevel mappings
const highConfig = getTrustCheckBadgeConfig('high_risk');
assert(
  highConfig.text === 'HIGH RISK' && highConfig.badgeClass.includes('bg-red-100') && highConfig.pulseDot === true,
  'Badge: high_risk maps to red HIGH RISK with pulse',
  highConfig.text,
  'HIGH RISK'
);

const suspConfig = getTrustCheckBadgeConfig('suspicious');
assert(
  suspConfig.text === 'SUSPICIOUS' && suspConfig.badgeClass.includes('bg-amber-100') && suspConfig.pulseDot === false,
  'Badge: suspicious maps to amber SUSPICIOUS without pulse',
  suspConfig.text,
  'SUSPICIOUS'
);

const lowConfig = getTrustCheckBadgeConfig('low_risk');
assert(
  lowConfig.text === 'LOW RISK' && lowConfig.badgeClass.includes('bg-emerald-100') && lowConfig.pulseDot === false,
  'Badge: low_risk maps to green LOW RISK without pulse',
  lowConfig.text,
  'LOW RISK'
);

const verifiedConfig = getTrustCheckBadgeConfig('verified');
assert(
  verifiedConfig.text === 'LOW RISK' && verifiedConfig.badgeClass.includes('bg-emerald-100'),
  'Badge: verified maps to green badge',
  verifiedConfig.text,
  'LOW RISK'
);

// Precedence test: riskLevel enum overrides resultStatus text
const precedenceConfig = getTrustCheckBadgeConfig('suspicious', 'Verified adverse match');
assert(
  precedenceConfig.text === 'SUSPICIOUS' && precedenceConfig.badgeClass.includes('bg-amber-100'),
  'Badge Precedence: riskLevel enum ("suspicious") takes strict precedence over fallback status',
  precedenceConfig.text,
  'SUSPICIOUS'
);

// =========================================================================
// SECTION 5: Truthful Source Labels & Synthetic Reference Elimination
// =========================================================================
console.log('\n--- Section 5: Truthful Source Labels & Synthetic Reference Elimination ---');

// 1. Verify absence of synthetic government notice numbers across all catalog records
let hasSyntheticDocketNotice = false;
let hasLive1930FilingClaim = false;
let anyYieldsOfficialFindingLabel = false;

for (const record of SAMPLE_TRUST_CHECK_RECORDS) {
  const jsonStr = JSON.stringify(record);
  if (jsonStr.includes('#2026-CYBER-DISCOM') || jsonStr.includes('CIET-2026-0419') || jsonStr.includes('#2026-')) {
    hasSyntheticDocketNotice = true;
  }
  if (jsonStr.includes('Reported directly on 1930 Cybercrime Portal as active case')) {
    hasLive1930FilingClaim = true;
  }
  const label = getTrustCheckSourceLabel(record);
  if (label.text === 'Official Public Advisory Finding' || label.text.includes('Official Public Advisory')) {
    anyYieldsOfficialFindingLabel = true;
  }
}

assert(
  !hasSyntheticDocketNotice,
  'Catalog Integrity: Zero synthetic notice codes (#2026-CYBER-DISCOM, CIET-2026-0419) in sample records',
  hasSyntheticDocketNotice,
  false
);

assert(
  !hasLive1930FilingClaim,
  'Catalog Integrity: Zero unverified claims of direct 1930 Cybercrime Portal active filings',
  hasLive1930FilingClaim,
  false
);

assert(
  !anyYieldsOfficialFindingLabel,
  'Source Label Truthfulness: getTrustCheckSourceLabel NEVER returns "Official Public Advisory Finding" for any catalog record',
  anyYieldsOfficialFindingLabel,
  false
);

// 2. Specific test for low-risk curated catalog record (quickbazaar.verified@icici)
const lowRiskCatalogRecord = SAMPLE_TRUST_CHECK_RECORDS.find((r) => r.input === 'quickbazaar.verified@icici')!;
assert(
  Boolean(lowRiskCatalogRecord),
  'Low Risk Verification: quickbazaar.verified@icici exists in sample records',
  Boolean(lowRiskCatalogRecord),
  true
);

const lowRiskLabel = getTrustCheckSourceLabel(lowRiskCatalogRecord);
assert(
  lowRiskLabel.text === 'Curated Catalog Check',
  'Low Risk Verification: quickbazaar.verified@icici gets truthful "Curated Catalog Check" label',
  lowRiskLabel.text,
  'Curated Catalog Check'
);
assert(
  !lowRiskLabel.text.toLowerCase().includes('official'),
  'Low Risk Verification: quickbazaar.verified@icici label does not contain "Official"',
  lowRiskLabel.text,
  'Does not contain "official"'
);

// 3. Source reference verification: Government advisories link to generic public portals
for (const record of SAMPLE_TRUST_CHECK_RECORDS) {
  if (record.governmentAdvisories) {
    for (const adv of record.governmentAdvisories) {
      const url = adv.url || '';
      assert(
        url.startsWith('https://'),
        `Advisory Link: "${adv.title}" has secure HTTPS link (${url})`,
        url.startsWith('https://'),
        true
      );
    }
  }
}

// 4. Verify taxonomy separation between Heuristic, Catalog Adverse, and Catalog Negative
const aiObsSample = SAMPLE_TRUST_CHECK_RECORDS.find((r) => r.isAiObservation === true)!;
assert(
  getTrustCheckSourceLabel(aiObsSample).text === 'AI Heuristic Observation',
  'Taxonomy: isAiObservation=true records map to "AI Heuristic Observation"',
  getTrustCheckSourceLabel(aiObsSample).text,
  'AI Heuristic Observation'
);

const catalogAdverseSample = SAMPLE_TRUST_CHECK_RECORDS.find((r) => !r.isAiObservation && r.riskLevel === 'high_risk')!;
assert(
  getTrustCheckSourceLabel(catalogAdverseSample).text === 'Curated Catalog Match',
  'Taxonomy: Non-AI high-risk catalog records map to "Curated Catalog Match"',
  getTrustCheckSourceLabel(catalogAdverseSample).text,
  'Curated Catalog Match'
);

// =========================================================================
// SECTION 6: Summary
// =========================================================================
console.log('\n======================================================');
console.log(`TrustCheck Test Summary: ${passedCount} passed, ${failedCount} failed`);
console.log('======================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
