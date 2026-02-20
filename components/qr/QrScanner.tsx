"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function QrScanner({
  onResult,
  active = true,
  height = 320,
  showTitle = true,
  showHint = true,
  className = "",
}: {
  onResult: (value: string) => void;
  active?: boolean;
  height?: number | string;
  showTitle?: boolean;
  showHint?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return;

    const codeReader = new BrowserMultiFormatReader();
    let controls: { stop: () => void } | null = null;
    let stopped = false;

    const start = async () => {
      try {
        controls = await codeReader.decodeFromVideoDevice(
          undefined,
          videoRef.current ?? undefined,
          (result, err) => {
            if (result) {
              onResult(result.getText());
            }
            if (err) {
              const name = (err as { name?: string }).name ?? "";
              const message = err instanceof Error ? err.message : String(err);
              if (name !== "NotFoundException" && !message.includes("NotFoundException")) {
                setError(message || "Camera error");
              }
            }
          }
        );
        setReady(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to access camera";
        setError(message);
      }
    };

    start();

    return () => {
      stopped = true;
      if (controls) {
        controls.stop();
      }
      const maybeReader = codeReader as unknown as { reset?: () => void };
      if (typeof maybeReader.reset === "function") {
        maybeReader.reset();
      }
      if (stopped) {
        setReady(false);
      }
    };
  }, [active, onResult]);

  return (
    <div className={`card ${className}`} style={{ display: "grid", gap: 12 }}>
      {showTitle ? <div className="card-title">Camera Scanner</div> : null}
      <div
        style={{
          background: "#0b1427",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <video
          ref={videoRef}
          style={{ width: "100%", height, objectFit: "cover" }}
          autoPlay
          muted
          playsInline
        />
      </div>
      {showHint ? (
        <div className="card-muted">
          {error
            ? `Camera error: ${error}`
            : ready
            ? "Point the camera at the employee QR code."
            : "Starting camera..."}
        </div>
      ) : null}
    </div>
  );
}
