export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { autoGenerateHookText } from "@/lib/editor/captions";

export async function POST(req: NextRequest) {
  try {
    const { clipTitle, clipReason, transcript } = await req.json();
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Ask Claude to pick all settings
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: `You are an expert short-form video editor. Given a clip's title, AI reason, and transcript, pick the best editing settings to maximize viral potential on TikTok/Reels/Shorts.
Return ONLY valid JSON with these fields:
{
  subtitleStyle: one of "viral-word"|"hormozi"|"outline"|"box"|"neon"|"minimal",
  layout: one of "full"|"split-gameplay"|"blur-background"|"black-bars"|"zoom-punch"|"shake",
  colorPreset: one of "viral"|"cinematic"|"bright"|"dark",
  normalize: boolean,
  removeSilence: boolean,
  progressBar: boolean,
  reasoning: string (1 sentence)
}`,
      messages: [
        {
          role: "user",
          content: `Title: ${clipTitle}\nReason: ${clipReason}\nTranscript preview: ${
            (transcript || []).slice(0, 5).map((s: { text: string }) => s.text).join(" ")
          }`,
        },
      ],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text;
    const clean = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
    const settings = JSON.parse(clean);

    // Generate hook text
    const hookText = await autoGenerateHookText(clipTitle);

    return NextResponse.json({ ...settings, hookText });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
