/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// =============================================================================
// NIVARANSETU LEGAL ANALYSIS ENGINE
// Pure evaluation utilities for financial crime analysis, event-level temporal
// jurisdiction classification, conditional RBI customer protection evaluation,
// Consumer Protection Act eligibility, and evidence certainty taxonomy.
// =============================================================================

import {
  BNS_CATALOGUE,
  IPC_LEGACY_CATALOGUE,
  IT_ACT_CATALOGUE,
  CPA_CATALOGUE,
  RBI_COMMERCIAL_BANKS_CATALOGUE,
  StatutoryCatalogueEntry,
  RbiParagraphEntry,
} from '../data/statutoryCatalogue';

// -----------------------------------------------------------------------------
// TYPES & INTERFACES
// -----------------------------------------------------------------------------

export type TimelineEventType =
  // Substantive offending acts (used for criminal temporal jurisdiction)
  | 'initial_contact'
  | 'deceptive_inducement'
  | 'credential_disclosure'
  | 'unauthorized_access'
  | 'unauthorized_debit'
  // Administrative milestones (STRICTLY EXCLUDED from criminal temporal classification)
  | 'discovery'
  | 'bank_notification'
  | 'police_report';

export interface TimelineEventItem {
  id: string;
  date: string; // ISO format or YYYY-MM-DD
  title: string;
  description: string;
  eventType: TimelineEventType;
}

export type TemporalJurisdictionStatus =
  | 'GOVERNED_BY_IPC_1860'
  | 'GOVERNED_BY_BNS_2023'
  | 'REVIEW_NEEDED_SPANNING_CONDUCT'
  | 'REVIEW_NEEDED_UNDATED_CONDUCT';

export interface TemporalEvaluationResult {
  status: TemporalJurisdictionStatus;
  offendingEventDates: string[];
  excludedAdministrativeDates: { date: string; eventType: string }[];
  timelineCrossesBnsTransition: boolean;
  earliestOffendingDate?: string;
  latestOffendingDate?: string;
  applicableCriminalStatutes: StatutoryCatalogueEntry[];
  savingsProvisionsCited: StatutoryCatalogueEntry[];
  explanation: string;
}

export type InstitutionType =
  | 'scheduled_commercial_bank'
  | 'small_finance_bank'
  | 'payments_bank'
  | 'regional_rural_bank'
  | 'local_area_bank'
  | 'cooperative_bank'
  | 'nbfc'
  | 'ppi_wallet'
  | 'unknown';

export type PaymentAuthorizationNature =
  | 'unauthorised_transaction' // Debited without customer initiation or consent
  | 'authorised_payment_under_deception' // Customer voluntarily authorized 2FA/PIN transfer under false pretenses
  | 'uncertain_authorization';

export type CustomerNegligenceStatus =
  | 'no_negligence_alleged'
  | 'admitted_voluntary_negligence' // Citizen explicitly states they voluntarily shared OTP/PIN without deception
  | 'alleged_by_bank_unproven' // Bank asserts negligence; unproven under Paragraph 75
  | 'disputed_malware_or_remote_access'; // Trojan/APK or screen-share used; legal negligence is disputed

export type RbiAccountCategory =
  | 'bsbd' // ₹5,000 cap
  | 'standard_sb' // ₹10,000 cap
  | 'prepaid_or_gift_card' // ₹10,000 cap
  | 'msme_current_cc_od' // ₹10,000 cap
  | 'individual_current_cc_od_limit_up_to_25l' // ₹10,000 cap (Annual avg balance / limit up to ₹25 lakh)
  | 'credit_card_limit_up_to_5l' // ₹10,000 cap
  | 'all_other_current_cc_od' // ₹25,000 cap (Individual > ₹25L or non-MSME corporate)
  | 'credit_card_limit_above_5l' // ₹25,000 cap
  // Grouped aliases for backwards compatibility:
  | 'standard_sb_or_prepaid_or_limit_up_to_5l'
  | 'standard_sb_or_prepaid_or_msme_or_individual_current_limit_up_to_25l_or_card_5l'
  | 'current_or_credit_limit_above_5l';

export interface RbiEvaluationInput {
  involvedEntityType: InstitutionType;
  incidentDate: string; // YYYY-MM-DD (debit date)
  communicationReceivedDate?: string; // Date bank sent alert/SMS (Day 0)
  notificationDate?: string; // Date citizen informed bank
  paymentNature: PaymentAuthorizationNature;
  isBankDeficiencyOrFraudAlleged: boolean;
  customerNegligenceStatus: CustomerNegligenceStatus;
  workingDaysFromCommunication?: number; // Calculated strictly excluding receipt date
  accountType?: RbiAccountCategory;
}

export type RbiLiabilityTier =
  | 'zero_liability_bank_fault'
  | 'zero_liability_prompt_report'
  | 'limited_liability_delay_4_to_7_days'
  | 'full_loss_customer_negligence_until_reported'
  | 'board_policy_delay_over_7_days'
  | 'authorised_payment_not_covered_under_unauthorised_framework'
  | 'communication_date_unknown_cannot_calculate_reporting_window'
  | 'institution_scope_mismatch'
  | 'unsupported_post_2026_framework'
  | 'undetermined';

export interface RbiEvaluationResult {
  tier: RbiLiabilityTier;
  applicableParagraphs: RbiParagraphEntry[];
  isCommercialBankCovered: boolean;
  isUnsupportedPost2026: boolean;
  institutionScopeNotice?: string;
  maximumCustomerLiabilityAmount?: number;
  shadowCreditEntitlement: {
    eligible: boolean;
    mandatoryDeadlineDays: number;
    description: string;
  };
  grievanceResolutionDeadlineDays: number;
  burdenOfProofNotice: string;
  plainLanguageSummary: string;
  calculationBasisNotice: string;
}

export interface CpaEvaluationInput {
  hasConsumerServiceProviderRelationship: boolean;
  respondentEntityName: string;
  respondentRole: 'service_provider_platform' | 'anonymous_fraudster' | 'unknown';
  allegedDeficiencies: string[];
}

export interface CpaEvaluationResult {
  isEligible: boolean;
  applicableProvisions: StatutoryCatalogueEntry[];
  reasoning: string;
  recommendedForum?: string;
}

export type FactCertaintyStatus =
  | 'alleged_in_citizen_statement'
  | 'referenced_in_attached_document'
  | 'document_content_requires_forensic_review'
  | 'missing_or_unsubstantiated'
  | 'uncertain_requires_investigation';

export interface CaseFactualContext {
  hasDeceptiveCommunication: boolean; // e.g. fraudulent lure, fake call, deceptive email
  hasDishonestInducement: boolean; // false promise or misleading claim inducing delivery/transfer
  hasDeliveryOfPropertyOrDebit: boolean; // funds transferred or wrongful monetary loss suffered
  hasImpersonationOfPersonOrAuthority: boolean; // pretended to be bank officer, police, courier, etc.
  hasPriorEntrustmentOfProperty: boolean; // property entrusted in any manner or dominion over property
  allegedOffenderQualifyingCapacity?: string; // capacity of offender: 'public servant' | 'banker' | 'merchant' | 'factor' | 'broker' | 'attorney' | 'agent'
  respondentInstitutionName?: string; // e.g. 'State Bank of India' (institution identity alone does NOT establish offender capacity)
  hasFabricatedDocumentOrElectronicRecord: boolean; // false document or fake electronic record created under Section 335
  intentToCheatWithFabricatedDocument: boolean; // forged document intended for cheating
  isValuableSecurityOrWillForged?: boolean; // will, bill of exchange, valuable security
  isReceiptOrAcquittanceAcknowledgingPaymentForged?: boolean; // acquittance or receipt acknowledging payment of money (expressly covered under Section 338)
  isDocumentOfCoveredDescriptionUnder338?: boolean; // document/record of description covered under Section 338
  isUnverifiedImageOrGenuineScreenshotOnly?: boolean; // genuine screenshot or unverified image without Section 335 false document fabrication
  hasUnauthorizedUseOfPasswordOrPin: boolean; // General credential compromise indicator
  hasOffenderUsedAnotherPersonsCredentials?: boolean; // Offender fraudulently/dishonestly used victim's password, OTP, or PIN
  isVictimOwnCredentialEntryUnderDeception?: boolean; // Victim entered/approved their own PIN/OTP under deceptive lure
  hasComputerResourceUsedForImpersonation: boolean; // spoofed portal, fake SMS header, phishing site
  hasSuspiciousUrlOrApkOnly: boolean; // ONLY a suspicious link/APK without established deception
  hasReportedDebitOnly: boolean; // ONLY an unexplained debit without deception or entrustment established
}

export interface OffenceAssessmentItem {
  catalogueId: string;
  actTitle: string;
  sectionNumber: string;
  provisionTitle: string;
  isPrimaFacieSupported: boolean;
  prescribedPunishment: string;
  establishedIngredients: string[];
  missingIngredients: string[];
  evidentiaryNote: string;
}

export interface OffenceAssessmentResult {
  assessedOffences: OffenceAssessmentItem[];
  cautionaryNotice: string;
}

// -----------------------------------------------------------------------------
// 1. EVENT-LEVEL TEMPORAL JURISDICTION EVALUATION
// -----------------------------------------------------------------------------
const BNS_TRANSITION_DATE = '2024-07-01';

/**
 * Evaluates whether an incident is governed by IPC 1860, BNS 2023, or spans across.
 *
 * CRUCIAL LEGAL REQUIREMENT:
 * Under Article 20(1) of the Constitution of India, criminal offences are governed
 * strictly by the substantive law in force on the date the OFFENCE WAS COMMITTED.
 *
 * The date the citizen DISCOVERED the crime or REPORTED it to their bank/police
 * is an administrative milestone and is STRICTLY EXCLUDED from deciding whether
 * the IPC or BNS applies.
 */
export function evaluateTemporalJurisdiction(
  events: TimelineEventItem[]
): TemporalEvaluationResult {
  const offendingDates: string[] = [];
  const excludedAdminDates: { date: string; eventType: string }[] = [];

  for (const ev of events) {
    if (!ev.date || !ev.date.trim()) continue;
    const cleanDate = ev.date.trim().substring(0, 10);

    if (
      ev.eventType === 'initial_contact' ||
      ev.eventType === 'deceptive_inducement' ||
      ev.eventType === 'credential_disclosure' ||
      ev.eventType === 'unauthorized_access' ||
      ev.eventType === 'unauthorized_debit'
    ) {
      offendingDates.push(cleanDate);
    } else {
      // Excluded: discovery, bank_notification, police_report
      excludedAdminDates.push({ date: cleanDate, eventType: ev.eventType });
    }
  }

  // Sort offending dates chronologically
  offendingDates.sort();

  if (offendingDates.length === 0) {
    return {
      status: 'REVIEW_NEEDED_UNDATED_CONDUCT',
      offendingEventDates: [],
      excludedAdministrativeDates: excludedAdminDates,
      timelineCrossesBnsTransition: false,
      applicableCriminalStatutes: [],
      savingsProvisionsCited: [],
      explanation:
        'No valid dated offending acts (initial contact, deception, credential disclosure, access, or debits) were identified. Criminal temporal jurisdiction requires verification of when the offending acts occurred.',
    };
  }

  const earliestDate = offendingDates[0];
  const latestDate = offendingDates[offendingDates.length - 1];

  const hasPreBnsEvent = offendingDates.some((d) => d < BNS_TRANSITION_DATE);
  const hasPostBnsEvent = offendingDates.some((d) => d >= BNS_TRANSITION_DATE);
  const crossesTransition = hasPreBnsEvent && hasPostBnsEvent;

  // Case 1: Conduct strictly prior to 1 July 2024
  if (hasPreBnsEvent && !hasPostBnsEvent) {
    return {
      status: 'GOVERNED_BY_IPC_1860',
      offendingEventDates: offendingDates,
      excludedAdministrativeDates: excludedAdminDates,
      timelineCrossesBnsTransition: false,
      earliestOffendingDate: earliestDate,
      latestOffendingDate: latestDate,
      applicableCriminalStatutes: [
        IPC_LEGACY_CATALOGUE['IPC-420'],
        IPC_LEGACY_CATALOGUE['IPC-419'],
        IPC_LEGACY_CATALOGUE['IPC-406'],
        IPC_LEGACY_CATALOGUE['IPC-468'],
        IT_ACT_CATALOGUE['IT-66C'],
        IT_ACT_CATALOGUE['IT-66D'],
      ],
      savingsProvisionsCited: [
        BNS_CATALOGUE['BNS-358'],
        {
          catalogueId: 'GCA-6',
          actTitle: 'General Clauses Act, 1897',
          actNumberAndYear: 'Act No. 10 of 1897',
          sectionNumber: 'Section 6',
          provisionTitle: 'Effect of repeal',
          commencementDate: '1897-03-11',
          versionStatus: 'savings_clause',
          officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2262',
          sourceAuthority: 'Gazette of India / India Code',
          summaryPlainLanguage: 'Saves accrued liabilities and ongoing proceedings under repealed IPC.',
          prescribedPunishment: {
            imprisonmentTerm: 'None',
            fineAmount: 'None',
            punishmentType: 'regulatory_liability_direction',
          },
          statutoryIngredients: ['Repeal of enactment', 'Preservation of pre-existing liabilities'],
          isSavingsOrInterpretationProvision: true,
        },
      ],
      explanation: `All recorded offending acts occurred between ${earliestDate} and ${latestDate}, strictly prior to the commencement of the Bharatiya Nyaya Sanhita, 2023 on 1 July 2024. Consequently, substantive penal liability is governed by the Indian Penal Code, 1860, as preserved by Section 358 BNS and Section 6 of the General Clauses Act, 1897.`,
    };
  }

  // Case 2: Conduct strictly on or after 1 July 2024
  if (!hasPreBnsEvent && hasPostBnsEvent) {
    return {
      status: 'GOVERNED_BY_BNS_2023',
      offendingEventDates: offendingDates,
      excludedAdministrativeDates: excludedAdminDates,
      timelineCrossesBnsTransition: false,
      earliestOffendingDate: earliestDate,
      latestOffendingDate: latestDate,
      applicableCriminalStatutes: [
        BNS_CATALOGUE['BNS-318-4'],
        BNS_CATALOGUE['BNS-319-2'],
        BNS_CATALOGUE['BNS-316-2'],
        BNS_CATALOGUE['BNS-336-3'],
        IT_ACT_CATALOGUE['IT-66C'],
        IT_ACT_CATALOGUE['IT-66D'],
      ],
      savingsProvisionsCited: [],
      explanation: `All recorded offending acts occurred between ${earliestDate} and ${latestDate}, on or after 1 July 2024. Substantive penal liability is governed exclusively by the Bharatiya Nyaya Sanhita, 2023 and the Information Technology Act, 2000.`,
    };
  }

  // Case 3: Spanning Conduct crossing 1 July 2024
  return {
    status: 'REVIEW_NEEDED_SPANNING_CONDUCT',
    offendingEventDates: offendingDates,
    excludedAdministrativeDates: excludedAdminDates,
    timelineCrossesBnsTransition: true,
    earliestOffendingDate: earliestDate,
    latestOffendingDate: latestDate,
    applicableCriminalStatutes: [
      // Both sets provided for comparative legal reference, NOT dual charging
      IPC_LEGACY_CATALOGUE['IPC-420'],
      BNS_CATALOGUE['BNS-318-4'],
      IT_ACT_CATALOGUE['IT-66C'],
      IT_ACT_CATALOGUE['IT-66D'],
    ],
    savingsProvisionsCited: [
      BNS_CATALOGUE['BNS-358'],
      {
        catalogueId: 'GCA-6',
        actTitle: 'General Clauses Act, 1897',
        actNumberAndYear: 'Act No. 10 of 1897',
        sectionNumber: 'Section 6',
        provisionTitle: 'Effect of repeal',
        commencementDate: '1897-03-11',
        versionStatus: 'savings_clause',
        officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2262',
        sourceAuthority: 'Gazette of India / India Code',
        summaryPlainLanguage: 'Saves accrued liabilities and ongoing proceedings under repealed IPC.',
        prescribedPunishment: {
          imprisonmentTerm: 'None',
          fineAmount: 'None',
          punishmentType: 'regulatory_liability_direction',
        },
        statutoryIngredients: ['Repeal of enactment', 'Preservation of pre-existing liabilities'],
        isSavingsOrInterpretationProvision: true,
      },
    ],
    explanation: `Offending events span across the 1 July 2024 transition threshold (beginning ${earliestDate} under the IPC and concluding ${latestDate} under the BNS). Section 358 BNS and Section 6 of the General Clauses Act, 1897 are repeal-and-savings provisions only; they do not authorize dual charging or cumulative prosecution for the same ongoing continuous transaction. In Indian law, whether cheating crystallizes at the moment of initial fraudulent inducement (pre-July 2024) or upon realization of unauthorized fund debits (post-July 2024) is a matter of judicial determination. The appropriate penal charges are formulated by the investigating police officer and the Public Prosecutor. Both frameworks are presented for comparative reference without prescribing dual charges.`,
  };
}

// -----------------------------------------------------------------------------
// 2. CONDITIONAL RBI REGULATORY REMEDIES EVALUATION
// -----------------------------------------------------------------------------
/**
 * Evaluates banking remedies strictly under the Reserve Bank of India (Responsible
 * Business Conduct — Customer Service and Protection) Directions, 2025 (Commercial Banks).
 *
 * INSTITUTIONAL SCOPE:
 * Covers strictly Scheduled Commercial Banks (excluding Regional Rural Banks,
 * Small Finance Banks, Payments Banks, and Local Area Banks).
 *
 * DATE CALCULATION RULE:
 * 3-day and 4-7 day windows are calculated STRICTLY from the date of receipt of
 * communication from the bank (alert/SMS/email), EXCLUDING the date of receipt (Day 0).
 * They are NEVER calculated automatically from the transaction debit date.
 */
export function evaluateRbiRegulatoryRemedies(input: RbiEvaluationInput): RbiEvaluationResult {
  // 1. Institution Scope Check: Strictly Commercial Banks (excluding SFBs, Payments Banks, RRBs, LABs)
  if (input.involvedEntityType !== 'scheduled_commercial_bank') {
    let scopeNotice =
      'The Commercial Banks Directions (updated 1 October 2026, Master Direction No. 13140) apply strictly to Commercial Banks, excluding Small Finance Banks, Payments Banks, Regional Rural Banks, and Local Area Banks. ';

    if (input.involvedEntityType === 'small_finance_bank') {
      scopeNotice +=
        'Small Finance Banks are governed by separate RBI Directions for SFBs and are not covered under this commercial bank catalogue entry.';
    } else if (input.involvedEntityType === 'payments_bank') {
      scopeNotice +=
        'Payments Banks are governed by separate RBI Operating Guidelines for Payments Banks and are not covered under this commercial bank catalogue entry.';
    } else if (input.involvedEntityType === 'regional_rural_bank') {
      scopeNotice +=
        'Regional Rural Banks are governed by separate statutory circulars and are excluded from the commercial bank framework.';
    } else if (input.involvedEntityType === 'local_area_bank') {
      scopeNotice +=
        'Local Area Banks are excluded from the commercial bank Master Directions.';
    } else if (input.involvedEntityType === 'cooperative_bank') {
      scopeNotice +=
        'Co-operative Banks (UCBs/StCBs/DCCBs) are governed by separate Co-operative Banking Directions.';
    } else if (input.involvedEntityType === 'ppi_wallet') {
      scopeNotice +=
        'Prepaid Payment Instruments / Digital Wallets: A generic wallet label cannot automatically determine the applicable framework without establishing whether the instrument is bank-issued or issued by a non-bank entity under the Master Directions on PPIs.';
    } else {
      scopeNotice +=
        'The institution type is unverified. Verify whether your financial institution is a Scheduled Commercial Bank or an excluded entity (SFB, Payments Bank, RRB, or Co-operative).';
    }

    return {
      tier: 'institution_scope_mismatch',
      applicableParagraphs: [],
      isCommercialBankCovered: false,
      isUnsupportedPost2026: false,
      institutionScopeNotice: scopeNotice,
      shadowCreditEntitlement: {
        eligible: false,
        mandatoryDeadlineDays: 0,
        description: 'Commercial Bank Directions not directly applicable.',
      },
      grievanceResolutionDeadlineDays: 0,
      burdenOfProofNotice: 'Check applicable sector guidelines for burden of proof rules.',
      plainLanguageSummary:
        'The Commercial Bank Master Directions do not govern this institution type directly.',
      calculationBasisNotice:
        'Reporting windows are inapplicable due to institutional scope mismatch.',
    };
  }

  // 2. Framework Versioning Check (Post-1 January 2027)
  const incidentYear = parseInt(input.incidentDate.substring(0, 4), 10);
  if (incidentYear >= 2027) {
    return {
      tier: 'unsupported_post_2026_framework',
      applicableParagraphs: [],
      isCommercialBankCovered: true,
      isUnsupportedPost2026: true,
      institutionScopeNotice:
        'Transactions occurring on or after 1 January 2027 fall under the revised RBI Customer Service & Protection Framework replacing Chapter Paragraphs 64–76. NivaranSetu does not evaluate post-2026 transactions under the older framework. RBI regulatory analysis is suspended for this case until the consolidated 2027 catalogue is activated.',
      shadowCreditEntitlement: {
        eligible: false,
        mandatoryDeadlineDays: 0,
        description: 'Post-2026 transactions require 2027 framework activation.',
      },
      grievanceResolutionDeadlineDays: 0,
      burdenOfProofNotice: '2027 framework pending activation.',
      plainLanguageSummary:
        'Post-1 January 2027 transactions cannot be evaluated under the 2025/2026 catalogue.',
      calculationBasisNotice:
        'Calculation suspended pending 2027 framework activation.',
    };
  }

  // 3. Payment Nature Check: Authorized Payment under Deception vs Unauthorized Transaction
  if (input.paymentNature === 'authorised_payment_under_deception') {
    return {
      tier: 'authorised_payment_not_covered_under_unauthorised_framework',
      applicableParagraphs: [],
      isCommercialBankCovered: true,
      isUnsupportedPost2026: false,
      institutionScopeNotice:
        'Authorized Payment under Deception (Push-Payment / APP Scam): The customer voluntarily initiated and approved the transaction with their credentials (e.g. UPI PIN / OTP) under deceptive inducement. Under current RBI Master Directions, voluntary authorized transfers are not automatically equivalent to unauthorized electronic banking transactions. Unless a bank technical deficiency, defective multi-factor authentication, or failure to act on account-freeze notice is established, the zero-liability rules under Paragraph 67 do not apply automatically. The primary criminal remedy is under BNS Section 318(4) (Cheating) where dishonest inducement is established, and under IT Act Section 66D only where personation through a computer resource is independently substantiated.',
      shadowCreditEntitlement: {
        eligible: false,
        mandatoryDeadlineDays: 0,
        description:
          'Shadow reversal under Paragraph 72 applies to unauthorized transactions, not customer-authorized transfers under deception.',
      },
      grievanceResolutionDeadlineDays: 90,
      burdenOfProofNotice:
        'If the citizen alleges that the bank’s security controls or 2FA failed, that specific deficiency must be investigated.',
      plainLanguageSummary:
        'Because the payment was authorized by the customer with full 2FA credentials under deception, it does not automatically qualify as an unauthorized electronic transaction under Paragraphs 67–75.',
      calculationBasisNotice:
        'Liability matrix applies to unauthorized transactions, not authorized payments under deception.',
    };
  }

  // 4. Communication Receipt Check: Window runs from receipt of communication, NOT debit date
  if (!input.communicationReceivedDate && input.workingDaysFromCommunication === undefined) {
    return {
      tier: 'communication_date_unknown_cannot_calculate_reporting_window',
      applicableParagraphs: [
        RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-71'],
        RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-75'],
      ],
      isCommercialBankCovered: true,
      isUnsupportedPost2026: false,
      institutionScopeNotice:
        'Communication Receipt Date Unknown: The 3-day and 4–7-day customer reporting windows under Paragraph 71 cannot be calculated from the supplied facts because the exact date the customer received communication from the bank (SMS or email alert) is unrecorded. The reporting window is not calculated from the debit date. Bank delivery records (such as SMS gateway delivery timestamps or telecom logs) may be needed to establish when communication was received.',
      shadowCreditEntitlement: {
        eligible: true,
        mandatoryDeadlineDays: 10,
        description:
          'Shadow reversal entitlement under Paragraph 72 requires verification of when notification was provided relative to bank communication.',
      },
      grievanceResolutionDeadlineDays: 90,
      burdenOfProofNotice:
        'Under Paragraph 75, the burden of proving the date and delivery of transaction alerts lies on the bank.',
      plainLanguageSummary:
        'The reporting window cannot be calculated without the date of receipt of communication from the bank. Bank delivery records may be required.',
      calculationBasisNotice:
        'Communication receipt date unknown; reporting window cannot be calculated without bank delivery records.',
    };
  }

  // 5. Substantive Liability Assessment (2025/2026 Regime)
  const paras: RbiParagraphEntry[] = [
    RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-71'],
    RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-72'],
    RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-73'],
    RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-75'],
  ];

  // Bank deficiency/fraud has absolute zero liability
  if (input.isBankDeficiencyOrFraudAlleged) {
    paras.unshift(RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-67']);
    return {
      tier: 'zero_liability_bank_fault',
      applicableParagraphs: paras,
      isCommercialBankCovered: true,
      isUnsupportedPost2026: false,
      maximumCustomerLiabilityAmount: 0,
      shadowCreditEntitlement: {
        eligible: true,
        mandatoryDeadlineDays: 10,
        description:
          'Mandatory shadow reversal of disputed sum within 10 working days of customer notification (Paragraph 72).',
      },
      grievanceResolutionDeadlineDays: 90,
      burdenOfProofNotice:
        'Under Paragraph 75, the burden of proving customer liability or negligence lies on the bank.',
      plainLanguageSummary:
        'Because fraud, negligence, or deficiency is alleged on the part of the bank, the customer has ZERO liability irrespective of whether or when the transaction was reported (Paragraph 67(a)). The bank must credit the disputed amount within 10 working days.',
      calculationBasisNotice:
        'Zero liability under Paragraph 67(a) applies irrespective of reporting timeframe.',
    };
  }

  // Customer negligence bars zero liability ONLY when admitted or legally proven
  if (input.customerNegligenceStatus === 'admitted_voluntary_negligence') {
    paras.unshift(RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-68']);
    return {
      tier: 'full_loss_customer_negligence_until_reported',
      applicableParagraphs: paras,
      isCommercialBankCovered: true,
      isUnsupportedPost2026: false,
      shadowCreditEntitlement: {
        eligible: false,
        mandatoryDeadlineDays: 10,
        description:
          'In cases of customer negligence, customer bears the entire loss until reported (Paragraph 68(1)). Losses occurring AFTER reporting are borne by the bank.',
      },
      grievanceResolutionDeadlineDays: 90,
      burdenOfProofNotice:
        'The bank carries the legal burden under Paragraph 75 to substantiate negligence. While voluntary sharing of credentials was admitted, any debits occurring after notification must be reimbursed by the bank.',
      plainLanguageSummary:
        'Where loss is due to customer negligence (sharing credentials like OTP, UPI PIN, password), the customer bears the entire loss until the unauthorized transaction is reported to the bank. Reporting within 3 days does NOT grant zero liability if credentials were compromised by customer negligence.',
      calculationBasisNotice:
        'Customer negligence bars zero liability until reporting date.',
    };
  }

  // If bank merely alleges negligence or malware/remote-access was used,
  // do NOT automatically classify as legally established negligence!
  let negligenceNotice = '';
  if (input.customerNegligenceStatus === 'disputed_malware_or_remote_access') {
    negligenceNotice =
      'Remote Access / Malicious APK Intervention: Installing an application or remote access software does NOT automatically constitute legally established customer negligence. Under Paragraph 75, the legal burden remains on the bank to prove that the customer was negligent. Disputed technical claims are treated as a third-party breach pending bank forensic proof.';
  } else if (input.customerNegligenceStatus === 'alleged_by_bank_unproven') {
    negligenceNotice =
      'Unproven Bank Allegation: The bank’s unilateral assertion of credential compromise does NOT establish customer negligence. Under Paragraph 75, the legal onus rests on the bank.';
  }

  // Third-party breach with prompt reporting (within 3 working days from communication)
  const delayDays = input.workingDaysFromCommunication ?? 1;
  const calcNotice = `Working days calculated from receipt of bank communication (excluding communication date as Day 0 and holidays): ${delayDays} working day(s). ${negligenceNotice}`;

  if (delayDays <= 3) {
    paras.unshift(RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-67']);
    return {
      tier: 'zero_liability_prompt_report',
      applicableParagraphs: paras,
      isCommercialBankCovered: true,
      isUnsupportedPost2026: false,
      maximumCustomerLiabilityAmount: 0,
      shadowCreditEntitlement: {
        eligible: true,
        mandatoryDeadlineDays: 10,
        description:
          'Mandatory shadow credit of disputed amount within 10 working days from notification (Paragraph 72).',
      },
      grievanceResolutionDeadlineDays: 90,
      burdenOfProofNotice:
        'The burden of proving customer liability lies entirely on the bank (Paragraph 75).',
      plainLanguageSummary:
        'Because the deficiency lies in a third-party breach elsewhere in the system and was reported within 3 working days of receiving bank communication, the customer has ZERO liability (Paragraph 67(b)). The bank must provide shadow credit within 10 working days.',
      calculationBasisNotice: calcNotice,
    };
  }

  // Third-party breach with 4 to 7 working days delay from communication
  // Table 1 exact thresholds:
  // ₹5,000: BSBD
  // ₹10,000: All other SB, Pre-paid/Gift Cards, MSME Current/CC/OD, Individual Current/CC/OD limit up to ₹25 lakh, Credit Cards limit up to ₹5 lakh
  // ₹25,000: All other Current/CC/OD (Individual > ₹25L or corporate other than MSME), Credit Cards limit above ₹5 lakh
  if (delayDays >= 4 && delayDays <= 7) {
    paras.unshift(RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-68']);
    let capAmount = 10000;
    if (input.accountType === 'bsbd') {
      capAmount = 5000;
    } else if (
      input.accountType === 'all_other_current_cc_od' ||
      input.accountType === 'credit_card_limit_above_5l' ||
      input.accountType === 'current_or_credit_limit_above_5l'
    ) {
      capAmount = 25000;
    }

    return {
      tier: 'limited_liability_delay_4_to_7_days',
      applicableParagraphs: paras,
      isCommercialBankCovered: true,
      isUnsupportedPost2026: false,
      maximumCustomerLiabilityAmount: capAmount,
      shadowCreditEntitlement: {
        eligible: true,
        mandatoryDeadlineDays: 10,
        description:
          'Bank must credit the excess amount beyond the maximum statutory liability cap within 10 working days (Paragraph 72).',
      },
      grievanceResolutionDeadlineDays: 90,
      burdenOfProofNotice:
        'The bank carries the legal burden of proof under Paragraph 75 to establish the delay.',
      plainLanguageSummary: `Third-party breach reported with a delay of 4 to 7 working days from receipt of bank communication. Customer liability is statutorily capped at a maximum of ₹${capAmount.toLocaleString('en-IN')} (Paragraph 68(2), Table 1). Any loss above this cap must be credited by the bank within 10 working days.`,
      calculationBasisNotice: calcNotice,
    };
  }

  // Reporting delay beyond 7 working days from communication
  paras.unshift(RBI_COMMERCIAL_BANKS_CATALOGUE['RBI-PARA-69']);
  return {
    tier: 'board_policy_delay_over_7_days',
    applicableParagraphs: paras,
    isCommercialBankCovered: true,
    isUnsupportedPost2026: false,
    shadowCreditEntitlement: {
      eligible: false,
      mandatoryDeadlineDays: 10,
      description: 'Customer liability is determined as per the bank’s Board-approved policy.',
    },
    grievanceResolutionDeadlineDays: 90,
    burdenOfProofNotice:
      'Bank must substantiate notification dates and Board policy terms under Paragraph 75.',
    plainLanguageSummary:
      'The transaction was reported beyond 7 working days of receiving bank communication. Customer liability is determined in accordance with the individual bank’s Board-approved policy (Paragraph 69).',
    calculationBasisNotice: calcNotice,
  };
}

// -----------------------------------------------------------------------------
// 3. CONSUMER PROTECTION ACT (CPA 2019) EVALUATOR
// -----------------------------------------------------------------------------
export function evaluateCpaEligibility(input: CpaEvaluationInput): CpaEvaluationResult {
  // If the respondent is strictly an anonymous fraudster, CPA does NOT apply
  if (input.respondentRole === 'anonymous_fraudster') {
    return {
      isEligible: false,
      applicableProvisions: [],
      reasoning:
        'A Consumer Protection Act claim cannot be filed against an anonymous cybercriminal or fraudster. CPA claims under Section 35 require an identifiable service provider with whom a consumer transaction occurred for consideration.',
    };
  }

  // Consumer relationship and alleged deficiency required
  if (
    input.hasConsumerServiceProviderRelationship &&
    input.allegedDeficiencies &&
    input.allegedDeficiencies.length > 0
  ) {
    return {
      isEligible: true,
      applicableProvisions: [
        CPA_CATALOGUE['CPA-2-7'],
        CPA_CATALOGUE['CPA-2-42'],
        CPA_CATALOGUE['CPA-2-11'],
        CPA_CATALOGUE['CPA-35'],
      ],
      reasoning: `The complainant has a consumer-service relationship under Section 2(7) for services defined under Section 2(42) against ${input.respondentEntityName}, and alleges specific service deficiencies under Section 2(11) (e.g. ${input.allegedDeficiencies.join(', ')}). A consumer complaint may be filed before the District Commission under Section 35.`,
      recommendedForum: 'District Consumer Disputes Redressal Commission (via e-Daakhil portal)',
    };
  }

  return {
    isEligible: false,
    applicableProvisions: [],
    reasoning:
      'To pursue remedies under the Consumer Protection Act, 2019, the citizen must establish a consumer relationship for consideration under Section 2(7) and allege specific deficiencies under Section 2(11) against the named service provider.',
  };
}

// -----------------------------------------------------------------------------
// 4. BNS 316(2) VS 316(5) SPECIFIC CAPACITY CHECK
// -----------------------------------------------------------------------------
export function evaluateBreachOfTrustApplicability(
  isEntrusted: boolean,
  capacityOfAccused: string
): { isApplicable: boolean; entry?: StatutoryCatalogueEntry; reason: string } {
  if (!isEntrusted) {
    return {
      isApplicable: false,
      reason:
        'Criminal breach of trust requires property entrusted in any manner, or dominion over property. If property was obtained via deception or fraudulent inducement from the inception without entrustment or dominion, Section 318(4) (Cheating) applies rather than breach of trust.',
    };
  }

  const normalized = capacityOfAccused.toLowerCase().trim();
  const qualifyingCapacities = [
    'public servant',
    'banker',
    'merchant',
    'factor',
    'broker',
    'attorney',
    'agent',
  ];

  const matchedCapacity = qualifyingCapacities.find((c) => normalized.includes(c));

  if (matchedCapacity) {
    return {
      isApplicable: true,
      entry: BNS_CATALOGUE['BNS-316-5'],
      reason: `The accused was entrusted with property in the specific capacity of a ${matchedCapacity}. Section 316(5) of BNS 2023 prescribes life imprisonment or imprisonment up to 10 years and fine for breach in this capacity.`,
    };
  }

  return {
    isApplicable: true,
    entry: BNS_CATALOGUE['BNS-316-2'],
    reason:
      'General criminal breach of trust under Section 316(2) BNS 2023 applies. (Punishment: up to 5 years, or fine, or both). The accused does not hold the specialized fiduciary capacities required for Section 316(5).',
  };
}

// -----------------------------------------------------------------------------
// 5. ESSENTIAL INGREDIENT CHECKER (PREVENTING FALSE INFERENCES)
// -----------------------------------------------------------------------------
/**
 * Evaluates prima facie applicability of all catalogue offences against factual ingredients:
 * BNS 318(4), 319(2), 316(2), 316(5), 336(2), 336(3), 338, IT Act 66C and 66D.
 *
 * CRUCIAL ANTI-HALLUCINATION SAFEGUARD:
 * The engine MUST NOT infer an offence merely from a suspicious URL, APK link,
 * reported debit, or respondent bank identity alone without established statutory ingredients.
 */
export function evaluateOffenceApplicability(facts: CaseFactualContext): OffenceAssessmentResult {
  const assessments: OffenceAssessmentItem[] = [];

  // Negative Guard: Merely a suspicious URL/APK or reported debit without facts
  const isUrlOnly = facts.hasSuspiciousUrlOrApkOnly;
  const isDebitOnly = facts.hasReportedDebitOnly;
  const isGenuineScreenshotOrUnverifiedImageOnly = Boolean(facts.isUnverifiedImageOrGenuineScreenshotOnly);

  // 1. BNS 318(4) - Cheating & Dishonestly Inducing Delivery
  const bns318IngredientsEstablished: string[] = [];
  const bns318IngredientsMissing: string[] = [];

  if (facts.hasDeceptiveCommunication && !isUrlOnly && !isDebitOnly) {
    bns318IngredientsEstablished.push('Deception practiced upon the complainant');
  } else {
    bns318IngredientsMissing.push('Deceptive communication or fraudulent representation');
  }

  if (facts.hasDishonestInducement && !isUrlOnly && !isDebitOnly) {
    bns318IngredientsEstablished.push('Dishonest or fraudulent inducement to deliver property');
  } else {
    bns318IngredientsMissing.push('Dishonest inducement causing the victim to act');
  }

  if (facts.hasDeliveryOfPropertyOrDebit && !isUrlOnly) {
    bns318IngredientsEstablished.push('Delivery of property or wrongful monetary debit');
  } else {
    bns318IngredientsMissing.push('Proof of property delivered or monetary loss suffered');
  }

  const bns318Supported = bns318IngredientsEstablished.length === 3;

  assessments.push({
    catalogueId: 'BNS-318-4',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    sectionNumber: 'Section 318(4)',
    provisionTitle: 'Cheating and dishonestly inducing delivery of property',
    isPrimaFacieSupported: bns318Supported,
    prescribedPunishment: 'Imprisonment up to 7 years, and shall also be liable to fine',
    establishedIngredients: bns318IngredientsEstablished,
    missingIngredients: bns318IngredientsMissing,
    evidentiaryNote: isUrlOnly
      ? 'A suspicious URL or APK link alone does not constitute cheating under Section 318(4) without proof of deceptive communication, inducement, and delivery of property.'
      : isDebitOnly
      ? 'An unexplained bank debit alone does not constitute cheating under Section 318(4) without established deceptive inducement.'
      : bns318Supported
      ? 'Prima facie supported by alleged deception, dishonest inducement, and delivery of property.'
      : 'Incomplete: Missing essential statutory ingredients of deception or inducement.',
  });

  // 2. BNS 319(2) - Cheating by Personation
  const bns319IngredientsEstablished: string[] = [];
  const bns319IngredientsMissing: string[] = [];

  if (bns318Supported) {
    bns319IngredientsEstablished.push('Underlying cheating under Section 318');
  } else {
    bns319IngredientsMissing.push('Underlying offence of cheating');
  }

  if (facts.hasImpersonationOfPersonOrAuthority && !isUrlOnly && !isDebitOnly) {
    bns319IngredientsEstablished.push('Cheating by personating another known, official, or fictitious persona');
  } else {
    bns319IngredientsMissing.push('Impersonation of an individual, official, or fictitious entity');
  }

  const bns319Supported = bns319IngredientsEstablished.length === 2;

  assessments.push({
    catalogueId: 'BNS-319-2',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    sectionNumber: 'Section 319(2)',
    provisionTitle: 'Cheating by personation',
    isPrimaFacieSupported: bns319Supported,
    prescribedPunishment: 'Imprisonment up to 5 years, or with fine, or with both',
    establishedIngredients: bns319IngredientsEstablished,
    missingIngredients: bns319IngredientsMissing,
    evidentiaryNote: bns319Supported
      ? 'Prima facie supported: Personation was specifically used to induce the victim to deliver property.'
      : 'Impersonation is not alleged; general cheating applies without the personation aggravation.',
  });

  // 3. BNS 316(2) - Criminal Breach of Trust (General)
  const bns316_2Established: string[] = [];
  const bns316_2Missing: string[] = [];

  if (facts.hasPriorEntrustmentOfProperty && !isUrlOnly && !isDebitOnly) {
    bns316_2Established.push('Property entrusted in any manner, or dominion over property');
    if (facts.hasDeliveryOfPropertyOrDebit) {
      bns316_2Established.push('Dishonest misappropriation, conversion, use, or disposal in violation of legal direction or contract');
    } else {
      bns316_2Missing.push('Dishonest misappropriation, conversion, or disposal of property');
    }
  } else {
    bns316_2Missing.push('Property entrusted in any manner or dominion over property (property was induced deceitfully from inception without entrustment)');
  }

  const bns316_2Supported = bns316_2Established.length === 2;

  assessments.push({
    catalogueId: 'BNS-316-2',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    sectionNumber: 'Section 316(2)',
    provisionTitle: 'Criminal breach of trust (General)',
    isPrimaFacieSupported: bns316_2Supported,
    prescribedPunishment: 'Imprisonment up to 5 years, or with fine, or with both',
    establishedIngredients: bns316_2Established,
    missingIngredients: bns316_2Missing,
    evidentiaryNote: !facts.hasPriorEntrustmentOfProperty
      ? 'Not applicable: Where property was dishonestly induced through deception from the inception without entrustment or dominion, Section 318(4) (Cheating) applies rather than Section 316 (Breach of Trust).'
      : bns316_2Supported
      ? 'Supported: Property was entrusted in any manner or dominion exercised, followed by dishonest misappropriation, conversion, use, or disposal in violation of legal direction or contract.'
      : 'Incomplete: Missing proof of dishonest misappropriation, conversion, or disposal.',
  });

  // 4. BNS 316(5) - Criminal Breach of Trust by Specific Capacities
  // MUST test offender's qualifying capacity, NOT merely respondent bank identity!
  const bns316_5Established: string[] = [];
  const bns316_5Missing: string[] = [];

  if (bns316_2Supported) {
    bns316_5Established.push('Underlying criminal breach of trust established');
  } else {
    bns316_5Missing.push('Underlying criminal breach of trust under Section 316(1)');
  }

  const qualifyingCapacities = [
    'public servant',
    'banker',
    'merchant',
    'factor',
    'broker',
    'attorney',
    'agent',
  ];
  const offenderCap = facts.allegedOffenderQualifyingCapacity?.toLowerCase().trim() || '';
  const hasQualifyingCapacity = qualifyingCapacities.some((c) => offenderCap.includes(c));

  if (hasQualifyingCapacity) {
    bns316_5Established.push(`Offender acted in statutory qualifying capacity: ${facts.allegedOffenderQualifyingCapacity}`);
  } else {
    bns316_5Missing.push(
      'Offender entrusted strictly in capacity as Public Servant, Banker, Merchant, Factor, Broker, Attorney, or Agent'
    );
  }

  const bns316_5Supported = bns316_5Established.length === 2;

  assessments.push({
    catalogueId: 'BNS-316-5',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    sectionNumber: 'Section 316(5)',
    provisionTitle:
      'Criminal breach of trust by public servant, or by banker, merchant, factor, broker, attorney or agent',
    isPrimaFacieSupported: bns316_5Supported,
    prescribedPunishment:
      'Imprisonment for life, or with imprisonment of either description for a term which may extend to 10 years, and fine',
    establishedIngredients: bns316_5Established,
    missingIngredients: bns316_5Missing,
    evidentiaryNote: facts.respondentInstitutionName && !hasQualifyingCapacity
      ? `The respondent entity (${facts.respondentInstitutionName}) being a bank does NOT establish Section 316(5). The alleged offender personally must have been entrusted with property strictly in the commercial capacity of a banker or agent.`
      : bns316_5Supported
      ? `Supported: Offender committed breach in the specific fiduciary capacity of a ${facts.allegedOffenderQualifyingCapacity}.`
      : 'Not applicable: Offender does not hold the statutory fiduciary capacities prescribed by Section 316(5).',
  });

  // 5. BNS 336(2) - Forgery (General)
  const bns336_2Established: string[] = [];
  const bns336_2Missing: string[] = [];

  if (
    facts.hasFabricatedDocumentOrElectronicRecord &&
    !isUrlOnly &&
    !isDebitOnly &&
    !isGenuineScreenshotOrUnverifiedImageOnly
  ) {
    bns336_2Established.push('Making of a false document or electronic record (Section 335)');
  } else if (isGenuineScreenshotOrUnverifiedImageOnly) {
    bns336_2Missing.push(
      'Fabrication of a false document or false electronic record (genuine screenshot or unverified image is insufficient)'
    );
  } else {
    bns336_2Missing.push('Fabrication of a false document or electronic record');
  }

  const bns336_2Supported = bns336_2Established.length === 1;

  assessments.push({
    catalogueId: 'BNS-336-2',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    sectionNumber: 'Section 336(2)',
    provisionTitle: 'Punishment for forgery (General)',
    isPrimaFacieSupported: bns336_2Supported,
    prescribedPunishment: 'Imprisonment up to 2 years, or with fine, or with both',
    establishedIngredients: bns336_2Established,
    missingIngredients: bns336_2Missing,
    evidentiaryNote: isGenuineScreenshotOrUnverifiedImageOnly
      ? 'A genuine screenshot or an unverified image alone does not establish forgery under Section 335 without proof of a fabricated false document or false electronic record.'
      : isUrlOnly
      ? 'A suspicious link or APK URL is not automatically a forged document under Section 335 without proof of a fabricated false document or false electronic record.'
      : bns336_2Supported
      ? 'Supported by fabrication of false document or electronic record.'
      : 'Incomplete: No fabricated document or false electronic record alleged.',
  });

  // 6. BNS 336(3) - Forgery for Purpose of Cheating
  const bns336_3Established: string[] = [];
  const bns336_3Missing: string[] = [];

  if (bns336_2Supported) {
    bns336_3Established.push('Commission of forgery under Section 335');
  } else {
    bns336_3Missing.push('Commission of forgery under Section 335');
  }

  if (facts.intentToCheatWithFabricatedDocument && !isUrlOnly && !isDebitOnly && !isGenuineScreenshotOrUnverifiedImageOnly) {
    bns336_3Established.push('Specific intent that forged document/record be used for cheating');
  } else {
    bns336_3Missing.push('Specific intent that the forged document be used for cheating');
  }

  const bns336_3Supported = bns336_3Established.length === 2;

  assessments.push({
    catalogueId: 'BNS-336-3',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    sectionNumber: 'Section 336(3)',
    provisionTitle: 'Forgery for purpose of cheating',
    isPrimaFacieSupported: bns336_3Supported,
    prescribedPunishment: 'Imprisonment up to 7 years, and shall also be liable to fine',
    establishedIngredients: bns336_3Established,
    missingIngredients: bns336_3Missing,
    evidentiaryNote: isGenuineScreenshotOrUnverifiedImageOnly
      ? 'A genuine screenshot or an unverified image alone does not establish forgery under Section 335 or Section 336(3).'
      : isUrlOnly
      ? 'A suspicious link or phishing site is not a forged document under Section 335 unless a false electronic record/receipt was fabricated.'
      : bns336_3Supported
      ? 'Supported by fabrication of false electronic record specifically intended for cheating.'
      : 'Incomplete: Requires both false document fabrication and specific intent to cheat.',
  });

  // 7. BNS 338 - Forgery of Valuable Security, Will, Acquittance or Receipt Acknowledging Payment of Money
  const bns338Established: string[] = [];
  const bns338Missing: string[] = [];

  if (bns336_2Supported) {
    bns338Established.push('Commission of forgery under Section 335');
  } else {
    bns338Missing.push('Commission of forgery under Section 335');
  }

  const isCovered338Description = Boolean(
    facts.isValuableSecurityOrWillForged ||
    facts.isReceiptOrAcquittanceAcknowledgingPaymentForged ||
    facts.isDocumentOfCoveredDescriptionUnder338
  );

  if (isCovered338Description && !isUrlOnly && !isDebitOnly && !isGenuineScreenshotOrUnverifiedImageOnly) {
    bns338Established.push(
      'Document or electronic record forged purports to be a valuable security, will, authority to receive/transfer money, or an acquittance/receipt acknowledging payment of money'
    );
  } else {
    bns338Missing.push(
      'Document forged must purport to be a valuable security, will, authority to transfer/receive funds, or acquittance/receipt acknowledging payment of money'
    );
  }

  const bns338Supported = bns338Established.length === 2;

  assessments.push({
    catalogueId: 'BNS-338',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    sectionNumber: 'Section 338',
    provisionTitle: 'Forgery of valuable security, will, etc.',
    isPrimaFacieSupported: bns338Supported,
    prescribedPunishment:
      'Imprisonment for life, or with imprisonment of either description for a term which may extend to 10 years, and fine',
    establishedIngredients: bns338Established,
    missingIngredients: bns338Missing,
    evidentiaryNote: isGenuineScreenshotOrUnverifiedImageOnly
      ? 'A genuine screenshot or an unverified image alone does not establish forgery under Section 335 or Section 338 without proof that a false document or false electronic record was made.'
      : !isCovered338Description
      ? 'Not applicable: While a false document or electronic record is alleged, it is not of a description covered under Section 338 (valuable security, will, authority to transfer/receive funds, or receipt/acquittance acknowledging payment of money). General forgery or forgery for purpose of cheating under Section 336 applies instead.'
      : bns338Supported
      ? 'Supported: Commission of forgery of a document or electronic record of a description covered under Section 338 (valuable security, will, authority to transfer/receive funds, or receipt/acquittance acknowledging payment of money).'
      : 'Incomplete: Missing essential ingredients of false document fabrication or covered Section 338 description.',
  });

  // 8. IT Act Section 66C - Identity Theft
  const it66cEstablished: string[] = [];
  const it66cMissing: string[] = [];

  const isVictimOwnEntry = Boolean(facts.isVictimOwnCredentialEntryUnderDeception);
  const offenderUsedCredentials =
    facts.hasOffenderUsedAnotherPersonsCredentials ??
    (facts.hasUnauthorizedUseOfPasswordOrPin && !isVictimOwnEntry);

  if (offenderUsedCredentials && !isUrlOnly && !isDebitOnly && !isVictimOwnEntry) {
    it66cEstablished.push(
      'Offender fraudulently or dishonestly made use of another person’s electronic signature, password, OTP, or unique identification feature'
    );
  } else if (isVictimOwnEntry) {
    it66cMissing.push(
      'Offender’s fraudulent use of another person’s credential (victim entered their own credentials under deception; does not satisfy Section 66C)'
    );
  } else {
    it66cMissing.push(
      'Offender’s fraudulent or dishonest use of another person’s electronic signature, password, OTP, or unique identification feature'
    );
  }

  const it66cSupported = it66cEstablished.length === 1;

  assessments.push({
    catalogueId: 'IT-66C',
    actTitle: 'Information Technology Act, 2000',
    sectionNumber: 'Section 66C',
    provisionTitle: 'Punishment for identity theft',
    isPrimaFacieSupported: it66cSupported,
    prescribedPunishment: 'Imprisonment up to 3 years, and shall also be liable to fine up to ₹1,00,000',
    establishedIngredients: it66cEstablished,
    missingIngredients: it66cMissing,
    evidentiaryNote: isDebitOnly
      ? 'A reported debit alone does not prove identity theft under Section 66C without evidence of an offender using another person’s credentials.'
      : isVictimOwnEntry
      ? 'A victim entering or approving their own OTP or UPI PIN under deceptive inducement does not constitute identity theft under Section 66C. Section 66C strictly requires the offender to make use of another person’s electronic signature, password, or unique identification feature. Deceptive push-payment inducement is evaluated under BNS Section 318(4) (Cheating) where its statutory ingredients are satisfied, and under IT Act Section 66D only if cheating by personation through a computer resource is independently established.'
      : it66cSupported
      ? 'Supported: Offender fraudulently or dishonestly made use of another person’s unique electronic credentials (OTP/UPI PIN/password).'
      : 'Missing proof of offender fraudulently using another person’s electronic credentials.',
  });

  // 9. IT Act Section 66D - Cheating by Personation using Computer Resource
  const it66dEstablished: string[] = [];
  const it66dMissing: string[] = [];

  if (bns318Supported) {
    it66dEstablished.push('Underlying cheating executed');
  } else {
    it66dMissing.push('Underlying cheating under penal law');
  }

  if (facts.hasImpersonationOfPersonOrAuthority && !isUrlOnly && !isDebitOnly) {
    it66dEstablished.push('Personation practiced');
  } else {
    it66dMissing.push('Personation of an individual, official, or organization');
  }

  if (facts.hasComputerResourceUsedForImpersonation && !isDebitOnly) {
    it66dEstablished.push('Use of computer resource, mobile communication, or electronic portal');
  } else {
    it66dMissing.push('Use of computer resource or electronic communication device');
  }

  const it66dSupported = it66dEstablished.length === 3;

  assessments.push({
    catalogueId: 'IT-66D',
    actTitle: 'Information Technology Act, 2000',
    sectionNumber: 'Section 66D',
    provisionTitle: 'Punishment for cheating by personation by using computer resource',
    isPrimaFacieSupported: it66dSupported,
    prescribedPunishment: 'Imprisonment up to 3 years, and shall also be liable to fine up to ₹1,00,000',
    establishedIngredients: it66dEstablished,
    missingIngredients: it66dMissing,
    evidentiaryNote: isUrlOnly
      ? 'A suspicious URL alone does not establish Section 66D without proof of cheating by personation.'
      : it66dSupported
      ? 'Supported: Cheating by personation executed using computer resource / electronic communication.'
      : 'Requires cheating, personation, and execution via computer resource.',
  });

  return {
    assessedOffences: assessments,
    cautionaryNotice:
      'Cautionary Legal Note: Possible offences are evaluated strictly against essential statutory ingredients. An allegation, suspicious URL, bank debit, or respondent bank identity does not automatically establish an offence without factual substantiation of each ingredient. Formal penal charges are framed exclusively by law enforcement under BNSS Section 173.',
  };
}

// -----------------------------------------------------------------------------
// 6. EVIDENCE CERTAINTY TAXONOMY
// -----------------------------------------------------------------------------
/**
 * Maps an ingredient and available exhibits to a transparent FactCertaintyStatus.
 * A SHA-256 hash establishes bitstream integrity (the file was not corrupted),
 * but NEVER proves the truth or legal authenticity of document contents.
 */
export function evaluateFactCertainty(
  isAllegedInNarrative: boolean,
  matchingExhibitAttached: boolean,
  requiresTechnicalForensicAudit: boolean,
  hasContradictoryData: boolean
): FactCertaintyStatus {
  if (hasContradictoryData) {
    return 'uncertain_requires_investigation';
  }

  if (!isAllegedInNarrative && !matchingExhibitAttached) {
    return 'missing_or_unsubstantiated';
  }

  if (matchingExhibitAttached && requiresTechnicalForensicAudit) {
    return 'document_content_requires_forensic_review';
  }

  if (matchingExhibitAttached) {
    return 'referenced_in_attached_document';
  }

  return 'alleged_in_citizen_statement';
}
