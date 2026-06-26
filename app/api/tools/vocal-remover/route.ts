export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { createId } from "@paralleldrive/cuid2";
import ffmpegStatic from "ffmpeg-static";

function ffmpegRun(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = ffmpegStatic || "ffmpeg";
    const proc = spawn(bin, ["-y", ...args]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => { if (code === 0) { resolve(); } else { reject(new Error(err.slice(-400))); } });
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File;
    const mode = form.get("mode") as string || "instrumental";
    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });

    const jobId = createId();
    const dir = `/tmp/clipflow/tools/${jobId}`;
    mkdirSync(dir, { recursive: true });

    const inputPath = `${dir}/input.mp3`;
    const instrumentalPath = `${dir}/instrumental.mp3`;
    const vocalsPath = `${dir}/vocals.mp3`;

    writeFileSync(inputPath, Buffer.from(await file.arrayBuffer()));

    // Center channel removal (vocal isolation trick using stereo phase cancellation)
    // Instrumental: pan=stereo|c0=c0-c1|c1=c1-c0 (removes center = vocals)
    // Vocals: original minus instrumental approximation
    await ffmpegRun([
      "-i", inputPath,
      "-af", "pan=stereo|c0=c0-c1|c1=c1-c0",
      "-c:a", "libmp3lame", "-b:a", "192k",
      instrumentalPath,
    ]);

    await ffmpegRun([
      "-i", inputPath,
      "-af", "pan=stereo|c0=c0+c1|c1=c0+c1,volume=0.5",
      "-c:a", "libmp3lame", "-b:a", "192k",
      vocalsPath,
    ]);

    return NextResponse.json({
      instrumentalUrl: mode === "instrumental" || mode === "both" ? `/api/tools/serve/${jobId}/instrumental.mp3` : "",
      vocalsUrl: mode === "vocals" || mode === "both" ? `/api/tools/serve/${jobId}/vocals.mp3` : "",
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
