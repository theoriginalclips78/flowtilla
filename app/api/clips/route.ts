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
  return NextResponse.json(clips);
}

export async function PATCH(req: NextRequest) {
  const { ids, status } = await req.json();
  await prisma.clip.updateMany({ where: { id: { in: ids } }, data: { status } });
  return NextResponse.json({ ok: true });
}
