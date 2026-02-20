import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/supabase/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdminFromRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;

  const supabaseAdmin = createServiceRoleClient();
  const { data, error } = await supabaseAdmin
    .from("roster_uploads")
    .select("id, uploaded_by, uploaded_at, file_name, inserted_count, updated_count, terminated_count, error_count")
    .order("uploaded_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ uploads: data ?? [] });
}
