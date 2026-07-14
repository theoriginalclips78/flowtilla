# Solvek — AI video clipping engine

Turn one long video into a batch of viral, ready-to-post short clips. Solvek scans a
podcast, interview, or stream, finds the moments most likely to pop, reframes them to
follow the speaker, burns in animated captions and a scroll-stopping hook, and exports
a vertical clip for every platform — all automatically.

It's built to run a content-clipping operation at scale (hundreds of clips a day) and to
match the output quality of closed tools like Crayo, OpusClip, and Vugola — as a
self-hostable engine you own.

---

## What it does

Paste a video URL (or add it to a campaign) and Solvek runs the full pipeline:

1. **Download** — pulls the source (YouTube, etc.) via `yt-dlp`.
2. **Transcribe** — word-level timestamps from Whisper (Groq) across the whole video.
3. **Find the moments** — Claude ranks the most viral, self-contained beats and drops the filler.
4. **Write the hooks** — Claude writes the on-screen hook for each clip, then A/B-tests 2 alternatives and keeps the strongest.
5. **Reframe** — OpenCV detects the speaker per shot and drives a **shot-aware tracking crop** that follows them across cuts (falls back to a static magic-crop, then blur-fill).
6. **Caption + title** — animated word-by-word captions (phrase-grouped, in the platform-safe lower third) plus a persistent title card.
7. **Polish** — silence-trim for pacing, a subtle opening punch-in, loudness-normalized audio (−14 LUFS), and a smart face-forward thumbnail.
8. **Export** — GPU-encoded 1080×1920 (plus 1:1 / 16:9 on demand), each verified by a quality-control pass before it's saved.

## Key features

- **Shot-aware speaker tracking** — the vertical frame follows whoever is talking, cut to cut.
- **AI hooks with A/B selection** — the on-screen line that decides retention, optimized per clip.
- **Animated captions** — word-pop, phrase-aware grouping, active-word highlight, platform-safe placement.
- **Multi-aspect export** — 9:16, 1:1, 16:9, 4:5 from a single analysis.
- **Edit tiers** — fully edited · magic-crop only · subtitles only · raw cut.
- **Quality control + retry** — every render is validated (size, streams, duration); a broken render is re-tried on a fallback encoder, never shipped.
- **GPU encoding** — Apple VideoToolbox with an automatic `libx264` fallback (~2× faster, far less CPU).
- **Built for volume** — bounded concurrency, auto-cleanup of render artifacts, fail-open throughout.

## Tech stack

- **App:** Next.js (App Router) · React · TypeScript · Tailwind CSS
- **Data:** Prisma + SQLite (better-sqlite3)
- **AI:** Claude (`@anthropic-ai/sdk`) for hooks, moment-finding, brief reading · Whisper via Groq for transcription
- **Media:** `ffmpeg` (ffmpeg-static) for cutting/encoding · **OpenCV** (Python) for face detection, per-shot tracking, and cover-frame selection · `yt-dlp` for downloads

## Architecture

```
app/
  api/agent/run/          the campaign clip pipeline (download → transcribe → moments → render)
  api/tools/auto-clip/    the paste-a-URL clip pipeline
  (dashboard, agent, clips, post, social, tools, settings …)  the app UI
lib/
  clipEngine/render.ts    the shared render engine — tracking, magic crop, captions, QC, retry
  editor/captionStyles.ts animated-caption / title ASS generation
scripts/
  reframe.py              dominant-face position (static magic crop)
  reframe_track.py        per-shot subject tracking (dynamic crop)
  best_thumb.py           best cover-frame selection
```

The render engine is shared by both entry points so a clip looks identical however it was made.

## Getting started

**Prerequisites:** Node 18+, Python 3.9+ with OpenCV (`pip install opencv-python numpy`),
and `yt-dlp` on your PATH (with a JS runtime available for YouTube). `ffmpeg` ships via
`ffmpeg-static`.

```bash
npm install
cp .env.local.example .env.local   # add your ANTHROPIC_API_KEY and GROQ_API_KEY
npx prisma db push                  # create the local SQLite database
npm run dev                         # http://localhost:3000
```

Secrets live in `.env.local` (git-ignored). Never commit real API keys.

## Status

Actively developed. The clipping **engine** is production-grade and validated end-to-end;
the web UI is being refreshed. Built to power a real clipping agency.

## License

See [LICENSE](LICENSE).
