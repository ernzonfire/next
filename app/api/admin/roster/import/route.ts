import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { requireAdminFromRequest } from "@/lib/supabase/admin-auth";
import { createServiceRoleClient, normalizeRole } from "@/lib/supabase/server";

type ParsedRosterRow = {
  employee_id: string;
  surname: string;
  first_name: string | null;
  department: string | null;
  job_title: string | null;
  campaign: string | null;
  work_arrangement: string | null;
  app_role: "admin" | "employee" | "committee";
  status: "active" | "terminated";
};

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const normalizeCell = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim();
  }

  return String(value ?? "").trim();
};

const getFirstValue = (row: Record<string, unknown>, candidates: string[]) => {
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = normalizeCell(row[key]);
      if (value) {
        return value;
      }
    }
  }

  return "";
};

const extractCsvPayload = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const csvTextField =
      form.get("csv_text") ?? form.get("csvText") ?? form.get("csv") ?? form.get("text");

    if (file instanceof File && file.size > 0) {
      return {
        csvText: await file.text(),
        fileName: file.name || "roster.csv",
      };
    }

    if (typeof csvTextField === "string" && csvTextField.trim()) {
      return {
        csvText: csvTextField,
        fileName: "pasted-roster.csv",
      };
    }

    return null;
  }

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      csvText?: string;
      csv_text?: string;
      fileName?: string;
    };

    const csvText = String(body.csvText ?? body.csv_text ?? "");
    if (!csvText.trim()) {
      return null;
    }

    return {
      csvText,
      fileName: String(body.fileName ?? "pasted-roster.csv"),
    };
  }

  const rawText = await request.text();
  if (!rawText.trim()) {
    return null;
  }

  return {
    csvText: rawText,
    fileName: "pasted-roster.csv",
  };
};

const parseRosterCsv = (csvText: string) => {
  let normalizedHeaders: string[] = [];

  const rows = parse(csvText.replace(/^\uFEFF/, ""), {
    columns: (headers: string[]) => {
      normalizedHeaders = headers.map(normalizeHeader);
      return normalizedHeaders;
    },
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, unknown>[];

  return { rows, headers: normalizedHeaders };
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdminFromRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const payload = await extractCsvPayload(request);
  if (!payload) {
    return NextResponse.json(
      { error: "CSV input is required. Upload a file or paste CSV text." },
      { status: 400 }
    );
  }

  const parsed = (() => {
    try {
      return parseRosterCsv(payload.csvText);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid CSV.";
      return { error: message };
    }
  })();

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const hasEmployeeId = parsed.headers.includes("employee_id");
  const hasSurname = parsed.headers.includes("surname") || parsed.headers.includes("last_name");
  const hasStatus = parsed.headers.includes("status");

  const missingHeaders = [
    hasEmployeeId ? null : "employee_id",
    hasSurname ? null : "surname (or last_name)",
  ]
    .filter(Boolean)
    .map(String);

  if (missingHeaders.length > 0) {
    return NextResponse.json(
      { error: `Missing required column(s): ${missingHeaders.join(", ")}.` },
      { status: 400 }
    );
  }

  const validRowsByEmployee = new Map<string, ParsedRosterRow>();
  const validationErrors: string[] = [];
  const idRegex = /^\d{5,7}$/;

  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const employeeId = getFirstValue(row, ["employee_id"]);
    const surname = getFirstValue(row, ["surname", "last_name"]);
    const firstName = getFirstValue(row, ["first_name"]) || null;
    const department = getFirstValue(row, ["department", "vertical"]) || null;
    const jobTitle = getFirstValue(row, ["job_title", "role", "position"]) || null;
    const campaign = getFirstValue(row, ["campaign"]) || null;
    const workArrangement = getFirstValue(row, ["work_setup", "work_arrangement"]) || null;
    const status = (hasStatus ? getFirstValue(row, ["status"]) : "active").toLowerCase() || "active";
    const nextRoleRaw = getFirstValue(row, ["next_role"]).toLowerCase();

    if (!employeeId || !surname) {
      validationErrors.push(`Row ${rowNumber}: employee_id and surname/last_name are required.`);
      return;
    }

    if (!idRegex.test(employeeId)) {
      validationErrors.push(`Row ${rowNumber}: employee_id must be 5 to 7 digits.`);
      return;
    }

    if (status !== "active" && status !== "terminated") {
      validationErrors.push(`Row ${rowNumber}: status must be active or terminated.`);
      return;
    }

    const roleToken = nextRoleRaw || "employee";
    if (!["admin", "employee", "committee", "user"].includes(roleToken)) {
      validationErrors.push(
        `Row ${rowNumber}: next_role must be one of admin, employee, committee, user.`
      );
      return;
    }

    validRowsByEmployee.set(employeeId, {
      employee_id: employeeId,
      surname,
      first_name: firstName,
      department,
      job_title: jobTitle,
      campaign,
      work_arrangement: workArrangement,
      app_role: normalizeRole(roleToken),
      status,
    });
  });

  const validRows = Array.from(validRowsByEmployee.values());

  if (validRows.length === 0) {
    return NextResponse.json(
      {
        error: "No valid rows found in CSV.",
        inserted_count: 0,
        updated_count: 0,
        terminated_count: 0,
        error_count: validationErrors.length,
        validation_errors: validationErrors.slice(0, 20),
      },
      { status: 400 }
    );
  }

  const supabaseAdmin = createServiceRoleClient();

  const employeeIds = validRows.map((row) => row.employee_id);
  const { data: existingEmployees, error: existingEmployeesError } = await supabaseAdmin
    .from("employees")
    .select("employee_id")
    .in("employee_id", employeeIds);

  if (existingEmployeesError) {
    return NextResponse.json({ error: existingEmployeesError.message }, { status: 500 });
  }

  const existingSet = new Set((existingEmployees ?? []).map((row) => row.employee_id));
  const insertedCount = validRows.filter((row) => !existingSet.has(row.employee_id)).length;
  const updatedCount = validRows.length - insertedCount;

  const { error: employeesUpsertError } = await supabaseAdmin
    .from("employees")
    .upsert(
      validRows.map((row) => ({
        employee_id: row.employee_id,
        surname: row.surname,
        first_name: row.first_name,
        department: row.department,
        status: row.status,
      })),
      { onConflict: "employee_id" }
    );

  if (employeesUpsertError) {
    return NextResponse.json({ error: employeesUpsertError.message }, { status: 500 });
  }

  const { error: profilesUpsertError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      validRows.map((row) => ({
        employee_id: row.employee_id,
        first_name: row.first_name,
        last_name: row.surname,
        full_name: [row.first_name, row.surname].filter(Boolean).join(" "),
        department: row.department,
        job_title: row.job_title,
        campaign: row.campaign,
        work_arrangement: row.work_arrangement,
        role: row.app_role,
      })),
      { onConflict: "employee_id" }
    );

  if (profilesUpsertError) {
    return NextResponse.json({ error: profilesUpsertError.message }, { status: 500 });
  }

  const terminatedIds = validRows
    .filter((row) => row.status === "terminated")
    .map((row) => row.employee_id);

  if (terminatedIds.length > 0) {
    const { error: terminateError } = await supabaseAdmin
      .from("profiles")
      .update({ disabled_at: new Date().toISOString() })
      .in("employee_id", terminatedIds)
      .is("disabled_at", null);

    if (terminateError) {
      return NextResponse.json({ error: terminateError.message }, { status: 500 });
    }
  }

  const summary = {
    inserted_count: insertedCount,
    updated_count: updatedCount,
    terminated_count: terminatedIds.length,
    error_count: validationErrors.length,
  };

  const { error: uploadLogError } = await supabaseAdmin.from("roster_uploads").insert({
    uploaded_by: auth.user.id,
    file_name: payload.fileName,
    ...summary,
  });

  if (uploadLogError) {
    return NextResponse.json({ error: uploadLogError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ...summary,
    claim_ready_count: validRows.filter((row) => row.status === "active").length,
    total_valid_rows: validRows.length,
    validation_errors: validationErrors.slice(0, 20),
  });
}
