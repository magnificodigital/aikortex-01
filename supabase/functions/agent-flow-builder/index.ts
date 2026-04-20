// Edge function: agent-flow-builder
// Generates a personalized automation flow for a newly created agent
// by calling DeerFlow with the agent's config (name, type, niche, scheduling, etc.).
// Returns { name, description, nodes, edges } in React Flow format.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_URL = "https://aikortex-flow-production.up.railway.app/api/chat/completions";

const SYSTEM_PROMPT = `Você é um arquiteto de automações para a plataforma Aikortex.
Sua tarefa é GERAR um fluxo de automação React Flow JSON personalizado para um agente recém-criado, considerando o tipo, nicho e ferramentas que o usuário usa (ex: Google Calendar para agendamento).

## Regras
- Saída SEMPRE em PT-BR.
- Devolva APENAS um bloco \`\`\`json com um objeto: { "name": string, "description": string, "nodes": [...], "edges": [...] }.
- Não inclua texto fora do bloco JSON.

## Estrutura dos nodes
Cada node: {
  "id": string único,
  "type": "flowNode",
  "position": { "x": number, "y": number },
  "data": {
    "label": string,
    "category": "trigger" | "processing" | "data_capture" | "crm_actions" | "knowledge" | "control" | "output" | "integration",
    "icon": emoji curto,
    "color": "#hex",
    "nodeType": string (ex: trigger_chat, agent_ai, capture_name, capture_email, crm_create_lead, calendar_create_event, knowledge_search, send_message, intent_classifier, human_in_loop, memory_lookup),
    "description": string curta,
    "config": object (ex: { agentId, model, prompt, variable, provider: "google_calendar"|"calendly"|"internal", ... })
  }
}

## Edges
{ "id": "e-source-target", "source": id, "target": id }

## Layout
- Posicione nodes da esquerda para direita, y=200, espaçamento horizontal de 280px.

## Padrões por tipo de agente
- **SDR com agendamento**: trigger_chat → agent_ai → capture_name → capture_email → intent_qualify → calendar_create_event (use o provider correto: google_calendar/calendly/internal) → crm_create_lead → send_message
- **SDR sem agendamento**: trigger_chat → agent_ai → capture_name → capture_email → crm_create_lead → crm_create_followup → send_message
- **SAC**: trigger_chat → agent_ai → intent_classifier → knowledge_search → human_in_loop (condicional) → send_message
- **Custom**: trigger_chat → agent_ai → memory_lookup → send_message

Sempre conecte o node agent_ai ao agentId fornecido em config.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent } = await req.json().catch(() => ({}));
    if (!agent || !agent.id || !agent.name) {
      return new Response(JSON.stringify({ error: "agent payload required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = agent.config || {};
    const niche = cfg.niche || cfg.companyDescription || cfg.companyName || "não informado";
    const scheduling = cfg.scheduling || cfg.calendarTool || (typeof cfg.instructions === "string" && /agend|calend|reuni|consult/i.test(cfg.instructions) ? "provável" : "não informado");
    const calendarTool = cfg.calendarTool || cfg.scheduleTool || "não especificado";

    const userPrompt = `Gere o fluxo de automação para este agente:

- ID: ${agent.id}
- Nome: ${agent.name}
- Tipo: ${agent.agent_type || "Custom"}
- Modelo: ${agent.model || "gemini-2.5-flash"}
- Nicho/Empresa: ${niche}
- Agenda reuniões: ${scheduling}
- Ferramenta de agenda: ${calendarTool}
- Objetivo: ${cfg.objective || cfg.description || "não informado"}
- Instruções resumidas: ${(cfg.instructions || "").slice(0, 600)}

Retorne APENAS o bloco \`\`\`json com { name, description, nodes, edges }.`;

    const url = Deno.env.get("DEERFLOW_URL") || FALLBACK_URL;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 3000,
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("DeerFlow error:", resp.status, t.slice(0, 300));
      return new Response(JSON.stringify({ error: `DeerFlow ${resp.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content || "";
    const match = content.match(/```json\s*([\s\S]*?)```/);
    const jsonStr = match ? match[1].trim() : content.trim();

    let flow: any;
    try {
      flow = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse flow JSON:", jsonStr.slice(0, 400));
      return new Response(JSON.stringify({ error: "Invalid flow JSON from DeerFlow", raw: content.slice(0, 600) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure each node has type: "flowNode"
    if (Array.isArray(flow.nodes)) {
      flow.nodes = flow.nodes.map((n: any) => ({ ...n, type: n.type || "flowNode" }));
    }

    return new Response(JSON.stringify({ flow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-flow-builder error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
