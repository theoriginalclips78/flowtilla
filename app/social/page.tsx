"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, Eye, Trophy, ExternalLink, RefreshCw } from "lucide-react";

interface Post {
  id: string; platform: string; url: string; hook: string; style: string;
  views: number; likes: number; postedAt: string; createdAt: string;
}

const PLATFORMS = [
  { id: "tiktok", label: "TikTok", emoji: "🎵" },
  { id: "instagram", label: "Instagram", emoji: "📸" },
  { id: "youtube", label: "YouTube", emoji: "🎬" },
  { id: "twitter", label: "X", emoji: "𝕏" },
];
const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

export default function SocialTrackerPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState("tiktok");
  const [url, setUrl] = useState("");
  const [hook, setHook] = useState("");
  const [views, setViews] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/tracker").then(r => r.json()).then(d => { setPosts(Array.isArray(d) ? d : []); setLoading(false); });
  };
  useEffect(load, []);

  const add = async () => {
    if (!url.trim() && !hook.trim()) return;
    setSaving(true);
    await fetch("/api/tracker", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, url, hook, views }) });
    setUrl(""); setHook(""); setViews(""); setSaving(false); load();
  };
  const updateViews = async (id: string, v: string) => {
    setPosts(p => p.map(x => x.id === id ? { ...x, views: parseInt(v) || 0 } : x));
    await fetch(`/api/tracker/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ views: v }) });
  };
  const remove = async (id: string) => {
    setPosts(p => p.filter(x => x.id !== id));
    await fetch(`/api/tracker/${id}`, { method: "DELETE" });
  };

  const totalViews = posts.reduce((s, p) => s + p.views, 0);
  const avg = posts.length ? Math.round(totalViews / posts.length) : 0;
  const best = posts[0];
  // Best hooks: top 5 posts that have a hook, unique-ish
  const topHooks = posts.filter(p => p.hook).slice(0, 5);

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center">
          <TrendingUp size={20} className="text-[var(--text-muted)]" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)]">Social Tracker</h1>
          <p className="text-sm text-[var(--text-muted)]">Log your posts and views — see which hooks actually pop.</p>
        </div>
        <button onClick={load} className="ml-auto btn-secondary !py-2 text-sm"><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-4 gap-4">
        <Stat icon={<Eye size={18} />} label="Total views" value={fmt(totalViews)} />
        <Stat icon={<TrendingUp size={18} />} label="Posts tracked" value={String(posts.length)} />
        <Stat icon={<TrendingUp size={18} />} label="Avg / post" value={fmt(avg)} />
        <Stat icon={<Trophy size={18} />} label="Best post" value={best ? fmt(best.views) : "—"} />
      </div>

      {/* Add post */}
      <div className="panel p-5">
        <h2 className="font-bold text-[var(--text)] mb-3">Log a post</h2>
        <div className="grid grid-cols-12 gap-2">
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="glass-input col-span-2">
            {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>)}
          </select>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Post URL" className="glass-input col-span-4" />
          <input value={hook} onChange={e => setHook(e.target.value)} placeholder="Hook used (optional)" className="glass-input col-span-4" />
          <input value={views} onChange={e => setViews(e.target.value)} type="number" placeholder="Views" className="glass-input col-span-1" />
          <button onClick={add} disabled={saving} className="btn-blue col-span-1 justify-center">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={16} />}
          </button>
        </div>
      </div>

      {/* Top hooks */}
      {topHooks.length > 0 && (
        <div className="panel p-5">
          <h2 className="font-bold text-[var(--text)] mb-3 flex items-center gap-2"><Trophy size={16} className="text-[var(--text-muted)]" /> Best-performing hooks</h2>
          <div className="space-y-2">
            {topHooks.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--text-light)] w-5">#{i + 1}</span>
                <span className="flex-1 text-sm text-[var(--text)] truncate">&ldquo;{p.hook}&rdquo;</span>
                <span className="text-sm font-semibold text-[var(--text)] tabular-nums">{fmt(p.views)} views</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Posts list */}
      <div className="panel p-5">
        <h2 className="font-bold text-[var(--text)] mb-3">Tracked posts</h2>
        {loading ? (
          <div className="flex justify-center py-10"><RefreshCw size={18} className="animate-spin text-[var(--text-light)]" /></div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">No posts yet. Log your first post above to start tracking what works.</p>
        ) : (
          <div className="space-y-1.5">
            {posts.map(p => {
              const pf = PLATFORMS.find(x => x.id === p.platform);
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
                  <span className="text-lg w-6 text-center">{pf?.emoji || "🔗"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] truncate">{p.hook || p.url || "Untitled post"}</p>
                    {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[var(--text-light)] hover:text-[var(--accent)] flex items-center gap-1 truncate"><ExternalLink size={10} /> {p.url}</a>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input defaultValue={p.views} onBlur={e => updateViews(p.id, e.target.value)} type="number"
                      className="w-20 text-right glass-input !py-1.5 !text-sm font-semibold" />
                    <span className="text-xs text-[var(--text-light)]">views</span>
                  </div>
                  <button onClick={() => remove(p.id)} className="text-[var(--text-light)] hover:text-[var(--danger)] p-1"><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1.5">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-extrabold text-[var(--text)]">{value}</div>
    </div>
  );
}
