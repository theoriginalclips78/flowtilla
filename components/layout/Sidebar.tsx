"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bot, FolderKanban, HardDrive, Wrench, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/agent",     icon: Bot,             label: "Agent" },
  { href: "/projects",  icon: FolderKanban,    label: "Projects" },
  { href: "/assets",    icon: HardDrive,       label: "Assets" },
  { href: "/tools",     icon: Wrench,          label: "Tools" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[72px] flex flex-col items-center py-4 z-50 liquid-glass"
      style={{ background: "rgba(0,0,0,0.35)" }}
    >
      {/* Logo */}
      <Link
        href="/dashboard"
        className="mb-8 w-10 h-10 rounded-xl flex items-center justify-center liquid-glass"
        style={{ background: "rgba(192,57,43,0.7)" }}
      >
        <span className="text-white font-black text-[15px] tracking-tight">CF</span>
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
              className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${
                active
                  ? "liquid-glass text-white"
                  : "text-white/50 hover:text-white hover:bg-white/10"
              }`}
              style={active ? { background: "rgba(255,255,255,0.15)" } : {}}
            >
              <Icon size={20} />
            </Link>
          );
        })}
      </nav>

      {/* Settings + avatar */}
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/settings"
          title="Settings"
          className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${
            pathname.startsWith("/settings")
              ? "liquid-glass text-white"
              : "text-white/50 hover:text-white hover:bg-white/10"
          }`}
          style={pathname.startsWith("/settings") ? { background: "rgba(255,255,255,0.15)" } : {}}
        >
          <Settings size={20} />
        </Link>
        <div
          className="w-9 h-9 rounded-full liquid-glass flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <span className="text-white text-xs font-semibold">A</span>
        </div>
      </div>
    </aside>
  );
}
