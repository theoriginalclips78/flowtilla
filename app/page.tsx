"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Fade in once video is ready
    const v = videoRef.current;
    if (!v) return;
    const onCanPlay = () => setLoaded(true);
    v.addEventListener("canplay", onCanPlay);
    // Fallback: show after 1s even if video stalls
    const t = setTimeout(() => setLoaded(true), 1000);
    return () => { v.removeEventListener("canplay", onCanPlay); clearTimeout(t); };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">

      {/* Full-screen video background */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${loaded ? "opacity-100" : "opacity-0"}`}
        autoPlay
        muted
        loop
        playsInline
        poster="/og-poster.jpg"
      >
        {/* Replace src with your own video URL or local /public/hero.mp4 */}
        <source src="/hero.mp4" type="video/mp4" />
      </video>

      {/* Dark gradient overlay — heavier at bottom-left for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

      {/* Glassmorphic Nav */}
      <header className="absolute top-0 left-0 right-0 z-20">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#C0392B] rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M18 4l2 4H4l2-4h12zM4 10v10h16V10H4zm6 8V12l5 3-5 3z"/>
              </svg>
            </div>
            <span className="font-black text-white text-xl tracking-tight">ClipFlow</span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 backdrop-blur-md bg-white/10 border border-white/20 rounded-full px-2 py-1.5">
            {["Features", "Pricing", "Tools", "Docs"].map((item) => (
              <a
                key={item}
                href={item === "Tools" ? "/tools" : "#"}
                className="px-4 py-1.5 rounded-full text-sm font-medium text-white/80 hover:text-white hover:bg-white/15 transition-all"
              >
                {item}
              </a>
            ))}
          </nav>

          {/* CTA buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 rounded-full text-sm font-semibold text-white/80 hover:text-white backdrop-blur-md bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
            >
              Sign in
            </button>
            <button
              onClick={() => router.push("/agent")}
              className="px-4 py-2 rounded-full text-sm font-bold text-white bg-[#C0392B] hover:bg-[#a93226] transition-colors shadow-lg shadow-[#C0392B]/30"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero content — bottom-left */}
      <div className="absolute bottom-0 left-0 z-10 px-8 md:px-14 pb-14 max-w-2xl">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 backdrop-blur-md bg-white/10 border border-white/20 rounded-full px-3 py-1.5 mb-5">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-white/90">AI-Powered Video Clipping</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-black text-white leading-[1.05] tracking-tight mb-4">
          Turn any video<br />
          <span className="text-[#C0392B]">into viral clips</span><br />
          automatically.
        </h1>

        {/* Subheadline */}
        <p className="text-base text-white/70 mb-8 leading-relaxed max-w-lg">
          Paste a campaign brief. ClipFlow finds the best moments, cuts the clips,
          adds captions and subtitles, and gets them post-ready — in minutes.
        </p>

        {/* CTA row */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => router.push("/agent")}
            className="flex items-center gap-2 bg-[#C0392B] text-white font-bold px-6 py-3.5 rounded-full hover:bg-[#a93226] transition-colors shadow-xl shadow-[#C0392B]/40 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            Start Clipping Free
          </button>
          <button
            onClick={() => router.push("/tools")}
            className="flex items-center gap-2 backdrop-blur-md bg-white/10 border border-white/25 text-white font-semibold px-6 py-3.5 rounded-full hover:bg-white/20 transition-all text-sm"
          >
            Explore Tools →
          </button>
        </div>

        {/* Social proof */}
        <div className="flex items-center gap-4 mt-8">
          <div className="flex -space-x-2">
            {["#C0392B", "#0F1E3C", "#D97706", "#059669"].map((c, i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-black/30 flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: c }}>
                {["A", "K", "M", "J"][i]}
              </div>
            ))}
          </div>
          <p className="text-xs text-white/60">
            <span className="text-white font-semibold">2,400+</span> clips generated this week
          </p>
        </div>
      </div>

      {/* Bottom-right stats */}
      <div className="absolute bottom-10 right-8 z-10 hidden md:flex flex-col gap-3">
        {[
          { value: "10x", label: "Faster than manual editing" },
          { value: "$0", label: "Cost per clip" },
          { value: "15+", label: "Platforms supported" },
        ].map((s) => (
          <div key={s.label} className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-right">
            <p className="text-2xl font-black text-white leading-none">{s.value}</p>
            <p className="text-[11px] text-white/60 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
