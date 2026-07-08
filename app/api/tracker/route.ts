export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET — all tracked posts (highest views first).
export async function GET() {
  const posts = await prisma.trackedPost.findMany({ orderBy: [{ views: "desc" }, { postedAt: "desc" }] });
  return NextResponse.json(posts);
}

// POST — log a new post.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const post = await prisma.trackedPost.create({
      data: {
        platform: String(b.platform || "tiktok"),
        url: String(b.url || "").trim(),
        hook: String(b.hook || "").trim(),
        style: String(b.style || "").trim(),
        views: Math.max(0, parseInt(b.views) || 0),
        likes: Math.max(0, parseInt(b.likes) || 0),
        postedAt: b.postedAt ? new Date(b.postedAt) : new Date(),
      },
    });
    return NextResponse.json(post);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
