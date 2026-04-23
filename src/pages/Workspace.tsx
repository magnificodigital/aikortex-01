import { lazy, Suspense, useState, useRef, useEffect } from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useClientPermissions } from "@/hooks/use-client-permissions";
import { useTheme } from "@/hooks/use-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import aikortexLogoWhite from "@/assets/aikortex-logo-white.png";
import aikortexLogoBlack from "@/assets/aikortex-logo-black.png";
import {
  Home, LayoutDashboard, Users, Contact, MessageSquare,
  CheckSquare, DollarSign, Settings, LogOut, Sun, Moon,
  ChevronLeft, ChevronRight, Menu, X, Send, Bot, Loader2, ArrowUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RightPanelProvider } from "@/components/RightPanel";

// Reuse agency pages (DashboardLayout is transparent for clients)
const DashboardIndex = lazy(() => import("./Index"));
const Clients = lazy(() => import("./Clients"));
const AikortexCRM = lazy(() => import("./AikortexCRM"));
const AikortexMessages = lazy(() => import("./AikortexMessages"));
const Tasks = lazy(() => import("./Tasks"));
const Financial = lazy(() => import("./Financial"));
const SettingsPage = lazy(() => import("./SettingsPage"));

type NavItem = { label: string; icon: typeof Home; path: string; key: string | null };

const navItems: NavItem[] = [
  { label: "Home", icon: Home, path: "/workspace", key: null },
  { label: "Dashboard", icon: LayoutDashboard, path: "/workspace/dashboard", key: null },
  { label: "Clientes", icon: Users, path: "/workspace/clients", key: "gestao.clientes" },
  { label: "CRM", icon: Contact, path: "/workspace/crm", key: "gestao.crm" },
  { label: "Mensagens", icon: MessageSquare, path: "/workspace/messages", key: "aikortex.mensagens" },
  { label: "Tarefas", icon: CheckSquare, path: "/workspace/tasks", key: "gestao.tarefas" },
  { label: "Financeiro", icon: DollarSign, path: "/workspace/financial", key: "gestao.financeiro" },
  { label: "Configurações", icon: Settings, path: "/workspace/settings", key: null },
];

// ---------- AI Chat Home ----------
type ChatMsg = { role: "user" | "assistant"; text: string };

const WorkspaceHome = () => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: `Olá${profile?.full_name ? ", " + profile.full_name.split(" ")[0] : ""}! Sou seu assistente. Posso te ajudar a buscar informações sobre clientes, tarefas, financeiro, vendas e contratos. Como posso ajudar?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workspace-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ message: text }),
        }
      );
      const data = await res.json().catch(() => ({}));
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data?.reply ?? "Não consegui processar sua solicitação." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Erro ao conectar com o assistente. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-screen p-4 lg:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" /> Assistente IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pergunte sobre clientes, tarefas, financeiro, vendas ou contratos.
        </p>
      </div>

      <ScrollArea className="flex-1 rounded-lg border border-border bg-card/50 p-4">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
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
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex gap-2 mt-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Digite sua pergunta..."
          disabled={loading}
          className="flex-1"
        />
        <Button onClick={send} disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

// ---------- Main Workspace ----------
const Workspace = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { canView } = useClientPermissions();
  const { theme, toggle } = useTheme();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isActive = (path: string) =>
    path === "/workspace"
      ? location.pathname === "/workspace"
      : location.pathname.startsWith(path);

  const linkClasses = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
    }`;

  const visibleItems = navItems.filter((item) => !item.key || canView(item.key));

  return (
    <RightPanelProvider>
      <div className="flex min-h-screen w-full overflow-hidden">
        {isMobile && mobileSidebarOpen && (
          <button
            className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Fechar menu"
          />
        )}

        <aside
          className={`flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ${
            isMobile
              ? `fixed inset-y-0 left-0 z-40 w-64 ${
                  mobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
                }`
              : collapsed
              ? "w-16"
              : "w-56"
          }`}
        >
          <div className="flex h-14 items-center border-b border-sidebar-border px-4 justify-between">
            {(!collapsed || isMobile) && (
              <img
                src={theme === "dark" ? aikortexLogoWhite : aikortexLogoBlack}
                alt="Aikortex"
                className="h-7 w-auto"
              />
            )}
            {isMobile && (
              <button onClick={() => setMobileSidebarOpen(false)} className="p-2 text-sidebar-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {(!collapsed || isMobile) && (
            <div className="px-4 py-3 border-b border-sidebar-border">
              <p className="text-xs text-muted-foreground truncate">{profile?.full_name ?? "Cliente"}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">Workspace do cliente</p>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {visibleItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => isMobile && setMobileSidebarOpen(false)}
                className={`${linkClasses(isActive(item.path))} overflow-hidden`}
                title={collapsed && !isMobile ? item.label : undefined}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${isActive(item.path) ? "text-primary" : ""}`} />
                {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
              </Link>
            ))}
          </nav>

          <div className="space-y-0.5 border-t border-sidebar-border px-2 py-2">
            <button onClick={toggle} className={`${linkClasses(false)} w-full`}>
              {theme === "dark" ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
              {(!collapsed || isMobile) && <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>}
            </button>
            <button
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
              className={`${linkClasses(false)} w-full`}
            >
              <LogOut className="w-4 h-4 shrink-0 text-destructive" />
              {(!collapsed || isMobile) && <span className="text-destructive">Sair</span>}
            </button>
            {!isMobile && (
              <button onClick={() => setCollapsed(!collapsed)} className={`${linkClasses(false)} w-full`}>
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

        <main className="relative flex-1 min-w-0 overflow-y-auto bg-background">
          {isMobile && (
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="absolute top-3 left-3 z-30 p-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <Suspense fallback={<div className="p-6 text-muted-foreground">Carregando...</div>}>
            <Routes>
              <Route index element={<WorkspaceHome />} />
              <Route path="dashboard/*" element={<DashboardIndex />} />
              <Route path="clients/*" element={<Clients />} />
              <Route path="crm/*" element={<AikortexCRM />} />
              <Route path="messages/*" element={<AikortexMessages />} />
              <Route path="tasks/*" element={<Tasks />} />
              <Route path="financial/*" element={<Financial />} />
              <Route path="settings/*" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </RightPanelProvider>
  );
};

export default Workspace;
