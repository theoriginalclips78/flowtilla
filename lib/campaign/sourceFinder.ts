import { spawn } from "child_process";

export interface SourceVideo {
  videoId: string;
  title: string;
  duration: number;
  url: string;
  platform: string;
  viewCount: number;
  uploadDate: string;
  status: "pending";
}

export interface FindResult {
  platform: string;
  videos: SourceVideo[];
  error?: string;
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
      else reject(new Error(err.slice(0, 500) || `yt-dlp exited ${code}`));
    });
  });
}

function detectPlatform(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("twitch.tv")) return "twitch";
  if (url.includes("kick.com")) return "kick";
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
  return "other";
}

function buildArgs(url: string, platform: string): string[] {
  const PRINT = "--print";
  // id | title | duration | webpage_url | view_count | upload_date
  const FMT = "%(id)s|||%(title)s|||%(duration)s|||%(webpage_url)s|||%(view_count)s|||%(upload_date)s";

  switch (platform) {
    case "youtube":
      if (url.includes("/watch") || url.includes("youtu.be/")) {
        return [PRINT, FMT, url];
      }
      // channel/playlist — get 30 most recent (default order is newest first)
      return ["--flat-playlist", "--playlist-end", "30", PRINT, FMT, url];

    case "tiktok":
      if (url.includes("/video/")) {
        return [PRINT, FMT, url];
      }
      return ["--flat-playlist", "--playlist-end", "30", "--no-check-certificate", PRINT, FMT, url];

    case "instagram":
      return [
        "--flat-playlist", "--playlist-end", "20",
        "--cookies-from-browser", "chrome",
        PRINT, FMT, url,
      ];

    case "twitch": {
      const match = url.match(/twitch\.tv\/([^/?#]+)/);
      const username = match?.[1] || "";
      const vodUrl = `https://www.twitch.tv/${username}/videos`;
      return ["--flat-playlist", "--playlist-end", "5", PRINT, FMT, vodUrl];
    }

    case "kick":
      return ["--flat-playlist", "--playlist-end", "5", PRINT, FMT, url];

    default:
      return [PRINT, FMT, url];
  }
}

function parseOutput(output: string, platform: string): SourceVideo[] {
  const videos: SourceVideo[] = [];
  const lines = output.trim().split("\n").filter(Boolean);

  for (const line of lines) {
    const parts = line.split("|||");
    if (parts.length < 4) continue;
    const [videoId, title, durationStr, videoUrl, viewCountStr, uploadDate] = parts;
    const duration = parseInt(durationStr, 10) || 0;
    if (!videoId || videoId === "NA" || !videoUrl || videoUrl === "NA") continue;

    videos.push({
      videoId: videoId.trim(),
      title: (title || "Untitled").trim().slice(0, 120),
      duration,
      url: videoUrl.trim(),
      platform,
      viewCount: parseInt(viewCountStr || "0", 10) || 0,
      uploadDate: (uploadDate || "").trim(),
      status: "pending",
    });
  }

  // Sort newest first (uploadDate is YYYYMMDD format)
  return videos.sort((a, b) => (b.uploadDate || "").localeCompare(a.uploadDate || ""));
}

export async function findVideosFromUrl(url: string): Promise<FindResult> {
  const platform = detectPlatform(url);
  try {
    const args = buildArgs(url, platform);
    const output = await ytdlp(args);
    const videos = parseOutput(output, platform);
    return { platform, videos };
  } catch (err) {
    return {
      platform,
      videos: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function findAllVideos(sourceUrls: string[]): Promise<{
  all: SourceVideo[];
  byPlatform: Record<string, SourceVideo[]>;
  errors: { url: string; error: string }[];
}> {
  const byPlatform: Record<string, SourceVideo[]> = {};
  const errors: { url: string; error: string }[] = [];
  const all: SourceVideo[] = [];

  for (const url of sourceUrls) {
    const result = await findVideosFromUrl(url);
    if (result.error) {
      errors.push({ url, error: result.error });
    }
    if (result.videos.length > 0) {
      byPlatform[result.platform] = [
        ...(byPlatform[result.platform] || []),
        ...result.videos,
      ];
      all.push(...result.videos);
    }
  }

  // Keep newest-first across all platforms
  all.sort((a, b) => (b.uploadDate || "").localeCompare(a.uploadDate || ""));

  return { all, byPlatform, errors };
}
