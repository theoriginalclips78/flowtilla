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

const EFFECT_FILTERS: Record<string, string> = {
  robot: "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75",
  deep: "asetrate=44100*0.75,aresample=44100,atempo=1.33",
  chipmunk: "asetrate=44100*1.5,aresample=44100,atempo=0.67",
  echo: "aecho=0.8:0.9:500:0.3",
  reverb: "aecho=0.8:0.88:60:0.4,aecho=0.8:0.88:120:0.3",
  radio: "highpass=f=300,lowpass=f=3000,volume=2",
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File;
    const effect = form.get("effect") as string || "deep";
    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });

    const jobId = createId();
    const dir = `/tmp/clipflow/tools/${jobId}`;
    mkdirSync(dir, { recursive: true });

    const inputPath = `${dir}/input.mp4`;
    const outputPath = `${dir}/output.mp3`;
    writeFileSync(inputPath, Buffer.from(await file.arrayBuffer()));

    const filter = EFFECT_FILTERS[effect] || EFFECT_FILTERS.deep;

    await ffmpegRun([
      "-i", inputPath,
      "-vn",
      "-af", filter,
      "-c:a", "libmp3lame", "-b:a", "192k",
      outputPath,
    ]);

    return NextResponse.json({ downloadUrl: `/api/tools/serve/${jobId}/output.mp3` });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
