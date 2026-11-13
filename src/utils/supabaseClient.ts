/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Auto-load .env.local if running in Node environment (e.g. test runner)
if (typeof process !== 'undefined' && typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile('.env.local');
  } catch {
    // Ignore if file not found or already loaded
  }
}

// Singleton instance holder to ensure client is initialized only once
let supabaseInstance: SupabaseClient | null = null;

export function resolveConfig(): { url: string; key: string } {
  let url = '';
  let key = '';

  // Vite environment
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      url = import.meta.env.VITE_SUPABASE_URL || '';
      key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
    }
  } catch {}

  // Process environment fallback (Node / tsx test runners)
  if (!url && typeof process !== 'undefined' && process.env) {
    url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  }
  if (!key && typeof process !== 'undefined' && process.env) {
    key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  }

  return { url: url.trim(), key: key.trim() };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = resolveConfig();
  return Boolean(url && key);
}

/**
 * Validates environment variables and initializes/returns the singleton Supabase client.
 * Safe validation produces descriptive errors without logging or revealing sensitive credentials.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const { url, key } = resolveConfig();

  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error(
      'Missing Supabase configuration: VITE_SUPABASE_URL is not set. Verify that VITE_SUPABASE_URL is defined in .env.local.'
    );
  }

  if (!key || typeof key !== 'string' || !key.trim()) {
    throw new Error(
      'Missing Supabase configuration: VITE_SUPABASE_PUBLISHABLE_KEY is not set. Verify that VITE_SUPABASE_PUBLISHABLE_KEY is defined in .env.local.'
    );
  }

  supabaseInstance = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return supabaseInstance;
}

/**
 * Creates an isolated, non-persisted Supabase client instance using project credentials.
 * - persistSession: false (in-memory only, never reads or writes localStorage).
 * - autoRefreshToken: false (no background timers or automatic token exchange).
 * - detectSessionInUrl: false (does not inspect browser URL hashes).
 * Used exclusively for dedicated test runs or background tasks to avoid mutating the user's active session.
 */
export function createIsolatedClient(): SupabaseClient {
  const { url, key } = resolveConfig();

  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error(
      'Missing Supabase configuration: VITE_SUPABASE_URL is not set. Verify that VITE_SUPABASE_URL is defined in .env.local.'
    );
  }

  if (!key || typeof key !== 'string' || !key.trim()) {
    throw new Error(
      'Missing Supabase configuration: VITE_SUPABASE_PUBLISHABLE_KEY is not set. Verify that VITE_SUPABASE_PUBLISHABLE_KEY is defined in .env.local.'
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Exported singleton Supabase client instance.
 */
export const supabase: SupabaseClient = getSupabaseClient();
