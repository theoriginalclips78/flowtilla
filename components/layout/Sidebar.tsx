"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bot, Film, Send, TrendingUp, HardDrive, Wrench, BookOpen, Building2, Settings } from "lucide-react";
import MontviewLogo from "@/components/MontviewLogo";
import ThemeToggle from "@/components/ThemeToggle";

const GROUPS = [
  { title: "", items: [{ href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }] },
  { title: "Create", items: [
    { href: "/agent", icon: Bot,  label: "Agent" },
    { href: "/clips", icon: Film, label: "Clips" },
    { href: "/post",  icon: Send, label: "Post Queue" },
  ] },
  { title: "Grow", items: [
    { href: "/social", icon: TrendingUp, label: "Social Tracker" },
    { href: "/assets", icon: HardDrive,  label: "Assets" },
  ] },
  { title: "More", items: [
    { href: "/tools",  icon: Wrench,    label: "Tools" },
    { href: "/guide",  icon: BookOpen,  label: "Guide" },
    { href: "/agency", icon: Building2, label: "Agency Admin" },
  ] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/") || (href === "/dashboard" && pathname === "/");

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[240px] flex flex-col z-50"
      style={{ background: "var(--sidebar)", borderRight: "1px solid var(--border)" }}
    >
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 h-16 shrink-0">
        <MontviewLogo size={26} />
        <div className="leading-none">
          <div className="text-[16px] font-extrabold tracking-tight text-[var(--text)]">Montview</div>
          <div className="text-[10px] text-[var(--text-light)] mt-1">Precision Clips</div>
        </div>
      </Link>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
        {GROUPS.map((g, gi) => (
          <div key={gi}>
            {g.title && (
              <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-light)]">{g.title}</div>
            )}
            <div className="space-y-0.5">
              {g.items.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href} href={href}
                    className="flex items-center gap-3 h-9 px-3 rounded-[10px] text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
                    style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--text-muted)" }}
                  >
                    <Icon size={17} className="shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 space-y-0.5" style={{ borderTop: "1px solid var(--border)" }}>
        <ThemeToggle variant="row" />
        <Link
          href="/settings"
          className="flex items-center gap-3 h-9 px-3 rounded-[10px] text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
          style={pathname.startsWith("/settings") ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--text-muted)" }}
        >
          <Settings size={17} /> <span>Settings</span>
        </Link>
        <div className="flex items-center gap-2.5 px-3 pt-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "var(--accent)" }}>A</div>
          <span className="text-xs text-[var(--text-muted)] truncate">Your workspace</span>
        </div>
      </div>
    </aside>
  );
}
