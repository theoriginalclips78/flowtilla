export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { mkdirSync, createReadStream } from "fs";
import { createId } from "@paralleldrive/cuid2";
import ffmpegStatic from "ffmpeg-static";
import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";

if (ffmpegStatic) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpeg = require("fluent-ffmpeg") as { setFfmpegPath: (p: string) => void };
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

function sse(controller: ReadableStreamDefaultController, data: object) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

function ytdlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = process.env.YTDLP_PATH || `${process.env.HOME}/bin/yt-dlp`;
    const proc = spawn(bin, args);
    let out = ""; let err = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => { if (code === 0 || out.trim()) { resolve(out); } else { reject(new Error(err.slice(0, 400))); } });
  });
}

function ffmpegRun(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = ffmpegStatic || "ffmpeg";
    const proc = spawn(bin, ["-y", ...args]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => { if (code === 0) { resolve(); } else { reject(new Error(err.slice(-300))); } });
  });
}

export async function POST(req: NextRequest) {
  const { url, prompt } = await req.json();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const jobId = createId();
        const dir = `/tmp/clipflow/tools/${jobId}`;
        mkdirSync(dir, { recursive: true });
        const srcPath = `${dir}/source.mp4`;
        const audioPath = `${dir}/audio.wav`;

        // 1. Download
        sse(controller, { step: 0 });
        const info = await ytdlp([url, "-o", srcPath, "-f", "bestvideo[ext=mp4]+bestaudio/best", "--merge-output-format", "mp4", "--print", "%(title)s", "--print", "%(duration)s"]);
        const lines = info.trim().split("\n").filter(Boolean);
        const title = lines[0] || "Video";
        const duration = parseFloat(lines[1] || "0");

        // 2. Transcribe
        sse(controller, { step: 1 });
        let transcript = "";
        try {
          await ffmpegRun(["-i", srcPath, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k", "-t", "600", audioPath]);
          const whisperRes = await groq.audio.transcriptions.create({
            file: createReadStream(audioPath) as Parameters<typeof groq.audio.transcriptions.create>[0]["file"],
            model: "whisper-large-v3",
            response_format: "verbose_json",
          });
          const segs = (whisperRes as { segments?: { start: number; end: number; text: string }[] }).segments || [];
          transcript = segs.map((s) => `[${s.start.toFixed(1)}s] ${s.text}`).join("\n");
        } catch { transcript = `Video duration: ${duration}s`; }

        // 3. Claude analysis
        sse(controller, { step: 2 });
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
          messages: [{
            role: "user",
            content: `Find viral clip moments in this video.\nTitle: ${title}\nDuration: ${duration}s\n${prompt ? `Look for: ${prompt}\n` : ""}Transcript:\n${transcript.slice(0, 8000)}\n\nReturn ONLY a JSON array of moments, each with: start_time, end_time, title, reason, virality_score (high/medium/low), hook`,
          }],
        });

        const raw = (msg.content[0] as { type: string; text: string }).text;
        const moments = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim());
        sse(controller, { moments });
      } catch (err: unknown) {
        sse(controller, { error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
