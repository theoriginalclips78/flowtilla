import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { readdirSync, existsSync } from "fs";
import path from "path";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

export type LayoutType = "full" | "split-gameplay" | "blur-background" | "black-bars" | "zoom-punch" | "shake";
export type GameplayStyle = "subway-surfers" | "minecraft" | "gta" | "satisfying" | "nature";

function getGameplayFile(style: GameplayStyle): string | null {
  const dir = path.join(process.cwd(), "public/gameplay");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.toLowerCase().includes(style.replace("-", "")));
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

function randomStart(maxSeconds = 300): number {
  return Math.floor(Math.random() * maxSeconds);
}

export function applyLayout(
  jobId: string,
  clipIndex: number,
  layoutType: LayoutType,
  gameplayStyle: GameplayStyle = "subway-surfers"
): Promise<string> {
  const inputPath = `/tmp/clipflow/${jobId}/clips/clip-${clipIndex}.mp4`;
  const outputPath = `/tmp/clipflow/${jobId}/clips/clip-${clipIndex}-layout.mp4`;

  return new Promise((resolve, reject) => {
    if (layoutType === "full") {
      resolve(inputPath);
      return;
    }

    const cmd = ffmpeg();

    switch (layoutType) {
      case "split-gameplay": {
        const gameplay = getGameplayFile(gameplayStyle);
        if (!gameplay) {
          resolve(inputPath);
          return;
        }
        const ss = randomStart();
        cmd
          .input(inputPath)
          .input(gameplay)
          .inputOptions(["-ss", String(ss)])
          .complexFilter([
            "[0:v]scale=1080:960,setsar=1[top]",
            "[1:v]scale=1080:960,setsar=1[bottom]",
            "[top][bottom]vstack=inputs=2[v]",
          ])
          .outputOptions(["-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-c:a", "aac", "-shortest"])
          .output(outputPath)
          .on("end", () => resolve(outputPath))
          .on("error", reject)
          .run();
        break;
      }
      case "blur-background":
        cmd
          .input(inputPath)
          .complexFilter([
            "[0:v]scale=1080:1920,boxblur=20:20[bg]",
            "[0:v]scale=-1:1080[fg]",
            "[bg][fg]overlay=(W-w)/2:(H-h)/2[v]",
          ])
          .outputOptions(["-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-c:a", "aac"])
          .output(outputPath)
          .on("end", () => resolve(outputPath))
          .on("error", reject)
          .run();
        break;
      case "black-bars":
        cmd
          .input(inputPath)
          .complexFilter([
            "[0:v]scale=1080:-1,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[v]",
          ])
          .outputOptions(["-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-c:a", "aac"])
          .output(outputPath)
          .on("end", () => resolve(outputPath))
          .on("error", reject)
          .run();
        break;
      case "zoom-punch":
        cmd
          .input(inputPath)
          .videoFilter("zoompan=z='if(lte(mod(t,4),0.1),1.05,1)':d=1:s=1080x1920:fps=30")
          .outputOptions(["-c:a", "copy"])
          .output(outputPath)
          .on("end", () => resolve(outputPath))
          .on("error", reject)
          .run();
        break;
      case "shake":
        // Subtle camera shake via periodic crop offset
        cmd
          .input(inputPath)
          .videoFilter("crop=iw-20:ih-20:10+10*sin(t*15):10+10*cos(t*13),scale=iw+20:ih+20")
          .outputOptions(["-c:a", "copy"])
          .output(outputPath)
          .on("end", () => resolve(outputPath))
          .on("error", reject)
          .run();
        break;
      default:
        resolve(inputPath);
    }
  });
}
