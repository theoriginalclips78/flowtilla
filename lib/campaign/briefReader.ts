import Anthropic from "@anthropic-ai/sdk";
import { anthropicText } from "@/lib/anthropic/text";

export interface BriefData {
  brandName: string | null;
  campaignType: string | null;
  cpm: number | null;
  maxPerClip: number | null;
  minPayout: number | null;
  paymentModel: string | null;
  platforms: string[] | null;
  sourceUrls: string[] | null;
  tagging: {
    tiktok: string | null;
    instagram: string | null;
    youtube: string | null;
    twitch: string | null;
    kick: string | null;
  } | null;
  captionRules: string | null;
  contentRules: string | null;
  aiInstructions: string | null;
  requirements: string[] | null;
  rejectionReasons: string[] | null;
  minimumEngagement: string | null;
  audienceRequirement: string | null;
  postDuration: string | null;
  submissionProcess: string | null;
  requiresDedicatedAccount: boolean | null;
  accountNote: string | null;
}

const SYSTEM_PROMPT = `You are a universal campaign brief parser for content creators. Extract all information from a campaign brief and return ONLY this JSON (no markdown, no explanation):

{
  "brandName": "string — the brand or creator being promoted",
  "campaignType": "clipping / ugc / reaction / review / other",
  "cpm": number or null,
  "maxPerClip": number or null,
  "minPayout": number or null,
  "paymentModel": "cpm / flat / per-submission / other",
  "platforms": ["tiktok","instagram","youtube","twitter","kick","twitch"],
  "sourceUrls": ["ALL content source URLs. IMPORTANT: If explicit URLs are not provided but social handles are mentioned (e.g. @davidfilterbuy, @handle), infer the channel URLs: for YouTube use https://www.youtube.com/@handle, for TikTok use https://www.tiktok.com/@handle, for Instagram use https://www.instagram.com/handle/ (no @ prefix). Include ALL platforms the creator posts on based on context clues in the brief."],
  "tagging": {
    "tiktok": "@handle or null",
    "instagram": "@handle or null",
    "youtube": "@handle or null",
    "twitch": "handle or null",
    "kick": "handle or null"
  },
  "captionRules": "caption do/don't rules as a string",
  "contentRules": "content rules as a string",
  "aiInstructions": "detailed description of what makes a perfect clip — specific moments, energy, visuals, emotions to look for. Include the creator's name, topic focus, what makes their content unique.",
  "requirements": ["all must-do requirements"],
  "rejectionReasons": ["all rejection/non-payment reasons"],
  "minimumEngagement": "engagement requirement or null",
  "audienceRequirement": "audience size requirement or null",
  "postDuration": "how long to keep post live",
  "submissionProcess": "how to submit clips for payment",
  "requiresDedicatedAccount": true or false — set TRUE if the brief implies you should post from a NEW / dedicated / separate / brand-specific account (phrases like 'dedicated account', 'new page', 'separate account', 'make a page for this', 'no personal page', 'clipping account'). Set FALSE if it explicitly says use your normal/existing page.,
  "accountNote": "one short sentence on the account requirement (e.g. 'Post from a dedicated account for this brand') or null"
}

CRITICAL for sourceUrls: Always try to populate this. Include EVERY explicit video URL in the brief (YouTube, youtu.be, etc.). If the brief mentions a creator handle like @davidfilterbuy and says to clip from their content, also generate channel URLs for the mentioned platforms. Never return an empty sourceUrls array if URLs or handles are present. Cap at 40 URLs.

CRITICAL for rejectionReasons: capture EVERY reason a clip gets rejected or unpaid, including brief-specific bans (e.g. "no clips of [person]"), spelling/branding requirements (e.g. "auto-captions must spell the brand correctly"), effort rules ("no low-effort slop/bait", "no raw rips"), tone rules ("no negativity toward the brand or talent"), and content bans ("nothing political/controversial", "no other brand watermarks").

For captionRules: capture the exact posting requirements — what the caption MUST mention, required tags/handles, and any per-platform difference (e.g. "X = tracking URL, all other platforms = @tag").

Keep every string field concise (under ~400 chars) and output COMPACT minified JSON on a single line. If a field is not found, set it to null. Return ONLY the JSON.`;

// Tolerant JSON extraction for the LLM's brief output. Handles markdown fences, trailing
// commas, and — most importantly — responses truncated by the token limit, which it
// salvages by balancing any unclosed strings/braces. Never throws the raw
// "Expected double-quoted property name" error at the user.
function closeTruncatedJson(s: string): string {
  let t = s.replace(/,\s*"[^"]*"\s*:?\s*("(?:[^"\\]|\\[\s\S])*)?$/, ""); // drop a dangling trailing property
  t = t.replace(/,\s*$/, "");
  const stack: string[] = [];
  let inStr = false, esc = false;
  for (const ch of t) {
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}") { if (stack[stack.length - 1] === "{") stack.pop(); }
    else if (ch === "]") { if (stack[stack.length - 1] === "[") stack.pop(); }
  }
  if (inStr) t += '"';
  while (stack.length) { t += stack.pop() === "{" ? "}" : "]"; }
  return t;
}

function parseBriefJson(raw: string): BriefData {
  let s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = s.indexOf("{"), end = s.lastIndexOf("}");
  if (start !== -1 && end > start) s = s.slice(start, end + 1);
  const tryParse = (t: string): BriefData | null => { try { return JSON.parse(t) as BriefData; } catch { return null; } };
  const candidates = [s, s.replace(/,(\s*[}\]])/g, "$1"), closeTruncatedJson(s)];
  for (const c of candidates) { const d = tryParse(c); if (d) return d; }
  throw new Error("Couldn't read this brief automatically. Try shortening it, or use the Quick Add tab.");
}

async function scrapeUrl(url: string): Promise<{ text: string; loginWall: boolean }> {
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise((r) => setTimeout(r, 2500));
    const text = await page.evaluate(() => document.body?.innerText || "");
    await browser.close();

    const lower = text.toLowerCase();
    const loginWall =
      text.length < 400 ||
      lower.includes("sign in to continue") ||
      lower.includes("log in to view") ||
      lower.includes("create an account to") ||
      lower.includes("join to access") ||
      lower.includes("members only") ||
      lower.includes("login required");

    return { text, loginWall };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Puppeteer scrape error:", msg);
    return { text: "", loginWall: false };
  }
}

export async function readAnyBrief(
  input: string
): Promise<{ data: BriefData; loginWall: boolean; rawText: string }> {
  const trimmed = input.trim();
  const isUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://");
  let rawText = trimmed;
  const loginWall = false;

  if (isUrl) {
    const scraped = await scrapeUrl(trimmed);
    if (scraped.loginWall) {
      return { data: {} as BriefData, loginWall: true, rawText: "" };
    }
    if (scraped.text) rawText = scraped.text;
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: rawText.slice(0, 16000) }],
  });

  const raw = anthropicText(msg);
  const data = parseBriefJson(raw);

  return { data, loginWall, rawText };
}
