
-- Replace the permissive INSERT policy with a tighter one
DROP POLICY IF EXISTS "Guests insert into active meeting only" ON public.meeting_waiting_room;

CREATE POLICY "Guests insert into waiting-room-enabled meetings"
ON public.meeting_waiting_room
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_waiting_room.meeting_id
      AND m.status <> 'ended'
      AND COALESCE((m.settings->>'waiting_room')::boolean, false) = true
  )
);

-- Server-side validation trigger for length and duplicate-guest abuse prevention
CREATE OR REPLACE FUNCTION public.validate_waiting_room_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.display_name IS NULL OR length(trim(NEW.display_name)) = 0 THEN
    RAISE EXCEPTION 'display_name is required';
  END IF;
  IF length(NEW.display_name) > 80 THEN
    RAISE EXCEPTION 'display_name too long (max 80 chars)';
  END IF;
  IF NEW.guest_id IS NULL OR length(NEW.guest_id) = 0 OR length(NEW.guest_id) > 100 THEN
    RAISE EXCEPTION 'invalid guest_id';
  END IF;
  IF NEW.status NOT IN ('waiting','approved','rejected') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  -- Prevent the same guest from spamming entries for the same meeting
  IF EXISTS (
    SELECT 1 FROM public.meeting_waiting_room
    WHERE meeting_id = NEW.meeting_id
      AND guest_id = NEW.guest_id
      AND status = 'waiting'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'duplicate waiting entry for this guest';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_waiting_room_entry ON public.meeting_waiting_room;
CREATE TRIGGER trg_validate_waiting_room_entry
BEFORE INSERT OR UPDATE ON public.meeting_waiting_room
FOR EACH ROW EXECUTE FUNCTION public.validate_waiting_room_entry();
