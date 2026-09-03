import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

const ROLES = ["student", "canteen_owner", "admin"] as const;

/** Lists every account with email, profile and role. Admin only. */
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emails = new Map<string, { email: string; created_at: string }>();
    let page = 1;
    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error("Failed to list users");
      for (const u of data.users) emails.set(u.id, { email: u.email ?? "", created_at: u.created_at });
      if (data.users.length < 200) break;
      page += 1;
    }
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, full_name, class, last_active_at, avatar_url"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
    return (profiles ?? [])
      .map((p) => ({
        ...p,
        email: emails.get(p.id)?.email ?? "",
        role: roleMap.get(p.id) ?? "student",
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
  });

/** Changes a user's role. Admin only. */
export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: z.enum(ROLES) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    if (data.userId === (context as Ctx).userId && data.role !== "admin") throw new Error("Cannot demote yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error("Failed to update role");
    return { ok: true };
  });

/** Permanently deletes an account. Admin only. */
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    if (data.userId === (context as Ctx).userId) throw new Error("Cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("Failed to delete user");
    return { ok: true };
  });

/** Updates profile fields for any user. Admin only. */
export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,20}$/),
        full_name: z.string().trim().max(80),
        class: z.string().trim().max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { userId, ...fields } = data;
    const { error } = await (context as Ctx).supabase.from("profiles").update(fields).eq("id", userId);
    if (error) throw new Error(error.message.includes("unique") ? "USERNAME_TAKEN" : "Failed to update profile");
    return { ok: true };
  });
