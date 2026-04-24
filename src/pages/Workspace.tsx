import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/use-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import aikortexLogoWhite from "@/assets/aikortex-logo-white.png";
import aikortexLogoBlack from "@/assets/aikortex-logo-black.png";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  TrendingUp,
  DollarSign,
  CheckSquare,
  Settings,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Home,
  ChevronDown,
  ChevronUp,
  Send,
  Bot,
  Loader2,
  Plus,
  Search,
  Target,
  FileText,
  BarChart2,
} from "lucide-react";

type Msg = { role: "user" | "assistant"; text: string };

/* ---------------- HOME ---------------- */
const HomeSection = ({ name }: { name: string }) => {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: `Olá ${name}! Sou seu assistente. Como posso ajudar hoje?` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("agent-chat", {
        body: { message: text, context: "client_workspace" },
      });
      const reply =
        data?.response || data?.message || "Desculpe, não consegui processar sua mensagem.";
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Erro ao conectar com o assistente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quick = [
    { label: "Clientes", icon: Users, color: "text-blue-500", path: "/workspace/clientes" },
    { label: "Vendas", icon: TrendingUp, color: "text-green-500", path: "/workspace/vendas" },
    { label: "Tarefas", icon: CheckSquare, color: "text-amber-500", path: "/workspace/tarefas" },
    { label: "Mensagens", icon: MessageSquare, color: "text-purple-500", path: "/workspace/mensagens" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Olá, {name} 👋</h1>
        <p className="text-muted-foreground mt-1">Bem-vindo ao seu workspace.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quick.map((item) => (
          <Link key={item.label} to={item.path}>
            <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <span className="font-medium text-sm">{item.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="h-[420px] flex flex-col">
        <CardHeader className="border-b py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5 text-primary" />
            Assistente IA
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full p-4">
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </CardContent>
        <div className="border-t p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Pergunte ao seu assistente..."
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={send} disabled={loading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
};

/* ---------------- MENSAGENS ---------------- */
const MensagensSection = () => {
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <MessageSquare className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mensagens</h1>
            <p className="text-sm text-muted-foreground">Central de comunicação com seus clientes</p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Nova conversa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[500px]">
        <Card className="flex flex-col">
          <CardHeader className="py-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar conversas..." className="pl-9" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center text-center p-6">
            <div className="space-y-2">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 flex flex-col">
          <CardContent className="flex-1 flex items-center justify-center text-center p-6">
            <div className="space-y-2">
              <Bot className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Selecione uma conversa para começar.
              </p>
            </div>
          </CardContent>
          <div className="border-t p-3 flex gap-2">
            <Input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Digite uma mensagem..."
              disabled
              className="flex-1"
            />
            <Button disabled size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

/* ---------------- CLIENTES ---------------- */
const ClientesSection = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const stats = [
    { label: "Clientes ativos", value: "0", icon: Users, color: "text-primary" },
    { label: "Receita mensal", value: "R$ 0", icon: DollarSign, color: "text-green-600" },
    { label: "Templates ativos", value: "0", icon: FileText, color: "text-blue-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Users className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground">Gerencie seus clientes</p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Adicionar Cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
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
              <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                Nenhum cliente cadastrado ainda.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

/* ---------------- VENDAS ---------------- */
const VendasSection = () => {
  const metrics = [
    { label: "Pipeline Total", value: "R$ 0", icon: DollarSign, bg: "bg-primary/10", color: "text-primary" },
    { label: "Fechados", value: "R$ 0", icon: TrendingUp, bg: "bg-emerald-500/10", color: "text-emerald-500" },
    { label: "Ticket Médio", value: "R$ 0", icon: Target, bg: "bg-blue-500/10", color: "text-blue-500" },
    { label: "Oportunidades", value: "0", icon: Users, bg: "bg-purple-500/10", color: "text-purple-500" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
            <p className="text-sm text-muted-foreground">Pipeline e oportunidades</p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Nova Oportunidade
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5 flex items-center gap-3">
              <div className={`p-3 rounded-lg ${m.bg}`}>
                <m.icon className={`h-5 w-5 ${m.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-xl font-bold text-foreground">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
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
              <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                Nenhuma oportunidade cadastrada ainda.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

/* ---------------- FINANCEIRO ---------------- */
const FinanceiroSection = () => {
  const cards = [
    { label: "Receita Total", value: "R$ 0", sub: "Este mês", color: "text-green-600", bg: "bg-green-500/10", icon: TrendingUp },
    { label: "Despesas", value: "R$ 0", sub: "Este mês", color: "text-destructive", bg: "bg-destructive/10", icon: DollarSign },
    { label: "Saldo", value: "R$ 0", sub: "Disponível", color: "text-foreground", bg: "bg-muted", icon: BarChart2 },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
            <p className="text-sm text-muted-foreground">Controle de receitas e despesas</p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Nova Transação
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${c.bg}`}>
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                </div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </div>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transações</CardTitle>
        </CardHeader>
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
              <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                Nenhuma transação registrada ainda.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

/* ---------------- TAREFAS ---------------- */
const TarefasSection = () => {
  const [search, setSearch] = useState("");
  const stats = [
    { label: "Total", value: "0", color: "text-foreground" },
    { label: "Em andamento", value: "0", color: "text-blue-600" },
    { label: "Concluídas", value: "0", color: "text-green-600" },
    { label: "Atrasadas", value: "0", color: "text-destructive" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <CheckSquare className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas atividades</p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Nova Tarefa
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tarefas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
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
              <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                Nenhuma tarefa cadastrada ainda.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

/* ---------------- MAIN WORKSPACE ---------------- */
const Workspace = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { profile, user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [gestaoOpen, setGestaoOpen] = useState(true);

  const displayName =
    profile?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Cliente";
  const displayEmail = user?.email ?? "";

  useEffect(() => {
    if (isMobile) setMobileSidebarOpen(false);
  }, [location.pathname, isMobile]);

  const path = location.pathname;
  const isActive = (p: string) =>
    p === "/workspace" ? path === "/workspace" : path === p;

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      active
        ? "bg-sidebar-accent text-primary font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
    }`;

  const showLabels = !collapsed || isMobile;

  const NavLink = ({
    to,
    icon: Icon,
    label,
  }: {
    to: string;
    icon: typeof Home;
    label: string;
  }) => (
    <Link to={to} className={linkClass(isActive(to))} title={collapsed && !isMobile ? label : undefined}>
      <Icon className="h-4 w-4 flex-shrink-0" />
      {showLabels && <span className="truncate">{label}</span>}
    </Link>
  );

  const renderContent = () => {
    if (path === "/workspace" || path === "/workspace/")
      return <HomeSection name={displayName} />;
    if (path === "/workspace/mensagens") return <MensagensSection />;
    if (path === "/workspace/clientes") return <ClientesSection />;
    if (path === "/workspace/vendas") return <VendasSection />;
    if (path === "/workspace/financeiro") return <FinanceiroSection />;
    if (path === "/workspace/tarefas") return <TarefasSection />;
    if (path === "/workspace/configuracoes")
      return (
        <div className="space-y-6 max-w-2xl">
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados da conta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="text-foreground font-medium">{displayEmail}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Nome:</span>{" "}
                <span className="text-foreground font-medium">{profile?.full_name ?? "—"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Tipo:</span>{" "}
                <span className="text-foreground font-medium">Cliente</span>
              </p>
            </CardContent>
          </Card>
        </div>
      );
    return <HomeSection name={displayName} />;
  };

  const sidebarWidth = collapsed && !isMobile ? "w-16" : "w-56";
  const sidebarTransform = isMobile
    ? mobileSidebarOpen
      ? "translate-x-0"
      : "-translate-x-full"
    : "translate-x-0";

  return (
    <div className="min-h-screen flex w-full bg-background">
      {isMobile && mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`${sidebarWidth} ${sidebarTransform} ${
          isMobile ? "fixed inset-y-0 left-0 z-50" : "sticky top-0 h-screen"
        } bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border">
          {showLabels ? (
            <img
              src={theme === "dark" ? aikortexLogoWhite : aikortexLogoBlack}
              alt="AiKortex"
              className="h-7 w-auto"
            />
          ) : (
            <div className="w-full flex justify-center">
              <img
                src={theme === "dark" ? aikortexLogoWhite : aikortexLogoBlack}
                alt="AiKortex"
                className="h-6 w-6 object-contain"
              />
            </div>
          )}
          {isMobile && (
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="p-1 text-sidebar-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* User block */}
        {showLabels && (
          <div className="px-3 py-3 border-b border-sidebar-border">
            <p className="text-xs font-medium text-foreground truncate">{displayEmail}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Workspace do cliente</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          <NavLink to="/workspace" icon={Home} label="Home" />

          {showLabels ? (
            <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Ferramentas
            </p>
          ) : (
            <div className="my-2 border-t border-sidebar-border" />
          )}
          <NavLink to="/workspace/mensagens" icon={MessageSquare} label="Mensagens" />

          {showLabels ? (
            <button
              onClick={() => setGestaoOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <span>Gestão</span>
              {gestaoOpen ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          ) : (
            <div className="my-2 border-t border-sidebar-border" />
          )}

          {(gestaoOpen || (collapsed && !isMobile)) && (
            <div className="space-y-1">
              <NavLink to="/workspace/clientes" icon={Users} label="Clientes" />
              <NavLink to="/workspace/vendas" icon={TrendingUp} label="Vendas" />
              <NavLink to="/workspace/financeiro" icon={DollarSign} label="Financeiro" />
              <NavLink to="/workspace/tarefas" icon={CheckSquare} label="Tarefas" />
            </div>
          )}

          {showLabels ? (
            <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Conta
            </p>
          ) : (
            <div className="my-2 border-t border-sidebar-border" />
          )}
          <NavLink to="/workspace/configuracoes" icon={Settings} label="Configurações" />
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-sidebar-border space-y-1">
          <button onClick={toggle} className={`${linkClass(false)} w-full`}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {showLabels && (
              <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
            )}
          </button>
          <button
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full text-destructive hover:bg-destructive/10 transition-colors`}
          >
            <LogOut className="h-4 w-4" />
            {showLabels && <span>Sair</span>}
          </button>
          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`${linkClass(false)} w-full`}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span>Recolher</span>
                </>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {isMobile && (
          <div className="h-12 flex items-center px-3 border-b border-border bg-background sticky top-0 z-30">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 p-4 md:p-8 overflow-x-hidden">{renderContent()}</div>
      </main>
    </div>
  );
};

export default Workspace;
