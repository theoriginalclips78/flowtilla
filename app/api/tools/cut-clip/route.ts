export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { mkdirSync } from "fs";
import { createId } from "@paralleldrive/cuid2";
import ffmpegStatic from "ffmpeg-static";

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
  try {
    const { url, startTime, endTime, title } = await req.json();
    const jobId = createId();
    const dir = `/tmp/clipflow/tools/${jobId}`;
    mkdirSync(dir, { recursive: true });
    const srcPath = `${dir}/source.mp4`;
    const clipPath = `${dir}/clip.mp4`;

    await ytdlp([url, "-o", srcPath, "-f", "bestvideo[ext=mp4]+bestaudio/best", "--merge-output-format", "mp4"]);
    await ffmpegRun(["-ss", String(startTime), "-i", srcPath, "-t", String(endTime - startTime), "-c", "copy", clipPath]);

    return NextResponse.json({ downloadUrl: `/api/tools/serve/${jobId}/clip.mp4`, title });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
