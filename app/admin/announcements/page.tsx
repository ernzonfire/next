"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";

type Announcement = {
  id: string;
  title: string;
  created_at: string;
  created_by: string;
  body: string;
};

export default function AdminAnnouncementsPage() {
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
          <p className="card-muted">Role-based editing with RLS enforced.</p>
        </div>
      </div>

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

      {error ? <div className="card-muted">{error}</div> : null}

      <div className="table">
        <div className="table-row">
          <strong>Title</strong>
          <strong>Date</strong>
          <strong>Body</strong>
          <strong>Actions</strong>
        </div>
        {loading ? (
          <div className="card-muted">Loading announcements...</div>
        ) : items.length === 0 ? (
          <div className="card-muted">No announcements yet.</div>
        ) : (
          items.map((item) => (
            <div className="table-row" key={item.id}>
              <div>{item.title}</div>
              <div>{formatDate(item.created_at)}</div>
              <div>{item.body}</div>
              <div>
                <button className="btn btn-ghost" onClick={() => handleDelete(item.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
