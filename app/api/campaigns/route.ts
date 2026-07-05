export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    include: { sources: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sources, ...campaignData } = body;

    const campaign = await prisma.campaign.create({
      data: {
        ...campaignData,
        // Default new campaigns to the premium look unless the UI specifies otherwise.
        videoLayout: campaignData.videoLayout || "letterbox",
        // Keep medium+ moments (drops only filler); the engine ranks high clips first.
        minVirality: campaignData.minVirality || "medium",
        sources: {
          create: sources || [],
        },
      },
      include: { sources: true },
    });
    return NextResponse.json(campaign);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
