CREATE OR REPLACE FUNCTION public.is_company_member(check_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = check_company_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = check_company_id AND created_by = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_companies()
RETURNS SETOF public.companies
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT DISTINCT c.*
  FROM public.companies c
  LEFT JOIN public.company_members cm ON c.id = cm.company_id
  WHERE cm.user_id = auth.uid() OR c.created_by = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_companies() TO authenticated;

DROP POLICY IF EXISTS "Company members can view company applications" ON public.applications;
CREATE POLICY "Company members can view company applications"
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (
    public.is_company_member(company_id)
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = applications.job_id AND j.posted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = applications.company_id AND c.created_by = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Company members can view history of company applications" ON public.application_status_history;
CREATE POLICY "Company members can view history of company applications"
  ON public.application_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id
        AND (
          public.is_company_member(a.company_id)
          OR EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = a.job_id AND j.posted_by = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = a.company_id AND c.created_by = auth.uid()
          )
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "Company members can view resumes of their applicants" ON storage.objects;
CREATE POLICY "Company members can view resumes of their applicants"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      JOIN public.companies c ON c.id = a.company_id
      WHERE a.resume_path = storage.objects.name
        AND (
          public.is_company_member(a.company_id)
          OR j.posted_by = auth.uid()
          OR c.created_by = auth.uid()
          OR public.is_admin()
        )
    )
  );

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
  v_job_id uuid;
  v_job_posted_by uuid;
  v_status text;
  v_sent_at timestamptz;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT a.company_id, a.candidate_id, a.job_id, a.status, a.selection_email_sent_at, j.posted_by
  INTO v_company_id, v_candidate_id, v_job_id, v_status, v_sent_at, v_job_posted_by
  FROM public.applications a
  JOIN public.jobs j ON j.id = a.job_id
  WHERE a.id = p_application_id
  FOR UPDATE OF a;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    IF NOT (
      public.is_admin()
      OR public.is_company_member(v_company_id)
      OR v_job_posted_by = v_caller_id
      OR EXISTS (SELECT 1 FROM public.companies WHERE id = v_company_id AND created_by = v_caller_id)
    ) THEN
      RAISE EXCEPTION 'Only authorized company recruiters or administrators can send selection emails.';
    END IF;

    IF v_caller_id = v_candidate_id AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Candidates cannot trigger selection emails for their own applications.';
    END IF;
  END IF;

  IF v_status IS DISTINCT FROM 'selected' THEN
    RAISE EXCEPTION 'Application status must be selected to send a selection email.';
  END IF;

  IF v_sent_at IS NOT NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('app.allow_application_update', 'true', true);

  UPDATE public.applications
  SET selection_email_sent_at = now()
  WHERE id = p_application_id
    AND selection_email_sent_at IS NULL;

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
  v_job_id uuid;
  v_job_posted_by uuid;
  v_sent_at timestamptz;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT a.company_id, a.candidate_id, a.job_id, a.selection_email_sent_at, j.posted_by
  INTO v_company_id, v_candidate_id, v_job_id, v_sent_at, v_job_posted_by
  FROM public.applications a
  JOIN public.jobs j ON j.id = a.job_id
  WHERE a.id = p_application_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    IF NOT (
      public.is_admin()
      OR public.is_company_member(v_company_id)
      OR v_job_posted_by = v_caller_id
      OR EXISTS (SELECT 1 FROM public.companies WHERE id = v_company_id AND created_by = v_caller_id)
    ) THEN
      RAISE EXCEPTION 'Only authorized company recruiters or administrators can release selection emails.';
    END IF;

    IF v_caller_id = v_candidate_id AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Candidates cannot release selection emails.';
    END IF;
  END IF;

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