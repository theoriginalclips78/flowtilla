"use client";

import { useState } from "react";
import { Loader2, Scissors, AlertCircle, Download } from "lucide-react";
import ToolPageLayout from "@/components/tools/ToolPageLayout";

interface Moment {
  start_time: number;
  end_time: number;
  title: string;
  reason: string;
  virality_score: string;
  hook: string;
}

const viralColors: Record<string, string> = {
  high: "bg-[var(--accent)] text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-gray-400 text-white",
};

const STEPS = ["📥 Downloading video...", "🎙️ Transcribing audio...", "🤖 Finding viral moments..."];

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function ClipFinderPage() {
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(-1);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [error, setError] = useState("");
  const [cutting, setCutting] = useState<string | null>(null);

  const handleFind = async () => {
    if (!url.trim()) return;
    setLoading(true); setError(""); setMoments([]); setStep(0);
    try {
      const res = await fetch("/api/tools/clip-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), prompt: prompt.trim() }),
      });
      // SSE stream
      if (!res.body) throw new Error("No response");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.step !== undefined) setStep(evt.step);
            if (evt.moments) setMoments(evt.moments);
            if (evt.error) throw new Error(evt.error);
          } catch { /* skip */ }
        }
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    }
    setLoading(false);
    setStep(-1);
  };

  const handleCut = async (m: Moment, idx: number) => {
    const key = `${idx}`;
    setCutting(key);
    try {
      const res = await fetch("/api/tools/cut-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), startTime: m.start_time, endTime: m.end_time, title: m.title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.download = `${m.title}.mp4`;
      a.click();
    } catch (e: unknown) {
      alert((e as Error).message);
    }
    setCutting(null);
  };

  return (
    <ToolPageLayout title="AI Clip Finder">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-1.5">Video URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste any YouTube or TikTok URL..."
            className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-1.5">What to look for <span className="normal-case font-normal">(optional)</span></label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="funny reactions, key insights, hype moments..."
            className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] resize-none"
          />
        </div>

        <button
          onClick={handleFind}
          disabled={loading || !url.trim()}
          className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Scissors size={16} />}
          {loading ? STEPS[step] || "Working..." : "Find Viral Moments"}
        </button>

        {loading && step >= 0 && (
          <div className="space-y-2 pt-1">
            {STEPS.map((s, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm ${i < step ? "text-green-600" : i === step ? "text-[var(--text)] font-medium" : "text-[var(--text-muted)]/40"}`}>
                {i < step ? "✅" : i === step ? <Loader2 size={13} className="animate-spin" /> : "○"} {s}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-4">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {moments.length > 0 && (
          <div className="space-y-3 pt-2">
            <p className="font-semibold text-sm text-[var(--text)]">Found {moments.length} viral moments</p>
            {moments.map((m, i) => (
              <div key={i} className="border border-[var(--border)] rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm text-[var(--text)]">{m.title}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${viralColors[m.virality_score] || viralColors.low}`}>
                    {m.virality_score === "high" ? "🔥" : m.virality_score === "medium" ? "⚡" : "💤"} {m.virality_score}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{fmt(m.start_time)} – {fmt(m.end_time)} · {Math.round(m.end_time - m.start_time)}s</p>
                <p className="text-xs text-[var(--text-muted)]">{m.reason}</p>
                <button
                  onClick={() => handleCut(m, i)}
                  disabled={cutting === `${i}`}
                  className="flex items-center gap-1.5 bg-[var(--chip)] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[var(--chip)]/80 disabled:opacity-50"
                >
                  {cutting === `${i}` ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                  Cut This Clip
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
