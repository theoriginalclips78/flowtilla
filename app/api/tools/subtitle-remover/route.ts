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
    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });

    const jobId = createId();
    const dir = `/tmp/clipflow/tools/${jobId}`;
    mkdirSync(dir, { recursive: true });

    const inputPath = `${dir}/input.mp4`;
    const outputPath = `${dir}/output.mp4`;
    writeFileSync(inputPath, Buffer.from(await file.arrayBuffer()));

    await ffmpegRun([
      "-i", inputPath,
      "-vf", "subtitles=" + inputPath + ":si=0",
      "-c:a", "copy",
      outputPath,
    ]).catch(() =>
      // Fallback: just copy without subtitle track
      ffmpegRun(["-i", inputPath, "-map", "0:v", "-map", "0:a?", "-c", "copy", "-sn", outputPath])
    );

    return NextResponse.json({ downloadUrl: `/api/tools/serve/${jobId}/output.mp4` });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
