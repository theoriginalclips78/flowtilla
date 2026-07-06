"use client";

import { useState } from "react";
import { X, Loader2, CheckCircle, AlertTriangle, Globe, FileText, Zap, Upload } from "lucide-react";
import { Campaign } from "@/store/campaignStore";
import { BriefData } from "@/lib/campaign/briefReader";

interface ReadResult {
  campaign: Campaign;
  briefData: BriefData;
  videoCount?: number;
  breakdown?: { platform: string; count: number }[];
}

interface Props {
  onAdd: (result: ReadResult, autoStart?: boolean) => void;
  onClose: () => void;
}

type Tab = "url" | "brief" | "quick";

const PLATFORM_ICONS: Record<string, string> = {
  youtube: "🎬",
  tiktok: "🎵",
  instagram: "📸",
  twitch: "🎮",
  kick: "⚡",
  twitter: "𝕏",
};

interface StepState {
  text: string;
  done: boolean;
  active: boolean;
}

export default function AddCampaignModal({ onAdd, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("brief");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [preview, setPreview] = useState<ReadResult | null>(null);
  const [error, setError] = useState("");
  const [loginWall, setLoginWall] = useState(false);

  // Upload a folder of downloaded footage → save on the server → local-footage campaign.
  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const vids = Array.from(fileList).filter(f => /\.(mp4|mov|webm|mkv|m4v)$/i.test(f.name));
    if (vids.length === 0) { setError("No video files found in that folder (need .mp4/.mov/.webm)."); return; }
    setLoading(true); setError(""); setPreview(null); setSteps([]);
    try {
      addStep(`⬆️ Uploading ${vids.length} video${vids.length !== 1 ? "s" : ""}...`);
      const fd = new FormData();
      vids.forEach(f => fd.append("files", f));
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error || "Upload failed");
      completeStep();
      addStep("📁 Creating campaign...");
      const res = await fetch("/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Uploaded Footage — ${new Date().toLocaleDateString()}`,
          cpm: 1, maxPerClip: 0, minPayout: 0, platforms: "tiktok,instagram,youtube",
          aiInstructions: "Clip the uploaded footage into short, punchy edits with a strong hook.",
          videoLayout: "letterbox",
          sources: [{ platform: "local", url: upData.path }],
        }),
      });
      const c = await res.json();
      if (!res.ok) throw new Error(c.error || "Failed to create campaign");
      completeStep();
      addStep(`✅ Ready — ${upData.count} clip${upData.count !== 1 ? "s" : ""} uploaded`);
      completeStep();
      setPreview({ campaign: c, briefData: {} as ReadResult["briefData"], videoCount: upData.count, breakdown: [] });
    } catch (e: unknown) {
      setError((e as Error).message);
    }
    setLoading(false);
  };

  // Quick add form
  const [quickBrand, setQuickBrand] = useState("");
  const [quickUrls, setQuickUrls] = useState("");
  const [quickInstructions, setQuickInstructions] = useState("");
  const [quickCpm, setQuickCpm] = useState("");
  const [quickPlatforms, setQuickPlatforms] = useState<string[]>(["tiktok", "instagram"]);

  function addStep(text: string) {
    setSteps((prev) => {
      const updated = prev.map((s) => ({ ...s, active: false, done: true }));
      return [...updated, { text, done: false, active: true }];
    });
  }

  function completeStep() {
    setSteps((prev) =>
      prev.map((s, i) => i === prev.length - 1 ? { ...s, active: false, done: true } : s)
    );
  }

  const handleRead = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setPreview(null);
    setLoginWall(false);
    setSteps([]);

    // Local folder / file path: user downloaded a campaign's provided footage. Skip the
    // brief scraper — create a local-footage campaign directly and clip those files.
    if (/^(~|\/)/.test(input.trim())) {
      try {
        addStep("📁 Adding local footage...");
        const res = await fetch("/api/campaigns", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Local Footage — ${new Date().toLocaleDateString()}`,
            cpm: 1, maxPerClip: 0, minPayout: 0, platforms: "tiktok,instagram,youtube",
            aiInstructions: "Clip the provided local footage into short, punchy edits with a strong hook.",
            videoLayout: "letterbox",
            sources: [{ platform: "local", url: input.trim() }],
          }),
        });
        const c = await res.json();
        if (!res.ok) throw new Error(c.error || "Failed to add local footage");
        completeStep();
        setPreview({ campaign: c, briefData: {} as ReadResult["briefData"], videoCount: 1, breakdown: [] });
      } catch (e: unknown) {
        setError((e as Error).message);
      }
      setLoading(false);
      return;
    }

    try {
      addStep("⏳ Reading campaign brief...");
      const body = tab === "url" ? { url: input.trim() } : { rawText: input.trim() };
      const res = await fetch("/api/brief/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 422 && data.loginWall) {
        setLoginWall(true);
        setLoading(false);
        setSteps([]);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to read campaign");
      completeStep();

      addStep("🤖 AI extracting campaign details...");
      await new Promise((r) => setTimeout(r, 200));
      completeStep();

      addStep("🔍 Scanning source URLs...");
      const srcRes = await fetch("/api/brief/findsources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: data.campaign.id }),
      });
      const srcData = await srcRes.json();
      completeStep();

      // Show per-platform steps
      const breakdown: { platform: string; count: number }[] = srcData.breakdown || [];
      for (const b of breakdown) {
        const icon = PLATFORM_ICONS[b.platform] || "📺";
        addStep(`${icon} Found ${b.count} videos from ${b.platform}`);
        await new Promise((r) => setTimeout(r, 150));
        completeStep();
      }

      const total = srcData.totalVideos || 0;
      addStep(`✅ Campaign ready — ${total} total videos found`);
      completeStep();

      setPreview({
        campaign: data.campaign,
        briefData: data.briefData,
        videoCount: total,
        breakdown,
      });
    } catch (e: unknown) {
      setError((e as Error).message || "Something went wrong");
      setSteps([]);
    }
    setLoading(false);
  };

  const handleQuickAdd = async () => {
    if (!quickBrand.trim()) return;
    setLoading(true);
    setError("");
    setSteps([]);

    // Local folder/file paths (downloaded campaign footage) can't survive the brief parser,
    // so if any are present, create the campaign directly with them as local sources.
    const lines = quickUrls.split("\n").map(s => s.trim()).filter(Boolean);
    const hasLocal = lines.some(l => /^(~|\/)/.test(l));
    if (hasLocal) {
      try {
        addStep("📁 Adding folder + instructions...");
        const sources = lines.map(l => /^(~|\/)/.test(l)
          ? { platform: "local", url: l }
          : { platform: "youtube", url: l });
        const res = await fetch("/api/campaigns", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: quickBrand,
            cpm: parseFloat(quickCpm) || 1,
            platforms: quickPlatforms.join(","),
            aiInstructions: quickInstructions || "Clip the provided footage into short, punchy edits with a strong hook.",
            videoLayout: "letterbox",
            sources,
          }),
        });
        const c = await res.json();
        if (!res.ok) throw new Error(c.error || "Failed to create campaign");
        completeStep();
        addStep(`✅ Ready — ${sources.length} source${sources.length !== 1 ? "s" : ""} added`);
        completeStep();
        setPreview({ campaign: c, briefData: {} as ReadResult["briefData"], videoCount: sources.length, breakdown: [] });
      } catch (e: unknown) {
        setError((e as Error).message);
      }
      setLoading(false);
      return;
    }

    const rawText = [
      `Brand: ${quickBrand}`,
      quickCpm ? `CPM: $${quickCpm} per 1000 views` : "",
      `Post to: ${quickPlatforms.join(", ")}`,
      quickUrls ? `Source URLs:\n${quickUrls}` : "",
      quickInstructions ? `What to look for:\n${quickInstructions}` : "",
    ].filter(Boolean).join("\n");

    try {
      addStep("⏳ Creating campaign...");
      const res = await fetch("/api/brief/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      completeStep();

      addStep("🔍 Finding source videos...");
      const srcRes = await fetch("/api/brief/findsources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: data.campaign.id }),
      });
      const srcData = await srcRes.json();
      completeStep();

      addStep(`✅ Ready — ${srcData.totalVideos || 0} videos found`);
      completeStep();

      setPreview({
        campaign: data.campaign,
        briefData: data.briefData,
        videoCount: srcData.totalVideos || 0,
        breakdown: srcData.breakdown || [],
      });
    } catch (e: unknown) {
      setError((e as Error).message);
    }
    setLoading(false);
  };

  const handleAdd = () => {
    if (!preview) return;
    onAdd(preview);
    onClose();
  };

  // One-shot: add the campaign AND immediately kick off clipping.
  const handleAddAndRun = () => {
    if (!preview) return;
    onAdd(preview, true);
    onClose();
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "url", label: "Paste URL", icon: <Globe size={14} /> },
    { id: "brief", label: "Paste Brief", icon: <FileText size={14} /> },
    { id: "quick", label: "Quick Add", icon: <Zap size={14} /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-xl text-[#111827]">Add Campaign</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-gray-100 hover:text-[#111827]">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setError(""); setLoginWall(false); setSteps([]); setPreview(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === t.id ? "border-[#C0392B] text-[#C0392B]" : "border-transparent text-[#6B7280] hover:text-[#111827]"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* URL Tab */}
          {tab === "url" && (
            <div className="space-y-3">
              {/* Upload folder — the easy path for "use only our footage" campaigns */}
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
                className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl px-4 py-6 text-center cursor-pointer hover:border-[#C0392B]/60 hover:bg-[#C0392B]/[0.03] transition-colors">
                <input
                  type="file" multiple className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                  {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                />
                <Upload size={22} className="text-[#C0392B] mb-2" />
                <div className="text-sm font-bold text-[#111827]">Upload a folder of clips</div>
                <div className="text-[11px] text-[#94A3B8] mt-1">Click to choose a downloaded folder (or drag files in) — it clips every video inside.</div>
              </label>

              <div className="flex items-center gap-3 text-[11px] text-[#94A3B8]">
                <div className="h-px bg-gray-200 flex-1" /> or paste a URL / path <div className="h-px bg-gray-200 flex-1" />
              </div>

              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleRead()}
                placeholder="Paste a campaign URL — or a local folder path (/Users/you/Downloads/footage)"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20 focus:border-[#C0392B]" />
              <button onClick={handleRead} disabled={loading || !input.trim()}
                className="w-full bg-[#C0392B] text-white font-bold py-3 rounded-xl hover:bg-[#a93226] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Read Campaign →
              </button>

              {loginWall && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">This page requires login</p>
                      <p className="text-xs text-amber-700 mt-0.5">Please copy the campaign brief text and paste it directly.</p>
                      <button onClick={() => { setTab("brief"); setLoginWall(false); setInput(""); }}
                        className="mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-900">
                        Switch to Paste Brief →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Brief Tab */}
          {tab === "brief" && (
            <div className="space-y-3">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={7}
                placeholder="Paste the full campaign brief here. Copy everything from the campaign page — the rules, source links, payout info, all of it. The AI will extract what it needs."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20 focus:border-[#C0392B] resize-none" />
              <button onClick={handleRead} disabled={loading || !input.trim()}
                className="w-full bg-[#C0392B] text-white font-bold py-3 rounded-xl hover:bg-[#a93226] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Parse Brief →
              </button>
            </div>
          )}

          {/* Quick Add Tab */}
          {tab === "quick" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] uppercase mb-1.5">Brand Name *</label>
                <input value={quickBrand} onChange={(e) => setQuickBrand(e.target.value)}
                  placeholder="e.g. YoungLA, Bang Energy, Ghost..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20 focus:border-[#C0392B]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] uppercase mb-1.5">Source URLs or local folder (one per line)</label>
                <textarea value={quickUrls} onChange={(e) => setQuickUrls(e.target.value)} rows={3}
                  placeholder={"https://www.youtube.com/@brand/videos\n— or a downloaded folder —\n/Users/ahmedsaciidabdullahi/Downloads/higgsfield"}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20 focus:border-[#C0392B] resize-none" />
                <p className="text-[11px] text-[#94A3B8] mt-1">Paste a <b>folder path</b> for &quot;use only our footage&quot; campaigns — it clips every video inside.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] uppercase mb-1.5">What makes a good clip?</label>
                <textarea value={quickInstructions} onChange={(e) => setQuickInstructions(e.target.value)} rows={2}
                  placeholder="Look for high-energy moments, product reveals, funny reactions, transformation moments..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20 focus:border-[#C0392B] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7280] uppercase mb-1.5">CPM (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm">$</span>
                    <input value={quickCpm} onChange={(e) => setQuickCpm(e.target.value)} type="number" step="0.01"
                      placeholder="1.00"
                      className="w-full border border-gray-200 rounded-xl pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20 focus:border-[#C0392B]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7280] uppercase mb-1.5">Post to</label>
                  <div className="flex flex-wrap gap-1.5">
                    {["tiktok", "instagram", "youtube"].map((p) => (
                      <button key={p} onClick={() => setQuickPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${quickPlatforms.includes(p) ? "bg-[#0F1E3C] text-white" : "border border-gray-200 text-[#6B7280] hover:border-[#0F1E3C]/30"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={handleQuickAdd} disabled={loading || !quickBrand.trim()}
                className="w-full bg-[#C0392B] text-white font-bold py-3 rounded-xl hover:bg-[#a93226] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={15} />}
                Add Campaign
              </button>
            </div>
          )}

          {/* Loading steps */}
          {steps.length > 0 && (
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm transition-all ${s.active || s.done ? "opacity-100" : "opacity-0"}`}>
                  {s.done ? (
                    <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                  ) : s.active ? (
                    <Loader2 size={15} className="animate-spin text-[#C0392B] flex-shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0" />
                  )}
                  <span className={s.done ? "text-[#6B7280]" : s.active ? "text-[#111827] font-medium" : "text-[#6B7280]"}>{s.text}</span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Campaign Preview Card */}
          {preview && !loading && (
            <div className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50">
              {/* Brand header */}
              <div className="bg-[#0F1E3C] px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C0392B] flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                  {(preview.campaign.name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{preview.campaign.name}</p>
                  <p className="text-xs text-white/60 capitalize">{preview.briefData?.campaignType || "campaign"}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {preview.campaign.cpm > 0 && (
                    <span className="text-xs bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full font-bold">${preview.campaign.cpm} CPM</span>
                  )}
                  {preview.campaign.maxPerClip > 0 && (
                    <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full font-bold">Max ${preview.campaign.maxPerClip}</span>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Sources breakdown */}
                <div>
                  <p className="text-xs font-semibold text-[#6B7280] uppercase mb-1.5">Sources Found</p>
                  <div className="flex flex-wrap gap-2">
                    {(preview.breakdown || []).map((b) => (
                      <span key={b.platform} className="flex items-center gap-1 text-xs bg-white border border-gray-200 px-2.5 py-1 rounded-full font-medium text-[#111827]">
                        {PLATFORM_ICONS[b.platform] || "📺"} {b.count} {b.platform}
                      </span>
                    ))}
                    {(preview.breakdown || []).length === 0 && (
                      <span className="text-xs text-[#6B7280]">{preview.videoCount || 0} videos found</span>
                    )}
                  </div>
                </div>

                {/* Requirements */}
                {preview.briefData?.requirements && preview.briefData.requirements.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#6B7280] uppercase mb-1.5">Requirements</p>
                    {preview.briefData.requirements.slice(0, 3).map((r, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-[#111827] mb-1">
                        <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span><span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rejection reasons */}
                {preview.briefData?.rejectionReasons && preview.briefData.rejectionReasons.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#6B7280] uppercase mb-1.5">Rejection Reasons</p>
                    {preview.briefData.rejectionReasons.slice(0, 2).map((r, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-[#6B7280] mb-1">
                        <span className="text-[#C0392B] mt-0.5 flex-shrink-0">✕</span><span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Instructions preview */}
                {preview.briefData?.aiInstructions && (
                  <div className="bg-white border border-gray-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-[#6B7280] uppercase mb-1">AI Instructions</p>
                    <p className="text-xs text-[#6B7280] italic line-clamp-2">{preview.briefData.aiInstructions}</p>
                  </div>
                )}

                <button onClick={handleAddAndRun}
                  className="btn-blue w-full justify-center !py-3 !text-base mt-2">
                  🚀 Create &amp; Start Clipping
                </button>
                <button onClick={handleAdd}
                  className="w-full text-[#6B7280] font-medium py-2 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Just add it — I&apos;ll run it later
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
