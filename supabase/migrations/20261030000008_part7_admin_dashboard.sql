ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_verification_status_check;
ALTER TABLE public.companies ADD CONSTRAINT companies_verification_status_check
  CHECK (verification_status IN ('pending', 'verified', 'approved', 'rejected'));

ALTER TABLE public.companies ALTER COLUMN verification_status SET DEFAULT 'pending';

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

  INSERT INTO public.companies (
    name, description, website, location, logo_url, verification_status, created_by
  ) VALUES (
    company_name, company_desc, company_website, company_location, company_logo_url, 'pending', caller_id
  )
  RETURNING id INTO new_comp_id;

  INSERT INTO public.company_members (company_id, user_id)
  VALUES (new_comp_id, caller_id);

  INSERT INTO public.company_credits (company_id, balance)
  VALUES (new_comp_id, 0)
  ON CONFLICT (company_id) DO NOTHING;

  RETURN new_comp_id;
END;
$$;

REVOKE ALL ON FUNCTION public.setup_company(text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.setup_company(text, text, text, text, text) TO authenticated;

DROP POLICY IF EXISTS "Public can view approved companies" ON public.companies;
CREATE POLICY "Public can view approved companies"
  ON public.companies
  FOR SELECT
  TO anon, authenticated
  USING (
    verification_status IN ('verified', 'approved')
    OR public.is_company_member(id)
    OR public.is_admin()
  );

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

  IF v_verif IS NULL OR v_verif NOT IN ('verified', 'approved') THEN
    RAISE EXCEPTION 'Employer is not verified. Only verified companies can post jobs.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_job_insert_verification ON public.jobs;
CREATE TRIGGER trg_check_job_insert_verification
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_job_insert_verification();

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
      WHERE c.id = company_id AND c.verification_status IN ('verified', 'approved')
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
        WHERE c.id = company_id AND c.verification_status IN ('verified', 'approved')
      )
    )
    OR public.is_company_member(company_id)
    OR public.is_admin()
  );

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
  IF v_target_status NOT IN ('verified', 'approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'Invalid verification status: %. Allowed: verified, rejected, pending.', p_status;
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

CREATE OR REPLACE FUNCTION public.admin_add_credits(
  p_company_id uuid,
  p_amount integer,
  p_payment_ref text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.admin_add_credits(p_company_id, p_amount, p_payment_ref, NULL::text);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_credits(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_add_credits(uuid, integer, text) TO authenticated;

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
