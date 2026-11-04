-- ==============================================================================
-- PART 4 FIX 2: CASCADE-SAFE LEDGER IMMUTABILITY, PREVENT JOB DELETION WITH
--               APPLICATIONS, AND AUTOMATIC PAUSING ON JOB INSERTION
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CREDIT LEDGER IMMUTABILITY TRIGGER FIX
-- ------------------------------------------------------------------------------
-- The original trigger blocked all UPDATE operations unconditionally, which prevented
-- foreign key ON DELETE SET NULL cascades (for application_id and created_by) from running.
--
-- Specification:
-- - DELETE is always blocked.
-- - UPDATE is allowed ONLY when every column is unchanged except application_id
--   and/or created_by being set from a value to NULL.
-- - Anything else raises the immutability exception.

CREATE OR REPLACE FUNCTION public.prevent_ledger_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Credit ledger records are immutable and cannot be deleted.';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check that every column is unchanged except application_id and/or created_by being set from a value to NULL
    IF NEW.id IS NOT DISTINCT FROM OLD.id
       AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id
       AND NEW.type IS NOT DISTINCT FROM OLD.type
       AND NEW.amount IS NOT DISTINCT FROM OLD.amount
       AND NEW.balance_after IS NOT DISTINCT FROM OLD.balance_after
       AND NEW.reference IS NOT DISTINCT FROM OLD.reference
       AND NEW.note IS NOT DISTINCT FROM OLD.note
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
       AND (
         NEW.application_id IS NOT DISTINCT FROM OLD.application_id
         OR (OLD.application_id IS NOT NULL AND NEW.application_id IS NULL)
       )
       AND (
         NEW.created_by IS NOT DISTINCT FROM OLD.created_by
         OR (OLD.created_by IS NOT NULL AND NEW.created_by IS NULL)
       )
       AND (
         (OLD.application_id IS NOT NULL AND NEW.application_id IS NULL)
         OR (OLD.created_by IS NOT NULL AND NEW.created_by IS NULL)
       )
    THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Credit ledger records are immutable and cannot be updated.';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ledger_modifications ON public.credit_ledger;
CREATE TRIGGER trg_prevent_ledger_modifications
  BEFORE UPDATE OR DELETE ON public.credit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ledger_modifications();


-- ------------------------------------------------------------------------------
-- 2. PREVENT JOB DELETION WHEN APPLICATIONS EXIST
-- ------------------------------------------------------------------------------
-- Add a BEFORE DELETE trigger on jobs that raises a clear message:
-- "This job has applications and cannot be deleted. Close it instead."
-- if any application exists for that job. Applies to recruiters and admins alike.

CREATE OR REPLACE FUNCTION public.prevent_job_deletion_with_applications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.applications WHERE job_id = OLD.id) THEN
    RAISE EXCEPTION 'This job has applications and cannot be deleted. Close it instead.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_job_deletion_with_applications ON public.jobs;
CREATE TRIGGER trg_prevent_job_deletion_with_applications
  BEFORE DELETE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_job_deletion_with_applications();


-- ------------------------------------------------------------------------------
-- 3. AUTOMATIC JOB STATUS ON INSERTION (INSUFFICIENT CREDITS CHECK)
-- ------------------------------------------------------------------------------
-- Add a BEFORE INSERT trigger on jobs that forces NEW.status = 'paused' when
-- the hiring company's balance is below the application cost (from platform_settings),
-- and 'open' otherwise, regardless of what the client sent.

CREATE OR REPLACE FUNCTION public.check_job_insert_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_app_cost integer;
  v_balance integer;
BEGIN
  -- Read application cost from platform_settings (default: 10)
  SELECT COALESCE(value::integer, 10) INTO v_app_cost
  FROM public.platform_settings
  WHERE key = 'application_cost';
  IF v_app_cost IS NULL THEN v_app_cost := 10; END IF;

  -- Read company credit balance
  SELECT balance INTO v_balance
  FROM public.company_credits
  WHERE company_id = NEW.company_id;

  -- Force status based on credit balance
  IF COALESCE(v_balance, 0) < v_app_cost THEN
    NEW.status := 'paused';
  ELSE
    NEW.status := 'open';
  END IF;

  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_job_insert_credits ON public.jobs;
CREATE TRIGGER trg_check_job_insert_credits
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_job_insert_credits();
