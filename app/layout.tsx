import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
import { Toaster } from "sonner";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import BottomTabBar from "@/components/layout/BottomTabBar";

export const metadata: Metadata = {
  title: "FlowTilla — AI Video Clipping",
  description: "AI-powered video clipping agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-studio min-h-screen`} style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-col flex-1 ml-[72px]">
            <Navbar />
            <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
              {children}
            </main>
          </div>
        </div>
        <BottomTabBar />
        <Toaster position="top-right" theme="light" richColors />
      </body>
    </html>
  );
}
