export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { mkdirSync, createReadStream, writeFileSync, readdirSync, readFileSync, renameSync, existsSync, statSync, copyFileSync } from "fs";
import path from "path";
import os from "os";
import { createId } from "@paralleldrive/cuid2";
// Use absolute path — ffmpeg-static path gets mangled by Next.js bundler at runtime
const FFMPEG_BIN = "/Users/ahmedsaciidabdullahi/clipflow/node_modules/ffmpeg-static/ffmpeg";
import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/prisma";
import { CAPTION_PRESETS, presetById, buildWordAss, buildTitleAss, CAPTION_PLACEMENTS, type CaptionPlacement } from "@/lib/editor/captionStyles";
import { renderOverlay, closeOverlayBrowser } from "@/lib/editor/overlayRender";
import { WORK_DIR } from "@/lib/workdir";

const CONCURRENCY = 1; // sequential: finish all clips from one video before moving to next
const FONT = "/System/Library/Fonts/Helvetica.ttc";

function sse(ctrl: ReadableStreamDefaultController, data: object) {
  try { ctrl.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ }
}

function ytdlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = process.env.YTDLP_PATH || `${process.env.HOME}/bin/yt-dlp`;
    const proc = spawn(bin, args);
    let out = "", err = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (c) => (c === 0 || out.trim()) ? resolve(out) : reject(new Error(err.slice(0, 600) || `yt-dlp exit ${c}`)));
  });
}

function ffmpegRun(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = FFMPEG_BIN;
    const proc = spawn(bin, ["-y", ...args]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (c) => c === 0 ? resolve() : reject(new Error(err.slice(-500))));
  });
}

// Run ffmpeg and return its stderr (for silencedetect / volumedetect parsing).
function ffmpegCapture(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_BIN, ["-hide_banner", ...args]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", () => resolve(err));
  });
}

// Run ffmpeg and return its stdout (for signalstats metadata parsing).
function ffmpegStdout(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_BIN, ["-hide_banner", ...args]);
    let out = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.on("close", () => resolve(out));
  });
}

// Single-frame brightness (YAVG 0-255) + saturation (SATAVG) via signalstats. Null on failure.
async function frameStats(srcPath: string, atSec: number): Promise<{ y: number; sat: number } | null> {
  const out = await ffmpegStdout([
    "-ss", String(atSec), "-i", srcPath, "-frames:v", "1",
    "-vf", "signalstats,metadata=print:file=-", "-f", "null", "-",
  ]);
  const y = out.match(/signalstats\.YAVG=([0-9.]+)/);
  const s = out.match(/signalstats\.SATAVG=([0-9.]+)/);
  if (!y) return null;
  return { y: parseFloat(y[1]), sat: s ? parseFloat(s[1]) : 0 };
}

// A clean opening frame is not near-black and not blown-out — this reliably catches
// fades, cuts, and white flashes at a clip's start (the common "opens on a bad frame"
// case). Brightness is source-agnostic; absolute saturation is not, so we don't gate on
// it (real colourful footage would false-positive). Fail-open: unknown stats = accept.
function cleanFrame(st: { y: number; sat: number } | null): boolean {
  return !st || (st.y >= 20 && st.y <= 226);
}

// Nudge the clip start past bad opening frames so every clip opens on clean, watchable
// footage (spec: "frame 1 is confirmed normal"). All-ffmpeg, fail-open. Returns the
// seconds to push the start forward (0 = the original start is already clean).
async function pickOpeningOffset(srcPath: string, startSec: number, maxPush = 1.0): Promise<number> {
  const first = await frameStats(srcPath, startSec);
  if (cleanFrame(first)) return 0;
  for (let off = 0.2; off <= maxPush + 1e-6; off += 0.2) {
    if (cleanFrame(await frameStats(srcPath, startSec + off))) return Math.round(off * 100) / 100;
  }
  return 0; // nothing cleaner found within the window — keep the original start
}

// OpenCV frame validator: starts every clip on a real human face and skips
// animated/green-screen/no-face intros. Falls back to the brightness-only scan when
// Python/OpenCV is unavailable, so the pipeline never stalls on it.
const PYTHON_BIN = process.env.PYTHON_BIN || "python3";
const FRAME_CHECK = path.join(process.cwd(), "scripts", "frame_check.py");

function pyCapture(args: string[], timeoutMs = 25000): Promise<string> {
  return new Promise((resolve) => {
    let out = "";
    let proc: ReturnType<typeof spawn>;
    try { proc = spawn(PYTHON_BIN, args); } catch { return resolve(""); }
    const timer = setTimeout(() => { try { proc.kill("SIGKILL"); } catch { /* noop */ } resolve(out); }, timeoutMs);
    proc.stdout?.on("data", (d) => { out += d.toString(); });
    proc.on("close", () => { clearTimeout(timer); resolve(out); });
    proc.on("error", () => { clearTimeout(timer); resolve(""); });
  });
}

async function faceAwareOffset(srcPath: string, startSec: number): Promise<{ offset: number; face: boolean }> {
  try {
    const out = await pyCapture([FRAME_CHECK, srcPath, String(startSec), "1.2"]);
    const lastLine = out.trim().split("\n").pop() || "{}";
    const j = JSON.parse(lastLine) as { offset?: number; face?: boolean };
    if (typeof j.offset === "number" && isFinite(j.offset)) return { offset: Math.max(0, j.offset), face: !!j.face };
  } catch { /* fall through to brightness-only */ }
  return { offset: await pickOpeningOffset(srcPath, startSec), face: false };
}

/**
 * Tighten pacing by trimming dead air — viral clips have no slow lead-in or pauses.
 * ADAPTIVE + SAFE: the silence threshold is set relative to the clip's own loudness
 * (so it works whether audio is quiet or music-heavy), and it bails out if it would
 * cut too little to matter or so much that it's clearly mis-detecting (music clips).
 * Cuts video + audio + burned captions together, so A/V and captions stay in sync.
 * Returns true if it produced a tightened file, false if the original should be kept.
 */
async function tightenClip(inPath: string, outPath: string, duration: number): Promise<boolean> {
  try {
    // 1) measure loudness to pick an adaptive silence floor
    const volOut = await ffmpegCapture(["-i", inPath, "-af", "volumedetect", "-f", "null", "-"]);
    const meanMatch = volOut.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/);
    const mean = meanMatch ? parseFloat(meanMatch[1]) : -20;
    // conservative: only cut audio well below the average level (true pauses, not music dips)
    const thresh = Math.min(Math.round(mean - 14), -24);

    // 2) detect silences
    const silOut = await ffmpegCapture(["-i", inPath, "-af", `silencedetect=noise=${thresh}dB:d=0.45`, "-f", "null", "-"]);
    const starts = Array.from(silOut.matchAll(/silence_start:\s*(-?\d+(?:\.\d+)?)/g)).map(m => parseFloat(m[1]));
    const ends = Array.from(silOut.matchAll(/silence_end:\s*(-?\d+(?:\.\d+)?)/g)).map(m => parseFloat(m[1]));

    // pair up silence intervals
    const silences: [number, number][] = [];
    for (let i = 0; i < starts.length; i++) {
      const s = starts[i];
      const e = ends[i] !== undefined ? ends[i] : duration;
      if (e > s) silences.push([s, e]);
    }
    if (silences.length === 0) return false;

    // 3) build KEEP ranges = video minus silences, with 0.12s padding so speech isn't clipped
    const pad = 0.12;
    const keeps: [number, number][] = [];
    let cursor = 0;
    for (const [s, e] of silences) {
      const keepEnd = Math.max(cursor, s + pad);
      if (keepEnd - cursor > 0.15) keeps.push([cursor, keepEnd]);
      cursor = Math.max(cursor, e - pad);
    }
    if (duration - cursor > 0.15) keeps.push([cursor, duration]);

    const keptTotal = keeps.reduce((a, [s, e]) => a + (e - s), 0);
    const removed = duration - keptTotal;
    // 4) safety: skip if it barely helps (<0.5s) or removes too much (>45% = mis-detect on music)
    if (removed < 0.5 || removed > duration * 0.45 || keeps.length === 0) return false;

    // 5) build select/aselect filter that drops the silent ranges and re-sequences timestamps
    const between = keeps.map(([s, e]) => `between(t,${s.toFixed(3)},${e.toFixed(3)})`).join("+");
    await ffmpegRun([
      "-i", inPath,
      "-vf", `select='${between}',setpts=N/FRAME_RATE/TB`,
      "-af", `aselect='${between}',asetpts=N/SR/TB`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", outPath,
    ]);
    return true;
  } catch {
    return false;
  }
}

function detectPlatform(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("twitch.tv")) return "twitch";
  if (url.includes("kick.com")) return "kick";
  return "other";
}

// ---------------------------------------------------------------------------
// PRE-FLIGHT: decide up-front whether this campaign is something the clipper
// can actually deliver, so we fail fast with a clear reason instead of burning
// ~10 minutes downloading/transcribing/analyzing before producing 0 clips.
// ---------------------------------------------------------------------------

// What the agent can and cannot do — fed to the feasibility check.
const AGENT_CAPABILITIES = `The agent is an automated video CLIPPER. It CAN ONLY:
- Download EXISTING public videos (YouTube videos/channels, Twitch VODs, single TikTok/Kick video links, and other yt-dlp-supported sites).
- Cut them into short VERTICAL 9:16 clips.
- Burn in auto captions, a text hook overlay, motion/zoom, light color grading, and dead-air trimming.
- Suggest a caption + hashtags and tag a brand handle.

The agent CANNOT:
- Film or record ORIGINAL footage, record a voiceover, or appear on camera (it only reuses existing footage).
- Output horizontal 16:9 or square 1:1 final clips (output is ALWAYS 9:16 vertical).
- Download from Google Drive FOLDERS, Dropbox folders, private/login-gated links, or paywalled files.
- Guarantee a creator's follower count, account age, post quotas, or that posts won't be flagged as unoriginal.
- Add licensed/trending audio automatically, run paid ads, translate/dub, or remove pre-existing burned-in subtitles.`;

// Instant structural check on a single source URL. Returns a reason string if
// the URL is a kind the agent fundamentally cannot download, else null.
// A local file/folder path the user downloaded footage into (for "use only our provided
// footage" campaigns). Absolute path, ~ home path, or file:// URL.
function localSourcePath(url: string): string | null {
  const raw = (url || "").trim();
  if (!raw) return null;
  let p = raw;
  if (p.startsWith("file://")) p = p.slice(7);
  if (p.startsWith("~")) p = path.join(os.homedir(), p.slice(1));
  if (p.startsWith("/") && existsSync(p)) return p;
  return null;
}

function badSourceReason(url: string): string | null {
  const u = (url || "").toLowerCase().trim();
  if (!u) return "empty URL";
  if (localSourcePath(url)) return null;   // local file/folder — always usable
  if (u.includes("drive.google.com") && u.includes("folders"))
    return "Google Drive folder — the agent can't enumerate or download Drive folders. Use a direct YouTube/Twitch/TikTok video or channel URL.";
  if (u.includes("drive.google.com"))
    return "Google Drive link — Drive files aren't downloadable by the clipper. Use a public YouTube/Twitch/TikTok URL.";
  if (u.includes("dropbox.com") && (u.includes("/scl/fo/") || u.includes("/sh/")))
    return "Dropbox folder — not downloadable. Use a direct public video URL.";
  if (!/^https?:\/\//.test(u))
    return "not a valid http(s) URL.";
  return null;
}

type Preflight = { ok: boolean; reason: string; note?: string };

// Full pre-flight: structural source check + a cheap LLM feasibility check on
// the campaign brief. Runs in seconds, no video downloads.
async function preflight(
  campaign: { name: string; sources: { url: string }[]; aiInstructions: string; contentRules: string; rejectionReasons?: string; captionRules?: string; platforms: string; aspectRatio?: string; extraContext?: string },
  anthropic: Anthropic,
): Promise<Preflight> {
  // 1) Sources present?
  if (!campaign.sources || campaign.sources.length === 0)
    return { ok: false, reason: "No video sources are configured. Add at least one public YouTube / Twitch / TikTok URL to this campaign." };

  // 2) Are ANY sources downloadable? (block only if EVERY source is unusable)
  const usable = campaign.sources.filter(s => !badSourceReason(s.url));
  if (usable.length === 0) {
    const first = badSourceReason(campaign.sources[0].url) || "unsupported source";
    return { ok: false, reason: `None of the sources can be downloaded. ${first}` };
  }

  // 3) Feasibility of the brief vs. agent capabilities (one cheap call).
  const brief = [
    campaign.aiInstructions && `What to look for: ${campaign.aiInstructions}`,
    campaign.contentRules && `Content rules: ${campaign.contentRules}`,
    campaign.rejectionReasons && `Rejection reasons: ${campaign.rejectionReasons}`,
    campaign.captionRules && `Caption rules: ${campaign.captionRules}`,
    campaign.aspectRatio && `Required aspect ratio: ${campaign.aspectRatio}`,
    campaign.platforms && `Platforms: ${campaign.platforms}`,
    campaign.extraContext && `Extra context: ${campaign.extraContext}`,
  ].filter(Boolean).join("\n");

  if (!brief.trim()) return { ok: true, reason: "", note: "no special requirements" };

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content:
`${AGENT_CAPABILITIES}

A user wants to run this clipping agent on a campaign with these requirements:
---
${brief.slice(0, 2000)}
---

Decide if the agent can fundamentally deliver this. Only mark it INFEASIBLE when there is a CLEAR, hard conflict with the capabilities above — e.g. it requires ORIGINAL filming / the user on camera / a recorded voiceover, requires HORIZONTAL 16:9 or SQUARE output, bans clipping/reusing footage entirely, or requires something the agent simply cannot produce. Vague rules, "be authentic/organic", tagging a brand, hashtag rules, or anything about how the clip should FEEL are all FEASIBLE.

Respond with ONLY JSON: {"feasible": true|false, "reason": "<one short sentence; if infeasible, name the exact conflicting requirement>"}` }],
    });
    const text = msg.content.map(b => (b.type === "text" ? b.text : "")).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]);
      if (j.feasible === false)
        return { ok: false, reason: String(j.reason || "the campaign requires something the clipper can't produce.") };
      return { ok: true, reason: "", note: String(j.reason || "requirements are clippable") };
    }
  } catch { /* if the feasibility check itself fails, don't block — let the run proceed */ }
  return { ok: true, reason: "", note: "requirements look clippable" };
}

// Heuristic: does this campaign require a DEDICATED / fresh posting account (vs. letting
// you post from one shared page and just submit the link)? We don't block on it — clips
// still render fine — but we surface it so the user knows BEFORE posting. Returns a short
// warning string, or null when a shared page looks fine.
function accountRequirementWarning(campaign: { aiInstructions?: string; contentRules?: string; rejectionReasons?: string; extraContext?: string }): string | null {
  const text = [campaign.aiInstructions, campaign.contentRules, campaign.rejectionReasons, campaign.extraContext]
    .filter(Boolean).join(" \n ").toLowerCase();
  if (!text.trim()) return null;
  const patterns: { re: RegExp; why: string }[] = [
    { re: /\b(dedicated|separate|exclusive|new|fresh|its own|brand[- ]?specific)\s+(account|page|profile|channel)\b/, why: "a dedicated/separate account" },
    { re: /\baccount\s+(must|should|has to|needs to)\s+(only|exclusively|solely)\b/, why: "an account that only posts their content" },
    { re: /\b(only|exclusively|solely)\s+post\b/, why: "posting their content exclusively" },
    { re: /\b(100%|all)\s+(of\s+)?(your\s+)?(content|posts|videos)\b/, why: "100% of the account's content to be theirs" },
    { re: /\bbio\s+(must|should|needs?\s+to|has to)\b/, why: "specific bio requirements" },
    { re: /\baccount\s+theme\b/, why: "a themed account" },
    { re: /\bcreate\s+(a\s+)?(new|separate|dedicated)\b/, why: "creating a new account" },
  ];
  for (const p of patterns) if (p.re.test(text)) return p.why;
  return null;
}

// Download video AND get metadata via --write-info-json (--print skips download!)
async function downloadVideo(url: string, outDir: string, platform: string): Promise<{ filePath: string; title: string; duration: number }> {
  // LOCAL FILE: user downloaded the campaign's official footage and pointed us at it.
  const local = localSourcePath(url);
  if (local && statSync(local).isFile()) {
    const ext = path.extname(local) || ".mp4";
    const dest = path.join(outDir, `source${ext}`);
    copyFileSync(local, dest);
    const meta = await ffmpegCapture(["-i", dest]);
    const m = meta.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
    const dur = m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0;
    return { filePath: dest, title: path.basename(local, path.extname(local)).slice(0, 80) || "Local clip", duration: dur };
  }

  const args = [
    url,
    "-o", path.join(outDir, "source.%(ext)s"),
    // Prefer a merged video+audio stream; fall back to progressive formats that
    // ALWAYS contain audio (never a bare video-only stream).
    "-f", "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720][acodec!=none]/best[height<=720][acodec!=none]/best[acodec!=none]/best",
    "--merge-output-format", "mp4",
    // yt-dlp needs ffmpeg to merge separate video+audio tracks — point it at ffmpeg-static
    // so the merge always succeeds and the clip keeps its audio.
    "--ffmpeg-location", FFMPEG_BIN,
    "--no-playlist",
    "--retries", "3",
    "--write-info-json",   // writes source.info.json — gives title + duration without --print
    "--quiet", "--no-warnings",
  ];
  if (platform === "tiktok") {
    args.push("--no-check-certificate");
    args.push("--extractor-retries", "5");
    args.push("--add-header", "User-Agent:Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
  }

  await ytdlp(args);

  // Find the actual video file (yt-dlp may write .mp4 or .webm)
  const files = readdirSync(outDir);
  const videoFile = files.find(f => /\.(mp4|webm|mkv|mov)$/i.test(f) && !f.includes(".info"));
  if (!videoFile) throw new Error("Download produced no video file");

  const filePath = path.join(outDir, videoFile);

  // Read metadata from info JSON
  const infoFile = files.find(f => f.endsWith(".info.json"));
  let title = "Untitled", duration = 0;
  if (infoFile) {
    try {
      const info = JSON.parse(readFileSync(path.join(outDir, infoFile), "utf8"));
      title = info.title || info.fulltitle || "Untitled";
      duration = Number(info.duration) || 0;
    } catch { /* use defaults */ }
  }

  // Fallback: get duration via ffprobe
  if (duration === 0) {
    try {
      const probe = await ytdlp(["--no-playlist", "--print", "%(duration)s", filePath]);
      duration = parseFloat(probe.trim()) || 0;
    } catch { /* leave as 0 */ }
  }

  return { filePath, title, duration };
}

async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  await ffmpegRun(["-i", videoPath, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k", "-t", "600", audioPath]);
}

function toSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
}

function buildSrt(segs: { start: number; end: number; text: string }[], offset: number, duration: number): string {
  const relevant = segs.filter(s => s.end > offset && s.start < offset + duration);
  if (relevant.length === 0) return "";
  let idx = 1;
  const lines: string[] = [];
  for (const s of relevant) {
    const start = Math.max(0, s.start - offset);
    const end = Math.min(duration, s.end - offset);
    const words = s.text.trim().split(/\s+/);
    const chunks: string[] = [];
    for (let j = 0; j < words.length; j += 5) chunks.push(words.slice(j, j + 5).join(" "));
    const chunkDur = (end - start) / Math.max(chunks.length, 1);
    for (let ci = 0; ci < chunks.length; ci++) {
      lines.push(`${idx++}\n${toSrtTime(start + ci * chunkDur)} --> ${toSrtTime(start + (ci + 1) * chunkDur)}\n${chunks[ci]}`);
    }
  }
  return lines.join("\n\n");
}

// Tolerant parser for the AI moments array. Handles markdown fences AND truncated
// responses (max_tokens cutoff) by salvaging every complete {...} object it can.
function parseMomentsLoose(raw: string): { start_time: number; end_time: number; title: string; reason: string; virality_score: string; hook: string; caption: string; platform_fit: string[] }[] {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  // First try a straight parse.
  try {
    const p = JSON.parse(cleaned);
    if (Array.isArray(p)) return p;
  } catch { /* fall through to salvage */ }
  // Salvage: pull each balanced {...} block and parse individually.
  const out: ReturnType<typeof parseMomentsLoose> = [];
  let depth = 0, start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}") { depth--; if (depth === 0 && start >= 0) {
      try { const obj = JSON.parse(cleaned.slice(start, i + 1)); if (obj && obj.start_time !== undefined) out.push(obj); } catch { /* skip */ }
      start = -1;
    } }
  }
  return out;
}

// Guaranteed clip generator — chops a video into evenly-spaced clips so we ALWAYS
// produce output even when AI analysis fails or returns nothing.
function makeTimeMoments(videoDuration: number, videoTitle: string, targetLen = 30, max = 12) {
  const moments: { start_time: number; end_time: number; title: string; reason: string; virality_score: string; hook: string; caption: string; platform_fit: string[] }[] = [];
  if (videoDuration < 5) return moments;
  const len = Math.min(targetLen, Math.max(8, Math.floor(videoDuration / 2)));
  let t = videoDuration > 20 ? 3 : 0; // skip a few intro seconds on longer videos
  let i = 0;
  while (t + 4 < videoDuration && i < max) {
    const end = Math.min(t + len, videoDuration);
    moments.push({ start_time: t, end_time: end, title: videoTitle.slice(0, 50), reason: "auto", virality_score: "medium", hook: "", caption: "", platform_fit: ["tiktok","instagram","youtube"] });
    t += len;
    i++;
  }
  return moments;
}

type Moment = { start_time: number; end_time: number; title: string; reason: string; virality_score: string; hook: string; caption: string; platform_fit: string[] };

// Snap a clip window to complete SENTENCES so it never starts or ends mid-thought — the
// biggest reason auto-clips feel "off". Moves the start back to the sentence it lands in
// and the end forward to finish the current sentence, using the transcript segments.
function snapToSentences(
  start: number, end: number,
  segs: { start: number; end: number; text: string }[],
  videoDuration: number, maxLen = 70,
): { start: number; end: number } {
  if (!segs || segs.length === 0) return { start, end };
  let s = start, e = end;
  // begin at the sentence that contains (or just precedes) the chosen start
  const startSeg = [...segs].reverse().find(g => g.start <= start + 0.3);
  if (startSeg) s = startSeg.start;
  // end at the sentence that contains (or just follows) the chosen end
  const endSeg = segs.find(g => g.end >= end - 0.3);
  if (endSeg) e = endSeg.end;
  s = Math.max(0, s);
  e = Math.min(videoDuration, e);
  if (e <= s + 2) e = Math.min(videoDuration, s + 3);
  if (e - s > maxLen) e = s + maxLen;         // don't let a run-on sentence balloon the clip
  return { start: s, end: e };
}

// Generate N alternative on-screen hooks for each moment in ONE cheap call, so variations
// feel genuinely different (not the same text N times). Fail-open: reuse the base hook.
async function generateHookVariants(anthropic: Anthropic, hooks: string[], n: number): Promise<string[][]> {
  const fallback = hooks.map(h => Array.from({ length: n }, () => h));
  if (n <= 1 || hooks.length === 0) return fallback;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content:
`For each hook below, write ${n} short, punchy alternative on-screen hook lines for the SAME clip — different angles/wording, each under 60 chars, clean text, NO emojis. Put exactly ONE word per line in ALL CAPS for emphasis (the single strongest word), never more than one. Return ONLY a JSON array of arrays: one inner array of exactly ${n} strings per hook, in order.\n\nHooks:\n${hooks.map((h, i) => `${i + 1}. ${h}`).join("\n")}` }],
    });
    const raw = (msg.content[0] as { text: string }).text;
    const m = raw.match(/\[[\s\S]*\]/);
    const parsed = m ? (JSON.parse(m[0]) as string[][]) : null;
    if (!Array.isArray(parsed)) return fallback;
    return hooks.map((h, i) => {
      const arr = Array.isArray(parsed[i]) ? parsed[i].filter(x => typeof x === "string" && x.trim()) : [];
      const out = [h, ...arr].slice(0, n);            // variant 0 = original hook
      while (out.length < n) out.push(h);
      return out;
    });
  } catch { return fallback; }
}

// Good post captions for a SHORT asset (the short path skips the moment-finder, so it has
// no caption). One cheap call → N native, cross-platform captions. Fail-open.
async function generateShortCaptions(anthropic: Anthropic, title: string, hooks: string[], captionRules: string): Promise<string[]> {
  const fallback = hooks.map(h => `${h} #fyp #viral #foryou`);
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      messages: [{ role: "user", content:
`Write ${hooks.length} great short-form post captions for the SAME video (posted to TikTok, Instagram Reels AND YouTube Shorts). Video: "${title}". On-screen hooks: ${hooks.map((h, i) => `${i + 1}) ${h}`).join("; ")}. Each caption: real creator voice (NOT an ad), under 125 chars of text, 1-2 emojis, then 4-6 hashtags mixing broad (#fyp #viral #foryou) with 2-3 niche ones. Make people want to comment.${captionRules ? ` Obey these rules: ${captionRules}.` : ""} Return ONLY a JSON array of ${hooks.length} strings.` }],
    });
    const raw = (msg.content[0] as { text: string }).text;
    const m = raw.match(/\[[\s\S]*\]/);
    const parsed = m ? (JSON.parse(m[0]) as string[]) : null;
    if (!Array.isArray(parsed)) return fallback;
    return hooks.map((h, i) => (typeof parsed[i] === "string" && parsed[i].trim()) ? parsed[i] : fallback[i]);
  } catch { return fallback; }
}

// Turn an ugly asset filename into a readable hint (strip codec/format/export junk).
function cleanTitle(name: string): string {
  let s = name.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-]+/g, " ");
  s = s.replace(/\b(hero|master|final|draft|copy|export|render|general|paid|social|web|ctv|product|color|colour|clean|v\d+|\d{2,4}p|4k|uhd|hd|1080|720|16[x×]9|9[x×]16|h264|h265|hevc|prores|422|444|hq|proxy|mp4|mov)\b/gi, " ");
  s = s.replace(/\b\d{1,3}\b/g, " ").replace(/\s+/g, " ").trim();
  return s || name;
}

// For a SHORT asset (no moment-finder), write CAPTIVATING hooks + captions from what's
// ACTUALLY said in the clip (transcript) + campaign context — never the filename. Uses a
// strong model and a prompt that bans generic AI clichés. One call.
async function generateShortMeta(anthropic: Anthropic, clipAbout: string, transcript: string, aiInstructions: string, campaignName: string, captionRules: string, n: number): Promise<{ hook: string; caption: string }[]> {
  const fallback = Array.from({ length: n }, () => ({ hook: clipAbout, caption: `${clipAbout} #fyp #viral #foryou` }));
  try {
    const spoken = transcript.trim().slice(0, 1500);
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1100,
      messages: [{ role: "user", content:
`You write hooks for viral short clips. Campaign: "${campaignName}".${aiInstructions ? ` Context: ${aiInstructions}.` : ""}
This clip is about: "${clipAbout}".
${spoken ? `WHAT'S ACTUALLY SAID IN THE CLIP (use the real, specific, surprising details from this — quote or reference the exact moment):\n"""${spoken}"""` : `(No spoken words — it's a visual/product clip. Infer the most intriguing angle.)`}

Write ${n} DIFFERENT (hook, caption) pairs.

The "hook" is the on-screen text — the first 1.5 seconds decide whether someone keeps watching or scrolls past. Your bar: a stranger scrolling at 2am has to physically stop.
- Pull the single most surprising, specific, or contrarian detail from what's ACTUALLY said/shown above and lead with it. Real numbers, real names, real stakes.
- Use ONE proven pattern per hook (mix them across the ${n}):
  • Curiosity gap — imply a payoff without giving it away ("The one thing she'd never order")
  • Contrarian/callout — challenge what people assume ("Stop drinking your protein wrong")
  • Specific number/stat ("$7 dinner. 40g protein.")
  • Open loop / cliffhanger ("Watch what happens at 0:12")
  • Confession/POV ("I was doing this completely wrong")
  • Named authority ("A chef told me to stop doing this")
- 3-8 words. Concrete beats clever. If it could describe ANY product, delete it and rewrite.
- Put exactly ONE word per hook in ALL CAPS — the single strongest/most surprising word — for emphasis (e.g. "I was ONLY hitting 60g protein"). Never more than one, never the whole hook. NO emojis in the hook itself.
- BANNED (generic AI slop — never use): "hits different", "changed my life/game", "this works", "game changer", "obsessed", "you need this", "the secret", "will blow your mind", "proved this works", "let's talk about", "here's why".
- Great examples of the bar: "She spends $400/wk on THIS", "Nobody orders it this way", "3 ingredients. That's it.", "He quit sugar for 30 days", "This is why your coffee tastes flat", "The chef who refuses to salt pasta".

The "caption" = a native cross-platform caption (TikTok/IG/Shorts): real creator voice, under 125 chars, 1-2 emojis, then 4-6 hashtags (broad #fyp #viral #foryou + niche).${captionRules ? ` MUST obey: ${captionRules}.` : ""}

Return ONLY a JSON array of ${n} objects: [{"hook":"...","caption":"..."}]` }],
    });
    const raw = (msg.content[0] as { text: string }).text;
    const m = raw.match(/\[[\s\S]*\]/);
    const parsed = m ? (JSON.parse(m[0]) as { hook?: string; caption?: string }[]) : null;
    if (!Array.isArray(parsed)) return fallback;
    return Array.from({ length: n }, (_, i) => ({
      hook: (parsed[i]?.hook || "").trim() || clipAbout,
      caption: (parsed[i]?.caption || "").trim() || `${clipAbout} #fyp #viral #foryou`,
    }));
  } catch { return fallback; }
}

// AUTOMATED SELF-VALIDATION PASS — replaces a manual "review & approve" gate.
// After the finder picks moments, a strict second pass vets each one and DROPS the
// duds (weak/generic hook, mid-conversation filler, no clear payoff, near-duplicate
// of a stronger pick). Returns the indices to KEEP. Fail-open: if validation errors
// or returns nothing usable, keep every candidate so the pipeline never stalls.
async function validateMoments(
  anthropic: Anthropic,
  videoTitle: string,
  moments: Moment[],
): Promise<number[]> {
  const keepAll = moments.map((_, i) => i);
  if (moments.length <= 1) return keepAll;
  try {
    const list = moments.map((m, i) => {
      const len = Math.round((Number(m.end_time) || 0) - (Number(m.start_time) || 0));
      return `${i}. [${len}s] score=${m.virality_score} | hook="${(m.hook || "").slice(0, 60)}" | ${(m.title || "").slice(0, 60)} — ${(m.reason || "").slice(0, 80)}`;
    }).join("\n");
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: `You are a ruthless QA gate for viral short-form clips. You receive a list of candidate clips already picked by another model. Your job is to DROP the weak ones so only scroll-stopping, self-contained moments survive.

DROP a clip if ANY apply:
- The hook is generic, vague, or boring (would not stop a scroll).
- It reads like mid-conversation filler / setup with no clear payoff, punch, reveal, or emotional spike.
- It is a near-duplicate of a stronger clip in the list (keep only the best of the overlapping set).
- The length is unreasonable for a Reel (under 6s, or over 60s — a real moment is tight).
KEEP a clip if it has a clear payoff AND a strong, curiosity-driving hook.

Be strict — it is correct and expected to drop several. But NEVER drop everything; always keep at least the single best clip.
Return ONLY a compact JSON object: {"keep":[<indices to keep>]}. No prose.`,
      messages: [{ role: "user", content: `Video: "${videoTitle}"\n\nCandidates:\n${list}` }],
    });
    const raw = (msg.content[0] as { text: string }).text;
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return keepAll;
    const parsed = JSON.parse(m[0]) as { keep?: unknown };
    const keep = Array.isArray(parsed.keep)
      ? parsed.keep.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < moments.length)
      : [];
    const uniq = Array.from(new Set(keep));
    return uniq.length > 0 ? uniq : keepAll; // never wipe out the whole video
  } catch {
    return keepAll; // fail-open — automation must not stall on a validator hiccup
  }
}

function escapeDrawtext(str: string): string {
  return str.replace(/[\\:'"[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 55);
}

// Each clip gets a different visual treatment so no two clips look the same —
// this defeats TikTok/IG "unoriginal / reposted content" detection and gives reach.
// Colours are ASS format &HAABBGGRR (alpha, blue, green, red).
type ClipStyle = {
  name: string;
  grade: string;        // ffmpeg eq color grade
  zoom: number;         // punch-in factor (1.0 = none)
  subColor: string;     // subtitle primary colour
  subOutline: string;   // subtitle outline colour
  subSize: number;      // subtitle font size
  subMargin: number;    // distance from bottom
  hookColor: string;    // hook text colour (drawtext)
  hookBox: string;      // hook box colour@alpha
  hookY: number;        // hook vertical position
};

const CLIP_STYLES: ClipStyle[] = [
  { name: "yellow-pop",  grade: "saturation=1.25:contrast=1.10:gamma=1.02", zoom: 1.10, subColor: "&H0000F0FF", subOutline: "&H00000000", subSize: 24, subMargin: 90,  hookColor: "white",  hookBox: "black@0.6",  hookY: 60 },
  { name: "clean-white", grade: "saturation=1.12:contrast=1.06",            zoom: 1.05, subColor: "&H00FFFFFF", subOutline: "&H000000FF", subSize: 22, subMargin: 110, hookColor: "yellow", hookBox: "black@0.55", hookY: 80 },
  { name: "green-punch", grade: "saturation=1.30:contrast=1.12",            zoom: 1.14, subColor: "&H0000FF66", subOutline: "&H00000000", subSize: 26, subMargin: 130, hookColor: "white",  hookBox: "#1c1c9b@0.6", hookY: 56 },
  { name: "warm-bold",   grade: "saturation=1.18:contrast=1.08:gamma=1.05", zoom: 1.08, subColor: "&H00FFFFFF", subOutline: "&H001212C8", subSize: 23, subMargin: 100, hookColor: "white",  hookBox: "#22304F@0.6", hookY: 70 },
  { name: "cyan-edge",   grade: "saturation=1.22:contrast=1.10",            zoom: 1.12, subColor: "&H00FFFF00", subOutline: "&H00000000", subSize: 25, subMargin: 120, hookColor: "black",  hookBox: "white@0.7",  hookY: 64 },
];

function buildCrop(style: ClipStyle): string {
  // Scale up by the zoom factor, then crop back to 1080x1920 = a punch-in reframe.
  const w = Math.round(1080 * style.zoom);
  const h = Math.round(1920 * style.zoom);
  return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=1080:1920,eq=${style.grade}`;
}

// Animated reframe: a continuous slow push-in/out (Ken Burns) adds MOTION so the clip
// is never a static crop — a real "creative edit" that helps with platform originality
// detection and looks more pro. `variant` rotates direction/speed for per-clip uniqueness.
function buildMotionCrop(style: ClipStyle, variant: number): string {
  // headroom to zoom into (scale a bit larger than the 1080x1920 target)
  const head = 1.18;
  const w = Math.round(1080 * head);
  const h = Math.round(1920 * head);
  const base = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
  // 3 motion modes rotating per clip: slow push-in, slow push-out, gentle pan-in
  const mode = variant % 3;
  const sp = 0.00045 + (variant % 2) * 0.0002; // slight speed variation
  let z: string;
  if (mode === 0) z = `min(1+${sp}*on,1.14)`;            // push in
  else if (mode === 1) z = `max(1.14-${sp}*on,1.0)`;     // push out (starts zoomed)
  else z = `min(1+${(sp * 0.7).toFixed(5)}*on,1.10)`;    // gentle push in
  return `${base},zoompan=z='${z}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,eq=${style.grade}`;
}

// ---------------------------------------------------------------------------
// LAYOUT ENGINE (Crayo/OpusClip-style frame layouts).
//   crop  — punch-in reframe with Ken Burns motion (the original look)
//   blur  — sharp video centred over a blurred fill of itself (no ugly crop /
//           black bars; makes low-res horizontal sources look premium)
//   split — top = the clip, bottom = looping gameplay (Subway Surfers etc.)
//           the single biggest retention lever for low-dialogue footage
// Each returns a filter_complex graph ending in [vbase] + any extra -i inputs.
// ---------------------------------------------------------------------------
type Layout = "crop" | "blur" | "split" | "letterbox";
const GAMEPLAY_PATH = process.env.GAMEPLAY_VIDEO || path.join(os.homedir(), "Downloads", "gameplay.mp4");
function gameplayAvailable(): boolean { return existsSync(GAMEPLAY_PATH); }

function layoutBase(layout: Layout, style: ClipStyle, variant: number, motion: boolean): { base: string; inputs: string[] } {
  const eq = `eq=${style.grade}`;

  // SPLIT: clip on top, looping muted gameplay on the bottom.
  if (layout === "split" && gameplayAvailable()) {
    const topH = 1180, botH = 1920 - topH; // 1180 / 740
    const base =
      `[0:v]scale=1080:${topH}:force_original_aspect_ratio=increase,crop=1080:${topH},${eq}[top];` +
      `[1:v]scale=1080:${botH}:force_original_aspect_ratio=increase,crop=1080:${botH}[bot];` +
      `[top][bot]vstack=inputs=2[vbase]`;
    // loop the gameplay forever so it never runs out, start at a random-ish offset
    const offset = (variant * 17) % 120;
    return { base, inputs: ["-stream_loop", "-1", "-ss", String(offset), "-i", GAMEPLAY_PATH] };
  }

  // LETTERBOX: whole frame scaled to full width, centred on solid black bars. The
  // cleanest treatment for screen-recordings / busy horizontal sources (a blur would
  // just blur the browser chrome). The top/bottom bars become room for the title card
  // and watermark. This is what the best auto-clippers use for stream footage.
  if (layout === "letterbox") {
    const base = `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,${eq}[vbase]`;
    return { base, inputs: [] };
  }

  // BLUR: sharp foreground centred on a blurred, zoomed copy of the same frame.
  if (layout === "blur") {
    const base =
      `[0:v]split=2[bgsrc][fgsrc];` +
      `[bgsrc]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=22:4,${eq}[bg];` +
      `[fgsrc]scale=1080:1920:force_original_aspect_ratio=decrease,${eq}[fg];` +
      `[bg][fg]overlay=(W-w)/2:(H-h)/2[vbase]`;
    return { base, inputs: [] };
  }

  // CROP (default): animated push-in/out reframe, or a static reframe.
  if (motion) {
    const head = 1.18;
    const w = Math.round(1080 * head), h = Math.round(1920 * head);
    const mode = variant % 3;
    const sp = 0.00045 + (variant % 2) * 0.0002;
    let z: string;
    if (mode === 0) z = `min(1+${sp}*on,1.14)`;
    else if (mode === 1) z = `max(1.14-${sp}*on,1.0)`;
    else z = `min(1+${(sp * 0.7).toFixed(5)}*on,1.10)`;
    const base = `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},zoompan=z='${z}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,${eq}[vbase]`;
    return { base, inputs: [] };
  }
  const w = Math.round(1080 * style.zoom), h = Math.round(1920 * style.zoom);
  const base = `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=1080:1920,${eq}[vbase]`;
  return { base, inputs: [] };
}

// Chain post filters (subtitles, hook) onto the [vbase] node and append the
// audio chain, yielding a complete filter_complex + the -map labels.
function assembleGraph(base: string, post: string[], withAudio: boolean, overlayPng?: string): { graph: string; maps: string[] } {
  let videoGraph: string;
  // When a Chrome-rendered overlay PNG (hook + banner + emoji) is present, the post chain
  // ends in [vpre] and we composite the overlay on top via the `movie` source filter.
  const finalLabel = overlayPng ? "[vpre]" : "[v]";
  if (post.length === 0) {
    videoGraph = base.replace(/\[vbase\]$/, finalLabel);
  } else {
    const parts = [base];
    let label = "vbase";
    post.forEach((f, i) => {
      const out = i === post.length - 1 ? finalLabel : `[p${i}]`;
      parts.push(`[${label}]${f}${out}`);
      label = `p${i}`;
    });
    videoGraph = parts.join(";");
  }
  if (overlayPng) {
    videoGraph += `;movie=${overlayPng}[ovl];[vpre][ovl]overlay=0:0[v]`;
  }
  if (withAudio) {
    return { graph: `${videoGraph};[0:a]dynaudnorm=f=150:g=15[a]`, maps: ["-map", "[v]", "-map", "[a]"] };
  }
  return { graph: videoGraph, maps: ["-map", "[v]"] };
}

async function cutClip(
  srcPath: string, outPath: string,
  startTime: number, duration: number,
  transcript: { start: number; end: number; text: string }[],
  title: string,
  variant: number = 0,
  words: { word: string; start: number; end: number }[] = [],
  captionPresetId?: string,
  motion: boolean = true,
  layout: Layout = "letterbox",
  captionMode: "lines" | "word" = "lines",
  captionPosition: "auto" | "top" | "middle" | "bottom" = "auto",
  watermarkText: string = "",
  bottomBanner: string = "",
): Promise<void> {
  const style = CLIP_STYLES[variant % CLIP_STYLES.length];

  // Pick an animated caption preset: campaign-fixed if set, otherwise rotate for uniqueness.
  const preset = captionPresetId
    ? presetById(captionPresetId)
    : CAPTION_PRESETS[variant % CAPTION_PRESETS.length];

  // CAPTION POSITION (automated): "auto" picks the spot that reads best for each layout —
  // bottom-third for crop, middle (on the centred footage band) for blur, bottom (over the
  // gameplay strip) for split. An explicit top/middle/bottom always wins.
  // Captions sit on the footage band for layouts with empty top/bottom space.
  const autoPos: "top" | "middle" | "bottom" = (layout === "blur" || layout === "letterbox") ? "middle" : "bottom";
  const placement: CaptionPlacement = CAPTION_PLACEMENTS[captionPosition === "auto" ? autoPos : captionPosition];

  const safeTitle = escapeDrawtext(title);
  const { base, inputs } = layoutBase(layout, style, variant, motion);
  // TITLE. A clean PERSISTENT white title card, rendered via libass so it's bold and
  // AUTO-WRAPS (long titles used to clip at the frame edges). For letterbox it sits in
  // the top black bar; for other layouts near the top of the frame. Non-letterbox also
  // keeps the animated 4s drawtext hook as a fallback if the title card can't be built.
  const titleTop = layout === "letterbox" ? 210 : 150;

  // PRIMARY TITLE PATH: a Chrome-rendered overlay PNG (hook + optional brand banner) so we
  // get COLOUR EMOJI, a lime-highlighted brand word, and pixel-perfect styling. Composited
  // as a persistent layer. Falls back to the libass/drawtext title if Chrome fails.
  const overlayPngPath = outPath.replace(".mp4", ".overlay.png");
  const overlayOk = await renderOverlay(
    {
      hook: title, variant, topMargin: titleTop,
      banner: bottomBanner.trim() || undefined,
      bannerKicker: bottomBanner.trim() ? "CREATE VIRAL 4K AI VIDEOS" : undefined,
    },
    overlayPngPath,
  );

  const titleAss = buildTitleAss(title, duration, variant, { topMargin: titleTop });
  const hookY = Math.round(1920 * 0.16);
  const hookDraw = `drawtext=fontfile=${FONT}:text='${safeTitle}':fontsize=58:fontcolor=${style.hookColor}:borderw=3:bordercolor=black:x=(w-text_w)/2:y=${hookY}:box=1:boxcolor=${style.hookBox}:boxborderw=20:enable='lt(t,4)'`;
  // libass title fallback (used only when the overlay didn't render).
  let titleFilter = hookDraw;
  if (titleAss) {
    const titleAssPath = outPath.replace(".mp4", ".title.ass");
    writeFileSync(titleAssPath, titleAss, "utf8");
    titleFilter = `subtitles=${titleAssPath}`;
  }
  // When the overlay handles the hook, it's not a post filter — it's composited last.
  const titlePost = overlayOk ? [] : [titleFilter];
  const overlayArg = overlayOk ? overlayPngPath : undefined;

  // WATERMARK (automated): small, semi-transparent @handle pinned near the bottom edge for
  // the whole clip — brands the clip and deters reposters. Only added when a handle is set.
  const safeMark = escapeDrawtext(watermarkText.startsWith("@") || !watermarkText ? watermarkText : `@${watermarkText}`);
  const watermarkDraw = safeMark
    ? `drawtext=fontfile=${FONT}:text='${safeMark}':fontsize=30:fontcolor=white@0.85:borderw=2:bordercolor=black@0.55:x=(w-text_w)/2:y=h-78`
    : "";
  // Overlays applied on top of captions/hook on every successful attempt.
  const extra = watermarkDraw ? [watermarkDraw] : [];

  // Render with a given list of post filters; toggles audio off for the source-has-no-audio retry.
  const render = (post: string[], withAudio = true) => {
    const { graph, maps } = assembleGraph(base, post, withAudio, overlayArg);
    return ffmpegRun([
      "-ss", String(startTime), "-i", srcPath, ...inputs, "-t", String(duration),
      "-filter_complex", graph, ...maps,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", outPath,
    ]);
  };

  // Attempt 0: BEST — layout + animated word-pop ASS captions + hook + watermark.
  const wpl = captionMode === "word" ? 1 : undefined;
  const assContent = words.length > 0 ? buildWordAss(words, startTime, duration, preset, wpl, placement) : null;
  if (assContent) {
    const assPath = outPath.replace(".mp4", ".ass");
    writeFileSync(assPath, assContent, "utf8");
    try { await render([`subtitles=${assPath}`, ...titlePost, ...extra]); return; } catch { /* fall back to SRT */ }
  }

  // Fallback subtitle path: plain SRT from sentence-level transcript.
  const srtContent = buildSrt(transcript, startTime, duration);
  const srtPath = outPath.replace(".mp4", ".srt");
  if (srtContent) writeFileSync(srtPath, srtContent, "utf8");
  const subStyle = `Fontname=Helvetica,FontSize=${style.subSize},Alignment=${placement.alignment},PrimaryColour=${style.subColor},OutlineColour=${style.subOutline},Outline=3,Shadow=0.6,Bold=1,MarginV=${placement.marginV}`;

  // Attempt 1: layout + SRT subtitles + hook + watermark
  if (srtContent) {
    try { await render([`subtitles=${srtPath}:force_style='${subStyle}'`, ...titlePost, ...extra]); return; } catch { /* try next */ }
  }
  // Attempt 2: layout + title + watermark
  try { await render([...titlePost, ...extra]); return; } catch { /* try next */ }
  // Attempt 2b: drawtext hook fallback (if the overlay AND libass title both failed)
  if (!overlayOk && titleFilter !== hookDraw) { try { await render([hookDraw, ...extra]); return; } catch { /* try next */ } }
  // Attempt 3: layout + watermark only
  try { await render([...extra]); return; } catch { /* try next */ }
  // Attempt 4: layout only, no audio (source may have no audio stream)
  try { await render([], false); return; } catch { /* try next */ }

  // Attempt 5: stream copy — always works if file is valid (no layout/overlays)
  await ffmpegRun([
    "-ss", String(startTime), "-i", srcPath, "-t", String(duration),
    "-c", "copy", "-movflags", "+faststart", outPath,
  ]);
}

const BEST_THUMB = path.join(process.cwd(), "scripts", "best_thumb.py");

// Pick the best cover time (a clear, sharp, centred face) via OpenCV, falling back to 1.0s
// when Python/OpenCV isn't available.
async function bestThumbTime(clipPath: string): Promise<number> {
  try {
    const out = await pyCapture([BEST_THUMB, clipPath], 20000);
    const j = JSON.parse(out.trim().split("\n").pop() || "{}") as { time?: number };
    if (typeof j.time === "number" && isFinite(j.time) && j.time >= 0) return j.time;
  } catch { /* fall back */ }
  return 1;
}

async function extractThumbnail(videoPath: string, thumbPath: string): Promise<void> {
  const t = await bestThumbTime(videoPath);
  await ffmpegRun(["-ss", String(t), "-i", videoPath, "-vframes", "1", "-q:v", "4", "-vf", "scale=480:-1", thumbPath]);
}

async function processOneVideo(
  src: { url: string; platform: string; title: string; id: string },
  campaignId: string, jobId: string,
  campaign: { name: string; aiInstructions: string; contentRules: string; platforms: string },
  vIdx: number, total: number,
  groq: Groq, anthropic: Anthropic,
  ctrl: ReadableStreamDefaultController,
  onClip: () => number,
): Promise<number> {
  const subId = createId();
  const dir = path.join(WORK_DIR, subId);
  const clipsDir = dir + "/clips";
  mkdirSync(clipsDir, { recursive: true });

  sse(ctrl, { step: "source_start", status: "started", isGroupHeader: true,
    message: `── Video ${vIdx + 1}/${total}: ${src.title.slice(0, 55)} ──`, sourceIndex: vIdx });

  // ── DOWNLOAD ──────────────────────────────────────────────────
  sse(ctrl, { step: "download", status: "started", message: `📥 Downloading from ${src.platform}...` });
  let srcPath = "", videoTitle = src.title, videoDuration = 0;
  try {
    const dl = await downloadVideo(src.url, dir, src.platform);
    srcPath = dl.filePath;
    videoTitle = dl.title;
    videoDuration = dl.duration;
    const dur = `${Math.floor(videoDuration / 60)}m${String(Math.floor(videoDuration % 60)).padStart(2,"0")}s`;
    sse(ctrl, { step: "download", status: "complete", message: `✅ ${videoTitle} (${dur})` });
  } catch (err) {
    const msg = (err as Error).message || "";
    const unavailable = msg.includes("not available") || msg.includes("status code 0") || msg.includes("Private video") || msg.includes("This video is unavailable");
    if (unavailable) {
      // Mark as unavailable so we don't retry it next run
      prisma.sourceVideo.updateMany({ where: { id: src.id }, data: { status: "unavailable" } }).catch(() => {});
      sse(ctrl, { step: "download", status: "warn", message: `⚠️ Skipped (video unavailable or region-locked): ${src.title || src.url}` });
    } else {
      sse(ctrl, { step: "download", status: "error", message: `❌ Download failed: ${msg.slice(0, 120)}` });
    }
    return 0;
  }

  // Helper to save a clip and stream it to the client
  const saveAndStream = async (clipFile: string, thumbFile: string, m: {
    start_time: number; end_time: number; title: string; reason: string;
    virality_score: string; hook: string; caption: string; platform_fit: string | string[];
  }) => {
    extractThumbnail(clipFile, thumbFile).catch(() => {});
    const saved = await prisma.clip.create({ data: {
      jobId, campaignId,
      title: m.title,
      filePath: clipFile,
      downloadUrl: `/api/clip/${subId}/${path.basename(clipFile, ".mp4").replace("clip-","")}`,
      thumbnailUrl: `/api/clip/${subId}/thumb/${path.basename(clipFile, ".mp4").replace("clip-","")}`,
      startTime: m.start_time, endTime: m.end_time,
      viralityScore: m.virality_score || "medium",
      reason: m.reason || "", hook: m.hook || "", caption: m.caption || "",
      platformFit: Array.isArray(m.platform_fit) ? m.platform_fit.join(",") : (m.platform_fit || ""),
      status: "pending",
    }});
    prisma.sourceVideo.updateMany({ where: { id: src.id }, data: { status: "processed" } }).catch(() => {});
    const totalNow = onClip();
    sse(ctrl, { step: "clip_ready", status: "complete", message: `✅ ${saved.title}`,
      clip: { id: saved.id, title: saved.title, downloadUrl: saved.downloadUrl, thumbnailUrl: saved.thumbnailUrl,
        startTime: saved.startTime, endTime: saved.endTime, viralityScore: saved.viralityScore,
        reason: saved.reason, hook: saved.hook, caption: saved.caption, platformFit: saved.platformFit, sourceTitle: videoTitle },
      totalClips: totalNow });
    return saved;
  };

  // ── Campaign-level render settings (used by BOTH the short-video path and main loop) ──
  const cRec = campaign as Record<string, unknown>;
  const rsPresetId = (cRec.captionPresetId as string) || undefined;
  const rsSubsOn = cRec.subtitlesEnabled !== false;
  const rsMotion = cRec.motionEnabled !== false;
  let rsLayout = ((cRec.videoLayout as string) || "letterbox") as Layout;
  if (rsLayout === "split" && !gameplayAvailable()) rsLayout = "blur";
  const rsCaptionMode = ((cRec.captionMode as string) === "word" ? "word" : "lines") as "word" | "lines";
  const rsRawPos = String(cRec.captionPosition || "auto");
  const rsCaptionPos = (["top", "middle", "bottom"].includes(rsRawPos) ? rsRawPos : "auto") as "auto" | "top" | "middle" | "bottom";
  const rsWatermark = String(cRec.watermarkText || "").trim();
  const rsBanner = String(cRec.bottomBanner || "").trim();
  const rsVariations = Math.max(1, Math.min(3, Number(cRec.variationsPerClip) || 1));

  // ── SHORT VIDEO SHORTCUT ≤90s ──────────────────────────────────
  if (videoDuration > 0 && videoDuration <= 90) {
    sse(ctrl, { step: "cut", status: "progress", message: rsVariations > 1
      ? `⚡ Short video (${Math.round(videoDuration)}s) — making ${rsVariations} versions...`
      : `⚡ Short video (${Math.round(videoDuration)}s) — clipping with subtitles...` });

    // Transcribe the short clip so hooks + captions are based on what's ACTUALLY said —
    // not the filename. Best-effort: if it fails we fall back to a title-only hook.
    let shortTx: { start: number; end: number; text: string }[] = [];
    let shortWords: { word: string; start: number; end: number }[] = [];
    try {
      sse(ctrl, { step: "transcribe", status: "started", message: `🎙️ Transcribing clip...` });
      const audioPath = dir + "/audio.wav";
      await extractAudio(srcPath, audioPath);
      const res = await groq.audio.transcriptions.create({
        file: createReadStream(audioPath) as Parameters<typeof groq.audio.transcriptions.create>[0]["file"],
        model: "whisper-large-v3", response_format: "verbose_json",
        timestamp_granularities: ["word", "segment"],
      } as Parameters<typeof groq.audio.transcriptions.create>[0]);
      const r = res as { segments?: { start: number; end: number; text: string }[]; words?: { word: string; start: number; end: number }[] };
      shortTx = (r.segments || []).map(s => ({ start: s.start, end: s.end, text: s.text.trim() }));
      shortWords = (r.words || []).map(w => ({ word: w.word.trim(), start: w.start, end: w.end })).filter(w => w.word);
      sse(ctrl, { step: "transcribe", status: "complete", message: `✅ Transcribed (${shortTx.length} segments)` });
    } catch {
      sse(ctrl, { step: "transcribe", status: "warn", message: `⚠️ No transcript — hooks from title only` });
    }
    const shortSpoken = shortTx.map(s => s.text).join(" ").trim();

    // Write REAL creative hooks + captions from what's actually said + campaign context
    // (never the raw filename). Always at least 1; more when variations are on.
    const meta = await generateShortMeta(anthropic, cleanTitle(videoTitle), shortSpoken, String(cRec.aiInstructions || ""), campaign.name, String(cRec.captionRules || ""), rsVariations);
    const shortSubs = rsSubsOn ? shortTx : [];
    const shortSubWords = rsSubsOn ? shortWords : [];
    let made = 0;
    for (let v = 0; v < rsVariations; v++) {
      const clipFile = clipsDir + `/clip-${v}.mp4`;
      const thumbFile = clipsDir + `/thumb-${v}.jpg`;
      const hook = meta[v]?.hook || cleanTitle(videoTitle);
      try {
        await cutClip(srcPath, clipFile, 0, videoDuration, shortSubs, hook, v, shortSubWords, rsPresetId, rsMotion, rsLayout, rsCaptionMode, rsCaptionPos, rsWatermark, rsBanner);
        await saveAndStream(clipFile, thumbFile, {
          start_time: 0, end_time: videoDuration, title: hook,
          reason: "Complete short-form video", virality_score: "high",
          hook, caption: meta[v]?.caption || `${cleanTitle(videoTitle)} #fyp #viral #foryou`, platform_fit: src.platform,
        });
        made++;
      } catch (err) {
        sse(ctrl, { step: "cut", status: "error", message: `❌ ffmpeg error: ${(err as Error).message.slice(0,120)}` });
      }
    }
    sse(ctrl, { step: "source_complete", status: "complete", message: `✅ ${made} clip${made !== 1 ? "s" : ""} from "${videoTitle.slice(0,40)}"`, sourceIndex: vIdx, clipsFromSource: made });
    return made;
  }

  // ── TRANSCRIBE ─────────────────────────────────────────────────
  sse(ctrl, { step: "transcribe", status: "started", message: `🎙️ Transcribing audio...` });
  let transcript: { start: number; end: number; text: string }[] = [];
  let words: { word: string; start: number; end: number }[] = [];
  try {
    const audioPath = dir + "/audio.wav";
    await extractAudio(srcPath, audioPath);
    const res = await groq.audio.transcriptions.create({
      file: createReadStream(audioPath) as Parameters<typeof groq.audio.transcriptions.create>[0]["file"],
      model: "whisper-large-v3", response_format: "verbose_json",
      // word-level timing powers the animated "active word pops in colour" captions
      timestamp_granularities: ["word", "segment"],
    } as Parameters<typeof groq.audio.transcriptions.create>[0]);
    const r = res as { segments?: { start: number; end: number; text: string }[]; words?: { word: string; start: number; end: number }[] };
    const segs = r.segments || [];
    transcript = segs.map(s => ({ start: s.start, end: s.end, text: s.text.trim() }));
    words = (r.words || []).map(w => ({ word: w.word.trim(), start: w.start, end: w.end })).filter(w => w.word);
    sse(ctrl, { step: "transcribe", status: "complete", message: `✅ Transcribed (${transcript.length} segments, ${words.length} words)` });
  } catch {
    sse(ctrl, { step: "transcribe", status: "warn", message: `⚠️ Transcription failed — using time-based clips` });
  }

  // ── ANALYZE ────────────────────────────────────────────────────
  sse(ctrl, { step: "analyze", status: "started", message: `🤖 Claude finding viral moments...` });
  let moments: { start_time: number; end_time: number; title: string; reason: string; virality_score: string; hook: string; caption: string; platform_fit: string[] }[] = [];
  // Length is fully automatic — the AI decides per clip. These defaults only feed
  // the no-transcript / time-based fallback paths (0 or unset = use smart defaults).
  const rawMin = Number((campaign as Record<string,unknown>).clipLengthMin);
  const rawMax = Number((campaign as Record<string,unknown>).clipLengthMax);
  const clipMin = rawMin > 0 ? rawMin : 12;
  const clipMax = rawMax > 0 ? rawMax : 30;
  try {
    const transcriptText = transcript.length > 0
      ? transcript.map(s => `[${s.start.toFixed(1)}s] ${s.text}`).join("\n")
      : `No transcript available. Video duration: ${videoDuration}s. Suggest 8 evenly spaced clips each exactly ${Math.round((clipMin + clipMax) / 2)}s long (between ${clipMin}s–${clipMax}s). Start first clip at 30s, space them evenly.`;

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: `You are a world-class viral short-form clipper for the campaign "${campaign.name}". Your ONLY job is picking moments that make someone STOP SCROLLING and watch.

HOW TO PICK (in priority order):
1. Pick moments with a clear PAYOFF or PUNCH — a funny line, a shocking reaction, an impressive feat, a hot take, a "wait what?" beat, a satisfying reveal. NO boring setup, NO rambling, NO mid-conversation filler.
2. The clip MUST start exactly ON the attention-grabbing instant. Trim all dead air before it. The first 1.5 seconds decide everything.
3. SHORT WINS. Best length is 8-25 seconds. Only go longer if the payoff genuinely needs it. NEVER over 45 seconds. A tight 12s clip beats a loose 60s clip every time.
4. The moment must be self-explanatory without outside context.

THE "hook" FIELD IS CRITICAL — it becomes on-screen text in the first seconds. Write a SCROLL-STOPPING line, 3-7 words, using one of these PROVEN viral formulas (these are the only patterns that consistently hold 70%+ of viewers past 3s):
- OUTCOME-FIRST (state the result/payoff up front): "He benched 405 raw", "This cost him $10k"
- CURIOSITY GAP: "He eats HOW much?!", "Wait for the REACTION"
- CONTRARIAN / BOLD CLAIM: "Stop doing cardio", "Rest days are a scam"
- OPEN LOOP: "Nobody talks about this", "This changes everything"
- CONFESSION: "I was doing this wrong for years"
NEVER use a STORY-SETUP opener ("Let me tell you about the time...", "So basically...") — they need trust before the payoff and they kill retention. NEVER copy the video title or write a dull description ("Gym haul reaction").

"virality_score" — be HONEST and strict. "high" = genuinely scroll-stopping (a real payoff + a strong hook). "medium" = decent but not special. "low" = filler. Most moments are NOT high; only the truly great ones are.

Rules: ${campaign.contentRules || "feel authentic and organic"}. Target platforms: ${campaign.platforms || "tiktok,instagram,youtube"}.

Keep "reason" under 12 words.

"caption" — THIS MATTERS, the SAME caption gets posted on TikTok, Instagram Reels AND YouTube Shorts, so make it genuinely good and native to all three. Write like a real creator, NOT an ad. Pick ONE angle: a relatable confession ("POV: you..."), a bold claim, a curiosity gap, or a real reaction. Under 125 chars of actual text. Then add 1-2 fitting emojis and 4-6 hashtags — mix 2-3 BROAD reach tags (#fyp #viral #foryou #reels) with 2-3 SPECIFIC to the topic/niche. Make people want to comment. Do NOT just repeat the on-screen hook, do NOT be generic ("check this out 🔥"), do NOT sound salesy.${(campaign as { captionRules?: string }).captionRules ? ` You MUST also obey these campaign caption rules: ${(campaign as { captionRules?: string }).captionRules}` : ""}

The "hook" (on-screen text) MUST put exactly ONE word in ALL CAPS — the single strongest/most surprising word — for emphasis (e.g. "He benched 405 RAW", "This cost him $10K"). Never more than one caps word, never the whole hook, and NO emojis in the hook itself. Rank STRICTLY by scroll-stopping power, best first — only include genuinely good moments (it's fine to return fewer than 8 if the video only has a few).

Return ONLY a compact valid JSON array (no markdown, no commentary). Max 8 clips.`,
      messages: [{ role: "user", content: `Video: "${videoTitle}" (${videoDuration}s)\n\nWhat to look for: ${campaign.aiInstructions || "high-energy, funny, emotional, impressive, or quotable moments"}\n\nTranscript:\n${transcriptText.slice(0, 8000)}\n\nReturn the best self-contained scroll-stopping moments (8-25s ideal, never >45s). Each: {start_time, end_time, title, reason, virality_score, hook, caption, platform_fit}${(campaign as Record<string,unknown>).extraContext ? `\n\nContext:\n${String((campaign as Record<string,unknown>).extraContext).slice(0,400)}` : ""}` }],
    });

    const raw = (msg.content[0] as { text: string }).text;
    moments = parseMomentsLoose(raw);
    if (moments.length === 0) throw new Error("no parseable moments");
    sse(ctrl, { step: "analyze", status: "complete", message: `✅ Found ${moments.length} viral moments`, momentCount: moments.length });
  } catch (err) {
    sse(ctrl, { step: "analyze", status: "warn", message: `⚠️ AI analysis unavailable (${(err as Error).message.slice(0,50)}) — auto-clipping the video instead` });
    moments = [];
  }

  // GUARANTEE clips: if the AI gave us nothing usable, chop the video into even clips.
  // These time-based clips have no hooks, so they must SKIP the validator (which would
  // wrongly drop them as "generic") — it exists to vet real AI picks, not the safety net.
  let usedFallback = false;
  if (moments.length === 0) {
    moments = makeTimeMoments(videoDuration, videoTitle, Math.round((clipMin + clipMax) / 2) || 30, 12);
    usedFallback = true;
    sse(ctrl, { step: "analyze", status: "complete", message: `✂️ Auto-generated ${moments.length} clips from this video`, momentCount: moments.length });
  }

  // ── NORMALIZE LENGTHS ──
  // Cap length for virality — long clips kill retention. A moment over MISFIRE_MAX
  // isn't a real moment, it's the finder mis-firing (e.g. an 8-minute "compilation"),
  // so we DROP it rather than keep an arbitrary 45s slice of it. Moderately-long
  // picks (45–70s) are trimmed to their first HARD_MAX seconds, which keeps the hook.
  const HARD_MAX = 45;
  const MISFIRE_MAX = 70;
  const normalized = moments
    .map(m => {
      let start = Math.max(0, Number(m.start_time) || 0);
      let rawEnd = Math.min(Number(m.end_time) || 0, videoDuration);
      // Snap AI picks to complete sentences so clips make sense (skip the time-based fallback).
      if (!usedFallback) { const snap = snapToSentences(start, rawEnd, transcript, videoDuration); start = snap.start; rawEnd = snap.end; }
      const span = rawEnd - start;
      const end = span > HARD_MAX ? start + HARD_MAX : rawEnd;
      return { ...m, start_time: start, end_time: end, _span: span };
    })
    // drop finder misfires (absurdly long picks) and anything too short to land
    .filter(m => m.start_time < videoDuration && m._span <= MISFIRE_MAX && (m.end_time - m.start_time) >= 6)
    .map(({ _span, ...m }) => { void _span; return m; });

  // ── SELF-VALIDATION GATE (automated, replaces a manual review step) ──
  // A strict second model pass drops weak/duplicate/filler picks. Fail-open.
  let validated = normalized;
  if (!usedFallback && normalized.length > 1) {
    sse(ctrl, { step: "validate", status: "started", message: `🔎 Vetting ${normalized.length} moments — dropping the weak ones...` });
    const keep = await validateMoments(anthropic, videoTitle, normalized);
    validated = keep.map(i => normalized[i]).filter(Boolean);
    const dropped = normalized.length - validated.length;
    sse(ctrl, { step: "validate", status: "complete", message: dropped > 0 ? `✅ Kept ${validated.length} strong moments (dropped ${dropped} weak)` : `✅ All ${validated.length} moments passed vetting` });
  }

  // Quality ordering: keep the floor (drops filler "low"), but RANK the best first —
  // high-virality "bankers" lead, medium picks ride along as extras at the bottom.
  const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const minViral = String((campaign as Record<string,unknown>).minVirality || "medium").toLowerCase();
  const minRank = rank[minViral] || 1;
  const scoreOf = (m: { virality_score?: string }) => rank[String(m.virality_score || "medium").toLowerCase()] || 2;
  let clipJobs = validated
    .filter(m => scoreOf(m) >= minRank)
    .sort((a, b) => scoreOf(b) - scoreOf(a))   // high clips first, mediums as extras
    .slice(0, 12);

  if (moments.length > 0 && clipJobs.length === 0 && minRank > 1) {
    sse(ctrl, { step: "filter", status: "warn", message: `⚠️ No clips met the "${minViral}+" virality bar for this video — skipping it` });
  }

  // Last-resort safety net: if everything got clamped away (and we're NOT filtering
  // for high virality), force time-based clips so the video still produces something.
  if (clipJobs.length === 0 && minRank <= 1) {
    clipJobs = makeTimeMoments(videoDuration, videoTitle, 30, 12)
      .map(m => ({ ...m, start_time: m.start_time, end_time: m.end_time }));
  }

  // VARIATIONS: turn each top moment into N posts — same footage, different hook + title
  // style — so one source yields several clips (great for volume / limited footage).
  let jobs: (Moment & { _variant?: number })[] = clipJobs;
  if (rsVariations > 1 && clipJobs.length > 0) {
    sse(ctrl, { step: "variations", status: "started", message: `🎛️ Making ${rsVariations} versions of each clip...` });
    const variantHooks = await generateHookVariants(anthropic, clipJobs.map(m => m.hook || m.title || ""), rsVariations);
    const expanded: (Moment & { _variant?: number })[] = [];
    clipJobs.forEach((m, mi) => {
      for (let v = 0; v < rsVariations; v++) {
        expanded.push({ ...m, hook: variantHooks[mi]?.[v] || m.hook, _variant: mi * rsVariations + v });
      }
    });
    jobs = expanded.slice(0, 15);
    sse(ctrl, { step: "variations", status: "complete", message: `✅ ${jobs.length} clips queued (${rsVariations}× per moment)` });
  }

  let clipsFromSource = 0;
  const clipSummaries: Record<string, unknown>[] = [];
  const results = await Promise.allSettled(jobs.map(async (m, i) => {
    const variant = m._variant ?? i;   // variations give each version a distinct title style
    const safeEnd = Math.min(m.end_time, videoDuration);
    // Start on a real face; skip black/flash + animated/no-face intros (OpenCV, with a
    // brightness-only fallback when Python/OpenCV is unavailable).
    const opening = await faceAwareOffset(srcPath, m.start_time);
    const openPush = opening.offset;
    const startForCut = m.start_time + openPush;
    const dur = Math.round(safeEnd - startForCut);
    if (dur < 3) return null;
    if (openPush > 0) sse(ctrl, { step: "cut", status: "progress", message: `🎯 Clip ${i+1}: trimmed ${openPush.toFixed(1)}s to open on ${opening.face ? "a face" : "clean footage"}` });

    sse(ctrl, { step: "cut", status: "progress", message: `✂️ Clip ${i+1}/${jobs.length}: ${m.title}` });
    const clipFile = path.join(clipsDir, `clip-${i}.mp4`);
    const thumbFile = path.join(clipsDir, `thumb-${i}.jpg`);

    // Some source footage already has burned-in captions; turn ours OFF for those.
    const useWords = rsSubsOn ? words : [];
    const useTranscript = rsSubsOn ? transcript : [];
    // The top overlay should be the scroll-stopping HOOK, not the dull video title.
    // If a moment somehow has no hook (e.g. the no-transcript time-based fallback),
    // never show raw codec/filename junk — clean it first.
    const overlayText = (m.hook && m.hook.trim()) ? m.hook.trim() : cleanTitle(m.title || videoTitle);
    await cutClip(srcPath, clipFile, startForCut, dur, useTranscript, overlayText, variant, useWords, rsPresetId, rsMotion, rsLayout, rsCaptionMode, rsCaptionPos, rsWatermark, rsBanner);

    // Tighten pacing — trim dead air for a faster, more retentive edit. Safely
    // no-ops on music-heavy clips. Only swap in the tightened file if it succeeded.
    const tightEdit = (campaign as Record<string,unknown>).tightEdit !== false;
    if (tightEdit) {
      const tightFile = path.join(clipsDir, `clip-${i}-tight.mp4`);
      const ok = await tightenClip(clipFile, tightFile, dur);
      if (ok) { try { renameSync(tightFile, clipFile); } catch { /* keep original */ } }
    }

    const saved = await saveAndStream(clipFile, thumbFile, { ...m, start_time: startForCut, end_time: safeEnd });
    // Spec-style per-clip record for the run summary.
    const hookWord = (m.hook || m.title || "clip").split(/\s+/).filter(Boolean)
      .sort((a, b) => b.length - a.length)[0]?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 16) || "clip";
    clipSummaries.push({
      index: i + 1,
      file: `clip_${String(i + 1).padStart(2, "0")}_${hookWord}.mp4`,
      title: m.title,
      hook: m.hook || "",
      source_start_sec: Number(startForCut.toFixed(2)),
      source_end_sec: Number(safeEnd.toFixed(2)),
      opening_trim_sec: openPush,
      duration_sec: dur,
      checks: { frame1_is_face: opening.face, opens_clean: true, within_90s: dur <= 90, format: "1080x1920", single_subtitle_layer: true },
    });
    return saved;
  }));

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) clipsFromSource++;
    else if (r.status === "rejected") sse(ctrl, { step: "cut", status: "error", message: `❌ ${(r.reason as Error).message?.slice(0,120)}` });
  }

  // Write a spec-style summary.json next to the clips for this source.
  try {
    writeFileSync(path.join(clipsDir, "summary.json"), JSON.stringify({
      source: videoTitle,
      source_duration_sec: Math.round(videoDuration),
      generated_at: new Date().toISOString(),
      clips_produced: clipSummaries.length,
      clips: clipSummaries.sort((a, b) => (a.index as number) - (b.index as number)),
    }, null, 2));
  } catch { /* non-fatal */ }

  sse(ctrl, { step: "source_complete", status: "complete", message: `🎉 ${clipsFromSource} clips from "${videoTitle.slice(0,40)}"`, sourceIndex: vIdx, clipsFromSource });
  return clipsFromSource;
}

export async function POST(req: NextRequest) {
  const { campaignId } = await req.json();
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { sources: true } });
  if (!campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404 });

  // Auto-brand: if the campaign has no explicit watermark, fall back to the user's saved
  // social handle so every clip gets stamped without per-campaign setup.
  if (!String((campaign as Record<string, unknown>).watermarkText || "").trim()) {
    const settings = await prisma.userSettings.findUnique({ where: { id: "default" } }).catch(() => null);
    const handle = settings?.tiktokHandle || settings?.instagramHandle || settings?.youtubeHandle || "";
    if (handle) (campaign as Record<string, unknown>).watermarkText = handle;
  }

  const job = await prisma.agentJob.create({ data: { campaignId, status: "running", startedAt: new Date(), logEntries: "[]" } });

  // Helper: append a log line to DB so the client can poll even after navigating away
  async function dbLog(entry: object) {
    try {
      const current = await prisma.agentJob.findUnique({ where: { id: job.id }, select: { logEntries: true } });
      const logs = JSON.parse(current?.logEntries || "[]");
      logs.push({ ...entry, t: new Date().toISOString() });
      await prisma.agentJob.update({ where: { id: job.id }, data: { logEntries: JSON.stringify(logs) } });
    } catch { /* non-fatal */ }
  }

  // Fire the actual work in the background — runs even if client disconnects
  void (async () => {
    let totalClips = 0;
    const onClip = () => ++totalClips;
    // null controller — logs go to DB only (no SSE needed for background mode)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const nullCtrl = { enqueue: () => {} } as unknown as ReadableStreamDefaultController;

    try {
      // ---- PRE-FLIGHT: fail fast if this campaign can't be served ----
      void dbLog({ step: "preflight", status: "started", message: "🧭 Checking the brief against what I can actually do..." });
      const pf = await preflight(campaign, anthropic);
      if (!pf.ok) {
        void dbLog({ step: "preflight", status: "error", message: `🚫 I can't run this campaign — ${pf.reason}` });
        await prisma.agentJob.update({ where: { id: job.id }, data: { status: "blocked", completedAt: new Date() } }).catch(() => {});
        return;
      }
      void dbLog({ step: "preflight", status: "complete", message: `✅ Requirements check passed${pf.note ? ` — ${pf.note}` : ""}` });

      // Heads-up (non-blocking): flag campaigns that look like they need a DEDICATED posting
      // account, so the user knows they can't just submit from one shared page.
      const acctWarn = accountRequirementWarning(campaign);
      if (acctWarn) void dbLog({ step: "preflight", status: "warn", message: `📌 Posting note: this campaign appears to require ${acctWarn} — you may not be able to submit from a shared page. Check the brief before posting.` });

      // Drop sources the clipper structurally can't download (e.g. Drive folders),
      // warning per source, but keep going with the usable ones.
      for (const s of campaign.sources) {
        const why = badSourceReason(s.url);
        if (why) void dbLog({ step: "preflight", status: "warn", message: `⚠️ Skipping a source: ${why}` });
      }

      let sourceVideos = await prisma.sourceVideo.findMany({ where: { campaignId, status: "pending" }, orderBy: { createdAt: "desc" }, take: 50 });

      if (sourceVideos.length === 0 && campaign.sources.length > 0) {
        void dbLog({ step: "discover", status: "started", message: "🔍 Scanning channels for videos..." });
        const { findAllVideos } = await import("@/lib/campaign/sourceFinder");
        const { all, errors } = await findAllVideos(campaign.sources.filter(s => !badSourceReason(s.url) && !localSourcePath(s.url)).map(s => s.url));
        for (const e of errors) void dbLog({ step: "discover", status: "warn", message: `⚠️ ${e.error.slice(0,80)}` });
        for (const v of all) {
          const ex = await prisma.sourceVideo.findFirst({ where: { campaignId, videoId: v.videoId } });
          if (!ex) await prisma.sourceVideo.create({ data: { campaignId, platform: v.platform, url: v.url, videoId: v.videoId, title: v.title, duration: v.duration, viewCount: v.viewCount || 0, uploadDate: v.uploadDate || "", status: "pending" } });
        }
        sourceVideos = await prisma.sourceVideo.findMany({ where: { campaignId, status: "pending" }, orderBy: { createdAt: "desc" }, take: 50 });
        void dbLog({ step: "discover", status: "complete", message: `✅ ${sourceVideos.length} videos queued` });
      }

      // Local footage the user downloaded — expand a folder into one entry per video file.
      const localVideos: { url: string; platform: string; title: string; id: string }[] = [];
      for (const s of campaign.sources) {
        const lp = localSourcePath(s.url);
        if (!lp) continue;
        if (statSync(lp).isDirectory()) {
          for (const f of readdirSync(lp).filter(f => /\.(mp4|mov|webm|mkv|m4v)$/i.test(f)))
            localVideos.push({ url: path.join(lp, f), platform: "local", title: f, id: `${s.id}-${f}` });
        } else {
          localVideos.push({ url: lp, platform: "local", title: path.basename(lp), id: s.id });
        }
      }

      const urlVideos = sourceVideos.length > 0
        ? sourceVideos.map(v => ({ url: v.url, platform: v.platform, title: v.title || v.url, id: v.id }))
        : campaign.sources.filter(s => !badSourceReason(s.url) && !localSourcePath(s.url)).map(s => ({ url: s.url, platform: detectPlatform(s.url), title: s.url, id: s.id }));
      const videos = [...localVideos, ...urlVideos];

      void dbLog({ step: "start", status: "started", message: `🚀 Processing ${videos.length} videos (newest first, one at a time)...` });

      // Build a stream that also mirrors every SSE message to the DB
      const dec = new TextDecoder();
      const stream = new ReadableStream({
        async start(ctrl) {
          // Proxy controller: every sse() call inside processOneVideo also writes to DB
          const dbCtrl = new Proxy(ctrl, {
            get(target, prop) {
              if (prop !== "enqueue") return (target as unknown as Record<string, unknown>)[prop as string];
              return (chunk: Uint8Array) => {
                target.enqueue(chunk);
                const text = dec.decode(chunk);
                const m = text.match(/^data: ([\s\S]+)\n\n$/);
                if (m) { try { void dbLog(JSON.parse(m[1])); } catch { /* ignore */ } }
              };
            },
          });
          for (let i = 0; i < videos.length; i += CONCURRENCY) {
            const batch = videos.slice(i, i + CONCURRENCY);
            await Promise.allSettled(batch.map((src, bi) =>
              processOneVideo(src, campaignId, job.id, campaign, i + bi, videos.length, groq, anthropic, dbCtrl, onClip)
                .catch(e => { sse(dbCtrl, { step: "error", status: "error", message: `❌ ${(e as Error).message}` }); })
            ));
          }
          await prisma.agentJob.update({ where: { id: job.id }, data: { status: "completed", completedAt: new Date() } });
          sse(dbCtrl, { step: "done", status: "complete", message: `🎉 Done — ${totalClips} clips produced`, totalClips });
          ctrl.close();
        },
      });
      // Drain the stream so processOneVideo runs to completion regardless of SSE client
      const reader = stream.getReader();
      while (true) { const { done } = await reader.read(); if (done) break; }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      void dbLog({ step: "error", status: "error", message: `❌ ${msg}` });
      await prisma.agentJob.update({ where: { id: job.id }, data: { status: "error" } }).catch(() => {});
    } finally {
      await closeOverlayBrowser().catch(() => {});   // free the shared Chrome instance
    }
  })();

  // Return the jobId immediately so the client can start polling
  return new Response(JSON.stringify({ jobId: job.id }), {
    headers: { "Content-Type": "application/json" },
  });
}
