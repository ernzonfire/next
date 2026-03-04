import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminFromRequest } from "@/lib/supabase/admin-auth";

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

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdminFromRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
    body = await request.json();
  } catch (_error) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const description = body.description?.trim() || null;
  const eventDate = (body.event_date ?? "").trim();
  const points = Number(body.points ?? 0);
  const imageUrl = body.image_url?.trim() || null;
  const customEventCode = normalizeEventCode(body.event_code);

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  if (!eventDate) {
    return NextResponse.json({ error: "Event date and time are required." }, { status: 400 });
  }

  if (!Number.isFinite(points) || points < 1) {
    return NextResponse.json({ error: "Points must be at least 1." }, { status: 400 });
  }

  if (customEventCode && !isValidEventCode(customEventCode)) {
    return NextResponse.json(
      {
        error:
          "event_code must be 4-24 characters and can only contain A-Z, 0-9, dash (-), or underscore (_).",
      },
      { status: 400 }
    );
  }

  const supabaseAdmin = createServiceRoleClient();

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
      created_by: auth.profileId,
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
        created_by: auth.profileId,
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
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    if (insertError && insertError.code === "23505" && customEventCode) {
      return NextResponse.json({ error: "Event code already exists. Choose another code." }, { status: 409 });
    }
  }

  if (!insertedId || !eventCode) {
    return NextResponse.json({ error: "Failed to generate a unique event code." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event_id: insertedId, event_code: eventCode });
}
