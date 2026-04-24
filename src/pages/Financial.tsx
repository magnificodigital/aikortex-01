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
import { DollarSign, Plus, Search, MoreVertical, Pencil, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

type Entry = {
  id: string; user_id: string; type: string; description: string; category: string;
  amount: number; status: string; due_date: string | null; paid_at: string | null;
  client_name: string | null; notes: string; created_at: string;
};
const TYPES = [{ value: "income", label: "Receita" }, { value: "expense", label: "Despesa" }];
const STATUSES = [
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
  { value: "overdue", label: "Vencido" },
];
const statusBadge = (s: string) => s === "paid" ? "default" : s === "overdue" ? "destructive" : "secondary";

const Financial = () => {
  const { user } = useAuth();
  const { activeClientUserId } = useWorkspace();
  const dataUserId = activeClientUserId ?? user?.id;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "expense", description: "", category: "outros", amount: 0, status: "pending", due_date: "", paid_at: "", client_name: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!dataUserId) return;
    setLoading(true);
    const { data } = await supabase.from("financial_entries").select("*").eq("user_id", dataUserId).order("created_at", { ascending: false });
    setEntries((data as Entry[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [dataUserId]);

  const filtered = useMemo(() => entries.filter(e => {
    const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase()) || (e.client_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || e.type === typeFilter;
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  }), [entries, search, typeFilter, statusFilter]);

  const stats = {
    income: entries.filter(e => e.type === "income" && e.status === "paid").reduce((s, e) => s + Number(e.amount), 0),
    expense: entries.filter(e => e.type === "expense" && e.status === "paid").reduce((s, e) => s + Number(e.amount), 0),
    pending: entries.filter(e => e.status === "pending").reduce((s, e) => s + Number(e.amount), 0),
  };
  const balance = stats.income - stats.expense;

  const openNew = () => { setEditingId(null); setForm({ type: "expense", description: "", category: "outros", amount: 0, status: "pending", due_date: "", paid_at: "", client_name: "", notes: "" }); setDialogOpen(true); };
  const openEdit = (e: Entry) => {
    setEditingId(e.id);
    setForm({ type: e.type, description: e.description, category: e.category ?? "outros", amount: Number(e.amount), status: e.status, due_date: e.due_date ?? "", paid_at: e.paid_at ?? "", client_name: e.client_name ?? "", notes: e.notes ?? "" });
    setDialogOpen(true);
  };
  const save = async () => {
    if (!form.description.trim() || !dataUserId) return;
    setSaving(true);
    const payload = { ...form, due_date: form.due_date || null, paid_at: form.paid_at || null, client_name: form.client_name || null, user_id: dataUserId };
    const { error } = editingId
      ? await supabase.from("financial_entries").update(payload).eq("id", editingId)
      : await supabase.from("financial_entries").insert(payload);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success(editingId ? "Lançamento atualizado" : "Lançamento criado");
    setDialogOpen(false); load();
  };
  const remove = async (id: string) => {
    await supabase.from("financial_entries").delete().eq("id", id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success("Removido");
  };

  return (
    <ModuleGate moduleKey="gestao.financeiro">
      <DashboardLayout>
        <div className="p-6 lg:p-8 max-w-7xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
                <p className="text-sm text-muted-foreground">Controle suas receitas e despesas</p>
              </div>
            </div>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Lançamento</Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Receitas (pago)", value: `R$ ${stats.income.toFixed(2)}`, icon: TrendingUp, color: "text-emerald-500" },
              { label: "Despesas (pago)", value: `R$ ${stats.expense.toFixed(2)}`, icon: TrendingDown, color: "text-destructive" },
              { label: "Saldo", value: `R$ ${balance.toFixed(2)}`, icon: Wallet, color: balance >= 0 ? "text-emerald-500" : "text-destructive" },
              { label: "Pendentes", value: `R$ ${stats.pending.toFixed(2)}`, icon: DollarSign, color: "text-amber-500" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2"><span className="text-xs text-muted-foreground">{s.label}</span><s.icon className={`w-4 h-4 ${s.color}`} /></div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos tipos</SelectItem>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos status</SelectItem>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader><TableRow>{["Descrição","Tipo","Valor","Status","Vencimento","Cliente",""].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">{entries.length === 0 ? "Nenhum lançamento ainda." : "Sem resultados."}</TableCell></TableRow>
                : filtered.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.description}</TableCell>
                    <TableCell><Badge variant={e.type === "income" ? "default" : "secondary"}>{e.type === "income" ? "Receita" : "Despesa"}</Badge></TableCell>
                    <TableCell className={e.type === "income" ? "text-emerald-600" : "text-destructive"}>R$ {Number(e.amount).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={statusBadge(e.status)}>{STATUSES.find(s => s.value === e.status)?.label ?? e.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{e.due_date ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.client_name ?? "—"}</TableCell>
                    <TableCell className="w-12">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(e)}><Pencil className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => remove(e.id)}><Trash2 className="w-4 h-4 mr-2" /> Remover</DropdownMenuItem>
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
              <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} Lançamento</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({...f, type: v}))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
                  </div>
                </div>
                <div><Label>Descrição *</Label><Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({...f, amount: parseFloat(e.target.value) || 0}))} className="mt-1" /></div>
                  <div><Label>Categoria</Label><Input value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className="mt-1" /></div>
                  <div><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({...f, due_date: e.target.value}))} className="mt-1" /></div>
                  <div><Label>Pago em</Label><Input type="date" value={form.paid_at} onChange={e => setForm(f => ({...f, paid_at: e.target.value}))} className="mt-1" /></div>
                </div>
                <div><Label>Cliente</Label><Input value={form.client_name} onChange={e => setForm(f => ({...f, client_name: e.target.value}))} className="mt-1" /></div>
                <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="mt-1 resize-none" rows={2} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={save} disabled={!form.description.trim() || saving}>{saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ModuleGate>
  );
};
export default Financial;
