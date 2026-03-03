"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase/client";

type UserRow = {
  id: string;
  full_name: string;
  department: string | null;
  campaign: string | null;
  employee_id: string | null;
  job_title: string | null;
  claimed: boolean;
};

type ImportSummary = {
  inserted_count: number;
  updated_count: number;
  terminated_count: number;
  error_count: number;
  claim_ready_count?: number;
  total_valid_rows?: number;
  validation_errors?: string[];
};

type UploadHistoryRow = {
  id: string;
  uploaded_by: string;
  uploaded_at: string;
  file_name: string | null;
  inserted_count: number;
  updated_count: number;
  terminated_count: number;
  error_count: number;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [employeeIdFilter, setEmployeeIdFilter] = useState("");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [claimedFilter, setClaimedFilter] = useState("all");
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [history, setHistory] = useState<UploadHistoryRow[]>([]);

  const hasUploadInput = useMemo(() => Boolean(file || csvText.trim()), [file, csvText]);

  const getAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(error.message);
    }

    const token = data.session?.access_token;
    if (!token) {
      throw new Error("Session expired. Please sign in again.");
    }
    return token;
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    const { data, error: loadError } = await supabase
      .from("profiles")
      .select("id, full_name, department, campaign, employee_id, job_title, claimed")
      .order("full_name", { ascending: true });

    if (loadError) {
      setUsersError(loadError.message);
      setUsers([]);
      setLoadingUsers(false);
      return;
    }

    setUsers(data ?? []);
    setLoadingUsers(false);
  };

  const loadUploadHistory = async () => {
    setHistoryLoading(true);
    setRosterError(null);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/admin/roster/history?limit=20", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json()) as {
        error?: string;
        uploads?: UploadHistoryRow[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load roster uploads.");
      }

      setHistory(payload.uploads ?? []);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to load roster uploads.";
      setRosterError(message);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRosterUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasUploadInput) {
      setRosterError("Upload a CSV file or paste CSV text.");
      return;
    }

    setUploading(true);
    setRosterError(null);
    setSummary(null);

    try {
      const token = await getAccessToken();
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      }
      if (csvText.trim()) {
        formData.append("csv_text", csvText.trim());
      }

      const response = await fetch("/api/admin/roster/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const payload = (await response.json()) as
        | ({ error?: string } & ImportSummary)
        | { error?: string };

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload && "error" in payload
            ? payload.error
            : "Roster upload failed.";
        throw new Error(message ?? "Roster upload failed.");
      }

      setSummary(payload as ImportSummary);
      setFile(null);
      setCsvText("");
      await Promise.all([loadUploadHistory(), loadUsers()]);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Roster upload failed.";
      setRosterError(message);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadUploadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verticalOptions = useMemo(
    () =>
      Array.from(new Set(users.map((user) => user.department?.trim()).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b)
      ),
    [users]
  );

  const campaignOptions = useMemo(
    () =>
      Array.from(new Set(users.map((user) => user.campaign?.trim()).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b)
      ),
    [users]
  );

  const roleOptions = useMemo(
    () =>
      Array.from(new Set(users.map((user) => user.job_title?.trim()).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b)
      ),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    const nameText = nameFilter.trim().toLowerCase();
    const employeeIdText = employeeIdFilter.trim().toLowerCase();

    return users.filter((user) => {
      const name = user.full_name?.trim() || "Unnamed";
      const employeeId = user.employee_id?.trim() || "";
      const vertical = user.department?.trim() || "Not set";
      const campaign = user.campaign?.trim() || "Not set";
      const role = user.job_title?.trim() || "Not set";
      const claimed = user.claimed ? "yes" : "no";

      if (searchText) {
        const searchable = `${name} ${employeeId} ${vertical} ${campaign} ${role} ${claimed}`.toLowerCase();
        if (!searchable.includes(searchText)) {
          return false;
        }
      }

      if (nameText && !name.toLowerCase().includes(nameText)) {
        return false;
      }

      if (employeeIdText && !employeeId.toLowerCase().includes(employeeIdText)) {
        return false;
      }

      if (verticalFilter !== "all" && vertical !== verticalFilter) {
        return false;
      }

      if (campaignFilter !== "all" && campaign !== campaignFilter) {
        return false;
      }

      if (roleFilter !== "all" && role !== roleFilter) {
        return false;
      }

      if (claimedFilter !== "all" && claimed !== claimedFilter) {
        return false;
      }

      return true;
    });
  }, [
    users,
    search,
    nameFilter,
    employeeIdFilter,
    verticalFilter,
    campaignFilter,
    roleFilter,
    claimedFilter,
  ]);

  const clearFilters = () => {
    setSearch("");
    setNameFilter("");
    setEmployeeIdFilter("");
    setVerticalFilter("all");
    setCampaignFilter("all");
    setRoleFilter("all");
    setClaimedFilter("all");
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="card-muted">Roster upload and user records.</p>
        </div>
      </div>

      <form className="card" onSubmit={handleRosterUpload} style={{ marginBottom: 16 }}>
        <div className="card-title">Import CSV Roster</div>
        <div className="card-muted" style={{ marginTop: 8 }}>
          Required: <code>employee_id</code>, <code>surname</code> (or <code>last_name</code>). Optional: <code>first_name</code>, <code>vertical</code>/<code>department</code>, <code>campaign</code>, <code>role</code> (position), <code>work_setup</code>, <code>next_role</code>, <code>status</code>.
        </div>
        <div className="form" style={{ marginTop: 12 }}>
          <label className="form">
            <span>CSV File</span>
            <input
              className="input"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="form">
            <span>Or paste CSV text</span>
            <textarea
              className="textarea"
              rows={7}
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder="employee_id,surname,status&#10;123456,Dela Cruz,active"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={uploading || !hasUploadInput}>
            {uploading ? "Uploading..." : "Upload Roster"}
          </button>
          {rosterError ? <div className="helper">{rosterError}</div> : null}
        </div>

        {summary ? (
          <div className="card" style={{ marginTop: 14, borderRadius: 14 }}>
            <div className="card-title">Import Summary</div>
            <div className="grid grid-2" style={{ marginTop: 10 }}>
              <div className="chip">Inserted: {summary.inserted_count}</div>
              <div className="chip">Updated: {summary.updated_count}</div>
              <div className="chip">Terminated: {summary.terminated_count}</div>
              <div className="chip">Errors: {summary.error_count}</div>
              {summary.claim_ready_count !== undefined ? (
                <div className="chip">Claim Ready: {summary.claim_ready_count}</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </form>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Recent Uploads</div>
        {historyLoading ? (
          <div className="card-muted" style={{ marginTop: 10 }}>
            Loading uploads...
          </div>
        ) : history.length === 0 ? (
          <div className="card-muted" style={{ marginTop: 10 }}>
            No uploads yet.
          </div>
        ) : (
          <div className="table" style={{ marginTop: 12 }}>
            <div className="table-row" style={{ "--columns": 6 } as CSSProperties}>
              <strong>Uploaded</strong>
              <strong>File</strong>
              <strong>Inserted</strong>
              <strong>Updated</strong>
              <strong>Terminated</strong>
              <strong>Errors</strong>
            </div>
            {history.map((row) => (
              <div className="table-row" style={{ "--columns": 6 } as CSSProperties} key={row.id}>
                <div>{formatDateTime(row.uploaded_at)}</div>
                <div>{row.file_name ?? "-"}</div>
                <div>{row.inserted_count}</div>
                <div>{row.updated_count}</div>
                <div>{row.terminated_count}</div>
                <div>{row.error_count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {usersError ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="helper">{usersError}</div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Search & Filters</div>
        <div className="form" style={{ marginTop: 12 }}>
          <label className="form">
            <span>Search</span>
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, employee ID, vertical, campaign, role"
            />
          </label>

          <div className="grid grid-2">
            <label className="form">
              <span>Name</span>
              <input
                className="input"
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="Filter by name"
              />
            </label>
            <label className="form">
              <span>Employee ID</span>
              <input
                className="input"
                value={employeeIdFilter}
                onChange={(event) => setEmployeeIdFilter(event.target.value)}
                placeholder="Filter by ID"
              />
            </label>
          </div>

          <div className="grid grid-2">
            <label className="form">
              <span>Vertical</span>
              <select
                className="select"
                value={verticalFilter}
                onChange={(event) => setVerticalFilter(event.target.value)}
              >
                <option value="all">All</option>
                {verticalOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="form">
              <span>Campaign</span>
              <select
                className="select"
                value={campaignFilter}
                onChange={(event) => setCampaignFilter(event.target.value)}
              >
                <option value="all">All</option>
                {campaignOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-2">
            <label className="form">
              <span>Role</span>
              <select
                className="select"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="all">All</option>
                {roleOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="form">
              <span>Claimed</span>
              <select
                className="select"
                value={claimedFilter}
                onChange={(event) => setClaimedFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>

          <button type="button" className="btn btn-outline" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      <div className="table">
        <div className="table-row" style={{ "--columns": 6 } as CSSProperties}>
          <strong>Name</strong>
          <strong>Employee ID</strong>
          <strong>Vertical</strong>
          <strong>Campaign</strong>
          <strong>Role</strong>
          <strong>Claimed</strong>
        </div>
        {loadingUsers ? (
          <div className="card-muted">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="card-muted">No users match your filters.</div>
        ) : users.length === 0 ? (
          <div className="card-muted">No users found.</div>
        ) : (
          filteredUsers.map((user) => (
            <div className="table-row" style={{ "--columns": 6 } as CSSProperties} key={user.id}>
              <div>{user.full_name || "Unnamed"}</div>
              <div>{user.employee_id ?? "-"}</div>
              <div>{user.department ?? "Not set"}</div>
              <div>{user.campaign ?? "Not set"}</div>
              <div>{user.job_title?.trim() || "Not set"}</div>
              <div>{user.claimed ? "Yes" : "No"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
