import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/use-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { useClientPermissions } from "@/hooks/use-client-permissions";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import aikortexLogoWhite from "@/assets/aikortex-logo-white.png";
import aikortexLogoBlack from "@/assets/aikortex-logo-black.png";
import {
  LayoutDashboard, Users, CheckSquare, DollarSign, FileText, Settings,
  LogOut, Sun, Moon, ChevronLeft, ChevronRight, Menu, X, Contact, Sparkles,
} from "lucide-react";
import { RightPanelProvider } from "@/components/RightPanel";

type NavItem = { label: string; icon: typeof LayoutDashboard; path: string };

const clientNavItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/workspace" },
  { label: "CRM", icon: Contact, path: "/workspace/crm" },
  { label: "Projetos", icon: Users, path: "/workspace/projects" },
  { label: "Tarefas", icon: CheckSquare, path: "/workspace/tasks" },
  { label: "Financeiro", icon: DollarSign, path: "/workspace/financial" },
  { label: "Contratos", icon: FileText, path: "/workspace/contracts" },
  { label: "Configurações", icon: Settings, path: "/workspace/settings" },
];

const CLIENT_MODULE_KEYS: Record<string, string> = {
  "/workspace/crm": "gestao.crm",
  "/workspace/projects": "gestao.projetos",
  "/workspace/tasks": "gestao.tarefas",
  "/workspace/financial": "gestao.financeiro",
  "/workspace/contracts": "gestao.contratos",
};

// ---------- Section components (self-contained, client-scoped) ----------

const SectionShell = ({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) => (
  <div className="p-6 lg:p-8 max-w-[1400px] space-y-5">
    <div>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
    {children}
  </div>
);

const ComingSoon = ({ name }: { name: string }) => (
  <div className="rounded-lg border border-dashed border-border bg-card/50 p-10 flex flex-col items-center justify-center text-center">
    <Sparkles className="w-8 h-8 text-muted-foreground mb-3" />
    <p className="text-sm font-medium text-foreground">Em breve</p>
    <p className="text-xs text-muted-foreground mt-1">Em breve: gestão de {name} do cliente.</p>
  </div>
);

const WorkspaceHome = () => (
  <div className="p-6 space-y-4">
    <h1 className="text-2xl font-bold">Bem-vindo ao seu workspace</h1>
    <p className="text-muted-foreground">Use o menu lateral para navegar entre os módulos disponíveis.</p>
  </div>
);

const WorkspaceTasks = () => (
  <SectionShell title="Tarefas" description="Suas tarefas e atividades.">
    <ComingSoon name="tarefas" />
  </SectionShell>
);

const WorkspaceCRM = () => (
  <SectionShell title="CRM" description="Acompanhe seus leads e oportunidades.">
    <ComingSoon name="CRM" />
  </SectionShell>
);

const WorkspaceFinancial = () => (
  <SectionShell title="Financeiro" description="Faturas, cobranças e pagamentos.">
    <ComingSoon name="financeiro" />
  </SectionShell>
);

const WorkspaceContracts = () => (
  <SectionShell title="Contratos" description="Seus contratos ativos e histórico.">
    <ComingSoon name="contratos" />
  </SectionShell>
);

const WorkspaceProjects = () => (
  <SectionShell title="Projetos" description="Acompanhe o andamento dos seus projetos.">
    <ComingSoon name="projetos" />
  </SectionShell>
);

const WorkspaceSettings = () => (
  <SectionShell title="Configurações" description="Preferências do seu workspace.">
    <ComingSoon name="configurações" />
  </SectionShell>
);

const Workspace = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { profile, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { canView } = useClientPermissions();
  const { activeWorkspace } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const linkClasses = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      active ? "bg-primary/10 text-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
    }`;

  useEffect(() => { if (isMobile) setMobileSidebarOpen(false); }, [location.pathname]);

  const renderContent = () => {
    const path = location.pathname;
    if (path === "/workspace/tasks") return <WorkspaceTasks />;
    if (path === "/workspace/crm") return <WorkspaceCRM />;
    if (path === "/workspace/financial") return <WorkspaceFinancial />;
    if (path === "/workspace/contracts") return <WorkspaceContracts />;
    if (path === "/workspace/projects") return <WorkspaceProjects />;
    if (path === "/workspace/settings") return <WorkspaceSettings />;
    return <WorkspaceHome />;
  };

  return (
    <RightPanelProvider>
      <div className="flex min-h-screen w-full overflow-hidden">
        {isMobile && mobileSidebarOpen && (
          <button className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
        )}

        <aside className={`flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ${
          isMobile
            ? `fixed inset-y-0 left-0 z-40 w-64 ${mobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`
            : collapsed ? "w-16" : "w-56"
        }`}>
          <div className="flex h-14 items-center border-b border-sidebar-border px-4 justify-between">
            {(!collapsed || isMobile) && (
              <img src={theme === "dark" ? aikortexLogoWhite : aikortexLogoBlack} alt="Aikortex" className="h-7 w-auto" />
            )}
            {isMobile && (
              <button onClick={() => setMobileSidebarOpen(false)} className="p-2 text-sidebar-foreground"><X className="h-4 w-4" /></button>
            )}
          </div>

          {(!collapsed || isMobile) && (
            <div className="px-4 py-3 border-b border-sidebar-border">
              <p className="text-xs text-muted-foreground">Olá, {activeWorkspace?.name ?? profile?.full_name?.split(" ")[0] ?? "Cliente"}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">Workspace do cliente</p>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {clientNavItems
              .filter(item => {
                const key = CLIENT_MODULE_KEYS[item.path];
                return !key || canView(key);
              })
              .map(item => (
                <Link key={item.path} to={item.path} className={linkClasses(isActive(item.path))}>
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
            <button onClick={async () => { await signOut(); navigate("/"); }} className={`${linkClasses(false)} w-full`}>
              <LogOut className="w-4 h-4 shrink-0 text-destructive" />
              {(!collapsed || isMobile) && <span className="text-destructive">Sair</span>}
            </button>
            {!isMobile && (
              <button onClick={() => setCollapsed(!collapsed)} className={`${linkClasses(false)} w-full`}>
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Recolher</span></>}
              </button>
            )}
          </div>
        </aside>

        <main className="relative flex-1 min-w-0 overflow-y-auto bg-background">
          {isMobile && (
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="absolute top-3 left-3 z-30 p-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          {renderContent()}
        </main>
      </div>
    </RightPanelProvider>
  );
};

export default Workspace;
