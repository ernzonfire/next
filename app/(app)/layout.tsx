"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, MessageCircle, RefreshCcw } from "lucide-react";
import RequireAuth from "@/components/auth/RequireAuth";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import BottomTabs from "@/app/components/BottomTabs";
import ScannerOverlay from "@/app/components/ScannerOverlay";
import SupportPanel from "@/app/components/SupportPanel";
import AppToast from "@/app/components/AppToast";

type ToastState = {
  message: string;
  tone: "success" | "error" | "info";
};

type ToastEventDetail = {
  message: string;
  tone?: "success" | "error" | "info";
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { role } = useCurrentUser();
  const [scanOpen, setScanOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const isAdmin = role === "admin";

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent<ToastEventDetail>;
      const nextMessage = customEvent.detail?.message?.trim();
      if (!nextMessage) {
        return;
      }

      setToast({
        message: nextMessage,
        tone: customEvent.detail.tone ?? "info",
      });
    };

    window.addEventListener("next-toast", handleToast as EventListener);
    return () => {
      window.removeEventListener("next-toast", handleToast as EventListener);
    };
  }, []);

  const showToast = (message: string, tone: ToastState["tone"] = "info") => {
    setToast({ message, tone });
  };

  return (
    <RequireAuth>
      <div className="page">
        <header className="topbar" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr" }}>
          <div aria-hidden="true" />

          <Link href="/" className="logo" aria-label="NEXT home">
            <span>NEXT</span>
          </Link>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
            {isAdmin ? (
              <Link href="/admin/dashboard" className="btn btn-outline" aria-label="Switch to admin mode">
                Admin Mode
              </Link>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost icon-button"
              aria-label="Refresh current page"
              onClick={() => router.refresh()}
            >
              <RefreshCcw size={18} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className="btn btn-ghost icon-button"
              aria-label="Notifications"
              style={{ position: "relative" }}
            >
              <Bell size={18} strokeWidth={2.2} />
              <span
                aria-label="2 unread notifications"
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "var(--brand-green)",
                }}
              />
            </button>
          </div>
        </header>

        <main className="page-content">{children}</main>

        <button
          type="button"
          className="floating-chat"
          onClick={() => setChatOpen(true)}
          aria-label="Open support chat"
        >
          <MessageCircle size={22} strokeWidth={2.2} />
        </button>

        <BottomTabs onScanClick={() => setScanOpen(true)} scanActive={scanOpen} />

        <ScannerOverlay
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onResult={(message, tone) => showToast(message, tone)}
        />

        <SupportPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onSubmitSuccess={() => showToast("Thanks. Your message has been sent.", "success")}
        />

        {toast ? <AppToast message={toast.message} tone={toast.tone} /> : null}
      </div>
    </RequireAuth>
  );
}
