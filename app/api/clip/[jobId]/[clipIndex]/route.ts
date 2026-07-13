export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { ReadableStream as WebReadableStream } from "stream/web";
import { WORK_DIR } from "@/lib/workdir";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string; clipIndex: string } }
) {
  const { jobId, clipIndex } = params;
  // ?aspect=1x1 / 16x9 / 4x5 serves the multi-aspect variant file; default = the 9:16 primary.
  const aspect = (req.nextUrl.searchParams.get("aspect") || "").replace(/[^0-9x]/g, "");
  const name = aspect && aspect !== "9x16" ? `clip-${clipIndex}-${aspect}.mp4` : `clip-${clipIndex}.mp4`;
  const filePath = path.join(WORK_DIR, jobId, "clips", name);

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(filePath);
  } catch {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const fileSize = stat.size;
  const range = req.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const nodeStream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream) as WebReadableStream<Uint8Array>;

    return new Response(webStream as ReadableStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": "video/mp4",
      },
    });
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as WebReadableStream<Uint8Array>;

  return new Response(webStream as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename=clip-${clipIndex}.mp4`,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
    },
  });
}
