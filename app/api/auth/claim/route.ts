import { NextResponse } from "next/server";
import {
  createServiceRoleClient,
  employeeIdToEmail,
  normalizeNameForMatch,
  normalizeRole,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

type ClaimRequestBody = {
  employee_id?: string;
  surname?: string;
  password?: string;
};

const findAuthUserByEmail = async (
  supabaseAdmin: ReturnType<typeof createServiceRoleClient>,
  email: string
) => {
  let page = 1;
  const perPage = 500;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }

    const user = (data?.users ?? []).find(
      (entry) => (entry.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (user) {
      return user;
    }

    if (!data?.users || data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
};

export async function POST(request: Request) {
  let body: ClaimRequestBody;

  try {
    body = (await request.json()) as ClaimRequestBody;
  } catch (_error) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const employeeId = String(body.employee_id ?? "").trim();
  const surnameInput = String(body.surname ?? "").trim();
  const password = String(body.password ?? "");

  if (!/^\d{5,7}$/.test(employeeId)) {
    return NextResponse.json({ error: "employee_id must be 5 to 7 digits." }, { status: 400 });
  }

  if (!surnameInput) {
    return NextResponse.json({ error: "surname is required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters." }, { status: 400 });
  }

  const supabaseAdmin = createServiceRoleClient();

  const { data: employee, error: employeeError } = await supabaseAdmin
    .from("employees")
    .select("employee_id, surname, first_name, department, status")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (employeeError) {
    return NextResponse.json({ error: employeeError.message }, { status: 500 });
  }

  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  if (employee.status !== "active") {
    return NextResponse.json({ error: "Employee is not active." }, { status: 403 });
  }

  const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
    .from("profiles")
    .select("id, employee_id, first_name, last_name, full_name, department, role, auth_user_id, disabled_at, claimed_at")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (profileLookupError) {
    return NextResponse.json({ error: profileLookupError.message }, { status: 500 });
  }

  let profile = existingProfile;

  if (!profile) {
    const { error: profileCreateError } = await supabaseAdmin.from("profiles").insert({
      employee_id: employeeId,
      first_name: employee.first_name,
      last_name: employee.surname,
      full_name: [employee.first_name, employee.surname].filter(Boolean).join(" "),
      department: employee.department,
      role: "employee",
      claimed: false,
    });

    if (profileCreateError) {
      return NextResponse.json({ error: profileCreateError.message }, { status: 500 });
    }

    const { data: createdProfile, error: createdProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, employee_id, first_name, last_name, full_name, department, role, auth_user_id, disabled_at, claimed_at")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (createdProfileError || !createdProfile) {
      return NextResponse.json(
        { error: createdProfileError?.message ?? "Failed to prepare profile." },
        { status: 500 }
      );
    }

    profile = createdProfile;
  }

  if (profile.disabled_at) {
    return NextResponse.json({ error: "Account is disabled." }, { status: 403 });
  }

  if (profile.auth_user_id) {
    return NextResponse.json({ error: "Account already claimed." }, { status: 409 });
  }

  const normalizedInputSurname = normalizeNameForMatch(surnameInput);
  const normalizedStoredSurname = normalizeNameForMatch(profile.last_name ?? employee.surname ?? "");

  if (!normalizedStoredSurname || normalizedInputSurname !== normalizedStoredSurname) {
    return NextResponse.json({ error: "Surname does not match our records." }, { status: 403 });
  }

  const email = employeeIdToEmail(employeeId);
  const role = normalizeRole(profile.role);

  const createPayload = {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      employee_id: employeeId,
      first_name: profile.first_name ?? employee.first_name ?? null,
      last_name: profile.last_name ?? employee.surname,
      full_name:
        profile.full_name || [profile.first_name ?? employee.first_name, profile.last_name ?? employee.surname]
          .filter(Boolean)
          .join(" "),
      department: profile.department ?? employee.department ?? null,
    },
    app_metadata: { role },
  };

  let authUserId: string | null = null;
  const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser(
    createPayload
  );

  if (createdUser?.user?.id) {
    authUserId = createdUser.user.id;
  }

  if (createUserError && createUserError.message.toLowerCase().includes("already")) {
    try {
      const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, email);
      if (!existingAuthUser?.id) {
        return NextResponse.json({ error: "Auth account already exists." }, { status: 409 });
      }

      const { error: updateExistingUserError } = await supabaseAdmin.auth.admin.updateUserById(
        existingAuthUser.id,
        {
          password,
          user_metadata: createPayload.user_metadata,
          app_metadata: createPayload.app_metadata,
          email_confirm: true,
        }
      );

      if (updateExistingUserError) {
        return NextResponse.json({ error: updateExistingUserError.message }, { status: 409 });
      }

      authUserId = existingAuthUser.id;
    } catch (lookupError) {
      return NextResponse.json(
        {
          error:
            lookupError instanceof Error
              ? lookupError.message
              : "Auth account already exists and cannot be recovered.",
        },
        { status: 409 }
      );
    }
  } else if (createUserError) {
    const message = createUserError.message || "Unable to create auth account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!authUserId) {
    return NextResponse.json({ error: "Unable to create auth account." }, { status: 400 });
  }

  const claimedAt = new Date().toISOString();
  const { error: profileUpdateError } = await supabaseAdmin
    .from("profiles")
    .update({
      id: authUserId,
      auth_user_id: authUserId,
      first_name: profile.first_name ?? employee.first_name ?? null,
      last_name: profile.last_name ?? employee.surname,
      full_name:
        profile.full_name || [profile.first_name ?? employee.first_name, profile.last_name ?? employee.surname]
          .filter(Boolean)
          .join(" "),
      department: profile.department ?? employee.department ?? null,
      claimed: true,
      claimed_at: claimedAt,
      role,
    })
    .eq("employee_id", employeeId);

  if (profileUpdateError) {
    return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    employee_id: employeeId,
    email,
    claimed_at: claimedAt,
  });
}
