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
import { writeFileSync } from "fs";
import path from "path";
import { CAPTION_PRESETS, presetById, buildWordAss, buildTitleAss, CAPTION_PLACEMENTS } from "@/lib/editor/captionStyles";

export type Word = { word: string; start: number; end: number };

const FFMPEG_BIN =
  process.env.FFMPEG_PATH ||
  path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
const PYTHON_BIN = process.env.PYTHON_BIN || "python3";
const REFRAME = path.join(process.cwd(), "scripts", "reframe.py");

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

// Small shared ffmpeg spawn used by engine-local render helpers.
export function engineFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, ["-y", ...args]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (c) => (c === 0 ? resolve() : reject(new Error(err.slice(-500)))));
  });
}

const TW = 1080, TH = 1920;

// Blur-fill: fills the 9:16 frame with a blurred, zoomed copy of the footage behind the
// aspect-correct centered footage. Safe default when there's no confident single face.
function blurFillFilter(): string {
  return `[0:v]scale=${TW}:${TH}:force_original_aspect_ratio=increase,crop=${TW}:${TH},boxblur=22:2[bg];` +
         `[0:v]scale=${TW}:${TH}:force_original_aspect_ratio=decrease[fg];` +
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
  face?: FaceInfo | null;        // pass the reframeFace result to enable magic crop
  captions?: boolean;            // burn word captions (default true when words present)
};

/**
 * Render ONE premium vertical (1080×1920) clip: magic-crop or blur-fill framing +
 * animated word captions + a title card. This is the shared render both the campaign
 * Agent and the URL Auto Clip tool build on, so output is identical everywhere.
 */
export async function renderVerticalClip(opts: RenderClipOpts): Promise<void> {
  const { srcPath, outPath, startTime, duration, title } = opts;
  const variant = opts.variant ?? 0;
  const chosen = chooseLayout(opts.layout ?? "crop", opts.face ?? null);
  const preset = opts.captionPresetId ? presetById(opts.captionPresetId) : CAPTION_PRESETS[variant % CAPTION_PRESETS.length];
  const withCaptions = (opts.captions ?? true) && !!opts.words?.length;

  // 1) framing: magic crop when we have a confident face, else blur-fill.
  const parts: string[] = [];
  if (chosen.layout === "crop" && chosen.face) {
    parts.push(`[0:v]${magicCropFill(chosen.face, TW, TH)}[v0]`);
  } else {
    parts.push(blurFillFilter());
  }
  let last = "v0";

  // 2) captions: burn the animated word-pop track (reuses the shared caption library).
  if (withCaptions) {
    const ass = buildWordAss(opts.words as Word[], startTime, duration, preset, undefined, CAPTION_PLACEMENTS.bottom);
    if (ass) {
      const p = outPath.replace(/\.mp4$/, ".cap.ass");
      writeFileSync(p, ass, "utf8");
      parts.push(`[${last}]subtitles=${p}[v1]`); last = "v1";
    }
  }

  // 3) title card (persistent hook at the top).
  const titleAss = buildTitleAss(title, duration, variant, { topMargin: 150 });
  if (titleAss) {
    const p = outPath.replace(/\.mp4$/, ".title.ass");
    writeFileSync(p, titleAss, "utf8");
    parts.push(`[${last}]subtitles=${p}[v2]`); last = "v2";
  }

  const filter = parts.join(";");
  await engineFfmpeg([
    "-ss", String(startTime), "-i", srcPath, "-t", String(duration),
    "-filter_complex", filter, "-map", `[${last}]`, "-map", "0:a?",
    "-c:v", "libx264", "-preset", "fast", "-crf", "18",
    "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", outPath,
  ]);
}
