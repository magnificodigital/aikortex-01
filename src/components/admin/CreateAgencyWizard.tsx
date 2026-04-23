import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, RefreshCw } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const generatePassword = () => {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const adminInvoke = async (body: Record<string, any>) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Erro desconhecido");
  if (data?.error) throw new Error(data.error);
  return data;
};

const CreateAgencyWizard = ({ open, onClose, onSuccess }: Props) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(generatePassword());
  const [tier, setTier] = useState("starter");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !email.trim()) { toast.error("Nome e e-mail são obrigatórios"); return; }
    setSaving(true);
    try {
      await adminInvoke({ action: "create", email, password, full_name: name, role: "agency_owner", tenant_type: "agency", agency_name: name, tier });
      setCreated(true);
      toast.success("Agência criada com sucesso!");
      onSuccess();
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  const handleClose = () => { setCreated(false); setName(""); setEmail(""); setPassword(generatePassword()); setTier("starter"); onClose(); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{created ? "Agência criada!" : "Criar nova agência"}</DialogTitle>
          <DialogDescription>{created ? "Copie as credenciais abaixo." : "Preencha os dados da nova agência."}</DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 space-y-2 bg-muted/50">
              <p className="text-sm"><span className="text-muted-foreground">E-mail:</span> {email}</p>
              <p className="text-sm"><span className="text-muted-foreground">Senha:</span> {password}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`E-mail: ${email}\nSenha: ${password}`); toast.success("Copiado!"); }}>
              <Copy className="w-4 h-4 mr-1.5" /> Copiar credenciais
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div><Label>Nome da agência *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da agência" /></div>
            <div><Label>E-mail do responsável *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@agencia.com" /></div>
            <div>
              <Label>Senha temporária *</Label>
              <div className="flex gap-2">
                <Input value={password} onChange={e => setPassword(e.target.value)} />
                <Button variant="outline" size="icon" onClick={() => setPassword(generatePassword())}><RefreshCw className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(password); toast.success("Copiado!"); }}><Copy className="w-4 h-4" /></Button>
              </div>
            </div>
            <div><Label>Tier inicial</Label>
              <Select value={tier} onValueChange={setTier}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="starter">Starter</SelectItem><SelectItem value="hack">Hack</SelectItem><SelectItem value="growth">Growth</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          {created ? <Button onClick={handleClose}>Fechar</Button> : (
            <><Button variant="outline" onClick={handleClose}>Cancelar</Button><Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Criar agência</Button></>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAgencyWizard;
