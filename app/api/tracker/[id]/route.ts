export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// PATCH — update a post's views/likes (track growth over time).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (b.views !== undefined) data.views = Math.max(0, parseInt(b.views) || 0);
    if (b.likes !== undefined) data.likes = Math.max(0, parseInt(b.likes) || 0);
    if (typeof b.url === "string") data.url = b.url.trim();
    if (typeof b.hook === "string") data.hook = b.hook.trim();
    const post = await prisma.trackedPost.update({ where: { id: params.id }, data });
    return NextResponse.json(post);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// DELETE — stop tracking a post (idempotent).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.trackedPost.deleteMany({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
