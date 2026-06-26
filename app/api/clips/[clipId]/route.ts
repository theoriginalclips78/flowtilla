export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { clipId: string } }
) {
  try {
    const clip = await prisma.clip.findUnique({ where: { id: params.clipId } });
    if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(clip);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { clipId: string } }
) {
  try {
    const { status } = await req.json();
    const clip = await prisma.clip.update({
      where: { id: params.clipId },
      data: { status },
    });
    return NextResponse.json(clip);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
