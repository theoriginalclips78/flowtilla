export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { existsSync, createReadStream, statSync } from "fs";

const MIME: Record<string, string> = {
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  svg: "image/svg+xml",
  jpg: "image/jpeg",
  png: "image/png",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string; filename: string } }
) {
  const filePath = `/tmp/clipflow/tools/${params.jobId}/${params.filename}`;
  if (!existsSync(filePath)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ext = params.filename.split(".").pop() || "";
  const mime = MIME[ext] || "application/octet-stream";
  const size = statSync(filePath).size;
  const stream = createReadStream(filePath);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${params.filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
