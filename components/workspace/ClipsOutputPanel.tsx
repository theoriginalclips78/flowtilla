"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import WorkspaceClipCard, { WorkspaceClip } from "./WorkspaceClipCard";

type FilterType = "all" | "pending" | "approved" | "discarded";
type SortType = "virality" | "newest" | "source";

interface Props {
  clips: WorkspaceClip[];
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
  onPreview: (clip: WorkspaceClip) => void;
}

const viralOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function ClipsOutputPanel({ clips, onApprove, onDiscard, onPreview }: Props) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("virality");
  const [page, setPage] = useState(20);

  const filtered = clips
    .filter((c) => filter === "all" || c.status === filter)
    .sort((a, b) => {
      if (sort === "virality") return (viralOrder[a.viralityScore] ?? 3) - (viralOrder[b.viralityScore] ?? 3);
      if (sort === "source") return (a.sourceTitle || "").localeCompare(b.sourceTitle || "");
      return 0; // newest — clips arrive in append order
    });

  const approved = clips.filter((c) => c.status === "approved").length;
  const pending   = clips.filter((c) => c.status === "pending").length;
  const discarded = clips.filter((c) => c.status === "discarded").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#111827]">Clips</span>
            <span className="text-[11px] bg-gray-100 text-[#6B7280] px-2 py-0.5 rounded-full">
              {clips.length}
            </span>
          </div>
          {clips.length > 0 && (
            <button className="flex items-center gap-1 text-xs border border-gray-200 px-2 py-1 rounded-lg text-[#6B7280] hover:bg-gray-50">
              <Download size={11} /> All
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-1 mb-2">
          {(["all", "pending", "approved", "discarded"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${
                filter === f ? "bg-[#0F1E3C] text-white" : "bg-gray-100 text-[#6B7280] hover:bg-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortType)}
          className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 text-[#6B7280]"
        >
          <option value="virality">Sort: Virality</option>
          <option value="newest">Sort: Newest</option>
          <option value="source">Sort: Source</option>
        </select>
      </div>

      {/* Clips list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ minHeight: 0 }}>
        {filtered.length === 0 && (
          <p className="text-sm text-[#6B7280] text-center py-8">
            {clips.length === 0 ? "Clips will appear here as the agent runs." : "No clips match this filter."}
          </p>
        )}
        {filtered.slice(0, page).map((clip) => (
          <WorkspaceClipCard
            key={clip.id}
            clip={clip}
            onApprove={onApprove}
            onDiscard={onDiscard}
            onPreview={onPreview}
          />
        ))}
        {filtered.length > page && (
          <button
            onClick={() => setPage((p) => p + 20)}
            className="w-full border border-gray-200 text-[#6B7280] text-sm py-2 rounded-xl hover:bg-gray-50"
          >
            Load More ({filtered.length - page} remaining)
          </button>
        )}
      </div>

      {/* Stats footer */}
      {clips.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 bg-white flex-shrink-0">
          <p className="text-[11px] text-[#6B7280]">
            <span className="text-green-600 font-medium">{approved} approved</span>
            {" · "}
            <span>{pending} pending</span>
            {" · "}
            <span className="text-[#C0392B]">{discarded} discarded</span>
          </p>
        </div>
      )}
    </div>
  );
}
