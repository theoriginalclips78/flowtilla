import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import path from "path";
import { existsSync } from "fs";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

export type SubtitleStyle = "viral-word" | "hormozi" | "outline" | "box" | "neon" | "minimal";

interface Segment { start: number; end: number; text: string }

// Word-level segmentation from sentence-level transcript
function toWords(segments: Segment[]): Segment[] {
  const words: Segment[] = [];
  for (const seg of segments) {
    const ws = seg.text.trim().split(/\s+/).filter(Boolean);
    if (ws.length === 0) continue;
    const dur = (seg.end - seg.start) / ws.length;
    ws.forEach((w, i) => {
      words.push({ start: seg.start + i * dur, end: seg.start + (i + 1) * dur, text: w });
    });
  }
  return words;
}

// Group words into lines of max 4
function toLines(segments: Segment[], maxWords = 4): Segment[] {
  const lines: Segment[] = [];
  let buf: Segment[] = [];
  for (const w of segments) {
    buf.push(w);
    if (buf.length >= maxWords) {
      lines.push({ start: buf[0].start, end: buf[buf.length - 1].end, text: buf.map((b) => b.text).join(" ") });
      buf = [];
    }
  }
  if (buf.length) lines.push({ start: buf[0].start, end: buf[buf.length - 1].end, text: buf.map((b) => b.text).join(" ") });
  return lines;
}

function escapeFFmpeg(s: string): string {
  return s.replace(/[\\:',]/g, "\\$&").replace(/'/g, "\\'");
}

// Build drawtext filter for each segment
function buildDrawtextFilters(units: Segment[], style: SubtitleStyle, fontPath: string): string {
  return units.map((u) => {
    const text = escapeFFmpeg(style === "hormozi" ? u.text.toUpperCase() : u.text);
    const t0 = u.start.toFixed(3);
    const t1 = u.end.toFixed(3);
    const enable = `between(t,${t0},${t1})`;

    switch (style) {
      case "viral-word":
        return `drawtext=fontfile=${fontPath}:text='${text}':fontsize=72:fontcolor=white:bordercolor=black:borderw=4:x=(w-text_w)/2:y=(h-text_h)/2:enable='${enable}'`;
      case "hormozi":
        return `drawtext=fontfile=${fontPath}:text='${text}':fontsize=64:fontcolor=yellow:bordercolor=black:borderw=5:x=(w-text_w)/2:y=h*0.75-text_h/2:enable='${enable}'`;
      case "outline":
        return `drawtext=fontfile=${fontPath}:text='${text}':fontsize=56:fontcolor=white:bordercolor=#FF4444:borderw=3:x=(w-text_w)/2:y=h*0.85-text_h/2:enable='${enable}'`;
      case "box":
        return `drawtext=fontfile=${fontPath}:text='${text}':fontsize=52:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8:x=(w-text_w)/2:y=h*0.85-text_h/2:enable='${enable}'`;
      case "neon":
        return `drawtext=fontfile=${fontPath}:text='${text}':fontsize=60:fontcolor=0x00FFFF:bordercolor=0x00FFFF:borderw=2:shadowx=0:shadowy=0:x=(w-text_w)/2:y=h*0.85-text_h/2:enable='${enable}'`;
      case "minimal":
        return `drawtext=fontfile=${fontPath}:text='${text}':fontsize=40:fontcolor=white:shadowcolor=black@0.8:shadowx=1:shadowy=1:x=(w-text_w)/2:y=h*0.9-text_h:enable='${enable}'`;
      default:
        return `drawtext=fontfile=${fontPath}:text='${text}':fontsize=52:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.85:enable='${enable}'`;
    }
  }).join(",");
}

export function burnSubtitles(
  jobId: string,
  clipIndex: number,
  style: SubtitleStyle,
  transcript: Segment[]
): Promise<string> {
  const inputPath = `/tmp/clipflow/${jobId}/clips/clip-${clipIndex}.mp4`;
  const outputPath = `/tmp/clipflow/${jobId}/clips/clip-${clipIndex}-sub.mp4`;

  const fontPath = path.join(process.cwd(), "public/fonts/Montserrat-Bold.ttf");
  const fallbackFont = "/System/Library/Fonts/Helvetica.ttc";
  const resolvedFont = existsSync(fontPath) ? fontPath : fallbackFont;

  // Use word-level for viral-word, lines for others
  const units = style === "viral-word" || style === "hormozi"
    ? toWords(transcript)
    : toLines(transcript);

  const filter = buildDrawtextFilters(units, style, resolvedFont);

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
