import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import ModuleGate from "@/components/shared/ModuleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileText, Plus, Search, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

type Contract = {
  id: string; user_id: string; name: string; client_name: string; type: string; value: number;
  status: string; start_date: string | null; end_date: string | null; signed_at: string | null;
  notes: string; created_at: string;
};
const TYPES = [
  { value: "service", label: "Serviço" },
  { value: "nda", label: "NDA" },
  { value: "partnership", label: "Parceria" },
];
const STATUSES = [
  { value: "draft", label: "Rascunho" },
  { value: "active", label: "Ativo" },
  { value: "signed", label: "Assinado" },
  { value: "expired", label: "Expirado" },
  { value: "cancelled", label: "Cancelado" },
];
const statusBadge = (s: string) => s === "signed" || s === "active" ? "default" : s === "expired" || s === "cancelled" ? "destructive" : "secondary";

const Contracts = () => {
  const { user } = useAuth();
  const { activeClientUserId } = useWorkspace();
  const dataUserId = activeClientUserId ?? user?.id;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", client_name: "", type: "service", value: 0, status: "draft", start_date: "", end_date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!dataUserId) return;
    setLoading(true);
    const { data } = await supabase.from("user_contracts").select("*").eq("user_id", dataUserId).order("created_at", { ascending: false });
    setContracts((data as Contract[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [dataUserId]);

  const filtered = useMemo(() => contracts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.client_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  }), [contracts, search, statusFilter]);

  const stats = {
    total: contracts.length,
    active: contracts.filter(c => c.status === "active" || c.status === "signed").length,
    value: contracts.filter(c => c.status === "active" || c.status === "signed").reduce((s, c) => s + Number(c.value), 0),
  };

  const openNew = () => { setEditingId(null); setForm({ name: "", client_name: "", type: "service", value: 0, status: "draft", start_date: "", end_date: "", notes: "" }); setDialogOpen(true); };
  const openEdit = (c: Contract) => {
    setEditingId(c.id);
    setForm({ name: c.name, client_name: c.client_name ?? "", type: c.type, value: Number(c.value), status: c.status, start_date: c.start_date ?? "", end_date: c.end_date ?? "", notes: c.notes ?? "" });
    setDialogOpen(true);
  };
  const save = async () => {
    if (!form.name.trim() || !dataUserId) return;
    setSaving(true);
    const payload = { ...form, start_date: form.start_date || null, end_date: form.end_date || null, user_id: dataUserId };
    const { error } = editingId
      ? await supabase.from("user_contracts").update(payload).eq("id", editingId)
      : await supabase.from("user_contracts").insert(payload);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success(editingId ? "Contrato atualizado" : "Contrato criado");
    setDialogOpen(false); load();
  };
  const remove = async (id: string) => {
    await supabase.from("user_contracts").delete().eq("id", id);
    setContracts(prev => prev.filter(c => c.id !== id));
    toast.success("Removido");
  };

  return (
    <ModuleGate moduleKey="gestao.contratos">
      <DashboardLayout>
        <div className="p-6 lg:p-8 max-w-7xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
                <p className="text-sm text-muted-foreground">Gestão contratual</p>
              </div>
            </div>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Contrato</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Total", value: stats.total },
              { label: "Ativos", value: stats.active },
              { label: "Valor ativo", value: `R$ ${stats.value.toFixed(2)}` },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos status</SelectItem>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader><TableRow>{["Nome","Cliente","Tipo","Valor","Status","Vigência",""].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">{contracts.length === 0 ? "Nenhum contrato ainda." : "Sem resultados."}</TableCell></TableRow>
                : filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.client_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{TYPES.find(t => t.value === c.type)?.label ?? c.type}</TableCell>
                    <TableCell>R$ {Number(c.value).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={statusBadge(c.status)}>{STATUSES.find(s => s.value === c.status)?.label ?? c.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{c.start_date ? `${c.start_date} → ${c.end_date ?? "?"}` : "—"}</TableCell>
                    <TableCell className="w-12">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4 mr-2" /> Remover</DropdownMenuItem>
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
              <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} Contrato</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cliente</Label><Input value={form.client_name} onChange={e => setForm(f => ({...f, client_name: e.target.value}))} className="mt-1" /></div>
                  <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.value} onChange={e => setForm(f => ({...f, value: parseFloat(e.target.value) || 0}))} className="mt-1" /></div>
                  <div><Label>Tipo</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({...f, type: v}))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div><Label>Início</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} className="mt-1" /></div>
                  <div><Label>Fim</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} className="mt-1" /></div>
                </div>
                <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="mt-1 resize-none" rows={2} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={save} disabled={!form.name.trim() || saving}>{saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ModuleGate>
  );
};
export default Contracts;
