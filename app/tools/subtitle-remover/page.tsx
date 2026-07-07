"use client";

import { useState, useRef } from "react";
import { Loader2, Upload, AlertCircle, Download } from "lucide-react";
import ToolPageLayout from "@/components/tools/ToolPageLayout";

export default function SubtitleRemoverPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [error, setError] = useState("");
  const [videoPreview, setVideoPreview] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setVideoPreview(URL.createObjectURL(f));
    setDownloadUrl(""); setError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true); setError(""); setDownloadUrl(""); setProgress(0);
    const interval = setInterval(() => setProgress((p) => Math.min(p + 5, 90)), 800);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/tools/subtitle-remover", { method: "POST", body: form });
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
    <ToolPageLayout title="Subtitle Remover">
      <div className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-colors"
        >
          <Upload size={28} className="mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-sm font-semibold text-[var(--text)]">{file ? file.name : "Drop video here or click to upload"}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">MP4, MOV, AVI supported</p>
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        {videoPreview && (
          <video src={videoPreview} controls className="w-full rounded-xl border border-[var(--border)] max-h-48 object-contain bg-black" />
        )}

        <button
          onClick={handleProcess}
          disabled={loading || !file}
          className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? "Removing Subtitles..." : "Remove Subtitles"}
        </button>

        {loading && (
          <div>
            <div className="w-full bg-[var(--surface-2)] rounded-full h-2">
              <div className="bg-[var(--accent)] h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-4">
            <AlertCircle size={16} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {downloadUrl && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-green-700 mb-3">✅ Subtitles removed</p>
            <a href={downloadUrl} download className="flex items-center justify-center gap-2 w-full bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors">
              <Download size={15} /> Download Clean Video
            </a>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
