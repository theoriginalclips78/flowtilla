import Anthropic from "@anthropic-ai/sdk";
import { anthropicText } from "@/lib/anthropic/text";

const SYSTEM_PROMPT = `You are a viral social media caption writer for short-form content.
Given a clip title, AI reason, and campaign brief rules, write a caption that:
- Does NOT mention the brand name promotionally
- Does NOT use words like 'buy', 'check out', 'get this', 'link in bio'
- Feels like a normal organic post
- Is under 150 characters
- Includes 3-5 relevant hashtags
- Matches the energy of the clip (funny, hype, inspiring, etc.)
Return ONLY the caption text, nothing else.`;

export async function generateCaption(
  clipTitle: string,
  clipReason: string,
  contentRules: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Clip title: ${clipTitle}\nWhy it's good: ${clipReason}\nContent rules: ${contentRules}`,
      },
    ],
  });

  return anthropicText(msg);
}

export async function autoGenerateHookText(clipTitle: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 100,
    system: "Write a short hook text (3-6 words) to put on the first 2 seconds of a short-form video. Make it create curiosity or excitement. Examples: 'Wait for it... 👀', 'This is insane 🔥', 'Nobody talks about this'. Return ONLY the hook text.",
    messages: [{ role: "user", content: `Video title: ${clipTitle}` }],
  });

  return anthropicText(msg);
}
