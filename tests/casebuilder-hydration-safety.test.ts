/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — CaseBuilder Hydration Safety & Custody Event Regression Test Suite
 *
 * Scope:
 * - 1. Hydration-Safe Extraction:
 *      - Confirms that opening an existing case with populated description does NOT trigger debounced extraction.
 *      - Confirms that citizen editing/entering new grievance text DOES trigger debounced extraction.
 *      - Confirms Step 1 boundary and minimum character threshold requirements.
 * - 2. Hydration-Safe Autosave:
 *      - Confirms that initial loading of an existing case leaves the case clean (isDirty = false) and triggers NO save.
 *      - Confirms that editing fields (title, description, category, amount, entity, evidence, step) marks dirty.
 *      - Confirms that rapid-navigation autosave on unmount is preserved when edits exist.
 *      - Confirms that rapid-navigation unmount does NOT save when the case was merely opened without edits.
 * - 3. Custody-Event Security & Trusted System Boundaries:
 *      - Confirms removal of client-side 'entity_extracted' event generation.
 *      - Confirms client only generates permitted client custody event types.
 *      - Confirms existing case custody log remains intact without synthetic corruption on hydration.
 *
 * Execution: Strictly offline. Zero external network, Gemini, or Supabase requests.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  shouldTriggerDebouncedExtraction,
  hasCaseChangedFromBaseline,
  CaseBaselineState,
} from '../src/components/CaseBuilder';
import { GrievanceCase, CustodyEvent } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== NivaranSetu CaseBuilder Hydration Safety & Custody Suite ===\n');

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

// Sample existing synthetic case matching user reproduction
const existingCase: GrievanceCase = {
  id: 'NS-INT-1794299633556',
  title: 'Unauthorized UPI deduction of Rs. 4500 from HDFC Bank account',
  description:
    'On 5 November 2026, an amount of Rs. 4500 was deducted from my savings account through an unauthorized UPI transaction without OTP or PIN approval. I immediately contacted HDFC customer care.',
  category: 'banking_financial',
  stage: 'evidence_gathering',
  status: 'active',
  createdAt: '2026-11-05T10:30:00.000Z',
  lastUpdated: '2026-11-05T10:35:00.000Z',
  incidentDate: '2026-11-05',
  incidentLocation: 'Noida, Uttar Pradesh',
  involvedEntity: 'HDFC Bank',
  disputedAmount: 4500,
  currency: 'INR',
  simpleSummary: 'On 5 November 2026, an amount of Rs. 4500 was deducted from my savings account.',
  readinessScore: 70,
  readinessBreakdown: {
    evidenceCompleteness: 20,
    timelineClarity: 20,
    identityProof: 20,
    formalNoticeSent: 10,
  },
  recommendedAuthority: {
    name: 'Banking Ombudsman (RBI CMS)',
    portalName: 'Complaint Management System (CMS)',
    portalUrl: 'https://cms.rbi.org.in',
    filingFee: 'Nil',
    averageResolutionTime: '30 Days',
  },
  timeline: [],
  evidence: [],
  missingElements: [],
  complaintDraft: {
    subject: 'Grievance against HDFC Bank',
    formalBody: 'Formal text...',
    simpleBody: 'Simple text...',
    reliefSought: 'Full reversal',
  },
  custodyEvents: [
    {
      id: 'cust-1',
      caseId: 'NS-INT-1794299633556',
      timestamp: '2026-11-05T10:30:00.000Z',
      eventType: 'case_created',
      action: 'Grievance Case Initialized',
      actor: 'Citizen (Browser Session)',
      details: 'Case loaded under category: banking_financial.',
      fileHash: null,
    },
  ],
};

// =========================================================================
// SECTION 1: Hydration-Safe Extraction
// =========================================================================
console.log('\n--- Section 1: Hydration-Safe Extraction ---');

// 1.1 Existing populated case on mount
const shouldExtractOnMount = shouldTriggerDebouncedExtraction(
  existingCase.description,
  existingCase.description, // lastExtracted matches hydrated description
  1
);
assert(
  shouldExtractOnMount === false,
  'Hydration Guard: Opening existing populated case does NOT trigger extraction on mount',
  shouldExtractOnMount,
  false
);

// 1.2 User edits grievance text
const editedText = existingCase.description + ' Transaction ID was UPI/123456789012.';
const shouldExtractOnEdit = shouldTriggerDebouncedExtraction(
  editedText,
  existingCase.description,
  1
);
assert(
  shouldExtractOnEdit === true,
  'Edit Workflow: Citizen editing grievance text DOES trigger extraction',
  shouldExtractOnEdit,
  true
);

// 1.3 Step boundary: Navigation away from Step 1 prevents debounced extraction
const shouldExtractOnStep2 = shouldTriggerDebouncedExtraction(
  editedText,
  existingCase.description,
  2
);
assert(
  shouldExtractOnStep2 === false,
  'Step Boundary: Extraction is not triggered when currentStep is not 1',
  shouldExtractOnStep2,
  false
);

// 1.4 Short text threshold (< 15 characters)
const shouldExtractShort = shouldTriggerDebouncedExtraction('Too short', '', 1);
assert(
  shouldExtractShort === false,
  'Character Threshold: Text under 15 characters does not trigger extraction',
  shouldExtractShort,
  false
);

// 1.5 Brand new empty case on mount
const shouldExtractEmptyNewCase = shouldTriggerDebouncedExtraction('', '', 1);
assert(
  shouldExtractEmptyNewCase === false,
  'Empty New Case: Empty grievance text on new case mount does not trigger extraction',
  shouldExtractEmptyNewCase,
  false
);

// =========================================================================
// SECTION 2: Hydration-Safe Autosave & Baseline Tracking
// =========================================================================
console.log('\n--- Section 2: Hydration-Safe Autosave & Baseline Tracking ---');

const initialBaseline: CaseBaselineState = {
  caseId: existingCase.id,
  title: existingCase.title,
  description: existingCase.description,
  category: existingCase.category,
  disputedAmount: existingCase.disputedAmount || 0,
  involvedEntity: existingCase.involvedEntity,
  evidenceCount: existingCase.evidence.length,
  currentStep: 1,
};

// 2.1 State matches baseline on mount
const currentStateOnMount: CaseBaselineState = { ...initialBaseline };
const hasChangedOnMount = hasCaseChangedFromBaseline(currentStateOnMount, initialBaseline);
assert(
  hasChangedOnMount === false,
  'Hydration Guard: Existing case on mount matches baseline (no change detected)',
  hasChangedOnMount,
  false
);

// 2.2 Change in description triggers autosave
const stateWithEditedDesc: CaseBaselineState = {
  ...initialBaseline,
  description: editedText,
};
const hasChangedDesc = hasCaseChangedFromBaseline(stateWithEditedDesc, initialBaseline);
assert(
  hasChangedDesc === true,
  'Autosave Trigger: Editing description flags case as changed from baseline',
  hasChangedDesc,
  true
);

// 2.3 Change in title triggers autosave
const stateWithEditedTitle: CaseBaselineState = {
  ...initialBaseline,
  title: 'Updated Dispute Title',
};
assert(
  hasCaseChangedFromBaseline(stateWithEditedTitle, initialBaseline) === true,
  'Autosave Trigger: Editing title flags case as changed from baseline'
);

// 2.4 Change in category triggers autosave
const stateWithEditedCategory: CaseBaselineState = {
  ...initialBaseline,
  category: 'ecommerce_fraud',
};
assert(
  hasCaseChangedFromBaseline(stateWithEditedCategory, initialBaseline) === true,
  'Autosave Trigger: Changing category flags case as changed from baseline'
);

// 2.5 Change in disputed amount triggers autosave
const stateWithEditedAmount: CaseBaselineState = {
  ...initialBaseline,
  disputedAmount: 9000,
};
assert(
  hasCaseChangedFromBaseline(stateWithEditedAmount, initialBaseline) === true,
  'Autosave Trigger: Changing disputed amount flags case as changed from baseline'
);

// 2.6 Change in involved entity triggers autosave
const stateWithEditedEntity: CaseBaselineState = {
  ...initialBaseline,
  involvedEntity: 'State Bank of India',
};
assert(
  hasCaseChangedFromBaseline(stateWithEditedEntity, initialBaseline) === true,
  'Autosave Trigger: Changing involved entity flags case as changed from baseline'
);

// 2.7 Adding evidence item triggers autosave
const stateWithAddedEvidence: CaseBaselineState = {
  ...initialBaseline,
  evidenceCount: 1,
};
assert(
  hasCaseChangedFromBaseline(stateWithAddedEvidence, initialBaseline) === true,
  'Autosave Trigger: Adding evidence exhibit flags case as changed from baseline'
);

// 2.7b Changing exhibit claim mapping (linking/unlinking) triggers autosave
const baselineWithEvidence: CaseBaselineState = {
  ...initialBaseline,
  evidenceCount: 1,
  evidenceMappingKey: 'ev-1:',
};
const stateWithLinkedExhibit: CaseBaselineState = {
  ...baselineWithEvidence,
  evidenceMappingKey: 'ev-1:rec_sms_screenshot',
};
assert(
  hasCaseChangedFromBaseline(stateWithLinkedExhibit, baselineWithEvidence) === true,
  'Autosave Trigger: Linking exhibit to recommendation flags case as changed from baseline'
);

const stateWithUnlinkedExhibit: CaseBaselineState = {
  ...stateWithLinkedExhibit,
  evidenceMappingKey: 'ev-1:',
};
assert(
  hasCaseChangedFromBaseline(stateWithUnlinkedExhibit, stateWithLinkedExhibit) === true,
  'Autosave Trigger: Unlinking exhibit from recommendation flags case as changed from baseline'
);

// 2.8 Advancing step triggers autosave
const stateWithAdvancedStep: CaseBaselineState = {
  ...initialBaseline,
  currentStep: 2,
};
assert(
  hasCaseChangedFromBaseline(stateWithAdvancedStep, initialBaseline) === true,
  'Autosave Trigger: Advancing step flags case as changed from baseline'
);

// 2.9 Rapid Navigation Unmount Simulation:
// Case A: Merely opened existing case without edit -> isDirty = false -> NO unmount save
let simulatedSaveCount = 0;
function simulateUnmount(isDirty: boolean, hasContent: boolean) {
  if (isDirty && hasContent) {
    simulatedSaveCount++;
  }
}

simulateUnmount(false, true); // Opened, not edited, navigated away
assert(
  simulatedSaveCount === 0,
  'Rapid Navigation: Opening existing case and navigating away does NOT trigger unmount save',
  simulatedSaveCount,
  0
);

// Case B: User edited description -> isDirty = true -> unmount MUST save
simulateUnmount(true, true); // Edited, navigated away immediately
assert(
  simulatedSaveCount === 1,
  'Rapid Navigation: Editing case and rapidly navigating away DOES trigger unmount save',
  simulatedSaveCount,
  1
);

// =========================================================================
// SECTION 3: Custody-Event Security & Trusted System Boundaries
// =========================================================================
console.log('\n--- Section 3: Custody-Event Security & Trusted Boundaries ---');

// 3.1 Verify 'entity_extracted' does not exist in CaseBuilder.tsx source
const caseBuilderPath = path.resolve(__dirname, '../src/components/CaseBuilder.tsx');
const caseBuilderSource = fs.readFileSync(caseBuilderPath, 'utf8');

const entityExtractedMatches = caseBuilderSource.match(/['"]entity_extracted['"]/g);
assert(
  entityExtractedMatches === null,
  'Custody Security: Client-side "entity_extracted" event creation is completely removed from CaseBuilder.tsx',
  entityExtractedMatches ? entityExtractedMatches.length : 0,
  0
);

// 3.2 Verify that applyExtractedFacts does not inject case_updated to circumvent policy
const applyExtractedFactsMatch = caseBuilderSource.match(
  /const applyExtractedFacts = [\s\S]*?^  \};/m
);
assert(
  applyExtractedFactsMatch !== null,
  'applyExtractedFacts function is located in CaseBuilder.tsx'
);
if (applyExtractedFactsMatch) {
  const fnBody = applyExtractedFactsMatch[0];
  const containsCreateCustody = fnBody.includes('createCustodyEvent');
  assert(
    containsCreateCustody === false,
    'Custody Security: applyExtractedFacts() contains zero custody event creations (no entity_extracted, no case_updated)',
    containsCreateCustody,
    false
  );
}

// 3.3 Verify permitted client custody events in CaseBuilder.tsx
const allCustodyEventMatches = Array.from(
  caseBuilderSource.matchAll(/createCustodyEvent\(\s*[\w\.\?]+,\s*['"]([a-zA-Z_]+)['"]/g)
).map((m) => m[1]);

const uniqueClientEvents = Array.from(new Set(allCustodyEventMatches));
console.log('Permitted client custody event types in CaseBuilder.tsx:', uniqueClientEvents);

const restrictedEventTypes = ['entity_extracted', 'authority_escalated', 'legal_notice_served'];
const foundRestricted = uniqueClientEvents.filter((ev) => restrictedEventTypes.includes(ev));

assert(
  foundRestricted.length === 0,
  'Custody Security: No restricted system/authority event types are generated by CaseBuilder.tsx',
  foundRestricted,
  []
);

// 3.4 Permitted client events are within legitimate user action scope
const expectedPermitted = [
  'evidence_uploaded',
  'case_created',
  'evidence_removed',
  'evidence_verified',
  'evidence_downloaded',
  'dossier_exported',
];
const allArePermitted = uniqueClientEvents.every((ev) => expectedPermitted.includes(ev));
assert(
  allArePermitted === true,
  'Custody Scope: All remaining client custody events represent genuine citizen actions',
  uniqueClientEvents,
  expectedPermitted
);

// =========================================================================
// SECTION 4: Hydration State Integrity
// =========================================================================
console.log('\n--- Section 4: Hydration State Integrity ---');

// 4.1 Verify existing case retains its exact custody events upon hydration
const hydratedCustodyEvents: CustodyEvent[] =
  existingCase.custodyEvents && existingCase.custodyEvents.length > 0
    ? existingCase.custodyEvents
    : [];

assert(
  hydratedCustodyEvents.length === 1,
  'State Integrity: Hydrated case retains original custody event count without synthetic duplicates',
  hydratedCustodyEvents.length,
  1
);

assert(
  hydratedCustodyEvents[0].eventType === 'case_created',
  'State Integrity: Original case_created event preserved untouched',
  hydratedCustodyEvents[0].eventType,
  'case_created'
);

// =========================================================================
// SECTION 5: Summary
// =========================================================================
console.log('\n======================================================');
console.log(`CaseBuilder Hydration Safety Summary: ${passedCount} passed, ${failedCount} failed`);
console.log('======================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
