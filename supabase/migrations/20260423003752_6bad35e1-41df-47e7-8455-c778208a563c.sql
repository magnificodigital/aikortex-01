-- Tabela de notificações lightbox por cliente
CREATE TABLE public.client_lightbox_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agency_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  action_url TEXT,
  action_label TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lightbox_client_active ON public.client_lightbox_notifications(client_id, is_active);

ALTER TABLE public.client_lightbox_notifications ENABLE ROW LEVEL SECURITY;

-- Agência gerencia notificações dos seus clientes
CREATE POLICY "Agency manages own client notifications"
ON public.client_lightbox_notifications
FOR ALL
TO authenticated
USING (agency_id IN (SELECT id FROM public.agency_profiles WHERE user_id = auth.uid()))
WITH CHECK (agency_id IN (SELECT id FROM public.agency_profiles WHERE user_id = auth.uid()));

-- Cliente vê suas próprias notificações ativas
CREATE POLICY "Client views own notifications"
ON public.client_lightbox_notifications
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND client_id IN (SELECT id FROM public.agency_clients WHERE client_user_id = auth.uid())
);

-- Platform admins
CREATE POLICY "Platform admins manage lightbox notifications"
ON public.client_lightbox_notifications
FOR ALL
TO authenticated
USING (is_platform_user(auth.uid()))
WITH CHECK (is_platform_user(auth.uid()));

CREATE TRIGGER update_lightbox_notifications_updated_at
BEFORE UPDATE ON public.client_lightbox_notifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de dismissals (cliente marcou como lido)
CREATE TABLE public.client_lightbox_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.client_lightbox_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

CREATE INDEX idx_dismissals_user ON public.client_lightbox_dismissals(user_id);

ALTER TABLE public.client_lightbox_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dismissals"
ON public.client_lightbox_dismissals
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Agency views client dismissals"
ON public.client_lightbox_dismissals
FOR SELECT
TO authenticated
USING (
  notification_id IN (
    SELECT id FROM public.client_lightbox_notifications
    WHERE agency_id IN (SELECT id FROM public.agency_profiles WHERE user_id = auth.uid())
  )
);