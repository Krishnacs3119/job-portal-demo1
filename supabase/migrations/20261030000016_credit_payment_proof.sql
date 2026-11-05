ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS screenshot_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment_proofs',
  'payment_proofs',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']::text[];

DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment proofs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment_proofs'
  );

DROP POLICY IF EXISTS "Company members and admins can view payment proofs" ON storage.objects;
CREATE POLICY "Company members and admins can view payment proofs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment_proofs'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.credit_requests cr
        WHERE cr.screenshot_url = storage.objects.name
          AND (
            cr.requested_by = auth.uid()
            OR public.is_company_member(cr.company_id)
            OR EXISTS (
              SELECT 1 FROM public.companies c
              WHERE c.id = cr.company_id AND c.created_by = auth.uid()
            )
          )
      )
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE OR REPLACE FUNCTION public.request_credits(
  p_company_id uuid,
  p_pack_id uuid,
  p_payment_reference text,
  p_screenshot_url text DEFAULT NULL
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
  v_clean_screenshot text;
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

  v_clean_screenshot := nullif(trim(p_screenshot_url), '');

  INSERT INTO public.credit_requests (
    company_id,
    requested_by,
    pack_id,
    credits,
    price_inr,
    payment_reference,
    screenshot_url,
    status
  ) VALUES (
    p_company_id,
    v_caller_id,
    p_pack_id,
    v_credits,
    v_price_inr,
    v_clean_ref,
    v_clean_screenshot,
    'pending'
  ) RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_credits(uuid, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_credits(uuid, uuid, text, text) TO authenticated;

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
BEGIN
  RETURN public.request_credits(p_company_id, p_pack_id, p_payment_reference, NULL::text);
END;
$$;

REVOKE ALL ON FUNCTION public.request_credits(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_credits(uuid, uuid, text) TO authenticated;
