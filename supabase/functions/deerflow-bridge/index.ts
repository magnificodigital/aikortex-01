// ==========================================================================
// deerflow-bridge
// --------------------------------------------------------------------------
// Supabase Edge Function that sits between Aikortex and the DeerFlow Gateway.
// It handles:
//   - provisioning agents in DeerFlow
//   - creating & reusing threads per conversation
//   - dispatching sync messages and async research jobs
//   - (optional) streaming back SSE to the client
//
// Env vars (set in Supabase dashboard → Edge Functions → Secrets):
//   DEERFLOW_BASE_URL           → https://aikortex-flow-production.up.railway.app
//   DEERFLOW_API_KEY            → optional shared secret (Bearer), ignored if empty
//   DEERFLOW_DEFAULT_ASSISTANT  → assistant_id to use (default: "lead_agent")
// ==========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --------------------------------------------------------------------------
// CORS — the frontend calls this function from the browser
// --------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------
const DEERFLOW_BASE_URL =
  (Deno.env.get("DEERFLOW_BASE_URL") ?? "").replace(/\/$/, "");
const DEERFLOW_API_KEY = Deno.env.get("DEERFLOW_API_KEY") ?? "";
const DEERFLOW_DEFAULT_ASSISTANT =
  Deno.env.get("DEERFLOW_DEFAULT_ASSISTANT") ?? "lead_agent";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
type Action =
  | "ping"
  | "provision_agent"
  | "chat"
  | "chat_stream"
  | "start_research"
  | "get_run"
  | "cancel_run"
  | "list_threads";

interface BridgeRequest {
  action: Action;
  agent_id?: string;         // Aikortex user_agents.id
  thread_ref?: {             // how Aikortex identifies a conversation
    channel: string;         // "web", "whatsapp", etc.
    external_ref?: string;   // phone, lead id, ...
  };
  message?: string;          // user input for chat actions
  context?: Record<string, unknown>; // extra state passed to the agent
  run_id?: string;           // for get_run / cancel_run
  agent_config?: AgentConfig; // for provision_agent
}

interface AgentConfig {
  name: string;
  description?: string;
  objective?: string;
  instructions?: string;
  greeting_message?: string;
  tone?: string;
  agent_type?: string;
  skills?: string[];         // list of DeerFlow skill names to enable
  model?: string;            // DeerFlow model name
  metadata?: Record<string, unknown>;
}

// --------------------------------------------------------------------------
// Small DeerFlow HTTP client
// --------------------------------------------------------------------------
async function deerflow<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const url = `${DEERFLOW_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (DEERFLOW_API_KEY) {
    headers["Authorization"] = `Bearer ${DEERFLOW_API_KEY}`;
  }
  const resp = await fetch(url, { ...init, headers });
  const text = await resp.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { ok: resp.ok, status: resp.status, data, text };
}

// --------------------------------------------------------------------------
// Supabase admin client (service role) — for writing to our bookkeeping tables
// --------------------------------------------------------------------------
function supaAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function bad(message: string, status = 400) {
  return json({ error: message }, { status });
}

async function authenticateUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// Find-or-create a DeerFlow thread for (agent_id, channel, external_ref)
async function resolveThread(
  userId: string,
  agentId: string,
  channel: string,
  externalRef: string | undefined,
): Promise<{ deerflow_thread_id: string; local_id: string } | null> {
  const admin = supaAdmin();

  // 1) Try to find existing mapping
  const { data: existing } = await admin
    .from("deerflow_threads")
    .select("id, deerflow_thread_id")
    .eq("agent_id", agentId)
    .eq("channel", channel)
    .eq("external_ref", externalRef ?? "")
    .maybeSingle();

  if (existing?.deerflow_thread_id) {
    return {
      deerflow_thread_id: existing.deerflow_thread_id,
      local_id: existing.id,
    };
  }

  // 2) Create a new DeerFlow thread
  const res = await deerflow<{ thread_id: string }>("/api/threads", {
    method: "POST",
    body: JSON.stringify({
      metadata: {
        source: "aikortex",
        agent_id: agentId,
        user_id: userId,
        channel,
        external_ref: externalRef ?? null,
      },
    }),
  });
  if (!res.ok || !res.data?.thread_id) {
    console.error("deerflow thread create failed", res.status, res.text);
    return null;
  }

  // 3) Save the mapping
  const { data: inserted, error: insertError } = await admin
    .from("deerflow_threads")
    .insert({
      user_id: userId,
      agent_id: agentId,
      deerflow_thread_id: res.data.thread_id,
      channel,
      external_ref: externalRef ?? "",
    })
    .select("id")
    .single();
  if (insertError) {
    console.error("thread mapping insert failed", insertError);
    return null;
  }

  return {
    deerflow_thread_id: res.data.thread_id,
    local_id: inserted.id,
  };
}

// Extract the textual reply from a DeerFlow run response.
// DeerFlow returns structured state; we look for the last assistant message.
function extractAssistantReply(runOutput: unknown): string {
  if (!runOutput || typeof runOutput !== "object") return "";
  const out = runOutput as Record<string, unknown>;

  // Most common path: { messages: [{role, content, ...}, ...] }
  const messages = (out.messages ?? (out.output as any)?.messages) as
    | Array<{ role?: string; type?: string; content?: unknown }>
    | undefined;
  if (Array.isArray(messages) && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const role = m.role ?? m.type;
      if (role === "assistant" || role === "ai") {
        if (typeof m.content === "string") return m.content;
        if (Array.isArray(m.content)) {
          return m.content
            .map((c: any) => (typeof c === "string" ? c : c?.text ?? ""))
            .join("");
        }
      }
    }
  }

  // Fallbacks
  if (typeof out.final_response === "string") return out.final_response;
  if (typeof out.output === "string") return out.output;
  return "";
}

// --------------------------------------------------------------------------
// Action handlers
// --------------------------------------------------------------------------

async function handlePing() {
  const health = await deerflow<{ status?: string }>("/health");
  const models = await deerflow<{ models: unknown[] }>("/api/models");
  return json({
    ok: health.ok && models.ok,
  });
}

async function handleProvisionAgent(
  userId: string,
  agentId: string | undefined,
  config: AgentConfig | undefined,
) {
  if (!agentId) return bad("agent_id is required");
  if (!config) return bad("agent_config is required");

  const admin = supaAdmin();

  // Deterministic DeerFlow agent name: aikortex_<agent_id_first_8>
  const safeName = `aikortex-${agentId.replace(/-/g, "").slice(0, 12)}`;

  // Build a DeerFlow-compatible payload. Adjust keys as your DeerFlow schema
  // evolves. Current expected shape (from /api/agents POST):
  const payload = {
    name: safeName,
    description: config.description ?? config.name,
    instructions: config.instructions ?? "",
    greeting: config.greeting_message ?? "",
    tone: config.tone ?? "professional_friendly",
    model: config.model ?? null,
    skills: config.skills ?? [],
    metadata: {
      source: "aikortex",
      aikortex_agent_id: agentId,
      aikortex_user_id: userId,
      agent_type: config.agent_type ?? "Custom",
      ...(config.metadata ?? {}),
    },
  };

  // Check if it already exists, then PUT, else POST
  const existing = await deerflow(`/api/agents/${safeName}`);
  const method = existing.status === 200 ? "PUT" : "POST";
  const path = method === "PUT" ? `/api/agents/${safeName}` : "/api/agents";

  const res = await deerflow(path, {
    method,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return json(
      { error: "deerflow provisioning failed", status: res.status, body: res.text },
      { status: 502 },
    );
  }

  // Save the linkage on our side
  const { error: updErr } = await admin
    .from("user_agents")
    .update({
      execution_engine: "deerflow",
      deerflow_agent_name: safeName,
      deerflow_meta: {
        provisioned_at: new Date().toISOString(),
        skills: config.skills ?? [],
        model: config.model ?? null,
      },
    })
    .eq("id", agentId)
    .eq("user_id", userId);

  if (updErr) {
    console.error("user_agents update failed", updErr);
    return json(
      { error: "provisioned in deerflow but failed to persist linkage" },
      { status: 500 },
    );
  }

  return json({ ok: true, deerflow_agent_name: safeName });
}

async function handleChat(
  userId: string,
  body: BridgeRequest,
): Promise<Response> {
  const { agent_id, message, thread_ref, context } = body;
  if (!agent_id) return bad("agent_id is required");
  if (!message) return bad("message is required");
  const channel = thread_ref?.channel ?? "web";
  const externalRef = thread_ref?.external_ref;

  const admin = supaAdmin();

  // Fetch the agent to get the deerflow_agent_name
  const { data: agent, error } = await admin
    .from("user_agents")
    .select("id, user_id, deerflow_agent_name, execution_engine")
    .eq("id", agent_id)
    .eq("user_id", userId)
    .single();
  if (error || !agent) return bad("agent not found", 404);
  if (agent.execution_engine !== "deerflow") {
    return bad("agent is not configured to use DeerFlow", 409);
  }

  // Resolve/create thread
  const thread = await resolveThread(userId, agent_id, channel, externalRef);
  if (!thread) return bad("failed to create DeerFlow thread", 502);

  // Book-keep the run
  const { data: runRow } = await admin
    .from("deerflow_runs")
    .insert({
      user_id: userId,
      agent_id,
      thread_id: thread.local_id,
      mode: "sync",
      status: "running",
      input: { message, context: context ?? {} },
    })
    .select("id")
    .single();

  const t0 = Date.now();

  const assistantId = agent.deerflow_agent_name ?? DEERFLOW_DEFAULT_ASSISTANT;
  const runRes = await deerflow<Record<string, unknown>>(
    `/api/threads/${thread.deerflow_thread_id}/runs/wait`,
    {
      method: "POST",
      body: JSON.stringify({
        assistant_id: assistantId,
        input: {
          messages: [{ role: "user", content: message }],
        },
        // Pass any Aikortex context the skills may want to consume
        context: context ?? {},
      }),
    },
  );

  const latency_ms = Date.now() - t0;

  if (!runRes.ok) {
    if (runRow?.id) {
      await admin.from("deerflow_runs").update({
        status: "error",
        error: `HTTP ${runRes.status}: ${runRes.text.slice(0, 500)}`,
        latency_ms,
        finished_at: new Date().toISOString(),
      }).eq("id", runRow.id);
    }
    return json(
      { error: "deerflow run failed", status: runRes.status, body: runRes.text },
      { status: 502 },
    );
  }

  const reply = extractAssistantReply(runRes.data);
  const deerflowRunId =
    (runRes.data as any)?.run_id ?? (runRes.data as any)?.id ?? null;

  if (runRow?.id) {
    await admin.from("deerflow_runs").update({
      status: "success",
      deerflow_run_id: deerflowRunId,
      output: { reply, raw: runRes.data },
      latency_ms,
      finished_at: new Date().toISOString(),
    }).eq("id", runRow.id);
  }

  return json({
    ok: true,
    reply,
    thread_id: thread.deerflow_thread_id,
    run_id: deerflowRunId,
    latency_ms,
  });
}

// Async research: kick off a run WITHOUT waiting. Client polls /get_run or
// we can later add a webhook → realtime push.
async function handleStartResearch(
  userId: string,
  body: BridgeRequest,
): Promise<Response> {
  const { agent_id, message, thread_ref, context } = body;
  if (!agent_id) return bad("agent_id is required");
  if (!message) return bad("message is required");
  const channel = thread_ref?.channel ?? "web";
  const externalRef = thread_ref?.external_ref;

  const admin = supaAdmin();

  const { data: agent } = await admin
    .from("user_agents")
    .select("id, deerflow_agent_name")
    .eq("id", agent_id)
    .eq("user_id", userId)
    .maybeSingle();

  const thread = await resolveThread(userId, agent_id, channel, externalRef);
  if (!thread) return bad("failed to create thread", 502);

  const assistantId = agent?.deerflow_agent_name ?? DEERFLOW_DEFAULT_ASSISTANT;

  // Fire-and-forget: POST /runs WITHOUT /wait
  const runRes = await deerflow<{ run_id?: string; id?: string }>(
    `/api/threads/${thread.deerflow_thread_id}/runs`,
    {
      method: "POST",
      body: JSON.stringify({
        assistant_id: assistantId,
        input: { messages: [{ role: "user", content: message }] },
        context: context ?? {},
      }),
    },
  );
  if (!runRes.ok) {
    return json(
      { error: "failed to start deerflow run", status: runRes.status, body: runRes.text },
      { status: 502 },
    );
  }

  const deerflowRunId = runRes.data?.run_id ?? runRes.data?.id ?? null;

  const { data: runRow } = await admin.from("deerflow_runs").insert({
    user_id: userId,
    agent_id,
    thread_id: thread.local_id,
    deerflow_run_id: deerflowRunId,
    mode: "async",
    status: "running",
    input: { message, context: context ?? {} },
  }).select("id").single();

  return json({
    ok: true,
    run_id: runRow?.id,
    deerflow_run_id: deerflowRunId,
    thread_id: thread.deerflow_thread_id,
    status: "running",
  });
}

// Poll a run's status (used by client while an async research runs).
async function handleGetRun(userId: string, runId: string | undefined) {
  if (!runId) return bad("run_id is required");
  const admin = supaAdmin();
  const { data: run, error } = await admin
    .from("deerflow_runs")
    .select("*, deerflow_threads(deerflow_thread_id)")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !run) return bad("run not found", 404);
  if (run.status !== "running") return json({ ok: true, run });

  // Still running? Ask DeerFlow for the latest state.
  const threadId = (run as any).deerflow_threads?.deerflow_thread_id;
  if (!threadId || !run.deerflow_run_id) return json({ ok: true, run });

  const res = await deerflow<Record<string, unknown>>(
    `/api/threads/${threadId}/runs/${run.deerflow_run_id}`,
  );
  if (!res.ok) return json({ ok: true, run });

  const state = (res.data as any)?.status ?? "running";
  if (state === "success" || state === "error" || state === "cancelled") {
    const reply = extractAssistantReply(res.data);
    await admin.from("deerflow_runs").update({
      status: state,
      output: { reply, raw: res.data },
      finished_at: new Date().toISOString(),
    }).eq("id", runId);
  }

  return json({ ok: true, run, remote: res.data });
}

async function handleCancelRun(userId: string, runId: string | undefined) {
  if (!runId) return bad("run_id is required");
  const admin = supaAdmin();
  const { data: run } = await admin
    .from("deerflow_runs")
    .select("*, deerflow_threads(deerflow_thread_id)")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!run) return bad("run not found", 404);
  const threadId = (run as any).deerflow_threads?.deerflow_thread_id;
  if (!threadId || !run.deerflow_run_id) return bad("run is not cancellable", 409);

  const res = await deerflow(
    `/api/threads/${threadId}/runs/${run.deerflow_run_id}/cancel`,
    { method: "POST" },
  );

  if (res.ok) {
    await admin.from("deerflow_runs").update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
    }).eq("id", runId);
  }

  return json({ ok: res.ok });
}

async function handleListThreads(userId: string, agentId: string | undefined) {
  if (!agentId) return bad("agent_id is required");
  const admin = supaAdmin();
  const { data, error } = await admin
    .from("deerflow_threads")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false });
  if (error) return bad(error.message, 500);
  return json({ ok: true, threads: data });
}

// Streaming variant: pipes DeerFlow SSE back to the client.
// Useful for real-time chat UIs that want token-by-token rendering.
async function handleChatStream(
  userId: string,
  body: BridgeRequest,
): Promise<Response> {
  const { agent_id, message, thread_ref, context } = body;
  if (!agent_id) return bad("agent_id is required");
  if (!message) return bad("message is required");
  const channel = thread_ref?.channel ?? "web";
  const externalRef = thread_ref?.external_ref;

  const admin = supaAdmin();
  const { data: agent } = await admin
    .from("user_agents")
    .select("id, deerflow_agent_name")
    .eq("id", agent_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) return bad("agent not found", 404);

  const thread = await resolveThread(userId, agent_id, channel, externalRef);
  if (!thread) return bad("failed to create thread", 502);

  const assistantId = agent.deerflow_agent_name ?? DEERFLOW_DEFAULT_ASSISTANT;
  const url =
    `${DEERFLOW_BASE_URL}/api/threads/${thread.deerflow_thread_id}/runs/stream`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (DEERFLOW_API_KEY) headers["Authorization"] = `Bearer ${DEERFLOW_API_KEY}`;

  const upstream = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      assistant_id: assistantId,
      input: { messages: [{ role: "user", content: message }] },
      context: context ?? {},
      stream_mode: "messages",
    }),
  });
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return json(
      { error: "failed to open deerflow stream", status: upstream.status, body: text },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// --------------------------------------------------------------------------
// Entry point
// --------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return bad("method not allowed", 405);
  }
  if (!DEERFLOW_BASE_URL) {
    return bad("DEERFLOW_BASE_URL env var is not set", 500);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return bad("Supabase service credentials are not configured", 500);
  }

  let body: BridgeRequest;
  try {
    body = await req.json();
  } catch {
    return bad("invalid JSON body");
  }

  const user = await authenticateUser(req);
  if (!user) return bad("unauthorized", 401);

  try {
    switch (body.action) {
      case "ping":
        return await handlePing();
      case "provision_agent":
        return await handleProvisionAgent(user.id, body.agent_id, body.agent_config);
      case "chat":
        return await handleChat(user.id, body);
      case "chat_stream":
        return await handleChatStream(user.id, body);
      case "start_research":
        return await handleStartResearch(user.id, body);
      case "get_run":
        return await handleGetRun(user.id, body.run_id);
      case "cancel_run":
        return await handleCancelRun(user.id, body.run_id);
      case "list_threads":
        return await handleListThreads(user.id, body.agent_id);
      default:
        return bad(`unknown action: ${body.action}`);
    }
  } catch (e) {
    console.error("deerflow-bridge error", e);
    return json(
      { error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 },
    );
  }
});
