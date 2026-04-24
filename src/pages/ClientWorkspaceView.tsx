import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTheme } from "@/hooks/use-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import aikortexLogoWhite from "@/assets/aikortex-logo-white.png";
import aikortexLogoBlack from "@/assets/aikortex-logo-black.png";
import {
  Home,
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
  ChevronDown,
  ChevronUp,
  Activity,
  Send,
} from "lucide-react";

const ClientWorkspaceView = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  const { agencyName, clients, switchToAgency } = useWorkspace();
  const isMobile = useIsMobile();

  const [clientName, setClientName] = useState("Cliente");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [gestaoOpen, setGestaoOpen] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!clientId) return;
    const found = clients.find((c) => c.id === clientId);
    if (found) {
      setClientName(found.client_name);
      return;
    }
    supabase
      .from("agency_clients")
      .select("client_name")
      .eq("id", clientId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setClientName(data.client_name);
      });
  }, [clientId, clients]);

  useEffect(() => {
    if (isMobile) setMobileSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const base = `/clients/${clientId}/workspace`;
  const sub = location.pathname.replace(base, "") || "/";

  const isActive = (path: string) =>
    path === base ? location.pathname === base : location.pathname === path;

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
      active
        ? "bg-sidebar-accent text-primary font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
    }`;

  const NavLink = ({
    to,
    icon: Icon,
    label,
  }: {
    to: string;
    icon: typeof Home;
    label: string;
  }) => (
    <Link to={to} className={linkClass(isActive(to))}>
      <Icon className="w-4 h-4 shrink-0" />
      {(!collapsed || isMobile) && <span>{label}</span>}
    </Link>
  );

  const StatCard = ({
    label,
    value,
    icon: Icon,
    color,
  }: {
    label: string;
    value: string;
    icon: typeof Home;
    color: string;
  }) => (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`w-8 h-8 ${color}`} />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  const EmptySection = ({
    title,
    icon: Icon,
    cta,
  }: {
    title: string;
    icon: typeof Home;
    cta?: string;
  }) => (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <Card>
        <CardContent className="p-10 flex flex-col items-center justify-center gap-3 text-center">
          <Icon className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
          {cta && <Button>{cta}</Button>}
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    if (sub === "/" || sub === "")
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Workspace — {clientName}
            </h1>
            <p className="text-sm text-muted-foreground">Visão geral da subconta.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Clientes" value="—" icon={Users} color="text-blue-500" />
            <StatCard label="Vendas no mês" value="—" icon={TrendingUp} color="text-green-500" />
            <StatCard label="Tarefas pendentes" value="—" icon={CheckSquare} color="text-amber-500" />
            <StatCard label="Mensagens" value="0 / 500" icon={MessageSquare} color="text-purple-500" />
          </div>
          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center gap-2 text-center">
              <Activity className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
            </CardContent>
          </Card>
        </div>
      );

    if (sub === "/dashboard")
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-foreground">
            Dashboard — {clientName}
          </h1>
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Dados aparecerão aqui.
            </CardContent>
          </Card>
        </div>
      );

    if (sub === "/mensagens")
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-foreground">Mensagens</h1>
          <Card>
            <CardContent className="p-0 flex flex-col h-[60vh]">
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
                </div>
              </div>
              <div className="border-t border-border p-3 flex gap-2">
                <Input
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  className="flex-1"
                />
                <Button>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );

    if (sub === "/financeiro")
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-foreground">Financeiro</h1>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { l: "Receitas", v: "R$ 0", c: "text-green-600" },
              { l: "Despesas", v: "R$ 0", c: "text-destructive" },
              { l: "Saldo", v: "R$ 0", c: "text-foreground" },
            ].map((i) => (
              <Card key={i.l}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{i.l}</p>
                  <p className={`text-xl font-semibold ${i.c}`}>{i.v}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );

    if (sub === "/clientes")
      return <EmptySection title="Clientes" icon={Users} cta="Novo cliente" />;
    if (sub === "/vendas")
      return <EmptySection title="Vendas" icon={TrendingUp} cta="Nova venda" />;
    if (sub === "/tarefas")
      return <EmptySection title="Tarefas" icon={CheckSquare} cta="Nova tarefa" />;

    return <p className="text-sm text-muted-foreground">Seção não encontrada.</p>;
  };

  const sidebarWidth = collapsed && !isMobile ? "w-16" : "w-64";
  const sidebarVisible = !isMobile || mobileSidebarOpen;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {isMobile && mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`${sidebarWidth} ${
          isMobile
            ? `fixed inset-y-0 left-0 z-50 transition-transform ${
                mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`
            : "relative"
        } bg-sidebar border-r border-sidebar-border flex flex-col`}
      >
        <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border shrink-0">
          {(!collapsed || isMobile) && (
            <img
              src={theme === "dark" ? aikortexLogoWhite : aikortexLogoBlack}
              alt="Aikortex"
              className="h-7"
            />
          )}
          {isMobile && (
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="p-1 text-sidebar-foreground"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {(!collapsed || isMobile) && (
          <div className="p-3 border-b border-sidebar-border">
            <Select
              value={clientId}
              onValueChange={(val) => {
                if (val === "__agency__") {
                  switchToAgency();
                  navigate("/home");
                } else {
                  navigate(`/clients/${val}/workspace`);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar workspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__agency__">{agencyName}</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          <NavLink to={base} icon={Home} label="Início" />
          <NavLink to={`${base}/dashboard`} icon={LayoutDashboard} label="Dashboard" />

          {(!collapsed || isMobile) ? (
            <p className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Ferramentas
            </p>
          ) : (
            <div className="my-2 border-t border-sidebar-border" />
          )}

          <NavLink to={`${base}/mensagens`} icon={MessageSquare} label="Mensagens" />

          {(!collapsed || isMobile) ? (
            <button
              onClick={() => setGestaoOpen((o) => !o)}
              className={`${linkClass(false)} w-full justify-between`}
            >
              <span>Gestão</span>
              {gestaoOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="my-2 border-t border-sidebar-border" />
          )}

          {(gestaoOpen || collapsed || isMobile) && (
            <>
              <NavLink to={`${base}/clientes`} icon={Users} label="Clientes" />
              <NavLink to={`${base}/vendas`} icon={TrendingUp} label="Vendas" />
              <NavLink to={`${base}/financeiro`} icon={DollarSign} label="Financeiro" />
              <NavLink to={`${base}/tarefas`} icon={CheckSquare} label="Tarefas" />
            </>
          )}

          {(!collapsed || isMobile) ? (
            <p className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Conta
            </p>
          ) : (
            <div className="my-2 border-t border-sidebar-border" />
          )}

          <NavLink to={`${base}/settings`} icon={Settings} label="Configurações" />
        </nav>

        <div className="p-2 border-t border-sidebar-border space-y-1">
          <button onClick={toggle} className={`${linkClass(false)} w-full`}>
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
            {(!collapsed || isMobile) && (
              <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
            )}
          </button>
          <button
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
            className={`${linkClass(false)} w-full`}
          >
            <LogOut className="w-4 h-4" />
            {(!collapsed || isMobile) && <span>Sair</span>}
          </button>
          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`${linkClass(false)} w-full`}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span>Recolher</span>
                </>
              )}
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {isMobile && (
          <div className="h-14 flex items-center px-3 border-b border-border bg-background sticky top-0 z-30">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-6">{renderContent()}</div>
      </main>
    </div>
  );
};

export default ClientWorkspaceView;