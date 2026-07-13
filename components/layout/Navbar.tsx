"use client";

import { usePathname, useRouter } from "next/navigation";
import { Zap, Bell } from "lucide-react";

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  "/dashboard": { title: "Dashboard",        sub: "Overview & quick actions" },
  "/agent":     { title: "Agent Workspace",  sub: "Run campaigns & review clips" },
  "/clips":     { title: "Clips",            sub: "Review and approve your generated clips" },
  "/post":      { title: "Post Queue",       sub: "Ready to post — captions pre-filled" },
  "/social":    { title: "Social Tracker",   sub: "Log posts & see what wins" },
  "/assets":    { title: "Assets",           sub: "Your media library" },
  "/tools":     { title: "Tools",            sub: "AI utilities" },
  "/guide":     { title: "Guide",            sub: "How to get the most out of Montview" },
  "/settings":  { title: "Settings",         sub: "Preferences & integrations" },
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const key = Object.keys(PAGE_TITLES).find((k) => pathname.startsWith(k)) || "/dashboard";
  const { title, sub } = PAGE_TITLES[key];

  return (
    <header
      className="h-[56px] flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-40"
      style={{
        background: "color-mix(in srgb, var(--bg) 82%, transparent)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "saturate(180%) blur(12px)",
      }}
    >
      <div>
        <h1 className="font-semibold text-[15px] leading-tight tracking-tight" style={{ color: "var(--text)" }}>{title}</h1>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-[var(--surface-2)]"
          style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
          title="Notifications"
        >
          <Bell size={15} />
        </button>

        <button
          onClick={() => router.push("/agent")}
          className="btn-primary flex items-center gap-2 py-2 px-4"
        >
          <Zap size={13} fill="white" />
          <span>Run Agent</span>
        </button>
      </div>
    </header>
  );
}
