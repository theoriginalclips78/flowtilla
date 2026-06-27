export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const job = await prisma.agentJob.findUnique({
    where: { id: params.jobId },
    include: { clips: { orderBy: { createdAt: "asc" } } },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const logs = (() => { try { return JSON.parse(job.logEntries); } catch { return []; } })();
  return NextResponse.json({ id: job.id, status: job.status, logs, clips: job.clips });
}
