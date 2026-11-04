-- ==============================================================================
-- PART 3: JOBS, COMPANIES, COMPANY MEMBERS, AND SAVED JOBS
-- ==============================================================================

-- 1. Helper function: is_admin() (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 2. Helper function: is_recruiter()
CREATE OR REPLACE FUNCTION public.is_recruiter()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'recruiter'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_recruiter() TO anon, authenticated;

-- 3. COMPANIES TABLE
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  website text,
  logo_url text,
  location text,
  verification_status text NOT NULL DEFAULT 'approved' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 4. COMPANY MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- 5. Helper function: is_company_member(check_company_id uuid)
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
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO anon, authenticated;

-- RLS for COMPANIES
-- Anyone can view approved companies
CREATE POLICY "Public can view approved companies"
  ON public.companies
  FOR SELECT
  TO anon, authenticated
  USING (
    verification_status = 'approved'
    OR public.is_company_member(id)
    OR public.is_admin()
  );

-- Only recruiters or admins can create companies
CREATE POLICY "Recruiters and admins can create companies"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_recruiter() OR public.is_admin())
    AND auth.uid() = created_by
  );

-- Company members or admins can update company details
CREATE POLICY "Company members or admins can update company"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (public.is_company_member(id) OR public.is_admin())
  WITH CHECK (public.is_company_member(id) OR public.is_admin());

-- RLS for COMPANY_MEMBERS
CREATE POLICY "Members or admins can view company members"
  ON public.company_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_company_member(company_id)
    OR public.is_admin()
  );

CREATE POLICY "Recruiters and admins can join company as creator"
  ON public.company_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.is_recruiter() OR public.is_admin())
  );

-- 6. Atomic Company Setup RPC: setup_company
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

  RETURN new_comp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.setup_company(text, text, text, text, text) TO authenticated;

-- Helper to get companies for the authenticated user
CREATE OR REPLACE FUNCTION public.get_my_companies()
RETURNS SETOF public.companies
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT c.*
  FROM public.companies c
  JOIN public.company_members cm ON c.id = cm.company_id
  WHERE cm.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_companies() TO authenticated;

-- 7. JOBS TABLE
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  requirements text,
  location text NOT NULL,
  job_type text NOT NULL CHECK (job_type IN ('full_time', 'part_time', 'internship', 'contract', 'remote')),
  salary_min numeric CHECK (salary_min IS NULL OR salary_min >= 0),
  salary_max numeric CHECK (salary_max IS NULL OR salary_max >= 0),
  experience_level text NOT NULL CHECK (experience_level IN ('fresher', '1-3', '3-5', '5+')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- RLS for JOBS
-- Anyone (including logged out visitors) can read open jobs from approved companies
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

-- Recruiters can create jobs ONLY for companies they are members of, and only if their role is recruiter
CREATE POLICY "Recruiters can insert jobs for own companies"
  ON public.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_recruiter() OR public.is_admin())
    AND public.is_company_member(company_id)
    AND auth.uid() = posted_by
  );

-- Recruiters can update jobs of own companies
CREATE POLICY "Recruiters can update jobs of own companies"
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (public.is_company_member(company_id) OR public.is_admin())
  WITH CHECK (public.is_company_member(company_id) OR public.is_admin());

-- Recruiters can delete jobs of own companies
CREATE POLICY "Recruiters can delete jobs of own companies"
  ON public.jobs
  FOR DELETE
  TO authenticated
  USING (public.is_company_member(company_id) OR public.is_admin());

-- 8. SAVED JOBS TABLE
CREATE TABLE IF NOT EXISTS public.saved_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

-- RLS for SAVED_JOBS
CREATE POLICY "Candidates and admins can view own saved jobs"
  ON public.saved_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Candidates can save jobs"
  ON public.saved_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'candidate'
      )
    )
  );

CREATE POLICY "Candidates can unsave jobs"
  ON public.saved_jobs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- 9. INDEXES FOR HIGH-PERFORMANCE SEARCH & FILTERING
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON public.jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON public.jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON public.jobs(experience_level);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON public.jobs(location);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON public.saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_search_fts ON public.jobs USING gin (to_tsvector('english', title || ' ' || description || ' ' || location));
