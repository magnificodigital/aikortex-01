import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PLATFORM_ROLES = ["platform_owner", "platform_admin"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  // Authorize: caller must be platform user
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role, tenant_type")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerProfile || !PLATFORM_ROLES.includes(callerProfile.role)) {
    return json({ error: "Forbidden — apenas administradores da plataforma" }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const action = body?.action as string;

  try {
    switch (action) {
      // ─────────────────────────── USERS ───────────────────────────
      case "list": {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, user_id, full_name, avatar_url, role, tenant_type, is_active, created_at");
        const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));
        const users = (profiles ?? []).map((p) => ({
          ...p,
          email: emailById.get(p.user_id) ?? "",
        }));
        return json({ users });
      }

      case "create": {
        const { email, password, full_name, role, tenant_type, agency_name, tier } = body;
        if (!email || !password || password.length < 8) {
          return json({ error: "Email e senha (mín 8 caracteres) obrigatórios" }, 400);
        }
        const { data: created, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name, role, tenant_type },
        });
        if (error || !created.user) return json({ error: error?.message ?? "Erro ao criar usuário" }, 400);

        await admin.from("profiles").upsert({
          user_id: created.user.id,
          full_name: full_name ?? email,
          role, tenant_type,
        }, { onConflict: "user_id" });

        if (tenant_type === "agency") {
          await admin.from("agency_profiles").upsert({
            user_id: created.user.id,
            agency_name: agency_name ?? full_name ?? email,
            tier: tier ?? "starter",
          }, { onConflict: "user_id" });
        }
        return json({ ok: true, user_id: created.user.id });
      }

      case "update": {
        const { user_id, full_name, role, tenant_type, is_active, email } = body;
        if (!user_id) return json({ error: "user_id obrigatório" }, 400);

        const profileUpdate: Record<string, unknown> = {};
        if (full_name !== undefined) profileUpdate.full_name = full_name;
        if (role !== undefined) profileUpdate.role = role;
        if (tenant_type !== undefined) profileUpdate.tenant_type = tenant_type;
        if (is_active !== undefined) profileUpdate.is_active = is_active;
        if (Object.keys(profileUpdate).length > 0) {
          await admin.from("profiles").update(profileUpdate).eq("user_id", user_id);
        }
        if (email) {
          await admin.auth.admin.updateUserById(user_id, { email, email_confirm: true });
        }
        return json({ ok: true });
      }

      case "delete": {
        const { user_id } = body;
        if (!user_id) return json({ error: "user_id obrigatório" }, 400);
        const { error } = await admin.auth.admin.deleteUser(user_id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "suspend": {
        const { user_id } = body;
        if (!user_id) return json({ error: "user_id obrigatório" }, 400);
        await admin.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });
        await admin.from("profiles").update({ is_active: false }).eq("user_id", user_id);
        return json({ ok: true });
      }

      case "unsuspend": {
        const { user_id } = body;
        if (!user_id) return json({ error: "user_id obrigatório" }, 400);
        await admin.auth.admin.updateUserById(user_id, { ban_duration: "none" });
        await admin.from("profiles").update({ is_active: true }).eq("user_id", user_id);
        return json({ ok: true });
      }

      case "reset-password": {
        const { email } = body;
        if (!email) return json({ error: "email obrigatório" }, 400);
        const redirectTo = `${req.headers.get("origin") ?? ""}/reset-password`;
        const { error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: "Link de recuperação enviado" });
      }

      // ─────────────────────────── AGENCIES ───────────────────────────
      case "update-agency": {
        const { agency_id, agency_name, tier, tier_manually_overridden } = body;
        if (!agency_id) return json({ error: "agency_id obrigatório" }, 400);
        const upd: Record<string, unknown> = {};
        if (agency_name !== undefined) upd.agency_name = agency_name;
        if (tier !== undefined) upd.tier = tier;
        if (tier_manually_overridden !== undefined) upd.tier_manually_overridden = tier_manually_overridden;
        const { error } = await admin.from("agency_profiles").update(upd).eq("id", agency_id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      // ─────────────────────────── CLIENTS ───────────────────────────
      case "create-client": {
        const {
          agency_id, client_name, client_email, client_phone, client_document,
          create_access, access_email, access_password, template_ids,
        } = body;
        if (!agency_id || !client_name) return json({ error: "agency_id e client_name obrigatórios" }, 400);

        let client_user_id: string | null = null;
        if (create_access && access_email && access_password) {
          const { data: created, error } = await admin.auth.admin.createUser({
            email: access_email, password: access_password, email_confirm: true,
            user_metadata: { full_name: client_name, role: "client_owner", tenant_type: "client" },
          });
          if (error || !created.user) return json({ error: error?.message ?? "Erro ao criar acesso" }, 400);
          client_user_id = created.user.id;
          await admin.from("profiles").upsert({
            user_id: client_user_id,
            full_name: client_name,
            role: "client_owner",
            tenant_type: "client",
          }, { onConflict: "user_id" });
        }

        const { data: client, error: clientErr } = await admin.from("agency_clients").insert({
          agency_id, client_name,
          client_email: client_email ?? access_email ?? null,
          client_phone: client_phone ?? null,
          client_document: client_document ?? null,
          client_user_id,
          status: "active",
        }).select("id").single();
        if (clientErr) return json({ error: clientErr.message }, 400);

        if (Array.isArray(template_ids) && template_ids.length > 0 && client) {
          const { data: templates } = await admin.from("platform_templates")
            .select("id, platform_price_monthly").in("id", template_ids);
          const subs = (templates ?? []).map((t) => ({
            agency_id, client_id: client.id, template_id: t.id,
            platform_price_monthly: t.platform_price_monthly,
            agency_price_monthly: t.platform_price_monthly,
            status: "pending",
          }));
          if (subs.length) await admin.from("client_template_subscriptions").insert(subs);
        }
        return json({ ok: true, client_id: client?.id });
      }

      case "update-client": {
        const { client_id, ...updates } = body;
        delete updates.action;
        if (!client_id) return json({ error: "client_id obrigatório" }, 400);
        const { error } = await admin.from("agency_clients").update(updates).eq("id", client_id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "delete-client": {
        const { client_id } = body;
        if (!client_id) return json({ error: "client_id obrigatório" }, 400);
        const { data: client } = await admin.from("agency_clients")
          .select("client_user_id").eq("id", client_id).maybeSingle();
        await admin.from("agency_clients").delete().eq("id", client_id);
        if (client?.client_user_id) {
          await admin.auth.admin.deleteUser(client.client_user_id).catch(() => {});
        }
        return json({ ok: true });
      }

      case "create-workspace-access": {
        const { client_id, email, password, client_name } = body;
        if (!client_id || !email || !password) return json({ error: "client_id, email e password obrigatórios" }, 400);
        const { data: created, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name: client_name ?? email, role: "client_owner", tenant_type: "client" },
        });
        if (error || !created.user) return json({ error: error?.message ?? "Erro ao criar acesso" }, 400);
        await admin.from("profiles").upsert({
          user_id: created.user.id,
          full_name: client_name ?? email,
          role: "client_owner", tenant_type: "client",
        }, { onConflict: "user_id" });
        await admin.from("agency_clients").update({
          client_user_id: created.user.id,
          client_email: email,
        }).eq("id", client_id);
        return json({ ok: true, user_id: created.user.id });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});