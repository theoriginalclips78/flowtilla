"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bot, Folder, Film, Settings } from "lucide-react";

const tabs = [
  { icon: Home, label: "Home", href: "/dashboard" },
  { icon: Bot, label: "Agent", href: "/agent" },
  { icon: Folder, label: "Projects", href: "/projects" },
  { icon: Film, label: "Assets", href: "/assets" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 liquid-glass border-t border-white/10 flex md:hidden z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
      {tabs.map(({ icon: Icon, label, href }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
              isActive ? "text-white" : "text-white/40"
            }`}
          >
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
