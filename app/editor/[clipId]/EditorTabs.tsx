"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EditorSettings } from "./page";

interface Segment { start: number; end: number; text: string }
interface ClipData { id: string; downloadUrl: string; title: string; reason: string }
interface Props {
  settings: EditorSettings;
  update: (p: Partial<EditorSettings>) => void;
  transcript: Segment[];
  setTranscript: (t: Segment[]) => void;
  clip: ClipData;
}

const TABS = ["Style Subtitles", "Edit Subtitles", "Edit Video", "Audio", "Overlays", "Color"];

const SUBTITLE_STYLES = [
  { id: "viral-word", label: "Viral Word", preview: "The" },
  { id: "hormozi", label: "Hormozi", preview: "THIS IS" },
  { id: "outline", label: "Outline", preview: "Watch" },
  { id: "box", label: "Box", preview: "Now" },
  { id: "neon", label: "Neon", preview: "🔥" },
  { id: "minimal", label: "Minimal", preview: "subtle" },
];

const LAYOUTS = [
  { id: "full", label: "Full Video", icon: "📱" },
  { id: "split-gameplay", label: "Split + Gameplay", icon: "🎮" },
  { id: "blur-background", label: "Blur Background", icon: "🌫️" },
  { id: "black-bars", label: "Black Bars", icon: "🎬" },
  { id: "zoom-punch", label: "Zoom Punch", icon: "🔍" },
  { id: "shake", label: "Shake Effect", icon: "📳" },
];

const GAMEPLAY_STYLES = ["subway-surfers", "minecraft", "gta", "satisfying", "nature"];
const COLOR_PRESETS = [
  { id: "auto", label: "Auto (AI)", desc: "AI picks best" },
  { id: "viral", label: "Viral", desc: "Warm & saturated" },
  { id: "cinematic", label: "Cinematic", desc: "Teal-orange grade" },
  { id: "bright", label: "Bright", desc: "Light & pop" },
  { id: "dark", label: "Dark", desc: "Moody contrast" },
];

const MUSIC_TRACKS = [
  "energetic-1", "energetic-2", "chill-1", "chill-2",
  "hype-1", "hype-2", "dramatic-1", "dramatic-2", "upbeat-1", "upbeat-2",
];

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border)]/50 last:border-0">
      <div>
        <p className="text-sm font-medium text-[var(--text)]">{label}</p>
        {desc && <p className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${checked ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
      >
        <div className={`w-3.5 h-3.5 bg-[var(--surface)] rounded-full absolute top-0.5 transition-all shadow ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
        <span className="text-xs text-[var(--text-muted)]">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)] h-1.5 rounded-full"
      />
    </div>
  );
}

export default function EditorTabs({ settings, update, transcript, setTranscript, clip }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [subtitleLoading, setSubtitleLoading] = useState(false);

  const generateSubtitles = async () => {
    setSubtitleLoading(true);
    try {
      const urlParts = clip.downloadUrl.split("/");
      const jobId = urlParts[urlParts.length - 2];
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTranscript(data.transcript || []);
      toast.success("Subtitles generated ✅");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate subtitles");
    }
    setSubtitleLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)] bg-[var(--surface)] overflow-x-auto flex-shrink-0">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
              activeTab === i
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Tab 0 — Style Subtitles */}
        {activeTab === 0 && (
          <div>
            <div className="flex gap-2 mb-4">
              <div className="flex gap-1 bg-[var(--surface-2)] rounded-lg p-1">
                {["One Word", "Lines"].map((m) => (
                  <button key={m} className="px-3 py-1 text-sm rounded-md bg-[var(--surface)] shadow font-medium">{m}</button>
                ))}
              </div>
              <button className="text-sm text-[var(--text-muted)] border border-[var(--border)] px-3 py-1 rounded-lg hover:bg-[var(--surface-2)]">
                Edit Size & Position
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {SUBTITLE_STYLES.map((style) => {
                const previewClass: Record<string, string> = {
                  "viral-word": "text-white text-xl font-black [text-shadow:0_0_8px_rgba(0,0,0,1)]",
                  "hormozi": "text-yellow-400 text-lg font-black uppercase [text-shadow:2px_2px_0px_black]",
                  "outline": "text-white text-lg font-bold [text-shadow:0_0_3px_#FF4444,0_0_3px_#FF4444]",
                  "box": "text-white text-lg font-bold bg-black/60 px-2 py-0.5 rounded",
                  "neon": "text-cyan-400 text-lg font-bold [text-shadow:0_0_8px_#00FFFF]",
                  "minimal": "text-white text-base [text-shadow:1px_1px_2px_black]",
                };
                return (
                  <button
                    key={style.id}
                    onClick={() => update({ subtitleStyle: style.id })}
                    className={`bg-[var(--chip)] rounded-xl p-4 flex flex-col items-center justify-center gap-2 border-2 transition-colors ${
                      settings.subtitleStyle === style.id ? "border-[var(--accent)]" : "border-transparent"
                    }`}
                  >
                    <span className={previewClass[style.id] || "text-white"}>{style.preview}</span>
                    <span className="text-[11px] text-white/60">{style.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 1 — Edit Subtitles */}
        {activeTab === 1 && (
          <div>
            <button
              onClick={generateSubtitles}
              disabled={subtitleLoading}
              className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-white font-semibold py-2.5 rounded-lg mb-4 hover:bg-[var(--accent)]/90 disabled:opacity-60"
            >
              {subtitleLoading ? <Loader2 size={15} className="animate-spin" /> : null}
              Generate Subtitles
            </button>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {transcript.length === 0 && (
                <p className="text-sm text-[var(--text-muted)] text-center py-8">No subtitles yet. Click Generate above.</p>
              )}
              {transcript.map((seg, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs bg-[var(--chip)] text-white px-2 py-0.5 rounded font-mono flex-shrink-0">
                    {seg.start.toFixed(1)}s
                  </span>
                  <input
                    value={seg.text}
                    onChange={(e) => {
                      const updated = [...transcript];
                      updated[i] = { ...seg, text: e.target.value };
                      setTranscript(updated);
                    }}
                    className="flex-1 text-sm border border-[var(--border)] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                  />
                </div>
              ))}
            </div>

            {transcript.length > 0 && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setTranscript([...transcript, { start: 0, end: 2, text: "New line" }])}
                  className="flex items-center gap-1 text-sm text-[var(--text-muted)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--surface-2)]"
                >
                  <Plus size={13} /> Add Caption
                </button>
                <button
                  onClick={() => setTranscript([])}
                  className="flex items-center gap-1 text-sm text-[var(--accent)] border border-[var(--accent)]/30 px-3 py-1.5 rounded-lg hover:bg-[var(--accent)]/5 ml-auto"
                >
                  <Trash2 size={13} /> Delete All
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2 — Edit Video */}
        {activeTab === 2 && (
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">Layout</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => update({ layout: l.id })}
                  className={`border-2 rounded-xl p-3 flex flex-col items-center gap-1.5 transition-colors ${
                    settings.layout === l.id ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)] hover:border-[var(--accent)]/30"
                  }`}
                >
                  <span className="text-2xl">{l.icon}</span>
                  <span className="text-[11px] text-[var(--text-muted)] text-center">{l.label}</span>
                </button>
              ))}
            </div>

            {settings.layout === "split-gameplay" && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">Gameplay Style</p>
                <div className="flex flex-wrap gap-2">
                  {GAMEPLAY_STYLES.map((g) => (
                    <button
                      key={g}
                      onClick={() => update({ gameplayStyle: g })}
                      className={`px-3 py-1.5 rounded-full text-sm capitalize transition-colors ${
                        settings.gameplayStyle === g ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/40"
                      }`}
                    >
                      {g.replace("-", " ")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <details className="border border-[var(--border)] rounded-lg">
              <summary className="px-4 py-3 text-sm font-semibold cursor-pointer text-[var(--text)] select-none">
                Video Config
              </summary>
              <div className="px-4 pb-4 pt-2">
                <Slider label="Brightness" value={settings.colorManual.brightness * 100} min={-50} max={50}
                  onChange={(v) => update({ colorManual: { ...settings.colorManual, brightness: v / 100 } })} />
                <Slider label="Contrast" value={settings.colorManual.contrast} min={-50} max={50}
                  onChange={(v) => update({ colorManual: { ...settings.colorManual, contrast: v } })} />
                <Slider label="Saturation" value={Math.round(settings.colorManual.saturation * 100)} min={0} max={300}
                  onChange={(v) => update({ colorManual: { ...settings.colorManual, saturation: v / 100 } })} />
                <div className="mt-2">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">Speed</p>
                  <div className="flex gap-2">
                    {["0.75x", "1x", "1.25x", "1.5x"].map((s) => (
                      <button key={s} className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:border-[var(--accent)]/40 data-[active=true]:bg-[var(--accent)] data-[active=true]:text-white">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Tab 3 — Audio */}
        {activeTab === 3 && (
          <div>
            <Toggle label="Normalize Audio" desc="Target -14 LUFS for social media" checked={settings.normalize} onChange={(v) => update({ normalize: v })} />
            <Toggle label="Remove Silence" desc="Cut pauses longer than 0.5s" checked={settings.removeSilence} onChange={(v) => update({ removeSilence: v })} />
            <Toggle label="Background Music" checked={settings.musicTrack !== null} onChange={(v) => update({ musicTrack: v ? MUSIC_TRACKS[0] : null })} />

            {settings.musicTrack !== null && (
              <div className="mt-3 mb-3">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">Music Tracks</p>
                <div className="grid grid-cols-2 gap-2">
                  {MUSIC_TRACKS.map((track) => (
                    <button
                      key={track}
                      onClick={() => update({ musicTrack: track })}
                      className={`border rounded-lg p-2 text-left transition-colors ${
                        settings.musicTrack === track ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)] hover:border-[var(--accent)]/30"
                      }`}
                    >
                      <p className="text-xs font-medium text-[var(--text)] capitalize">{track.replace("-", " ")}</p>
                      <div className="flex gap-0.5 mt-1">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} className="w-1 bg-[var(--border-strong)] rounded-full" style={{ height: 4 + Math.random() * 10 }} />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
                <Slider label="Music Volume" value={settings.musicVolume} min={0} max={30}
                  onChange={(v) => update({ musicVolume: v })} />
              </div>
            )}

            <Toggle label="Speed Ramp" desc="Slightly speed up low-energy segments" checked={settings.speedRamp} onChange={(v) => update({ speedRamp: v })} />

            <div className="mt-2">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">Sound Effects</p>
              <Toggle label="Whoosh on cuts" checked={false} onChange={() => {}} />
              <Toggle label="Impact on key moments" checked={false} onChange={() => {}} />
            </div>
          </div>
        )}

        {/* Tab 4 — Overlays */}
        {activeTab === 4 && (
          <div className="space-y-4">
            {/* Hook Text */}
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">Hook Text</p>
              <Toggle label="Enable hook text" checked={settings.hookEnabled} onChange={(v) => update({ hookEnabled: v })} />
              {settings.hookEnabled && (
                <div className="mt-2 space-y-2">
                  <input
                    value={settings.hookText}
                    onChange={(e) => update({ hookText: e.target.value })}
                    placeholder="Wait for it... 👀"
                    className="w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-[var(--text-muted)] mb-1">Duration</p>
                      <input type="range" min={1} max={4} value={settings.hookDuration}
                        onChange={(e) => update({ hookDuration: Number(e.target.value) })}
                        className="w-full accent-[var(--accent)]" />
                      <p className="text-xs text-[var(--text-muted)] text-right">{settings.hookDuration}s</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)] mb-1">Position</p>
                      <div className="flex gap-1">
                        {(["top", "middle"] as const).map((p) => (
                          <button key={p} onClick={() => update({ hookPosition: p })}
                            className={`px-2 py-1 text-xs rounded border capitalize ${settings.hookPosition === p ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--border)]"}`}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">Progress Bar</p>
              <Toggle label="Enable progress bar" checked={settings.progressBar} onChange={(v) => update({ progressBar: v })} />
              {settings.progressBar && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-[var(--text-muted)]">Color</span>
                  <input type="color" value={settings.progressColor}
                    onChange={(e) => update({ progressColor: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border-0" />
                </div>
              )}
            </div>

            {/* Watermark */}
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">Watermark</p>
              <Toggle label="Enable watermark" checked={settings.watermarkEnabled} onChange={(v) => update({ watermarkEnabled: v })} />
              {settings.watermarkEnabled && (
                <div className="mt-2 space-y-2">
                  <input
                    value={settings.watermarkText}
                    onChange={(e) => update({ watermarkText: e.target.value })}
                    placeholder="@username"
                    className="w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none"
                  />
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">Position</p>
                    <div className="grid grid-cols-2 gap-1 w-24">
                      {(["tl", "tr", "bl", "br"] as const).map((pos) => (
                        <button key={pos} onClick={() => update({ watermarkPosition: pos })}
                          className={`text-xs p-1 rounded border ${settings.watermarkPosition === pos ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--border)]"}`}>
                          {pos.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Slider label="Opacity" value={settings.watermarkOpacity} min={20} max={80}
                    onChange={(v) => update({ watermarkOpacity: v })} />
                </div>
              )}
            </div>

            {/* End Card */}
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">End Card</p>
              <Toggle label="Enable end card" checked={settings.endCard} onChange={(v) => update({ endCard: v })} />
              {settings.endCard && (
                <div className="mt-2 space-y-2">
                  <input
                    value={settings.endCardText}
                    onChange={(e) => update({ endCardText: e.target.value })}
                    className="w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none"
                  />
                  <Slider label="Duration" value={settings.endCardDuration} min={1} max={3}
                    onChange={(v) => update({ endCardDuration: v })} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5 — Color */}
        {activeTab === 5 && (
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">Color Grade Preset</p>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {COLOR_PRESETS.map((p) => {
                const bg: Record<string, string> = {
                  auto: "bg-gradient-to-br from-purple-400 to-pink-400",
                  viral: "bg-gradient-to-br from-orange-400 to-yellow-300",
                  cinematic: "bg-gradient-to-br from-teal-400 to-orange-300",
                  bright: "bg-gradient-to-br from-sky-300 to-yellow-200",
                  dark: "bg-gradient-to-br from-gray-700 to-gray-900",
                };
                return (
                  <button
                    key={p.id}
                    onClick={() => update({ colorPreset: p.id })}
                    className={`flex flex-col gap-1.5 border-2 rounded-xl overflow-hidden transition-colors ${
                      settings.colorPreset === p.id ? "border-[var(--accent)]" : "border-[var(--border)]"
                    }`}
                  >
                    <div className={`h-14 w-full ${bg[p.id]}`} />
                    <span className="text-[10px] text-[var(--text-muted)] pb-1.5 px-1 text-center">{p.label}</span>
                  </button>
                );
              })}
            </div>

            <details className="border border-[var(--border)] rounded-lg">
              <summary className="px-4 py-3 text-sm font-semibold cursor-pointer text-[var(--text)] select-none">
                Manual Adjustments
              </summary>
              <div className="px-4 pb-4 pt-2">
                <Slider label="Brightness" value={Math.round(settings.colorManual.brightness * 100)} min={-50} max={50}
                  onChange={(v) => update({ colorManual: { ...settings.colorManual, brightness: v / 100 } })} />
                <Slider label="Contrast" value={settings.colorManual.contrast} min={-50} max={50}
                  onChange={(v) => update({ colorManual: { ...settings.colorManual, contrast: v } })} />
                <Slider label="Saturation" value={Math.round(settings.colorManual.saturation * 100)} min={0} max={300}
                  onChange={(v) => update({ colorManual: { ...settings.colorManual, saturation: v / 100 } })} />
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
