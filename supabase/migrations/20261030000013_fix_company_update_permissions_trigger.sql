-- ==============================================================================
-- PART 6-8 ENHANCEMENTS: FIX COMPANY UPDATE PERMISSIONS TRIGGER
-- ==============================================================================
-- Security Rule:
-- Never use current_user for permission checks.
-- Use auth.uid() with is_admin() / is_company_member().
-- Use session_user only to allow postgres/supabase_admin (e.g. SQL editor / migrations).
-- Always set search_path = public, auth.

-- ------------------------------------------------------------------------------
-- 1. FIXED check_company_update_permissions TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
-- Rules:
-- 1. Allow created_by to change from a non-null value to NULL when verification_status
--    is unchanged (handles owner account deletion / ON DELETE SET NULL).
-- 2. Otherwise, only is_admin() or session_user in ('postgres', 'supabase_admin')
--    may change verification_status or created_by.
-- 3. Sets updated_at = now().
CREATE OR REPLACE FUNCTION public.check_company_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 1. Check if verification_status is changing
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NOT public.is_admin() AND session_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Only administrators are permitted to modify company verification status or ownership.';
    END IF;
  END IF;

  -- 2. Check if created_by (ownership) is changing
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    -- Exception: Allow created_by to change from a value to NULL when verification_status is unchanged (owner account deleted)
    IF OLD.created_by IS NOT NULL AND NEW.created_by IS NULL AND NEW.verification_status IS NOT DISTINCT FROM OLD.verification_status THEN
      NULL; -- Permitted
    ELSE
      IF NOT public.is_admin() AND session_user NOT IN ('postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'Only administrators are permitted to modify company verification status or ownership.';
      END IF;
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Ensure triggers on public.companies execute the unified permissions check
DROP TRIGGER IF EXISTS trg_check_company_verification_status_update ON public.companies;
DROP TRIGGER IF EXISTS trg_check_company_update_permissions ON public.companies;

CREATE TRIGGER trg_check_company_update_permissions
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.check_company_update_permissions();
