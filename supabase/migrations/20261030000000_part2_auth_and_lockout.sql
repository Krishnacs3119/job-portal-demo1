-- ==============================================================================
-- PART 2: AUTHENTICATION, USER ROLES, AND LOGIN ATTEMPTS
-- ==============================================================================

-- 1. Create PROFILES table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text CHECK (role IS NULL OR role IN ('candidate', 'recruiter', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies:
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Prevent role or email modification via direct UPDATE on profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_role_or_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Allow direct changes if executed by superuser / postgres / supabase_admin in SQL Editor
  -- or if internal authorization flag 'app.allow_role_change' is explicitly enabled
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_setting('app.allow_role_change', true) IS DISTINCT FROM 'true' 
       AND current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Role cannot be modified directly via client update';
    END IF;
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    IF current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Email cannot be modified directly via profile update';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_or_email_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_or_email_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_or_email_change();

-- 3. Automatic Profile Creation on auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    NULL, -- Always force role to NULL on creation; never trust user metadata
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Secure Function: set_initial_role
-- Works ONLY if caller is authenticated, their current role is NULL,
-- and new_role is 'candidate' or 'recruiter'. Never allows 'admin'.
CREATE OR REPLACE FUNCTION public.set_initial_role(new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id uuid;
  existing_role text;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF new_role NOT IN ('candidate', 'recruiter') THEN
    RAISE EXCEPTION 'Invalid role. Only candidate or recruiter can be selected';
  END IF;

  SELECT role INTO existing_role FROM public.profiles WHERE id = current_user_id;

  IF existing_role IS NOT NULL THEN
    RAISE EXCEPTION 'Role has already been chosen and cannot be changed';
  END IF;

  -- Temporarily allow role change within this transaction
  PERFORM set_config('app.allow_role_change', 'true', true);

  UPDATE public.profiles
  SET role = new_role,
      updated_at = now()
  WHERE id = current_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_initial_role(text) TO authenticated;

-- 5. Create LOGIN_ATTEMPTS table (Lockout tracking)
CREATE TABLE IF NOT EXISTS public.login_attempts (
  email text PRIMARY KEY,
  failed_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS with NO POLICIES so clients cannot access rows directly
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- 6. RPC: check_account_lock
-- Checks whether an email is currently under a 15-minute lockout
CREATE OR REPLACE FUNCTION public.check_account_lock(target_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_email text;
  attempt_row public.login_attempts%ROWTYPE;
  mins_left integer;
BEGIN
  normalized_email := lower(trim(target_email));
  
  SELECT * INTO attempt_row 
  FROM public.login_attempts 
  WHERE email = normalized_email;

  IF FOUND AND attempt_row.locked_until IS NOT NULL AND attempt_row.locked_until > now() THEN
    mins_left := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (attempt_row.locked_until - now())) / 60));
    RETURN json_build_object(
      'is_locked', true,
      'remaining_minutes', mins_left,
      'error', 'Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ' || mins_left || ' minute(s) or reset your password to unlock immediately.'
    );
  END IF;

  RETURN json_build_object(
    'is_locked', false,
    'remaining_minutes', 0,
    'error', null
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_account_lock(text) TO anon, authenticated;

-- 7. RPC: record_failed_login
-- Increments failed attempts and triggers 15-minute lock upon 5 consecutive failures
CREATE OR REPLACE FUNCTION public.record_failed_login(target_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_email text;
  new_failed_count integer := 1;
  new_locked_until timestamptz := NULL;
  is_now_locked boolean := false;
  mins_left integer := 0;
BEGIN
  normalized_email := lower(trim(target_email));

  INSERT INTO public.login_attempts (email, failed_count, locked_until, updated_at)
  VALUES (normalized_email, 1, NULL, now())
  ON CONFLICT (email) DO UPDATE
  SET failed_count = public.login_attempts.failed_count + 1,
      updated_at = now()
  RETURNING failed_count INTO new_failed_count;

  IF new_failed_count >= 5 THEN
    new_locked_until := now() + interval '15 minutes';
    is_now_locked := true;
    mins_left := 15;

    UPDATE public.login_attempts
    SET locked_until = new_locked_until,
        updated_at = now()
    WHERE email = normalized_email;

    RETURN json_build_object(
      'is_locked', true,
      'failed_count', new_failed_count,
      'remaining_minutes', 15,
      'error', 'Account has been locked for 15 minutes due to 5 consecutive failed login attempts. You can reset your password to unlock immediately.'
    );
  END IF;

  RETURN json_build_object(
    'is_locked', false,
    'failed_count', new_failed_count,
    'remaining_minutes', 0,
    'attempts_left', GREATEST(0, 5 - new_failed_count),
    'error', 'Invalid email or password'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_failed_login(text) TO anon, authenticated;

-- 8. RPC: reset_login_attempts
-- Clears failed attempts and active lock (called on successful login or password reset)
CREATE OR REPLACE FUNCTION public.reset_login_attempts(target_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_email text;
BEGIN
  normalized_email := lower(trim(target_email));

  INSERT INTO public.login_attempts (email, failed_count, locked_until, updated_at)
  VALUES (normalized_email, 0, NULL, now())
  ON CONFLICT (email) DO UPDATE
  SET failed_count = 0,
      locked_until = NULL,
      updated_at = now();

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_login_attempts(text) TO anon, authenticated;

-- 9. Promote a user to admin (run manually in SQL editor as needed):
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@example.com';
