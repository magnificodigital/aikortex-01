import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { CheckSquare, Plus, Search, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

type TaskRow = {
  id: string; user_id: string; title: string; description: string;
  status: string; priority: string; assignee: string; due_date: string | null;
  created_at: string;
};
const STATUS_OPTS = [
  { value: "todo", label: "A fazer" },
  { value: "in_progress", label: "Em andamento" },
  { value: "done", label: "Concluído" },
];
const PRIORITY_OPTS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];
const statusBadge = (s: string) =>
  s === "done" ? "default" : s === "in_progress" ? "secondary" : "outline";

const Tasks = () => {
  const { user } = useAuth();
  const { activeClientUserId } = useWorkspace();
  const dataUserId = activeClientUserId ?? user?.id;
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", status: "todo", priority: "medium", assignee: "", due_date: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!dataUserId) return;
    setLoading(true);
    const { data } = await supabase
      .from("tasks").select("*")
      .eq("user_id", dataUserId)
      .order("created_at", { ascending: false });
    setTasks((data as TaskRow[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [dataUserId]);

  const filtered = useMemo(() => tasks.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  }), [tasks, search, statusFilter]);

  const openNew = () => { setEditingId(null); setForm({ title: "", description: "", status: "todo", priority: "medium", assignee: "", due_date: "" }); setDialogOpen(true); };
  const openEdit = (t: TaskRow) => {
    setEditingId(t.id);
    setForm({ title: t.title, description: t.description ?? "", status: t.status, priority: t.priority, assignee: t.assignee ?? "", due_date: t.due_date ?? "" });
    setDialogOpen(true);
  };
  const save = async () => {
    if (!form.title.trim() || !dataUserId) return;
    setSaving(true);
    const payload = { ...form, due_date: form.due_date || null, user_id: dataUserId };
    const { error } = editingId
      ? await supabase.from("tasks").update(payload).eq("id", editingId)
      : await supabase.from("tasks").insert(payload);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success(editingId ? "Tarefa atualizada" : "Tarefa criada");
    setDialogOpen(false); load();
  };
  const remove = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success("Tarefa removida");
  };

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === "todo").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    done: tasks.filter(t => t.status === "done").length,
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
              <p className="text-sm text-muted-foreground">Organize e acompanhe suas atividades</p>
            </div>
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova Tarefa</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total },
            { label: "A fazer", value: stats.todo },
            { label: "Em andamento", value: stats.inProgress },
            { label: "Concluídas", value: stats.done },
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
            <Input placeholder="Buscar tarefas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>{["Título","Status","Prioridade","Responsável","Vencimento",""].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{tasks.length === 0 ? "Nenhuma tarefa criada ainda." : "Nenhum resultado."}</TableCell></TableRow>
              ) : filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell><Badge variant={statusBadge(t.status)}>{STATUS_OPTS.find(s => s.value === t.status)?.label ?? t.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{PRIORITY_OPTS.find(p => p.value === t.priority)?.label ?? t.priority}</TableCell>
                  <TableCell className="text-muted-foreground">{t.assignee || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.due_date ?? "—"}</TableCell>
                  <TableCell className="w-12">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(t)}><Pencil className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4 mr-2" /> Remover</DropdownMenuItem>
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
            <DialogHeader><DialogTitle>{editingId ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} className="mt-1" /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className="mt-1 resize-none" rows={3} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({...f, priority: v}))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{PRIORITY_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>Responsável</Label><Input value={form.assignee} onChange={e => setForm(f => ({...f, assignee: e.target.value}))} className="mt-1" /></div>
                <div><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({...f, due_date: e.target.value}))} className="mt-1" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={!form.title.trim() || saving}>{saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
