"use client";

import { useState } from "react";
import { Camera, CheckCircle2, XCircle } from "lucide-react";

type ScannerOverlayProps = {
  open: boolean;
  onClose: () => void;
  onResult: (message: string, tone?: "success" | "error" | "info") => void;
};

export default function ScannerOverlay({ open, onClose, onResult }: ScannerOverlayProps) {
  const [status, setStatus] = useState("Align event QR within the frame.");
  const [isScanning, setIsScanning] = useState(false);

  if (!open) {
    return null;
  }

  const simulateSuccess = () => {
    setIsScanning(true);
    setStatus("Scanning in progress...");

    window.setTimeout(() => {
      setIsScanning(false);
      setStatus("Attendance recorded. Points credited.");
      onResult("You earned event points.", "success");
    }, 900);
  };

  const simulateMiss = () => {
    setStatus("Code not recognized. Try manual event code.");
    onResult("Unable to recognize QR. Try again.", "error");
  };

  return (
    <section className="scan-overlay" aria-modal="true" role="dialog" aria-label="QR scanner">
      <header className="scan-header">
        <div>
          <div className="scan-title">Scan Event QR</div>
          <div className="scan-meta">No camera access required in this demo mode.</div>
        </div>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="scan-body">
        <div className="scan-camera-frame">
          <div
            style={{
              minHeight: "min(64vh, 460px)",
              display: "grid",
              placeItems: "center",
              padding: 18,
              textAlign: "center",
              background:
                "linear-gradient(160deg, rgba(0,46,109,0.15), rgba(98,187,70,0.18))",
            }}
          >
            <div>
              <Camera size={42} />
              <div style={{ marginTop: 10, fontWeight: 600 }}>Camera Placeholder</div>
              <div style={{ color: "rgba(242,245,251,0.8)", fontSize: 13 }}>
                Venue QR appears here during actual scan.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="scan-status">{status}</div>

      <footer className="scan-footer">
        <button type="button" className="btn btn-outline" onClick={simulateMiss}>
          <XCircle size={18} />
          Simulate Miss
        </button>
        <button type="button" className="btn btn-primary" disabled={isScanning} onClick={simulateSuccess}>
          <CheckCircle2 size={18} />
          {isScanning ? "Scanning..." : "Simulate Success"}
        </button>
      </footer>
    </section>
  );
}
