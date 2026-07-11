export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicText } from "@/lib/anthropic/text";

export async function POST(req: NextRequest) {
  try {
    const { niche, audience, contentType, count } = await req.json();
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 3000,
      messages: [{
        role: "user",
        content: `Generate ${count} viral ${contentType} content ideas for: ${niche}${audience ? `, targeting ${audience}` : ""}.

Return ONLY a JSON array where each item has:
- title: catchy video title (under 10 words)
- hook: the opening line or hook (1 sentence, grabs attention instantly)
- why: why this works for the algorithm and audience (1-2 sentences)
- platform: best platform (TikTok / Instagram / YouTube)

Return ONLY the JSON array, no markdown.`
      }],
    });

    const raw = anthropicText(msg);
    const ideas = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim());
    return NextResponse.json({ ideas });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
