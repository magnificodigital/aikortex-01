import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, User, Lock } from "lucide-react";

export const WorkspaceSettings = () => {
  const { user, profile } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">Preferências da sua conta</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Dados da conta</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm text-foreground mt-1">{user?.email ?? "—"}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <p className="text-sm text-foreground mt-1">{profile?.full_name ?? "—"}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <p className="text-sm text-foreground mt-1">Cliente</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Segurança</h2>
        </div>
        <div className="space-y-3 max-w-md">
          <div>
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button
            onClick={save}
            disabled={saving || !newPassword || !confirmPassword}
          >
            {saving ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSettings;