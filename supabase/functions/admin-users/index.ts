import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreatePayload {
  action: "create";
  email: string;
  password: string;
  full_name: string;
  role: string;
  tenant_type: "platform" | "agency" | "client";
  department?: string;
  job_title?: string;
  workspace_owner_user_id?: string;
}

const PLATFORM_ROLES = ["platform_owner", "platform_admin"];
const AGENCY_ROLES = ["agency_owner", "agency_admin", "agency_manager", "agency_member"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json() as CreatePayload;

    if (body.action !== "create") {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load caller profile to authorize
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role, tenant_type")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!callerProfile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPlatform = PLATFORM_ROLES.includes(callerProfile.role);
    const isAgencyAdmin = ["agency_owner", "agency_admin"].includes(callerProfile.role);

    // Authorization rules
    if (PLATFORM_ROLES.includes(body.role) && !isPlatform) {
      return new Response(JSON.stringify({ error: "Apenas a plataforma pode criar usuários da plataforma" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (AGENCY_ROLES.includes(body.role) && !isPlatform && !isAgencyAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão para criar usuários de agência" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.email || !body.password || body.password.length < 8) {
      return new Response(JSON.stringify({ error: "Email e senha (min 8 caracteres) obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        role: body.role,
        tenant_type: body.tenant_type,
      },
    });

    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Erro ao criar usuário" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure profile reflects requested role/tenant (handle_new_user trigger may default)
    await admin.from("profiles").upsert({
      user_id: created.user.id,
      full_name: body.full_name,
      role: body.role,
      tenant_type: body.tenant_type,
    }, { onConflict: "user_id" });

    return new Response(
      JSON.stringify({ ok: true, user_id: created.user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});