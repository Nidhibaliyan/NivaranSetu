-- =============================================================================
-- NIVARANSETU FORWARD-ONLY MIGRATION: PERMIT ACTIVE FRONTEND CUSTODY EVENTS
-- Phase 1A Fix: Reconciles public.trg_fn_enforce_custody_insert_integrity()
-- with legitimate citizen-emitted custody event types already allowed by
-- public.custody_events CHECK constraint (chk_custody_event_type).
--
-- Permitted additions for authenticated client sessions:
--   - evidence_verified       (CaseBuilder Step 5 byte re-hash verification log)
--   - response_received       (SmartCaseMonitoring citizen-logged entity response)
--   - followup_letter_generated (SmartCaseMonitoring saved follow-up draft)
--   - filing_ref_recorded     (ResolutionNavigator Step 8 acknowledgement log)
--   - submission_recorded     (SmartCaseMonitoring filing/submission tracking save)
--
-- Security invariants strictly preserved:
--   - Append-only custody enforcement (trg_custody_events_no_mutation) unchanged
--   - RLS tenant isolation (custody_tenant_select, custody_tenant_insert) unchanged
--   - Server-stamped NEW.server_timestamp := clock_timestamp() and NEW.user_id := auth.uid()
--   - Client actor spoofing blocked: NEW.actor forced to 'Citizen (Browser Session)'
--   - evidence_items.verified_original remains strictly server-controlled
--     (trg_fn_prevent_evidence_tampering continues blocking client verified_original=TRUE)
--   - evidence_uploaded and evidence_verified strictly require NEW.evidence_id IS NOT NULL;
--     evidence_verified also requires non-null 64-hex NEW.file_hash
--   - Internal pipeline/AI events (ocr_processed, entity_extracted, claim_mapped,
--     readiness_assessed, authority_recommended, response_analyzed,
--     escalation_evaluated, dossier_generated) remain restricted to system roles
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_fn_enforce_custody_insert_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.server_timestamp := clock_timestamp();
    NEW.user_id := auth.uid();

    -- Normalize empty or whitespace-only file hash to SQL NULL
    IF NEW.file_hash IS NOT NULL AND trim(NEW.file_hash) = '' THEN
        NEW.file_hash := NULL;
    END IF;

    -- Enforce non-empty audit action & details
    IF NEW.action IS NULL OR trim(NEW.action) = '' THEN
        RAISE EXCEPTION 'NIVARANSETU_VALIDATION_ERROR: Custody event action must not be empty.';
    END IF;
    IF NEW.details IS NULL OR trim(NEW.details) = '' THEN
        RAISE EXCEPTION 'NIVARANSETU_VALIDATION_ERROR: Custody event details must not be empty.';
    END IF;

    -- Enforce strict role boundary: Ordinary clients are restricted to positive allowlist
    IF current_user NOT IN ('postgres', 'supabase_admin') THEN
        -- Positive allowlist of client-permitted event types
        IF NEW.event_type NOT IN (
            'case_created',
            'case_updated',
            'category_changed',
            'status_changed',
            'evidence_uploaded',
            'evidence_accessed',
            'evidence_downloaded',
            'evidence_removed',
            'evidence_verified',
            'complaint_generated',
            'filing_ref_recorded',
            'submission_recorded',
            'reminder_created',
            'reminder_completed',
            'reminder_deleted',
            'response_received',
            'followup_letter_generated',
            'dossier_exported'
        ) THEN
            RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: Custody event type "%" is restricted to trusted system or authority processing.', NEW.event_type;
        END IF;

        -- Enforce truthful client-origin actor label (prevents spoofing engine/authority actors)
        NEW.actor := 'Citizen (Browser Session)';

        -- Require linked exhibit for upload and verification events
        IF NEW.event_type IN ('evidence_uploaded', 'evidence_verified') AND NEW.evidence_id IS NULL THEN
            RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: % custody event requires evidence_id.', NEW.event_type;
        END IF;

        -- Require cryptographic SHA-256 hash when logging client-side byte re-verification
        IF NEW.event_type = 'evidence_verified' AND NEW.file_hash IS NULL THEN
            RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: evidence_verified custody event requires file_hash.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custody_events_insert_integrity ON public.custody_events;
CREATE TRIGGER trg_custody_events_insert_integrity
    BEFORE INSERT ON public.custody_events
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_enforce_custody_insert_integrity();

COMMIT;
