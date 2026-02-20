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

const makePassword = () => {
  const array = crypto.getRandomValues(new Uint8Array(12));
  const raw = btoa(String.fromCharCode(...array)).replace(/[^a-zA-Z0-9]/g, "");
  return `${raw.slice(0, 10)}!9`;
};

const monthMap: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const formatDob = (dobText: string) => {
  const raw = String(dobText || "").trim();
  if (!raw) return null;

  let match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const mm = match[1].padStart(2, "0");
    const dd = match[2].padStart(2, "0");
    const yyyy = match[3];
    return `${mm}${dd}${yyyy}`;
  }

  match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const mm = match[2].padStart(2, "0");
    const dd = match[3].padStart(2, "0");
    const yyyy = match[1];
    return `${mm}${dd}${yyyy}`;
  }

  match = raw.match(/^(\d{1,2})[-/ ]([A-Za-z]+)[-/ ](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = monthMap[match[2].toLowerCase()];
    const year = match[3];
    if (!month) return null;
    return `${String(month).padStart(2, "0")}${day}${year}`;
  }

  match = raw.match(/^([A-Za-z]+)\\s*(\\d{1,2}),?\\s*(\\d{4})$/);
  if (match) {
    const month = monthMap[match[1].toLowerCase()];
    const day = match[2].padStart(2, "0");
    const year = match[3];
    if (!month) return null;
    return `${String(month).padStart(2, "0")}${day}${year}`;
  }

  return null;
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

  const requesterRole = userData.user.app_metadata?.role;
  if (requesterRole !== "admin") {
    return json(403, { error: "not authorized" }, origin);
  }

  let body: {
    employee_id?: string;
    first_name?: string;
    last_name?: string;
    job_title?: string;
    campaign?: string;
    site?: string;
    work_arrangement?: string;
    dob_text?: string;
    role?: "admin" | "employee" | "committee" | "user";
    temp_password?: string;
  };

  try {
    body = await req.json();
  } catch (_error) {
    return json(400, { error: "invalid json" }, origin);
  }

  const employeeId = (body.employee_id ?? "").trim();
  const idRegex = /^\d{5,7}$/;
  if (!idRegex.test(employeeId)) {
    return json(400, { error: "employee_id must be 5 to 7 digits" }, origin);
  }

  const requestedRole =
    body.role === "admin" || body.role === "committee"
      ? body.role
      : "employee";

  const domain = Deno.env.get("EMPLOYEE_EMAIL_DOMAIN") ?? "next.com";
  const email = `${employeeId}@${domain}`;
  const firstName = (body.first_name ?? "").trim();
  const lastName = (body.last_name ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const dobFormatted = formatDob(body.dob_text ?? "");
  const providedPassword = (body.temp_password ?? "").trim();
  const tempPassword = providedPassword || (dobFormatted ? `${employeeId}${dobFormatted}` : makePassword());
  const passwordSource = providedPassword
    ? "custom"
    : dobFormatted
    ? "derived"
    : "random";

  const metadata = {
    employee_id: employeeId,
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
    job_title: body.job_title ?? null,
    campaign: body.campaign ?? null,
    site: body.site ?? null,
    work_arrangement: body.work_arrangement ?? null,
    dob_text: body.dob_text ?? null,
  };

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: { role: requestedRole },
  });

  if (createError || !created.user) {
    const message = createError?.message ?? "create failed";
    const isDuplicate = message.toLowerCase().includes("already") || message.toLowerCase().includes("registered");
    return json(isDuplicate ? 409 : 400, { error: message }, origin);
  }

  const userId = created.user.id;

  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    employee_id: employeeId,
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
    job_title: body.job_title ?? null,
    campaign: body.campaign ?? null,
    site: body.site ?? null,
    work_arrangement: body.work_arrangement ?? null,
    dob_text: body.dob_text ?? null,
    role: requestedRole,
  });

  return json(
    200,
    {
      user_id: userId,
      email,
      temp_password: tempPassword,
      role: requestedRole,
      password_source: passwordSource,
    },
    origin
  );
});
