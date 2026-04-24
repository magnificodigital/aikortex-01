import { useState, useRef, useEffect, createContext, useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/use-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import aikortexLogoWhite from "@/assets/aikortex-logo-white.png";
import aikortexLogoBlack from "@/assets/aikortex-logo-black.png";
import {
  LayoutDashboard, MessageSquare, Users, TrendingUp, DollarSign,
  CheckSquare, Settings, LogOut, Sun, Moon, ChevronLeft, ChevronRight,
  Menu, X, Home, ChevronDown, ChevronUp, Send, Bot, Loader2,
} from "lucide-react";

// WorkspaceOwnerContext for useWorkspaceOwner hook
type WorkspaceOwnerContextValue = {
  ownerId: string;
  clientName: string;
  isReadOnly: boolean;
};
const WorkspaceOwnerContext = createContext<WorkspaceOwnerContextValue>({
  ownerId: "",
  clientName: "",
  isReadOnly: false,
});
export const useWorkspaceOwner = () => useContext(WorkspaceOwnerContext);

type Msg = { role: "user" | "assistant"; text: string };

const HomeSection = ({ name, user }: { name: string; user: any }) => {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: `Olá ${name}! Sou seu assistente. Como posso ajudar hoje?` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: { message: text, context: "client_workspace" },
      });
      const reply = data?.response || data?.message || "Desculpe, não consegui processar sua mensagem.";
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Erro ao conectar com o assistente." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {name} 👋</h1>
          <p className="text-muted-foreground">Bem-vindo ao seu workspace.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Clientes", icon: Users, color: "text-blue-500", path: "/workspace/clientes" },
          { label: "Vendas", icon: TrendingUp, color: "text-green-500", path: "/workspace/vendas" },
          { label: "Tarefas", icon: CheckSquare, color: "text-amber-500", path: "/workspace/tarefas" },
          { label: "Mensagens", icon: MessageSquare, color: "text-purple-500", path: "/workspace/mensagens" },
        ].map(item => (
          <Link key={item.label} to={item.path}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <item.icon className={`w-8 h-8 ${item.color}`} />
                  <div className="text-lg font-medium">{item.label}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Atividade Recente</h3>
          <p className="text-muted-foreground text-sm">Nenhuma atividade recente.</p>
        </CardContent>
      </Card>
    </div>
  );
};

const MensagensSection = () => {
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
        <p className="text-muted-foreground">Central de comunicação com seus clientes</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="h-96 flex flex-col items-center justify-center text-center text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhuma conversa ainda.</p>
            <p className="text-sm">Suas mensagens com clientes aparecerão aqui.</p>
          </div>
          <div className="flex gap-2 mt-4">
            <Input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Digite uma mensagem..." className="flex-1" />
            <Button size="icon"><Send className="w-4 h-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SimpleSection = ({ title, sub, icon: Icon, cta }: { title: string; sub: string; icon: typeof Users; cta?: string }) => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{sub}</p>
    </div>
    <Card>
      <CardContent className="p-6 text-center text-muted-foreground">
        <Icon className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhum registro ainda.</p>
        {cta && <Button className="mt-4">{cta}</Button>}
      </CardContent>
    </Card>
  </div>
);

const FinanceiroSection = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
    <div className="grid gap-4 md:grid-cols-3">
      {[
        { label: "Receitas", value: "R$ 0", color: "text-green-600" },
        { label: "Despesas", value: "R$ 0", color: "text-destructive" },
        { label: "Saldo", value: "R$ 0", color: "text-foreground" },
      ].map(item => (
        <Card key={item.label}>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
    <Card>
      <CardContent className="p-6 text-center text-muted-foreground">
        <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhuma transação registrada.</p>
      </CardContent>
    </Card>
  </div>
);

const Workspace = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { profile, user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [gestaoOpen, setGestaoOpen] = useState(true);

  const displayName = profile?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Cliente";
  const displayEmail = user?.email ?? "";

  useEffect(() => { if (isMobile) setMobileSidebarOpen(false); }, [location.pathname]);

  const path = location.pathname;
  const isActive = (p: string) => p === "/workspace" ? path === "/workspace" : path === p;

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      active ? "bg-sidebar-accent text-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
    }`;

  const NavLink = ({ to, icon: Icon, label }: { to: string; icon: typeof Home; label: string }) => (
    <Link to={to} className={linkClass(isActive(to))}>
      <Icon className="w-5 h-5" />
      {(!collapsed || isMobile) && <span>{label}</span>}
    </Link>
  );

  const renderContent = () => {
    if (path === "/workspace" || path === "/workspace/") return <HomeSection name={displayName} user={user} />;
    if (path === "/workspace/dashboard") return <HomeSection name={displayName} user={user} />;
    if (path === "/workspace/mensagens") return <MensagensSection />;
    if (path === "/workspace/clientes") return (
      <SimpleSection title="Clientes" sub="Gerencie seus clientes" icon={Users} cta="Adicionar cliente" />
    );
    if (path === "/workspace/vendas") return (
      <SimpleSection title="Vendas" sub="Acompanhe suas vendas" icon={TrendingUp} cta="Nova venda" />
    );
    if (path === "/workspace/financeiro") return <FinanceiroSection />;
    if (path === "/workspace/tarefas") return (
      <SimpleSection title="Tarefas" sub="Organize suas tarefas" icon={CheckSquare} cta="Nova tarefa" />
    );
    if (path === "/workspace/configuracoes") return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-medium">Dados da conta</h3>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Email: {displayEmail}</p>
              <p className="text-sm text-muted-foreground">Tipo: Cliente</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
    return <div className="p-8 text-center text-muted-foreground">Seção não encontrada.</div>;
  };

  return (
    <div className="flex h-screen bg-background">
      {isMobile && mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <aside className={`${collapsed && !isMobile ? "w-16" : "w-64"} ${isMobile ? (mobileSidebarOpen ? "translate-x-0" : "-translate-x-full") : ""} bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 fixed md:relative h-full z-50`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {(!collapsed || isMobile) && (
            <img src={theme === "dark" ? aikortexLogoWhite : aikortexLogoBlack} alt="Aikortex" className="h-8" />
          )}
          {isMobile && <button onClick={() => setMobileSidebarOpen(false)} className="p-1"><X className="w-5 h-5" /></button>}
        </div>

        <div className="p-3 border-b border-sidebar-border">
          {(!collapsed || isMobile) && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              <p className="text-xs font-medium text-sidebar-foreground truncate">Workspace do cliente</p>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 p-3">
          <div className="space-y-1">
            <NavLink to="/workspace" icon={Home} label="Início" />
            <NavLink to="/workspace/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavLink to="/workspace/mensagens" icon={MessageSquare} label="Mensagens" />
          </div>

          <div className="mt-6 mb-2">
            {(!collapsed || isMobile)
              ? <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ferramentas</p>
              : <div className="mx-auto w-4 h-px bg-sidebar-border" />}
          </div>

          <div className="space-y-1">
            {(!collapsed || isMobile)
              ? <button onClick={() => setGestaoOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-md">
                <span className="flex items-center gap-3"><LayoutDashboard className="w-5 h-5" />Gestão</span>
                {gestaoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              : <div className="px-3 py-2"><LayoutDashboard className="w-5 h-5 text-sidebar-foreground" /></div>}

            {(gestaoOpen || collapsed || isMobile) && <>
              <NavLink to="/workspace/clientes" icon={Users} label="Clientes" />
              <NavLink to="/workspace/vendas" icon={TrendingUp} label="Vendas" />
              <NavLink to="/workspace/financeiro" icon={DollarSign} label="Financeiro" />
              <NavLink to="/workspace/tarefas" icon={CheckSquare} label="Tarefas" />
            </>}
          </div>

          <div className="mt-6 mb-2">
            {(!collapsed || isMobile)
              ? <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conta</p>
              : <div className="mx-auto w-4 h-px bg-sidebar-border" />}
          </div>
          <NavLink to="/workspace/configuracoes" icon={Settings} label="Configurações" />
        </ScrollArea>

        <div className="p-3 border-t border-sidebar-border space-y-1">
          <button onClick={toggle} className={linkClass(false)}>
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {(!collapsed || isMobile) && <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>}
          </button>
          <button onClick={async () => { await signOut(); navigate("/"); }} className={`${linkClass(false)} w-full`}>
            <LogOut className="w-5 h-5" />
            {(!collapsed || isMobile) && <span>Sair</span>}
          </button>
          {!isMobile && (
            <button onClick={() => setCollapsed(!collapsed)} className={`${linkClass(false)} w-full`}>
              {collapsed ? <ChevronRight className="w-5 h-5" /> : <><ChevronLeft className="w-5 h-5" /> <span>Recolher</span></>}
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {isMobile && (
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setMobileSidebarOpen(true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-medium">Menu</span>
          </div>
        )}
        <div className="max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Workspace;