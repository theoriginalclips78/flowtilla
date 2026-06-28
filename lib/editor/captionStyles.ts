/**
 * Animated caption STYLE library for FlowTilla clips.
 *
 * Produces ASS subtitle files with the viral "active word pops in colour" effect
 * using word-level timestamps. Each preset matches a popular TikTok/Reels caption
 * look (bold white, comic outline, neon glow, highlight-word, boxed, etc.).
 *
 * ASS colours are &HAABBGGRR  (alpha, blue, green, red — reversed from web hex).
 */

export type Word = { word: string; start: number; end: number };

export type CaptionPreset = {
  id: string;
  label: string;
  font: string;
  fontSize: number;
  bold: number;        // -1 = bold
  italic: number;      // -1 = italic
  upper: boolean;      // force UPPERCASE
  primary: string;     // base text colour (ASS)
  highlight: string;   // active-word colour (ASS)
  outline: string;     // outline colour (ASS)
  outlineW: number;
  shadow: number;
  back: string;        // box/background colour (ASS), used when borderStyle=3
  borderStyle: number; // 1 = outline+shadow, 3 = opaque box
  wordsPerLine: number;
  marginV: number;
};

// web hex → ASS &HAABBGGRR
function ass(hex: string, alpha = "00"): string {
  const h = hex.replace("#", "");
  const r = h.slice(0, 2), g = h.slice(2, 4), b = h.slice(4, 6);
  return `&H${alpha}${b}${g}${r}`.toUpperCase();
}

export const CAPTION_PRESETS: CaptionPreset[] = [
  { id: "bold-white",  label: "Bold White",       font: "Arial",                 fontSize: 64, bold: -1, italic: 0,  upper: false, primary: ass("FFFFFF"), highlight: ass("FFFFFF"), outline: ass("000000"), outlineW: 4, shadow: 2, back: ass("000000"), borderStyle: 1, wordsPerLine: 3, marginV: 230 },
  { id: "white-glow",  label: "White Glow",       font: "Arial",                 fontSize: 66, bold: -1, italic: 0,  upper: false, primary: ass("FFFFFF"), highlight: ass("FFFFFF"), outline: ass("FFFFFF"), outlineW: 1, shadow: 6, back: ass("000000"), borderStyle: 1, wordsPerLine: 3, marginV: 230 },
  { id: "blue-pop",    label: "Blue Word Pop",    font: "Arial",                 fontSize: 60, bold: -1, italic: -1, upper: true,  primary: ass("FFFFFF"), highlight: ass("2E6BFF"), outline: ass("000000"), outlineW: 4, shadow: 2, back: ass("000000"), borderStyle: 1, wordsPerLine: 3, marginV: 230 },
  { id: "comic-white", label: "Comic Outline",    font: "Arial Rounded MT Bold", fontSize: 62, bold: -1, italic: 0,  upper: true,  primary: ass("FFFFFF"), highlight: ass("FFFFFF"), outline: ass("000000"), outlineW: 6, shadow: 0, back: ass("000000"), borderStyle: 1, wordsPerLine: 3, marginV: 230 },
  { id: "red-pop",     label: "Red Word Pop",     font: "Arial",                 fontSize: 60, bold: -1, italic: -1, upper: true,  primary: ass("FFFFFF"), highlight: ass("E23B2E"), outline: ass("000000"), outlineW: 5, shadow: 1, back: ass("000000"), borderStyle: 1, wordsPerLine: 3, marginV: 230 },
  { id: "yellow-glow", label: "Yellow Glow",      font: "Arial",                 fontSize: 62, bold: -1, italic: 0,  upper: false, primary: ass("FFE94A"), highlight: ass("FFE94A"), outline: ass("FFE94A"), outlineW: 1, shadow: 6, back: ass("000000"), borderStyle: 1, wordsPerLine: 3, marginV: 230 },
  { id: "yellow-box",  label: "Yellow Highlight", font: "Arial",                 fontSize: 58, bold: -1, italic: 0,  upper: true,  primary: ass("FFFFFF"), highlight: ass("F4D03F"), outline: ass("000000"), outlineW: 4, shadow: 1, back: ass("000000"), borderStyle: 1, wordsPerLine: 3, marginV: 230 },
  { id: "cyan-bold",   label: "Cyan Bold",        font: "Arial",                 fontSize: 64, bold: -1, italic: 0,  upper: true,  primary: ass("5BE0E6"), highlight: ass("5BE0E6"), outline: ass("0A2A2C"), outlineW: 3, shadow: 1, back: ass("000000"), borderStyle: 1, wordsPerLine: 3, marginV: 230 },
  { id: "green-pop",   label: "Green Word Pop",   font: "Arial",                 fontSize: 60, bold: -1, italic: 0,  upper: true,  primary: ass("FFFFFF"), highlight: ass("9BE844"), outline: ass("000000"), outlineW: 5, shadow: 1, back: ass("000000"), borderStyle: 1, wordsPerLine: 3, marginV: 230 },
  { id: "pink-italic", label: "Pink Word Pop",    font: "Arial",                 fontSize: 60, bold: -1, italic: -1, upper: true,  primary: ass("FFFFFF"), highlight: ass("F4A6C0"), outline: ass("000000"), outlineW: 4, shadow: 1, back: ass("000000"), borderStyle: 1, wordsPerLine: 3, marginV: 230 },
  { id: "black-box",   label: "Black Box",        font: "Arial",                 fontSize: 56, bold: -1, italic: 0,  upper: false, primary: ass("FFFFFF"), highlight: ass("FFFFFF"), outline: ass("000000"), outlineW: 0, shadow: 0, back: ass("000000","BB"), borderStyle: 3, wordsPerLine: 3, marginV: 230 },
  { id: "purple-pop",  label: "Purple Word Pop",  font: "Arial",                 fontSize: 60, bold: -1, italic: 0,  upper: true,  primary: ass("FFFFFF"), highlight: ass("C9B6F5"), outline: ass("000000"), outlineW: 4, shadow: 1, back: ass("000000"), borderStyle: 1, wordsPerLine: 3, marginV: 230 },
];

export function presetById(id: string): CaptionPreset {
  return CAPTION_PRESETS.find(p => p.id === id) || CAPTION_PRESETS[0];
}

function toAssTime(t: number): string {
  if (t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t - Math.floor(t)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function esc(s: string): string {
  return s.replace(/[{}]/g, "").replace(/\\/g, "");
}

/**
 * Build an ASS file (1080x1920) with word-grouped captions where the currently
 * spoken word is shown in the preset's highlight colour. Returns null if there
 * are no usable words in the time window.
 */
export function buildWordAss(
  allWords: Word[],
  offset: number,
  duration: number,
  preset: CaptionPreset,
): string | null {
  const raw = allWords
    .filter(w => w.end > offset && w.start < offset + duration && w.word)
    .map(w => ({
      word: preset.upper ? w.word.toUpperCase() : w.word,
      start: Math.max(0, w.start - offset),
      end: Math.min(duration, w.end - offset),
    }))
    .sort((a, b) => a.start - b.start);

  // De-dupe overlapping/repeated word timings (whisper sometimes emits the same
  // word twice with overlapping times → "AT THAT. OH AT THAT. OH"). Drop a word
  // if it's identical to the previous one and starts before the previous ended.
  const ws: typeof raw = [];
  for (const w of raw) {
    const prev = ws[ws.length - 1];
    if (prev && prev.word === w.word && w.start < prev.end + 0.05) continue;
    if (prev && w.start < prev.end) w.start = prev.end; // remove time overlaps
    if (w.end <= w.start) w.end = w.start + 0.2;
    ws.push(w);
  }
  if (ws.length === 0) return null;

  const lines: { words: typeof ws }[] = [];
  for (let i = 0; i < ws.length; i += preset.wordsPerLine) lines.push({ words: ws.slice(i, i + preset.wordsPerLine) });

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,${preset.font},${preset.fontSize},${preset.primary},${preset.primary},${preset.outline},${preset.back},${preset.bold},${preset.italic},0,0,100,100,0,0,${preset.borderStyle},${preset.outlineW},${preset.shadow},2,60,60,${preset.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events: string[] = [];
  for (const line of lines) {
    const lineStart = line.words[0].start;
    const lineEnd = line.words[line.words.length - 1].end;
    for (let wi = 0; wi < line.words.length; wi++) {
      const segStart = wi === 0 ? lineStart : line.words[wi].start;
      const segEnd = wi === line.words.length - 1 ? lineEnd : line.words[wi + 1].start;
      if (segEnd <= segStart) continue;
      const text = line.words.map((w, idx) => {
        const word = esc(w.word);
        return idx === wi ? `{\\c${preset.highlight}}${word}{\\c${preset.primary}}` : word;
      }).join(" ");
      events.push(`Dialogue: 0,${toAssTime(segStart)},${toAssTime(segEnd)},Main,,0,0,0,,${text}`);
    }
  }
  if (events.length === 0) return null;
  return `${header}\n${events.join("\n")}\n`;
}
