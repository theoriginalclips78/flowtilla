"use client";

import { useState, useRef } from "react";
import { Loader2, Upload, AlertCircle, Download } from "lucide-react";
import ToolPageLayout from "@/components/tools/ToolPageLayout";

export default function VocalRemoverPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"instrumental" | "vocals">("instrumental");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ instrumentalUrl: string; vocalsUrl: string } | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => { setFile(f); setResult(null); setError(""); };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true); setError(""); setResult(null); setProgress(0);
    const interval = setInterval(() => setProgress((p) => Math.min(p + 5, 90)), 800);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", mode);
      const res = await fetch("/api/tools/vocal-remover", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");
      setProgress(100);
      setResult(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
    clearInterval(interval);
    setLoading(false);
  };

  return (
    <ToolPageLayout title="Vocal Remover">
      <div className="space-y-4">
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
        >
          <Upload size={28} className="mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-sm font-semibold text-[var(--text)]">{file ? file.name : "Drop audio/video here or click to upload"}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">MP4, MP3, WAV supported</p>
          <input ref={inputRef} type="file" accept="video/*,audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-2">Output</label>
          <div className="flex gap-3">
            {([["instrumental", "🎵 Instrumental only", "Remove vocals, keep music"], ["vocals", "🎤 Vocals only", "Remove music, keep voice"]] as const).map(([val, label, desc]) => (
              <button
                key={val}
                onClick={() => setMode(val)}
                className={`flex-1 p-3 rounded-xl border text-left transition-colors ${mode === val ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"}`}
              >
                <p className={`text-xs font-bold ${mode === val ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{label}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleProcess}
          disabled={loading || !file}
          className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? "Processing..." : "Remove Vocals"}
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

        {result && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-green-700">✅ Done</p>
            {result.instrumentalUrl && (
              <a href={result.instrumentalUrl} download className="flex items-center justify-center gap-2 w-full bg-[var(--chip)] text-white font-bold py-2.5 rounded-xl hover:bg-[var(--chip)] transition-colors text-sm">
                <Download size={14} /> Download Instrumental
              </a>
            )}
            {result.vocalsUrl && (
              <a href={result.vocalsUrl} download className="flex items-center justify-center gap-2 w-full bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors text-sm">
                <Download size={14} /> Download Vocals
              </a>
            )}
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
