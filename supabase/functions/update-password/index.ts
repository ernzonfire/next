import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

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

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json(405, { error: "method not allowed" }, origin);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(401, { error: "missing bearer token" }, origin);
  }

  const jwt = authHeader.slice("Bearer ".length);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return json(401, { error: "invalid token" }, origin);
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch (_error) {
    return json(400, { error: "invalid json" }, origin);
  }

  const password = (body.password ?? "").trim();
  if (password.length < 8) {
    return json(400, { error: "password must be at least 8 characters" }, origin);
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    userData.user.id,
    { password }
  );

  if (updateError) {
    return json(400, { error: updateError.message }, origin);
  }

  return json(200, { ok: true }, origin);
});
