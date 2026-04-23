import { lazy, Suspense, Component, useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { Routes, Route } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import { RightPanelProvider } from "@/components/RightPanel";
import { Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { WorkspaceHomeChat } from "@/components/workspace/WorkspaceHomeChat";
import { WorkspaceClients } from "@/components/workspace/WorkspaceClients";

// Context so inner pages can get the workspace owner_id
type WorkspaceOwnerContextValue = {
  ownerId: string;
  clientName: string;
  isReadOnly: boolean;
};
export const WorkspaceOwnerContext = createContext<WorkspaceOwnerContextValue>({
  ownerId: "",
  clientName: "",
  isReadOnly: false,
});
export const useWorkspaceOwner = () => useContext(WorkspaceOwnerContext);

const DashboardIndex = lazy(() => import("./Index"));
const AikortexCRM = lazy(() => import("./AikortexCRM"));
const AikortexMessages = lazy(() => import("./AikortexMessages"));
const Tasks = lazy(() => import("./Tasks"));
const Financial = lazy(() => import("./Financial"));
const SettingsPage = lazy(() => import("./SettingsPage"));

class ErrorBoundary extends Component<{ children: ReactNode }, { err: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { err: "" };
  }
  static getDerivedStateFromError(e: Error) {
    return { err: e.message };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="p-8 text-center space-y-2">
          <p className="text-destructive font-medium">Erro ao carregar módulo</p>
          <p className="text-sm text-muted-foreground">{this.state.err}</p>
          <button
            className="text-sm text-primary underline mt-2"
            onClick={() => this.setState({ err: "" })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Workspace = () => {
  const { user, profile } = useAuth();
  const [ownerId, setOwnerId] = useState("");
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Workspace is always the logged-in client's own space
  const isReadOnly = false;

  useEffect(() => {
    if (!user) return;
    const resolve = async () => {
      setLoading(true);
      // Always use the logged-in user's own ID — no URL lookup
      setOwnerId(user.id);
      const { data } = await supabase
        .from("agency_clients")
        .select("client_name")
        .eq("client_user_id", user.id)
        .maybeSingle();
      setClientName(data?.client_name ?? profile?.full_name ?? "Cliente");
      setLoading(false);
    };
    resolve();
  }, [user, profile]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!ownerId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Workspace não encontrado.</p>
      </div>
    );
  }

  return (
    <WorkspaceOwnerContext.Provider value={{ ownerId, clientName, isReadOnly }}>
      <RightPanelProvider>
        <div className="flex h-screen bg-background">
          <AppSidebar
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
          <main className="flex-1 overflow-auto flex flex-col">
            {isReadOnly && (
              <div className="flex items-center gap-2 bg-primary/10 border-b border-primary/20 px-4 py-2 text-xs text-primary">
                <Eye className="w-3.5 h-3.5" />
                <span>
                  Visualizando workspace de <strong>{clientName}</strong> — somente leitura para agência
                </span>
              </div>
            )}
            <ErrorBoundary>
              <Suspense
                fallback={
                  <div className="flex h-full min-h-[60vh] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                }
              >
                <Routes>
                  <Route index element={<WorkspaceHomeChat />} />
                  <Route path="dashboard" element={<DashboardIndex />} />
                  <Route path="clients" element={<WorkspaceClients />} />
                  <Route path="crm" element={<AikortexCRM />} />
                  <Route path="messages" element={<AikortexMessages />} />
                  <Route path="tasks" element={<Tasks />} />
                  <Route path="financial" element={<Financial />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </RightPanelProvider>
    </WorkspaceOwnerContext.Provider>
  );
};

export default Workspace;
