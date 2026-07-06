"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, DollarSign, Users, Calendar, Target, Lightbulb,
  Image as ImageIcon, BarChart3, UsersRound, ClipboardList, Settings,
  PanelLeftClose, PanelLeft,
} from "lucide-react";
import MontviewLogo from "@/components/MontviewLogo";

const NAV = [
  { href: "/agency/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { href: "/agency/money",      icon: DollarSign,      label: "Money" },
  { href: "/agency/clients",    icon: Users,           label: "Clients" },
  { href: "/agency/calendar",   icon: Calendar,        label: "Calendar" },
  { href: "/agency/leads",      icon: Target,          label: "Leads" },
  { href: "/agency/ideation",   icon: Lightbulb,       label: "Ideation" },
  { href: "/agency/thumbnails", icon: ImageIcon,       label: "Thumbnails" },
  { href: "/agency/analytics",  icon: BarChart3,       label: "Analytics" },
  { href: "/agency/team",       icon: UsersRound,      label: "Team" },
  { href: "/agency/onboarding", icon: ClipboardList,   label: "Onboarding" },
  { href: "/agency/settings",   icon: Settings,        label: "Settings" },
];

export default function AgencyShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const W = open ? 260 : 72;

  return (
    <div className="min-h-screen" style={{ background: "#000000", color: "#f5f5f7" }}>
      {/* liquid-glass orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: 620, height: 620, borderRadius: "50%", background: "#0A84FF", opacity: 0.12, filter: "blur(120px)" }} />
        <div style={{ position: "absolute", bottom: "-15%", left: "10%", width: 560, height: 560, borderRadius: "50%", background: "#BF5AF2", opacity: 0.10, filter: "blur(120px)" }} />
        <div style={{ position: "absolute", top: "30%", left: "40%", width: 480, height: 480, borderRadius: "50%", background: "#64D2FF", opacity: 0.08, filter: "blur(130px)" }} />
      </div>

      {/* Sidebar */}
      <aside
        className="fixed left-0 top-0 h-screen flex flex-col z-50 transition-[width] duration-300"
        style={{ width: W, background: "#000000", borderRight: "0.5px solid rgba(255,255,255,0.09)" }}
      >
        <div className="flex items-center gap-3 px-4 h-16 shrink-0">
          <Link href="/agency/dashboard" className="flex items-center gap-3 min-w-0">
            <MontviewLogo size={26} />
            {open && (
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-tight text-[#f5f5f7] leading-none">Montview</div>
                <div className="text-[11px] text-[#86868b] mt-1 leading-none">Agency Admin</div>
              </div>
            )}
          </Link>
        </div>

        <nav className="flex-1 px-2.5 py-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href} href={href} title={label}
                className="flex items-center gap-3 rounded-[10px] px-2.5 h-9 transition-colors hover:bg-white/5"
                style={{ background: active ? "rgba(255,255,255,0.08)" : "transparent", color: active ? "#f5f5f7" : "#86868b" }}
              >
                <Icon size={18} className="shrink-0" />
                {open && <span className="text-[14px] font-medium truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-3 px-4 h-12 shrink-0 text-[#86868b] hover:text-[#f5f5f7] transition-colors"
          style={{ borderTop: "0.5px solid rgba(255,255,255,0.09)" }}
        >
          {open ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          {open && <span className="text-[13px]">Collapse</span>}
        </button>
      </aside>

      {/* Content */}
      <main className="relative transition-[margin] duration-300" style={{ marginLeft: W, zIndex: 1 }}>
        {/* thin top bar so window controls never overlap */}
        <div className="h-11 w-full" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }} />
        <div className="px-8 py-7 max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
