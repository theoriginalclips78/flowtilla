export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { NextRequest, NextResponse } from "next/server";
import { WORK_DIR } from "@/lib/workdir";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import crypto from "crypto";

// Receives uploaded video files (a whole folder from the browser's folder picker) and
// saves them to a fresh folder under the work dir, returning that path so the caller can
// create a local-footage campaign from it. Powers the drag/drop + "Upload folder" button.
const VIDEO_RE = /\.(mp4|mov|webm|mkv|m4v)$/i;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    const dir = path.join(WORK_DIR, "uploads", crypto.randomUUID());
    mkdirSync(dir, { recursive: true });

    let saved = 0;
    for (const f of files) {
      const name = path.basename(f.name || "");
      if (!VIDEO_RE.test(name)) continue;
      const buf = Buffer.from(await f.arrayBuffer());
      writeFileSync(path.join(dir, name), buf);
      saved++;
    }
    if (saved === 0) {
      return NextResponse.json({ error: "No video files found (need .mp4/.mov/.webm/.mkv)." }, { status: 400 });
    }
    return NextResponse.json({ path: dir, count: saved });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
