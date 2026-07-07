"use client";

import { useState } from "react";
import { Loader2, Download, AlertCircle } from "lucide-react";
import ToolPageLayout from "@/components/tools/ToolPageLayout";

interface Result { title: string; duration: number; downloadUrl: string; }

export default function YouTubeDownloaderPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  const handleDownload = async () => {
    if (!url.trim()) return;
    setLoading(true); setError(""); setResult(null); setProgress(0);
    const interval = setInterval(() => setProgress((p) => Math.min(p + 8, 90)), 600);
    try {
      const res = await fetch("/api/tools/youtube-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Download failed");
      setProgress(100);
      setResult(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
    clearInterval(interval);
    setLoading(false);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <ToolPageLayout title="YouTube Downloader">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-1.5">YouTube URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleDownload()}
            placeholder="Paste YouTube URL here..."
            className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
          />
        </div>

        <button
          onClick={handleDownload}
          disabled={loading || !url.trim()}
          className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {loading ? "Downloading..." : "Download"}
        </button>

        {loading && (
          <div>
            <div className="w-full bg-[var(--surface-2)] rounded-full h-2">
              <div className="bg-[var(--accent)] h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1 text-center">{progress}%</p>
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
            <div>
              <p className="font-semibold text-[var(--text)]">{result.title}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Duration: {fmt(result.duration)}</p>
            </div>
            <a
              href={result.downloadUrl}
              download
              className="flex items-center justify-center gap-2 w-full bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors"
            >
              <Download size={15} /> Download MP4
            </a>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
