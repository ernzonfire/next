"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, X } from "lucide-react";
import QrScanner from "@/components/qr/QrScanner";
import { invokeEdge } from "@/lib/supabase/edge";

type ScannerOverlayProps = {
  open: boolean;
  onClose: () => void;
  onResult: (message: string, tone?: "success" | "error" | "info") => void;
};

export default function ScannerOverlay({ open, onClose, onResult }: ScannerOverlayProps) {
  const [status, setStatus] = useState("Align event QR within the frame.");
  const [busy, setBusy] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setStatus("Requesting camera access...");
    setBusy(false);
    setManualCode("");
    setCameraError(null);
    lastScanRef.current = null;
  }, [open]);

  const submitToken = useCallback(
    async (rawValue: string, source: "scan" | "manual") => {
      const input = rawValue.trim();
      if (!input) {
        return;
      }

      const token = input.startsWith("event:") ? input : `event:${input}`;
      setBusy(true);
      setStatus(source === "scan" ? "Processing scan..." : "Submitting code...");

      try {
        const payload = await invokeEdge<{ points_awarded?: number; new_balance?: number }>(
          "grant-event-points",
          { qr_token: token }
        );
        const points = Number(payload?.points_awarded ?? 0);
        const successMessage =
          points > 0 ? `You earned ${points} points.` : "Attendance recorded.";
        setCameraError(null);
        setStatus(successMessage);
        onResult(successMessage, "success");
        window.setTimeout(() => onClose(), 700);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to process this event code.";
        setStatus(message);
        onResult(message, "error");
      } finally {
        setBusy(false);
      }
    },
    [onClose, onResult]
  );

  const handleScan = useCallback(
    async (value: string) => {
      if (!value || busy) {
        return;
      }

      const now = Date.now();
      const previous = lastScanRef.current;
      if (previous && previous.value === value && now - previous.at < 2500) {
        return;
      }
      lastScanRef.current = { value, at: now };
      await submitToken(value, "scan");
    },
    [busy, submitToken]
  );

  const handleManualSubmit = async () => {
    await submitToken(manualCode, "manual");
    setManualCode("");
  };

  const handleScannerReady = useCallback(() => {
    if (busy) {
      return;
    }
    setCameraError(null);
    setStatus("Camera ready. Align QR in frame.");
  }, [busy]);

  const handleScannerError = useCallback((message: string) => {
    const normalized = message.toLowerCase();
    let userMessage = message;

    if (normalized.includes("notallowed") || normalized.includes("permission")) {
      userMessage = "Camera permission denied. Enable camera access or use manual code.";
    } else if (
      normalized.includes("notfound") ||
      normalized.includes("no camera") ||
      normalized.includes("requested device not found")
    ) {
      userMessage = "No camera found on this device. Use manual code.";
    } else if (normalized.includes("https") || normalized.includes("secure")) {
      userMessage = "Camera requires HTTPS (or localhost for local testing). Use manual code.";
    } else {
      userMessage = `Camera error: ${message}`;
    }

    setCameraError(userMessage);
    if (!busy) {
      setStatus(userMessage);
    }
  }, [busy]);

  if (!open) {
    return null;
  }

  return (
    <section className="scan-overlay" aria-modal="true" role="dialog" aria-label="QR scanner">
      <header className="scan-header">
        <div>
          <div className="scan-title">Scan Event QR</div>
          <div className="scan-meta">Use camera or enter event code manually.</div>
        </div>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          <X size={16} />
          Close
        </button>
      </header>

      <div className="scan-body">
        <div className="scan-camera-frame">
          <QrScanner
            onResult={handleScan}
            onReady={handleScannerReady}
            onError={handleScannerError}
            active={open && !busy}
            showTitle={false}
            showHint
            className="scan-qr-card"
            height="min(70vh, 720px)"
          />
        </div>
      </div>

      <div className="scan-status">
        {status}
        {cameraError ? <div className="scan-meta" style={{ marginTop: 6 }}>{cameraError}</div> : null}
      </div>

      <footer className="scan-footer">
        <input
          className="input"
          value={manualCode}
          onChange={(event) => setManualCode(event.target.value)}
          placeholder="Event code (e.g. REIGNITES2)"
          style={{ flex: 1, minWidth: 180 }}
          disabled={busy}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleManualSubmit}
          disabled={busy || !manualCode.trim()}
        >
          <Keyboard size={18} />
          Redeem Code
        </button>
      </footer>
    </section>
  );
}
