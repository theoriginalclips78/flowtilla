"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronDown, ChevronUp, Play, CheckCircle, MoreHorizontal, Zap, Trash2, Pause, Image as ImageIcon } from "lucide-react";
import { Campaign } from "@/store/campaignStore";
import { toast } from "sonner";
import AgentLogPanel, { LogLine } from "./AgentLogPanel";
import BriefSummaryPanel from "./BriefSummaryPanel";
import ClipsOutputPanel from "./ClipsOutputPanel";
import { WorkspaceClip } from "./WorkspaceClipCard";
import PostChecklistModal from "./PostChecklistModal";
import ClipPreviewModal from "./ClipPreviewModal";
import EditBriefModal from "./EditBriefModal";

type AgentStatus = "idle" | "running" | "complete" | "error";

interface Source {
  id: string;
  url: string;
  platform: string;
}

interface Props {
  campaign: Campaign;
  sources: Source[];
  index?: number;
  onRemove: (id: string) => void;
  onUpdate?: (updated: Campaign) => void;
}

const PlatformIcon = ({ platform, size = 18 }: { platform: string; size?: number }) => {
  if (platform === "youtube") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-[#C0392B]">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
  if (platform === "tiktok") return <span className="text-xs font-bold text-black">TT</span>;
  return <span className="text-xs font-bold text-pink-600">IG</span>;
};

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

export default function CampaignWorkspaceCard({ campaign, sources, onRemove, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [clips, setClips] = useState<WorkspaceClip[]>([]);
  const [totalClips, setTotalClips] = useState(0);
  const [sourcesProcessed, setSourcesProcessed] = useState(0);
  const [currentClipInSource, setCurrentClipInSource] = useState(0);
  const [clipsInCurrentSource, setClipsInCurrentSource] = useState(0);
  const [processedSourceIds] = useState(new Set<string>());
  const [jobCount, setJobCount] = useState(0);
  const [checklistClip, setChecklistClip] = useState<WorkspaceClip | null>(null);
  const [previewClip, setPreviewClip] = useState<WorkspaceClip | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const abortRef = useRef<AbortController | null>(null);

  const addLog = useCallback((line: LogLine) => {
    setLogs((prev) => [...prev, line]);
  }, []);

  const pollJobRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenLogCount = useRef(0);
  const activeJobId = useRef<string | null>(null);

  useEffect(() => () => { if (pollJobRef.current) clearInterval(pollJobRef.current); }, []);

  const processEvent = useCallback((event: Record<string, unknown>) => {
    if (event.step === "source_start") {
      addLog({ time: now(), message: event.message as string, status: "info", isGroupHeader: true });
      setSourcesProcessed(event.sourceIndex as number);
    } else if (event.step === "source_complete") {
      setSourcesProcessed((event.sourceIndex as number) + 1);
      addLog({ time: now(), message: `🎉 Video ${(event.sourceIndex as number) + 1} complete — ${event.clipsFromSource} clips`, status: "info" });
    } else if (event.step === "clip_ready" && event.clip) {
      const c = event.clip as Record<string, unknown>;
      setTotalClips(event.totalClips as number);
      setCurrentClipInSource((prev) => prev + 1);
      addLog({ time: now(), message: event.message as string, status: "complete" });
      setClips((prev) => [...prev, {
        id: c.id as string, title: c.title as string, downloadUrl: c.downloadUrl as string,
        thumbnailUrl: c.thumbnailUrl as string, startTime: c.startTime as number, endTime: c.endTime as number,
        viralityScore: c.viralityScore as string, reason: c.reason as string, hook: c.hook as string,
        caption: c.caption as string, platformFit: c.platformFit as string, sourceTitle: c.sourceTitle as string,
        status: "pending",
      }]);
    } else if (event.step === "analyze" && event.momentCount) {
      setClipsInCurrentSource(event.momentCount as number);
      setCurrentClipInSource(0);
      addLog({ time: now(), message: event.message as string, status: "complete" });
    } else if (event.step === "done") {
      setStatus("complete");
      addLog({ time: now(), message: event.message as string, status: "info" });
      toast.success(`${campaign.name}: ${event.totalClips} clips generated!`);
    } else if (event.message) {
      addLog({ time: now(), message: event.message as string, status: (event.status as LogLine["status"]) || "info" });
    }
  }, [addLog, campaign.name]);

  const startPolling = useCallback((jobId: string) => {
    activeJobId.current = jobId;
    seenLogCount.current = 0;
    if (pollJobRef.current) clearInterval(pollJobRef.current);
    pollJobRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/agent/jobs/${jobId}`);
        const data = await res.json();
        const logs: Record<string, unknown>[] = data.logs || [];
        // Only process new log entries
        for (let i = seenLogCount.current; i < logs.length; i++) {
          processEvent(logs[i]);
        }
        seenLogCount.current = logs.length;
        // Load any clips from DB that aren't in local state yet
        if (data.clips?.length) {
          setClips(prev => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newClips: WorkspaceClip[] = (data.clips as Record<string, unknown>[])
              .filter(c => !existingIds.has(c.id as string))
              .map(c => {
                const st = c.status as string;
                return {
                  id: c.id as string, title: c.title as string, downloadUrl: c.downloadUrl as string,
                  thumbnailUrl: c.thumbnailUrl as string, startTime: c.startTime as number, endTime: c.endTime as number,
                  viralityScore: c.viralityScore as string, reason: c.reason as string, hook: c.hook as string,
                  caption: c.caption as string, platformFit: c.platformFit as string, sourceTitle: "",
                  status: (st === "approved" ? "approved" : st === "discarded" ? "discarded" : "pending") as WorkspaceClip["status"],
                };
              });
            return newClips.length ? [...prev, ...newClips] : prev;
          });
        }
        if (data.status === "completed" || data.status === "error") {
          clearInterval(pollJobRef.current!);
          pollJobRef.current = null;
          if (data.status === "completed") setStatus("complete");
          else setStatus("error");
        }
      } catch { /* ignore poll errors */ }
    }, 2000);
  }, [processEvent]);

  const handleRun = async () => {
    if (status === "running") {
      // Can't stop a background job easily — just update UI
      setStatus("idle");
      if (pollJobRef.current) { clearInterval(pollJobRef.current); pollJobRef.current = null; }
      return;
    }
    setStatus("running");
    setJobCount((n) => n + 1);
    addLog({ time: now(), message: "🚀 Starting agent in background...", status: "started" });
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      const data = await res.json();
      if (!data.jobId) throw new Error(data.error || "Failed to start job");
      addLog({ time: now(), message: `✅ Job started — you can navigate away freely`, status: "info" });
      startPolling(data.jobId);
    } catch (err: unknown) {
      setStatus("error");
      addLog({ time: now(), message: `❌ ${(err as Error).message}`, status: "error" });
    }
  };

  const handleAutoEditAll = async () => {
    if (status === "running") {
      setStatus("idle");
      if (pollJobRef.current) { clearInterval(pollJobRef.current); pollJobRef.current = null; }
      return;
    }
    setStatus("running");
    setJobCount((n) => n + 1);
    addLog({ time: now(), message: "🔍 Scanning all channels for latest videos...", status: "started" });
    try {
      const srcRes = await fetch("/api/brief/findsources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      const srcData = await srcRes.json();
      if (srcData.errors?.length) {
        for (const e of srcData.errors) addLog({ time: now(), message: `⚠️ ${e.url}: ${e.error.slice(0,80)}`, status: "info" });
      }
      const total = srcData.totalVideos || 0;
      addLog({ time: now(), message: `✅ ${total} videos queued — starting agent in background...`, status: "complete", isGroupHeader: true });

      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      const data = await res.json();
      if (!data.jobId) throw new Error(data.error || "Failed to start job");
      addLog({ time: now(), message: `✅ Job started — you can navigate away freely`, status: "info" });
      startPolling(data.jobId);
    } catch (err: unknown) {
      setStatus("error");
      addLog({ time: now(), message: `❌ ${(err as Error).message}`, status: "error" });
    }
  };

  const handleApprove = (id: string) => {
    const clip = clips.find((c) => c.id === id);
    if (clip) setChecklistClip(clip);
    setClips((prev) => prev.map((c) => c.id === id ? { ...c, status: "approved" } : c));
  };
  const handleDiscard = (id: string) => {
    setClips((prev) => prev.map((c) => c.id === id ? { ...c, status: "discarded" } : c));
  };

  const uniquePlatforms = Array.from(new Set(sources.map((s) => s.platform)));
  const approvedCount = clips.filter((c) => c.status === "approved").length;
  const estEarnings = ((approvedCount * 50000 * campaign.cpm) / 1000).toFixed(0);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Card Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="w-10 h-10 rounded-full bg-[#0F1E3C] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {campaign.name[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[18px] text-[#111827]">{campaign.name}</span>
            {uniquePlatforms.map((p) => (
              <span key={p} className="inline-flex"><PlatformIcon platform={p} /></span>
            ))}
            <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-semibold">
              ${campaign.cpm} CPM
            </span>
            <span className="text-xs bg-red-50 text-red-800 px-2 py-0.5 rounded-full font-semibold">
              Max ${campaign.maxPerClip}
            </span>
            {totalClips > 0 && (
              <span className="text-xs bg-gray-100 text-[#6B7280] px-2 py-0.5 rounded-full">
                {sources.length} videos · {totalClips} clips{approvedCount > 0 ? ` · ~$${estEarnings} est.` : ""}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {status === "idle" && <span className="text-xs bg-gray-100 text-[#6B7280] px-2 py-1 rounded-full">Idle</span>}
          {status === "running" && (
            <span className="text-xs bg-[#C0392B]/10 text-[#C0392B] px-2 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#C0392B] rounded-full animate-pulse" /> Running
            </span>
          )}
          {status === "complete" && (
            <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full flex items-center gap-1">
              <CheckCircle size={11} /> Complete
            </span>
          )}
          {status === "error" && <span className="text-xs bg-[#C0392B]/10 text-[#C0392B] px-2 py-1 rounded-full">Error</span>}

          <button
            onClick={handleRun}
            className="flex items-center gap-1.5 bg-[#C0392B] text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-[#C0392B]/90"
          >
            {status === "running" ? <><Pause size={13} /> Pause</> : status === "complete" ? <><Play size={13} fill="white" /> Re-run</> : <><Play size={13} fill="white" /> Run</>}
          </button>

          <button
            onClick={handleAutoEditAll}
            className="flex items-center gap-1.5 bg-[#0F1E3C] text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-[#0F1E3C]/90"
          >
            <Zap size={13} /> Auto Edit All
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-8 h-8 flex items-center justify-center text-[#6B7280] border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 w-44">
                <button onClick={() => { setMenuOpen(false); setShowEdit(true); }}
                  className="w-full text-left px-4 py-2 text-sm text-[#111827] hover:bg-gray-50">
                  Edit Brief
                </button>
                <a href={`/api/campaigns/${campaign.id}/avatar`} download
                  onClick={() => setMenuOpen(false)}
                  className="block w-full text-left px-4 py-2 text-sm text-[#111827] hover:bg-gray-50 flex items-center gap-2">
                  <ImageIcon size={13} /> Download profile pic
                </a>
                <button
                  onClick={() => { setMenuOpen(false); onRemove(campaign.id); }}
                  className="w-full text-left px-4 py-2 text-sm text-[#C0392B] hover:bg-[#C0392B]/5 flex items-center gap-2"
                >
                  <Trash2 size={13} /> Remove Campaign
                </button>
              </div>
            )}
          </div>
        </div>

        {expanded ? <ChevronUp size={18} className="text-[#6B7280]" /> : <ChevronDown size={18} className="text-[#6B7280]" />}
      </div>

      {/* Card Body */}
      {expanded && (
        <div className="border-t border-gray-200 grid grid-cols-[25%_45%_30%]" style={{ height: 500 }}>
          <div className="border-r border-gray-200 overflow-hidden">
            <BriefSummaryPanel
              campaign={campaign}
              sources={sources}
              processedSourceIds={processedSourceIds}
              onRescan={() => toast.info("Re-scanning sources...")}
            />
          </div>
          <div className="border-r border-gray-200 overflow-hidden flex flex-col">
            <AgentLogPanel
              logs={logs}
              totalClips={totalClips}
              sourcesTotal={sources.length}
              sourcesProcessed={sourcesProcessed}
              currentClipInSource={currentClipInSource}
              clipsInCurrentSource={clipsInCurrentSource}
              onClear={() => setLogs([])}
              jobCount={jobCount}
            />
          </div>
          <div className="overflow-hidden flex flex-col">
            <ClipsOutputPanel clips={clips} onApprove={handleApprove} onDiscard={handleDiscard} onPreview={setPreviewClip} />
          </div>
        </div>
      )}

      {previewClip && (
        <ClipPreviewModal
          clip={previewClip}
          clips={clips}
          onClose={() => setPreviewClip(null)}
          onApprove={handleApprove}
          onDiscard={handleDiscard}
          onNavigate={setPreviewClip}
        />
      )}

      {checklistClip && (
        <PostChecklistModal
          clip={checklistClip}
          campaignName={campaign.name}
          platforms={campaign.platforms ? campaign.platforms.split(",") : ["tiktok", "instagram"]}
          postDuration={(campaign as { postDuration?: string }).postDuration}
          onMarkPosted={() => {
            setClips((prev) => prev.map((c) => c.id === checklistClip.id ? { ...c, status: "approved" } : c));
            setChecklistClip(null);
            toast.success("Clip marked as posted!");
          }}
          onClose={() => setChecklistClip(null)}
        />
      )}

      {showEdit && (
        <EditBriefModal
          campaign={campaign}
          onSave={(updated) => { onUpdate?.(updated); setShowEdit(false); }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
