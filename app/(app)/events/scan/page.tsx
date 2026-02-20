"use client";

import { useCallback, useRef, useState } from "react";
import QrScanner from "@/components/qr/QrScanner";
import { invokeEdge } from "@/lib/supabase/edge";

type StatusState = {
  type: "success" | "error" | "info";
  message: string;
};

type ToastState = {
  message: string;
  type: "success" | "error" | "info";
};

export default function EventCheckInPage() {
  const [status, setStatus] = useState<StatusState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);

  const showToast = useCallback((message: string, type: ToastState["type"]) => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const grantPoints = useCallback(async (qrValue: string, source: string) => {
    setBusy(true);
    setStatus({ type: "info", message: `Processing ${source}...` });

    try {
      const payload = await invokeEdge<{ new_balance?: number; points_awarded?: number }>(
        "grant-event-points",
        { qr_token: qrValue }
      );

      setStatus({
        type: "success",
        message: `Check-in complete. New balance: ${payload?.new_balance ?? "updated"}.`,
      });
      if (payload?.points_awarded) {
        showToast(`You earned ${payload.points_awarded} points`, "success");
      } else {
        showToast("Check-in complete.", "success");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to check in.";
      setStatus({ type: "error", message });
      showToast(message, "error");
    }

    setBusy(false);
  }, [showToast]);

  const handleScan = useCallback(
    async (value: string) => {
      if (!value) return;
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.value === value && now - last.at < 3000) {
        return;
      }
      lastScanRef.current = { value, at: now };

      const token = value.startsWith("event:") ? value : `event:${value}`;
      await grantPoints(token, "scan");
    },
    [grantPoints]
  );

  const handleManual = async () => {
    const raw = manualValue.trim();
    if (!raw) return;
    const token = raw.startsWith("event:") ? raw : `event:${raw}`;
    await grantPoints(token, "manual entry");
    setManualValue("");
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Event Check-In</h1>
          <p className="card-muted">Scan the event QR code to get your points.</p>
        </div>
      </div>

      <QrScanner onResult={handleScan} active={!busy} />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Manual Entry</div>
        <div className="card-muted" style={{ marginBottom: 10 }}>
          Enter the event code if the camera fails.
        </div>
        <div className="form">
          <input
            className="input"
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            placeholder="Event code"
          />
          <button className="btn btn-primary" onClick={handleManual} disabled={busy}>
            Submit
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

      {toast ? (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
