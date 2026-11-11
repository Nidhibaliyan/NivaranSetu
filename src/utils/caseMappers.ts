/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GrievanceCase,
  EvidenceItem,
  TimelineEvent,
  CustodyEvent,
  CustodyEventType,
  CaseMonitoringData,
  CaseReminder,
  CaseResponseRecord,
  FollowUpLetterDraft,
  CitizenReportedStatus,
  GrievanceCategory,
  CaseStage,
  TrustCheckRecord,
  NavigatorSession,
  LegalAnalysisResponse,
} from '../types';

// =============================================================================
// DATABASE ROW INTERFACES (PostgreSQL schema matching 01_fresh_install.sql)
// =============================================================================

export interface GrievanceCaseRow {
  user_id: string; // UUID
  id: string;
  title: string;
  category: GrievanceCategory;
  stage: CaseStage;
  status: 'active' | 'pending_attention' | 'ready' | 'resolved';
  is_sample_data: boolean;
  incident_date: string | null;
  incident_location: string;
  involved_entity: string;
  disputed_amount: number | null;
  currency: string;
  description: string;
  simple_summary: string;
  readiness_score: number;
  readiness_breakdown: {
    evidenceCompleteness: number;
    timelineClarity: number;
    identityProof: number;
    formalNoticeSent: number;
  };
  recommended_authority: {
    name: string;
    portalName: string;
    portalUrl: string;
    filingFee: string;
    averageResolutionTime: string;
  };
  complaint_draft: {
    subject: string;
    formalBody: string;
    simpleBody: string;
    reliefSought: string;
    legalAnalysis?: LegalAnalysisResponse | null;
  };
  missing_elements: string[];
  filing_details: {
    referenceNumber?: string;
    authority?: string;
    filingDate?: string;
    officialAckUrl?: string;
    notes?: string;
  } | null;
  trust_check_record: TrustCheckRecord | null;
  created_at: string;
  last_updated: string;
  deleted_at: string | null;
}

export interface EvidenceItemRow {
  user_id: string; // UUID
  case_id: string;
  id: string;
  title: string;
  category: 'receipt' | 'correspondence' | 'screenshot' | 'agreement' | 'notice' | 'bank_statement';
  file_name: string;
  file_size_bytes: number;
  file_size_formatted: string;
  file_type: string;
  upload_date: string;
  sha256_hash: string | null;
  storage_ref: string | null;
  raw_ocr_text: string | null;
  has_blob: boolean;
  ocr_extracted: {
    dates: string[];
    amounts: string[];
    identifiers: string[];
    parties: string[];
    summary: string;
  };
  flag: {
    type: 'inconsistency' | 'duplicate' | 'verified';
    message: string;
  } | null;
  claim_mapped_to: string | null;
  verified_original: boolean;
  created_at: string;
  deleted_at: string | null;
}

export interface TimelineEventRow {
  user_id: string; // UUID
  case_id: string;
  id: string;
  evidence_id: string | null;
  date: string;
  title: string;
  description: string;
  verified_by_doc: boolean;
  created_at: string;
}

export interface CustodyEventRow {
  user_id: string; // UUID
  case_id: string;
  id: string;
  evidence_id: string | null;
  event_type: CustodyEventType;
  action: string;
  actor: string;
  client_timestamp: string;
  server_timestamp: string;
  details: string;
  file_hash: string | null;
}

export interface CaseMonitoringRow {
  user_id: string; // UUID
  case_id: string;
  submission_date: string | null;
  submission_time: string | null;
  official_portal: string | null;
  department: string | null;
  docket_number: string | null;
  citizen_reported_status: CitizenReportedStatus;
  statutory_deadline_days: number;
  statutory_deadline_date: string | null;
  reminders: CaseReminder[];
  responses: CaseResponseRecord[];
  generated_letters: FollowUpLetterDraft[];
  last_evaluated_at: string | null;
  updated_at: string;
}

export interface NavigatorSessionRow {
  user_id: string; // UUID
  case_id: string;
  guide_id: string;
  current_step: number;
  ack_number: string;
  ack_filing_date: string;
  saved_at: string;
}

// =============================================================================
// VALIDATION & NORMALIZATION HELPERS
// =============================================================================

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Validates strictly that the provided string is in standard UUID format (v4 / 8-4-4-4-12 hex).
 *
 * NOTE: This function validates string syntax/format only. It DOES NOT prove or verify
 * that the user ID originated from an authenticated Supabase session.
 * The future repository layer is strictly responsible for obtaining the authoritative user ID
 * from the verified Supabase session (`supabase.auth.getSession()` / `auth.uid()`),
 * and must NEVER accept or trust an unverified user ID from arbitrary UI or client input.
 */
export function assertValidUserUuid(userId: string): string {
  if (!userId || typeof userId !== 'string') {
    throw new Error('A valid user UUID string is required for database row conversion.');
  }
  const trimmed = userId.trim();
  if (!UUID_REGEX.test(trimmed)) {
    throw new Error(`Invalid user UUID "${userId}": Must match standard UUID format.`);
  }
  return trimmed;
}

// Backwards-compatible alias
export const assertValidUserId = assertValidUserUuid;

/**
 * Validates that a case ID is provided and non-empty.
 */
export function assertValidCaseId(caseId: string): string {
  if (!caseId || typeof caseId !== 'string' || !caseId.trim()) {
    throw new Error('A valid caseId is required.');
  }
  return caseId.trim();
}

/**
 * Parses a human-readable file size string (e.g. "1.4 MB", "480 KB", "1024 B") into bytes.
 */
export function parseFormattedSizeToBytes(formatted: string | undefined): number {
  if (!formatted || typeof formatted !== 'string') return 0;
  const trimmed = formatted.trim();
  const match = trimmed.match(/^([\d.]+)\s*([a-zA-Z]+)?$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (isNaN(num) || num < 0) return 0;
  const unit = (match[2] || 'B').toUpperCase();
  switch (unit) {
    case 'GB':
      return Math.round(num * 1024 * 1024 * 1024);
    case 'MB':
      return Math.round(num * 1024 * 1024);
    case 'KB':
      return Math.round(num * 1024);
    case 'B':
    default:
      return Math.round(num);
  }
}

/**
 * Formats byte size into human readable string (KB, MB).
 */
export function formatByteSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Normalizes SHA-256 hashes:
 * - Empty string or whitespace becomes SQL NULL (null).
 * - Valid 64-char hex strings are trimmed and lowercased.
 * - Non-hex strings are rejected and normalized to null.
 */
export function normalizeSha256Hash(hash: string | null | undefined): string | null {
  if (!hash || typeof hash !== 'string') return null;
  const trimmed = hash.trim();
  if (!trimmed) return null;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return null;
}

// =============================================================================
// 1. GRIEVANCE CASE MAPPERS
// =============================================================================

/**
 * Converts a frontend GrievanceCase to a database grievance_cases row.
 * Requires verified session userId (UUID).
 */
export function caseToRow(c: GrievanceCase, userId: string): GrievanceCaseRow {
  const validUserId = assertValidUserUuid(userId);
  const validCaseId = assertValidCaseId(c.id);

  const cleanIncidentDate = c.incidentDate?.trim() || null;
  const cleanDisputedAmount =
    c.disputedAmount != null && !isNaN(Number(c.disputedAmount)) && Number(c.disputedAmount) >= 0
      ? Number(c.disputedAmount)
      : null;

  return {
    user_id: validUserId,
    id: validCaseId,
    title: c.title?.trim().substring(0, 255) || 'Untitled Grievance',
    category: c.category || 'banking_financial',
    stage: c.stage || 'drafting',
    status: c.status || 'active',
    is_sample_data: Boolean(c.isSampleData),
    incident_date: cleanIncidentDate,
    incident_location: c.incidentLocation?.trim() || '',
    involved_entity: c.involvedEntity?.trim() || '',
    disputed_amount: cleanDisputedAmount,
    currency: c.currency?.trim() || 'INR',
    description: c.description || '',
    simple_summary: c.simpleSummary || '',
    readiness_score: Math.min(100, Math.max(0, Math.round(c.readinessScore || 0))),
    readiness_breakdown: c.readinessBreakdown || {
      evidenceCompleteness: 0,
      timelineClarity: 0,
      identityProof: 0,
      formalNoticeSent: 0,
    },
    recommended_authority: c.recommendedAuthority || {
      name: '',
      portalName: '',
      portalUrl: '',
      filingFee: '',
      averageResolutionTime: '',
    },
    complaint_draft: c.complaintDraft || {
      subject: '',
      formalBody: '',
      simpleBody: '',
      reliefSought: '',
    },
    missing_elements: Array.isArray(c.missingElements) ? c.missingElements : [],
    filing_details: c.filingDetails || null,
    trust_check_record: c.trustCheckRecord || null,
    created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
    last_updated: c.lastUpdated ? new Date(c.lastUpdated).toISOString() : new Date().toISOString(),
    deleted_at: c.deletedAt ? new Date(c.deletedAt).toISOString() : null,
  };
}

/**
 * Converts a database grievance_cases row to a frontend GrievanceCase.
 * Optionally attaches child records (evidence, timeline, custody, monitoring).
 */
export function rowToCase(
  row: GrievanceCaseRow,
  children?: {
    evidence?: EvidenceItem[];
    timeline?: TimelineEvent[];
    custodyEvents?: CustodyEvent[];
    monitoring?: CaseMonitoringData;
  }
): GrievanceCase {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    stage: row.stage,
    status: row.status,
    isSampleData: Boolean(row.is_sample_data),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    lastUpdated: row.last_updated ? new Date(row.last_updated).toISOString() : new Date().toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    incidentDate: row.incident_date || '',
    incidentLocation: row.incident_location || '',
    involvedEntity: row.involved_entity || '',
    disputedAmount: row.disputed_amount != null ? Number(row.disputed_amount) : undefined,
    currency: row.currency || 'INR',
    description: row.description || '',
    simpleSummary: row.simple_summary || '',
    readinessScore: Number(row.readiness_score || 0),
    readinessBreakdown: row.readiness_breakdown || {
      evidenceCompleteness: 0,
      timelineClarity: 0,
      identityProof: 0,
      formalNoticeSent: 0,
    },
    recommendedAuthority: row.recommended_authority || {
      name: '',
      portalName: '',
      portalUrl: '',
      filingFee: '',
      averageResolutionTime: '',
    },
    complaintDraft: row.complaint_draft || {
      subject: '',
      formalBody: '',
      simpleBody: '',
      reliefSought: '',
    },
    missingElements: Array.isArray(row.missing_elements) ? row.missing_elements : [],
    filingDetails: row.filing_details || undefined,
    trustCheckRecord: row.trust_check_record || undefined,
    evidence: children?.evidence || [],
    timeline: children?.timeline || [],
    custodyEvents: children?.custodyEvents || [],
    monitoring: children?.monitoring || undefined,
  };
}

// =============================================================================
// 2. EVIDENCE ITEM MAPPERS
// =============================================================================

/**
 * Converts a frontend EvidenceItem to a database evidence_items row.
 * Strictly guarantees chk_evidence_blob_hash_integrity:
 * - When hasBlob = true: storage_ref and sha256_hash MUST be non-null and valid.
 *   If either is missing, the mapping is rejected with a clear error.
 *   Never silently converts incomplete real evidence into a synthetic/no-blob item.
 * - When hasBlob = false: storage_ref = null, sha256_hash = null, verified_original = false.
 */
export function evidenceToRow(
  item: EvidenceItem,
  userId: string,
  caseId: string
): EvidenceItemRow {
  const validUserId = assertValidUserUuid(userId);
  const validCaseId = assertValidCaseId(caseId);
  const validId = item.id?.trim() || `ev-${Date.now()}`;

  const cleanHash = normalizeSha256Hash(item.sha256Hash);
  const cleanStorageRef = item.storageRef?.trim() || null;

  let hasBlob: boolean;
  let sha256Hash: string | null;
  let storageRef: string | null;
  let verifiedOriginal: boolean;

  if (item.hasBlob === true) {
    if (!cleanStorageRef) {
      throw new Error(
        `EVIDENCE_INTEGRITY_VIOLATION: Evidence item "${validId}" has hasBlob=true but is missing a valid storage reference. Incomplete binary exhibits cannot be mapped to database storage.`
      );
    }
    if (!cleanHash) {
      throw new Error(
        `EVIDENCE_INTEGRITY_VIOLATION: Evidence item "${validId}" has hasBlob=true but is missing a valid 64-character SHA-256 digest. Incomplete binary exhibits cannot be mapped to database storage.`
      );
    }
    hasBlob = true;
    storageRef = cleanStorageRef;
    sha256Hash = cleanHash;
    verifiedOriginal = Boolean(item.verifiedOriginal);
  } else {
    // Synthetic demo evidence or unuploaded exhibit metadata
    hasBlob = false;
    storageRef = null;
    sha256Hash = null;
    verifiedOriginal = false;
  }

  // Compute byte size
  const bytes =
    item.fileSizeBytes != null && !isNaN(Number(item.fileSizeBytes)) && Number(item.fileSizeBytes) >= 0
      ? Math.round(Number(item.fileSizeBytes))
      : parseFormattedSizeToBytes(item.fileSize);

  const formattedSize = item.fileSize?.trim() || formatByteSize(bytes);

  return {
    user_id: validUserId,
    case_id: validCaseId,
    id: validId,
    title: item.title?.trim().substring(0, 255) || 'Untitled Exhibit',
    category: item.category || 'receipt',
    file_name: item.fileName?.trim().substring(0, 255) || 'unnamed_file',
    file_size_bytes: bytes,
    file_size_formatted: formattedSize,
    file_type: item.fileType?.trim() || 'application/octet-stream',
    upload_date: item.uploadDate ? new Date(item.uploadDate).toISOString() : new Date().toISOString(),
    sha256_hash: sha256Hash,
    storage_ref: storageRef,
    raw_ocr_text: item.rawOcrText?.trim() || null,
    has_blob: hasBlob,
    ocr_extracted: {
      dates: Array.isArray(item.ocrExtracted?.dates) ? item.ocrExtracted.dates : [],
      amounts: Array.isArray(item.ocrExtracted?.amounts) ? item.ocrExtracted.amounts : [],
      identifiers: Array.isArray(item.ocrExtracted?.identifiers) ? item.ocrExtracted.identifiers : [],
      parties: Array.isArray(item.ocrExtracted?.parties) ? item.ocrExtracted.parties : [],
      summary: item.ocrExtracted?.summary || '',
    },
    flag: item.flag || null,
    claim_mapped_to: item.claimMappedTo?.trim() || null,
    verified_original: verifiedOriginal,
    created_at: new Date().toISOString(),
    deleted_at: item.deletedAt ? new Date(item.deletedAt).toISOString() : null,
  };
}

/**
 * Converts a database evidence_items row to a frontend EvidenceItem.
 */
export function rowToEvidence(row: EvidenceItemRow): EvidenceItem {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    fileName: row.file_name,
    fileSize: row.file_size_formatted || formatByteSize(Number(row.file_size_bytes)),
    fileSizeBytes: Number(row.file_size_bytes),
    fileType: row.file_type,
    uploadDate: row.upload_date ? new Date(row.upload_date).toISOString().split('T')[0] : '',
    sha256Hash: row.sha256_hash || null,
    storageRef: row.storage_ref || undefined,
    rawOcrText: row.raw_ocr_text || undefined,
    hasBlob: Boolean(row.has_blob),
    ocrExtracted: {
      dates: Array.isArray(row.ocr_extracted?.dates) ? row.ocr_extracted.dates : [],
      amounts: Array.isArray(row.ocr_extracted?.amounts) ? row.ocr_extracted.amounts : [],
      identifiers: Array.isArray(row.ocr_extracted?.identifiers) ? row.ocr_extracted.identifiers : [],
      parties: Array.isArray(row.ocr_extracted?.parties) ? row.ocr_extracted.parties : [],
      summary: row.ocr_extracted?.summary || '',
    },
    flag: row.flag || undefined,
    claimMappedTo: row.claim_mapped_to || undefined,
    verifiedOriginal: Boolean(row.verified_original),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  };
}

// =============================================================================
// 3. TIMELINE EVENT MAPPERS
// =============================================================================

/**
 * Converts a frontend TimelineEvent to a database timeline_events row.
 */
export function timelineToRow(
  event: TimelineEvent,
  userId: string,
  caseId: string
): TimelineEventRow {
  const validUserId = assertValidUserUuid(userId);
  const validCaseId = assertValidCaseId(caseId);

  return {
    user_id: validUserId,
    case_id: validCaseId,
    id: event.id?.trim() || `tl-${Date.now()}`,
    evidence_id: event.evidenceId?.trim() || null,
    date: event.date?.trim() || new Date().toISOString().split('T')[0],
    title: event.title?.trim().substring(0, 255) || 'Timeline Milestone',
    description: event.description || '',
    verified_by_doc: Boolean(event.verifiedByDoc),
    created_at: new Date().toISOString(),
  };
}

/**
 * Converts a database timeline_events row to a frontend TimelineEvent.
 */
export function rowToTimeline(row: TimelineEventRow): TimelineEvent {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    description: row.description || '',
    evidenceId: row.evidence_id || null,
    verifiedByDoc: Boolean(row.verified_by_doc),
  };
}

// =============================================================================
// 4. CUSTODY EVENT MAPPERS
// =============================================================================

/**
 * Converts a frontend CustodyEvent to a database custody_events row.
 */
export function custodyToRow(event: CustodyEvent, userId: string): CustodyEventRow {
  const validUserId = assertValidUserUuid(userId);
  const validCaseId = assertValidCaseId(event.caseId);

  const cleanFileHash = normalizeSha256Hash(event.fileHash);

  return {
    user_id: validUserId,
    case_id: validCaseId,
    id: event.id?.trim() || `ev-${Date.now()}`,
    evidence_id: event.evidenceId?.trim() || null,
    event_type: event.eventType,
    action: event.action?.trim() || 'Custody Event Recorded',
    actor: event.actor?.trim() || 'Citizen (Browser Session)',
    client_timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
    server_timestamp: new Date().toISOString(),
    details: event.details || '',
    file_hash: cleanFileHash,
  };
}

/**
 * Converts a database custody_events row to a frontend CustodyEvent.
 */
export function rowToCustody(row: CustodyEventRow): CustodyEvent {
  return {
    id: row.id,
    caseId: row.case_id,
    evidenceId: row.evidence_id || undefined,
    eventType: row.event_type,
    action: row.action,
    actor: row.actor,
    timestamp: row.client_timestamp || row.server_timestamp,
    details: row.details || '',
    fileHash: row.file_hash || null,
  };
}

// =============================================================================
// 5. CASE MONITORING MAPPERS
// =============================================================================

/**
 * Converts a frontend CaseMonitoringData object to a database case_monitoring row.
 */
export function monitoringToRow(
  data: CaseMonitoringData,
  userId: string,
  caseId: string
): CaseMonitoringRow {
  const validUserId = assertValidUserUuid(userId);
  const validCaseId = assertValidCaseId(caseId);

  const deadlineDays =
    Number.isFinite(data.statutoryDeadlineDays) && data.statutoryDeadlineDays >= 0
      ? Math.round(data.statutoryDeadlineDays)
      : 30;

  return {
    user_id: validUserId,
    case_id: validCaseId,
    submission_date: data.submissionDate?.trim() || null,
    submission_time: data.submissionTime?.trim() || null,
    official_portal: data.officialPortal?.trim() || null,
    department: data.department?.trim() || null,
    docket_number: data.docketNumber?.trim() || null,
    citizen_reported_status: data.citizenReportedStatus || 'not_submitted',
    statutory_deadline_days: deadlineDays,
    statutory_deadline_date: data.statutoryDeadlineDate?.trim() || null,
    reminders: Array.isArray(data.reminders) ? data.reminders : [],
    responses: Array.isArray(data.responses) ? data.responses : [],
    generated_letters: Array.isArray(data.generatedLetters) ? data.generatedLetters : [],
    last_evaluated_at: data.lastEvaluatedAt ? new Date(data.lastEvaluatedAt).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Converts a database case_monitoring row to a frontend CaseMonitoringData object.
 */
export function rowToMonitoring(row: CaseMonitoringRow): CaseMonitoringData {
  return {
    submissionDate: row.submission_date || undefined,
    submissionTime: row.submission_time || undefined,
    officialPortal: row.official_portal || undefined,
    department: row.department || undefined,
    docketNumber: row.docket_number || undefined,
    citizenReportedStatus: row.citizen_reported_status || 'not_submitted',
    statutoryDeadlineDays: row.statutory_deadline_days ?? 30,
    statutoryDeadlineDate: row.statutory_deadline_date || undefined,
    reminders: Array.isArray(row.reminders) ? row.reminders : [],
    responses: Array.isArray(row.responses) ? row.responses : [],
    generatedLetters: Array.isArray(row.generated_letters) ? row.generated_letters : [],
    lastEvaluatedAt: row.last_evaluated_at ? new Date(row.last_evaluated_at).toISOString() : undefined,
  };
}

// =============================================================================
// 6. RESOLUTION NAVIGATOR SESSION MAPPERS
// =============================================================================

/**
 * Converts a frontend NavigatorSession to a database navigator_sessions row.
 * Steps are clamped to the 1-8 range enforced by SQL check constraint.
 */
export function navigatorSessionToRow(
  session: NavigatorSession,
  userId: string
): NavigatorSessionRow {
  const validUserId = assertValidUserUuid(userId);
  const validCaseId = assertValidCaseId(session.caseId);

  const clampedStep = Math.min(8, Math.max(1, Math.round(session.currentStep || 1)));

  return {
    user_id: validUserId,
    case_id: validCaseId,
    guide_id: session.guideId?.trim() || 'default-guide',
    current_step: clampedStep,
    ack_number: session.ackNumber?.trim() || '',
    ack_filing_date: session.ackFilingDate?.trim() || '',
    saved_at: session.savedAt ? new Date(session.savedAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * Converts a database navigator_sessions row to a frontend NavigatorSession.
 */
export function rowToNavigatorSession(row: NavigatorSessionRow): NavigatorSession {
  return {
    caseId: row.case_id,
    guideId: row.guide_id,
    currentStep: row.current_step,
    ackNumber: row.ack_number || '',
    ackFilingDate: row.ack_filing_date || '',
    savedAt: row.saved_at ? new Date(row.saved_at).toISOString() : undefined,
  };
}

/**
 * Convenience aliases for evidence mappers.
 */
export function mapEvidenceItemToDbRow(
  caseId: string,
  item: EvidenceItem,
  userId: string = '00000000-0000-0000-0000-000000000001'
): EvidenceItemRow {
  return evidenceToRow(item, userId, caseId);
}
export const mapDbRowToEvidenceItem = rowToEvidence;
