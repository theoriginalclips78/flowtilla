export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { mkdirSync, existsSync, readFileSync } from "fs";
import path from "path";
import { prisma } from "@/lib/db/prisma";

const FFMPEG_BIN = "/Users/ahmedsaciidabdullahi/clipflow/node_modules/ffmpeg-static/ffmpeg";
const FONT = "/System/Library/Fonts/Helvetica.ttc";
const AVATAR_DIR = "/tmp/clipflow/avatars";

// A curated palette so every campaign gets a distinct but tasteful colour.
const PALETTE = [
  ["#9B1C1C", "#6E1212"], // maroon
  ["#1E3A8A", "#0F1E3C"], // navy
  ["#047857", "#064E3B"], // emerald
  ["#7C3AED", "#4C1D95"], // violet
  ["#B45309", "#7C2D12"], // amber/burnt
  ["#0E7490", "#083344"], // teal
  ["#BE185D", "#831843"], // pink
  ["#374151", "#111827"], // slate
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "FT";
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  // single word: catch internal capitals (YoungLA -> YL, FlowTilla -> FT)
  const w = words[0];
  const cap = w.slice(1).match(/[A-Z0-9]/);
  if (cap) return (w[0] + cap[0]).toUpperCase();
  return w.slice(0, 2).toUpperCase();
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, ["-y", ...args]);
    let err = "";
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (c) => (c === 0 ? resolve() : reject(new Error(err.slice(-400)))));
  });
}

export async function GET(_req: NextRequest, { params }: { params: { campaignId: string } }) {
  const campaign = await prisma.campaign.findUnique({ where: { id: params.campaignId }, select: { name: true } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const text = initials(campaign.name);
  const [c1, c2] = PALETTE[hashStr(campaign.name) % PALETTE.length];

  mkdirSync(AVATAR_DIR, { recursive: true });
  const outPath = path.join(AVATAR_DIR, `${params.campaignId}.png`);

  // Regenerate each request (campaign name can change) — fast for a single frame.
  try {
    // 1024x1024: vertical gradient background + big bold initials + a soft inner ring.
    await ffmpeg([
      "-f", "lavfi",
      "-i", `gradients=s=1024x1024:c0=${c1}:c1=${c2}:x0=0:y0=0:x1=1024:y1=1024`,
      "-vf", [
        // subtle vignette ring
        `drawbox=x=40:y=40:w=944:h=944:color=white@0.10:t=8`,
        // initials
        `drawtext=fontfile=${FONT}:text='${text}':fontsize=440:fontcolor=white:borderw=0:x=(w-text_w)/2:y=(h-text_h)/2-30:shadowcolor=black@0.25:shadowx=0:shadowy=8`,
        // small brand wordmark at the bottom
        `drawtext=fontfile=${FONT}:text='FLOWTILLA':fontsize=34:fontcolor=white@0.55:x=(w-text_w)/2:y=h-120`,
      ].join(","),
      "-frames:v", "1", "-update", "1", outPath,
    ]);
  } catch (e) {
    return NextResponse.json({ error: "Failed to render avatar: " + (e as Error).message }, { status: 500 });
  }

  if (!existsSync(outPath)) return NextResponse.json({ error: "Avatar not generated" }, { status: 500 });

  const buf = readFileSync(outPath);
  const safeName = campaign.name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "campaign";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${safeName}-profile.png"`,
      "Cache-Control": "no-store",
    },
  });
}
