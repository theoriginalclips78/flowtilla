"use client";

import { useState, useRef } from "react";
import { Scissors, Download, Copy, Check, ChevronDown, ChevronUp, Loader2, Zap, Play } from "lucide-react";
import ToolPageLayout from "@/components/tools/ToolPageLayout";

interface Clip {
  id: string;
  title: string;
  reason: string;
  viralityScore: string;
  hook?: string;
  caption?: string;
  startTime: number;
  endTime: number;
  duration: number;
  downloadUrl: string;
  thumbnailUrl?: string | null;
  sourceTitle: string;
}

const viralBadge: Record<string, { label: string; bg: string }> = {
  high:   { label: "🔥 High",  bg: "rgba(192,57,43,0.8)" },
  medium: { label: "⚡ Med",   bg: "rgba(217,119,6,0.8)" },
  low:    { label: "💤 Low",   bg: "rgba(255,255,255,0.2)" },
};

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function ClipCard({ clip }: { clip: Clip }) {
  const [playing, setPlaying] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const badge = viralBadge[clip.viralityScore] || viralBadge.low;

  return (
    <div className="liquid-glass rounded-xl overflow-hidden border border-white/10" style={{ background: "rgba(255,255,255,0.07)" }}>
      {/* Thumbnail */}
      <div className="relative bg-black/40 aspect-video cursor-pointer" onClick={() => setPlaying(!playing)}>
        {playing ? (
          <video src={clip.downloadUrl} autoPlay controls className="w-full h-full object-cover" />
        ) : (
          <>
            {clip.thumbnailUrl
              ? <img src={clip.thumbnailUrl} alt={clip.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center bg-black/60">
                  <Scissors size={32} className="text-white/20" />
                </div>
            }
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full liquid-glass flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                <Play size={16} className="text-white ml-0.5" fill="white" />
              </div>
            </div>
          </>
        )}
        <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-lg liquid-glass text-white" style={{ background: badge.bg }}>
          {badge.label}
        </span>
        <span className="absolute bottom-2 right-2 text-[10px] text-white/80 liquid-glass px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.6)" }}>
          {clip.duration}s
        </span>
      </div>

      {/* Info */}
      <div className="px-3 pt-2.5 pb-1">
        <p className="font-medium text-[13px] text-white truncate">{clip.title}</p>
        <p className="text-[11px] text-white/40 mt-0.5">{fmt(clip.startTime)} – {fmt(clip.endTime)}</p>
        {clip.reason && <p className="text-[11px] text-white/50 mt-1 line-clamp-2">{clip.reason}</p>}
        {clip.hook && (
          <p className="text-[11px] text-white/60 mt-1 italic line-clamp-1">&ldquo;{clip.hook}&rdquo;</p>
        )}
      </div>

      {/* Caption */}
      {clip.caption && (
        <div className="px-3 pb-1">
          <button onClick={() => setCaptionOpen(v => !v)}
            className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 py-1">
            {captionOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />} Caption
          </button>
          {captionOpen && (
            <div className="relative rounded-lg p-2.5 mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
              <p className="text-[11px] text-white/70 leading-relaxed pr-6">{clip.caption}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(clip.caption || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="absolute top-2 right-2 text-white/40 hover:text-white/80">
                {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Download */}
      <div className="px-3 pb-3">
        <a href={clip.downloadUrl} download={`${clip.title}.mp4`} className="btn-primary w-full justify-center py-1.5 text-[12px]">
          <Download size={12} /> Download Clip
        </a>
      </div>
    </div>
  );
}

type StepStatus = "waiting" | "active" | "done" | "error";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
}

export default function AutoClipPage() {
  const [url, setUrl] = useState("");
  const [maxClips, setMaxClips] = useState(5);
  const [minDuration, setMinDuration] = useState(20);
  const [maxDuration, setMaxDuration] = useState(90);
  const [running, setRunning] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState("");
  const [log, setLog] = useState("");
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const setStep = (id: string, status: StepStatus) => {
    setSteps(prev => {
      const exists = prev.find(s => s.id === id);
      if (exists) return prev.map(s => s.id === id ? { ...s, status } : s);
      const labels: Record<string, string> = {
        download: "Downloading video",
        transcribe: "Transcribing audio",
        analyze: "AI finding best moments",
        cutting: "Cutting clips",
        done: "Complete",
      };
      const newStep: Step = { id, label: labels[id] || id, status };
      return [...prev.filter(s => s.id !== id), newStep];
    });
  };

  const handleRun = async () => {
    if (!url.trim()) return;
    setRunning(true);
    setClips([]);
    setSteps([]);
    setError("");
    setLog("");
    setDone(false);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/tools/auto-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), maxClips, minDuration, maxDuration }),
        signal: abortRef.current.signal,
      });

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            setLog(event.message || "");

            if (event.step === "download") setStep("download", "active");
            else if (event.step === "download_done") setStep("download", "done");
            else if (event.step === "transcribe") { setStep("download", "done"); setStep("transcribe", "active"); }
            else if (event.step === "transcribe_done") setStep("transcribe", "done");
            else if (event.step === "analyze") { setStep("transcribe", "done"); setStep("analyze", "active"); }
            else if (event.step === "analyze_done") { setStep("analyze", "done"); setStep("cutting", "active"); }
            else if (event.step === "clip_ready" && event.clip) {
              setClips(prev => [...prev, event.clip]);
            }
            else if (event.step === "done") {
              setStep("cutting", "done");
              setStep("done", "done");
              setDone(true);
            }
            else if (event.step === "error") {
              setError(event.message);
              setStep("download", "error");
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setRunning(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const stepIcon = (status: StepStatus, index: number) => {
    if (status === "done") return <Check size={13} className="text-green-400" />;
    if (status === "active") return <Loader2 size={13} className="animate-spin text-white" />;
    if (status === "error") return <span className="text-red-400 text-xs">✕</span>;
    return <span className="text-white/30 text-xs">{index + 1}</span>;
  };

  return (
    <ToolPageLayout title="Auto Clip with AI">
      <div className="space-y-5">
        {/* URL input */}
        <div>
          <label className="text-xs font-medium text-white/60 block mb-1.5">Video URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="glass-input"
            disabled={running}
            onKeyDown={(e) => e.key === "Enter" && !running && handleRun()}
          />
        </div>

        {/* Options */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-white/50">Max Clips</label>
              <span className="text-xs text-white font-medium">{maxClips}</span>
            </div>
            <input type="range" min={1} max={10} value={maxClips}
              onChange={(e) => setMaxClips(Number(e.target.value))}
              className="w-full accent-[var(--accent)]" disabled={running} />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-white/50">Min Duration</label>
              <span className="text-xs text-white font-medium">{minDuration}s</span>
            </div>
            <input type="range" min={10} max={60} step={5} value={minDuration}
              onChange={(e) => setMinDuration(Number(e.target.value))}
              className="w-full accent-[var(--accent)]" disabled={running} />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-white/50">Max Duration</label>
              <span className="text-xs text-white font-medium">{maxDuration}s</span>
            </div>
            <input type="range" min={30} max={180} step={10} value={maxDuration}
              onChange={(e) => setMaxDuration(Number(e.target.value))}
              className="w-full accent-[var(--accent)]" disabled={running} />
          </div>
        </div>

        {/* Run / Stop button */}
        {running ? (
          <button onClick={handleStop} className="btn-secondary w-full justify-center py-3">
            <span className="w-2 h-2 bg-red-400 rounded-sm" /> Stop
          </button>
        ) : (
          <button onClick={handleRun} disabled={!url.trim()} className="btn-primary w-full justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed">
            <Zap size={16} /> Auto Clip
          </button>
        )}

        {/* Progress steps */}
        {steps.length > 0 && (
          <div className="rounded-xl p-4 space-y-2.5" style={{ background: "rgba(0,0,0,0.3)" }}>
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  s.status === "done" ? "bg-green-500/20" :
                  s.status === "active" ? "bg-[var(--surface)]/15" :
                  s.status === "error" ? "bg-red-500/20" : "bg-[var(--surface)]/5"
                }`}>
                  {stepIcon(s.status, i)}
                </div>
                <span className={`text-sm ${
                  s.status === "done" ? "text-green-400" :
                  s.status === "active" ? "text-white" :
                  s.status === "error" ? "text-red-400" : "text-white/30"
                }`}>{s.label}</span>
                {s.status === "active" && log && (
                  <span className="text-xs text-white/40 truncate">{log}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm text-red-300" style={{ background: "rgba(192,57,43,0.15)", border: "1px solid rgba(192,57,43,0.3)" }}>
            {error}
          </div>
        )}

        {/* Done banner */}
        {done && clips.length > 0 && (
          <div className="rounded-xl px-4 py-3 text-sm text-green-300 flex items-center gap-2" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <Check size={15} /> {clips.length} clips ready to download
          </div>
        )}
      </div>

      {/* Clips grid */}
      {clips.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
            {clips.length} Clip{clips.length !== 1 ? "s" : ""} Generated
          </p>
          <div className="grid grid-cols-2 gap-3">
            {clips.map(clip => <ClipCard key={clip.id} clip={clip} />)}
          </div>
        </div>
      )}
    </ToolPageLayout>
  );
}
