"use client";

import { useState } from "react";
import { Loader2, Mic, AlertCircle, Download } from "lucide-react";
import ToolPageLayout from "@/components/tools/ToolPageLayout";

const VOICES = [
  { id: "onyx", label: "Male Deep", desc: "Rich & authoritative" },
  { id: "echo", label: "Male Young", desc: "Energetic & clear" },
  { id: "nova", label: "Female Professional", desc: "Crisp & confident" },
  { id: "shimmer", label: "Female Warm", desc: "Friendly & engaging" },
  { id: "fable", label: "British Male", desc: "Polished accent" },
  { id: "alloy", label: "Neutral", desc: "Balanced & versatile" },
];

const SPEEDS = [0.75, 1, 1.25, 1.5];

export default function VoiceoverPage() {
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState("nova");
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!script.trim()) return;
    setLoading(true); setError(""); setAudioUrl("");
    try {
      const res = await fetch("/api/tools/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: script.trim(), voice, speed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setAudioUrl(data.downloadUrl);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
    setLoading(false);
  };

  return (
    <ToolPageLayout title="Voiceover Generator">
      <div className="space-y-5">
        <div>
          <label className="text-xs font-semibold text-[#6B7280] uppercase block mb-1.5">Script</label>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={5}
            placeholder="Type your script here..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C0392B]/20 focus:border-[#C0392B] resize-none"
          />
          <p className="text-[11px] text-[#6B7280] mt-1 text-right">{script.length} chars</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-[#6B7280] uppercase block mb-2">Voice</label>
          <div className="grid grid-cols-3 gap-2">
            {VOICES.map((v) => (
              <button
                key={v.id}
                onClick={() => setVoice(v.id)}
                className={`p-3 rounded-xl border text-left transition-colors ${voice === v.id ? "border-[#C0392B] bg-[#C0392B]/5" : "border-gray-200 hover:border-gray-300"}`}
              >
                <p className={`text-xs font-bold ${voice === v.id ? "text-[#C0392B]" : "text-[#111827]"}`}>{v.label}</p>
                <p className="text-[10px] text-[#6B7280] mt-0.5">{v.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-[#6B7280] uppercase block mb-2">Speed</label>
          <div className="flex gap-2">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors ${speed === s ? "bg-[#0F1E3C] text-white border-[#0F1E3C]" : "border-gray-200 text-[#6B7280] hover:border-gray-300"}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !script.trim()}
          className="w-full bg-[#C0392B] text-white font-bold py-3 rounded-xl hover:bg-[#a93226] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
          {loading ? "Generating..." : "Generate Voiceover"}
        </button>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-4">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {audioUrl && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-green-700">✅ Voiceover ready</p>
            <audio controls src={audioUrl} className="w-full" />
            <a href={audioUrl} download className="flex items-center justify-center gap-2 w-full bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors">
              <Download size={15} /> Download MP3
            </a>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
