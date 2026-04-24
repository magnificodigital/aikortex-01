import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  MessageSquare,
  Users,
  ShoppingCart,
  DollarSign,
  CheckSquare,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import aikortexLogoWhite from "@/assets/aikortex-logo-white.png";
import aikortexLogoBlack from "@/assets/aikortex-logo-black.png";
import aikortexIconWhite from "@/assets/aikortex-icon-white.png";
import aikortexIconBlack from "@/assets/aikortex-icon-black.png";

type NavItem = { label: string; icon: typeof Home; path: string };

const getFerramentasItems = (basePath: string): NavItem[] => [
  { label: "Mensagens", icon: MessageSquare, path: `${basePath}/mensagens` },
];

const getGestaoItems = (basePath: string): NavItem[] => [
  { label: "Clientes", icon: Users, path: `${basePath}/clientes` },
  { label: "Vendas", icon: ShoppingCart, path: `${basePath}/vendas` },
  { label: "Financeiro", icon: DollarSign, path: `${basePath}/financeiro` },
  { label: "Tarefas", icon: CheckSquare, path: `${basePath}/tarefas` },
];

type Props = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  readOnly?: boolean;
  overrideName?: string;
  basePath?: string;
};

const ClientSidebar = ({ mobileOpen = false, onMobileClose, readOnly = false, overrideName, basePath = "/workspace" }: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { user, profile, signOut } = useAuth();
  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(false);
  const [ferramentasOpen, setFerramentasOpen] = useState(true);
  const [gestaoOpen, setGestaoOpen] = useState(true);
  const [contaOpen, setContaOpen] = useState(true);
  const [displayName, setDisplayName] = useState<string>(
    overrideName ?? profile?.full_name ?? "Meu Workspace"
  );
  const [agencyBranding, setAgencyBranding] = useState<{
    logoUrl: string | null;
    agencyName: string | null;
    tier: string;
  } | null>(null);

  // Load client_name from agency_clients for this user
  useEffect(() => {
    if (overrideName) {
      setDisplayName(overrideName);
      return;
    }
    if (!user?.id) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("agency_clients")
        .select("client_name")
        .eq("client_user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (data?.client_name) {
        setDisplayName(data.client_name);
      } else if (profile?.full_name) {
        setDisplayName(profile.full_name);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id, profile?.full_name, overrideName]);

  // Fetch agency branding when client is in their own workspace (owner mode)
  useEffect(() => {
    if (readOnly) return; // agency viewing — don't apply client branding
    if (!user?.id) return;

    let active = true;

    (async () => {
      // 1. Get agency_id from client's profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active || !profileData?.agency_id) return;

      // 2. Fetch agency branding
      const { data: agency } = await supabase
        .from("agency_profiles")
        .select("logo_url, agency_name, tier")
        .eq("id", profileData.agency_id)
        .maybeSingle();

      if (!active || !agency) return;

      setAgencyBranding({
        logoUrl: agency.logo_url,
        agencyName: agency.agency_name,
        tier: agency.tier,
      });
    })();

    return () => { active = false; };
  }, [user?.id, readOnly]);

  useEffect(() => {
    if (isMobile) onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const isActive = (path: string) =>
    location.pathname === path ||
    (path === basePath && location.pathname === basePath);

  const linkClasses = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors overflow-hidden ${
      active
        ? "bg-sidebar-accent text-primary font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
    }`;

  const renderItem = (item: NavItem) => {
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => isMobile && onMobileClose?.()}
        className={linkClasses(active)}
        title={collapsed && !isMobile ? item.label : undefined}
      >
        <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-primary" : ""}`} />
        {(!collapsed || isMobile) && <span className="flex-1 truncate">{item.label}</span>}
      </Link>
    );
  };

  const renderGroup = (
    label: string,
    items: NavItem[],
    open: boolean,
    setOpen: (v: boolean) => void,
  ) => (
    <div>
      {!collapsed || isMobile ? (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full px-3 py-2 mt-4 text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>{label}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
      ) : (
        <div className="border-t border-sidebar-border my-2" />
      )}
      {(open || collapsed || isMobile) && (
        <div className="space-y-0.5">{items.map(renderItem)}</div>
      )}
    </div>
  );

  return (
    <>
      {isMobile && mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ${
          isMobile
            ? `fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] ${
                mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
              }`
            : collapsed
              ? "w-16"
              : "w-56"
        }`}
      >
        <div className={`flex h-14 items-center border-b border-sidebar-border px-4 ${isMobile ? "justify-between" : "justify-center"}`}>
          <img
            src={
              collapsed && !isMobile
                ? theme === "dark" ? aikortexIconWhite : aikortexIconBlack
                : theme === "dark" ? aikortexLogoWhite : aikortexLogoBlack
            }
            alt="Aikortex"
            className={collapsed && !isMobile ? "h-7 w-7 object-contain" : "h-7 w-auto object-contain"}
          />
          {isMobile && (
            <button
              type="button"
              onClick={onMobileClose}
              className="rounded-md p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar menu</span>
            </button>
          )}
        </div>

        {(!collapsed || isMobile) && (
          <div className="px-3 pt-3 pb-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Workspace
            </div>
            <div className="truncate text-sm font-medium text-sidebar-foreground" title={displayName}>
              {displayName}
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-thin">
          <div className="mt-2 space-y-0.5">
            <Link
              to={basePath}
              onClick={() => isMobile && onMobileClose?.()}
              className={linkClasses(location.pathname === basePath)}
              title={collapsed && !isMobile ? "Home" : undefined}
            >
              <Home className={`w-4 h-4 shrink-0 ${location.pathname === basePath ? "text-primary" : ""}`} />
              {(!collapsed || isMobile) && <span>Home</span>}
            </Link>
          </div>

          {renderGroup("Ferramentas", getFerramentasItems(basePath), ferramentasOpen, setFerramentasOpen)}
          {renderGroup("Gestão", getGestaoItems(basePath), gestaoOpen, setGestaoOpen)}

          <div>
            {!collapsed || isMobile ? (
              <button
                onClick={() => setContaOpen(!contaOpen)}
                className="flex items-center justify-between w-full px-3 py-2 mt-4 text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>Conta</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${contaOpen ? "" : "-rotate-90"}`} />
              </button>
            ) : (
              <div className="border-t border-sidebar-border my-2" />
            )}
            {(contaOpen || collapsed || isMobile) && (
              <div className="space-y-0.5">
                <Link
                  to={`${basePath}/configuracoes`}
                  onClick={() => isMobile && onMobileClose?.()}
                  className={linkClasses(location.pathname === `${basePath}/configuracoes`)}
                  title={collapsed && !isMobile ? "Configurações" : undefined}
                >
                  <Settings className={`w-4 h-4 shrink-0 ${location.pathname === `${basePath}/configuracoes` ? "text-primary" : ""}`} />
                  {(!collapsed || isMobile) && <span className="truncate">Configurações</span>}
                </Link>
              </div>
            )}
          </div>
        </nav>

        <div className="space-y-0.5 border-t border-sidebar-border px-2 py-2">
          <button
            onClick={toggle}
            className={`${linkClasses(false)} w-full`}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {(!collapsed || isMobile) && (
              <span className="truncate">{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
            )}
          </button>
          {readOnly ? (
            <button
              onClick={() => navigate("/home")}
              className={`${linkClasses(false)} w-full`}
              title={collapsed && !isMobile ? "Voltar ao workspace" : undefined}
            >
              <ChevronLeft className="w-4 h-4 shrink-0 text-primary" />
              {(!collapsed || isMobile) && (
                <span className="truncate text-primary">Voltar ao meu workspace</span>
              )}
            </button>
          ) : (
            <button
              onClick={async () => { await signOut(); navigate("/"); }}
              className={`${linkClasses(false)} w-full`}
              title={collapsed && !isMobile ? "Sair" : undefined}
            >
              <LogOut className="w-4 h-4 shrink-0 text-destructive" />
              {(!collapsed || isMobile) && (
                <span className="truncate text-destructive">Sair</span>
              )}
            </button>
          )}
          {isMobile ? (
            <button type="button" onClick={onMobileClose} className={`${linkClasses(false)} w-full`}>
              <X className="w-4 h-4 shrink-0" />
              <span>Fechar menu</span>
            </button>
          ) : (
            <button onClick={() => setCollapsed(!collapsed)} className={`${linkClasses(false)} w-full`}>
              {collapsed ? (
                <ChevronRight className="w-4 h-4 shrink-0" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 shrink-0" />
                  <span>Recolher</span>
                </>
              )}
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default ClientSidebar;