"use client";

import { useState } from "react";
import { Loader2, Image as ImageIcon, AlertCircle, Download, RefreshCw } from "lucide-react";
import ToolPageLayout from "@/components/tools/ToolPageLayout";

const STYLES = ["Realistic", "Cartoon", "Cinematic", "Minimalist", "Dark"];
const SIZES = [
  { label: "Square", value: "1024x1024" },
  { label: "Portrait", value: "1024x1792" },
  { label: "Landscape", value: "1792x1024" },
];

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Cinematic");
  const [size, setSize] = useState("1024x1024");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(""); setImageUrl("");
    try {
      const res = await fetch("/api/tools/image-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${style} style: ${prompt.trim()}`, size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setImageUrl(data.imageUrl);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
    setLoading(false);
  };

  return (
    <ToolPageLayout title="Image Generator">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-1.5">Describe the image</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe the image you want..."
            className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-2">Style</label>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${style === s ? "bg-[var(--chip)] text-white border-[var(--chip)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border)]"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-2">Size</label>
          <div className="flex gap-2">
            {SIZES.map((s) => (
              <button
                key={s.value}
                onClick={() => setSize(s.value)}
                className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors ${size === s.value ? "bg-[var(--chip)] text-white border-[var(--chip)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
          {loading ? "Generating..." : "Generate Image"}
        </button>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-4">
            <AlertCircle size={16} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {imageUrl && (
          <div className="space-y-3">
            <img src={imageUrl} alt="Generated" className="w-full rounded-xl border border-[var(--border)]" />
            <div className="flex gap-2">
              <a href={imageUrl} download className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors text-sm">
                <Download size={14} /> Download
              </a>
              <button onClick={handleGenerate} className="flex-1 flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--text)] font-semibold py-2.5 rounded-xl hover:bg-[var(--surface-2)] text-sm">
                <RefreshCw size={14} /> Generate Another
              </button>
            </div>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
