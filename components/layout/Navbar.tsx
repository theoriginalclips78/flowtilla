"use client";

import { usePathname, useRouter } from "next/navigation";
import { Play } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/agent":     "Agent Workspace",
  "/projects":  "Projects",
  "/assets":    "Assets",
  "/tools":     "Tools",
  "/settings":  "Settings",
  "/editor":    "Clip Editor",
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const key = Object.keys(PAGE_TITLES).find((k) => pathname.startsWith(k)) || "/dashboard";
  const title = PAGE_TITLES[key];

  return (
    <header
      className="h-[60px] flex items-center justify-between px-6 flex-shrink-0 liquid-glass border-b border-white/10"
      style={{ background: "rgba(0,0,0,0.25)" }}
    >
      <h1 className="text-white font-medium text-lg tracking-tight">{title}</h1>

      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/agent")}
          className="btn-secondary flex items-center gap-1.5 py-2 px-4 text-sm"
        >
          <Play size={13} fill="white" /> Run Agent
        </button>
        <div
          className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center cursor-pointer"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <span className="text-white text-sm font-semibold">A</span>
        </div>
      </div>
    </header>
  );
}
