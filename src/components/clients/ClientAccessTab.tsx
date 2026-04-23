import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, KeyRound, UserPlus, Send, Loader2 } from "lucide-react";

interface Props {
  client: {
    id: string;
    client_email: string | null;
    client_user_id: string | null;
  };
  onUpdated: () => void;
}

export const ClientAccessTab = ({ client, onUpdated }: Props) => {
  const [email, setEmail] = useState(client.client_email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const invoke = async (action: string, payload: Record<string, unknown>, key: string) => {
    setLoading(key);
    try {
      const { data, error } = await supabase.functions.invoke("manage-client-access", {
        body: { action, client_id: client.id, ...payload },
      });
      if (error) throw error;
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

  const hasUser = !!client.client_user_id;

  return (
    <div className="space-y-4">
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
