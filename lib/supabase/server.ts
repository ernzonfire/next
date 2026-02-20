import { createClient } from "@supabase/supabase-js";

const getEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? getEnv("SUPABASE_URL");

export const getSupabaseAnonKey = () => getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

export const getSupabaseServiceRoleKey = () => getEnv("SUPABASE_SERVICE_ROLE_KEY");

export const createServiceRoleClient = () =>
  createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

export const getEmployeeAuthDomain = () =>
  process.env.EMPLOYEE_EMAIL_DOMAIN ??
  process.env.NEXT_PUBLIC_EMPLOYEE_EMAIL_DOMAIN ??
  "next.com";

export const employeeIdToEmail = (employeeId: string) => `${employeeId}@${getEmployeeAuthDomain()}`;

export const normalizeRole = (role: string | null | undefined): "admin" | "employee" | "committee" => {
  if (role === "admin" || role === "committee") {
    return role;
  }

  return "employee";
};

export const normalizeNameForMatch = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

export const getBearerToken = (request: Request) => {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return null;
  }

  return auth.slice("Bearer ".length).trim() || null;
};
