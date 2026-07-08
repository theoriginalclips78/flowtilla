"use client";

import { useEffect, useState } from "react";
import { Download, Copy, Check, Send, RefreshCw, Play } from "lucide-react";

interface Clip {
  id: string; title: string; hook: string; caption: string; campaignName: string;
  thumbnailUrl: string; downloadUrl: string; status: string; postedAt: string | null;
  tags: Record<string, string>;
}

const PLATFORMS = [
  { id: "tiktok", label: "TikTok", emoji: "🎵" },
  { id: "instagram", label: "Instagram", emoji: "📸" },
  { id: "youtube", label: "YouTube", emoji: "🎬" },
];

// Bump the shared daily tally used by the dashboard widget.
function bumpTally() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem("montview_tally");
    const d = raw ? JSON.parse(raw) : null;
    const count = (d && d.date === today ? d.count : 0) + 1;
    localStorage.setItem("montview_tally", JSON.stringify({ date: today, count }));
  } catch { /* ignore */ }
}

export default function PostQueuePage() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState("tiktok");
  const [copied, setCopied] = useState<string>("");
  const [captions, setCaptions] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    fetch("/api/clips").then(r => r.json()).then((d: Clip[]) => {
      setClips(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const captionFor = (c: Clip) => {
    if (captions[c.id] !== undefined) return captions[c.id];
    const tag = c.tags?.[platform] || "";
    let cap = c.caption || c.hook || "";
    if (tag && !cap.toLowerCase().includes(tag.toLowerCase())) cap = `${cap} ${tag}`.trim();
    return cap;
  };

  const copy = async (c: Clip) => {
    try { await navigator.clipboard.writeText(captionFor(c)); setCopied(c.id); setTimeout(() => setCopied(""), 1500); } catch { /* ignore */ }
  };

  const markPosted = async (c: Clip) => {
    setClips(prev => prev.map(x => x.id === c.id ? { ...x, postedAt: new Date().toISOString() } : x));
    bumpTally();
    await fetch(`/api/clips/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ posted: true }) });
    // also log it in the Social Tracker so views can be tracked later
    fetch("/api/tracker", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, hook: c.hook || c.title, views: 0 }) }).catch(() => {});
  };

  const queue = clips.filter(c => !c.postedAt && c.status !== "discarded");
  const postedToday = clips.filter(c => c.postedAt && new Date(c.postedAt).toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center">
          <Send size={18} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)]">Post Queue</h1>
          <p className="text-sm text-[var(--text-muted)]">{queue.length} to post · {postedToday} posted today</p>
        </div>
        <button onClick={load} className="ml-auto btn-secondary !py-2 text-sm"><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Platform selector — changes the tag inserted into every caption */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Posting to</span>
        {PLATFORMS.map(p => (
          <button key={p.id} onClick={() => setPlatform(p.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${platform === p.id ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            {p.emoji} {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin text-[var(--text-light)]" /></div>
      ) : queue.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm font-medium text-[var(--text)]">Queue's empty 🎉</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Run a campaign to generate clips, then they&apos;ll show up here ready to post.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map(c => (
            <div key={c.id} className="panel p-4 flex gap-4">
              {/* preview */}
              <a href={c.downloadUrl} target="_blank" rel="noopener noreferrer"
                className="relative w-28 shrink-0 rounded-xl overflow-hidden bg-[var(--chip)] aspect-[9/16] block group">
                {c.thumbnailUrl
                  ? <img src={c.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  : <video src={c.downloadUrl} className="w-full h-full object-cover" preload="none" />}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play size={16} className="text-white" fill="white" />
                </div>
              </a>

              {/* caption + actions */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-bold text-[var(--text)] truncate">{c.hook || c.title}</span>
                  {c.campaignName && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-semibold shrink-0">{c.campaignName}</span>}
                </div>
                <textarea
                  value={captionFor(c)}
                  onChange={e => setCaptions(m => ({ ...m, [c.id]: e.target.value }))}
                  rows={2}
                  className="glass-input !text-sm resize-none flex-1"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => copy(c)} className="btn-secondary !py-1.5 text-sm">
                    {copied === c.id ? <><Check size={14} className="text-[var(--accent)]" /> Copied</> : <><Copy size={14} /> Copy caption</>}
                  </button>
                  <a href={c.downloadUrl} download className="btn-secondary !py-1.5 text-sm"><Download size={14} /> Download</a>
                  <button onClick={() => markPosted(c)} className="btn-blue !py-1.5 text-sm ml-auto"><Check size={14} /> Mark posted</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
