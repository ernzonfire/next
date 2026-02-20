"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { invokeEdge } from "@/lib/supabase/edge";
import QrScanner from "@/components/qr/QrScanner";
import { formatDateTime } from "@/lib/utils/format";

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  points: number;
};

type StatusState = {
  type: "success" | "error" | "info";
  message: string;
};

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EventScanPage() {
  const searchParams = useSearchParams();
  const autoFullscreen = searchParams.get("fullscreen") === "1";
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [status, setStatus] = useState<StatusState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [scanOnly, setScanOnly] = useState(false);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const autoStartedRef = useRef(false);

  const selectedMeta = events.find((event) => event.id === selectedEvent) ?? null;

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("events")
        .select("id, title, event_date, points")
        .order("event_date", { ascending: true });

      setEvents((data as EventRow[]) ?? []);
      if (data && data.length > 0) {
        setSelectedEvent(data[0].id);
      }
      setLoading(false);
    };

    loadEvents();
  }, []);

  useEffect(() => {
    const handleChange = () => {
      if (!document.fullscreenElement) {
        setScanOnly(false);
        document.body.style.overflow = "";
      }
    };

    document.addEventListener("fullscreenchange", handleChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.body.style.overflow = "";
    };
  }, []);

  const enterFullscreen = useCallback(async () => {
    if (!selectedEvent) {
      setStatus({ type: "error", message: "Select an event before scanning." });
      return;
    }

    setScanOnly(true);
    document.body.style.overflow = "hidden";

    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Fullscreen blocked";
        setStatus({ type: "error", message: `Fullscreen unavailable: ${message}` });
      }
    }
  }, [selectedEvent]);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch (_err) {
        // ignore
      }
    }
    setScanOnly(false);
    document.body.style.overflow = "";
  }, []);

  useEffect(() => {
    if (!autoFullscreen || !selectedEvent || autoStartedRef.current) return;
    autoStartedRef.current = true;
    enterFullscreen();
  }, [autoFullscreen, selectedEvent, enterFullscreen]);

  const invokeGrant = useCallback(
    async (payload: { event_id: string; user_id?: string; qr_token?: string }, source: string) => {
      if (!payload.event_id) {
        setStatus({ type: "error", message: "Select an event before scanning." });
        return;
      }

      setBusy(true);
      setStatus({ type: "info", message: `Processing ${source}...` });

      try {
        const data = await invokeEdge<{ new_balance?: number }>("grant-event-points", payload);
        setStatus({
          type: "success",
          message: `Points granted. New balance: ${data?.new_balance ?? "updated"}.`,
        });
      } catch (invokeError) {
        const message =
          invokeError instanceof Error ? invokeError.message : "Unable to grant points.";
        setStatus({ type: "error", message });
      }

      setBusy(false);
    },
    []
  );

  const handleScan = useCallback(
    async (value: string) => {
      if (!value) return;
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.value === value && now - last.at < 3000) {
        return;
      }
      lastScanRef.current = { value, at: now };

      if (!selectedEvent) {
        setStatus({ type: "error", message: "Select an event before scanning." });
        return;
      }

      const payload = value.startsWith("user:")
        ? { event_id: selectedEvent, qr_token: value }
        : uuidRegex.test(value)
        ? { event_id: selectedEvent, user_id: value }
        : { event_id: selectedEvent, qr_token: value };

      await invokeGrant(payload, "scan");
    },
    [invokeGrant, selectedEvent]
  );

  const handleManual = async () => {
    const raw = manualValue.trim();
    if (!raw) return;

    const payload = raw.startsWith("user:")
      ? { event_id: selectedEvent, qr_token: raw }
      : uuidRegex.test(raw)
      ? { event_id: selectedEvent, user_id: raw }
      : { event_id: selectedEvent, qr_token: raw };

    await invokeGrant(payload, "manual entry");
    setManualValue("");
  };

  const statusMessage = status?.message ?? "Ready to scan.";

  return (
    <div>
      {!scanOnly ? (
        <>
          <div className="page-header">
            <div>
              <h1>Event Scan</h1>
              <p className="card-muted">Scan employee QR codes to grant points.</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn-outline"
                onClick={enterFullscreen}
                disabled={!selectedEvent}
              >
                Fullscreen Scan
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Select Event</div>
            {loading ? (
              <div className="card-muted">Loading events...</div>
            ) : events.length === 0 ? (
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

          <QrScanner onResult={handleScan} active={!busy} />

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Manual Entry</div>
            <div className="card-muted" style={{ marginBottom: 10 }}>
              Paste QR text or user UUID if the camera fails.
            </div>
            <div className="form">
              <input
                className="input"
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="user:uuid or uuid"
              />
              <button className="btn btn-primary" onClick={handleManual} disabled={busy}>
                Grant Points
              </button>
            </div>
          </div>

          {status ? (
            <div
              className="card"
              style={{
                marginTop: 16,
                borderColor:
                  status.type === "error"
                    ? "rgba(220, 53, 69, 0.4)"
                    : status.type === "success"
                    ? "rgba(40, 167, 69, 0.4)"
                    : "rgba(0, 61, 166, 0.3)",
              }}
            >
              <div className="card-title">Status</div>
              <div className="card-muted">{status.message}</div>
            </div>
          ) : null}
        </>
      ) : null}

      {scanOnly ? (
        <div className="scan-overlay">
          <div className="scan-header">
            <div>
              <div className="scan-title">Live Event Check-In</div>
              <div className="scan-meta">
                {selectedMeta
                  ? `${selectedMeta.title} · ${formatDateTime(selectedMeta.event_date)} · +${selectedMeta.points} pts`
                  : "Select an event to begin"}
              </div>
            </div>
            <div className="scan-actions">
              <button className="btn btn-outline" onClick={exitFullscreen}>
                Exit
              </button>
            </div>
          </div>

          <div className="scan-body">
            <QrScanner
              onResult={handleScan}
              active={!busy}
              height="min(70vh, 520px)"
              showTitle={false}
              showHint={false}
              className="scan-qr-card"
            />
          </div>

          <div className="scan-footer">
            <div className="scan-meta">{busy ? "Processing scan..." : statusMessage}</div>
            <div className="scan-meta">Camera mode</div>
          </div>

          {status ? (
            <div className="scan-status">{status.message}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
