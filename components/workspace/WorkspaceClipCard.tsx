"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Download, Check, X, ChevronDown, ChevronUp, Copy } from "lucide-react";

export interface WorkspaceClip {
  id: string;
  title: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  startTime: number;
  endTime: number;
  viralityScore: string;
  reason: string;
  hook?: string;
  caption?: string;
  platformFit?: string;
  sourceTitle?: string;
  status: "pending" | "approved" | "discarded";
}

interface Props {
  clip: WorkspaceClip;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
  onPreview: (clip: WorkspaceClip) => void;
}

const viralBadge: Record<string, { label: string; bg: string }> = {
  high:   { label: "🔥 High",  bg: "rgba(192,57,43,0.8)" },
  medium: { label: "⚡ Med",   bg: "rgba(217,119,6,0.8)" },
  low:    { label: "💤 Low",   bg: "rgba(255,255,255,0.2)" },
};

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function WorkspaceClipCard({ clip, onApprove, onDiscard, onPreview }: Props) {
  const router = useRouter();
  const [captionOpen, setCaptionOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const badge = viralBadge[clip.viralityScore] || viralBadge.low;

  if (clip.status === "discarded") {
    return (
      <div className="liquid-glass rounded-xl px-3 py-2 flex items-center gap-2 opacity-40" style={{ background: "rgba(255,255,255,0.05)" }}>
        <span className="text-xs text-white/50 flex-1 truncate line-through">{clip.title}</span>
        <button onClick={() => onApprove(clip.id)} className="text-xs text-white/40 hover:text-green-400">undo</button>
      </div>
    );
  }

  const duration = Math.round(clip.endTime - clip.startTime);

  return (
    <div className={`liquid-glass rounded-xl overflow-hidden ${clip.status === "approved" ? "ring-1 ring-green-500/50" : ""}`} style={{ background: "rgba(255,255,255,0.07)" }}>
      {clip.status === "approved" && (
        <div className="px-3 py-1 flex items-center gap-1.5" style={{ background: "rgba(34,197,94,0.15)" }}>
          <Check size={11} className="text-green-400" />
          <span className="text-[11px] font-medium text-green-400">Approved</span>
        </div>
      )}

      {/* Thumbnail — click to open fullscreen preview */}
      <div className="relative bg-black/40 aspect-video cursor-pointer group" onClick={() => onPreview(clip)}>
        {clip.thumbnailUrl
          ? <img src={clip.thumbnailUrl} alt={clip.title} className="w-full h-full object-cover" />
          : <video src={clip.downloadUrl} className="w-full h-full object-cover" preload="metadata" />
        }
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(59,130,246,0.85)", boxShadow: "0 0 20px rgba(59,130,246,0.5)" }}>
            <div className="w-0 h-0 border-y-[7px] border-y-transparent border-l-[12px] border-l-white ml-1" />
          </div>
        </div>
        <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-lg liquid-glass text-white" style={{ background: badge.bg }}>
          {badge.label}
        </span>
      </div>

      {/* Info */}
      <div className="px-3 pt-2.5 pb-1">
        <p className="font-medium text-[13px] text-white truncate">{clip.title}</p>
        <p className="text-[11px] text-white/40 mt-0.5">{fmt(clip.startTime)} – {fmt(clip.endTime)} · {duration}s</p>
        {clip.reason && <p className="text-[11px] text-white/50 mt-1 line-clamp-2">{clip.reason}</p>}
      </div>

      {/* Caption */}
      {clip.caption && (
        <div className="px-3 pb-1">
          <button onClick={() => setCaptionOpen(v => !v)} className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 font-medium py-1">
            {captionOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />} Caption
          </button>
          {captionOpen && (
            <div className="relative rounded-lg p-2.5 mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
              <p className="text-[11px] text-white/70 leading-relaxed pr-6">{clip.caption}</p>
              <button onClick={() => { navigator.clipboard.writeText(clip.caption || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="absolute top-2 right-2 text-white/40 hover:text-white/80">
                {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex px-3 pb-3 gap-1.5">
        <button onClick={() => router.push(`/editor/${clip.id}`)} className="btn-secondary flex-1 py-1.5 px-2 text-[11px] justify-center">
          <Pencil size={10} /> Edit
        </button>
        <a href={clip.downloadUrl} download className="btn-secondary flex-1 py-1.5 px-2 text-[11px] justify-center">
          <Download size={10} /> Save
        </a>
        {clip.status !== "approved" && (
          <button onClick={() => onApprove(clip.id)} className="btn-primary flex-1 py-1.5 px-2 text-[11px] justify-center">
            <Check size={10} /> Approve
          </button>
        )}
        <button onClick={() => onDiscard(clip.id)} className="btn-secondary w-8 py-1.5 px-0 justify-center text-white/50 hover:text-red-400">
          <X size={11} />
        </button>
      </div>
    </div>
  );
}
