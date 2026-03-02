"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Gift,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Receipt,
  Upload,
  Users,
} from "lucide-react";

const links = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/roster", label: "Roster Upload", icon: Upload },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/rewards", label: "Rewards", icon: Gift },
  { href: "/admin/redemptions", label: "Redemptions", icon: Receipt },
  { href: "/admin/chat", label: "Chat", icon: MessageCircle },
];

export default function AdminSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={`admin-nav${collapsed ? " compact" : ""}`}>
      {links.map((link) => {
        const isActive = pathname === link.href;
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={isActive ? "active" : ""}
            title={collapsed ? link.label : undefined}
            aria-label={link.label}
          >
            <Icon size={17} strokeWidth={2.1} />
            <span className="label">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
