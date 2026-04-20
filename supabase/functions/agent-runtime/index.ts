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

function normalizeModel(model: string | undefined, provider?: string): string {
  if (!model) return DEFAULT_MODEL;
  if (model.includes("/")) return model;
  switch ((provider || "").toLowerCase()) {
    case "openai": return `openai/${model}`;
    case "anthropic": return `anthropic/${model}`;
    case "gemini":
    case "google": return `google/${model}`;
    case "groq": return `groq/${model}`;
    default: return model;
  }
}

/* ── Wizard system prompts (PT-BR, guided Q&A per agent type) ── */

const WIZARD_QUESTIONS: Record<string, string[]> = {
  sdr: [
    "Qual é o **nome da sua empresa** e o que ela vende?",
    "Qual é o **perfil de cliente ideal (ICP)** que você quer qualificar? (segmento, porte, cargo)",
    "Quais são os **principais critérios de qualificação** que o agente deve usar? (ex: orçamento, urgência, autoridade)",
    "Quais **perguntas de descoberta** o agente deve fazer ao lead?",
    "Qual é a **proposta de valor** que o agente deve comunicar?",
    "Quais são as **objeções mais comuns** e como respondê-las?",
    "Para qual **time/pessoa** o lead qualificado deve ser encaminhado? (e como — calendário, WhatsApp, e-mail)",
    "Qual o **tom de voz** desejado? (formal, consultivo, descontraído)",
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

  return `Você é um **assistente de configuração** que vai ajudar o usuário a montar um agente de IA do tipo **${typeLabel}**.

Sua missão é conduzir uma entrevista guiada **em português do Brasil**, fazendo UMA pergunta por vez, para coletar todas as informações necessárias.

## Regras obrigatórias
1. Responda SEMPRE em português do Brasil. Nunca em inglês.
2. Faça **apenas UMA pergunta por mensagem** — nunca várias de uma vez.
3. Seja breve e direto: máximo 2-3 linhas por mensagem (pergunta + contexto curto se necessário).
4. Use **markdown** (negrito) para destacar termos importantes.
5. Quando o usuário enviar "start", responda com uma saudação curta apresentando-se e faça a **primeira pergunta** da lista.
6. Após cada resposta do usuário, agradeça brevemente e siga para a **próxima pergunta** da lista.
7. NÃO invente respostas pelo usuário. Se a resposta for vaga, peça para detalhar.
8. Quando todas as perguntas forem respondidas, finalize com: "✅ Tenho tudo o que preciso! Vou estruturar seu agente agora..."

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

    const orPayload: Record<string, unknown> = {
      model: normalizeModel(model, provider),
      messages,
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
