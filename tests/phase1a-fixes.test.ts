/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — Phase 1A Regression Test Suite
 *
 * Covers the 4 targeted P0 database persistence & correctness fixes:
 *   1. Forward-only Supabase migration permits active frontend custody events
 *      (evidence_verified, response_received, followup_letter_generated,
 *       filing_ref_recorded, submission_recorded) while preserving all custody
 *      integrity, actor anti-spoofing, and RLS protections.
 *   2. CaseDossier text export reflects ev.verifiedOriginal truthfully and
 *      never claims "Verified Original" when verification has not occurred.
 *   3. authSession.getPersistedTab() persists and restores 'legal_rag'.
 *   4. SmartCaseMonitoring has zero window.alert() calls and validates actions
 *      using inline banner helpers.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Minimal localStorage polyfill for Node execution
class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new MockLocalStorage();
}

import {
  getEvidenceIntegrityTextLabel,
  buildCaseDossierText,
} from '../src/components/CaseDossier';
import {
  getPersistedTab,
  savePersistedTab,
  ACTIVE_TAB_KEY,
} from '../src/utils/authSession';
import {
  validateResponseAttachmentDownload,
  validateResponseSubmissionInput,
} from '../src/components/SmartCaseMonitoring';
import { INITIAL_CASES } from '../src/sampleData';
import { GrievanceCase } from '../src/types';

console.log('=== NivaranSetu Phase 1A Regression Test Suite ===\n');

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. DATABASE CUSTODY EVENT MISMATCH — FORWARD-ONLY MIGRATION CHECKS
// ---------------------------------------------------------------------------
console.log('--- 1. Custody Migration & Frontend Producer Alignment ---');

const migrationPath = path.join(
  ROOT,
  'supabase/migrations/20261115_permit_frontend_custody_events.sql'
);
assert(
  fs.existsSync(migrationPath),
  '1.1: Forward-only custody migration file exists'
);

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Extract trigger allowlist items from migration
const allowlistMatch = migrationSql.match(
  /IF\s+NEW\.event_type\s+NOT\s+IN\s*\(([\s\S]*?)\)\s*THEN/i
);
assert(
  allowlistMatch !== null,
  '1.2: Migration defines explicit positive event_type allowlist in trg_fn_enforce_custody_insert_integrity'
);

const permittedInMigration = Array.from(
  (allowlistMatch?.[1] || '').matchAll(/'([a-z_]+)'/g)
).map((m) => m[1]);

const requiredAdditions = [
  'evidence_verified',
  'response_received',
  'followup_letter_generated',
  'filing_ref_recorded',
  'submission_recorded',
];

for (const evType of requiredAdditions) {
  assert(
    permittedInMigration.includes(evType),
    `1.3: Migration allowlist includes '${evType}'`,
    permittedInMigration.includes(evType),
    true
  );
}

// Inspect ALL active frontend component files for createCustodyEvent producers
const componentFiles = [
  'src/components/CaseBuilder.tsx',
  'src/components/SmartCaseMonitoring.tsx',
  'src/components/ResolutionNavigator.tsx',
];

const discoveredFrontendEvents = new Set<string>();
for (const relPath of componentFiles) {
  const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const matches = Array.from(
    src.matchAll(/createCustodyEvent\([\s\S]{0,160}?['"]([a-z_]+)['"]/g)
  );
  for (const m of matches) {
    discoveredFrontendEvents.add(m[1]);
  }
}

assert(
  discoveredFrontendEvents.size >= 10,
  '1.4: Discovered all active frontend createCustodyEvent producers across components',
  discoveredFrontendEvents.size
);

for (const producerEvent of discoveredFrontendEvents) {
  assert(
    permittedInMigration.includes(producerEvent),
    `1.5: Active frontend event '${producerEvent}' is permitted by forward-only migration`,
    permittedInMigration.includes(producerEvent),
    true
  );
}

// Ensure internal system/pipeline event types remain restricted
const strictlySystemEvents = [
  'ocr_processed',
  'entity_extracted',
  'claim_mapped',
  'readiness_assessed',
  'authority_recommended',
  'response_analyzed',
  'escalation_evaluated',
  'dossier_generated',
];

for (const sysEvent of strictlySystemEvents) {
  assert(
    !permittedInMigration.includes(sysEvent),
    `1.6: Internal system event '${sysEvent}' remains blocked for client inserts`,
    permittedInMigration.includes(sysEvent),
    false
  );
}

// Security invariants preserved in migration SQL
assert(
  migrationSql.includes("NEW.server_timestamp := clock_timestamp();") &&
    migrationSql.includes("NEW.user_id := auth.uid();") &&
    migrationSql.includes("NEW.actor := 'Citizen (Browser Session)';"),
  '1.7: Server timestamp, auth.uid() binding, and client actor anti-spoofing are preserved'
);
assert(
  migrationSql.includes("NEW.event_type IN ('evidence_uploaded', 'evidence_verified') AND NEW.evidence_id IS NULL") &&
    migrationSql.includes("NEW.event_type = 'evidence_verified' AND NEW.file_hash IS NULL"),
  '1.8: evidence_verified requires both evidence_id and cryptographic file_hash'
);
assert(
  migrationSql.includes('SECURITY INVOKER') &&
    migrationSql.includes('SET search_path = public, pg_temp'),
  '1.9: Trigger function keeps SECURITY INVOKER and pinned search_path'
);

// Verify baseline SQL migrations were NOT rewritten
const freshInstallSql = fs.readFileSync(path.join(ROOT, '01_fresh_install.sql'), 'utf8');
assert(
  !freshInstallSql.includes('20261115_permit_frontend_custody_events'),
  '1.10: Existing baseline 01_fresh_install.sql was not rewritten'
);

// ---------------------------------------------------------------------------
// 2. CASE DOSSIER INTEGRITY CLAIM
// ---------------------------------------------------------------------------
console.log('\n--- 2. CaseDossier Integrity Export Accuracy ---');

assert(
  getEvidenceIntegrityTextLabel({
    verifiedOriginal: true,
    hasBlob: true,
    sha256Hash: 'a'.repeat(64),
  }) === 'Verified Original',
  '2.1: verifiedOriginal=true outputs "Verified Original"'
);

const unverifiedWithBlob = getEvidenceIntegrityTextLabel({
  verifiedOriginal: false,
  hasBlob: true,
  sha256Hash: 'b'.repeat(64),
});
assert(
  !unverifiedWithBlob.includes('Verified Original') &&
    unverifiedWithBlob.includes('Unverified'),
  '2.2: verifiedOriginal=false with uploaded blob never claims "Verified Original"',
  unverifiedWithBlob
);

const unverifiedMetadataOnly = getEvidenceIntegrityTextLabel({
  verifiedOriginal: false,
  hasBlob: false,
  sha256Hash: null,
});
assert(
  !unverifiedMetadataOnly.includes('Verified Original') &&
    unverifiedMetadataOnly.includes('Unverified'),
  '2.3: verifiedOriginal=false metadata-only exhibit never claims "Verified Original"',
  unverifiedMetadataOnly
);

const sampleCaseCopy: GrievanceCase = {
  ...INITIAL_CASES[0],
  evidence: [
    {
      ...INITIAL_CASES[0].evidence[0],
      verifiedOriginal: false,
      hasBlob: false,
      sha256Hash: null,
    },
    {
      ...INITIAL_CASES[0].evidence[1],
      verifiedOriginal: false,
      hasBlob: true,
      sha256Hash: 'c'.repeat(64),
    },
  ],
};

const unverifiedDossierTxt = buildCaseDossierText(
  sampleCaseCopy,
  'detailed',
  'Rajesh Joshi'
);

assert(
  !unverifiedDossierTxt.includes('Integrity: Verified Original'),
  '2.4: buildCaseDossierText omits "Integrity: Verified Original" when no exhibit is verified'
);
assert(
  !unverifiedDossierTxt.includes('SHA-256 Digest: null'),
  '2.5: buildCaseDossierText formats null SHA-256 hash cleanly without literal "null"'
);
assert(
  unverifiedDossierTxt.includes('SHA-256 Digest: None (Metadata Only)'),
  '2.6: buildCaseDossierText states None (Metadata Only) when sha256Hash is null'
);

const mixedCaseCopy: GrievanceCase = {
  ...sampleCaseCopy,
  evidence: [
    {
      ...sampleCaseCopy.evidence[0],
      verifiedOriginal: true,
      hasBlob: true,
      sha256Hash: 'd'.repeat(64),
    },
    sampleCaseCopy.evidence[1],
  ],
};
const mixedDossierTxt = buildCaseDossierText(
  mixedCaseCopy,
  'simple',
  'Rajesh Joshi'
);
assert(
  mixedDossierTxt.includes('Integrity: Verified Original') &&
    mixedDossierTxt.includes('Integrity: Unverified (Client SHA-256 Recorded; Pending Server Verification)'),
  '2.7: buildCaseDossierText distinguishes verifiedOriginal=true and verifiedOriginal=false per exhibit'
);

// ---------------------------------------------------------------------------
// 3. LEGAL RAG TAB PERSISTENCE
// ---------------------------------------------------------------------------
console.log('\n--- 3. Legal RAG Tab Persistence ---');

localStorage.clear();
savePersistedTab('legal_rag');
assert(
  localStorage.getItem(ACTIVE_TAB_KEY) === 'legal_rag',
  '3.1: savePersistedTab("legal_rag") stores "legal_rag"'
);
assert(
  getPersistedTab() === 'legal_rag',
  '3.2: getPersistedTab() restores "legal_rag" instead of falling back to "overview"',
  getPersistedTab(),
  'legal_rag'
);

savePersistedTab('cases');
assert(
  getPersistedTab() === 'my_cases',
  '3.3: Existing legacy "cases" normalization remains intact'
);

localStorage.setItem(ACTIVE_TAB_KEY, 'unknown_tab_xyz');
assert(
  getPersistedTab() === 'overview',
  '3.4: Unknown tabs still safely fall back to "overview"'
);

// ---------------------------------------------------------------------------
// 4. SMART CASE MONITORING ALERTS
// ---------------------------------------------------------------------------
console.log('\n--- 4. SmartCaseMonitoring Alert Removal & Inline Validation ---');

const monitoringSrc = fs.readFileSync(
  path.join(ROOT, 'src/components/SmartCaseMonitoring.tsx'),
  'utf8'
);

const alertMatches = monitoringSrc.match(/\b(?:window\.)?alert\s*\(/g) || [];
assert(
  alertMatches.length === 0,
  '4.1: SmartCaseMonitoring.tsx contains zero alert() or window.alert() calls',
  alertMatches.length,
  0
);

assert(
  validateResponseAttachmentDownload({ storageRef: undefined }) ===
    'This response record was created locally and does not have a private cloud storage reference.',
  '4.2: Missing storageRef returns descriptive inline notice message'
);
assert(
  validateResponseAttachmentDownload({ storageRef: 'user/case/resp/file.pdf' }) === null,
  '4.3: Present storageRef passes download pre-check'
);

assert(
  validateResponseSubmissionInput({
    responseText: '   ',
    hasFile: false,
    hasUploadedAttachment: false,
    caseId: 'NS-2026-0001',
  }) === 'Please provide response text or select a response document file.',
  '4.4: Empty response input returns inline validation error'
);

assert(
  validateResponseSubmissionInput({
    responseText: 'Official reply attached.',
    hasFile: false,
    hasUploadedAttachment: false,
    caseId: ' ',
  }) === 'Cannot attach response: no active parent case ID found.',
  '4.5: Missing caseId returns inline validation error'
);

assert(
  validateResponseSubmissionInput({
    responseText: '',
    hasFile: true,
    hasUploadedAttachment: false,
    caseId: 'NS-2026-0001',
  }) === null,
  '4.6: Valid file-based response passes validation cleanly'
);

console.log('\n======================================================');
console.log(`Phase 1A Summary: ${passedCount} passed, ${failedCount} failed.`);
console.log('======================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
