export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createReadStream, writeFileSync } from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import OpenAI from "openai";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);


function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(["-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { jobId } = await req.json();
    const dir = `/tmp/clipflow/${jobId}`;
    const videoPath = path.join(dir, "source.mp4");
    const audioPath = path.join(dir, "audio.mp3");

    await extractAudio(videoPath, audioPath);
    console.log("[transcribe] audio extracted");

    const response = await openai.audio.transcriptions.create({
      file: createReadStream(audioPath) as Parameters<typeof openai.audio.transcriptions.create>[0]["file"],
      model: "whisper-1",
      response_format: "verbose_json",
    });

    const segments = (response as { segments?: { start: number; end: number; text: string }[] }).segments || [];
    const transcript = segments.map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    }));

    writeFileSync(path.join(dir, "transcript.json"), JSON.stringify(transcript, null, 2));

    const wordCount = transcript.reduce((acc, s) => acc + s.text.trim().split(/\s+/).length, 0);
    return NextResponse.json({ transcript, wordCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
