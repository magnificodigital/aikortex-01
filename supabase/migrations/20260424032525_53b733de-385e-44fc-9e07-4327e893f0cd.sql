-- Add explicit owner-scoped policies on call_sessions so users can only access their own sessions.
-- Previously only service_role had a policy; this ensures defense-in-depth for any client-side query.

CREATE POLICY "Users view own call sessions"
ON public.call_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own call sessions"
ON public.call_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own call sessions"
ON public.call_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own call sessions"
ON public.call_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);