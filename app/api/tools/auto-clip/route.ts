export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { mkdirSync, createReadStream, existsSync } from "fs";
import { createId } from "@paralleldrive/cuid2";
import ffmpegStatic from "ffmpeg-static";
import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicText } from "@/lib/anthropic/text";
import { reframeFace, reframeTrack, renderClipChecked, bestThumbnail, ASPECTS, type Word, type AspectKey } from "@/lib/clipEngine/render";

if (ffmpegStatic) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpeg = require("fluent-ffmpeg") as { setFfmpegPath: (p: string) => void };
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

function sse(ctrl: ReadableStreamDefaultController, data: object) {
  ctrl.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

// YouTube extraction now REQUIRES a JS runtime; yt-dlp only auto-enables deno. We point it
// at the server's own node binary (always present) so downloads don't silently fail.
const YTDLP_JS_RUNTIME = process.env.YTDLP_JS_RUNTIME || `node:${process.execPath}`;

function ytdlp(args: string[]): Promise<string> {
  // Always give yt-dlp a JS runtime (YouTube requires one now) and our bundled ffmpeg
  // (needed to merge bestvideo+bestaudio). Both are harmless on metadata-only calls.
  const base = ["--js-runtimes", YTDLP_JS_RUNTIME];
  if (ffmpegStatic) base.push("--ffmpeg-location", ffmpegStatic);
  return new Promise((resolve, reject) => {
    const bin = process.env.YTDLP_PATH || `${process.env.HOME}/bin/yt-dlp`;
    const proc = spawn(bin, [...base, ...args]);
    let out = ""; let err = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0 || out.trim()) resolve(out);
      else reject(new Error(err.slice(0, 400)));
    });
  });
}

function ffmpegRun(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = ffmpegStatic || "ffmpeg";
    const proc = spawn(bin, ["-y", ...args]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.slice(-300)));
    });
  });
}

interface Moment {
  start_time: number;
  end_time: number;
  title: string;
  reason: string;
  virality_score: string;
  hook?: string;
  caption?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, maxClips = 5, minDuration = 20, maxDuration = 90 } = body;
  // EDIT TIER (like Crayo's "how edited?"): maps to the engine's framing/caption/title/motion
  // toggles. "full" = the works; "magic" = reframe + motion only; "subtitles" = captions +
  // title, no magic crop or motion; "raw" = just a clean vertical cut.
  const editLevel: string = ["full", "magic", "subtitles", "raw"].includes(body.editLevel) ? body.editLevel : "full";
  const edit = {
    full:      { captions: true,  useTitle: true,  motion: true,  layout: "crop" as const },
    magic:     { captions: false, useTitle: false, motion: true,  layout: "crop" as const },
    subtitles: { captions: true,  useTitle: true,  motion: false, layout: "blur" as const },
    raw:       { captions: false, useTitle: false, motion: false, layout: "blur" as const },
  }[editLevel]!;
  // Caption style: a specific preset id, or "auto"/undefined to ROTATE styles across clips
  // (variety, the way Crayo does it) — passed through per clip below.
  const captionStyle: string | undefined = body.captionStyle && body.captionStyle !== "auto" ? body.captionStyle : undefined;
  // Which platform shapes to export per clip. Default 9:16 (TikTok/Reels/Shorts); pass e.g.
  // ["9:16","1:1","16:9"] to auto-produce a post for every platform from one source.
  const aspects: AspectKey[] = (Array.isArray(body.aspects) && body.aspects.length
    ? body.aspects.filter((a: string): a is AspectKey => a in ASPECTS)
    : ["9:16"]);

  const stream = new ReadableStream({
    async start(controller) {
      const jobId = createId();
      const dir = `/tmp/clipflow/tools/${jobId}`;
      mkdirSync(dir, { recursive: true });
      const srcPath = `${dir}/source.mp4`;
      const audioPath = `${dir}/audio.wav`;

      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        // 1. Download
        sse(controller, { step: "download", message: "Downloading video..." });
        const info = await ytdlp([
          url, "-o", srcPath,
          "-f", "bestvideo[ext=mp4][height<=720]+bestaudio/best[height<=720]/best",
          "--merge-output-format", "mp4",
          // --print implies --simulate (skips the actual download); force the download.
          "--no-simulate",
          "--print", "%(title)s",
          "--print", "%(duration)s",
        ]);
        const lines = info.trim().split("\n").filter(Boolean);
        const title = lines[0] || "Video";
        const duration = parseFloat(lines[1] || "0");
        sse(controller, { step: "download_done", message: `Downloaded: ${title}`, title, duration });

        // 2. Extract + transcribe audio
        sse(controller, { step: "transcribe", message: "Transcribing audio..." });
        let transcript = "";
        let segments: { start: number; end: number; text: string }[] = [];
        let words: Word[] = [];
        try {
          // Transcribe up to 60 min (32k mono ≈ 14MB, under Groq's 25MB cap) so we scan a full
          // podcast, not just the first chunk. Word timestamps power the animated captions.
          await ffmpegRun(["-i", srcPath, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k", "-t", "3600", audioPath]);
          const whisperRes = await groq.audio.transcriptions.create({
            file: createReadStream(audioPath) as Parameters<typeof groq.audio.transcriptions.create>[0]["file"],
            model: "whisper-large-v3",
            response_format: "verbose_json",
            timestamp_granularities: ["word", "segment"],
          } as Parameters<typeof groq.audio.transcriptions.create>[0], { timeout: 480000 });
          const r = whisperRes as { segments?: { start: number; end: number; text: string }[]; words?: { word: string; start: number; end: number }[] };
          segments = r.segments || [];
          words = (r.words || []).map((w) => ({ word: w.word.trim(), start: w.start, end: w.end })).filter((w) => w.word);
          transcript = segments.map((s) => `[${s.start.toFixed(1)}s-${s.end.toFixed(1)}s] ${s.text}`).join("\n");
        } catch {
          transcript = `Video: ${title}, Duration: ${duration}s`;
        }
        sse(controller, { step: "transcribe_done", message: "Transcription complete" });

        // 3. AI analysis
        sse(controller, { step: "analyze", message: "AI finding best moments..." });
        const analysisMsg = await anthropic.messages.create({
          model: "claude-sonnet-5",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: `You are a viral content expert. Find the ${maxClips} most viral-worthy clip moments from this video.

Title: ${title}
Duration: ${duration}s
Transcript:
${transcript.slice(0, 10000)}

Rules:
- Each clip must be ${minDuration}–${maxDuration} seconds long
- Choose moments with high entertainment/value/emotion
- Clips should have clear start/end (not mid-sentence)
- Return ONLY valid JSON array, no markdown

JSON format:
[{
  "start_time": 12.5,
  "end_time": 45.0,
  "title": "Short punchy title",
  "reason": "Why this moment is viral",
  "virality_score": "high|medium|low",
  "hook": "First 3 seconds hook text",
  "caption": "Ready-to-post social media caption with hashtags"
}]`,
          }],
        });

        const raw = anthropicText(analysisMsg);
        let moments: Moment[] = [];
        try {
          moments = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim());
        } catch {
          sse(controller, { step: "error", message: "Failed to parse AI response" });
          controller.close();
          return;
        }
        sse(controller, { step: "analyze_done", message: `Found ${moments.length} moments`, count: moments.length });

        // 4. Cut clips
        let clipsGenerated = 0;
        for (let i = 0; i < moments.length; i++) {
          const m = moments[i];
          const clipId = createId();
          const clipPath = `${dir}/clip_${clipId}.mp4`;
          const thumbPath = `${dir}/thumb_${clipId}.jpg`;

          sse(controller, { step: "cutting", message: `Cutting clip ${i + 1}/${moments.length}: ${m.title}`, index: i });

          try {
            // Render PREMIUM clips via the shared engine: magic-crop / per-shot tracking,
            // animated word captions, title card — one export per requested platform aspect.
            const clipDur = m.end_time - m.start_time;
            // Analyse the subject ONCE (tracking + static face), reuse across every aspect.
            const [track, face] = await Promise.all([
              reframeTrack(srcPath, m.start_time, clipDur),
              reframeFace(srcPath, m.start_time, clipDur),
            ]);
            const variants: { aspect: AspectKey; downloadUrl: string }[] = [];
            let primaryOk = true;
            for (const aspect of aspects) {
              const suffix = aspect.replace(":", "x");
              const isPrimary = aspect === aspects[0];
              const outPath = isPrimary ? clipPath : `${dir}/clip_${clipId}_${suffix}.mp4`;
              // Render + QC with one automatic retry. Drop a broken variant; if the PRIMARY
              // is broken (even after retry), skip the whole clip. Fail-open on probe hiccups.
              const qc = await renderClipChecked({
                srcPath, outPath,
                startTime: m.start_time, duration: clipDur,
                title: edit.useTitle ? (m.hook || m.title || "").trim() : "",
                words, variant: i, layout: edit.layout, face, track, aspect,
                captions: edit.captions, motion: edit.motion,
                captionPresetId: captionStyle,   // undefined → rotate styles for variety
              });
              if (!qc.ok) { if (isPrimary) { primaryOk = false; break; } continue; }
              variants.push({ aspect, downloadUrl: `/api/tools/serve/${jobId}/${outPath.split("/").pop()}` });
            }
            if (!primaryOk) {
              sse(controller, { step: "clip_error", message: `Clip ${i + 1} failed quality check — skipped` });
              continue;
            }

            // Thumbnail — a smart cover frame (clear central face, sharp, well-lit) from the
            // RENDERED vertical clip, so it matches the output and isn't a blurry t=1s grab.
            try { await bestThumbnail(clipPath, thumbPath); } catch { /* thumbnail optional */ }

            clipsGenerated++;
            sse(controller, {
              step: "clip_ready",
              message: `Clip ${clipsGenerated} ready: ${m.title}`,
              clip: {
                id: clipId,
                title: m.title,
                reason: m.reason,
                viralityScore: m.virality_score,
                hook: m.hook,
                caption: m.caption,
                startTime: m.start_time,
                endTime: m.end_time,
                duration: Math.round(m.end_time - m.start_time),
                downloadUrl: `/api/tools/serve/${jobId}/clip_${clipId}.mp4`,
                thumbnailUrl: existsSync(thumbPath) ? `/api/tools/serve/${jobId}/thumb_${clipId}.jpg` : null,
                sourceTitle: title,
                variants,   // one entry per platform aspect (9:16 / 1:1 / 16:9 …)
              },
            });
          } catch (e) {
            sse(controller, { step: "clip_error", message: `Clip ${i + 1} failed: ${(e as Error).message}` });
          }
        }

        sse(controller, { step: "done", message: `Done! ${clipsGenerated} clips ready`, totalClips: clipsGenerated });
      } catch (err: unknown) {
        sse(controller, { step: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
