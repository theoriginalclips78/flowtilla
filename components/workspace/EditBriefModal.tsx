"use client";

import { useState } from "react";
import { X, Loader2, Save, Link } from "lucide-react";
import { Campaign } from "@/store/campaignStore";

type CampaignExt = Campaign & { clipLengthMin?: number; clipLengthMax?: number; extraContext?: string; captionRules?: string; subtitlesEnabled?: boolean };

interface Props {
  campaign: Campaign;
  onSave: (updated: Campaign) => void;
  onClose: () => void;
}

export default function EditBriefModal({ campaign, onSave, onClose }: Props) {
  const c = campaign as CampaignExt;
  const [name, setName]                     = useState(c.name);
  const [cpm, setCpm]                       = useState(String(c.cpm));
  const [maxPerClip, setMaxPerClip]         = useState(String(c.maxPerClip));
  const [minPayout, setMinPayout]           = useState(String(c.minPayout));
  const [platforms, setPlatforms]           = useState(c.platforms || "tiktok,instagram,youtube");
  const [aiInstructions, setAiInstructions] = useState(c.aiInstructions || "");
  const [contentRules, setContentRules]     = useState(c.contentRules || "");
  const [rejectionReasons, setRejectionReasons] = useState(c.rejectionReasons || "");
  const [captionRules, setCaptionRules]     = useState(c.captionRules || "");
  const [clipCount, setClipCount]           = useState(String(c.clipCount));
  const [audienceReq, setAudienceReq]       = useState(c.audienceRequirement || "");
  const [postDuration, setPostDuration]     = useState(c.postDuration || "");
  const [extraContext, setExtraContext]     = useState(c.extraContext || "");
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(c.subtitlesEnabled !== false);
  const [minVirality, setMinVirality]       = useState((c as CampaignExt & { minVirality?: string }).minVirality || "medium");
  const [tightEdit, setTightEdit]           = useState((c as CampaignExt & { tightEdit?: boolean }).tightEdit !== false);
  const [videoLayout, setVideoLayout]       = useState((c as CampaignExt & { videoLayout?: string }).videoLayout || "letterbox");
  const [captionMode, setCaptionMode]       = useState((c as CampaignExt & { captionMode?: string }).captionMode || "lines");
  const [captionPosition, setCaptionPosition] = useState((c as CampaignExt & { captionPosition?: string }).captionPosition || "auto");
  const [watermarkText, setWatermarkText]   = useState((c as CampaignExt & { watermarkText?: string }).watermarkText || "");
  const [bottomBanner, setBottomBanner]     = useState((c as CampaignExt & { bottomBanner?: string }).bottomBanner || "");
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        name,
        cpm: parseFloat(cpm) || 0,
        maxPerClip: parseFloat(maxPerClip) || 0,
        minPayout: parseFloat(minPayout) || 0,
        platforms, aiInstructions, contentRules,
        rejectionReasons, captionRules,
        clipCount: parseInt(clipCount) || 10,
        // Length is fully automatic now — wide bounds so the AI picks freely.
        clipLength: 30,
        clipLengthMin: 0,
        clipLengthMax: 0,
        audienceRequirement: audienceReq,
        postDuration,
        extraContext,
        subtitlesEnabled,
        minVirality,
        tightEdit,
        videoLayout,
        captionMode,
        captionPosition,
        watermarkText,
        bottomBanner,
      };
      const res = await fetch(`/api/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      const updated = await res.json();
      onSave(updated);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl mx-4 rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 20px 50px rgba(15,30,60,0.18)", maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div>
            <h3 className="font-bold text-[var(--text)] text-lg">Edit Brief</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{c.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100">
            <X size={15} className="text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Campaign name */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">CAMPAIGN NAME</label>
            <input value={name} onChange={e => setName(e.target.value)} className="glass-input" />
          </div>

          {/* Payout */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">CPM ($)</label>
              <input type="number" value={cpm} onChange={e => setCpm(e.target.value)} className="glass-input" placeholder="1.00" />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">MAX / CLIP ($)</label>
              <input type="number" value={maxPerClip} onChange={e => setMaxPerClip(e.target.value)} className="glass-input" placeholder="250" />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">MIN PAYOUT ($)</label>
              <input type="number" value={minPayout} onChange={e => setMinPayout(e.target.value)} className="glass-input" placeholder="1.00" />
            </div>
          </div>

          {/* Clip settings */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">CLIPS PER RUN</label>
              <input type="number" value={clipCount} onChange={e => setClipCount(e.target.value)} className="glass-input" placeholder="10" />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">POST DURATION</label>
              <input value={postDuration} onChange={e => setPostDuration(e.target.value)} className="glass-input" placeholder="e.g. 30 days" />
            </div>
          </div>

          {/* Clip length — fully automatic */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-2">CLIP LENGTH</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: "#EEF1F7", border: "1px solid #C9D3E6", color: "#22304F" }}>
              <span>✨</span>
              <span className="font-semibold">Auto</span>
              <span className="text-[#1A2540]">— the AI picks the best length for each clip (no limits to set).</span>
            </div>
          </div>

          {/* Auto subtitles toggle */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-2">AUTO SUBTITLES</label>
            <button type="button" onClick={() => setSubtitlesEnabled(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: subtitlesEnabled ? "#EEF1F7" : "#F1F5F9", border: `1px solid ${subtitlesEnabled ? "#C9D3E6" : "var(--border)"}` }}>
              <span className="text-left">
                <span className="font-semibold" style={{ color: subtitlesEnabled ? "#22304F" : "var(--text-muted)" }}>
                  {subtitlesEnabled ? "On — add animated captions" : "Off — no captions added"}
                </span>
                <span className="block text-[11px] text-[var(--text-light)] mt-0.5">Turn OFF if the source footage already has its own subtitles (avoids double captions).</span>
              </span>
              <span className="flex-shrink-0 w-11 h-6 rounded-full relative transition-all" style={{ background: subtitlesEnabled ? "#22304F" : "#CBD5E1" }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-[var(--surface)] transition-all" style={{ left: subtitlesEnabled ? "22px" : "2px" }} />
              </span>
            </button>
          </div>

          {/* Virality filter */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-2">CLIP QUALITY BAR</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "all",    label: "All clips",   desc: "Keep everything" },
                { v: "medium", label: "Good+",       desc: "Drop weak ones" },
                { v: "high",   label: "Only 🔥 high", desc: "Bankers only" },
              ] as const).map(opt => (
                <button key={opt.v} type="button" onClick={() => setMinVirality(opt.v)}
                  className="px-2 py-2.5 rounded-xl text-center transition-all"
                  style={minVirality === opt.v
                    ? { background: "#22304F", color: "var(--surface)", border: "1px solid #22304F" }
                    : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className="block text-[10px] mt-0.5 opacity-80">{opt.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-light)] mt-1.5">&ldquo;Only high&rdquo; produces fewer clips but every one is a strong, view-worthy moment.</p>
          </div>

          {/* ── Section: how the clips LOOK ── */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-[11px] font-extrabold tracking-wider text-[#22304F]">🎬 LOOK &amp; STYLE</span>
            <span className="flex-1 h-px" style={{ background: "linear-gradient(to right, #C9D3E6, transparent)" }} />
          </div>

          {/* Frame layout */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-2">FRAME LAYOUT</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: "letterbox", label: "Letterbox", desc: "Clean black bars + title card" },
                { v: "blur",  label: "Blur fill", desc: "Whole frame, premium" },
                { v: "crop",  label: "Reframe",   desc: "Zoom + motion" },
                { v: "split", label: "Gameplay",  desc: "Clip + game below" },
              ] as const).map(opt => (
                <button key={opt.v} type="button" onClick={() => setVideoLayout(opt.v)}
                  className="px-2 py-2.5 rounded-xl text-center transition-all"
                  style={videoLayout === opt.v
                    ? { background: "#22304F", color: "var(--surface)", border: "1px solid #22304F" }
                    : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className="block text-[10px] mt-0.5 opacity-80">{opt.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-light)] mt-1.5">
              {videoLayout === "split"
                ? "Needs a gameplay.mp4 in your Downloads folder — falls back to Blur fill if missing."
                : videoLayout === "letterbox"
                ? "Best for streams & screen-recordings — clean black bars, persistent title card up top."
                : videoLayout === "blur"
                ? "Best for low-res or horizontal footage — no cropped faces, no black bars."
                : "Punch-in reframe with a slow Ken Burns motion."}
            </p>
          </div>

          {/* Caption mode */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-2">CAPTION STYLE</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: "lines", label: "Lines",    desc: "A few words at a time" },
                { v: "word",  label: "One Word", desc: "Karaoke, one word" },
              ] as const).map(opt => (
                <button key={opt.v} type="button" onClick={() => setCaptionMode(opt.v)}
                  className="px-2 py-2.5 rounded-xl text-center transition-all"
                  style={captionMode === opt.v
                    ? { background: "#22304F", color: "var(--surface)", border: "1px solid #22304F" }
                    : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className="block text-[10px] mt-0.5 opacity-80">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Caption position */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-2">CAPTION POSITION</label>
            <div className="grid grid-cols-4 gap-2">
              {([
                { v: "auto",   label: "Auto",   desc: "Best per layout" },
                { v: "top",    label: "Top",    desc: "Upper third" },
                { v: "middle", label: "Middle", desc: "Centered" },
                { v: "bottom", label: "Bottom", desc: "Lower third" },
              ] as const).map(opt => (
                <button key={opt.v} type="button" onClick={() => setCaptionPosition(opt.v)}
                  className="px-2 py-2.5 rounded-xl text-center transition-all"
                  style={captionPosition === opt.v
                    ? { background: "#22304F", color: "var(--surface)", border: "1px solid #22304F" }
                    : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className="block text-[10px] mt-0.5 opacity-80">{opt.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-light)] mt-1.5">Auto sits captions in the middle for Blur fill and lower-third for Reframe/Gameplay.</p>
          </div>

          {/* Watermark */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-2">WATERMARK HANDLE</label>
            <input
              type="text"
              value={watermarkText}
              onChange={e => setWatermarkText(e.target.value)}
              placeholder="@yourhandle (leave blank for none)"
              className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
            />
            <p className="text-[11px] text-[var(--text-light)] mt-1.5">Stamped small at the bottom of every clip — brands it and deters reposters.</p>
          </div>

          {/* Bottom brand banner */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-2">BOTTOM BRAND BANNER</label>
            <input
              type="text"
              value={bottomBanner}
              onChange={e => setBottomBanner(e.target.value)}
              placeholder="e.g. SEEDANCE 2.0 ON HIGGSFIELD (leave blank for none)"
              className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
            />
            <p className="text-[11px] text-[var(--text-light)] mt-1.5">Big persistent CTA banner pinned to the bottom — the <b>last word turns lime green</b>. This is the format the top-performing branded clips use.</p>
          </div>

          {/* Tight edit toggle */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-2">TIGHT EDIT (fast pacing)</label>
            <button type="button" onClick={() => setTightEdit(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: tightEdit ? "#EEF1F7" : "#F1F5F9", border: `1px solid ${tightEdit ? "#C9D3E6" : "var(--border)"}` }}>
              <span className="text-left">
                <span className="font-semibold" style={{ color: tightEdit ? "#22304F" : "var(--text-muted)" }}>
                  {tightEdit ? "On — trim dead air for snappy pacing" : "Off — keep original pacing"}
                </span>
                <span className="block text-[11px] text-[var(--text-light)] mt-0.5">Cuts silent pauses to boost retention. Safely skips music-heavy clips.</span>
              </span>
              <span className="flex-shrink-0 w-11 h-6 rounded-full relative transition-all" style={{ background: tightEdit ? "#22304F" : "#CBD5E1" }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-[var(--surface)] transition-all" style={{ left: tightEdit ? "22px" : "2px" }} />
              </span>
            </button>
          </div>

          {/* Platforms */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">PLATFORMS (comma-separated)</label>
            <input value={platforms} onChange={e => setPlatforms(e.target.value)} className="glass-input" placeholder="tiktok,instagram,youtube" />
          </div>

          {/* Audience */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">AUDIENCE REQUIREMENT</label>
            <input value={audienceReq} onChange={e => setAudienceReq(e.target.value)} className="glass-input" placeholder="e.g. 40%+ Tier 1 (US, UK, CA, AU)" />
          </div>

          {/* AI Instructions */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">AI CLIP INSTRUCTIONS</label>
            <textarea value={aiInstructions} onChange={e => setAiInstructions(e.target.value)} rows={3}
              className="glass-input resize-none" placeholder="What moments should the AI look for?" />
          </div>

          {/* Content rules */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">CONTENT RULES</label>
            <textarea value={contentRules} onChange={e => setContentRules(e.target.value)} rows={3}
              className="glass-input resize-none" placeholder="What content is allowed?" />
          </div>

          {/* Rejection reasons */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">REJECTION REASONS</label>
            <textarea value={rejectionReasons} onChange={e => setRejectionReasons(e.target.value)} rows={2}
              className="glass-input resize-none" placeholder="What gets a clip rejected?" />
          </div>

          {/* Caption rules */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">CAPTION RULES</label>
            <textarea value={captionRules} onChange={e => setCaptionRules(e.target.value)} rows={2}
              className="glass-input resize-none" placeholder="Caption guidelines, required tags, hashtags..." />
          </div>

          {/* Extra context */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-xs font-bold text-[var(--text-muted)]">EXTRA CONTEXT</label>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#EEF1F7", color: "#22304F", border: "1px solid #C9D3E6" }}>
                Optional
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-light)] mb-1.5">Paste anything — links, brand info, reference clips, notes, copy from the campaign page. The AI will use this as additional context when picking clips.</p>
            <textarea value={extraContext} onChange={e => setExtraContext(e.target.value)} rows={5}
              className="glass-input resize-none"
              placeholder={"Paste links, extra campaign details, notes, brand guidelines, reference clips...\n\nhttps://example.com/brief\nBrand voice: energetic, authentic, no hard sell..."} />
            {extraContext && (
              <p className="text-[10px] text-[var(--text-light)] mt-1 flex items-center gap-1">
                <Link size={10} /> {extraContext.split("\n").filter(Boolean).length} line{extraContext.split("\n").filter(Boolean).length !== 1 ? "s" : ""} of context added
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-[var(--border)] flex-shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center gap-2">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
