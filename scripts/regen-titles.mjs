// One-off backfill: regenerate entertaining title + caption for EXISTING clips by
// transcribing each rendered clip's audio and running it through the good generator.
// Fixes clips created by the old broken model that fell back to the filename.
//   node scripts/regen-titles.mjs           (all clips)
//   node scripts/regen-titles.mjs --limit 5 (test on a few)
import Database from "better-sqlite3";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream, existsSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const run = promisify(execFile);
const env = readFileSync(".env", "utf8") + "\n" + (existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "");
const getKey = (k) => (env.match(new RegExp(`${k}=["']?([^"'\\n]+)`)) || [])[1];
const anthropic = new Anthropic({ apiKey: getKey("ANTHROPIC_API_KEY") });
const groq = new Groq({ apiKey: getKey("GROQ_API_KEY") });

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const db = new Database("dev.db");
const camp = db.prepare("SELECT name,aiInstructions,captionRules,contentRules FROM Campaign LIMIT 1").get();
const clips = db.prepare("SELECT id,title,filePath FROM Clip ORDER BY createdAt DESC").all().slice(0, LIMIT);
const update = db.prepare("UPDATE Clip SET title=?, hook=?, caption=? WHERE id=?");

async function transcribe(videoPath) {
  const wav = path.join(os.tmpdir(), `regen-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
  try {
    await run(ffmpegPath, ["-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", wav], { maxBuffer: 1 << 26 });
    const res = await groq.audio.transcriptions.create({
      file: createReadStream(wav), model: "whisper-large-v3", response_format: "verbose_json",
    });
    return (res.segments || []).map((s) => s.text.trim()).join(" ").trim();
  } catch { return ""; } finally { try { rmSync(wav); } catch {} }
}

async function gen(spoken) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-5", max_tokens: 500,
    messages: [{ role: "user", content:
`You write scroll-stopping titles for viral short clips for the "${camp.name}" campaign.
Brand context: ${camp.aiInstructions}
${spoken ? `WHAT'S ACTUALLY SAID IN THIS CLIP (base the title on the single most surprising/entertaining/specific moment here — quote or reference it):\n"""${spoken.slice(0, 1500)}"""` : `(No clear speech — it's a visual/product moment for David Protein. Write an intriguing, curiosity-driving title.)`}

Return ONE title and ONE caption as JSON: {"title":"...","caption":"..."}

TITLE = the on-screen/card hook. It must ENTERTAIN and make a stranger stop scrolling in 1.5s:
- Lead with the most surprising, specific, or funny real detail above. Real names, numbers, stakes.
- Use one proven pattern: curiosity gap, contrarian callout, specific number, open loop, confession/POV, or named authority.
- 3-8 words. Concrete beats clever. Put exactly ONE word in ALL CAPS for emphasis. NO emojis. NO filename-style text.
- BANNED slop: "hits different","game changer","changed my life","this works","obsessed","the secret","David Mention","Ad","Truett".

CAPTION = native TikTok/IG/Shorts caption in a real creator voice (never salesy), under 125 chars, 1-2 emojis, then 4-6 hashtags.
CAPTION RULES (MUST obey): ${camp.captionRules}` }],
  });
  const raw = msg.content.map((b) => b.text || "").join("");
  const m = raw.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}

let done = 0, skipped = 0;
for (const c of clips) {
  if (!c.filePath || !existsSync(c.filePath)) { skipped++; continue; }
  const spoken = await transcribe(c.filePath);
  let out = null;
  try { out = await gen(spoken); } catch (e) { console.log(`  ! gen failed: ${e.message}`); }
  if (!out || !out.title) { skipped++; console.log(`SKIP  ${c.title}`); continue; }
  update.run(out.title, out.title, out.caption || `${out.title} #DavidProtein #fyp #viral`, c.id);
  done++;
  console.log(`\n[${done}] OLD: ${c.title}\n     NEW: ${out.title}\n     CAP: ${out.caption}`);
}
console.log(`\n✅ Regenerated ${done} clips, skipped ${skipped}.`);
db.close();
