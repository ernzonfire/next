"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, Home, ScanLine, User, Megaphone } from "lucide-react";

type BottomTabsProps = {
  onScanClick: () => void;
  scanActive?: boolean;
};

const navItems = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/updates", label: "Updates", Icon: Megaphone },
  { href: "/shop", label: "Shop", Icon: Gift },
  { href: "/profile", label: "Profile", Icon: User },
];

export default function BottomTabs({ onScanClick, scanActive = false }: BottomTabsProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {navItems.map((item) => {
        const Icon = item.Icon;
        return (
          <Link key={item.href} href={item.href} className={isActive(item.href) ? "active" : ""}>
            <Icon size={18} strokeWidth={2} />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        className={`bottom-nav-scan${scanActive ? " active" : ""}`}
        aria-label="Open scanner"
        onClick={onScanClick}
      >
        <ScanLine size={24} strokeWidth={2.3} />
      </button>
    </nav>
  );
}
