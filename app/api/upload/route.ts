export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { NextRequest, NextResponse } from "next/server";
import { WORK_DIR } from "@/lib/workdir";
import { mkdirSync, writeFileSync, readdirSync } from "fs";
import path from "path";
import crypto from "crypto";

// Receives uploaded video files and saves them into a per-session folder under the work
// dir, returning that path. Files are uploaded ONE (or a few) at a time to the same
// `uploadId` so a big folder never exceeds the request body limit. Powers the "Upload
// folder" button.
const VIDEO_RE = /\.(mp4|mov|webm|mkv|m4v)$/i;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const raw = String(form.get("uploadId") || "");
    const uploadId = /^[a-zA-Z0-9-]{6,64}$/.test(raw) ? raw : crypto.randomUUID();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    const dir = path.join(WORK_DIR, "uploads", uploadId);
    mkdirSync(dir, { recursive: true });

    for (const f of files) {
      const name = path.basename(f.name || "");
      if (!VIDEO_RE.test(name)) continue;
      const buf = Buffer.from(await f.arrayBuffer());
      writeFileSync(path.join(dir, name), buf);
    }
    // total video files accumulated in this folder so far
    const total = readdirSync(dir).filter(n => VIDEO_RE.test(n)).length;
    return NextResponse.json({ path: dir, uploadId, count: total });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
