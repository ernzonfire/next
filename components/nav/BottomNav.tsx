"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Megaphone,
  Gift,
  User,
  ScanLine,
} from "lucide-react";

const items = [
  { href: "/dashboard", label: "Home", Icon: Home },
  { href: "/announcements", label: "News", Icon: Megaphone },
  { href: "/shop", label: "Shop", Icon: Gift },
  { href: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const scanActive = pathname === "/events/scan";

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.Icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? "active" : ""}
          >
            <Icon size={18} strokeWidth={2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <Link
        href="/events/scan"
        className={`bottom-nav-scan${scanActive ? " active" : ""}`}
        aria-label="Scan event QR"
      >
        <ScanLine size={24} strokeWidth={2.3} />
      </Link>
    </nav>
  );
}
