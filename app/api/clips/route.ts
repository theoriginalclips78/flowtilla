export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const campaignId = searchParams.get("campaignId");

  const where: Record<string, string> = {};
  if (status) where.status = status;
  if (campaignId) where.campaignId = campaignId;

  const clips = await prisma.clip.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Attach each clip's campaign tagging so the UI can render a ready-to-paste
  // caption with the correct @mention + hashtags per platform.
  const campaignIds = Array.from(new Set(clips.map(c => c.campaignId)));
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: campaignIds } },
    select: { id: true, name: true, taggingJson: true },
  });
  const cmap = new Map(campaigns.map(c => [c.id, c]));

  const enriched = clips.map(c => {
    const camp = cmap.get(c.campaignId);
    let tags: Record<string, string> = {};
    try { tags = JSON.parse(camp?.taggingJson || "{}"); } catch { /* ignore */ }
    return { ...c, campaignName: camp?.name || "", tags };
  });

  return NextResponse.json(enriched);
}

export async function PATCH(req: NextRequest) {
  const { ids, status } = await req.json();
  await prisma.clip.updateMany({ where: { id: { in: ids } }, data: { status } });
  return NextResponse.json({ ok: true });
}
