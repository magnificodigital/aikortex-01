import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Bot, Plus, Pencil, Trash2, Loader2, Play, Send, CheckCircle2, Archive, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAgentChat } from "@/hooks/use-agent-chat";

// ── Types ──────────────────────────────────────────────────────────

interface AgentTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  agent_type: string;
  soul_md: string;
  config_yaml: string;
  model: string;
  status: "draft" | "published" | "archived";
  version: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  template_pricing?: PricingRow[];
  category?: string;
  features?: string[];
  demo_url?: string | null;
  min_tier?: string;
  is_active?: boolean;
  is_exclusive?: boolean;
  sort_order?: number;
}

interface PricingRow {
  id?: string;
  price_cents: number;
  currency: string;
  billing_type: "monthly" | "one_time";
  min_resale_margin_pct: number;
  is_active: boolean;
}

interface TemplateForm {
  name: string;
  slug: string;
  description: string;
  agent_type: string;
  model: string;
  soul_md: string;
  config_yaml: string;
  price_cents: number;
  billing_type: "monthly" | "one_time";
  min_resale_margin_pct: number;
  category: string;
  features: string[];
  demo_url: string;
  min_tier: string;
  is_active: boolean;
  is_exclusive: boolean;
  sort_order: number;
}

// ── Constants ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: "Rascunho",  color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  published: { label: "Publicado", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  archived:  { label: "Arquivado", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
};

const AGENT_TYPES = ["SDR", "SAC", "Custom", "Marketing", "Suporte"];

const EMPTY_FORM: TemplateForm = {
  name: "",
  slug: "",
  description: "",
  agent_type: "Custom",
  model: "google/gemini-2.5-flash",
  soul_md: "",
  config_yaml: "name: meu-agente\ndescription: Descrição do agente\nmodel: gemini-flash\ntool_groups:\n  - web\n  - file:read",
  price_cents: 0,
  billing_type: "monthly",
  min_resale_margin_pct: 20,
  category: "agent",
  features: [],
  demo_url: "",
  min_tier: "starter",
  is_active: true,
  is_exclusive: false,
  sort_order: 0,
};

const slugify = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ── Test Chat Panel ────────────────────────────────────────────────

const TestChatPanel = ({ template, onClose }: { template: AgentTemplate; onClose: () => void }) => {
  const [input, setInput] = useState("");

  const chat = useAgentChat(
    [{ role: "agent", text: `Olá! Sou o **${template.name}**. Como posso ajudar?` }],
    {
      useGateway: true,
      gatewayModel: "google/gemini-2.5-flash",
      systemPrompt: template.soul_md || `Você é ${template.name}. ${template.description || ""}`,
      disableCrmExtraction: true,
    } as any
  );

  const send = () => {
    const text = input.trim();
    if (!text || chat.isStreaming) return;
    setInput("");
    chat.sendMessage(text);
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            Teste — {template.name}
            <Badge variant="outline" className="ml-auto text-[10px]">Preview</Badge>
          </SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chat.messages.map((m: any, i: number) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {chat.isStreaming && (
            <div className="flex justify-start">
              <div className="bg-muted px-3 py-2 rounded-lg">
                <Loader2 className="w-3 h-3 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Envie uma mensagem..."
            className="flex-1 h-9 text-sm"
            disabled={chat.isStreaming}
          />
          <Button size="sm" onClick={send} disabled={!input.trim() || chat.isStreaming}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ── Main Component ─────────────────────────────────────────────────

const AdminAgentTemplatesTab = () => {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgentTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<AgentTemplate | null>(null);
  const [testTarget, setTestTarget] = useState<AgentTemplate | null>(null);
  const [formTab, setFormTab] = useState("info");

  // ── Queries ──

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["admin-agent-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_templates" as any)
        .select("*, template_pricing(*)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AgentTemplate[];
    },
  });

  // ── Mutations ──

  const saveMutation = useMutation({
    mutationFn: async () => {
      const templatePayload = {
        name:        form.name,
        slug:        form.slug,
        description: form.description || null,
        agent_type:  form.agent_type,
        model:       form.model,
        soul_md:     form.soul_md,
        config_yaml: form.config_yaml,
        category:    form.category,
        features:    form.features,
        demo_url:    form.demo_url || null,
        min_tier:    form.min_tier,
        is_active:   form.is_active,
        is_exclusive: form.is_exclusive,
        sort_order:  form.sort_order,
        updated_at:  new Date().toISOString(),
      };

      let templateId = editing?.id;

      if (editing) {
        const { error } = await supabase.from("agent_templates" as any).update(templatePayload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("agent_templates" as any).insert(templatePayload).select().single();
        if (error) throw error;
        templateId = (data as any).id;
      }

      // Upsert pricing
      if (templateId) {
        const existingPricing = editing?.template_pricing?.[0];
        const pricingPayload = {
          template_id:           templateId,
          price_cents:           form.price_cents,
          currency:              "BRL",
          billing_type:          form.billing_type,
          min_resale_margin_pct: form.min_resale_margin_pct,
          is_active:             true,
        };
        if (existingPricing?.id) {
          await supabase.from("template_pricing" as any).update(pricingPayload).eq("id", existingPricing.id);
        } else {
          await supabase.from("template_pricing" as any).insert(pricingPayload);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-agent-templates"] });
      toast.success(editing ? "Template atualizado" : "Template criado");
      closeModal();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("agent_templates" as any).update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ["admin-agent-templates"] });
      toast.success(status === "published" ? "Template publicado" : "Template arquivado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_templates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-agent-templates"] });
      toast.success("Template excluído");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  // ── Helpers ──

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormTab("info");
    setModalOpen(true);
  };

  const openEdit = (t: AgentTemplate) => {
    const pricing = t.template_pricing?.[0];
    setEditing(t);
    setForm({
      name:                  t.name,
      slug:                  t.slug,
      description:           t.description ?? "",
      agent_type:            t.agent_type,
      model:                 t.model,
      soul_md:               t.soul_md,
      config_yaml:           t.config_yaml,
      price_cents:           pricing?.price_cents ?? 0,
      billing_type:          pricing?.billing_type ?? "monthly",
      min_resale_margin_pct: pricing?.min_resale_margin_pct ?? 20,
      category:              t.category ?? "agent",
      features:              Array.isArray(t.features) ? t.features : [],
      demo_url:              t.demo_url ?? "",
      min_tier:              t.min_tier ?? "starter",
      is_active:             t.is_active ?? true,
      is_exclusive:          t.is_exclusive ?? false,
      sort_order:            t.sort_order ?? 0,
    });
    setFormTab("info");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.slug.trim()) { toast.error("Slug é obrigatório"); return; }
    if (!form.soul_md.trim()) { toast.error("SOUL.md é obrigatório"); setFormTab("soul"); return; }
    saveMutation.mutate();
  };

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Templates de Agentes</h2>
            <p className="text-sm text-muted-foreground">Crie e gerencie templates de agentes IA disponíveis para as agências</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Novo Template
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum template criado ainda
                  </TableCell>
                </TableRow>
              ) : templates.map((t) => {
                const pricing = t.template_pricing?.[0];
                const sc = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.draft;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{t.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{t.slug}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{t.agent_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs border ${sc.color}`}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {pricing ? `${formatPrice(pricing.price_cents)}/${pricing.billing_type === "monthly" ? "mês" : "único"}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">v{t.version}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTestTarget(t)} title="Testar">
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {t.status === "draft" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => statusMutation.mutate({ id: t.id, status: "published" })} title="Publicar">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          </Button>
                        )}
                        {t.status === "published" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => statusMutation.mutate({ id: t.id, status: "archived" })} title="Arquivar">
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(t)} title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Template" : "Novo Template de Agente"}</DialogTitle>
            <DialogDescription>
              {editing ? "Atualize as configurações do template" : "Configure o template de agente que as agências poderão adquirir"}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={formTab} onValueChange={setFormTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="soul">SOUL</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="pricing">Preço</TabsTrigger>
            </TabsList>

            {/* INFO */}
            <TabsContent value="info" className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setForm((p) => ({ ...p, name, slug: editing ? p.slug : slugify(name) }));
                    }}
                    placeholder="Ex: Agente SDR BANT"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Slug *</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                    placeholder="agente-sdr-bant"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tipo de Agente</Label>
                  <Select value={form.agent_type} onValueChange={(v) => setForm((p) => ({ ...p, agent_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AGENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    placeholder="Descreva o que este agente faz..."
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Modelo padrão</Label>
                  <Select value={form.model} onValueChange={(v) => setForm((p) => ({ ...p, model: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                      <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                      <SelectItem value="openai/gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="anthropic/claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* SOUL */}
            <TabsContent value="soul" className="space-y-2 mt-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">SOUL.md — Personalidade e instruções do agente</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Defina a persona, missão, fluxo de atendimento e restrições do agente. Use Markdown.
              </p>
              <Textarea
                value={form.soul_md}
                onChange={(e) => setForm((p) => ({ ...p, soul_md: e.target.value }))}
                rows={18}
                className="font-mono text-xs resize-none"
                placeholder={"# SOUL\n\nVocê é um agente especializado em..."}
              />
            </TabsContent>

            {/* CONFIG */}
            <TabsContent value="config" className="space-y-2 mt-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">config.yaml — Configuração técnica do agente</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Define nome, modelo e grupos de ferramentas disponíveis para este agente.
              </p>
              <Textarea
                value={form.config_yaml}
                onChange={(e) => setForm((p) => ({ ...p, config_yaml: e.target.value }))}
                rows={12}
                className="font-mono text-xs resize-none"
                placeholder={"name: meu-agente\nmodel: gemini-flash\ntool_groups:\n  - web"}
              />
            </TabsContent>

            {/* PRICING */}
            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label>Preço (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={(form.price_cents / 100).toFixed(2)}
                    onChange={(e) => setForm((p) => ({ ...p, price_cents: Math.round(Number(e.target.value) * 100) }))}
                    placeholder="0,00"
                  />
                  <p className="text-[11px] text-muted-foreground">Valor que a agência paga para usar este template</p>
                </div>
                <div className="space-y-1">
                  <Label>Cobrança</Label>
                  <Select value={form.billing_type} onValueChange={(v: "monthly" | "one_time") => setForm((p) => ({ ...p, billing_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="one_time">Pagamento único</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Margem mínima de revenda (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.min_resale_margin_pct}
                    onChange={(e) => setForm((p) => ({ ...p, min_resale_margin_pct: Number(e.target.value) }))}
                  />
                  <p className="text-[11px] text-muted-foreground">A agência deve cobrar pelo menos este % a mais ao revender</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Agências com licença ativa continuarão com acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Chat */}
      {testTarget && <TestChatPanel template={testTarget} onClose={() => setTestTarget(null)} />}
    </div>
  );
};

export default AdminAgentTemplatesTab;
