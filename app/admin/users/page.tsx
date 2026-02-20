"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase/client";

type UserRow = {
  id: string;
  full_name: string;
  department: string | null;
  employee_id: string | null;
  role: string;
  claimed: boolean;
};

type CreatePayload = {
  employee_id: string;
  first_name: string;
  last_name: string;
  job_title: string;
  campaign: string;
  site: string;
  work_arrangement: string;
  dob_text: string;
  role: "admin" | "employee" | "committee";
  temp_password: string;
};

type CreateResult = {
  email: string;
  tempPassword: string;
  role: "admin" | "employee" | "committee";
  passwordSource: "custom" | "derived" | "random";
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [payload, setPayload] = useState<CreatePayload>({
    employee_id: "",
    first_name: "",
    last_name: "",
    job_title: "",
    campaign: "",
    site: "",
    work_arrangement: "",
    dob_text: "",
    role: "employee",
    temp_password: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("profiles")
      .select("id, full_name, department, employee_id, role, claimed")
      .order("full_name", { ascending: true });

    if (loadError) {
      setError(loadError.message);
    }

    setUsers(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = (field: keyof CreatePayload, value: string) => {
    setPayload((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    setError(null);
    setResult(null);

    if (!/^\d{5,7}$/.test(payload.employee_id.trim())) {
      setError("Employee ID must be 5 to 7 digits.");
      return;
    }

    setSubmitting(true);

    const { data, error: createError } = await supabase.functions.invoke("create-employee", {
      body: {
        ...payload,
        employee_id: payload.employee_id.trim(),
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        job_title: payload.job_title.trim(),
        campaign: payload.campaign.trim(),
        site: payload.site.trim(),
        work_arrangement: payload.work_arrangement.trim(),
        dob_text: payload.dob_text.trim(),
        temp_password: payload.temp_password.trim() || undefined,
      },
    });

    if (createError) {
      setError(createError.message);
    setSubmitting(false);
    return;
  }

    setResult({
      email: data?.email ?? "user",
      tempPassword: data?.temp_password ?? "",
      role: data?.role ?? payload.role,
      passwordSource: data?.password_source ?? "custom",
    });
    setCopied(false);
    setPayload({
      employee_id: "",
      first_name: "",
      last_name: "",
      job_title: "",
      campaign: "",
      site: "",
      work_arrangement: "",
      dob_text: "",
      role: "employee",
      temp_password: "",
    });

    await load();
    setSubmitting(false);
  };

  const handleCopy = async () => {
    if (!result?.tempPassword) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (copyError) {
      console.error("Failed to copy password", copyError);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="card-muted">Manage roles and account status.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Create Employee Account</div>
        <div className="form" style={{ marginTop: 12 }}>
          <label className="form">
            <span>Employee ID</span>
            <input
              className="input"
              value={payload.employee_id}
              onChange={(event) => updateField("employee_id", event.target.value)}
              placeholder="5 to 7 digits"
              inputMode="numeric"
            />
          </label>
          <div className="grid grid-2">
            <label className="form">
              <span>First Name</span>
              <input
                className="input"
                value={payload.first_name}
                onChange={(event) => updateField("first_name", event.target.value)}
              />
            </label>
            <label className="form">
              <span>Last Name</span>
              <input
                className="input"
                value={payload.last_name}
                onChange={(event) => updateField("last_name", event.target.value)}
              />
            </label>
          </div>
          <label className="form">
            <span>Job Title</span>
            <input
              className="input"
              value={payload.job_title}
              onChange={(event) => updateField("job_title", event.target.value)}
            />
          </label>
          <label className="form">
            <span>Campaign / Client</span>
            <input
              className="input"
              value={payload.campaign}
              onChange={(event) => updateField("campaign", event.target.value)}
            />
          </label>
          <div className="grid grid-2">
            <label className="form">
              <span>Site</span>
              <input
                className="input"
                value={payload.site}
                onChange={(event) => updateField("site", event.target.value)}
              />
            </label>
            <label className="form">
              <span>Work Arrangement</span>
              <input
                className="input"
                value={payload.work_arrangement}
                onChange={(event) => updateField("work_arrangement", event.target.value)}
                placeholder="On Site / Work At Home"
              />
            </label>
          </div>
          <div className="grid grid-2">
            <label className="form">
              <span>DOB (Text)</span>
              <input
                className="input"
                value={payload.dob_text}
                onChange={(event) => updateField("dob_text", event.target.value)}
                placeholder="1-Jan"
              />
            </label>
            <label className="form">
              <span>Role</span>
              <select
                className="select"
                value={payload.role}
                onChange={(event) => updateField("role", event.target.value)}
              >
                <option value="employee">employee</option>
                <option value="admin">admin</option>
                <option value="committee">committee</option>
              </select>
            </label>
          </div>
          <label className="form">
              <span>Temporary Password (leave blank to auto-generate)</span>
              <input
                className="input"
                value={payload.temp_password}
                onChange={(event) => updateField("temp_password", event.target.value)}
                placeholder="Auto-generate if empty"
              />
            </label>
          <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating..." : "Create Account"}
          </button>
        </div>
        {result ? (
          <div className="card-muted" style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <div>
              Created <strong>{result.email}</strong> ({result.role})
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span>Temporary password:</span>
              <span
                className="chip"
                style={{
                  background: "rgba(0, 61, 166, 0.12)",
                  color: "var(--brand-blue)",
                }}
              >
                {result.tempPassword}
              </span>
              <button className="btn btn-outline" onClick={handleCopy} type="button">
                {copied ? "Copied!" : "Copy"}
              </button>
              <span className="helper">
                {result.passwordSource === "derived"
                  ? "From EID + DOB"
                  : result.passwordSource === "random"
                  ? "Auto-generated"
                  : "Custom"}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <div className="card-muted">{error}</div> : null}

      <div className="table">
        <div className="table-row" style={{ "--columns": 5 } as CSSProperties}>
          <strong>Name</strong>
          <strong>Employee ID</strong>
          <strong>Department</strong>
          <strong>Role</strong>
          <strong>Claimed</strong>
        </div>
        {loading ? (
          <div className="card-muted">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="card-muted">No users found.</div>
        ) : (
          users.map((user) => (
            <div className="table-row" style={{ "--columns": 5 } as CSSProperties} key={user.id}>
              <div>{user.full_name || "Unnamed"}</div>
              <div>{user.employee_id ?? "-"}</div>
              <div>{user.department ?? "-"}</div>
              <div>{user.role}</div>
              <div>{user.claimed ? "Yes" : "No"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
