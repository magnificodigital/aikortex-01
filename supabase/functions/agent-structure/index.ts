// Edge function: agent-structure
// Converts a wizard Q&A transcript (or free-form description) into a fully
// structured agent config in PT-BR, including a high-quality `instructions`
// prompt organized in clear stages using prompt-engineering best practices.
//
// Uses the Lovable AI Gateway (LOVABLE_API_KEY) — no user BYOK needed.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `Você é um arquiteto sênior de agentes de IA. Sua tarefa é transformar a descrição (ou entrevista) fornecida pelo usuário em uma configuração COMPLETA de agente, em português do Brasil.

Você deve devolver SEMPRE via tool call \`build_agent_config\`, preenchendo todos os campos.

## Como escrever o campo "instructions"
O campo \`instructions\` é o **prompt operacional** do agente. Ele deve ser claro, profissional e organizado em **etapas numeradas**, usando markdown. Use as melhores técnicas de engenharia de prompt:

- Comece com **# 1. Identidade** (nome, papel, empresa, persona).
- **# 2. Objetivo Principal** (o que o agente precisa alcançar em cada conversa).
- **# 3. Público-Alvo** (com quem ele fala).
- **# 4. Tom de Voz e Estilo** (como ele se comunica).
- **# 5. Fluxo da Conversa** (passo a passo: abertura → descoberta → qualificação/resolução → encaminhamento → encerramento). Numere os passos com clareza.
- **# 6. Informações a Coletar** (lista de dados que devem ser obtidos do usuário).
- **# 7. Regras e Restrições** (o que NUNCA fazer, limites, quando escalar).
- **# 8. Critérios de Sucesso** (como reconhecer que a conversa atingiu o objetivo).

Cada seção deve ter de 2 a 6 bullets curtos e acionáveis. Seja específico ao contexto do usuário — NÃO invente fatos sobre a empresa: use apenas o que foi informado, e quando faltar algo, use placeholders entre colchetes (ex: \`[nome do produto]\`).

## Outras regras
- \`agent_name\`: curto e descritivo (ex: "Sofia • SDR Imobiliária").
- \`description\`: 1 frase resumindo o agente.
- \`objective\`: 1-2 frases — o que o agente faz e para quem.
- \`tone\`: escolha um valor coerente (Profissional e Amigável, Formal, Casual e Descontraído, Empático e Acolhedor, Direto e Objetivo).
- \`greeting_message\`: mensagem de abertura natural, em PT-BR, máximo 2 linhas.
- \`channels\`: array com canais sugeridos (ex: ["whatsapp", "web"]).
- \`language\`: sempre "pt-BR".`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "build_agent_config",
    description: "Devolve a configuração completa do agente.",
    parameters: {
      type: "object",
      properties: {
        agent_name: { type: "string" },
        agent_type: { type: "string" },
        description: { type: "string" },
        objective: { type: "string" },
        tone: { type: "string" },
        language: { type: "string" },
        greeting_message: { type: "string" },
        instructions: {
          type: "string",
          description: "Prompt operacional COMPLETO em markdown, organizado em seções numeradas (# 1. Identidade, # 2. Objetivo, ...).",
        },
        channels: { type: "array", items: { type: "string" } },
      },
      required: [
        "agent_name", "agent_type", "description", "objective",
        "tone", "language", "greeting_message", "instructions", "channels",
      ],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { description, agent_type = "custom", language = "pt-BR" } = await req.json().catch(() => ({}));
    if (!description || typeof description !== "string") {
      return new Response(JSON.stringify({ error: "description is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Tipo do agente: **${agent_type}**.
Idioma: **${language}**.

Conteúdo (entrevista ou descrição) fornecido pelo usuário:
"""
${description}
"""

Gere a configuração completa via \`build_agent_config\`.`;

    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "build_agent_config" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Gateway error:", resp.status, t);
      const status = resp.status === 429 ? 429 : resp.status === 402 ? 402 : 500;
      return new Response(JSON.stringify({ error: `Gateway ${resp.status}: ${t.slice(0, 400)}` }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      console.error("No tool call in response:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "No structured config returned" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try { parsed = typeof args === "string" ? JSON.parse(args) : args; }
    catch (e) {
      return new Response(JSON.stringify({ error: "Failed to parse config", raw: args }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ structuredConfig: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-structure error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
