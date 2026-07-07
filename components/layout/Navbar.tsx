"use client";

import { usePathname, useRouter } from "next/navigation";
import { Zap, Bell } from "lucide-react";

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  "/dashboard": { title: "Dashboard",        sub: "Overview & quick actions" },
  "/agent":     { title: "Agent Workspace",  sub: "Run campaigns & review clips" },
  "/clips":     { title: "Clips",            sub: "Review and approve your generated clips" },
  "/projects":  { title: "Projects",         sub: "Manage your content projects" },
  "/assets":    { title: "Assets",           sub: "Your media library" },
  "/tools":     { title: "Tools",            sub: "AI utilities" },
  "/settings":  { title: "Settings",         sub: "Preferences & integrations" },
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const key = Object.keys(PAGE_TITLES).find((k) => pathname.startsWith(k)) || "/dashboard";
  const { title, sub } = PAGE_TITLES[key];

  return (
    <header
      className="h-[64px] flex items-center justify-between px-6 flex-shrink-0"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(15,30,60,0.06)",
      }}
    >
      <div>
        <h1 className="font-bold text-base leading-tight tracking-tight" style={{ color: "var(--chip)" }}>{title}</h1>
        <p className="text-[11px] mt-0.5 font-medium" style={{ color: "var(--text-muted)" }}>{sub}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-[var(--surface-2)]"
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
