import { Suspense, Component, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ClientLayout from "@/components/workspace/ClientLayout";
import { Loader2 } from "lucide-react";
import { WorkspaceHomeChat } from "@/components/workspace/WorkspaceHomeChat";
import { useState } from "react";
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
import {
  MessageSquare,
  ShoppingCart,
  DollarSign,
  CheckSquare,
  Settings,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
    console.error("[Workspace] Module error:", error, info);
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

const Placeholder = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof MessageSquare;
  title: string;
  description: string;
}) => (
  <div className="p-6 lg:p-8 max-w-[1200px]">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
      Em breve você poderá gerenciar {title.toLowerCase()} por aqui.
    </div>
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
}) => (
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
    {actionLabel && (
      <Button onClick={() => toast.info("Em breve")}>
        <Plus className="w-4 h-4 mr-1" /> {actionLabel}
      </Button>
    )}
  </div>
);

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

const ClientesSection = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader
        icon={Users}
        title="Clientes"
        description="Gerencie seus clientes"
        actionLabel="Adicionar Cliente"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Clientes ativos" value={0} />
        <StatCard label="Receita mensal" value="R$ 0" />
        <StatCard label="Templates ativos" value={0} />
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
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
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Templates</TableHead>
              <TableHead>Receita/mês</TableHead>
              <TableHead>Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                Nenhum cliente cadastrado ainda.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const VendasSection = () => (
  <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
    <SectionHeader
      icon={ShoppingCart}
      title="Vendas"
      description="Pipeline e oportunidades"
      actionLabel="Nova Oportunidade"
    />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Pipeline Total" value="R$ 0" />
      <StatCard label="Fechados" value="R$ 0" />
      <StatCard label="Ticket Médio" value="R$ 0" />
      <StatCard label="Oportunidades" value={0} />
    </div>
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Probabilidade</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
              Nenhuma oportunidade cadastrada ainda.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
);

const FinanceiroSection = () => (
  <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
    <SectionHeader
      icon={DollarSign}
      title="Financeiro"
      description="Controle de receitas e despesas"
      actionLabel="Nova Transação"
    />
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard label="Receita Total" value="R$ 0" valueClassName="text-[hsl(var(--success))]" />
      <StatCard label="Despesas" value="R$ 0" valueClassName="text-destructive" />
      <StatCard label="Saldo" value="R$ 0" />
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
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
              Nenhuma transação registrada ainda.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
);

const TarefasSection = () => {
  const [search, setSearch] = useState("");
  return (
    <div className="p-6 lg:p-8 max-w-[1200px] space-y-6">
      <SectionHeader
        icon={CheckSquare}
        title="Tarefas"
        description="Gerencie suas atividades"
        actionLabel="Nova Tarefa"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={0} />
        <StatCard label="Em andamento" value={0} valueClassName="text-[hsl(var(--info,210_100%_50%))]" />
        <StatCard label="Concluídas" value={0} valueClassName="text-[hsl(var(--success))]" />
        <StatCard label="Atrasadas" value={0} valueClassName="text-destructive" />
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
            <TableRow>
              <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                Nenhuma tarefa cadastrada ainda.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const ConfiguracoesSection = () => {
  const { user, profile } = useAuth();
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
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const Workspace = () => (
  <ClientLayout>
    <WorkspaceErrorBoundary>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route index element={<WorkspaceHomeChat />} />
          <Route
            path="mensagens"
            element={
              <Placeholder
                icon={MessageSquare}
                title="Mensagens"
                description="Conversas e atendimentos"
              />
            }
          />
          <Route path="clientes" element={<ClientesSection />} />
          <Route path="vendas" element={<VendasSection />} />
          <Route path="financeiro" element={<FinanceiroSection />} />
          <Route path="tarefas" element={<TarefasSection />} />
          <Route path="configuracoes" element={<ConfiguracoesSection />} />
          {/* Legacy path redirects */}
          <Route path="clients" element={<Navigate to="/workspace/clientes" replace />} />
          <Route path="crm" element={<Navigate to="/workspace/vendas" replace />} />
          <Route path="messages" element={<Navigate to="/workspace/mensagens" replace />} />
          <Route path="tasks" element={<Navigate to="/workspace/tarefas" replace />} />
          <Route path="financial" element={<Navigate to="/workspace/financeiro" replace />} />
          <Route path="settings" element={<Navigate to="/workspace/configuracoes" replace />} />
        </Routes>
      </Suspense>
    </WorkspaceErrorBoundary>
  </ClientLayout>
);

export default Workspace;