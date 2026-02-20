"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/roster", label: "Roster Upload" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/redemptions", label: "Redemptions" },
  { href: "/admin/chat", label: "Chat" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={isActive ? "active" : ""}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
