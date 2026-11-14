/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { AuthUser } from '../types';

export type { AuthUser };

export interface AuthSession {
  token: string;
  user: AuthUser;
  createdAt: number;
  expiresAt: number;
  rememberMe: boolean;
}

export const AUTH_SESSION_KEY = 'ns_auth_session';
export const USER_PROFILE_KEY = 'ns_user_profile';
export const ACTIVE_TAB_KEY = 'ns_active_tab';
export const AUTH_VIEW_KEY = 'ns_auth_view';

// 14 days for "Remember Me", 24 hours for standard session
export const DEFAULT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
export const REMEMBER_ME_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

// Standard demo citizen password for 1-click authentic test logins
export const DEMO_CITIZEN_PASSWORD = 'DemoCitizen2026!';

/**
 * Maps an authentic Supabase User object into the domain AuthUser model.
 * The UUID (auth.uid()) is extracted directly from the verified Supabase token,
 * never from client-controlled UI inputs.
 */
export function mapSupabaseUserToAuthUser(user: User): AuthUser {
  const metadata = user.user_metadata || {};
  return {
    id: user.id, // Authenticated UUID from Supabase Auth
    email: user.email || '',
    name: metadata.full_name || metadata.name || user.email?.split('@')[0] || 'Citizen User',
    phone: metadata.phone || user.phone || '',
    location: metadata.location || '',
    role: metadata.role || 'citizen',
  };
}

/**
 * Authenticates a user with Supabase Auth using email and password.
 * Returns the mapped AuthUser with verified UUID, or an error message.
 */
export async function signInWithSupabase(
  email: string,
  password: string,
  rememberMe = true
): Promise<{ user: AuthUser | null; session: any | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    if (!data.user || !data.session) {
      return { user: null, session: null, error: 'Authentication succeeded but no active session was returned.' };
    }

    const authUser = mapSupabaseUserToAuthUser(data.user);
    saveAuthSession(authUser, rememberMe);
    savePersistedView('app');
    return { user: authUser, session: data.session, error: null };
  } catch (err: any) {
    return { user: null, session: null, error: err?.message || 'An unexpected authentication error occurred.' };
  }
}

/**
 * Registers a new user with Supabase Auth.
 * Includes citizen metadata (full_name, phone, location) in user_metadata.
 */
export async function signUpWithSupabase(
  email: string,
  password: string,
  metadata?: { fullName?: string; phone?: string; location?: string; role?: string },
  rememberMe = true
): Promise<{
  user: AuthUser | null;
  session: any | null;
  requiresEmailConfirmation: boolean;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: metadata?.fullName?.trim() || '',
          phone: metadata?.phone?.trim() || '',
          location: metadata?.location?.trim() || '',
          role: metadata?.role || 'citizen',
        },
      },
    });

    if (error) {
      return { user: null, session: null, requiresEmailConfirmation: false, error: error.message };
    }

    if (!data.user) {
      return { user: null, session: null, requiresEmailConfirmation: false, error: 'Registration failed: No user returned.' };
    }

    const authUser = mapSupabaseUserToAuthUser(data.user);
    const requiresEmailConfirmation = !data.session;

    if (data.session) {
      saveAuthSession(authUser, rememberMe);
      savePersistedView('app');
    }

    return { user: authUser, session: data.session, requiresEmailConfirmation, error: null };
  } catch (err: any) {
    return {
      user: null,
      session: null,
      requiresEmailConfirmation: false,
      error: err?.message || 'An unexpected registration error occurred.',
    };
  }
}

/**
 * Signs out the current user from Supabase Auth and purges local session artifacts.
 */
export async function signOutFromSupabase(): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('Supabase signOut warning:', error.message);
    }
  } catch (err) {
    console.warn('Network error during Supabase signOut:', err);
  } finally {
    clearAuthSession();
  }
  return { error: null };
}

/**
 * Attempts a single graceful Supabase session refresh and synchronizes local cache.
 * Returns the refreshed non-empty access token, or null if refresh fails or identity shifts.
 */
export async function refreshAndGetAccessToken(): Promise<string | null> {
  try {
    const cachedSession = getAuthSession();
    const expectedUserId = cachedSession?.user?.id || null;
    const { data, error } = await supabase.auth.refreshSession();
    const refreshedSession = data?.session;

    if (error || !refreshedSession || !refreshedSession.user?.id) {
      clearAuthSession();
      return null;
    }

    if (expectedUserId && refreshedSession.user.id !== expectedUserId) {
      console.warn('NivaranSetu session identity mismatch detected during refresh.');
      clearAuthSession();
      return null;
    }

    if (
      refreshedSession.expires_at &&
      Date.now() / 1000 >= refreshedSession.expires_at
    ) {
      clearAuthSession();
      return null;
    }

    const token =
      typeof refreshedSession.access_token === 'string'
        ? refreshedSession.access_token.trim()
        : '';
    if (!token) {
      clearAuthSession();
      return null;
    }

    const authUser = mapSupabaseUserToAuthUser(refreshedSession.user);
    saveAuthSession(authUser, true);
    return token;
  } catch (err) {
    console.warn('Error refreshing Supabase session:', err);
    clearAuthSession();
    return null;
  }
}

/**
 * Asynchronously restores and validates the active Supabase session.
 * Automatically checks token expiration, attempts graceful refresh when expired
 * or near expiry, and discards unrecoverable expired sessions.
 */
export async function getSupabaseAuthSession(): Promise<{ user: AuthUser | null; session: any | null }> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || !data.session.user) {
      clearAuthSession();
      return { user: null, session: null };
    }

    let activeSession = data.session;

    // Check expiration against expires_at timestamp (in seconds, with 30s refresh buffer)
    if (activeSession.expires_at && Date.now() / 1000 >= activeSession.expires_at - 30) {
      const initialUserId = activeSession.user.id;
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      const refreshed = refreshData?.session;

      if (
        refreshError ||
        !refreshed ||
        !refreshed.user?.id ||
        refreshed.user.id !== initialUserId ||
        (refreshed.expires_at && Date.now() / 1000 >= refreshed.expires_at)
      ) {
        console.warn('NivaranSetu session token expired and could not be refreshed.');
        clearAuthSession();
        return { user: null, session: null };
      }

      activeSession = refreshed;
    }

    const authUser = mapSupabaseUserToAuthUser(activeSession.user);
    // Keep local cache in sync with verified Supabase session
    saveAuthSession(authUser, true);
    return { user: authUser, session: activeSession };
  } catch (err) {
    console.error('Error fetching Supabase session:', err);
    clearAuthSession();
    return { user: null, session: null };
  }
}

/**
 * Asynchronously retrieves a valid, non-expired Supabase access token (JWT).
 * Reuses the existing getSupabaseAuthSession() mechanism without creating duplicate clients.
 * Returns null if no valid authenticated session exists.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const { session } = await getSupabaseAuthSession();
  if (!session || typeof session.access_token !== 'string' || !session.access_token.trim()) {
    return null;
  }
  return session.access_token.trim();
}

/**
 * Subscribes to Supabase authentication lifecycle changes.
 * Handles SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, and USER_UPDATED events.
 */
export function onSupabaseAuthStateChange(
  callback: (event: string, authUser: AuthUser | null) => void
): { unsubscribe: () => void } {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
      const authUser = mapSupabaseUserToAuthUser(session.user);
      saveAuthSession(authUser, true);
      callback(event, authUser);
    } else if (event === 'SIGNED_OUT') {
      clearAuthSession();
      callback(event, null);
    }
  });

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
}

/**
 * Requests a password reset email via Supabase Auth.
 */
export async function resetSupabasePassword(email: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to request password reset.' };
  }
}

// =============================================================================
// SYNCHRONOUS CACHE & UI HELPERS
// (Maintains synchronous tab navigation and startup flash prevention)
// =============================================================================

/**
 * Saves authenticated session metadata to local storage for instant synchronous reads.
 */
export function saveAuthSession(user: AuthUser, rememberMe = true): AuthSession {
  const now = Date.now();
  const duration = rememberMe ? REMEMBER_ME_DURATION_MS : DEFAULT_SESSION_DURATION_MS;
  const expiresAt = now + duration;

  const session: AuthSession = {
    token: user.id ? `sb_user_${user.id}` : `ns_sess_${now}`,
    user: {
      id: user.id || '',
      name: user.name.trim(),
      email: user.email.trim(),
      phone: user.phone?.trim() || '',
      location: user.location?.trim() || '',
      role: user.role || 'citizen',
    },
    createdAt: now,
    expiresAt,
    rememberMe,
  };

  try {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(session.user));
    localStorage.setItem(AUTH_VIEW_KEY, 'app');
  } catch (err) {
    console.error('Failed to save auth session to localStorage:', err);
  }

  return session;
}

/**
 * Retrieves the cached authenticated session from local storage.
 * Synchronous helper used to prevent unauthenticated screen flash while Supabase initializes.
 */
export function getAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;

    const session: AuthSession = JSON.parse(raw);

    if (
      !session ||
      !session.user ||
      typeof session.user.name !== 'string' ||
      !session.user.name.trim() ||
      typeof session.user.email !== 'string' ||
      !session.user.email.trim() ||
      typeof session.expiresAt !== 'number'
    ) {
      clearAuthSession();
      return null;
    }

    if (Date.now() > session.expiresAt) {
      console.warn('NivaranSetu authentication session expired.');
      clearAuthSession();
      return null;
    }

    return session;
  } catch (err) {
    console.error('Error validating auth session:', err);
    clearAuthSession();
    return null;
  }
}

/**
 * Clears the active authentication session and credentials on logout.
 * Leaves non-auth preferences (cases, theme, language) intact.
 */
export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
    localStorage.setItem(AUTH_VIEW_KEY, 'auth');
    localStorage.removeItem(ACTIVE_TAB_KEY);
  } catch (err) {
    console.error('Failed to clear auth session from localStorage:', err);
  }
}

/**
 * Returns true if an unexpired cached session exists.
 */
export function hasValidSession(): boolean {
  return getAuthSession() !== null;
}

/**
 * Safely loads the last active application tab, falling back to 'overview'.
 */
export function getPersistedTab(): string {
  try {
    const raw = localStorage.getItem(ACTIVE_TAB_KEY);
    const tab = raw === 'cases' ? 'my_cases' : raw;
    const validTabs = [
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
      'legal_rag',
      'trust',
      'settings',
    ];
    if (tab && validTabs.includes(tab)) {
      return tab;
    }
  } catch {
    // fallback
  }
  return 'overview';
}

/**
 * Persists the user's active tab selection.
 */
export function savePersistedTab(tab: string): void {
  try {
    const normalized = tab === 'cases' ? 'my_cases' : tab;
    localStorage.setItem(ACTIVE_TAB_KEY, normalized);
  } catch {
    // ignore
  }
}

/**
 * Gets the persisted navigation view ('landing', 'auth', or 'app').
 */
export function getPersistedView(): 'landing' | 'auth' | 'app' {
  try {
    const view = localStorage.getItem(AUTH_VIEW_KEY);
    if (view === 'app' || view === 'auth' || view === 'landing') {
      return view;
    }
  } catch {
    // ignore
  }
  return 'landing';
}

/**
 * Persists the navigation view.
 */
export function savePersistedView(view: 'landing' | 'auth' | 'app'): void {
  try {
    localStorage.setItem(AUTH_VIEW_KEY, view);
  } catch {
    // ignore
  }
}
