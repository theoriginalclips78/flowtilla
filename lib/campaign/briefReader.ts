import Anthropic from "@anthropic-ai/sdk";

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
  "sourceUrls": ["ALL content source URLs — YouTube channels, TikTok accounts, Twitch/Kick channels, Instagram pages"],
  "tagging": {
    "tiktok": "@handle or null",
    "instagram": "@handle or null",
    "youtube": "@handle or null",
    "twitch": "handle or null",
    "kick": "handle or null"
  },
  "captionRules": "caption do/don't rules as a string",
  "contentRules": "content rules as a string",
  "aiInstructions": "detailed description of what makes a perfect clip — specific moments, energy, visuals, emotions to look for",
  "requirements": ["all must-do requirements"],
  "rejectionReasons": ["all rejection/non-payment reasons"],
  "minimumEngagement": "engagement requirement or null",
  "audienceRequirement": "audience size requirement or null",
  "postDuration": "how long to keep post live",
  "submissionProcess": "how to submit clips for payment"
}

If a field is not found, set it to null. Return ONLY the JSON.`;

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
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: rawText.slice(0, 12000) }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text;
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const data = JSON.parse(cleaned) as BriefData;

  return { data, loginWall, rawText };
}
