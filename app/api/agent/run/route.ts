export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { mkdirSync, createReadStream, writeFileSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { createId } from "@paralleldrive/cuid2";
// Use absolute path — ffmpeg-static path gets mangled by Next.js bundler at runtime
const FFMPEG_BIN = "/Users/ahmedsaciidabdullahi/clipflow/node_modules/ffmpeg-static/ffmpeg";
import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/prisma";

const CONCURRENCY = 1; // sequential: finish all clips from one video before moving to next
const FONT = "/System/Library/Fonts/Helvetica.ttc";

function sse(ctrl: ReadableStreamDefaultController, data: object) {
  try { ctrl.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ }
}

function ytdlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = process.env.YTDLP_PATH || `${process.env.HOME}/bin/yt-dlp`;
    const proc = spawn(bin, args);
    let out = "", err = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (c) => (c === 0 || out.trim()) ? resolve(out) : reject(new Error(err.slice(0, 600) || `yt-dlp exit ${c}`)));
  });
}

function ffmpegRun(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = FFMPEG_BIN;
    const proc = spawn(bin, ["-y", ...args]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (c) => c === 0 ? resolve() : reject(new Error(err.slice(-500))));
  });
}

function detectPlatform(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("twitch.tv")) return "twitch";
  if (url.includes("kick.com")) return "kick";
  return "other";
}

// Download video AND get metadata via --write-info-json (--print skips download!)
async function downloadVideo(url: string, outDir: string, platform: string): Promise<{ filePath: string; title: string; duration: number }> {
  const args = [
    url,
    "-o", path.join(outDir, "source.%(ext)s"),
    "-f", "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[height<=720]/best",
    "--merge-output-format", "mp4",
    "--no-playlist",
    "--retries", "3",
    "--write-info-json",   // writes source.info.json — gives title + duration without --print
    "--quiet", "--no-warnings",
  ];
  if (platform === "tiktok") {
    args.push("--no-check-certificate");
    args.push("--extractor-retries", "5");
    args.push("--add-header", "User-Agent:Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
  }

  await ytdlp(args);

  // Find the actual video file (yt-dlp may write .mp4 or .webm)
  const files = readdirSync(outDir);
  const videoFile = files.find(f => /\.(mp4|webm|mkv|mov)$/i.test(f) && !f.includes(".info"));
  if (!videoFile) throw new Error("Download produced no video file");

  const filePath = path.join(outDir, videoFile);

  // Read metadata from info JSON
  const infoFile = files.find(f => f.endsWith(".info.json"));
  let title = "Untitled", duration = 0;
  if (infoFile) {
    try {
      const info = JSON.parse(readFileSync(path.join(outDir, infoFile), "utf8"));
      title = info.title || info.fulltitle || "Untitled";
      duration = Number(info.duration) || 0;
    } catch { /* use defaults */ }
  }

  // Fallback: get duration via ffprobe
  if (duration === 0) {
    try {
      const probe = await ytdlp(["--no-playlist", "--print", "%(duration)s", filePath]);
      duration = parseFloat(probe.trim()) || 0;
    } catch { /* leave as 0 */ }
  }

  return { filePath, title, duration };
}

async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  await ffmpegRun(["-i", videoPath, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k", "-t", "600", audioPath]);
}

function toSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
}

function buildSrt(segs: { start: number; end: number; text: string }[], offset: number, duration: number): string {
  const relevant = segs.filter(s => s.end > offset && s.start < offset + duration);
  if (relevant.length === 0) return "";
  let idx = 1;
  const lines: string[] = [];
  for (const s of relevant) {
    const start = Math.max(0, s.start - offset);
    const end = Math.min(duration, s.end - offset);
    const words = s.text.trim().split(/\s+/);
    const chunks: string[] = [];
    for (let j = 0; j < words.length; j += 5) chunks.push(words.slice(j, j + 5).join(" "));
    const chunkDur = (end - start) / Math.max(chunks.length, 1);
    for (let ci = 0; ci < chunks.length; ci++) {
      lines.push(`${idx++}\n${toSrtTime(start + ci * chunkDur)} --> ${toSrtTime(start + (ci + 1) * chunkDur)}\n${chunks[ci]}`);
    }
  }
  return lines.join("\n\n");
}

function escapeDrawtext(str: string): string {
  return str.replace(/[\\:'"[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 55);
}

async function cutClip(
  srcPath: string, outPath: string,
  startTime: number, duration: number,
  transcript: { start: number; end: number; text: string }[],
  title: string,
): Promise<void> {
  const srtContent = buildSrt(transcript, startTime, duration);
  const srtPath = outPath.replace(".mp4", ".srt");
  if (srtContent) writeFileSync(srtPath, srtContent, "utf8");

  const safeTitle = escapeDrawtext(title);
  const cropFilter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=saturation=1.12:contrast=1.06";

  // Attempt 1: full pipeline — crop + subtitles + title
  if (srtContent) {
    try {
      await ffmpegRun([
        "-ss", String(startTime), "-i", srcPath, "-t", String(duration),
        "-vf", [
          cropFilter,
          `subtitles=${srtPath}:force_style='Fontname=Helvetica,FontSize=20,Alignment=2,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2.5,Shadow=0.5,Bold=1,MarginV=80'`,
          `drawtext=fontfile=${FONT}:text='${safeTitle}':fontsize=26:fontcolor=white:x=(w-text_w)/2:y=52:box=1:boxcolor=black@0.55:boxborderw=12`,
        ].join(","),
        "-af", "dynaudnorm=f=150:g=15",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", outPath,
      ]);
      return;
    } catch { /* try next */ }
  }

  // Attempt 2: crop + title only (no subtitles)
  try {
    await ffmpegRun([
      "-ss", String(startTime), "-i", srcPath, "-t", String(duration),
      "-vf", [
        cropFilter,
        `drawtext=fontfile=${FONT}:text='${safeTitle}':fontsize=26:fontcolor=white:x=(w-text_w)/2:y=52:box=1:boxcolor=black@0.55:boxborderw=12`,
      ].join(","),
      "-af", "dynaudnorm=f=150:g=15",
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
      "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", outPath,
    ]);
    return;
  } catch { /* try next */ }

  // Attempt 3: crop only, no text overlays
  try {
    await ffmpegRun([
      "-ss", String(startTime), "-i", srcPath, "-t", String(duration),
      "-vf", cropFilter,
      "-af", "dynaudnorm=f=150:g=15",
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
      "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", outPath,
    ]);
    return;
  } catch { /* try next */ }

  // Attempt 4: stream copy — always works if file is valid
  await ffmpegRun([
    "-ss", String(startTime), "-i", srcPath, "-t", String(duration),
    "-c", "copy", "-movflags", "+faststart", outPath,
  ]);
}

async function extractThumbnail(videoPath: string, thumbPath: string): Promise<void> {
  await ffmpegRun(["-ss", "1", "-i", videoPath, "-vframes", "1", "-q:v", "4", "-vf", "scale=480:-1", thumbPath]);
}

async function processOneVideo(
  src: { url: string; platform: string; title: string; id: string },
  campaignId: string, jobId: string,
  campaign: { name: string; aiInstructions: string; contentRules: string; platforms: string },
  vIdx: number, total: number,
  groq: Groq, anthropic: Anthropic,
  ctrl: ReadableStreamDefaultController,
  onClip: () => number,
): Promise<number> {
  const subId = createId();
  const dir = `/tmp/clipflow/${subId}`;
  const clipsDir = dir + "/clips";
  mkdirSync(clipsDir, { recursive: true });

  sse(ctrl, { step: "source_start", status: "started", isGroupHeader: true,
    message: `── Video ${vIdx + 1}/${total}: ${src.title.slice(0, 55)} ──`, sourceIndex: vIdx });

  // ── DOWNLOAD ──────────────────────────────────────────────────
  sse(ctrl, { step: "download", status: "started", message: `📥 Downloading from ${src.platform}...` });
  let srcPath = "", videoTitle = src.title, videoDuration = 0;
  try {
    const dl = await downloadVideo(src.url, dir, src.platform);
    srcPath = dl.filePath;
    videoTitle = dl.title;
    videoDuration = dl.duration;
    const dur = `${Math.floor(videoDuration / 60)}m${String(Math.floor(videoDuration % 60)).padStart(2,"0")}s`;
    sse(ctrl, { step: "download", status: "complete", message: `✅ ${videoTitle} (${dur})` });
  } catch (err) {
    const msg = (err as Error).message || "";
    const unavailable = msg.includes("not available") || msg.includes("status code 0") || msg.includes("Private video") || msg.includes("This video is unavailable");
    if (unavailable) {
      // Mark as unavailable so we don't retry it next run
      prisma.sourceVideo.updateMany({ where: { id: src.id }, data: { status: "unavailable" } }).catch(() => {});
      sse(ctrl, { step: "download", status: "warn", message: `⚠️ Skipped (video unavailable or region-locked): ${src.title || src.url}` });
    } else {
      sse(ctrl, { step: "download", status: "error", message: `❌ Download failed: ${msg.slice(0, 120)}` });
    }
    return 0;
  }

  // Helper to save a clip and stream it to the client
  const saveAndStream = async (clipFile: string, thumbFile: string, m: {
    start_time: number; end_time: number; title: string; reason: string;
    virality_score: string; hook: string; caption: string; platform_fit: string | string[];
  }) => {
    extractThumbnail(clipFile, thumbFile).catch(() => {});
    const saved = await prisma.clip.create({ data: {
      jobId, campaignId,
      title: m.title,
      filePath: clipFile,
      downloadUrl: `/api/clip/${subId}/${path.basename(clipFile, ".mp4").replace("clip-","")}`,
      thumbnailUrl: `/api/clip/${subId}/thumb/${path.basename(clipFile, ".mp4").replace("clip-","")}`,
      startTime: m.start_time, endTime: m.end_time,
      viralityScore: m.virality_score || "medium",
      reason: m.reason || "", hook: m.hook || "", caption: m.caption || "",
      platformFit: Array.isArray(m.platform_fit) ? m.platform_fit.join(",") : (m.platform_fit || ""),
      status: "pending",
    }});
    prisma.sourceVideo.updateMany({ where: { id: src.id }, data: { status: "processed" } }).catch(() => {});
    const totalNow = onClip();
    sse(ctrl, { step: "clip_ready", status: "complete", message: `✅ ${saved.title}`,
      clip: { id: saved.id, title: saved.title, downloadUrl: saved.downloadUrl, thumbnailUrl: saved.thumbnailUrl,
        startTime: saved.startTime, endTime: saved.endTime, viralityScore: saved.viralityScore,
        reason: saved.reason, hook: saved.hook, caption: saved.caption, platformFit: saved.platformFit, sourceTitle: videoTitle },
      totalClips: totalNow });
    return saved;
  };

  // ── SHORT VIDEO SHORTCUT ≤90s ──────────────────────────────────
  if (videoDuration > 0 && videoDuration <= 90) {
    sse(ctrl, { step: "cut", status: "progress", message: `⚡ Short video (${Math.round(videoDuration)}s) — clipping whole video with subtitles...` });
    const clipFile = clipsDir + "/clip-0.mp4";
    const thumbFile = clipsDir + "/thumb-0.jpg";
    try {
      await cutClip(srcPath, clipFile, 0, videoDuration, [], videoTitle);
      await saveAndStream(clipFile, thumbFile, {
        start_time: 0, end_time: videoDuration, title: videoTitle,
        reason: "Complete short-form video", virality_score: "high",
        hook: videoTitle, caption: `${videoTitle} #shorts #viral`, platform_fit: src.platform,
      });
      sse(ctrl, { step: "source_complete", status: "complete", message: `✅ 1 clip from "${videoTitle.slice(0,40)}"`, sourceIndex: vIdx, clipsFromSource: 1 });
      return 1;
    } catch (err) {
      sse(ctrl, { step: "cut", status: "error", message: `❌ ffmpeg error: ${(err as Error).message.slice(0,120)}` });
      return 0;
    }
  }

  // ── TRANSCRIBE ─────────────────────────────────────────────────
  sse(ctrl, { step: "transcribe", status: "started", message: `🎙️ Transcribing audio...` });
  let transcript: { start: number; end: number; text: string }[] = [];
  try {
    const audioPath = dir + "/audio.wav";
    await extractAudio(srcPath, audioPath);
    const res = await groq.audio.transcriptions.create({
      file: createReadStream(audioPath) as Parameters<typeof groq.audio.transcriptions.create>[0]["file"],
      model: "whisper-large-v3", response_format: "verbose_json",
    });
    const segs = (res as { segments?: { start: number; end: number; text: string }[] }).segments || [];
    transcript = segs.map(s => ({ start: s.start, end: s.end, text: s.text.trim() }));
    sse(ctrl, { step: "transcribe", status: "complete", message: `✅ Transcribed (${transcript.length} segments)` });
  } catch {
    sse(ctrl, { step: "transcribe", status: "warn", message: `⚠️ Transcription failed — using time-based clips` });
  }

  // ── ANALYZE ────────────────────────────────────────────────────
  sse(ctrl, { step: "analyze", status: "started", message: `🤖 Claude finding viral moments...` });
  let moments: { start_time: number; end_time: number; title: string; reason: string; virality_score: string; hook: string; caption: string; platform_fit: string[] }[] = [];
  const clipMin = Number((campaign as Record<string,unknown>).clipLengthMin ?? 30);
  const clipMax = Number((campaign as Record<string,unknown>).clipLengthMax ?? 90);
  try {
    const transcriptText = transcript.length > 0
      ? transcript.map(s => `[${s.start.toFixed(1)}s] ${s.text}`).join("\n")
      : `No transcript available. Video duration: ${videoDuration}s. Suggest 8 evenly spaced clips each exactly ${Math.round((clipMin + clipMax) / 2)}s long (between ${clipMin}s–${clipMax}s). Start first clip at 30s, space them evenly.`;

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: `You are a viral short-form content strategist for the campaign "${campaign.name}". Identify the most compelling clip moments from the transcript. Rules: ${campaign.contentRules || "feel authentic and organic"}. Target platforms: ${campaign.platforms || "tiktok,instagram,youtube"}.

CLIP LENGTH: Each clip must be between ${clipMin}s and ${clipMax}s. Do not suggest clips shorter or longer than this range.

For the "caption" field: write an ORIGINAL caption for the clip — do NOT copy the video's title or description. The caption should be conversational, hook-driven, and platform-native (like something a creator would write themselves, not a copy of the source). Max 150 chars, no hashtag spam.

Return ONLY a valid JSON array, no markdown, no explanation.`,
      messages: [{ role: "user", content: `Video: "${videoTitle}" (${videoDuration}s)\n\nInstructions: ${campaign.aiInstructions || "find high-energy, emotional, or quotable moments"}\n\nTranscript:\n${transcriptText.slice(0, 8000)}\n\nFind 5–10 clips (${clipMin}–${clipMax}s each). Each entry: {start_time, end_time, title, reason, virality_score, hook, caption, platform_fit}${(campaign as Record<string,unknown>).extraContext ? `\n\nExtra campaign context:\n${(campaign as Record<string,unknown>).extraContext}` : ""}` }],
    });

    const raw = (msg.content[0] as { text: string }).text;
    moments = JSON.parse(raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim());
    if (!Array.isArray(moments)) throw new Error("not array");
    sse(ctrl, { step: "analyze", status: "complete", message: `✅ Found ${moments.length} moments`, momentCount: moments.length });
  } catch (err) {
    sse(ctrl, { step: "analyze", status: "error", message: `❌ Analysis: ${(err as Error).message.slice(0,80)}` });
    return 0;
  }

  // ── CUT CLIPS (parallel) ───────────────────────────────────────
  const clipJobs = moments.filter(m => {
    const d = Math.round(m.end_time - m.start_time);
    const passes = d >= clipMin && d <= clipMax && m.start_time < videoDuration;
    if (!passes) sse(ctrl, { step: "filter", status: "warn", message: `⏭️ Skipped "${(m.title||"").slice(0,35)}" — ${d}s (limit: ${clipMin}–${clipMax}s)` });
    return passes;
  }).slice(0, 12);

  if (moments.length > 0 && clipJobs.length === 0) {
    sse(ctrl, { step: "filter", status: "warn", message: `⚠️ All ${moments.length} moments filtered out — open Edit Brief and widen min/max clip length (currently ${clipMin}–${clipMax}s)` });
  }

  let clipsFromSource = 0;
  const results = await Promise.allSettled(clipJobs.map(async (m, i) => {
    const safeEnd = Math.min(m.end_time, videoDuration);
    const dur = Math.round(safeEnd - m.start_time);
    if (dur < 10) return null;

    sse(ctrl, { step: "cut", status: "progress", message: `✂️ Clip ${i+1}/${clipJobs.length}: ${m.title}` });
    const clipFile = path.join(clipsDir, `clip-${i}.mp4`);
    const thumbFile = path.join(clipsDir, `thumb-${i}.jpg`);

    await cutClip(srcPath, clipFile, m.start_time, dur, transcript, m.title);
    return await saveAndStream(clipFile, thumbFile, { ...m, end_time: safeEnd });
  }));

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) clipsFromSource++;
    else if (r.status === "rejected") sse(ctrl, { step: "cut", status: "error", message: `❌ ${(r.reason as Error).message?.slice(0,120)}` });
  }

  sse(ctrl, { step: "source_complete", status: "complete", message: `🎉 ${clipsFromSource} clips from "${videoTitle.slice(0,40)}"`, sourceIndex: vIdx, clipsFromSource });
  return clipsFromSource;
}

export async function POST(req: NextRequest) {
  const { campaignId } = await req.json();
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { sources: true } });
  if (!campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404 });

  const job = await prisma.agentJob.create({ data: { campaignId, status: "running", startedAt: new Date(), logEntries: "[]" } });

  // Helper: append a log line to DB so the client can poll even after navigating away
  async function dbLog(entry: object) {
    try {
      const current = await prisma.agentJob.findUnique({ where: { id: job.id }, select: { logEntries: true } });
      const logs = JSON.parse(current?.logEntries || "[]");
      logs.push({ ...entry, t: new Date().toISOString() });
      await prisma.agentJob.update({ where: { id: job.id }, data: { logEntries: JSON.stringify(logs) } });
    } catch { /* non-fatal */ }
  }

  // Fire the actual work in the background — runs even if client disconnects
  void (async () => {
    let totalClips = 0;
    const onClip = () => ++totalClips;
    // null controller — logs go to DB only (no SSE needed for background mode)
    const nullCtrl = { enqueue: () => {} } as unknown as ReadableStreamDefaultController;
    void nullCtrl;

    try {
      let sourceVideos = await prisma.sourceVideo.findMany({ where: { campaignId, status: "pending" }, orderBy: { createdAt: "desc" }, take: 50 });

      if (sourceVideos.length === 0 && campaign.sources.length > 0) {
        void dbLog({ step: "discover", status: "started", message: "🔍 Scanning channels for videos..." });
        const { findAllVideos } = await import("@/lib/campaign/sourceFinder");
        const { all, errors } = await findAllVideos(campaign.sources.map(s => s.url));
        for (const e of errors) void dbLog({ step: "discover", status: "warn", message: `⚠️ ${e.error.slice(0,80)}` });
        for (const v of all) {
          const ex = await prisma.sourceVideo.findFirst({ where: { campaignId, videoId: v.videoId } });
          if (!ex) await prisma.sourceVideo.create({ data: { campaignId, platform: v.platform, url: v.url, videoId: v.videoId, title: v.title, duration: v.duration, viewCount: v.viewCount || 0, uploadDate: v.uploadDate || "", status: "pending" } });
        }
        sourceVideos = await prisma.sourceVideo.findMany({ where: { campaignId, status: "pending" }, orderBy: { createdAt: "desc" }, take: 50 });
        void dbLog({ step: "discover", status: "complete", message: `✅ ${sourceVideos.length} videos queued` });
      }

      const videos = sourceVideos.length > 0
        ? sourceVideos.map(v => ({ url: v.url, platform: v.platform, title: v.title || v.url, id: v.id }))
        : campaign.sources.map(s => ({ url: s.url, platform: detectPlatform(s.url), title: s.url, id: s.id }));

      void dbLog({ step: "start", status: "started", message: `🚀 Processing ${videos.length} videos (newest first, one at a time)...` });

      // Build a stream that also mirrors every SSE message to the DB
      const dec = new TextDecoder();
      const stream = new ReadableStream({
        async start(ctrl) {
          // Proxy controller: every sse() call inside processOneVideo also writes to DB
          const dbCtrl = new Proxy(ctrl, {
            get(target, prop) {
              if (prop !== "enqueue") return (target as unknown as Record<string, unknown>)[prop as string];
              return (chunk: Uint8Array) => {
                target.enqueue(chunk);
                const text = dec.decode(chunk);
                const m = text.match(/^data: ([\s\S]+)\n\n$/);
                if (m) { try { void dbLog(JSON.parse(m[1])); } catch { /* ignore */ } }
              };
            },
          });
          for (let i = 0; i < videos.length; i += CONCURRENCY) {
            const batch = videos.slice(i, i + CONCURRENCY);
            await Promise.allSettled(batch.map((src, bi) =>
              processOneVideo(src, campaignId, job.id, campaign, i + bi, videos.length, groq, anthropic, dbCtrl, onClip)
                .catch(e => { sse(dbCtrl, { step: "error", status: "error", message: `❌ ${(e as Error).message}` }); })
            ));
          }
          await prisma.agentJob.update({ where: { id: job.id }, data: { status: "completed", completedAt: new Date() } });
          sse(dbCtrl, { step: "done", status: "complete", message: `🎉 Done — ${totalClips} clips produced`, totalClips });
          ctrl.close();
        },
      });
      // Drain the stream so processOneVideo runs to completion regardless of SSE client
      const reader = stream.getReader();
      while (true) { const { done } = await reader.read(); if (done) break; }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      void dbLog({ step: "error", status: "error", message: `❌ ${msg}` });
      await prisma.agentJob.update({ where: { id: job.id }, data: { status: "error" } }).catch(() => {});
    }
  })();

  // Return the jobId immediately so the client can start polling
  return new Response(JSON.stringify({ jobId: job.id }), {
    headers: { "Content-Type": "application/json" },
  });
}
