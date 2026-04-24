import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Home, LayoutDashboard, MessageSquare, Users, TrendingUp,
  DollarSign, CheckSquare, Activity, Send,
} from "lucide-react";

const HomeSection = ({ name }: { name: string }) => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Workspace — {name}</h1>
      <p className="text-sm text-muted-foreground">Visão geral da subconta deste cliente.</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: "Clientes", value: "—", icon: Users, color: "text-blue-500" },
        { label: "Vendas no mês", value: "—", icon: TrendingUp, color: "text-green-500" },
        { label: "Tarefas pendentes", value: "—", icon: CheckSquare, color: "text-amber-500" },
        { label: "Mensagens", value: "0 / 500", icon: MessageSquare, color: "text-purple-500" },
      ].map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <item.icon className={`w-8 h-8 ${item.color}`} />
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-lg font-semibold text-foreground">{item.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
    <Card>
      <CardContent className="p-6 flex flex-col items-center justify-center gap-2 text-center">
        <Activity className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
      </CardContent>
    </Card>
  </div>
);

const SimpleSection = ({ title, sub, icon: Icon, cta }: { title: string; sub: string; icon: typeof Users; cta?: string }) => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{sub}</p>
    </div>
    <Card>
      <CardContent className="p-10 flex flex-col items-center justify-center gap-3 text-center">
        <Icon className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
        {cta && <Button>{cta}</Button>}
      </CardContent>
    </Card>
  </div>
);

const MensagensSection = () => {
  const [msg, setMsg] = useState("");
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
            <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Digite uma mensagem..." className="flex-1" />
            <Button><Send className="w-4 h-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const FinanceiroSection = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-semibold text-foreground">Financeiro</h1>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[
        { label: "Receitas", value: "R$ 0", color: "text-green-600" },
        { label: "Despesas", value: "R$ 0", color: "text-destructive" },
        { label: "Saldo", value: "R$ 0", color: "text-foreground" },
      ].map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`text-xl font-semibold ${item.color}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

const ClientWorkspaceView = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const location = useLocation();
  const { clients, activeWorkspace, switchToClient } = useWorkspace();
  const [clientName, setClientName] = useState("Cliente");

  useEffect(() => {
    if (!clientId) return;
    const found = clients.find(c => c.id === clientId);
    if (found) {
      setClientName(found.client_name);
      if (activeWorkspace.id !== clientId) switchToClient(found);
      return;
    }
    supabase
      .from("agency_clients")
      .select("id, client_name, client_email, status")
      .eq("id", clientId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setClientName(data.client_name);
          if (activeWorkspace.id !== clientId)
            switchToClient({ id: data.id, client_name: data.client_name, client_email: data.client_email, status: data.status } as never);
        }
      });
  }, [clientId, clients]);

  const base = `/clients/${clientId}/workspace`;
  const subPath = location.pathname.replace(base, "") || "/";

  const renderContent = () => {
    if (subPath === "/" || subPath === "") return <HomeSection name={clientName} />;
    if (subPath === "/dashboard") return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard — {clientName}</h1>
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Dados aparecerão aqui.</CardContent></Card>
      </div>
    );
    if (subPath === "/mensagens") return <MensagensSection />;
    if (subPath === "/clientes") return <SimpleSection title="Clientes" sub="Contatos desta subconta." icon={Users} cta="Novo cliente" />;
    if (subPath === "/vendas") return <SimpleSection title="Vendas" sub="Pipeline e oportunidades." icon={TrendingUp} cta="Nova venda" />;
    if (subPath === "/financeiro") return <FinanceiroSection />;
    if (subPath === "/tarefas") return <SimpleSection title="Tarefas" sub="Tarefas atribuídas a esta conta." icon={CheckSquare} cta="Nova tarefa" />;
    return <HomeSection name={clientName} />;
  };

  return (
    <DashboardLayout>
      <div className="p-6">{renderContent()}</div>
    </DashboardLayout>
  );
};

export default ClientWorkspaceView;
