export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const sources = await prisma.campaignSource.findMany({
      where: { campaignId: params.campaignId },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(sources);
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
