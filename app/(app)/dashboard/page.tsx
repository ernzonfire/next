"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { formatDateTime } from "@/lib/utils/format";

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

type Event = {
  id: string;
  title: string;
  event_date: string;
  points: number;
};

export default function DashboardPage() {
  const { profile } = useCurrentUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: announcementsData }, { data: eventsData }] = await Promise.all([
        supabase
          .from("announcements")
          .select("id, title, body, created_at")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("events")
          .select("id, title, event_date, points")
          .gte("event_date", new Date().toISOString())
          .order("event_date", { ascending: true })
          .limit(3),
      ]);

      setAnnouncements(announcementsData ?? []);
      setEvents(eventsData ?? []);
      setLoading(false);
    };

    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="card-muted">Everything you need, in one place.</p>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card stat">
          <div className="stat-label">Points Balance</div>
          <div className="stat-value">{profile?.points_balance ?? 0}</div>
          <div className="card-muted">Updated after each event scan.</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Upcoming Events</div>
          <div className="stat-value">{events.length}</div>
          <div className="card-muted">This month</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Rewards Ready</div>
          <div className="stat-value">
            {profile ? Math.floor(profile.points_balance / 100) : 0}
          </div>
          <div className="card-muted">Estimate based on balance</div>
        </div>
      </div>

      <div className="section-title">Latest Announcements</div>
      <div className="list">
        {loading && announcements.length === 0 ? (
          <div className="card-muted">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div className="card-muted">No announcements yet.</div>
        ) : (
          announcements.map((announcement) => (
            <div className="card" key={announcement.id}>
              <div className="card-title">{announcement.title}</div>
              <div className="card-muted">{announcement.body}</div>
            </div>
          ))
        )}
      </div>

      <div className="section-title">Upcoming Events</div>
      <div className="list">
        {loading && events.length === 0 ? (
          <div className="card-muted">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="card-muted">No upcoming events.</div>
        ) : (
          events.map((event) => (
            <div className="list-item" key={event.id}>
              <div>
                <div className="card-title">{event.title}</div>
                <div className="card-muted">{formatDateTime(event.event_date)}</div>
              </div>
              <span className="chip">+{event.points} pts</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
