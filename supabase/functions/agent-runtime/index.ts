// Edge function: agent-runtime
// Sandbox / wizard runtime — proxies chat-completion requests to OpenRouter
// and streams the SSE response back. Output format is OpenAI-compatible,
// so the existing frontend SSE parser (use-agent-chat.ts) keeps working.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_MODEL = "google/gemini-2.5-flash";

/** Map deprecated/legacy OpenRouter model IDs to their current equivalents. */
const LEGACY_MODEL_ALIASES: Record<string, string> = {
  "google/gemini-2.5-flash-preview-04-17": "google/gemini-2.5-flash",
  "google/gemini-2.5-pro-preview-05-06": "google/gemini-2.5-pro",
  "google/gemini-2.5-flash-preview": "google/gemini-2.5-flash",
  "google/gemini-2.5-pro-preview": "google/gemini-2.5-pro",
};

function normalizeModel(model: string | undefined, provider?: string): string {
  if (!model) return DEFAULT_MODEL;
  const aliased = LEGACY_MODEL_ALIASES[model] || model;
  if (aliased.includes("/")) return aliased;
  switch ((provider || "").toLowerCase()) {
    case "openai": return `openai/${aliased}`;
    case "anthropic": return `anthropic/${aliased}`;
    case "gemini":
    case "google": return `google/${aliased}`;
    case "groq": return `groq/${aliased}`;
    default: return aliased;
  }
}

/* ── Operational system prompt for live agent chats (non-wizard) ── */
function buildOperationalSystemPrompt(ctx: any): string {
  if (!ctx || typeof ctx !== "object") return "";
  const name = ctx.name || "Assistente";
  const company = ctx.companyName || ctx.company || "";
  const role = ctx.role || "assistente especializado";
  const objective = ctx.objective || "ajudar o usuário com excelência";
  const tone = ctx.toneOfVoice || "profissional e amigável";
  let greeting = ctx.greetingMessage || "";
  const channels = Array.isArray(ctx.channels) ? ctx.channels.join(", ") : "";
  const tools = Array.isArray(ctx.tools) ? ctx.tools.join(", ") : "";
  const instructions = ctx.instructions || "";

  // Replace placeholders like [Empresa], [empresa], {{company}} in greeting with actual company name
  if (company) {
    greeting = greeting
      .replace(/\[empresa\]/gi, company)
      .replace(/\{\{\s*company(name)?\s*\}\}/gi, company)
      .replace(/\[company(name)?\]/gi, company);
  }

  return `# Identidade
Você é **${name}**${company ? `, da empresa **${company}**` : ""}. Atua como **${role}**.

# Objetivo principal
${objective}

# Tom de voz
${tone}. Frases curtas, diretas, sem rodeios. Evite jargão técnico desnecessário.

# Regras invioláveis de cadência (SDR humano de alta performance)
1. Responda **sempre em português do Brasil**.
2. **Seja MUITO objetivo**: cada mensagem com **no máximo 2 frases curtas** (≈ 25 palavras). Nada de parágrafos longos.
3. **NUNCA repita ou parafraseie** o que o cliente acabou de dizer ("Entendi, você está dizendo que..."). Vá direto ao próximo passo.
4. **NUNCA use "Entendi, [nome]"** mais de uma vez na conversa inteira. Não repita o nome da pessoa em toda mensagem — soa robótico.
5. **Avance rápido na qualificação**: agrupe **2 perguntas relacionadas** quando fizer sentido (ex: "Há quanto tempo isso te incomoda e já tentou algum tratamento profissional?").
6. **Se a resposta for vaga** ("sei lá", "não sei"), faça **1 pergunta de afunilamento direto** com opções (ex: "É mais relacionado a A, B ou C?") — não fique perguntando o mesmo de formas diferentes.
7. **Após 3-4 trocas** com sinais claros de interesse, **proponha o próximo passo** (agendamento, orçamento, demo) — não enrole na descoberta.
8. **NUNCA invente** informações sobre empresa, produtos, preços ou prazos. Se não souber, diga que vai verificar.
9. Use markdown (negrito) só para destacar 1-2 termos-chave por mensagem.
10. **NUNCA** use placeholders como \`[Empresa]\`, \`[área de atuação]\`, \`{{company}}\`. ${company ? `A empresa é **${company}**.` : "Se não souber, omita."}
11. **REGRA CRÍTICA — CRM**: Sempre que coletar **nome + (telefone OU email)** do usuário, ou identificar **interesse real** (orçamento, agendamento, "quero comprar/saber mais"), você **DEVE** terminar a mensagem com o bloco técnico abaixo (em uma linha separada, no FINAL da mensagem):
\`\`\`
<<<CRM_LEAD>>>
{"name":"...","email":"...","phone":"...","company":"...","position":"...","stage":"lead","source":"chat","temperature":"morno","value":0,"notes":"resumo da dor/interesse","tags":[],"meeting":null}
<<<END>>>
\`\`\`
- Use \`stage\`: "lead" (primeiro contato), "qualificado" (BANT/SPIN ok), "agendado" (reunião marcada), "ganho" (fechou), "perdido".
- Use \`temperature\`: "frio" / "morno" / "quente" conforme intenção demonstrada.
- Se houver agendamento, preencha \`meeting\`: \`{"scheduled_at":"YYYY-MM-DDTHH:mm:00-03:00","duration_minutes":30,"topic":"..."}\`.
- Se não souber um campo, use string vazia "" ou null. **Nunca omita o bloco** quando tiver os dados mínimos.
- O bloco é técnico — o sistema vai removê-lo antes de mostrar a mensagem ao usuário.

${greeting ? `# Mensagem de saudação (use APENAS na primeira interação, depois nunca mais)\n${greeting}\n` : ""}${channels ? `# Canais ativos\n${channels}\n` : ""}${tools ? `# Ferramentas disponíveis\n${tools}\n` : ""}${instructions ? `# Instruções específicas do agente\n${instructions}` : ""}`.trim();
}

/* ── Wizard system prompts (PT-BR, guided Q&A per agent type) ── */

const WIZARD_QUESTIONS: Record<string, string[]> = {
  sdr: [
    "Qual o **nome do agente** e o **nome da empresa**? (ex: Sofia da Bem+Bela)",
    "**Nicho/segmento** da empresa? (ex: clínica de estética, SaaS B2B, imobiliária, infoproduto)",
    "**Produto/serviço** principal em 1 frase + **ticket médio** aproximado.",
    "**Cliente ideal (ICP)**: descreva o perfil em 1 frase (ex: mulheres 30-50 anos que querem rejuvenescer / gestores de RH em empresas 50-500 funcionários).",
    "Top **3 dores** que vocês resolvem (1 linha cada).",
    "**Tom de voz** — escolha 1: (a) **Consultivo profissional**, (b) **Descontraído amigável** (com emojis leves), (c) **Empático acolhedor**, (d) **Direto e objetivo**, (e) **Formal corporativo**.",
    "**Metodologia de qualificação** — escolha 1: (a) **BANT** (Budget, Authority, Need, Timeline — clássico B2B), (b) **SPIN** (Situação, Problema, Implicação, Necessidade — vendas consultivas), (c) **CHAMP** (Challenges, Authority, Money, Prioritization), (d) **Qualificação leve** (só dor + urgência + interesse — ideal para B2C/estética/varejo), (e) **Custom** (descreva).",
    "O agente **agenda reuniões/consultas**? (sim / não). Se sim: qual ferramenta? (Google Calendar, Calendly, agenda interna, WhatsApp manual)",
    "Se agenda: **tipo de reunião** (consulta, demo, call descoberta, visita) + **duração** (ex: consulta 30min).",
    "Top **3 objeções** comuns + resposta padrão de cada (1 linha cada).",
    "**Limite de mensagens** antes de propor o próximo passo? (ex: após 3-4 trocas com sinal de interesse, oferecer agendamento)",
    "O que o agente **NUNCA** deve fazer? (ex: prometer resultado, dar preço sem qualificar, falar mal de concorrente)",
  ],
  sac: [
    "Qual é o **nome da sua empresa** e o produto/serviço atendido?",
    "Quais são os **tipos de solicitação mais comuns** que o agente vai receber? (dúvida, suporte técnico, troca, reclamação)",
    "Quais informações o agente precisa **coletar do cliente** para abrir/resolver um chamado?",
    "Quais **dúvidas frequentes (FAQ)** o agente deve resolver sozinho?",
    "Quando o agente deve **escalar para um humano**? E para qual canal/time?",
    "Qual o **tom de voz** desejado? (empático, formal, direto)",
  ],
  custom: [
    "Qual é o **nome do agente** e o **objetivo principal** dele?",
    "Quem é o **público-alvo** com quem ele vai conversar?",
    "Quais **tarefas** o agente precisa executar nas conversas?",
    "Quais **informações** ele deve coletar do usuário?",
    "Em que momento ele deve **encerrar** ou **escalar** a conversa?",
    "Qual o **tom de voz** desejado?",
  ],
};

function buildWizardSystemPrompt(agentType: string): string {
  const key = (agentType || "custom").toLowerCase();
  const questions = WIZARD_QUESTIONS[key] || WIZARD_QUESTIONS.custom;
  const typeLabel =
    key === "sdr" ? "SDR (qualificação de leads inbound)" :
    key === "sac" ? "SAC (atendimento ao cliente)" :
    "personalizado";

  return `Você é um **consultor sênior** especialista em montar agentes de IA do tipo **${typeLabel}** que se comportam como profissionais humanos de alta performance.

Sua missão é conduzir uma **entrevista guiada em português do Brasil**, fazendo UMA pergunta por vez, com tom acolhedor e consultivo — como se estivesse tomando um café com o cliente.

## Regras obrigatórias
1. Responda SEMPRE em português do Brasil. Nunca em inglês.
2. Faça **apenas UMA pergunta por mensagem** — nunca várias de uma vez.
3. Seja breve e humano: máximo 3 linhas por mensagem (pergunta + 1 frase de contexto/exemplo curto).
4. Use **markdown** (negrito) para destacar termos importantes.
5. Quando o usuário enviar "start", responda com uma saudação curta e calorosa, explique em 1 frase que vai fazer algumas perguntas para deixar o agente "redondo", e faça a **primeira pergunta** da lista.
6. Após cada resposta, **valide brevemente** (ex: "Boa, anotei!" ou "Ótimo exemplo, entendi.") e siga para a **próxima pergunta** da lista.
7. Se a resposta vier **vaga ou genérica** (ex: "qualquer um", "não sei", "tanto faz"), peça **um exemplo concreto** com gentileza antes de avançar — como um SDR humano faria. Mas se o usuário insistir que não sabe, sugira uma resposta padrão razoável e siga em frente.
8. NUNCA invente respostas pelo usuário. NUNCA pule perguntas da lista.
9. Quando todas as perguntas forem respondidas, finalize EXATAMENTE com: "✅ Tenho tudo o que preciso! Vou estruturar seu agente agora..."

## Roteiro de perguntas (faça nesta ordem, uma por vez)
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Comece agora.`;
}



serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      mode,
      agentType,
      agentContext,
      messages = [],
      model,
      provider,
      temperature,
      max_tokens,
      top_p,
      frequency_penalty,
      presence_penalty,
      response_format,
      stop,
    } = body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Inject system prompt: wizard for setup, operational for live chats.
    let finalMessages = messages;
    let systemPrompt = "";
    if (mode === "wizard-setup") {
      systemPrompt = buildWizardSystemPrompt(agentType);
    } else if (agentContext) {
      systemPrompt = buildOperationalSystemPrompt(agentContext);
    }
    if (systemPrompt) {
      const hasSystem = messages[0]?.role === "system";
      finalMessages = hasSystem
        ? [{ role: "system", content: systemPrompt }, ...messages.slice(1)]
        : [{ role: "system", content: systemPrompt }, ...messages];
    }

    const orPayload: Record<string, unknown> = {
      model: normalizeModel(model, provider),
      messages: finalMessages,
      stream: true,
    };
    if (typeof temperature === "number") orPayload.temperature = temperature;
    const MAX_TOKENS_CAP = 8000;
    orPayload.max_tokens = typeof max_tokens === "number"
      ? Math.min(max_tokens, MAX_TOKENS_CAP)
      : MAX_TOKENS_CAP;
    if (typeof top_p === "number") orPayload.top_p = top_p;
    if (typeof frequency_penalty === "number") orPayload.frequency_penalty = frequency_penalty;
    if (typeof presence_penalty === "number") orPayload.presence_penalty = presence_penalty;
    if (response_format) orPayload.response_format = response_format;
    if (stop) orPayload.stop = stop;

    const orResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aikortex01.lovable.app",
        "X-Title": "Aikortex",
      },
      body: JSON.stringify(orPayload),
    });

    if (!orResp.ok) {
      const errText = await orResp.text();
      console.error("OpenRouter error:", orResp.status, errText);
      const status = orResp.status === 429 ? 429 : orResp.status === 402 ? 402 : 500;
      return new Response(
        JSON.stringify({ error: `OpenRouter ${orResp.status}: ${errText.slice(0, 500)}` }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!orResp.body) {
      return new Response(JSON.stringify({ error: "No response body from OpenRouter" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(orResp.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("agent-runtime error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
