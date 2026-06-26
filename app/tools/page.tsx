"use client";

import { useRouter } from "next/navigation";
import { Music, Zap, Mic, Image, Scissors, Volume2, MessageSquare, Headphones, Wand2 } from "lucide-react";

const quickAccess = [
  { icon: Zap, label: "Auto Clip with AI", desc: "Paste a URL — AI cuts the best clips for you", href: "/tools/auto-clip" },
  { icon: Scissors, label: "YouTube Downloader", desc: "Download any YouTube video in seconds", href: "/tools/youtube-downloader" },
  { icon: Music, label: "TikTok Downloader", desc: "Save TikTok videos without watermarks", href: "/tools/tiktok-downloader" },
];

const tools = [
  { icon: Zap, label: "Auto Clip with AI", desc: "Paste a URL — AI finds, cuts and captions clips automatically", href: "/tools/auto-clip" },
  { icon: Scissors, label: "AI Clip Finder", desc: "Automatically find the best moments in any video", href: "/tools/clip-finder" },
  { icon: Mic, label: "Voiceover Generator", desc: "Add AI-generated voiceovers to your clips", href: "/tools/voiceover" },
  { icon: Image, label: "Image Generator", desc: "Create thumbnails and visuals with AI", href: "/tools/image-generator" },
  { icon: Scissors, label: "Subtitle Remover", desc: "Clean up videos by removing embedded subtitles", href: "/tools/subtitle-remover" },
  { icon: Volume2, label: "Voice Changer", desc: "Transform voices in your video content", href: "/tools/voice-changer" },
  { icon: MessageSquare, label: "Brainstormer", desc: "Get AI-powered content ideas for your brand", href: "/tools/brainstormer" },
  { icon: Headphones, label: "Vocal Remover", desc: "Extract or remove vocals from any audio track", href: "/tools/vocal-remover" },
  { icon: Wand2, label: "Speech Enhancer", desc: "Improve audio quality and clarity automatically", href: "/tools/speech-enhancer" },
];

export default function ToolsPage() {
  const router = useRouter();

  const handleQuickAccess = (href: string) => {
    if (href.startsWith("#")) {
      document.getElementById("all-tools")?.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push(href);
    }
  };

  return (
    <div className="space-y-8">
      <div className="animate-fade-up delay-1">
        <h1 className="text-2xl font-bold text-white">Tools</h1>
        <p className="text-sm text-white/50 mt-1">Free utilities to power your content workflow</p>
      </div>

      {/* Quick access */}
      <div className="animate-fade-up delay-2">
        <h2 className="font-medium text-white/70 text-sm uppercase tracking-wider mb-3">Quick Access</h2>
        <div className="grid grid-cols-3 gap-4">
          {quickAccess.map((t) => (
            <button
              key={t.label}
              onClick={() => handleQuickAccess(t.href)}
              className="liquid-glass rounded-2xl p-5 flex items-center gap-4 text-left hover:bg-white/10 transition-all hover:scale-[1.01] border border-white/10"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              <div className="w-11 h-11 rounded-xl liquid-glass flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)" }}>
                <t.icon size={20} className="text-white" />
              </div>
              <div>
                <p className="font-medium text-white">{t.label}</p>
                <p className="text-xs text-white/50 mt-0.5">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* All tools */}
      <div id="all-tools" className="animate-fade-up delay-3">
        <h2 className="font-medium text-white/70 text-sm uppercase tracking-wider mb-3">All Tools</h2>
        <div className="grid grid-cols-4 gap-4">
          {tools.map((t) => (
            <div
              key={t.label}
              className="liquid-glass rounded-2xl p-5 flex flex-col gap-3 hover:bg-white/10 hover:scale-[1.01] transition-all border border-white/10"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              <div className="w-10 h-10 rounded-xl liquid-glass flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
                <t.icon size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-white">{t.label}</p>
                <p className="text-xs text-white/50 mt-1">{t.desc}</p>
              </div>
              <button
                onClick={() => router.push(t.href)}
                className="btn-secondary w-full justify-center py-2 text-xs"
              >
                Get Started
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
