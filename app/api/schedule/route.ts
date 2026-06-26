export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import cron, { ScheduledTask } from "node-cron";
import { prisma } from "@/lib/db/prisma";

// In-memory schedule registry (survives server lifetime)
const schedules = new Map<string, ScheduledTask>();

function cronExpression(frequency: string, time?: string): string {
  const hour = time ? new Date(`2000-01-01T${time}`).getHours() : 9;
  switch (frequency) {
    case "hourly": return "0 * * * *";
    case "every6h": return "0 */6 * * *";
    case "every12h": return "0 */12 * * *";
    case "weekly": return `0 ${hour} * * 0`;
    default: return `0 ${hour} * * *`; // daily
  }
}

function nextRun(): Date {
  return new Date(Date.now() + 3600 * 1000);
}

async function triggerAgentRun(campaignId: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    console.log(`[schedule] triggered campaign ${campaignId}, status=${res.status}`);
  } catch (err) {
    console.error(`[schedule] failed to trigger campaign ${campaignId}`, err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { campaignId, frequency, time } = await req.json();

    // Cancel existing schedule for this campaign
    schedules.get(campaignId)?.stop();

    const expression = cronExpression(frequency, time);
    const task = cron.schedule(expression, () => triggerAgentRun(campaignId));
    schedules.set(campaignId, task);

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { scheduleEnabled: true, scheduleFrequency: frequency, scheduleTime: time },
    });

    return NextResponse.json({ scheduleId: campaignId, expression, nextRun: nextRun() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");
    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

    schedules.get(campaignId)?.stop();
    schedules.delete(campaignId);

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { scheduleEnabled: false },
    });

    return NextResponse.json({ cancelled: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
