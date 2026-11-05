CREATE TABLE IF NOT EXISTS public.credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  credits integer NOT NULL CHECK (credits > 0),
  price_inr integer NOT NULL CHECK (price_inr >= 0),
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active credit packs" ON public.credit_packs;
CREATE POLICY "Public can view active credit packs"
  ON public.credit_packs
  FOR SELECT
  TO anon, authenticated
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can insert credit packs" ON public.credit_packs;
CREATE POLICY "Admins can insert credit packs"
  ON public.credit_packs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update credit packs" ON public.credit_packs;
CREATE POLICY "Admins can update credit packs"
  ON public.credit_packs
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete credit packs" ON public.credit_packs;
CREATE POLICY "Admins can delete credit packs"
  ON public.credit_packs
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

INSERT INTO public.credit_packs (name, credits, price_inr, active, sort)
VALUES
  ('Starter', 100, 1000, true, 1),
  ('Growth', 500, 5000, true, 2),
  ('Scale', 1000, 10000, true, 3)
ON CONFLICT (name) DO UPDATE
SET credits = EXCLUDED.credits,
    price_inr = EXCLUDED.price_inr,
    active = EXCLUDED.active,
    sort = EXCLUDED.sort;

CREATE TABLE IF NOT EXISTS public.credit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.credit_packs(id) ON DELETE RESTRICT,
  credits integer NOT NULL CHECK (credits > 0),
  price_inr integer NOT NULL CHECK (price_inr >= 0),
  payment_reference text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_requests_company_created
  ON public.credit_requests (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_requests_status
  ON public.credit_requests (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_requests_unique_payment_ref
  ON public.credit_requests (lower(trim(payment_reference)));

ALTER TABLE public.credit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members and admins can view credit requests" ON public.credit_requests;
CREATE POLICY "Company members and admins can view credit requests"
  ON public.credit_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_company_member(company_id)
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.created_by = auth.uid()
    )
    OR public.is_admin()
  );

ALTER TABLE public.credit_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'credit_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_requests;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_credits(
  p_company_id uuid,
  p_pack_id uuid,
  p_payment_reference text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid;
  v_company_status text;
  v_credits integer;
  v_price_inr integer;
  v_active boolean;
  v_clean_ref text;
  v_pending_count integer;
  v_request_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT verification_status INTO v_company_status
  FROM public.companies
  WHERE id = p_company_id;

  IF v_company_status IS NULL THEN
    RAISE EXCEPTION 'Company not found.';
  END IF;

  IF v_company_status <> 'approved' THEN
    RAISE EXCEPTION 'Company must be approved to request credits.';
  END IF;

  IF NOT (
    public.is_company_member(p_company_id)
    OR EXISTS (
      SELECT 1 FROM public.companies
      WHERE id = p_company_id AND created_by = v_caller_id
    )
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Only authorized company recruiters or administrators can request credits.';
  END IF;

  SELECT credits, price_inr, active INTO v_credits, v_price_inr, v_active
  FROM public.credit_packs
  WHERE id = p_pack_id;

  IF v_credits IS NULL OR v_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Credit pack is not active or does not exist.';
  END IF;

  v_clean_ref := trim(p_payment_reference);
  IF v_clean_ref IS NULL OR length(v_clean_ref) < 6 OR length(v_clean_ref) > 40 THEN
    RAISE EXCEPTION 'Payment reference must be between 6 and 40 characters.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.credit_requests
    WHERE lower(trim(payment_reference)) = lower(v_clean_ref)
  ) THEN
    RAISE EXCEPTION 'Payment reference has already been submitted.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.credit_ledger
    WHERE reference IS NOT NULL AND lower(trim(reference)) = lower(v_clean_ref)
  ) THEN
    RAISE EXCEPTION 'Payment reference has already been processed.';
  END IF;

  SELECT count(*) INTO v_pending_count
  FROM public.credit_requests
  WHERE company_id = p_company_id AND status = 'pending';

  IF v_pending_count >= 3 THEN
    RAISE EXCEPTION 'Company already has 3 pending credit requests. Please wait for them to be resolved.';
  END IF;

  INSERT INTO public.credit_requests (
    company_id,
    requested_by,
    pack_id,
    credits,
    price_inr,
    payment_reference,
    status
  ) VALUES (
    p_company_id,
    v_caller_id,
    p_pack_id,
    v_credits,
    v_price_inr,
    v_clean_ref,
    'pending'
  ) RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_credits(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_credits(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_credit_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_req public.credit_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Admin privileges required to resolve credit requests.';
  END IF;

  IF p_approve IS NULL THEN
    RAISE EXCEPTION 'Approval decision (p_approve) cannot be null.';
  END IF;

  SELECT * INTO v_req
  FROM public.credit_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Credit request not found.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Credit request has already been resolved.';
  END IF;

  IF p_approve IS TRUE THEN
    PERFORM public.admin_add_credits(
      v_req.company_id,
      v_req.credits,
      v_req.payment_reference,
      COALESCE(trim(p_note), 'Approved credit request')
    );

    UPDATE public.credit_requests
    SET status = 'approved',
        admin_note = trim(p_note),
        resolved_by = auth.uid(),
        resolved_at = now()
    WHERE id = p_request_id;

    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      link
    ) VALUES (
      v_req.requested_by,
      'general',
      'Credit Request Approved',
      format('Your request for %s credits has been approved.', v_req.credits),
      '/dashboard/credits'
    );
  ELSE
    UPDATE public.credit_requests
    SET status = 'rejected',
        admin_note = trim(p_note),
        resolved_by = auth.uid(),
        resolved_at = now()
    WHERE id = p_request_id;

    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      link
    ) VALUES (
      v_req.requested_by,
      'general',
      'Credit Request Rejected',
      COALESCE(trim(p_note), 'Your credit request was rejected. Please contact support or submit a valid payment reference.'),
      '/dashboard/credits'
    );
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_credit_request(uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_credit_request(uuid, boolean, text) TO authenticated;
