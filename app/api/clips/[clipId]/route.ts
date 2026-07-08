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
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.status === "string") data.status = body.status;
    if (body.posted === true) data.postedAt = new Date();
    if (body.posted === false) data.postedAt = null;
    const clip = await prisma.clip.update({
      where: { id: params.clipId },
      data,
    });
    return NextResponse.json(clip);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
