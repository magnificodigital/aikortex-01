import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BRIDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deerflow-bridge`;

type ThreadRef = { channel: string; external_ref?: string };

type AgentConfig = {
  name: string;
  description?: string;
  objective?: string;
  instructions?: string;
  greeting_message?: string;
  tone?: string;
  agent_type?: string;
  skills?: string[];
  model?: string;
  metadata?: Record<string, unknown>;
};

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function callBridge<T = unknown>(body: unknown): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* noop */ }
  if (!res.ok) {
    const msg = (parsed as { error?: string })?.error ?? text ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return parsed as T;
}

export type DeerflowChatResult = {
  ok: boolean;
  reply: string;
  thread_id: string;
  run_id?: string | null;
  latency_ms: number;
};

export type DeerflowResearchStart = {
  ok: boolean;
  run_id: string;
  deerflow_run_id?: string | null;
  thread_id: string;
  status: "running";
};

export type DeerflowRunStatus = {
  ok: boolean;
  run: {
    id: string;
    status: "pending" | "running" | "success" | "error" | "cancelled";
    output: { reply?: string; raw?: unknown } | null;
    error?: string | null;
    latency_ms?: number | null;
    finished_at?: string | null;
  };
  remote?: unknown;
};

export function useDeerflowBridge() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ping = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      return await callBridge<{ ok: boolean; models?: unknown }>({ action: "ping" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally { setLoading(false); }
  }, []);

  const provisionAgent = useCallback(
    async (agentId: string, config: AgentConfig) => {
      setLoading(true); setError(null);
      try {
        return await callBridge<{ ok: boolean; deerflow_agent_name: string }>({
          action: "provision_agent",
          agent_id: agentId,
          agent_config: config,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally { setLoading(false); }
    },
    [],
  );

  const chat = useCallback(
    async (
      agentId: string,
      message: string,
      opts?: { thread_ref?: ThreadRef; context?: Record<string, unknown> },
    ) => {
      setLoading(true); setError(null);
      try {
        return await callBridge<DeerflowChatResult>({
          action: "chat",
          agent_id: agentId,
          message,
          thread_ref: opts?.thread_ref ?? { channel: "web" },
          context: opts?.context,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally { setLoading(false); }
    },
    [],
  );

  const startResearch = useCallback(
    async (
      agentId: string,
      message: string,
      opts?: { thread_ref?: ThreadRef; context?: Record<string, unknown> },
    ) => {
      setLoading(true); setError(null);
      try {
        return await callBridge<DeerflowResearchStart>({
          action: "start_research",
          agent_id: agentId,
          message,
          thread_ref: opts?.thread_ref ?? { channel: "web" },
          context: opts?.context,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally { setLoading(false); }
    },
    [],
  );

  const getRun = useCallback(async (runId: string) => {
    return await callBridge<DeerflowRunStatus>({ action: "get_run", run_id: runId });
  }, []);

  const cancelRun = useCallback(async (runId: string) => {
    return await callBridge<{ ok: boolean }>({ action: "cancel_run", run_id: runId });
  }, []);

  const waitForRun = useCallback(
    async (runId: string, intervalMs = 2500, timeoutMs = 600_000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const res = await getRun(runId);
        if (res.run.status !== "running" && res.run.status !== "pending") {
          return res;
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      throw new Error("Research run timed out");
    },
    [getRun],
  );

  return {
    loading,
    error,
    ping,
    provisionAgent,
    chat,
    startResearch,
    getRun,
    cancelRun,
    waitForRun,
  };
}
