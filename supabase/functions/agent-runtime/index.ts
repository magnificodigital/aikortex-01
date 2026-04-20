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
    "Qual **nome** você quer dar ao seu agente SDR? (ex: Sofia, Lucas, Ana — algo humano e fácil de lembrar)",
    "Qual **tom de voz** ele deve ter? (ex: consultivo e empático, formal e corporativo, descontraído e próximo)",
    "Qual o **nome da sua empresa** e em **uma frase**, o que vocês fazem?",
    "Qual é o **principal produto ou serviço** que o agente vai oferecer? Descreva de forma simples como você apresentaria a um amigo.",
    "Quem é o seu **cliente ideal (ICP)**? Pense em segmento, porte da empresa e cargo da pessoa que normalmente compra de você.",
    "Quais são as **3 maiores dores** que o seu cliente tem hoje — e que o seu produto resolve?",
    "Quais **perguntas de descoberta** o agente deve fazer para entender se o lead está pronto? (ex: tamanho do time, situação atual, urgência)",
    "Como qualificar **BANT**? Conta brevemente: faixa de **Budget** típica, quem costuma ser o **decisor**, qual a **dor crítica** e o **prazo** ideal de implementação.",
    "Quais são as **3 objeções mais comuns** que vocês ouvem (ex: \"está caro\", \"vou pensar\", \"já uso outro\") e como o time costuma responder?",
    "Qual é a **proposta de valor** em 1-2 frases — o motivo pelo qual o cliente escolhe vocês em vez do concorrente?",
    "Como o agente deve **agendar a reunião**? Cole aqui o **link da agenda** (Calendly, Google Calendar) ou diga: nome do vendedor + janelas típicas de horário.",
    "Por fim: o que o agente **NUNCA** deve fazer? (ex: não falar de preço sem qualificar, não prometer prazo, não negociar desconto)",
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

    // Inject wizard system prompt (PT-BR guided Q&A) when running setup wizard.
    let finalMessages = messages;
    if (mode === "wizard-setup") {
      const systemPrompt = buildWizardSystemPrompt(agentType);
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
