-- =============================================================================
-- NIVARANSETU PRODUCTION DATABASE DEFINITION: FRESH INSTALLATION
-- Version: 2.0.0 (Hardened Production Schema)
-- Engine Requirement: PostgreSQL 15.0+ (Required for column-targeted ON DELETE SET NULL)
-- Transactional: Safe execution wrapped in transaction block.
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 0: PRE-FLIGHT ENGINE VERSION CHECK
-- =============================================================================
DO $$
DECLARE
    v_server_version INTEGER;
BEGIN
    SELECT current_setting('server_version_num')::integer INTO v_server_version;
    IF v_server_version < 150000 THEN
        RAISE EXCEPTION 'NIVARANSETU_INSTALL_ABORTED: PostgreSQL 15.0 or higher is strictly required for column-targeted ON DELETE SET NULL (evidence_id). Current server_version_num is %.', v_server_version;
    END IF;
    RAISE NOTICE 'NivaranSetu Pre-flight: PostgreSQL version check passed (server_version_num = %).', v_server_version;
END $$;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TABLE: public.grievance_cases
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grievance_cases (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    id TEXT NOT NULL,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 255),
    category TEXT NOT NULL CHECK (category IN (
        'banking_financial',
        'consumer_ecommerce',
        'municipal_civic',
        'telecom_isp',
        'real_estate_rera',
        'insurance_claims',
        'employment_labour',
        'utilities_power'
    )),
    stage TEXT NOT NULL CHECK (stage IN (
        'drafting',
        'evidence_gathering',
        'readiness_check',
        'ready_to_file',
        'filed_externally',
        'escalated'
    )),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active',
        'pending_attention',
        'ready',
        'resolved'
    )),
    is_sample_data BOOLEAN NOT NULL DEFAULT FALSE,
    incident_date TEXT NULL,
    incident_location TEXT NOT NULL DEFAULT '',
    involved_entity TEXT NOT NULL DEFAULT '',
    disputed_amount NUMERIC(14, 2) NULL CHECK (disputed_amount IS NULL OR disputed_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    description TEXT NOT NULL DEFAULT '',
    simple_summary TEXT NOT NULL DEFAULT '',
    readiness_score INTEGER NOT NULL DEFAULT 0 CHECK (readiness_score BETWEEN 0 AND 100),
    readiness_breakdown JSONB NOT NULL DEFAULT '{
        "evidenceCompleteness": 0,
        "timelineClarity": 0,
        "identityProof": 0,
        "formalNoticeSent": 0
    }'::jsonb,
    recommended_authority JSONB NOT NULL DEFAULT '{
        "name": "",
        "portalName": "",
        "portalUrl": "",
        "filingFee": "",
        "averageResolutionTime": ""
    }'::jsonb,
    complaint_draft JSONB NOT NULL DEFAULT '{
        "subject": "",
        "formalBody": "",
        "simpleBody": "",
        "reliefSought": ""
    }'::jsonb,
    missing_elements JSONB NOT NULL DEFAULT '[]'::jsonb,
    filing_details JSONB NULL,
    trust_check_record JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deleted_at TIMESTAMPTZ NULL,

    CONSTRAINT pk_grievance_cases PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grievance_cases_tenant_active 
    ON public.grievance_cases (user_id, deleted_at) 
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. TABLE: public.evidence_items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evidence_items (
    user_id UUID NOT NULL,
    case_id TEXT NOT NULL,
    id TEXT NOT NULL,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 255),
    category TEXT NOT NULL CHECK (category IN (
        'receipt',
        'correspondence',
        'screenshot',
        'agreement',
        'notice',
        'bank_statement'
    )),
    file_name TEXT NOT NULL CHECK (char_length(file_name) <= 255),
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
    file_size_formatted TEXT NOT NULL,
    file_type TEXT NOT NULL,
    upload_date TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    sha256_hash TEXT NULL CHECK (sha256_hash IS NULL OR sha256_hash ~ '^[0-9a-fA-F]{64}$'),
    storage_ref TEXT NULL,
    raw_ocr_text TEXT NULL,
    has_blob BOOLEAN NOT NULL DEFAULT FALSE,
    ocr_extracted JSONB NOT NULL DEFAULT '{
        "dates": [],
        "amounts": [],
        "identifiers": [],
        "parties": [],
        "summary": ""
    }'::jsonb,
    flag JSONB NULL,
    claim_mapped_to TEXT NULL,
    verified_original BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deleted_at TIMESTAMPTZ NULL,

    CONSTRAINT pk_evidence_items PRIMARY KEY (user_id, case_id, id),
    CONSTRAINT fk_evidence_parent_case FOREIGN KEY (user_id, case_id)
        REFERENCES public.grievance_cases (user_id, id)
        ON DELETE RESTRICT,
    -- Truthful synthetic vs uploaded binary integrity constraint
    CONSTRAINT chk_evidence_blob_hash_integrity CHECK (
        (has_blob = TRUE AND storage_ref IS NOT NULL AND sha256_hash IS NOT NULL)
        OR
        (has_blob = FALSE AND storage_ref IS NULL AND verified_original = FALSE AND sha256_hash IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_lookup 
    ON public.evidence_items (user_id, case_id, deleted_at)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 3. TABLE: public.timeline_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timeline_events (
    user_id UUID NOT NULL,
    case_id TEXT NOT NULL,
    id TEXT NOT NULL,
    evidence_id TEXT NULL,
    date TEXT NOT NULL,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 255),
    description TEXT NOT NULL DEFAULT '',
    verified_by_doc BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT pk_timeline_events PRIMARY KEY (user_id, case_id, id),
    CONSTRAINT fk_timeline_parent_case FOREIGN KEY (user_id, case_id)
        REFERENCES public.grievance_cases (user_id, id)
        ON DELETE RESTRICT,
    -- Column-targeted NULLification strictly on evidence_id (PostgreSQL 15+)
    CONSTRAINT fk_timeline_evidence FOREIGN KEY (user_id, case_id, evidence_id)
        REFERENCES public.evidence_items (user_id, case_id, id)
        ON DELETE SET NULL (evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_lookup 
    ON public.timeline_events (user_id, case_id);

-- -----------------------------------------------------------------------------
-- 4. TABLE: public.custody_events (FORENSIC AUDIT LEDGER)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custody_events (
    user_id UUID NOT NULL,
    case_id TEXT NOT NULL,
    id TEXT NOT NULL,
    evidence_id TEXT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'case_created',
        'case_updated',
        'category_changed',
        'status_changed',
        'evidence_uploaded',
        'evidence_accessed',
        'evidence_downloaded',
        'evidence_removed',
        'evidence_verified',
        'ocr_processed',
        'entity_extracted',
        'claim_mapped',
        'readiness_assessed',
        'complaint_generated',
        'authority_recommended',
        'filing_ref_recorded',
        'submission_recorded',
        'reminder_created',
        'reminder_completed',
        'reminder_deleted',
        'response_received',
        'response_analyzed',
        'escalation_evaluated',
        'followup_letter_generated',
        'dossier_generated',
        'dossier_exported'
    )),
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    client_timestamp TIMESTAMPTZ NOT NULL,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    details TEXT NOT NULL,
    file_hash TEXT NULL CHECK (file_hash IS NULL OR file_hash ~ '^[0-9a-fA-F]{64}$'),

    CONSTRAINT pk_custody_events PRIMARY KEY (user_id, case_id, id),
    CONSTRAINT fk_custody_parent_case FOREIGN KEY (user_id, case_id)
        REFERENCES public.grievance_cases (user_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_custody_evidence FOREIGN KEY (user_id, case_id, evidence_id)
        REFERENCES public.evidence_items (user_id, case_id, id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_custody_events_chronology 
    ON public.custody_events (user_id, case_id, server_timestamp ASC);

-- -----------------------------------------------------------------------------
-- 5. TABLE: public.case_monitoring
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_monitoring (
    user_id UUID NOT NULL,
    case_id TEXT NOT NULL,
    submission_date TEXT NULL,
    submission_time TEXT NULL,
    official_portal TEXT NULL,
    department TEXT NULL,
    docket_number TEXT NULL,
    citizen_reported_status TEXT NOT NULL DEFAULT 'not_submitted' CHECK (citizen_reported_status IN (
        'not_submitted',
        'submitted',
        'in_progress',
        'response_received',
        'resolved',
        'unresolved',
        'escalated'
    )),
    statutory_deadline_days INTEGER NOT NULL DEFAULT 30 CHECK (statutory_deadline_days >= 0),
    statutory_deadline_date TEXT NULL,
    reminders JSONB NOT NULL DEFAULT '[]'::jsonb,
    responses JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_letters JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_evaluated_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT pk_case_monitoring PRIMARY KEY (user_id, case_id),
    CONSTRAINT fk_monitoring_parent_case FOREIGN KEY (user_id, case_id)
        REFERENCES public.grievance_cases (user_id, id)
        ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- 6. TABLE: public.navigator_sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.navigator_sessions (
    user_id UUID NOT NULL,
    case_id TEXT NOT NULL,
    guide_id TEXT NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 1 CONSTRAINT chk_navigator_sessions_step_range CHECK (current_step BETWEEN 1 AND 8),
    ack_number TEXT NOT NULL DEFAULT '',
    ack_filing_date TEXT NOT NULL DEFAULT '',
    saved_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT pk_navigator_sessions PRIMARY KEY (user_id, case_id),
    CONSTRAINT fk_navigator_parent_case FOREIGN KEY (user_id, case_id)
        REFERENCES public.grievance_cases (user_id, id)
        ON DELETE RESTRICT
);

-- =============================================================================
-- TRIGGERS & SECURITY INVOKER INTEGRITY SAFEGUARDS
-- =============================================================================

-- Guard 1: Append-only custody enforcement
CREATE OR REPLACE FUNCTION public.trg_fn_prevent_custody_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: Custody records are immutable append-only audit events.';
END;
$$;

DROP TRIGGER IF EXISTS trg_custody_events_no_mutation ON public.custody_events;
CREATE TRIGGER trg_custody_events_no_mutation
    BEFORE UPDATE OR DELETE ON public.custody_events
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_prevent_custody_mutation();

-- Guard 2: Enforce server timestamp, authenticated UID, truthful actor, and restricted client event types
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
            'complaint_generated',
            'reminder_created',
            'reminder_completed',
            'reminder_deleted',
            'dossier_exported'
        ) THEN
            RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: Custody event type "%" is restricted to trusted system or authority processing.', NEW.event_type;
        END IF;

        -- Enforce truthful client-origin actor label
        NEW.actor := 'Citizen (Browser Session)';

        -- Require evidence_id for upload events
        IF NEW.event_type = 'evidence_uploaded' AND NEW.evidence_id IS NULL THEN
            RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: evidence_uploaded custody event requires evidence_id.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custody_events_insert_integrity ON public.custody_events;
CREATE TRIGGER trg_custody_events_insert_integrity
    BEFORE INSERT ON public.custody_events
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_enforce_custody_insert_integrity();

-- Guard 3: Case immutability checks using IS DISTINCT FROM
CREATE OR REPLACE FUNCTION public.trg_fn_prevent_case_key_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: Modification of user_id is prohibited.';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: Modification of case id is prohibited.';
    END IF;
    IF NEW.is_sample_data IS DISTINCT FROM OLD.is_sample_data THEN
        RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: is_sample_data classification is immutable once set.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_case_mutation ON public.grievance_cases;
CREATE TRIGGER trg_prevent_case_mutation
    BEFORE UPDATE ON public.grievance_cases
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_prevent_case_key_mutation();

-- Guard 4: Evidence insert & update safeguards (prevents client-forged verified_original)
CREATE OR REPLACE FUNCTION public.trg_fn_prevent_evidence_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Normalize empty or whitespace-only sha256_hash to SQL NULL
    IF NEW.sha256_hash IS NOT NULL AND trim(NEW.sha256_hash) = '' THEN
        NEW.sha256_hash := NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Ordinary authenticated clients cannot assert verified_original = TRUE
        IF current_user NOT IN ('postgres', 'supabase_admin') THEN
            IF NEW.verified_original IS TRUE THEN
                NEW.verified_original := FALSE;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.user_id IS DISTINCT FROM OLD.user_id OR 
           NEW.case_id IS DISTINCT FROM OLD.case_id OR 
           NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: Reassignment of evidence composite keys is prohibited.';
        END IF;

        IF NEW.sha256_hash IS DISTINCT FROM OLD.sha256_hash AND OLD.sha256_hash IS NOT NULL THEN
            RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: sha256_hash is cryptographically immutable once recorded.';
        END IF;

        IF NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes OR 
           NEW.file_name IS DISTINCT FROM OLD.file_name THEN
            RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: Ingested file metadata (name, byte size) is immutable.';
        END IF;

        IF OLD.storage_ref IS NOT NULL AND NEW.storage_ref IS DISTINCT FROM OLD.storage_ref THEN
            RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: storage_ref cannot be altered once assigned.';
        END IF;

        IF NEW.has_blob IS DISTINCT FROM OLD.has_blob THEN
            RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: has_blob flag is immutable after creation.';
        END IF;

        -- Prevent toggling verified_original via direct client SQL update
        IF current_user NOT IN ('postgres', 'supabase_admin') THEN
            IF (OLD.verified_original IS DISTINCT FROM TRUE) AND NEW.verified_original = TRUE THEN
                RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: verified_original status cannot be toggled via direct client update.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_evidence_tampering ON public.evidence_items;
CREATE TRIGGER trg_prevent_evidence_tampering
    BEFORE INSERT OR UPDATE ON public.evidence_items
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_prevent_evidence_tampering();

-- Guard 5: Child table composite key immutability
CREATE OR REPLACE FUNCTION public.trg_fn_prevent_child_key_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.case_id IS DISTINCT FROM OLD.case_id THEN
        RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: Modification of user_id or case_id is prohibited.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_timeline_key_mutation ON public.timeline_events;
CREATE TRIGGER trg_prevent_timeline_key_mutation
    BEFORE UPDATE ON public.timeline_events
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_prevent_child_key_mutation();

DROP TRIGGER IF EXISTS trg_prevent_monitoring_key_mutation ON public.case_monitoring;
CREATE TRIGGER trg_prevent_monitoring_key_mutation
    BEFORE UPDATE ON public.case_monitoring
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_prevent_child_key_mutation();

DROP TRIGGER IF EXISTS trg_prevent_navigator_key_mutation ON public.navigator_sessions;
CREATE TRIGGER trg_prevent_navigator_key_mutation
    BEFORE UPDATE ON public.navigator_sessions
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_prevent_child_key_mutation();

-- Guard 6: Automatic last_updated timestamp on grievance cases
CREATE OR REPLACE FUNCTION public.trg_fn_touch_last_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.last_updated := clock_timestamp();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_case_updated ON public.grievance_cases;
CREATE TRIGGER trg_touch_case_updated
    BEFORE UPDATE ON public.grievance_cases
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_touch_last_updated();

-- =============================================================================
-- SCOPED PRIVILEGES & ROW LEVEL SECURITY
-- =============================================================================

REVOKE ALL ON TABLE public.grievance_cases FROM anon, public;
REVOKE ALL ON TABLE public.evidence_items FROM anon, public;
REVOKE ALL ON TABLE public.timeline_events FROM anon, public;
REVOKE ALL ON TABLE public.custody_events FROM anon, public;
REVOKE ALL ON TABLE public.case_monitoring FROM anon, public;
REVOKE ALL ON TABLE public.navigator_sessions FROM anon, public;

REVOKE DELETE ON public.grievance_cases FROM authenticated;
REVOKE DELETE ON public.evidence_items FROM authenticated;
REVOKE DELETE ON public.case_monitoring FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON public.grievance_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evidence_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timeline_events TO authenticated;
GRANT SELECT, INSERT ON public.custody_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.case_monitoring TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.navigator_sessions TO authenticated;

ALTER TABLE public.grievance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigator_sessions ENABLE ROW LEVEL SECURITY;

-- Cases RLS: is_sample_data = FALSE enforced on authenticated INSERT
DROP POLICY IF EXISTS "cases_tenant_select" ON public.grievance_cases;
CREATE POLICY "cases_tenant_select" ON public.grievance_cases
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "cases_tenant_insert" ON public.grievance_cases;
CREATE POLICY "cases_tenant_insert" ON public.grievance_cases
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id AND is_sample_data = FALSE);

DROP POLICY IF EXISTS "cases_tenant_update" ON public.grievance_cases;
CREATE POLICY "cases_tenant_update" ON public.grievance_cases
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = user_id);

-- Evidence RLS
DROP POLICY IF EXISTS "evidence_tenant_select" ON public.evidence_items;
CREATE POLICY "evidence_tenant_select" ON public.evidence_items
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = evidence_items.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "evidence_tenant_insert" ON public.evidence_items;
CREATE POLICY "evidence_tenant_insert" ON public.evidence_items
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = evidence_items.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "evidence_tenant_update" ON public.evidence_items;
CREATE POLICY "evidence_tenant_update" ON public.evidence_items
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = user_id AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = evidence_items.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    )
    WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = evidence_items.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

-- Timeline RLS
DROP POLICY IF EXISTS "timeline_tenant_select" ON public.timeline_events;
CREATE POLICY "timeline_tenant_select" ON public.timeline_events
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = timeline_events.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "timeline_tenant_insert" ON public.timeline_events;
CREATE POLICY "timeline_tenant_insert" ON public.timeline_events
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = timeline_events.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "timeline_tenant_update" ON public.timeline_events;
CREATE POLICY "timeline_tenant_update" ON public.timeline_events
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = timeline_events.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    )
    WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = timeline_events.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "timeline_tenant_delete" ON public.timeline_events;
CREATE POLICY "timeline_tenant_delete" ON public.timeline_events
    FOR DELETE TO authenticated
    USING (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = timeline_events.case_id AND gc.user_id = auth.uid()
        )
    );

-- Custody RLS
DROP POLICY IF EXISTS "custody_tenant_select" ON public.custody_events;
CREATE POLICY "custody_tenant_select" ON public.custody_events
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = custody_events.case_id AND gc.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "custody_tenant_insert" ON public.custody_events;
CREATE POLICY "custody_tenant_insert" ON public.custody_events
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = custody_events.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

-- Monitoring RLS
DROP POLICY IF EXISTS "monitoring_tenant_select" ON public.case_monitoring;
CREATE POLICY "monitoring_tenant_select" ON public.case_monitoring
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = case_monitoring.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "monitoring_tenant_insert" ON public.case_monitoring;
CREATE POLICY "monitoring_tenant_insert" ON public.case_monitoring
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = case_monitoring.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "monitoring_tenant_update" ON public.case_monitoring;
CREATE POLICY "monitoring_tenant_update" ON public.case_monitoring
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = case_monitoring.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    )
    WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = case_monitoring.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

-- Navigator Sessions RLS
DROP POLICY IF EXISTS "navigator_tenant_select" ON public.navigator_sessions;
CREATE POLICY "navigator_tenant_select" ON public.navigator_sessions
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = navigator_sessions.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "navigator_tenant_insert" ON public.navigator_sessions;
CREATE POLICY "navigator_tenant_insert" ON public.navigator_sessions
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = navigator_sessions.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "navigator_tenant_update" ON public.navigator_sessions;
CREATE POLICY "navigator_tenant_update" ON public.navigator_sessions
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = navigator_sessions.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    )
    WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = navigator_sessions.case_id AND gc.user_id = auth.uid() AND gc.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "navigator_tenant_delete" ON public.navigator_sessions;
CREATE POLICY "navigator_tenant_delete" ON public.navigator_sessions
    FOR DELETE TO authenticated
    USING (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = navigator_sessions.case_id AND gc.user_id = auth.uid()
        )
    );

-- =============================================================================
-- STORAGE BUCKET SPECIFICATION & IMMUTABLE RESTRICTIVE OVERRIDES
-- Path: <user_id>/<case_id>/<evidence_id>/<file_name>
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evidence',
    'evidence',
    FALSE,
    26214400,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
    public = FALSE,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- RESTRICTIVE POLICIES: Evaluated with logical AND against all permissive policies on storage.objects.
-- Applies TO public (authenticated + anon). Guarantees that even if generic permissive policies
-- exist (e.g. public access or bucket-agnostic reads/inserts), operations on bucket 'evidence'
-- CANNOT bypass tenant isolation. Other buckets remain completely unaffected (bucket_id <> 'evidence').

DROP POLICY IF EXISTS "evidence_bucket_restrict_select" ON storage.objects;
CREATE POLICY "evidence_bucket_restrict_select" ON storage.objects
    AS RESTRICTIVE
    FOR SELECT TO public
    USING (
        bucket_id <> 'evidence'
        OR (
            auth.role() = 'authenticated'
            AND split_part(name, '/', 1) = auth.uid()::text
            AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[a-zA-Z0-9_-]{3,64}/[a-zA-Z0-9_-]{3,64}/[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127}$'
            AND name NOT LIKE '%..%'
            AND EXISTS (
                SELECT 1 FROM public.grievance_cases gc
                WHERE gc.id = split_part(name, '/', 2)
                  AND gc.user_id = auth.uid()
                  AND gc.deleted_at IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "evidence_bucket_restrict_insert" ON storage.objects;
CREATE POLICY "evidence_bucket_restrict_insert" ON storage.objects
    AS RESTRICTIVE
    FOR INSERT TO public
    WITH CHECK (
        bucket_id <> 'evidence'
        OR (
            auth.role() = 'authenticated'
            AND split_part(name, '/', 1) = auth.uid()::text
            AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[a-zA-Z0-9_-]{3,64}/[a-zA-Z0-9_-]{3,64}/[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127}$'
            AND name NOT LIKE '%..%'
            AND EXISTS (
                SELECT 1 FROM public.grievance_cases gc
                WHERE gc.id = split_part(name, '/', 2)
                  AND gc.user_id = auth.uid()
                  AND gc.deleted_at IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "evidence_bucket_restrict_updates" ON storage.objects;
CREATE POLICY "evidence_bucket_restrict_updates" ON storage.objects
    AS RESTRICTIVE
    FOR UPDATE TO public
    USING (bucket_id <> 'evidence');

DROP POLICY IF EXISTS "evidence_bucket_restrict_deletes" ON storage.objects;
CREATE POLICY "evidence_bucket_restrict_deletes" ON storage.objects
    AS RESTRICTIVE
    FOR DELETE TO public
    USING (bucket_id <> 'evidence');

-- PERMISSIVE POLICIES: Grants access to authenticated owner for bucket 'evidence'
DROP POLICY IF EXISTS "evidence_storage_select" ON storage.objects;
CREATE POLICY "evidence_storage_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'evidence'
        AND split_part(name, '/', 1) = auth.uid()::text
        AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[a-zA-Z0-9_-]{3,64}/[a-zA-Z0-9_-]{3,64}/[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127}$'
        AND name NOT LIKE '%..%'
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = split_part(name, '/', 2)
              AND gc.user_id = auth.uid()
              AND gc.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS "evidence_storage_insert" ON storage.objects;
CREATE POLICY "evidence_storage_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'evidence'
        AND split_part(name, '/', 1) = auth.uid()::text
        AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[a-zA-Z0-9_-]{3,64}/[a-zA-Z0-9_-]{3,64}/[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127}$'
        AND name NOT LIKE '%..%'
        AND EXISTS (
            SELECT 1 FROM public.grievance_cases gc
            WHERE gc.id = split_part(name, '/', 2)
              AND gc.user_id = auth.uid()
              AND gc.deleted_at IS NULL
        )
    );

-- =============================================================================
-- ADMINISTRATIVE ORPHAN IDENTIFICATION (NO DIRECT SQL DELETION)
-- Returns all orphaned/malformed objects in bucket 'evidence' for Storage API deletion.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_identify_orphaned_storage_objects()
RETURNS TABLE (
    object_id UUID,
    object_name TEXT,
    created_at TIMESTAMPTZ,
    byte_size BIGINT,
    is_malformed_path BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
BEGIN
    IF auth.role() <> 'service_role' AND current_user <> 'postgres' THEN
        RAISE EXCEPTION 'NIVARANSETU_ADMIN_ERROR: Unauthorized execution. Requires service_role privilege.';
    END IF;

    RETURN QUERY
    SELECT 
        o.id,
        o.name,
        o.created_at,
        (o.metadata->>'size')::bigint AS byte_size,
        NOT (
            o.name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[a-zA-Z0-9_-]{3,64}/[a-zA-Z0-9_-]{3,64}/[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127}$'
            AND o.name NOT LIKE '%..%'
        ) AS is_malformed_path
    FROM storage.objects o
    WHERE o.bucket_id = 'evidence'
      AND o.created_at < clock_timestamp() - INTERVAL '72 hours'
      -- 1. Object is not registered in evidence_items
      AND NOT EXISTS (
          SELECT 1 FROM public.evidence_items ei
          WHERE ei.storage_ref = 'supabase://evidence/' || o.name
      )
      -- 2. Object name is not referenced in custody event logs
      AND NOT EXISTS (
          SELECT 1 FROM public.custody_events ce
          WHERE ce.details LIKE '%' || o.name || '%'
      );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_identify_orphaned_storage_objects() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_identify_orphaned_storage_objects() TO service_role;
ALTER FUNCTION public.admin_identify_orphaned_storage_objects() OWNER TO postgres;

-- =============================================================================
-- CONTROLLED SERVER-SIDE VERIFICATION & SYSTEM CUSTODY PIPELINE FUNCTIONS
-- =============================================================================

-- Function 1: Narrowly permissioned evidence cryptographic verification gate
CREATE OR REPLACE FUNCTION public.admin_verify_evidence_item(
    p_user_id UUID,
    p_case_id TEXT,
    p_evidence_id TEXT,
    p_expected_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_clean_hash TEXT;
BEGIN
    -- 1. Validate input arguments
    IF p_user_id IS NULL OR p_case_id IS NULL OR trim(p_case_id) = '' OR 
       p_evidence_id IS NULL OR trim(p_evidence_id) = '' OR 
       p_expected_hash IS NULL OR trim(p_expected_hash) = '' THEN
        RAISE EXCEPTION 'NIVARANSETU_VALIDATION_ERROR: Missing required verification arguments.';
    END IF;

    v_clean_hash := lower(trim(p_expected_hash));
    IF v_clean_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'NIVARANSETU_VALIDATION_ERROR: Invalid SHA-256 hash format.';
    END IF;

    -- 2. Validate active case belongs to the target user
    IF NOT EXISTS (
        SELECT 1 FROM public.grievance_cases 
        WHERE user_id = p_user_id AND id = p_case_id AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'NIVARANSETU_NOT_FOUND: Active grievance case not found for specified user.';
    END IF;

    -- 3. Fetch evidence item
    SELECT * INTO v_rec
    FROM public.evidence_items
    WHERE user_id = p_user_id AND case_id = p_case_id AND id = p_evidence_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NIVARANSETU_NOT_FOUND: Evidence item not found on case.';
    END IF;

    -- 4. Mandatory prerequisite: Evidence item must have an uploaded storage object
    IF v_rec.has_blob IS NOT TRUE OR v_rec.storage_ref IS NULL OR trim(v_rec.storage_ref) = '' THEN
        RAISE EXCEPTION 'NIVARANSETU_INTEGRITY_ERROR: Synthetic or metadata-only evidence cannot be verified without uploaded storage object.';
    END IF;

    -- 5. Storage path tenant ownership validation (<user_id>/<case_id>/<evidence_id>...)
    IF v_rec.storage_ref !~ ('^' || p_user_id::text || '/' || p_case_id || '/') THEN
        RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: Evidence storage path violates user ownership boundary.';
    END IF;

    -- 6. STRICT BACKEND CRYPTOGRAPHIC VERIFICATION GATE:
    -- Matching a database metadata hash is NOT independent file verification.
    -- Marking evidence as verified_original requires a trusted server-side binary worker (e.g., Supabase Edge Function)
    -- to read the raw binary stream from storage, calculate the SHA-256 digest independently, and securely attest the result.
    -- Because this server-side worker is not yet deployed, this database function strictly refuses to mark evidence verified.
    -- verified_original remains FALSE to prevent unearned or fabricated cryptographic attestation.
    RAISE EXCEPTION 'NIVARANSETU_VERIFICATION_UNAVAILABLE: Server-side binary hash verification worker is not yet deployed. verified_original remains FALSE until actual file bytes are verified by a trusted backend worker.';
END;
$$;

ALTER FUNCTION public.admin_verify_evidence_item(UUID, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_verify_evidence_item(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_evidence_item(UUID, TEXT, TEXT, TEXT) TO service_role;

-- Function 2: Narrowly permissioned system custody event insertion with authoritative server-side actor derivation
DROP FUNCTION IF EXISTS public.admin_insert_system_custody_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_insert_system_custody_event(
    p_user_id UUID,
    p_case_id TEXT,
    p_evidence_id TEXT,
    p_event_type TEXT,
    p_action TEXT,
    p_details TEXT,
    p_file_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_custody_id TEXT;
    v_clean_hash TEXT := NULL;
    v_derived_actor TEXT;
BEGIN
    -- 1. Validate core arguments
    IF p_user_id IS NULL OR p_case_id IS NULL OR trim(p_case_id) = '' OR 
       p_event_type IS NULL OR trim(p_event_type) = '' OR 
       p_action IS NULL OR trim(p_action) = '' OR 
       p_details IS NULL OR trim(p_details) = '' THEN
        RAISE EXCEPTION 'NIVARANSETU_VALIDATION_ERROR: Missing required custody event fields.';
    END IF;

    -- 2. Validate case exists and belongs to user
    IF NOT EXISTS (
        SELECT 1 FROM public.grievance_cases 
        WHERE user_id = p_user_id AND id = p_case_id AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'NIVARANSETU_NOT_FOUND: Active grievance case not found for specified user.';
    END IF;

    -- 3. If evidence_id supplied, validate evidence exists on this case
    IF p_evidence_id IS NOT NULL AND trim(p_evidence_id) <> '' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.evidence_items 
            WHERE user_id = p_user_id AND case_id = p_case_id AND id = p_evidence_id AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'NIVARANSETU_NOT_FOUND: Evidence item not found on case.';
        END IF;
    ELSE
        p_evidence_id := NULL;
    END IF;

    -- 4. Derive authoritative server-side actor mapping (Caller cannot supply or spoof actor)
    CASE p_event_type
        WHEN 'ocr_processed' THEN
            v_derived_actor := 'NivaranSetu System (OCR Pipeline)';
        WHEN 'entity_extracted' THEN
            v_derived_actor := 'NivaranSetu System (Entity Extraction Engine)';
        WHEN 'claim_mapped' THEN
            v_derived_actor := 'NivaranSetu System (Legal Claim Mapper)';
        WHEN 'readiness_assessed' THEN
            v_derived_actor := 'NivaranSetu System (Readiness Assessment Engine)';
        WHEN 'authority_recommended' THEN
            v_derived_actor := 'NivaranSetu System (Statutory Routing Engine)';
        WHEN 'response_analyzed' THEN
            v_derived_actor := 'NivaranSetu System (Counter-Party Analysis Engine)';
        WHEN 'escalation_evaluated' THEN
            v_derived_actor := 'NivaranSetu System (Escalation Window Evaluator)';
        WHEN 'followup_letter_generated' THEN
            v_derived_actor := 'NivaranSetu System (Document Formulator)';
        WHEN 'dossier_generated' THEN
            v_derived_actor := 'NivaranSetu System (Dossier Compiler)';
        WHEN 'filing_ref_recorded' THEN
            v_derived_actor := 'Statutory Redress Gateway (Filing Docket Recorder)';
        WHEN 'submission_recorded' THEN
            v_derived_actor := 'Statutory Redress Gateway (Electronic Filing Gateway)';
        WHEN 'response_received' THEN
            v_derived_actor := 'Statutory Redress Gateway (Inbound Authority Webhook)';
        ELSE
            -- Rejects 'evidence_verified', client event types, or arbitrary strings
            RAISE EXCEPTION 'NIVARANSETU_SECURITY_VIOLATION: Custody event type "%" is not an authorized automated system or gateway event.', p_event_type;
    END CASE;

    -- 5. Normalize and validate file hash if provided
    IF p_file_hash IS NOT NULL AND trim(p_file_hash) <> '' THEN
        v_clean_hash := lower(trim(p_file_hash));
        IF v_clean_hash !~ '^[0-9a-f]{64}$' THEN
            RAISE EXCEPTION 'NIVARANSETU_VALIDATION_ERROR: Invalid SHA-256 hash format for custody event.';
        END IF;
    END IF;

    -- 6. Insert custody event with derived authoritative actor
    v_custody_id := 'ev-sys-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 6);
    INSERT INTO public.custody_events (
        user_id,
        case_id,
        id,
        evidence_id,
        event_type,
        action,
        actor,
        client_timestamp,
        server_timestamp,
        details,
        file_hash
    ) VALUES (
        p_user_id,
        p_case_id,
        v_custody_id,
        p_evidence_id,
        p_event_type,
        trim(p_action),
        v_derived_actor,
        clock_timestamp(),
        clock_timestamp(),
        trim(p_details),
        v_clean_hash
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'custody_event_id', v_custody_id,
        'event_type', p_event_type,
        'actor', v_derived_actor
    );
END;
$$;

ALTER FUNCTION public.admin_insert_system_custody_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_insert_system_custody_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_insert_system_custody_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- =============================================================================
-- COMPLETE 4-SCENARIO IDEMPOTENT DEMO SEEDING PROCEDURE
-- Truthful synthetic exhibits: has_blob=FALSE, storage_ref=NULL, sha256_hash=NULL, verified_original=FALSE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.seed_demo_cases_for_current_user()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'NIVARANSETU_AUTH_ERROR: Unauthenticated execution rejected.';
    END IF;

    -- Concurrency Protection: Transaction-scoped advisory lock per user
    PERFORM pg_advisory_xact_lock(hashtext('seed_demo_cases_' || v_user_id::text));

    -- -------------------------------------------------------------------------
    -- 1. SCENARIO 1: Rajesh Kumar (NS-2026-0842 - Banking / UPI Fraud)
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM public.grievance_cases WHERE user_id = v_user_id AND id = 'NS-2026-0842') THEN
        INSERT INTO public.grievance_cases (
            user_id, id, title, category, stage, status, is_sample_data,
            incident_date, incident_location, involved_entity, disputed_amount,
            currency, description, simple_summary, readiness_score,
            readiness_breakdown, recommended_authority, complaint_draft,
            missing_elements, filing_details, trust_check_record
        ) VALUES (
            v_user_id, 'NS-2026-0842',
            'Unauthorized UPI debits totaling ₹42,500 after deceptive electricity bill APK',
            'banking_financial', 'ready_to_file', 'ready', TRUE,
            '2026-10-28', 'Pune, Maharashtra',
            'Apex Bank of India / Unregistered Merchant Gateway', 42500.00, 'INR',
            'Received an SMS claiming electricity power supply would be disconnected by 9:30 PM due to unpaid dues. Followed SMS instruction to download a bill verification utility which installed a malicious background service. Three rapid UPI debits of ₹15,000, ₹15,000, and ₹12,500 occurred within 8 minutes. Bank branch was notified within 2 hours, but branch manager refused to register internal fraud dispute or share transaction reversal reference numbers.',
            'A fake electricity bill message tricked me into installing an app, causing ₹42,500 to be taken from my bank. The bank refused to help despite reporting within the 3-day zero-liability window.',
            88,
            '{"evidenceCompleteness": 92, "timelineClarity": 88, "identityProof": 100, "formalNoticeSent": 72}'::jsonb,
            '{"name": "RBI Integrated Ombudsman Scheme (CMS Portal)", "portalName": "RBI Complaint Management System (CMS)", "portalUrl": "https://cms.rbi.org.in", "filingFee": "Nil (Free statutory grievance redressal)", "averageResolutionTime": "30-45 calendar days"}'::jsonb,
            '{"subject": "Formal Grievance under RBI Integrated Ombudsman Scheme 2021 against Apex Bank of India for failure to credit unconsented electronic transactions under Zero Liability guidelines", "formalBody": "Before the Learned Banking Ombudsman (Maharashtra & Goa Jurisdiction)...", "simpleBody": "My bank allowed ₹42,500 to be stolen without OTP...", "reliefSought": "Immediate zero-liability reversal of ₹42,500 with statutory interest and compensation."}'::jsonb,
            '["Final written closure letter from Apex Bank Principal Nodal Officer"]'::jsonb,
            '{"referenceNumber": "APEX/PN/2026/INW-714", "authority": "Apex Bank Principal Nodal Officer / RBI CMS", "filingDate": "2026-10-29", "officialAckUrl": "https://cms.rbi.org.in"}'::jsonb,
            '{"id": "tc-rec-0842", "input": "https://bill-pay-pseb.top/verify.apk", "type": "url", "riskLevel": "high_risk", "resultStatus": "Verified adverse match", "flagTitle": "Verified Electricity APK Phishing Campaign", "description": "CERT-In advisory CI-2026-0182 flags this domain as active SMS-delivered Android trojan stealing SMS permissions.", "sourceReferences": ["CERT-In Security Bulletin CI-2026-0182", "National Cyber Crime Reporting Portal Threat Feed"], "timestamp": "2026-10-29 09:12:00 UTC", "recommendedActions": ["Do not install APK", "Factory reset device", "Freeze netbanking credentials"]}'::jsonb
        );
    END IF;

    -- Exhibits for NS-2026-0842 (Synthetic metadata: sha256_hash = NULL, has_blob = FALSE, storage_ref = NULL, verified_original = FALSE)
    IF EXISTS (SELECT 1 FROM public.grievance_cases WHERE user_id = v_user_id AND id = 'NS-2026-0842' AND is_sample_data = TRUE AND deleted_at IS NULL) THEN
        IF NOT EXISTS (SELECT 1 FROM public.evidence_items WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'ev-1') THEN
            INSERT INTO public.evidence_items (user_id, case_id, id, title, category, file_name, file_size_bytes, file_size_formatted, file_type, upload_date, sha256_hash, storage_ref, raw_ocr_text, has_blob, ocr_extracted, flag, claim_mapped_to, verified_original)
            VALUES (v_user_id, 'NS-2026-0842', 'ev-1', 'SMS Screenshot & Sender Header (VM-POWURG)', 'screenshot', 'sms_threat_electricity_notice.png', 1468006, '1.4 MB', 'image/png', '2026-10-29 10:14:00+00', NULL, NULL, 'VM-POWURG: Electricity dues pending. Power off 9:30 PM. Download apk to verify.', FALSE, '{"dates": ["28-10-2026"], "amounts": ["12.00"], "identifiers": ["VM-POWURG", "quick-bill-pay.apk"], "parties": ["Discom Impersonator"], "summary": "Threat message warning disconnection at 21:30 hrs unless bill verified via linked file."}'::jsonb, NULL, 'Phishing lure proof', FALSE);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.evidence_items WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'ev-2') THEN
            INSERT INTO public.evidence_items (user_id, case_id, id, title, category, file_name, file_size_bytes, file_size_formatted, file_type, upload_date, sha256_hash, storage_ref, raw_ocr_text, has_blob, ocr_extracted, flag, claim_mapped_to, verified_original)
            VALUES (v_user_id, 'NS-2026-0842', 'ev-2', 'Bank Statement Showing 3 Immediate Debits', 'bank_statement', 'bank_passbook_extract_oct2026.pdf', 2936012, '2.8 MB', 'application/pdf', '2026-10-29 10:15:00+00', NULL, NULL, 'Apex Bank Account Statement... 28-OCT-2026 UPI/DR/630198421094/PWRBILL ₹15,000.00 ₹15,000.00 ₹12,500.00', FALSE, '{"dates": ["28-OCT-2026"], "amounts": ["15,000.00", "15,000.00", "12,500.00"], "identifiers": ["630198421094", "630198422180", "630198423401"], "parties": ["Apex Bank of India", "ref-collect92@okaxis"], "summary": "Bank statement reflecting 3 unauthorized UPI debits."}'::jsonb, '{"type": "verified", "message": "Transaction amounts match disputed sum."}'::jsonb, 'Unauthorized debit claim', FALSE);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.evidence_items WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'ev-3') THEN
            INSERT INTO public.evidence_items (user_id, case_id, id, title, category, file_name, file_size_bytes, file_size_formatted, file_type, upload_date, sha256_hash, storage_ref, raw_ocr_text, has_blob, ocr_extracted, flag, claim_mapped_to, verified_original)
            VALUES (v_user_id, 'NS-2026-0842', 'ev-3', 'In-Person Branch Complaint Written Ack', 'correspondence', 'branch_complaint_ack.pdf', 838860, '820 KB', 'application/pdf', '2026-10-30 11:00:00+00', NULL, NULL, 'To Branch Manager, Apex Bank... Intimation of fraudulent debits within 2 hours... Received stamp dated 28-Oct-2026.', FALSE, '{"dates": ["28-Oct-2026"], "amounts": ["42,500.00"], "identifiers": ["ACK-714"], "parties": ["Branch Manager", "Account Holder"], "summary": "Physical written dispute intimation stamped by branch officer."}'::jsonb, '{"type": "verified", "message": "Stamped within zero-liability reporting window."}'::jsonb, 'Timely intimation proof', FALSE);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.evidence_items WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'ev-4') THEN
            INSERT INTO public.evidence_items (user_id, case_id, id, title, category, file_name, file_size_bytes, file_size_formatted, file_type, upload_date, sha256_hash, storage_ref, raw_ocr_text, has_blob, ocr_extracted, flag, claim_mapped_to, verified_original)
            VALUES (v_user_id, 'NS-2026-0842', 'ev-4', 'National Cyber Crime Portal Acknowledgement', 'receipt', 'cybercrime_ack_receipt.pdf', 614400, '600 KB', 'application/pdf', '2026-10-31 16:30:00+00', NULL, NULL, 'Cyber Crime Incident Report 210984128... Financial Fraud Category... Status: Transferred to State Nodal Cyber Cell.', FALSE, '{"dates": ["29-Oct-2026"], "amounts": ["42,500.00"], "identifiers": ["210984128"], "parties": ["Cyber Crime Portal", "Complainant"], "summary": "Formal cyber crime FIR / complaint acknowledgement receipt."}'::jsonb, NULL, 'Police intimation compliance', FALSE);
        END IF;

        -- Timelines for NS-2026-0842
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'tl-1') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0842', 'tl-1', 'ev-1', '2026-10-28', 'Deceptive Electricity SMS Received', 'Received SMS claiming electricity disconnection at 9:30 PM.', TRUE);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'tl-2') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0842', 'tl-2', 'ev-2', '2026-10-28', 'Three Fraudulent Debits Occurred', 'Debits of ₹15,000, ₹15,000, and ₹12,500 within 8 minutes.', TRUE);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'tl-3') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0842', 'tl-3', 'ev-3', '2026-10-28', 'Reported to Apex Bank Branch Manager', 'Informed branch manager in person within 2 hours; manager refused dispute number.', TRUE);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'tl-4') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0842', 'tl-4', 'ev-4', '2026-10-29', 'National Cyber Crime Portal Complaint Registered', 'Acknowledged reference 210984128.', TRUE);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'tl-5') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0842', 'tl-5', NULL, '2026-11-04', 'Apex Bank Grievance Escalation Rejected', 'Principal Nodal Officer sent refusal letter alleging customer shared credentials.', FALSE);
        END IF;

        -- Custody Events for NS-2026-0842 (Synthetic metadata notice: file_hash = NULL)
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'ev-ns0842-1') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0842', 'ev-ns0842-1', NULL, 'case_created', 'Case Record Initialized', 'Citizen (Browser Session)', '2026-10-28 10:14:00+00', 'Grievance case registered under category: banking financial. Disputed entity: Apex Bank of India / Unregistered Merchant Gateway.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'ev-ns0842-2') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0842', 'ev-ns0842-2', NULL, 'case_updated', 'TrustCheck Advisory Correlated', 'NivaranSetu System', '2026-10-28 10:14:15+00', 'Integrated findings for suspicious identifier "https://bill-pay-pseb.top/verify.apk" (Verified adverse match).', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'ev-ns0842-3') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0842', 'ev-ns0842-3', 'ev-1', 'case_updated', 'Synthetic Exhibit Initialized (Demonstration Scenario)', 'NivaranSetu System (Sample Data Initializer)', '2026-10-29 10:14:00+00', 'Sample exhibit metadata initialized for demonstration. No physical file was ingested, and no genuine cryptographic hash was computed.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'ev-ns0842-4') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0842', 'ev-ns0842-4', 'ev-2', 'case_updated', 'Synthetic Exhibit Initialized (Demonstration Scenario)', 'NivaranSetu System (Sample Data Initializer)', '2026-10-29 10:15:12+00', 'Sample exhibit metadata initialized for demonstration. No physical file was ingested, and no genuine cryptographic hash was computed.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'ev-ns0842-5') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0842', 'ev-ns0842-5', 'ev-2', 'case_updated', 'OCR Entity Extraction: Bank Passbook / Statement (October 2026)', 'NivaranSetu System', '2026-10-29 10:15:02+00', 'Extracted 3 financial values, 1 dates, and 3 identifiers without modifying binary content.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'ev-ns0842-6') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0842', 'ev-ns0842-6', NULL, 'case_updated', 'Case Readiness Evaluated (88%)', 'NivaranSetu System', '2026-11-06 11:20:00+00', 'Calculated readiness tier: Ready for review. Evidence completeness: 92%.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0842' AND id = 'ev-ns0842-7') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0842', 'ev-ns0842-7', NULL, 'complaint_generated', 'Structured Complaint Statement Formulated', 'Citizen (Browser Session)', '2026-11-06 11:22:00+00', 'Subject: Formal Grievance under RBI Integrated Ombudsman Scheme 2021 against Apex Bank of India...', NULL);
        END IF;

        -- Case Monitoring for NS-2026-0842
        IF NOT EXISTS (SELECT 1 FROM public.case_monitoring WHERE user_id = v_user_id AND case_id = 'NS-2026-0842') THEN
            INSERT INTO public.case_monitoring (user_id, case_id, submission_date, submission_time, official_portal, department, docket_number, citizen_reported_status, statutory_deadline_days, statutory_deadline_date, reminders, responses, generated_letters, last_evaluated_at)
            VALUES (v_user_id, 'NS-2026-0842', '2026-10-29', '14:30', 'RBI CMS Portal', 'Banking Ombudsman (Mumbai Centre)', 'APEX/PN/2026/INW-714', 'submitted', 30, '2026-11-28', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '2026-11-06 14:32:00+00');
        END IF;
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. SCENARIO 2: Greenfield Infra (NS-2026-0619 - Real Estate / RERA)
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM public.grievance_cases WHERE user_id = v_user_id AND id = 'NS-2026-0619') THEN
        INSERT INTO public.grievance_cases (
            user_id, id, title, category, stage, status, is_sample_data,
            incident_date, incident_location, involved_entity, disputed_amount,
            currency, description, simple_summary, readiness_score,
            readiness_breakdown, recommended_authority, complaint_draft,
            missing_elements, filing_details, trust_check_record
        ) VALUES (
            v_user_id, 'NS-2026-0619',
            '44-month possession delay and demand for illegal escalation charges by Greenfield Infra',
            'real_estate_rera', 'evidence_gathering', 'pending_attention', TRUE,
            '2024-03-31', 'Sector 78, Gurugram, Haryana',
            'Greenfield Infrastructure & Promoters Pvt Ltd', 1850000.00, 'INR',
            'Allotment letter promised handover of 3BHK unit (Flat 1104, Tower C) by March 2024 with a 6-month grace period ending September 2024. As of November 2026, tower construction is halted at 14th floor plastering. Builder issued an illegal supplementary demand letter of ₹4.8 Lakhs for raw material price escalation while refusing to pay delay compensation under Section 18 of RERA.',
            'The builder was supposed to give flat possession by March 2024. After 2.5 years of delay, they are demanding extra money instead of paying delay penalty.',
            74,
            '{"evidenceCompleteness": 70, "timelineClarity": 80, "identityProof": 100, "formalNoticeSent": 45}'::jsonb,
            '{"name": "Haryana Real Estate Regulatory Authority (HARERA Gurugram)", "portalName": "HARERA Gurugram Portal", "portalUrl": "https://haryanarera.gov.in", "filingFee": "₹1,000 + statutory annexure fee", "averageResolutionTime": "60-90 calendar days"}'::jsonb,
            '{"subject": "Complaint under Section 31 read with Section 18 of Real Estate (Regulation and Development) Act 2016 for delay possession interest and setting aside illegal escalation demands", "formalBody": "Before the Honble Haryana Real Estate Regulatory Authority...", "simpleBody": "Greenfield Infra delayed my home possession by over 2 years...", "reliefSought": "Immediate possession with statutory interest at SBI MCLR + 2%."}'::jsonb,
            '["Formal speed-post legal notice acknowledgment receipt"]'::jsonb,
            '{"referenceNumber": "HRERA/GGM/2026/CMP-4109", "authority": "Haryana Real Estate Regulatory Authority (Gurugram)", "filingDate": "2026-09-15", "officialAckUrl": "https://haryanarera.gov.in"}'::jsonb,
            NULL
        );
    END IF;

    IF EXISTS (SELECT 1 FROM public.grievance_cases WHERE user_id = v_user_id AND id = 'NS-2026-0619' AND is_sample_data = TRUE AND deleted_at IS NULL) THEN
        IF NOT EXISTS (SELECT 1 FROM public.evidence_items WHERE user_id = v_user_id AND case_id = 'NS-2026-0619' AND id = 'ev-rera-1') THEN
            INSERT INTO public.evidence_items (user_id, case_id, id, title, category, file_name, file_size_bytes, file_size_formatted, file_type, upload_date, sha256_hash, storage_ref, raw_ocr_text, has_blob, ocr_extracted, flag, claim_mapped_to, verified_original)
            VALUES (v_user_id, 'NS-2026-0619', 'ev-rera-1', 'Builder Buyer Agreement (Registered)', 'agreement', 'greenfield_bba_registered.pdf', 4718592, '4.5 MB', 'application/pdf', '2026-11-01 11:30:00+00', NULL, NULL, 'Flat 1104, Tower C... Possession Date: 31-March-2024...', FALSE, '{"dates": ["31-March-2024"], "amounts": ["1,850,000.00"], "identifiers": ["HARERA/GGM/2019/314"], "parties": ["Greenfield Infra", "Allottee"], "summary": "Registered agreement establishing contractual handover deadline."}'::jsonb, NULL, 'Handover clause proof', FALSE);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.evidence_items WHERE user_id = v_user_id AND case_id = 'NS-2026-0619' AND id = 'ev-rera-2') THEN
            INSERT INTO public.evidence_items (user_id, case_id, id, title, category, file_name, file_size_bytes, file_size_formatted, file_type, upload_date, sha256_hash, storage_ref, raw_ocr_text, has_blob, ocr_extracted, flag, claim_mapped_to, verified_original)
            VALUES (v_user_id, 'NS-2026-0619', 'ev-rera-2', 'Unilateral Price Escalation Demand Letter', 'notice', 'escalation_demand_notice.pdf', 943718, '922 KB', 'application/pdf', '2026-11-02 14:15:00+00', NULL, NULL, 'Due to steel & cement inflation, demand ₹4,80,000 extra before possession...', FALSE, '{"dates": ["12-Oct-2026"], "amounts": ["480,000.00"], "identifiers": ["DEM-4109"], "parties": ["Greenfield Infra"], "summary": "Demand notice imposing illegal price escalation."}'::jsonb, '{"type": "inconsistency", "message": "BBA clause 14 explicitly prohibits price escalation."}'::jsonb, 'Illegal charge dispute', FALSE);
        END IF;

        -- Timelines for NS-2026-0619
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0619' AND id = 'tl-rera-1') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0619', 'tl-rera-1', 'ev-rera-1', '2019-11-15', 'Builder Buyer Agreement Executed', 'Signed agreement with promised possession of March 2024.', TRUE);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0619' AND id = 'tl-rera-2') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0619', 'tl-rera-2', NULL, '2024-03-31', 'Contractual Possession Date Missed', 'Grace period lapsed on 30 September 2024 without completion.', FALSE);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0619' AND id = 'tl-rera-3') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0619', 'tl-rera-3', 'ev-rera-2', '2026-10-12', 'Illegal Supplementary Demand Issued', 'Builder demanded ₹4.8 Lakhs citing construction raw material costs.', TRUE);
        END IF;

        -- Custody Events for NS-2026-0619
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0619' AND id = 'ev-ns0619-1') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0619', 'ev-ns0619-1', NULL, 'case_created', 'Case Record Initialized', 'Citizen (Browser Session)', '2024-03-31 10:14:00+00', 'Grievance case registered under category: real estate rera. Disputed entity: Greenfield Infrastructure & Promoters Pvt Ltd.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0619' AND id = 'ev-ns0619-2') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0619', 'ev-ns0619-2', 'ev-rera-1', 'case_updated', 'Synthetic Exhibit Initialized (Demonstration Scenario)', 'NivaranSetu System (Sample Data Initializer)', '2026-11-01 11:30:00+00', 'Sample exhibit metadata initialized for demonstration. No physical file was ingested, and no genuine cryptographic hash was computed.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0619' AND id = 'ev-ns0619-3') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0619', 'ev-ns0619-3', NULL, 'case_updated', 'Case Readiness Evaluated (74%)', 'NivaranSetu System', '2026-11-05 09:15:00+00', 'Calculated readiness tier: Needs additional info. Evidence completeness: 70%.', NULL);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.case_monitoring WHERE user_id = v_user_id AND case_id = 'NS-2026-0619') THEN
            INSERT INTO public.case_monitoring (user_id, case_id, submission_date, submission_time, official_portal, department, docket_number, citizen_reported_status, statutory_deadline_days, statutory_deadline_date, reminders, responses, generated_letters, last_evaluated_at)
            VALUES (v_user_id, 'NS-2026-0619', '2026-09-15', '11:00', 'HARERA Gurugram Portal', 'Adjudicating Officer Bench III', 'HRERA/GGM/2026/CMP-4109', 'in_progress', 60, '2026-11-14', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '2026-11-05 09:15:00+00');
        END IF;
    END IF;

    -- -------------------------------------------------------------------------
    -- 3. SCENARIO 3: QuickBazaar (NS-2026-0381 - Consumer / E-Commerce)
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM public.grievance_cases WHERE user_id = v_user_id AND id = 'NS-2026-0381') THEN
        INSERT INTO public.grievance_cases (
            user_id, id, title, category, stage, status, is_sample_data,
            incident_date, incident_location, involved_entity, disputed_amount,
            currency, description, simple_summary, readiness_score,
            readiness_breakdown, recommended_authority, complaint_draft,
            missing_elements, filing_details, trust_check_record
        ) VALUES (
            v_user_id, 'NS-2026-0381',
            'Defective 65" OLED TV and refusal of warranty replacement by QuickBazaar Online',
            'consumer_ecommerce', 'ready_to_file', 'ready', TRUE,
            '2026-10-02', 'Bengaluru, Karnataka',
            'QuickBazaar Retail Pvt Ltd & VisionTech India', 114999.00, 'INR',
            'Purchased a 65-inch 4K OLED Smart TV during Great Festive Sale. Upon brand-authorized technician unboxing, the panel had massive internal vertical line artifacts and screen bleed. Technician logged panel DOA (Dead on Arrival) in service sheet. Seller refused return window alleging customer damaged during unboxing, even though technician unboxed it on official video.',
            'Bought an expensive TV that arrived broken. Authorized technician opened it and confirmed it was broken out of the box, but the online seller refuses to replace or refund it.',
            94,
            '{"evidenceCompleteness": 96, "timelineClarity": 92, "identityProof": 100, "formalNoticeSent": 88}'::jsonb,
            '{"name": "National Consumer Disputes Redressal Commission (e-Daakhil Portal)", "portalName": "e-Daakhil Portal", "portalUrl": "https://edaakhil.nic.in", "filingFee": "₹200 (Online Payment)", "averageResolutionTime": "45-60 calendar days"}'::jsonb,
            '{"subject": "Consumer Complaint under Section 35 Consumer Protection Act 2019 for Deficient Service and Unfair Trade Practice regarding replacement of DOA television", "formalBody": "Before the Honble District Consumer Disputes Redressal Commission...", "simpleBody": "QuickBazaar delivered a broken OLED TV and rejected replacement...", "reliefSought": "Full refund of ₹1,14,999 with 18% statutory interest plus ₹25,000 compensation."}'::jsonb,
            '[]'::jsonb,
            '{"referenceNumber": "EDK/BLR/2026/CC-892", "authority": "District Consumer Commission, Bengaluru Urban", "filingDate": "2026-10-15", "officialAckUrl": "https://edaakhil.nic.in"}'::jsonb,
            NULL
        );
    END IF;

    IF EXISTS (SELECT 1 FROM public.grievance_cases WHERE user_id = v_user_id AND id = 'NS-2026-0381' AND is_sample_data = TRUE AND deleted_at IS NULL) THEN
        IF NOT EXISTS (SELECT 1 FROM public.evidence_items WHERE user_id = v_user_id AND case_id = 'NS-2026-0381' AND id = 'ev-cons-1') THEN
            INSERT INTO public.evidence_items (user_id, case_id, id, title, category, file_name, file_size_bytes, file_size_formatted, file_type, upload_date, sha256_hash, storage_ref, raw_ocr_text, has_blob, ocr_extracted, flag, claim_mapped_to, verified_original)
            VALUES (v_user_id, 'NS-2026-0381', 'ev-cons-1', 'Tax Invoice & Purchase Receipt', 'receipt', 'quickbazaar_tv_invoice.pdf', 629145, '614 KB', 'application/pdf', '2026-10-03 14:00:00+00', NULL, NULL, 'Invoice #QB-948120... Amount: ₹114,999.00...', FALSE, '{"dates": ["02-Oct-2026"], "amounts": ["114,999.00"], "identifiers": ["QB-948120"], "parties": ["QuickBazaar", "Customer"], "summary": "Official retail tax invoice."}'::jsonb, NULL, 'Purchase verification', FALSE);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.evidence_items WHERE user_id = v_user_id AND case_id = 'NS-2026-0381' AND id = 'ev-cons-2') THEN
            INSERT INTO public.evidence_items (user_id, case_id, id, title, category, file_name, file_size_bytes, file_size_formatted, file_type, upload_date, sha256_hash, storage_ref, raw_ocr_text, has_blob, ocr_extracted, flag, claim_mapped_to, verified_original)
            VALUES (v_user_id, 'NS-2026-0381', 'ev-cons-2', 'Brand Technician Service Sheet (DOA Remarks)', 'correspondence', 'visiontech_technician_doa_sheet.pdf', 1887436, '1.8 MB', 'application/pdf', '2026-10-04 16:30:00+00', NULL, NULL, 'Technician Name: Ramesh K... Panel cracked inside box... DOA confirmed.', FALSE, '{"dates": ["04-Oct-2026"], "amounts": [], "identifiers": ["DOA-VT-412"], "parties": ["VisionTech", "Customer"], "summary": "Official inspection sheet confirming dead-on-arrival status."}'::jsonb, '{"type": "verified", "message": "Proves goods arrived damaged before customer possession."}'::jsonb, 'Damage origin proof', FALSE);
        END IF;

        -- Timelines for NS-2026-0381
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0381' AND id = 'tl-cons-1') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0381', 'tl-cons-1', 'ev-cons-1', '2026-10-02', '65" OLED TV Purchased & Delivered', 'Delivered by QuickBazaar in sealed carton.', TRUE);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0381' AND id = 'tl-cons-2') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0381', 'tl-cons-2', 'ev-cons-2', '2026-10-04', 'Authorized Technician Unboxing & DOA Confirmation', 'Brand technician unboxed and certified Dead on Arrival.', TRUE);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0381' AND id = 'tl-cons-3') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0381', 'tl-cons-3', NULL, '2026-10-06', 'QuickBazaar Online Return Rejection', 'Seller customer support closed return ticket alleging physical transit damage.', FALSE);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0381' AND id = 'tl-cons-4') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0381', 'tl-cons-4', NULL, '2026-10-12', 'Statutory Formal Legal Notice Sent via Speed Post', 'Demanded immediate replacement or refund under Consumer Protection Act.', FALSE);
        END IF;

        -- Custody Events for NS-2026-0381
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0381' AND id = 'ev-ns0381-1') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0381', 'ev-ns0381-1', NULL, 'case_created', 'Case Record Initialized', 'Citizen (Browser Session)', '2026-10-02 10:14:00+00', 'Grievance case registered under category: consumer ecommerce. Disputed entity: QuickBazaar Retail Pvt Ltd & VisionTech India.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0381' AND id = 'ev-ns0381-2') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0381', 'ev-ns0381-2', 'ev-cons-1', 'case_updated', 'Synthetic Exhibit Initialized (Demonstration Scenario)', 'NivaranSetu System (Sample Data Initializer)', '2026-10-03 14:00:00+00', 'Sample exhibit metadata initialized for demonstration. No physical file was ingested, and no genuine cryptographic hash was computed.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0381' AND id = 'ev-ns0381-3') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0381', 'ev-ns0381-3', 'ev-cons-2', 'case_updated', 'Synthetic Exhibit Initialized (Demonstration Scenario)', 'NivaranSetu System (Sample Data Initializer)', '2026-10-04 16:30:00+00', 'Sample exhibit metadata initialized for demonstration. No physical file was ingested, and no genuine cryptographic hash was computed.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0381' AND id = 'ev-ns0381-4') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0381', 'ev-ns0381-4', NULL, 'case_updated', 'Case Readiness Evaluated (94%)', 'NivaranSetu System', '2026-11-07 11:20:00+00', 'Calculated readiness tier: Ready for review. Evidence completeness: 96%.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0381' AND id = 'ev-ns0381-5') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0381', 'ev-ns0381-5', NULL, 'complaint_generated', 'Structured Complaint Statement Formulated', 'Citizen (Browser Session)', '2026-11-07 11:22:00+00', 'Subject: Consumer Complaint under Section 35 Consumer Protection Act 2019 for Deficient Service and Unfair Trade Practice...', NULL);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.case_monitoring WHERE user_id = v_user_id AND case_id = 'NS-2026-0381') THEN
            INSERT INTO public.case_monitoring (user_id, case_id, submission_date, submission_time, official_portal, department, docket_number, citizen_reported_status, statutory_deadline_days, statutory_deadline_date, reminders, responses, generated_letters, last_evaluated_at)
            VALUES (v_user_id, 'NS-2026-0381', '2026-10-15', '16:00', 'e-Daakhil Portal', 'District Consumer Disputes Redressal Commission, Bengaluru Urban', 'EDK/BLR/2026/CC-892', 'response_received', 45, '2026-11-29', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '2026-11-07 11:20:00+00');
        END IF;
    END IF;

    -- -------------------------------------------------------------------------
    -- 4. SCENARIO 4: TrustShield (NS-2026-0211 - Insurance Claims)
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM public.grievance_cases WHERE user_id = v_user_id AND id = 'NS-2026-0211') THEN
        INSERT INTO public.grievance_cases (
            user_id, id, title, category, stage, status, is_sample_data,
            incident_date, incident_location, involved_entity, disputed_amount,
            currency, description, simple_summary, readiness_score,
            readiness_breakdown, recommended_authority, complaint_draft,
            missing_elements, filing_details, trust_check_record
        ) VALUES (
            v_user_id, 'NS-2026-0211',
            'Wrongful cashless mediclaim repudiation citing non-disclosure of cold & cough from 2018',
            'insurance_claims', 'drafting', 'active', TRUE,
            '2026-09-18', 'Jaipur, Rajasthan',
            'TrustShield General Insurance Co Ltd', 284000.00, 'INR',
            'Underwent emergency laparoscopic cholecystectomy for acute gallstone pancreatitis. Cashless pre-authorization was denied at hospital desk. Subsequent reimbursement claim of ₹2,84,000 was repudiated citing non-disclosure of outpatient allergy and seasonal bronchitis in 2018, which has zero medical nexus with acute gall bladder stones.',
            'Hospital bill of ₹2.84 Lakhs for emergency gallstone surgery was rejected by insurance company claiming I had a cold 8 years ago that was not mentioned in the policy.',
            68,
            '{"evidenceCompleteness": 64, "timelineClarity": 72, "identityProof": 100, "formalNoticeSent": 35}'::jsonb,
            '{"name": "Insurance Ombudsman / IRDAI Bima Bharosa", "portalName": "Council for Insurance Ombudsmen (CIO)", "portalUrl": "https://www.cioins.co.in", "filingFee": "Nil (Free)", "averageResolutionTime": "30-60 calendar days"}'::jsonb,
            '{"subject": "Representation under Rule 14 Insurance Ombudsman Rules 2017 against arbitrary repudiation of Health Claim No. TS-CLM-2026-9018", "formalBody": "Before the Learned Insurance Ombudsman (Jaipur Centre)...", "simpleBody": "TrustShield rejected my gallstone surgery reimbursement...", "reliefSought": "Direction to settle claim ₹2,84,000 with penal interest."}'::jsonb,
            '["Doctor certificate confirming acute non-pre-existing onset"]'::jsonb,
            '{"referenceNumber": "IO/JPR/GI/2026/0411", "authority": "Insurance Ombudsman (Jaipur Centre)", "filingDate": "2026-10-05", "officialAckUrl": "https://www.cioins.co.in"}'::jsonb,
            NULL
        );
    END IF;

    IF EXISTS (SELECT 1 FROM public.grievance_cases WHERE user_id = v_user_id AND id = 'NS-2026-0211' AND is_sample_data = TRUE AND deleted_at IS NULL) THEN
        IF NOT EXISTS (SELECT 1 FROM public.evidence_items WHERE user_id = v_user_id AND case_id = 'NS-2026-0211' AND id = 'ev-ins-1') THEN
            INSERT INTO public.evidence_items (user_id, case_id, id, title, category, file_name, file_size_bytes, file_size_formatted, file_type, upload_date, sha256_hash, storage_ref, raw_ocr_text, has_blob, ocr_extracted, flag, claim_mapped_to, verified_original)
            VALUES (v_user_id, 'NS-2026-0211', 'ev-ins-1', 'Hospital Discharge Summary & Operative Notes', 'notice', 'hospital_discharge_summary.pdf', 3145728, '3.0 MB', 'application/pdf', '2026-09-22 09:30:00+00', NULL, NULL, 'Emergency laparoscopic cholecystectomy... No pre-existing gall bladder pathology...', FALSE, '{"dates": ["18-Sep-2026"], "amounts": ["284,000.00"], "identifiers": ["IPD-84210"], "parties": ["Apex Hospital", "Patient"], "summary": "Discharge summary documenting acute onset surgical procedure."}'::jsonb, NULL, 'Surgical necessity proof', FALSE);
        END IF;

        -- Timelines for NS-2026-0211
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0211' AND id = 'tl-ins-1') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0211', 'tl-ins-1', 'ev-ins-1', '2026-09-18', 'Emergency Hospital Admission & Cashless Denied', 'Hospital TPA desk rejected pre-authorization request.', TRUE);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.timeline_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0211' AND id = 'tl-ins-2') THEN
            INSERT INTO public.timeline_events (user_id, case_id, id, evidence_id, date, title, description, verified_by_doc)
            VALUES (v_user_id, 'NS-2026-0211', 'tl-ins-2', NULL, '2026-10-01', 'Reimbursement Claim Repudiated by TrustShield', 'Claim rejected alleging non-disclosure of seasonal bronchitis.', FALSE);
        END IF;

        -- Custody Events for NS-2026-0211
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0211' AND id = 'ev-ns0211-1') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0211', 'ev-ns0211-1', NULL, 'case_created', 'Case Record Initialized', 'Citizen (Browser Session)', '2026-09-18 10:14:00+00', 'Grievance case registered under category: insurance claims. Disputed entity: TrustShield General Insurance Co Ltd.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0211' AND id = 'ev-ns0211-2') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0211', 'ev-ns0211-2', 'ev-ins-1', 'case_updated', 'Synthetic Exhibit Initialized (Demonstration Scenario)', 'NivaranSetu System (Sample Data Initializer)', '2026-09-22 09:30:00+00', 'Sample exhibit metadata initialized for demonstration. No physical file was ingested, and no genuine cryptographic hash was computed.', NULL);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.custody_events WHERE user_id = v_user_id AND case_id = 'NS-2026-0211' AND id = 'ev-ns0211-3') THEN
            INSERT INTO public.custody_events (user_id, case_id, id, evidence_id, event_type, action, actor, client_timestamp, details, file_hash)
            VALUES (v_user_id, 'NS-2026-0211', 'ev-ns0211-3', NULL, 'case_updated', 'Case Readiness Evaluated (68%)', 'NivaranSetu System', '2026-11-04 16:45:00+00', 'Calculated readiness tier: Needs additional info. Evidence completeness: 64%.', NULL);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.case_monitoring WHERE user_id = v_user_id AND case_id = 'NS-2026-0211') THEN
            INSERT INTO public.case_monitoring (user_id, case_id, submission_date, submission_time, official_portal, department, docket_number, citizen_reported_status, statutory_deadline_days, statutory_deadline_date, reminders, responses, generated_letters, last_evaluated_at)
            VALUES (v_user_id, 'NS-2026-0211', '2026-10-05', '12:15', 'Council for Insurance Ombudsmen (CIO)', 'Office of Insurance Ombudsman, Jaipur', 'IO/JPR/GI/2026/0411', 'submitted', 30, '2026-11-04', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '2026-11-04 16:45:00+00');
        END IF;
    END IF;
END;
$$;

ALTER FUNCTION public.seed_demo_cases_for_current_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.seed_demo_cases_for_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_demo_cases_for_current_user() TO authenticated;

COMMIT;
