"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";

type Thread = {
  id: string;
  status: string;
  updated_at: string;
  profiles: { full_name: string } | null;
};

type ThreadQueryRow = {
  id: string;
  status: string;
  updated_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

export default function AdminChatPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("chat_threads")
        .select("id, status, updated_at, profiles(full_name)")
        .order("updated_at", { ascending: false });

      if (loadError) {
        setError(loadError.message);
      }

      const normalized =
        ((data ?? []) as ThreadQueryRow[]).map((row) => ({
          ...row,
          profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
        })) ?? [];

      setThreads(normalized);
      setLoading(false);
    };

    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Chat Threads</h1>
          <p className="card-muted">Respond to employee concerns quickly.</p>
        </div>
      </div>

      {error ? <div className="card-muted">{error}</div> : null}

      <div className="list">
        {loading ? (
          <div className="card-muted">Loading threads...</div>
        ) : threads.length === 0 ? (
          <div className="card-muted">No threads yet.</div>
        ) : (
          threads.map((thread) => (
            <div className="card" key={thread.id}>
              <div className="card-title">{thread.profiles?.full_name ?? "Employee"}</div>
              <div className="card-muted">Status: {thread.status}</div>
              <div className="card-muted" style={{ marginTop: 8 }}>
                Updated {formatDate(thread.updated_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
