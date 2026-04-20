// ==========================================================================
// agent-chat PATCH — hybrid routing
// --------------------------------------------------------------------------
// Drop this block near the top of supabase/functions/agent-chat/index.ts,
// right after authentication and agent lookup but BEFORE your existing
// native pipeline (Lovable Gateway / OpenRouter / Groq).
//
// The idea: when the agent is configured with execution_engine='deerflow',
// we forward the request to the deerflow-bridge Edge Function and return
// its response straight to the client. The native pipeline stays untouched.
// ==========================================================================

// 1) Make sure your agent lookup includes the new columns. Example:
//
//    const { data: agent } = await supa
//      .from("user_agents")
//      .select("id, user_id, name, model, config, execution_engine, deerflow_agent_name")
//      .eq("id", agentId)
//      .single();

// 2) Add this early-return block:

if (agent?.execution_engine === "deerflow") {
  const bridgeUrl = `${SUPABASE_URL}/functions/v1/deerflow-bridge`;

  // Forward the user's JWT so deerflow-bridge can authenticate them.
  const authHeader = req.headers.get("Authorization") ?? "";

  // Try to figure out the last user message. The agent-chat payload uses
  // an array of messages — grab the latest user one.
  const lastUserMessage = [...(messages ?? [])]
    .reverse()
    .find((m: { role: string; content: string }) => m.role === "user")
    ?.content ?? "";

  const bridgeResp = await fetch(bridgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      action: "chat", // use "chat_stream" if your frontend supports SSE
      agent_id: agent.id,
      message: lastUserMessage,
      thread_ref: {
        channel: channel ?? "web",
        external_ref: externalRef ?? undefined,
      },
      context: {
        // Pass any runtime context you want skills to receive.
        // Useful for CRM writeback, lead attribution, etc.
        aikortex_agent_name: agent.name,
        user_id: agent.user_id,
      },
    }),
  });

  // Pass through status + body verbatim.
  const bodyText = await bridgeResp.text();
  return new Response(bodyText, {
    status: bridgeResp.status,
    headers: {
      ...corsHeaders,
      "Content-Type":
        bridgeResp.headers.get("Content-Type") ?? "application/json",
    },
  });
}

// ---- Native pipeline continues below (untouched) ----
