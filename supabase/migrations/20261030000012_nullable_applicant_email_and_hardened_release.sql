-- ==============================================================================
-- PART 6-8 ENHANCEMENTS: NULLABLE APPLICANT EMAIL & HARDENED EMAIL CLAIM RELEASE
-- ==============================================================================
-- Security Rule:
-- Never use current_user for permission checks.
-- Use auth.uid() with is_admin() / is_company_member().
-- Use session_user only to allow postgres/supabase_admin (e.g. SQL editor / migrations).
-- Always set search_path = public, auth.

-- ------------------------------------------------------------------------------
-- 1. MAKE applications.email NULLABLE
-- ------------------------------------------------------------------------------
-- Phone OTP authenticated users do not possess an email address in auth.users.
-- Allowing NULL ensures candidates authenticated via phone OTP can apply smoothly.
ALTER TABLE public.applications
ALTER COLUMN email DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. UPDATE apply_to_job RPC
-- ------------------------------------------------------------------------------
-- Copies auth.users.email (which may be NULL for phone-only users) into applications.email
-- without raising not-null violations.
CREATE OR REPLACE FUNCTION public.apply_to_job(
  p_job_id      uuid,
  p_full_name   text,
  p_phone       text,
  p_cover_note  text,
  p_resume_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_caller_id      uuid;
  v_caller_email   text;
  v_job_status     text;
  v_job_title      text;
  v_company_id     uuid;
  v_company_status text;
  v_app_cost       integer;
  v_balance        integer;
  v_new_balance    integer;
  v_application_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit applications.';
  END IF;

  -- 1. Check caller is a candidate (or admin)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role = 'candidate')
     AND NOT public.is_admin() THEN
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
  IF EXISTS (
    SELECT 1 FROM public.applications
    WHERE job_id = p_job_id AND candidate_id = v_caller_id
  ) THEN
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

  -- 7. Lock company credits row FOR UPDATE (serializes concurrent applications)
  SELECT balance INTO v_balance
  FROM public.company_credits
  WHERE company_id = v_company_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO public.company_credits (company_id, balance)
    VALUES (v_company_id, 0)
    RETURNING balance INTO v_balance;
  END IF;

  -- 8. If balance < cost, pause open jobs and RETURN NULL
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

  -- 10. Extract email from auth.users (can be NULL for phone OTP sign-ins)
  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

  -- 11. Record application with nullable email
  INSERT INTO public.applications (
    job_id, company_id, candidate_id, full_name, email, phone, cover_note, resume_path, credits_charged
  ) VALUES (
    p_job_id, v_company_id, v_caller_id,
    trim(p_full_name), v_caller_email, trim(p_phone),
    p_cover_note, p_resume_path, v_app_cost
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

  -- 13. Record initial status in application_status_history (NULL -> 'applied')
  INSERT INTO public.application_status_history (
    application_id, from_status, to_status, changed_by, note, created_at
  ) VALUES (
    v_application_id, NULL, 'applied', v_caller_id, 'Application submitted by candidate.', now()
  );

  -- 14. Pause remaining open jobs if new balance cannot cover another application
  IF v_new_balance < v_app_cost THEN
    UPDATE public.jobs
    SET status = 'paused', updated_at = now()
    WHERE company_id = v_company_id AND status = 'open';
  END IF;

  RETURN v_application_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_to_job(uuid, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_to_job(uuid, text, text, text, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. KEEP claim_selection_email WORKING WHEN EMAIL IS NULL
-- ------------------------------------------------------------------------------
-- Atomically claims selection email and returns verified DB details even if email is NULL.
CREATE OR REPLACE FUNCTION public.claim_selection_email(p_application_id uuid)
RETURNS TABLE (
  email text,
  full_name text,
  job_title text,
  company_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid;
  v_company_id uuid;
  v_candidate_id uuid;
  v_status text;
  v_sent_at timestamptz;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- 1. Lock and inspect application
  SELECT a.company_id, a.candidate_id, a.status, a.selection_email_sent_at
  INTO v_company_id, v_candidate_id, v_status, v_sent_at
  FROM public.applications a
  WHERE a.id = p_application_id
  FOR UPDATE OF a;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  -- 2. Caller authorization check (admin or company member, NOT candidate)
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    IF NOT (public.is_admin() OR public.is_company_member(v_company_id)) THEN
      RAISE EXCEPTION 'Only authorized company recruiters or administrators can send selection emails.';
    END IF;

    IF v_caller_id = v_candidate_id AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Candidates cannot trigger selection emails for their own applications.';
    END IF;
  END IF;

  -- 3. Status must be 'selected'
  IF v_status IS DISTINCT FROM 'selected' THEN
    RAISE EXCEPTION 'Application status must be selected to send a selection email.';
  END IF;

  -- 4. If already claimed/sent, return no rows
  IF v_sent_at IS NOT NULL THEN
    RETURN;
  END IF;

  -- 5. Bypass direct-update trigger and set sent timestamp atomically
  PERFORM set_config('app.allow_application_update', 'true', true);

  UPDATE public.applications
  SET selection_email_sent_at = now()
  WHERE id = p_application_id
    AND selection_email_sent_at IS NULL;

  -- 6. Return verified details directly from database tables (email can be NULL)
  RETURN QUERY
  SELECT
    a.email::text,
    a.full_name::text,
    j.title::text AS job_title,
    c.name::text AS company_name
  FROM public.applications a
  JOIN public.jobs j ON j.id = a.job_id
  JOIN public.companies c ON c.id = a.company_id
  WHERE a.id = p_application_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_selection_email(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_selection_email(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. HARDEN release_selection_email (2-MINUTE EXPIRATION WINDOW)
-- ------------------------------------------------------------------------------
-- Only releases claim if selection_email_sent_at is within the last 2 minutes.
CREATE OR REPLACE FUNCTION public.release_selection_email(p_application_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid;
  v_company_id uuid;
  v_candidate_id uuid;
  v_sent_at timestamptz;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT a.company_id, a.candidate_id, a.selection_email_sent_at
  INTO v_company_id, v_candidate_id, v_sent_at
  FROM public.applications a
  WHERE a.id = p_application_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    IF NOT (public.is_admin() OR public.is_company_member(v_company_id)) THEN
      RAISE EXCEPTION 'Only authorized company recruiters or administrators can release selection emails.';
    END IF;

    IF v_caller_id = v_candidate_id AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Candidates cannot release selection emails.';
    END IF;
  END IF;

  -- Hardening: Only release if selection_email_sent_at is not null and within the last 2 minutes
  IF v_sent_at IS NULL THEN
    RETURN false;
  END IF;

  IF v_sent_at < (now() - interval '2 minutes') THEN
    RAISE EXCEPTION 'Cannot release selection email claim: time window (2 minutes) has expired.';
  END IF;

  PERFORM set_config('app.allow_application_update', 'true', true);

  UPDATE public.applications
  SET selection_email_sent_at = NULL
  WHERE id = p_application_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.release_selection_email(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.release_selection_email(uuid) TO authenticated;
