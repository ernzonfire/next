"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { formatDate } from "@/lib/utils/format";

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  created_by: string;
};

export default function AnnouncementsPage() {
  const { role } = useCurrentUser();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("announcements")
      .select("id, title, body, created_at, created_by")
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    }

    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase
      .from("announcements")
      .insert({ title: title.trim(), body: body.trim() });

    if (insertError) {
      setError(insertError.message);
    } else {
      setTitle("");
      setBody("");
      await load();
    }

    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    setError(null);
    const { error: deleteError } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Announcements</h1>
          <p className="card-muted">Company-wide updates in one feed.</p>
        </div>
      </div>

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Create Announcement</div>
          <div className="form" style={{ marginTop: 12 }}>
            <label className="form">
              <span>Title</span>
              <input
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="form">
              <span>Message</span>
              <textarea
                className="textarea"
                rows={4}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="card-muted">{error}</div> : null}

      <div className="list">
        {loading ? (
          <div className="card-muted">Loading announcements...</div>
        ) : items.length === 0 ? (
          <div className="card-muted">No announcements yet.</div>
        ) : (
          items.map((item) => (
            <div className="card" key={item.id}>
              <div className="card-title">{item.title}</div>
              <div className="card-muted" style={{ marginBottom: 10 }}>
                {item.body}
              </div>
              <div className="card-muted">{formatDate(item.created_at)}</div>
              {isAdmin ? (
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: 10 }}
                  onClick={() => handleDelete(item.id)}
                >
                  Delete
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
