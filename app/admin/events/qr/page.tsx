"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "react-qr-code";
import { supabase } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils/format";

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  points: number;
  event_code: string;
};

export default function EventQrPage() {
  const searchParams = useSearchParams();
  const autoFullscreen = searchParams.get("fullscreen") === "1";
  const initialEventId = searchParams.get("event_id");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const selectedMeta = events.find((event) => event.id === selectedEvent) ?? null;

  useEffect(() => {
    const loadEvents = async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, event_date, points, event_code")
        .order("event_date", { ascending: true });

      setEvents((data as EventRow[]) ?? []);
      if (data && data.length > 0) {
        const match = initialEventId && data.find((event) => event.id === initialEventId);
        setSelectedEvent(match ? match.id : data[0].id);
      }
    };

    loadEvents();
  }, [initialEventId]);

  useEffect(() => {
    if (!autoFullscreen || !selectedEvent) return;
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => null);
    }
  }, [autoFullscreen, selectedEvent]);

  const qrValue = selectedMeta?.event_code ? `event:${selectedMeta.event_code}` : "";

  const handleCopy = async () => {
    if (!selectedMeta?.event_code) return;
    try {
      await navigator.clipboard.writeText(selectedMeta.event_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (_err) {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const svg = document.querySelector("#event-qr svg");
    if (!svg || !selectedMeta?.event_code) return;

    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 1024;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const png = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = png;
      link.download = `event-${selectedMeta.event_code}.png`;
      link.click();
    };

    img.src = url;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Event QR</h1>
          <p className="card-muted">Display this QR code at the venue.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Select Event</div>
        {events.length === 0 ? (
          <div className="card-muted">No events available. Create one first.</div>
        ) : (
          <select
            className="select"
            value={selectedEvent}
            onChange={(event) => setSelectedEvent(event.target.value)}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} · {formatDateTime(event.event_date)} · +{event.points} pts
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedMeta ? (
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">{selectedMeta.title}</div>
          <div className="card-muted" style={{ marginTop: 6 }}>
            {formatDateTime(selectedMeta.event_date)} · +{selectedMeta.points} pts
          </div>
          <div id="event-qr" style={{ margin: "16px 0" }}>
            <QRCode value={qrValue} size={260} />
          </div>
          <div className="card-muted">Code: {selectedMeta.event_code}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 12 }}>
            <button className="btn btn-outline" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy Code"}
            </button>
            <button className="btn btn-primary" onClick={handleDownload}>
              Download QR
            </button>
          </div>
          <div className="card-muted" style={{ marginTop: 6 }}>
            Employees scan or enter this code to check in.
          </div>
        </div>
      ) : null}
    </div>
  );
}
