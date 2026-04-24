import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DollarSign, Plus, Search, MoreVertical, Pencil, Trash2, TrendingUp, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

type Opp = {
  id: string; user_id: string; client_name: string; value: number;
  stage: string; probability: number; expected_close_date: string | null;
  notes: string; created_at: string;
};
const STAGES = [
  { value: "qualificacao", label: "Qualificação" },
  { value: "proposta", label: "Proposta" },
  { value: "negociacao", label: "Negociação" },
  { value: "fechado", label: "Fechado" },
  { value: "perdido", label: "Perdido" },
];
const stageBadge = (s: string) =>
  s === "fechado" ? "default" : s === "perdido" ? "destructive" : "secondary";

const Sales = () => {
  const { user } = useAuth();
  const { activeClientUserId } = useWorkspace();
  const dataUserId = activeClientUserId ?? user?.id;
  const [opps, setOpps] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ client_name: "", value: 0, stage: "qualificacao", probability: 50, expected_close_date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!dataUserId) return;
    setLoading(true);
    const { data } = await supabase.from("sales_opportunities").select("*").eq("user_id", dataUserId).order("created_at", { ascending: false });
    setOpps((data as Opp[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [dataUserId]);

  const filtered = useMemo(() => opps.filter(o => {
    const matchSearch = !search || o.client_name.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === "all" || o.stage === stageFilter;
    return matchSearch && matchStage;
  }), [opps, search, stageFilter]);

  const stats = {
    pipeline: opps.filter(o => !["fechado", "perdido"].includes(o.stage)).reduce((s, o) => s + Number(o.value), 0),
    closed: opps.filter(o => o.stage === "fechado").reduce((s, o) => s + Number(o.value), 0),
    count: opps.length,
    avgDeal: opps.length ? opps.reduce((s, o) => s + Number(o.value), 0) / opps.length : 0,
  };

  const openNew = () => { setEditingId(null); setForm({ client_name: "", value: 0, stage: "qualificacao", probability: 50, expected_close_date: "", notes: "" }); setDialogOpen(true); };
  const openEdit = (o: Opp) => {
    setEditingId(o.id);
    setForm({ client_name: o.client_name, value: Number(o.value), stage: o.stage, probability: o.probability, expected_close_date: o.expected_close_date ?? "", notes: o.notes ?? "" });
    setDialogOpen(true);
  };
  const save = async () => {
    if (!form.client_name.trim() || !dataUserId) return;
    setSaving(true);
    const payload = { ...form, expected_close_date: form.expected_close_date || null, user_id: dataUserId };
    const { error } = editingId
      ? await supabase.from("sales_opportunities").update(payload).eq("id", editingId)
      : await supabase.from("sales_opportunities").insert(payload);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success(editingId ? "Oportunidade atualizada" : "Oportunidade criada");
    setDialogOpen(false); load();
  };
  const remove = async (id: string) => {
    await supabase.from("sales_opportunities").delete().eq("id", id);
    setOpps(prev => prev.filter(o => o.id !== id));
    toast.success("Removida");
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
              <p className="text-sm text-muted-foreground">Pipeline e oportunidades</p>
            </div>
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova Oportunidade</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Pipeline", value: `R$ ${stats.pipeline.toFixed(2)}`, icon: TrendingUp },
            { label: "Fechado", value: `R$ ${stats.closed.toFixed(2)}`, icon: DollarSign },
            { label: "Oportunidades", value: stats.count, icon: Target },
            { label: "Ticket médio", value: `R$ ${stats.avgDeal.toFixed(2)}`, icon: TrendingUp },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-xs text-muted-foreground">{s.label}</span><s.icon className="w-4 h-4 text-primary" /></div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos estágios</SelectItem>
              {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>{["Cliente","Valor","Estágio","Probabilidade","Fechamento",""].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{opps.length === 0 ? "Nenhuma oportunidade ainda." : "Sem resultados."}</TableCell></TableRow>
              : filtered.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.client_name}</TableCell>
                  <TableCell>R$ {Number(o.value).toFixed(2)}</TableCell>
                  <TableCell><Badge variant={stageBadge(o.stage)}>{STAGES.find(s => s.value === o.stage)?.label ?? o.stage}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{o.probability}%</TableCell>
                  <TableCell className="text-muted-foreground">{o.expected_close_date ?? "—"}</TableCell>
                  <TableCell className="w-12">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(o)}><Pencil className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(o.id)}><Trash2 className="w-4 h-4 mr-2" /> Remover</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingId ? "Editar" : "Nova"} Oportunidade</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Cliente *</Label><Input value={form.client_name} onChange={e => setForm(f => ({...f, client_name: e.target.value}))} className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.value} onChange={e => setForm(f => ({...f, value: parseFloat(e.target.value) || 0}))} className="mt-1" /></div>
                <div><Label>Probabilidade (%)</Label><Input type="number" min={0} max={100} value={form.probability} onChange={e => setForm(f => ({...f, probability: parseInt(e.target.value) || 0}))} className="mt-1" /></div>
                <div><Label>Estágio</Label>
                  <Select value={form.stage} onValueChange={v => setForm(f => ({...f, stage: v}))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>Fechamento</Label><Input type="date" value={form.expected_close_date} onChange={e => setForm(f => ({...f, expected_close_date: e.target.value}))} className="mt-1" /></div>
              </div>
              <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="mt-1 resize-none" rows={3} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={!form.client_name.trim() || saving}>{saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};
export default Sales;
