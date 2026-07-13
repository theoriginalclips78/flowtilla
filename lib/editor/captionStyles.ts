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
  { id: "light-box",   label: "Light Box",        font: "Arial",                 fontSize: 56, bold: -1, italic: 0,  upper: false, primary: ass("111111"), highlight: ass("111111"), outline: ass("FFFFFF"), outlineW: 0, shadow: 0, back: ass("F1F1F1","E6"), borderStyle: 3, wordsPerLine: 3, marginV: 230 },
  { id: "blue-box",    label: "Blue Box",         font: "Arial",                 fontSize: 56, bold: -1, italic: 0,  upper: true,  primary: ass("FFFFFF"), highlight: ass("FFFFFF"), outline: ass("2E6BFF"), outlineW: 0, shadow: 0, back: ass("2E6BFF","CC"), borderStyle: 3, wordsPerLine: 3, marginV: 230 },
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
// ASS numpad alignment + vertical margin for a caption position. marginV is measured
// from the bottom for bottom alignment, from the top for top, and is centred for middle.
export type CaptionPlacement = { alignment: number; marginV: number };
export const CAPTION_PLACEMENTS: Record<"top" | "middle" | "bottom", CaptionPlacement> = {
  top:    { alignment: 8, marginV: 300 },
  // "bottom" sits in the safe lower-third (~20% up from the frame edge) so TikTok/Reels/
  // Shorts UI (username, caption, action buttons) never covers the words. This is the
  // standard viral-caption position; scaled per-aspect by buildWordAss.
  bottom: { alignment: 2, marginV: 380 },
  middle: { alignment: 5, marginV: 0 },
};

export function buildWordAss(
  allWords: Word[],
  offset: number,
  duration: number,
  preset: CaptionPreset,
  wordsPerLineOverride?: number,   // "One Word" mode passes 1; default uses the preset
  placement?: CaptionPlacement,    // caption vertical position; defaults to preset bottom
  canvas: { w: number; h: number } = { w: 1080, h: 1920 },  // target frame size (multi-aspect)
): string | null {
  const wordsPerLine = Math.max(1, wordsPerLineOverride ?? preset.wordsPerLine);
  const align = placement?.alignment ?? 2;
  // Sizes are authored for a 1920-tall 9:16 frame; scale them to the real canvas height so
  // captions look right in 1:1 / 16:9 / 4:5 too.
  const sc = canvas.h / 1920;
  const px = (n: number) => Math.max(1, Math.round(n * sc));
  const fontSize = px(preset.fontSize);
  const outlineW = px(preset.outlineW);
  const shadow = px(preset.shadow);
  const marginV = px(placement?.marginV ?? preset.marginV);
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

  // Group words into caption lines by NATURAL PHRASE, not fixed N-word chunks — so lines
  // don't read as mid-sentence fragments ("goal is. As"). Break a line when it's full,
  // OR the previous word ended a sentence/clause (. ! ? , ; :), OR there's a real pause
  // (gap > 0.45s) before the next word. This keeps captions reading as coherent phrases.
  const endsClause = (w: string) => /[.!?,;:]["')\]]?$/.test(w);
  const lines: { words: typeof ws }[] = [];
  let cur: typeof ws = [];
  for (let i = 0; i < ws.length; i++) {
    cur.push(ws[i]);
    const next = ws[i + 1];
    const full = cur.length >= wordsPerLine;
    const clauseEnd = endsClause(ws[i].word) && cur.length >= Math.min(2, wordsPerLine);
    const pause = next && next.start - ws[i].end > 0.45 && cur.length >= Math.min(2, wordsPerLine);
    if (full || clauseEnd || pause || !next) { lines.push({ words: cur }); cur = []; }
  }

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${canvas.w}
PlayResY: ${canvas.h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,${preset.font},${fontSize},${preset.primary},${preset.primary},${preset.outline},${preset.back},${preset.bold},${preset.italic},0,0,100,100,0,0,${preset.borderStyle},${outlineW},${shadow},${align},${px(60)},${px(60)},${marginV},1

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
        // The active word POPS: quick scale-up then settle, coloured with the highlight.
        // This is the premium "Hormozi/Crayo" caption feel vs a flat colour swap.
        // \t is relative to this event's start, so the pop fires exactly as the word is spoken.
        // Reset scale + colour afterwards so the rest of the line stays baseline size.
        return idx === wi
          ? `{\\c${preset.highlight}\\t(0,90,\\fscx118\\fscy118)\\t(90,190,\\fscx106\\fscy106)}${word}{\\c${preset.primary}\\fscx100\\fscy100}`
          : word;
      }).join(" ");
      // Fade the line in once (on its first word) for a clean entrance, no per-word flicker.
      const lead = wi === 0 ? "{\\fad(70,0)}" : "";
      events.push(`Dialogue: 0,${toAssTime(segStart)},${toAssTime(segEnd)},Main,,0,0,0,,${lead}${text}`);
    }
  }
  if (events.length === 0) return null;
  return `${header}\n${events.join("\n")}\n`;
}

// A rotating library of TITLE-CARD looks so clips vary instead of all looking identical.
// Mix of "floating" outlined text (no box) and clean pills. Rendered via libass so every
// one is bold, auto-wrapping, and per-line centred.
export type TitleStyle = {
  id: string;
  font: string;
  fontSize: number;
  upper: boolean;
  primary: string;   // ASS
  outline: string;   // ASS
  back: string;      // ASS (box fill when borderStyle 3)
  borderStyle: number; // 1 = outline+shadow (floating), 3 = solid box (pill)
  outlineW: number;
  shadow: number;
};

export const TITLE_STYLES: TitleStyle[] = [
  { id: "float-white", font: "Arial Black",           fontSize: 72, upper: false, primary: ass("FFFFFF"), outline: ass("000000"),         back: ass("000000"),      borderStyle: 1, outlineW: 5, shadow: 4 },
  { id: "white-pill",  font: "Arial Black",           fontSize: 64, upper: false, primary: ass("151515"), outline: ass("FFFFFF"),         back: ass("FFFFFF"),      borderStyle: 3, outlineW: 14, shadow: 0 },
  { id: "black-pill",  font: "Arial Black",           fontSize: 64, upper: false, primary: ass("FFFFFF"), outline: ass("000000"),         back: ass("000000","10"), borderStyle: 3, outlineW: 14, shadow: 0 },
  { id: "float-caps",  font: "Arial Black",           fontSize: 64, upper: true,  primary: ass("FFFFFF"), outline: ass("000000"),         back: ass("000000"),      borderStyle: 1, outlineW: 6, shadow: 4 },
  { id: "yellow-pop",  font: "Arial Black",           fontSize: 68, upper: false, primary: ass("FFE94A"), outline: ass("111111"),         back: ass("000000"),      borderStyle: 1, outlineW: 6, shadow: 4 },
  { id: "comic-white", font: "Arial Rounded MT Bold", fontSize: 70, upper: false, primary: ass("FFFFFF"), outline: ass("000000"),         back: ass("000000"),      borderStyle: 1, outlineW: 9, shadow: 3 },
];

/**
 * Build a persistent TITLE CARD (ASS). Auto-wraps so long titles never clip at the frame
 * edges, bold and per-line centred. `variant` rotates the look across clips for variety;
 * `topMargin` places it (higher for letterbox's black bar).
 */
export function buildTitleAss(title: string, duration: number, variant = 0, opts?: { topMargin?: number; canvas?: { w: number; h: number } }): string | null {
  const text = (title || "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  const canvas = opts?.canvas ?? { w: 1080, h: 1920 };
  const sc = canvas.h / 1920;
  const px = (n: number) => Math.max(1, Math.round(n * sc));
  const topMargin = px(opts?.topMargin ?? 240);
  const st = TITLE_STYLES[((variant % TITLE_STYLES.length) + TITLE_STYLES.length) % TITLE_STYLES.length];
  // strip ASS-control chars; emoji are dropped (libass renders them as tofu boxes)
  let safe = text.replace(/[{}\\]/g, "")
    .replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])|[←-⇿⌀-➿⬀-⯿️]/g, "")
    .replace(/\s+/g, " ").trim();
  if (!safe) return null;
  if (st.upper) safe = safe.toUpperCase();
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${canvas.w}
PlayResY: ${canvas.h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,${st.font},${px(st.fontSize)},${st.primary},${st.primary},${st.outline},${st.back},-1,0,0,0,100,100,0,0,${st.borderStyle},${px(st.outlineW)},${px(st.shadow)},8,${px(90)},${px(90)},${topMargin},1`;
  const events = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,${toAssTime(duration)},Title,,0,0,0,,${safe}`;
  return `${header}\n\n${events}\n`;
}
