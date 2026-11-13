import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  GrievanceCase,
  GrievanceCategory,
  EvidenceItem,
  TimelineEvent,
  TrustCheckRecord,
  CustodyEvent,
  LegalAnalysisResponse,
} from '../types';
import { requestLegalAnalysis } from '../utils/legalAnalysisClient';
import { getValidAccessToken } from '../utils/authSession';
import { useLanguage } from '../context/LanguageContext';
import {
  calculateSha256,
  createCustodyEvent,
  formatFileSize,
  exportChainOfCustodyReport,
} from '../utils/caseStorage';
import {
  uploadEvidenceBlob,
  downloadEvidenceBlob,
  verifyEvidenceBytes,
} from '../utils/evidenceStorage';
import {
  resolveExhibitOcrData,
  hasGenuineOcrContent,
  ExhibitOcrData,
} from '../utils/evidenceOcr';
import {
  getTrustCheckBadgeConfig,
  getTrustCheckSourceLabel,
} from './TrustCheck';
import { GuidedNavigationHeader } from './GuidedNavigationHeader';
import { LegalMarkdownRenderer } from './LegalMarkdownRenderer';
import {
  getEvidenceRecommendations,
  associateExhibitWithRecommendation,
  unlinkExhibitFromRecommendation,
  DebitStatus,
  EvidenceRecommendation,
} from '../utils/evidenceRecommendations';
import {
  MicrophoneRecorder,
  audioFileToBase64,
  createSampleAudioBase64,
} from '../utils/audioUtils';
import {
  CHAT_CLIENT_TIMEOUT_MS,
  TRANSCRIBE_CLIENT_TIMEOUT_MS,
  boundConversationHistory,
  fetchWithTimeout,
  formatAiErrorMessage,
} from '../utils/aiClientUtils';
import {
  Sparkles,
  Upload,
  Mic,
  MicOff,
  Check,
  ChevronRight,
  ChevronLeft,
  FileText,
  AlertCircle,
  HelpCircle,
  Paperclip,
  Trash2,
  Calendar,
  MapPin,
  Building,
  IndianRupee,
  ShieldCheck,
  Send,
  Bot,
  Loader2,
  FileAudio,
  UploadCloud,
  CheckCircle2,
  Clock,
  Layers,
  Info,
  Globe,
  Languages,
  Eye,
  FileSearch,
  AlertTriangle,
  ShieldAlert,
  Lock,
  Shield,
  Download,
  Copy,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ScanLine,
  Search,
  Maximize2,
  FileCode,
  FileCheck2,
  ListTodo,
  Scale,
  Bookmark,
  RefreshCw,
} from 'lucide-react';

interface CaseBuilderProps {
  initialCase?: GrievanceCase;
  initialPrompt?: string;
  initialTrustRecord?: TrustCheckRecord | null;
  initialStep?: number;
  onSaveCase: (updatedCase: GrievanceCase, proceedToNavigator?: boolean) => Promise<boolean | void> | void;
  onCancel: () => void;
  onStartNewCase?: () => void;
}

export type SaveOperationResult = 'saved' | 'discarded_stale' | 'failed';

export interface CaseBaselineState {
  caseId: string;
  title: string;
  description: string;
  category: string;
  disputedAmount: number;
  involvedEntity: string;
  incidentDate?: string;
  incidentLocation?: string;
  evidenceCount: number;
  currentStep: number;
  evidenceFingerprint?: string;
  timelineFingerprint?: string;
  custodyFingerprint?: string;
  savedAnalysisEvaluatedAt?: string | null;
  evidenceMappingKey?: string;
}

/**
 * Computes a comprehensive deterministic fingerprint covering all persisted Exhibit fields.
 * Includes: id, title, category, fileName, fileSize, fileSizeBytes, fileType, uploadDate,
 * sha256Hash, storageRef, exact rawOcrText, hasBlob, ocrExtracted components, flag, claimMappedTo, verifiedOriginal.
 */
export function computeEvidenceFingerprint(evidence: EvidenceItem[]): string {
  if (!Array.isArray(evidence) || evidence.length === 0) return 'empty';
  return evidence
    .map((e) => {
      const ocrExt = e.ocrExtracted
        ? [
            (e.ocrExtracted.dates || []).join(','),
            (e.ocrExtracted.amounts || []).join(','),
            (e.ocrExtracted.identifiers || []).join(','),
            (e.ocrExtracted.parties || []).join(','),
            e.ocrExtracted.summary || '',
          ].join(':')
        : 'none';
      const flagStr = e.flag ? `${e.flag.type || ''}:${e.flag.message || ''}` : 'none';
      return [
        e.id || '',
        e.title || '',
        e.category || '',
        e.fileName || '',
        e.fileSize || '',
        e.fileSizeBytes ?? '',
        e.fileType || '',
        e.uploadDate || '',
        e.sha256Hash || '',
        e.storageRef || '',
        e.rawOcrText || '',
        e.hasBlob ? 'blob' : 'noblob',
        e.ocrStatus || e.ocrExtracted?.status || '',
        ocrExt,
        flagStr,
        e.claimMappedTo || '',
        e.verifiedOriginal ? 'orig' : 'unver',
      ].join('~');
    })
    .join('##');
}

/**
 * Computes a deterministic fingerprint representing the timeline events and documentary verifications.
 */
export function computeTimelineFingerprint(timeline: TimelineEvent[]): string {
  if (!Array.isArray(timeline) || timeline.length === 0) return 'empty';
  return timeline
    .map((t) => [
      t.id || '',
      t.date || '',
      t.title || '',
      t.description || '',
      t.evidenceId || '',
      t.verifiedByDoc ? 'verified' : 'unverified',
    ].join('~'))
    .join('##');
}

/**
 * Computes a deterministic fingerprint representing the tamper-evident chain-of-custody audit log.
 */
export function computeCustodyFingerprint(custody: CustodyEvent[]): string {
  if (!Array.isArray(custody) || custody.length === 0) return 'empty';
  return custody
    .map((c) => [
      c.id || '',
      c.caseId || '',
      c.evidenceId || '',
      c.eventType || '',
      c.action || '',
      c.actor || '',
      c.timestamp || '',
      c.details || '',
      c.fileHash || '',
    ].join('~'))
    .join('##');
}

/**
 * Computes a legacy exhibit recommendation mapping key for backward compatibility.
 */
export function computeEvidenceMappingKey(evidence: EvidenceItem[]): string {
  return (evidence || []).map((e) => `${e.id}:${e.claimMappedTo || ''}`).join('|');
}

/**
 * Derives the exact confirmed baseline state strictly from an immutable case record snapshot and step.
 */
export function deriveBaselineFromRecord(record: GrievanceCase, step: number): CaseBaselineState {
  return {
    caseId: record.id,
    title: record.title || '',
    description: record.description || '',
    category: record.category,
    disputedAmount: Number(record.disputedAmount) || 0,
    involvedEntity: record.involvedEntity || '',
    incidentDate: record.incidentDate || '',
    incidentLocation: record.incidentLocation || '',
    evidenceCount: (record.evidence || []).length,
    currentStep: step,
    evidenceFingerprint: computeEvidenceFingerprint(record.evidence || []),
    timelineFingerprint: computeTimelineFingerprint(record.timeline || []),
    custodyFingerprint: computeCustodyFingerprint(record.custodyEvents || []),
    savedAnalysisEvaluatedAt: record.complaintDraft?.legalAnalysis?.findings?.assessmentMetadata?.evaluatedAt || null,
    evidenceMappingKey: computeEvidenceMappingKey(record.evidence || []),
  };
}

/**
 * Guard to verify if debounced extraction should run.
 * Prevents redundant re-extraction during initial hydration of existing populated cases.
 */
export function shouldTriggerDebouncedExtraction(
  description: string,
  lastExtracted: string,
  currentStep: number
): boolean {
  if (currentStep !== 1 || !description || description.trim().length < 15) return false;
  return description !== lastExtracted;
}

/**
 * Guard to verify if automatic category extraction should update the active category state.
 * Once a citizen explicitly selects a category manually, automatic extraction does not override it.
 */
export function shouldUpdateCategoryOnExtraction(
  extractedCategory?: GrievanceCategory,
  isCategoryManuallyModified = false
): boolean {
  if (!extractedCategory) return false;
  return !isCategoryManuallyModified;
}

/**
 * Determines whether user actions or edits have changed the case state from its confirmed baseline.
 * Performs deep, comprehensive comparison across all persisted case and exhibit dimensions.
 */
export function hasCaseChangedFromBaseline(
  current: CaseBaselineState,
  baseline: CaseBaselineState
): boolean {
  return (
    current.caseId !== baseline.caseId ||
    current.title !== baseline.title ||
    current.description !== baseline.description ||
    current.category !== baseline.category ||
    current.disputedAmount !== baseline.disputedAmount ||
    current.involvedEntity !== baseline.involvedEntity ||
    (current.incidentDate || '') !== (baseline.incidentDate || '') ||
    (current.incidentLocation || '') !== (baseline.incidentLocation || '') ||
    current.evidenceCount !== baseline.evidenceCount ||
    current.currentStep !== baseline.currentStep ||
    (current.evidenceFingerprint || '') !== (baseline.evidenceFingerprint || '') ||
    (current.timelineFingerprint || '') !== (baseline.timelineFingerprint || '') ||
    (current.custodyFingerprint || '') !== (baseline.custodyFingerprint || '') ||
    (current.savedAnalysisEvaluatedAt || '') !== (baseline.savedAnalysisEvaluatedAt || '') ||
    Boolean(
      current.evidenceMappingKey !== undefined &&
      baseline.evidenceMappingKey !== undefined &&
      current.evidenceMappingKey !== baseline.evidenceMappingKey
    )
  );
}

/**
 * Detects whether an identifier represents a website URL, domain, or executable/APK link,
 * rather than a genuine corporate or banking entity name.
 */
export function isUrlOrDomainIndicator(input?: string | null): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (!trimmed) return false;

  // Explicit URL schemes or www prefix
  if (/^(?:https?|ftp|file):\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
    return true;
  }

  // File extension indicative of suspicious downloads / APKs
  if (/\.(?:apk|exe|dmg|pkg|deb|rpm|zip|rar|tar|gz)(?:[\/?#]|$)/i.test(trimmed)) {
    return true;
  }

  // Bare domain or domain with path (without spaces)
  // Legal entity / company names have spaces (e.g. "Tata Power") or standard plain names without dots/TLDs
  if (!trimmed.includes(' ')) {
    const domainPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?:\.[a-z]{2,})(?::\d+)?(?:\/.*)?$/i;
    if (domainPattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Detects whether an identifier represents an unspecified or unknown respondent,
 * rather than a verified legal corporate, utility, or banking entity.
 */
export function isUnknownEntity(entity?: string | null): boolean {
  if (!entity || typeof entity !== 'string') return true;
  const trimmed = entity.trim().toLowerCase();
  if (!trimmed) return true;
  const unknownTokens = [
    'unknown',
    'unknown entity',
    'unknown party',
    'unknown respondent',
    'unspecified',
    'unspecified party',
    'opposite party',
    'not known',
    'not specified',
    'n/a',
    'na',
    'none',
    'pending',
    'anonymous',
  ];
  return unknownTokens.includes(trimmed);
}

export interface RecommendedAuthorityInfo {
  name: string;
  portalName: string;
  portalUrl: string;
}

export const CATEGORY_AUTHORITY_MAP: Record<GrievanceCategory, RecommendedAuthorityInfo> = {
  banking_financial: {
    name: 'Reserve Bank of India (RBI) Integrated Ombudsman Scheme',
    portalName: 'CMS Portal (cms.rbi.org.in)',
    portalUrl: 'https://cms.rbi.org.in',
  },
  consumer_ecommerce: {
    name: 'National Consumer Disputes Redressal Commission / e-Daakhil',
    portalName: 'e-Daakhil Portal (edaakhil.nic.in)',
    portalUrl: 'https://edaakhil.nic.in',
  },
  real_estate_rera: {
    name: 'State Real Estate Regulatory Authority (RERA)',
    portalName: 'State RERA Portal',
    portalUrl: 'https://rera.nic.in',
  },
  insurance_claims: {
    name: 'Insurance Ombudsman / IRDAI Bima Bharosa',
    portalName: 'Bima Bharosa Portal',
    portalUrl: 'https://bimabharosa.irdai.gov.in',
  },
  municipal_civic: {
    name: 'CPGRAMS / Ministry of Personnel, Public Grievances',
    portalName: 'CPGRAMS Portal (pgportal.gov.in)',
    portalUrl: 'https://pgportal.gov.in',
  },
  telecom_isp: {
    name: 'Department of Telecommunications (DoT / Sanchar Saathi)',
    portalName: 'Telecom Grievance Cell',
    portalUrl: 'https://sancharsaathi.gov.in',
  },
  employment_labour: {
    name: 'Office of the Labour Commissioner / Samadhan Portal',
    portalName: 'Ministry of Labour Portal',
    portalUrl: 'https://labour.gov.in',
  },
  utilities_power: {
    name: 'Electricity Consumer Grievance Redressal Forum (CGRF)',
    portalName: 'State Electricity Regulatory Commission',
    portalUrl: 'https://cgrf.gov.in',
  },
};

export function getRecommendedAuthority(category: GrievanceCategory): RecommendedAuthorityInfo {
  return CATEGORY_AUTHORITY_MAP[category] || CATEGORY_AUTHORITY_MAP.banking_financial;
}

export function formatCategoryLabel(category: GrievanceCategory): string {
  const map: Record<GrievanceCategory, string> = {
    banking_financial: 'Banking & UPI Financial Fraud (RBI Ombudsman)',
    consumer_ecommerce: 'Consumer Goods & E-Commerce Defect (e-Daakhil / NCDRC)',
    real_estate_rera: 'Real Estate Possession Delay (State RERA)',
    insurance_claims: 'Insurance Claim Repudiation (IRDAI Bima Bharosa)',
    municipal_civic: 'Central / State Civic Grievance (CPGRAMS)',
    telecom_isp: 'Telecom & SIM Fraud (TRAI / Sanchar Saathi)',
    employment_labour: 'Labour & Workplace Compensation (Samadhan)',
    utilities_power: 'Electricity & Power Utility (CGRF)',
  };
  return map[category] || category;
}

export function deriveMissingElements(params: {
  description?: string;
  involvedEntity?: string;
  incidentDate?: string;
  disputedAmount?: number;
  evidenceList?: EvidenceItem[];
  timeline?: TimelineEvent[];
}): string[] {
  const missing: string[] = [];
  const evidence = params.evidenceList || [];
  const entity = params.involvedEntity || '';
  const desc = params.description || '';
  const date = params.incidentDate || '';
  const amount = params.disputedAmount;
  const timeline = params.timeline || [];

  if (evidence.length === 0) {
    missing.push('No documentary evidence or transaction records attached.');
  }
  if (!entity.trim() || isUnknownEntity(entity) || isUrlOrDomainIndicator(entity)) {
    missing.push('Opposite party / respondent entity is not clearly identified.');
  }
  if (!amount || amount <= 0) {
    missing.push('Specific disputed financial sum is not quantified.');
  }
  if (!date.trim()) {
    missing.push('Incident occurrence date is missing.');
  }
  if (!desc.trim() || desc.trim().length < 30) {
    missing.push('Factual grievance narrative is incomplete or brief.');
  }
  if (timeline.length === 0) {
    missing.push('Incident timeline chronology has not been established.');
  }

  return missing;
}

export interface PrerequisiteNoticeAssessment {
  state: 'none' | 'correspondence' | 'notice' | 'complaint_ticket';
  score: number;
  note: string;
}

export interface EvidenceMaturitySummary {
  uploaded: number;
  processed: number;
  relevant: number;
  verified: number;
}

function isEvidenceUsableForAssessment(item: EvidenceItem): boolean {
  const effectiveStatus = item.ocrStatus || item.ocrExtracted?.status;
  if (effectiveStatus === 'pending' || effectiveStatus === 'no_text' || effectiveStatus === 'failed') {
    return false;
  }
  if (item.hasBlob === true) {
    return hasGenuineOcrContent(item) || item.verifiedOriginal === true;
  }
  return hasGenuineOcrContent(item) || item.verifiedOriginal === true;
}

/**
 * Classifies exhibits along 4 independent evidentiary stages:
 * - uploaded: total attached exhibits (physical blob or metadata exhibit)
 * - processed: exhibits with genuine OCR text / extracted fields (excludes pending, no_text, failed)
 * - relevant: processed exhibits mapped to a claim or carrying a specific evidentiary category (excludes generic screenshot unless mapped)
 * - verified: exhibits explicitly verified as originals (SHA-256 upload alone never marks verifiedOriginal)
 */
export function evaluateEvidenceMaturity(evidenceList?: EvidenceItem[]): EvidenceMaturitySummary {
  if (!evidenceList || evidenceList.length === 0) {
    return { uploaded: 0, processed: 0, relevant: 0, verified: 0 };
  }

  let processed = 0;
  let relevant = 0;
  let verified = 0;

  for (const item of evidenceList) {
    const usable = isEvidenceUsableForAssessment(item);
    if (usable) {
      processed++;
      const hasSpecificCategory = Boolean(
        item.category &&
          ['bank_statement', 'receipt', 'agreement', 'notice', 'correspondence'].includes(item.category)
      );
      if (Boolean(item.claimMappedTo) || hasSpecificCategory) {
        relevant++;
      }
    }

    if (item.verifiedOriginal === true && (!item.hasBlob || Boolean(item.sha256Hash))) {
      verified++;
    }
  }

  return {
    uploaded: evidenceList.length,
    processed,
    relevant,
    verified,
  };
}

/**
 * Truthfully evaluates prerequisite dispute communication based strictly on readable/processed exhibits.
 * Pending, no_text, or failed uploads NEVER earn notice/correspondence/ticket credit from filenames alone.
 */
export function evaluatePrerequisiteNotice(evidenceList?: EvidenceItem[]): PrerequisiteNoticeAssessment {
  if (!evidenceList || evidenceList.length === 0) {
    return {
      state: 'none',
      score: 0,
      note: 'No prior dispute ticket or notice attached',
    };
  }

  const usableExhibits = evidenceList.filter(isEvidenceUsableForAssessment);
  if (usableExhibits.length === 0) {
    return {
      state: 'none',
      score: 0,
      note: 'No readable dispute ticket or notice detected (OCR scan pending or no text detected)',
    };
  }

  const isComplaintTicket = (item: EvidenceItem): boolean => {
    const ticketRecs = ['rec_bank_complaint', 'rec_telecom_docket', 'rec_municipal_token', 'rec_delay_representation'];
    if (item.claimMappedTo && ticketRecs.includes(item.claimMappedTo)) {
      return true;
    }
    const lowerText = `${item.title || ''} ${item.fileName || ''} ${item.ocrExtracted?.summary || ''} ${item.rawOcrText || ''}`.toLowerCase();
    const ticketKeywords = [
      'acknowledgement',
      'acknowledgment',
      'docket',
      'ticket number',
      'complaint number',
      'grievance ref',
      'crm ref',
      'complaint acknowledgement',
      'sr number',
      'service request number',
    ];
    return ticketKeywords.some((kw) => lowerText.includes(kw));
  };

  const isNoticeDoc = (item: EvidenceItem): boolean => {
    if (item.category === 'notice') return true;
    if (item.claimMappedTo === 'rec_discom_utility_notice') return true;
    const lowerText = `${item.title || ''} ${item.fileName || ''} ${item.ocrExtracted?.summary || ''}`.toLowerCase();
    return lowerText.includes('notice') || lowerText.includes('legal notice') || lowerText.includes('demand letter');
  };

  const isCorrespondenceDoc = (item: EvidenceItem): boolean => {
    if (item.category === 'correspondence') return true;
    if (item.claimMappedTo === 'rec_seller_communication' || item.claimMappedTo === 'rec_claim_repudiation') return true;
    const lowerText = `${item.title || ''} ${item.fileName || ''} ${item.ocrExtracted?.summary || ''}`.toLowerCase();
    return lowerText.includes('email') || lowerText.includes('chat') || lowerText.includes('correspondence') || lowerText.includes('support ticket');
  };

  // State D: Complaint acknowledgement / formal ticket attached (85%)
  if (usableExhibits.some(isComplaintTicket)) {
    return {
      state: 'complaint_ticket',
      score: 85,
      note: 'Complaint acknowledgement / formal ticket attached',
    };
  }

  // State C: Notice document attached, delivery / service not independently established (60%)
  if (usableExhibits.some(isNoticeDoc)) {
    return {
      state: 'notice',
      score: 60,
      note: 'Notice document attached (delivery / service not independently established)',
    };
  }

  // State B: Customer correspondence attached, formal dispute ticket unverified (40%)
  if (usableExhibits.some(isCorrespondenceDoc)) {
    return {
      state: 'correspondence',
      score: 40,
      note: 'Customer correspondence attached (formal dispute ticket unverified)',
    };
  }

  // State A: No prior communication attached (0%)
  return {
    state: 'none',
    score: 0,
    note: 'No prior dispute ticket or notice attached',
  };
}

export interface CaseReadinessResult {
  score: number;
  tier: 'ready' | 'needs_info' | 'incomplete';
  breakdown: {
    evidenceCompleteness: number;
    timelineClarity: number;
    identityProof: number;
    formalNoticeSent: number;
  };
  evidenceMaturity: EvidenceMaturitySummary;
  prerequisiteNotice: PrerequisiteNoticeAssessment;
}

/**
 * Calculates dynamic case readiness based on 4 factual pillars:
 * 1. Evidence Completeness (35% weight) — requires processed/relevant exhibits (pending/no_text/failed earn 0%)
 * 2. Incident Timeline Clarity (25% weight)
 * 3. Entity Identification (20% weight)
 * 4. Prerequisite Notice (20% weight)
 *
 * Strict Readiness Guard:
 * - Unprocessed, pending, or no-text exhibits earn 0 completeness/notice points.
 * - 0 processed exhibits: Tier is strictly capped at 'incomplete'.
 * - 1 processed exhibit: Tier can be at most 'needs_info'.
 * - 2+ processed exhibits with relevance and score >= 80 required for 'ready' tier.
 */
export function calculateCaseReadiness(params: {
  description?: string;
  involvedEntity?: string;
  incidentDate?: string;
  disputedAmount?: number;
  evidenceList?: EvidenceItem[];
}): CaseReadinessResult {
  const description = params.description || '';
  const involvedEntity = params.involvedEntity || '';
  const incidentDate = params.incidentDate || '';
  const evidenceList = params.evidenceList || [];

  const evidenceMaturity = evaluateEvidenceMaturity(evidenceList);

  // 1. Evidence Completeness (0 to 100)
  // Only processed/readable exhibits contribute to evidentiary completeness.
  let evidenceCompleteness = 0;
  if (evidenceList.length > 0) {
    let earnedEvidence = 0;
    for (const item of evidenceList) {
      if (!isEvidenceUsableForAssessment(item)) {
        continue;
      }
      const hasSpecificCategory =
        item.category &&
        ['bank_statement', 'receipt', 'agreement', 'notice', 'correspondence'].includes(item.category);
      const isMapped = Boolean(item.claimMappedTo);
      if (isMapped || hasSpecificCategory) {
        earnedEvidence += 45;
      } else {
        earnedEvidence += 25;
      }
    }
    evidenceCompleteness = Math.min(100, earnedEvidence);
  }

  // 2. Incident Timeline Clarity (0 to 100)
  let timelineClarity = 40;
  if (description.trim().length > 50) timelineClarity += 35;
  if (incidentDate.trim()) timelineClarity += 25;
  timelineClarity = Math.min(100, timelineClarity);

  // 3. Entity Identification (0 to 100)
  // URLs, APK links, domains, and unknown/unspecified respondents receive 0% credit.
  let identityProof = 0;
  const hasValidEntity =
    involvedEntity.trim().length > 0 &&
    !isUrlOrDomainIndicator(involvedEntity) &&
    !isUnknownEntity(involvedEntity);
  if (hasValidEntity) {
    identityProof = 90;
    if (involvedEntity.trim().length > 3) identityProof = 100;
  }

  // 4. Prerequisite Notice Assessment (0 to 100)
  const prerequisiteNotice = evaluatePrerequisiteNotice(evidenceList);
  const formalNoticeSent = prerequisiteNotice.score;

  // 4-Pillar Weighted Score
  const weightedScore = Math.round(
    evidenceCompleteness * 0.35 +
      timelineClarity * 0.25 +
      identityProof * 0.20 +
      formalNoticeSent * 0.20
  );

  const score = Math.max(0, Math.min(95, weightedScore));

  // Evidence-Gated Readiness Tier (requires genuinely processed evidence, not just raw uploads)
  let tier: 'ready' | 'needs_info' | 'incomplete' = 'incomplete';
  if (score >= 80 && evidenceMaturity.processed >= 2 && evidenceMaturity.relevant >= 1) {
    tier = 'ready';
  } else if (score >= 50 && evidenceMaturity.processed >= 1) {
    tier = 'needs_info';
  } else {
    tier = 'incomplete';
  }

  return {
    score,
    tier,
    breakdown: {
      evidenceCompleteness,
      timelineClarity,
      identityProof,
      formalNoticeSent,
    },
    evidenceMaturity,
    prerequisiteNotice,
  };
}

export interface ExtractedGrievanceFacts {
  subject?: string;
  category?: GrievanceCategory;
  involvedEntity?: string;
  disputedAmount?: number;
  incidentDate?: string;
  incidentLocation?: string;
}

/**
 * Intelligent extraction of grievance facts from citizen voice transcripts or written text.
 */
export function extractFactsFromGrievanceText(rawText: string): ExtractedGrievanceFacts {
  if (!rawText || !rawText.trim()) return {};

  const text = rawText.trim();
  const lower = text.toLowerCase();
  const facts: ExtractedGrievanceFacts = {};

  // 1. Category Classification
  // High-confidence cyber fraud / phishing / malicious link / apk / unauthorized financial compromise indicators.
  // These take precedence over incidental mentions of electricity, mobile, delivery, or SIM.
  const isExplicitCyberFraud =
    /\b(pay\.apk|\.apk|apk\b|malware|trojan|ransomware|spyware|sideload(?:ing)?)\b/i.test(text) ||
    /\b(phishing|phished|vishing|smishing|credential\s*harvesting)\b/i.test(text) ||
    (/\b(otp|one\s*time\s*password)\b/i.test(text) && /\b(theft|scam|fraud|stolen|leak|intercept(?:ion|ed)?|bypass|shared|asked|entered|debited|deducted|unauthori[sz]ed)\b/i.test(text)) ||
    /\b(anydesk|teamviewer|rustdesk|quicksupport|remote\s*access)\b/i.test(text) ||
    /\b(unauthori[sz]ed\s+(?:debit|transaction|transfer|withdrawal|charge|payment|money\s*transfer|deduction))\b/i.test(text) ||
    /\b(sim\s*swap|e-?sim\s*swap|unauthori[sz]ed\s+(?:e-?sim|sim)\s*(?:swap|transfer|port|issuance))\b/i.test(text) ||
    /\b(fake\s+(?:link|url|website|portal|payment\s*link|sms|notice|disconnection|ebill|e-bill|delivery|courier|order|message))\b/i.test(text) ||
    /\b(kyc\s*(?:update|expiry|verification|fraud|scam|link|suspended|block))\b/i.test(text) ||
    /\b(lottery\s*fraud|investment\s*scam|part\s*time\s*job\s*scam|task\s*scam|crypto\s*fraud)\b/i.test(text) ||
    /\b(1930|cyber\s*crime|cyber\s*fraud|cybercrime)\b/i.test(text) ||
    (/\b(courier|package|parcel|postal|india\s*post|delivery)\b/i.test(text) && /\b(link|url|http|https|\.xyz|\.top|\.online|\.site|\.apk|sms)\b/i.test(text) && /\b(debited|fee|otp|fraud|scam|stolen|pay)\b/i.test(text)) ||
    (/\b(disconnection|disconnected|ebill|e-bill|electricity\s*bill)\b/i.test(text) && /\b(link|url|download|install|apk|whatsapp|sms)\b/i.test(text)) ||
    (/\bhttps?:\/\/[^\s]+/i.test(text) && /\b(debited|deducted|stolen|loss|fraud|scam|unauthori[sz]ed|otp)\b/i.test(text));

  const isUtilitiesPower =
    /\b(electricity|power\s*cut|power\s*outage|power\s*supply|electric\s*meter|smart\s*meter|discom|bescom|tneb|mseb|bses|uppcl|dhbvn|cesc|voltage\s*fluctuation|bijli|power\s*utility|electricity\s*bill|tariff|meter\s*reading|load\s*shedding)\b/i.test(text);

  const isConsumerEcommerce =
    /\b(amazon|flipkart|meesho|myntra|ajio|tata\s*cliq|snapdeal|nykaa|e-?commerce|shopping\s*portal|online\s*shopping)\b/i.test(text) ||
    /\b(placed\s*(?:an\s*)?order|online\s*order|order\s*id|ordered\s+(?:a|an|the)\b|order\s*(?:cancellation|cancelled|delayed|status))\b/i.test(text) ||
    /\b(defective\s*(?:product|item|goods|device|appliance)|damaged\s*(?:product|item|goods|parcel)|manufacturing\s*defect|warranty|guarantee|seller|replacement|refund\s*for\s*(?:returned|cancelled|damaged|order)|return\s*request|return\s*pickup)\b/i.test(text) ||
    /\b(courier|courier\s*delivery|package\s*delivery|parcel\s*delivery|delayed\s*delivery|non-delivery|failed\s*delivery|wrong\s*item\s*delivered|delivery\s*agent|delivery\s*partner|delivery\s*person)\b/i.test(text) ||
    /\b(television|\btv\b|smart\s*tv|refrigerator|washing\s*machine|air\s*conditioner|headphone|earbuds)\b/i.test(text) ||
    /\b(?:ordered|purchased|bought|defective|damaged|repaired)\s+(?:a\s+)?(?:mobile|phone|smartphone|handset|laptop)\b/i.test(text) ||
    /\b(?:mobile|phone|smartphone|handset|laptop)\s+(?:purchase|order|warranty|defect|replacement|repair|screen\s*replacement)\b/i.test(text);

  const isTelecomIsp =
    /\b(telecom|broadband|wifi|wi-fi|fiber|fibre|internet\s*service|trai|sanchar\s*saathi|recharge|mobile\s*recharge|sim\s*card|sim\s*deactivation|network\s*coverage|call\s*drop|porting|mnp|airtel|jio|vodafone|\bvi\b|bsnl|mtnl)\b/i.test(text);

  const isRealEstateRera =
    /\b(rera|builder|developer|possession|flat|apartment|housing\s*society|allotment|occupancy\s*certificate|completion\s*certificate|carpet\s*area|promoter|floor\s*plan|super\s*built-up)\b/i.test(text);

  const isInsuranceClaims =
    /\b(insurance|mediclaim|cashless|irdai|tpa|claim\s*repudiation|claim\s*rejection|health\s*insurance|motor\s*insurance|life\s*insurance|policy\s*premium|hospital\s*bill\s*claim|reimbursement\s*claim)\b/i.test(text);

  const isBankingFinancial =
    /\b(bank|banking|atm|upi|credit\s*card|debit\s*card|rbi|sbi|hdfc|icici|axis|pnb|bob|kotak|canara|paytm|phonepe|gpay|google\s*pay|bhim|loan|emi|account\s*debit|savings\s*account|current\s*account|fixed\s*deposit|chargeback|banking\s*ombudsman|financial\s*fraud|cheque|overdraft|forex)\b/i.test(text) ||
    /\b(airtel|jio|paytm)\s*payments?\s*bank\b/i.test(text);

  const isMunicipalCivic =
    /\b(municipal|corporation|drainage|sewage|garbage|trash|pothole|road\s*repair|street\s*light|water\s*supply|water\s*contamination|civic|panchayat|cpgrams)\b/i.test(text);

  const isEmploymentLabour =
    /\b(salary|wages|employer|employee|gratuity|provident\s*fund|\bpf\b|epfo|samadhan|unpaid\s*salary|wrongful\s*termination|severance|bonus|labour\s*court)\b/i.test(text);

  if (isExplicitCyberFraud) {
    facts.category = 'banking_financial';
  } else if (isUtilitiesPower) {
    facts.category = 'utilities_power';
  } else if (isConsumerEcommerce) {
    facts.category = 'consumer_ecommerce';
  } else if (isTelecomIsp) {
    facts.category = 'telecom_isp';
  } else if (isRealEstateRera) {
    facts.category = 'real_estate_rera';
  } else if (isInsuranceClaims) {
    facts.category = 'insurance_claims';
  } else if (isBankingFinancial) {
    facts.category = 'banking_financial';
  } else if (isMunicipalCivic) {
    facts.category = 'municipal_civic';
  } else if (isEmploymentLabour) {
    facts.category = 'employment_labour';
  }

  // 2. Disputed Amount Extraction
  // 1. Prefix: Rs. 4500, Rs 4,500, Rs.4500, INR 4500, ₹4,500, Re. 1, etc.
  const prefixMatch = text.match(
    /(?:(?:rs|re)\.?\s*|inr\.?\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)(?!\s*(?:st|nd|rd|th|am|pm|hours|hrs|minutes|mins|days|months|years|year|old|\/))/i
  );
  if (prefixMatch && prefixMatch[1]) {
    const rawVal = prefixMatch[1].replace(/,/g, '');
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0) facts.disputedAmount = num;
  }

  // 2. Suffix: 4500 rupees, 4,500 rs, 4500 inr, 4,500/-
  if (!facts.disputedAmount) {
    const suffixMatch = text.match(
      /([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rupee|rs\.?|inr|\/-)(?!\w)/i
    );
    if (suffixMatch && suffixMatch[1]) {
      const rawVal = suffixMatch[1].replace(/,/g, '');
      const num = parseFloat(rawVal);
      if (!isNaN(num) && num > 0) facts.disputedAmount = num;
    }
  }

  // 3. Contextual keywords: "amount of 4500", "deducted 4500", "loss of 4,500"
  if (!facts.disputedAmount) {
    const contextMatch = text.match(
      /(?:amount(?:ing)?(?:\s+of)?|sum\s+of|worth(?:\s+of)?|loss\s+of|disputed(?:\s+amount)?(?:\s+of)?|debited(?:\s+amount)?(?:\s+of)?|deducted(?:\s+amount)?(?:\s+of)?)\s+(?:(?:rs|re)\.?\s*|inr\.?\s*|₹\s*)?([\d,]+(?:\.\d{1,2})?)(?!\s*(?:st|nd|rd|th|am|pm|hours|hrs|minutes|mins|days|months|years|year|old|\/))/i
    );
    if (contextMatch && contextMatch[1]) {
      const rawVal = contextMatch[1].replace(/,/g, '');
      const num = parseFloat(rawVal);
      if (!isNaN(num) && num > 0) facts.disputedAmount = num;
    }
  }

  // 3. Involved Entity Extraction
  const knownEntities = [
    'State Bank of India',
    'SBI',
    'HDFC Bank',
    'HDFC',
    'ICICI Bank',
    'ICICI',
    'Axis Bank',
    'Punjab National Bank',
    'PNB',
    'Bank of Baroda',
    'Kotak Mahindra Bank',
    'Kotak Bank',
    'IndusInd Bank',
    'Yes Bank',
    'Apex Bank',
    'PhonePe',
    'Google Pay',
    'GPay',
    'Paytm',
    'Amazon',
    'Flipkart',
    'Myntra',
    'Meesho',
    'Tata Power',
    'Adani Electricity',
    'BESCOM',
    'MSEDCL',
    'DHBVN',
    'UPPCL',
    'BSES',
    'Airtel',
    'Reliance Jio',
    'Jio',
    'Vodafone Idea',
    'VI',
    'BSNL',
  ];

  for (const entity of knownEntities) {
    const escaped = entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(text)) {
      facts.involvedEntity = entity;
      break;
    }
  }

  if (!facts.involvedEntity) {
    const entityMatch = text.match(
      /(?:against|with|from|by)\s+([A-Z][a-zA-Z0-9\s&]{2,30}?)(?=\s+(?:bank|portal|store|app|company|pvt|ltd|branch|\.|\,|$))/i
    );
    if (entityMatch && entityMatch[1]) {
      const candidate = entityMatch[1].trim();
      if (!['my', 'the', 'an', 'a', 'this', 'that'].includes(candidate.toLowerCase()) && !isUrlOrDomainIndicator(candidate)) {
        facts.involvedEntity = candidate;
      }
    }
  }

  // 4. Incident Location Extraction
  const cityStateMatch = text.match(
    /(?:happened in|occurred in|location:\s*|in\s+|at\s+)([A-Za-z\s]+,\s*[A-Za-z\s]+?)(?=[.!?\n]|,\s*but|\s+and|\s+I\b|$)/i
  );
  if (cityStateMatch && cityStateMatch[1]) {
    const candidate = cityStateMatch[1].trim();
    if (candidate.length >= 4 && candidate.length <= 40 && !/^(the|a|an|this|that|my)\b/i.test(candidate)) {
      facts.incidentLocation = candidate;
    }
  }

  if (!facts.incidentLocation) {
    const majorLocations = [
      'Noida, Uttar Pradesh',
      'Gurugram, Haryana',
      'Mumbai, Maharashtra',
      'Pune, Maharashtra',
      'Bengaluru, Karnataka',
      'Bangalore, Karnataka',
      'Hyderabad, Telangana',
      'Chennai, Tamil Nadu',
      'Kolkata, West Bengal',
      'Ahmedabad, Gujarat',
      'Jaipur, Rajasthan',
      'Lucknow, Uttar Pradesh',
      'Mumbai',
      'Delhi',
      'New Delhi',
      'Bengaluru',
      'Bangalore',
      'Hyderabad',
      'Chennai',
      'Kolkata',
      'Pune',
      'Ahmedabad',
      'Jaipur',
      'Lucknow',
      'Chandigarh',
      'Noida',
      'Gurugram',
      'Gurgaon',
      'Surat',
      'Bhopal',
      'Patna',
      'Kochi',
      'Thane',
      'Nagpur',
      'Indore',
      'Bhubaneswar',
      'Goa',
    ];

    for (const loc of majorLocations) {
      const escaped = loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`\\b${escaped}\\b`, 'i');
      if (reg.test(text)) {
        facts.incidentLocation = loc;
        break;
      }
    }
  }

  // 5. Incident Date Extraction
  const isoDateMatch = text.match(/\b(202\d-\d{2}-\d{2})\b/);
  if (isoDateMatch) {
    facts.incidentDate = isoDateMatch[1];
  } else {
    const slashDateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](202\d|\d{2})\b/);
    if (slashDateMatch) {
      const d = slashDateMatch[1].padStart(2, '0');
      const m = slashDateMatch[2].padStart(2, '0');
      const y = slashDateMatch[3].length === 2 ? `20${slashDateMatch[3]}` : slashDateMatch[3];
      facts.incidentDate = `${y}-${m}-${d}`;
    } else {
      const naturalDateMatch = text.match(
        /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(202\d)?\b/i
      );
      if (naturalDateMatch) {
        const monthNames: Record<string, string> = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
          january: '01', february: '02', march: '03', april: '04', june: '06',
          july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
        };
        const d = naturalDateMatch[1].padStart(2, '0');
        const m = monthNames[naturalDateMatch[2].toLowerCase().slice(0, 3)] || '01';
        const y = naturalDateMatch[3] || new Date().getFullYear().toString();
        facts.incidentDate = `${y}-${m}-${d}`;
      }
    }
  }

  // 6. Subject (Title) Extraction
  let cleanIntro = text;
  // Repeatedly strip common conversational greetings and intro phrases
  const preambleRegex = /^(?:hello\s*(?:sir|madam)?|hi\s*(?:sir|madam)?|sir|madam|dear\s*(?:sir|madam)?|please note that|i want to report that|i would like to lodge a complaint regarding|i would like to report that|i am writing to report|this is a complaint regarding|my complaint is regarding|my complaint is that|my issue is that|recently)\s*[:,-]?\s*/i;
  let prevLength = 0;
  while (preambleRegex.test(cleanIntro) && cleanIntro.length !== prevLength) {
    prevLength = cleanIntro.length;
    cleanIntro = cleanIntro.replace(preambleRegex, '').trim();
  }

  const firstSentenceMatch = cleanIntro.match(/^([^.!?\n]+)/);
  let derivedSubject = firstSentenceMatch ? firstSentenceMatch[1].trim() : cleanIntro;

  if (derivedSubject.length > 90) {
    derivedSubject = derivedSubject.slice(0, 87).replace(/\s+\S*$/, '') + '...';
  }

  if (derivedSubject.length > 5) {
    facts.subject = derivedSubject.charAt(0).toUpperCase() + derivedSubject.slice(1);
  } else if (facts.involvedEntity && facts.category) {
    facts.subject = `Grievance against ${facts.involvedEntity} (${facts.category.replace(/_/g, ' ')})`;
  }

  return facts;
}

export interface EvidenceUploadHandlerParams {
  caseId: string;
  files: Array<{ name: string; size: number; type: string; arrayBuffer?: () => Promise<ArrayBuffer> } | File | Blob>;
  existingEvidence: EvidenceItem[];
  existingCustodyEvents: CustodyEvent[];
  incidentDate: string;
  disputedAmount: number;
  involvedEntity: string;
  buildCaseRecord: (evidence: EvidenceItem[], custody: CustodyEvent[]) => GrievanceCase;
  onSaveCase: (updatedCase: GrievanceCase, proceedToNavigator?: boolean) => Promise<boolean | void> | void;
  uploadBlobFn?: (params: any) => Promise<any>;
  onNotice?: (notice: string | null) => void;
  onIsUploading?: (isUploading: boolean) => void;
  onUpdateEvidence?: (items: EvidenceItem[]) => void;
  onUpdateCustody?: (events: CustodyEvent[]) => void;
  onSelectExhibit?: (id: string) => void;
  onAutosaveSuccess?: () => void;
  claimMappedTo?: string;
  targetCategory?: EvidenceItem['category'];
}

export interface EvidenceUploadHandlerResult {
  success: boolean;
  uploadedCount: number;
  failedCount: number;
  parentSaved: boolean;
  metadataSaved: boolean;
  newEvidence: EvidenceItem[];
  error?: string;
}

/**
 * Handles the complete evidence upload workflow with strict parent-before-upload sequencing:
 * 1. Persists the current parent case draft to Supabase BEFORE any file is uploaded to Storage,
 *    satisfying PostgreSQL Storage RLS policy `evidence_bucket_restrict_insert`.
 * 2. If parent persistence fails, zero Storage uploads are attempted and user draft is preserved.
 * 3. Streams each file to private Storage with genuine SHA-256 calculation.
 * 4. Only successfully uploaded files are added to the active evidence register (preventing false success).
 * 5. Persists the updated case metadata to database with retry/reconciliation resilience.
 */
export async function executeEvidenceUploadWithParentPersistence(
  params: EvidenceUploadHandlerParams
): Promise<EvidenceUploadHandlerResult> {
  const {
    caseId,
    files,
    existingEvidence,
    existingCustodyEvents,
    incidentDate,
    disputedAmount,
    involvedEntity,
    buildCaseRecord,
    onSaveCase,
    uploadBlobFn = uploadEvidenceBlob,
    onNotice = () => {},
    onIsUploading = () => {},
    onUpdateEvidence = () => {},
    onUpdateCustody = () => {},
    onSelectExhibit = () => {},
    onAutosaveSuccess = () => {},
  } = params;

  if (!files || files.length === 0) {
    return {
      success: false,
      uploadedCount: 0,
      failedCount: 0,
      parentSaved: false,
      metadataSaved: false,
      newEvidence: [],
      error: 'No files provided.',
    };
  }

  onIsUploading(true);
  onNotice('Securing case draft before uploading evidence...');

  // STEP 1: Persist parent case draft to Supabase BEFORE uploading any files.
  // This guarantees that the parent row exists in `grievance_cases` where `deleted_at IS NULL`,
  // strictly satisfying the PostgreSQL Storage RLS policy `evidence_bucket_restrict_insert`.
  const initialDraft = buildCaseRecord(existingEvidence, existingCustodyEvents);
  try {
    const parentSaveResult = await onSaveCase(initialDraft, false);
    if (parentSaveResult === false) {
      throw new Error('Database refused case draft persistence.');
    }
  } catch (parentErr: any) {
    const errMsg = parentErr?.message || 'Database error saving case draft.';
    console.error('Failed to persist parent case before evidence upload:', parentErr);
    onNotice(`Upload aborted: Could not save parent case to database (${errMsg}). Please try again.`);
    onIsUploading(false);
    return {
      success: false,
      uploadedCount: 0,
      failedCount: files.length,
      parentSaved: false,
      metadataSaved: false,
      newEvidence: [],
      error: errMsg,
    };
  }

  // STEP 2: Loop over files and stream to Supabase Storage with cryptographic SHA-256
  onNotice('Calculating cryptographic SHA-256 digest and uploading to private storage...');
  const newItems: EvidenceItem[] = [];
  const newEvents: CustodyEvent[] = [];
  let uploadFailureCount = 0;
  let lastUploadErrorMsg: string | null = null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = (file as any).name || `file_${i}`;
    const fileSize = typeof (file as any).size === 'number' ? (file as any).size : 0;
    const fileType = (file as any).type || '';
    const evidenceId = `ev-${Date.now()}-${i}`;
    const fileSizeFormatted = formatFileSize(fileSize);
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    const cat: EvidenceItem['category'] =
      ext === 'pdf'
        ? fileName.toLowerCase().includes('statement')
          ? 'bank_statement'
          : 'receipt'
        : ext === 'png' || ext === 'jpg' || ext === 'jpeg'
        ? fileName.toLowerCase().includes('notice') || fileName.toLowerCase().includes('letter')
          ? 'notice'
          : 'screenshot'
        : 'correspondence';

    try {
      const uploadResult = await uploadBlobFn({
        caseId,
        evidenceId,
        file: file as File | Blob,
        fileName,
        category: cat,
      });

      const item: EvidenceItem = {
        id: evidenceId,
        title: fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
        category: params.targetCategory || cat,
        fileName,
        fileSize: fileSizeFormatted,
        fileSizeBytes: uploadResult.fileSizeBytes,
        fileType: uploadResult.fileType || fileType,
        uploadDate: new Date().toISOString().split('T')[0],
        sha256Hash: uploadResult.sha256Hash,
        storageRef: uploadResult.storageRef,
        hasBlob: true,
        rawOcrText: undefined,
        ocrStatus: 'pending',
        claimMappedTo: params.claimMappedTo || undefined,
        ocrExtracted: {
          dates: [],
          amounts: [],
          identifiers: [],
          parties: [],
          summary: '',
          status: 'pending',
        },
        verifiedOriginal: false,
      };

      newItems.push(item);

      const uploadEvent = createCustodyEvent(
        caseId,
        'evidence_uploaded',
        `Evidence Ingestion: ${fileName}`,
        'Citizen (Browser Session)',
        `Calculated cryptographic SHA-256: ${uploadResult.sha256Hash}. File size: ${fileSizeFormatted}, MIME type: ${uploadResult.fileType || fileType}. Stored in private evidence vault at ${uploadResult.storageRef}.`,
        evidenceId,
        uploadResult.sha256Hash
      );
      newEvents.push(uploadEvent);
    } catch (fileErr: any) {
      console.error(`Failed to upload exhibit "${fileName}":`, fileErr);
      uploadFailureCount++;
      lastUploadErrorMsg = fileErr?.message || 'Storage upload error';
      // Failed file is strictly excluded from newItems and newEvents
    }
  }

  // If zero files succeeded, do NOT modify evidence list or report false success
  if (newItems.length === 0) {
    const errorNotice = `Upload failed: ${lastUploadErrorMsg || 'Could not upload files to private storage. Please try again.'}`;
    onNotice(errorNotice);
    onIsUploading(false);
    return {
      success: false,
      uploadedCount: 0,
      failedCount: files.length,
      parentSaved: true,
      metadataSaved: false,
      newEvidence: [],
      error: errorNotice,
    };
  }

  // STEP 3: At least one file uploaded. Update state and persist metadata.
  const updatedEvidence = [...existingEvidence, ...newItems];
  const updatedCustody = [...existingCustodyEvents, ...newEvents];

  onUpdateEvidence(updatedEvidence);
  onUpdateCustody(updatedCustody);
  onSelectExhibit(newItems[0].id);

  const updatedCase = buildCaseRecord(updatedEvidence, updatedCustody);

  let metadataSaveFailed = false;
  let metadataErrMsg = '';
  try {
    const metaResult = await onSaveCase(updatedCase, false);
    if (metaResult === false) {
      metadataSaveFailed = true;
      metadataErrMsg = 'Database error saving exhibit records';
    } else {
      onAutosaveSuccess();
    }
  } catch (metaErr: any) {
    console.error('Failed to persist exhibit metadata to database:', metaErr);
    metadataSaveFailed = true;
    metadataErrMsg = metaErr?.message || 'Database error saving exhibit records';
  }

  if (metadataSaveFailed) {
    // Preserve uploaded blobs and items in state so citizen can retry saving via 'Save Draft'
    onNotice(
      `File(s) uploaded to private vault, but saving database metadata failed (${metadataErrMsg}). Please click "Save Draft" to retry saving metadata.`
    );
  } else if (uploadFailureCount > 0) {
    onNotice(
      `Partially preserved: ${newItems.length} file(s) secured in vault, but ${uploadFailureCount} file(s) failed (${lastUploadErrorMsg}).`
    );
  } else {
    onNotice(`Successfully preserved ${newItems.length} file(s) in private vault with SHA-256 fingerprints.`);
    setTimeout(() => onNotice(null), 3500);
  }

  onIsUploading(false);
  return {
    success: !metadataSaveFailed && uploadFailureCount === 0,
    uploadedCount: newItems.length,
    failedCount: uploadFailureCount,
    parentSaved: true,
    metadataSaved: !metadataSaveFailed,
    newEvidence: newItems,
    error: metadataSaveFailed ? metadataErrMsg : lastUploadErrorMsg || undefined,
  };
}

export const CaseBuilder: React.FC<CaseBuilderProps> = ({
  initialCase,
  initialPrompt = '',
  initialTrustRecord,
  initialStep = 1,
  onSaveCase,
  onCancel,
  onStartNewCase,
}) => {
  const { t, mode } = useLanguage();

  // Wizard Step:
  // 1 = Incident & Details
  // 2 = Evidence Intelligence
  // 3 = Case Readiness Assessment
  // 4 = AI Clarification & Refinement
  // 5 = Complaint Review & Custody Proof
  const [currentStep, setCurrentStep] = useState<number>(initialStep);

  // Case ID - stable throughout the session
  const [caseId, setCaseId] = useState<string>(
    initialCase?.id || `NS-2026-0${Math.floor(100 + Math.random() * 900)}`
  );

  // Extract facts from initial prompt if present (for new complaint)
  const initialFacts = !initialCase && initialPrompt ? extractFactsFromGrievanceText(initialPrompt) : {};

  // Form State
  const [title, setTitle] = useState(
    initialCase?.title ||
      initialFacts.subject ||
      (initialPrompt
        ? `Grievance: ${initialPrompt.slice(0, 50).replace(/\n/g, ' ')}...`
        : '')
  );
  const [description, setDescription] = useState(
    initialCase?.description || initialPrompt || ''
  );
  const [category, setCategory] = useState<GrievanceCategory>(
    initialCase?.category || initialFacts.category || 'banking_financial'
  );
  const [incidentDate, setIncidentDate] = useState(
    initialCase?.incidentDate || initialFacts.incidentDate || new Date().toISOString().split('T')[0]
  );
  const [incidentLocation, setIncidentLocation] = useState(
    initialCase?.incidentLocation || initialFacts.incidentLocation || ''
  );
  const [involvedEntity, setInvolvedEntity] = useState<string>(() => {
    if (initialCase?.involvedEntity && !isUrlOrDomainIndicator(initialCase.involvedEntity)) {
      return initialCase.involvedEntity;
    }
    if (initialFacts.involvedEntity && !isUrlOrDomainIndicator(initialFacts.involvedEntity)) {
      return initialFacts.involvedEntity;
    }
    if (
      initialTrustRecord?.input &&
      !isUrlOrDomainIndicator(initialTrustRecord.input) &&
      initialTrustRecord.type !== 'url' &&
      initialTrustRecord.type !== 'phone' &&
      initialTrustRecord.type !== 'upi'
    ) {
      return initialTrustRecord.input;
    }
    return 'unknown';
  });
  const [disputedAmount, setDisputedAmount] = useState<number>(
    initialCase?.disputedAmount || initialFacts.disputedAmount || 0
  );

  // Additional structured fields for precision grievance routing
  const [transactionRef, setTransactionRef] = useState(
    initialCase?.filingDetails?.referenceNumber || ''
  );
  const [upiIdOrVpa, setUpiIdOrVpa] = useState(
    initialTrustRecord?.type === 'upi' ? initialTrustRecord.input : ''
  );
  const [contactIdentifier, setContactIdentifier] = useState(
    initialTrustRecord?.type === 'phone' ? initialTrustRecord.input : ''
  );

  // TrustCheck Record associated with this case
  const [trustRecord] = useState<TrustCheckRecord | undefined>(
    initialCase?.trustCheckRecord || initialTrustRecord || undefined
  );

  // Voice recognition state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [isBrowserSpeechActive, setIsBrowserSpeechActive] = useState(false);
  const recognitionRef = useRef<any>(null);
  const micRecorderRef = useRef<MicrophoneRecorder | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  // AI Grievance Detection state
  const [isAnalyzingFacts, setIsAnalyzingFacts] = useState(false);

  // Evidence list with real SHA-256 hashes
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>(
    initialCase?.evidence || []
  );
  const [selectedExhibitId, setSelectedExhibitId] = useState<string>(
    initialCase?.evidence[0]?.id || ''
  );
  const [dragActive, setDragActive] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Exhibit Viewer Sub-Tab & Controls in Step 2
  const [exhibitTab, setExhibitTab] = useState<'ocr_preview' | 'metadata'>('ocr_preview');
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [rawTextSearch, setRawTextSearch] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedRawText, setCopiedRawText] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState<Record<string, string>>({});

  // Evidence Recommendation state: practical evidentiary suggestions
  const [debitStatus, setDebitStatus] = useState<DebitStatus>('unconfirmed');
  const pendingRecommendationRef = useRef<{ id: string; category?: EvidenceItem['category'] } | null>(null);
  const recommendationFileInputRef = useRef<HTMLInputElement | null>(null);

  const evidenceRecommendations = React.useMemo(() => {
    return getEvidenceRecommendations({
      category,
      description,
      disputedAmount,
      debitStatus,
      trustRecord: trustRecord || initialTrustRecord,
      involvedEntity,
      evidenceList,
    });
  }, [category, description, disputedAmount, debitStatus, trustRecord, initialTrustRecord, involvedEntity, evidenceList]);

  // Timeline events
  const [timeline, setTimeline] = useState<TimelineEvent[]>(
    initialCase?.timeline || [
      {
        id: 'tl-1',
        date: incidentDate,
        title: 'Incident Occurred & Disputed Loss Detected',
        description: description ? description.slice(0, 140) + '...' : 'Disputed incident occurred.',
        verifiedByDoc: false,
      },
      {
        id: 'tl-2',
        date: incidentDate,
        title: 'Prompt Notification within Statutory Golden Window',
        description: `Notified ${involvedEntity || 'Opposite Party'} customer support within statutory notification window.`,
        verifiedByDoc: true,
      },
    ]
  );

  // Custody events log
  const [custodyEvents, setCustodyEvents] = useState<CustodyEvent[]>(
    initialCase?.custodyEvents && initialCase.custodyEvents.length > 0
      ? initialCase.custodyEvents
      : [
          createCustodyEvent(
            caseId,
            'case_created',
            'Grievance Case Initialized',
            'Citizen (Browser Session)',
            `Case drafting started under category: ${category.replace(/_/g, ' ')}. Disputed entity: ${involvedEntity || 'Opposite Party'}.`
          ),
        ]
  );

  // Baseline ref tracking the last confirmed clean/saved database state
  const confirmedBaselineRef = useRef<CaseBaselineState | null>(
    initialCase ? deriveBaselineFromRecord(initialCase, initialStep || 1) : null
  );
  // Alias for backward compatibility with existing references
  const baselineRef = confirmedBaselineRef;
  const isDirtyRef = useRef<boolean>(false);
  const editVersionRef = useRef<number>(1);
  const saveQueueTailRef = useRef<Promise<any>>(Promise.resolve());
  const isUnmountedRef = useRef<boolean>(false);
  const activeCaseIdRef = useRef<string>(caseId);
  activeCaseIdRef.current = caseId;
  const currentStepRef = useRef<number>(currentStep);
  currentStepRef.current = currentStep;
  const analysisAbortControllerRef = useRef<AbortController | null>(null);
  const analysisRequestSeqRef = useRef<number>(0);

  const lastExtractedDescriptionRef = useRef<string>(initialCase?.description || '');
  const isCategoryManuallyModifiedRef = useRef<boolean>(Boolean(initialCase?.category));

  // Complaint draft view toggle: 'formal' | 'simple'
  const [complaintView, setComplaintView] = useState<'formal' | 'simple'>('formal');
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [downloadReportSuccess, setDownloadReportSuccess] = useState(false);

  // Step 4 Financial Crime Legal Analysis Assistant State
  const [currentAnalysis, setCurrentAnalysis] = useState<LegalAnalysisResponse | null>(
    initialCase?.complaintDraft?.legalAnalysis || null
  );
  const [savedAnalysis, setSavedAnalysis] = useState<LegalAnalysisResponse | null>(
    initialCase?.complaintDraft?.legalAnalysis || null
  );
  const [isAnalysisLoading, setIsAnalysisLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null);
  const [analyzedAtVersion, setAnalyzedAtVersion] = useState<number | null>(
    initialCase?.complaintDraft?.legalAnalysis ? 1 : null
  );
  const [commitAnalysisStatus, setCommitAnalysisStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastAutosavedTime, setLastAutosavedTime] = useState<string>('just now');
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [saveDraftStatus, setSaveDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isProceedingToNavigator, setIsProceedingToNavigator] = useState<boolean>(false);
  const [proceedError, setProceedError] = useState<string | null>(null);

  const missingElements = useMemo(() => deriveMissingElements({
    description,
    involvedEntity,
    incidentDate,
    disputedAmount,
    evidenceList,
    timeline,
  }), [description, involvedEntity, incidentDate, disputedAmount, evidenceList, timeline]);

  const latestTitleRef = useRef(title);
  latestTitleRef.current = title;
  const latestDescriptionRef = useRef(description);
  latestDescriptionRef.current = description;
  const onSaveCaseRef = useRef(onSaveCase);
  onSaveCaseRef.current = onSaveCase;
  const buildCurrentCaseRecordRef = useRef<() => GrievanceCase>(() => ({} as any));

  // Build the complete current baseline projection from active form state
  const buildCurrentBaseline = (): CaseBaselineState => {
    return {
      caseId,
      title,
      description,
      category,
      disputedAmount: Number(disputedAmount) || 0,
      involvedEntity,
      incidentDate,
      incidentLocation,
      evidenceCount: evidenceList.length,
      currentStep,
      evidenceFingerprint: computeEvidenceFingerprint(evidenceList),
      timelineFingerprint: computeTimelineFingerprint(timeline),
      custodyFingerprint: computeCustodyFingerprint(custodyEvents),
      savedAnalysisEvaluatedAt: savedAnalysis?.findings?.assessmentMetadata?.evaluatedAt || null,
      evidenceMappingKey: computeEvidenceMappingKey(evidenceList),
    };
  };

  // Synchronous mutation trigger to advance edit version and dirty flag
  const markUserEdit = () => {
    editVersionRef.current++;
    isDirtyRef.current = true;
  };

  // Step 1 Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Synchronize or reset form state when initialCase or initialPrompt changes
  const prevCaseIdRef = useRef<string | undefined>(initialCase?.id);
  const prevPromptRef = useRef<string>(initialPrompt);

  useEffect(() => {
    const caseIdChanged = prevCaseIdRef.current !== initialCase?.id;
    const promptChanged = prevPromptRef.current !== initialPrompt;

    if (caseIdChanged || promptChanged) {
      prevCaseIdRef.current = initialCase?.id;
      prevPromptRef.current = initialPrompt;

      if (!initialCase) {
        // Genuinely new complaint - reset all fields to clean defaults
        isCategoryManuallyModifiedRef.current = false;
        const promptFacts = initialPrompt ? extractFactsFromGrievanceText(initialPrompt) : {};
        const newCaseId = `NS-2026-0${Math.floor(100 + Math.random() * 900)}`;
        const today = new Date().toISOString().split('T')[0];
        setCaseId(newCaseId);
        setTitle(promptFacts.subject || (initialPrompt ? `Grievance: ${initialPrompt.slice(0, 50).replace(/\n/g, ' ')}...` : ''));
        setDescription(initialPrompt || '');
        setCategory(promptFacts.category || 'banking_financial');
        setIncidentDate(promptFacts.incidentDate || today);
        setIncidentLocation(promptFacts.incidentLocation || '');
        const promptEntity =
          promptFacts.involvedEntity && !isUrlOrDomainIndicator(promptFacts.involvedEntity)
            ? promptFacts.involvedEntity
            : '';
        const trustEntity =
          initialTrustRecord?.input &&
          !isUrlOrDomainIndicator(initialTrustRecord.input) &&
          initialTrustRecord.type !== 'url' &&
          initialTrustRecord.type !== 'phone' &&
          initialTrustRecord.type !== 'upi'
            ? initialTrustRecord.input
            : '';
        const safeEntity = promptEntity || trustEntity || 'unknown';
        setInvolvedEntity(safeEntity);
        setDisputedAmount(promptFacts.disputedAmount || 0);
        setTransactionRef('');
        setUpiIdOrVpa(initialTrustRecord?.type === 'upi' ? initialTrustRecord.input : '');
        setContactIdentifier(initialTrustRecord?.type === 'phone' ? initialTrustRecord.input : '');
        setEvidenceList([]);
        setSelectedExhibitId('');
        setDragActive(false);
        setUploadNotice(null);
        setIsUploading(false);
        setVoiceNotice(null);
        setIsRecording(false);
        setValidationErrors([]);
        setCurrentStep(initialStep || 1);
        setTimeline([
          {
            id: 'tl-1',
            date: promptFacts.incidentDate || today,
            title: 'Incident Occurred & Disputed Loss Detected',
            description: initialPrompt ? initialPrompt.slice(0, 140) + '...' : 'Disputed incident occurred.',
            verifiedByDoc: false,
          },
          {
            id: 'tl-2',
            date: promptFacts.incidentDate || today,
            title: 'Prompt Notification within Statutory Golden Window',
            description: `Notified ${!isUnknownEntity(safeEntity) ? safeEntity : 'Opposite Party'} customer support within statutory notification window.`,
            verifiedByDoc: true,
          },
        ]);
        setCustodyEvents([
          createCustodyEvent(
            newCaseId,
            'case_created',
            'Grievance Case Initialized',
            'Citizen (Browser Session)',
            `Case drafting started under category: ${(promptFacts.category || 'banking_financial').replace(/_/g, ' ')}.`
          ),
        ]);
        // Reset analysis state for new case
        analysisAbortControllerRef.current?.abort();
        analysisRequestSeqRef.current++;
        setCurrentAnalysis(null);
        setSavedAnalysis(null);
        setAnalyzedAtVersion(null);
        setAnalysisError(null);
        setAnalysisWarning(null);
        confirmedBaselineRef.current = null;
        isDirtyRef.current = false;
        editVersionRef.current = 1;
      } else {
        // Loaded existing case - populate previous case data
        const safeHydratedEntity =
          initialCase.involvedEntity && !isUrlOrDomainIndicator(initialCase.involvedEntity)
            ? initialCase.involvedEntity
            : '';
        setCaseId(initialCase.id);
        setTitle(initialCase.title || '');
        setDescription(initialCase.description || '');
        setCategory(initialCase.category || 'banking_financial');
        setIncidentDate(initialCase.incidentDate || new Date().toISOString().split('T')[0]);
        setIncidentLocation(initialCase.incidentLocation || '');
        setInvolvedEntity(safeHydratedEntity);
        setDisputedAmount(initialCase.disputedAmount || 0);
        setTransactionRef(initialCase.filingDetails?.referenceNumber || '');
        setEvidenceList(initialCase.evidence || []);
        setSelectedExhibitId(initialCase.evidence?.[0]?.id || '');
        setTimeline(initialCase.timeline || []);
        setCustodyEvents(
          initialCase.custodyEvents && initialCase.custodyEvents.length > 0
            ? initialCase.custodyEvents
            : [
                createCustodyEvent(
                  initialCase.id,
                  'case_created',
                  'Grievance Case Initialized',
                  'Citizen (Browser Session)',
                  `Case loaded under category: ${initialCase.category}.`
                ),
              ]
        );
        setValidationErrors([]);
        setCurrentStep(initialStep || 1);

        // Invalidate prior in-flight analysis and sync analysis state to hydrated case
        analysisAbortControllerRef.current?.abort();
        analysisRequestSeqRef.current++;
        setCurrentAnalysis(initialCase.complaintDraft?.legalAnalysis || null);
        setSavedAnalysis(initialCase.complaintDraft?.legalAnalysis || null);
        setAnalyzedAtVersion(initialCase.complaintDraft?.legalAnalysis ? 1 : null);
        setAnalysisError(null);
        setAnalysisWarning(null);

        // Update baseline refs to reflect hydrated case without marking dirty
        lastExtractedDescriptionRef.current = initialCase.description || '';
        isCategoryManuallyModifiedRef.current = true;
        confirmedBaselineRef.current = deriveBaselineFromRecord(initialCase, initialStep || 1);
        isDirtyRef.current = false;
        editVersionRef.current = 1;
      }
    }
  }, [initialCase?.id, initialPrompt, initialStep, initialTrustRecord]);

  // Update selected exhibit ID when evidence list changes
  useEffect(() => {
    if (evidenceList.length > 0 && !selectedExhibitId) {
      setSelectedExhibitId(evidenceList[0].id);
    }
  }, [evidenceList, selectedExhibitId]);

  /**
   * Applies transcribed text to narrative and automatically extracts/populates
   * structured fields (subject, category, entity, amount, date, location).
   */
  const applyExtractedFacts = (extractedSnippet: string, fullTranscript: string, forceUpdate = false) => {
    const facts = extractFactsFromGrievanceText(fullTranscript);

    // 1. Always update narrative
    setDescription(fullTranscript);

    // 2. Subject / Title
    if (facts.subject) {
      if (forceUpdate || !title.trim() || title.startsWith('Grievance:') || title.includes('...')) {
        setTitle(facts.subject);
      }
    }

    // 3. Grievance Category
    if (shouldUpdateCategoryOnExtraction(facts.category, isCategoryManuallyModifiedRef.current)) {
      setCategory(facts.category!);
    }

    // 4. Involved Entity
    if (facts.involvedEntity) {
      if (forceUpdate || !involvedEntity.trim() || !initialCase) {
        setInvolvedEntity(facts.involvedEntity);
      }
    }

    // 5. Disputed Amount
    if (facts.disputedAmount && facts.disputedAmount > 0) {
      if (forceUpdate || !disputedAmount || disputedAmount === 0 || !initialCase) {
        setDisputedAmount(facts.disputedAmount);
      }
    }

    // 6. Incident Date
    if (facts.incidentDate) {
      setIncidentDate(facts.incidentDate);
    }

    // 7. Incident Location
    if (facts.incidentLocation) {
      if (forceUpdate || !incidentLocation.trim() || !initialCase) {
        setIncidentLocation(facts.incidentLocation);
      }
    }
    // Note: Restricted extraction events are reserved for trusted system processing and never created on client.
  };

  // Real-time debounced extraction when user types or pastes into description
  useEffect(() => {
    if (!shouldTriggerDebouncedExtraction(description, lastExtractedDescriptionRef.current, currentStep)) {
      return;
    }
    const timer = setTimeout(() => {
      lastExtractedDescriptionRef.current = description;
      applyExtractedFacts(description, description, false);
    }, 600);
    return () => clearTimeout(timer);
  }, [description, currentStep]);

  const handleDescriptionBlur = () => {
    if (
      description &&
      description.trim().length >= 10 &&
      description !== lastExtractedDescriptionRef.current
    ) {
      lastExtractedDescriptionRef.current = description;
      applyExtractedFacts(description, description, false);
    }
  };

  // Web Speech API
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = voiceLanguage;

      recognition.onstart = () => {
        setIsBrowserSpeechActive(true);
        setVoiceNotice(
          `Listening (${voiceLanguage === 'hi-IN' ? 'Hindi' : 'English'}). Speak your grievance clearly...`
        );
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          markUserEdit();
          const combined = description ? `${description.trim()} ${finalTranscript.trim()}` : finalTranscript.trim();
          applyExtractedFacts(finalTranscript, combined);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Browser speech recognition notice:', event.error);
        setIsBrowserSpeechActive(false);
      };

      recognition.onend = () => {
        setIsBrowserSpeechActive(false);
      };

      recognitionRef.current = recognition;
    }
  }, [voiceLanguage, description, title, category, involvedEntity, disputedAmount]);

  const toggleBrowserRecording = () => {
    if (isBrowserSpeechActive) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setVoiceNotice('Voice captured. You can review, edit, and correct the text below.');
    } else {
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) {
        toggleServerRecording();
      }
    }
  };

  const toggleServerRecording = async () => {
    if (!isRecording) {
      try {
        if (!micRecorderRef.current) {
          micRecorderRef.current = new MicrophoneRecorder();
        }
        await micRecorderRef.current.start();
        setIsRecording(true);
        setVoiceNotice('Recording audio via microphone stream (16kHz)...');
      } catch (err: any) {
        console.warn('Microphone access notice:', err?.message);
        setVoiceNotice('Microphone unavailable. Use sample recording or type directly.');
      }
    } else {
      if (!micRecorderRef.current) return;
      setIsRecording(false);
      setVoiceNotice('Transcribing audio with Gemini...');

      try {
        const { base64, mimeType } = await micRecorderRef.current.stop();
        const res = await fetchWithTimeout(
          '/api/gemini/transcribe',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64,
              mimeType,
              prompt:
                'Transcribe this citizen grievance recording accurately. Extract dates, amounts, and involved entities.',
            }),
          },
          TRANSCRIBE_CLIENT_TIMEOUT_MS
        );

        const data = await res.json();
        if (res.ok && data.text) {
          const combined = description ? `${description}\n\n${data.text}` : data.text;
          applyExtractedFacts(data.text, combined);
          setVoiceNotice('Audio transcribed & key details extracted! Review and edit below.');
          setTimeout(() => setVoiceNotice(null), 3500);
        } else {
          throw new Error(data.error || 'Failed to transcribe');
        }
      } catch (err: any) {
        const errMsg = formatAiErrorMessage(err, 'Could not transcribe audio');
        setVoiceNotice(`${errMsg} Please type directly or use sample voice.`);
        setTimeout(() => setVoiceNotice(null), 4000);
      }
    }
  };

  const handleStartVoice = () => {
    if (recognitionRef.current) {
      toggleBrowserRecording();
    } else {
      toggleServerRecording();
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVoiceNotice(`Transcribing "${file.name}"...`);
    try {
      const { base64, mimeType } = await audioFileToBase64(file);
      const res = await fetchWithTimeout(
        '/api/gemini/transcribe',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64,
            mimeType,
            prompt:
              'Transcribe this citizen grievance recording accurately. Extract dates, amounts, and involved entities.',
          }),
        },
        TRANSCRIBE_CLIENT_TIMEOUT_MS
      );

      const data = await res.json();
      if (res.ok && data.text) {
        markUserEdit();
        const combined = description ? `${description}\n\n${data.text}` : data.text;
        applyExtractedFacts(data.text, combined);
        setVoiceNotice(`Transcribed "${file.name}" & key details extracted! Review and edit below.`);
        setTimeout(() => setVoiceNotice(null), 3500);
      } else {
        throw new Error(data.error || 'Failed to transcribe file');
      }
    } catch (err: any) {
      const errMsg = formatAiErrorMessage(err, 'Failed to transcribe audio file');
      setVoiceNotice(`${errMsg} Please type details directly.`);
      setTimeout(() => setVoiceNotice(null), 4000);
    }
  };

  // AI Incident Extraction
  const handleAnalyzeFacts = () => {
    if (!description.trim()) return;
    setIsAnalyzingFacts(true);

    setTimeout(() => {
      applyExtractedFacts(description, description, true);
      setIsAnalyzingFacts(false);
    }, 500);
  };

  // Real File Upload to Supabase Private Storage with Parent-Before-Upload Sequencing
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const recToApply = pendingRecommendationRef.current;
    pendingRecommendationRef.current = null;

    await executeEvidenceUploadWithParentPersistence({
      caseId,
      files: fileArray,
      existingEvidence: evidenceList,
      existingCustodyEvents: custodyEvents,
      incidentDate,
      disputedAmount,
      involvedEntity,
      buildCaseRecord: (ev, cust) => ({
        ...buildCurrentCaseRecord(),
        evidence: ev,
        custodyEvents: cust,
      }),
      onSaveCase,
      uploadBlobFn: uploadEvidenceBlob,
      onNotice: setUploadNotice,
      onIsUploading: setIsUploading,
      onUpdateEvidence: (items) => {
        markUserEdit();
        setEvidenceList(items);
      },
      onUpdateCustody: (events) => {
        markUserEdit();
        setCustodyEvents(events);
      },
      onSelectExhibit: (id) => setSelectedExhibitId((prev) => prev || id),
      onAutosaveSuccess: () => {
        isDirtyRef.current = false;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastAutosavedTime(timeStr);
      },
      claimMappedTo: recToApply?.id,
      targetCategory: recToApply?.category,
    });
  };

  const handleAttachToRecommendation = (rec: EvidenceRecommendation) => {
    pendingRecommendationRef.current = {
      id: rec.id,
      category: rec.suggestedCategories[0],
    };
    recommendationFileInputRef.current?.click();
  };

  const handleLinkExhibitToRecommendation = (exhibitId: string, recId: string) => {
    markUserEdit();
    const updated = evidenceList.map((ex) => {
      if (ex.id === exhibitId) {
        return associateExhibitWithRecommendation(ex, recId);
      }
      return ex;
    });
    setEvidenceList(updated);
  };

  const handleUnlinkExhibit = (exhibitId: string) => {
    markUserEdit();
    const updated = evidenceList.map((ex) => {
      if (ex.id === exhibitId) {
        return unlinkExhibitFromRecommendation(ex);
      }
      return ex;
    });
    setEvidenceList(updated);
  };

  const handleRemoveEvidence = (idToRemove: string) => {
    markUserEdit();
    const item = evidenceList.find((e) => e.id === idToRemove);
    setEvidenceList((prev) => prev.filter((e) => e.id !== idToRemove));
    if (selectedExhibitId === idToRemove) {
      setSelectedExhibitId(evidenceList.find((e) => e.id !== idToRemove)?.id || '');
    }

    const removeEvent = createCustodyEvent(
      caseId,
      'evidence_removed',
      `Evidence Removed from Case: ${item?.fileName || idToRemove}`,
      'Citizen (Browser Session)',
      `Exhibit ${idToRemove} unlinked from active grievance petition. Historical fingerprint preserved in audit ledger.`,
      idToRemove,
      item?.sha256Hash
    );
    setCustodyEvents((prev) => [...prev, removeEvent]);
  };

  // Re-verify integrity of an exhibit by streaming and hashing private storage bytes
  const handleVerifyIntegrity = async (evidenceId: string, recordedHash: string) => {
    const item = evidenceList.find((e) => e.id === evidenceId);
    setIntegrityStatus((prev) => ({ ...prev, [evidenceId]: 'verifying' }));
    const res = await verifyEvidenceBytes(item?.storageRef, recordedHash);

    if (res.verified) {
      setIntegrityStatus((prev) => ({ ...prev, [evidenceId]: 'verified' }));
      const verifyEvent = createCustodyEvent(
        caseId,
        'evidence_verified',
        `Cryptographic Re-Verification Matched: ${evidenceId}`,
        'Integrity Engine',
        `Re-hashed binary stream matches original recorded SHA-256: ${recordedHash}. Zero byte tampering detected.`,
        evidenceId,
        recordedHash
      );
      setCustodyEvents((prev) => [...prev, verifyEvent]);
    } else {
      setIntegrityStatus((prev) => ({ ...prev, [evidenceId]: 'tampered' }));
    }
  };

  // Download actual preserved file from private storage
  const handleDownloadExhibit = async (item: EvidenceItem) => {
    try {
      if (item.hasBlob && item.storageRef) {
        const blob = await downloadEvidenceBlob(item.storageRef);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Fallback simulated export for synthetic/sample exhibits
        const dummyBlob = new Blob(
          [`[NivaranSetu Preserved Evidence]\nFile: ${item.fileName}\nSHA-256: ${item.sha256Hash || 'None (Synthetic Metadata)'}\nCase: ${caseId}`],
          { type: 'text/plain' }
        );
        const url = URL.createObjectURL(dummyBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.fileName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      const dlEvent = createCustodyEvent(
        caseId,
        'evidence_downloaded',
        `Evidence Exported: ${item.fileName}`,
        'Citizen (Browser Session)',
        `Preserved file ${item.fileName} exported from evidence vault. Digest: ${item.sha256Hash || 'none'}.`,
        item.id,
        item.sha256Hash
      );
      setCustodyEvents((prev) => [...prev, dlEvent]);
    } catch (err: any) {
      console.error('Download error:', err);
      setUploadNotice(`Download failed: ${err.message || 'Unable to download file.'}`);
      setTimeout(() => setUploadNotice(null), 3500);
    }
  };

  // Dynamic Case Readiness Calculation
  const readiness = calculateCaseReadiness({
    description,
    involvedEntity,
    incidentDate,
    disputedAmount,
    evidenceList,
  });

  // Compile current case record snapshot
  const buildCurrentCaseRecord = (): GrievanceCase => {
    const targetAuth = getRecommendedAuthority(category);

    const formalBody = `To,\nThe Competent Redressal Authority / Ombudsman,\n\nSUB: FORMAL CITIZEN GRIEVANCE PETITION UNDER STATUTORY REDRESSAL SCHEME\n\n1. PARTIES:\nComplainant: Citizen Consumer\nOpposite Party / Regulated Entity: ${involvedEntity || 'Regulated Entity'}, Location: ${incidentLocation}\n\n2. STATEMENT OF FACTS:\nOn or about ${incidentDate}, the complainant suffered an unauthorized grievance amounting to INR ${disputedAmount ? disputedAmount.toLocaleString('en-IN') : '0'}.\n\nNarrative of Incident:\n${description}\n\nTransaction & Identifier References:\n- Involved Entity: ${involvedEntity}\n- Disputed Identifier / VPA: ${upiIdOrVpa}\n- Bank / Txn Reference: ${transactionRef}\n- Disputed Amount: INR ${disputedAmount ? disputedAmount.toLocaleString('en-IN') : '0'}\n\n3. EVIDENCE EXHIBITS:\n${evidenceList.map((e, i) => `Exhibit Ex-0${i + 1}: ${e.title} (${e.fileName}) — SHA-256: ${e.sha256Hash}`).join('\n') || 'None attached'}\n\n4. STATUTORY PREREQUISITES:\nThe complainant has satisfied mandatory escalation prerequisites and served written notice to customer support without receiving fair redressal.\n\n5. PRAYER FOR RELIEF:\nThe complainant respectfully prays that this Authority:\n(a) Direct the opposite party to credit back/rectify the disputed sum of INR ${disputedAmount ? disputedAmount.toLocaleString('en-IN') : '0'};\n(b) Direct payment of appropriate statutory interest and token compensation for harassment.`;

    const simpleBody = `I am submitting a grievance about ${involvedEntity}. On ${incidentDate}, I suffered an issue amounting to ₹${disputedAmount.toLocaleString('en-IN')}. I informed the company but have not received a fair resolution. I have attached ${evidenceList.length} evidence exhibit(s) (${readiness.evidenceMaturity.verified} verified original). I request the authority to direct a full refund and resolution.`;

    const dynamicMissingElements = deriveMissingElements({
      description,
      involvedEntity,
      incidentDate,
      disputedAmount,
      evidenceList,
      timeline,
    });

    const finalCase: GrievanceCase = {
      id: caseId,
      title: title || `Grievance: ${involvedEntity || 'Opposite Party'} (${category.replace(/_/g, ' ')})`,
      category,
      stage: readiness.tier === 'ready' ? 'ready_to_file' : 'evidence_gathering',
      status: 'active',
      createdAt: initialCase?.createdAt || new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      incidentDate,
      incidentLocation,
      involvedEntity: involvedEntity || 'Unspecified Party',
      disputedAmount: Number(disputedAmount) || 0,
      currency: 'INR',
      description,
      simpleSummary: `On ${incidentDate}, an incident involving ${involvedEntity} resulted in a disputed loss of ₹${(Number(disputedAmount) || 0).toLocaleString('en-IN')}. Despite prompt notice, resolution has not occurred. I request a complete reversal and refund.`,
      readinessScore: readiness.score,
      readinessBreakdown: readiness.breakdown,
      recommendedAuthority: {
        name: targetAuth.name,
        portalName: targetAuth.portalName,
        portalUrl: targetAuth.portalUrl,
        filingFee: 'Nil or Nominal',
        averageResolutionTime: '30 to 45 Days',
      },
      trustCheckRecord: trustRecord,
      timeline,
      evidence: evidenceList,
      missingElements: dynamicMissingElements,
      complaintDraft: {
        subject: `Grievance Complaint against ${involvedEntity || 'Opposite Party'} regarding unauthorized debits and service deficiency`,
        formalBody,
        simpleBody,
        reliefSought: `Full reversal and refund of ₹${Number(disputedAmount).toLocaleString('en-IN')} with statutory compensation for deficiency in service.`,
        legalAnalysis: savedAnalysis,
      },
      custodyEvents,
    };

    return finalCase;
  };
  buildCurrentCaseRecordRef.current = buildCurrentCaseRecord;

  interface EnqueueSaveOptions {
    isManualSave?: boolean;
    expectedCaseId?: string;
    proceedToNavigator?: boolean;
    commitAnalysis?: LegalAnalysisResponse | null;
  }

  /**
   * Enqueues a case persistence operation onto the serialized promise chain.
   * Guarantees:
   * 1. Synchronous chain registration before yielding control.
   * 2. Fresh record construction inside the queued callback after prior saves settle.
   * 3. Network I/O begins only after preceding saves complete.
   * 4. Errors in preceding saves never poison subsequent saves (.catch absorption).
   * 5. Returns three-state result: 'saved' | 'discarded_stale' | 'failed'.
   */
  const enqueueSaveOperation = (
    snapshotFactory: () => { record: GrievanceCase; step: number },
    options: EnqueueSaveOptions = {}
  ): Promise<SaveOperationResult> => {
    const currentTail = saveQueueTailRef.current;

    const task = async (): Promise<SaveOperationResult> => {
      // Discard stale background saves if unmounted or if the active case changed
      if (isUnmountedRef.current && !options.isManualSave) {
        return 'discarded_stale';
      }
      if (options.expectedCaseId && options.expectedCaseId !== activeCaseIdRef.current) {
        return 'discarded_stale';
      }

      try {
        const { record, step } = snapshotFactory();

        if (options.commitAnalysis !== undefined) {
          record.complaintDraft = {
            ...record.complaintDraft,
            legalAnalysis: options.commitAnalysis,
          };
        } else if (savedAnalysis !== undefined) {
          record.complaintDraft = {
            ...record.complaintDraft,
            legalAnalysis: savedAnalysis,
          };
        }

        const saveSuccess = await onSaveCaseRef.current(record, options.proceedToNavigator);
        if (saveSuccess === false) {
          return 'failed';
        }

        // Save succeeded: update confirmed baseline to match this saved state
        confirmedBaselineRef.current = deriveBaselineFromRecord(record, step);

        // Update React state only if component remains mounted
        if (!isUnmountedRef.current) {
          isDirtyRef.current = false;
          if (options.commitAnalysis !== undefined) {
            setSavedAnalysis(options.commitAnalysis);
          }
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastAutosavedTime(timeStr);
        }

        return 'saved';
      } catch (err) {
        console.error('Error during serialized case persistence:', err);
        return 'failed';
      }
    };

    const nextPromise = currentTail.catch(() => {}).then(task);
    saveQueueTailRef.current = nextPromise;
    return nextPromise;
  };

  // Format RBI liability tier into citizen-readable legal description
  const formatRbiTier = (tier?: string): string => {
    switch (tier) {
      case 'zero_liability_bank_fault':
        return 'Zero Customer Liability (Bank Deficiency / Fraud Alleged under Paragraph 67(a))';
      case 'zero_liability_prompt_report':
        return 'Zero Customer Liability (Prompt Notification within 3 Working Days under Paragraph 67(b))';
      case 'limited_liability_delay_4_to_7_days':
        return 'Limited Customer Liability (Notification Delay of 4 to 7 Working Days under Paragraph 68(2))';
      case 'full_loss_customer_negligence_until_reported':
        return 'Customer Liability for Entire Loss Until Reported (Admitted Negligence under Paragraph 68(1))';
      case 'board_policy_delay_over_7_days':
        return 'Bank Board Approved Policy Discretion (Notification Delay Exceeding 7 Working Days under Paragraph 69)';
      case 'authorised_payment_not_covered_under_unauthorised_framework':
        return 'Authorised Payment Under Deception (Not Governed by Unauthorised Framework)';
      case 'communication_date_unknown_cannot_calculate_reporting_window':
        return 'Communication Date Unknown (Reporting Window Requires Proof of Delivery)';
      case 'institution_scope_mismatch':
        return 'Institution Scope Mismatch (Not a Scheduled Commercial Bank)';
      case 'unsupported_post_2026_framework':
        return 'Post-2026 Amended Framework (Effective 1 January 2027)';
      default:
        return tier ? tier.replace(/_/g, ' ') : 'Liability tier not determined';
    }
  };

  // Statutory Financial Crime Legal Analysis Handler
  const handleRunLegalAnalysis = async () => {
    if (isAnalysisLoading) return;
    setAnalysisError(null);
    setAnalysisWarning(null);

    const hasBasicContent = Boolean(title.trim() || description.trim());
    if (!hasBasicContent) {
      setAnalysisError('Please provide an incident description or title in Step 1 before running statutory analysis.');
      return;
    }

    const requestCaseId = caseId;
    const preSaveVersion = editVersionRef.current;

    // 1. Mandatory Pre-Analysis Save: persist current facts to Supabase before backend evaluates
    const preSaveResult = await enqueueSaveOperation(
      () => ({ record: buildCurrentCaseRecord(), step: currentStep }),
      { isManualSave: true, expectedCaseId: requestCaseId }
    );

    if (preSaveResult !== 'saved') {
      setAnalysisError('Unable to save case facts to database before analysis. Please check your connection and try again.');
      return;
    }

    // 2. Obtain valid authentication access token asynchronously
    const token = await getValidAccessToken();
    if (!token) {
      setAnalysisError('Authentication required: Please sign in to run statutory legal analysis.');
      return;
    }

    // 3. CRITICAL SYNCHRONOUS PRE-DISPATCH RACE GUARD
    // Zero async ticks between check and fetch dispatch!
    const preDispatchVersion = editVersionRef.current;
    const currentBaseline = buildCurrentBaseline();

    if (
      isUnmountedRef.current ||
      activeCaseIdRef.current !== requestCaseId ||
      preDispatchVersion !== preSaveVersion ||
      !confirmedBaselineRef.current ||
      hasCaseChangedFromBaseline(currentBaseline, confirmedBaselineRef.current)
    ) {
      setAnalysisWarning('Case facts were modified while saving. Please run analysis again to evaluate the latest facts.');
      return;
    }

    // 4. Setup cancellation controller and monotonically increasing request sequence
    analysisAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    analysisAbortControllerRef.current = abortController;
    const currentRequestId = ++analysisRequestSeqRef.current;
    const dispatchedVersion = preSaveVersion;

    try {
      setIsAnalysisLoading(true);
      const response = await requestLegalAnalysis(
        { caseId: requestCaseId, signal: abortController.signal },
        token
      );

      // 5. Post-Response Identity, Generation & Lifecycle Guard
      if (
        isUnmountedRef.current ||
        activeCaseIdRef.current !== requestCaseId ||
        analysisRequestSeqRef.current !== currentRequestId
      ) {
        return; // Silently drop obsolete or superseded response
      }

      setCurrentAnalysis(response);
      setAnalyzedAtVersion(dispatchedVersion);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (
        isUnmountedRef.current ||
        activeCaseIdRef.current !== requestCaseId ||
        analysisRequestSeqRef.current !== currentRequestId
      ) {
        return;
      }
      const message = formatAiErrorMessage(err, 'Statutory legal analysis failed.');
      setAnalysisError(message);
    } finally {
      if (
        !isUnmountedRef.current &&
        activeCaseIdRef.current === requestCaseId &&
        analysisRequestSeqRef.current === currentRequestId
      ) {
        setIsAnalysisLoading(false);
      }
    }
  };

  // Commit and persist the active legal analysis into the grievance draft
  const handleCommitAnalysisToDraft = async () => {
    if (!currentAnalysis) return;
    setCommitAnalysisStatus('saving');

    const saveResult = await enqueueSaveOperation(
      () => ({
        record: {
          ...buildCurrentCaseRecord(),
          complaintDraft: {
            ...buildCurrentCaseRecord().complaintDraft,
            legalAnalysis: currentAnalysis,
          },
        },
        step: currentStep,
      }),
      {
        isManualSave: true,
        expectedCaseId: caseId,
        commitAnalysis: currentAnalysis,
      }
    );

    if (saveResult === 'saved') {
      setSavedAnalysis(currentAnalysis);
      setCommitAnalysisStatus('saved');
      setTimeout(() => setCommitAnalysisStatus('idle'), 3000);
    } else {
      setCommitAnalysisStatus('error');
    }
  };

  const selectedExhibit = evidenceList.find((e) => e.id === selectedExhibitId) || evidenceList[0];
  const ocrData: ExhibitOcrData = resolveExhibitOcrData(selectedExhibit);

  // Validate step requirements before advancing
  const handleValidateAndAdvance = (targetStep: number) => {
    setValidationErrors([]);

    if (currentStep === 1) {
      const errs: string[] = [];
      if (!title.trim()) {
        errs.push('Please enter a grievance subject or title.');
      }
      if (!description.trim()) {
        errs.push('Please describe the incident or speak your grievance.');
      }
      if (isUrlOrDomainIndicator(involvedEntity)) {
        errs.push('Please enter the name of the company, bank, or organization (e.g. Tata Power, SBI) rather than a website URL or link.');
      }
      if (errs.length > 0) {
        setValidationErrors(errs);
        return;
      }
      if (!involvedEntity.trim()) {
        markUserEdit();
        setInvolvedEntity('unknown');
      }
    }

    setCurrentStep(targetStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveDraft = async (): Promise<SaveOperationResult> => {
    if (isSavingDraft || isProceedingToNavigator) return 'failed';
    setIsSavingDraft(true);
    setSaveDraftStatus('saving');

    const result = await enqueueSaveOperation(
      () => ({ record: buildCurrentCaseRecord(), step: currentStep }),
      { isManualSave: true, expectedCaseId: caseId }
    );

    if (result === 'saved') {
      setSaveDraftStatus('saved');
      setTimeout(() => setSaveDraftStatus('idle'), 2500);
    } else {
      setSaveDraftStatus('error');
      setTimeout(() => setSaveDraftStatus('idle'), 3500);
    }
    setIsSavingDraft(false);
    return result;
  };

  const handleSaveAndProceedToNavigator = async (): Promise<SaveOperationResult> => {
    if (isSavingDraft || isProceedingToNavigator) return 'failed';
    setIsProceedingToNavigator(true);
    setProceedError(null);

    const result = await enqueueSaveOperation(
      () => ({ record: buildCurrentCaseRecord(), step: currentStep }),
      { isManualSave: true, expectedCaseId: caseId, proceedToNavigator: true }
    );

    if (result !== 'saved') {
      setProceedError('Unable to persist grievance record to database. Please check your connection and retry.');
      setIsProceedingToNavigator(false);
    }
    return result;
  };

  const handleDownloadAuditReport = () => {
    const caseRecord = buildCurrentCaseRecord();
    const reportText = exportChainOfCustodyReport(caseRecord);
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Chain_of_Custody_Report_${caseId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadReportSuccess(true);
    setTimeout(() => setDownloadReportSuccess(false), 3500);

    const dlEvent = createCustodyEvent(
      caseId,
      'dossier_exported',
      'Chain-of-Custody Audit Report Exported',
      'Citizen (Browser Session)',
      `Plaintext cryptographic audit report exported for Case ${caseId}. Contains ${evidenceList.length} evidence digests and ${custodyEvents.length} custody entries.`
    );
    setCustodyEvents((prev) => [...prev, dlEvent]);
  };

  const STEP_INFO = [
    { num: 1, title: 'Explain the Incident', instruction: 'Tell us what happened in voice or text. AI will identify key transaction numbers, dates, and entities.' },
    { num: 2, title: 'Gather & Verify Evidence', instruction: 'Attach passbooks, bills, or notices. Binary data is fingerprinted with SHA-256 in your browser.' },
    { num: 3, title: 'Case Readiness Audit', instruction: 'Verify evidence completeness and statutory dispute prerequisites before proceeding.' },
    { num: 4, title: 'Statutory Legal Analysis', instruction: 'Evaluate applicable financial-crime offences, RBI regulatory remedies, and Consumer Protection Act eligibility.' },
    { num: 5, title: 'Chain-of-Custody & Final Verification', instruction: 'Review the tamper-evident cryptographic log and save your finalized case record.' },
  ];

  // Autosave effect debounced, with immediate save on unmount to preserve in-progress edits
  useEffect(() => {
    if (!description && !title) return;

    const currentState = buildCurrentBaseline();

    // Hydration guard: for an existing case, do not mark dirty or trigger autosave if state matches baseline
    if (confirmedBaselineRef.current && !hasCaseChangedFromBaseline(currentState, confirmedBaselineRef.current)) {
      isDirtyRef.current = false;
      return;
    }

    isDirtyRef.current = true;
    const saveCaseId = caseId;

    const timer = setTimeout(() => {
      enqueueSaveOperation(
        () => ({ record: buildCurrentCaseRecordRef.current(), step: currentStepRef.current }),
        { isManualSave: false, expectedCaseId: saveCaseId }
      );
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    title,
    description,
    category,
    disputedAmount,
    involvedEntity,
    incidentDate,
    incidentLocation,
    evidenceList,
    timeline,
    custodyEvents,
    currentStep,
    savedAnalysis,
    caseId,
  ]);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      // Abort in-flight legal analysis and invalidate request sequence
      analysisAbortControllerRef.current?.abort();
      analysisRequestSeqRef.current++;

      const unmountCaseId = activeCaseIdRef.current;
      const hasContent = Boolean(
        latestTitleRef.current?.trim() || latestDescriptionRef.current?.trim()
      );

      if (isDirtyRef.current && hasContent) {
        // Deep independent frozen snapshot captured synchronously
        const frozenRecord = structuredClone(buildCurrentCaseRecordRef.current());
        const frozenStep = currentStepRef.current;

        enqueueSaveOperation(
          () => ({ record: frozenRecord, step: frozenStep }),
          { isManualSave: true, expectedCaseId: unmountCaseId }
        ).catch((err) => {
          console.error('Error auto-saving draft on unmount:', err);
        });
      }
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      
      {/* 1. GUIDED PROGRESS HEADER: One Task Per Screen with Back, Save, Exit, Continue */}
      <GuidedNavigationHeader
        stepNumber={currentStep}
        totalSteps={5}
        badgeLabel={`CASE ${caseId}`}
        stepTitle={STEP_INFO[currentStep - 1].title}
        instruction={STEP_INFO[currentStep - 1].instruction}
        progressPercent={Math.round((currentStep / 5) * 100)}
        lastAutosaved={lastAutosavedTime}
        onBack={currentStep > 1 ? () => setCurrentStep(currentStep - 1) : onCancel}
        backLabel={currentStep > 1 ? 'Previous Step' : 'Exit to Dashboard'}
        onSaveDraft={handleSaveDraft}
        onExit={onCancel}
        exitLabel="Exit to Dashboard"
        onContinue={
          currentStep < 5
            ? () => handleValidateAndAdvance(currentStep + 1)
            : handleSaveAndProceedToNavigator
        }
        continueLabel={currentStep < 5 ? 'Continue' : 'Proceed to Navigator'}
      />

      {/* Step Indicator Header (5 Unified Steps) */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {[
          { num: 1, label: 'Incident & Facts' },
          { num: 2, label: 'Evidence Intelligence' },
          { num: 3, label: 'Case Readiness' },
          { num: 4, label: 'Statutory Legal Analysis' },
          { num: 5, label: 'Review & Custody' },
        ].map((s) => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;

          return (
            <button
              key={s.num}
              onClick={() => handleValidateAndAdvance(s.num)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                isActive
                  ? 'border-[#007FFF] bg-[#007FFF]/5 dark:bg-[#007FFF]/10 shadow-xs'
                  : isDone
                  ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-zinc-400">
                  0{s.num}
                </span>
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : isActive ? (
                  <span className="w-2 h-2 rounded-full bg-[#007FFF]" />
                ) : null}
              </div>
              <div
                className={`text-xs font-bold mt-1 truncate ${
                  isActive ? 'text-[#007FFF]' : isDone ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'
                }`}
              >
                {s.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Validation Errors Callout */}
      {validationErrors.length > 0 && (
        <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/5 dark:bg-red-500/10 text-xs text-red-600 dark:text-red-400 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Please complete required fields to proceed:</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* TrustCheck Finding Notification Banner (if came from TrustCheck) */}
      {trustRecord && (() => {
        const badgeConfig = getTrustCheckBadgeConfig(trustRecord.riskLevel, trustRecord.resultStatus);
        const sourceConfig = getTrustCheckSourceLabel(trustRecord);
        return (
          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 flex items-start gap-3 text-xs">
            <ShieldAlert className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-zinc-900 dark:text-white">
                    Imported TrustCheck Advisory:
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badgeConfig.badgeClass}`}
                  >
                    {badgeConfig.text}
                  </span>
                  <span className={sourceConfig.className}>
                    {sourceConfig.text}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-zinc-400 uppercase">
                  {trustRecord.type}
                </span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400">
                Identifier <code className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[#007FFF] font-mono">{trustRecord.input}</code> matched curated threat pattern indicators. Pattern observations have been preserved in your case facts as an advisory threat indicator.
              </p>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          STEP 1: INCIDENT & FACTS
          ========================================================================= */}
      {currentStep === 1 && (
        <div className="space-y-6">
          
          {/* Voice Input Section */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                  <Mic className="w-4 h-4 text-[#007FFF]" />
                  <span>Voice-First Grievance Intake</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Describe what happened in natural language. Speech is converted to text and key details are extracted.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {onStartNewCase && (
                  <button
                    type="button"
                    onClick={onStartNewCase}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    title="Clear form and start a fresh complaint"
                  >
                    <RotateCcw className="w-3 h-3 text-[#007FFF]" />
                    <span>Start Fresh Complaint</span>
                  </button>
                )}

                {/* Language toggle */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setVoiceLanguage('en-IN')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      voiceLanguage === 'en-IN'
                        ? 'bg-white dark:bg-zinc-800 text-[#007FFF] shadow-xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceLanguage('hi-IN')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      voiceLanguage === 'hi-IN'
                        ? 'bg-white dark:bg-zinc-800 text-[#007FFF] shadow-xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    हिन्दी (Hindi)
                  </button>
                </div>
              </div>
            </div>

            {/* Mic Button & Audio Actions */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-4">
              <button
                type="button"
                onClick={handleStartVoice}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
                  isRecording || isBrowserSpeechActive
                    ? 'bg-red-500 text-white animate-pulse shadow-red-500/30'
                    : 'bg-[#007FFF] text-white hover:bg-[#0070e0] shadow-blue-500/20'
                }`}
              >
                {isRecording || isBrowserSpeechActive ? (
                  <MicOff className="w-7 h-7" />
                ) : (
                  <Mic className="w-7 h-7" />
                )}
              </button>

              <div className="text-center space-y-1">
                <div className="text-xs font-bold text-zinc-900 dark:text-white">
                  {isRecording || isBrowserSpeechActive
                    ? 'Listening... Click to Stop Recording'
                    : 'Click Microphone to Start Speaking'}
                </div>
                <div className="text-[11px] text-zinc-500">
                  Supported formats: Speech via microphone, or upload recorded audio below
                </div>
              </div>

              {/* Upload audio file button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => audioFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  <FileAudio className="w-3.5 h-3.5 text-[#007FFF]" />
                  <span>Upload Audio File (.wav, .mp3, .m4a)</span>
                </button>
                <input
                  ref={audioFileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioFileUpload}
                  className="hidden"
                />
              </div>

              {voiceNotice && (
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-[#007FFF] font-medium text-center max-w-md">
                  {voiceNotice}
                </div>
              )}
            </div>

            {/* Description Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Detailed Grievance Description <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-zinc-400">
                  Review and edit transcribed speech below
                </span>
              </div>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => {
                  markUserEdit();
                  setDescription(e.target.value);
                }}
                onBlur={handleDescriptionBlur}
                placeholder="Explain what happened: what service or product was involved, what went wrong, dates, amounts, and previous complaints made..."
                className="w-full text-xs p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF] leading-relaxed resize-y"
              />
            </div>

            {/* Analyze & Extract Button */}
            <button
              type="button"
              onClick={handleAnalyzeFacts}
              disabled={isAnalyzingFacts || !description.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {isAnalyzingFacts ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing & Classifying Grievance Facts...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analyze & Extract Key Facts Automatically</span>
                </>
              )}
            </button>
          </div>

          {/* Structured Fields Grid */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-5 shadow-xs">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">
              Structured Incident Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Grievance Subject / Title */}
              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                    Grievance Subject / Title <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-zinc-400">
                    Concise summary of your dispute
                  </span>
                </div>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      markUserEdit();
                      setTitle(e.target.value);
                    }}
                    placeholder="e.g. Unauthorized UPI debit of ₹42,500 from State Bank account"
                    className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                  />
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Grievance Category
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    markUserEdit();
                    isCategoryManuallyModifiedRef.current = true;
                    setCategory(e.target.value as GrievanceCategory);
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                >
                  <option value="banking_financial">Banking & UPI Financial Fraud (RBI Ombudsman)</option>
                  <option value="consumer_ecommerce">Consumer Goods & E-Commerce Defect (e-Daakhil / NCDRC)</option>
                  <option value="real_estate_rera">Real Estate Possession Delay (State RERA)</option>
                  <option value="insurance_claims">Insurance Claim Repudiation (IRDAI Bima Bharosa)</option>
                  <option value="municipal_civic">Central / State Civic Grievance (CPGRAMS)</option>
                  <option value="telecom_isp">Telecom & SIM Fraud (TRAI / Sanchar Saathi)</option>
                  <option value="employment_labour">Labour & Workplace Compensation (Samadhan)</option>
                  <option value="utilities_power">Electricity & Power Utility (CGRF)</option>
                </select>
              </div>

              {/* Involved Entity */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Bank / Company / Entity Involved <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={involvedEntity}
                    onChange={(e) => {
                      markUserEdit();
                      setInvolvedEntity(e.target.value);
                    }}
                    placeholder="e.g. Apex Bank, QuickBazaar Retail (or 'unknown')"
                    className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                  />
                </div>
                {isUrlOrDomainIndicator(involvedEntity) && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Please enter the company, bank, or utility name (e.g. Tata Power, SBI) rather than a website URL or link.
                  </p>
                )}
                {isUnknownEntity(involvedEntity) && (
                  <p className="text-[11px] text-zinc-500">
                    Respondent is currently set to unknown (0% identification credit). You may proceed and update it later if the organization is identified.
                  </p>
                )}
              </div>

              {/* Disputed Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Disputed Amount (INR)
                </label>
                <div className="relative">
                  <IndianRupee className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    value={disputedAmount || ''}
                    onChange={(e) => {
                      markUserEdit();
                      setDisputedAmount(Number(e.target.value));
                    }}
                    placeholder="e.g. 42500"
                    className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                  />
                </div>
              </div>

              {/* Incident Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Incident Date
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={incidentDate}
                    onChange={(e) => {
                      markUserEdit();
                      setIncidentDate(e.target.value);
                    }}
                    className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                  />
                </div>
              </div>

              {/* Incident Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Location (City, State)
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={incidentLocation}
                    onChange={(e) => {
                      markUserEdit();
                      setIncidentLocation(e.target.value);
                    }}
                    placeholder="e.g. Pune, Maharashtra"
                    className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Previous / Next Navigation for Step 1 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => handleValidateAndAdvance(2)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <span>Continue to Evidence Intelligence</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          STEP 2: INTEGRATED EVIDENCE INTELLIGENCE
          ========================================================================= */}
      {currentStep === 2 && (
        <div className="space-y-6">
          
          {/* Uninitialized Case Guidance if arriving at Evidence without case facts */}
          {currentStep === 2 && !initialCase && !title.trim() && !description.trim() && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>
                  No active grievance is currently initialized. To attach and verify evidence for a specific incident, please describe your problem in Step 1 or select an existing case.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs cursor-pointer transition-colors"
                >
                  Go to Step 1 (Describe Problem)
                </button>
                <button
                  onClick={onCancel}
                  className="px-3 py-1.5 rounded-lg border border-amber-500/40 hover:bg-amber-500/10 text-amber-900 dark:text-amber-200 font-medium text-xs cursor-pointer transition-colors"
                >
                  Select from Dashboard
                </button>
              </div>
            </div>
          )}
          
          {/* Targeted Evidence Requirements for this category */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                Step 2: Targeted Evidence Collection & Ingestion
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Upload receipts, screenshots, bank statements, or correspondence. Files are hashed via SHA-256 and stored in the local evidence vault.
              </p>
            </div>

            {/* Hidden file input for recommendation-targeted upload */}
            <input
              type="file"
              ref={recommendationFileInputRef}
              onChange={(e) => handleFileUpload(e.target.files)}
              accept=".pdf,image/png,image/jpeg,image/jpg"
              className="hidden"
            />

            {/* Case-Specific Recommended Evidence Panel */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/60 dark:border-zinc-800 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#007FFF]" />
                    <h4 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                      Case-Specific Recommended Evidence ({evidenceRecommendations.filter((r) => r.isSatisfied).length} of {evidenceRecommendations.length} Attached)
                    </h4>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Practical evidentiary checklist tailored to your incident facts. Attach or link exhibits to substantiate each point.
                  </p>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 self-start sm:self-auto">
                  Practical Guidance (Non-Mandatory)
                </span>
              </div>

              {/* Debit Confirmation Selector (Triggered when a positive disputed amount is present) */}
              {disputedAmount > 0 && (
                <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="text-zinc-700 dark:text-zinc-300">
                      <span>Reported Disputed Sum: </span>
                      <strong className="text-zinc-950 dark:text-white font-mono font-bold">
                        ₹{disputedAmount.toLocaleString('en-IN')}
                      </strong>
                      <span className="text-zinc-500 block sm:inline sm:ml-1 text-[11px]">
                        — Was this money actually debited from your bank/UPI account?
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDebitStatus('confirmed_debit')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                          debitStatus === 'confirmed_debit'
                            ? 'bg-[#007FFF] text-white font-semibold shadow-xs'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        ✓ Yes, debited
                      </button>
                      <button
                        type="button"
                        onClick={() => setDebitStatus('no_debit')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                          debitStatus === 'no_debit'
                            ? 'bg-[#007FFF] text-white font-semibold shadow-xs'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        ✗ No debit (attempt only)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDebitStatus('unconfirmed')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                          debitStatus === 'unconfirmed'
                            ? 'bg-[#007FFF] text-white font-semibold shadow-xs'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        ? Need to verify
                      </button>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-amber-500/15 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold text-amber-700 dark:text-amber-400">Session Notice:</span>
                    <span>Debit confirmation is temporary for this drafting session only and resets to &quot;Need to verify&quot; whenever you reopen this case.</span>
                  </div>
                </div>
              )}

              {/* Recommendation Cards Responsive Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {evidenceRecommendations.map((rec) => {
                  const priorityBadgeStyle =
                    rec.priority === 'conditional'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                      : rec.priority === 'optional'
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                      : 'bg-blue-500/10 text-[#007FFF] border border-blue-500/20';

                  const eligibleUnlinked = evidenceList.filter(
                    (ex) => !ex.claimMappedTo && rec.suggestedCategories.includes(ex.category)
                  );

                  return (
                    <div
                      key={rec.id}
                      className={`p-3.5 rounded-xl border transition-all text-xs flex flex-col justify-between gap-3 ${
                        rec.isSatisfied
                          ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B]'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${priorityBadgeStyle}`}>
                            {rec.priority}
                          </span>
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {rec.title}
                          </span>
                        </div>

                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {rec.instruction}
                        </p>

                        <div className="text-[10px] text-zinc-400 italic">
                          Utility: {rec.practicalPurpose}
                        </div>

                        {rec.conditionReason && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                            Condition: {rec.conditionReason}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                        {rec.isSatisfied ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold truncate max-w-[210px]">
                              <Check className="w-3 h-3 shrink-0" />
                              <span className="truncate">{rec.matchedExhibitTitle || 'Exhibit attached'}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUnlinkExhibit(rec.matchedExhibitId!)}
                              className="text-[10px] font-mono text-zinc-400 hover:text-red-500 cursor-pointer transition-colors"
                            >
                              Unlink
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full gap-2">
                            <button
                              type="button"
                              onClick={() => handleAttachToRecommendation(rec)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#007FFF] hover:bg-[#0070e0] text-white font-medium text-[11px] cursor-pointer transition-colors"
                            >
                              <Upload className="w-3 h-3" />
                              <span>Attach</span>
                            </button>

                            {eligibleUnlinked.length > 0 && (
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleLinkExhibitToRecommendation(e.target.value, rec.id);
                                  }
                                }}
                                className="text-[10px] font-mono p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 max-w-[140px] truncate"
                              >
                                <option value="" disabled>Link exhibit...</option>
                                {eligibleUnlinked.map((ex) => (
                                  <option key={ex.id} value={ex.id}>
                                    {ex.title}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Drag & Drop Upload Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-2xl p-7 text-center transition-all ${
                dragActive
                  ? 'border-[#007FFF] bg-[#007FFF]/5'
                  : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/40'
              }`}
            >
              <Upload className="w-8 h-8 text-[#007FFF] mx-auto mb-2" />
              <div className="text-xs font-semibold text-zinc-900 dark:text-white mb-1">
                Drag & Drop Evidence Documents Here, or Click to Browse
              </div>
              <div className="text-[11px] text-zinc-500 mb-3">
                Supports PDF documents, PNG/JPG images, and screenshots (SHA-256 fingerprint calculated on ingest)
              </div>
              <label className="inline-block px-4 py-2 rounded-xl bg-[#007FFF] text-white text-xs font-semibold cursor-pointer hover:bg-[#0070e0] transition-colors">
                <span>Select Files from Device</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            {uploadNotice && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-[#007FFF] font-medium text-center">
                {uploadNotice}
              </div>
            )}
          </div>

          {/* Exhibits Master-Detail Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Preserved Exhibits Register (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Preserved Exhibits ({evidenceList.length})
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  SHA-256 Indexed
                </span>
              </div>

              {evidenceList.length === 0 ? (
                <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] text-center text-xs text-zinc-500">
                  No evidence uploaded yet. Add at least 1 document to support your complaint.
                </div>
              ) : (
                <div className="space-y-2">
                  {evidenceList.map((item) => {
                    const isSelected = item.id === selectedExhibitId;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedExhibitId(item.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#007FFF] bg-[#007FFF]/5 dark:bg-[#007FFF]/10 shadow-xs'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate max-w-[200px]">
                              {item.title}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-400">
                              {item.fileName} · {item.fileSize}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveEvidence(item.id);
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors"
                            title="Remove exhibit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                          <span>SHA: {item.sha256Hash ? item.sha256Hash.slice(0, 12) + '...' : 'Metadata only'}</span>
                          {(() => {
                            const itemOcr = resolveExhibitOcrData(item);
                            if (item.verifiedOriginal) {
                              return (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Verified Original
                                </span>
                              );
                            }
                            if (itemOcr.status === 'no_text') {
                              return (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                  No Text Detected
                                </span>
                              );
                            }
                            if (itemOcr.status === 'pending') {
                              return (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                  OCR Pending
                                </span>
                              );
                            }
                            if (itemOcr.status === 'failed') {
                              return (
                                <span className="text-red-600 dark:text-red-400 font-semibold">
                                  OCR Failed
                                </span>
                              );
                            }
                            if (itemOcr.status === 'demo') {
                              return (
                                <span className="text-zinc-500 dark:text-zinc-400 font-semibold">
                                  Sample Exhibit
                                </span>
                              );
                            }
                            return (
                              <span className="text-zinc-500 dark:text-zinc-400 font-semibold">
                                Uploaded (Unverified)
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Exhibit OCR & Visual Explorer (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {selectedExhibit ? (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-5 space-y-4 shadow-xs">
                  
                  {/* Exhibit Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <div>
                      <div className="text-[10px] font-mono text-[#007FFF] uppercase">
                        EXHIBIT: {selectedExhibit.id}
                      </div>
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white mt-0.5">
                        {selectedExhibit.title}
                      </h4>
                      <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                        {selectedExhibit.fileName} ({selectedExhibit.fileSize})
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadExhibit(selectedExhibit)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>

                  {/* Hash strip */}
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-all">
                      SHA-256: {selectedExhibit.sha256Hash || 'Metadata only (No physical upload)'}
                    </span>
                    <button
                      type="button"
                      disabled={!selectedExhibit.sha256Hash}
                      onClick={() => {
                        if (selectedExhibit.sha256Hash) {
                          navigator.clipboard.writeText(selectedExhibit.sha256Hash);
                          setCopiedHash(selectedExhibit.sha256Hash);
                          setTimeout(() => setCopiedHash(null), 2000);
                        }
                      }}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      title={selectedExhibit.sha256Hash ? "Copy SHA-256 Hash" : "No hash recorded"}
                    >
                      {copiedHash === selectedExhibit.sha256Hash && selectedExhibit.sha256Hash ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Visual Document Viewer with Bounding Boxes */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <ScanLine className="w-3.5 h-3.5 text-[#007FFF]" />
                        <span>Interactive OCR Exhibit Inspection</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                          showBoundingBoxes
                            ? 'bg-[#007FFF]/10 text-[#007FFF]'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {showBoundingBoxes ? 'Bounding Boxes: ON' : 'Bounding Boxes: OFF'}
                      </button>
                    </div>

                    <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 min-h-[180px] font-mono text-xs overflow-hidden">
                      <div className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed select-text">
                        {ocrData.rawText}
                      </div>

                      {/* Visual overlay boxes */}
                      {showBoundingBoxes &&
                        ocrData.boundingBoxes.map((box) => (
                          <div
                            key={box.id}
                            style={{
                              position: 'absolute',
                              top: `${box.topPercent}%`,
                              left: `${box.leftPercent}%`,
                              width: `${box.widthPercent}%`,
                              height: `${box.heightPercent}%`,
                            }}
                            className="border border-[#007FFF] bg-[#007FFF]/10 rounded pointer-events-none flex items-start justify-end p-0.5"
                          >
                            <span className="text-[8px] bg-[#007FFF] text-white px-1 rounded font-bold font-mono">
                              {box.type.toUpperCase()}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Extracted Entities Chips */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">
                      STRUCTURED OCR ENTITIES DETECTED
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedExhibit.ocrExtracted.amounts.map((amt, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-mono font-semibold"
                        >
                          {amt}
                        </span>
                      ))}
                      {selectedExhibit.ocrExtracted.dates.map((dt, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-blue-500/10 text-[#007FFF] text-[11px] font-mono"
                        >
                          Date: {dt}
                        </span>
                      ))}
                      {selectedExhibit.ocrExtracted.identifiers.map((idVal, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-mono"
                        >
                          {idVal}
                        </span>
                      ))}
                      {selectedExhibit.ocrExtracted.amounts.length === 0 &&
                        selectedExhibit.ocrExtracted.dates.length === 0 &&
                        selectedExhibit.ocrExtracted.identifiers.length === 0 &&
                        selectedExhibit.ocrExtracted.parties.length === 0 && (
                          <span className="text-[11px] font-mono text-zinc-500">
                            {ocrData.status === 'no_text'
                              ? 'No text detected in this exhibit.'
                              : 'OCR scan pending — no structured entities extracted yet.'}
                          </span>
                        )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] text-center text-xs text-zinc-400">
                  Select an exhibit on the left to view its OCR entities and cryptographic hash.
                </div>
              )}
            </div>

          </div>

          {/* Navigation for Step 2 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => handleValidateAndAdvance(1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous: Incident Facts</span>
            </button>

            <button
              type="button"
              onClick={() => handleValidateAndAdvance(3)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <span>Continue to Case Readiness</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          STEP 3: INTEGRATED CASE READINESS ASSESSMENT
          ========================================================================= */}
      {currentStep === 3 && (
        <div className="space-y-6">
          
          {/* Header */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-6 shadow-xs">
            <div>
              <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider font-mono">
                PRE-FILING EVALUATION · STEP 3
              </div>
              <h3 className="text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                Case Readiness Assessment
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Assessing document sufficiency, incident timeline clarity, and mandatory statutory prerequisites.
              </p>
            </div>

            {/* Mandatory Legal Disclaimer */}
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 flex items-start gap-3 text-xs text-zinc-600 dark:text-zinc-400">
              <Info className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-900 dark:text-white">Assistance Assessment Notice: </strong>
                This score evaluates filing completeness to minimize administrative rejections by ombudsmen or commissions. It does not constitute formal legal representation or guarantee official case acceptance or compensation awards.
              </div>
            </div>

            {/* Radial Score Visual + Status Tier */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
              
              {/* Radial Meter Card (5 cols) */}
              <div className="md:col-span-5 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-center space-y-3">
                <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-zinc-200 dark:text-zinc-800"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * readiness.score) / 100}
                      strokeLinecap="round"
                      className={
                        readiness.tier === 'ready'
                          ? 'text-emerald-500'
                          : readiness.tier === 'needs_info'
                          ? 'text-amber-500'
                          : 'text-red-500'
                      }
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold font-mono text-zinc-950 dark:text-white">
                      {readiness.score}%
                    </span>
                    <span className="text-[10px] text-zinc-400 uppercase font-mono">
                      READINESS
                    </span>
                  </div>
                </div>

                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold font-mono">
                  {readiness.tier === 'ready' ? (
                    <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                      ✓ Ready for Review
                    </span>
                  ) : readiness.tier === 'needs_info' ? (
                    <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">
                      {isUnknownEntity(involvedEntity) ? '⚠ Needs Info · Respondent Unidentified' : '⚠ Needs Additional Info'}
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 bg-red-500/10 px-3 py-1 rounded-full">
                      ✕ Incomplete Draft
                    </span>
                  )}
                </div>

                {isUnknownEntity(involvedEntity) && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center max-w-[220px] pt-1">
                    Factual details are recorded. The respondent is unidentified and can be determined later — this does not prevent you from continuing.
                  </p>
                )}
              </div>

              {/* Breakdown Bars (7 cols) */}
              <div className="md:col-span-7 space-y-3.5">
                {[
                  {
                    label: 'Evidence Completeness',
                    score: readiness.breakdown.evidenceCompleteness,
                    note:
                      evidenceList.length === 0
                        ? '0 exhibits uploaded (primary evidence required)'
                        : `${readiness.evidenceMaturity.uploaded} uploaded · ${readiness.evidenceMaturity.processed} OCR processed · ${readiness.evidenceMaturity.relevant} relevant · ${readiness.evidenceMaturity.verified} verified`,
                  },
                  {
                    label: 'Incident Timeline Clarity',
                    score: readiness.breakdown.timelineClarity,
                    note: incidentDate ? `Occurred on ${incidentDate}` : 'Date and facts logged',
                  },
                  {
                    label: 'Entity Identification',
                    score: readiness.breakdown.identityProof,
                    note: isUrlOrDomainIndicator(involvedEntity)
                      ? 'URL entered — please identify legal company/bank'
                      : isUnknownEntity(involvedEntity)
                      ? 'Respondent unknown (0% credit — identify party before filing)'
                      : (involvedEntity.trim() || 'Entity missing'),
                  },
                  {
                    label: 'Prerequisite Notice',
                    score: readiness.breakdown.formalNoticeSent,
                    note: readiness.prerequisiteNotice.note,
                  },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-900 dark:text-white">{item.label}</span>
                      <span className="font-mono text-zinc-500">{item.score}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        style={{ width: `${item.score}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.score >= 80 ? 'bg-emerald-500' : item.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">{item.note}</div>
                  </div>
                ))}
              </div>

            </div>

            {/* Checklist of Completed vs Missing Items */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Readiness Checklist & Action Items
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                
                {/* Completed */}
                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 space-y-2">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Completed Requirements</span>
                  </div>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-400 text-[11px]">
                    <li>• Incident description and category specified</li>
                    {involvedEntity.trim() && !isUrlOrDomainIndicator(involvedEntity) && !isUnknownEntity(involvedEntity) && (
                      <li>• Identified entity: {involvedEntity}</li>
                    )}
                    {readiness.evidenceMaturity.uploaded > 0 && (
                      <li>
                        • {readiness.evidenceMaturity.uploaded} exhibit{readiness.evidenceMaturity.uploaded > 1 ? 's' : ''} uploaded ({readiness.evidenceMaturity.processed} OCR processed · {readiness.evidenceMaturity.relevant} relevant · {readiness.evidenceMaturity.verified} verified)
                      </li>
                    )}
                    {readiness.prerequisiteNotice.state === 'complaint_ticket' && (
                      <li>• Prior complaint acknowledgement / ticket attached</li>
                    )}
                  </ul>
                </div>

                {/* Recommendations */}
                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 space-y-2">
                  <div className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>Recommended Next Steps</span>
                  </div>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-400 text-[11px]">
                    {readiness.evidenceMaturity.uploaded === 0 ? (
                      <li>• Attach primary evidence exhibit in Step 2 (e.g. transaction receipt, SMS screenshot)</li>
                    ) : readiness.evidenceMaturity.processed === 0 ? (
                      <li>• Attach clear, readable documentary evidence (uploaded file has OCR scan pending or no text detected)</li>
                    ) : readiness.evidenceMaturity.processed < 2 ? (
                      <li>• Upload second corroborating document with readable details (e.g. statement or customer support ticket)</li>
                    ) : null}
                    {(!involvedEntity.trim() || isUrlOrDomainIndicator(involvedEntity) || isUnknownEntity(involvedEntity)) && (
                      <li>• Identify legal respondent (bank, utility, or company) when known (can be determined later; does not block drafting)</li>
                    )}
                    {readiness.prerequisiteNotice.state !== 'complaint_ticket' && (
                      <li>• Attach prior grievance acknowledgement or written notice if available</li>
                    )}
                    <li>• Review structured legal petition in Step 5 before proceeding to Resolution Navigator</li>
                  </ul>
                </div>

              </div>
            </div>

          </div>

          {/* Navigation for Step 3 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => handleValidateAndAdvance(2)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous: Evidence Intelligence</span>
            </button>

            <button
              type="button"
              onClick={() => handleValidateAndAdvance(4)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <span>Continue to Legal Analysis</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          STEP 4: STATUTORY FINANCIAL CRIME LEGAL ANALYSIS
          ========================================================================= */}
      {currentStep === 4 && (
        <div className="space-y-6">
          
          {/* Header Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider font-mono">
                  AI LEGAL ANALYSIS · STEP 4
                </div>
                <h3 className="text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                  Statutory Financial Crime Legal Analysis
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5 max-w-2xl">
                  Automated assessment of applicable criminal offences (BNS 2023 / IPC 1860), Reserve Bank of India (RBI) unauthorized transaction liability, and Consumer Protection Act (CPA 2019) eligibility.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRunLegalAnalysis}
                  disabled={isAnalysisLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] disabled:opacity-50 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
                >
                  {isAnalysisLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Evaluating Case Facts...</span>
                    </>
                  ) : currentAnalysis ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Re-run Analysis</span>
                    </>
                  ) : (
                    <>
                      <Scale className="w-4 h-4" />
                      <span>Run Statutory Analysis</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* In-flight Loading Banner */}
            {isAnalysisLoading && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-[#007FFF] shrink-0" />
                <div className="space-y-0.5">
                  <div className="font-semibold">NivaranSetu Legal Engine in progress...</div>
                  <div className="text-[11px] opacity-90">
                    Evaluating narrative facts against BNS 2023 sections, RBI Master Directions, and CPA 2019 provisions. This process secures a database snapshot before analysis.
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {analysisError && !isAnalysisLoading && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="font-semibold">Statutory Analysis Interrupted</div>
                  <div className="text-[11px] leading-relaxed">{analysisError}</div>
                  <button
                    type="button"
                    onClick={handleRunLegalAnalysis}
                    className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-300 font-medium text-[11px] transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry Analysis</span>
                  </button>
                </div>
              </div>
            )}

            {/* Warning Banner */}
            {analysisWarning && !isAnalysisLoading && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold">Notice</div>
                  <div className="text-[11px] leading-relaxed">{analysisWarning}</div>
                </div>
              </div>
            )}

            {/* Stale Analysis Alert */}
            {!isAnalysisLoading && currentAnalysis && analyzedAtVersion !== null && editVersionRef.current !== analyzedAtVersion && (
              <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Case Facts Modified Since Analysis</div>
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                      Case facts or evidence exhibits have been updated (Version {editVersionRef.current}) since this assessment was conducted (Version {analyzedAtVersion}). Re-run analysis to evaluate the latest facts.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRunLegalAnalysis}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-[11px] transition-colors cursor-pointer"
                >
                  Re-run Analysis
                </button>
              </div>
            )}

            {/* Fallback / Deterministic Engine Disclaimer */}
            {currentAnalysis?.isFallback && !isAnalysisLoading && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs">
                <Scale className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-semibold">Deterministic Statutory Evaluation:</span> This analysis was produced by NivaranSetu's rule-based statutory engine under Indian laws (BNS 2023, RBI Master Directions, CPA 2019) to ensure uninterrupted availability.
                </div>
              </div>
            )}

            {/* Unsaved Analysis Alert */}
            {currentAnalysis && currentAnalysis !== savedAnalysis && commitAnalysisStatus !== 'saved' && !isAnalysisLoading && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-300 text-xs">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-[#007FFF] shrink-0" />
                  <span className="text-[11px] font-medium">This legal assessment is not yet saved to your permanent case draft.</span>
                </div>
                <button
                  type="button"
                  onClick={handleCommitAnalysisToDraft}
                  disabled={commitAnalysisStatus === 'saving'}
                  className="px-3 py-1 rounded-lg bg-[#007FFF] hover:bg-[#0070e0] text-white font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  {commitAnalysisStatus === 'saving' ? 'Saving...' : 'Save to Draft'}
                </button>
              </div>
            )}
          </div>

          {/* Analysis Findings Content */}
          {currentAnalysis ? (
            <div className="space-y-6">

              {/* 1. Plain-Language Narrative Synthesis Card */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                        Executive Legal Assessment & Narrative
                      </h4>
                      <div className="text-[11px] text-zinc-500">Plain-language statutory summary for citizens</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                      {currentAnalysis.modelUsed || 'Statutory Engine'}
                    </span>
                    {currentAnalysis.findings?.assessmentMetadata?.evaluatedAt && (
                      <span className="text-zinc-400">
                        {new Date(currentAnalysis.findings.assessmentMetadata.evaluatedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <LegalMarkdownRenderer content={currentAnalysis.synthesis} />

                {/* BNSS Section 173 Statutory Disclaimer Box */}
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed space-y-1">
                  <div className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Statutory Citizen Notice under BNSS Section 173
                  </div>
                  <div>
                    This automated statutory assessment is prepared solely to empower citizens with structured dispute formulation and administrative petition drafting under Section 173 of the Bharatiya Nagarik Suraksha Sanhita (BNSS 2023) and RBI Consumer Protection Master Directions. It does not constitute formal legal counsel. Final cognizance rests with the judicial magistrate or statutory ombudsman.
                  </div>
                </div>
              </div>

              {/* 2. Criminal Offences Assessment Card */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                        Applicable Criminal Offences (BNS 2023 / IPC 1860)
                      </h4>
                      <div className="text-[11px] text-zinc-500">
                        Identified {currentAnalysis.findings?.criminalOffencesAssessment?.assessedOffences?.length || 0} statutory offence{currentAnalysis.findings?.criminalOffencesAssessment?.assessedOffences?.length === 1 ? '' : 's'} based on active facts
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {currentAnalysis.findings?.criminalOffencesAssessment?.assessedOffences?.map((offence, idx) => {
                    const statusConfig = offence.isPrimaFacieSupported
                      ? {
                          label: 'Prima Facie Supported',
                          className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                        }
                      : {
                          label: 'Missing Critical Ingredients',
                          className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                        };

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-zinc-950 dark:text-white">
                                {offence.sectionNumber}: {offence.provisionTitle}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                                {offence.actTitle}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusConfig.className}`}>
                              {statusConfig.label}
                            </span>
                          </div>
                        </div>

                        {/* Punishment */}
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">Statutory Punishment: </span>
                          {offence.prescribedPunishment}
                        </div>

                        {/* Ingredients */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Established Ingredients</span>
                            </div>
                            <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5 pl-4 list-disc">
                              {offence.establishedIngredients?.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                              {(!offence.establishedIngredients || offence.establishedIngredients.length === 0) && (
                                <li className="text-zinc-400 italic">None established from current exhibits</li>
                              )}
                            </ul>
                          </div>

                          <div className="space-y-1">
                            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Missing / Requires Corroboration</span>
                            </div>
                            <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5 pl-4 list-disc">
                              {offence.missingIngredients?.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                              {(!offence.missingIngredients || offence.missingIngredients.length === 0) && (
                                <li className="text-zinc-400 italic">All primary elements substantiated</li>
                              )}
                            </ul>
                          </div>
                        </div>

                        {/* Evidentiary note */}
                        {offence.evidentiaryNote && (
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Evidentiary Assessment: </span>
                            {offence.evidentiaryNote}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. RBI Customer Protection Regulatory Framework Card */}
              {currentAnalysis.findings?.rbiCommercialBanksProtection && (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
                  <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-[#007FFF] flex items-center justify-center">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                        RBI Customer Protection & Zero-Liability Framework
                      </h4>
                      <div className="text-[11px] text-zinc-500">
                        Reserve Bank of India Master Directions on Limiting Customer Liability in Unauthorised Electronic Banking Transactions
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-1">
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                        Customer Liability Tier
                      </div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {formatRbiTier(currentAnalysis.findings.rbiCommercialBanksProtection.tier)}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">
                        {currentAnalysis.findings.rbiCommercialBanksProtection.calculationBasisNotice}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-1">
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                        Mandatory Shadow Credit / Reversal
                      </div>
                      <div className="text-xs font-bold text-[#007FFF]">
                        {currentAnalysis.findings.rbiCommercialBanksProtection.shadowCreditEntitlement?.mandatoryDeadlineDays || 10} Working Days
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">
                        {currentAnalysis.findings.rbiCommercialBanksProtection.shadowCreditEntitlement?.description}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">Statutory Burden of Proof: </span>
                    {currentAnalysis.findings.rbiCommercialBanksProtection.burdenOfProofNotice}
                  </div>
                </div>
              )}

              {/* 4. Consumer Protection Act Eligibility Card (CPA 2019) */}
              {currentAnalysis.findings?.consumerProtectionAct && (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Scale className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                          Consumer Protection Act (CPA 2019) Redressal
                        </h4>
                        <div className="text-[11px] text-zinc-500">
                          Redressal for service deficiency under Act No. 35 of 2019
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        currentAnalysis.findings.consumerProtectionAct.isEligible
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30'
                      }`}
                    >
                      {currentAnalysis.findings.consumerProtectionAct.isEligible ? 'Eligible Consumer' : 'Ineligible / Unverified'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-1 text-xs">
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                      Statutory Reasoning & Deficiency Assessment
                    </div>
                    <div className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      {currentAnalysis.findings.consumerProtectionAct.reasoning}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <div>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">Recommended Redressal Forum: </span>
                      {currentAnalysis.findings.consumerProtectionAct.recommendedForum || 'District Consumer Disputes Redressal Commission (e-Daakhil)'}
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Temporal Jurisdiction Card */}
              {currentAnalysis.findings?.temporalJurisdiction && (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                        Temporal Jurisdiction (BNS 2023 vs IPC 1860)
                      </h4>
                      <div className="text-[11px] text-zinc-500">
                        Transition provisions under Section 358 of Bharatiya Nyaya Sanhita, 2023
                      </div>
                    </div>
                  </div>

                  <div className="text-xs space-y-2">
                    <div className="text-[11px] text-zinc-700 dark:text-zinc-300">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">Applicable Code: </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[11px]">
                        {currentAnalysis.findings.temporalJurisdiction.applicableCriminalStatutes?.map((s) => s.actTitle).join(', ') || 'Bharatiya Nyaya Sanhita, 2023'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {currentAnalysis.findings.temporalJurisdiction.explanation}
                    </div>
                  </div>
                </div>
              )}

              {/* 6. Commit to Draft Card */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-zinc-950 dark:text-white">
                    Embed Statutory Analysis in Case Petition
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Saves this complete legal assessment into your complaint draft JSONB for subsequent review in Step 5 and filing in Resolution Navigator.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCommitAnalysisToDraft}
                  disabled={commitAnalysisStatus === 'saving'}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm shrink-0 ${
                    savedAnalysis === currentAnalysis || commitAnalysisStatus === 'saved'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : commitAnalysisStatus === 'error'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-[#007FFF] hover:bg-[#0070e0] text-white'
                  }`}
                >
                  {commitAnalysisStatus === 'saving' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Draft...</span>
                    </>
                  ) : savedAnalysis === currentAnalysis || commitAnalysisStatus === 'saved' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Analysis Saved to Case Draft</span>
                    </>
                  ) : commitAnalysisStatus === 'error' ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Retry Saving to Draft</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4" />
                      <span>Save Analysis to Case Draft</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          ) : !isAnalysisLoading ? (
            /* Clean Empty State */
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-8 text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center mx-auto">
                <Scale className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h4 className="text-base font-bold text-zinc-950 dark:text-white">
                  Statutory Financial Crime Legal Analysis
                </h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Evaluate your grievance against Bharatiya Nyaya Sanhita (BNS 2023) / IPC criminal offences, Reserve Bank of India (RBI) zero-liability electronic fraud directives, and Consumer Protection Act (CPA 2019) deficiency in service provisions.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRunLegalAnalysis}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
                >
                  <Scale className="w-4 h-4" />
                  <span>Run Statutory Legal Analysis</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* Navigation for Step 4 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => handleValidateAndAdvance(3)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous: Case Readiness</span>
            </button>

            <button
              type="button"
              onClick={() => handleValidateAndAdvance(5)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <span>Continue to Review & Custody</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          STEP 5: COMPLAINT REVIEW & DIGITAL CUSTODY PROOF
          ========================================================================= */}
      {currentStep === 5 && (
        <div className="space-y-6">

          {/* 1. Incomplete Information & Non-Blocking Evidentiary Warnings */}
          {missingElements.length > 0 && (
            <div className="rounded-2xl border border-amber-300/70 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 p-4 sm:p-5 space-y-3 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 w-full">
                  <div className="font-semibold text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span>Incomplete Case Details & Evidentiary Recommendations</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-200/60 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 w-fit">
                      Readiness: {readiness.score}% ({readiness.tier.replace(/_/g, ' ')})
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    The following factual elements are incomplete or unattached. While you may proceed to file your complaint draft, providing complete facts significantly accelerates ombudsman review:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900/90 dark:text-amber-200/90 pt-0.5">
                    {missingElements.map((item, idx) => (
                      <li key={idx} className="leading-normal">
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 pt-1 italic">
                    Note: Citizens are not prevented from proceeding if evidence is currently unavailable. You may proceed and furnish supporting records directly to the redressal authority upon inquiry.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2. Compact Case Overview & Dispute Parameters */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider font-mono">
                  GRIEVANCE RECORD SUMMARY
                </div>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white mt-0.5">
                  Case Overview & Dispute Parameters
                </h3>
              </div>
              <div className="font-mono text-xs px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 w-fit">
                {caseId}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {/* Category */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
                <div className="text-[11px] font-medium text-zinc-500">Grievance Category</div>
                <div className="font-semibold text-zinc-900 dark:text-white">
                  {formatCategoryLabel(category)}
                </div>
              </div>

              {/* Respondent / Entity */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
                <div className="text-[11px] font-medium text-zinc-500">Opposite Party / Entity</div>
                <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{involvedEntity || 'Not specified'}</span>
                </div>
              </div>

              {/* Disputed Amount */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
                <div className="text-[11px] font-medium text-zinc-500">Disputed Amount</div>
                <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 text-[#007FFF] shrink-0" />
                  <span>{disputedAmount ? `₹${Number(disputedAmount).toLocaleString('en-IN')}` : '₹0 (Not quantified)'}</span>
                </div>
              </div>

              {/* Incident Date */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
                <div className="text-[11px] font-medium text-zinc-500">Incident Date</div>
                <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>{incidentDate || 'Not specified'}</span>
                </div>
              </div>

              {/* Location */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
                <div className="text-[11px] font-medium text-zinc-500">Location</div>
                <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>{incidentLocation || 'Not specified'}</span>
                </div>
              </div>

              {/* Recommended Authority */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
                <div className="text-[11px] font-medium text-zinc-500">Competent Redressal Authority</div>
                <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-[#007FFF] shrink-0" />
                  <span className="truncate">{getRecommendedAuthority(category).name}</span>
                </div>
              </div>
            </div>

            {/* Optional Qualified Statutory Legal Analysis Card */}
            {(savedAnalysis || currentAnalysis) && (
              <div className="mt-3 p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 dark:text-blue-300">
                    <Scale className="w-3.5 h-3.5 text-[#007FFF]" />
                    <span>Preliminary Statutory Assessment (AI Reference Guide)</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Evaluated under Indian Law
                  </span>
                </div>
                <LegalMarkdownRenderer
                  content={(savedAnalysis || currentAnalysis)?.synthesis || ''}
                  variant="compact"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {(savedAnalysis || currentAnalysis)?.findings?.temporalJurisdiction?.applicableCriminalStatutes?.slice(0, 3).map((statute) => (
                    <span
                      key={statute.catalogueId || statute.sectionNumber}
                      className="px-2 py-0.5 rounded-md bg-blue-100/70 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-[10px] font-medium"
                    >
                      {statute.actTitle.includes('BNS') || statute.actTitle.includes('Bharatiya') ? 'BNS' : statute.actTitle.includes('Information') ? 'IT Act' : 'IPC'} {statute.sectionNumber}
                    </span>
                  ))}
                  {(savedAnalysis || currentAnalysis)?.findings?.rbiCommercialBanksProtection?.tier && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100/70 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-[10px] font-medium">
                      RBI Tier: {(savedAnalysis || currentAnalysis)?.findings.rbiCommercialBanksProtection.tier.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic pt-0.5">
                  Disclaimer: Statutory provisions and liability assessments are informational aids for petition drafting and do not constitute formal legal advice or binding judicial determinations.
                </p>
              </div>
            )}
          </div>

          {/* 3. Formal / Simple Complaint Draft Statement */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider font-mono">
                  FINAL PREPARATION · STEP 5
                </div>
                <h3 className="text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                  Structured Complaint Statement
                </h3>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setComplaintView('formal')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      complaintView === 'formal'
                        ? 'bg-white dark:bg-zinc-800 text-[#007FFF] shadow-xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Formal Legal
                  </button>
                  <button
                    type="button"
                    onClick={() => setComplaintView('simple')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      complaintView === 'simple'
                        ? 'bg-white dark:bg-zinc-800 text-[#007FFF] shadow-xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Simple Citizen
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const text =
                      complaintView === 'formal'
                        ? buildCurrentCaseRecord().complaintDraft.formalBody
                        : buildCurrentCaseRecord().complaintDraft.simpleBody;
                    navigator.clipboard.writeText(text);
                    setCopiedDraft(true);
                    setTimeout(() => setCopiedDraft(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  {copiedDraft ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Statement</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Complaint Text Box */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
              {complaintView === 'formal'
                ? buildCurrentCaseRecord().complaintDraft.formalBody
                : buildCurrentCaseRecord().complaintDraft.simpleBody}
            </div>
          </div>

          {/* 4. Factual Incident Timeline Chronology */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#007FFF]" />
                  <span>Incident Chronology</span>
                </div>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white mt-0.5">
                  Factual Incident Timeline ({timeline.length} Events)
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Chronological sequence of incident occurrences, transactions, and customer grievance notices.
                </p>
              </div>
            </div>

            {timeline.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <Clock className="w-6 h-6 text-zinc-400 mx-auto" />
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  No Incident Timeline Events Recorded
                </div>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  No chronological events have been attached to this case. You can navigate back to Step 1 or Step 2 to record transaction dates and incident milestones.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {timeline.map((item, idx) => {
                  const linkedExhibit = item.evidenceId ? evidenceList.find((e) => e.id === item.evidenceId) : null;
                  return (
                    <div
                      key={item.id || idx}
                      className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 space-y-1.5 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="font-semibold text-zinc-950 dark:text-white flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-[#007FFF] font-mono text-[10px] flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span>{item.title}</span>
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          <span>{item.date}</span>
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed pl-7">
                        {item.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pl-7 pt-0.5">
                        {linkedExhibit && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono text-[10px] flex items-center gap-1 border border-blue-200/60 dark:border-blue-900/40">
                            <Paperclip className="w-2.5 h-2.5" />
                            <span>Linked Exhibit: {linkedExhibit.title}</span>
                          </span>
                        )}
                        {item.verifiedByDoc ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium text-[10px] flex items-center gap-1 border border-emerald-200/60 dark:border-emerald-900/40">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Document Verified</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px]">
                            Citizen Narrative
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Integrated Digital Custody Proof Section */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#007FFF]" />
                  <span>Digital Custody Proof · Case {caseId}</span>
                </div>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white mt-0.5">
                  Cryptographic Integrity & Digital Custody
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Cryptographic SHA-256 evidence digests and append-only internal handling log.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadAuditReport}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer shadow-xs whitespace-nowrap"
              >
                {downloadReportSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Report Downloaded</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-[#007FFF]" />
                    <span>Download Custody Report</span>
                  </>
                )}
              </button>
            </div>

            {/* Preserved Evidence Register */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Preserved Evidence Register ({evidenceList.length} Exhibits)
                </div>
                <div className="text-[11px] text-zinc-500">
                  FIPS PUB 180-4 SHA-256 binary digests
                </div>
              </div>

              {evidenceList.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 space-y-1.5">
                  <FileSearch className="w-6 h-6 text-zinc-400 mx-auto" />
                  <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    No Evidence Documents Uploaded
                  </div>
                  <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                    No supporting exhibits have been attached to this petition. You may upload bank statements, receipts, or screenshots in Step 2.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {evidenceList.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col gap-2.5 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] text-[#007FFF] font-bold">
                              [EX-0{idx + 1}]
                            </span>
                            <span>{item.title}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {item.category.replace(/_/g, ' ')}
                            </span>
                            {item.verifiedOriginal ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100/70 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Verified Original
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                Electronic Copy
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                            {item.fileName && <span>File: {item.fileName}</span>}
                            {item.fileSize && <span>Size: {item.fileSize}</span>}
                            {item.fileType && <span>Type: {item.fileType}</span>}
                            {item.uploadDate && <span>Uploaded: {item.uploadDate}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                          {/* Download Exhibit Button */}
                          <button
                            type="button"
                            onClick={() => handleDownloadExhibit(item)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer shadow-2xs"
                            title="Download preserved file from vault"
                          >
                            <Download className="w-3 h-3 text-[#007FFF]" />
                            <span>Download</span>
                          </button>

                          {/* Verify Integrity Button */}
                          <button
                            type="button"
                            disabled={!item.sha256Hash}
                            onClick={() => {
                              if (item.sha256Hash) {
                                handleVerifyIntegrity(item.id, item.sha256Hash);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                          >
                            {integrityStatus[item.id] === 'verifying'
                              ? 'Checking...'
                              : integrityStatus[item.id] === 'verified'
                              ? '✓ Verified'
                              : integrityStatus[item.id] === 'tampered'
                              ? '⚠ Mismatch'
                              : 'Verify Integrity'}
                          </button>
                        </div>
                      </div>

                      {/* Cryptographic SHA-256 Digest */}
                      <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-all space-y-0.5">
                        <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                          Cryptographic Digest (SHA-256)
                        </div>
                        <div>{item.sha256Hash || 'Metadata only (Unuploaded exhibit)'}</div>
                      </div>

                      {/* Useful OCR Metadata (or truthful pending / no_text indicator) */}
                      {(() => {
                        const step5Ocr = resolveExhibitOcrData(item);
                        if (
                          item.ocrExtracted &&
                          (item.ocrExtracted.amounts?.length ||
                            item.ocrExtracted.dates?.length ||
                            item.ocrExtracted.summary)
                        ) {
                          return (
                            <div className="flex flex-wrap items-center gap-2 text-[10px] pt-0.5">
                              <span className="font-semibold text-zinc-500">OCR Extracted:</span>
                              {item.ocrExtracted.amounts?.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                  Amounts: {item.ocrExtracted.amounts.join(', ')}
                                </span>
                              )}
                              {item.ocrExtracted.dates?.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                  Dates: {item.ocrExtracted.dates.join(', ')}
                                </span>
                              )}
                              {item.ocrExtracted.summary && (
                                <span className="text-zinc-500 truncate max-w-md">
                                  Summary: {item.ocrExtracted.summary}
                                </span>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono pt-0.5">
                            OCR Status:{' '}
                            {step5Ocr.status === 'no_text'
                              ? 'No text detected'
                              : step5Ocr.status === 'failed'
                              ? 'Scan unavailable'
                              : 'Scan pending'}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic pt-1">
                Cryptographic SHA-256 hash verifies file stream integrity against post-upload modification. It does not independently verify underlying real-world document authenticity.
              </p>
            </div>

            {/* Chronological Append-Only Custody Log */}
            <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#007FFF]" />
                <span>Append-Only Case Activity Log ({custodyEvents.length} Events)</span>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {custodyEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/20 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900 dark:text-white">{ev.action}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{ev.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{ev.details}</p>
                    <div className="text-[10px] font-mono text-[#007FFF]">Actor: {ev.actor}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Proceed Error Alert */}
          {proceedError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold">Persistence Error</div>
                <div className="text-[11px] mt-0.5">{proceedError}</div>
              </div>
              <button
                type="button"
                onClick={() => setProceedError(null)}
                className="text-red-600 dark:text-red-400 hover:underline text-[11px] cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Previous / Final Save & Proceed Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
            <button
              type="button"
              onClick={() => handleValidateAndAdvance(4)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous: Statutory Legal Analysis</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isSavingDraft || isProceedingToNavigator}
                onClick={handleSaveDraft}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveDraftStatus === 'saving' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007FFF]" />
                    <span>Saving Draft...</span>
                  </>
                ) : saveDraftStatus === 'saved' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Draft Saved ✓</span>
                  </>
                ) : saveDraftStatus === 'error' ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    <span>Save Failed</span>
                  </>
                ) : (
                  <span>Save Draft</span>
                )}
              </button>

              <button
                type="button"
                disabled={isSavingDraft || isProceedingToNavigator}
                onClick={handleSaveAndProceedToNavigator}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isProceedingToNavigator ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving & Opening Navigator...</span>
                  </>
                ) : (
                  <>
                    <span>Save & Proceed to Resolution Navigator</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
