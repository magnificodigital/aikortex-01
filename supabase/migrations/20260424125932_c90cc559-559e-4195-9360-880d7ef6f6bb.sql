
-- Fix 1: Prevent privilege escalation via profiles self-update
-- Replace the "Users can update their own profile" policy with one that
-- blocks changes to role and tenant_type.

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
  AND tenant_type = (SELECT p.tenant_type FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- Fix 2: Protect whatsapp_messages rows where user_id IS NULL.
-- Block anon/authenticated direct inserts with null user_id so that
-- rows without an owner cannot be created from the client. Service role
-- (used by webhook edge functions) bypasses RLS and is unaffected.

DROP POLICY IF EXISTS "Block inserts with null user_id" ON public.whatsapp_messages;
CREATE POLICY "Block inserts with null user_id"
ON public.whatsapp_messages
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (user_id IS NOT NULL);
