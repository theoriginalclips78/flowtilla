"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  wide?: boolean;
  /** Render children without the default panel wrapper (for custom multi-column layouts). */
  bare?: boolean;
  children: React.ReactNode;
}

export default function ToolPageLayout({ title, subtitle, wide, bare, children }: Props) {
  const router = useRouter();
  return (
    <div className={`${wide ? "max-w-5xl" : "max-w-2xl"} animate-fade-up delay-1`}>
      <button
        onClick={() => router.push("/tools")}
        className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] mb-5 font-medium transition-colors duration-200"
      >
        <ArrowLeft size={15} /> Tools
      </button>
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-[var(--text)]">{title}</h1>
      {subtitle && <p className="text-[15px] text-[var(--text-muted)] mt-1.5 mb-7">{subtitle}</p>}
      {!subtitle && <div className="mb-7" />}
      {bare ? children : (
        <div className="panel-raised p-7">{children}</div>
      )}
    </div>
  );
}
