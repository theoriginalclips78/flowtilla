"use client";

import { X, Play, Loader2, CheckCircle } from "lucide-react";
import { Campaign } from "@/store/campaignStore";

interface QueueItem {
  campaign: Campaign;
  videoCount: number;
  status: "queued" | "running" | "complete";
}

interface Props {
  queue: QueueItem[];
  onRemove: (id: string) => void;
  onRun: (id: string) => void;
  onRunAll: () => void;
}

const statusConfig = {
  queued: { label: "Queued", className: "bg-gray-100 text-[#6B7280]" },
  running: { label: "Running", className: "bg-red-100 text-red-800 animate-pulse" },
  complete: { label: "Complete", className: "bg-green-500/10 text-green-600" },
};

const platformIcons: Record<string, React.ReactNode> = {
  youtube: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#C0392B]">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  tiktok: <span className="text-xs">TT</span>,
  instagram: <span className="text-xs">IG</span>,
};

export default function CampaignQueue({ queue, onRemove, onRun, onRunAll }: Props) {
  if (queue.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-[16px] text-[#111827]">
          Campaign Queue
          <span className="ml-2 text-xs bg-gray-200 text-[#6B7280] px-2 py-0.5 rounded-full font-normal">
            {queue.length}
          </span>
        </h3>
      </div>

      {queue.map(({ campaign, videoCount, status }) => {
        const cfg = statusConfig[status];
        const uniquePlatforms = Array.from(new Set(campaign.sources.map((s) => s.platform)));
        return (
          <div key={campaign.id} className="bg-white rounded-xl border border-gray-200 p-3 relative">
            <button
              onClick={() => onRemove(campaign.id)}
              className="absolute top-2 right-2 text-[#6B7280] hover:text-[#111827]"
            >
              <X size={14} />
            </button>

            <div className="flex items-start gap-2 mb-2 pr-5">
              <div className="flex-1">
                <p className="font-semibold text-[14px] text-[#111827]">{campaign.name}</p>
                <div className="flex gap-1 mt-1">
                  {uniquePlatforms.map((p) => (
                    <span key={p}>{platformIcons[p]}</span>
                  ))}
                </div>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>
                {cfg.label}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-[#6B7280] mb-2">
              <span>${campaign.cpm} CPM · Max ${campaign.maxPerClip}</span>
              <span>{videoCount} videos ready</span>
            </div>

            <button
              onClick={() => onRun(campaign.id)}
              disabled={status === "running"}
              className="w-full flex items-center justify-center gap-1.5 bg-[#C0392B] text-white text-sm font-medium py-1.5 rounded-lg hover:bg-[#C0392B]/90 disabled:opacity-60"
            >
              {status === "running" ? (
                <><Loader2 size={13} className="animate-spin" /> Running...</>
              ) : status === "complete" ? (
                <><CheckCircle size={13} /> Done</>
              ) : (
                <><Play size={13} /> Run Now</>
              )}
            </button>
          </div>
        );
      })}

      <button
        onClick={onRunAll}
        className="w-full bg-[#C0392B] text-white font-bold py-3 rounded-xl hover:bg-[#C0392B]/90 mt-1 flex items-center justify-center gap-2"
      >
        <Play size={16} fill="white" /> Run All Campaigns
      </button>
    </div>
  );
}
