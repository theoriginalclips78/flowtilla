"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, CheckCircle, XCircle, Loader2, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgentStore, LogEntry, ClipResult } from "@/store/agentStore";
import { useCampaignStore } from "@/store/campaignStore";
import { format } from "date-fns";
import ClipCard from "@/components/clips/ClipCard";
import ReviewClipModal from "@/components/clips/ReviewClipModal";

function logColor(entry: LogEntry) {
  if (entry.status === "complete") return "text-green-400";
  if (entry.status === "error") return "text-red-400";
  if (entry.status === "progress") return "text-yellow-300";
  return "text-white";
}

function logIcon(entry: LogEntry) {
  if (entry.status === "complete") return "✅";
  if (entry.status === "error") return "❌";
  if (entry.status === "progress") return "🎉";
  return "⏳";
}

export default function AgentControlPanel() {
  const { campaigns } = useCampaignStore();
  const {
    agentStatus, currentTask, progress, logEntries, results,
    setActiveCampaign, setStatus, setCurrentTask, setProgress, addLog, setResults, setJobId, resetAgent,
  } = useAgentStore();

  const logRef = useRef<HTMLDivElement>(null);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [reviewClip, setReviewClip] = useState<ClipResult | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logEntries]);

  const startAgent = async () => {
    if (!selectedCampaign) return;
    resetAgent();
    setActiveCampaign(selectedCampaign);
    setStatus("running");
    setCurrentTask("Starting agent...");

    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: selectedCampaign }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    let stepProgress = 0;
    const steps = ["brief", "job", "download", "transcribe", "analyze", "cut", "done"];

    const read = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.jobId) setJobId(data.jobId);

            const stepIdx = steps.indexOf(data.step);
            if (stepIdx >= 0) {
              stepProgress = Math.round(((stepIdx + 1) / steps.length) * 100);
              setProgress(stepProgress);
            }

            setCurrentTask(data.message || "");

            addLog({
              timestamp: format(new Date(), "HH:mm:ss"),
              step: data.step,
              status: data.status,
              message: data.message || "",
            });

            if (data.step === "done") {
              setStatus("completed");
              if (data.clips) setResults(data.clips);
            }

            if (data.status === "error") {
              setStatus("error");
            }
          } catch {}
        }
      }
    };

    read().catch(() => setStatus("error"));
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Status Card */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 flex flex-col items-center gap-3">
        {agentStatus === "idle" && (
          <>
            <Bot size={48} className="text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)] font-medium">Agent is ready</span>
          </>
        )}
        {agentStatus === "running" && (
          <>
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[var(--accent-soft)] animate-ping" />
              <Bot size={48} className="text-[var(--accent)] relative" />
            </div>
            <span className="text-[var(--text)] font-medium text-center">{currentTask}</span>
            <div className="w-full bg-[var(--surface-2)] rounded-full h-1.5">
              <div
                className="bg-[var(--accent)] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}
        {agentStatus === "completed" && (
          <>
            <CheckCircle size={48} className="text-green-600" />
            <span className="text-green-600 font-medium">All clips ready</span>
          </>
        )}
        {agentStatus === "error" && (
          <>
            <XCircle size={48} className="text-[var(--accent)]" />
            <span className="text-[var(--accent)] font-medium">{currentTask || "Something went wrong"}</span>
          </>
        )}
      </div>

      {/* Campaign selector + Run button */}
      <div className="flex gap-2">
        <Select value={selectedCampaign} onValueChange={(v) => setSelectedCampaign(v ?? "")}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select campaign to run" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={startAgent}
          disabled={agentStatus === "running" || !selectedCampaign}
          className="bg-[var(--accent)] hover:bg-[var(--accent-soft)] text-white font-bold px-6"
        >
          {agentStatus === "running" ? (
            <><Loader2 size={16} className="animate-spin mr-2" /> Running...</>
          ) : (
            <><Play size={16} className="mr-2" /> Run Agent</>
          )}
        </Button>
      </div>

      {/* Log terminal */}
      <div className="bg-[var(--chip)] rounded-xl flex-1 flex flex-col overflow-hidden min-h-[240px]">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <span className="text-[12px] text-[var(--text-muted)] font-mono">Agent Log</span>
          <button onClick={() => resetAgent()} className="text-[12px] text-[var(--text-muted)] hover:text-white flex items-center gap-1">
            <Trash2 size={12} /> Clear
          </button>
        </div>
        <div ref={logRef} className="flex-1 overflow-y-auto p-4 font-mono text-[13px] space-y-1">
          {logEntries.length === 0 && (
            <span className="text-[var(--text-light)]">Waiting for agent to start...</span>
          )}
          {logEntries.map((entry, i) => (
            <div key={i} className={logColor(entry)}>
              <span className="text-[var(--text-light)] mr-2">[{entry.timestamp}]</span>
              <span className="mr-2">{logIcon(entry)}</span>
              {entry.message}
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <h3 className="font-bold text-[var(--text)] mb-3">Generated Clips — Ready for Review</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {results.map((clip, i) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onReview={() => { setReviewClip(clip); setReviewIndex(i); }}
              />
            ))}
          </div>
        </div>
      )}

      {reviewClip && (
        <ReviewClipModal
          clip={reviewClip}
          allClips={results}
          currentIndex={reviewIndex}
          onNavigate={(i) => { setReviewClip(results[i]); setReviewIndex(i); }}
          onClose={() => setReviewClip(null)}
        />
      )}
    </div>
  );
}
