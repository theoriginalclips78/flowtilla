"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, X, Download, RefreshCw, Play, Trash2, ChevronLeft, ChevronRight, Copy, Send, Loader2 } from "lucide-react";

interface Clip {
  id: string; title: string; downloadUrl: string; thumbnailUrl: string;
  startTime: number; endTime: number; viralityScore: string;
  reason: string; hook: string; caption: string; platformFit: string;
  status: string; campaignId: string; filePath: string; createdAt: string;
  campaignName?: string; tags?: Record<string, string>;
}

// Build a ready-to-paste caption: organic caption + required @mention + hashtags.
// Data-backed: viral clips average ~10 hashtags mixing generic-reach tags with
// niche tags, and #fyp-style tags get 2.2x median views. So we ship 8-12 tags.
function buildPostCaption(clip: Clip, platform: "tiktok" | "instagram" | "youtube"): string {
  const base = (clip.caption || clip.title || "").trim();
  const mention = clip.tags?.[platform] || "";
  const camp = (clip.campaignName || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  // generic reach tags (platform-native) + niche tags + the brand tag
  const reach: Record<string, string[]> = {
    tiktok:    ["#fyp", "#foryou", "#foryoupage", "#viral"],
    instagram: ["#reels", "#reelsinstagram", "#explore", "#viral"],
    youtube:   ["#shorts", "#shortsfeed", "#viral"],
  };
  // Universal viral/reach tags that work for ANY campaign niche.
  const universal = ["#trending", "#viralvideo", "#blowthisup", "#fypシ", "#trend"];
  // Campaign-specific niche anchor (the brand/topic), derived from the campaign name.
  const tags = [...reach[platform], `#${camp}`.length > 1 ? `#${camp}` : "", ...universal].filter(Boolean);
  // de-dupe + cap at 12
  const seen = new Set<string>();
  const finalTags = tags.filter(t => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
  return [base, mention, finalTags.join(" ")].filter(Boolean).join("\n\n");
}
interface Campaign { id: string; name: string; }
interface SocialAccount { id: string; platform: string; accountName: string; }

type FilterTab = "all" | "pending" | "approved" | "discarded";

const viral: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: "var(--accent-soft)", text: "#DC2626", label: "🔥 High" },
  medium: { bg: "#FFFBEB", text: "#D97706", label: "⚡ Med" },
  low:    { bg: "#F8FAFC", text: "var(--text-muted)", label: "💤 Low" },
};
function fmt(s: number) { return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(Math.floor(s%60)).padStart(2,"0")}`; }

const PLATFORM_LABEL: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };
const PLATFORM_ICON: Record<string, string>  = { tiktok: "TT", instagram: "IG", youtube: "YT" };

/* ──────────── Post Modal ──────────── */
function PostModal({ clip, accounts, onClose, campaignName }: {
  clip: Clip; accounts: SocialAccount[]; onClose: () => void; campaignName: string;
}) {
  const [selectedId, setSelectedId] = useState<string>(accounts[0]?.id || "");
  const [caption, setCaption]       = useState(clip.caption || clip.title);
  const [posting, setPosting]       = useState(false);
  const [result, setResult]         = useState<{ ok?: boolean; error?: string; postUrl?: string } | null>(null);

  const selectedAccount = accounts.find(a => a.id === selectedId);

  // Group accounts by platform
  const byPlatform: Record<string, SocialAccount[]> = {};
  for (const a of accounts) {
    if (!byPlatform[a.platform]) byPlatform[a.platform] = [];
    byPlatform[a.platform].push(a);
  }

  const post = async () => {
    if (!selectedAccount) return;
    setPosting(true);
    const res = await fetch("/api/social/post", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipId: clip.id, platform: selectedAccount.platform, accountId: selectedAccount.id, caption }),
    });
    const data = await res.json();
    setResult(data.ok ? { ok: true, postUrl: data.postUrl } : { error: data.error });
    setPosting(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 20px 50px rgba(15,30,60,0.18)" }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="font-bold text-[var(--text)]">Post Clip</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{campaignName} · {clip.title.slice(0,40)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--surface-2)] transition-all">
            <X size={15} className="text-[var(--text-muted)]" />
          </button>
        </div>

        {result ? (
          <div className="p-6 text-center">
            {result.ok ? (
              <>
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <Check size={26} className="text-green-500" />
                </div>
                <p className="font-bold text-[var(--text)] text-lg mb-1">Posted successfully!</p>
                {result.postUrl && <a href={result.postUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--accent)] underline">{result.postUrl}</a>}
                <button onClick={onClose} className="btn-primary mt-4 mx-auto justify-center">Done</button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                  <X size={26} className="text-[var(--accent)]" />
                </div>
                <p className="font-bold text-[var(--text)] text-lg mb-1">Post failed</p>
                <p className="text-sm text-[var(--text-muted)] mb-4">{result.error}</p>
                <button onClick={() => setResult(null)} className="btn-secondary mx-auto justify-center">Try again</button>
              </>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Account picker */}
            {accounts.length === 0 ? (
              <div className="rounded-xl p-4 text-center" style={{ background: "var(--accent-soft)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold text-[var(--text)] mb-1">No accounts connected</p>
                <a href="/settings" className="text-sm text-[var(--accent)] underline">Go to Settings → Connected Accounts</a>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] block mb-2">POST TO</label>
                <div className="space-y-3">
                  {Object.entries(byPlatform).map(([platform, accts]) => (
                    <div key={platform}>
                      <p className="text-[10px] font-bold text-[var(--text-light)] mb-1.5 uppercase tracking-wider">{PLATFORM_LABEL[platform] || platform}</p>
                      <div className="space-y-1.5">
                        {accts.map(acct => (
                          <button key={acct.id} onClick={() => setSelectedId(acct.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all text-left"
                            style={selectedId === acct.id
                              ? { background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--text)" }
                              : { background: "var(--surface)", borderColor: "var(--border)", color: "var(--chip)" }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                              style={{ background: selectedId === acct.id ? "var(--accent)" : "var(--chip)" }}>
                              {PLATFORM_ICON[platform] || platform[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{acct.accountName}</p>
                              <p className="text-[10px] text-[var(--text-light)] font-normal">{PLATFORM_LABEL[platform] || platform}</p>
                            </div>
                            {selectedId === acct.id && <Check size={14} className="text-[var(--accent)] flex-shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <a href="/settings" className="text-[11px] text-[var(--text-light)] hover:text-[var(--accent)] mt-2 block transition-colors">
                  + Connect another account
                </a>
              </div>
            )}

            {/* Caption */}
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] block mb-2">CAPTION</label>
              <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3}
                className="glass-input resize-none text-sm" placeholder="Write a caption..." />
              <p className="text-[10px] text-[var(--text-light)] mt-1">{caption.length}/2200</p>
            </div>

            <button onClick={post} disabled={posting || !selectedAccount}
              className="btn-primary w-full justify-center py-3 gap-2 disabled:opacity-50">
              {posting
                ? <><Loader2 size={15} className="animate-spin" /> Posting…</>
                : <><Send size={15} /> Post to {selectedAccount ? selectedAccount.accountName : "…"}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────── Preview Modal ──────────── */
function PreviewModal({ clip, clips, campaigns, accounts, onClose, onStatus, onNavigate }: {
  clip: Clip; clips: Clip[]; campaigns: Record<string, string>;
  accounts: SocialAccount[]; onClose: () => void;
  onStatus: (id: string, s: string) => void;
  onNavigate: (clip: Clip) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const visible = clips.filter(c => c.status !== "discarded");
  const idx = visible.findIndex(c => c.id === clip.id);
  const v = viral[clip.viralityScore] || viral.low;
  const duration = Math.round(clip.endTime - clip.startTime);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "a" || e.key === "A") onStatus(clip.id, "approved");
      if (e.key === "d" || e.key === "D") { onStatus(clip.id, "discarded"); onClose(); }
      if (e.key === "ArrowLeft" && idx > 0) onNavigate(visible[idx - 1]);
      if (e.key === "ArrowRight" && idx < visible.length - 1) onNavigate(visible[idx + 1]);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [clip.id, idx, visible.length]);

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="relative flex w-full max-w-5xl mx-4 rounded-2xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "92vh", boxShadow: "0 25px 60px rgba(15,30,60,0.2)" }}>

          <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--surface-2)]" style={{ border: "1px solid var(--border)" }}>
            <X size={15} className="text-[var(--text-muted)]" />
          </button>

          {idx > 0 && (
            <button onClick={() => onNavigate(visible[idx - 1])} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center bg-[var(--surface)] hover:bg-[var(--surface-2)] shadow-md" style={{ border: "1px solid var(--border)" }}>
              <ChevronLeft size={18} className="text-[var(--text-muted)]" />
            </button>
          )}
          {idx < visible.length - 1 && (
            <button onClick={() => onNavigate(visible[idx + 1])} className="absolute right-12 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center bg-[var(--surface)] hover:bg-[var(--surface-2)] shadow-md" style={{ border: "1px solid var(--border)" }}>
              <ChevronRight size={18} className="text-[var(--text-muted)]" />
            </button>
          )}

          {/* Video */}
          <div className="flex-shrink-0 flex items-center justify-center bg-[var(--chip)]" style={{ width: 320 }}>
            <div style={{ width: 290, aspectRatio: "9/16" }}>
              <video src={clip.downloadUrl} autoPlay controls loop className="w-full h-full object-cover rounded-xl" />
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col flex-1 p-7 overflow-y-auto">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                {campaigns[clip.campaignId] || "Campaign"}
              </span>
              <span className="text-xs text-[var(--text-light)]">{idx + 1} of {visible.length}</span>
            </div>

            <h2 className="text-[var(--text)] font-bold text-xl leading-snug mt-2 mb-3">{clip.title}</h2>

            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: v.bg, color: v.text }}>{v.label} virality</span>
              <span className="text-xs text-[var(--text-light)]">{fmt(clip.startTime)} – {fmt(clip.endTime)} · {duration}s</span>
              {clip.status === "approved" && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-600">✓ Approved</span>}
            </div>

            {clip.reason && (
              <div className="mb-4 rounded-xl p-4" style={{ background: "var(--accent-soft)", border: "1px solid var(--border)" }}>
                <p className="text-[11px] font-bold text-[var(--accent)] mb-1">WHY THIS WORKS</p>
                <p className="text-sm text-[#450A0A] leading-relaxed">{clip.reason}</p>
              </div>
            )}

            {clip.hook && (
              <div className="mb-4">
                <p className="text-[11px] font-bold text-[var(--text-light)] mb-1.5">HOOK</p>
                <p className="text-sm text-[var(--text)] leading-relaxed">{clip.hook}</p>
              </div>
            )}

            {clip.caption && (
              <div className="mb-4">
                <p className="text-[11px] font-bold text-[var(--text-light)] mb-1.5">CAPTION</p>
                <div className="relative rounded-xl p-3.5" style={{ background: "#F8FAFC", border: "1px solid var(--border)" }}>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed pr-7">{clip.caption}</p>
                  <button onClick={() => { navigator.clipboard.writeText(clip.caption); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="absolute top-3 right-3" style={{ color: copied ? "#16A34A" : "var(--text-light)" }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            )}

            {clip.platformFit && (
              <div className="mb-5">
                <p className="text-[11px] font-bold text-[var(--text-light)] mb-1.5">BEST FOR</p>
                <div className="flex gap-1.5 flex-wrap">
                  {clip.platformFit.split(",").map(p => (
                    <span key={p} className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--border)" }}>{p.trim()}</span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-[var(--text-light)] mb-4">A approve · D discard · Esc close</p>

            <div className="mt-auto flex flex-col gap-2">
              <button onClick={() => setShowPost(true)}
                className="btn-blue w-full py-3 justify-center gap-2 text-sm">
                <Send size={15} /> Post to Social Media
              </button>
              {clip.status !== "approved" ? (
                <button onClick={() => onStatus(clip.id, "approved")} className="btn-primary w-full py-2.5 justify-center gap-2 text-sm">
                  <Check size={15} /> Approve
                </button>
              ) : (
                <button onClick={() => onStatus(clip.id, "pending")}
                  className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold"
                  style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#16A34A" }}>
                  <Check size={15} /> Approved — click to undo
                </button>
              )}
              <div className="flex gap-2">
                <a href={clip.downloadUrl} download className="btn-secondary flex-1 py-2.5 text-sm justify-center gap-2"><Download size={13} /> Download</a>
                <button onClick={() => { onStatus(clip.id, "discarded"); onClose(); }} className="btn-secondary py-2.5 px-4 text-sm justify-center gap-1.5 hover:text-[var(--accent)]">
                  <Trash2 size={13} /> Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPost && (
        <PostModal clip={clip} accounts={accounts} campaignName={campaigns[clip.campaignId] || "Campaign"} onClose={() => setShowPost(false)} />
      )}
    </>
  );
}

/* ──────────── Clip Card ──────────── */
function ClipCard({ clip, campaigns, onPreview, onStatus, accounts }: {
  clip: Clip; campaigns: Record<string, string>;
  onPreview: () => void;
  onStatus: (id: string, s: string) => void;
  accounts: SocialAccount[];
}) {
  const [showPost, setShowPost] = useState(false);
  const [capPlatform, setCapPlatform] = useState<"tiktok" | "instagram" | "youtube">("tiktok");
  const [copied, setCopied] = useState(false);
  const v = viral[clip.viralityScore] || viral.low;
  const duration = Math.round(clip.endTime - clip.startTime);
  const campaignName = campaigns[clip.campaignId] || clip.campaignName || "—";
  const hasTags = clip.tags && Object.keys(clip.tags).length > 0;
  const postCaption = buildPostCaption(clip, capPlatform);

  return (
    <>
      <div className="panel overflow-hidden group cursor-pointer hover:-translate-y-0.5 transition-all hover:shadow-md"
        style={clip.status === "approved" ? { borderColor: "#86EFAC" } : clip.status === "discarded" ? { opacity: 0.45 } : {}}>

        {/* Thumbnail */}
        <div className="relative bg-[var(--chip)] aspect-video" onClick={onPreview}>
          {clip.thumbnailUrl
            ? <img src={clip.thumbnailUrl} alt={clip.title} className="w-full h-full object-cover" />
            : <video src={clip.downloadUrl} className="w-full h-full object-cover" preload="metadata" />
          }
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--accent)", boxShadow: "0 4px 14px rgba(155,28,28,0.5)" }}>
              <Play size={16} className="text-white ml-0.5" fill="white" />
            </div>
          </div>
          <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: v.bg, color: v.text }}>{v.label}</span>
          <span className="absolute bottom-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/60 text-white">{duration}s</span>
          {clip.status === "approved" && (
            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
              <Check size={11} className="text-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="text-[10px] font-semibold text-[var(--accent)] mb-0.5 truncate">{campaignName}</p>
          <p className="text-sm font-semibold text-[var(--text)] truncate mb-0.5">{clip.title}</p>
          <p className="text-[11px] text-[var(--text-light)] truncate">{new Date(clip.createdAt).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}</p>

          {/* Ready-to-paste caption with required @mention + hashtags */}
          <div className="mt-2.5 rounded-lg border p-2" style={{ borderColor: "var(--border)", background: "#FFF9F9" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--accent)]">Caption to copy</span>
              <div className="flex gap-0.5">
                {(["tiktok","instagram","youtube"] as const).map(p => (
                  <button key={p} onClick={() => setCapPlatform(p)}
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded transition-all"
                    style={capPlatform === p ? { background: "var(--accent)", color: "var(--surface)" } : { background: "var(--border)", color: "var(--accent)" }}>
                    {p === "tiktok" ? "TT" : p === "instagram" ? "IG" : "YT"}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed whitespace-pre-line mb-1.5" style={{ maxHeight: 84, overflowY: "auto" }}>{postCaption}</p>
            {hasTags && (
              <p className="text-[9px] font-semibold text-[#DC2626] mb-1.5">⚠ Must tag {clip.tags?.[capPlatform] || "the brand account"} — keep likes visible, no ad wording</p>
            )}
            <button onClick={() => { navigator.clipboard.writeText(postCaption); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all"
              style={{ background: copied ? "#16A34A" : "var(--accent)", color: "var(--surface)" }}>
              {copied ? <><Check size={10}/> Copied!</> : <><Copy size={10}/> Copy caption</>}
            </button>
          </div>

          <div className="flex gap-1.5 mt-2.5">
            {clip.status !== "approved" ? (
              <button onClick={e => { e.stopPropagation(); onStatus(clip.id, "approved"); }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{ background: "var(--chip)", color: "var(--surface)" }}>
                <Check size={11} /> Approve
              </button>
            ) : (
              <button onClick={e => { e.stopPropagation(); setShowPost(true); }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--border)" }}>
                <Send size={11} /> Post
              </button>
            )}
            <a href={clip.downloadUrl} download onClick={e => e.stopPropagation()}
              className="w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] transition-all"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <Download size={12} />
            </a>
            <button onClick={e => { e.stopPropagation(); onStatus(clip.id, clip.status === "discarded" ? "pending" : "discarded"); }}
              className="w-8 flex items-center justify-center rounded-lg transition-all hover:bg-red-50 hover:border-red-200 hover:text-[var(--accent)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-light)" }}>
              <X size={12} />
            </button>
          </div>
        </div>
      </div>

      {showPost && (
        <PostModal clip={clip} accounts={accounts} campaignName={campaignName} onClose={() => setShowPost(false)} />
      )}
    </>
  );
}

/* ──────────── Page ──────────── */
export default function ClipsPage() {
  const [clips, setClips]       = useState<Clip[]>([]);
  const [campaigns, setCampaigns] = useState<Record<string, string>>({});
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [filter, setFilter]     = useState<FilterTab>("all");
  const [loading, setLoading]   = useState(true);
  const [preview, setPreview]   = useState<Clip | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [clipsRes, campRes, acctRes] = await Promise.all([
      fetch("/api/clips").then(r => r.json()),
      fetch("/api/campaigns").then(r => r.json()),
      fetch("/api/social/accounts").then(r => r.json()),
    ]);
    setClips(Array.isArray(clipsRes) ? clipsRes : []);
    const map: Record<string, string> = {};
    if (Array.isArray(campRes)) campRes.forEach((c: Campaign) => { map[c.id] = c.name; });
    setCampaigns(map);
    setAccounts(Array.isArray(acctRes) ? acctRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    await fetch(`/api/clips/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  };

  const approveAll = async () => {
    const ids = filtered.filter(c => c.status === "pending").map(c => c.id);
    if (!ids.length) return;
    setClips(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: "approved" } : c));
    await fetch("/api/clips", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, status: "approved" }) });
  };

  const filtered = clips.filter(c => filter === "all" || c.status === filter);
  const counts = {
    all: clips.length,
    pending: clips.filter(c => c.status === "pending").length,
    approved: clips.filter(c => c.status === "approved").length,
    discarded: clips.filter(c => c.status === "discarded").length,
  };

  // Group filtered clips by campaign
  const grouped: { campaignId: string; campaignName: string; clips: Clip[] }[] = [];
  const seen = new Set<string>();
  for (const clip of filtered) {
    if (!seen.has(clip.campaignId)) {
      seen.add(clip.campaignId);
      grouped.push({ campaignId: clip.campaignId, campaignName: campaigns[clip.campaignId] || "Unknown Campaign", clips: [] });
    }
    grouped.find(g => g.campaignId === clip.campaignId)!.clips.push(clip);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Clips</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {counts.all} clips · {counts.approved} approved · {counts.pending} pending
            {accounts.length > 0 && <> · <span className="text-green-600 font-medium">{accounts.map(a => a.platform).join(", ")} connected</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary py-2 px-3 gap-1.5 text-sm">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          {accounts.length === 0 && (
            <a href="/settings#social" className="btn-secondary py-2 px-3 gap-1.5 text-sm">Connect Social Accounts</a>
          )}
          {counts.pending > 0 && (
            <button onClick={approveAll} className="btn-primary py-2 px-4 gap-1.5 text-sm">
              <Check size={13} /> Approve All ({counts.pending})
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--surface-2)" }}>
        {(["all","pending","approved","discarded"] as FilterTab[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all"
            style={filter === f ? { background: "var(--surface)", color: "var(--chip)", boxShadow: "0 1px 3px rgba(15,30,60,0.1)" } : { color: "var(--text-muted)" }}>
            {f} <span className="ml-1 text-xs opacity-60">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Grouped by campaign */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-[var(--text-light)]">
          <Loader2 size={22} className="animate-spin mr-2" /> Loading clips...
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center mb-3">
            <Play size={24} className="text-[var(--accent)]" />
          </div>
          <p className="font-semibold text-[var(--text)]">{clips.length === 0 ? "No clips yet" : "No clips match this filter"}</p>
          <p className="text-sm text-[var(--text-light)] mt-1">{clips.length === 0 ? "Run the agent on a campaign to start generating clips." : "Try a different filter."}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(group => (
            <div key={group.campaignId}>
              {/* Campaign header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--border)" }}>
                  {group.campaignName}
                </span>
                <span className="text-xs text-[var(--text-light)]">{group.clips.length} clip{group.clips.length !== 1 ? "s" : ""}</span>
                <div className="h-px flex-1" style={{ background: "var(--border)" }} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {group.clips.map(clip => (
                  <ClipCard key={clip.id} clip={clip} campaigns={campaigns} accounts={accounts}
                    onPreview={() => setPreview(clip)} onStatus={updateStatus} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <PreviewModal clip={preview} clips={clips} campaigns={campaigns} accounts={accounts}
          onClose={() => setPreview(null)} onStatus={updateStatus} onNavigate={(c) => setPreview(c)} />
      )}
    </div>
  );
}
