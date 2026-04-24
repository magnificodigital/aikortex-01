import { Suspense, Component, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2, MessageSquare, ShoppingCart, DollarSign, CheckSquare, Settings, Plus, Search, Users, Eye, Menu, FileText, Target, Video, UsersRound, Bot, AppWindow, GitBranch, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import ClientSidebar from "./ClientSidebar";
import { WorkspaceHomeChat } from "./WorkspaceHomeChat";

export interface WorkspaceShellProps {
  mode: "owner" | "read_only";
  clientId?: string;
  clientName?: string;
}

type ShellCtx = {
  mode: "owner" | "read_only";
  readOnly: boolean;
  ownerId: string | null;
  enabledModules: string[];
};
const ShellContext = createContext<ShellCtx>({
  mode: "owner", readOnly: false, ownerId: null,
  enabledModules: ["mensagens"],
});
const useShell = () => useContext(ShellContext);

class WorkspaceErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; msg: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, msg: "" };
  }
  static getDerivedStateFromError(e: Error) {
    return { hasError: true, msg: e.message };
  }
  componentDidCatch(error: Error, info: unknown) {
    console.error("[WorkspaceShell] Module error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center space-y-2">
          <p className="text-destructive font-medium">Erro ao carregar o módulo</p>
          <p className="text-sm text-muted-foreground">{this.state.msg}</p>
          <button
            className="text-sm text-primary underline mt-2"
            onClick={() => this.setState({ hasError: false, msg: "" })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Loader = () => (
  <div className="p-6 text-muted-foreground flex items-center gap-2">
    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
  </div>
);

const SectionHeader = ({
  icon: Icon,
  title,
  description,
  actionLabel,
}: {
  icon: typeof MessageSquare;
  title: string;
  description: string;
  actionLabel?: string;
}) => {
  const { readOnly } = useShell();
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {actionLabel && !readOnly && (
        <Button onClick={() => toast.info("Em breve")}>
          <Plus className="w-4 h-4 mr-1" /> {actionLabel}
        </Button>
      )}
    </div>
  );
};

const StatCard = ({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) => (
  <div className="bg-card border border-border rounded-xl p-4">
    <p className="text-xs text-muted-foreground mb-2">{label}</p>
    <p className={`text-xl font-bold ${valueClassName ?? "text-foreground"}`}>{value}</p>
  </div>
);

const HomeSection = () => {
  const { readOnly } = useShell();
  return (
    <div className={readOnly ? "pointer-events-none opacity-80" : ""}>
      <WorkspaceHomeChat />
    </div>
  );
};

const ClientesSection = () => {
  const { readOnly, ownerId } = useShell();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    supabase
      .from("client_contacts")
      .select("*")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setContacts(data ?? []);
        setLoading(false);
      });
  }, [ownerId]);

  const filtered = contacts.filter((c) => {
    const matchSearch =
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = status === "all" || c.status === status;
    return matchSearch && matchStatus;
  });

  const active = contacts.filter((c) => c.status === "active" || !c.status).length;
  const monthlyTotal = contacts.reduce((s, c) => s + (Number(c.monthly_value) || 0), 0);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader
        icon={Users}
        title="Clientes"
        description="Gerencie seus clientes"
        actionLabel="Adicionar Cliente"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Clientes ativos" value={active} />
        <StatCard label="Receita mensal" value={`R$ ${monthlyTotal.toFixed(0)}`} />
        <StatCard label="Total de clientes" value={contacts.length} />
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Valor/mês</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    {c.monthly_value ? `R$ ${Number(c.monthly_value).toFixed(0)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {c.status === "active" || !c.status ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const VendasSection = () => {
  const { ownerId } = useShell();
  const [opps, setOpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    supabase
      .from("sales_opportunities")
      .select("*")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setOpps(data ?? []);
        setLoading(false);
      });
  }, [ownerId]);

  const pipeline = opps.reduce((s, o) => s + (Number(o.value) || 0), 0);
  const closed = opps
    .filter((o) => o.stage === "closed_won")
    .reduce((s, o) => s + (Number(o.value) || 0), 0);
  const ticket = opps.length > 0 ? pipeline / opps.length : 0;

  const stageLabel: Record<string, string> = {
    lead: "Lead",
    contact: "Contato",
    proposal: "Proposta",
    negotiation: "Negociação",
    closed_won: "Fechado",
    closed_lost: "Perdido",
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader
        icon={ShoppingCart}
        title="Vendas"
        description="Pipeline e oportunidades"
        actionLabel="Nova Oportunidade"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pipeline Total" value={`R$ ${pipeline.toFixed(0)}`} />
        <StatCard
          label="Fechados"
          value={`R$ ${closed.toFixed(0)}`}
          valueClassName="text-[hsl(var(--success))]"
        />
        <StatCard label="Ticket Médio" value={`R$ ${ticket.toFixed(0)}`} />
        <StatCard label="Oportunidades" value={opps.length} />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Probabilidade</TableHead>
              <TableHead>Previsão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : opps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Nenhuma oportunidade cadastrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              opps.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.client_name}</TableCell>
                  <TableCell>R$ {Number(o.value).toFixed(0)}</TableCell>
                  <TableCell>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        o.stage === "closed_won"
                          ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20"
                          : o.stage === "closed_lost"
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-primary/10 text-primary border-primary/20"
                      }`}
                    >
                      {stageLabel[o.stage] ?? o.stage}
                    </span>
                  </TableCell>
                  <TableCell>{o.probability}%</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {o.expected_close_date
                      ? new Date(o.expected_close_date).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const FinanceiroSection = () => {
  const { ownerId } = useShell();
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    supabase
      .from("workspace_transactions")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTxs(data ?? []);
        setLoading(false);
      });
  }, [ownerId]);

  const isIncome = (t: any) => t.type === "income" || t.type === "receita";
  const receita = txs.filter(isIncome).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const despesas = txs
    .filter((t) => t.type === "expense" || t.type === "despesa")
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const saldo = receita - despesas;

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader
        icon={DollarSign}
        title="Financeiro"
        description="Controle de receitas e despesas"
        actionLabel="Nova Transação"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Receita Total"
          value={`R$ ${receita.toFixed(2)}`}
          valueClassName="text-[hsl(var(--success))]"
        />
        <StatCard
          label="Despesas"
          value={`R$ ${despesas.toFixed(2)}`}
          valueClassName="text-destructive"
        />
        <StatCard
          label="Saldo"
          value={`R$ ${saldo.toFixed(2)}`}
          valueClassName={saldo >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}
        />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Transações</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : txs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Nenhuma transação registrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              txs.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="font-medium">{t.description}</TableCell>
                  <TableCell
                    className={
                      isIncome(t)
                        ? "text-[hsl(var(--success))] font-medium"
                        : "text-destructive font-medium"
                    }
                  >
                    {isIncome(t) ? "+" : "-"}R$ {Number(t.amount).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        isIncome(t)
                          ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}
                    >
                      {isIncome(t) ? "Receita" : "Despesa"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                      {t.status ?? "—"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const TarefasSection = () => {
  const { ownerId } = useShell();
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    supabase
      .from("workspace_tasks")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTasks(data ?? []);
        setLoading(false);
      });
  }, [ownerId]);

  const counts = {
    total: tasks.length,
    doing: tasks.filter((t) => t.status === "doing" || t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done" || t.status === "completed").length,
    late: tasks.filter(
      (t) =>
        t.due_date &&
        new Date(t.due_date) < new Date() &&
        t.status !== "done" &&
        t.status !== "completed",
    ).length,
  };

  const filtered = tasks.filter(
    (t) => !search || t.title?.toLowerCase().includes(search.toLowerCase()),
  );

  const priorityLabel: Record<string, string> = { high: "Alta", medium: "Média", low: "Baixa" };
  const statusLabel: Record<string, string> = {
    todo: "A fazer",
    doing: "Em andamento",
    in_progress: "Em andamento",
    done: "Concluída",
    completed: "Concluída",
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader
        icon={CheckSquare}
        title="Tarefas"
        description="Gerencie suas atividades"
        actionLabel="Nova Tarefa"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Em andamento" value={counts.doing} valueClassName="text-[hsl(var(--info,210_100%_50%))]" />
        <StatCard label="Concluídas" value={counts.done} valueClassName="text-[hsl(var(--success))]" />
        <StatCard label="Atrasadas" value={counts.late} valueClassName="text-destructive" />
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tarefas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarefa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Vencimento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  Nenhuma tarefa encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.title}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {statusLabel[t.status] ?? t.status ?? "A fazer"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {priorityLabel[t.priority] ?? "Normal"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const ConfiguracoesSection = () => {
  const { user, profile } = useAuth();
  const { readOnly } = useShell();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast.error("Erro ao atualizar senha");
      return;
    }
    toast.success("Senha atualizada com sucesso");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="p-6 lg:p-8 max-w-[800px] space-y-6">
      <SectionHeader
        icon={Settings}
        title="Configurações"
        description="Preferências da sua conta"
      />
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Informações da conta</h2>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm text-foreground mt-1">{user?.email ?? "—"}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <p className="text-sm text-foreground mt-1">{profile?.full_name ?? "—"}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <p className="text-sm text-foreground mt-1">Cliente</p>
          </div>
        </div>
      </div>
      {!readOnly && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Alterar senha</h2>
          <div className="space-y-3">
            <div>
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Atualizar senha"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const MensagensSection = () => {
  const { readOnly } = useShell();
  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader
        icon={MessageSquare}
        title="Mensagens"
        description="Central de comunicação com seus clientes"
        actionLabel="Nova conversa"
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 520 }}>
        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar conversa..." className="pl-9" />
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-6">
            <MessageSquare className="w-8 h-8 mb-2 opacity-60" />
            <p className="text-sm">Nenhuma conversa ainda.</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden lg:col-span-2">
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-6">
            <MessageSquare className="w-8 h-8 mb-2 opacity-60" />
            <p className="text-sm">Selecione uma conversa para começar.</p>
          </div>
          <div className="p-3 border-t border-border flex items-center gap-2">
            <Input placeholder="Digite uma mensagem..." disabled={readOnly || true} className="flex-1" />
            <Button disabled>Enviar</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ContratosSection = () => {
  const { ownerId, readOnly } = useShell();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    supabase.from("user_contracts").select("*").eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setContracts(data ?? []); setLoading(false); });
  }, [ownerId]);

  const statusLabel: Record<string, string> = {
    active: "Ativo", draft: "Rascunho", signed: "Assinado",
    cancelled: "Cancelado", expired: "Expirado",
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader icon={FileText} title="Contratos" description="Seus contratos e acordos" actionLabel="Novo Contrato" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={contracts.length} />
        <StatCard label="Ativos" value={contracts.filter(c => c.status === "active" || c.status === "signed").length} valueClassName="text-green-600" />
        <StatCard label="Rascunhos" value={contracts.filter(c => c.status === "draft").length} />
        <StatCard label="Expirados" value={contracts.filter(c => c.status === "expired" || c.status === "cancelled").length} valueClassName="text-destructive" />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : contracts.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum contrato encontrado.</TableCell></TableRow>
            ) : contracts.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.type ?? "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${c.status === "active" || c.status === "signed" ? "bg-green-500/10 text-green-600 border-green-500/20" : c.status === "expired" || c.status === "cancelled" ? "bg-red-500/10 text-red-600 border-red-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                    {statusLabel[c.status] ?? c.status}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const CrmSection = () => {
  const { ownerId, readOnly } = useShell();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    supabase.from("leads").select("*").eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setLeads(data ?? []); setLoading(false); });
  }, [ownerId]);

  const stageColor: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    contacted: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    qualified: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    won: "bg-green-500/10 text-green-600 border-green-500/20",
    lost: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader icon={Target} title="CRM" description="Pipeline de relacionamento" actionLabel="Novo Lead" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de leads" value={leads.length} />
        <StatCard label="Qualificados" value={leads.filter(l => l.stage === "qualified").length} valueClassName="text-purple-600" />
        <StatCard label="Ganhos" value={leads.filter(l => l.stage === "won").length} valueClassName="text-green-600" />
        <StatCard label="Perdidos" value={leads.filter(l => l.stage === "lost").length} valueClassName="text-destructive" />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Etapa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : leads.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow>
            ) : leads.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell className="text-muted-foreground">{l.company ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{l.email ?? "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${stageColor[l.stage] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {l.stage ?? "—"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const ReunioesSection = () => {
  const { ownerId, readOnly } = useShell();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    supabase.from("meetings").select("*").eq("host_user_id", ownerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setMeetings(data ?? []); setLoading(false); });
  }, [ownerId]);

  const statusLabel: Record<string, string> = {
    waiting: "Aguardando", active: "Ativa", ended: "Encerrada",
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader icon={Video} title="Reuniões" description="Videochamadas e encontros" actionLabel="Nova Reunião" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total" value={meetings.length} />
        <StatCard label="Ativas" value={meetings.filter(m => m.status === "active").length} valueClassName="text-green-600" />
        <StatCard label="Encerradas" value={meetings.filter(m => m.status === "ended").length} />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Início</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : meetings.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">Nenhuma reunião encontrada.</TableCell></TableRow>
            ) : meetings.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.title}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${m.status === "active" ? "bg-green-500/10 text-green-600 border-green-500/20" : m.status === "ended" ? "bg-muted text-muted-foreground border-border" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                    {statusLabel[m.status] ?? m.status}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {m.started_at ? new Date(m.started_at).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const EquipeSection = () => {
  const { ownerId, readOnly } = useShell();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    supabase.from("workspace_members").select("*").eq("workspace_owner_id", ownerId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setMembers(data ?? []); setLoading(false); });
  }, [ownerId]);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader icon={UsersRound} title="Equipe" description="Membros do seu workspace" actionLabel="Convidar membro" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total" value={members.length} />
        <StatCard label="Ativos" value={members.filter(m => m.status === "active").length} valueClassName="text-green-600" />
        <StatCard label="Pendentes" value={members.filter(m => m.status === "invited" || m.status === "pending").length} />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membro</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum membro na equipe ainda.</TableCell></TableRow>
            ) : members.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.member_user_id}</TableCell>
                <TableCell className="text-muted-foreground">{m.job_title ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{m.department ?? "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${m.status === "active" ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                    {m.status ?? "—"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const AgentesSection = () => {
  const { ownerId, readOnly } = useShell();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    supabase.from("user_agents").select("id, name, description, status, agent_type, created_at")
      .eq("user_id", ownerId).order("created_at", { ascending: false })
      .then(({ data }) => { setAgents(data ?? []); setLoading(false); });
  }, [ownerId]);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader icon={Bot} title="Agentes" description="Seus agentes de IA" actionLabel="Novo Agente" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total" value={agents.length} />
        <StatCard label="Ativos" value={agents.filter(a => a.status === "active").length} valueClassName="text-green-600" />
        <StatCard label="Rascunhos" value={agents.filter(a => a.status === "draft" || !a.status).length} />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : agents.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum agente criado ainda.</TableCell></TableRow>
            ) : agents.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="text-muted-foreground">{a.agent_type ?? "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${a.status === "active" ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                    {a.status ?? "rascunho"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {a.created_at ? new Date(a.created_at).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const AppsSection = () => {
  const { ownerId, readOnly } = useShell();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    supabase.from("user_apps").select("id, name, status, created_at")
      .eq("user_id", ownerId).order("created_at", { ascending: false })
      .then(({ data }) => { setApps(data ?? []); setLoading(false); });
  }, [ownerId]);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader icon={AppWindow} title="Apps" description="Aplicações do seu workspace" actionLabel="Novo App" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total" value={apps.length} />
        <StatCard label="Publicados" value={apps.filter(a => a.status === "published").length} valueClassName="text-green-600" />
        <StatCard label="Rascunhos" value={apps.filter(a => a.status !== "published").length} />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : apps.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">Nenhum app criado ainda.</TableCell></TableRow>
            ) : apps.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${a.status === "published" ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                    {a.status ?? "rascunho"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {a.created_at ? new Date(a.created_at).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const FlowsSection = () => (
  <div className="p-6 lg:p-8 max-w-[1200px]">
    <SectionHeader icon={GitBranch} title="Flows" description="Automações do seu workspace" actionLabel="Novo Flow" />
    <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
      Nenhum flow criado ainda.
    </div>
  </div>
);

const TemplatesSection = () => (
  <div className="p-6 lg:p-8 max-w-[1200px]">
    <SectionHeader icon={FileText} title="Templates" description="Templates disponíveis" />
    <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
      Nenhum template disponível ainda.
    </div>
  </div>
);

const DisparosSection = () => {
  const { ownerId } = useShell();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    setLoading(true);
    supabase.from("broadcast_logs").select("id, broadcast_name, status, created_at")
      .eq("user_id", ownerId).order("created_at", { ascending: false })
      .then(({ data }) => { setLogs(data ?? []); setLoading(false); });
  }, [ownerId]);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader icon={Send} title="Disparos" description="Histórico de broadcasts" actionLabel="Novo Disparo" />
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">Nenhum disparo realizado ainda.</TableCell></TableRow>
            ) : logs.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.broadcast_name ?? "—"}</TableCell>
                <TableCell>
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                    {l.status ?? "—"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {l.created_at ? new Date(l.created_at).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const WorkspaceShell = ({ mode, clientId, clientName }: WorkspaceShellProps) => {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = () => setMobileOpen(false);
  const readOnly = mode === "read_only";
  const { user } = useAuth();
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "owner") {
      setOwnerId(user?.id ?? null);
      return;
    }
    if (!clientId) return;
    supabase
      .from("agency_clients")
      .select("client_user_id")
      .eq("id", clientId)
      .maybeSingle()
      .then(({ data }) => setOwnerId(data?.client_user_id ?? null));
  }, [mode, clientId, user?.id]);

  const [enabledModules, setEnabledModules] = useState<string[]>(["mensagens"]);

  useEffect(() => {
    if (!ownerId) return;
    supabase
      .from("agency_clients")
      .select("enabled_ia_modules")
      .eq("client_user_id", ownerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.enabled_ia_modules?.length) {
          setEnabledModules(data.enabled_ia_modules);
        }
      });
  }, [ownerId]);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  return (
    <ShellContext.Provider value={{ mode, readOnly, ownerId, enabledModules }}>
      <div className="flex min-h-screen w-full overflow-hidden">
        <ClientSidebar
          mobileOpen={mobileOpen}
          onMobileClose={close}
          readOnly={readOnly}
          overrideName={readOnly ? clientName : undefined}
          basePath={readOnly && clientId ? `/clients/${clientId}/workspace` : "/workspace"}
          enabledModules={enabledModules}
        />
        <main className="relative flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-background">
          {isMobile && (
            <div className="sticky top-0 z-30 flex items-center justify-between bg-background/80 backdrop-blur-lg px-3 py-2">
              <button
                onClick={() => setMobileOpen(true)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div />
            </div>
          )}
          {readOnly && (
            <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
              <Eye className="w-4 h-4 shrink-0" />
              <span>
                Você está visualizando o workspace deste cliente. Edições não são permitidas.
              </span>
            </div>
          )}
          <div className="relative z-10">
            <WorkspaceErrorBoundary>
              <Suspense fallback={<Loader />}>
                <Routes>
                  <Route index element={<HomeSection />} />
                  <Route path="mensagens" element={<MensagensSection />} />
                  <Route path="clientes" element={<ClientesSection />} />
                  {/* Gestão — novos */}
                  <Route path="contratos" element={<ContratosSection />} />
                  <Route path="vendas" element={<VendasSection />} />
                  <Route path="crm" element={<CrmSection />} />
                  <Route path="reunioes" element={<ReunioesSection />} />
                  <Route path="financeiro" element={<FinanceiroSection />} />
                  <Route path="equipe" element={<EquipeSection />} />
                  <Route path="tarefas" element={<TarefasSection />} />
                  {/* IA — condicionais */}
                  <Route path="agentes" element={<AgentesSection />} />
                  <Route path="flows" element={<FlowsSection />} />
                  <Route path="apps" element={<AppsSection />} />
                  <Route path="templates" element={<TemplatesSection />} />
                  <Route path="disparos" element={<DisparosSection />} />
                  <Route path="configuracoes" element={<ConfiguracoesSection />} />
                  {/* Legacy path redirects */}
                  <Route path="clients" element={<Navigate to="/workspace/clientes" replace />} />
                  <Route path="messages" element={<Navigate to="/workspace/mensagens" replace />} />
                  <Route path="tasks" element={<Navigate to="/workspace/tarefas" replace />} />
                  <Route path="financial" element={<Navigate to="/workspace/financeiro" replace />} />
                  <Route path="settings" element={<Navigate to="/workspace/configuracoes" replace />} />
                </Routes>
              </Suspense>
            </WorkspaceErrorBoundary>
          </div>
        </main>
      </div>
    </ShellContext.Provider>
  );
};

export default WorkspaceShell;
// Note: clientId is reserved for future data-loading in read_only mode.