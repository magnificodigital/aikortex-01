import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, KeyRound, UserPlus, Send, Loader2, Copy, Link2, Layers } from "lucide-react";

interface Props {
  client: {
    id: string;
    client_email: string | null;
    client_user_id: string | null;
    enabled_ia_modules: string[];
  };
  onUpdated: () => void;
}

export const ClientAccessTab = ({ client, onUpdated }: Props) => {
  const [email, setEmail] = useState(client.client_email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [modules, setModules] = useState(client.enabled_ia_modules ?? ["mensagens"]);
  const [savingModules, setSavingModules] = useState(false);

  const handleGenerateInvite = async () => {
    setLoading("invite");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada.");
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-client-access`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "generate_invite", client_id: client.id }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Erro ao gerar convite");
      setInviteUrl(data.invite_url);
      toast.success("Link de convite gerado!");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const invoke = async (action: string, payload: Record<string, unknown>, key: string) => {
    setLoading(key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-client-access`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action, client_id: client.id, ...payload }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Erro na operação");
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message ?? "Operação concluída");
      onUpdated();
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    } finally {
      setLoading(null);
    }
  };

  const toggleModule = async (key: string, enabled: boolean) => {
    const next = enabled ? [...modules, key] : modules.filter((m) => m !== key);
    setModules(next);
    setSavingModules(true);
    try {
      const { error } = await supabase
        .from("agency_clients")
        .update({ enabled_ia_modules: next })
        .eq("id", client.id);
      if (error) throw error;
      toast.success("Módulos atualizados");
      onUpdated();
    } catch (err) {
      toast.error((err as Error).message);
      setModules(modules);
    } finally {
      setSavingModules(false);
    }
  };

  const hasUser = !!client.client_user_id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4" /> Módulos de IA liberados
          </CardTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Escolha quais recursos de IA o cliente pode acessar no workspace dele.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Mensagens</p>
              <p className="text-xs text-muted-foreground">Sempre habilitado</p>
            </div>
            <Badge>Ativo</Badge>
          </div>

          {[
            { key: "agentes",   label: "Agentes",   desc: "Criação e uso de agentes de IA" },
            { key: "flows",     label: "Flows",     desc: "Automações e fluxos de IA" },
            { key: "apps",      label: "Apps",      desc: "Aplicativos conectados" },
            { key: "templates", label: "Templates", desc: "Biblioteca de templates" },
            { key: "disparos",  label: "Disparos",  desc: "Envios em massa" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={modules.includes(key)}
                onCheckedChange={(val) => toggleModule(key, val)}
                disabled={savingModules}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {!hasUser && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Convidar cliente
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Gera um link de acesso para o cliente criar a própria senha. Válido por 7 dias.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {inviteUrl ? (
              <div className="space-y-2">
                <Label>Link gerado</Label>
                <div className="flex gap-2">
                  <Input value={inviteUrl} readOnly className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteUrl);
                      toast.success("Link copiado!");
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compartilhe este link com o cliente para ele criar a senha.
                </p>
              </div>
            ) : (
              <Button
                className="w-full"
                disabled={loading !== null || !client.client_email}
                onClick={handleGenerateInvite}
              >
                {loading === "invite" ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Gerando...</>
                ) : (
                  <><Link2 className="w-4 h-4 mr-1" /> Gerar link de convite</>
                )}
              </Button>
            )}
            {!client.client_email && (
              <p className="text-xs text-amber-600">
                Cadastre o email do cliente antes de gerar o convite.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" /> Email de acesso
          </CardTitle>
          <Badge variant={hasUser ? "default" : "outline"}>
            {hasUser ? "Usuário ativo" : "Sem usuário"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@exemplo.com"
            />
            <Button
              onClick={() => invoke("update_email", { new_email: email }, "email")}
              disabled={loading !== null || !email || email === client.client_email}
            >
              {loading === "email" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Atualizar o email aqui também atualiza o login do cliente no sistema de autenticação.
          </p>
        </CardContent>
      </Card>

      {!hasUser && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Criar usuário de acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Cria uma conta para que o cliente possa fazer login no sistema com email e senha.
            </p>
            <div>
              <Label>Senha inicial (mín. 8 caracteres)</Label>
              <Input
                type="text"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Senha temporária"
              />
            </div>
            <Button
              className="w-full"
              disabled={loading !== null || !email || createPassword.length < 8}
              onClick={async () => {
                const ok = await invoke(
                  "create_client_user",
                  { email, password: createPassword },
                  "create",
                );
                if (ok) setCreatePassword("");
              }}
            >
              {loading === "create" ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <UserPlus className="w-4 h-4 mr-1" />
              )}
              Criar usuário
            </Button>
          </CardContent>
        </Card>
      )}

      {hasUser && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-4 h-4" /> Enviar email de recuperação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                O cliente recebe um link por email para definir uma nova senha. Recomendado para garantir
                segurança máxima.
              </p>
              <Button
                variant="outline"
                disabled={loading !== null}
                onClick={() => invoke("send_password_reset", {}, "reset")}
              >
                {loading === "reset" ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Send className="w-4 h-4 mr-1" />
                )}
                Enviar link de recuperação
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Definir senha manualmente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Define uma nova senha imediatamente. Comunique ao cliente por canal seguro.
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha (mín. 8 caracteres)"
                />
                <Button
                  variant="secondary"
                  disabled={loading !== null || newPassword.length < 8}
                  onClick={async () => {
                    const ok = await invoke(
                      "set_password",
                      { new_password: newPassword },
                      "setpw",
                    );
                    if (ok) setNewPassword("");
                  }}
                >
                  {loading === "setpw" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
