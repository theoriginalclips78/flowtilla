import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import BottomTabBar from "@/components/layout/BottomTabBar";
import VideoBg from "@/components/layout/VideoBg";

export const metadata: Metadata = {
  title: "ClipFlow — AI Video Clipping",
  description: "AI-powered video clipping agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="relative min-h-screen w-full overflow-hidden">
          <VideoBg />
          <div className="absolute inset-0 z-[1]" style={{ background: "rgba(0,0,0,0.55)" }} />
          <div className="relative z-[2] flex min-h-screen">
            <Sidebar />
            <div className="flex flex-col flex-1 ml-[72px]">
              <Navbar />
              <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
                {children}
              </main>
            </div>
          </div>
        </div>
        <BottomTabBar />
        <Toaster position="top-right" theme="dark" richColors />
      </body>
    </html>
  );
}
