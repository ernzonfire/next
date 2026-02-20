"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase/client";

type ImportSummary = {
  inserted_count: number;
  updated_count: number;
  terminated_count: number;
  error_count: number;
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

export default function AdminRosterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [history, setHistory] = useState<UploadHistoryRow[]>([]);

  const hasInput = useMemo(() => Boolean(file || csvText.trim()), [file, csvText]);

  const getAccessToken = async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const token = data.session?.access_token;
    if (!token) {
      throw new Error("Session expired. Please sign in again.");
    }

    return token;
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setError(null);

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
      setError(message);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasInput) {
      setError("Upload a CSV file or paste CSV text.");
      return;
    }

    setLoading(true);
    setError(null);
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
      await loadHistory();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Roster upload failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Roster Upload</h1>
          <p className="card-muted">Upload CSV roster to create/update employee records.</p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit} style={{ marginTop: 12, marginBottom: 16 }}>
        <div className="card-title">Import CSV</div>
        <div className="card-muted" style={{ marginBottom: 12 }}>
          Required columns: <code>employee_id</code>, <code>surname</code>, <code>status</code>. Optional: <code>first_name</code>, <code>department</code>.
        </div>

        <div className="form">
          <label className="form">
            <span>CSV file</span>
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
              rows={8}
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder="employee_id,surname,status\n123456,Dela Cruz,active"
            />
          </label>

          <button className="btn btn-primary" type="submit" disabled={loading || !hasInput}>
            {loading ? "Uploading..." : "Upload Roster"}
          </button>
        </div>

        {error ? (
          <div className="helper" style={{ marginTop: 12 }}>
            {error}
          </div>
        ) : null}

        {summary ? (
          <div className="card" style={{ marginTop: 14, borderRadius: 14 }}>
            <div className="card-title">Import Summary</div>
            <div className="grid grid-2" style={{ marginTop: 10 }}>
              <div className="chip">Inserted: {summary.inserted_count}</div>
              <div className="chip">Updated: {summary.updated_count}</div>
              <div className="chip">Terminated: {summary.terminated_count}</div>
              <div className="chip">Errors: {summary.error_count}</div>
            </div>
            {summary.total_valid_rows !== undefined ? (
              <div className="card-muted" style={{ marginTop: 10 }}>
                Valid rows processed: {summary.total_valid_rows}
              </div>
            ) : null}
            {summary.validation_errors && summary.validation_errors.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <div className="card-muted">Validation errors (first {summary.validation_errors.length}):</div>
                <div className="list" style={{ marginTop: 8 }}>
                  {summary.validation_errors.map((rowError) => (
                    <div className="card-muted" key={rowError}>
                      • {rowError}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </form>

      <div className="card">
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
    </div>
  );
}
