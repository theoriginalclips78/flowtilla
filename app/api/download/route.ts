export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { mkdirSync } from "fs";
import { createId } from "@paralleldrive/cuid2";
import path from "path";

function runYtDlp(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const ytdlpPath = process.env.YTDLP_PATH || `${process.env.HOME}/bin/yt-dlp`;
    const proc = spawn(ytdlpPath, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
      console.log("[yt-dlp]", d.toString().trim());
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      console.error("[yt-dlp err]", d.toString().trim());
    });
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `yt-dlp exited with code ${code}`));
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { url, platform } = await req.json();
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

    const jobId = createId();
    const dir = `/tmp/clipflow/${jobId}`;
    mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, "source.mp4");

    const args = [
      url,
      "-o", outPath,
      "-f", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]/best",
      "--merge-output-format", "mp4",
      "--print", "%(title)s",
      "--print", "%(duration)s",
    ];

    if (platform === "tiktok") args.push("--no-check-certificate");

    const { stdout } = await runYtDlp(args);
    const lines = stdout.trim().split("\n").filter(Boolean);
    const title = lines[0] || "Untitled";
    const duration = parseFloat(lines[1] || "0");

    return NextResponse.json({ jobId, title, duration, filePath: outPath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[download]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
