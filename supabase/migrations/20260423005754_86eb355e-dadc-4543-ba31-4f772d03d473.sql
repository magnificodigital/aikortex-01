-- 1. Enable RLS on template_pricing (had no RLS — exposed to PostgREST)
ALTER TABLE IF EXISTS public.template_pricing ENABLE ROW LEVEL SECURITY;

-- Default-deny: only platform admins can manage pricing; everyone authenticated can read
DROP POLICY IF EXISTS "Platform admins manage template pricing" ON public.template_pricing;
DROP POLICY IF EXISTS "Authenticated read template pricing" ON public.template_pricing;

CREATE POLICY "Platform admins manage template pricing"
ON public.template_pricing FOR ALL
TO authenticated
USING (public.is_platform_user(auth.uid()))
WITH CHECK (public.is_platform_user(auth.uid()));

CREATE POLICY "Authenticated read template pricing"
ON public.template_pricing FOR SELECT
TO authenticated
USING (true);

-- 2. Fix the over-permissive realtime.messages SELECT policy.
-- The old policy returned `true` for waiting-% and ELSE, which (because RLS
-- policies combine with OR) overrode the strict "Meeting realtime access"
-- policy and let any authenticated user subscribe to any waiting-room topic.
DROP POLICY IF EXISTS "Authenticated users can subscribe to meeting topics they belong" ON realtime.messages;

-- Also tighten the INSERT (broadcast) side which was unrestricted.
DROP POLICY IF EXISTS "Authenticated users can broadcast to meeting topics they belong" ON realtime.messages;

CREATE POLICY "Meeting realtime broadcast"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'waiting-%' THEN
      EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.id::text = substring(realtime.topic() FROM 'waiting-(.*)')
          AND (
            m.host_user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.meeting_waiting_room w
              WHERE w.meeting_id = m.id
                AND w.guest_id = ((current_setting('request.headers', true))::json ->> 'x-guest-id')
            )
          )
      )
    WHEN realtime.topic() LIKE 'host-waiting-%' THEN
      EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.id::text = substring(realtime.topic() FROM 'host-waiting-(.*)')
          AND m.host_user_id = auth.uid()
      )
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