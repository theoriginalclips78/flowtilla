import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

export type ColorPreset = "auto" | "viral" | "cinematic" | "bright" | "dark";

export interface ManualAdjustments {
  brightness?: number; // -1 to 1
  contrast?: number;   // -1000 to 1000
  saturation?: number; // 0 to 3
  warmth?: number;     // hue shift degrees
}

const PRESETS: Record<Exclude<ColorPreset, "auto">, ManualAdjustments> = {
  viral:     { brightness: 0.05, contrast: 20, saturation: 1.3 },
  cinematic: { brightness: -0.05, contrast: 30, saturation: 0.85 },
  bright:    { brightness: 0.1, contrast: 10, saturation: 1.5 },
  dark:      { brightness: -0.1, contrast: 50, saturation: 0.9 },
};

function buildEqFilter(adj: ManualAdjustments): string {
  const parts: string[] = [];
  if (adj.brightness != null) parts.push(`brightness=${adj.brightness}`);
  if (adj.contrast != null) parts.push(`contrast=${adj.contrast}`);
  if (adj.saturation != null) parts.push(`saturation=${adj.saturation}`);
  return `eq=${parts.join(":")}`;
}

export function applyColorGrade(
  jobId: string,
  clipIndex: number,
  preset: ColorPreset,
  manual?: ManualAdjustments
): Promise<string> {
  const inputPath = `/tmp/clipflow/${jobId}/clips/clip-${clipIndex}.mp4`;
  const outputPath = `/tmp/clipflow/${jobId}/clips/clip-${clipIndex}-color.mp4`;

  // For 'auto', fall back to 'viral'
  const resolved = preset === "auto" ? "viral" : preset;
  const adj = { ...(PRESETS[resolved] || {}), ...(manual || {}) };

  const filter = buildEqFilter(adj);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilter(filter)
      .outputOptions(["-c:a", "copy"])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}
