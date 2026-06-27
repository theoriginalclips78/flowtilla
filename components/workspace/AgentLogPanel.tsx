"use client";

import { useEffect, useRef } from "react";

export interface LogLine {
  time: string;
  message: string;
  status: "started" | "complete" | "error" | "progress" | "info";
  isGroupHeader?: boolean;
}

interface Props {
  logs: LogLine[];
  totalClips: number;
  sourcesTotal: number;
  sourcesProcessed: number;
  currentClipInSource: number;
  clipsInCurrentSource: number;
  onClear: () => void;
  jobCount: number;
}

const lineColor: Record<string, string> = {
  complete: "text-green-400",
  error:    "text-red-400",
  started:  "text-slate-200",
  progress: "text-slate-400",
  info:     "text-red-300",
};

export default function AgentLogPanel({
  logs, totalClips, sourcesTotal, sourcesProcessed,
  currentClipInSource, clipsInCurrentSource, onClear, jobCount,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const progress = sourcesTotal > 0 ? (sourcesProcessed / sourcesTotal) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/10 flex-shrink-0" style={{ background: "rgba(255,255,255,0.6)" }}>
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900">Agent Log</span>
          {jobCount > 0 && (
            <span className="text-[11px] liquid-glass rounded-lg px-2 py-0.5 text-black/45" style={{ background: "rgba(0,0,0,0.06)" }}>
              {jobCount} jobs
            </span>
          )}
        </div>
        <button onClick={onClear} className="text-xs text-black/35 hover:text-black/70 transition-colors">Clear</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed" style={{ minHeight: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}>
        {logs.length === 0 && <p className="text-slate-500">Waiting for agent to start...</p>}
        {logs.map((line, i) => (
          <div key={i} className={line.isGroupHeader ? "mt-3 mb-1 border-t border-white/10 pt-2" : ""}>
            {line.isGroupHeader ? (
              <span className="text-slate-400">{line.message}</span>
            ) : (
              <span className={lineColor[line.status] || "text-slate-300"}>
                [{line.time}] {line.message}
              </span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {sourcesTotal > 0 && (
        <div className="px-4 py-3 border-t border-black/10 flex-shrink-0" style={{ background: "rgba(255,255,255,0.6)" }}>
          <div className="w-full rounded-full h-1 mb-2" style={{ background: "rgba(0,0,0,0.1)" }}>
            <div className="bg-[#C0392B] h-1 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] text-black/40">
            Video {Math.min(sourcesProcessed + 1, sourcesTotal)} of {sourcesTotal}
            {clipsInCurrentSource > 0 && ` · Clip ${currentClipInSource} of ${clipsInCurrentSource}`}
            {totalClips > 0 && ` · ${totalClips} clips total`}
          </p>
        </div>
      )}
    </div>
  );
}
