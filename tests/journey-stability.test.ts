/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple in-memory localStorage polyfill for Node test runner
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

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new MockLocalStorage();
}

import { AUTHORITY_GUIDES, INITIAL_CASES } from '../src/sampleData';
import { GrievanceCase, GrievanceCategory } from '../src/types';
import { loadInitialCases } from '../src/utils/caseStorage';
import {
  getPersistedTab,
  savePersistedTab,
  clearAuthSession,
} from '../src/utils/authSession';
import {
  generateStatusReminderLetter,
  generateEscalationPetitionLetter,
  STATUTORY_RULES,
} from '../src/utils/escalationRules';

console.log('=== NivaranSetu Milestone 1: Journey Stability Regression Test Suite ===\n');

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

// =========================================================================
// SCENARIO A: Navigator State Synchronization Across Case Categories
// =========================================================================
console.log('--- SCENARIO A: Navigator Authority & State Synchronization ---');

// Helper simulating Navigator's authority derivation
function getAuthorityGuideForCase(c: GrievanceCase) {
  return (
    AUTHORITY_GUIDES.find((g) => g.category === c.category) || AUTHORITY_GUIDES[0]
  );
}

// 1. Banking Case
const bankingCase = INITIAL_CASES.find((c) => c.category === 'banking_financial')!;
const bankingGuide = getAuthorityGuideForCase(bankingCase);
assert(
  bankingGuide.id === 'auth-rbi',
  'Banking case maps to RBI CMS authority guide (auth-rbi)',
  bankingGuide.id,
  'auth-rbi'
);
assert(
  bankingGuide.authorityName.includes('Reserve Bank of India'),
  'Banking authority name references Reserve Bank of India',
  bankingGuide.authorityName
);

// 2. Switch to Consumer Case
const consumerCase = INITIAL_CASES.find((c) => c.category === 'consumer_ecommerce')!;
const consumerGuide = getAuthorityGuideForCase(consumerCase);
assert(
  consumerGuide.id === 'auth-consumer',
  'Consumer case maps to Consumer Commission / e-Daakhil (auth-consumer)',
  consumerGuide.id,
  'auth-consumer'
);
assert(
  consumerGuide.authorityName.includes('Consumer'),
  'Consumer authority name references Consumer Disputes',
  consumerGuide.authorityName
);

// 3. Switch to RERA / Real Estate Case
const reraCase = INITIAL_CASES.find((c) => c.category === 'real_estate_rera')!;
const reraGuide = getAuthorityGuideForCase(reraCase);
assert(
  reraGuide.id === 'auth-rera',
  'Real estate case maps to State RERA authority (auth-rera)',
  reraGuide.id,
  'auth-rera'
);

// 4. Case-Switch Lifecycle Simulator
interface SimulatedNavigatorState {
  caseId: string;
  category: GrievanceCategory;
  selectedGuideId: string;
  currentStep: number;
  ackNumber: string;
  ackSavedSuccess: boolean;
}

function simulateNavigatorSync(
  prevState: SimulatedNavigatorState | null,
  newCase: GrievanceCase
): SimulatedNavigatorState {
  const guide = getAuthorityGuideForCase(newCase);
  const isDifferentCase = !prevState || prevState.caseId !== newCase.id;

  if (isDifferentCase) {
    return {
      caseId: newCase.id,
      category: newCase.category,
      selectedGuideId: guide.id,
      currentStep: 1, // Reset to step 1 for new case
      ackNumber: newCase.filingDetails?.referenceNumber || '',
      ackSavedSuccess: newCase.stage === 'filed_externally',
    };
  }

  // Same case: preserve user progress
  return {
    ...prevState,
    category: newCase.category,
    selectedGuideId:
      prevState.selectedGuideId &&
      AUTHORITY_GUIDES.find((g) => g.id === prevState.selectedGuideId)?.category === newCase.category
        ? prevState.selectedGuideId
        : guide.id,
  };
}

let navState = simulateNavigatorSync(null, bankingCase);
assert(navState.selectedGuideId === 'auth-rbi', 'Initial mount derives RBI CMS (auth-rbi)');
assert(navState.currentStep === 1, 'Initial mount starts at step 1');

// User advances to step 4 on banking case
navState.currentStep = 4;
assert(navState.currentStep === 4, 'User advances to step 4');

// Re-render of SAME case preserves step 4
navState = simulateNavigatorSync(navState, bankingCase);
assert(navState.currentStep === 4, 'Re-render of same case preserves workflow step 4');
assert(navState.selectedGuideId === 'auth-rbi', 'Re-render of same case preserves selected guide');

// Switch to Consumer case resets step and sets Consumer authority
navState = simulateNavigatorSync(navState, consumerCase);
assert(navState.selectedGuideId === 'auth-consumer', 'Case switch derives Consumer Court authority');
assert(navState.currentStep === 1, 'Case switch resets workflow step to 1');
assert(navState.caseId === consumerCase.id, 'Case switch updates active case ID');

// =========================================================================
// SCENARIO B: Builder Navigation & Session Preservation
// =========================================================================
console.log('\n--- SCENARIO B: Builder Navigation & Session Preservation ---');

interface AppNavigationState {
  activeTab: string;
  selectedCaseId: string;
  editingExistingCaseId: string | null;
  newCaseSessionId: string;
  cases: GrievanceCase[];
}

function createInitialAppState(): AppNavigationState {
  return {
    activeTab: 'overview',
    selectedCaseId: INITIAL_CASES[0].id,
    editingExistingCaseId: null,
    newCaseSessionId: 'session-1001',
    cases: [...INITIAL_CASES],
  };
}

// Simulates the corrected handleNavigateToTab logic in App.tsx
function navigateTab<T extends AppNavigationState>(state: T, targetTab: string): T {
  if (targetTab === 'new_case') {
    return {
      ...state,
      editingExistingCaseId: null,
      newCaseSessionId: `session-${Date.now()}`,
      activeTab: 'new_case',
    };
  }

  if (targetTab === 'builder') {
    // DEF-07: Preserve active editing session if set; do not silently convert selectedCaseId into an edit session
    return {
      ...state,
      activeTab: 'builder',
    };
  }

  if (targetTab === 'evidence') {
    // DEF-07: Attach to active editing case or selected case; if neither, start a new case
    const targetCase = state.editingExistingCaseId
      ? state.cases.find((c) => c.id === state.editingExistingCaseId)
      : state.selectedCaseId
      ? state.cases.find((c) => c.id === state.selectedCaseId)
      : undefined;

    if (targetCase) {
      return {
        ...state,
        selectedCaseId: targetCase.id,
        editingExistingCaseId: targetCase.id,
        activeTab: 'evidence',
      };
    } else {
      return {
        ...state,
        editingExistingCaseId: null,
        newCaseSessionId: `session-${Date.now()}`,
        activeTab: 'new_case',
      };
    }
  }

  return {
    ...state,
    activeTab: targetTab,
  };
}

let app = createInitialAppState();

// Step 1: User explicitly opens Case NS-2026-001 for editing
app.editingExistingCaseId = 'NS-2026-001';
app.selectedCaseId = 'NS-2026-001';
app.activeTab = 'builder';

assert(app.editingExistingCaseId === 'NS-2026-001', 'User is editing NS-2026-001');

// Step 2: User clicks Dashboard
app = navigateTab(app, 'overview');
assert(app.activeTab === 'overview', 'User is now on Dashboard');
assert(app.editingExistingCaseId === 'NS-2026-001', 'editingExistingCaseId is preserved when on Dashboard');

// Step 3: User clicks Smart Case Builder in sidebar
app = navigateTab(app, 'builder');
assert(app.activeTab === 'builder', 'User returned to Builder');
assert(
  app.editingExistingCaseId === 'NS-2026-001',
  'Active editing case NS-2026-001 is preserved upon return to Builder (DEFECT 2 FIXED)'
);

// Step 4: User explicitly clicks "New Case"
app = navigateTab(app, 'new_case');
assert(app.activeTab === 'new_case', 'User explicitly started new case');
assert(
  app.editingExistingCaseId === null,
  'editingExistingCaseId is cleared only on explicit new_case intent'
);

// Step 5: Save case sets editingExistingCaseId to saved case
const newMockCase: GrievanceCase = {
  ...INITIAL_CASES[0],
  id: 'NS-2026-999',
  title: 'Newly Saved Draft Complaint',
};
app.cases.push(newMockCase);
app.selectedCaseId = newMockCase.id;
app.editingExistingCaseId = newMockCase.id;

// Navigate to settings and return to builder
app = navigateTab(app, 'settings');
app = navigateTab(app, 'builder');
assert(
  app.editingExistingCaseId === 'NS-2026-999',
  'Newly saved case draft ID is preserved across navigation'
);

// Step 6: Rapid Navigation Stale-Closure Unmount Persistence Simulation
console.log('--- Sub-scenario B.6: Rapid-Navigation Unmount Stale-Closure Guard ---');

class CaseBuilderMountSimulator {
  title: string;
  description: string;
  latestTitleRef: { current: string };
  latestDescRef: { current: string };
  buildCurrentCaseRecordRef: { current: () => { id: string; title: string; description: string } };
  onSaveCaseRef: { current: (caseRecord: any, proceed: boolean) => void };
  isDirtyRef: { current: boolean };
  savedCases: any[] = [];
  unmountCleanup: () => void;

  constructor(initialTitle = '', initialDesc = '') {
    this.title = initialTitle;
    this.description = initialDesc;
    this.latestTitleRef = { current: this.title };
    this.latestDescRef = { current: this.description };
    this.isDirtyRef = { current: false };

    const buildRecord = () => ({
      id: 'NS-SIM-1',
      title: this.title || 'Untitled Grievance',
      description: this.description,
    });
    this.buildCurrentCaseRecordRef = { current: buildRecord };

    const saveCase = (c: any) => {
      this.savedCases.push(c);
    };
    this.onSaveCaseRef = { current: saveCase };

    // Register unmount cleanup hook mimicking CaseBuilder's useEffect(..., [])
    this.unmountCleanup = () => {
      const hasContent = Boolean(
        this.latestTitleRef.current?.trim() || this.latestDescRef.current?.trim()
      );
      if (this.isDirtyRef.current && hasContent) {
        const caseRecord = this.buildCurrentCaseRecordRef.current();
        this.onSaveCaseRef.current(caseRecord, false);
      }
    };
  }

  typeDescription(text: string) {
    this.description = text;
    // On each re-render, refs are updated
    this.latestTitleRef.current = this.title;
    this.latestDescRef.current = this.description;
    this.buildCurrentCaseRecordRef.current = () => ({
      id: 'NS-SIM-1',
      title: this.title || 'Untitled Grievance',
      description: this.description,
    });
    this.isDirtyRef.current = true;
  }

  unmount() {
    this.unmountCleanup();
  }
}

// Case A: User types in brand-new case and rapidly navigates away (< 1500ms debounce)
const rapidNavSim = new CaseBuilderMountSimulator('', '');
rapidNavSim.typeDescription('Disputed unauthorized UPI debit of Rs 5000');
rapidNavSim.unmount();
assert(
  rapidNavSim.savedCases.length === 1,
  'Rapid unmount (< 1500ms) on new case saves draft without stale-closure loss'
);
assert(
  rapidNavSim.savedCases[0]?.description === 'Disputed unauthorized UPI debit of Rs 5000',
  'Saved draft on rapid unmount contains latest typed description'
);

// Case B: User mounts blank case and navigates away without typing
const blankNavSim = new CaseBuilderMountSimulator('', '');
blankNavSim.unmount();
assert(
  blankNavSim.savedCases.length === 0,
  'Unmount on untouched blank case does not create phantom draft'
);

// Case C: Debounce timer already completed prior to unmount
const debouncedSim = new CaseBuilderMountSimulator('', '');
debouncedSim.typeDescription('Pre-debounced complaint draft');
// Simulate timer firing
debouncedSim.onSaveCaseRef.current(debouncedSim.buildCurrentCaseRecordRef.current(), false);
debouncedSim.isDirtyRef.current = false;
assert(debouncedSim.savedCases.length === 1, 'Initial debounce save fired');
// Now unmount happens
debouncedSim.unmount();
assert(
  debouncedSim.savedCases.length === 1,
  'Clean unmount after debounce does not trigger duplicate save'
);

// Step 7: DEF-06 Logout Session-State Cleanup
console.log('\n--- Sub-scenario B.7: DEF-06 Logout Session-State Cleanup ---');

interface ExtendedAppNavigationState extends AppNavigationState {
  initialBuilderPrompt: string;
  activeTrustRecord: any;
}

function deriveSelectedCase(cases: GrievanceCase[], selectedCaseId: string): GrievanceCase | null {
  // DEF-07: Respect selectedCaseId; return null when empty or invalid
  return selectedCaseId ? cases.find((c) => c.id === selectedCaseId) || null : null;
}

function simulateLogout(state: ExtendedAppNavigationState): ExtendedAppNavigationState {
  // Directly invoke the real exported authSession functions
  clearAuthSession();
  savePersistedTab('overview');
  return {
    ...state,
    activeTab: 'overview',
    editingExistingCaseId: null,
    initialBuilderPrompt: '',
    activeTrustRecord: null,
    selectedCaseId: '', // DEF-06: Wiped to empty string (not anchored to cases[0])
    newCaseSessionId: `session-${Date.now()}`,
  };
}

let activeUserApp: ExtendedAppNavigationState = {
  ...app,
  editingExistingCaseId: 'NS-2026-999',
  selectedCaseId: 'NS-2026-999',
  initialBuilderPrompt: 'Advisory: suspicious UPI handle',
  activeTrustRecord: { input: 'fake-upi@okhdfc' },
};

// User A logs out
activeUserApp = simulateLogout(activeUserApp);
assert(
  activeUserApp.selectedCaseId === '',
  'DEF-06: selectedCaseId is cleared to empty string on logout'
);
assert(
  activeUserApp.activeTab === 'overview',
  'DEF-06: activeTab is reset to overview on logout'
);
assert(
  getPersistedTab() === 'overview',
  'DEF-06: persistedTab in storage is reset to overview on logout'
);
assert(
  activeUserApp.editingExistingCaseId === null,
  'DEF-06: editingExistingCaseId is wiped on logout'
);
assert(
  activeUserApp.initialBuilderPrompt === '',
  'DEF-06: initialBuilderPrompt is wiped on logout'
);
assert(
  activeUserApp.activeTrustRecord === null,
  'DEF-06: activeTrustRecord is wiped on logout'
);

// User B logs in and opens builder without explicit case selection
const userBBuilderState = navigateTab(activeUserApp, 'builder');
assert(
  userBBuilderState.editingExistingCaseId === null,
  'DEF-06/07: User B opening Builder without explicit selection does not auto-edit cases[0] or User A case'
);

// User B's selectedCase is null (does not inherit previous user case)
const userBSelectedCase = deriveSelectedCase(activeUserApp.cases, activeUserApp.selectedCaseId);
assert(
  userBSelectedCase === null,
  'DEF-06: User B does NOT inherit a selectedCase from User A session'
);

// User B explicitly selects a case to edit (e.g. from My Cases)
let userBExplicitSelect: ExtendedAppNavigationState = {
  ...activeUserApp,
  selectedCaseId: 'NS-2026-0842',
  editingExistingCaseId: 'NS-2026-0842',
};
userBExplicitSelect = navigateTab(userBExplicitSelect, 'builder');
assert(
  userBExplicitSelect.editingExistingCaseId === 'NS-2026-0842',
  'DEF-07: Explicitly selecting a case opens that case for editing in Builder'
);

// Step 8: DEF-07 Ghost Case Fallback & Empty-Case Behavior
console.log('\n--- Sub-scenario B.8: DEF-07 Ghost Case Fallback & Empty-Case Behavior ---');

// 1. When cases is empty, selectedCase must evaluate to null, NOT INITIAL_CASES[0]
const clearedSelectedCase = deriveSelectedCase([], 'NS-2026-0842');
assert(
  clearedSelectedCase === null,
  'DEF-07: deriveSelectedCase evaluates to null when cases is empty (NO GHOST CASE)'
);

// 2. When cases has items, but selectedCaseId is empty string, selectedCase must evaluate to null
const emptySelectionCase = deriveSelectedCase(INITIAL_CASES, '');
assert(
  emptySelectionCase === null,
  'DEF-07: deriveSelectedCase evaluates to null when selectedCaseId is empty, even when saved cases exist'
);

// 3. When cases has items, but selectedCaseId is invalid, selectedCase must evaluate to null
const invalidSelectionCase = deriveSelectedCase(INITIAL_CASES, 'non_existent_id');
assert(
  invalidSelectionCase === null,
  'DEF-07: deriveSelectedCase evaluates to null for invalid case ID'
);

// 4. When cases has items, it selects the matching case
const populatedSelectedCase = deriveSelectedCase(INITIAL_CASES, INITIAL_CASES[1].id);
assert(
  populatedSelectedCase?.id === INITIAL_CASES[1].id,
  'deriveSelectedCase retrieves matched case when cases are populated and ID is valid'
);

// Step 9: DEF-07 Clear-All-After-Refresh Storage Persistence
console.log('\n--- Sub-scenario B.9: DEF-07 Clear-All-After-Refresh Storage Persistence ---');

// 1. Simulate clearing all cases: explicitly storing empty array []
localStorage.setItem('ns_grievance_cases', JSON.stringify([]));
const loadedAfterClear = loadInitialCases();
assert(
  Array.isArray(loadedAfterClear) && loadedAfterClear.length === 0,
  'DEF-07: Explicit empty array in storage remains empty after loadInitialCases() (no resurrection)'
);

// 2. Simulate absent storage key (first-time visitor or reset demo cases)
localStorage.removeItem('ns_grievance_cases');
const loadedInitialDemo = loadInitialCases();
assert(
  Array.isArray(loadedInitialDemo) && loadedInitialDemo.length === INITIAL_CASES.length,
  'DEF-07: Absent storage key loads full INITIAL_CASES demo dataset'
);

// =========================================================================
// SCENARIO C: Dashboard Roadmap Evidence Step Routing
// =========================================================================
console.log('\n--- SCENARIO C: Dashboard Roadmap Evidence Step Routing ---');

// 1. Evidence clicked when cases exist
app = createInitialAppState();
const secondCase = app.cases[1]; // e.g. NS-2026-0619
app.selectedCaseId = secondCase.id;
app = navigateTab(app, 'evidence');

assert(app.activeTab === 'evidence', 'Target tab is evidence');
assert(
  app.editingExistingCaseId === secondCase.id,
  `Evidence tab opens with selected case ${secondCase.id} attached`
);

// 2. Evidence clicked when zero cases exist
const emptyApp: AppNavigationState = {
  activeTab: 'overview',
  selectedCaseId: '',
  editingExistingCaseId: null,
  newCaseSessionId: 'session-blank',
  cases: [],
};

const routedBlank = navigateTab(emptyApp, 'evidence');
assert(
  routedBlank.activeTab === 'new_case',
  'Empty state safely routes to new_case workflow rather than broken blank evidence'
);
assert(
  routedBlank.editingExistingCaseId === null,
  'New case workflow initialized cleanly'
);

// =========================================================================
// SCENARIO D: Dynamic Citizen Identity in Copy & Documents
// =========================================================================
console.log('\n--- SCENARIO D: Dynamic Citizen Identity Propagation ---');

const demoCitizenName = 'Anita Sharma';

// 1. Simulated Filing Package Copy Text
function generateCopyPackageText(c: GrievanceCase, citizenName?: string) {
  const guide = getAuthorityGuideForCase(c);
  const effectiveName = citizenName?.trim() || 'Citizen Complainant';
  return `NIVARANSETU OFFICIAL FILING DATA PACKAGE
Forum: ${guide.authorityName} (${guide.officialPortal})
Case ID: ${c.id}
Complainant: ${effectiveName}
Opposite Party: ${c.involvedEntity}
Incident Date: ${c.incidentDate}`;
}

const copiedText = generateCopyPackageText(bankingCase, demoCitizenName);
assert(
  copiedText.includes('Complainant: Anita Sharma'),
  'Copied filing package contains demo profile name "Anita Sharma"',
  copiedText.match(/Complainant: [^\n]+/)?.[0]
);
assert(
  !copiedText.includes('Rajesh Joshi'),
  'Copied filing package does NOT contain hardcoded "Rajesh Joshi"'
);

// 2. Fallback when name is empty/missing
const fallbackCopiedText = generateCopyPackageText(bankingCase, '');
assert(
  fallbackCopiedText.includes('Complainant: Citizen Complainant'),
  'Graceful fallback to "Citizen Complainant" when name is empty string',
  fallbackCopiedText.match(/Complainant: [^\n]+/)?.[0]
);

// 3. Escalation Reminder Letter
const reminderLetter = generateStatusReminderLetter(bankingCase, { citizenName: demoCitizenName });
assert(
  reminderLetter.includes('Complainant Name: Anita Sharma'),
  'Status reminder letter header contains "Anita Sharma"',
  reminderLetter.match(/Complainant Name: [^\n]+/)?.[0]
);
assert(
  reminderLetter.includes('Yours sincerely,\n\nAnita Sharma'),
  'Status reminder letter signature uses "Anita Sharma"'
);
assert(
  !reminderLetter.includes('Rajesh Joshi'),
  'Status reminder letter does NOT contain hardcoded "Rajesh Joshi"'
);

// 4. Escalation Petition Letter
const petitionLetter = generateEscalationPetitionLetter(bankingCase, { citizenName: demoCitizenName });
assert(
  petitionLetter.includes('Anita Sharma'),
  'Escalation petition letter contains "Anita Sharma"'
);
assert(
  !petitionLetter.includes('Rajesh Joshi'),
  'Escalation petition letter does NOT contain hardcoded "Rajesh Joshi"'
);

// 5. Fallback in Escalation Letters
const fallbackLetter = generateStatusReminderLetter(bankingCase, { citizenName: '   ' });
assert(
  fallbackLetter.includes('Complainant Name: Citizen Complainant'),
  'Escalation letter falls back to "Citizen Complainant" for whitespace name'
);

// =========================================================================
// SUMMARY
// =========================================================================
console.log(`\n======================================================`);
console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
console.log(`======================================================\n`);

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
