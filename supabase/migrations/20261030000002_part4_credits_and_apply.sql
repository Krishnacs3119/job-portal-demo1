-- ==============================================================================
-- PART 4: CREDITS, IMMUTABLE LEDGER, APPLICATIONS, AND PRIVATE RESUME STORAGE
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. SECURITY FIXES TO PART 3 SCHEMA
-- ------------------------------------------------------------------------------

-- 0.1 Drop policy allowing client insertion into company_members
-- (setup_company is SECURITY DEFINER and already handles membership securely)
DROP POLICY IF EXISTS "Recruiters and admins can join company as creator" ON public.company_members;

-- 0.2 BEFORE UPDATE trigger on companies:
-- Only admins can change verification_status or created_by.
-- Members may only edit name, description, website, location, logo_url.
CREATE OR REPLACE FUNCTION public.check_company_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (NEW.verification_status IS DISTINCT FROM OLD.verification_status OR NEW.created_by IS DISTINCT FROM OLD.created_by) THEN
    IF NOT public.is_admin() AND current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Only administrators are permitted to modify company verification status or ownership.';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_company_update_permissions ON public.companies;
CREATE TRIGGER trg_check_company_update_permissions
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.check_company_update_permissions();

-- 0.3 Add 'paused' to allowed values of jobs.status
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (status IN ('open', 'closed', 'paused'));

-- ------------------------------------------------------------------------------
-- 1. PLATFORM SETTINGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Everyone can read platform settings"
  ON public.platform_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Only admins can modify platform settings" ON public.platform_settings;
CREATE POLICY "Only admins can modify platform settings"
  ON public.platform_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed application_cost = 10
INSERT INTO public.platform_settings (key, value, description)
VALUES ('application_cost', '10', 'Credits deducted from hiring company per submitted application')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ------------------------------------------------------------------------------
-- 2. COMPANY CREDITS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_credits (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_credits ENABLE ROW LEVEL SECURITY;

-- RLS: Company members and admins ONLY can read balance (NEVER public)
DROP POLICY IF EXISTS "Company members and admins can view credit balance" ON public.company_credits;
CREATE POLICY "Company members and admins can view credit balance"
  ON public.company_credits
  FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id) OR public.is_admin());

-- Backfill company_credits for existing companies
INSERT INTO public.company_credits (company_id, balance)
SELECT id, 0 FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. APPLICATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  cover_note text,
  resume_path text NOT NULL,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'shortlisted', 'selected', 'rejected')),
  credits_charged integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Candidates read only their own applications
DROP POLICY IF EXISTS "Candidates can view own applications" ON public.applications;
CREATE POLICY "Candidates can view own applications"
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (candidate_id = auth.uid());

-- Company members read applications for their company
DROP POLICY IF EXISTS "Company members can view company applications" ON public.applications;
CREATE POLICY "Company members can view company applications"
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

-- Admins read all applications
DROP POLICY IF EXISTS "Admins can view all applications" ON public.applications;
CREATE POLICY "Admins can view all applications"
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 4. CREDIT LEDGER TABLE (IMMUTABLE AUDIT LOG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('admin_topup', 'application_charge', 'adjustment')),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  reference text,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

-- Members and admins can view credit ledger
DROP POLICY IF EXISTS "Company members and admins can view credit ledger" ON public.credit_ledger;
CREATE POLICY "Company members and admins can view credit ledger"
  ON public.credit_ledger
  FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id) OR public.is_admin());

-- Immutable trigger: blocks UPDATE and DELETE on credit_ledger
CREATE OR REPLACE FUNCTION public.prevent_ledger_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'Credit ledger records are immutable and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ledger_modifications ON public.credit_ledger;
CREATE TRIGGER trg_prevent_ledger_modifications
  BEFORE UPDATE OR DELETE ON public.credit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ledger_modifications();

-- UNIQUE index on reference for admin_topup to prevent duplicate top-ups
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_unique_topup_ref
  ON public.credit_ledger (reference)
  WHERE type = 'admin_topup' AND reference IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. JOB STATUS TRANSITION ENFORCEMENT TRIGGER
-- ------------------------------------------------------------------------------
-- Recruiter cannot manually set 'paused'.
-- Recruiter cannot reopen job if balance < application_cost.
CREATE OR REPLACE FUNCTION public.check_job_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_app_cost integer;
  v_balance integer;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Block manual setting to 'paused' unless done by internal system transaction
    IF NEW.status = 'paused' 
       AND current_setting('app.system_setting_status', true) IS DISTINCT FROM 'true' 
       AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Status "paused" can only be set automatically by the platform.';
    END IF;

    -- If recruiter tries to reopen job (closed/paused -> open), verify sufficient balance
    IF NEW.status = 'open' 
       AND current_setting('app.system_setting_status', true) IS DISTINCT FROM 'true' 
       AND NOT public.is_admin() THEN
      SELECT COALESCE(value::integer, 10) INTO v_app_cost
      FROM public.platform_settings
      WHERE key = 'application_cost';
      IF v_app_cost IS NULL THEN v_app_cost := 10; END IF;

      SELECT balance INTO v_balance
      FROM public.company_credits
      WHERE company_id = NEW.company_id;

      IF COALESCE(v_balance, 0) < v_app_cost THEN
        RAISE EXCEPTION 'Cannot open job. Company has insufficient credits (Balance: %, Required: %). Please top up credits first.', COALESCE(v_balance, 0), v_app_cost;
      END IF;
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_job_status_transition ON public.jobs;
CREATE TRIGGER trg_check_job_status_transition
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_job_status_transition();

-- ------------------------------------------------------------------------------
-- 6. ATOMIC APPLICATION FUNCTION: apply_to_job
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

  -- 3. Verify resume is in the candidate folder
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

  -- Allow system-level status transition
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

  -- 8. If balance < cost, pause all open jobs and abort
  IF v_balance < v_app_cost THEN
    UPDATE public.jobs
    SET status = 'paused', updated_at = now()
    WHERE company_id = v_company_id AND status = 'open';

    RAISE EXCEPTION 'This job is not accepting applications right now.';
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
    p_job_id, v_company_id, v_caller_id, trim(p_full_name), v_caller_email, trim(p_phone), trim(p_cover_note), p_resume_path, v_app_cost
  ) RETURNING id INTO v_application_id;

  -- 12. Record ledger charge
  INSERT INTO public.credit_ledger (
    company_id, type, amount, balance_after, application_id, note, created_by
  ) VALUES (
    v_company_id, 'application_charge', -v_app_cost, v_new_balance, v_application_id, 'Application fee for role: ' || v_job_title, v_caller_id
  );

  -- 13. If remaining balance < cost, pause all open jobs for this company
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
-- 7. ADMIN CREDIT TOPUP FUNCTION: admin_add_credits
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_add_credits(
  p_company_id uuid,
  p_amount integer,
  p_reference text,
  p_note text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_balance integer;
  v_new_balance integer;
  v_app_cost integer;
BEGIN
  IF NOT public.is_admin() AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Admin privileges required to allocate company credits.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be greater than zero.';
  END IF;

  IF p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'Payment reference ID (Razorpay ID) is required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'Company not found.';
  END IF;

  -- Lock credit row FOR UPDATE
  SELECT balance INTO v_balance
  FROM public.company_credits
  WHERE company_id = p_company_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO public.company_credits (company_id, balance)
    VALUES (p_company_id, 0)
    RETURNING balance INTO v_balance;
  END IF;

  v_new_balance := v_balance + p_amount;

  UPDATE public.company_credits
  SET balance = v_new_balance, updated_at = now()
  WHERE company_id = p_company_id;

  INSERT INTO public.credit_ledger (
    company_id, type, amount, balance_after, reference, note, created_by
  ) VALUES (
    p_company_id, 'admin_topup', p_amount, v_new_balance, trim(p_reference), p_note, auth.uid()
  );

  -- Fetch app cost
  SELECT COALESCE(value::integer, 10) INTO v_app_cost
  FROM public.platform_settings
  WHERE key = 'application_cost';
  IF v_app_cost IS NULL THEN v_app_cost := 10; END IF;

  -- If company now has sufficient credits, restore paused jobs back to open
  IF v_new_balance >= v_app_cost THEN
    PERFORM set_config('app.system_setting_status', 'true', true);

    UPDATE public.jobs
    SET status = 'open', updated_at = now()
    WHERE company_id = p_company_id AND status = 'paused';
  END IF;

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_credits(uuid, integer, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_add_credits(uuid, integer, text, text) TO authenticated;

-- Update setup_company to initialize company_credits
CREATE OR REPLACE FUNCTION public.setup_company(
  company_name text,
  company_desc text,
  company_website text,
  company_location text,
  company_logo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_comp_id uuid;
  caller_id uuid;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_recruiter() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only users with the recruiter or admin role can set up a company';
  END IF;

  INSERT INTO public.companies (name, description, website, location, logo_url, created_by)
  VALUES (company_name, company_desc, company_website, company_location, company_logo_url, caller_id)
  RETURNING id INTO new_comp_id;

  INSERT INTO public.company_members (company_id, user_id)
  VALUES (new_comp_id, caller_id);

  INSERT INTO public.company_credits (company_id, balance)
  VALUES (new_comp_id, 0)
  ON CONFLICT (company_id) DO NOTHING;

  RETURN new_comp_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. STORAGE CONFIGURATION FOR RESUMES BUCKET
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resumes', 'resumes', false, 2097152, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['application/pdf']::text[];

-- Candidate upload policy
DROP POLICY IF EXISTS "Candidates can upload resume into own user folder" ON storage.objects;
CREATE POLICY "Candidates can upload resume into own user folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) = 'pdf'
  );

-- Candidate view own resume policy
DROP POLICY IF EXISTS "Candidates can view own uploaded resume" ON storage.objects;
CREATE POLICY "Candidates can view own uploaded resume"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Candidate delete own resume policy
DROP POLICY IF EXISTS "Candidates can delete own uploaded resume" ON storage.objects;
CREATE POLICY "Candidates can delete own uploaded resume"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Company members can view resumes of their applicants
DROP POLICY IF EXISTS "Company members can view resumes of their applicants" ON storage.objects;
CREATE POLICY "Company members can view resumes of their applicants"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.company_members cm ON a.company_id = cm.company_id
      WHERE cm.user_id = auth.uid()
        AND a.resume_path = storage.objects.name
    )
  );

-- Admins can view all resumes
DROP POLICY IF EXISTS "Admins can view all resumes" ON storage.objects;
CREATE POLICY "Admins can view all resumes"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND public.is_admin()
  );
