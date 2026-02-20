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

const resolveRole = async (userId: string, jwtRole?: string | null) => {
  if (jwtRole === "admin") {
    return jwtRole;
  }

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return data?.role ?? null;
};

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

  const role = await resolveRole(userData.user.id, userData.user.app_metadata?.role);

  let body: { event_id?: string; user_id?: string; qr_token?: string };
  try {
    body = await req.json();
  } catch (_error) {
    return json(400, { error: "invalid json" }, origin);
  }

  let eventId = body.event_id ?? null;
  let userId = body.user_id ?? null;
  let eventCode: string | null = null;

  if (body.qr_token?.startsWith("event:")) {
    eventCode = body.qr_token.replace("event:", "").trim();
    userId = userData.user.id;
  } else if (body.qr_token?.startsWith("user:")) {
    userId = body.qr_token.replace("user:", "").trim();
  } else if (body.qr_token) {
    eventCode = body.qr_token.trim();
    userId = userData.user.id;
  }

  if (!eventId || !userId) {
    if (!eventCode) {
      return json(400, { error: "event_id and user_id (or qr_token) required" }, origin);
    }
  }

  const isAdmin = role === "admin";
  if (!isAdmin && userId !== userData.user.id) {
    return json(403, { error: "not authorized" }, origin);
  }

  let pointsAwarded: number | null = null;

  if (!eventId && eventCode) {
    const { data: eventRow, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, points")
      .eq("event_code", eventCode)
      .maybeSingle();

    if (eventError) {
      return json(400, { error: eventError.message }, origin);
    }

    if (!eventRow) {
      return json(404, { error: "event not found" }, origin);
    }

    eventId = eventRow.id;
    pointsAwarded = eventRow.points ?? null;
  }

  const { data, error } = await supabaseAdmin.rpc("grant_event_points", {
    p_event_id: eventId,
    p_user_id: userId,
    p_scanned_by: userData.user.id,
  });

  if (error) {
    return json(400, { error: error.message }, origin);
  }

  const newBalance = Array.isArray(data) ? data[0]?.new_balance : null;
  const awarded =
    Array.isArray(data) && data[0]?.points_awarded !== undefined
      ? data[0]?.points_awarded
      : pointsAwarded;

  return json(200, { new_balance: newBalance, points_awarded: awarded }, origin);
});
