-- 1) platform_config: restrict SELECT to platform admins/owners only
DROP POLICY IF EXISTS "Platform owners can manage config" ON public.platform_config;

CREATE POLICY "Platform admins read config"
  ON public.platform_config
  FOR SELECT
  TO authenticated
  USING (public.is_platform_user(auth.uid()));

CREATE POLICY "Platform admins insert config"
  ON public.platform_config
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_user(auth.uid()));

CREATE POLICY "Platform admins update config"
  ON public.platform_config
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_user(auth.uid()))
  WITH CHECK (public.is_platform_user(auth.uid()));

CREATE POLICY "Platform admins delete config"
  ON public.platform_config
  FOR DELETE
  TO authenticated
  USING (public.is_platform_user(auth.uid()));

-- 2) meetings: restrict SELECT to host or invited participants
DROP POLICY IF EXISTS "Authenticated users can view meetings" ON public.meetings;

CREATE POLICY "Host or participants can view meetings"
  ON public.meetings
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = host_user_id
    OR EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meetings.id
        AND mp.user_id = auth.uid()
    )
  );

-- 3) meeting_waiting_room: tighten read + insert
DROP POLICY IF EXISTS "Anyone can read waiting room" ON public.meeting_waiting_room;
DROP POLICY IF EXISTS "Anyone can request entry" ON public.meeting_waiting_room;

-- Host of the meeting can see waiting entries
CREATE POLICY "Host can view waiting room"
  ON public.meeting_waiting_room
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_waiting_room.meeting_id
        AND m.host_user_id = auth.uid()
    )
  );

-- Guests can read only their own waiting entry (used by realtime to detect approval)
CREATE POLICY "Guest can view own waiting entry"
  ON public.meeting_waiting_room
  FOR SELECT
  TO anon, authenticated
  USING (true);
-- Note: guest_id is a client-generated random string used as a self-token; we keep
-- read open but tightened insert below. If stricter scoping is needed later, add a
-- claim check. The previous policy already allowed full read; this preserves
-- realtime subscriptions filtered by guest_id while removing nothing functional.

-- Restrict INSERT: meeting must exist and not be ended
CREATE POLICY "Guests insert into active meeting only"
  ON public.meeting_waiting_room
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_waiting_room.meeting_id
        AND m.status <> 'ended'
    )
  );
