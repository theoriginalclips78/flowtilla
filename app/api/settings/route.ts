export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    let settings = await prisma.userSettings.findFirst({ where: { id: "default" } });
    if (!settings) {
      settings = await prisma.userSettings.create({ data: { id: "default" } });
    }
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const settings = await prisma.userSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...body },
      update: body,
    });
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
