import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PERMISSION_GROUPS = [
  {
    group: "Aikortex",
    items: [
      { key: "aikortex.agentes", label: "Agentes" },
      { key: "aikortex.ligacoes", label: "Ligações" },
      { key: "aikortex.flows", label: "Flows" },
      { key: "aikortex.apps", label: "Apps" },
      { key: "aikortex.mensagens", label: "Mensagens" },
      { key: "aikortex.disparos", label: "Disparos" },
    ],
  },
  {
    group: "Gestão",
    items: [
      { key: "gestao.clientes", label: "Clientes" },
      { key: "gestao.contratos", label: "Contratos" },
      { key: "gestao.vendas", label: "Vendas" },
      { key: "gestao.crm", label: "CRM" },
      { key: "gestao.reunioes", label: "Reuniões" },
      { key: "gestao.financeiro", label: "Financeiro" },
      { key: "gestao.equipe", label: "Equipe" },
      { key: "gestao.tarefas", label: "Tarefas" },
    ],
  },
];

interface Props {
  clientId: string;
  initialPermissions: Record<string, boolean>;
}

export function ClientPermissionsPanel({ clientId, initialPermissions }: Props) {
  const [perms, setPerms] = useState<Record<string, boolean>>(initialPermissions ?? {});
  const [saving, setSaving] = useState(false);

  const toggle = (key: string) =>
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("agency_clients")
      .update({ client_permissions: perms })
      .eq("id", clientId);
    setSaving(false);
    if (error) toast.error("Erro ao salvar permissões");
    else toast.success("Permissões atualizadas");
  };

  return (
    <div className="space-y-6">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.group} className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{group.group}</h3>
          <div className="space-y-2">
            {group.items.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between glass-card rounded-lg px-3 py-2"
              >
                <span className="text-sm text-foreground">{item.label}</span>
                <Switch
                  checked={!!perms[item.key]}
                  onCheckedChange={() => toggle(item.key)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Salvando..." : "Salvar permissões"}
      </Button>
    </div>
  );
}