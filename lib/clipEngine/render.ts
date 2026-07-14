/**
 * Shared clip render ENGINE — the single source of truth for how Montview frames a
 * vertical clip. Used by BOTH the campaign Agent (app/api/agent/run) and the URL-based
 * Auto Clip tool (app/api/tools/auto-clip), so every clip — however it's created — gets
 * the same premium framing.
 *
 * Stage 1: face detection + magic crop (the biggest quality driver — see the Crayo
 * analysis: their edge is framing/tracking, not captions or codec). More of the render
 * graph (layouts, caption burn, cutClip) migrates here in later stages.
 *
 * Self-contained on purpose (its own ffmpeg/python spawns) so importing it never drags
 * in campaign/prisma code.
 */
import { spawn } from "child_process";
import { writeFileSync, statSync } from "fs";
import path from "path";
import { CAPTION_PRESETS, presetById, buildWordAss, buildTitleAss, CAPTION_PLACEMENTS } from "@/lib/editor/captionStyles";

export type Word = { word: string; start: number; end: number };

const FFMPEG_BIN =
  process.env.FFMPEG_PATH ||
  path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
const PYTHON_BIN = process.env.PYTHON_BIN || "python3";
const REFRAME = path.join(process.cwd(), "scripts", "reframe.py");
const REFRAME_TRACK = path.join(process.cwd(), "scripts", "reframe_track.py");
const BEST_THUMB = path.join(process.cwd(), "scripts", "best_thumb.py");

// ── MAGIC CROP ─────────────────────────────────────────────────────────────
// Where the subject sits in a clip, so we can crop a 9:16 frame that KEEPS them
// framed instead of dumb-centering (which chops off off-centre speakers).
export type FaceInfo = { faceRatio: number; faceYRatio: number; coverage: number; spread: number; srcW: number; srcH: number };
export type Layout = "crop" | "blur" | "split" | "letterbox";

// Run a python helper and capture stdout, with a hard timeout so a stuck OpenCV
// process can never hang a render. Returns "" on any failure (fail-open).
function pyCapture(args: string[], timeoutMs = 30000): Promise<string> {
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

/**
 * Analyse where the subject sits over a clip window so we can frame them. Runs the
 * OpenCV reframe.py over the segment; returns null (→ caller falls back to blur-fill)
 * when there's no confident, stable face.
 */
export async function reframeFace(srcPath: string, startSec: number, duration: number): Promise<FaceInfo | null> {
  try {
    const out = await pyCapture([REFRAME, srcPath, String(startSec), String(duration)], 30000);
    const j = JSON.parse(out.trim().split("\n").pop() || "{}") as Partial<FaceInfo>;
    if (typeof j.faceRatio === "number" && typeof j.srcW === "number" && j.srcW > 0) {
      return { faceRatio: j.faceRatio, faceYRatio: j.faceYRatio ?? 0.4, coverage: j.coverage ?? 0,
               spread: j.spread ?? 0, srcW: j.srcW, srcH: j.srcH ?? 0 };
    }
  } catch { /* fall through */ }
  return null;
}

// Given the subject position, build a scale+crop that fills a Tw×Th target while
// keeping the face centred (clamped so we never crop past the frame edges).
export function magicCropFill(f: FaceInfo, Tw: number, Th: number): string {
  const even = (n: number) => { const r = Math.round(n); return r % 2 ? r + 1 : r; };
  const scale = Math.max(Tw / f.srcW, Th / f.srcH);
  const sW = even(f.srcW * scale), sH = even(f.srcH * scale);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const x = even(clamp(Math.round(f.faceRatio * sW - Tw / 2), 0, sW - Tw));
  // Bias slightly above the face centre so heads sit in the upper third (more natural).
  const y = even(clamp(Math.round(f.faceYRatio * sH - Th * 0.42), 0, sH - Th));
  return `scale=${sW}:${sH},crop=${Tw}:${Th}:${x}:${y}`;
}

// Decide the real layout: honour an explicit choice, but for the default "crop" auto-pick
// the face-tracked magic crop when we have a confident, stable subject, else blur-fill
// (safe for product b-roll / group / roaming shots).
export function chooseLayout(requested: Layout, face: FaceInfo | null): { layout: Layout; face: FaceInfo | null } {
  if (requested !== "crop") return { layout: requested, face: null };
  if (face && face.coverage >= 0.4 && face.spread <= 0.33) return { layout: "crop", face };
  return { layout: "blur", face: null };
}

// ── SHOT-AWARE DYNAMIC TRACKING ──────────────────────────────────────────────
// Per-shot subject positions so the crop SNAPS to the right spot on every camera cut
// (follows whoever is on screen) instead of one static crop for the whole clip.
export type TrackSegment = { start: number; end: number; faceRatio: number; faceYRatio: number; coverage: number };
export type TrackData = { srcW: number; srcH: number; coverage: number; segments: TrackSegment[] };

export async function reframeTrack(srcPath: string, startSec: number, duration: number, fps = 4): Promise<TrackData | null> {
  try {
    const out = await pyCapture([REFRAME_TRACK, srcPath, String(startSec), String(duration), String(fps)], 90000);
    const j = JSON.parse(out.trim().split("\n").pop() || "{}") as Partial<TrackData>;
    if (typeof j.srcW === "number" && j.srcW > 0 && Array.isArray(j.segments)) {
      return { srcW: j.srcW, srcH: j.srcH ?? 0, coverage: j.coverage ?? 0, segments: j.segments };
    }
  } catch { /* fall through */ }
  return null;
}

// Build a scale + TIME-VARYING crop that snaps the crop window to each shot's subject.
// The x/y crop offsets are ffmpeg expressions (piecewise over shot end-times); commas
// inside if() are protected by the single quotes, so this is safe in a filtergraph.
export function trackedCropFilter(track: TrackData, Tw: number, Th: number): string | null {
  const segs = track.segments.filter((s) => s.end > s.start);
  if (segs.length < 1 || !track.srcW || !track.srcH) return null;
  const even = (n: number) => { const r = Math.round(n); return r % 2 ? r + 1 : r; };
  const scale = Math.max(Tw / track.srcW, Th / track.srcH);
  const sW = even(track.srcW * scale), sH = even(track.srcH * scale);
  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const xOf = (r: number) => even(cl(Math.round(r * sW - Tw / 2), 0, sW - Tw));
  const yOf = (r: number) => even(cl(Math.round(r * sH - Th * 0.42), 0, sH - Th));
  let xe = `${xOf(segs[segs.length - 1].faceRatio)}`;
  let ye = `${yOf(segs[segs.length - 1].faceYRatio)}`;
  for (let i = segs.length - 2; i >= 0; i--) {
    xe = `if(lt(t,${segs[i].end.toFixed(2)}),${xOf(segs[i].faceRatio)},${xe})`;
    ye = `if(lt(t,${segs[i].end.toFixed(2)}),${yOf(segs[i].faceYRatio)},${ye})`;
  }
  return `scale=${sW}:${sH},crop=${Tw}:${Th}:x='${xe}':y='${ye}'`;
}

// Pick a strong COVER frame (clear, central face + sharp + well-lit via best_thumb.py) and
// write it as the thumbnail — far better than a fixed t=1s grab that often lands on a blur
// or a transition. Falls back to t=1s if the picker is unavailable.
export async function bestThumbnail(clipPath: string, thumbPath: string): Promise<void> {
  let t = 1;
  try {
    const out = await pyCapture([BEST_THUMB, clipPath], 20000);
    const j = JSON.parse(out.trim().split("\n").pop() || "{}") as { time?: number };
    if (typeof j.time === "number" && isFinite(j.time) && j.time >= 0) t = j.time;
  } catch { /* fall back to t=1 */ }
  await engineFfmpeg(["-ss", String(t), "-i", clipPath, "-frames:v", "1", "-q:v", "3", "-vf", "scale=480:-1", thumbPath]);
}

// Small shared ffmpeg spawn used by engine-local render helpers.
export function engineFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, ["-y", ...args]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (c) => (c === 0 ? resolve() : reject(new Error(err.slice(-500)))));
  });
}

// Probe a media file — `ffmpeg -i` prints stream/format info to stderr (and exits non-zero
// because no output is given), so we capture stderr regardless of exit code.
function engineProbe(input: string): Promise<string> {
  return new Promise((resolve) => {
    let err = "";
    let proc: ReturnType<typeof spawn>;
    try { proc = spawn(FFMPEG_BIN, ["-hide_banner", "-i", input]); } catch { return resolve(""); }
    proc.stderr?.on("data", (d) => { err += d.toString(); });
    proc.on("close", () => resolve(err));
    proc.on("error", () => resolve(""));
  });
}

// ── QUALITY CONTROL ──────────────────────────────────────────────────────────
// Verify a RENDERED clip is actually good before it reaches a user: real file, a valid
// video stream, the expected frame size, and not truncated. Only rejects UNAMBIGUOUSLY
// broken output (empty/corrupt/wrong-size/too-short). FAIL-OPEN by design — a probe hiccup
// must never drop a good clip. Missing audio is reported (soft) but not a hard reject.
export type ClipCheck = { ok: boolean; reason?: string; hasAudio: boolean };
export async function validateRenderedClip(clipPath: string, opts?: { aspect?: AspectKey; minSec?: number }): Promise<ClipCheck> {
  try {
    const { w, h } = ASPECTS[opts?.aspect ?? "9:16"];
    // Floor is deliberately low (1s): the silence-trim can legitimately shorten a near-3s
    // clip to ~1.6s, and we must never reject those. Corruption is caught by the size /
    // stream / dimension checks; this only flags truly-broken sub-second renders.
    const minSec = opts?.minSec ?? 1;
    let st;
    try { st = statSync(clipPath); } catch { return { ok: false, reason: "missing file", hasAudio: false }; }
    if (!st.isFile() || st.size < 40_000) return { ok: false, reason: `file empty/too small (${st.size ?? 0}b)`, hasAudio: false };
    const info = await engineProbe(clipPath);
    const hasAudio = /Stream #\d+:\d+.*Audio:/.test(info);
    if (!/Stream #\d+:\d+.*Video:/.test(info)) return { ok: false, reason: "no video stream", hasAudio };
    const dim = info.match(/Video:.*?\b(\d{2,4})x(\d{2,4})\b/);
    if (dim && (Number(dim[1]) !== w || Number(dim[2]) !== h)) return { ok: false, reason: `wrong size ${dim[1]}x${dim[2]} (want ${w}x${h})`, hasAudio };
    const dm = info.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (dm) {
      const sec = (+dm[1]) * 3600 + (+dm[2]) * 60 + parseFloat(dm[3]);
      if (sec < minSec) return { ok: false, reason: `too short (${sec.toFixed(1)}s)`, hasAudio };
    }
    return { ok: true, hasAudio };
  } catch {
    return { ok: true, hasAudio: true }; // fail-open — QC must never block a good clip
  }
}

// Aspect targets for every major platform. 9:16 covers TikTok/Reels/Shorts (default);
// 1:1 + 4:5 for feed; 16:9 for YouTube. All produced from one source by the same engine.
export type AspectKey = "9:16" | "1:1" | "4:5" | "16:9";
export const ASPECTS: Record<AspectKey, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "1:1":  { w: 1080, h: 1080 },
  "4:5":  { w: 1080, h: 1350 },
  "16:9": { w: 1920, h: 1080 },
};

// Blur-fill: fills the frame with a blurred, zoomed copy of the footage behind the
// aspect-correct centered footage. Safe default when there's no confident single face.
function blurFillFilter(Tw: number, Th: number): string {
  return `[0:v]scale=${Tw}:${Th}:force_original_aspect_ratio=increase,crop=${Tw}:${Th},boxblur=22:2[bg];` +
         `[0:v]scale=${Tw}:${Th}:force_original_aspect_ratio=decrease[fg];` +
         `[bg][fg]overlay=(W-w)/2:(H-h)/2[v0]`;
}

export type RenderClipOpts = {
  srcPath: string;
  outPath: string;
  startTime: number;
  duration: number;
  title: string;                 // on-screen hook / title card text
  words?: Word[];                // word-level transcript for animated captions
  captionPresetId?: string;      // fixed caption style, else rotates by variant
  variant?: number;
  layout?: Layout;               // "crop" (magic crop) or "blur"; default crop→auto
  face?: FaceInfo | null;        // static magic-crop fallback (reframeFace result)
  track?: TrackData | null;      // per-shot tracking (reframeTrack) — preferred when multi-shot
  captions?: boolean;            // burn word captions (default true when words present)
  aspect?: AspectKey;            // output shape (default 9:16 for TikTok/Reels/Shorts)
  motion?: boolean;              // subtle opening punch + drift (default true)
  forceX264?: boolean;           // skip the GPU encoder (used by a retry to rule out a glitch)
};

/**
 * Render ONE premium vertical (1080×1920) clip: magic-crop or blur-fill framing +
 * animated word captions + a title card. This is the shared render both the campaign
 * Agent and the URL Auto Clip tool build on, so output is identical everywhere.
 */
export async function renderVerticalClip(opts: RenderClipOpts): Promise<void> {
  const { srcPath, outPath, startTime, duration, title } = opts;
  const variant = opts.variant ?? 0;
  const preset = opts.captionPresetId ? presetById(opts.captionPresetId) : CAPTION_PRESETS[variant % CAPTION_PRESETS.length];
  const withCaptions = (opts.captions ?? true) && !!opts.words?.length;
  const { w: TW, h: TH } = ASPECTS[opts.aspect ?? "9:16"];  // multi-aspect target
  const canvas = { w: TW, h: TH };

  // 1) framing, best → safest:
  //    a) SHOT-AWARE TRACKING when we have ≥2 shots with confident faces (follows the
  //       speaker across cuts — the premium look),
  //    b) static magic crop for a single stable subject,
  //    c) blur-fill for everything else (group / product / roaming).
  const parts: string[] = [];
  const track = opts.track;
  const trackFilter = (opts.layout ?? "crop") === "crop" && track && track.segments.length >= 2 && track.coverage >= 0.5
    ? trackedCropFilter(track, TW, TH) : null;
  if (trackFilter) {
    parts.push(`[0:v]${trackFilter}[v0]`);
  } else {
    const chosen = chooseLayout(opts.layout ?? "crop", opts.face ?? null);
    if (chosen.layout === "crop" && chosen.face) parts.push(`[0:v]${magicCropFill(chosen.face, TW, TH)}[v0]`);
    else parts.push(blurFillFilter(TW, TH));
  }
  let last = "v0";

  // 1b) LIFE: a quick opening punch-in (settles over ~0.4s) then a barely-there slow drift,
  // so clips never feel static (like Crayo/Opus). Subtle on purpose — energy, not motion-sick.
  if (opts.motion ?? true) {
    parts.push(
      `[${last}]zoompan=z='if(lte(on,12),1.07-0.07*on/12,min(1.0+0.00018*on,1.05))':d=1:` +
      `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${TW}x${TH}:fps=30[vm]`,
    );
    last = "vm";
  }

  // 2) captions: burn the animated word-pop track (reuses the shared caption library).
  if (withCaptions) {
    const ass = buildWordAss(opts.words as Word[], startTime, duration, preset, undefined, CAPTION_PLACEMENTS.bottom, canvas);
    if (ass) {
      const p = outPath.replace(/\.mp4$/, ".cap.ass");
      writeFileSync(p, ass, "utf8");
      parts.push(`[${last}]subtitles=${p}[v1]`); last = "v1";
    }
  }

  // 3) title card (persistent hook at the top).
  const titleAss = buildTitleAss(title, duration, variant, { topMargin: 150, canvas });
  if (titleAss) {
    const p = outPath.replace(/\.mp4$/, ".title.ass");
    writeFileSync(p, titleAss, "utf8");
    parts.push(`[${last}]subtitles=${p}[v2]`); last = "v2";
  }

  const filter = parts.join(";");
  const io = [
    "-ss", String(startTime), "-i", srcPath, "-t", String(duration),
    "-filter_complex", filter, "-map", `[${last}]`, "-map", "0:a?",
  ];
  const tail = ["-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", outPath];
  // Prefer the Mac GPU encoder (VideoToolbox): ~2× faster, ~7× less CPU/power than libx264.
  // Fall back to libx264 automatically if the hardware encoder isn't available or fails.
  if (process.env.FORCE_X264 || opts.forceX264) {
    await engineFfmpeg([...io, "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-profile:v", "high", ...tail]);
    return;
  }
  try {
    await engineFfmpeg([...io, "-c:v", "h264_videotoolbox", "-b:v", "6000k", "-profile:v", "high", ...tail]);
  } catch {
    await engineFfmpeg([...io, "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-profile:v", "high", ...tail]);
  }
}

// Render + quality-check with ONE retry: if the first render is broken (or throws), try again
// forcing libx264 to rule out a GPU-encoder glitch. Returns the final QC result — one lost
// render shouldn't mean a lost clip. Reliability step for agency-scale runs.
export async function renderClipChecked(opts: RenderClipOpts): Promise<ClipCheck> {
  const check = () => validateRenderedClip(opts.outPath, { aspect: opts.aspect, minSec: 1 });
  try {
    await renderVerticalClip(opts);
    const qc = await check();
    if (qc.ok) return qc;
  } catch { /* fall through to the retry */ }
  try {
    await renderVerticalClip({ ...opts, forceX264: true });   // retry on CPU encoder
    return await check();
  } catch (e) {
    return { ok: false, reason: `render failed: ${(e as Error).message?.slice(0, 80)}`, hasAudio: false };
  }
}
