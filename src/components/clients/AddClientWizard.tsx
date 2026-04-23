import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight, ArrowLeft, CheckCircle2, Loader2, AlertTriangle,
  Building2, Zap, KeyRound, ClipboardList, User, Phone, Mail,
  FileText, Briefcase, Check
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  agencyId?: string;
  customPricing?: Record<string, number> | null;
  agencyTier: string;
  onSuccess: () => void;
}

type Template = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  platform_price_monthly: number;
  min_tier: string;
};

const TIER_ORDER: Record<string, number> = { starter: 0, explorer: 1, hack: 2 };

const SEGMENTS = [
  "Agência de Marketing", "Consultoria", "E-commerce", "Educação",
  "Imobiliária", "Jurídico", "Saúde & Bem-estar", "Serviços Financeiros",
  "Tecnologia", "Varejo", "Outro",
];

const STEPS = [
  { id: 1, label: "Dados do Cliente", icon: Building2 },
  { id: 2, label: "Funcionalidades", icon: Zap },
  { id: 3, label: "Acesso ao Painel", icon: KeyRound },
  { id: 4, label: "Revisão Final", icon: ClipboardList },
];

const StepBar = ({ current }: { current: number }) => (
  <div className="flex items-center justify-between mb-6">
    {STEPS.map((s, i) => {
      const done = current > s.id;
      const active = current === s.id;
      return (
        <div key={s.id} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${
              done
                ? "bg-primary border-primary text-primary-foreground"
                : active
                ? "border-primary text-primary"
                : "border-muted-foreground/30 text-muted-foreground"
            }`}
          >
            {done ? <Check className="w-4 h-4" /> : s.id}
          </div>
          <div className="ml-2 hidden sm:block">
            <p className={`text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
              {s.label}
            </p>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 sm:w-12 h-0.5 mx-2 ${done ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      );
    })}
  </div>
);

const FieldGroup = ({ icon: Icon, label, children }: { icon?: React.ElementType; label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label className="flex items-center gap-2 text-sm font-medium">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      {label}
    </Label>
    {children}
  </div>
);

const AddClientWizard = ({ open, onOpenChange, agencyId, customPricing, agencyTier, onSuccess }: Props) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [personType, setPersonType] = useState<"juridica" | "fisica">("juridica");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [segment, setSegment] = useState("");
  const [fantasyName, setFantasyName] = useState("");

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [createWorkspaceAccess, setCreateWorkspaceAccess] = useState(false);
  const [clientPassword, setClientPassword] = useState("");

  const [createdClientId, setCreatedClientId] = useState("");

  useEffect(() => {
    if (open) {
      setStep(1);
      setPersonType("juridica");
      setName(""); setEmail(""); setPhone(""); setDocument("");
      setSegment(""); setFantasyName("");
      setSelected(new Set());
      setCreateWorkspaceAccess(false); setClientPassword("");
      setCreatedClientId("");
      supabase.from("platform_templates").select("*").eq("is_active", true).then(({ data }) => {
        if (data) setTemplates(data.filter((t: any) => TIER_ORDER[agencyTier] >= TIER_ORDER[t.min_tier]) as Template[]);
      });
    }
  }, [open, agencyTier]);

  const getPrice = (t: Template) => customPricing?.[t.slug] ?? null;
  const selectedTemplates = templates.filter((t) => selected.has(t.id));
  const monthlyTotal = selectedTemplates.reduce((sum, t) => sum + (getPrice(t) ?? 0), 0);

  const step1Valid = !!name && !!email && !!document;
  const step3Valid = !createWorkspaceAccess || (!!email && !!clientPassword);

  const handleCreate = async () => {
    if (!agencyId) { toast.error("Perfil de agência não encontrado"); return; }
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("asaas-create-client", {
        body: { client_name: name, client_email: email, client_phone: phone, client_document: document },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) { toast.error(typeof res.data.error === "string" ? res.data.error : "Erro ao criar cliente"); setLoading(false); return; }

      const clientId = res.data.client?.id;
      setCreatedClientId(clientId);

      if (createWorkspaceAccess && email && clientPassword) {
        const createRes = await supabase.functions.invoke("create-user", {
          body: { email, password: clientPassword, full_name: name, role: "client_owner", tenant_type: "client" },
        });
        if (createRes.data?.user?.id) {
          await supabase.from("agency_clients").update({ client_user_id: createRes.data.user.id }).eq("id", clientId);
        }
      }

      for (const t of selectedTemplates) {
        await supabase.functions.invoke("asaas-subscribe-template", {
          body: { client_id: clientId, template_id: t.id },
        });
      }

      toast.success("Cliente cadastrado com sucesso!");
      setStep(5);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <StepBar current={step > 4 ? 4 : step} />
        </DialogHeader>

        <div className="mt-4">

          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Dados do Cliente</h3>
                <p className="text-sm text-muted-foreground">Informações básicas da nova conta</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tipo de Conta *</Label>
                  <RadioGroup value={personType} onValueChange={(v) => setPersonType(v as "juridica" | "fisica")} className="flex gap-4">
                    {[{ value: "juridica", label: "Pessoa Jurídica" }, { value: "fisica", label: "Pessoa Física" }].map((opt) => (
                      <div key={opt.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt.value} id={opt.value} />
                        <Label htmlFor={opt.value} className="text-sm">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldGroup icon={User} label="Nome / Razão Social *">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={personType === "juridica" ? "Ex: Empresa LTDA" : "Nome do cliente"} />
                  </FieldGroup>
                  <FieldGroup icon={Mail} label="Email *">
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com" />
                  </FieldGroup>
                  <FieldGroup icon={FileText} label={personType === "juridica" ? "CNPJ *" : "CPF *"}>
                    <Input value={document} onChange={(e) => setDocument(e.target.value)} placeholder={personType === "juridica" ? "00.000.000/0000-00" : "000.000.000-00"} />
                  </FieldGroup>
                  <FieldGroup icon={Briefcase} label="Segmento">
                    <Select value={segment} onValueChange={setSegment}>
                      <SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger>
                      <SelectContent>
                        {SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                  <FieldGroup icon={Phone} label="Telefone">
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 3333-4444" />
                  </FieldGroup>
                  {personType === "juridica" && (
                    <FieldGroup icon={Building2} label="Nome Fantasia">
                      <Input value={fantasyName} onChange={(e) => setFantasyName(e.target.value)} placeholder="Nome comercial (opcional)" />
                    </FieldGroup>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!step1Valid}>
                  Próximo <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Funcionalidades</h3>
                <p className="text-sm text-muted-foreground">Selecione os templates que este cliente vai usar</p>
              </div>

              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum template disponível para o seu plano.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {templates.map((t) => {
                    const price = getPrice(t);
                    const isSelected = selected.has(t.id);
                    return (
                      <Card
                        key={t.id}
                        onClick={() => { if (price === null) return; const next = new Set(selected); isSelected ? next.delete(t.id) : next.add(t.id); setSelected(next); }}
                        className={`cursor-pointer transition-all ${isSelected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"} ${price === null ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                            {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm">{t.name}</h4>
                              <Badge variant="outline" className="text-[10px] h-5">
                                {t.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {t.description}
                            </p>
                          </div>
                          <div className="text-right">
                            {price !== null ? (
                              <p className="text-sm font-semibold">R$ {price.toFixed(0)}/mês</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">Sem preço</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {selectedTemplates.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{selectedTemplates.length} template(s) selecionado(s)</span>
                    <span className="text-lg font-semibold">R$ {monthlyTotal.toFixed(0)}/mês</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}> Voltar</Button>
                <Button onClick={() => setStep(3)}>Próximo <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Acesso ao Painel</h3>
                <p className="text-sm text-muted-foreground">Configure o acesso do cliente ao workspace</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <Switch
                    checked={createWorkspaceAccess}
                    onCheckedChange={setCreateWorkspaceAccess}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label className="font-medium cursor-pointer">
                      Criar acesso ao workspace
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      O cliente poderá acessar seu próprio painel com login e senha
                    </p>
                  </div>
                </div>

                {createWorkspaceAccess && (
                  <>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Atenção</p>
                        <p className="text-sm text-amber-700">
                          O cliente usará o email acima com esta senha para entrar pela primeira vez.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Senha temporária *</Label>
                      <Input type="password" value={clientPassword} onChange={(e) => setClientPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}> Voltar</Button>
                <Button onClick={() => setStep(4)}>Próximo <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <ClipboardList className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Revisão Final</h3>
                <p className="text-sm text-muted-foreground">Confirme os dados antes de cadastrar</p>
              </div>

              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Dados do Cliente
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nome / Razão Social</span>
                      <p className="font-medium">{name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email</span>
                      <p className="font-medium">{email}</p>
                    </div>
                    {document && <div>
                      <span className="text-muted-foreground">{personType === "juridica" ? "CNPJ" : "CPF"}</span>
                      <p className="font-medium">{document}</p>
                    </div>}
                    {phone && <div>
                      <span className="text-muted-foreground">Telefone</span>
                      <p className="font-medium">{phone}</p>
                    </div>}
                    {segment && <div>
                      <span className="text-muted-foreground">Segmento</span>
                      <p className="font-medium">{segment}</p>
                    </div>}
                  </div>
                </div>

                {selectedTemplates.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4" /> Funcionalidades
                    </h4>
                    {selectedTemplates.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-1">
                        <span className="text-sm">{t.name}</span>
                        <span className="text-sm font-medium">R$ {(getPrice(t) ?? 0).toFixed(0)}/mês</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total mensal</span>
                      <span className="text-lg font-semibold">R$ {monthlyTotal.toFixed(0)}/mês</span>
                    </div>
                  </div>
                )}

                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <KeyRound className="w-4 h-4" /> Acesso ao Painel
                  </h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={createWorkspaceAccess ? "default" : "secondary"}>
                      {createWorkspaceAccess ? "Ativo" : "Não configurado"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {createWorkspaceAccess ? "Será criado com senha temporária" : "Sem acesso configurado"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}> Voltar</Button>
                <Button onClick={handleCreate} disabled={loading || !step1Valid}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {loading ? "Cadastrando..." : "Cadastrar Cliente"}
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>

              <div>
                <h3 className="text-xl font-semibold">Cliente cadastrado!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  O cliente foi adicionado à sua base com sucesso.
                </p>
              </div>

              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                {createdClientId && (
                  <Button onClick={() => { onOpenChange(false); window.location.href = `/clients/${createdClientId}`; }}>Ver Cliente</Button>
                )}
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddClientWizard;