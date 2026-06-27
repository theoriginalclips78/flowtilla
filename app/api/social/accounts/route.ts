export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const accounts = await prisma.socialAccount.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(accounts);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.socialAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
