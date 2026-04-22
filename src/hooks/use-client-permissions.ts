import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const CLIENT_DEFAULTS: Record<string, boolean> = {
  "aikortex.agentes": false,
  "aikortex.ligacoes": false,
  "aikortex.flows": false,
  "aikortex.apps": false,
  "aikortex.mensagens": true,
  "aikortex.disparos": false,
  "gestao.clientes": true,
  "gestao.contratos": true,
  "gestao.vendas": true,
  "gestao.crm": true,
  "gestao.reunioes": true,
  "gestao.financeiro": true,
  "gestao.equipe": true,
  "gestao.tarefas": true,
};

export function useClientPermissions() {
  const { activeWorkspace } = useWorkspace();
  const isClientMode = activeWorkspace.type === "client";

  const { data: permissions } = useQuery({
    queryKey: ["client-permissions", activeWorkspace.id],
    enabled: isClientMode && !!activeWorkspace.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("agency_clients")
        .select("client_permissions")
        .eq("id", activeWorkspace.id)
        .maybeSingle();
      return (data?.client_permissions as Record<string, boolean>) ?? CLIENT_DEFAULTS;
    },
  });

  const canView = (moduleKey: string): boolean => {
    if (!isClientMode) return true;
    return permissions?.[moduleKey] ?? CLIENT_DEFAULTS[moduleKey] ?? false;
  };

  return { canView, isClientMode, permissions: permissions ?? CLIENT_DEFAULTS };
}