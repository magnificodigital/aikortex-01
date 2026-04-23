import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | { action: "send_password_reset"; client_id: string }
  | { action: "set_password"; client_id: string; new_password: string }
  | { action: "update_email"; client_id: string; new_email: string }
  | { action: "create_client_user"; client_id: string; email: string; password: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
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
    const body = await req.json() as Action;

    // Verify the caller's agency owns the client
    const { data: agency } = await admin
      .from("agency_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agency) {
      return new Response(JSON.stringify({ error: "Agency profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: client } = await admin
      .from("agency_clients")
      .select("id, client_user_id, client_email, agency_id")
      .eq("id", body.client_id)
      .maybeSingle();

    if (!client || client.agency_id !== agency.id) {
      return new Response(JSON.stringify({ error: "Client not found or not yours" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === send_password_reset ===
    if (body.action === "send_password_reset") {
      const email = client.client_email;
      if (!email) throw new Error("Cliente sem email cadastrado");
      const redirectTo = `${req.headers.get("origin") ?? ""}/reset-password`;
      const { error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, message: "Email de recuperação enviado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === set_password ===
    if (body.action === "set_password") {
      if (!client.client_user_id) throw new Error("Cliente ainda não possui usuário vinculado");
      if (!body.new_password || body.new_password.length < 8) {
        throw new Error("Senha deve ter no mínimo 8 caracteres");
      }
      const { error } = await admin.auth.admin.updateUserById(client.client_user_id, {
        password: body.new_password,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, message: "Senha atualizada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === update_email ===
    if (body.action === "update_email") {
      if (!body.new_email) throw new Error("Email obrigatório");
      if (client.client_user_id) {
        const { error } = await admin.auth.admin.updateUserById(client.client_user_id, {
          email: body.new_email,
          email_confirm: true,
        });
        if (error) throw error;
      }
      await admin.from("agency_clients").update({ client_email: body.new_email }).eq("id", client.id);
      return new Response(JSON.stringify({ ok: true, message: "Email atualizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === create_client_user ===
    if (body.action === "create_client_user") {
      if (client.client_user_id) throw new Error("Cliente já possui usuário vinculado");
      const { data: created, error } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { tenant_type: "client", role: "client_owner" },
      });
      if (error) throw error;
      await admin.from("agency_clients").update({
        client_user_id: created.user!.id,
        client_email: body.email,
      }).eq("id", client.id);
      return new Response(JSON.stringify({ ok: true, message: "Usuário criado", user_id: created.user!.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
