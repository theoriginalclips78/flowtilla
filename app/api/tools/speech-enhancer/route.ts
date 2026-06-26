export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { mkdirSync, writeFileSync, copyFileSync } from "fs";
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
    const optsRaw = form.get("options") as string;
    const opts: string[] = optsRaw ? JSON.parse(optsRaw) : ["denoise", "normalize", "clarity", "echo"];
    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });

    const jobId = createId();
    const dir = `/tmp/clipflow/tools/${jobId}`;
    mkdirSync(dir, { recursive: true });

    const inputPath = `${dir}/input.mp3`;
    const outputPath = `${dir}/enhanced.mp3`;
    const originalPath = `${dir}/original.mp3`;

    writeFileSync(inputPath, Buffer.from(await file.arrayBuffer()));
    copyFileSync(inputPath, originalPath);

    const filters: string[] = [];
    if (opts.includes("denoise")) filters.push("highpass=f=80");
    if (opts.includes("clarity")) filters.push("equalizer=f=3000:t=o:width=1:g=3");
    if (opts.includes("echo")) filters.push("lowpass=f=8000");
    if (opts.includes("normalize")) filters.push("loudnorm=I=-14:TP=-1:LRA=11");

    const af = filters.length > 0 ? filters.join(",") : "loudnorm";

    await ffmpegRun([
      "-i", inputPath,
      "-af", af,
      "-c:a", "libmp3lame", "-b:a", "192k",
      outputPath,
    ]);

    return NextResponse.json({
      originalUrl: `/api/tools/serve/${jobId}/original.mp3`,
      enhancedUrl: `/api/tools/serve/${jobId}/enhanced.mp3`,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
