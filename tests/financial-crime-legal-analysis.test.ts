/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// =============================================================================
// NIVARANSETU FINANCIAL CRIME LEGAL ANALYSIS ENGINE UNIT TESTS
// 100% Offline test suite verifying Batch 1 statutory catalogue and pure engine.
// Zero network calls, zero external API requests, zero database mutations.
// =============================================================================

import {
  BNS_CATALOGUE,
  IPC_LEGACY_CATALOGUE,
  IT_ACT_CATALOGUE,
  CPA_CATALOGUE,
  RBI_COMMERCIAL_BANKS_CATALOGUE,
  STATUTORY_CATALOGUE_METADATA,
} from '../src/data/statutoryCatalogue';

import {
  evaluateTemporalJurisdiction,
  evaluateRbiRegulatoryRemedies,
  evaluateCpaEligibility,
  evaluateBreachOfTrustApplicability,
  evaluateOffenceApplicability,
  evaluateFactCertainty,
  TimelineEventItem,
} from '../src/utils/legalAnalysisEngine';

console.log('=== NivaranSetu Financial Crime Legal Analysis Test Suite (Batch 1 Refined) ===\n');

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(
      `[FAIL] ${testName} | Expected: ${JSON.stringify(expected)} | Got: ${JSON.stringify(actual)}`
    );
    failedCount++;
  }
}

// -----------------------------------------------------------------------------
// TEST SUITE 1: TEMPORAL CLASSIFICATION & EXCLUSION OF ADMINISTRATIVE DATES
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Event-Level Temporal Evaluation ---');

// Test 1.1: Discovery and reporting dates MUST NOT affect criminal jurisdiction
const eventsPreBnsWithLaterDiscovery: TimelineEventItem[] = [
  {
    id: 'e1',
    date: '2024-05-15',
    title: 'Phishing call received',
    description: 'Fraudster lured victim with fake KYC update',
    eventType: 'initial_contact', // Offending act: Pre-BNS
  },
  {
    id: 'e2',
    date: '2024-05-16',
    title: 'Unauthorized account debit',
    description: 'Rs. 50,000 debited without consent',
    eventType: 'unauthorized_debit', // Offending act: Pre-BNS
  },
  {
    id: 'e3',
    date: '2024-09-10', // Discovery in September 2024 (Post-BNS!)
    title: 'Discovered during passbook update',
    description: 'Citizen noticed missing funds while updating passbook',
    eventType: 'discovery', // Administrative: MUST BE EXCLUDED from criminal classification
  },
  {
    id: 'e4',
    date: '2024-09-11', // Reporting in September 2024
    title: 'Reported to cyber cell',
    description: 'Citizen lodged report on National Cyber Crime Portal',
    eventType: 'police_report', // Administrative: MUST BE EXCLUDED
  },
];

const res1 = evaluateTemporalJurisdiction(eventsPreBnsWithLaterDiscovery);

assert(
  res1.status === 'GOVERNED_BY_IPC_1860',
  'Excludes discovery/reporting dates: Pre-July offence discovered in Sept 2024 is governed strictly by IPC 1860',
  res1.status,
  'GOVERNED_BY_IPC_1860'
);

assert(
  res1.offendingEventDates.length === 2 &&
    res1.offendingEventDates.includes('2024-05-15') &&
    res1.offendingEventDates.includes('2024-05-16'),
  'Identifies exactly the 2 offending event dates',
  res1.offendingEventDates,
  ['2024-05-15', '2024-05-16']
);

assert(
  res1.excludedAdministrativeDates.length === 2,
  'Records exactly 2 excluded administrative milestones',
  res1.excludedAdministrativeDates.length,
  2
);

assert(
  res1.timelineCrossesBnsTransition === false,
  'Correctly marks timelineCrossesBnsTransition as false because all offending acts were pre-BNS',
  res1.timelineCrossesBnsTransition,
  false
);

// Test 1.2: Post-BNS events only
const eventsPostBnsOnly: TimelineEventItem[] = [
  {
    id: 'e5',
    date: '2024-08-01',
    title: 'Malicious APK downloaded',
    description: 'Installed fake electricity payment APK',
    eventType: 'initial_contact',
  },
  {
    id: 'e6',
    date: '2024-08-02',
    title: 'UPI PIN compromised',
    description: 'App captured screen credentials',
    eventType: 'credential_disclosure',
  },
  {
    id: 'e7',
    date: '2024-08-03',
    title: 'UPI transfers executed',
    description: 'Three transfers totaling Rs. 85,000',
    eventType: 'unauthorized_debit',
  },
];

const res2 = evaluateTemporalJurisdiction(eventsPostBnsOnly);

assert(
  res2.status === 'GOVERNED_BY_BNS_2023',
  'Post-July 2024 acts are governed exclusively by BNS 2023',
  res2.status,
  'GOVERNED_BY_BNS_2023'
);

assert(
  res2.applicableCriminalStatutes.some((s) => s.catalogueId === 'BNS-318-4'),
  'Includes BNS Section 318(4) for cheating',
  true,
  true
);

// Test 1.3: Spanning Conduct crossing 1 July 2024
const eventsSpanning: TimelineEventItem[] = [
  {
    id: 'e8',
    date: '2024-06-15',
    title: 'Fake investment website registered and contacted',
    description: 'Victim joined fraudulent investment Telegram group',
    eventType: 'initial_contact', // Pre-BNS
  },
  {
    id: 'e9',
    date: '2024-06-25',
    title: 'False profit promises made',
    description: 'Fraudster showed fictitious trading profits',
    eventType: 'deceptive_inducement', // Pre-BNS
  },
  {
    id: 'e10',
    date: '2024-07-20',
    title: 'Funds debited for withdrawal fee',
    description: 'Victim induced to pay Rs. 1,20,000 for fictitious taxes',
    eventType: 'unauthorized_debit', // Post-BNS
  },
];

const res3 = evaluateTemporalJurisdiction(eventsSpanning);

assert(
  res3.status === 'REVIEW_NEEDED_SPANNING_CONDUCT',
  'Detects timeline crossing 1 July 2024 and returns REVIEW_NEEDED_SPANNING_CONDUCT',
  res3.status,
  'REVIEW_NEEDED_SPANNING_CONDUCT'
);

assert(
  res3.timelineCrossesBnsTransition === true,
  'Correctly marks timelineCrossesBnsTransition as true',
  res3.timelineCrossesBnsTransition,
  true
);

assert(
  res3.savingsProvisionsCited.some((s) => s.catalogueId === 'BNS-358') &&
    res3.savingsProvisionsCited.some((s) => s.catalogueId === 'GCA-6'),
  'Cites Section 358 BNS and Section 6 General Clauses Act as savings provisions',
  true,
  true
);

assert(
  res3.savingsProvisionsCited.every((s) => s.isSavingsOrInterpretationProvision === true),
  'Affirms that savings provisions are flagged isSavingsOrInterpretationProvision = true',
  true,
  true
);

assert(
  res3.explanation.includes('without prescribing dual charges') &&
    res3.explanation.includes('do not authorize dual charging'),
  'Explanation explicitly disclaims prescribing dual charges',
  true,
  true
);

// -----------------------------------------------------------------------------
// TEST SUITE 2: STATUTORY PUNISHMENTS & SUBSECTION VERIFICATIONS
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Statutory Punishments & Subsection Verifications ---');

// Test 2.1: BNS 318(4) - Cheating
const bns318 = BNS_CATALOGUE['BNS-318-4'];
assert(
  bns318.prescribedPunishment.imprisonmentTerm.includes('7 years') &&
    bns318.prescribedPunishment.fineAmount.includes('liable to fine'),
  'BNS 318(4) prescribes up to 7 years and fine',
  bns318.prescribedPunishment,
  'Up to 7 years and fine'
);

// Test 2.2: BNS 319(2) - Cheating by Personation
const bns319 = BNS_CATALOGUE['BNS-319-2'];
assert(
  bns319.prescribedPunishment.imprisonmentTerm.includes('5 years') &&
    bns319.prescribedPunishment.punishmentType === 'imprisonment_or_fine_or_both',
  'BNS 319(2) prescribes up to 5 years, or fine, or both',
  bns319.prescribedPunishment.imprisonmentTerm,
  '5 years'
);

// Test 2.3: BNS 316(2) General vs 316(5) Specific Fiduciary Capacity
const bns316_2 = BNS_CATALOGUE['BNS-316-2'];
const bns316_5 = BNS_CATALOGUE['BNS-316-5'];

assert(
  bns316_2.prescribedPunishment.imprisonmentTerm.includes('5 years') &&
    bns316_2.prescribedPunishment.punishmentType === 'imprisonment_or_fine_or_both',
  'BNS 316(2) general breach of trust prescribes up to 5 years, or fine, or both',
  bns316_2.prescribedPunishment.imprisonmentTerm,
  '5 years'
);

assert(
  bns316_5.prescribedPunishment.imprisonmentTerm.includes('life') &&
    bns316_5.prescribedPunishment.imprisonmentTerm.includes('10 years'),
  'BNS 316(5) fiduciary breach of trust prescribes life or up to 10 years and fine',
  bns316_5.prescribedPunishment.imprisonmentTerm,
  'Life or 10 years'
);

assert(
  Array.isArray(bns316_5.appliesToCapacities) &&
    bns316_5.appliesToCapacities.includes('Banker') &&
    bns316_5.appliesToCapacities.includes('Merchant') &&
    bns316_5.appliesToCapacities.includes('Agent') &&
    bns316_5.appliesToCapacities.includes('Public Servant'),
  'BNS 316(5) strictly lists qualifying professional capacities',
  bns316_5.appliesToCapacities,
  ['Public Servant', 'Banker', 'Merchant', 'Factor', 'Broker', 'Attorney', 'Agent']
);

// Test 2.4: evaluateBreachOfTrustApplicability helper
const botBanker = evaluateBreachOfTrustApplicability(true, 'Branch Relationship Banker');
assert(
  botBanker.entry?.catalogueId === 'BNS-316-5',
  'Fiduciary capacity "Banker" correctly unlocks BNS Section 316(5)',
  botBanker.entry?.catalogueId,
  'BNS-316-5'
);

const botGeneral = evaluateBreachOfTrustApplicability(true, 'Acquaintance');
assert(
  botGeneral.entry?.catalogueId === 'BNS-316-2',
  'Non-fiduciary capacity defaults safely to general BNS Section 316(2)',
  botGeneral.entry?.catalogueId,
  'BNS-316-2'
);

const botNoEntrustment = evaluateBreachOfTrustApplicability(false, 'Scammer');
assert(
  botNoEntrustment.isApplicable === false,
  'Rejects breach of trust when initial entrustment is absent',
  botNoEntrustment.isApplicable,
  false
);

// Test 2.5: BNS Forgery Subsections 336(2), 336(3), and 338
const bns336_2 = BNS_CATALOGUE['BNS-336-2'];
const bns336_3 = BNS_CATALOGUE['BNS-336-3'];
const bns338 = BNS_CATALOGUE['BNS-338'];

assert(
  bns336_2.prescribedPunishment.imprisonmentTerm.includes('2 years'),
  'BNS 336(2) general forgery carries up to 2 years',
  bns336_2.prescribedPunishment.imprisonmentTerm,
  '2 years'
);

assert(
  bns336_3.prescribedPunishment.imprisonmentTerm.includes('7 years') &&
    bns336_3.prescribedPunishment.punishmentType === 'mandatory_imprisonment_and_fine',
  'BNS 336(3) forgery for cheating carries up to 7 years and fine',
  bns336_3.prescribedPunishment.imprisonmentTerm,
  '7 years'
);

assert(
  bns338.prescribedPunishment.imprisonmentTerm.includes('life') &&
    bns338.prescribedPunishment.imprisonmentTerm.includes('10 years'),
  'BNS 338 forgery of valuable security carries life or up to 10 years and fine',
  bns338.prescribedPunishment.imprisonmentTerm,
  'Life or 10 years'
);

// -----------------------------------------------------------------------------
// TEST SUITE 3: CONSUMER PROTECTION ACT (CPA 2019)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Consumer Protection Act (CPA 2019) Eligibility ---');

// Test 3.1: Section 35 description exactness
const cpa35 = CPA_CATALOGUE['CPA-35'];
assert(
  cpa35.provisionTitle === 'Manner in which complaint shall be made before the District Commission',
  'Section 35 provisionTitle is exact: "Manner in which complaint shall be made before the District Commission"',
  cpa35.provisionTitle,
  'Manner in which complaint shall be made before the District Commission'
);

// Test 3.2: Sections 2(7), 2(42), 2(11) presence
assert(
  CPA_CATALOGUE['CPA-2-7'] !== undefined &&
    CPA_CATALOGUE['CPA-2-42'] !== undefined &&
    CPA_CATALOGUE['CPA-2-11'] !== undefined,
  'CPA Catalogue contains Section 2(7) Consumer, 2(42) Service, and 2(11) Deficiency',
  true,
  true
);

// Test 3.3: Anonymous fraudster cannot be sued under CPA
const cpaAnon = evaluateCpaEligibility({
  hasConsumerServiceProviderRelationship: false,
  respondentEntityName: 'Anonymous Telegram Scammer',
  respondentRole: 'anonymous_fraudster',
  allegedDeficiencies: ['Stole money'],
});

assert(
  cpaAnon.isEligible === false && cpaAnon.reasoning.includes('anonymous cybercriminal'),
  'Suppresses CPA when respondent is an anonymous fraudster',
  cpaAnon.isEligible,
  false
);

// Test 3.4: Bank deficiency enables CPA
const cpaBank = evaluateCpaEligibility({
  hasConsumerServiceProviderRelationship: true,
  respondentEntityName: 'State Bank of India',
  respondentRole: 'service_provider_platform',
  allegedDeficiencies: ['Failure to send mandatory SMS transaction alerts', 'Delay in blocking netbanking'],
});

assert(
  cpaBank.isEligible === true &&
    cpaBank.applicableProvisions.some((p) => p.catalogueId === 'CPA-35') &&
    cpaBank.applicableProvisions.some((p) => p.catalogueId === 'CPA-2-42'),
  'Eligible for CPA against bank with alleged service deficiencies under Sec 2(42) and Sec 35',
  cpaBank.isEligible,
  true
);

// -----------------------------------------------------------------------------
// TEST SUITE 4: REFINED CONDITIONAL RBI REGULATORY REMEDIES
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Refined Conditional RBI Directions Evaluation ---');

// Test 4.1: Institutional Scope - SFBs excluded from Commercial Banks Directions
const rbiSfb = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'small_finance_bank',
  incidentDate: '2026-10-15',
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'no_negligence_alleged',
  workingDaysFromCommunication: 2,
});

assert(
  rbiSfb.tier === 'institution_scope_mismatch' &&
    rbiSfb.isCommercialBankCovered === false &&
    Boolean(rbiSfb.institutionScopeNotice?.includes('Small Finance Banks')),
  'Small Finance Bank excluded from Commercial Bank Directions with specific SFB notice',
  rbiSfb.tier,
  'institution_scope_mismatch'
);

// Test 4.2: Institutional Scope - Payments Banks excluded
const rbiPb = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'payments_bank',
  incidentDate: '2026-10-15',
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'no_negligence_alleged',
  workingDaysFromCommunication: 2,
});

assert(
  rbiPb.tier === 'institution_scope_mismatch' &&
    Boolean(rbiPb.institutionScopeNotice?.includes('Payments Banks')),
  'Payments Bank excluded from Commercial Bank Directions with specific PB notice',
  rbiPb.tier,
  'institution_scope_mismatch'
);

// Test 4.3: Institutional Scope - Generic PPI / Wallet disclaimer
const rbiWallet = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'ppi_wallet',
  incidentDate: '2026-10-15',
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'no_negligence_alleged',
  workingDaysFromCommunication: 2,
});

assert(
  rbiWallet.tier === 'institution_scope_mismatch' &&
    Boolean(rbiWallet.institutionScopeNotice?.includes('bank-issued or issued by a non-bank')),
  'Generic wallet/PPI clarifies bank-issued vs non-bank issued framework requirement',
  true,
  true
);

// Test 4.4: Framework Versioning - Post-1 Jan 2027 produces Unsupported Framework status
const rbiPost2026 = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'scheduled_commercial_bank',
  incidentDate: '2027-02-10', // Post-2026!
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'no_negligence_alleged',
  workingDaysFromCommunication: 1,
});

assert(
  rbiPost2026.tier === 'unsupported_post_2026_framework' && rbiPost2026.isUnsupportedPost2026 === true,
  'Post-1 January 2027 transaction is explicitly marked unsupported_post_2026_framework',
  rbiPost2026.tier,
  'unsupported_post_2026_framework'
);

// Test 4.5: Push-payment scam (Authorized transfer under deception) distinct from unauthorized debit
const rbiPushPayment = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'scheduled_commercial_bank',
  incidentDate: '2026-09-10',
  paymentNature: 'authorised_payment_under_deception', // APP scam
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'no_negligence_alleged',
  workingDaysFromCommunication: 1,
});

assert(
  rbiPushPayment.tier === 'authorised_payment_not_covered_under_unauthorised_framework' &&
    rbiPushPayment.shadowCreditEntitlement.eligible === false,
  'Customer-authorized payment under deception is not treated as an unauthorized transaction under Para 67',
  rbiPushPayment.tier,
  'authorised_payment_not_covered_under_unauthorised_framework'
);

// Test 4.6: Date Calculation - Missing communication receipt date suspends delay clock
const rbiNoCommDate = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'scheduled_commercial_bank',
  incidentDate: '2026-09-01', // Debit happened 20 days ago, but bank never sent SMS/alert!
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'no_negligence_alleged',
  // communicationReceivedDate omitted!
});

assert(
  rbiNoCommDate.tier === 'communication_date_unknown_cannot_calculate_reporting_window' &&
    Boolean(rbiNoCommDate.institutionScopeNotice?.includes('Bank delivery records')) &&
    Boolean(rbiNoCommDate.institutionScopeNotice?.includes('may be needed')),
  'Delay clock runs from communication receipt date, NOT debit date; missing communication date flags reporting window cannot be calculated and delivery records may be needed',
  rbiNoCommDate.tier,
  'communication_date_unknown_cannot_calculate_reporting_window'
);

// Test 4.7: Commercial Bank - Zero Liability on Bank Contributory Fault (Para 67(a))
const rbiBankFault = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'scheduled_commercial_bank',
  incidentDate: '2026-09-10',
  communicationReceivedDate: '2026-09-11',
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: true,
  customerNegligenceStatus: 'no_negligence_alleged',
  workingDaysFromCommunication: 15, // Delay does not bar zero liability if bank is deficient
});

assert(
  rbiBankFault.tier === 'zero_liability_bank_fault' &&
    rbiBankFault.maximumCustomerLiabilityAmount === 0 &&
    rbiBankFault.shadowCreditEntitlement.eligible === true &&
    rbiBankFault.shadowCreditEntitlement.mandatoryDeadlineDays === 10,
  'Bank fault grants Zero Liability (Para 67(a)) and 10-day shadow credit regardless of reporting delay',
  rbiBankFault.maximumCustomerLiabilityAmount,
  0
);

// Test 4.8: Customer Negligence - Only admitted voluntary negligence establishes full loss
const rbiCustNegAdmitted = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'scheduled_commercial_bank',
  incidentDate: '2026-09-10',
  communicationReceivedDate: '2026-09-10',
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'admitted_voluntary_negligence', // Voluntarily shared
  workingDaysFromCommunication: 1,
});

assert(
  rbiCustNegAdmitted.tier === 'full_loss_customer_negligence_until_reported' &&
    rbiCustNegAdmitted.shadowCreditEntitlement.eligible === false,
  'Admitted customer negligence bars zero liability until reported (Para 68(1))',
  rbiCustNegAdmitted.tier,
  'full_loss_customer_negligence_until_reported'
);

// Test 4.9: Disputed Malware / Remote Access NOT treated as established negligence
const rbiRemoteAccess = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'scheduled_commercial_bank',
  incidentDate: '2026-09-10',
  communicationReceivedDate: '2026-09-10',
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'disputed_malware_or_remote_access', // Remote access used, negligence disputed
  workingDaysFromCommunication: 2, // Reported within 2 working days
});

assert(
  rbiRemoteAccess.tier === 'zero_liability_prompt_report' &&
    Boolean(rbiRemoteAccess.calculationBasisNotice.includes('Remote Access / Malicious APK Intervention')),
  'Remote access / APK installation is NOT automatically treated as legally established customer negligence; burden on bank',
  rbiRemoteAccess.tier,
  'zero_liability_prompt_report'
);

// Test 4.10: Exact Account-Category Caps under Para 68(2)
// Category 1: BSBD (₹5,000)
const rbiCapBsbd = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'scheduled_commercial_bank',
  incidentDate: '2026-09-10',
  communicationReceivedDate: '2026-09-10',
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'no_negligence_alleged',
  workingDaysFromCommunication: 5,
  accountType: 'bsbd',
});
assert(
  rbiCapBsbd.maximumCustomerLiabilityAmount === 5000,
  'Exact Cap: BSBD account capped at ₹5,000',
  rbiCapBsbd.maximumCustomerLiabilityAmount,
  5000
);

// Category 2: Standard SB / Prepaid / MSME / Individual Current/CC/OD limit up to ₹25L / Card up to ₹5L (₹10,000)
const rbiCapSb = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'scheduled_commercial_bank',
  incidentDate: '2026-09-10',
  communicationReceivedDate: '2026-09-10',
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'no_negligence_alleged',
  workingDaysFromCommunication: 5,
  accountType: 'standard_sb',
});
assert(
  rbiCapSb.maximumCustomerLiabilityAmount === 10000,
  'Exact Cap: Standard SB capped at ₹10,000',
  rbiCapSb.maximumCustomerLiabilityAmount,
  10000
);

// Category 2b: Individual Current / CC / OD with balance/limit up to ₹25 lakh (₹10,000 cap under Table 1)
const rbiCapIndividualCurrent25L = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'scheduled_commercial_bank',
  incidentDate: '2026-09-10',
  communicationReceivedDate: '2026-09-10',
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'no_negligence_alleged',
  workingDaysFromCommunication: 5,
  accountType: 'individual_current_cc_od_limit_up_to_25l',
});
assert(
  rbiCapIndividualCurrent25L.maximumCustomerLiabilityAmount === 10000,
  'Exact Cap: Individual Current/CC/OD balance/limit up to ₹25 lakh capped at ₹10,000 under Table 1',
  rbiCapIndividualCurrent25L.maximumCustomerLiabilityAmount,
  10000
);

// Category 2c: MSME Current / CC / OD (₹10,000)
const rbiCapMsme = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'scheduled_commercial_bank',
  incidentDate: '2026-09-10',
  communicationReceivedDate: '2026-09-10',
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'no_negligence_alleged',
  workingDaysFromCommunication: 5,
  accountType: 'msme_current_cc_od',
});
assert(
  rbiCapMsme.maximumCustomerLiabilityAmount === 10000,
  'Exact Cap: MSME Current/CC/OD capped at ₹10,000',
  rbiCapMsme.maximumCustomerLiabilityAmount,
  10000
);

// Category 3: All other Current / CC / OD (Individual > ₹25L or non-MSME corporate) (₹25,000)
const rbiCapHighLimit = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'scheduled_commercial_bank',
  incidentDate: '2026-09-10',
  communicationReceivedDate: '2026-09-10',
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'no_negligence_alleged',
  workingDaysFromCommunication: 5,
  accountType: 'all_other_current_cc_od',
});
assert(
  rbiCapHighLimit.maximumCustomerLiabilityAmount === 25000,
  'Exact Cap: All other Current / CC / OD (Individual > ₹25L / non-MSME) capped at ₹25,000',
  rbiCapHighLimit.maximumCustomerLiabilityAmount,
  25000
);

// Category 3b: Credit Card limit above ₹5 lakh (₹25,000)
const rbiCapCardAbove5L = evaluateRbiRegulatoryRemedies({
  involvedEntityType: 'scheduled_commercial_bank',
  incidentDate: '2026-09-10',
  communicationReceivedDate: '2026-09-10',
  paymentNature: 'unauthorised_transaction',
  isBankDeficiencyOrFraudAlleged: false,
  customerNegligenceStatus: 'no_negligence_alleged',
  workingDaysFromCommunication: 5,
  accountType: 'credit_card_limit_above_5l',
});
assert(
  rbiCapCardAbove5L.maximumCustomerLiabilityAmount === 25000,
  'Exact Cap: Credit Card limit above ₹5L capped at ₹25,000',
  rbiCapCardAbove5L.maximumCustomerLiabilityAmount,
  25000
);

// -----------------------------------------------------------------------------
// TEST SUITE 5: OFFENCE ESSENTIAL INGREDIENTS CHECKER (ALL 9 OFFENCES)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Offence Applicability & Ingredient Verification ---');

// Test 5.1: Negative Guard - Suspicious URL/APK alone rejects offences and lists missing ingredients
const offenceUrlOnly = evaluateOffenceApplicability({
  hasDeceptiveCommunication: false,
  hasDishonestInducement: false,
  hasDeliveryOfPropertyOrDebit: false,
  hasImpersonationOfPersonOrAuthority: false,
  hasPriorEntrustmentOfProperty: false,
  hasFabricatedDocumentOrElectronicRecord: false,
  intentToCheatWithFabricatedDocument: false,
  isValuableSecurityOrWillForged: false,
  hasUnauthorizedUseOfPasswordOrPin: false,
  hasComputerResourceUsedForImpersonation: false,
  hasSuspiciousUrlOrApkOnly: true,
  hasReportedDebitOnly: false,
});

const bns318UrlOnly = offenceUrlOnly.assessedOffences.find((o) => o.catalogueId === 'BNS-318-4');
assert(
  bns318UrlOnly?.isPrimaFacieSupported === false &&
    bns318UrlOnly.missingIngredients.length > 0 &&
    bns318UrlOnly.evidentiaryNote.includes('suspicious URL or APK link alone does not constitute cheating'),
  'Suspicious URL alone rejects BNS 318(4) cheating and lists missing ingredients',
  bns318UrlOnly?.isPrimaFacieSupported,
  false
);

const bns336UrlOnly = offenceUrlOnly.assessedOffences.find((o) => o.catalogueId === 'BNS-336-2');
assert(
  bns336UrlOnly?.isPrimaFacieSupported === false &&
    bns336UrlOnly.evidentiaryNote.includes('suspicious link or APK URL is not automatically a forged document'),
  'Suspicious URL alone rejects BNS 336(2) forgery',
  bns336UrlOnly?.isPrimaFacieSupported,
  false
);

// Test 5.2: Negative Guard - Reported debit alone does NOT establish Cheating or Identity Theft
const offenceDebitOnly = evaluateOffenceApplicability({
  hasDeceptiveCommunication: false,
  hasDishonestInducement: false,
  hasDeliveryOfPropertyOrDebit: true, // Only an unauthorized debit exists!
  hasImpersonationOfPersonOrAuthority: false,
  hasPriorEntrustmentOfProperty: false,
  hasFabricatedDocumentOrElectronicRecord: false,
  intentToCheatWithFabricatedDocument: false,
  isValuableSecurityOrWillForged: false,
  hasUnauthorizedUseOfPasswordOrPin: false,
  hasComputerResourceUsedForImpersonation: false,
  hasSuspiciousUrlOrApkOnly: false,
  hasReportedDebitOnly: true,
});

const bns318DebitOnly = offenceDebitOnly.assessedOffences.find((o) => o.catalogueId === 'BNS-318-4');
const it66cDebitOnly = offenceDebitOnly.assessedOffences.find((o) => o.catalogueId === 'IT-66C');
assert(
  bns318DebitOnly?.isPrimaFacieSupported === false &&
    bns318DebitOnly.evidentiaryNote.includes('unexplained bank debit alone does not constitute cheating'),
  'Reported debit alone rejects BNS 318(4) cheating without deceptive inducement',
  bns318DebitOnly?.isPrimaFacieSupported,
  false
);
assert(
  it66cDebitOnly?.isPrimaFacieSupported === false &&
    it66cDebitOnly.evidentiaryNote.includes('reported debit alone does not prove identity theft'),
  'Reported debit alone rejects IT Act 66C without unauthorized credential/PIN use',
  it66cDebitOnly?.isPrimaFacieSupported,
  false
);

// Test 5.3: BNS 318(4) - Cheating & Dishonestly Inducing Delivery (Positive Case)
const factsCheating = {
  hasDeceptiveCommunication: true,
  hasDishonestInducement: true,
  hasDeliveryOfPropertyOrDebit: true,
  hasImpersonationOfPersonOrAuthority: false,
  hasPriorEntrustmentOfProperty: false,
  hasFabricatedDocumentOrElectronicRecord: false,
  intentToCheatWithFabricatedDocument: false,
  isValuableSecurityOrWillForged: false,
  hasUnauthorizedUseOfPasswordOrPin: false,
  hasComputerResourceUsedForImpersonation: false,
  hasSuspiciousUrlOrApkOnly: false,
  hasReportedDebitOnly: false,
};
const resCheating = evaluateOffenceApplicability(factsCheating);
const bns318CheatingOnly = resCheating.assessedOffences.find((o) => o.catalogueId === 'BNS-318-4');
assert(
  bns318CheatingOnly?.isPrimaFacieSupported === true &&
    bns318CheatingOnly.prescribedPunishment.includes('7 years'),
  'Deception + Inducement + Delivery supports BNS 318(4) cheating with 7 years punishment',
  bns318CheatingOnly?.isPrimaFacieSupported,
  true
);

// Test 5.4: BNS 319(2) - Cheating by Personation (Positive & Negative)
const factsPersonation = {
  ...factsCheating,
  hasImpersonationOfPersonOrAuthority: true,
};
const resPersonation = evaluateOffenceApplicability(factsPersonation);
const bns319Supported = resPersonation.assessedOffences.find((o) => o.catalogueId === 'BNS-319-2');
const bns319Unsupported = resCheating.assessedOffences.find((o) => o.catalogueId === 'BNS-319-2');
assert(
  bns319Supported?.isPrimaFacieSupported === true &&
    bns319Unsupported?.isPrimaFacieSupported === false,
  'BNS 319(2) supported when personation is alleged; rejected when personation is absent',
  bns319Supported?.isPrimaFacieSupported,
  true
);

// Test 5.5: BNS 316(2) - Criminal Breach of Trust (General) (Statutory Entrustment Test)
// Does NOT require voluntary entrustment; follows statutory wording: property entrusted in any manner or dominion
const factsBreachGeneral = {
  ...factsCheating,
  hasPriorEntrustmentOfProperty: true,
};
const resBreachGeneral = evaluateOffenceApplicability(factsBreachGeneral);
const bns316_2Pos = resBreachGeneral.assessedOffences.find((o) => o.catalogueId === 'BNS-316-2');
const bns316_2Neg = resCheating.assessedOffences.find((o) => o.catalogueId === 'BNS-316-2');
assert(
  bns316_2Pos?.isPrimaFacieSupported === true &&
    bns316_2Pos.establishedIngredients.some((i) => i.includes('Property entrusted in any manner')) &&
    bns316_2Neg?.isPrimaFacieSupported === false,
  'BNS 316(2) supported when property is entrusted in any manner; rejected when money was obtained deceitfully from inception without entrustment',
  bns316_2Pos?.isPrimaFacieSupported,
  true
);

// Test 5.6: BNS 316(5) - Breach of Trust by Banker / Agent (Capacity Test vs Institution Identity Guard)
// Positive: Offender personally holds qualifying capacity "banker"
const factsBankerOffender = {
  ...factsBreachGeneral,
  allegedOffenderQualifyingCapacity: 'banker',
};
const resBanker = evaluateOffenceApplicability(factsBankerOffender);
const bns316_5Pos = resBanker.assessedOffences.find((o) => o.catalogueId === 'BNS-316-5');
assert(
  bns316_5Pos?.isPrimaFacieSupported === true &&
    bns316_5Pos.prescribedPunishment.includes('life'),
  'BNS 316(5) supported when offender personally holds qualifying capacity "banker" (life or up to 10 years)',
  bns316_5Pos?.isPrimaFacieSupported,
  true
);

// CRUCIAL NEGATIVE GUARD: Respondent is "State Bank of India", but offender personal capacity is absent!
const factsBankRespondentNoCapacity = {
  ...factsBreachGeneral,
  respondentInstitutionName: 'State Bank of India',
  allegedOffenderQualifyingCapacity: undefined, // No personal capacity established!
};
const resBankRespondent = evaluateOffenceApplicability(factsBankRespondentNoCapacity);
const bns316_5InstitutionOnly = resBankRespondent.assessedOffences.find((o) => o.catalogueId === 'BNS-316-5');
assert(
  bns316_5InstitutionOnly?.isPrimaFacieSupported === false &&
    bns316_5InstitutionOnly.evidentiaryNote.includes('being a bank does NOT establish Section 316(5)'),
  'CRUCIAL GUARD: Respondent institution being a bank does NOT establish BNS 316(5) without personal offender capacity',
  bns316_5InstitutionOnly?.isPrimaFacieSupported,
  false
);

// Test 5.7: BNS 336(2) - Forgery (General) (Positive & Negative)
const factsForgeryGeneral = {
  ...factsCheating,
  hasFabricatedDocumentOrElectronicRecord: true,
};
const resForgeryGeneral = evaluateOffenceApplicability(factsForgeryGeneral);
const bns336_2Pos = resForgeryGeneral.assessedOffences.find((o) => o.catalogueId === 'BNS-336-2');
const bns336_2Neg = resCheating.assessedOffences.find((o) => o.catalogueId === 'BNS-336-2');
assert(
  bns336_2Pos?.isPrimaFacieSupported === true &&
    bns336_2Neg?.isPrimaFacieSupported === false,
  'BNS 336(2) supported when false document/record is created; rejected when absent',
  bns336_2Pos?.isPrimaFacieSupported,
  true
);

// Test 5.8: BNS 336(3) - Forgery for Cheating (Positive & Negative)
const factsForgeryCheating = {
  ...factsForgeryGeneral,
  intentToCheatWithFabricatedDocument: true,
};
const resForgeryCheating = evaluateOffenceApplicability(factsForgeryCheating);
const bns336_3Pos = resForgeryCheating.assessedOffences.find((o) => o.catalogueId === 'BNS-336-3');
const bns336_3Neg = resForgeryGeneral.assessedOffences.find((o) => o.catalogueId === 'BNS-336-3');
assert(
  bns336_3Pos?.isPrimaFacieSupported === true &&
    bns336_3Pos.prescribedPunishment.includes('7 years') &&
    bns336_3Neg?.isPrimaFacieSupported === false,
  'BNS 336(3) supported when false document + intent to cheat; rejected without intent to cheat',
  bns336_3Pos?.isPrimaFacieSupported,
  true
);

// Test 5.9a: BNS 338 - Forgery of Receipt / Acquittance Acknowledging Payment of Money (Positive)
// Section 338 explicitly covers any document purporting to be an acquittance or receipt acknowledging payment of money
const factsForgedReceipt = {
  ...factsForgeryCheating,
  isReceiptOrAcquittanceAcknowledgingPaymentForged: true,
};
const resForgedReceipt = evaluateOffenceApplicability(factsForgedReceipt);
const bns338Receipt = resForgedReceipt.assessedOffences.find((o) => o.catalogueId === 'BNS-338');
assert(
  bns338Receipt?.isPrimaFacieSupported === true &&
    bns338Receipt.prescribedPunishment.includes('life') &&
    bns338Receipt.evidentiaryNote.includes('receipt/acquittance acknowledging payment of money'),
  'BNS 338 explicitly covers forged acquittance or receipt acknowledging payment of money',
  bns338Receipt?.isPrimaFacieSupported,
  true
);

// Test 5.9b: BNS 338 - Forgery of Valuable Security or Will (Positive)
const factsValuableSecurity = {
  ...factsForgeryCheating,
  isValuableSecurityOrWillForged: true,
};
const resValuableSecurity = evaluateOffenceApplicability(factsValuableSecurity);
const bns338ValuableSecurity = resValuableSecurity.assessedOffences.find((o) => o.catalogueId === 'BNS-338');
assert(
  bns338ValuableSecurity?.isPrimaFacieSupported === true &&
    bns338ValuableSecurity.prescribedPunishment.includes('life'),
  'BNS 338 supported when document forged is a valuable security or will',
  bns338ValuableSecurity?.isPrimaFacieSupported,
  true
);

// Test 5.9c: BNS 338 & 336(2) - Genuine Screenshot or Unverified Image Alone (Negative Guard)
// A genuine screenshot or an unverified image alone must NOT establish forgery under Section 335 or 338
const factsGenuineScreenshot = {
  ...factsCheating,
  hasFabricatedDocumentOrElectronicRecord: false,
  isUnverifiedImageOrGenuineScreenshotOnly: true,
  isReceiptOrAcquittanceAcknowledgingPaymentForged: false,
};
const resGenuineScreenshot = evaluateOffenceApplicability(factsGenuineScreenshot);
const bns338Genuine = resGenuineScreenshot.assessedOffences.find((o) => o.catalogueId === 'BNS-338');
const bns336_2Genuine = resGenuineScreenshot.assessedOffences.find((o) => o.catalogueId === 'BNS-336-2');
assert(
  bns338Genuine?.isPrimaFacieSupported === false &&
    bns336_2Genuine?.isPrimaFacieSupported === false &&
    bns338Genuine.evidentiaryNote.includes('genuine screenshot or an unverified image alone does not establish forgery'),
  'A genuine screenshot or unverified image alone rejects BNS 335 and BNS 338 forgery',
  bns338Genuine?.isPrimaFacieSupported,
  false
);

// Test 5.9d: BNS 338 - Document of Non-338 Description (Negative Case)
const factsForgedOrdinaryDoc = {
  ...factsForgeryCheating,
  isValuableSecurityOrWillForged: false,
  isReceiptOrAcquittanceAcknowledgingPaymentForged: false,
};
const resForgedOrdinaryDoc = evaluateOffenceApplicability(factsForgedOrdinaryDoc);
const bns338OrdinaryDoc = resForgedOrdinaryDoc.assessedOffences.find((o) => o.catalogueId === 'BNS-338');
const bns336_3OrdinaryDoc = resForgedOrdinaryDoc.assessedOffences.find((o) => o.catalogueId === 'BNS-336-3');
assert(
  bns338OrdinaryDoc?.isPrimaFacieSupported === false &&
    bns336_3OrdinaryDoc?.isPrimaFacieSupported === true &&
    bns338OrdinaryDoc.evidentiaryNote.includes('not of a description covered under Section 338'),
  'BNS 338 rejected when false document is not of a covered description (Section 336(3) applies instead)',
  bns338OrdinaryDoc?.isPrimaFacieSupported,
  false
);

// Test 5.10a: IT Act Section 66C - Offender Uses Victim's Credentials (Positive Case)
const factsOffenderCredentialUse = {
  ...factsCheating,
  hasUnauthorizedUseOfPasswordOrPin: true,
  hasOffenderUsedAnotherPersonsCredentials: true,
  isVictimOwnCredentialEntryUnderDeception: false,
};
const resOffenderCredentialUse = evaluateOffenceApplicability(factsOffenderCredentialUse);
const it66cPos = resOffenderCredentialUse.assessedOffences.find((o) => o.catalogueId === 'IT-66C');
assert(
  it66cPos?.isPrimaFacieSupported === true &&
    it66cPos.prescribedPunishment.includes('3 years') &&
    it66cPos.establishedIngredients.some((i) => i.includes('Offender fraudulently or dishonestly made use')),
  'IT Act 66C supported when offender fraudulently makes use of victim’s credentials/OTP/PIN',
  it66cPos?.isPrimaFacieSupported,
  true
);

// Test 5.10b: IT Act Section 66C - Victim's Own Credential Entry Under Deception (Crucial Negative Guard)
// A victim entering their own OTP/UPI PIN on their own device does NOT unlock Section 66C
const factsVictimOwnEntry = {
  ...factsCheating,
  hasUnauthorizedUseOfPasswordOrPin: true,
  hasOffenderUsedAnotherPersonsCredentials: false,
  isVictimOwnCredentialEntryUnderDeception: true, // Victim lured into entering their own PIN/OTP
};
const resVictimOwnEntry = evaluateOffenceApplicability(factsVictimOwnEntry);
const it66cVictimOwn = resVictimOwnEntry.assessedOffences.find((o) => o.catalogueId === 'IT-66C');
const bns318PushPayment = resVictimOwnEntry.assessedOffences.find((o) => o.catalogueId === 'BNS-318-4');
assert(
  it66cVictimOwn?.isPrimaFacieSupported === false &&
    bns318PushPayment?.isPrimaFacieSupported === true &&
    it66cVictimOwn.evidentiaryNote.includes('victim entering or approving their own OTP or UPI PIN under deceptive inducement does not constitute identity theft'),
  'CRUCIAL GUARD: Victim’s own credential entry under deception rejects IT Act 66C (governed by BNS 318(4) cheating)',
  it66cVictimOwn?.isPrimaFacieSupported,
  false
);

// Test 5.11: IT Act Section 66D - Cheating by Personation using Computer Resource (Positive & Negative)
const facts66D = {
  ...factsPersonation,
  hasComputerResourceUsedForImpersonation: true,
};
const res66D = evaluateOffenceApplicability(facts66D);
const it66dPos = res66D.assessedOffences.find((o) => o.catalogueId === 'IT-66D');
const it66dNeg = resPersonation.assessedOffences.find((o) => o.catalogueId === 'IT-66D'); // No computer resource
assert(
  it66dPos?.isPrimaFacieSupported === true &&
    it66dNeg?.isPrimaFacieSupported === false,
  'IT Act 66D supported when cheating + personation + computer resource; rejected when computer resource is absent',
  it66dPos?.isPrimaFacieSupported,
  true
);

// -----------------------------------------------------------------------------
// TEST SUITE 6: OFFICIAL SOURCE URLS & CATALOGUE TRACEABILITY
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 6: Source Traceability & Exact Provision Metadata ---');

// Test 6.1: Exact RBI Master Direction URL id=13140
assert(
  RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-67'].officialSourceUrl ===
    'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13140',
  'RBI Para 67 URL is exactly https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13140',
  RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-67'].officialSourceUrl,
  'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13140'
);

// Test 6.2: Exact BNS Act and Section Metadata
assert(
  BNS_CATALOGUE['BNS-318-4'].actTitle === 'Bharatiya Nyaya Sanhita, 2023' &&
    BNS_CATALOGUE['BNS-318-4'].actNumberAndYear === 'Act No. 45 of 2023' &&
    BNS_CATALOGUE['BNS-318-4'].sectionNumber === 'Section 318(4)' &&
    BNS_CATALOGUE['BNS-318-4'].commencementDate === '2024-07-01' &&
    BNS_CATALOGUE['BNS-318-4'].officialSourceUrl === 'https://www.indiacode.nic.in/handle/123456789/2189',
  'BNS 318(4) metadata verified: exact Act title, Act number, section, effective date, and URL',
  true,
  true
);

// Test 6.3: Exact IPC Act and Section Metadata
assert(
  IPC_LEGACY_CATALOGUE['IPC-420'].actTitle === 'Indian Penal Code, 1860' &&
    IPC_LEGACY_CATALOGUE['IPC-420'].actNumberAndYear === 'Act No. 45 of 1860' &&
    IPC_LEGACY_CATALOGUE['IPC-420'].sectionNumber === 'Section 420' &&
    IPC_LEGACY_CATALOGUE['IPC-420'].officialSourceUrl === 'https://www.indiacode.nic.in/handle/123456789/2263',
  'IPC 420 metadata verified: exact Act title, Act number, section, and URL',
  true,
  true
);

// Test 6.4: Exact IT Act Metadata
assert(
  IT_ACT_CATALOGUE['IT-66C'].actTitle === 'Information Technology Act, 2000' &&
    IT_ACT_CATALOGUE['IT-66C'].actNumberAndYear === 'Act No. 21 of 2000' &&
    IT_ACT_CATALOGUE['IT-66C'].sectionNumber === 'Section 66C' &&
    IT_ACT_CATALOGUE['IT-66C'].officialSourceUrl === 'https://www.indiacode.nic.in/handle/123456789/1999',
  'IT Act 66C metadata verified: exact Act title, Act number, section, and URL',
  true,
  true
);

// Test 6.5: Exact CPA Metadata
assert(
  CPA_CATALOGUE['CPA-35'].actTitle === 'Consumer Protection Act, 2019' &&
    CPA_CATALOGUE['CPA-35'].actNumberAndYear === 'Act No. 35 of 2019' &&
    CPA_CATALOGUE['CPA-35'].sectionNumber === 'Section 35' &&
    CPA_CATALOGUE['CPA-35'].officialSourceUrl === 'https://www.indiacode.nic.in/handle/123456789/15256',
  'CPA Section 35 metadata verified: exact Act title, Act number, section, and URL',
  true,
  true
);

// Test 6.6: Metadata Non-Exhaustiveness and Date Audit
assert(
  STATUTORY_CATALOGUE_METADATA.isExhaustive === false &&
    STATUTORY_CATALOGUE_METADATA.rbiMasterDirectionUpdatedDate === '2026-10-01' &&
    STATUTORY_CATALOGUE_METADATA.rbiAmendmentCommencementDate === '2027-01-01',
  'Catalogue metadata records 1 October 2026 update date and 1 January 2027 amendment date',
  true,
  true
);

// -----------------------------------------------------------------------------
// TEST SUITE 7: HONEST FACT CERTAINTY TAXONOMY
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 7: Five-Tier Evidence Certainty Taxonomy ---');

assert(
  evaluateFactCertainty(true, false, false, false) === 'alleged_in_citizen_statement',
  'Allegation without document is "alleged_in_citizen_statement"',
  evaluateFactCertainty(true, false, false, false),
  'alleged_in_citizen_statement'
);

assert(
  evaluateFactCertainty(true, true, false, false) === 'referenced_in_attached_document',
  'Attached document matching category is "referenced_in_attached_document"',
  evaluateFactCertainty(true, true, false, false),
  'referenced_in_attached_document'
);

assert(
  evaluateFactCertainty(true, true, true, false) === 'document_content_requires_forensic_review',
  'Technical claim requiring server/device audit is "document_content_requires_forensic_review"',
  evaluateFactCertainty(true, true, true, false),
  'document_content_requires_forensic_review'
);

assert(
  evaluateFactCertainty(false, false, false, false) === 'missing_or_unsubstantiated',
  'Absence of narrative and document is "missing_or_unsubstantiated"',
  evaluateFactCertainty(false, false, false, false),
  'missing_or_unsubstantiated'
);

assert(
  evaluateFactCertainty(true, true, false, true) === 'uncertain_requires_investigation',
  'Contradictory dates or records yield "uncertain_requires_investigation"',
  evaluateFactCertainty(true, true, false, true),
  'uncertain_requires_investigation'
);

// -----------------------------------------------------------------------------
// FINAL SUMMARY
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
console.log('======================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
