"use client";

import Link from "next/link";
import Logo from "@/components/brand/Logo";
import BottomNav from "@/components/nav/BottomNav";
import RequireAuth from "@/components/auth/RequireAuth";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { MessageCircle } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { role } = useCurrentUser();
  const isAdmin = role === "admin";

  return (
    <RequireAuth>
      <div className="page">
        <header className="topbar">
          <Logo href="/dashboard" />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isAdmin ? (
              <Link href="/admin/dashboard" className="badge">
                Admin
              </Link>
            ) : null}
          </div>
        </header>
        <main className="page-content">{children}</main>
        <Link href="/chat" className="floating-chat" aria-label="Open chat">
          <MessageCircle size={22} strokeWidth={2.2} />
        </Link>
        <BottomNav />
      </div>
    </RequireAuth>
  );
}
