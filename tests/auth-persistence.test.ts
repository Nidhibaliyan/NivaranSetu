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

// Attach mock localStorage to global if running in Node
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new MockLocalStorage();
}

import {
  saveAuthSession,
  getAuthSession,
  clearAuthSession,
  hasValidSession,
  getPersistedTab,
  savePersistedTab,
  getPersistedView,
  savePersistedView,
  AUTH_SESSION_KEY,
  USER_PROFILE_KEY,
  AUTH_VIEW_KEY,
  ACTIVE_TAB_KEY,
  DEFAULT_SESSION_DURATION_MS,
  REMEMBER_ME_DURATION_MS,
} from '../src/utils/authSession';

console.log('=== NivaranSetu Authentication Persistence Test Suite ===\n');

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

// -------------------------------------------------------------------
// SCENARIO 1: Login -> Refresh -> Remain Logged In
// -------------------------------------------------------------------
console.log('--- SCENARIO 1: Login -> Browser Refresh Simulation ---');
localStorage.clear();

const citizen = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  name: 'Rajesh Joshi',
  email: 'rajesh.joshi@example.com',
  phone: '9876543210',
};

// 1. User logs in
const session = saveAuthSession(citizen, true);
assert(hasValidSession(), 'Session is valid immediately after login');
assert(session.token.length > 0, 'Session token generated');
assert(session.expiresAt > Date.now() + REMEMBER_ME_DURATION_MS - 5000, 'Remember Me sets 14 days expiration');
assert(getPersistedView() === 'app', 'Persisted view is set to "app"');

// 2. Simulate browser refresh: memory state wiped, but localStorage persisted
const restoredSession = getAuthSession();
assert(restoredSession !== null, 'Session is successfully restored after simulated browser refresh');
assert(restoredSession?.user.name === 'Rajesh Joshi', 'User name preserved across refresh', restoredSession?.user.name, 'Rajesh Joshi');
assert(restoredSession?.user.email === 'rajesh.joshi@example.com', 'User email preserved across refresh', restoredSession?.user.email, 'rajesh.joshi@example.com');
assert(hasValidSession(), 'hasValidSession() returns true on startup');

// -------------------------------------------------------------------
// SCENARIO 2: Navigation Between Pages -> Remain Logged In
// -------------------------------------------------------------------
console.log('\n--- SCENARIO 2: Page Navigation -> Browser Refresh Simulation ---');

const tabsToTest = [
  'overview',
  'my_cases',
  'builder',
  'new_case',
  'evidence',
  'readiness',
  'custody',
  'navigator',
  'dossier',
  'monitoring',
  'simplifier',
  'trust',
  'settings',
];

for (const tab of tabsToTest) {
  savePersistedTab(tab);
  const loadedTab = getPersistedTab();
  assert(loadedTab === tab, `Active tab "${tab}" persisted and restored across refresh`, loadedTab, tab);
  assert(hasValidSession(), `User remains authenticated while viewing tab "${tab}"`);
}

// Explicit DEF-02 Assertions:
// 1. Refreshing on 'my_cases' preserves 'my_cases'
savePersistedTab('my_cases');
assert(getPersistedTab() === 'my_cases', 'DEF-02: Refreshing on "my_cases" restores "my_cases" tab directly (not overview)');

// 2. Legacy 'cases' in localStorage is automatically mapped to 'my_cases'
localStorage.setItem(ACTIVE_TAB_KEY, 'cases');
assert(getPersistedTab() === 'my_cases', 'DEF-02: Legacy "cases" in storage maps cleanly to "my_cases" without blank screen');

// 3. Passing legacy 'cases' to savePersistedTab() normalizes to 'my_cases'
savePersistedTab('cases');
assert(localStorage.getItem(ACTIVE_TAB_KEY) === 'my_cases', 'DEF-02: savePersistedTab("cases") normalizes to "my_cases"');
assert(getPersistedTab() === 'my_cases', 'DEF-02: getPersistedTab() returns "my_cases" after saving legacy tab');

// 4. Invalid or arbitrary tab safely falls back to 'overview'
localStorage.setItem(ACTIVE_TAB_KEY, 'non_existent_tab_123');
assert(getPersistedTab() === 'overview', 'DEF-02: Invalid tab in storage safely falls back to "overview"');

// -------------------------------------------------------------------
// SCENARIO 3: Logout -> Return to Login Page
// -------------------------------------------------------------------
console.log('\n--- SCENARIO 3: User Logout ---');

// User triggers logout
clearAuthSession();

assert(!hasValidSession(), 'Session is no longer valid after logout');
assert(getAuthSession() === null, 'getAuthSession() returns null after logout');
assert(localStorage.getItem(AUTH_SESSION_KEY) === null, 'AUTH_SESSION_KEY removed from localStorage');
assert(localStorage.getItem(USER_PROFILE_KEY) === null, 'USER_PROFILE_KEY removed from localStorage');
assert(getPersistedView() === 'auth', 'View is redirected to "auth" (login page)');

// -------------------------------------------------------------------
// SCENARIO 4: Refresh After Logout -> Remain Logged Out
// -------------------------------------------------------------------
console.log('\n--- SCENARIO 4: Refresh After Logout ---');

// Simulate browser refresh while logged out
const postLogoutSession = getAuthSession();
const postLogoutView = getPersistedView();

assert(postLogoutSession === null, 'Session remains null after page refresh');
assert(!hasValidSession(), 'hasValidSession() remains false after page refresh');
assert(postLogoutView === 'auth', 'User remains on the login page ("auth") rather than landing or app');

// -------------------------------------------------------------------
// SCENARIO 5: Session Expiration Enforcement
// -------------------------------------------------------------------
console.log('\n--- SCENARIO 5: Session Expiration Enforcement ---');
localStorage.clear();

// Create an expired session (simulating past token expiration)
const expiredSession = {
  token: 'ns_tok_expired_123',
  user: { name: 'Expired Citizen', email: 'expired@example.com' },
  createdAt: Date.now() - 100000,
  expiresAt: Date.now() - 5000, // expired 5 seconds ago
  rememberMe: false,
};
localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(expiredSession));

const retrievedExpired = getAuthSession();
assert(retrievedExpired === null, 'Expired session is detected and rejected');
assert(!hasValidSession(), 'hasValidSession() is false for expired session');
assert(localStorage.getItem(AUTH_SESSION_KEY) === null, 'Expired session is automatically purged from localStorage');

// -------------------------------------------------------------------
// SCENARIO 6: Preservation of Case Data, Theme and Language
// -------------------------------------------------------------------
console.log('\n--- SCENARIO 6: Preservation of Other Storage Keys ---');
localStorage.setItem('ns_grievance_cases', JSON.stringify([{ id: 'NS-CASE-1' }]));
localStorage.setItem('ns_theme', 'dark');
localStorage.setItem('ns_lang', 'hi');

// Perform login and subsequent logout
saveAuthSession({ id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', name: 'Test User', email: 'test@example.com' });
clearAuthSession();

assert(
  localStorage.getItem('ns_grievance_cases') === JSON.stringify([{ id: 'NS-CASE-1' }]),
  'Case storage (ns_grievance_cases) remains completely untouched by auth cycles'
);
assert(
  localStorage.getItem('ns_theme') === 'dark',
  'Theme preference (ns_theme) remains preserved'
);
assert(
  localStorage.getItem('ns_lang') === 'hi',
  'Language preference (ns_lang) remains preserved'
);

console.log(`\n======================================================`);
console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
console.log(`======================================================\n`);

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
