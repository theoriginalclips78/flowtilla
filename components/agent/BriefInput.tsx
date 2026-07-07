"use client";

import { useState } from "react";
import { Loader2, ArrowRight, Link2, FileText } from "lucide-react";
import { toast } from "sonner";
import { BriefData } from "@/lib/campaign/briefReader";
import { Campaign } from "@/store/campaignStore";

interface Result {
  campaign: Campaign;
  briefData: BriefData;
  videoCount?: number;
}

interface Props {
  onCampaignReady: (result: Result) => void;
}

const STEPS_URL = [
  "Opening campaign page...",
  "Reading brief...",
  "Extracting with AI...",
  "Finding source videos...",
  "Campaign ready ✅",
];

const STEPS_TEXT = [
  "Parsing brief text...",
  "Extracting with AI...",
  "Finding source videos...",
  "Campaign ready ✅",
];

export default function BriefInput({ onCampaignReady }: Props) {
  const [tab, setTab] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = tab === "url" ? STEPS_URL : STEPS_TEXT;

  const advance = (i: number) => setStepIndex(i);

  const run = async () => {
    if (tab === "url" && !url.trim()) return;
    if (tab === "text" && !rawText.trim()) return;
    setLoading(true);
    setStepIndex(0);

    try {
      if (tab === "url") advance(1);
      advance(tab === "url" ? 2 : 1);

      const res = await fetch("/api/brief/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tab === "url" ? { url } : { rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      advance(tab === "url" ? 3 : 2);

      // Find source videos
      const srcRes = await fetch("/api/brief/findsources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: data.campaign.id }),
      });
      const srcData = await srcRes.json();

      advance(steps.length - 1);

      setTimeout(() => {
        onCampaignReady({
          campaign: data.campaign,
          briefData: data.briefData,
          videoCount: srcData.count || 0,
        });
        setLoading(false);
        setUrl("");
        setRawText("");
        setStepIndex(0);
      }, 600);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to read brief");
      setLoading(false);
      setStepIndex(0);
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm p-4 mb-4">
      <h3 className="font-bold text-[16px] text-[var(--text)] mb-3">Add New Campaign</h3>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-[var(--surface-2)] rounded-lg p-1 mb-3">
        {(["url", "text"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-[var(--surface)] shadow text-[var(--text)]" : "text-[var(--text-muted)]"
            }`}
          >
            {t === "url" ? <Link2 size={14} /> : <FileText size={14} />}
            {t === "url" ? "Paste URL" : "Paste Brief"}
          </button>
        ))}
      </div>

      {/* Input */}
      {tab === "url" ? (
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          placeholder="Paste any campaign URL from ClipFarm, ContentRewards, Whop..."
          className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 mb-3 disabled:opacity-50"
        />
      ) : (
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          disabled={loading}
          rows={8}
          placeholder="Paste the full campaign brief text here..."
          className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 mb-3 resize-none disabled:opacity-50"
        />
      )}

      {/* Loading status */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-3 px-1">
          <Loader2 size={14} className="animate-spin text-[var(--accent)] flex-shrink-0" />
          <span>{steps[stepIndex]}</span>
        </div>
      )}

      <button
        onClick={run}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-white font-semibold py-2.5 rounded-lg hover:bg-[var(--accent)]/90 disabled:opacity-60 transition-colors"
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin" /> Processing...</>
        ) : (
          <>{tab === "url" ? "Read Campaign" : "Parse Brief"} <ArrowRight size={16} /></>
        )}
      </button>
    </div>
  );
}
