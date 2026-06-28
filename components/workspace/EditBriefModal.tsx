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
        style={{ background: "#FFF", border: "1px solid #E2E8F0", boxShadow: "0 20px 50px rgba(15,30,60,0.18)", maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] flex-shrink-0">
          <div>
            <h3 className="font-bold text-[#0F1E3C] text-lg">Edit Brief</h3>
            <p className="text-xs text-[#64748B] mt-0.5">{c.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100">
            <X size={15} className="text-[#64748B]" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Campaign name */}
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1.5">CAMPAIGN NAME</label>
            <input value={name} onChange={e => setName(e.target.value)} className="glass-input" />
          </div>

          {/* Payout */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-[#64748B] block mb-1.5">CPM ($)</label>
              <input type="number" value={cpm} onChange={e => setCpm(e.target.value)} className="glass-input" placeholder="1.00" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#64748B] block mb-1.5">MAX / CLIP ($)</label>
              <input type="number" value={maxPerClip} onChange={e => setMaxPerClip(e.target.value)} className="glass-input" placeholder="250" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#64748B] block mb-1.5">MIN PAYOUT ($)</label>
              <input type="number" value={minPayout} onChange={e => setMinPayout(e.target.value)} className="glass-input" placeholder="1.00" />
            </div>
          </div>

          {/* Clip settings */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-[#64748B] block mb-1.5">CLIPS PER RUN</label>
              <input type="number" value={clipCount} onChange={e => setClipCount(e.target.value)} className="glass-input" placeholder="10" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#64748B] block mb-1.5">POST DURATION</label>
              <input value={postDuration} onChange={e => setPostDuration(e.target.value)} className="glass-input" placeholder="e.g. 30 days" />
            </div>
          </div>

          {/* Clip length — fully automatic */}
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-2">CLIP LENGTH</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: "#FFF5F5", border: "1px solid #FECACA", color: "#9B1C1C" }}>
              <span>✨</span>
              <span className="font-semibold">Auto</span>
              <span className="text-[#7F1D1D]">— the AI picks the best length for each clip (no limits to set).</span>
            </div>
          </div>

          {/* Auto subtitles toggle */}
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-2">AUTO SUBTITLES</label>
            <button type="button" onClick={() => setSubtitlesEnabled(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: subtitlesEnabled ? "#FFF5F5" : "#F1F5F9", border: `1px solid ${subtitlesEnabled ? "#FECACA" : "#E2E8F0"}` }}>
              <span className="text-left">
                <span className="font-semibold" style={{ color: subtitlesEnabled ? "#9B1C1C" : "#64748B" }}>
                  {subtitlesEnabled ? "On — add animated captions" : "Off — no captions added"}
                </span>
                <span className="block text-[11px] text-[#94A3B8] mt-0.5">Turn OFF if the source footage already has its own subtitles (avoids double captions).</span>
              </span>
              <span className="flex-shrink-0 w-11 h-6 rounded-full relative transition-all" style={{ background: subtitlesEnabled ? "#9B1C1C" : "#CBD5E1" }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: subtitlesEnabled ? "22px" : "2px" }} />
              </span>
            </button>
          </div>

          {/* Virality filter */}
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-2">CLIP QUALITY BAR</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "all",    label: "All clips",   desc: "Keep everything" },
                { v: "medium", label: "Good+",       desc: "Drop weak ones" },
                { v: "high",   label: "Only 🔥 high", desc: "Bankers only" },
              ] as const).map(opt => (
                <button key={opt.v} type="button" onClick={() => setMinVirality(opt.v)}
                  className="px-2 py-2.5 rounded-xl text-center transition-all"
                  style={minVirality === opt.v
                    ? { background: "#9B1C1C", color: "#fff", border: "1px solid #9B1C1C" }
                    : { background: "#fff", color: "#64748B", border: "1px solid #E2E8F0" }}>
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className="block text-[10px] mt-0.5 opacity-80">{opt.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-1.5">&ldquo;Only high&rdquo; produces fewer clips but every one is a strong, view-worthy moment.</p>
          </div>

          {/* Tight edit toggle */}
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-2">TIGHT EDIT (fast pacing)</label>
            <button type="button" onClick={() => setTightEdit(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: tightEdit ? "#FFF5F5" : "#F1F5F9", border: `1px solid ${tightEdit ? "#FECACA" : "#E2E8F0"}` }}>
              <span className="text-left">
                <span className="font-semibold" style={{ color: tightEdit ? "#9B1C1C" : "#64748B" }}>
                  {tightEdit ? "On — trim dead air for snappy pacing" : "Off — keep original pacing"}
                </span>
                <span className="block text-[11px] text-[#94A3B8] mt-0.5">Cuts silent pauses to boost retention. Safely skips music-heavy clips.</span>
              </span>
              <span className="flex-shrink-0 w-11 h-6 rounded-full relative transition-all" style={{ background: tightEdit ? "#9B1C1C" : "#CBD5E1" }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: tightEdit ? "22px" : "2px" }} />
              </span>
            </button>
          </div>

          {/* Platforms */}
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1.5">PLATFORMS (comma-separated)</label>
            <input value={platforms} onChange={e => setPlatforms(e.target.value)} className="glass-input" placeholder="tiktok,instagram,youtube" />
          </div>

          {/* Audience */}
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1.5">AUDIENCE REQUIREMENT</label>
            <input value={audienceReq} onChange={e => setAudienceReq(e.target.value)} className="glass-input" placeholder="e.g. 40%+ Tier 1 (US, UK, CA, AU)" />
          </div>

          {/* AI Instructions */}
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1.5">AI CLIP INSTRUCTIONS</label>
            <textarea value={aiInstructions} onChange={e => setAiInstructions(e.target.value)} rows={3}
              className="glass-input resize-none" placeholder="What moments should the AI look for?" />
          </div>

          {/* Content rules */}
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1.5">CONTENT RULES</label>
            <textarea value={contentRules} onChange={e => setContentRules(e.target.value)} rows={3}
              className="glass-input resize-none" placeholder="What content is allowed?" />
          </div>

          {/* Rejection reasons */}
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1.5">REJECTION REASONS</label>
            <textarea value={rejectionReasons} onChange={e => setRejectionReasons(e.target.value)} rows={2}
              className="glass-input resize-none" placeholder="What gets a clip rejected?" />
          </div>

          {/* Caption rules */}
          <div>
            <label className="text-xs font-bold text-[#64748B] block mb-1.5">CAPTION RULES</label>
            <textarea value={captionRules} onChange={e => setCaptionRules(e.target.value)} rows={2}
              className="glass-input resize-none" placeholder="Caption guidelines, required tags, hashtags..." />
          </div>

          {/* Extra context */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-xs font-bold text-[#64748B]">EXTRA CONTEXT</label>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#FFF5F5", color: "#9B1C1C", border: "1px solid #FECACA" }}>
                Optional
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8] mb-1.5">Paste anything — links, brand info, reference clips, notes, copy from the campaign page. The AI will use this as additional context when picking clips.</p>
            <textarea value={extraContext} onChange={e => setExtraContext(e.target.value)} rows={5}
              className="glass-input resize-none"
              placeholder={"Paste links, extra campaign details, notes, brand guidelines, reference clips...\n\nhttps://example.com/brief\nBrand voice: energetic, authentic, no hard sell..."} />
            {extraContext && (
              <p className="text-[10px] text-[#94A3B8] mt-1 flex items-center gap-1">
                <Link size={10} /> {extraContext.split("\n").filter(Boolean).length} line{extraContext.split("\n").filter(Boolean).length !== 1 ? "s" : ""} of context added
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-[#E2E8F0] flex-shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center gap-2">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
