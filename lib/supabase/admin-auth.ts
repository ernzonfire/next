import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient, getBearerToken } from "@/lib/supabase/server";

export type AdminAuthResult =
  | {
      ok: true;
      user: User;
      profileId: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export const requireAdminFromRequest = async (request: Request): Promise<AdminAuthResult> => {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, error: "Missing bearer token." };
  }

  const supabaseAdmin = createServiceRoleClient();

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: "Invalid or expired session." };
  }

  const userId = userData.user.id;
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, disabled_at")
    .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, status: 403, error: "Profile not found." };
  }

  if (profile.disabled_at) {
    return { ok: false, status: 403, error: "Account is disabled." };
  }

  if (profile.role !== "admin") {
    return { ok: false, status: 403, error: "Admin access required." };
  }

  return {
    ok: true,
    user: userData.user,
    profileId: profile.id,
  };
};
