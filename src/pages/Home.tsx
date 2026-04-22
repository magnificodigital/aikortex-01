import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Monitor, Sparkles, Globe, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { AGENT_PRESETS } from "@/types/agent-presets";
import type { AgentType } from "@/types/agent-builder";

const suggestionsByTab = {
  app: [
    ["Construtor de Formulários", "Dashboard de Vendas", "Landing Page"],
    ["Sistema de Tarefas", "Painel Financeiro", "CRM Completo"],
    ["E-commerce Simples", "Blog com IA", "Portal de Clientes"],
  ],
  agentes: [
    ["Agente SDR para WhatsApp", "Agente de Suporte 24/7", "Agente de Qualificação"],
    ["Agente BDR LinkedIn", "Agente CS Pós-Venda", "Agente de Pesquisa"],
    ["Agente de Onboarding", "Agente Cobranças", "Agente Agendamento"],
  ],
  flows: [
    ["Fluxo de Onboarding", "Automação de E-mail", "Pipeline de Vendas"],
    ["Nutrição de Leads", "Fluxo Pós-Compra", "Workflow de Aprovação"],
    ["Integração CRM + WhatsApp", "Fluxo de Cobrança", "Sequência Follow-up"],
  ],
};

const tabIcons = { app: Monitor, agentes: Sparkles, flows: Globe };

const Home = () => {
  const [prompt, setPrompt] = useState("");
  const [activeCreationTab, setActiveCreationTab] = useState<"app" | "agentes" | "flows">("app");
  const [userName, setUserName] = useState("Usuário");
  const { user } = useAuth();
  const { activeWorkspace, isClientMode } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("full_name").eq("id", user.id).single().then(({ data }) => {
        if (data?.full_name) setUserName(data.full_name.split(" ")[0]);
      });
    }
  }, [user]);

  const handleCreate = (text: string) => {
    if (!text) return;
    // Logic for creation would go here
    console.log("Creating:", text);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Olá, {userName}!</h1>
          <p className="text-muted-foreground">Como podemos ajudar seu negócio hoje?</p>
        </div>

        {!isClientMode ? (
          <>
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl p-6">
              <div className="flex gap-2 mb-6">
                {(["app", "agentes", "flows"] as const).map((tab) => {
                  const Icon = tabIcons[tab];
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveCreationTab(tab)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        activeCreationTab === tab ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Descreva o ${activeCreationTab} que deseja criar...`}
                  className="w-full bg-background border border-border rounded-xl py-4 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate(prompt)}
                />
                <Button size="icon" className="absolute right-2 top-1.5" onClick={() => handleCreate(prompt)}>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mt-8">
              {suggestionsByTab[activeCreationTab].map((row, i) => (
                <div key={i} className="space-y-2">
                  {row.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setPrompt(suggestion)}
                      className="w-full text-left px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3 w-full max-w-md mt-4">
            {[
              { label: "Mensagens", path: "/aikortex/messages" },
              { label: "Tarefas", path: "/tasks" },
              { label: "Clientes", path: "/clients" },
              { label: "Financeiro", path: "/financeiro" },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="rounded-xl border border-border bg-card p-5 text-sm font-medium hover:border-primary/40 transition-all text-left"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Home;
