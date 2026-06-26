import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { existsSync } from "fs";
import path from "path";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

export interface OverlayOptions {
  hookText?: string | null;
  hookDuration?: number;
  hookPosition?: "top" | "middle";
  progressBar?: boolean;
  progressColor?: string;
  watermarkText?: string | null;
  watermarkLogo?: string | null;
  watermarkPosition?: "tl" | "tr" | "bl" | "br";
  watermarkOpacity?: number;
  endCard?: boolean;
  endCardText?: string;
  endCardDuration?: number;
  totalDuration?: number;
}

function escapeFFmpeg(s: string): string {
  return s.replace(/[\\:',]/g, "\\$&");
}

function fontPath(): string {
  const f = path.join(process.cwd(), "public/fonts/Montserrat-Bold.ttf");
  return existsSync(f) ? f : "/System/Library/Fonts/Helvetica.ttc";
}

export function addOverlays(
  jobId: string,
  clipIndex: number,
  options: OverlayOptions = {}
): Promise<string> {
  const {
    hookText,
    hookDuration = 2,
    hookPosition = "top",
    progressBar = false,
    progressColor = "#C0392B",
    watermarkText,
    watermarkOpacity = 40,
    endCard = false,
    endCardText = "Follow for more",
    endCardDuration = 2,
    totalDuration = 60,
  } = options;

  const inputPath = `/tmp/clipflow/${jobId}/clips/clip-${clipIndex}.mp4`;
  const outputPath = `/tmp/clipflow/${jobId}/clips/clip-${clipIndex}-overlays.mp4`;
  const font = fontPath();
  const filters: string[] = [];

  // Hook text (first N seconds)
  if (hookText) {
    const yPos = hookPosition === "top" ? "h*0.08" : "(h-text_h)/2";
    filters.push(
      `drawtext=fontfile=${font}:text='${escapeFFmpeg(hookText)}':fontsize=68:fontcolor=white:bordercolor=black:borderw=4:x=(w-text_w)/2:y=${yPos}:enable='between(t,0,${hookDuration})':alpha='if(lt(t,${hookDuration - 0.3}),1,lerp(1,0,(t-${hookDuration - 0.3})/0.3))'`
    );
  }

  // Progress bar — thin bar at very top
  if (progressBar) {
    // drawbox spanning from 0 to (t/duration)*w
    filters.push(
      `drawbox=x=0:y=0:w='(t/${totalDuration})*iw':h=6:color=${progressColor}:t=fill:enable='gte(t,0)'`
    );
  }

  // Watermark text
  if (watermarkText) {
    const opacity = (watermarkOpacity || 40) / 100;
    filters.push(
      `drawtext=fontfile=${font}:text='${escapeFFmpeg(watermarkText)}':fontsize=28:fontcolor=white@${opacity}:x=w*0.05:y=h*0.9`
    );
  }

  // End card
  if (endCard && totalDuration > 0) {
    const startT = Math.max(0, totalDuration - endCardDuration);
    filters.push(
      `drawtext=fontfile=${font}:text='${escapeFFmpeg(endCardText)}':fontsize=52:fontcolor=white:bordercolor=black:borderw=3:x=(w-text_w)/2:y=(h-text_h)/2:enable='gte(t,${startT})'`
    );
  }

  if (filters.length === 0) {
    return Promise.resolve(inputPath);
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilter(filters.join(","))
      .outputOptions(["-c:a", "copy"])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}
