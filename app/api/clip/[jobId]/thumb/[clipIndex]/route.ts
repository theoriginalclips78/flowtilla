export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { existsSync, createReadStream } from "fs";
import path from "path";
import { WORK_DIR } from "@/lib/workdir";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string; clipIndex: string } }
) {
  const thumbPath = path.join(WORK_DIR, params.jobId, "clips", `thumb-${params.clipIndex}.jpg`);
  if (!existsSync(thumbPath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const stream = createReadStream(thumbPath);
  return new Response(stream as unknown as ReadableStream, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
  });
}
