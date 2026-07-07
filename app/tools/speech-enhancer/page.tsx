"use client";

import { useState, useRef } from "react";
import { Loader2, Upload, AlertCircle, Download } from "lucide-react";
import ToolPageLayout from "@/components/tools/ToolPageLayout";

const OPTIONS = [
  { id: "denoise", label: "Reduce background noise" },
  { id: "normalize", label: "Normalize volume" },
  { id: "clarity", label: "Enhance clarity" },
  { id: "echo", label: "Remove echo" },
];

export default function SpeechEnhancerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [opts, setOpts] = useState(["denoise", "normalize", "clarity", "echo"]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ originalUrl: string; enhancedUrl: string } | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => { setFile(f); setResult(null); setError(""); };
  const toggleOpt = (id: string) => setOpts((prev) => prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]);

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true); setError(""); setResult(null); setProgress(0);
    const interval = setInterval(() => setProgress((p) => Math.min(p + 6, 90)), 700);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("options", JSON.stringify(opts));
      const res = await fetch("/api/tools/speech-enhancer", { method: "POST", body: form });
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
    <ToolPageLayout title="Speech Enhancer">
      <div className="space-y-4">
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
        >
          <Upload size={28} className="mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-sm font-semibold text-[var(--text)]">{file ? file.name : "Drop audio/video here or click to upload"}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">MP4, MP3, WAV, MOV</p>
          <input ref={inputRef} type="file" accept="video/*,audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-2">Enhancements</label>
          <div className="space-y-2">
            {OPTIONS.map((o) => (
              <label key={o.id} className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => toggleOpt(o.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${opts.includes(o.id) ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border)]"}`}
                >
                  {opts.includes(o.id) && <span className="text-white text-xs">✓</span>}
                </div>
                <span className="text-sm text-[var(--text)]">{o.label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleProcess}
          disabled={loading || !file || opts.length === 0}
          className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? "Enhancing..." : "Enhance Audio"}
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
            <p className="text-sm font-semibold text-green-700">✅ Enhancement complete</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1 font-medium">Before</p>
                <audio controls src={result.originalUrl} className="w-full" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1 font-medium">After</p>
                <audio controls src={result.enhancedUrl} className="w-full" />
              </div>
            </div>
            <a href={result.enhancedUrl} download className="flex items-center justify-center gap-2 w-full bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors">
              <Download size={15} /> Download Enhanced Audio
            </a>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
