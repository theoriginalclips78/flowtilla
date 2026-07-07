"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, DollarSign, Upload, CheckCircle, AlertCircle, Zap, Star, TrendingUp, Clock, Send } from "lucide-react";

const STEPS = [
  {
    step: "01",
    icon: <Zap size={20} className="text-[var(--accent)]" />,
    title: "Run the Agent",
    desc: "Go to the Agent page, select a campaign, and hit Run. The agent pulls the latest videos from the campaign's source channels, picks the best 30–120s moments, and clips them automatically.",
    tips: ["The agent always processes newest videos first", "Re-run anytime to grab new videos — already-clipped videos are skipped", "Each campaign has its own content rules the agent follows"],
  },
  {
    step: "02",
    icon: <CheckCircle size={20} className="text-[var(--accent)]" />,
    title: "Review & Approve Clips",
    desc: "Head to the Clips page. Every clip is grouped by campaign. Watch each one, check the hook and caption, then approve or discard. Only approved clips should be posted.",
    tips: ["Click a clip thumbnail to preview it fullscreen", "Press A to approve, D to discard while previewing", "Edit the caption before posting — make it feel like your own voice"],
  },
  {
    step: "03",
    icon: <Upload size={20} className="text-[var(--accent)]" />,
    title: "Post the Clip",
    desc: "Once a clip is approved, hit Post on the card. Choose TikTok or Instagram, edit the caption, and post directly from the app. You can also download and post manually.",
    tips: ["Connect your accounts once in Settings → Connected Accounts", "Post between 6–9pm in your audience's timezone for best reach", "Don't bulk-post — space clips out by at least 2–3 hours per platform"],
  },
  {
    step: "04",
    icon: <DollarSign size={20} className="text-[var(--accent)]" />,
    title: "Get Paid",
    desc: "Submit your posted clips to the campaign for payment review. The brand verifies your clip meets the content rules, checks performance, and pays out based on CPM or per-clip rate.",
    tips: ["CPM = cost per 1,000 views — more views = more money", "Check campaign Min Payout — some require a view threshold before they pay", "Keep your post live for the full Post Duration listed on the campaign"],
  },
];

const REWARDS: { platform: string; program: string; rate: string; notes: string; color: string }[] = [
  { platform: "TikTok", program: "TikTok Creativity Program", rate: "$0.40–$1.00 per 1K views", notes: "Must have 10K+ followers and 100K views in last 30 days to qualify", color: "var(--chip)" },
  { platform: "Instagram", program: "Instagram Reels Bonus", rate: "Varies — up to $1,200/mo", notes: "Invite-only. Instagram selects creators. Check Bonuses tab in your Instagram account", color: "#833AB4" },
  { platform: "YouTube", program: "YouTube Shorts Fund", rate: "$100–$10,000/mo", notes: "Based on views and engagement. Paid monthly via AdSense", color: "#DC2626" },
  { platform: "Campaign CPM", program: "Brand Campaign Payouts", rate: "Set by each campaign", notes: "Paid by the brand directly. Check each campaign card for CPM, Max/clip, and Min payout", color: "var(--accent)" },
];

const TIPS = [
  { icon: <TrendingUp size={16} />, title: "Hook in the first 2 seconds", body: "The algorithm decides whether to keep showing your clip based on how many people watch past the first 2–3 seconds. Start with the most interesting or surprising moment, not a slow intro." },
  { icon: <Star size={16} />, title: "Caption = context, not promotion", body: 'Captions like "You need to see this" or "POV: you just realized..." perform far better than "Buy now" or "Check the link in bio." Feel like a person, not a brand.' },
  { icon: <Clock size={16} />, title: "Posting frequency matters", body: "1–3 posts per day is the sweet spot on TikTok. More than that and your own posts compete with each other. Less than 3/week and the algorithm deprioritizes your account." },
  { icon: <AlertCircle size={16} />, title: "Don't repost identical clips", body: "Platforms penalize duplicate content. Even if the same clip performed well, don&apos;t repost it — make a new cut with a different start time or caption angle." },
  { icon: <Send size={16} />, title: "Tag the brand account", body: "Most campaigns require you to tag the brand's official account. Check the campaign's Tagging section — missing tags = rejected submission = no pay." },
  { icon: <CheckCircle size={16} />, title: "Meet the audience requirement", body: "Some campaigns require 40%+ Tier 1 audience (US, UK, Canada, Australia). Check your TikTok / Instagram analytics before applying to make sure your audience qualifies." },
];

function AccordionSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="panel overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
        style={{ borderBottom: open ? "1px solid var(--border)" : "none" }}>
        <h2 className="font-bold text-[var(--text)] text-base">{title}</h2>
        {open ? <ChevronUp size={18} className="text-[var(--text-light)]" /> : <ChevronDown size={18} className="text-[var(--text-light)]" />}
      </button>
      {open && <div className="px-6 py-5">{children}</div>}
    </div>
  );
}

export default function GuidePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">

      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold text-[var(--text)]">How It Works</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Step-by-step guide to posting clips and getting paid</p>
      </div>

      {/* Steps */}
      <AccordionSection title="📋 Posting a Clip — Step by Step">
        <div className="space-y-6">
          {STEPS.map((s) => (
            <div key={s.step} className="flex gap-4">
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-soft)", border: "1px solid var(--border)" }}>
                  {s.icon}
                </div>
                <div className="w-px flex-1 mt-2" style={{ background: "var(--border)", minHeight: 24 }} />
              </div>
              <div className="pb-6 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-[var(--accent)] tracking-widest">STEP {s.step}</span>
                </div>
                <h3 className="font-bold text-[var(--text)] text-base mb-1">{s.title}</h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-3">{s.desc}</p>
                <ul className="space-y-1.5">
                  {s.tips.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--text)]">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* How you get paid */}
      <AccordionSection title="💰 How You Get Paid">
        <div className="space-y-3 mb-5">
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            There are two ways to earn: <strong className="text-[var(--text)]">platform creator programs</strong> (the platform pays you for views) and <strong className="text-[var(--text)]">brand campaign payouts</strong> (the brand pays you for posting their content). You can stack both at the same time.
          </p>
        </div>
        <div className="space-y-3">
          {REWARDS.map((r) => (
            <div key={r.platform} className="flex gap-4 p-4 rounded-xl" style={{ background: "#F8FAFC", border: "1px solid var(--border)" }}>
              <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                style={{ background: r.color }}>
                {r.platform[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-semibold text-[var(--text)] text-sm">{r.program}</p>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--border)" }}>{r.rate}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{r.notes}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-4 rounded-xl" style={{ background: "var(--accent-soft)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-bold text-[var(--accent)] mb-1">IMPORTANT — Campaign Submission</p>
          <p className="text-sm text-[var(--text)] leading-relaxed">
            After posting a campaign clip, you must submit it to the brand for review. Keep the video live, tag the correct accounts, and don&apos;t edit or delete it. Payment is only released after the brand confirms it meets their content rules and the view minimum.
          </p>
        </div>
      </AccordionSection>

      {/* Tips */}
      <AccordionSection title="⚡ Tips to Maximize Performance">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIPS.map((t, i) => (
            <div key={i} className="p-4 rounded-xl" style={{ background: "#F8FAFC", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-2 text-[var(--accent)]">
                {t.icon}
                <p className="font-semibold text-[var(--text)] text-sm">{t.title}</p>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* Campaign requirements */}
      <AccordionSection title="✅ Campaign Requirements Checklist">
        <p className="text-sm text-[var(--text-muted)] mb-4">Before submitting a clip to a brand campaign, make sure you can check every box:</p>
        <div className="space-y-2">
          {[
            "Clip only uses footage from the campaign's approved source channels/links",
            "The brand account is tagged correctly on every platform",
            "Caption does NOT contain promotional language (no 'Buy now', 'Get this', 'Click link')",
            "Content feels organic — not like an ad",
            "Clip is the correct aspect ratio (usually 9:16 vertical)",
            "Your audience meets the Tier 1 % requirement if listed",
            "Post stays live for the full Post Duration listed on the campaign",
            "Video meets the minimum engagement threshold before submission",
          ].map((item, i) => (
            <label key={i} className="flex items-start gap-3 p-3 rounded-xl cursor-pointer hover:bg-[var(--accent-soft)] transition-colors group">
              <input type="checkbox" className="mt-0.5 accent-[var(--accent)] w-4 h-4 flex-shrink-0" />
              <span className="text-sm text-[var(--text)]">{item}</span>
            </label>
          ))}
        </div>
      </AccordionSection>

    </div>
  );
}
