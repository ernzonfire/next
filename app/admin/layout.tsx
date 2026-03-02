"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Logo from "@/components/brand/Logo";
import AdminSidebar from "@/components/nav/AdminSidebar";
import RequireAuth from "@/components/auth/RequireAuth";
import LogoutButton from "@/components/auth/LogoutButton";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const saved = window.localStorage.getItem("admin-sidebar-collapsed");
    setCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("admin-sidebar-collapsed", collapsed ? "true" : "false");
  }, [collapsed]);

  const handleMenuToggle = () => {
    if (window.matchMedia("(max-width: 899px)").matches) {
      setOpen(true);
      return;
    }

    setCollapsed((prev) => !prev);
  };

  return (
    <RequireAuth requireAdmin>
      <div
        className={`admin-layout${open ? " admin-open" : ""}${collapsed ? " admin-collapsed" : ""}`}
      >
        <header className="admin-topbar">
          <button
            className="btn btn-outline admin-menu icon-button"
            onClick={handleMenuToggle}
            aria-label="Toggle admin menu"
          >
            <Menu size={18} strokeWidth={2.2} />
          </button>
          <Logo href="/admin/dashboard" />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/dashboard" className="btn btn-outline" aria-label="Switch to user mode">
              User Mode
            </Link>
            <LogoutButton variant="outline" />
          </div>
        </header>

        <div
          className={`admin-overlay${open ? " show" : ""}`}
          onClick={() => setOpen(false)}
          aria-hidden={!open}
        />

        <aside className={`admin-sidebar${open ? " open" : ""}`}>
          <div className="admin-sidebar-header">
            <Logo href="/admin/dashboard" />
            <button
              className="btn btn-outline admin-close icon-button"
              onClick={() => setOpen(false)}
              aria-label="Close admin menu"
            >
              <X size={18} strokeWidth={2.2} />
            </button>
          </div>
          <h3 style={{ marginTop: 24 }}>{collapsed ? "Admin" : "Admin Console"}</h3>
          <AdminSidebar collapsed={collapsed} />
        </aside>
        <main className="admin-content">{children}</main>
      </div>
    </RequireAuth>
  );
}
