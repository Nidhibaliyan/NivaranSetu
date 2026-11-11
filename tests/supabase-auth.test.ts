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

import { User } from '@supabase/supabase-js';
import {
  mapSupabaseUserToAuthUser,
  saveAuthSession,
  getAuthSession,
  clearAuthSession,
  hasValidSession,
  signInWithSupabase,
  signUpWithSupabase,
  signOutFromSupabase,
  getSupabaseAuthSession,
  onSupabaseAuthStateChange,
  resetSupabasePassword,
  DEMO_CITIZEN_PASSWORD,
  AUTH_SESSION_KEY,
  USER_PROFILE_KEY,
  AUTH_VIEW_KEY,
} from '../src/utils/authSession';
import { getSupabaseClient, supabase } from '../src/utils/supabaseClient';
import { QUICK_CITIZENS, executeQuickLogin } from '../src/components/AuthPage';

console.log('=== NivaranSetu Supabase Authentication Test Suite ===\n');

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

const TEST_UUID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

// -------------------------------------------------------------
// SECTION 1: Client Initialization & Credential Safety
// -------------------------------------------------------------
console.log('--- SECTION 1: Client Initialization & Credential Safety ---');

assert(Boolean(supabase), 'Supabase singleton client initialized successfully');
assert(typeof getSupabaseClient === 'function', 'getSupabaseClient exported as function');
assert(getSupabaseClient() === supabase, 'getSupabaseClient returns singleton instance');

// Ensure publishable key is NOT a secret service-role key
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
assert(!publishableKey.includes('service_role'), 'Publishable key does not contain service_role token');
assert(
  publishableKey.startsWith('sb_publishable_') || publishableKey.startsWith('eyJ'),
  'Publishable key has valid public client format'
);

// -------------------------------------------------------------
// SECTION 2: Supabase User to AuthUser Model Mapping
// -------------------------------------------------------------
console.log('\n--- SECTION 2: User Mapping & Verified Identity ---');

const mockSupabaseUser: User = {
  id: TEST_UUID,
  app_metadata: { provider: 'email' },
  user_metadata: {
    full_name: 'Rajesh Joshi',
    phone: '9876543210',
    location: 'Pune, Maharashtra',
    role: 'citizen',
  },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'rajesh.joshi@example.com',
  phone: '9876543210',
} as any;

const mappedUser = mapSupabaseUserToAuthUser(mockSupabaseUser);

assert(mappedUser.id === TEST_UUID, 'mappedUser.id strictly equals verified Supabase user.id UUID', mappedUser.id, TEST_UUID);
assert(mappedUser.email === 'rajesh.joshi@example.com', 'mappedUser.email matches user email');
assert(mappedUser.name === 'Rajesh Joshi', 'mappedUser.name extracted from full_name metadata');
assert(mappedUser.phone === '9876543210', 'mappedUser.phone extracted from metadata/user');
assert(mappedUser.location === 'Pune, Maharashtra', 'mappedUser.location extracted from metadata');
assert(mappedUser.role === 'citizen', 'mappedUser.role defaults to citizen');

// Fallback when user_metadata is empty
const bareUser: User = {
  id: 'a1b2c3d4-e5f6-4789-abcd-0123456789ab',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'anita.sharma@example.com',
} as any;

const mappedBare = mapSupabaseUserToAuthUser(bareUser);
assert(mappedBare.id === 'a1b2c3d4-e5f6-4789-abcd-0123456789ab', 'Bare user id preserves UUID');
assert(mappedBare.name === 'anita.sharma', 'Bare user name falls back cleanly to email username prefix');
assert(mappedBare.role === 'citizen', 'Bare user role defaults to citizen');

// -------------------------------------------------------------
// SECTION 3: Auth Session Persistence & Synchronous Cache
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Session Cache & Lifecycle ---');
localStorage.clear();

assert(hasValidSession() === false, 'hasValidSession() is false when cache is empty');
assert(getAuthSession() === null, 'getAuthSession() is null when cache is empty');

// Cache session with verified user
const cached = saveAuthSession(mappedUser, true);
assert(hasValidSession() === true, 'hasValidSession() is true after saveAuthSession');
assert(cached.user.id === TEST_UUID, 'Cached user contains verified UUID');
assert(cached.token === `sb_user_${TEST_UUID}`, 'Cached token references Supabase user UUID');
assert(localStorage.getItem(AUTH_VIEW_KEY) === 'app', 'Cached view set to app');

// Validate retrieval
const retrieved = getAuthSession();
assert(retrieved !== null, 'getAuthSession() retrieves cached session');
assert(retrieved?.user.id === TEST_UUID, 'Retrieved user id matches UUID');
assert(retrieved?.user.email === 'rajesh.joshi@example.com', 'Retrieved email matches');

// Clear session
clearAuthSession();
assert(hasValidSession() === false, 'hasValidSession() is false after clearAuthSession');
assert(localStorage.getItem(AUTH_SESSION_KEY) === null, 'AUTH_SESSION_KEY removed from storage');
assert(localStorage.getItem(USER_PROFILE_KEY) === null, 'USER_PROFILE_KEY removed from storage');
assert(localStorage.getItem(AUTH_VIEW_KEY) === 'auth', 'AUTH_VIEW_KEY set to auth on clear');

// -------------------------------------------------------------
// SECTION 4: Supabase Auth Method Signatures & Error Safety
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Supabase Auth Contract Verification ---');

assert(typeof signInWithSupabase === 'function', 'signInWithSupabase is exported');
assert(typeof signUpWithSupabase === 'function', 'signUpWithSupabase is exported');
assert(typeof signOutFromSupabase === 'function', 'signOutFromSupabase is exported');
assert(typeof getSupabaseAuthSession === 'function', 'getSupabaseAuthSession is exported');
assert(typeof onSupabaseAuthStateChange === 'function', 'onSupabaseAuthStateChange is exported');
assert(typeof resetSupabasePassword === 'function', 'resetSupabasePassword is exported');

// -------------------------------------------------------------
// SECTION 5: Expired Session Discard Guard
// -------------------------------------------------------------
console.log('\n--- SECTION 5: Expired Session Discard Guard ---');
localStorage.clear();

// Construct expired session object
const expiredSession = {
  token: 'sb_expired_token',
  user: mappedUser,
  createdAt: Date.now() - 100000,
  expiresAt: Date.now() - 5000, // expired 5 seconds ago
  rememberMe: false,
};
localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(expiredSession));

const expiredCheck = getAuthSession();
assert(expiredCheck === null, 'getAuthSession() automatically returns null for expired session');
assert(hasValidSession() === false, 'hasValidSession() returns false for expired session');
assert(localStorage.getItem(AUTH_SESSION_KEY) === null, 'Expired session is automatically purged from storage');

// -------------------------------------------------------------
// SECTION 6: Auth State Change Subscription Lifecycle
// -------------------------------------------------------------
console.log('\n--- SECTION 6: Auth State Change Subscription ---');

let eventReceived = '';
let userReceived: any = null;

const sub = onSupabaseAuthStateChange((event, user) => {
  eventReceived = event;
  userReceived = user;
});

assert(typeof sub.unsubscribe === 'function', 'onSupabaseAuthStateChange returns object with unsubscribe()');
sub.unsubscribe();
assert(true, 'unsubscribe() executed without throwing error');

// -------------------------------------------------------------
// SECTION 7: Live Network Error Handling Contract
// (Tests graceful handling when remote auth rejects bad credentials)
// -------------------------------------------------------------
console.log('\n--- SECTION 7: Live Network Error Handling Contract ---');

async function testInvalidLogin() {
  const result = await signInWithSupabase('nonexistent.user.test@example.com', 'WrongPassword123!');
  assert(result.user === null, 'signInWithSupabase returns user = null for invalid credentials');
  assert(result.session === null, 'signInWithSupabase returns session = null for invalid credentials');
  assert(typeof result.error === 'string' && result.error.length > 0, 'signInWithSupabase returns descriptive error string');
}

// -------------------------------------------------------------
// SECTION 8: Demo Login Contract & Anti-Registration Guard (AUD-AUTH-01)
// -------------------------------------------------------------
async function testDemoLoginGuard() {
  console.log('\n--- SECTION 8: Demo Login Contract & Anti-Registration Guard (AUD-AUTH-01) ---');

  // Verify demo profiles configuration
  assert(Array.isArray(QUICK_CITIZENS), 'QUICK_CITIZENS is an exported array');
  assert(QUICK_CITIZENS.length === 2, 'QUICK_CITIZENS contains exactly 2 demo profiles');
  assert(QUICK_CITIZENS[0].name === 'Rajesh Joshi', 'Profile 0 is Rajesh Joshi');
  assert(QUICK_CITIZENS[0].email === 'rajesh.joshi@example.com', 'Profile 0 email is rajesh.joshi@example.com');
  assert(QUICK_CITIZENS[1].name === 'Anita Sharma', 'Profile 1 is Anita Sharma');
  assert(QUICK_CITIZENS[1].email === 'anita.sharma@example.com', 'Profile 1 email is anita.sharma@example.com');

  const origSignIn = supabase.auth.signInWithPassword.bind(supabase.auth);
  const origSignUp = supabase.auth.signUp.bind(supabase.auth);

  try {
    // 8.1: Test Rajesh Joshi Demo Button Click — Login Failure Must NEVER Call SignUp
    let rajeshSignInCalls: any[] = [];
    let signUpCallCount = 0;

    supabase.auth.signInWithPassword = (async (credentials: any) => {
      rajeshSignInCalls.push(credentials);
      return {
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' } as any,
      };
    }) as any;

    supabase.auth.signUp = (async () => {
      signUpCallCount++;
      return { data: { user: null, session: null }, error: { message: 'Email rate limit exceeded' } as any };
    }) as any;

    let errorMsg: string | null = null;
    let successNotice: string | null = null;
    let isSubmitting = false;
    let submittedUser: any = null;
    let submittedEmail = '';
    let submittedPassword = '';

    await executeQuickLogin(QUICK_CITIZENS[0], {
      setErrorMsg: (msg) => { errorMsg = msg; },
      setSuccessNotice: (msg) => { successNotice = msg; },
      setIsSubmitting: (sub) => { isSubmitting = sub; },
      setFullName: () => {},
      setEmail: (em) => { submittedEmail = em; },
      setPassword: (pw) => { submittedPassword = pw; },
      onSuccess: (u) => { submittedUser = u; },
    });

    assert(rajeshSignInCalls.length === 1, 'Rajesh Joshi quick login executed signInWithPassword exactly once');
    assert(rajeshSignInCalls[0].email === 'rajesh.joshi@example.com', 'signInWithPassword called with Rajesh Joshi email');
    assert(rajeshSignInCalls[0].password === DEMO_CITIZEN_PASSWORD, 'signInWithPassword called with standard demo password');
    assert(signUpCallCount === 0, 'AUD-AUTH-01 Guard: signUp was NEVER called on Rajesh Joshi login failure');
    assert(Boolean(errorMsg) && String(errorMsg).includes('Invalid login credentials'), 'Error message preserved and displayed to user');
    assert(submittedUser === null, 'onSuccess not called when demo sign-in fails');
    assert(isSubmitting === false, 'isSubmitting reset to false in finally block');

    // 8.2: Test Anita Sharma Demo Button Click — User Not Found Must NEVER Call SignUp
    let anitaSignInCalls: any[] = [];
    signUpCallCount = 0;

    supabase.auth.signInWithPassword = (async (credentials: any) => {
      anitaSignInCalls.push(credentials);
      return {
        data: { user: null, session: null },
        error: { message: 'User not found' } as any,
      };
    }) as any;

    errorMsg = null;
    submittedUser = null;

    await executeQuickLogin(QUICK_CITIZENS[1], {
      setErrorMsg: (msg) => { errorMsg = msg; },
      setSuccessNotice: (msg) => { successNotice = msg; },
      setIsSubmitting: (sub) => { isSubmitting = sub; },
      setFullName: () => {},
      setEmail: (em) => { submittedEmail = em; },
      setPassword: (pw) => { submittedPassword = pw; },
      onSuccess: (u) => { submittedUser = u; },
    });

    assert(anitaSignInCalls.length === 1, 'Anita Sharma quick login executed signInWithPassword exactly once');
    assert(anitaSignInCalls[0].email === 'anita.sharma@example.com', 'signInWithPassword called with Anita Sharma email');
    assert(anitaSignInCalls[0].password === DEMO_CITIZEN_PASSWORD, 'signInWithPassword called with standard demo password');
    assert(signUpCallCount === 0, 'AUD-AUTH-01 Guard: signUp was NEVER called on Anita Sharma login failure');
    assert(Boolean(errorMsg) && String(errorMsg).includes('User not found'), 'Error message preserved and displayed to user');
    assert(submittedUser === null, 'onSuccess not called when demo sign-in fails');
    assert(isSubmitting === false, 'isSubmitting reset to false in finally block');

    // 8.3: Test Successful Demo Login
    supabase.auth.signInWithPassword = (async (credentials: any) => {
      return {
        data: {
          user: mockSupabaseUser,
          session: { access_token: 'fake_jwt_token', user: mockSupabaseUser } as any,
        },
        error: null,
      };
    }) as any;

    errorMsg = null;
    submittedUser = null;

    await executeQuickLogin(QUICK_CITIZENS[0], {
      setErrorMsg: (msg) => { errorMsg = msg; },
      setSuccessNotice: (msg) => { successNotice = msg; },
      setIsSubmitting: (sub) => { isSubmitting = sub; },
      setFullName: () => {},
      setEmail: (em) => { submittedEmail = em; },
      setPassword: (pw) => { submittedPassword = pw; },
      onSuccess: (u) => { submittedUser = u; },
    });

    assert(submittedUser !== null, 'onSuccess called on valid demo sign-in');
    assert(submittedUser?.id === TEST_UUID, 'Submitted user has verified Supabase UUID');
    assert(signUpCallCount === 0, 'signUp call count remains strictly 0');
    assert(errorMsg === null, 'No error message set on successful login');

    // 8.4: Verify Normal Registration Continues to Work (Decoupled from Demo Login)
    let normalSignUpCalls: any[] = [];
    supabase.auth.signUp = (async (params: any) => {
      normalSignUpCalls.push(params);
      return {
        data: { user: mockSupabaseUser, session: null },
        error: null,
      };
    }) as any;

    const normalRegRes = await signUpWithSupabase('new.citizen@example.com', 'SecurePwd456!', {
      fullName: 'New Citizen',
      phone: '9998887776',
    });

    assert(normalSignUpCalls.length === 1, 'Standard registration correctly calls supabase.auth.signUp');
    assert(normalSignUpCalls[0].email === 'new.citizen@example.com', 'signUp called with citizen email');
    assert(normalSignUpCalls[0].options?.data?.full_name === 'New Citizen', 'signUp received full_name metadata');
    assert(normalRegRes.requiresEmailConfirmation === true, 'Standard registration indicates confirmation requirement when session is null');

  } finally {
    // Restore original auth functions
    supabase.auth.signInWithPassword = origSignIn;
    supabase.auth.signUp = origSignUp;
  }
}

async function runAllTests() {
  await testInvalidLogin();
  await testDemoLoginGuard();

  console.log(`\n======================================================`);
  console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
  console.log(`======================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
