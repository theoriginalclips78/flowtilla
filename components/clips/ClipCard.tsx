"use client";

import { useRouter } from "next/navigation";
import { ClipResult } from "@/store/agentStore";

interface Props {
  clip: ClipResult;
  onReview?: () => void;
}

const viralityConfig = {
  high: { label: "🔥 High", className: "bg-[var(--accent)]/10 text-[var(--accent)]" },
  medium: { label: "⚡ Medium", className: "bg-amber-500/10 text-amber-600" },
  low: { label: "💤 Low", className: "bg-gray-100 text-[var(--text-muted)]" },
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function ClipCard({ clip }: Props) {
  const router = useRouter();
  const viral = viralityConfig[clip.viralityScore as keyof typeof viralityConfig] || viralityConfig.low;

  return (
    <div className="w-[280px] flex-shrink-0 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
      {/* Video player */}
      <div className="relative bg-gray-100 aspect-video">
        <video
          src={clip.downloadUrl}
          className="w-full h-full object-cover"
          preload="metadata"
        />
        <span className={`absolute top-2 right-2 text-[11px] font-medium px-2 py-0.5 rounded-full ${viral.className}`}>
          {viral.label}
        </span>
      </div>

      <div className="p-3">
        <h4 className="font-bold text-[14px] text-[var(--text)] truncate mb-1">{clip.title}</h4>
        <p className="text-[12px] text-[var(--text-muted)] mb-1">
          {formatTime(clip.startTime)} – {formatTime(clip.endTime)}
        </p>
        <p className="text-[12px] text-[var(--text-muted)] line-clamp-2 mb-3">{clip.reason}</p>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/editor/${clip.id}`)}
            className="flex-1 bg-[var(--accent)] text-white text-[13px] font-medium py-1.5 rounded-lg hover:bg-[var(--accent)]/90 transition-colors"
          >
            Review & Edit
          </button>
          <button className="flex-1 border border-[var(--border)] text-[var(--text-muted)] text-[13px] py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
