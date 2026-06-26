export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { mkdirSync } from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { prisma } from "@/lib/db/prisma";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

interface ClipInput {
  start_time: number;
  end_time: number;
  title: string;
  virality_score: string;
  reason: string;
}

function buildVideoFilter(aspectRatio: string): string[] {
  switch (aspectRatio) {
    case "9:16":
      return ["-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"];
    case "1:1":
      return ["-vf", "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080"];
    default: // 16:9
      return ["-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080"];
  }
}

function cutClip(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  aspectRatio: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const vf = buildVideoFilter(aspectRatio);
    ffmpeg(inputPath)
      .inputOptions(["-ss", String(startTime)])
      .duration(duration)
      .outputOptions([...vf, "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

export async function POST(req: NextRequest) {
  try {
    const { jobId, campaignId, clips, aspectRatio } = await req.json();
    const clipsDir = `/tmp/clipflow/${jobId}/clips`;
    mkdirSync(clipsDir, { recursive: true });

    const inputPath = `/tmp/clipflow/${jobId}/source.mp4`;
    const results = [];

    for (let i = 0; i < clips.length; i++) {
      const clip: ClipInput = clips[i];
      const outFile = path.join(clipsDir, `clip-${i}.mp4`);
      const duration = clip.end_time - clip.start_time;

      await cutClip(inputPath, outFile, clip.start_time, duration, aspectRatio || "16:9");
      console.log(`[cut] clip ${i + 1}/${clips.length} done`);

      const saved = await prisma.clip.create({
        data: {
          jobId,
          campaignId,
          title: clip.title,
          filePath: outFile,
          downloadUrl: `/api/clip/${jobId}/${i}`,
          startTime: clip.start_time,
          endTime: clip.end_time,
          viralityScore: clip.virality_score,
          reason: clip.reason,
          status: "pending",
        },
      });

      results.push({
        id: saved.id,
        title: saved.title,
        filePath: saved.filePath,
        downloadUrl: saved.downloadUrl,
        startTime: saved.startTime,
        endTime: saved.endTime,
        viralityScore: saved.viralityScore,
        reason: saved.reason,
      });
    }

    return NextResponse.json({ clips: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
