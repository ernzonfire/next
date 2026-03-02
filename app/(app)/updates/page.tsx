"use client";

import { useState } from "react";
import { updatesFeed } from "@/app/components/mockData";

export default function UpdatesPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
          <p className="card-muted">Newsfeed for announcements, events, and culture notes.</p>
        </div>
      </header>

      <section className="list" style={{ marginTop: 14 }}>
        {updatesFeed.map((post) => {
          const isExpanded = Boolean(expanded[post.id]);
          return (
            <article className="card" key={post.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span className="chip">{post.category}</span>
                <span className="card-muted">{post.createdAt}</span>
              </div>

              <h2 className="card-title" style={{ marginTop: 10 }}>
                {post.title}
              </h2>

              <p className="card-muted" style={{ marginTop: 6 }}>
                {post.excerpt}
              </p>

              <p className={isExpanded ? "" : "line-clamp-3"} style={{ marginTop: 8 }}>
                {post.body}
              </p>

              <button type="button" className="text-link" onClick={() => toggleExpanded(post.id)}>
                {isExpanded ? "Show less" : "Read more"}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
