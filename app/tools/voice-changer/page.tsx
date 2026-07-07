"use client";

import { useState, useRef } from "react";
import { Loader2, Upload, AlertCircle, Download, Volume2 } from "lucide-react";
import ToolPageLayout from "@/components/tools/ToolPageLayout";

const EFFECTS = [
  { id: "robot", label: "Robot", icon: "🤖" },
  { id: "deep", label: "Deep", icon: "🔊" },
  { id: "chipmunk", label: "Chipmunk", icon: "🐿️" },
  { id: "echo", label: "Echo", icon: "🔁" },
  { id: "reverb", label: "Reverb", icon: "🎵" },
  { id: "radio", label: "Radio", icon: "📻" },
];

export default function VoiceChangerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [effect, setEffect] = useState("deep");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => { setFile(f); setDownloadUrl(""); setError(""); };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true); setError(""); setDownloadUrl(""); setProgress(0);
    const interval = setInterval(() => setProgress((p) => Math.min(p + 7, 90)), 600);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("effect", effect);
      const res = await fetch("/api/tools/voice-changer", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");
      setProgress(100);
      setDownloadUrl(data.downloadUrl);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
    clearInterval(interval);
    setLoading(false);
  };

  return (
    <ToolPageLayout title="Voice Changer">
      <div className="space-y-4">
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-colors"
        >
          <Upload size={28} className="mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-sm font-semibold text-[var(--text)]">{file ? file.name : "Drop file here or click to upload"}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">MP4, MP3, WAV, MOV</p>
          <input ref={inputRef} type="file" accept="video/*,audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-2">Voice Effect</label>
          <div className="grid grid-cols-3 gap-2">
            {EFFECTS.map((e) => (
              <button
                key={e.id}
                onClick={() => setEffect(e.id)}
                className={`p-3 rounded-xl border text-center transition-colors ${effect === e.id ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)] hover:border-[var(--border)]"}`}
              >
                <span className="text-xl block mb-1">{e.icon}</span>
                <span className={`text-xs font-bold ${effect === e.id ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{e.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleProcess}
          disabled={loading || !file}
          className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
          {loading ? "Applying Effect..." : "Apply Voice Change"}
        </button>

        {loading && (
          <div className="w-full bg-[var(--surface-2)] rounded-full h-2">
            <div className="bg-[var(--accent)] h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-4">
            <AlertCircle size={16} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {downloadUrl && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-green-700">✅ Voice changed</p>
            <audio controls src={downloadUrl} className="w-full" />
            <a href={downloadUrl} download className="flex items-center justify-center gap-2 w-full bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors">
              <Download size={15} /> Download
            </a>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
