"use client";

import { useState } from "react";
import { X, Copy, Check, ExternalLink } from "lucide-react";
import { WorkspaceClip } from "./WorkspaceClipCard";

interface Props {
  clip: WorkspaceClip;
  campaignName: string;
  submissionUrl?: string;
  platforms?: string[];
  tiktokHandle?: string;
  instagramHandle?: string;
  youtubeHandle?: string;
  postDuration?: string;
  onMarkPosted: () => void;
  onClose: () => void;
}

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: "🎵",
  instagram: "📸",
  youtube: "🎬",
};

function CaptionBox({
  platform, caption, handle,
}: {
  platform: string; caption: string; handle?: string;
}) {
  const [copied, setCopied] = useState(false);
  const fullCaption = handle ? `${caption}\n\n${handle}` : caption;

  return (
    <div className="border border-gray-100 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#111827] capitalize">
          {PLATFORM_ICONS[platform] || "📱"} {platform}
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(fullCaption);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 text-xs font-medium text-[#6B7280] hover:text-[#111827] border border-gray-200 rounded-lg px-2 py-1"
        >
          {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
          {copied ? "Copied!" : `Copy for ${platform}`}
        </button>
      </div>
      <p className="text-xs text-[#6B7280] leading-relaxed whitespace-pre-wrap">{fullCaption}</p>
    </div>
  );
}

interface CheckItem {
  label: string;
  auto: boolean;
}

export default function PostChecklistModal({
  clip, campaignName, submissionUrl, platforms = ["tiktok", "instagram"],
  tiktokHandle, instagramHandle, youtubeHandle, postDuration,
  onMarkPosted, onClose,
}: Props) {
  const platformHandles: Record<string, string | undefined> = {
    tiktok: tiktokHandle,
    instagram: instagramHandle,
    youtube: youtubeHandle,
  };

  const autoItems: CheckItem[] = [
    { label: "Clip is from approved source content", auto: true },
    { label: "Brand visible in clip", auto: true },
    { label: "Caption has no promotional language", auto: true },
    { label: `Correct account tagged (${tiktokHandle || instagramHandle || "your handle"})`, auto: true },
  ];

  const manualItems: CheckItem[] = [
    { label: `Posted to ${platforms.join(" & ")}`, auto: false },
    { label: "Likes count set to visible", auto: false },
    postDuration ? { label: `Post will stay live for ${postDuration}`, auto: false } : null,
    submissionUrl ? { label: "Submitted to campaign for payment", auto: false } : null,
  ].filter(Boolean) as CheckItem[];

  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const allManualChecked = manualItems.every((_, i) => checked[i]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0 bg-[#0F1E3C]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold text-white text-lg">Ready to Post</h2>
              <p className="text-white/60 text-xs mt-0.5 truncate">{campaignName} — {clip.title}</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white rounded-lg hover:bg-white/10">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Auto-checked items */}
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase mb-2">Auto-verified</p>
            <div className="space-y-2">
              {autoItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check size={11} className="text-green-600" />
                  </div>
                  <span className="text-sm text-[#111827]">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Manual checklist */}
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase mb-2">Before you submit</p>
            <div className="space-y-2">
              {manualItems.map((item, i) => (
                <label key={i} className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    onClick={() => setChecked((prev) => ({ ...prev, [i]: !prev[i] }))}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      checked[i] ? "bg-[#C0392B] border-[#C0392B]" : "border-gray-300 group-hover:border-[#C0392B]/50"
                    }`}
                  >
                    {checked[i] && <Check size={11} className="text-white" />}
                  </div>
                  <span className={`text-sm transition-colors ${checked[i] ? "text-[#6B7280] line-through" : "text-[#111827]"}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Captions */}
          {clip.caption && (
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase mb-2">Caption ready to copy</p>
              <div className="space-y-2">
                {platforms.filter((p) => ["tiktok", "instagram", "youtube"].includes(p)).map((p) => (
                  <CaptionBox
                    key={p}
                    platform={p}
                    caption={clip.caption || ""}
                    handle={platformHandles[p]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 space-y-2">
          <button
            onClick={onMarkPosted}
            disabled={!allManualChecked}
            className="w-full bg-[#C0392B] text-white font-bold py-3 rounded-xl hover:bg-[#a93226] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {allManualChecked ? "✅ Mark as Posted" : "Complete checklist above to continue"}
          </button>
          {submissionUrl && (
            <a
              href={submissionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 border border-gray-200 text-[#111827] font-semibold py-2.5 rounded-xl hover:bg-gray-50 text-sm"
            >
              <ExternalLink size={14} /> Submit for Payment
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
