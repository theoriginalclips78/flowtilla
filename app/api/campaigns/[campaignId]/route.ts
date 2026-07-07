export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const body = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sources: _sources, ...data } = body;

    const campaign = await prisma.campaign.update({
      where: { id: params.campaignId },
      data,
      include: { sources: true },
    });
    return NextResponse.json(campaign);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  const id = params.campaignId;
  try {
    // Delete EVERYTHING tied to this campaign, by campaignId (robust — covers orphaned rows
    // whose job was already gone), children first so no foreign key can block it. deleteMany
    // is idempotent, so a re-delete never errors and the campaign stays gone for good.
    const clips = await prisma.clip.findMany({ where: { campaignId: id }, select: { id: true } });
    const clipIds = clips.map(c => c.id);
    if (clipIds.length) await prisma.postLog.deleteMany({ where: { clipId: { in: clipIds } } }).catch(() => {});
    await prisma.clip.deleteMany({ where: { campaignId: id } });
    await prisma.agentJob.deleteMany({ where: { campaignId: id } });
    await prisma.campaignSource.deleteMany({ where: { campaignId: id } });
    await prisma.sourceVideo.deleteMany({ where: { campaignId: id } });
    await prisma.campaign.deleteMany({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
