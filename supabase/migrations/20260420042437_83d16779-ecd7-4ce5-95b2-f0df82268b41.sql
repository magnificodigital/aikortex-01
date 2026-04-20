
-- 1. Fix meeting_waiting_room: restrict SELECT to host or own guest entry
DROP POLICY IF EXISTS "Guest can view own waiting entry" ON public.meeting_waiting_room;

CREATE POLICY "Guest can view own waiting entry"
ON public.meeting_waiting_room
FOR SELECT
TO anon, authenticated
USING (
  guest_id = current_setting('request.headers', true)::json->>'x-guest-id'
);

-- 2. Add RLS policies on realtime.messages for meeting topics
-- Restrict subscriptions to meeting:{id} channels to host or participants
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to meeting topics they belong to" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to meeting topics they belong to"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Only allow if topic matches a meeting the user hosts or participates in
  CASE
    WHEN realtime.topic() LIKE 'meeting:%' THEN
      EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.id::text = substring(realtime.topic() FROM 9)
        AND (
          m.host_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.meeting_participants mp
            WHERE mp.meeting_id = m.id AND mp.user_id = auth.uid()
          )
        )
      )
    WHEN realtime.topic() LIKE 'waiting-%' THEN true  -- guest-specific channels are filtered by guest_id in postgres_changes
    WHEN realtime.topic() LIKE 'host-waiting-%' THEN
      EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.id::text = substring(realtime.topic() FROM 14)
        AND m.host_user_id = auth.uid()
      )
    ELSE true  -- allow other (non-meeting) topics for backward compatibility
  END
);

DROP POLICY IF EXISTS "Authenticated users can broadcast to meeting topics they belong to" ON realtime.messages;
CREATE POLICY "Authenticated users can broadcast to meeting topics they belong to"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'meeting:%' THEN
      EXISTS (
        SELECT 1 FROM public.meetings m
        WHERE m.id::text = substring(realtime.topic() FROM 9)
        AND (
          m.host_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.meeting_participants mp
            WHERE mp.meeting_id = m.id AND mp.user_id = auth.uid()
          )
        )
      )
    ELSE true
  END
);

-- 3. Remove user INSERT on credit_transactions (only service_role / admins should write)
DROP POLICY IF EXISTS "Users insert own transactions" ON public.credit_transactions;
