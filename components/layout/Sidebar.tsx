"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bot, Film, HardDrive, Wrench, Settings, Zap, BookOpen } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/agent",     icon: Bot,             label: "Agent" },
  { href: "/clips",     icon: Film,            label: "Clips" },
  { href: "/assets",    icon: HardDrive,       label: "Assets" },
  { href: "/tools",     icon: Wrench,          label: "Tools" },
  { href: "/guide",     icon: BookOpen,        label: "Guide" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[72px] flex flex-col items-center py-5 z-50"
      style={{
        background: "#0F1E3C",
        borderRight: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Logo */}
      <Link
        href="/dashboard"
        className="mb-8 w-10 h-10 rounded-2xl flex items-center justify-center"
        style={{
          background: "#9B1C1C",
          boxShadow: "0 4px 14px rgba(155,28,28,0.45)",
        }}
      >
        <Zap size={17} className="text-white" fill="white" />
      </Link>

      {/* Nav */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className="relative w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200"
              style={{
                background: active ? "rgba(155,28,28,0.25)" : "transparent",
                color: active ? "#FCA5A5" : "rgba(255,255,255,0.38)",
              }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ background: "#B91C1C", boxShadow: "0 0 8px rgba(185,28,28,0.7)" }}
                />
              )}
              <Icon size={20} />
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/settings"
          title="Settings"
          className="w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200"
          style={{
            background: pathname.startsWith("/settings") ? "rgba(155,28,28,0.25)" : "transparent",
            color: pathname.startsWith("/settings") ? "#FCA5A5" : "rgba(255,255,255,0.38)",
          }}
        >
          <Settings size={20} />
        </Link>

        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: "#9B1C1C", boxShadow: "0 2px 8px rgba(155,28,28,0.4)" }}
        >
          A
        </div>
      </div>
    </aside>
  );
}
