"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, Gift, Home, ScanLine, Shield, User, X } from "lucide-react";

type DesktopNavDrawerProps = {
  open: boolean;
  onClose: () => void;
  onOpenScanner: () => void;
  isAdmin: boolean;
};

const navItems = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/updates", label: "Updates", Icon: Megaphone },
  { href: "/shop", label: "Shop", Icon: Gift },
  { href: "/profile", label: "Profile", Icon: User },
];

export default function DesktopNavDrawer({
  open,
  onClose,
  onOpenScanner,
  isAdmin,
}: DesktopNavDrawerProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  return (
    <>
      <div
        className={`desktop-drawer-overlay${open ? " show" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside className={`desktop-drawer${open ? " open" : ""}`} aria-label="Desktop navigation">
        <div className="desktop-drawer-header">
          <strong>Menu</strong>
          <button
            type="button"
            className="btn btn-outline icon-button"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <nav className="desktop-drawer-nav">
          {navItems.map((item) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(item.href) ? "active" : ""}
                onClick={onClose}
              >
                <Icon size={18} strokeWidth={2.1} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="desktop-drawer-actions">
          <button type="button" className="btn btn-primary" onClick={onOpenScanner}>
            <ScanLine size={18} />
            Open Scanner
          </button>

          {isAdmin ? (
            <Link href="/admin/dashboard" className="btn btn-outline" onClick={onClose}>
              <Shield size={18} />
              Admin Mode
            </Link>
          ) : null}
        </div>
      </aside>
    </>
  );
}
