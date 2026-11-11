/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import {
  GrievanceCase,
  EvidenceItem,
  TimelineEvent,
  CustodyEvent,
  CaseMonitoringData,
  NavigatorSession,
} from '../types';
import {
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
  assertValidUserUuid,
  assertValidCaseId,
} from './caseMappers';

/**
 * Obtains the authoritative user UUID strictly from the verified Supabase Auth session.
 * - If the cached session is nominally expired, attempts an automatic refresh via supabase.auth.refreshSession().
 * - Rejects safely if there is no session, if the refresh fails, or if the authenticated identity changed during refresh.
 * - Never trusts or accepts a user ID passed in from UI components.
 * - Database RLS remains the ultimate enforcement mechanism on every request.
 */
export async function getAuthoritativeUserId(client: SupabaseClient = supabase): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw new Error(`AUTH_SESSION_ERROR: Failed to retrieve active session: ${error.message}`);
  }
  let session = data?.session;
  if (!session?.user?.id) {
    throw new Error('AUTH_REQUIRED: Operation requires a verified Supabase authentication session.');
  }

  // If the session token is nominally expired, attempt a graceful refresh
  if (session.expires_at && Date.now() / 1000 >= session.expires_at) {
    const initialUserId = session.user.id;
    const { data: refreshData, error: refreshError } = await client.auth.refreshSession();
    if (refreshError || !refreshData?.session?.user?.id) {
      throw new Error(
        `AUTH_EXPIRED: The Supabase authentication session has expired and could not be refreshed: ${
          refreshError?.message || 'No refreshed session'
        }`
      );
    }

    // Safety guard: Ensure the authenticated user identity did not change during refresh
    if (refreshData.session.user.id !== initialUserId) {
      throw new Error(
        'AUTH_IDENTITY_CHANGED: Active authenticated identity changed during session refresh.'
      );
    }

    session = refreshData.session;
  }

  return assertValidUserUuid(session.user.id);
}

/**
 * Fetches all active (non-soft-deleted) grievance cases for the authenticated user,
 * along with all associated child records across the six database tables,
 * and reconstructs the complete domain GrievanceCase objects.
 */
export async function fetchCases(client: SupabaseClient = supabase): Promise<GrievanceCase[]> {
  const userId = await getAuthoritativeUserId(client);

  // 1. Fetch parent grievance cases
  const { data: caseRows, error: casesError } = await client
    .from('grievance_cases')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('last_updated', { ascending: false });

  if (casesError) {
    throw new Error(`FETCH_CASES_FAILED: ${casesError.message}`);
  }

  if (!caseRows || caseRows.length === 0) {
    return [];
  }

  const caseIds = caseRows.map((r) => r.id);

  // 2. Fetch all child records in parallel
  const [evidenceRes, timelineRes, custodyRes, monitoringRes] = await Promise.all([
    client
      .from('evidence_items')
      .select('*')
      .eq('user_id', userId)
      .in('case_id', caseIds)
      .is('deleted_at', null)
      .order('upload_date', { ascending: true }),

    client
      .from('timeline_events')
      .select('*')
      .eq('user_id', userId)
      .in('case_id', caseIds)
      .order('date', { ascending: true }),

    client
      .from('custody_events')
      .select('*')
      .eq('user_id', userId)
      .in('case_id', caseIds)
      .order('server_timestamp', { ascending: true }),

    client
      .from('case_monitoring')
      .select('*')
      .eq('user_id', userId)
      .in('case_id', caseIds),
  ]);

  if (evidenceRes.error) {
    throw new Error(`FETCH_EVIDENCE_FAILED: ${evidenceRes.error.message}`);
  }
  if (timelineRes.error) {
    throw new Error(`FETCH_TIMELINE_FAILED: ${timelineRes.error.message}`);
  }
  if (custodyRes.error) {
    throw new Error(`FETCH_CUSTODY_FAILED: ${custodyRes.error.message}`);
  }
  if (monitoringRes.error) {
    throw new Error(`FETCH_MONITORING_FAILED: ${monitoringRes.error.message}`);
  }

  // 3. Group child records by case_id
  const evidenceByCase: Record<string, EvidenceItem[]> = {};
  for (const row of evidenceRes.data || []) {
    if (!evidenceByCase[row.case_id]) evidenceByCase[row.case_id] = [];
    evidenceByCase[row.case_id].push(rowToEvidence(row));
  }

  const timelineByCase: Record<string, TimelineEvent[]> = {};
  for (const row of timelineRes.data || []) {
    if (!timelineByCase[row.case_id]) timelineByCase[row.case_id] = [];
    timelineByCase[row.case_id].push(rowToTimeline(row));
  }

  const custodyByCase: Record<string, CustodyEvent[]> = {};
  for (const row of custodyRes.data || []) {
    if (!custodyByCase[row.case_id]) custodyByCase[row.case_id] = [];
    custodyByCase[row.case_id].push(rowToCustody(row));
  }

  const monitoringByCase: Record<string, CaseMonitoringData> = {};
  for (const row of monitoringRes.data || []) {
    monitoringByCase[row.case_id] = rowToMonitoring(row);
  }

  // 4. Assemble domain objects
  return caseRows.map((cRow) => {
    return rowToCase(cRow, {
      evidence: evidenceByCase[cRow.id] || [],
      timeline: timelineByCase[cRow.id] || [],
      custodyEvents: custodyByCase[cRow.id] || [],
      monitoring: monitoringByCase[cRow.id] || undefined,
    });
  });
}

/**
 * Persists a GrievanceCase and all its associated child records to Supabase.
 * - Strictly enforces parent-first persistence ordering to satisfy composite foreign keys.
 * - Respects the immutable custody ledger (trg_custody_events_no_mutation) by inserting ONLY new records.
 * - Handles partial database failures explicitly; never reports success if any record fails.
 * - Retries are safe and idempotent.
 */
export async function saveCase(caseData: GrievanceCase, client: SupabaseClient = supabase): Promise<GrievanceCase> {
  const userId = await getAuthoritativeUserId(client);
  const validCaseId = assertValidCaseId(caseData.id);

  // STEP 1: Persist parent grievance case first
  const caseRow = caseToRow(caseData, userId);
  const { error: caseError } = await client
    .from('grievance_cases')
    .upsert(caseRow, { onConflict: 'user_id,id' });

  if (caseError) {
    throw new Error(`CASE_SAVE_FAILED: Failed to save parent case "${validCaseId}": ${caseError.message}`);
  }

  // STEP 2: Persist Evidence Items (Carefully respecting trg_prevent_evidence_tampering)
  // - Genuinely new exhibits are INSERTED.
  // - Existing exhibits are NOT unconditionally upserted (to prevent triggering immutability violations on verified_original or hashes).
  // - If an existing exhibit has modified mutable fields (title, category, raw_ocr_text, ocr_extracted, flag, claim_mapped_to),
  //   ONLY those mutable fields are updated.
  // - Unchanged exhibits are skipped completely with zero database writes.
  if (caseData.evidence && caseData.evidence.length > 0) {
    const { data: existingEvRows, error: fetchEvErr } = await client
      .from('evidence_items')
      .select('id, title, category, raw_ocr_text, ocr_extracted, flag, claim_mapped_to')
      .eq('user_id', userId)
      .eq('case_id', validCaseId)
      .is('deleted_at', null);

    if (fetchEvErr) {
      throw new Error(
        `EVIDENCE_QUERY_FAILED: Failed to check existing exhibits on case "${validCaseId}": ${fetchEvErr.message}`
      );
    }

    const existingEvMap = new Map((existingEvRows || []).map((r: any) => [r.id, r]));

    for (const ev of caseData.evidence) {
      const existing = existingEvMap.get(ev.id);

      if (!existing) {
        // Genuinely new evidence item -> INSERT
        const evRow = evidenceToRow(ev, userId, validCaseId);
        const { error: insertErr } = await client
          .from('evidence_items')
          .insert(evRow);

        if (insertErr) {
          throw new Error(
            `EVIDENCE_SAVE_FAILED: Failed to insert new exhibit "${ev.id}" on case "${validCaseId}": ${insertErr.message}`
          );
        }
      } else {
        // Existing evidence item -> determine if any mutable fields have legitimately changed
        const mutableUpdates: Record<string, any> = {};

        const cleanTitle = ev.title?.trim().substring(0, 255) || 'Untitled Exhibit';
        if (cleanTitle !== existing.title) {
          mutableUpdates.title = cleanTitle;
        }

        const cleanCategory = ev.category || 'receipt';
        if (cleanCategory !== existing.category) {
          mutableUpdates.category = cleanCategory;
        }

        const cleanOcrText = ev.rawOcrText?.trim() || null;
        if (cleanOcrText !== (existing.raw_ocr_text || null)) {
          mutableUpdates.raw_ocr_text = cleanOcrText;
        }

        const currentOcrExtracted = {
          dates: Array.isArray(ev.ocrExtracted?.dates) ? ev.ocrExtracted.dates : [],
          amounts: Array.isArray(ev.ocrExtracted?.amounts) ? ev.ocrExtracted.amounts : [],
          identifiers: Array.isArray(ev.ocrExtracted?.identifiers) ? ev.ocrExtracted.identifiers : [],
          parties: Array.isArray(ev.ocrExtracted?.parties) ? ev.ocrExtracted.parties : [],
          summary: ev.ocrExtracted?.summary || '',
        };
        if (JSON.stringify(currentOcrExtracted) !== JSON.stringify(existing.ocr_extracted || {})) {
          mutableUpdates.ocr_extracted = currentOcrExtracted;
        }

        const currentFlag = ev.flag || null;
        if (JSON.stringify(currentFlag) !== JSON.stringify(existing.flag || null)) {
          mutableUpdates.flag = currentFlag;
        }

        const cleanClaimMapped = ev.claimMappedTo?.trim() || null;
        if (cleanClaimMapped !== (existing.claim_mapped_to || null)) {
          mutableUpdates.claim_mapped_to = cleanClaimMapped;
        }

        // Only issue an UPDATE if mutable fields actually changed
        if (Object.keys(mutableUpdates).length > 0) {
          const { error: updateErr } = await client
            .from('evidence_items')
            .update(mutableUpdates)
            .eq('user_id', userId)
            .eq('case_id', validCaseId)
            .eq('id', ev.id);

          if (updateErr) {
            throw new Error(
              `EVIDENCE_UPDATE_FAILED: Failed to update mutable fields for exhibit "${ev.id}" on case "${validCaseId}": ${updateErr.message}`
            );
          }
        }
        // If no mutable fields changed, skip safely with no database write!
      }
    }
  }

  // STEP 3: Upsert Timeline Events
  if (caseData.timeline && caseData.timeline.length > 0) {
    for (const tl of caseData.timeline) {
      const tlRow = timelineToRow(tl, userId, validCaseId);
      const { error: tlError } = await client
        .from('timeline_events')
        .upsert(tlRow, { onConflict: 'user_id,case_id,id' });

      if (tlError) {
        throw new Error(
          `TIMELINE_SAVE_FAILED: Failed to save timeline milestone "${tl.id}" on case "${validCaseId}": ${tlError.message}`
        );
      }
    }
  }

  // STEP 4: Append-Only Custody Events
  // Custody events are immutable (guarded by trg_custody_events_no_mutation).
  // We query existing IDs and insert ONLY genuinely new records, never attempting an UPDATE.
  if (caseData.custodyEvents && caseData.custodyEvents.length > 0) {
    const { data: existingRows, error: fetchErr } = await client
      .from('custody_events')
      .select('id')
      .eq('user_id', userId)
      .eq('case_id', validCaseId);

    if (fetchErr) {
      throw new Error(
        `CUSTODY_QUERY_FAILED: Failed to check existing custody events for case "${validCaseId}": ${fetchErr.message}`
      );
    }

    const existingIds = new Set((existingRows || []).map((r) => r.id));
    const newEvents = caseData.custodyEvents.filter((e) => !existingIds.has(e.id));

    for (const ce of newEvents) {
      const ceRow = custodyToRow(ce, userId);
      const { error: ceError } = await client
        .from('custody_events')
        .insert(ceRow);

      if (ceError) {
        throw new Error(
          `CUSTODY_APPEND_FAILED: Failed to append custody event "${ce.id}" on case "${validCaseId}": ${ceError.message}`
        );
      }
    }
  }

  // STEP 5: Upsert Case Monitoring
  if (caseData.monitoring) {
    const monRow = monitoringToRow(caseData.monitoring, userId, validCaseId);
    const { error: monError } = await client
      .from('case_monitoring')
      .upsert(monRow, { onConflict: 'user_id,case_id' });

    if (monError) {
      throw new Error(
        `MONITORING_SAVE_FAILED: Failed to save case monitoring for case "${validCaseId}": ${monError.message}`
      );
    }
  }

  return caseData;
}

/**
 * Soft-deletes a grievance case and its associated exhibits by setting deleted_at = now().
 * RLS policies automatically filter soft-deleted cases out of active citizen queries.
 */
export async function softDeleteCase(caseId: string, client: SupabaseClient = supabase): Promise<void> {
  const userId = await getAuthoritativeUserId(client);
  const validCaseId = assertValidCaseId(caseId);
  const now = new Date().toISOString();

  // 1. Soft-delete parent case
  const { error: caseErr } = await client
    .from('grievance_cases')
    .update({ deleted_at: now })
    .eq('user_id', userId)
    .eq('id', validCaseId)
    .is('deleted_at', null);

  if (caseErr) {
    throw new Error(`SOFT_DELETE_CASE_FAILED: Failed to soft-delete case "${validCaseId}": ${caseErr.message}`);
  }

  // 2. Soft-delete child exhibits
  const { error: evErr } = await client
    .from('evidence_items')
    .update({ deleted_at: now })
    .eq('user_id', userId)
    .eq('case_id', validCaseId)
    .is('deleted_at', null);

  if (evErr) {
    console.warn(`Warning: Failed to soft-delete exhibits for case "${validCaseId}":`, evErr.message);
  }
}

/**
 * Soft-deletes all active cases for the authenticated user.
 */
export async function softDeleteAllCases(client: SupabaseClient = supabase): Promise<void> {
  const userId = await getAuthoritativeUserId(client);
  const now = new Date().toISOString();

  const { error: caseErr } = await client
    .from('grievance_cases')
    .update({ deleted_at: now })
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (caseErr) {
    throw new Error(`SOFT_DELETE_ALL_FAILED: Failed to soft-delete cases: ${caseErr.message}`);
  }
}

/**
 * Seeds the 4 canonical demonstration scenarios into the authenticated user's account
 * by invoking the database stored procedure public.seed_demo_cases_for_current_user().
 */
export async function seedDemoCasesForUser(client: SupabaseClient = supabase): Promise<void> {
  await getAuthoritativeUserId(client);

  const { error } = await client.rpc('seed_demo_cases_for_current_user');
  if (error) {
    throw new Error(`SEED_DEMO_CASES_FAILED: Failed to seed demo cases: ${error.message}`);
  }
}

/**
 * Persists active Navigator progress (step, ack reference) to public.navigator_sessions.
 */
export async function saveNavigatorSession(session: NavigatorSession, client: SupabaseClient = supabase): Promise<void> {
  const userId = await getAuthoritativeUserId(client);
  const row = navigatorSessionToRow(session, userId);

  const { error } = await client
    .from('navigator_sessions')
    .upsert(row, { onConflict: 'user_id,case_id' });

  if (error) {
    throw new Error(`NAVIGATOR_SAVE_FAILED: Failed to save navigator session: ${error.message}`);
  }
}

/**
 * Fetches saved Navigator session progress for a case.
 */
export async function fetchNavigatorSession(caseId: string, client: SupabaseClient = supabase): Promise<NavigatorSession | null> {
  const userId = await getAuthoritativeUserId(client);
  const validCaseId = assertValidCaseId(caseId);

  const { data, error } = await client
    .from('navigator_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('case_id', validCaseId)
    .maybeSingle();

  if (error) {
    throw new Error(`NAVIGATOR_FETCH_FAILED: Failed to fetch navigator session: ${error.message}`);
  }

  return data ? rowToNavigatorSession(data) : null;
}
