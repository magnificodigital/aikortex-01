import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Bell, Loader2, Eye, EyeOff } from "lucide-react";

interface Props {
  clientId: string;
  agencyId: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  action_url: string | null;
  action_label: string | null;
  priority: string;
  is_active: boolean;
  created_at: string;
}

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente",
};

export const ClientLightboxTab = ({ clientId, agencyId }: Props) => {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "", message: "", image_url: "", action_url: "", action_label: "",
    priority: "normal",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_lightbox_notifications")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const handleCreate = async () => {
    if (!form.title || !form.message) {
      toast.error("Título e mensagem são obrigatórios");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("client_lightbox_notifications").insert({
      client_id: clientId,
      agency_id: agencyId,
      title: form.title,
      message: form.message,
      image_url: form.image_url || null,
      action_url: form.action_url || null,
      action_label: form.action_label || null,
      priority: form.priority,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Notificação criada");
    setForm({ title: "", message: "", image_url: "", action_url: "", action_label: "", priority: "normal" });
    load();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("client_lightbox_notifications")
      .update({ is_active: !isActive })
      .eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta notificação?")) return;
    const { error } = await supabase
      .from("client_lightbox_notifications")
      .delete()
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removida"); load(); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova notificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Nova funcionalidade disponível" />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Mensagem *</Label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Descreva a notificação..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Imagem (URL)</Label>
              <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Link de ação</Label>
              <Input value={form.action_url} onChange={(e) => setForm({ ...form, action_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div>
            <Label>Texto do botão de ação</Label>
            <Input value={form.action_label} onChange={(e) => setForm({ ...form, action_label: e.target.value })} placeholder="Ex: Saiba mais" />
          </div>
          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            Criar notificação
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" /> Notificações cadastradas ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma notificação cadastrada.</p>
          ) : items.map((n) => (
            <div key={n.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    <Badge variant="outline" className="text-xs">{PRIORITY_LABEL[n.priority] ?? n.priority}</Badge>
                    {!n.is_active && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{n.message}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => toggleActive(n.id, n.is_active)} title={n.is_active ? "Desativar" : "Ativar"}>
                    {n.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(n.id)} title="Remover">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
