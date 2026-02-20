"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { invokeEdge } from "@/lib/supabase/edge";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { formatDateTime } from "@/lib/utils/format";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  points: number;
  image_url: string | null;
};

export default function EventsPage() {
  const { role } = useCurrentUser();
  const isAdmin = role === "admin";
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportsEventImages, setSupportsEventImages] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [points, setPoints] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    setError(null);

    const withImage = await supabase
      .from("events")
      .select("id, title, description, event_date, points, image_url")
      .order("event_date", { ascending: true });

    if (!withImage.error) {
      setSupportsEventImages(true);
      setEvents((withImage.data ?? []) as EventItem[]);
      setLoading(false);
      return;
    }

    const missingImageColumn =
      withImage.error.code === "42703" ||
      withImage.error.message.toLowerCase().includes("image_url");

    if (missingImageColumn) {
      const withoutImage = await supabase
        .from("events")
        .select("id, title, description, event_date, points")
        .order("event_date", { ascending: true });

      if (withoutImage.error) {
        setError(withoutImage.error.message);
        setEvents([]);
      } else {
        setSupportsEventImages(false);
        const normalized = ((withoutImage.data ?? []) as Omit<EventItem, "image_url">[]).map(
          (row) => ({ ...row, image_url: null })
        );
        setEvents(normalized);
      }

      setLoading(false);
      return;
    }

    setError(withImage.error.message);
    setEvents([]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `events/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase
      .storage
      .from("event-images")
      .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });

    if (uploadError) {
      const message = uploadError.message.toLowerCase();
      if (message.includes("bucket not found")) {
        setSupportsEventImages(false);
        throw new Error("Event image bucket is missing. Run migration 008_event_images_storage.sql.");
      }
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage.from("event-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreate = async () => {
    if (!title.trim() || !eventDate) return;
    setSubmitting(true);
    setError(null);

    const isoDate = new Date(eventDate).toISOString();
    let imageUrl: string | null = null;

    try {
      if (supportsEventImages && imageFile) {
        imageUrl = await uploadImage(imageFile);
      }
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        event_date: isoDate,
        points,
      };
      if (supportsEventImages && imageUrl) {
        payload.image_url = imageUrl;
      }
      await invokeEdge<{ event_id: string }>("create-event", payload);
      setTitle("");
      setDescription("");
      setEventDate("");
      setPoints(10);
      setImageFile(null);
      setImagePreview(null);
      await load();
    } catch (invokeError) {
      const message = invokeError instanceof Error ? invokeError.message : "Unable to create event.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Events</h1>
          <p className="card-muted">Points are granted only by event scans.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link className="btn btn-outline" href="/events/scan">
            Event Check-In
          </Link>
          {isAdmin ? (
            <Link className="btn btn-outline" href="/admin/events/scan?fullscreen=1">
              Scan Attendees
            </Link>
          ) : null}
        </div>
      </div>

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Create Event</div>
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
              <span>Description</span>
              <textarea
                className="textarea"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="form">
              <span>Date & Time</span>
              <input
                className="input"
                type="datetime-local"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
              />
            </label>
            <label className="form">
              <span>Points</span>
              <input
                className="input"
                type="number"
                min={1}
                value={points}
                onChange={(event) => setPoints(Number(event.target.value))}
              />
            </label>
            {supportsEventImages ? (
              <label className="form">
                <span>Event Image (optional)</span>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setImageFile(file);
                    setImagePreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
                {imagePreview ? (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={imagePreview}
                      alt="Event preview"
                      style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
                    />
                  </div>
                ) : null}
              </label>
            ) : (
              <div className="card-muted">
                Event images are disabled until the image migrations are applied.
              </div>
            )}
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? "Creating..." : "Create Event"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="card-muted">{error}</div> : null}

      <div className="list">
        {loading ? (
          <div className="card-muted">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="card-muted">No events available.</div>
        ) : (
          events.map((event) => (
            <div className="card" key={event.id}>
              {event.image_url ? (
                <div style={{ margin: "-6px -6px 12px" }}>
                  <img
                    src={event.image_url}
                    alt={event.title}
                    style={{
                      width: "100%",
                      maxHeight: 220,
                      objectFit: "cover",
                      borderRadius: 14,
                      border: "1px solid var(--border)",
                    }}
                  />
                </div>
              ) : null}
              <div className="card-title">{event.title}</div>
              <div className="card-muted">{formatDateTime(event.event_date)}</div>
              {event.description ? (
                <div className="card-muted" style={{ marginTop: 8 }}>
                  <div
                    className={!expanded[event.id] ? "line-clamp-3" : undefined}
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {event.description}
                  </div>
                  {event.description.length > 140 ? (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [event.id]: !prev[event.id] }))
                      }
                    >
                      {expanded[event.id] ? "See less" : "See more"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div style={{ marginTop: 12 }}>
                <span className="chip">+{event.points} pts</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
