export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "fs";
import { createId } from "@paralleldrive/cuid2";

export async function POST(req: NextRequest) {
  try {
    const { script, voice, speed } = await req.json();
    if (!script) return NextResponse.json({ error: "Script required" }, { status: 400 });

    // Uses OpenAI TTS — if key not set, return clear error
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key required for TTS. Add OPENAI_API_KEY to .env.local" }, { status: 400 });

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", input: script, voice: voice || "nova", speed: speed || 1 }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "TTS failed");
    }

    const jobId = createId();
    const dir = `/tmp/clipflow/tools/${jobId}`;
    mkdirSync(dir, { recursive: true });
    const audioPath = `${dir}/voiceover.mp3`;
    writeFileSync(audioPath, Buffer.from(await res.arrayBuffer()));

    return NextResponse.json({ downloadUrl: `/api/tools/serve/${jobId}/voiceover.mp3` });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
