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
    // Must delete in order: Clip → AgentJob → CampaignSource → SourceVideo → Campaign
    const jobs = await prisma.agentJob.findMany({ where: { campaignId: id }, select: { id: true } });
    const jobIds = jobs.map(j => j.id);
    if (jobIds.length) {
      await prisma.clip.deleteMany({ where: { jobId: { in: jobIds } } });
      await prisma.agentJob.deleteMany({ where: { id: { in: jobIds } } });
    }
    await prisma.campaignSource.deleteMany({ where: { campaignId: id } });
    await prisma.sourceVideo.deleteMany({ where: { campaignId: id } });
    await prisma.campaign.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
