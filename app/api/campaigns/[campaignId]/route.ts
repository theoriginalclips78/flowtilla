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
  try {
    await prisma.campaignSource.deleteMany({ where: { campaignId: params.campaignId } });
    await prisma.campaign.delete({ where: { id: params.campaignId } });
    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
