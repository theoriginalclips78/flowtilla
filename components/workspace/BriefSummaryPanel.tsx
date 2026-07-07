"use client";

import { useState } from "react";
import { RefreshCw, Plus } from "lucide-react";
import { Campaign } from "@/store/campaignStore";

interface Source {
  id: string;
  url: string;
  platform: string;
  processed?: boolean;
}

interface Props {
  campaign: Campaign;
  sources: Source[];
  processedSourceIds: Set<string>;
  onRescan: () => void;
}

const PlatformIcon = ({ platform }: { platform: string }) => {
  if (platform === "youtube") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--accent)] flex-shrink-0">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
  if (platform === "tiktok") return <span className="text-[11px] font-bold text-black">TT</span>;
  return <span className="text-[11px] font-bold text-pink-600">IG</span>;
};

export default function BriefSummaryPanel({ campaign, sources, processedSourceIds, onRescan }: Props) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [autoRun, setAutoRun] = useState(false);

  const contentRules: string[] = campaign.contentRules
    ? campaign.contentRules.split("\n").filter(Boolean)
    : [];
  const rejectionReasons: string[] = campaign.rejectionReasons
    ? campaign.rejectionReasons.split("\n").filter(Boolean)
    : [];

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-3 flex flex-col gap-3 text-sm">
      {/* Brief Summary */}
      <div>
        <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase mb-2">Brief Summary</p>
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-3 space-y-1.5">
          <Row label="CPM" value={`$${campaign.cpm}`} />
          <Row label="Max / clip" value={`$${campaign.maxPerClip}`} />
          <Row label="Min payout" value={campaign.minPayout ? `$${campaign.minPayout}` : "—"} />
          <Row label="Platforms" value={campaign.platforms || "—"} />
          <Row label="Post duration" value={campaign.postDuration || "—"} />
          <Row label="Min engagement" value={campaign.minimumEngagement || "—"} />
          <Row label="Audience" value={campaign.audienceRequirement || "—"} />
        </div>
      </div>

      {/* Content Rules */}
      {(contentRules.length > 0 || rejectionReasons.length > 0) && (
        <div>
          <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase mb-2">Content Rules</p>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-3 space-y-1">
            {contentRules.map((r, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <span className="text-green-600 mt-0.5">✓</span>
                <span className="text-[var(--text)]">{r}</span>
              </div>
            ))}
            {rejectionReasons.map((r, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <span className="text-[var(--accent)] mt-0.5">✕</span>
                <span className="text-[var(--text-muted)]">{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source Videos */}
      <div>
        <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase mb-2">
          Source Videos
          <span className="ml-1 font-normal normal-case text-[var(--text-muted)]">({sources.length} available)</span>
        </p>
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="max-h-48 overflow-y-auto divide-y divide-border/50">
            {sources.map((src) => {
              const done = processedSourceIds.has(src.id);
              const label = src.url.split("/").pop()?.slice(0, 30) || src.url;
              return (
                <div key={src.id} className="flex items-center gap-2 px-3 py-2">
                  <PlatformIcon platform={src.platform} />
                  <span className="flex-1 text-xs text-[var(--text)] truncate">{label}</span>
                  {done ? (
                    <span className="text-green-600 text-[10px] font-medium flex-shrink-0">✅</span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                  )}
                </div>
              );
            })}
            {sources.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">No sources yet</p>
            )}
          </div>
          <div className="flex gap-2 p-2 border-t border-[var(--border)]">
            <button className="flex-1 flex items-center justify-center gap-1 text-xs border border-[var(--border)] rounded-lg py-1.5 text-[var(--text-muted)] hover:bg-gray-50">
              <Plus size={11} /> Add Sources
            </button>
            <button
              onClick={onRescan}
              className="flex-1 flex items-center justify-center gap-1 text-xs border border-[var(--border)] rounded-lg py-1.5 text-[var(--text-muted)] hover:bg-gray-50"
            >
              <RefreshCw size={11} /> Re-scan
            </button>
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div>
        <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase mb-2">Schedule</p>
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--text)]">Auto-run</span>
            <button
              onClick={() => setAutoRun(!autoRun)}
              className={`w-9 h-5 rounded-full transition-colors relative ${autoRun ? "bg-[var(--accent)]" : "bg-gray-200"}`}
            >
              <div className={`w-3.5 h-3.5 bg-[var(--surface)] rounded-full absolute top-0.5 shadow transition-all ${autoRun ? "left-[19px]" : "left-0.5"}`} />
            </button>
          </div>
          {autoRun && (
            <div>
              <select className="w-full text-xs border border-[var(--border)] rounded-lg px-2 py-1.5 mb-1.5" onClick={() => setShowSchedule(true)}>
                <option>Daily</option>
                <option>Every 12 hours</option>
                <option>Every 6 hours</option>
                <option>Weekly</option>
              </select>
              <p className="text-[11px] text-[var(--text-muted)]">Next run: in 24 hours</p>
            </div>
          )}
          {showSchedule && null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-medium text-[var(--text)]">{value}</span>
    </div>
  );
}
