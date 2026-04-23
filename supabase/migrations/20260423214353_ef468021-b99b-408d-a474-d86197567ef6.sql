-- Update validate_agency_profile_tier function: explorer -> hack
CREATE OR REPLACE FUNCTION public.validate_agency_profile_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tier NOT IN ('starter', 'hack', 'growth') THEN
    RAISE EXCEPTION 'Invalid agency tier: %', NEW.tier;
  END IF;
  RETURN NEW;
END;
$$;

-- Update validate_platform_template_min_tier function: explorer -> hack
CREATE OR REPLACE FUNCTION public.validate_platform_template_min_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.min_tier NOT IN ('starter', 'hack', 'growth') THEN
    RAISE EXCEPTION 'Invalid min_tier: %', NEW.min_tier;
  END IF;
  RETURN NEW;
END;
$$;

-- Update validate_partner_tier function: explorer -> hack
CREATE OR REPLACE FUNCTION public.validate_partner_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tier NOT IN ('starter', 'hack', 'growth') THEN
    RAISE EXCEPTION 'Invalid partner tier: %', NEW.tier;
  END IF;
  RETURN NEW;
END;
$$;

-- Update validate_tier_module_access_tier function: explorer -> hack
CREATE OR REPLACE FUNCTION public.validate_tier_module_access_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tier NOT IN ('starter', 'hack', 'growth') THEN
    RAISE EXCEPTION 'Invalid tier: %', NEW.tier;
  END IF;
  RETURN NEW;
END;
$$;

-- Update trigger_update_agency_tier function: explorer/hack -> hack/growth
CREATE OR REPLACE FUNCTION public.trigger_update_agency_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_agency_id uuid;
  active_clients integer;
  new_tier text;
  old_tier text;
  owner_user_id uuid;
  is_overridden boolean;
BEGIN
  target_agency_id := COALESCE(NEW.agency_id, OLD.agency_id);

  -- Check if tier is manually overridden
  SELECT tier, user_id, COALESCE(tier_manually_overridden, false) 
  INTO old_tier, owner_user_id, is_overridden
  FROM public.agency_profiles
  WHERE id = target_agency_id;

  SELECT COUNT(*) INTO active_clients
  FROM public.agency_clients
  WHERE agency_id = target_agency_id AND status = 'active';

  -- Always update active_clients_count
  UPDATE public.agency_profiles
  SET active_clients_count = active_clients, updated_at = now()
  WHERE id = target_agency_id;

  -- Skip tier update if manually overridden
  IF is_overridden THEN
    RETURN NEW;
  END IF;

  IF active_clients >= 15 THEN
    new_tier := 'growth';
  ELSIF active_clients >= 5 THEN
    new_tier := 'hack';
  ELSE
    new_tier := 'starter';
  END IF;

  UPDATE public.agency_profiles
  SET tier = new_tier, updated_at = now()
  WHERE id = target_agency_id;

  -- Insert tier upgrade notification if tier increased
  IF old_tier IS DISTINCT FROM new_tier AND new_tier > old_tier AND owner_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, action_url)
    VALUES (
      owner_user_id,
      'Você subiu de tier! 🎉',
      'Parabéns! Você atingiu o tier ' || UPPER(new_tier) || ' com ' || active_clients || ' clientes ativos. Novos templates e benefícios desbloqueados.',
      'success',
      '/templates'
    );
  END IF;

  RETURN NEW;
END;
$$;