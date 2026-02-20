import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return null;
  return args[idx + 1] || null;
};

const fromDomainRaw = getArg("from");
const toDomainRaw = getArg("to");
const dryRun = args.includes("--dry-run");

if (!fromDomainRaw || !toDomainRaw) {
  console.error(
    "Usage: npm run update:email-domain -- --from next.local --to next.com [--dry-run]"
  );
  process.exit(1);
}

const normalizeDomain = (value) => value.replace(/^@/, "").trim().toLowerCase();
const fromDomain = normalizeDomain(fromDomainRaw);
const toDomain = normalizeDomain(toDomainRaw);

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in your environment.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const outputDir = path.resolve("output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const reportPath = path.join(outputDir, "email_domain_update_report.csv");
const reportRows = [["user_id", "old_email", "new_email", "status", "message"]];

const loadUsers = async () => {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
};

let users = [];
try {
  users = await loadUsers();
} catch (error) {
  console.error(`Failed to load users: ${error.message}`);
  process.exit(1);
}

const emailIndex = new Set(users.map((user) => (user.email || "").toLowerCase()));
let updatedCount = 0;
let skippedCount = 0;

for (const user of users) {
  const email = (user.email || "").toLowerCase();
  if (!email || !email.endsWith(`@${fromDomain}`)) {
    continue;
  }

  const localPart = email.slice(0, email.length - (`@${fromDomain}`).length);
  const newEmail = `${localPart}@${toDomain}`.toLowerCase();

  if (emailIndex.has(newEmail)) {
    reportRows.push([user.id, email, newEmail, "skipped", "target email already exists"]);
    skippedCount += 1;
    continue;
  }

  if (dryRun) {
    reportRows.push([user.id, email, newEmail, "dry-run", "not updated"]);
    continue;
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    email: newEmail,
    email_confirm: true,
  });

  if (error) {
    reportRows.push([user.id, email, newEmail, "error", error.message]);
    skippedCount += 1;
    continue;
  }

  emailIndex.delete(email);
  emailIndex.add(newEmail);
  updatedCount += 1;
  reportRows.push([user.id, email, newEmail, "updated", "ok"]);
}

const toCsv = (rows) =>
  rows
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

fs.writeFileSync(reportPath, toCsv(reportRows), "utf-8");

console.log(`Updated: ${updatedCount}`);
console.log(`Skipped: ${skippedCount}`);
console.log(`Report: ${reportPath}`);
