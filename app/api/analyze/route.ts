export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { writeFileSync } from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const {
      jobId,
      transcript,
      campaignName,
      aiInstructions,
      contentRules,
      clipCount,
      clipLength,
    } = await req.json();

    const transcriptText = transcript
      .map((s: { start: number; end: number; text: string }) =>
        `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s] ${s.text}`
      )
      .join("\n");

    const systemPrompt = `You are a viral content strategist and professional video clipper. You will receive a video transcript with timestamps and a campaign brief. Your job is to identify the best moments to clip based on the brief requirements.

For each clip return:
- start_time: number (seconds)
- end_time: number (seconds)
- title: string (catchy, under 8 words, include an emoji)
- reason: string (2-3 sentences explaining viral potential)
- virality_score: 'high' | 'medium' | 'low'

Rules:
- Clips must be between ${clipLength - 10} and ${clipLength + 30} seconds long
- Find exactly ${clipCount} clips
- Prioritize moments matching the campaign brief
- Return ONLY a valid JSON array, no markdown, no explanation`;

    const userMessage = `Campaign: ${campaignName}
AI Instructions: ${aiInstructions}
Content Rules: ${contentRules}

Transcript:
${transcriptText}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text;
    const clips = JSON.parse(raw);

    writeFileSync(
      path.join(`/tmp/clipflow/${jobId}`, "moments.json"),
      JSON.stringify(clips, null, 2)
    );

    return NextResponse.json({ clips });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
