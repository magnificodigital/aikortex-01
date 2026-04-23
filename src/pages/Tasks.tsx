import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceOwner } from "@/hooks/use-workspace-owner";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, CheckSquare, Clock, AlertTriangle, TrendingUp, Loader2, Trash2,
} from "lucide-react";

type TaskStatus = "todo" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
};

const STATUS_COLS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "todo", label: "A Fazer", color: "bg-muted/40" },
  { key: "in_progress", label: "Em Progresso", color: "bg-blue-500/5 border-blue-500/20" },
  { key: "review", label: "Revisão", color: "bg-amber-500/5 border-amber-500/20" },
  { key: "done", label: "Concluída", color: "bg-emerald-500/5 border-emerald-500/20" },
];

const PRIORITY_VARIANT: Record<TaskPriority, "default" | "secondary" | "outline" | "destructive"> = {
  low: "secondary",
  medium: "outline",
  high: "default",
  urgent: "destructive",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
};

type FormData = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
};

const empty: FormData = {
  title: "", description: "", status: "todo", priority: "medium", due_date: "",
};

const Tasks = () => {
  const { ownerId } = useWorkspaceOwner();
  const { isReadOnlyView } = useWorkspace();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!ownerId) { setTasks([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("workspace_tasks")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    setTasks((data as Task[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ownerId]);

  const filtered = tasks.filter((t) =>
    !search || t.title.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    overdue: tasks.filter(
      (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done"
    ).length,
    rate: tasks.length
      ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100)
      : 0,
  };

  const openNew = () => { setForm(empty); setEditId(null); setDialogOpen(true); };
  const openEdit = (t: Task) => {
    setForm({
      title: t.title,
      description: t.description ?? "",
      status: t.status,
      priority: t.priority,
      due_date: t.due_date ?? "",
    });
    setEditId(t.id);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !ownerId) return;
    setSaving(true);
    const payload = {
      ...form,
      owner_id: ownerId,
      description: form.description || null,
      due_date: form.due_date || null,
    };
    let error;
    if (editId) {
      ({ error } = await supabase.from("workspace_tasks").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("workspace_tasks").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error("Erro ao salvar tarefa"); return; }
    toast.success(editId ? "Tarefa atualizada" : "Tarefa criada");
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("workspace_tasks").delete().eq("id", id);
    setTasks((p) => p.filter((t) => t.id !== id));
    toast.success("Tarefa removida");
  };

  const updateStatus = async (id: string, status: TaskStatus) => {
    await supabase.from("workspace_tasks").update({ status }).eq("id", id);
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
              <p className="text-sm text-muted-foreground">Gestão de atividades da equipe</p>
            </div>
          </div>
          <Button
            onClick={openNew}
            disabled={isReadOnlyView}
            title={isReadOnlyView ? "Apenas o cliente pode gerenciar tarefas" : undefined}
          >
            <Plus className="w-4 h-4 mr-1" /> Nova Tarefa
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total de Tarefas", value: stats.total, icon: CheckSquare, color: "text-foreground" },
            { label: "Em Progresso", value: stats.inProgress, icon: Clock, color: "text-blue-500" },
            { label: "Atrasadas", value: stats.overdue, icon: AlertTriangle, color: "text-red-500" },
            { label: "Taxa de Conclusão", value: `${stats.rate}%`, icon: TrendingUp, color: "text-emerald-500" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <Input
            placeholder="Buscar tarefa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <span className="text-xs text-muted-foreground">{filtered.length} tarefas</span>
        </div>

        {/* Kanban */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {STATUS_COLS.map((col) => {
              const colTasks = filtered.filter((t) => t.status === col.key);
              return (
                <div key={col.key} className={`rounded-xl border border-border p-3 space-y-2 ${col.color}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">{col.label}</span>
                    <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                  </div>
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => !isReadOnlyView && openEdit(task)}
                      className={`bg-card border border-border rounded-lg p-3 space-y-2 ${
                        isReadOnlyView ? "cursor-default" : "cursor-pointer hover:border-primary/40"
                      } transition-colors`}
                    >
                      <p className="text-sm font-medium text-foreground line-clamp-2">{task.title}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={PRIORITY_VARIANT[task.priority]} className="text-[10px] h-5">
                          {PRIORITY_LABEL[task.priority]}
                        </Badge>
                        {task.due_date && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(task.due_date).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                      {!isReadOnlyView && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={task.status}
                            onValueChange={(v) => updateStatus(task.id, v as TaskStatus)}
                          >
                            <SelectTrigger className="h-7 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_COLS.map((s) => (
                                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => remove(task.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as TaskStatus }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_COLS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TaskPriority }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Data limite</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.title.trim() || saving}>
              {saving ? "Salvando..." : editId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Tasks;