-- ==============================================================================
-- PART 6-8 SECURITY & VERIFICATION STATUS UNIFICATION FIXES
-- ==============================================================================
-- Security Rule:
-- Never use current_user for permission checks.
-- Use auth.uid() with is_admin() / is_company_member().
-- Use session_user only to allow postgres/supabase_admin (e.g. SQL editor / migrations).
-- Always set search_path = public, auth.

-- ------------------------------------------------------------------------------
-- 1. NOTIFICATIONS SECURITY FIXES
-- ------------------------------------------------------------------------------
-- 1.1 Drop client INSERT policy on notifications.
-- Clients must NEVER insert notifications directly; only the system triggers
-- (handle_application_status_notification) and broadcast_admin_announcement create them.
DROP POLICY IF EXISTS "Admins and authorized recruiters can insert notifications" ON public.notifications;

-- 1.2 Restrict client UPDATE on notifications to 'is_read' column only.
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

-- Ensure RLS update policy enforces auth.uid() = user_id
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 2. COMPANY VERIFICATION STATUS UNIFICATION ('pending', 'approved', 'rejected')
-- ------------------------------------------------------------------------------
-- 2.1 Convert all legacy 'verified' companies to 'approved'
UPDATE public.companies
SET verification_status = 'approved', updated_at = now()
WHERE verification_status = 'verified';

-- 2.2 Update check constraint to strictly allow only 'pending', 'approved', 'rejected'
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_verification_status_check;
ALTER TABLE public.companies ADD CONSTRAINT companies_verification_status_check
  CHECK (verification_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.companies ALTER COLUMN verification_status SET DEFAULT 'pending';

-- 2.3 Prevent non-admin / non-postgres users from modifying verification_status
CREATE OR REPLACE FUNCTION public.check_company_verification_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NOT public.is_admin() AND session_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Only administrators can change company verification status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_company_verification_status_update ON public.companies;
CREATE TRIGGER trg_check_company_verification_status_update
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.check_company_verification_status_update();

-- 2.4 Update admin_verify_company RPC function to only allow ('pending', 'approved', 'rejected')
CREATE OR REPLACE FUNCTION public.admin_verify_company(
  p_company_id uuid,
  p_status text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_status text;
BEGIN
  IF NOT public.is_admin() AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Admin privileges required to verify employers.';
  END IF;

  v_target_status := lower(trim(p_status));
  IF v_target_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid verification status: %. Allowed: approved, rejected, pending.', p_status;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'Company not found.';
  END IF;

  UPDATE public.companies
  SET verification_status = v_target_status, updated_at = now()
  WHERE id = p_company_id;

  RETURN v_target_status;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_verify_company(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_verify_company(uuid, text) TO authenticated;

-- 2.5 Update check_job_insert_verification trigger to check verification_status = 'approved'
CREATE OR REPLACE FUNCTION public.check_job_insert_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_verif text;
BEGIN
  SELECT verification_status INTO v_verif
  FROM public.companies
  WHERE id = NEW.company_id;

  IF v_verif IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Employer is not verified. Only approved companies can post jobs.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_job_insert_verification ON public.jobs;
CREATE TRIGGER trg_check_job_insert_verification
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_job_insert_verification();

-- 2.6 Update RLS policies on companies and jobs to use 'approved'
DROP POLICY IF EXISTS "Public can view approved companies" ON public.companies;
DROP POLICY IF EXISTS "Companies readable by authenticated users" ON public.companies;
CREATE POLICY "Public can view approved companies"
  ON public.companies
  FOR SELECT
  TO anon, authenticated
  USING (
    verification_status = 'approved'
    OR public.is_company_member(id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Recruiters can create jobs for own companies" ON public.jobs;
CREATE POLICY "Recruiters can create jobs for own companies"
  ON public.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_recruiter() OR public.is_admin())
    AND public.is_company_member(company_id)
    AND auth.uid() = posted_by
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Public can view open jobs of approved companies" ON public.jobs;
CREATE POLICY "Public can view open jobs of approved companies"
  ON public.jobs
  FOR SELECT
  TO anon, authenticated
  USING (
    (
      status = 'open'
      AND EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = company_id AND c.verification_status = 'approved'
      )
    )
    OR public.is_company_member(company_id)
    OR public.is_admin()
  );

-- ------------------------------------------------------------------------------
-- 3. PROFILES PRIVACY CONFIRMATION
-- ------------------------------------------------------------------------------
-- Non-admin users selecting from public.profiles only receive their own record.
-- Email and phone numbers are strictly protected by auth.uid() = id.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
