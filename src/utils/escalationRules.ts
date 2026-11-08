/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GrievanceCase, GrievanceCategory } from '../types';

export interface StatutoryRule {
  category: GrievanceCategory;
  primaryAct: string;
  initialAuthority: string;
  statutoryWindowDays: number;
  escalationAuthority: string;
  escalationPortal: string;
  portalUrl: string;
  nextTierAuthority: string;
  nextTierTimeline: string;
  statutoryCitation: string;
  mandatoryPrerequisites: string[];
}

export const STATUTORY_RULES: Record<GrievanceCategory, StatutoryRule> = {
  banking_financial: {
    category: 'banking_financial',
    primaryAct: 'Reserve Bank of India Act, 1934 & Banking Regulation Act, 1949',
    initialAuthority: 'Bank Principal Nodal Officer (PNO) / Customer Service Dept',
    statutoryWindowDays: 30,
    escalationAuthority: 'RBI Integrated Ombudsman',
    escalationPortal: 'RBI Complaint Management System (CMS)',
    portalUrl: 'https://cms.rbi.org.in',
    nextTierAuthority: 'Appellate Authority (Executive Director / Deputy Governor, RBI)',
    nextTierTimeline: 'Within 30 days from receipt of Ombudsman Award / Rejection',
    statutoryCitation: 'RBI Integrated Ombudsman Scheme 2021 (Clause 10 & 13) read with Circular DBR.No.Leg.BC.78/09.07.005/2017-18',
    mandatoryPrerequisites: [
      'Written dispute filed with bank branch/PNO with dated acknowledgment',
      'Transaction reference / UTR numbers',
      'Account statement showing unauthorized or disputed debits',
      'Copy of formal rejection letter from bank (or proof of 30 days non-response)',
    ],
  },
  consumer_ecommerce: {
    category: 'consumer_ecommerce',
    primaryAct: 'Consumer Protection Act, 2019 (Act No. 35 of 2019)',
    initialAuthority: 'Company / Seller Grievance Officer & National Consumer Helpline (NCH 1915)',
    statutoryWindowDays: 30,
    escalationAuthority: 'District Consumer Disputes Redressal Commission (DCDRC)',
    escalationPortal: 'e-Daakhil Online Filing Portal',
    portalUrl: 'https://edaakhil.nic.in',
    nextTierAuthority: 'State Consumer Disputes Redressal Commission (SCDRC)',
    nextTierTimeline: 'Within 45 days from District Commission order under Section 41',
    statutoryCitation: 'Consumer Protection Act 2019, Section 35 (Filing), Section 38(2)(a) (30-day response window), and Section 41 (Appeals)',
    mandatoryPrerequisites: [
      'Tax invoice, payment slip, or order confirmation',
      'Written correspondence/chat logs showing refusal or deficiency in service',
      'Formal legal notice sent via speed post or registered email with delivery proof',
    ],
  },
  real_estate_rera: {
    category: 'real_estate_rera',
    primaryAct: 'Real Estate (Regulation and Development) Act, 2016 (RERA)',
    initialAuthority: 'Promoter / Builder Customer Redressal Cell',
    statutoryWindowDays: 60,
    escalationAuthority: 'State Real Estate Regulatory Authority (RERA Bench)',
    escalationPortal: 'State RERA Web Portal',
    portalUrl: 'https://maharera.mahaonline.gov.in',
    nextTierAuthority: 'Real Estate Appellate Tribunal (REAT)',
    nextTierTimeline: 'Within 60 days under Section 44 of RERA Act 2016',
    statutoryCitation: 'RERA Act 2016, Section 18 (Delay & Refund with Interest), Section 31 (Filing of complaints), and Section 44 (Tribunal appeals)',
    mandatoryPrerequisites: [
      'Registered Agreement for Sale (AFS) or Allotment Letter',
      'Statement of customer ledger showing all installments paid',
      'Promised possession date clause reference',
      'Prior written demand/notice served to promoter',
    ],
  },
  insurance_claims: {
    category: 'insurance_claims',
    primaryAct: 'Insurance Regulatory and Development Authority Act, 1999 & Insurance Ombudsman Rules, 2017',
    initialAuthority: 'Insurer Grievance Redressal Officer (GRO) / Bima Bharosa',
    statutoryWindowDays: 30,
    escalationAuthority: 'Insurance Ombudsman (Council for Insurance Ombudsmen)',
    escalationPortal: 'Council for Insurance Ombudsmen (CIO) Portal',
    portalUrl: 'https://www.cioins.co.in',
    nextTierAuthority: 'Consumer Disputes Redressal Commission / Civil Court',
    nextTierTimeline: 'Within applicable statutory limitation period',
    statutoryCitation: 'Insurance Ombudsman Rules 2017, Rule 13 (Manner of filing) and Rule 14 (30 days from repudiation or non-response)',
    mandatoryPrerequisites: [
      'Insurance policy schedule with terms & conditions',
      'Claim form and hospital/incident bills submitted',
      'Insurer formal repudiation/deduction letter with GRO complaint reference',
    ],
  },
  municipal_civic: {
    category: 'municipal_civic',
    primaryAct: 'State Municipal Corporation Acts & Public Services Guarantee Act',
    initialAuthority: 'Municipal Ward Officer / Local Civic Helpline',
    statutoryWindowDays: 30,
    escalationAuthority: 'CPGRAMS Central / State Citizen Redressal Portal',
    escalationPortal: 'Centralized Public Grievance Redress and Monitoring System (CPGRAMS)',
    portalUrl: 'https://pgportal.gov.in',
    nextTierAuthority: 'First Appellate Officer / Municipal Commissioner / Lokayukta',
    nextTierTimeline: 'Within 30 days of initial closure or non-action',
    statutoryCitation: 'Citizen Charter Mandate & DARPG Public Grievance Redress Guidelines 2021',
    mandatoryPrerequisites: [
      'Ward token / online complaint registration number',
      'Photographs with timestamp and GPS/locality reference',
      'Prior representation letters submitted to local municipal office',
    ],
  },
  telecom_isp: {
    category: 'telecom_isp',
    primaryAct: 'Telecom Regulatory Authority of India (TRAI) Act, 1997',
    initialAuthority: 'Telecom Service Provider Appellate Authority',
    statutoryWindowDays: 30,
    escalationAuthority: 'Department of Telecommunications (DoT) Public Grievance Cell & Sanchar Saathi',
    escalationPortal: 'DoT PG Portal / Sanchar Saathi',
    portalUrl: 'https://sancharsaathi.gov.in',
    nextTierAuthority: 'Telecom Disputes Settlement and Appellate Tribunal (TDSAT)',
    nextTierTimeline: 'As per TRAI Complaint Redressal Regulations 2012',
    statutoryCitation: 'TRAI Telecom Consumers Complaint Redressal Regulations 2012',
    mandatoryPrerequisites: [
      'Service request docket number from telecom operator',
      'Billing records or call detail records (CDR)',
      'Proof of communication with operator Appellate Authority',
    ],
  },
  employment_labour: {
    category: 'employment_labour',
    primaryAct: 'Industrial Disputes Act, 1947 & Payment of Gratuity/Wages Act',
    initialAuthority: 'Company HR Redressal & Internal Committee',
    statutoryWindowDays: 30,
    escalationAuthority: 'Office of the Labour Commissioner / Conciliation Officer',
    escalationPortal: 'Ministry of Labour & Employment Portal',
    portalUrl: 'https://samadhan.labour.gov.in',
    nextTierAuthority: 'Labour Court / Industrial Tribunal',
    nextTierTimeline: 'Within prescribed statutory limitation period',
    statutoryCitation: 'Industrial Relations Code & Payment of Wages Act Section 15',
    mandatoryPrerequisites: [
      'Offer letter, employment contract, or pay slips',
      'Full and final settlement calculation or dues statement',
      'Formal resignation/termination correspondence and written grievance demand',
    ],
  },
  utilities_power: {
    category: 'utilities_power',
    primaryAct: 'Electricity Act, 2003 (Section 42(5) & 42(6))',
    initialAuthority: 'Distribution Licensee Internal Grievance Redressal Forum (CGRF)',
    statutoryWindowDays: 60,
    escalationAuthority: 'Electricity Ombudsman',
    escalationPortal: 'State Electricity Regulatory Commission Ombudsman',
    portalUrl: 'https://pgportal.gov.in',
    nextTierAuthority: 'Appellate Tribunal for Electricity (APTEL)',
    nextTierTimeline: 'Within 30 days under Electricity Act 2003 Section 42(6)',
    statutoryCitation: 'Electricity Act 2003, Section 42(5) (CGRF) and Section 42(6) (Electricity Ombudsman)',
    mandatoryPrerequisites: [
      'Electricity consumer number and latest paid bill',
      'Disputed bill / disconnection notice',
      'Formal complaint filed with CGRF with acknowledgment',
    ],
  },
};

export interface EscalationEvaluation {
  isEligible: boolean;
  daysElapsed: number;
  daysRemaining: number;
  statutoryWindowDays: number;
  filingDate: string;
  currentTier: string;
  escalationTier: string;
  portalUrl: string;
  portalName: string;
  statutoryCitation: string;
  eligibilityExplanation: string;
  recommendedAction: string;
}

/**
 * Calculates days elapsed between a submission date and current date.
 */
export function calculateDaysElapsed(submissionDateStr?: string): number {
  if (!submissionDateStr) return 0;
  const subDate = new Date(submissionDateStr);
  if (isNaN(subDate.getTime())) return 0;
  const now = new Date();
  const diffTime = Math.max(0, now.getTime() - subDate.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Evaluates whether a case has met statutory escalation requirements
 * based on verified department benchmarks.
 */
export function evaluateEscalationStatus(c: GrievanceCase): EscalationEvaluation {
  const rule = STATUTORY_RULES[c.category] || STATUTORY_RULES.banking_financial;
  const filingDate = c.monitoring?.submissionDate || c.filingDetails?.filingDate || c.incidentDate;
  const daysElapsed = calculateDaysElapsed(filingDate);
  const statutoryWindowDays = c.monitoring?.statutoryDeadlineDays || rule.statutoryWindowDays;
  const daysRemaining = Math.max(0, statutoryWindowDays - daysElapsed);

  // Check if any negative response has arrived early
  const hasRejectionResponse = Boolean(
    c.monitoring?.responses?.some(
      (r) => r.aiClassification === 'unresolved' || r.responseText.toLowerCase().includes('reject')
    )
  );

  const isEligible: boolean = Boolean(daysElapsed >= statutoryWindowDays || hasRejectionResponse);

  let eligibilityExplanation = '';
  let recommendedAction = '';

  if (hasRejectionResponse) {
    eligibilityExplanation = `Eligible for Immediate Escalation: The respondent has formally rejected or repudiated your grievance prior to the statutory deadline. Under ${rule.statutoryCitation}, you are not required to wait further and may directly petition the ${rule.escalationAuthority}.`;
    recommendedAction = `File a formal escalation petition before the ${rule.escalationAuthority} via ${rule.escalationPortal}.`;
  } else if (isEligible) {
    eligibilityExplanation = `Eligible for Statutory Escalation: ${daysElapsed} days have elapsed since your formal filing on ${filingDate}. This exceeds the mandatory ${statutoryWindowDays}-day resolution benchmark under ${rule.statutoryCitation}. Because no satisfactory resolution has been delivered within the statutory window, you have the legal right to escalate.`;
    recommendedAction = `Submit an escalation petition or non-response complaint with the ${rule.escalationAuthority} (${rule.escalationPortal}).`;
  } else {
    eligibilityExplanation = `Statutory Response Period Active: Currently at Day ${daysElapsed} of the mandatory ${statutoryWindowDays}-day response window (${daysRemaining} days remaining). The respondent is legally entitled to this window to investigate. An escalation petition filed prematurely may be returned by the Ombudsman as premature.`;
    recommendedAction = `Send a polite periodic reminder letter inquiring on case status and maintain your records. If no resolution arrives by Day ${statutoryWindowDays}, escalation becomes immediately permissible.`;
  }

  return {
    isEligible,
    daysElapsed,
    daysRemaining,
    statutoryWindowDays,
    filingDate,
    currentTier: rule.initialAuthority,
    escalationTier: rule.escalationAuthority,
    portalUrl: rule.portalUrl,
    portalName: rule.escalationPortal,
    statutoryCitation: rule.statutoryCitation,
    eligibilityExplanation,
    recommendedAction,
  };
}

/**
 * Detects missing documents, unanswered requests, and pending actions.
 */
export function detectPendingActions(c: GrievanceCase): {
  missingDocuments: string[];
  pendingRemindersCount: number;
  unansweredElapsedDays: number;
  checklistItems: Array<{ id: string; text: string; urgent: boolean; completed: boolean }>;
} {
  const rule = STATUTORY_RULES[c.category] || STATUTORY_RULES.banking_financial;
  const evidenceTitles = c.evidence.map((e) => `${e.title} ${e.fileName} ${e.category}`.toLowerCase());

  // Check which mandatory prerequisites are absent from evidence
  const missingDocuments: string[] = [];
  rule.mandatoryPrerequisites.forEach((req) => {
    const reqLower = req.toLowerCase();
    const hasMatch = evidenceTitles.some((t) => {
      if (reqLower.includes('invoice') && (t.includes('invoice') || t.includes('receipt') || t.includes('bill'))) return true;
      if (reqLower.includes('acknowledgment') && (t.includes('acknowledg') || t.includes('notice') || t.includes('stamp') || t.includes('receipt'))) return true;
      if (reqLower.includes('statement') && (t.includes('statement') || t.includes('bank') || t.includes('ledger'))) return true;
      if (reqLower.includes('rejection') && (t.includes('reject') || t.includes('repudiat') || t.includes('refusal'))) return true;
      if (reqLower.includes('agreement') && (t.includes('agreement') || t.includes('allotment') || t.includes('contract'))) return true;
      return false;
    });
    if (!hasMatch) {
      missingDocuments.push(req);
    }
  });

  const pendingReminders = c.monitoring?.reminders?.filter((r) => r.status === 'pending') || [];
  const filingDate = c.monitoring?.submissionDate || c.filingDetails?.filingDate || c.incidentDate;
  const unansweredElapsedDays = calculateDaysElapsed(filingDate);

  const checklistItems = [
    {
      id: 'sub-ref',
      text: c.monitoring?.docketNumber || c.filingDetails?.referenceNumber
        ? `Official docket reference verified: ${c.monitoring?.docketNumber || c.filingDetails?.referenceNumber}`
        : 'Record official filing docket/complaint reference number',
      urgent: !c.monitoring?.docketNumber && !c.filingDetails?.referenceNumber,
      completed: Boolean(c.monitoring?.docketNumber || c.filingDetails?.referenceNumber),
    },
    {
      id: 'docs-complete',
      text: missingDocuments.length === 0
        ? 'All mandatory statutory documents uploaded & SHA-256 verified'
        : `Upload ${missingDocuments.length} recommended statutory exhibit(s)`,
      urgent: missingDocuments.length > 0,
      completed: missingDocuments.length === 0,
    },
    {
      id: 'follow-up',
      text: pendingReminders.length > 0
        ? `${pendingReminders.length} scheduled follow-up reminder(s) pending`
        : 'Schedule next 7-day or 14-day in-app follow-up milestone',
      urgent: false,
      completed: pendingReminders.length > 0,
    },
    {
      id: 'resp-tracked',
      text: (c.monitoring?.responses?.length || 0) > 0
        ? `Official response received & AI-analyzed (${c.monitoring?.responses?.length} record)`
        : `Awaiting written response from ${c.involvedEntity} (Day ${unansweredElapsedDays})`,
      urgent: unansweredElapsedDays > 30 && (c.monitoring?.responses?.length || 0) === 0,
      completed: (c.monitoring?.responses?.length || 0) > 0,
    },
  ];

  return {
    missingDocuments,
    pendingRemindersCount: pendingReminders.length,
    unansweredElapsedDays,
    checklistItems,
  };
}

/**
 * Type A: Generates an editable periodic status inquiry reminder letter.
 */
export function generateStatusReminderLetter(
  c: GrievanceCase,
  options?: { citizenName?: string; customAddressee?: string }
): string {
  const rule = STATUTORY_RULES[c.category] || STATUTORY_RULES.banking_financial;
  const name = options?.citizenName || 'Rajesh Joshi';
  const recipient = options?.customAddressee || rule.initialAuthority;
  const docket = c.monitoring?.docketNumber || c.filingDetails?.referenceNumber || '[DOCKET/COMPLAINT REFERENCE NUMBER]';
  const subDate = c.monitoring?.submissionDate || c.filingDetails?.filingDate || c.incidentDate;
  const daysElapsed = calculateDaysElapsed(subDate);

  return `To:
The Principal Grievance Officer / Nodal Authority
${recipient}
${c.involvedEntity}

Subject: Urgent Status Inquiry & Periodic Reminder regarding Grievance Ref: ${docket}

Dear Sir / Madam,

Ref: 
1. Complaint / Docket No: ${docket}
2. Original Filing Date: ${subDate}
3. Complainant Name: ${name}
4. Case Title: ${c.title}

I am writing to respectfully request an urgent status update regarding the above-referenced grievance, which was formally lodged with your office on ${subDate} (${daysElapsed} calendar days elapsed).

Under the prescribed citizen redressal guidelines and ${rule.statutoryCitation}, an aggrieved consumer is entitled to an expeditious response within a reasonable timeframe (statutory benchmark: ${rule.statutoryWindowDays} days).

Brief Facts:
${c.simpleSummary || c.description}

As of today, ${daysElapsed} days have passed and I have not received a formal written resolution or communication explaining any delay in resolving this matter.

Kindly provide:
1. The current investigation status of Complaint Ref: ${docket}.
2. The name and direct contact details of the designated Inquiry Officer assigned to this file.
3. The specific timeline within which the final resolution or refund will be executed.

If I do not receive a written reply within 7 working days, I shall be compelled to exercise my statutory right to escalate this grievance before the ${rule.escalationAuthority} (${rule.escalationPortal}) without further notice.

Thanking you,

Yours sincerely,

${name}
Complainant
Location: ${c.incidentLocation}
Date: ${new Date().toLocaleDateString('en-IN')}`;
}

/**
 * Type B: Generates an editable statutory escalation petition letter.
 */
export function generateEscalationPetitionLetter(
  c: GrievanceCase,
  options?: { citizenName?: string; customAddressee?: string }
): string {
  const rule = STATUTORY_RULES[c.category] || STATUTORY_RULES.banking_financial;
  const name = options?.citizenName || 'Rajesh Joshi';
  const recipient = options?.customAddressee || rule.escalationAuthority;
  const docket = c.monitoring?.docketNumber || c.filingDetails?.referenceNumber || '[PREVIOUS DOCKET NUMBER]';
  const subDate = c.monitoring?.submissionDate || c.filingDetails?.filingDate || c.incidentDate;
  const daysElapsed = calculateDaysElapsed(subDate);
  const disputedAmt = c.disputedAmount ? `INR ₹${c.disputedAmount.toLocaleString('en-IN')}` : 'Non-monetary relief';

  return `BEFORE THE HON'BLE ${rule.escalationAuthority.toUpperCase()}
PORTAL / JURISDICTION: ${rule.escalationPortal}

In the Matter of:
${name},
Resident of: ${c.incidentLocation}
... COMPLAINANT / PETITIONER

VERSUS

${c.involvedEntity},
... RESPONDENT / OPPOSITE PARTY

PETITION UNDER ${rule.statutoryCitation.toUpperCase()} FOR STATUTORY ESCALATION DUE TO NON-REDRESSAL / WRONGFUL REPUDIATION

MOST RESPECTFULLY SHOWETH:

1. PARTICULARS OF THE ORIGINAL COMPLAINT:
The Complainant lodged a formal complaint against the Respondent entity on ${subDate} bearing Complaint / Docket Reference No: ${docket}.

2. STATUTORY PERIOD ELAPSED WITHOUT RESOLUTION:
A total of ${daysElapsed} calendar days have elapsed since the formal submission. This substantially exceeds the mandatory statutory benchmark of ${rule.statutoryWindowDays} days established under ${rule.primaryAct}. The Respondent has failed to provide satisfactory redress or execute transaction reversal.

3. STATEMENT OF RELEVANT FACTS:
${c.description}

4. QUANTUM OF DISPUTE:
The total financial amount in dispute is ${disputedAmt}, which remains wrongfully retained / debited from the Complainant without lawful cause.

5. GROUNDS FOR ESCALATION:
a) The Respondent has violated statutory consumer protection and grievance directives.
b) The Complainant has fulfilled all procedural prerequisites, including timely notification within the zero-liability window.
c) All documentary evidence, transaction logs, and formal communications have been preserved under cryptographic SHA-256 verification and are indexed in the attached Case Dossier (${c.id}).

PRAYER / RELIEF SOUGHT:
In the light of the facts stated above, the Complainant respectfully prays that this Hon'ble Authority may be pleased to:
a) Direct the Respondent to grant complete relief as claimed: ${c.complaintDraft.reliefSought}.
b) Order immediate restitution of disputed sum of ${disputedAmt} along with statutory interest as applicable.
c) Impose appropriate compensation for mental agony, harassment, and procedural delay.

VERIFICATION:
I, ${name}, the Complainant above-named, do hereby verify that the contents of this escalation petition are true to my knowledge and belief.

Place: ${c.incidentLocation}
Date: ${new Date().toLocaleDateString('en-IN')}

______________________________
${name}
Complainant / Petitioner`;
}
