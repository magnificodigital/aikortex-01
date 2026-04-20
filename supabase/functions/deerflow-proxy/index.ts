// Edge function: deerflow-proxy
// Proxies chat-completion requests to the DeerFlow service.
// Used by FlowCopilotPanel and agent-flow-builder.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_URL = "https://aikortex-flow-production.up.railway.app/api/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("DEERFLOW_URL") || FALLBACK_URL;
    const body = await req.json().catch(() => ({}));
    const { messages = [], model, temperature, max_tokens } = body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages must be a non-empty array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        model: model || "gpt-4o-mini",
        temperature: typeof temperature === "number" ? temperature : 0.4,
        max_tokens: typeof max_tokens === "number" ? max_tokens : 2400,
        stream: false,
      }),
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error("DeerFlow error:", resp.status, text.slice(0, 500));
      return new Response(JSON.stringify({ error: `DeerFlow ${resp.status}`, detail: text.slice(0, 600) }), {
        status: resp.status === 429 ? 429 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(text, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("deerflow-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
