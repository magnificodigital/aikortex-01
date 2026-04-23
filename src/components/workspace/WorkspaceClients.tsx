import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceOwner } from "@/hooks/use-workspace-owner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Search, Users, TrendingUp, MoreVertical, Pencil, Trash2, DollarSign } from "lucide-react";

type ContactStatus = "active" | "inactive" | "prospect";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: ContactStatus;
  monthly_value: number;
  notes: string | null;
  created_at: string;
};

type FormData = {
  name: string;
  email: string;
  phone: string;
  company: string;
  status: ContactStatus;
  monthly_value: number;
  notes: string;
};

const emptyForm: FormData = {
  name: "", email: "", phone: "", company: "",
  status: "active", monthly_value: 0, notes: "",
};

const statusLabel: Record<ContactStatus, string> = {
  active: "Ativo", inactive: "Inativo", prospect: "Prospect",
};
const statusVariant: Record<ContactStatus, "default" | "secondary" | "outline"> = {
  active: "default", inactive: "secondary", prospect: "outline",
};

export const WorkspaceClients = () => {
  const { isReadOnlyView } = useWorkspace();
  const { ownerId: dataUserId } = useWorkspaceOwner();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!dataUserId) return;
    setLoading(true);
    const { data } = await supabase
      .from("client_contacts")
      .select("*")
      .eq("user_id", dataUserId)
      .order("created_at", { ascending: false });
    setContacts((data as Contact[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [dataUserId]);

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: contacts.length,
    active: contacts.filter(c => c.status === "active").length,
    prospect: contacts.filter(c => c.status === "prospect").length,
    revenue: contacts
      .filter(c => c.status === "active")
      .reduce((s, c) => s + (c.monthly_value ?? 0), 0),
  };

  const openNew = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (c: Contact) => {
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      company: c.company ?? "",
      status: c.status,
      monthly_value: c.monthly_value,
      notes: c.notes ?? "",
    });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !dataUserId) return;
    setSaving(true);
    const payload = { ...form, user_id: dataUserId };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("client_contacts").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("client_contacts").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success(editingId ? "Contato atualizado" : "Contato adicionado");
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("client_contacts").delete().eq("id", id);
    toast.success("Contato removido");
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus clientes e contatos</p>
        </div>
        <Button
          onClick={openNew}
          disabled={isReadOnlyView}
          title={isReadOnlyView ? "Apenas o cliente pode gerenciar contatos" : undefined}
        >
          <Plus className="w-4 h-4 mr-1" /> Novo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total de Clientes", value: stats.total, icon: Users, color: "text-blue-500" },
          { label: "Clientes Ativos", value: stats.active, icon: Users, color: "text-emerald-500" },
          { label: "Prospects", value: stats.prospect, icon: TrendingUp, color: "text-amber-500" },
          { label: "Receita Mensal", value: `R$ ${stats.revenue.toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "text-purple-500" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="prospect">Prospects</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {["Nome", "Empresa", "Email", "Telefone", "Status", "Valor/mês", ""].map(h => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {contacts.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum resultado encontrado."}
                </TableCell>
              </TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.company ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[c.status]}>{statusLabel[c.status]}</Badge>
                </TableCell>
                <TableCell className="text-foreground">
                  {c.monthly_value > 0 ? `R$ ${c.monthly_value.toFixed(2).replace(".", ",")}` : "—"}
                </TableCell>
                <TableCell className="w-12">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => remove(c.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Empresa</Label>
                <Input value={form.company} onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as ContactStatus }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Valor mensal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.monthly_value}
                  onChange={(e) => setForm(f => ({ ...f, monthly_value: parseFloat(e.target.value) || 0 }))}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="mt-1 resize-none"
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.name.trim() || saving}>
              {saving ? "Salvando..." : editingId ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkspaceClients;