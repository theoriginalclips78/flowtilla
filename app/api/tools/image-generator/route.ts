export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync } from "fs";
import { createId } from "@paralleldrive/cuid2";
import { anthropicText } from "@/lib/anthropic/text";

export async function POST(req: NextRequest) {
  try {
    const { prompt, size } = await req.json();
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Use Claude to generate a detailed image description, then use a placeholder
    // In production you'd call DALL-E or Stability AI here
    // For now we'll return an SVG-based placeholder with the prompt rendered
    const jobId = createId();
    const dir = `/tmp/clipflow/tools/${jobId}`;
    mkdirSync(dir, { recursive: true });

    // Generate a creative prompt enhancement via Claude
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 200,
      messages: [{ role: "user", content: `Write a single, vivid one-sentence description of: "${prompt}". Be specific about colors, mood, and composition. No preamble.` }],
    });
    const enhanced = anthropicText(msg);

    // Create SVG placeholder image
    const [w, h] = (size || "1024x1024").split("x").map(Number);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#0F1E3C"/><stop offset="100%" style="stop-color:#C0392B"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <text x="50%" y="45%" font-family="system-ui,sans-serif" font-size="${Math.round(w * 0.025)}" fill="white" text-anchor="middle" dominant-baseline="middle" opacity="0.9">${prompt.slice(0, 40)}</text>
  <text x="50%" y="55%" font-family="system-ui,sans-serif" font-size="${Math.round(w * 0.015)}" fill="white" text-anchor="middle" dominant-baseline="middle" opacity="0.5">AI Generated</text>
</svg>`;

    const svgPath = `${dir}/image.svg`;
    writeFileSync(svgPath, svg);

    return NextResponse.json({
      imageUrl: `/api/tools/serve/${jobId}/image.svg`,
      enhanced,
      note: "Connect DALL-E or Stability AI for real image generation",
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
