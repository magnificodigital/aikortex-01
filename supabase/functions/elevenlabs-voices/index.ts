import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // 1. Try user's own ElevenLabs key (RLS scopes to their own row)
    const { data: keyRow } = await userClient
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", userId)
      .eq("provider", "elevenlabs")
      .maybeSingle();

    let apiKey: string | null = keyRow?.api_key ?? null;
    const isUserKey = !!apiKey;

    // 2. Fallback to platform key — read with service role (RLS no longer allows client)
    if (!apiKey) {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: platformRow } = await adminClient
        .from("platform_config")
        .select("value")
        .eq("key", "elevenlabs_api_key")
        .maybeSingle();
      apiKey = platformRow?.value ?? null;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Nenhuma chave ElevenLabs disponível", voices: [], hasUserKey: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao buscar vozes da ElevenLabs", voices: [], hasUserKey: isUserKey }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    let voices = (data.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      preview_url: v.preview_url || null,
      category: v.category || "premade",
      labels: v.labels || {},
    }));

    // Limit platform voices to 6 (never expose full catalog when using shared key)
    if (!isUserKey) voices = voices.slice(0, 6);

    return new Response(
      JSON.stringify({ voices, hasUserKey: isUserKey }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("elevenlabs-voices error:", e);
    return new Response(
      JSON.stringify({ error: "Erro interno", voices: [], hasUserKey: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
