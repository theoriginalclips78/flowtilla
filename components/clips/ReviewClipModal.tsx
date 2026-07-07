"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ClipResult } from "@/store/agentStore";

interface Props {
  clip: ClipResult;
  allClips: ClipResult[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export default function ReviewClipModal({ clip, allClips, currentIndex, onNavigate, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(clip.startTime);
  const [endTime, setEndTime] = useState(clip.endTime);
  const [adjustMode, setAdjustMode] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    setStartTime(clip.startTime);
    setEndTime(clip.endTime);
    setAdjustMode(false);
  }, [clip]);

  const onVideoLoaded = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      videoRef.current.currentTime = clip.startTime;
    }
  };

  const onTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const seek = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(ratio * duration);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
    else { videoRef.current.play(); setIsPlaying(true); }
  };

  const approve = async () => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/clips/${clip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Clip approved and saved ✅");
      if (currentIndex < allClips.length - 1) {
        onNavigate(currentIndex + 1);
      } else {
        onClose();
      }
    } catch {
      toast.error("Failed to approve clip");
    } finally {
      setIsApproving(false);
    }
  };

  const clipDuration = endTime - startTime;
  const startRatio = duration ? startTime / duration : 0;
  const endRatio = duration ? endTime / duration : 0;
  const currentRatio = duration ? currentTime / duration : 0;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Header with prev/next */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border)]">
          <button
            onClick={() => currentIndex > 0 && onNavigate(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <h2 className="font-bold text-[20px] text-[var(--text)]">Review Clip</h2>
            <p className="text-[14px] text-[var(--text-muted)]">Preview and adjust the clip timing</p>
          </div>
          <button
            onClick={() => currentIndex < allClips.length - 1 && onNavigate(currentIndex + 1)}
            disabled={currentIndex === allClips.length - 1}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Clip info */}
          <div>
            <h3 className="font-bold text-[18px]">{clip.title}</h3>
            <p className="text-[14px] text-[var(--text-muted)] mt-1">{clip.reason}</p>
          </div>

          {/* Video player */}
          <div className="bg-[var(--surface-2)] rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              src={clip.downloadUrl}
              className="w-full"
              onLoadedMetadata={onVideoLoaded}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </div>

          {/* Timeline */}
          <div>
            <div
              className="w-full h-3 bg-[var(--border)] rounded-full relative cursor-pointer"
              onClick={handleTrackClick}
            >
              {/* Clip range */}
              <div
                className="absolute h-full bg-[var(--accent)]/30 rounded-full"
                style={{ left: `${startRatio * 100}%`, width: `${(endRatio - startRatio) * 100}%` }}
              />
              {/* Current position */}
              <div
                className="absolute w-3 h-3 bg-[var(--accent)] rounded-full top-0 -translate-x-1/2 shadow"
                style={{ left: `${currentRatio * 100}%` }}
              />
              {/* Adjust handles */}
              {adjustMode && (
                <>
                  <div
                    className="absolute w-3 h-3 bg-red-700 rounded-full top-0 -translate-x-1/2 cursor-ew-resize shadow"
                    style={{ left: `${startRatio * 100}%` }}
                  />
                  <div
                    className="absolute w-3 h-3 bg-red-700 rounded-full top-0 -translate-x-1/2 cursor-ew-resize shadow"
                    style={{ left: `${endRatio * 100}%` }}
                  />
                </>
              )}
            </div>
            <div className="flex items-center justify-between mt-1 text-[12px] text-[var(--text-muted)]">
              <span>0:00</span>
              <span>{formatTime(startTime)}</span>
              <span className="bg-[var(--chip)] text-white px-2 py-0.5 rounded-full">{Math.round(clipDuration)}s</span>
              <span>{formatTime(endTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]/60 mt-1 text-center">
              Tap anywhere on the timeline to explore the full video
            </p>
          </div>

          {/* Playback controls */}
          <div className="flex gap-2">
            <button
              onClick={togglePlay}
              className="flex items-center gap-1.5 px-4 py-2 border border-[var(--border)] rounded-lg text-sm hover:bg-[var(--surface-2)]"
            >
              {isPlaying ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
            </button>
            <button
              onClick={() => seek(startTime)}
              className="flex items-center gap-1.5 px-4 py-2 border border-[var(--border)] rounded-lg text-sm hover:bg-[var(--surface-2)]"
            >
              <RotateCcw size={14} /> Play from start of clip
            </button>
          </div>

          {/* Adjust boundaries */}
          <button
            onClick={() => setAdjustMode(!adjustMode)}
            className="w-full flex items-center justify-center gap-2 border border-[var(--border)] rounded-lg py-2 text-sm hover:bg-[var(--surface-2)]"
          >
            <Pencil size={14} />
            {adjustMode ? "Done Adjusting" : "Adjust Boundaries"}
          </button>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 border border-[var(--border)] text-[var(--text-muted)] py-2.5 rounded-xl hover:bg-[var(--surface-2)] font-medium"
            >
              Cancel
            </button>
            <button
              onClick={approve}
              disabled={isApproving}
              className="flex-1 bg-[var(--accent)] text-white py-2.5 rounded-xl hover:bg-[var(--accent)]/90 font-medium disabled:opacity-60"
            >
              {isApproving ? "Approving..." : "Approve Clip"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
