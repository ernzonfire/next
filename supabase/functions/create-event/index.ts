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

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateCode = () => {
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
};

const normalizeEventCode = (value: string | null | undefined) =>
  (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

const isValidEventCode = (value: string) => /^[A-Z0-9_-]{4,24}$/.test(value);

const resolveRole = async (userId: string, jwtRole?: string | null) => {
  if (jwtRole === "admin") {
    return jwtRole;
  }

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
    .limit(1)
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
  if (role !== "admin") {
    return json(403, { error: "not authorized" }, origin);
  }

  let body: {
    title?: string;
    description?: string | null;
    event_date?: string;
    points?: number;
    image_url?: string | null;
    event_code?: string | null;
  };

  try {
    body = await req.json();
  } catch (_error) {
    return json(400, { error: "invalid json" }, origin);
  }

  const title = (body.title ?? "").trim();
  const description = body.description?.trim() || null;
  const eventDate = (body.event_date ?? "").trim();
  const points = Number(body.points ?? 0);
  const imageUrl = body.image_url?.trim() || null;
  const customEventCode = normalizeEventCode(body.event_code);

  if (!title) {
    return json(400, { error: "title is required" }, origin);
  }

  if (!eventDate) {
    return json(400, { error: "event_date is required" }, origin);
  }

  if (!Number.isFinite(points) || points < 1) {
    return json(400, { error: "points must be at least 1" }, origin);
  }

  if (customEventCode && !isValidEventCode(customEventCode)) {
    return json(
      400,
      {
        error:
          "event_code must be 4-24 characters and can only contain A-Z, 0-9, dash (-), or underscore (_).",
      },
      origin
    );
  }

  let insertedId: string | null = null;
  let eventCode: string | null = null;
  const maxAttempts = customEventCode ? 1 : 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    eventCode = customEventCode || generateCode();
    const payload: Record<string, unknown> = {
      title,
      description,
      event_date: eventDate,
      points,
      created_by: userData.user.id,
      event_code: eventCode,
    };
    if (imageUrl) {
      payload.image_url = imageUrl;
    }

    let { data: inserted, error: insertError } = await supabaseAdmin
      .from("events")
      .insert(payload)
      .select("id, event_code")
      .single();

    // Backward-compatible fallback for databases that still do not have image_url.
    if (
      insertError &&
      imageUrl &&
      (insertError.code === "42703" || insertError.message.toLowerCase().includes("image_url"))
    ) {
      const retryPayload = {
        title,
        description,
        event_date: eventDate,
        points,
        created_by: userData.user.id,
        event_code: eventCode,
      };
      const retry = await supabaseAdmin
        .from("events")
        .insert(retryPayload)
        .select("id, event_code")
        .single();
      inserted = retry.data;
      insertError = retry.error;
    }

    if (!insertError && inserted) {
      insertedId = inserted.id;
      eventCode = inserted.event_code;
      break;
    }

    if (insertError && insertError.code !== "23505") {
      return json(400, { error: insertError.message }, origin);
    }

    if (insertError && insertError.code === "23505" && customEventCode) {
      return json(409, { error: "event_code already exists. Choose another code." }, origin);
    }
  }

  if (!insertedId || !eventCode) {
    return json(500, { error: "failed to generate event code" }, origin);
  }

  return json(200, { event_id: insertedId, event_code: eventCode }, origin);
});
