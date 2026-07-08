"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import BottomTabBar from "@/components/layout/BottomTabBar";

// The agency dashboard (/agency/*) provides its own full-screen dark shell, so we skip the
// clipping app's cream chrome there. Everything else keeps the normal Montview clipping UI.
export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/agency")) return <>{children}</>;

  return (
    <div className="bg-studio min-h-screen flex">
      <Sidebar />
      <div className="flex flex-col flex-1 ml-[240px]">
        <Navbar />
        <main className="flex-1 overflow-y-auto px-8 py-6 pb-20 md:pb-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
      <BottomTabBar />
    </div>
  );
}
