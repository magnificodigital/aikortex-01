import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  action_url: string | null;
  action_label: string | null;
  priority: string;
}

const PRIORITY_VARIANT: Record<string, string> = {
  urgent: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  normal: "bg-primary/10 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente", high: "Alta", normal: "Normal", low: "Baixa",
};

export const LightboxNotificationModal = () => {
  const { user } = useAuth();
  const [pending, setPending] = useState<Notification[]>([]);
  const [current, setCurrent] = useState<Notification | null>(null);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Get active notifications for clients linked to this user
      const { data: notifs } = await supabase
        .from("client_lightbox_notifications")
        .select("id, title, message, image_url, action_url, action_label, priority")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (!notifs || notifs.length === 0) return;

      // Filter out dismissed ones
      const { data: dismissals } = await supabase
        .from("client_lightbox_dismissals")
        .select("notification_id")
        .eq("user_id", user.id);
      const dismissedIds = new Set((dismissals ?? []).map((d) => d.notification_id));
      const active = notifs.filter((n) => !dismissedIds.has(n.id));
      setPending(active);
      if (active.length > 0) setCurrent(active[0]);
    };
    load();
  }, [user]);

  const handleDismiss = async () => {
    if (!current || !user) return;
    setDismissing(true);
    await supabase.from("client_lightbox_dismissals").insert({
      notification_id: current.id,
      user_id: user.id,
    });
    setDismissing(false);
    const remaining = pending.filter((n) => n.id !== current.id);
    setPending(remaining);
    setCurrent(remaining[0] ?? null);
  };

  if (!current) return null;

  return (
    <Dialog open={!!current} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={PRIORITY_VARIANT[current.priority] ?? ""}>
              {PRIORITY_LABEL[current.priority] ?? current.priority}
            </Badge>
          </div>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap pt-1">
            {current.message}
          </DialogDescription>
        </DialogHeader>

        {current.image_url && (
          <img
            src={current.image_url}
            alt={current.title}
            className="w-full rounded-lg border border-border max-h-64 object-cover"
          />
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {current.action_url && (
            <Button
              variant="default"
              className="flex-1"
              onClick={() => window.open(current.action_url!, "_blank")}
            >
              {current.action_label ?? "Ver mais"}
            </Button>
          )}
          <Button
            variant={current.action_url ? "outline" : "default"}
            className="flex-1"
            onClick={handleDismiss}
            disabled={dismissing}
          >
            Marcar como lido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
