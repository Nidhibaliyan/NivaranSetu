/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GrievanceCategory, EvidenceItem, TrustCheckRecord } from '../types';

export type RecommendationPriority = 'recommended' | 'conditional' | 'optional';
export type DebitStatus = 'confirmed_debit' | 'unconfirmed' | 'no_debit';

/**
 * Extensible structure for future verified statutory and regulatory provisions.
 * Left optional until officially verified provisions, effective dates, and URLs are curated.
 */
export interface VerifiedLegalSource {
  authorityName?: string;
  provisionCitation?: string;
  officialPortalUrl?: string;
  effectiveDate?: string;
  verificationStatus: 'unverified' | 'curated_demonstration' | 'officially_verified';
}

export interface EvidenceRecommendation {
  id: string;
  title: string;
  instruction: string;
  practicalPurpose: string;
  priority: RecommendationPriority;
  suggestedCategories: EvidenceItem['category'][];
  isSatisfied: boolean;
  matchedExhibitId?: string;
  matchedExhibitTitle?: string;
  conditionReason?: string;
  conditionStatus?: 'active' | 'inactive' | 'unconfirmed';
  legalSource?: VerifiedLegalSource;
}

export interface RecommendationContext {
  category: GrievanceCategory;
  description: string;
  disputedAmount: number;
  debitStatus?: DebitStatus;
  trustRecord?: TrustCheckRecord | null;
  involvedEntity?: string;
  evidenceList: EvidenceItem[];
}

/**
 * Practical baseline evidence recommendations by category.
 * Note: These are practical evidentiary recommendations, not verified statutory prerequisites.
 */
function getCategoryBaselineRecommendations(category: GrievanceCategory): Omit<EvidenceRecommendation, 'isSatisfied' | 'matchedExhibitId' | 'matchedExhibitTitle'>[] {
  switch (category) {
    case 'banking_financial':
      return [
        {
          id: 'rec_bank_complaint',
          title: 'Bank / Payment Provider Written Complaint Record',
          instruction: 'Attach a copy or screenshot of your initial complaint ticket, email, or written dispute filed with customer service.',
          practicalPurpose: 'Demonstrates prompt notification and allows authorities to verify that internal resolution was attempted.',
          priority: 'recommended',
          suggestedCategories: ['notice', 'correspondence'],
        },
      ];

    case 'consumer_ecommerce':
      return [
        {
          id: 'rec_retail_invoice',
          title: 'Retail Tax Invoice / Order Confirmation',
          instruction: 'Upload your purchase invoice, order details receipt, or digital payment confirmation.',
          practicalPurpose: 'Establishes transaction details, purchase price, seller identification, and date of order.',
          priority: 'recommended',
          suggestedCategories: ['receipt'],
        },
        {
          id: 'rec_delivery_courier_proof',
          title: 'Delivery Slip / Defective Product Photograph',
          instruction: 'Upload a photograph of the damaged product or courier packaging showing the shipping label and tracking number.',
          practicalPurpose: 'Provides visual substantiation of the product defect, transit damage, or incorrect item received.',
          priority: 'recommended',
          suggestedCategories: ['screenshot', 'receipt'],
        },
        {
          id: 'rec_seller_communication',
          title: 'Seller / Platform Chat or Email Refusal',
          instruction: 'Attach screenshots of written customer support conversations showing denial of return, refund, or warranty.',
          practicalPurpose: 'Evidences customer service deficiency and refusal of standard resolution.',
          priority: 'optional',
          suggestedCategories: ['correspondence', 'screenshot'],
        },
      ];

    case 'real_estate_rera':
      return [
        {
          id: 'rec_allotment_or_agreement',
          title: 'Builder Allotment Letter / Agreement for Sale',
          instruction: 'Upload your signed allotment letter, builder-buyer agreement, or booking application form.',
          practicalPurpose: 'Documents contractual possession dates, unit details, and agreed consideration terms.',
          priority: 'recommended',
          suggestedCategories: ['agreement'],
        },
        {
          id: 'rec_builder_payment_ledger',
          title: 'Customer Payment Ledger / Bank Transfer Receipts',
          instruction: 'Attach payment receipts or account ledger showing installment amounts paid to the developer.',
          practicalPurpose: 'Proves financial compliance by the buyer and quantifies total consideration paid.',
          priority: 'recommended',
          suggestedCategories: ['receipt', 'bank_statement'],
        },
        {
          id: 'rec_delay_representation',
          title: 'Written Inquiry or Demand Notice Sent to Builder',
          instruction: 'Attach letters or emails inquiring about project delay and requesting possession status or interest.',
          practicalPurpose: 'Demonstrates reasonable inquiry and notice before escalating to regulatory authorities.',
          priority: 'optional',
          suggestedCategories: ['notice', 'correspondence'],
        },
      ];

    case 'insurance_claims':
      return [
        {
          id: 'rec_insurance_policy',
          title: 'Insurance Policy Schedule / Cover Document',
          instruction: 'Upload your active policy schedule showing policy period, sum insured, and terms.',
          practicalPurpose: 'Establishes active coverage, policy inception date, and eligible benefit heads.',
          priority: 'recommended',
          suggestedCategories: ['agreement', 'notice'],
        },
        {
          id: 'rec_claim_repudiation',
          title: 'Insurer Claim Repudiation or Deduction Letter',
          instruction: 'Attach the written rejection or settlement voucher letter detailing clause grounds cited by the insurer.',
          practicalPurpose: 'Enables dispute forums to review whether the specific denial ground was justified.',
          priority: 'conditional',
          conditionReason: 'Applicable if the insurer issued a formal claim rejection or partial deduction letter.',
          conditionStatus: 'active',
          suggestedCategories: ['notice', 'correspondence'],
        },
        {
          id: 'rec_hospital_bills',
          title: 'Itemized Medical Bills / Discharge Summary',
          instruction: 'Attach hospital discharge summary and breakdown of pharmacy/investigation bills.',
          practicalPurpose: 'Substantiates itemized expense amounts and clinical necessity of treatments.',
          priority: 'optional',
          suggestedCategories: ['receipt'],
        },
      ];

    case 'telecom_isp':
      return [
        {
          id: 'rec_telecom_docket',
          title: 'Operator Complaint Docket Number / SMS Receipt',
          instruction: 'Attach the service ticket number, acknowledgment SMS, or email issued by your telecom operator.',
          practicalPurpose: 'Proves when the issue was reported and enables tracking through telecom complaint hierarchies.',
          priority: 'recommended',
          suggestedCategories: ['notice', 'correspondence', 'screenshot'],
        },
        {
          id: 'rec_recharge_bill',
          title: 'Billing Statement / Plan Recharge Receipt',
          instruction: 'Upload your recent broadband bill or mobile recharge payment confirmation.',
          practicalPurpose: 'Establishes active subscribed plan, billing cycle, and payment verification.',
          priority: 'optional',
          suggestedCategories: ['receipt'],
        },
      ];

    case 'utilities_power':
      return [
        {
          id: 'rec_electricity_bill',
          title: 'Electricity Consumer Bill / Account Slip',
          instruction: 'Upload a recent electricity bill showing your Consumer Account (CA) or K-Number.',
          practicalPurpose: 'Establishes consumer standing, billing cycle, sanctioned load, and meter identifier.',
          priority: 'recommended',
          suggestedCategories: ['receipt', 'notice'],
        },
        {
          id: 'rec_meter_reading',
          title: 'Meter Display Photograph or Inspection Slip',
          instruction: 'If disputing erratic billing, attach a clear photo of the meter reading display or meter test report.',
          practicalPurpose: 'Corroborates claims of abnormal fast recording or physical meter defect.',
          priority: 'optional',
          suggestedCategories: ['screenshot', 'receipt'],
        },
      ];

    case 'municipal_civic':
      return [
        {
          id: 'rec_civic_photograph',
          title: 'Dated Photograph of Civic Defect / Problem',
          instruction: 'Upload clear photographs of the overflowing drainage, pothole, garbage, or road defect.',
          practicalPurpose: 'Provides visual proof of the civic hazard and locality condition for municipal inspection.',
          priority: 'recommended',
          suggestedCategories: ['screenshot'],
        },
        {
          id: 'rec_municipal_token',
          title: 'Ward Complaint Token / Portal Acknowledgement',
          instruction: 'Attach local ward office complaint token or portal grievance reference if previously lodged.',
          practicalPurpose: 'Evidences prior notice to local civic authorities before escalation.',
          priority: 'optional',
          suggestedCategories: ['notice', 'correspondence'],
        },
      ];

    case 'employment_labour':
      return [
        {
          id: 'rec_employment_proof',
          title: 'Offer Letter / Employee ID / Appointment Contract',
          instruction: 'Upload your employment contract, offer letter, or official company ID card.',
          practicalPurpose: 'Establishes employer-employee relationship, tenure, and agreed remuneration terms.',
          priority: 'recommended',
          suggestedCategories: ['agreement', 'notice'],
        },
        {
          id: 'rec_salary_dues',
          title: 'Salary Slips / Bank Account Statement of Credits',
          instruction: 'Attach recent salary slips or bank statement showing cessation of salary credits.',
          practicalPurpose: 'Quantifies unpaid wage arrears, gratuity entitlement, or disputed deductions.',
          priority: 'recommended',
          suggestedCategories: ['receipt', 'bank_statement'],
        },
      ];

    default:
      return [];
  }
}

/**
 * Pure recommendation engine generating case-specific evidentiary guidance.
 * Combines statutory category baselines with threat context overlays and debit condition evaluators.
 */
export function getEvidenceRecommendations(ctx: RecommendationContext): EvidenceRecommendation[] {
  const { category, description, disputedAmount, debitStatus = 'unconfirmed', trustRecord, evidenceList } = ctx;
  const descLower = (description || '').toLowerCase();
  const trustInput = (trustRecord?.input || '').toLowerCase();
  const trustTitle = (trustRecord?.flagTitle || '').toLowerCase();
  const trustDesc = (trustRecord?.description || '').toLowerCase();
  const combinedContext = `${descLower} ${trustInput} ${trustTitle} ${trustDesc}`;

  const recommendations: Omit<EvidenceRecommendation, 'isSatisfied' | 'matchedExhibitId' | 'matchedExhibitTitle'>[] = [];

  // 1. Incident Overlays: Threat Context
  const isApkOrMalwareThreat =
    combinedContext.includes('.apk') ||
    combinedContext.includes('pay.apk') ||
    combinedContext.includes('malware') ||
    combinedContext.includes('trojan') ||
    combinedContext.includes('sideload') ||
    combinedContext.includes('apk delivery');

  const isPhishingOrDeceptiveLink =
    isApkOrMalwareThreat ||
    combinedContext.includes('phishing') ||
    combinedContext.includes('fake link') ||
    combinedContext.includes('fake url') ||
    combinedContext.includes('fake website') ||
    combinedContext.includes('suspicious url') ||
    combinedContext.includes('fast-ebill') ||
    Boolean(trustRecord?.type === 'url');

  const isMessageOrThreatCommunication =
    isApkOrMalwareThreat ||
    combinedContext.includes('sms') ||
    combinedContext.includes('text message') ||
    combinedContext.includes('whatsapp') ||
    combinedContext.includes('disconnection message') ||
    combinedContext.includes('disconnection notice') ||
    combinedContext.includes('threat message') ||
    combinedContext.includes('vm-');

  // Threat Overlay A: Original Message / SMS Screenshot
  if (isMessageOrThreatCommunication) {
    recommendations.push({
      id: 'rec_sms_screenshot',
      title: 'Original SMS / Threat Message Screenshot',
      instruction:
        'Upload a screenshot of the fraudulent message showing the sender identifier (e.g. VM-POWURG) and timestamp.',
      practicalPurpose:
        'Preserves contemporaneous digital proof of the threat text, sender handle, and initial deception pattern.',
      priority: 'recommended',
      suggestedCategories: ['screenshot'],
    });
  }

  // Threat Overlay B: Suspicious URL / Application Link Screenshot
  if (isPhishingOrDeceptiveLink) {
    const urlReference = trustRecord?.input ? ` (${trustRecord.input})` : '';
    recommendations.push({
      id: 'rec_suspicious_url',
      title: 'Suspicious URL / APK Download Link Record',
      instruction: `Capture a screenshot or copy of the rogue link or website${urlReference} where you were directed.`,
      practicalPurpose:
        'Enables authorities and cyber investigators to document the malicious delivery domain and payload origin.',
      priority: 'recommended',
      suggestedCategories: ['screenshot', 'correspondence'],
    });
  }

  // Threat Overlay C: Conditional Bank / UPI Debit Statement
  if (disputedAmount > 0 || combinedContext.includes('debit') || combinedContext.includes('transferred') || combinedContext.includes('upi')) {
    let conditionStatus: 'active' | 'inactive' | 'unconfirmed' = 'unconfirmed';
    let conditionReason = 'Applicable only if money was actually deducted from your bank or payment account.';
    let instruction = `If ₹${disputedAmount.toLocaleString('en-IN')} was actually debited, attach your bank statement or UPI debit slip showing the UTR reference. If no money was lost (attempted scam only), verify your account and skip this item.`;

    if (debitStatus === 'confirmed_debit') {
      conditionStatus = 'active';
      conditionReason = 'Citizen confirmed that funds were debited from bank or payment account.';
      instruction = `Upload your bank statement, passbook extract, or UPI debit slip confirming the ₹${disputedAmount.toLocaleString('en-IN')} transaction and UTR number.`;
    } else if (debitStatus === 'no_debit') {
      conditionStatus = 'inactive';
      conditionReason = 'Citizen confirmed no financial debit occurred (attempted fraud only). Transaction proof is not required.';
      instruction = 'No monetary deduction occurred. Transaction proof is not applicable for this complaint.';
    }

    recommendations.push({
      id: 'rec_bank_statement',
      title: 'Bank / UPI Transaction Statement',
      instruction,
      practicalPurpose:
        'Verifies whether an unauthorized financial loss was sustained, establishing exact debit timestamps and reference codes.',
      priority: 'conditional',
      conditionReason,
      conditionStatus,
      suggestedCategories: ['bank_statement', 'receipt'],
    });
  }

  // 2. Category Baseline Recommendations
  const baselineRecs = getCategoryBaselineRecommendations(category);
  for (const baseRec of baselineRecs) {
    // Avoid duplicate recommendations if already covered by threat overlay
    if (!recommendations.some((r) => r.id === baseRec.id)) {
      recommendations.push(baseRec);
    }
  }

  // Threat Overlay D: Legitimate Utility Communication (for utility impersonation in banking fraud)
  if (
    category === 'banking_financial' &&
    (combinedContext.includes('electricity') || combinedContext.includes('ebill') || combinedContext.includes('power cut') || combinedContext.includes('disconnection'))
  ) {
    recommendations.push({
      id: 'rec_discom_utility_notice',
      title: 'Legitimate Electricity Bill / Discom Consumer Record',
      instruction:
        'If available, attach your genuine recent electricity bill or account number to establish that you are a legitimate utility consumer.',
      practicalPurpose:
        'Demonstrates your genuine consumer account standing and contrasts against the impersonator threat.',
      priority: 'optional',
      suggestedCategories: ['receipt', 'notice'],
    });
  }

  // 3. Resolve Satisfaction & Associate Exhibits (Strict, Citizen-Confirmed Matching)
  return recommendations.map((rec) => {
    // An exhibit satisfies a recommendation ONLY if explicitly associated via claimMappedTo
    // AND its category is among suggestedCategories.
    const matchingExhibit = evidenceList.find((ex) => {
      if (!ex.claimMappedTo) return false;
      if (ex.claimMappedTo !== rec.id) return false;
      return rec.suggestedCategories.includes(ex.category);
    });

    return {
      ...rec,
      isSatisfied: Boolean(matchingExhibit),
      matchedExhibitId: matchingExhibit?.id,
      matchedExhibitTitle: matchingExhibit?.title,
    };
  });
}

/**
 * Associating an exhibit explicitly with a recommendation.
 * Updates claimMappedTo without altering database schema.
 */
export function associateExhibitWithRecommendation(
  exhibit: EvidenceItem,
  recId: string
): EvidenceItem {
  return {
    ...exhibit,
    claimMappedTo: recId,
  };
}

/**
 * Unlinking an exhibit from a recommendation.
 */
export function unlinkExhibitFromRecommendation(exhibit: EvidenceItem): EvidenceItem {
  return {
    ...exhibit,
    claimMappedTo: undefined,
  };
}
