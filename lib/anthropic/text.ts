/**
 * Extract the text from an Anthropic Messages response.
 *
 * CRITICAL: thinking-enabled models (claude-sonnet-5, claude-opus-4-8, …) return a
 * `thinking` block at content[0] and the actual answer at content[1]. Reading
 * content[0].text on those returns undefined and throws — which, in a try/catch,
 * silently degrades every AI feature to its fallback (e.g. clip titles become the
 * raw filename). Always pull the FIRST text block, never content[0] blindly.
 */
export function anthropicText(msg: { content: Array<{ type: string; text?: string }> }): string {
  if (!msg?.content?.length) return "";
  return msg.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("")
    .trim();
}
