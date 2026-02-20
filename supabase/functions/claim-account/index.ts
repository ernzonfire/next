import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

export const config = {
  verify_jwt: false,
};

const buildCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const json = (status: number, body: Record<string, unknown>, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...buildCorsHeaders(origin),
    },
  });

const normalizeName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json(405, { error: "method not allowed" }, origin);
  }

  let body: {
    employee_id?: string;
    last_name?: string;
    password?: string;
  };

  try {
    body = await req.json();
  } catch (_error) {
    return json(400, { error: "invalid json" }, origin);
  }

  const employeeId = (body.employee_id ?? "").trim();
  const lastNameInput = (body.last_name ?? "").trim();
  const password = (body.password ?? "").trim();

  if (!/^\d{5,7}$/.test(employeeId)) {
    return json(400, { error: "employee_id must be 5 to 7 digits" }, origin);
  }

  if (password.length < 8) {
    return json(400, { error: "password must be at least 8 characters" }, origin);
  }

  if (!lastNameInput) {
    return json(400, { error: "last_name is required" }, origin);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, last_name, claimed")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (profileError) {
    return json(500, { error: profileError.message }, origin);
  }

  if (!profile) {
    return json(404, { error: "employee not found" }, origin);
  }

  if (profile.claimed) {
    return json(409, { error: "account already claimed" }, origin);
  }

  const normalizedInput = normalizeName(lastNameInput);
  const normalizedStored = normalizeName(profile.last_name ?? "");

  if (!normalizedInput || !normalizedStored || normalizedInput !== normalizedStored) {
    return json(403, { error: "Last name does not match our records" }, origin);
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    profile.id,
    { password }
  );

  if (updateError) {
    return json(400, { error: updateError.message }, origin);
  }

  const { error: claimError } = await supabaseAdmin
    .from("profiles")
    .update({ claimed: true })
    .eq("id", profile.id);

  if (claimError) {
    return json(400, { error: claimError.message }, origin);
  }

  const domain = Deno.env.get("EMPLOYEE_EMAIL_DOMAIN") ?? "next.local";
  const email = `${employeeId}@${domain}`;

  return json(200, { user_id: profile.id, email }, origin);
});
