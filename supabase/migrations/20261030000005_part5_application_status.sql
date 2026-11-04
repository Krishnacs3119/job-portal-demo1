-- ==============================================================================
-- PART 5: APPLICATION STATUS WORKFLOW, STATUS HISTORY & RECRUITER DASHBOARD
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. APPLICATION STATUS HISTORY TABLE (APPEND-ONLY AUDIT LOG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('applied', 'shortlisted', 'selected', 'rejected')),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_status_history_app_id 
  ON public.application_status_history (application_id, created_at ASC);

ALTER TABLE public.application_status_history ENABLE ROW LEVEL SECURITY;

-- Candidates can view history of their own applications
DROP POLICY IF EXISTS "Candidates can view history of own applications" ON public.application_status_history;
CREATE POLICY "Candidates can view history of own applications"
  ON public.application_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.candidate_id = auth.uid()
    )
  );

-- Company members can view status history of applications for their company
DROP POLICY IF EXISTS "Company members can view history of company applications" ON public.application_status_history;
CREATE POLICY "Company members can view history of company applications"
  ON public.application_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND public.is_company_member(a.company_id)
    )
  );

-- Admins can view all status history
DROP POLICY IF EXISTS "Admins can view all status history" ON public.application_status_history;
CREATE POLICY "Admins can view all status history"
  ON public.application_status_history
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 2. IMMUTABILITY TRIGGER ON application_status_history
-- ------------------------------------------------------------------------------
-- Blocks DELETE completely.
-- Allows UPDATE ONLY when changed_by is set from a value to NULL (ON DELETE SET NULL cascade).
CREATE OR REPLACE FUNCTION public.prevent_history_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Application status history records are immutable and cannot be deleted.';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS NOT DISTINCT FROM OLD.id
       AND NEW.application_id IS NOT DISTINCT FROM OLD.application_id
       AND NEW.from_status IS NOT DISTINCT FROM OLD.from_status
       AND NEW.to_status IS NOT DISTINCT FROM OLD.to_status
       AND NEW.note IS NOT DISTINCT FROM OLD.note
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
       AND (
         NEW.changed_by IS NOT DISTINCT FROM OLD.changed_by
         OR (OLD.changed_by IS NOT NULL AND NEW.changed_by IS NULL)
       )
       AND (OLD.changed_by IS NOT NULL AND NEW.changed_by IS NULL)
    THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Application status history records are immutable and cannot be updated.';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_history_modifications ON public.application_status_history;
CREATE TRIGGER trg_prevent_history_modifications
  BEFORE UPDATE OR DELETE ON public.application_status_history
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_history_modifications();

-- ------------------------------------------------------------------------------
-- 3. PREVENT DIRECT CLIENT UPDATES TO applications TABLE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_direct_application_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF current_setting('app.allow_application_update', true) IS DISTINCT FROM 'true'
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Direct updates to applications are prohibited. Use update_application_status RPC.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_application_update ON public.applications;
CREATE TRIGGER trg_prevent_direct_application_update
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_application_update();

-- ------------------------------------------------------------------------------
-- 4. RPC FUNCTION: update_application_status
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_application_status(
  p_application_id uuid,
  p_new_status text,
  p_note text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid;
  v_company_id uuid;
  v_current_status text;
  v_target_status text;
BEGIN
  v_caller_id := auth.uid();
  v_target_status := lower(trim(p_new_status));

  -- 1. Validate status argument
  IF v_target_status NOT IN ('applied', 'shortlisted', 'selected', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status "%". Allowed statuses: applied, shortlisted, selected, rejected.', p_new_status;
  END IF;

  -- 2. Fetch application info
  SELECT company_id, status
  INTO v_company_id, v_current_status
  FROM public.applications
  WHERE id = p_application_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  -- 3. Permission checks (never use current_user)
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    IF v_caller_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required to update application status.';
    END IF;

    IF NOT public.is_admin() AND NOT public.is_company_member(v_company_id) THEN
      RAISE EXCEPTION 'Only authorized company recruiters or administrators can update application status.';
    END IF;
  END IF;

  -- 4. Check if already in target status
  IF v_target_status = v_current_status THEN
    RAISE EXCEPTION 'Application is already in "%" status.', v_current_status;
  END IF;

  -- 5. Allowed transition checks:
  -- 'selected' and 'rejected' are final. Only platform administrators may modify final statuses.
  IF v_current_status IN ('selected', 'rejected') THEN
    IF NOT public.is_admin() AND session_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Status "%" is final. Only platform administrators may modify final statuses.', v_current_status;
    END IF;
  ELSE
    -- Non-final transitions:
    -- applied -> shortlisted or rejected
    -- shortlisted -> selected or rejected
    IF v_current_status = 'applied' THEN
      IF v_target_status NOT IN ('shortlisted', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status transition from "%" to "%". Allowed next statuses: shortlisted, rejected.', v_current_status, v_target_status;
      END IF;
    ELSIF v_current_status = 'shortlisted' THEN
      IF v_target_status NOT IN ('selected', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status transition from "%" to "%". Allowed next statuses: selected, rejected.', v_current_status, v_target_status;
      END IF;
    END IF;
  END IF;

  -- 6. Enable system update bypass for trigger
  PERFORM set_config('app.allow_application_update', 'true', true);

  -- 7. Update status on application
  UPDATE public.applications
  SET status = v_target_status
  WHERE id = p_application_id;

  -- 8. Record audit entry in application_status_history
  INSERT INTO public.application_status_history (
    application_id, from_status, to_status, changed_by, note, created_at
  ) VALUES (
    p_application_id, v_current_status, v_target_status, v_caller_id, trim(p_note), now()
  );

  RETURN v_target_status;
END;
$$;

REVOKE ALL ON FUNCTION public.update_application_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_application_status(uuid, text, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. UPDATE apply_to_job TO INSERT INITIAL STATUS HISTORY (null -> 'applied')
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_to_job(
  p_job_id uuid,
  p_full_name text,
  p_phone text,
  p_cover_note text,
  p_resume_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_email text;
  v_job_status text;
  v_job_title text;
  v_company_id uuid;
  v_company_status text;
  v_app_cost integer;
  v_balance integer;
  v_new_balance integer;
  v_application_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit applications.';
  END IF;

  -- 1. Check caller is a candidate
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role = 'candidate') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only candidate accounts are permitted to apply for positions.';
  END IF;

  -- 2. Validate input fields
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Full name is required.';
  END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RAISE EXCEPTION 'Contact phone number is required.';
  END IF;
  IF p_resume_path IS NULL OR length(trim(p_resume_path)) = 0 THEN
    RAISE EXCEPTION 'Resume document is required.';
  END IF;

  -- 3. Verify resume is in the candidate's personal folder
  IF NOT (p_resume_path LIKE (v_caller_id::text || '/%')) THEN
    RAISE EXCEPTION 'Invalid resume path. Files must be located in your personal user directory.';
  END IF;

  -- 4. Check user has not already applied
  IF EXISTS (SELECT 1 FROM public.applications WHERE job_id = p_job_id AND candidate_id = v_caller_id) THEN
    RAISE EXCEPTION 'You have already submitted an application for this position.';
  END IF;

  -- 5. Fetch job and company verification status
  SELECT j.title, j.status, j.company_id, c.verification_status
  INTO v_job_title, v_job_status, v_company_id, v_company_status
  FROM public.jobs j
  JOIN public.companies c ON j.company_id = c.id
  WHERE j.id = p_job_id;

  IF v_job_title IS NULL THEN
    RAISE EXCEPTION 'Job not found.';
  END IF;

  IF v_company_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Applications cannot be accepted for unverified companies.';
  END IF;

  IF v_job_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'This job is not accepting applications right now.';
  END IF;

  -- 6. Read application cost
  SELECT COALESCE(value::integer, 10) INTO v_app_cost
  FROM public.platform_settings
  WHERE key = 'application_cost';
  IF v_app_cost IS NULL THEN v_app_cost := 10; END IF;

  PERFORM set_config('app.system_setting_status', 'true', true);

  -- 7. Lock company credits row FOR UPDATE
  SELECT balance INTO v_balance
  FROM public.company_credits
  WHERE company_id = v_company_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO public.company_credits (company_id, balance)
    VALUES (v_company_id, 0)
    RETURNING balance INTO v_balance;
  END IF;

  -- 8. If balance < cost, pause open jobs and RETURN NULL (without rolling back the pause)
  IF v_balance < v_app_cost THEN
    UPDATE public.jobs
    SET status = 'paused', updated_at = now()
    WHERE company_id = v_company_id AND status = 'open';

    RETURN NULL;
  END IF;

  -- 9. Deduct cost atomically
  v_new_balance := v_balance - v_app_cost;

  UPDATE public.company_credits
  SET balance = v_new_balance, updated_at = now()
  WHERE company_id = v_company_id;

  -- 10. Extract verified email from auth.users
  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

  -- 11. Record application
  INSERT INTO public.applications (
    job_id, company_id, candidate_id, full_name, email, phone, cover_note, resume_path, credits_charged
  ) VALUES (
    p_job_id, v_company_id, v_caller_id, trim(p_full_name), v_caller_email, trim(p_phone), p_cover_note, p_resume_path, v_app_cost
  )
  RETURNING id INTO v_application_id;

  -- 12. Record in immutable credit_ledger
  INSERT INTO public.credit_ledger (
    company_id, type, amount, balance_after, application_id, reference, note, created_by
  ) VALUES (
    v_company_id, 'application_charge', -v_app_cost, v_new_balance, v_application_id,
    'APP-' || substr(v_application_id::text, 1, 8),
    'Candidate application for ' || v_job_title,
    v_caller_id
  );

  -- 13. Record initial status in application_status_history (null -> 'applied')
  INSERT INTO public.application_status_history (
    application_id, from_status, to_status, changed_by, note, created_at
  ) VALUES (
    v_application_id, NULL, 'applied', v_caller_id, 'Application submitted by candidate.', now()
  );

  -- 14. If balance reached zero, automatically pause all remaining open jobs
  IF v_new_balance = 0 THEN
    UPDATE public.jobs
    SET status = 'paused', updated_at = now()
    WHERE company_id = v_company_id AND status = 'open';
  END IF;

  RETURN v_application_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. BACKFILL INITIAL STATUS HISTORY FOR ANY EXISTING APPLICATIONS
-- ------------------------------------------------------------------------------
INSERT INTO public.application_status_history (
  application_id, from_status, to_status, changed_by, note, created_at
)
SELECT a.id, NULL, a.status, a.candidate_id, 'Initial application', a.created_at
FROM public.applications a
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_status_history h WHERE h.application_id = a.id
);

-- ------------------------------------------------------------------------------
-- 7. ENABLE REALTIME ON applications TABLE
-- ------------------------------------------------------------------------------
ALTER TABLE public.applications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
  END IF;
END;
$$;
