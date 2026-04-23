import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, LayoutTemplate, Trash2 } from "lucide-react";

interface Props {
  clientId: string;
  agencyId: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  platform_price_monthly: number;
}

interface Sub {
  id: string;
  template_id: string;
  status: string;
  agency_price_monthly: number;
  platform_price_monthly: number;
  platform_templates: { name: string; category: string } | null;
}

export const ClientTemplatesTab = ({ clientId, agencyId }: Props) => {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [available, setAvailable] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [pickedTemplate, setPickedTemplate] = useState<Template | null>(null);
  const [agencyPrice, setAgencyPrice] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [sRes, tRes] = await Promise.all([
      supabase
        .from("client_template_subscriptions")
        .select("*, platform_templates(name, category)")
        .eq("client_id", clientId),
      supabase
        .from("platform_templates")
        .select("id, name, description, category, platform_price_monthly")
        .eq("is_active", true)
        .order("sort_order"),
    ]);
    if (sRes.data) setSubs(sRes.data as unknown as Sub[]);
    if (tRes.data) setAvailable(tRes.data as Template[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const subscribedIds = new Set(subs.map((s) => s.template_id));
  const availableToAdd = available.filter((t) => !subscribedIds.has(t.id));

  const handleAdd = async () => {
    if (!pickedTemplate) return;
    const price = parseFloat(agencyPrice);
    if (isNaN(price) || price < pickedTemplate.platform_price_monthly) {
      toast.error(`Preço deve ser ≥ R$ ${pickedTemplate.platform_price_monthly.toFixed(0)} (custo da plataforma)`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("client_template_subscriptions").insert({
      client_id: clientId,
      agency_id: agencyId,
      template_id: pickedTemplate.id,
      agency_price_monthly: price,
      platform_price_monthly: pickedTemplate.platform_price_monthly,
      agency_profit_monthly: price - pickedTemplate.platform_price_monthly,
      status: "active",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Template atribuído ao cliente");
    setShowAdd(false);
    setPickedTemplate(null);
    setAgencyPrice("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta assinatura?")) return;
    const { error } = await supabase
      .from("client_template_subscriptions")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Assinatura cancelada"); load(); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4" /> Templates do cliente ({subs.filter((s) => s.status === "active" || s.status === "trial").length})
          </CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)} disabled={availableToAdd.length === 0}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : subs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum template atribuído.</p>
          ) : subs.map((s) => (
            <div key={s.id} className="border border-border rounded-lg p-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">{s.platform_templates?.name ?? "Template"}</p>
                  <Badge variant="outline" className="text-xs">{s.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  R$ {Number(s.agency_price_monthly).toFixed(0)}/mês · custo R$ {Number(s.platform_price_monthly).toFixed(0)}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(s.id)} disabled={s.status === "cancelled"}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Atribuir template</DialogTitle>
          </DialogHeader>
          {!pickedTemplate ? (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {availableToAdd.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum template disponível para atribuir.</p>
              ) : availableToAdd.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setPickedTemplate(t); setAgencyPrice(String(t.platform_price_monthly * 2)); }}
                  className="w-full text-left border border-border rounded-lg p-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <Badge variant="outline" className="text-xs">{t.category}</Badge>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Custo: R$ {t.platform_price_monthly.toFixed(0)}/mês</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border border-border rounded-lg p-3">
                <p className="text-sm font-medium text-foreground">{pickedTemplate.name}</p>
                <p className="text-xs text-muted-foreground mt-1">Custo plataforma: R$ {pickedTemplate.platform_price_monthly.toFixed(0)}/mês</p>
              </div>
              <div>
                <Label>Preço cobrado ao cliente (R$/mês)</Label>
                <Input
                  type="number"
                  value={agencyPrice}
                  onChange={(e) => setAgencyPrice(e.target.value)}
                  min={pickedTemplate.platform_price_monthly}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lucro: R$ {Math.max(0, parseFloat(agencyPrice || "0") - pickedTemplate.platform_price_monthly).toFixed(0)}/mês
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPickedTemplate(null)} className="flex-1">Voltar</Button>
                <Button onClick={handleAdd} disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  Atribuir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
