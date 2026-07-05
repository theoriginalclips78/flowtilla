export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createReadStream, existsSync, mkdtempSync, mkdirSync, symlinkSync, rmSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { spawn } from "child_process";
import { Readable } from "stream";

// Bundle every clip for a campaign into a single .zip so the user grabs a whole batch at
// once. Uses the system `zip` on a staging dir of symlinks (named NN_title.mp4) — no big
// memory copies, and it streams the finished zip back, cleaning up when the download ends.
export async function GET(_req: NextRequest, { params }: { params: { campaignId: string } }) {
  const campaign = await prisma.campaign.findUnique({ where: { id: params.campaignId }, select: { name: true } });
  if (!campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404 });

  const clips = await prisma.clip.findMany({
    where: { campaignId: params.campaignId },
    select: { title: true, filePath: true },
    orderBy: { createdAt: "asc" },
  });
  const usable = clips.filter(c => c.filePath && existsSync(c.filePath));
  if (usable.length === 0) {
    return new Response(JSON.stringify({ error: "No downloadable clips found for this campaign yet." }), { status: 404 });
  }

  // Each download goes into its own DATED folder so re-running a campaign and downloading
  // again never merges into the previous batch — you get a fresh, distinctly-named folder.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const base = (campaign.name || "montview").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "montview";
  const folderName = `${base}-${stamp}`;

  const staging = mkdtempSync(path.join(tmpdir(), "mv-zip-"));
  const innerDir = path.join(staging, folderName);
  mkdirSync(innerDir);
  const outZip = `${staging}.zip`;
  usable.forEach((c, i) => {
    const safe = (c.title || "clip").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).toLowerCase() || "clip";
    try { symlinkSync(c.filePath, path.join(innerDir, `${String(i + 1).padStart(2, "0")}_${safe}.mp4`)); } catch { /* skip */ }
  });

  await new Promise<void>((resolve) => {
    // -r includes the dated folder as the top level; no -y => follow symlinks, store content
    const p = spawn("zip", ["-q", "-X", "-r", outZip, folderName], { cwd: staging });
    p.on("close", () => resolve());
    p.on("error", () => resolve());
  });

  const cleanup = () => { try { rmSync(staging, { recursive: true, force: true }); } catch { /* noop */ } try { unlinkSync(outZip); } catch { /* noop */ } };
  if (!existsSync(outZip)) { cleanup(); return new Response(JSON.stringify({ error: "Failed to build the zip." }), { status: 500 }); }

  const nodeStream = createReadStream(outZip);
  nodeStream.on("close", cleanup);
  nodeStream.on("error", cleanup);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${folderName}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
