export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { mkdirSync } from "fs";
import path from "path";
import { createId } from "@paralleldrive/cuid2";

function ytdlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = process.env.YTDLP_PATH || `${process.env.HOME}/bin/yt-dlp`;
    const proc = spawn(bin, args);
    let out = ""; let err = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0 || out.trim()) resolve(out);
      else reject(new Error(err.slice(0, 400) || `yt-dlp exited ${code}`));
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

    const jobId = createId();
    const dir = `/tmp/clipflow/tools/${jobId}`;
    mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, "video.mp4");

    const info = await ytdlp([
      url, "-o", outPath,
      "-f", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format", "mp4",
      "--print", "%(title)s",
      "--print", "%(duration)s",
    ]);

    const lines = info.trim().split("\n").filter(Boolean);
    const title = lines[0] || "Video";
    const duration = parseFloat(lines[1] || "0");

    return NextResponse.json({ title, duration, downloadUrl: `/api/tools/serve/${jobId}/video.mp4` });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
