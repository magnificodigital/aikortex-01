import { lazy, Suspense, useState, useRef, useEffect } from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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
import { WorkspaceClients } from "@/components/workspace/WorkspaceClients";

// Reuse agency pages (DashboardLayout is transparent for clients)
const DashboardIndex = lazy(() => import("./Index"));
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

const WorkspaceHome = () => {
  const { user } = useAuth();
  const [clientName, setClientName] = useState("Cliente");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Olá! Sou seu assistente de IA. Posso te ajudar a buscar informações sobre seus clientes, tarefas, financeiro, vendas e contratos. Como posso ajudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.full_name) setClientName(data.full_name.split(" ")[0]);
      });
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

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
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ message: text }),
        }
      );
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply ?? "Não consegui processar sua solicitação." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Erro ao conectar com o assistente. Tente novamente em instantes." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-6">
      {/* Greeting — same style as agency Home */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
          {getGreeting()}, {clientName}
        </h1>
        <p className="text-muted-foreground text-lg">
          Pergunte ao assistente sobre clientes, tarefas, financeiro, vendas ou contratos do seu sistema.
        </p>
      </div>

      {/* Chat card — same dimensions and style as the creation box */}
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Chat header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <span className="font-medium text-foreground">Assistente IA</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Online
          </div>
        </div>

        {/* Messages area */}
        <ScrollArea className="h-[320px] px-6 py-4">
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
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
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Textarea — no border, full width, same as agency */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Pergunte sobre seus clientes, tarefas, financeiro, vendas ou contratos..."
          className="w-full bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/50 px-5 py-3 min-h-[72px]"
          disabled={loading}
        />

        {/* Bottom action bar — matches agency style */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Bot className="w-3.5 h-3.5" />
            <span>Assistente com acesso aos seus dados</span>
          </div>
          <Button
            size="sm"
            className="h-9 px-5 rounded-full bg-primary hover:bg-primary/90 gap-1.5"
            disabled={!input.trim() || loading}
            onClick={send}
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Quick question suggestions */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {[
          "Quantos clientes ativos tenho?",
          "Quais tarefas estão atrasadas?",
          "Resumo financeiro do mês",
          "Propostas abertas no CRM",
        ].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => { setInput(suggestion); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
          >
            <Bot className="w-4 h-4" />
            {suggestion}
          </button>
        ))}
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
              <Route path="clients" element={<WorkspaceClients />} />
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
