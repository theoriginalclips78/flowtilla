export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { findAllVideos } from "@/lib/campaign/sourceFinder";

export async function POST(req: NextRequest) {
  try {
    const { campaignId } = await req.json();
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId required" }, { status: 400 });
    }

    const sources = await prisma.campaignSource.findMany({
      where: { campaignId },
    });

    if (sources.length === 0) {
      return NextResponse.json({ totalVideos: 0, byPlatform: {}, videos: [], errors: [] });
    }

    const urls = sources.map((s) => s.url);
    const { all, byPlatform, errors } = await findAllVideos(urls);

    // Save discovered videos to SourceVideo table
    for (const video of all) {
      const existing = await prisma.sourceVideo.findFirst({
        where: { campaignId, videoId: video.videoId },
      });
      if (!existing) {
        await prisma.sourceVideo.create({
          data: {
            campaignId,
            platform: video.platform,
            url: video.url,
            videoId: video.videoId,
            title: video.title,
            duration: video.duration,
            status: "pending",
          },
        });
      }
    }

    const breakdown = Object.entries(byPlatform).map(([platform, vids]) => ({
      platform,
      count: vids.length,
    }));

    return NextResponse.json({
      totalVideos: all.length,
      byPlatform: Object.fromEntries(
        Object.entries(byPlatform).map(([k, v]) => [k, v.length])
      ),
      breakdown,
      videos: all.slice(0, 50),
      errors,
      sources,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
