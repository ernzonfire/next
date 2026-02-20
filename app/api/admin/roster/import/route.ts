import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { requireAdminFromRequest } from "@/lib/supabase/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

type ParsedRosterRow = {
  employee_id: string;
  surname: string;
  first_name: string | null;
  department: string | null;
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

  const requiredHeaders = ["employee_id", "surname", "status"];
  const missingHeaders = requiredHeaders.filter((header) => !parsed.headers.includes(header));
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
    const employeeId = normalizeCell(row.employee_id);
    const surname = normalizeCell(row.surname);
    const firstName = normalizeCell(row.first_name) || null;
    const department = normalizeCell(row.department) || null;
    const status = normalizeCell(row.status).toLowerCase();

    if (!employeeId || !surname || !status) {
      validationErrors.push(`Row ${rowNumber}: employee_id, surname, and status are required.`);
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

    validRowsByEmployee.set(employeeId, {
      employee_id: employeeId,
      surname,
      first_name: firstName,
      department,
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
    total_valid_rows: validRows.length,
    validation_errors: validationErrors.slice(0, 20),
  });
}
