import { lazy, Suspense, Component, useState, type ReactNode } from "react";
import { Routes, Route } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import { RightPanelProvider } from "@/components/RightPanel";
import { Loader2 } from "lucide-react";
import { WorkspaceHomeChat } from "@/components/workspace/WorkspaceHomeChat";
import { WorkspaceClients } from "@/components/workspace/WorkspaceClients";

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <RightPanelProvider>
      <div className="flex h-screen bg-background">
        <AppSidebar
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
        <main className="flex-1 overflow-auto">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="p-6 text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
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
  );
};

export default Workspace;
