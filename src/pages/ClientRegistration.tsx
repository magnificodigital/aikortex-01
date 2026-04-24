import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import aikortexLogoWhite from "@/assets/aikortex-logo-white.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type InviteStatus = "loading" | "valid" | "invalid" | "expired" | "used" | "success";

const ClientRegistration = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    supabase
      .from("client_invites")
      .select("email, expires_at, used_at")
      .eq("token", token)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setStatus("invalid"); return; }
        if (data.used_at) { setStatus("used"); return; }
        if (new Date(data.expires_at) < new Date()) { setStatus("expired"); return; }
        setEmail(data.email);
        setStatus("valid");
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Senha deve ter no mínimo 8 caracteres"); return; }
    if (password !== confirm) { toast.error("As senhas não conferem"); return; }
    if (!fullName.trim()) { toast.error("Informe seu nome"); return; }
    setSubmitting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-client-access`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "accept_invite",
            token,
            password,
            full_name: fullName.trim(),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Erro ao criar conta");
      setStatus("success");
      setTimeout(() => navigate("/"), 3000);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const wrap = (children: React.ReactNode) => (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="glass-card rounded-2xl p-10 max-w-md w-full space-y-6">
        <div className="flex justify-center">
          <img src={aikortexLogoWhite} alt="AIKortex" className="h-10" />
        </div>
        {children}
      </div>
    </div>
  );

  if (status === "loading") return wrap(
    <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin" />
      <span>Verificando convite...</span>
    </div>
  );

  if (status === "invalid" || status === "expired" || status === "used") return wrap(
    <div className="text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mx-auto">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold">
        {status === "used" ? "Convite já utilizado" :
         status === "expired" ? "Convite expirado" : "Convite inválido"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {status === "used"
          ? "Este link já foi usado. Faça login ou peça um novo convite à sua agência."
          : "Este link não é mais válido. Solicite um novo convite à sua agência."}
      </p>
      <Button onClick={() => navigate("/")}>Ir para o login</Button>
    </div>
  );

  if (status === "success") return wrap(
    <div className="text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-[hsl(var(--success))]/15 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8 text-[hsl(var(--success))]" />
      </div>
      <h2 className="text-xl font-semibold">Conta criada!</h2>
      <p className="text-sm text-muted-foreground">
        Redirecionando para o login...
      </p>
    </div>
  );

  return wrap(
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Criar sua conta</h1>
        <p className="text-sm text-muted-foreground">
          Você foi convidado para acessar o workspace da sua agência.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} disabled />
        </div>
        <div>
          <Label>Seu nome</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nome completo"
            required
          />
        </div>
        <div>
          <Label>Senha</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
          />
        </div>
        <div>
          <Label>Confirmar senha</Label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a senha"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting
            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Criando conta...</>
            : "Criar conta e acessar"}
        </Button>
      </form>
    </div>
  );
};

export default ClientRegistration;
