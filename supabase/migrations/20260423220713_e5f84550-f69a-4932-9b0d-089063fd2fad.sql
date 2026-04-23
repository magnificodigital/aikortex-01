
-- ============================================================
-- Fix 1: Restrict client read access to Asaas payment credentials
-- ============================================================
-- Revoke SELECT on the sensitive columns from authenticated and anon roles.
-- Keep INSERT/UPDATE so edge functions (service role) and writes still work via RLS.
REVOKE SELECT (asaas_api_key, asaas_wallet_id) ON public.agency_profiles FROM authenticated;
REVOKE SELECT (asaas_api_key, asaas_wallet_id) ON public.agency_profiles FROM anon;

-- SECURITY DEFINER RPC for the agency owner to know whether their key is configured.
CREATE OR REPLACE FUNCTION public.get_asaas_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
BEGIN
  SELECT asaas_api_key INTO k
  FROM public.agency_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF k IS NULL OR length(k) = 0 THEN
    RETURN jsonb_build_object('connected', false, 'last4', null);
  END IF;

  RETURN jsonb_build_object('connected', true, 'last4', right(k, 4));
END;
$$;

REVOKE ALL ON FUNCTION public.get_asaas_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_asaas_status() TO authenticated;

-- SECURITY DEFINER RPC for platform admins to see configuration status of all agencies.
CREATE OR REPLACE FUNCTION public.admin_list_asaas_status()
RETURNS TABLE(agency_id uuid, connected boolean, wallet_last4 text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_user(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    ap.id,
    (ap.asaas_api_key IS NOT NULL AND length(ap.asaas_api_key) > 0),
    CASE WHEN ap.asaas_wallet_id IS NOT NULL AND length(ap.asaas_wallet_id) >= 4
         THEN right(ap.asaas_wallet_id, 4)
         ELSE NULL END
  FROM public.agency_profiles ap;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_asaas_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_asaas_status() TO authenticated;

-- ============================================================
-- Fix 2: Restrict public exposure of agent prompt IP
-- ============================================================
-- Anonymous (unauthenticated) users may continue to browse the marketplace
-- metadata, but must NOT be able to read the proprietary system prompt
-- (soul_md) or full configuration (config_yaml). Authenticated users still
-- need access for the admin tab and for activated/licensed templates.
REVOKE SELECT (soul_md, config_yaml) ON public.agent_templates FROM anon;
