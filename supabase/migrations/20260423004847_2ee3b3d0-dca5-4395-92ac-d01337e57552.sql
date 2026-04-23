-- 1. Fix is_platform_admin() function — was checking wrong column (id vs user_id)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND tenant_type = 'platform'
  );
$function$;

-- 2. Fix update_updated_at function — missing search_path
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

-- 3. Enable RLS on agent_templates (policies already exist)
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;

-- 4. Enable RLS on agency_template_licenses (policies already exist)
ALTER TABLE public.agency_template_licenses ENABLE ROW LEVEL SECURITY;

-- 5. Fix storage agent-avatars INSERT policy — require user owns folder path
DROP POLICY IF EXISTS "Users can upload agent avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload agent avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload agent avatars" ON storage.objects;
DROP POLICY IF EXISTS "Agent avatars upload" ON storage.objects;

CREATE POLICY "Users upload own agent avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'agent-avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- 6. Fix Realtime waiting room policy — restrict waiting-% topic to host only
DO $$
BEGIN
  -- Drop and recreate the realtime messages SELECT policy if present
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
  ) THEN
    -- Drop any existing waiting-room related policy
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can read waiting room messages" ON realtime.messages';
    EXECUTE 'DROP POLICY IF EXISTS "Allow waiting room realtime" ON realtime.messages';
    EXECUTE 'DROP POLICY IF EXISTS "Users read meeting realtime" ON realtime.messages';
  END IF;
END $$;

-- Recreate a properly scoped Realtime SELECT policy for meetings/waiting room
CREATE POLICY "Meeting realtime access"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  CASE
    -- Host-only waiting room channel: only the meeting host can subscribe
    WHEN realtime.topic() LIKE 'waiting-%' THEN
      EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.id::text = substring(realtime.topic() FROM 'waiting-(.*)')
          AND m.host_user_id = auth.uid()
      )
    WHEN realtime.topic() LIKE 'host-waiting-%' THEN
      EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.id::text = substring(realtime.topic() FROM 'host-waiting-(.*)')
          AND m.host_user_id = auth.uid()
      )
    -- Meeting room channel: host or participant
    WHEN realtime.topic() LIKE 'meeting-%' THEN
      EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.id::text = substring(realtime.topic() FROM 'meeting-(.*)')
          AND (
            m.host_user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.meeting_participants mp
              WHERE mp.meeting_id = m.id AND mp.user_id = auth.uid()
            )
          )
      )
    ELSE false
  END
);
