"use client";

import { RefObject } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { useState } from "react";
import { EditorSettings } from "./page";

interface ClipData {
  id: string;
  jobId: string;
  title: string;
  downloadUrl: string;
  startTime: number;
  endTime: number;
  reason: string;
  viralityScore: string;
}

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  clip: ClipData;
  settings: EditorSettings;
}

export default function PhonePreview({ videoRef, clip, settings }: Props) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(clip.endTime - clip.startTime || 1);

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else { videoRef.current.play(); setPlaying(true); }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const hookVisible = settings.hookEnabled && currentTime < settings.hookDuration;
  const endCardVisible = settings.endCard && currentTime > duration - settings.endCardDuration;

  const subtitleDemo =
    settings.subtitleStyle === "viral-word" ? "This" :
    settings.subtitleStyle === "hormozi" ? "THIS IS INSANE" :
    settings.subtitleStyle === "minimal" ? "Great content here" :
    "Watch till the end 👀";

  const subtitleClass: Record<string, string> = {
    "viral-word": "text-white text-4xl font-black [text-shadow:0_0_12px_rgba(0,0,0,1)] tracking-tight",
    "hormozi": "text-yellow-400 text-3xl font-black uppercase [text-shadow:3px_3px_0px_black]",
    "outline": "text-white text-2xl font-bold [text-shadow:0_0_3px_#FF4444,0_0_3px_#FF4444]",
    "box": "text-white text-2xl font-bold bg-black/60 px-3 py-1 rounded-lg",
    "neon": "text-cyan-400 text-2xl font-bold [text-shadow:0_0_10px_#00FFFF,0_0_20px_#00FFFF]",
    "minimal": "text-white text-lg font-medium [text-shadow:1px_1px_2px_black]",
  };

  return (
    <div className="flex flex-col items-center">
      {/* Phone frame */}
      <div className="relative" style={{ width: 260, height: 520 }}>
        {/* Phone shell */}
        <div className="absolute inset-0 rounded-[36px] border-[10px] border-gray-800 shadow-2xl bg-black overflow-hidden">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-[var(--chip)] rounded-b-xl z-20" />

          {/* Video */}
          <video
            ref={videoRef}
            src={clip.downloadUrl}
            className="absolute inset-0 w-full h-full object-cover"
            onTimeUpdate={() => {
              if (videoRef.current) setCurrentTime(videoRef.current.currentTime - clip.startTime);
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = clip.startTime;
                setDuration(clip.endTime - clip.startTime);
              }
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />

          {/* CSS overlay layers */}
          {/* Progress bar */}
          {settings.progressBar && (
            <div className="absolute top-0 left-0 right-0 h-1.5 z-10">
              <div
                className="h-full transition-all duration-200"
                style={{ width: `${progress}%`, backgroundColor: settings.progressColor }}
              />
            </div>
          )}

          {/* Hook text */}
          {hookVisible && settings.hookText && (
            <div className={`absolute ${settings.hookPosition === "top" ? "top-8" : "top-1/2 -translate-y-1/2"} left-0 right-0 flex justify-center z-10 px-4`}>
              <span className="text-white text-2xl font-black text-center [text-shadow:0_0_12px_rgba(0,0,0,1)]">
                {settings.hookText}
              </span>
            </div>
          )}

          {/* Subtitles */}
          <div className="absolute bottom-16 left-0 right-0 flex justify-center z-10 px-4">
            <span className={`text-center ${subtitleClass[settings.subtitleStyle] || subtitleClass["minimal"]}`}>
              {subtitleDemo}
            </span>
          </div>

          {/* Watermark */}
          {settings.watermarkEnabled && settings.watermarkText && (
            <div
              className="absolute z-10 text-white text-xs font-medium"
              style={{
                opacity: settings.watermarkOpacity / 100,
                bottom: settings.watermarkPosition.includes("b") ? 8 : "auto",
                top: settings.watermarkPosition.includes("t") ? 8 : "auto",
                left: settings.watermarkPosition.includes("l") ? 8 : "auto",
                right: settings.watermarkPosition.includes("r") ? 8 : "auto",
              }}
            >
              {settings.watermarkText}
            </div>
          )}

          {/* End card */}
          {endCardVisible && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40">
              <span className="text-white text-2xl font-black text-center [text-shadow:0_0_12px_rgba(0,0,0,1)]">
                {settings.endCardText}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3 mt-4 w-full max-w-[260px]">
        <button onClick={toggle} className="p-2 rounded-full bg-[var(--chip)] text-white hover:bg-[var(--chip)]/80">
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="flex-1 bg-[var(--border)] rounded-full h-1.5 cursor-pointer relative"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            if (videoRef.current) {
              videoRef.current.currentTime = clip.startTime + ratio * duration;
            }
          }}
        >
          <div className="bg-[var(--accent)] h-1.5 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-[var(--text-muted)] tabular-nums">
          {Math.floor(currentTime)}s
        </span>
        <Volume2 size={14} className="text-[var(--text-muted)]" />
      </div>
    </div>
  );
}
