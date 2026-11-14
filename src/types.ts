import type {
  TemporalEvaluationResult,
  RbiEvaluationResult,
  CpaEvaluationResult,
  OffenceAssessmentResult,
} from './utils/legalAnalysisEngine';

export type {
  TemporalEvaluationResult,
  RbiEvaluationResult,
  CpaEvaluationResult,
  OffenceAssessmentResult,
};

export type AppTheme = 'dark' | 'light' | 'system';
export type AppMode = 'simple' | 'detailed';

export interface AuthUser {
  id: string; // Authenticated Supabase UUID (auth.uid())
  name: string;
  email: string;
  phone?: string;
  location?: string;
  role?: string;
}

export type LanguageCode =
  | 'en'
  | 'hi'
  | 'bn'
  | 'mr'
  | 'ta'
  | 'te'
  | 'kn'
  | 'ml'
  | 'gu'
  | 'pa'
  | 'or'
  | 'ur';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  supported: boolean;
}

export type GrievanceCategory =
  | 'banking_financial'
  | 'consumer_ecommerce'
  | 'municipal_civic'
  | 'telecom_isp'
  | 'real_estate_rera'
  | 'insurance_claims'
  | 'employment_labour'
  | 'utilities_power';

export type CaseStage =
  | 'drafting'
  | 'evidence_gathering'
  | 'readiness_check'
  | 'ready_to_file'
  | 'filed_externally'
  | 'escalated';

export type OcrStatus = 'pending' | 'processed' | 'no_text' | 'failed';

export interface EvidenceItem {
  id: string;
  title: string;
  category: 'receipt' | 'correspondence' | 'screenshot' | 'agreement' | 'notice' | 'bank_statement';
  fileName: string;
  fileSize: string;
  fileSizeBytes?: number;
  fileType: string;
  uploadDate: string;
  sha256Hash: string | null;
  storageRef?: string;
  rawOcrText?: string;
  hasBlob?: boolean;
  ocrStatus?: OcrStatus;
  ocrExtracted: {
    dates: string[];
    amounts: string[];
    identifiers: string[];
    parties: string[];
    summary: string;
    status?: OcrStatus;
  };
  flag?: {
    type: 'inconsistency' | 'duplicate' | 'verified';
    message: string;
  };
  claimMappedTo?: string;
  verifiedOriginal: boolean;
  deletedAt?: string | null;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  evidenceId?: string | null;
  verifiedByDoc: boolean;
}

export type CustodyEventType =
  | 'case_created'
  | 'case_updated'
  | 'category_changed'
  | 'status_changed'
  | 'evidence_uploaded'
  | 'evidence_accessed'
  | 'evidence_downloaded'
  | 'evidence_removed'
  | 'evidence_verified'
  | 'ocr_processed'
  | 'entity_extracted'
  | 'claim_mapped'
  | 'readiness_assessed'
  | 'complaint_generated'
  | 'authority_recommended'
  | 'filing_ref_recorded'
  | 'submission_recorded'
  | 'reminder_created'
  | 'reminder_completed'
  | 'reminder_deleted'
  | 'response_received'
  | 'response_analyzed'
  | 'escalation_evaluated'
  | 'followup_letter_generated'
  | 'dossier_generated'
  | 'dossier_exported';

export interface CustodyEvent {
  id: string;
  caseId: string;
  evidenceId?: string;
  eventType: CustodyEventType;
  action: string;
  actor: string;
  timestamp: string;
  details: string;
  fileHash?: string | null;
}

export interface CaseReminder {
  id: string;
  caseId: string;
  dueDate: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  createdAt: string;
}

export type ResponseClassification =
  | 'resolved'
  | 'partially_resolved'
  | 'unresolved'
  | 'requires_human_review';

export interface CaseResponseRecord {
  id: string;
  caseId: string;
  receivedDate: string;
  respondentName: string;
  documentName?: string;
  documentHash?: string;
  storageRef?: string;
  responseText: string;
  aiClassification: ResponseClassification;
  classificationRationale: string;
  createdAt: string;
}

export interface FollowUpLetterDraft {
  id: string;
  caseId: string;
  letterType: 'status_reminder' | 'statutory_escalation';
  recipientAuthority: string;
  subject: string;
  body: string;
  statutoryBasis: string;
  generatedAt: string;
}

export type CitizenReportedStatus =
  | 'not_submitted'
  | 'submitted'
  | 'in_progress'
  | 'response_received'
  | 'resolved'
  | 'unresolved'
  | 'escalated';

export interface CaseMonitoringData {
  submissionDate?: string;
  submissionTime?: string;
  officialPortal?: string;
  department?: string;
  docketNumber?: string;
  citizenReportedStatus: CitizenReportedStatus;
  statutoryDeadlineDays: number;
  statutoryDeadlineDate?: string;
  reminders: CaseReminder[];
  responses: CaseResponseRecord[];
  generatedLetters: FollowUpLetterDraft[];
  lastEvaluatedAt?: string;
}

export interface GrievanceCase {
  id: string;
  title: string;
  category: GrievanceCategory;
  stage: CaseStage;
  status: 'active' | 'pending_attention' | 'ready' | 'resolved';
  isSampleData?: boolean;
  createdAt?: string;
  lastUpdated: string;
  incidentDate: string;
  incidentLocation: string;
  involvedEntity: string;
  disputedAmount?: number;
  currency: string;
  description: string;
  simpleSummary: string;
  readinessScore: number;
  readinessBreakdown: {
    evidenceCompleteness: number;
    timelineClarity: number;
    identityProof: number;
    formalNoticeSent: number;
  };
  recommendedAuthority: {
    name: string;
    portalName: string;
    portalUrl: string;
    filingFee: string;
    averageResolutionTime: string;
  };
  trustCheckRecord?: TrustCheckRecord;
  timeline: TimelineEvent[];
  evidence: EvidenceItem[];
  missingElements: string[];
  complaintDraft: {
    subject: string;
    formalBody: string;
    simpleBody: string;
    reliefSought: string;
    legalAnalysis?: LegalAnalysisResponse | null;
  };
  custodyEvents: CustodyEvent[];
  filingDetails?: {
    referenceNumber?: string;
    authority?: string;
    filingDate?: string;
    officialAckUrl?: string;
    notes?: string;
  };
  monitoring?: CaseMonitoringData;
  deletedAt?: string | null;
}

export type TrustCheckStatus =
  | 'Adverse catalog match'
  | 'Verified adverse match'
  | 'Suspicious indicator'
  | 'No matching record found'
  | 'Unable to verify'
  | 'Source unavailable';

export interface TrustCheckRecord {
  id: string;
  input: string;
  type: 'upi' | 'phone' | 'bank_account' | 'url' | 'email' | 'screenshot' | 'other';
  riskLevel: 'high_risk' | 'suspicious' | 'low_risk' | 'verified';
  resultStatus?: TrustCheckStatus;
  flagTitle: string;
  description: string;
  officialFindings?: string[];
  governmentAdvisories?: Array<{ title: string; authority: string; url?: string }>;
  sourceReferences: string[];
  timestamp: string;
  lastChecked?: string;
  recommendedPrecautions?: string[];
  suggestedNextSteps?: string[];
  isAiObservation?: boolean;
  recommendedActions: string[];
}

export type TrustCheckEnhancedRiskLevel = 'low' | 'medium' | 'high';

export type TrustCheckWarningSource = 'rule_based' | 'ai_assessment';

export interface TrustCheckWarningSign {
  indicator: string;
  explanation: string;
  source: TrustCheckWarningSource;
}

export interface TrustCheckScreenshotPayload {
  mimeType: string;
  dataBase64: string;
  fileName?: string;
  fileSizeBytes?: number;
}

export interface UpiCollectAnalysisRequest {
  message: string;
  requestedAmount?: number | string | null;
  senderUpiId?: string;
  screenshot?: TrustCheckScreenshotPayload | null;
}

export interface UpiCollectAnalysisResult {
  mode: 'upi_collect';
  riskLevel: TrustCheckEnhancedRiskLevel;
  riskScore: number;
  summary: string;
  observedEvidence: string[];
  riskIndicators: string[];
  warningSigns: TrustCheckWarningSign[];
  pinSafetyNotice: string;
  recommendedImmediateActions: string[];
  safeNextSteps: string[];
  sensitiveDataRedacted: boolean;
  modelUsed: string;
  assessmentSource: 'gemini_and_deterministic_rules';
  aiDisclaimer: string;
  analyzedAt: string;
}

export type TransactionConsistency = 'consistent' | 'inconsistent' | 'uncertain';

export interface SuspiciousTransactionAnalysisRequest {
  amount: number | string;
  dateTime: string;
  counterpartyName?: string;
  upiOrDestination?: string;
  utrOrReferenceId?: string;
  descriptionOrSms?: string;
  recognizesTransaction: boolean;
  personallyAuthorized: boolean;
  screenshot?: TrustCheckScreenshotPayload | null;
}

export interface SuspiciousTransactionAnalysisResult {
  mode: 'suspicious_transaction';
  riskLevel: TrustCheckEnhancedRiskLevel;
  riskScore: number;
  summary: string;
  consistencyAssessment: TransactionConsistency;
  consistencyExplanation: string;
  observedEvidence: string[];
  riskIndicators: string[];
  warningSigns: TrustCheckWarningSign[];
  recommendedImmediateActions: string[];
  suggestedNextSteps: string[];
  sensitiveDataRedacted: boolean;
  modelUsed: string;
  assessmentSource: 'gemini_and_deterministic_rules';
  aiDisclaimer: string;
  analyzedAt: string;
}

export interface AuthorityGuide {
  id: string;
  category: GrievanceCategory;
  authorityName: string;
  jurisdiction: string;
  officialPortal: string;
  portalUrl: string;
  filingProcedure: string[];
  eligibility: string[];
  requiredDocuments: string[];
  statutoryDeadlines: string;
  escalationLadder: {
    level: number;
    tier: string;
    timeline: string;
    description: string;
  }[];
}

export interface NavigatorSession {
  caseId: string;
  guideId: string;
  currentStep: number;
  ackNumber: string;
  ackFilingDate: string;
  savedAt?: string;
}

// =============================================================================
// STATUTORY LEGAL ANALYSIS TYPES (Batch 2B)
// Matches server.ts POST /api/gemini/legal-analysis response schema
// =============================================================================

export interface EvidenceTaxonomySummary {
  citizenAllegationsCount: number;
  documentObservationsCount: number;
  forensicAuditRequiredCount: number;
}

export interface LegalAnalysisAssessmentMetadata {
  evaluatedAt: string;
  isUnsavedDraft: boolean;
  targetEntity: string;
  disputedAmount: number;
  evidenceTaxonomySummary: EvidenceTaxonomySummary;
}

export interface LegalAnalysisFindings {
  temporalJurisdiction: TemporalEvaluationResult;
  rbiCommercialBanksProtection: RbiEvaluationResult;
  consumerProtectionAct: CpaEvaluationResult;
  criminalOffencesAssessment: OffenceAssessmentResult;
  assessmentMetadata: LegalAnalysisAssessmentMetadata;
}

export interface LegalAnalysisResponse {
  success: true;
  isFallback: boolean;
  modelUsed: string;
  synthesis: string;
  findings: LegalAnalysisFindings;
}

export interface LegalAnalysisErrorResponse {
  error: string;
  message: string;
}

