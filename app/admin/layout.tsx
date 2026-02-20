"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Logo from "@/components/brand/Logo";
import AdminSidebar from "@/components/nav/AdminSidebar";
import RequireAuth from "@/components/auth/RequireAuth";
import LogoutButton from "@/components/auth/LogoutButton";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <RequireAuth requireAdmin>
      <div className={`admin-layout${open ? " admin-open" : ""}`}>
        <header className="admin-topbar">
          <button
            className="btn btn-outline admin-menu icon-button"
            onClick={() => setOpen(true)}
            aria-label="Open admin menu"
          >
            <Menu size={18} strokeWidth={2.2} />
          </button>
          <Logo href="/admin/dashboard" />
          <LogoutButton variant="outline" />
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
          <h3 style={{ marginTop: 24 }}>Admin Console</h3>
          <AdminSidebar />
        </aside>
        <main className="admin-content">{children}</main>
      </div>
    </RequireAuth>
  );
}
