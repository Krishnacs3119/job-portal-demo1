-- ==============================================================================
-- PART 4 SECURITY FIX: SESSION_USER PRIVILEGES, ATOMIC JOB PAUSING & STORAGE HARDENING
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX session_user IN SECURITY DEFINER FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------------------------
-- Inside SECURITY DEFINER functions, current_user evaluates to function owner ('postgres'),
-- which erroneously bypasses security checks. Using session_user ensures only the true
-- connected role (or SQL editor postgres session) can perform administrative operations.

-- 1.1 Fix prevent_profile_role_or_email_change trigger on profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_role_or_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_setting('app.allow_role_change', true) IS DISTINCT FROM 'true' 
       AND session_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Role cannot be modified directly via client update';
    END IF;
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    IF session_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Email cannot be modified directly via profile update';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1.2 Fix check_company_update_permissions trigger on companies
CREATE OR REPLACE FUNCTION public.check_company_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (NEW.verification_status IS DISTINCT FROM OLD.verification_status OR NEW.created_by IS DISTINCT FROM OLD.created_by) THEN
    IF NOT public.is_admin() AND session_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Only administrators are permitted to modify company verification status or ownership.';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1.3 Fix admin_add_credits function
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
  -- Check admin privileges using session_user (or is_admin for admin JWT)
  IF NOT public.is_admin() AND session_user NOT IN ('postgres', 'supabase_admin') THEN
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

  SELECT COALESCE(value::integer, 10) INTO v_app_cost
  FROM public.platform_settings
  WHERE key = 'application_cost';
  IF v_app_cost IS NULL THEN v_app_cost := 10; END IF;

  -- Restore paused jobs back to open if balance >= cost
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

-- ------------------------------------------------------------------------------
-- 2. FIX apply_to_job: ATOMIC PAUSE WITHOUT ROLLBACK (RETURNS NULL)
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
    p_job_id, v_company_id, v_caller_id, trim(p_full_name), v_caller_email, trim(p_phone), trim(p_cover_note), p_resume_path, v_app_cost
  ) RETURNING id INTO v_application_id;

  -- 12. Record ledger charge
  INSERT INTO public.credit_ledger (
    company_id, type, amount, balance_after, application_id, note, created_by
  ) VALUES (
    v_company_id, 'application_charge', -v_app_cost, v_new_balance, v_application_id, 'Application fee for role: ' || v_job_title, v_caller_id
  );

  -- 13. If new balance is below cost for next applicant, pause company's open jobs
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
-- 3. HARDEN RESUME STORAGE DELETE POLICY
-- ------------------------------------------------------------------------------
-- Drop unrestricted delete policy
DROP POLICY IF EXISTS "Candidates can delete own uploaded resume" ON storage.objects;
DROP POLICY IF EXISTS "Candidates can delete unreferenced resume" ON storage.objects;

-- Only permit deleting a resume if it has NOT been referenced by any submitted application
CREATE POLICY "Candidates can delete unreferenced resume"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND NOT EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.resume_path = storage.objects.name
    )
  );

-- ------------------------------------------------------------------------------
-- 4. DROP DIRECT INSERT POLICY ON COMPANIES
-- ------------------------------------------------------------------------------
-- Company creation MUST go through setup_company RPC (which enforces recruiter/admin checks,
-- initializes credits, and links creator). Direct client inserts are strictly prohibited.
DROP POLICY IF EXISTS "Recruiters and admins can create companies" ON public.companies;
