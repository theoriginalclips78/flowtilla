import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { existsSync, readdirSync } from "fs";
import path from "path";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

export interface AudioOptions {
  normalize?: boolean;
  removeSilence?: boolean;
  musicTrack?: string | null;
  musicVolume?: number;
  speedRamp?: boolean;
}

function getMusicFile(trackName?: string | null): string | null {
  const dir = path.join(process.cwd(), "public/music");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => /\.(mp3|wav|m4a)$/i.test(f));
  if (files.length === 0) return null;
  if (trackName) {
    const match = files.find((f) => f.toLowerCase().includes(trackName.toLowerCase()));
    if (match) return path.join(dir, match);
  }
  return path.join(dir, files[0]);
}

export function enhanceAudio(
  jobId: string,
  clipIndex: number,
  options: AudioOptions = {}
): Promise<string> {
  const {
    normalize = true,
    removeSilence = true,
    musicTrack = null,
    musicVolume = 15,
  } = options;

  const inputPath = `/tmp/clipflow/${jobId}/clips/clip-${clipIndex}.mp4`;
  const outputPath = `/tmp/clipflow/${jobId}/clips/clip-${clipIndex}-audio.mp4`;
  const musicFile = musicTrack !== undefined ? getMusicFile(musicTrack) : null;

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg().input(inputPath);
    const audioFilters: string[] = [];

    if (normalize) audioFilters.push("loudnorm=I=-14:TP=-1:LRA=11");
    if (removeSilence) audioFilters.push("silenceremove=start_periods=1:start_silence=0.5:start_threshold=-50dB");

    if (musicFile && existsSync(musicFile)) {
      cmd.input(musicFile);
      const musicVol = (musicVolume || 15) / 100;
      const speechFilter = audioFilters.length > 0 ? `[0:a]${audioFilters.join(",")}[speech]` : "[0:a]anull[speech]";
      cmd
        .complexFilter([
          speechFilter,
          `[1:a]volume=${musicVol}[music]`,
          "[speech][music]amix=inputs=2:duration=first:dropout_transition=2[aout]",
        ])
        .outputOptions(["-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-shortest"])
        .output(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", reject)
        .run();
    } else if (audioFilters.length > 0) {
      cmd
        .audioFilter(audioFilters.join(","))
        .outputOptions(["-c:v", "copy", "-c:a", "aac"])
        .output(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", reject)
        .run();
    } else {
      resolve(inputPath);
    }
  });
}
