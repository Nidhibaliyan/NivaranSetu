import { GrievanceCase, CustodyEvent, EvidenceItem, CustodyEventType } from '../types';
import { INITIAL_CASES } from '../sampleData';

const DB_NAME = 'nivaransetu_case_db';
const DB_VERSION = 1;
const STORAGE_KEY = 'ns_grievance_cases';

/**
 * Genuine cryptographic SHA-256 implementation using standard Web Crypto API.
 * Never uses Math.random() or non-cryptographic substitutes.
 */
export async function calculateSha256(data: File | Blob | ArrayBuffer): Promise<string> {
  let buffer: ArrayBuffer;
  if (data instanceof ArrayBuffer) {
    buffer = data;
  } else {
    buffer = await data.arrayBuffer();
  }

  // Use standard Web Crypto API (supported natively in modern browsers and Node 18+)
  const cryptoObj =
    typeof window !== 'undefined' && window.crypto
      ? window.crypto
      : typeof globalThis !== 'undefined' && globalThis.crypto
      ? globalThis.crypto
      : null;

  if (cryptoObj && cryptoObj.subtle) {
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  throw new Error('Standard cryptographic subtle API is not supported in this runtime environment.');
}

/**
 * Formats byte size into human readable string (KB, MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Initializes the IndexedDB instance for persistent local file and case storage.
 */
function openIndexedDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains('cases')) {
        db.createObjectStore('cases', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('evidence_blobs')) {
        db.createObjectStore('evidence_blobs', { keyPath: 'storageKey' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result as IDBDatabase);
    };

    request.onerror = (err) => {
      console.warn('IndexedDB unavailable, falling back to localStorage:', err);
      resolve(null);
    };
  });
}

/**
 * Stores actual binary Blob in IndexedDB.
 */
export async function storeEvidenceBlob(
  caseId: string,
  evidenceId: string,
  blob: Blob
): Promise<boolean> {
  const db = await openIndexedDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('evidence_blobs', 'readwrite');
      const store = tx.objectStore('evidence_blobs');
      const storageKey = `${caseId}_${evidenceId}`;
      const request = store.put({ storageKey, caseId, evidenceId, blob, updatedAt: Date.now() });

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (err) {
      console.warn('Error storing evidence blob:', err);
      resolve(false);
    }
  });
}

/**
 * Retrieves actual binary Blob from IndexedDB.
 */
export async function getEvidenceBlob(
  caseId: string,
  evidenceId: string
): Promise<Blob | null> {
  const db = await openIndexedDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('evidence_blobs', 'readonly');
      const store = tx.objectStore('evidence_blobs');
      const storageKey = `${caseId}_${evidenceId}`;
      const request = store.get(storageKey);

      request.onsuccess = (event: any) => {
        const result = event.target.result;
        resolve(result?.blob || null);
      };
      request.onerror = () => resolve(null);
    } catch (err) {
      console.warn('Error retrieving evidence blob:', err);
      resolve(null);
    }
  });
}

/**
 * Genuine cryptographic verification:
 * Re-reads binary bytes from IndexedDB, recomputes SHA-256 hash,
 * and matches it with recorded SHA-256 digest.
 */
export async function verifyEvidenceIntegrity(
  caseId: string,
  evidenceId: string,
  expectedHash: string | null
): Promise<{ verified: boolean; computedHash: string; status: 'matched' | 'mismatched' | 'blob_not_cached' | 'no_expected_hash' }> {
  if (!expectedHash || !expectedHash.trim()) {
    return { verified: false, computedHash: '', status: 'no_expected_hash' };
  }
  const blob = await getEvidenceBlob(caseId, evidenceId);
  if (!blob) {
    return { verified: false, computedHash: expectedHash, status: 'blob_not_cached' };
  }

  const computedHash = await calculateSha256(blob);
  const verified = computedHash.toLowerCase() === expectedHash.trim().toLowerCase();
  return {
    verified,
    computedHash,
    status: verified ? 'matched' : 'mismatched',
  };
}

/**
 * Creates and appends an immutable custody event for an action.
 */
export function createCustodyEvent(
  caseId: string,
  eventType: CustodyEventType,
  action: string,
  actor: string,
  details: string,
  evidenceId?: string,
  fileHash?: string | null
): CustodyEvent {
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const normalizedFileHash =
    fileHash && fileHash.trim().length > 0 ? fileHash.trim() : null;

  return {
    id: `ev-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    caseId,
    evidenceId,
    eventType,
    action,
    actor,
    timestamp,
    details,
    fileHash: normalizedFileHash,
  };
}

/**
 * Synchronizes cases to persistent stores (IndexedDB and localStorage).
 * @deprecated Offline fallback helper retained for unit tests.
 * Production application persistence is handled authoritatively by `src/utils/caseRepository.ts`.
 */
export async function persistCases(cases: GrievanceCase[]): Promise<void> {
  // Normalize hashes and integrity flags at the persistence boundary
  const normalizedCases = cases.map((c) => ({
    ...c,
    evidence: (c.evidence || []).map((ev) => {
      const cleanHash =
        ev.sha256Hash && ev.sha256Hash.trim().length > 0 ? ev.sha256Hash.trim() : null;
      return {
        ...ev,
        sha256Hash: cleanHash,
        hasBlob: ev.hasBlob === true && !!cleanHash,
        verifiedOriginal:
          ev.verifiedOriginal === true && ev.hasBlob === true && !!cleanHash,
      };
    }),
    custodyEvents: (c.custodyEvents || []).map((ev) => ({
      ...ev,
      fileHash:
        ev.fileHash && ev.fileHash.trim().length > 0 ? ev.fileHash.trim() : null,
    })),
  }));

  // 1. Sync to localStorage for instant synchronous reads
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedCases));
    } catch (e) {
      console.warn('localStorage save warning:', e);
    }
  }

  // 2. Sync to IndexedDB for unlimited capacity
  const db = await openIndexedDb();
  if (!db) return;

  try {
    const tx = db.transaction('cases', 'readwrite');
    const store = tx.objectStore('cases');
    for (const c of normalizedCases) {
      store.put(c);
    }
  } catch (err) {
    console.warn('IndexedDB case sync error:', err);
  }
}

/**
 * Loads saved cases from local storage fallback.
 * @deprecated Offline fallback helper retained for unit tests.
 * Production application case loading is handled authoritatively by `src/utils/caseRepository.ts`.
 */
export function loadInitialCases(): GrievanceCase[] {
  if (typeof localStorage === 'undefined') {
    return INITIAL_CASES;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          return [];
        }
        // Ensure every case has a valid custodyEvents array and proper sample/monitoring flags
        return parsed.map((c: GrievanceCase) => {
          const sampleMatch = INITIAL_CASES.find((init) => init.id === c.id);
          const isSample = sampleMatch ? true : c.isSampleData || false;
          const mergedMonitoring = c.monitoring || sampleMatch?.monitoring;

          return {
            ...c,
            isSampleData: isSample,
            monitoring: mergedMonitoring,
            custodyEvents:
              c.custodyEvents && Array.isArray(c.custodyEvents) && c.custodyEvents.length > 0
                ? c.custodyEvents
                : generateDefaultCustodyEvents(c),
          };
        });
      }
    }
  } catch (e) {
    console.error('Error loading stored cases:', e);
  }
  return INITIAL_CASES;
}

/**
 * Generates initial baseline custody events for cases that lacked them.
 */
export function generateDefaultCustodyEvents(c: GrievanceCase): CustodyEvent[] {
  const events: CustodyEvent[] = [];
  const baseDate = c.createdAt || c.incidentDate || '2026-10-28';

  // 1. Case creation
  events.push({
    id: `ev-init-${c.id}-1`,
    caseId: c.id,
    eventType: 'case_created',
    action: 'Case Record Initialized',
    actor: 'Citizen (Browser Session)',
    timestamp: `${baseDate} 10:14:00 UTC`,
    details: `Grievance case registered under category: ${c.category.replace(/_/g, ' ')}. Disputed entity: ${c.involvedEntity}.`,
  });

  // 2. TrustCheck link if present
  if (c.trustCheckRecord) {
    events.push({
      id: `ev-init-${c.id}-tc`,
      caseId: c.id,
      eventType: 'claim_mapped',
      action: 'TrustCheck Advisory Correlated',
      actor: 'NivaranSetu System',
      timestamp: `${baseDate} 10:14:15 UTC`,
      details: `Integrated findings for suspicious identifier "${c.trustCheckRecord.input}" (${c.trustCheckRecord.riskLevel.toUpperCase().replace(/_/g, ' ')}).`,
    });
  }

  // 3. Evidence ingest events
  c.evidence.forEach((item, idx) => {
    const cleanHash = item.sha256Hash && item.sha256Hash.trim().length > 0 ? item.sha256Hash.trim() : null;
    const isSynthetic = !cleanHash || !item.hasBlob;

    events.push({
      id: `ev-init-${c.id}-ev-${idx}`,
      caseId: c.id,
      evidenceId: item.id,
      eventType: 'evidence_uploaded',
      action: isSynthetic
        ? `Synthetic Exhibit Initialized: ${item.fileName}`
        : `Evidence Uploaded: ${item.fileName}`,
      actor: 'Citizen (Browser Session)',
      timestamp: `${item.uploadDate} 10:15:${(idx * 12).toString().padStart(2, '0')} UTC`,
      details: isSynthetic
        ? `Synthetic exhibit metadata initialized (Demonstration Scenario). File size: ${item.fileSize}, Category: ${item.category}. (No physical binary file uploaded).`
        : `Calculated cryptographic SHA-256 fingerprint: ${cleanHash}. File size: ${item.fileSize}, Category: ${item.category}.`,
      fileHash: cleanHash,
    });

    events.push({
      id: `ev-init-${c.id}-ocr-${idx}`,
      caseId: c.id,
      evidenceId: item.id,
      eventType: 'ocr_processed',
      action: `OCR Entity Extraction: ${item.title}`,
      actor: 'NivaranSetu System',
      timestamp: `${item.uploadDate} 10:15:${(idx * 12 + 2).toString().padStart(2, '0')} UTC`,
      details: `Extracted ${item.ocrExtracted.amounts.length} financial values, ${item.ocrExtracted.dates.length} dates, and ${item.ocrExtracted.identifiers.length} identifiers without modifying binary content.`,
    });
  });

  // 4. Readiness evaluation
  events.push({
    id: `ev-init-${c.id}-rd`,
    caseId: c.id,
    eventType: 'readiness_assessed',
    action: `Case Readiness Evaluated (${c.readinessScore}%)`,
    actor: 'NivaranSetu System',
    timestamp: `${c.lastUpdated.substring(0, 10)} 11:20:00 UTC`,
    details: `Calculated readiness tier: ${c.readinessScore >= 80 ? 'Ready for review' : c.readinessScore >= 50 ? 'Needs additional info' : 'Incomplete'}. Evidence completeness: ${c.readinessBreakdown.evidenceCompleteness}%.`,
  });

  // 5. Authority recommendation
  events.push({
    id: `ev-init-${c.id}-auth`,
    caseId: c.id,
    eventType: 'authority_recommended',
    action: `Statutory Authority Matched: ${c.recommendedAuthority.name}`,
    actor: 'NivaranSetu System',
    timestamp: `${c.lastUpdated.substring(0, 10)} 11:21:00 UTC`,
    details: `Official portal: ${c.recommendedAuthority.portalName} (${c.recommendedAuthority.portalUrl}).`,
  });

  // 6. Complaint generated
  events.push({
    id: `ev-init-${c.id}-comp`,
    caseId: c.id,
    eventType: 'complaint_generated',
    action: 'Structured Complaint Statement Formulated',
    actor: 'Citizen (Browser Session)',
    timestamp: `${c.lastUpdated.substring(0, 10)} 11:22:00 UTC`,
    details: `Subject: "${c.complaintDraft.subject.substring(0, 70)}...". Both formal legal and simplified versions generated.`,
  });

  return events;
}

/**
 * Generates an exportable plaintext Chain-of-Custody Audit Report.
 */
export function exportChainOfCustodyReport(c: GrievanceCase): string {
  const generatedAt = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  return `================================================================================
NIVARANSETU · DIGITAL CHAIN-OF-CUSTODY AUDIT REPORT
================================================================================
Case Reference: ${c.id}
Subject:        ${c.title}
Grievance Area: ${c.category.replace(/_/g, ' ').toUpperCase()}
Involved Party: ${c.involvedEntity}
Disputed Sum:   INR ${c.disputedAmount ? c.disputedAmount.toLocaleString('en-IN') : '0'}
Generated At:   ${generatedAt}
Report Hash:    SHA-256 (calculated on export)

--------------------------------------------------------------------------------
1. INTEGRITY SCOPE & ADMISSIBILITY NOTICE
--------------------------------------------------------------------------------
This report documents the local cryptographic chain-of-custody and evidence
audit events maintained within the NivaranSetu citizen grievance platform.
All file digests are generated using the standard cryptographic SHA-256
algorithm (FIPS PUB 180-4) calculated from the exact binary bytes of each
exhibit upon ingest.

DISCLAIMER:
A cryptographic hash demonstrates that an electronic document has not been
altered or corrupted since its recorded ingest date. It does not independently
certify that the underlying contents are authentic or that statements within
the document are truthful. Legal admissibility in statutory dispute forums
(such as Section 65B of the Indian Evidence Act / Section 63 of Bharatiya
Sakshya Adhiniyam) requires appropriate citizen affidavit / certification.

--------------------------------------------------------------------------------
2. EVIDENCE EXHIBIT REGISTER & CRYPTOGRAPHIC DIGESTS (${c.evidence.length} Exhibits)
--------------------------------------------------------------------------------
${c.evidence
  .map(
    (ev, i) => `[EXHIBIT ${i + 1}]
  Identifier:   ${ev.id}
  Title:        ${ev.title}
  File Name:    ${ev.fileName}
  Size / MIME:  ${ev.fileSize} · ${ev.fileType}
  Ingest Date:  ${ev.uploadDate}
  SHA-256:      ${ev.sha256Hash ? ev.sha256Hash : 'Metadata only (Synthetic / No physical binary)'}
  Integrity:    ${ev.verifiedOriginal ? 'Verified Original (Cryptographic match)' : 'Unverified / Synthetic Exhibit'}
  OCR Entities: ${ev.ocrExtracted.amounts.join(', ') || 'None'} | ${ev.ocrExtracted.dates.join(', ') || 'None'}
`
  )
  .join('\n')}

--------------------------------------------------------------------------------
3. CHRONOLOGICAL AUDIT & CUSTODY LOG (${c.custodyEvents.length} Events Recorded)
--------------------------------------------------------------------------------
${c.custodyEvents
  .map(
    (ev, i) => `[EVENT ${i + 1}] ${ev.timestamp}
  Action:      ${ev.action}
  Event Type:  ${ev.eventType}
  Actor:       ${ev.actor}
  Details:     ${ev.details}${ev.fileHash ? `\n  Digest:      ${ev.fileHash}` : ''}
`
  )
  .join('\n')}

================================================================================
END OF DIGITAL CHAIN-OF-CUSTODY REPORT · NIVARANSETU (A BRIDGE TO RESOLUTION)
================================================================================`;
}
