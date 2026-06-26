export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { mkdirSync, existsSync, createReadStream } from "fs";
import path from "path";
import { createId } from "@paralleldrive/cuid2";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/prisma";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

function sse(controller: ReadableStreamDefaultController, data: object) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

function ytdlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = process.env.YTDLP_PATH || `${process.env.HOME}/bin/yt-dlp`;
    const proc = spawn(bin, args);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0 || out.trim()) resolve(out);
      else reject(new Error(err.slice(0, 600) || `yt-dlp exited ${code}`));
    });
  });
}

function ffmpegRun(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = ffmpegStatic || "ffmpeg";
    const proc = spawn(bin, ["-y", ...args]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.slice(-500)));
    });
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function detectPlatform(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("twitch.tv")) return "twitch";
  if (url.includes("kick.com")) return "kick";
  return "other";
}

async function downloadVideo(
  url: string,
  outPath: string,
  platform: string
): Promise<{ title: string; duration: number }> {
  const args = [
    url,
    "-o", outPath,
    "-f", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]/best",
    "--merge-output-format", "mp4",
    "--print", "%(title)s",
    "--print", "%(duration)s",
  ];
  if (platform === "tiktok") args.push("--no-check-certificate");
  if (platform === "instagram") args.push("--cookies-from-browser", "chrome");

  const out = await ytdlp(args);
  const lines = out.trim().split("\n").filter(Boolean);
  return {
    title: lines[0] || "Untitled",
    duration: parseFloat(lines[1] || "0"),
  };
}

async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  await ffmpegRun([
    "-i", videoPath, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k", audioPath,
  ]);
}

async function extractThumbnail(videoPath: string, thumbPath: string): Promise<void> {
  await ffmpegRun([
    "-i", videoPath, "-ss", "1", "-vframes", "1", "-q:v", "2", thumbPath,
  ]);
}

async function cutAndEditClip(
  srcPath: string,
  outPath: string,
  startTime: number,
  duration: number,
  hook: string,
  transcript: Array<{ start: number; end: number; text: string }>,
  watermark: string,
  totalDuration: number
): Promise<void> {
  // Build ffmpeg filter chain with: crop, normalize, color grade, hook text, progress bar, subtitles, watermark
  const filters: string[] = [];

  // 1. Vertical 9:16 crop
  filters.push("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920");

  // 2. Color grade (subtle viral look)
  filters.push("eq=saturation=1.15:contrast=1.1:brightness=0.02");

  // 3. Audio normalize applied separately via amix — use loudnorm for video stream
  // Note: combined filter for video only first, audio handled in mapping

  const vf = filters.join(",");

  // Build subtitle drawtext filters for clip-relative timestamps
  const subFilters: string[] = [];
  for (const seg of transcript) {
    const segStart = seg.start - startTime;
    const segEnd = seg.end - startTime;
    if (segEnd < 0 || segStart > duration) continue;
    const t0 = Math.max(0, segStart).toFixed(2);
    const t1 = Math.min(duration, segEnd).toFixed(2);
    const escaped = seg.text.replace(/'/g, "’").replace(/:/g, "\\:").replace(/,/g, "\\,").trim();
    if (!escaped) continue;
    subFilters.push(
      `drawtext=text='${escaped}':fontsize=42:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.75:enable='between(t,${t0},${t1})'`
    );
  }

  // Hook text (first 2.5s)
  if (hook) {
    const escapedHook = hook.replace(/'/g, "’").replace(/:/g, "\\:").replace(/,/g, "\\,").slice(0, 60);
    subFilters.push(
      `drawtext=text='${escapedHook}':fontsize=52:fontcolor=white:borderw=4:bordercolor=black:x=(w-text_w)/2:y=h*0.12:enable='between(t,0,2.5)'`
    );
  }

  // Progress bar
  subFilters.push(
    `drawbox=x=0:y=0:w=iw*t/${totalDuration}:h=6:color=#C0392B@0.9:t=fill`
  );

  // Watermark
  if (watermark) {
    const wm = watermark.replace(/'/g, "’");
    subFilters.push(
      `drawtext=text='${wm}':fontsize=28:fontcolor=white@0.4:x=w-text_w-20:y=h-text_h-20`
    );
  }

  const fullVf = subFilters.length > 0 ? `${vf},${subFilters.join(",")}` : vf;

  await ffmpegRun([
    "-ss", String(startTime),
    "-i", srcPath,
    "-t", String(duration),
    "-vf", fullVf,
    "-af", "loudnorm=I=-14:TP=-1:LRA=11",
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    outPath,
  ]);
}

export async function POST(req: NextRequest) {
  const { campaignId } = await req.json();
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Load user settings for watermark
  const settings = await prisma.userSettings.findFirst({ where: { id: "default" } }).catch(() => null);
  const watermarkHandle = settings?.tiktokHandle || settings?.instagramHandle || "";

  const stream = new ReadableStream({
    async start(controller) {
      let jobId = "";
      let totalClips = 0;
      let skippedVideos = 0;

      try {
        // Load campaign
        const campaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
          include: { sources: true },
        });
        if (!campaign) throw new Error("Campaign not found");

        // Create job
        const job = await prisma.agentJob.create({
          data: { campaignId, status: "running", startedAt: new Date() },
        });
        jobId = job.id;

        // Load source videos from DB (discovered by findAllVideos earlier)
        const sourceVideos = await prisma.sourceVideo.findMany({
          where: { campaignId, status: "pending" },
          take: 50,
        });

        const videosToProcess = sourceVideos.length > 0
          ? sourceVideos.map((v) => ({ url: v.url, platform: v.platform, title: v.title, id: v.id }))
          : campaign.sources.map((s) => ({ url: s.url, platform: s.platform, title: s.url, id: s.id }));

        sse(controller, {
          step: "start",
          status: "started",
          message: `🚀 Starting agent for ${campaign.name} — processing ${videosToProcess.length} videos`,
          campaignId,
        });

        for (let vIdx = 0; vIdx < videosToProcess.length; vIdx++) {
          const src = videosToProcess[vIdx];
          const jobSubId = createId();
          const dir = `/tmp/clipflow/${jobSubId}`;
          mkdirSync(dir, { recursive: true });
          const clipsDir = path.join(dir, "clips");
          mkdirSync(clipsDir, { recursive: true });

          sse(controller, {
            step: "source_start",
            status: "started",
            message: `── Video ${vIdx + 1}/${videosToProcess.length}: ${src.title.slice(0, 60)} ──`,
            sourceIndex: vIdx,
            campaignId,
            isGroupHeader: true,
          });

          // 1. DOWNLOAD
          sse(controller, { step: "download", status: "started", message: `📥 Downloading from ${src.platform}...`, campaignId });
          const srcPath = path.join(dir, "source.mp4");
          let videoTitle = src.title;
          let videoDuration = 0;

          try {
            const dl = await downloadVideo(src.url, srcPath, src.platform);
            videoTitle = dl.title;
            videoDuration = dl.duration;
            const dur = `${Math.floor(videoDuration / 60)}:${String(Math.floor(videoDuration % 60)).padStart(2, "0")}`;
            sse(controller, { step: "download", status: "complete", message: `✅ Downloaded: ${videoTitle} (${dur} long)`, campaignId });
          } catch {
            skippedVideos++;
            sse(controller, { step: "download", status: "error", message: `❌ Failed to download — skipping to next video`, campaignId });
            continue;
          }

          // 2. TRANSCRIBE
          sse(controller, { step: "transcribe", status: "started", message: `🎙️ Transcribing audio...`, campaignId });
          let transcript: Array<{ start: number; end: number; text: string }> = [];

          try {
            const audioPath = path.join(dir, "audio.wav");
            await extractAudio(srcPath, audioPath);
            const whisperRes = await groq.audio.transcriptions.create({
              file: createReadStream(audioPath) as Parameters<typeof groq.audio.transcriptions.create>[0]["file"],
              model: "whisper-large-v3",
              response_format: "verbose_json",
            });
            const segs = (whisperRes as { segments?: { start: number; end: number; text: string }[] }).segments || [];
            transcript = segs.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() }));
            const wordCount = transcript.reduce((a, s) => a + s.text.split(/\s+/).length, 0);
            sse(controller, { step: "transcribe", status: "complete", message: `✅ Transcribed (${wordCount.toLocaleString()} words)`, campaignId });
          } catch {
            sse(controller, { step: "transcribe", status: "warn", message: `⚠️ Transcription failed — using visual analysis only`, campaignId });
          }

          // 3. ANALYZE
          sse(controller, { step: "analyze", status: "started", message: `🤖 Claude analyzing for viral moments...`, campaignId });
          let moments: Array<{
            start_time: number; end_time: number; title: string; reason: string;
            virality_score: string; hook: string; caption: string; platform_fit: string[];
          }> = [];

          try {
            const transcriptText = transcript.length > 0
              ? transcript.map((s) => `[${s.start.toFixed(1)}s] ${s.text}`).join("\n")
              : `(No transcript — video is ${videoDuration}s long. Find moments based on video structure.)`;

            const systemPrompt = `You are a viral content strategist. Analyze this video and find the maximum number of high-quality clips for this campaign.

CAMPAIGN: ${campaign.name}
WHAT TO LOOK FOR: ${campaign.aiInstructions || "Find energetic, entertaining, high-emotion moments"}
CONTENT RULES: ${campaign.contentRules || "Make clips feel organic, not like ads"}
TARGET PLATFORMS: ${campaign.platforms || "tiktok,instagram,youtube"}

For each clip:
- start_time (seconds)
- end_time (seconds, clips must be 30s–3min)
- title (catchy, under 8 words, include relevant emoji)
- reason (2 sentences: why this moment is viral AND how it fits the campaign)
- virality_score: high / medium / low
- hook (first sentence/phrase to show as text overlay for first 2.5s)
- caption (organic social caption under 150 chars, no promotional language, 3-5 hashtags)
- platform_fit (array of: tiktok / instagram / youtube / twitch / kick)

Find EVERY good moment. Aim for 8-15 clips minimum per video.
Return ONLY a valid JSON array.`;

            const aiMsg = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 4000,
              system: systemPrompt,
              messages: [{ role: "user", content: `Video: ${videoTitle}\nDuration: ${videoDuration}s\n\nTranscript:\n${transcriptText.slice(0, 10000)}` }],
            });

            const raw = (aiMsg.content[0] as { type: string; text: string }).text;
            moments = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim());
            sse(controller, { step: "analyze", status: "complete", message: `✅ Found ${moments.length} viral moments`, momentCount: moments.length, campaignId });
          } catch {
            sse(controller, { step: "analyze", status: "error", message: `❌ Analysis failed — skipping video`, campaignId });
            skippedVideos++;
            continue;
          }

          // 4. CUT + AUTO EDIT
          sse(controller, { step: "cut", status: "started", message: `✂️ Cutting and auto-editing ${moments.length} clips...`, campaignId });

          for (let i = 0; i < moments.length; i++) {
            const m = moments[i];
            const clipDuration = m.end_time - m.start_time;
            if (clipDuration < 10) continue;

            try {
              sse(controller, { step: "cut", status: "progress", message: `✂️ Cutting clip ${i + 1}/${moments.length}: ${m.title}`, campaignId });

              const clipFile = path.join(clipsDir, `clip-${i}.mp4`);
              const thumbFile = path.join(clipsDir, `thumb-${i}.jpg`);

              // Cut + auto-edit in one pass
              await cutAndEditClip(
                srcPath, clipFile,
                m.start_time, clipDuration,
                m.hook || "",
                transcript,
                watermarkHandle,
                clipDuration
              );

              // Extract thumbnail
              try {
                await extractThumbnail(clipFile, thumbFile);
              } catch { /* non-fatal */ }

              // Save to DB
              const saved = await prisma.clip.create({
                data: {
                  jobId: job.id,
                  campaignId,
                  title: m.title,
                  filePath: clipFile,
                  downloadUrl: `/api/clip/${jobSubId}/${i}`,
                  thumbnailUrl: existsSync(thumbFile) ? `/api/clip/${jobSubId}/thumb/${i}` : "",
                  startTime: m.start_time,
                  endTime: m.end_time,
                  viralityScore: m.virality_score,
                  reason: m.reason,
                  hook: m.hook || "",
                  caption: m.caption || "",
                  platformFit: Array.isArray(m.platform_fit) ? m.platform_fit.join(",") : "",
                  status: "pending",
                },
              });

              // Update source video status
              if (src.id) {
                await prisma.sourceVideo.updateMany({
                  where: { id: src.id },
                  data: { status: "processed" },
                }).catch(() => {});
              }

              totalClips++;
              sse(controller, {
                step: "clip_ready",
                status: "complete",
                message: `✅ Clip ready — ${m.title} (${Math.round(clipDuration)}s)`,
                clip: {
                  id: saved.id,
                  title: saved.title,
                  downloadUrl: saved.downloadUrl,
                  thumbnailUrl: saved.thumbnailUrl,
                  startTime: saved.startTime,
                  endTime: saved.endTime,
                  viralityScore: saved.viralityScore,
                  reason: saved.reason,
                  hook: saved.hook,
                  caption: saved.caption,
                  platformFit: saved.platformFit,
                  sourceTitle: videoTitle,
                },
                totalClips,
                campaignId,
              });
            } catch (err) {
              sse(controller, { step: "cut", status: "error", message: `❌ Clip ${i + 1} failed: ${(err as Error).message?.slice(0, 100)}`, campaignId });
            }
          }

          sse(controller, {
            step: "source_complete",
            status: "complete",
            message: `🎉 Video ${vIdx + 1} complete — ${moments.length} clips from ${videoTitle}`,
            campaignId,
          });
        }

        // All done
        await prisma.agentJob.update({
          where: { id: job.id },
          data: { status: "completed", completedAt: new Date() },
        });

        sse(controller, {
          step: "done",
          status: "complete",
          message: `🎉 Campaign complete! ${totalClips} clips generated from ${videosToProcess.length - skippedVideos} videos${skippedVideos > 0 ? ` (${skippedVideos} skipped)` : ""}`,
          totalClips,
          campaignId,
        });

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        sse(controller, { step: "error", status: "error", message: `❌ ${message}`, campaignId });
        if (jobId) await prisma.agentJob.update({ where: { id: jobId }, data: { status: "error" } }).catch(() => {});
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
