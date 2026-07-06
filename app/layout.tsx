import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
import { Toaster } from "sonner";
import AppChrome from "@/components/layout/AppChrome";

export const metadata: Metadata = {
  title: "Montview — Precision Clips. Premium Results.",
  description: "Montview — AI-powered clipping + agency admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} min-h-screen`} style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}>
        <AppChrome>{children}</AppChrome>
        <Toaster position="top-right" theme="light" richColors />
      </body>
    </html>
  );
}
