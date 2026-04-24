import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UsersRound, Plus, Search, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

type Member = {
  id: string; user_id: string; full_name: string; email: string; role: string;
  department: string; status: string; phone: string | null; joined_at: string | null;
  created_at: string;
};
const STATUSES = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "invited", label: "Convidado" },
];
const statusBadge = (s: string) => s === "active" ? "default" : s === "invited" ? "secondary" : "outline";

const Team = () => {
  const { user } = useAuth();
  const { activeClientUserId } = useWorkspace();
  const dataUserId = activeClientUserId ?? user?.id;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", role: "member", department: "", status: "active", phone: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!dataUserId) return;
    setLoading(true);
    const { data } = await supabase.from("team_members").select("*").eq("user_id", dataUserId).order("created_at", { ascending: false });
    setMembers((data as Member[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [dataUserId]);

  const filtered = useMemo(() => members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchStatus;
  }), [members, search, statusFilter]);

  const openNew = () => { setEditingId(null); setForm({ full_name: "", email: "", role: "member", department: "", status: "active", phone: "" }); setDialogOpen(true); };
  const openEdit = (m: Member) => {
    setEditingId(m.id);
    setForm({ full_name: m.full_name, email: m.email, role: m.role, department: m.department ?? "", status: m.status, phone: m.phone ?? "" });
    setDialogOpen(true);
  };
  const save = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !dataUserId) return;
    setSaving(true);
    const payload = { ...form, phone: form.phone || null, user_id: dataUserId };
    const { error } = editingId
      ? await supabase.from("team_members").update(payload).eq("id", editingId)
      : await supabase.from("team_members").insert(payload);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success(editingId ? "Membro atualizado" : "Membro adicionado");
    setDialogOpen(false); load();
  };
  const remove = async (id: string) => {
    await supabase.from("team_members").delete().eq("id", id);
    setMembers(prev => prev.filter(m => m.id !== id));
    toast.success("Removido");
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <UsersRound className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Equipe</h1>
              <p className="text-sm text-muted-foreground">Gestão de colaboradores</p>
            </div>
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Membro</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total", value: members.length },
            { label: "Ativos", value: members.filter(m => m.status === "active").length },
            { label: "Convidados", value: members.filter(m => m.status === "invited").length },
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
            <TableHeader><TableRow>{["Nome","Email","Cargo","Departamento","Status",""].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{members.length === 0 ? "Nenhum membro ainda." : "Sem resultados."}</TableCell></TableRow>
              : filtered.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell className="text-muted-foreground">{m.role}</TableCell>
                  <TableCell className="text-muted-foreground">{m.department || "—"}</TableCell>
                  <TableCell><Badge variant={statusBadge(m.status)}>{STATUSES.find(s => s.value === m.status)?.label ?? m.status}</Badge></TableCell>
                  <TableCell className="w-12">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(m)}><Pencil className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(m.id)}><Trash2 className="w-4 h-4 mr-2" /> Remover</DropdownMenuItem>
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
            <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} Membro</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))} className="mt-1" /></div>
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cargo</Label><Input value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} className="mt-1" /></div>
                <div><Label>Departamento</Label><Input value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))} className="mt-1" /></div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className="mt-1" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={!form.full_name.trim() || !form.email.trim() || saving}>{saving ? "Salvando..." : editingId ? "Salvar" : "Adicionar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};
export default Team;
