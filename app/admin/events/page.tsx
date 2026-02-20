"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { invokeEdge } from "@/lib/supabase/edge";
import { formatDateTime } from "@/lib/utils/format";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  points: number;
  event_code: string;
  image_url: string | null;
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportsEventImages, setSupportsEventImages] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [points, setPoints] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);

    const withImage = await supabase
      .from("events")
      .select("id, title, description, event_date, points, event_code, image_url")
      .order("event_date", { ascending: true });

    if (!withImage.error) {
      setSupportsEventImages(true);
      setEvents((withImage.data ?? []) as EventRow[]);
      setLoading(false);
      return;
    }

    const missingImageColumn =
      withImage.error.code === "42703" ||
      withImage.error.message.toLowerCase().includes("image_url");

    if (missingImageColumn) {
      const withoutImage = await supabase
        .from("events")
        .select("id, title, description, event_date, points, event_code")
        .order("event_date", { ascending: true });

      if (withoutImage.error) {
        setError(withoutImage.error.message);
        setEvents([]);
      } else {
        setSupportsEventImages(false);
        const normalized = ((withoutImage.data ?? []) as Omit<EventRow, "image_url">[]).map(
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

  const getImagePath = (url: string) => {
    const marker = "/storage/v1/object/public/event-images/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  };

  const handleDelete = async (event: EventRow) => {
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(event.id);
    setError(null);

    const { error: deleteError } = await supabase.from("events").delete().eq("id", event.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingId(null);
      return;
    }

    if (event.image_url) {
      const path = getImagePath(event.image_url);
      if (path) {
        await supabase.storage.from("event-images").remove([path]);
      }
    }

    setDeletingId(null);
    await load();
  };

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
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!eventDate) {
      setError("Event date and time are required.");
      return;
    }

    if (!Number.isFinite(points) || points < 1) {
      setError("Points must be at least 1.");
      return;
    }

    setSubmitting(true);

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
    } catch (invokeError) {
      const message = invokeError instanceof Error ? invokeError.message : "Unable to create event.";
      setError(message);
      setSubmitting(false);
      return;
    } finally {
      setSubmitting(false);
    }

    setTitle("");
    setDescription("");
    setEventDate("");
    setPoints(10);
    setImageFile(null);
    setImagePreview(null);
    setShowForm(false);
    await load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Events</h1>
          <p className="card-muted">Create events and manage point values.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={() => setShowForm((prev) => !prev)}>
            {showForm ? "Close" : "New Event"}
          </button>
          <Link className="btn btn-outline" href="/admin/events/qr?fullscreen=1">
            Event QR
          </Link>
        </div>
      </div>

      {showForm ? (
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
          <div className="card-muted">No events yet.</div>
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
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="chip">+{event.points} pts</span>
                <span className="chip">Code: {event.event_code}</span>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link className="btn btn-outline" href={`/admin/events/qr?event_id=${event.id}`}>
                  Open QR
                </Link>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => navigator.clipboard.writeText(event.event_code)}
                >
                  Copy Code
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => handleDelete(event)}
                  disabled={deletingId === event.id}
                >
                  {deletingId === event.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
