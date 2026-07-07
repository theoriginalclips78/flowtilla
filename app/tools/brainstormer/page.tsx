"use client";

import { useState } from "react";
import { Loader2, MessageSquare, AlertCircle, Copy, RefreshCw } from "lucide-react";
import ToolPageLayout from "@/components/tools/ToolPageLayout";

interface Idea {
  title: string;
  hook: string;
  why: string;
  platform: string;
}

const CONTENT_TYPES = ["Short clips", "Long form", "Stories", "Reels"];
const PLATFORM_COLORS: Record<string, string> = {
  TikTok: "bg-black text-white",
  Instagram: "bg-pink-500 text-white",
  YouTube: "bg-[var(--accent)] text-white",
  Twitch: "bg-purple-600 text-white",
};

export default function BrainstormerPage() {
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [contentType, setContentType] = useState("Short clips");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!niche.trim()) return;
    setLoading(true); setError(""); setIdeas([]);
    try {
      const res = await fetch("/api/tools/brainstormer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim(), audience: audience.trim(), contentType, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setIdeas(data.ideas);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
    setLoading(false);
  };

  const copyAll = () => {
    const text = ideas.map((idea, i) => `${i + 1}. ${idea.title}\nHook: ${idea.hook}\nWhy: ${idea.why}`).join("\n\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <ToolPageLayout title="Content Brainstormer">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-1.5">Niche / Brand</label>
            <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="fitness, gaming, cooking..." className="w-full border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-1.5">Target Audience</label>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="men 18-35, Gen Z..." className="w-full border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-2">Content Type</label>
          <div className="flex gap-2 flex-wrap">
            {CONTENT_TYPES.map((t) => (
              <button key={t} onClick={() => setContentType(t)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${contentType === t ? "bg-[var(--chip)] text-white border-[var(--chip)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}>{t}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase">Number of Ideas</label>
            <span className="text-sm font-bold text-[var(--text)]">{count}</span>
          </div>
          <input type="range" min={5} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !niche.trim()}
          className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
          {loading ? "Generating Ideas..." : "Generate Ideas"}
        </button>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-4">
            <AlertCircle size={16} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {ideas.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm text-[var(--text)]">{ideas.length} content ideas</p>
              <div className="flex gap-2">
                <button onClick={copyAll} className="flex items-center gap-1 text-xs border border-[var(--border)] px-2.5 py-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)]">
                  <Copy size={11} /> Copy All
                </button>
                <button onClick={handleGenerate} className="flex items-center gap-1 text-xs border border-[var(--border)] px-2.5 py-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)]">
                  <RefreshCw size={11} /> More
                </button>
              </div>
            </div>
            {ideas.map((idea, i) => (
              <div key={i} className="border border-[var(--border)] rounded-xl p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-sm text-[var(--text)]">{i + 1}. {idea.title}</p>
                  {idea.platform && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${PLATFORM_COLORS[idea.platform] || "bg-[var(--surface-2)] text-[var(--text-muted)]"}`}>{idea.platform}</span>
                  )}
                </div>
                <p className="text-xs text-[var(--accent)] font-medium italic">&quot;{idea.hook}&quot;</p>
                <p className="text-xs text-[var(--text-muted)]">{idea.why}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
