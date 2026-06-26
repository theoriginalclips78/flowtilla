export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { generateCaption } from "@/lib/editor/captions";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const { clipId, clipTitle, clipReason, contentRules } = await req.json();

    const caption = await generateCaption(clipTitle, clipReason, contentRules || "");

    if (clipId) {
      await prisma.clip.update({
        where: { id: clipId },
        data: { status: "edited" }, // caption stored separately; extend schema if needed
      });
    }

    return NextResponse.json({ caption });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
