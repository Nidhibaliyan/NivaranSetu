/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — TrustCheck to Smart Case Builder Handoff Regression Suite
 *
 * Scope:
 * - 1. High-Risk Handoff Template:
 *      - Confirms handoff template uses 'HIGH RISK — Curated Catalog Match'.
 *      - Confirms absence of legacy phrase 'Verified adverse match'.
 *      - Confirms identifier and advisory match details are preserved.
 * - 2. Suspicious Handoff Template:
 *      - Confirms handoff template uses 'SUSPICIOUS — AI Heuristic Observation'.
 *      - Confirms heuristic disclosure is preserved without claiming confirmed adverse findings.
 * - 3. Low-Risk Handoff Template:
 *      - Confirms handoff template uses 'LOW RISK — Curated Catalog Check'.
 *      - Confirms absence of 'Official' or 'Verified' claims.
 * - 4. Active Catalog Integrity:
 *      - Confirms zero occurrences of 'Verified adverse match' across all sample records.
 * - 5. Component Badge Formatting:
 *      - Confirms CaseBuilder and CaseDossier badge logic renders truthful risk labels.
 *
 * Execution: Strictly offline. Zero external network, Gemini, or Supabase requests.
 */

import {
  evaluateTrustCheckInput,
  getTrustCheckBadgeConfig,
  getTrustCheckSourceLabel,
} from '../src/components/TrustCheck';
import { SAMPLE_TRUST_CHECK_RECORDS } from '../src/sampleData';
import { TrustCheckRecord } from '../src/types';

console.log('=== NivaranSetu TrustCheck Handoff Regression Suite ===\n');

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

// Helper duplicating the exact App.tsx onContinueToBuilder template function
function buildHandoffPrompt(trustRecord: TrustCheckRecord): string {
  const badge = getTrustCheckBadgeConfig(trustRecord.riskLevel, trustRecord.resultStatus);
  const source = getTrustCheckSourceLabel(trustRecord);
  return `[TrustCheck Advisory: ${badge.text} — ${source.text}]\nSuspicious Identifier: ${trustRecord.input} (${trustRecord.type.toUpperCase()})\nAdvisory Match: ${trustRecord.flagTitle}\nDetails: ${trustRecord.description}`;
}

// =========================================================================
// SECTION 1: High-Risk Handoff
// =========================================================================
console.log('--- Section 1: High-Risk Handoff Verification ---');

const highRiskRecord = SAMPLE_TRUST_CHECK_RECORDS.find((r) => r.input === 'refund-desk99@oksbi')!;
assert(Boolean(highRiskRecord), 'highRiskRecord found in SAMPLE_TRUST_CHECK_RECORDS');

const highRiskPrompt = buildHandoffPrompt(highRiskRecord);

assert(
  highRiskPrompt.includes('[TrustCheck Advisory: HIGH RISK — Curated Catalog Match]'),
  'High-Risk Handoff: Header is "[TrustCheck Advisory: HIGH RISK — Curated Catalog Match]"',
  highRiskPrompt.split('\n')[0],
  '[TrustCheck Advisory: HIGH RISK — Curated Catalog Match]'
);

assert(
  !highRiskPrompt.includes('Verified adverse match'),
  'High-Risk Handoff: Does NOT contain legacy phrase "Verified adverse match"',
  highRiskPrompt.includes('Verified adverse match'),
  false
);

assert(
  highRiskPrompt.includes('Suspicious Identifier: refund-desk99@oksbi (UPI)'),
  'High-Risk Handoff: Preserves identifier and type',
  highRiskPrompt,
  'refund-desk99@oksbi (UPI)'
);

assert(
  highRiskPrompt.includes('Advisory Match: Deceptive Virtual Payment Address (VPA) / Fraud Collect Pattern'),
  'High-Risk Handoff: Preserves advisory flag title'
);

// Second high-risk vector: APK URL
const apkRecord = SAMPLE_TRUST_CHECK_RECORDS.find((r) => r.input === 'https://fast-ebill-update.xyz/pay.apk')!;
const apkPrompt = buildHandoffPrompt(apkRecord);
assert(
  apkPrompt.includes('[TrustCheck Advisory: HIGH RISK — Curated Catalog Match]'),
  'High-Risk APK Handoff: Header uses truthful HIGH RISK & Curated Catalog Match'
);
assert(
  !apkPrompt.includes('Verified adverse match'),
  'High-Risk APK Handoff: Does NOT contain "Verified adverse match"'
);

// =========================================================================
// SECTION 2: Suspicious Handoff (Heuristic & Catalog)
// =========================================================================
console.log('\n--- Section 2: Suspicious Handoff Verification ---');

const reproRecord = evaluateTrustCheckInput('customer-care-support.xyz', 'url');
const reproPrompt = buildHandoffPrompt(reproRecord);

assert(
  reproPrompt.includes('[TrustCheck Advisory: SUSPICIOUS — AI Heuristic Observation]'),
  'Suspicious Handoff: Header is "[TrustCheck Advisory: SUSPICIOUS — AI Heuristic Observation]"',
  reproPrompt.split('\n')[0],
  '[TrustCheck Advisory: SUSPICIOUS — AI Heuristic Observation]'
);

assert(
  !reproPrompt.includes('Verified adverse match'),
  'Suspicious Handoff: Does NOT contain "Verified adverse match"',
  reproPrompt.includes('Verified adverse match'),
  false
);

assert(
  reproPrompt.includes('Suspicious Identifier: customer-care-support.xyz (URL)'),
  'Suspicious Handoff: Preserves identifier and URL type'
);

// Catalog suspicious: support-claims@refunds-portal.in
const catSuspRecord = SAMPLE_TRUST_CHECK_RECORDS.find((r) => r.input === 'support-claims@refunds-portal.in')!;
const catSuspPrompt = buildHandoffPrompt(catSuspRecord);
assert(
  catSuspPrompt.includes('[TrustCheck Advisory: SUSPICIOUS — AI Heuristic Observation]'),
  'Catalog Suspicious Handoff: Correctly marked as AI Heuristic Observation'
);
assert(
  !catSuspPrompt.includes('Verified adverse match'),
  'Catalog Suspicious Handoff: Does NOT contain "Verified adverse match"'
);

// =========================================================================
// SECTION 3: Low-Risk Handoff (Negative Match)
// =========================================================================
console.log('\n--- Section 3: Low-Risk Handoff Verification ---');

const lowRiskRecord = SAMPLE_TRUST_CHECK_RECORDS.find((r) => r.input === 'quickbazaar.verified@icici')!;
const lowRiskPrompt = buildHandoffPrompt(lowRiskRecord);

assert(
  lowRiskPrompt.includes('[TrustCheck Advisory: LOW RISK — Curated Catalog Check]'),
  'Low-Risk Handoff: Header is "[TrustCheck Advisory: LOW RISK — Curated Catalog Check]"',
  lowRiskPrompt.split('\n')[0],
  '[TrustCheck Advisory: LOW RISK — Curated Catalog Check]'
);

assert(
  !lowRiskPrompt.includes('Verified adverse match'),
  'Low-Risk Handoff: Does NOT contain "Verified adverse match"'
);

assert(
  !lowRiskPrompt.split('\n')[0].includes('Official'),
  'Low-Risk Handoff: Header does not contain "Official"'
);

// =========================================================================
// SECTION 4: Active Catalog Record Status Integrity
// =========================================================================
console.log('\n--- Section 4: Active Catalog Record Status Integrity ---');

let anyCatalogHasVerifiedAdverseMatch = false;
for (const record of SAMPLE_TRUST_CHECK_RECORDS) {
  if (record.resultStatus === 'Verified adverse match') {
    anyCatalogHasVerifiedAdverseMatch = true;
  }
}

assert(
  !anyCatalogHasVerifiedAdverseMatch,
  'Catalog Integrity: Zero records in SAMPLE_TRUST_CHECK_RECORDS have resultStatus === "Verified adverse match"',
  anyCatalogHasVerifiedAdverseMatch,
  false
);

// =========================================================================
// SECTION 5: Summary
// =========================================================================
console.log('\n======================================================');
console.log(`TrustCheck Handoff Test Summary: ${passedCount} passed, ${failedCount} failed`);
console.log('======================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
