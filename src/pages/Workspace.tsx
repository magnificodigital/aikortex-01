import { lazy, Suspense, Component, type ReactNode } from "react";
import { Routes, Route } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Loader2 } from "lucide-react";
import { WorkspaceHomeChat } from "@/components/workspace/WorkspaceHomeChat";
import { WorkspaceClients } from "@/components/workspace/WorkspaceClients";

const DashboardIndex = lazy(() => import("./Index"));
const AikortexCRM = lazy(() => import("./AikortexCRM"));
const AikortexMessages = lazy(() => import("./AikortexMessages"));
const Tasks = lazy(() => import("./Tasks"));
const Financial = lazy(() => import("./Financial"));
const SettingsPage = lazy(() => import("./SettingsPage"));

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

const Workspace = () => (
  <DashboardLayout>
    <WorkspaceErrorBoundary>
      <Suspense fallback={<Loader />}>
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
    </WorkspaceErrorBoundary>
  </DashboardLayout>
);

export default Workspace;