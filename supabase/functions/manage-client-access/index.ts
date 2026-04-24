import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | { action: "send_password_reset"; client_id: string }
  | { action: "set_password"; client_id: string; new_password: string }
  | { action: "update_email"; client_id: string; new_email: string }
  | { action: "create_client_user"; client_id: string; email: string; password: string }
  | { action: "generate_invite"; client_id: string }
  | { action: "accept_invite"; token: string; password: string; full_name: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const ok = (data: unknown) =>
    new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  const err = (msg: string, status = 400) =>
    new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json() as Action;

    // ── accept_invite: público, sem autenticação necessária ──────────────────
    if (body.action === "accept_invite") {
      const { token, password, full_name } = body;
      if (!token || !password || password.length < 8)
        return err("Token e senha (mín. 8 caracteres) são obrigatórios");

      const { data: invite } = await admin
        .from("client_invites")
        .select("id, client_id, agency_id, email, expires_at, used_at")
        .eq("token", token)
        .maybeSingle();

      if (!invite) return err("Convite inválido", 404);
      if (invite.used_at) return err("Convite já utilizado", 409);
      if (new Date(invite.expires_at) < new Date()) return err("Convite expirado", 410);

      const { data: clientRow } = await admin
        .from("agency_clients")
        .select("id, client_user_id")
        .eq("id", invite.client_id)
        .maybeSingle();

      if (!clientRow) return err("Cliente não encontrado", 404);
      if (clientRow.client_user_id) return err("Cliente já possui acesso", 409);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          role: "client_owner",
          tenant_type: "client",
          agency_id: invite.agency_id,
        },
      });
      if (createErr) throw createErr;

      const userId = created.user!.id;

      await admin
        .from("agency_clients")
        .update({ client_user_id: userId })
        .eq("id", invite.client_id);

      // Garante agency_id no profile (caso trigger não pegue)
      await admin
        .from("profiles")
        .update({ agency_id: invite.agency_id, tenant_type: "client", role: "client_owner" })
        .eq("user_id", userId);

      await admin
        .from("client_invites")
        .update({ used_at: new Date().toISOString() })
        .eq("id", invite.id);

      return ok({ ok: true, message: "Conta criada com sucesso" });
    }

    // ── Ações autenticadas (agência) ─────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return err("Não autenticado", 401);

    const { data: agency } = await admin
      .from("agency_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!agency) return err("Perfil de agência não encontrado", 403);

    // ── generate_invite ──────────────────────────────────────────────────────
    if (body.action === "generate_invite") {
      const { data: clientRow } = await admin
        .from("agency_clients")
        .select("id, client_email, client_user_id, agency_id")
        .eq("id", body.client_id)
        .maybeSingle();

      if (!clientRow || clientRow.agency_id !== agency.id)
        return err("Cliente não encontrado", 404);
      if (clientRow.client_user_id)
        return err("Cliente já possui acesso ativo", 409);
      if (!clientRow.client_email)
        return err("Cliente sem email cadastrado. Adicione um email antes de convidar.", 422);

      // Invalida convites anteriores não utilizados para este cliente
      await admin
        .from("client_invites")
        .update({ used_at: new Date().toISOString() })
        .eq("client_id", body.client_id)
        .is("used_at", null);

      const { data: invite, error: inviteErr } = await admin
        .from("client_invites")
        .insert({
          agency_id: agency.id,
          client_id: body.client_id,
          email: clientRow.client_email,
        })
        .select("token")
        .single();
      if (inviteErr) throw inviteErr;

      const origin = req.headers.get("origin") ?? "https://app.aikortex.com";
      return ok({
        ok: true,
        invite_url: `${origin}/cadastro-cliente/${invite.token}`,
        token: invite.token,
      });
    }

    // ── Ações que precisam verificar ownership do cliente ────────────────────
    const { data: clientRow } = await admin
      .from("agency_clients")
      .select("id, client_user_id, client_email, agency_id")
      .eq("id", (body as { client_id: string }).client_id)
      .maybeSingle();

    if (!clientRow || clientRow.agency_id !== agency.id)
      return err("Cliente não encontrado", 404);

    if (body.action === "send_password_reset") {
      if (!clientRow.client_email) throw new Error("Cliente sem email cadastrado");
      const redirectTo = `${req.headers.get("origin") ?? ""}/reset-password`;
      const { error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: clientRow.client_email,
        options: { redirectTo },
      });
      if (error) throw error;
      return ok({ ok: true, message: "Email de recuperação enviado" });
    }

    if (body.action === "set_password") {
      if (!clientRow.client_user_id) throw new Error("Cliente ainda não possui usuário vinculado");
      if (!body.new_password || body.new_password.length < 8)
        throw new Error("Senha deve ter no mínimo 8 caracteres");
      const { error } = await admin.auth.admin.updateUserById(clientRow.client_user_id, {
        password: body.new_password,
      });
      if (error) throw error;
      return ok({ ok: true, message: "Senha atualizada" });
    }

    if (body.action === "update_email") {
      if (!body.new_email) throw new Error("Email obrigatório");
      if (clientRow.client_user_id) {
        const { error } = await admin.auth.admin.updateUserById(clientRow.client_user_id, {
          email: body.new_email,
          email_confirm: true,
        });
        if (error) throw error;
      }
      await admin.from("agency_clients").update({ client_email: body.new_email }).eq("id", clientRow.id);
      return ok({ ok: true, message: "Email atualizado" });
    }

    if (body.action === "create_client_user") {
      if (clientRow.client_user_id) throw new Error("Cliente já possui usuário vinculado");
      const { data: created, error } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          tenant_type: "client",
          role: "client_owner",
          agency_id: agency.id,
        },
      });
      if (error) throw error;
      await admin.from("agency_clients").update({
        client_user_id: created.user!.id,
        client_email: body.email,
      }).eq("id", clientRow.id);
      await admin.from("profiles").update({
        agency_id: agency.id,
        tenant_type: "client",
        role: "client_owner",
      }).eq("user_id", created.user!.id);
      return ok({ ok: true, message: "Usuário criado", user_id: created.user!.id });
    }

    return err("Ação desconhecida");
  } catch (e) {
    return err((e as Error).message);
  }
});
