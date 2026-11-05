-- ==============================================================================
-- PART 6-8 ENHANCEMENTS: SECURE SELECTION EMAIL & ADMIN PROFILES SELECT POLICY
-- ==============================================================================
-- Security Rule:
-- Never use current_user for permission checks.
-- Use auth.uid() with is_admin() / is_company_member().
-- Use session_user only to allow postgres/supabase_admin (e.g. SQL editor / migrations).
-- Always set search_path = public, auth.

-- ------------------------------------------------------------------------------
-- 1. SELECTION EMAIL TRACKING COLUMN
-- ------------------------------------------------------------------------------
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS selection_email_sent_at timestamptz DEFAULT NULL;

-- ------------------------------------------------------------------------------
-- 2. RPC: claim_selection_email
-- ------------------------------------------------------------------------------
-- Atomically claims permission to send a selection email for a 'selected' application.
-- Caller must be an authorized member of the application's company or an admin.
-- Candidates are strictly prohibited from claiming selection emails.
-- Sets selection_email_sent_at = now() and returns candidate/job details from the DB.
-- If the email was already sent (selection_email_sent_at IS NOT NULL), returns no rows.
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

  -- 6. Return verified details directly from database tables
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
-- 3. RPC: release_selection_email
-- ------------------------------------------------------------------------------
-- Reverts selection_email_sent_at back to NULL if transactional email provider delivery fails.
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
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT a.company_id, a.candidate_id
  INTO v_company_id, v_candidate_id
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

  PERFORM set_config('app.allow_application_update', 'true', true);

  UPDATE public.applications
  SET selection_email_sent_at = NULL
  WHERE id = p_application_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.release_selection_email(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.release_selection_email(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. ADMIN USER DIRECTORY SELECT POLICY ON PROFILES
-- ------------------------------------------------------------------------------
-- Allows platform administrators to view all profiles for management & overview.
-- Standard candidate and recruiter own-row policies remain strictly untouched.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
