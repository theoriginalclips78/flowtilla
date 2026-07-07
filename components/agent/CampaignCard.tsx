"use client";

import { MoreHorizontal, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Campaign } from "@/store/campaignStore";
import { formatDistanceToNow } from "date-fns";

interface Props {
  campaign: Campaign;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPause: () => void;
}

const statusConfig = {
  active: { label: "Active", className: "bg-green-500/10 text-green-600" },
  paused: { label: "Paused", className: "bg-gray-100 text-[var(--text-muted)]" },
  running: { label: "Running", className: "bg-[var(--accent)]/10 text-[var(--accent)] animate-pulse" },
};

const platformIcons: Record<string, React.ReactNode> = {
  youtube: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--accent)]">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  tiktok: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-black">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.74a8.19 8.19 0 0 0 4.78 1.52V6.79a4.85 4.85 0 0 1-1.01-.1z" />
    </svg>
  ),
  instagram: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-pink-500">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
};

export default function CampaignCard({ campaign, isActive, onSelect, onEdit, onDelete, onPause }: Props) {
  const status = campaign.status as keyof typeof statusConfig;
  const cfg = statusConfig[status] || statusConfig.active;

  return (
    <div
      onClick={onSelect}
      className={`bg-[var(--surface)] rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
        isActive ? "border-[var(--accent)] shadow-sm" : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-[var(--text)] text-[16px]">{campaign.name}</h3>
          <Badge className={`${cfg.className} text-[11px] px-2 py-0.5 mt-1 border-0`}>
            {cfg.label}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-gray-100"
          >
            <MoreHorizontal size={16} className="text-[var(--text-muted)]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPause(); }}>
              {campaign.status === "paused" ? "Resume" : "Pause"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-[var(--accent)] focus:text-[var(--accent)]"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="text-[12px] text-[var(--text-muted)] mb-3">
        <span>${campaign.cpm} CPM</span>
        <span className="mx-2">·</span>
        <span>Max ${campaign.maxPerClip}/clip</span>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        {campaign.sources.map((s) => (
          <span key={s.id}>{platformIcons[s.platform] || null}</span>
        ))}
      </div>

      <div className="flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
        <Clock size={12} />
        <span>Last run {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}</span>
      </div>
    </div>
  );
}
