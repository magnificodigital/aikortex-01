import { Suspense, Component, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ClientLayout from "@/components/workspace/ClientLayout";
import { Loader2, MessageSquare } from "lucide-react";
import { WorkspaceHome } from "@/components/workspace/WorkspaceHome";
import { WorkspaceClientsList } from "@/components/workspace/WorkspaceClientsList";
import { WorkspaceSales } from "@/components/workspace/WorkspaceSales";
import { WorkspaceFinancial } from "@/components/workspace/WorkspaceFinancial";
import { WorkspaceTasks } from "@/components/workspace/WorkspaceTasks";
import { WorkspaceSettings } from "@/components/workspace/WorkspaceSettings";

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

const MessagesPlaceholder = () => (
  <div className="p-6 lg:p-8 max-w-[1200px]">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <MessageSquare className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mensagens</h1>
        <p className="text-sm text-muted-foreground">Conversas e atendimentos</p>
      </div>
    </div>
    <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
      Em breve você poderá gerenciar mensagens por aqui.
    </div>
  </div>
);

const Workspace = () => (
  <ClientLayout>
    <WorkspaceErrorBoundary>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route index element={<WorkspaceHome />} />
          <Route path="mensagens" element={<MessagesPlaceholder />} />
          <Route path="clientes" element={<WorkspaceClientsList />} />
          <Route path="vendas" element={<WorkspaceSales />} />
          <Route path="financeiro" element={<WorkspaceFinancial />} />
          <Route path="tarefas" element={<WorkspaceTasks />} />
          <Route path="configuracoes" element={<WorkspaceSettings />} />
          {/* Legacy path redirects */}
          <Route path="clients" element={<Navigate to="/workspace/clientes" replace />} />
          <Route path="crm" element={<Navigate to="/workspace/vendas" replace />} />
          <Route path="messages" element={<Navigate to="/workspace/mensagens" replace />} />
          <Route path="tasks" element={<Navigate to="/workspace/tarefas" replace />} />
          <Route path="financial" element={<Navigate to="/workspace/financeiro" replace />} />
          <Route path="settings" element={<Navigate to="/workspace/configuracoes" replace />} />
        </Routes>
      </Suspense>
    </WorkspaceErrorBoundary>
  </ClientLayout>
);

export default Workspace;