"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Zap, Loader2, Copy, RefreshCw } from "lucide-react";
import PhonePreview from "./PhonePreview";
import EditorTabs from "./EditorTabs";

export interface EditorSettings {
  subtitleStyle: string;
  layout: string;
  gameplayStyle: string;
  colorPreset: string;
  colorManual: { brightness: number; contrast: number; saturation: number };
  normalize: boolean;
  removeSilence: boolean;
  musicTrack: string | null;
  musicVolume: number;
  speedRamp: boolean;
  hookText: string;
  hookEnabled: boolean;
  hookDuration: number;
  hookPosition: "top" | "middle";
  progressBar: boolean;
  progressColor: string;
  watermarkText: string;
  watermarkEnabled: boolean;
  watermarkOpacity: number;
  watermarkPosition: "tl" | "tr" | "bl" | "br";
  endCard: boolean;
  endCardText: string;
  endCardDuration: number;
}

const DEFAULT_SETTINGS: EditorSettings = {
  subtitleStyle: "viral-word",
  layout: "full",
  gameplayStyle: "subway-surfers",
  colorPreset: "viral",
  colorManual: { brightness: 0, contrast: 0, saturation: 1 },
  normalize: true,
  removeSilence: true,
  musicTrack: null,
  musicVolume: 15,
  speedRamp: false,
  hookText: "",
  hookEnabled: false,
  hookDuration: 2,
  hookPosition: "top",
  progressBar: true,
  progressColor: "var(--accent)",
  watermarkText: "@username",
  watermarkEnabled: false,
  watermarkOpacity: 40,
  watermarkPosition: "br",
  endCard: false,
  endCardText: "Follow for more",
  endCardDuration: 2,
};

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

export default function EditorPage() {
  const { clipId } = useParams<{ clipId: string }>();
  const [clip, setClip] = useState<ClipData | null>(null);
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_SETTINGS);
  const [transcript, setTranscript] = useState<{ start: number; end: number; text: string }[]>([]);
  const [caption, setCaption] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch(`/api/clips/${clipId}`)
      .then((r) => r.json())
      .then((data) => {
        setClip(data);
        if (data.title) {
          // inline caption call to avoid stale closure dependency
          fetch("/api/editor/caption", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clipId: data.id, clipTitle: data.title, clipReason: data.reason }),
          })
            .then((r) => r.json())
            .then((d) => setCaption(d.caption || ""))
            .catch(() => {});
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipId]);

  const generateCaption = async (c?: ClipData) => {
    const target = c || clip;
    if (!target) return;
    setCaptionLoading(true);
    try {
      const res = await fetch("/api/editor/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId: target.id, clipTitle: target.title, clipReason: target.reason }),
      });
      const data = await res.json();
      setCaption(data.caption || "");
    } catch { /* silent */ }
    setCaptionLoading(false);
  };

  const handleAutoEdit = async () => {
    if (!clip) return;
    setAutoLoading(true);
    try {
      const res = await fetch("/api/editor/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipTitle: clip.title, clipReason: clip.reason, transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings((s) => ({
        ...s,
        subtitleStyle: data.subtitleStyle || s.subtitleStyle,
        layout: data.layout || s.layout,
        colorPreset: data.colorPreset || s.colorPreset,
        normalize: data.normalize ?? s.normalize,
        removeSilence: data.removeSilence ?? s.removeSilence,
        progressBar: data.progressBar ?? s.progressBar,
        hookText: data.hookText || s.hookText,
        hookEnabled: !!data.hookText,
      }));
      toast.success("Auto-edit applied — optimized for viral performance ✅");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Auto-edit failed");
    }
    setAutoLoading(false);
  };

  const handleExport = async () => {
    if (!clip) return;
    setExporting(true);
    setExportProgress(10);

    const urlParts = clip.downloadUrl.split("/");
    const jobId = urlParts[urlParts.length - 2];
    const clipIndex = urlParts[urlParts.length - 1];

    try {
      setExportProgress(30);
      const res = await fetch("/api/editor/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId: clip.id,
          jobId,
          clipIndex,
          subtitleStyle: settings.subtitleStyle,
          transcript,
          layout: settings.layout,
          gameplayStyle: settings.gameplayStyle,
          audio: {
            normalize: settings.normalize,
            removeSilence: settings.removeSilence,
            musicTrack: settings.musicTrack,
            musicVolume: settings.musicVolume,
          },
          overlays: {
            hookText: settings.hookEnabled ? settings.hookText : null,
            hookDuration: settings.hookDuration,
            hookPosition: settings.hookPosition,
            progressBar: settings.progressBar,
            progressColor: settings.progressColor,
            watermarkText: settings.watermarkEnabled ? settings.watermarkText : null,
            watermarkOpacity: settings.watermarkOpacity,
            endCard: settings.endCard,
            endCardText: settings.endCardText,
            endCardDuration: settings.endCardDuration,
            totalDuration: clip.endTime - clip.startTime,
          },
          colorPreset: settings.colorPreset,
          colorManual: settings.colorManual,
        }),
      });
      setExportProgress(90);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExportProgress(100);
      toast.success("Clip exported successfully ✅");
      window.open(data.downloadUrl, "_blank");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
    setExporting(false);
    setTimeout(() => setExportProgress(0), 1500);
  };

  const update = (patch: Partial<EditorSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  if (!clip) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-[var(--accent)]" size={32} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--surface-2)] overflow-hidden">
      {/* Left panel — editing controls */}
      <div className="w-[58%] flex flex-col border-r border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
          <div>
            <h1 className="font-bold text-[16px] text-[var(--text)] truncate max-w-xs">{clip.title}</h1>
            <p className="text-xs text-[var(--text-muted)]">{Math.round(clip.endTime - clip.startTime)}s clip</p>
          </div>
          <button
            onClick={handleAutoEdit}
            disabled={autoLoading}
            className="flex items-center gap-2 bg-[var(--accent)] text-white font-bold px-4 py-2 rounded-xl hover:bg-[var(--accent-soft)] disabled:opacity-60"
          >
            {autoLoading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
            Auto Edit — Optimize for Views
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto">
          <EditorTabs
            settings={settings}
            update={update}
            transcript={transcript}
            setTranscript={setTranscript}
            clip={clip}
          />
        </div>

        {/* Caption section */}
        <div className="border-t border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm text-[var(--text)]">Auto-Generated Caption</span>
            <div className="flex gap-2">
              <button
                onClick={() => generateCaption()}
                disabled={captionLoading}
                className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] px-2 py-1 rounded"
              >
                {captionLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Regenerate
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(caption); toast.success("Copied!"); }}
                className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] px-2 py-1 rounded"
              >
                <Copy size={11} /> Copy
              </button>
            </div>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
          />
        </div>
      </div>

      {/* Right panel — phone preview */}
      <div className="w-[42%] flex flex-col items-center justify-center bg-[var(--surface-2)] p-6 gap-4">
        <PhonePreview
          videoRef={videoRef}
          clip={clip}
          settings={settings}
        />

        {/* Export */}
        <div className="w-full max-w-[280px]">
          {exportProgress > 0 && (
            <div className="w-full bg-[var(--border)] rounded-full h-1.5 mb-2">
              <div
                className="bg-[var(--accent)] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent-soft)] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {exporting ? (
              <><Loader2 size={16} className="animate-spin" /> Exporting...</>
            ) : (
              "Export Final Clip"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
