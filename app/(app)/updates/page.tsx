"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  image_url: string | null;
};

export default function UpdatesPage() {
  const [posts, setPosts] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    const loadAnnouncements = async () => {
      setLoading(true);
      setError(null);

      const withImage = await supabase
        .from("announcements")
        .select("id, title, body, created_at, image_url")
        .order("created_at", { ascending: false });

      if (!withImage.error) {
        if (!cancelled) {
          setPosts((withImage.data ?? []) as AnnouncementRow[]);
          setLoading(false);
        }
        return;
      }

      const fallback = await supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (fallback.error) {
          setError(fallback.error.message);
          setPosts([]);
        } else {
          setPosts(
            ((fallback.data ?? []) as Omit<AnnouncementRow, "image_url">[]).map((row) => ({
              ...row,
              image_url: null,
            }))
          );
        }
        setLoading(false);
      }
    };

    loadAnnouncements();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Updates</h1>
          <p className="card-muted">Latest announcements from admin.</p>
        </div>
      </header>

      <section className="list" style={{ marginTop: 14 }}>
        {loading ? (
          <div className="card-muted">Loading updates...</div>
        ) : error ? (
          <div className="card-muted">{error}</div>
        ) : posts.length === 0 ? (
          <div className="card-muted">No announcements yet.</div>
        ) : (
          posts.map((post) => {
            const isExpanded = Boolean(expanded[post.id]);
            const hasLongBody = post.body.length > 220;
            return (
              <article className="card" key={post.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span className="chip">Announcement</span>
                  <span className="card-muted">{formatDate(post.created_at)}</span>
                </div>

                <h2 className="card-title" style={{ marginTop: 10 }}>
                  {post.title}
                </h2>

                {post.image_url ? (
                  <div style={{ marginTop: 10 }}>
                    <img
                      src={post.image_url}
                      alt={post.title}
                      style={{
                        width: "100%",
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        maxHeight: 340,
                        objectFit: "cover",
                      }}
                    />
                  </div>
                ) : null}

                <p
                  className={isExpanded ? "" : hasLongBody ? "line-clamp-3" : ""}
                  style={{ marginTop: 10, whiteSpace: "pre-wrap" }}
                >
                  {post.body}
                </p>

                {hasLongBody ? (
                  <button type="button" className="text-link" onClick={() => toggleExpanded(post.id)}>
                    {isExpanded ? "Show less" : "Read more"}
                  </button>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
