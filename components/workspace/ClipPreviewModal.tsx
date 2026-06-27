"use client";

import { useEffect, useRef, useState } from "react";
import { X, Check, Download, Copy, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { WorkspaceClip } from "./WorkspaceClipCard";

interface Props {
  clip: WorkspaceClip;
  clips: WorkspaceClip[];
  onClose: () => void;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
  onNavigate: (clip: WorkspaceClip) => void;
}

const viralColor: Record<string, string> = {
  high:   "#EF4444",
  medium: "#F59E0B",
  low:    "#6B7280",
};

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function ClipPreviewModal({ clip, clips, onClose, onApprove, onDiscard, onNavigate }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [copied, setCopied] = useState(false);
  const activeClips = clips.filter(c => c.status !== "discarded");
  const idx = activeClips.findIndex(c => c.id === clip.id);
  const duration = Math.round(clip.endTime - clip.startTime);

  // keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && idx > 0) onNavigate(activeClips[idx - 1]);
      if (e.key === "ArrowRight" && idx < activeClips.length - 1) onNavigate(activeClips[idx + 1]);
      if (e.key === "a" || e.key === "A") onApprove(clip.id);
      if (e.key === "d" || e.key === "D") { onDiscard(clip.id); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clip.id, idx, activeClips]);

  const copyCaption = () => {
    navigator.clipboard.writeText(clip.caption || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative flex w-full max-w-5xl mx-4 rounded-2xl overflow-hidden"
        style={{ background: "rgba(10,18,40,0.95)", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "92vh" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <X size={15} className="text-white" />
        </button>

        {/* Left nav */}
        {idx > 0 && (
          <button
            onClick={() => onNavigate(activeClips[idx - 1])}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <ChevronLeft size={18} className="text-white" />
          </button>
        )}

        {/* Right nav */}
        {idx < activeClips.length - 1 && (
          <button
            onClick={() => onNavigate(activeClips[idx + 1])}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <ChevronRight size={18} className="text-white" />
          </button>
        )}

        {/* Video — 9:16 portrait */}
        <div className="flex-shrink-0 flex items-center justify-center bg-black" style={{ width: 340 }}>
          <div className="relative" style={{ width: 320, aspectRatio: "9/16" }}>
            <video
              ref={videoRef}
              src={clip.downloadUrl}
              autoPlay
              controls
              loop
              className="w-full h-full object-cover rounded-xl"
              style={{ background: "#000" }}
            />
            {clip.status === "approved" && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: "rgba(34,197,94,0.9)" }}>
                <Check size={11} className="text-white" />
                <span className="text-[11px] font-semibold text-white">Approved</span>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col flex-1 p-6 overflow-y-auto" style={{ minWidth: 0 }}>
          {/* Counter */}
          <p className="text-[11px] mb-3" style={{ color: "rgba(96,165,250,0.7)" }}>
            {idx + 1} of {activeClips.length} clips
          </p>

          {/* Title */}
          <h2 className="text-white font-bold text-lg leading-snug mb-1">{clip.title}</h2>

          {/* Meta row */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={{ background: `${viralColor[clip.viralityScore] || "#6B7280"}22`, color: viralColor[clip.viralityScore] || "#9CA3AF", border: `1px solid ${viralColor[clip.viralityScore] || "#6B7280"}44` }}>
              {clip.viralityScore === "high" ? "🔥 High virality" : clip.viralityScore === "medium" ? "⚡ Medium" : "💤 Low"}
            </span>
            <span className="text-[12px]" style={{ color: "rgba(186,210,255,0.5)" }}>
              {fmt(clip.startTime)} – {fmt(clip.endTime)} · {duration}s
            </span>
          </div>

          {/* Why viral */}
          {clip.reason && (
            <div className="mb-4 rounded-xl p-3.5" style={{ background: "rgba(185,28,28,0.08)", border: "1px solid rgba(185,28,28,0.18)" }}>
              <p className="text-[11px] font-semibold mb-1" style={{ color: "#EF4444" }}>WHY THIS WORKS</p>
              <p className="text-[13px] leading-relaxed" style={{ color: "rgba(186,210,255,0.85)" }}>{clip.reason}</p>
            </div>
          )}

          {/* Hook */}
          {clip.hook && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold mb-1.5" style={{ color: "rgba(186,210,255,0.5)" }}>HOOK</p>
              <p className="text-[13px] leading-relaxed text-white">{clip.hook}</p>
            </div>
          )}

          {/* Caption */}
          {clip.caption && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold mb-1.5" style={{ color: "rgba(186,210,255,0.5)" }}>CAPTION</p>
              <div className="relative rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[13px] leading-relaxed pr-7" style={{ color: "rgba(186,210,255,0.85)" }}>{clip.caption}</p>
                <button onClick={copyCaption} className="absolute top-3 right-3 transition-all"
                  style={{ color: copied ? "#4ADE80" : "rgba(255,255,255,0.4)" }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          )}

          {/* Platform fit */}
          {clip.platformFit && (
            <div className="mb-5">
              <p className="text-[11px] font-semibold mb-1.5" style={{ color: "rgba(186,210,255,0.5)" }}>BEST FOR</p>
              <div className="flex gap-1.5 flex-wrap">
                {clip.platformFit.split(",").map(p => (
                  <span key={p} className="text-[11px] px-2.5 py-0.5 rounded-full"
                    style={{ background: "rgba(6,182,212,0.12)", color: "#22D3EE", border: "1px solid rgba(6,182,212,0.25)" }}>
                    {p.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Keyboard hints */}
          <p className="text-[10px] mb-4" style={{ color: "rgba(255,255,255,0.2)" }}>
            ← → navigate · A approve · D discard · Esc close
          </p>

          {/* Action buttons */}
          <div className="mt-auto flex flex-col gap-2">
            {clip.status !== "approved" ? (
              <button onClick={() => onApprove(clip.id)}
                className="btn-primary w-full py-3 text-sm justify-center gap-2">
                <Check size={15} /> Approve Clip
              </button>
            ) : (
              <div className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold"
                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ADE80" }}>
                <Check size={15} /> Approved
              </div>
            )}
            <div className="flex gap-2">
              <a href={clip.downloadUrl} download
                className="btn-secondary flex-1 py-2.5 text-sm justify-center gap-2">
                <Download size={13} /> Download
              </a>
              <button onClick={() => { onDiscard(clip.id); onClose(); }}
                className="btn-secondary py-2.5 px-4 text-sm justify-center gap-1.5 hover:text-red-400">
                <Trash2 size={13} /> Discard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
