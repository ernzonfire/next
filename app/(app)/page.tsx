"use client";

import { useEffect, useMemo, useState } from "react";
import { hotItems, upcomingEvents } from "@/app/components/mockData";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

export default function HomePage() {
  const { profile } = useCurrentUser();
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  const greeting = useMemo(() => {
    if (hour === null) return "Hello";
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 18) return "Good afternoon";
    return "Good evening";
  }, [hour]);

  const greetingName = useMemo(() => {
    const preferred = profile?.preferred_name?.trim();
    if (preferred) return preferred;

    const first = profile?.first_name?.trim();
    if (first) return first;

    const fullNameFirstToken = profile?.full_name?.trim()?.split(/\s+/)[0];
    if (fullNameFirstToken) return fullNameFirstToken;

    return "there";
  }, [profile?.first_name, profile?.full_name, profile?.preferred_name]);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>{`${greeting}, ${greetingName}!`}</h1>
          <p className="card-muted">Track points, events, and reward highlights.</p>
        </div>
      </header>

      <section className="card stat" aria-label="Points summary" style={{ marginTop: 14 }}>
        <span className="stat-label">Current Points</span>
        <span className="stat-value">{profile?.points_balance ?? 0}</span>
        <span className="card-muted">Earned through event attendance and check-ins.</span>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2 className="section-title">Upcoming Events</h2>
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            paddingBottom: 4,
            scrollSnapType: "x mandatory",
          }}
        >
          {upcomingEvents.map((event) => (
            <article
              key={event.id}
              className="card"
              style={{
                minWidth: 230,
                maxWidth: 260,
                flex: "0 0 auto",
                scrollSnapAlign: "start",
              }}
            >
              <div className="chip" style={{ marginBottom: 8 }}>
                {event.tag}
              </div>
              <h3 className="card-title">{event.title}</h3>
              <p className="card-muted" style={{ marginTop: 6 }}>
                {event.startsAt}
              </p>
              <p className="card-muted">{event.location}</p>
              <p className="card-muted" style={{ marginTop: 8 }}>
                +{event.points} pts
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2 className="section-title">Hot Items</h2>
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            paddingBottom: 4,
            scrollSnapType: "x mandatory",
          }}
        >
          {hotItems.map((item) => (
            <article
              key={item.id}
              className="card"
              style={{
                minWidth: 220,
                maxWidth: 250,
                flex: "0 0 auto",
                scrollSnapAlign: "start",
              }}
            >
              <div className="card-title">{item.name}</div>
              <p className="card-muted">{item.details}</p>
              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
                <span className="chip">{item.category}</span>
                <strong style={{ color: "var(--brand-navy)" }}>{item.points} pts</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
