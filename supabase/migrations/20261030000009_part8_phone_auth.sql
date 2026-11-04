ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_or_phone_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_or_phone_check
  CHECK (email IS NOT NULL OR phone IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_idx
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    NULL,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = COALESCE(EXCLUDED.email, public.profiles.email),
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
      updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.prevent_profile_role_or_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    IF session_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Phone cannot be modified directly via profile update';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
