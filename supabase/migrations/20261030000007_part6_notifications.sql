CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('application_update', 'system_announcement', 'general')),
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread
  ON public.notifications (user_id) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and authorized recruiters can insert notifications" ON public.notifications;
CREATE POLICY "Admins and authorized recruiters can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.company_members cm ON cm.company_id = a.company_id
      WHERE cm.user_id = auth.uid()
        AND a.candidate_id = notifications.user_id
    )
  );

CREATE OR REPLACE FUNCTION public.handle_application_status_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_job_title text;
  v_company_name text;
  v_notif_title text;
  v_notif_message text;
  v_notif_link text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('selected', 'rejected', 'shortlisted') THEN
    SELECT j.title, c.name
    INTO v_job_title, v_company_name
    FROM public.jobs j
    JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = NEW.job_id;

    IF NEW.status = 'selected' THEN
      v_notif_title := 'Application Selected!';
      v_notif_message := 'Congratulations! You have been selected for the ' || COALESCE(v_job_title, 'role') || ' position at ' || COALESCE(v_company_name, 'the company') || '.';
    ELSIF NEW.status = 'rejected' THEN
      v_notif_title := 'Application Status Update';
      v_notif_message := 'Your application for ' || COALESCE(v_job_title, 'the role') || ' at ' || COALESCE(v_company_name, 'the company') || ' has been updated to rejected.';
    ELSIF NEW.status = 'shortlisted' THEN
      v_notif_title := 'Application Shortlisted';
      v_notif_message := 'Your application for ' || COALESCE(v_job_title, 'the role') || ' at ' || COALESCE(v_company_name, 'the company') || ' has been shortlisted.';
    END IF;

    v_notif_link := '/dashboard/my-applications';

    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      link,
      is_read,
      created_at
    ) VALUES (
      NEW.candidate_id,
      v_notif_title,
      v_notif_message,
      'application_update',
      v_notif_link,
      false,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_application_status_notification ON public.applications;
CREATE TRIGGER trg_application_status_notification
  AFTER UPDATE OF status ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_application_status_notification();

CREATE OR REPLACE FUNCTION public.broadcast_admin_announcement(
  p_title text,
  p_message text,
  p_link text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_inserted_count integer := 0;
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only administrators can broadcast announcements.';
    END IF;
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Announcement title is required.';
  END IF;
  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'Announcement message is required.';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link, is_read, created_at)
  SELECT u.id, trim(p_title), trim(p_message), 'system_announcement', p_link, false, now()
  FROM auth.users u;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_admin_announcement(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.broadcast_admin_announcement(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid;
  v_count integer := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = v_caller_id AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_as_read() FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_as_read() TO authenticated;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;
