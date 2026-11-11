import { INITIAL_CASES } from '../src/sampleData';
import {
  GrievanceCase,
  EvidenceItem,
  TimelineEvent,
  CustodyEvent,
  CaseMonitoringData,
  NavigatorSession,
} from '../src/types';
import {
  assertValidUserUuid,
  assertValidUserId,
  assertValidCaseId,
  parseFormattedSizeToBytes,
  formatByteSize,
  normalizeSha256Hash,
  caseToRow,
  rowToCase,
  evidenceToRow,
  rowToEvidence,
  timelineToRow,
  rowToTimeline,
  custodyToRow,
  rowToCustody,
  monitoringToRow,
  rowToMonitoring,
  navigatorSessionToRow,
  rowToNavigatorSession,
} from '../src/utils/caseMappers';

console.log('=== NivaranSetu Supabase Case Mappers Test Suite ===\n');

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

const TEST_USER_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const TEST_VALID_HASH = 'a'.repeat(64);

// -------------------------------------------------------------
// SECTION 1: Security & Helper Assertions
// -------------------------------------------------------------
console.log('--- SECTION 1: Security & Helper Assertions ---');

// assertValidUserUuid / assertValidUserId
let caughtInvalidUser = false;
try {
  assertValidUserUuid('not-a-uuid');
} catch {
  caughtInvalidUser = true;
}
assert(caughtInvalidUser, 'assertValidUserUuid rejects non-UUID string format');

let caughtEmptyUser = false;
try {
  assertValidUserUuid('');
} catch {
  caughtEmptyUser = true;
}
assert(caughtEmptyUser, 'assertValidUserUuid rejects empty string');

const validUser = assertValidUserUuid(TEST_USER_ID);
assert(validUser === TEST_USER_ID, 'assertValidUserUuid returns trimmed valid UUID format', validUser, TEST_USER_ID);
assert(assertValidUserId === assertValidUserUuid, 'assertValidUserId is an alias of assertValidUserUuid');

// assertValidCaseId
let caughtEmptyCase = false;
try {
  assertValidCaseId('   ');
} catch {
  caughtEmptyCase = true;
}
assert(caughtEmptyCase, 'assertValidCaseId rejects empty/whitespace caseId');

// normalizeSha256Hash
assert(normalizeSha256Hash(null) === null, 'normalizeSha256Hash(null) returns null');
assert(normalizeSha256Hash('') === null, 'normalizeSha256Hash("") returns null');
assert(normalizeSha256Hash('   ') === null, 'normalizeSha256Hash("   ") returns null');
assert(normalizeSha256Hash('invalid-hash') === null, 'normalizeSha256Hash("invalid-hash") returns null');
assert(
  normalizeSha256Hash('E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855') ===
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'normalizeSha256Hash lowercases and trims valid 64-char hex'
);

// parseFormattedSizeToBytes & formatByteSize
assert(parseFormattedSizeToBytes('1.4 MB') === 1468006, 'parseFormattedSizeToBytes("1.4 MB") returns 1468006');
assert(parseFormattedSizeToBytes('480 KB') === 491520, 'parseFormattedSizeToBytes("480 KB") returns 491520');
assert(parseFormattedSizeToBytes('1024 B') === 1024, 'parseFormattedSizeToBytes("1024 B") returns 1024');
assert(parseFormattedSizeToBytes('0 B') === 0, 'parseFormattedSizeToBytes("0 B") returns 0');
assert(parseFormattedSizeToBytes('') === 0, 'parseFormattedSizeToBytes("") returns 0');
assert(formatByteSize(1024) === '1 KB', 'formatByteSize(1024) returns 1 KB');
assert(formatByteSize(1468006) === '1.4 MB', 'formatByteSize(1468006) returns 1.4 MB');

// -------------------------------------------------------------
// SECTION 2: GrievanceCase Mappings
// -------------------------------------------------------------
console.log('\n--- SECTION 2: GrievanceCase Mappings ---');

const sampleCase = INITIAL_CASES[0];
const caseRow = caseToRow(sampleCase, TEST_USER_ID);

assert(caseRow.user_id === TEST_USER_ID, 'caseRow.user_id matches authenticated UUID', caseRow.user_id, TEST_USER_ID);
assert(caseRow.id === sampleCase.id, 'caseRow.id matches domain case id', caseRow.id, sampleCase.id);
assert(caseRow.title === sampleCase.title, 'caseRow.title matches domain title');
assert(caseRow.category === sampleCase.category, 'caseRow.category matches domain category');
assert(caseRow.stage === sampleCase.stage, 'caseRow.stage matches domain stage');
assert(caseRow.status === sampleCase.status, 'caseRow.status matches domain status');
assert(caseRow.is_sample_data === true, 'caseRow.is_sample_data preserves sample classification');
assert(caseRow.incident_date === sampleCase.incidentDate, 'caseRow.incident_date matches');
assert(caseRow.disputed_amount === sampleCase.disputedAmount, 'caseRow.disputed_amount matches');
assert(caseRow.currency === sampleCase.currency, 'caseRow.currency matches');
assert(caseRow.readiness_score === sampleCase.readinessScore, 'caseRow.readiness_score matches');
assert(Array.isArray(caseRow.missing_elements), 'caseRow.missing_elements is an array');

// Round-trip case
const reconstructedCase = rowToCase(caseRow);
assert(reconstructedCase.id === sampleCase.id, 'Round-trip case id matches');
assert(reconstructedCase.title === sampleCase.title, 'Round-trip case title matches');
assert(reconstructedCase.category === sampleCase.category, 'Round-trip case category matches');
assert(reconstructedCase.disputedAmount === sampleCase.disputedAmount, 'Round-trip disputedAmount matches');
assert(reconstructedCase.isSampleData === true, 'Round-trip isSampleData preserved');

// Minimal / Citizen Case (non-sample)
const citizenCase: GrievanceCase = {
  id: 'case-user-999',
  title: 'Delayed Broadband Refund',
  category: 'telecom_isp',
  stage: 'drafting',
  status: 'active',
  isSampleData: false,
  lastUpdated: new Date().toISOString(),
  incidentDate: '',
  incidentLocation: '',
  involvedEntity: 'Telecom Co',
  disputedAmount: undefined,
  currency: 'INR',
  description: 'Deposit not refunded after router return.',
  simpleSummary: 'Broadband deposit dispute',
  readinessScore: 35,
  readinessBreakdown: {
    evidenceCompleteness: 10,
    timelineClarity: 15,
    identityProof: 10,
    formalNoticeSent: 0,
  },
  recommendedAuthority: {
    name: 'TRAI / DoT Portal',
    portalName: 'National Consumer Helpline',
    portalUrl: 'https://consumerhelpline.gov.in',
    filingFee: 'Free',
    averageResolutionTime: '15-30 days',
  },
  timeline: [],
  evidence: [],
  missingElements: ['Return receipt'],
  complaintDraft: {
    subject: 'Refund of security deposit',
    formalBody: 'Dear Officer, ...',
    simpleBody: 'Please return my ₹1,500 deposit.',
    reliefSought: 'Immediate refund',
  },
  custodyEvents: [],
};

const citizenRow = caseToRow(citizenCase, TEST_USER_ID);
assert(citizenRow.is_sample_data === false, 'Citizen case produces is_sample_data = false');
assert(citizenRow.incident_date === null, 'Empty incidentDate normalized to null in row');
assert(citizenRow.disputed_amount === null, 'Undefined disputedAmount normalized to null in row');

const reconstructedCitizen = rowToCase(citizenRow);
assert(reconstructedCitizen.isSampleData === false, 'Reconstructed citizen case has isSampleData = false');
assert(reconstructedCitizen.incidentDate === '', 'Row null incident_date converted to empty string in frontend');
assert(reconstructedCitizen.disputedAmount === undefined, 'Row null disputed_amount converted to undefined in frontend');

// -------------------------------------------------------------
// SECTION 3: EvidenceItem Mappings & Integrity Constraints
// -------------------------------------------------------------
console.log('\n--- SECTION 3: EvidenceItem Mappings ---');

// 3A: Synthetic Demo Evidence (Truthful: hasBlob = false, hash = null)
const syntheticItem = sampleCase.evidence[0];
const syntheticRow = evidenceToRow(syntheticItem, TEST_USER_ID, sampleCase.id);

assert(syntheticRow.user_id === TEST_USER_ID, 'syntheticRow.user_id matches authenticated UUID');
assert(syntheticRow.case_id === sampleCase.id, 'syntheticRow.case_id matches');
assert(syntheticRow.id === syntheticItem.id, 'syntheticRow.id matches');
assert(syntheticRow.has_blob === false, 'syntheticRow.has_blob is strictly false');
assert(syntheticRow.sha256_hash === null, 'syntheticRow.sha256_hash is strictly null');
assert(syntheticRow.storage_ref === null, 'syntheticRow.storage_ref is strictly null');
assert(syntheticRow.verified_original === false, 'syntheticRow.verified_original is strictly false');
assert(syntheticRow.file_size_bytes > 0, 'syntheticRow.file_size_bytes parsed from formatted size', syntheticRow.file_size_bytes);

// chk_evidence_blob_hash_integrity verification for synthetic row:
// (has_blob = FALSE AND storage_ref IS NULL AND verified_original = FALSE AND sha256_hash IS NULL)
const syntheticCheckPasses =
  syntheticRow.has_blob === false &&
  syntheticRow.storage_ref === null &&
  syntheticRow.verified_original === false &&
  syntheticRow.sha256_hash === null;
assert(syntheticCheckPasses, 'syntheticRow strictly satisfies chk_evidence_blob_hash_integrity (synthetic branch)');

// 3B: Uploaded Binary Evidence (hasBlob = true, storageRef set, hash set)
const uploadedItem: EvidenceItem = {
  id: 'ev-upload-001',
  title: 'Passbook Photo',
  category: 'bank_statement',
  fileName: 'passbook.jpg',
  fileSize: '2.5 MB',
  fileSizeBytes: 2621440,
  fileType: 'image/jpeg',
  uploadDate: '2026-11-05',
  sha256Hash: TEST_VALID_HASH,
  storageRef: `${TEST_USER_ID}/NS-2026-0842/ev-upload-001/passbook.jpg`,
  hasBlob: true,
  ocrExtracted: {
    dates: ['2026-11-01'],
    amounts: ['50000.00'],
    identifiers: ['TXN-998811'],
    parties: ['Apex Bank'],
    summary: 'Bank passbook page',
  },
  verifiedOriginal: true,
};

const uploadedRow = evidenceToRow(uploadedItem, TEST_USER_ID, sampleCase.id);
assert(uploadedRow.has_blob === true, 'uploadedRow.has_blob is true');
assert(uploadedRow.sha256_hash === TEST_VALID_HASH, 'uploadedRow.sha256_hash preserved');
assert(uploadedRow.storage_ref === uploadedItem.storageRef, 'uploadedRow.storage_ref preserved');
assert(uploadedRow.file_size_bytes === 2621440, 'uploadedRow.file_size_bytes preserved from fileSizeBytes');
assert(uploadedRow.verified_original === true, 'uploadedRow.verified_original preserved');

// chk_evidence_blob_hash_integrity verification for uploaded row:
// (has_blob = TRUE AND storage_ref IS NOT NULL AND sha256_hash IS NOT NULL)
const uploadedCheckPasses =
  uploadedRow.has_blob === true && uploadedRow.storage_ref !== null && uploadedRow.sha256_hash !== null;
assert(uploadedCheckPasses, 'uploadedRow strictly satisfies chk_evidence_blob_hash_integrity (binary branch)');

// 3C: Strict Evidence Integrity Rejection: Incomplete binary items MUST be rejected (never silently converted to synthetic)
let caughtMissingStorageRef = false;
try {
  evidenceToRow(
    {
      ...uploadedItem,
      storageRef: undefined, // hasBlob=true but missing storageRef
    },
    TEST_USER_ID,
    sampleCase.id
  );
} catch (err: any) {
  caughtMissingStorageRef = err.message.includes('EVIDENCE_INTEGRITY_VIOLATION');
}
assert(caughtMissingStorageRef, 'evidenceToRow strictly rejects hasBlob=true with missing storageRef');

let caughtMissingHash = false;
try {
  evidenceToRow(
    {
      ...uploadedItem,
      sha256Hash: null, // hasBlob=true but missing sha256Hash
    },
    TEST_USER_ID,
    sampleCase.id
  );
} catch (err: any) {
  caughtMissingHash = err.message.includes('EVIDENCE_INTEGRITY_VIOLATION');
}
assert(caughtMissingHash, 'evidenceToRow strictly rejects hasBlob=true with null sha256Hash');

let caughtEmptyHash = false;
try {
  evidenceToRow(
    {
      ...uploadedItem,
      sha256Hash: '   ', // hasBlob=true but whitespace sha256Hash
    },
    TEST_USER_ID,
    sampleCase.id
  );
} catch (err: any) {
  caughtEmptyHash = err.message.includes('EVIDENCE_INTEGRITY_VIOLATION');
}
assert(caughtEmptyHash, 'evidenceToRow strictly rejects hasBlob=true with whitespace sha256Hash');

let caughtInvalidHexHash = false;
try {
  evidenceToRow(
    {
      ...uploadedItem,
      sha256Hash: 'invalid-non-hex-hash', // hasBlob=true but invalid hex
    },
    TEST_USER_ID,
    sampleCase.id
  );
} catch (err: any) {
  caughtInvalidHexHash = err.message.includes('EVIDENCE_INTEGRITY_VIOLATION');
}
assert(caughtInvalidHexHash, 'evidenceToRow strictly rejects hasBlob=true with invalid non-hex sha256Hash');

// 3D: Round-trip evidence conversions
const reconSynthetic = rowToEvidence(syntheticRow);
assert(reconSynthetic.id === syntheticItem.id, 'reconSynthetic.id matches');
assert(reconSynthetic.sha256Hash === null, 'reconSynthetic.sha256Hash is null');
assert(reconSynthetic.hasBlob === false, 'reconSynthetic.hasBlob is false');

const reconUploaded = rowToEvidence(uploadedRow);
assert(reconUploaded.id === uploadedItem.id, 'reconUploaded.id matches');
assert(reconUploaded.sha256Hash === TEST_VALID_HASH, 'reconUploaded.sha256Hash matches');
assert(reconUploaded.hasBlob === true, 'reconUploaded.hasBlob is true');
assert(reconUploaded.fileSizeBytes === 2621440, 'reconUploaded.fileSizeBytes matches');

// -------------------------------------------------------------
// SECTION 4: TimelineEvent Mappings
// -------------------------------------------------------------
console.log('\n--- SECTION 4: TimelineEvent Mappings ---');

const sampleTimeline = sampleCase.timeline[0];
const timelineRow = timelineToRow(sampleTimeline, TEST_USER_ID, sampleCase.id);

assert(timelineRow.user_id === TEST_USER_ID, 'timelineRow.user_id matches authenticated UUID');
assert(timelineRow.case_id === sampleCase.id, 'timelineRow.case_id matches');
assert(timelineRow.id === sampleTimeline.id, 'timelineRow.id matches');
assert(timelineRow.date === sampleTimeline.date, 'timelineRow.date matches');
assert(timelineRow.title === sampleTimeline.title, 'timelineRow.title matches');
assert(timelineRow.evidence_id === sampleTimeline.evidenceId, 'timelineRow.evidence_id matches');
assert(timelineRow.verified_by_doc === sampleTimeline.verifiedByDoc, 'timelineRow.verified_by_doc matches');

const reconTimeline = rowToTimeline(timelineRow);
assert(reconTimeline.id === sampleTimeline.id, 'reconTimeline.id matches');
assert(reconTimeline.evidenceId === sampleTimeline.evidenceId, 'reconTimeline.evidenceId matches');
assert(reconTimeline.verifiedByDoc === sampleTimeline.verifiedByDoc, 'reconTimeline.verifiedByDoc matches');

// Timeline with null evidenceId
const timelineNullEvidence: TimelineEvent = {
  id: 'tl-null-1',
  date: '2026-11-02',
  title: 'Verbal conversation with manager',
  description: 'Branch manager promised callback in 48 hours',
  evidenceId: null,
  verifiedByDoc: false,
};
const tlNullRow = timelineToRow(timelineNullEvidence, TEST_USER_ID, sampleCase.id);
assert(tlNullRow.evidence_id === null, 'timelineRow.evidence_id correctly set to null');
const reconNullTl = rowToTimeline(tlNullRow);
assert(reconNullTl.evidenceId === null, 'reconNullTl.evidenceId round-trips to null');

// -------------------------------------------------------------
// SECTION 5: CustodyEvent Mappings
// -------------------------------------------------------------
console.log('\n--- SECTION 5: CustodyEvent Mappings ---');

const sampleCustody = sampleCase.custodyEvents[0];
const custodyRow = custodyToRow(sampleCustody, TEST_USER_ID);

assert(custodyRow.user_id === TEST_USER_ID, 'custodyRow.user_id matches authenticated UUID');
assert(custodyRow.case_id === sampleCase.id, 'custodyRow.case_id matches');
assert(custodyRow.id === sampleCustody.id, 'custodyRow.id matches');
assert(custodyRow.event_type === sampleCustody.eventType, 'custodyRow.event_type matches');
assert(custodyRow.action === sampleCustody.action, 'custodyRow.action matches');
assert(custodyRow.actor === sampleCustody.actor, 'custodyRow.actor matches');
assert(custodyRow.file_hash === null, 'custodyRow.file_hash preserves null for synthetic event');

const reconCustody = rowToCustody(custodyRow);
assert(reconCustody.id === sampleCustody.id, 'reconCustody.id matches');
assert(reconCustody.eventType === sampleCustody.eventType, 'reconCustody.eventType matches');
assert(reconCustody.fileHash === null, 'reconCustody.fileHash round-trips to null');

// Real uploaded custody event with genuine fileHash
const uploadedCustody: CustodyEvent = {
  id: 'ev-cust-real-1',
  caseId: sampleCase.id,
  evidenceId: 'ev-upload-001',
  eventType: 'evidence_uploaded',
  action: 'Evidence Ingestion: passbook.jpg',
  actor: 'Citizen (Browser Session)',
  timestamp: '2026-11-05 10:00:00 UTC',
  details: 'Calculated SHA-256 fingerprint',
  fileHash: TEST_VALID_HASH,
};
const uploadedCustodyRow = custodyToRow(uploadedCustody, TEST_USER_ID);
assert(uploadedCustodyRow.file_hash === TEST_VALID_HASH, 'uploadedCustodyRow.file_hash preserves valid hash');
const reconUploadedCustody = rowToCustody(uploadedCustodyRow);
assert(reconUploadedCustody.fileHash === TEST_VALID_HASH, 'reconUploadedCustody.fileHash round-trips to valid hash');

// Empty string hash normalized to null
const emptyHashCustody: CustodyEvent = {
  ...uploadedCustody,
  fileHash: '',
};
const emptyHashCustodyRow = custodyToRow(emptyHashCustody, TEST_USER_ID);
assert(emptyHashCustodyRow.file_hash === null, 'Empty string fileHash in custody event normalized to null');

// -------------------------------------------------------------
// SECTION 6: CaseMonitoringData Mappings
// -------------------------------------------------------------
console.log('\n--- SECTION 6: CaseMonitoringData Mappings ---');

const sampleMonitoring = sampleCase.monitoring!;
const monitoringRow = monitoringToRow(sampleMonitoring, TEST_USER_ID, sampleCase.id);

assert(monitoringRow.user_id === TEST_USER_ID, 'monitoringRow.user_id matches authenticated UUID');
assert(monitoringRow.case_id === sampleCase.id, 'monitoringRow.case_id matches');
assert(monitoringRow.citizen_reported_status === sampleMonitoring.citizenReportedStatus, 'monitoringRow.citizen_reported_status matches');
assert(monitoringRow.statutory_deadline_days === sampleMonitoring.statutoryDeadlineDays, 'monitoringRow.statutory_deadline_days matches');
assert(monitoringRow.docket_number === sampleMonitoring.docketNumber, 'monitoringRow.docket_number matches');
assert(Array.isArray(monitoringRow.reminders), 'monitoringRow.reminders is an array');
assert(Array.isArray(monitoringRow.responses), 'monitoringRow.responses is an array');
assert(Array.isArray(monitoringRow.generated_letters), 'monitoringRow.generated_letters is an array');

const reconMonitoring = rowToMonitoring(monitoringRow);
assert(reconMonitoring.citizenReportedStatus === sampleMonitoring.citizenReportedStatus, 'reconMonitoring status matches');
assert(reconMonitoring.statutoryDeadlineDays === sampleMonitoring.statutoryDeadlineDays, 'reconMonitoring statutoryDeadlineDays matches');
assert(reconMonitoring.docketNumber === sampleMonitoring.docketNumber, 'reconMonitoring docketNumber matches');
assert(reconMonitoring.reminders.length === sampleMonitoring.reminders.length, 'reconMonitoring reminders count matches');
assert(reconMonitoring.responses.length === sampleMonitoring.responses.length, 'reconMonitoring responses count matches');

// Minimal Monitoring Data
const minimalMonitoring: CaseMonitoringData = {
  citizenReportedStatus: 'not_submitted',
  statutoryDeadlineDays: 30,
  reminders: [],
  responses: [],
  generatedLetters: [],
};
const minimalMonitoringRow = monitoringToRow(minimalMonitoring, TEST_USER_ID, 'case-minimal');
assert(minimalMonitoringRow.citizen_reported_status === 'not_submitted', 'minimalMonitoringRow status is not_submitted');
assert(minimalMonitoringRow.statutory_deadline_days === 30, 'minimalMonitoringRow default days is 30');
assert(minimalMonitoringRow.submission_date === null, 'minimalMonitoringRow submission_date is null');

// -------------------------------------------------------------
// SECTION 7: NavigatorSession Mappings
// -------------------------------------------------------------
console.log('\n--- SECTION 7: NavigatorSession Mappings ---');

const navSession: NavigatorSession = {
  caseId: sampleCase.id,
  guideId: 'guide-banking-rbi-cms',
  currentStep: 4,
  ackNumber: 'RBI/2026/CMS-098214',
  ackFilingDate: '2026-11-04',
  savedAt: '2026-11-04T12:00:00.000Z',
};

const navRow = navigatorSessionToRow(navSession, TEST_USER_ID);
assert(navRow.user_id === TEST_USER_ID, 'navRow.user_id matches authenticated UUID');
assert(navRow.case_id === navSession.caseId, 'navRow.case_id matches');
assert(navRow.guide_id === navSession.guideId, 'navRow.guide_id matches');
assert(navRow.current_step === 4, 'navRow.current_step matches');
assert(navRow.ack_number === navSession.ackNumber, 'navRow.ack_number matches');

const reconNav = rowToNavigatorSession(navRow);
assert(reconNav.caseId === navSession.caseId, 'reconNav.caseId matches');
assert(reconNav.guideId === navSession.guideId, 'reconNav.guideId matches');
assert(reconNav.currentStep === navSession.currentStep, 'reconNav.currentStep matches');
assert(reconNav.ackNumber === navSession.ackNumber, 'reconNav.ackNumber matches');

// Clamping currentStep to 1-8 (SQL check constraint chk_navigator_sessions_step_range)
const underStepSession = { ...navSession, currentStep: 0 };
const underStepRow = navigatorSessionToRow(underStepSession, TEST_USER_ID);
assert(underStepRow.current_step === 1, 'Step 0 clamped to 1', underStepRow.current_step, 1);

const overStepSession = { ...navSession, currentStep: 15 };
const overStepRow = navigatorSessionToRow(overStepSession, TEST_USER_ID);
assert(overStepRow.current_step === 8, 'Step 15 clamped to 8', overStepRow.current_step, 8);

// -------------------------------------------------------------
// SECTION 8: All 4 Canonical Scenarios Full Round-Trip Integrity
// -------------------------------------------------------------
console.log('\n--- SECTION 8: Canonical Demo Scenarios Round-Trip ---');

INITIAL_CASES.forEach((canonicalCase, index) => {
  const cRow = caseToRow(canonicalCase, TEST_USER_ID);
  const evRows = canonicalCase.evidence.map((ev) => evidenceToRow(ev, TEST_USER_ID, canonicalCase.id));
  const tlRows = canonicalCase.timeline.map((tl) => timelineToRow(tl, TEST_USER_ID, canonicalCase.id));
  const custRows = canonicalCase.custodyEvents.map((ce) => custodyToRow(ce, TEST_USER_ID));
  const monRow = canonicalCase.monitoring ? monitoringToRow(canonicalCase.monitoring, TEST_USER_ID, canonicalCase.id) : undefined;

  // Reconstruct
  const reconstructed = rowToCase(cRow, {
    evidence: evRows.map(rowToEvidence),
    timeline: tlRows.map(rowToTimeline),
    custodyEvents: custRows.map(rowToCustody),
    monitoring: monRow ? rowToMonitoring(monRow) : undefined,
  });

  assert(reconstructed.id === canonicalCase.id, `Scenario ${index + 1} (${canonicalCase.id}) ID preserved`);
  assert(reconstructed.title === canonicalCase.title, `Scenario ${index + 1} Title preserved`);
  assert(reconstructed.evidence.length === canonicalCase.evidence.length, `Scenario ${index + 1} Exhibit count matches (${canonicalCase.evidence.length})`);
  assert(reconstructed.timeline.length === canonicalCase.timeline.length, `Scenario ${index + 1} Timeline count matches (${canonicalCase.timeline.length})`);
  assert(reconstructed.custodyEvents.length === canonicalCase.custodyEvents.length, `Scenario ${index + 1} Custody count matches (${canonicalCase.custodyEvents.length})`);

  // Assert all reconstructed exhibits preserve null hashes
  reconstructed.evidence.forEach((ev, evIdx) => {
    assert(ev.sha256Hash === null, `Scenario ${index + 1} Exhibit ${evIdx + 1} sha256Hash is null`);
    assert(ev.hasBlob === false, `Scenario ${index + 1} Exhibit ${evIdx + 1} hasBlob is false`);
    assert(ev.verifiedOriginal === false, `Scenario ${index + 1} Exhibit ${evIdx + 1} verifiedOriginal is false`);
  });
});

console.log(`\n======================================================`);
console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
console.log(`======================================================\n`);

if (failedCount > 0) {
  process.exit(1);
}
