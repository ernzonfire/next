import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return null;
  return args[idx + 1] || null;
};

const filePath = getArg("file");
const domain = getArg("domain") || "next.com";
const roleArg = getArg("role") || "employee";
const defaultRole = roleArg === "admin" || roleArg === "committee" ? roleArg : "employee";
const resetExisting = args.includes("--reset-existing");
const noPassword = args.includes("--no-password");

if (!filePath) {
  console.error(
    "Usage: npm run import:employees -- --file /path/to/file.csv [--role employee] [--domain next.com] [--reset-existing] [--no-password]"
  );
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in your environment.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const content = fs.readFileSync(filePath, "utf-8");
const records = parse(content, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const outputDir = path.resolve("output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const credentialsPath = path.join(outputDir, "employee_credentials.csv");
const reportPath = path.join(outputDir, "employee_import_report.csv");

const credentialsRows = [["employee_id", "email", "temp_password", "role", "status"]];
const reportRows = [["employee_id", "status", "message"]];

const idRegex = /^\d{5,7}$/;
const monthMap = {
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

const makePassword = () => {
  const buffer = Buffer.from(Array.from({ length: 12 }, () => Math.floor(Math.random() * 256)));
  return buffer.toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) + "!9";
};

const formatDob = (dobText) => {
  const raw = String(dobText || "").trim();
  if (!raw) return null;

  // MM/DD/YYYY or M/D/YYYY
  let match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const mm = match[1].padStart(2, "0");
    const dd = match[2].padStart(2, "0");
    const yyyy = match[3];
    return `${mm}${dd}${yyyy}`;
  }

  // YYYY-MM-DD
  match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const mm = match[2].padStart(2, "0");
    const dd = match[3].padStart(2, "0");
    const yyyy = match[1];
    return `${mm}${dd}${yyyy}`;
  }

  // D-MMM-YYYY
  match = raw.match(/^(\d{1,2})[-/ ]([A-Za-z]+)[-/ ](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = monthMap[match[2].toLowerCase()];
    const year = match[3];
    if (!month) return null;
    return `${String(month).padStart(2, "0")}${day}${year}`;
  }

  // MMM D, YYYY
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

const loadExistingUsers = async () => {
  const users = new Map();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return { error };
    }

    const batch = data?.users ?? [];
    for (const user of batch) {
      if (user.email) {
        users.set(user.email.toLowerCase(), user);
      }
    }

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return { users };
};

const { users: existingUsers, error: existingUsersError } = await loadExistingUsers();
if (existingUsersError) {
  console.error(`Failed to load existing users: ${existingUsersError.message}`);
  process.exit(1);
}

for (const row of records) {
  const employeeId = String(row["EID"] || "").trim();
  const firstName = String(row["First Name"] || "").trim();
  const lastName = String(row["Last Name"] || "").trim();
  const jobTitle = String(row["Job"] || "").trim();
  const campaign = String(row["Client/LOB"] || "").trim();
  const site = String(row["Site"] || "").trim();
  const workArrangement = String(row["WAH/On Site"] || "").trim();
  const dobText = String(row["DOB"] || "").trim();

  if (!idRegex.test(employeeId)) {
    reportRows.push([employeeId || "(missing)", "skipped", "Invalid employee ID"]);
    continue;
  }

  const email = `${employeeId}@${domain}`;
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const dobFormatted = formatDob(dobText);

  if (!dobFormatted) {
    reportRows.push([employeeId, "skipped", "DOB must include year (mm/dd/yyyy)"]);
    continue;
  }

  const derivedTempPassword = `${employeeId}${dobFormatted}`;
  const tempPassword = noPassword ? makePassword() : derivedTempPassword;

  const metadata = {
    employee_id: employeeId,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    job_title: jobTitle || null,
    campaign: campaign || null,
    site: site || null,
    work_arrangement: workArrangement || null,
    dob_text: dobText || null,
  };

  const existingUser = existingUsers.get(email.toLowerCase());

  if (existingUser?.id) {
    const updates = {
      user_metadata: metadata,
      app_metadata: { role: defaultRole },
    };

    if (resetExisting) {
      if (noPassword) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          updates
        );

        if (updateError) {
          reportRows.push([employeeId, "error", updateError.message]);
          continue;
        }

        await supabaseAdmin.from("profiles").upsert({
          id: existingUser.id,
          employee_id: employeeId,
          first_name: firstName || null,
          last_name: lastName || null,
          full_name: fullName || null,
          job_title: jobTitle || null,
          campaign: campaign || null,
          site: site || null,
          work_arrangement: workArrangement || null,
          dob_text: dobText || null,
          role: defaultRole,
        });

        credentialsRows.push([employeeId, email, "", defaultRole, "updated"]);
        reportRows.push([employeeId, "updated", "Profile updated (password unchanged)"]);
        continue;
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          ...updates,
          password: derivedTempPassword,
        }
      );

      if (updateError) {
        reportRows.push([employeeId, "error", updateError.message]);
        continue;
      }

      await supabaseAdmin.from("profiles").upsert({
        id: existingUser.id,
        employee_id: employeeId,
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: fullName || null,
        job_title: jobTitle || null,
        campaign: campaign || null,
        site: site || null,
        work_arrangement: workArrangement || null,
        dob_text: dobText || null,
        role: defaultRole,
      });

      credentialsRows.push([employeeId, email, derivedTempPassword, defaultRole, "reset"]);
      reportRows.push([employeeId, "updated", "Password reset and profile updated"]);
      continue;
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      updates
    );

    if (updateError) {
      reportRows.push([employeeId, "error", updateError.message]);
      continue;
    }

    await supabaseAdmin.from("profiles").upsert({
      id: existingUser.id,
      employee_id: employeeId,
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: fullName || null,
      job_title: jobTitle || null,
      campaign: campaign || null,
      site: site || null,
      work_arrangement: workArrangement || null,
      dob_text: dobText || null,
      role: defaultRole,
    });

    credentialsRows.push([employeeId, email, "", defaultRole, "exists"]);
    reportRows.push([employeeId, "exists", "User already exists; profile synced"]);
    continue;
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: { role: defaultRole },
  });

  if (createError || !created.user) {
    reportRows.push([employeeId, "error", createError?.message ?? "Create failed"]);
    continue;
  }

  await supabaseAdmin.from("profiles").upsert({
    id: created.user.id,
    employee_id: employeeId,
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
    job_title: jobTitle || null,
    campaign: campaign || null,
    site: site || null,
    work_arrangement: workArrangement || null,
    dob_text: dobText || null,
    role: defaultRole,
  });

  credentialsRows.push([employeeId, email, noPassword ? "" : tempPassword, defaultRole, "created"]);
  reportRows.push([
    employeeId,
    "created",
    noPassword ? "User created (password hidden)" : "User created",
  ]);
  existingUsers.set(email.toLowerCase(), created.user);
}

const toCsv = (rows) => rows.map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

fs.writeFileSync(credentialsPath, toCsv(credentialsRows), "utf-8");
fs.writeFileSync(reportPath, toCsv(reportRows), "utf-8");

console.log("Import complete.");
console.log(`Credentials: ${credentialsPath}`);
console.log(`Report: ${reportPath}`);
