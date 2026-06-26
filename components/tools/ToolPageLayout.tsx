"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function ToolPageLayout({ title, children }: Props) {
  const router = useRouter();
  return (
    <div className="max-w-2xl animate-fade-up delay-1">
      <button
        onClick={() => router.push("/tools")}
        className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white mb-6 font-medium transition-colors"
      >
        <ArrowLeft size={15} /> Tools
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">{title}</h1>
      <div className="liquid-glass rounded-2xl p-6 border border-white/10" style={{ background: "rgba(255,255,255,0.07)" }}>
        {children}
      </div>
    </div>
  );
}
