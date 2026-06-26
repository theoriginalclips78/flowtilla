export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { mkdirSync, createReadStream, existsSync } from "fs";
import { createId } from "@paralleldrive/cuid2";
import ffmpegStatic from "ffmpeg-static";
import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";

if (ffmpegStatic) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpeg = require("fluent-ffmpeg") as { setFfmpegPath: (p: string) => void };
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

function sse(ctrl: ReadableStreamDefaultController, data: object) {
  ctrl.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

function ytdlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = process.env.YTDLP_PATH || `${process.env.HOME}/bin/yt-dlp`;
    const proc = spawn(bin, args);
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
  const { url, maxClips = 5, minDuration = 20, maxDuration = 90 } = await req.json();

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
        try {
          await ffmpegRun(["-i", srcPath, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k", "-t", "600", audioPath]);
          const whisperRes = await groq.audio.transcriptions.create({
            file: createReadStream(audioPath) as Parameters<typeof groq.audio.transcriptions.create>[0]["file"],
            model: "whisper-large-v3",
            response_format: "verbose_json",
          });
          segments = (whisperRes as { segments?: { start: number; end: number; text: string }[] }).segments || [];
          transcript = segments.map((s) => `[${s.start.toFixed(1)}s-${s.end.toFixed(1)}s] ${s.text}`).join("\n");
        } catch {
          transcript = `Video: ${title}, Duration: ${duration}s`;
        }
        sse(controller, { step: "transcribe_done", message: "Transcription complete" });

        // 3. AI analysis
        sse(controller, { step: "analyze", message: "AI finding best moments..." });
        const analysisMsg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
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

        const raw = (analysisMsg.content[0] as { text: string }).text;
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
            // Cut clip
            await ffmpegRun([
              "-ss", String(m.start_time),
              "-i", srcPath,
              "-t", String(m.end_time - m.start_time),
              "-c:v", "libx264", "-preset", "fast", "-crf", "23",
              "-c:a", "aac", "-b:a", "128k",
              "-movflags", "+faststart",
              clipPath,
            ]);

            // Thumbnail
            try {
              await ffmpegRun([
                "-ss", String(m.start_time + 1),
                "-i", srcPath,
                "-vframes", "1",
                "-q:v", "3",
                thumbPath,
              ]);
            } catch { /* thumbnail optional */ }

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
