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

const resolveRoleToken = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

const isUserAdmin = (user: User, profileRole: string | null): boolean => {
  const appMetadataRole = resolveRoleToken(user.app_metadata?.role);
  const userMetadataRole = resolveRoleToken(user.user_metadata?.role);
  return (
    profileRole === "admin" ||
    appMetadataRole === "admin" ||
    userMetadataRole === "admin"
  );
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

  const profileRole = resolveRoleToken(profile?.role);
  const adminByJwt = isUserAdmin(userData.user, null);

  if (profileError && !adminByJwt) {
    return { ok: false, status: 403, error: "Profile not found." };
  }

  if (profile?.disabled_at) {
    return { ok: false, status: 403, error: "Account is disabled." };
  }

  if (!isUserAdmin(userData.user, profileRole)) {
    return { ok: false, status: 403, error: "Admin access required." };
  }

  return {
    ok: true,
    user: userData.user,
    profileId: profile?.id ?? userId,
  };
};
