"use client";

import { CheckCircle, X } from "lucide-react";
import { BriefData } from "@/lib/campaign/briefReader";
import { Campaign } from "@/store/campaignStore";

interface Result {
  campaign: Campaign;
  briefData: BriefData;
  videoCount?: number;
}

interface Props {
  result: Result;
  onEdit: () => void;
  onQueue: () => void;
  onDismiss: () => void;
}

const platformIcons: Record<string, string> = {
  youtube: "🎬",
  tiktok: "🎵",
  instagram: "📸",
};

export default function CampaignPreviewCard({ result, onEdit, onQueue, onDismiss }: Props) {
  const { campaign, briefData, videoCount } = result;

  return (
    <div className="bg-white rounded-xl border-2 border-success/40 shadow-md p-4 mb-4 relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-[#6B7280] hover:text-[#111827]"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-2 mb-3">
        <CheckCircle size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-bold text-[18px] text-[#111827]">{campaign.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {briefData.cpm != null && (
              <span className="text-xs bg-green-500/10 text-green-600 font-semibold px-2 py-0.5 rounded-full">
                ${briefData.cpm} CPM
              </span>
            )}
            {briefData.maxPerClip != null && (
              <span className="text-xs bg-red-100 text-red-800 font-semibold px-2 py-0.5 rounded-full">
                Max ${briefData.maxPerClip}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Platforms */}
      {briefData.platforms && briefData.platforms.length > 0 && (
        <div className="flex gap-2 mb-3">
          {briefData.platforms.map((p) => (
            <span key={p} className="text-sm">
              {platformIcons[p] || "🌐"} {p.charAt(0).toUpperCase() + p.slice(1)}
            </span>
          ))}
        </div>
      )}

      {/* Source videos */}
      {videoCount != null && (
        <p className="text-sm text-[#6B7280] mb-3">
          🎞 Found <strong>{videoCount}</strong> videos from {campaign.name}
        </p>
      )}

      {/* Requirements preview */}
      {briefData.requirements && briefData.requirements.length > 0 && (
        <div className="mb-2">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase mb-1">Requirements</p>
          <ul className="space-y-0.5">
            {briefData.requirements.slice(0, 3).map((r, i) => (
              <li key={i} className="text-xs text-[#111827] flex items-start gap-1">
                <span className="text-green-600 mt-0.5">✓</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rejection reasons preview */}
      {briefData.rejectionReasons && briefData.rejectionReasons.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase mb-1">Avoid</p>
          <ul className="space-y-0.5">
            {briefData.rejectionReasons.slice(0, 3).map((r, i) => (
              <li key={i} className="text-xs text-[#111827] flex items-start gap-1">
                <span className="text-[#C0392B] mt-0.5">✕</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 border border-gray-200 text-[#6B7280] text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
        >
          Edit Details
        </button>
        <button
          onClick={onQueue}
          className="flex-1 bg-[#C0392B] text-white text-sm font-semibold py-2 rounded-lg hover:bg-[#C0392B]/90"
        >
          Save & Queue
        </button>
      </div>
    </div>
  );
}
