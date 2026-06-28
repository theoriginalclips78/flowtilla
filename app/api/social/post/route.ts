export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createReadStream, statSync } from "fs";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";

async function postToTikTok(token: string, filePath: string, caption: string) {
  const stat   = statSync(filePath);
  const size   = stat.size;

  // TikTok chunk rules: each chunk 5MB–64MB. A video <= 64MB MUST be sent as a
  // single chunk where chunk_size === video_size and total_chunk_count === 1.
  // Larger videos are split into 10MB chunks (the final chunk carries the remainder).
  const MAX_SINGLE = 64 * 1024 * 1024;
  let chunkSize: number;
  let totalChunks: number;
  if (size <= MAX_SINGLE) {
    chunkSize   = size;
    totalChunks = 1;
  } else {
    chunkSize   = 10 * 1024 * 1024;
    totalChunks = Math.floor(size / chunkSize); // last chunk absorbs the remainder
  }

  // Step 1 — init upload
  const init = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      // Unaudited / Sandbox apps may ONLY post as SELF_ONLY (private). Switch to
      // PUBLIC_TO_EVERYONE once the app passes TikTok review. Override via env.
      post_info: { title: caption.slice(0, 150), privacy_level: process.env.TIKTOK_PRIVACY_LEVEL || "SELF_ONLY", disable_duet: false, disable_comment: false, disable_stitch: false },
      source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: totalChunks },
    }),
  }).then(r => r.json());

  if (!init.data?.publish_id) throw new Error(init.error?.message || JSON.stringify(init));

  const { publish_id, upload_url } = init.data;

  // Step 2 — upload chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    // last chunk runs to the end of the file (absorbs any remainder)
    const end   = i === totalChunks - 1 ? size - 1 : start + chunkSize - 1;
    const buf   = await new Promise<Buffer>((res, rej) => {
      const chunks: Buffer[] = [];
      createReadStream(filePath, { start, end }).on("data", d => chunks.push(d as Buffer)).on("end", () => res(Buffer.concat(chunks))).on("error", rej);
    });

    await fetch(upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(buf.length),
      },
      body: buf as unknown as BodyInit,
    });
  }

  // Step 3 — poll status
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const status = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ publish_id }),
    }).then(r => r.json());

    const s = status.data?.status;
    if (s === "PUBLISH_COMPLETE") return { postUrl: `https://www.tiktok.com/` };
    if (s === "FAILED") throw new Error(status.data?.fail_reason || "TikTok publish failed");
  }

  return { postUrl: "" };
}

async function postToInstagram(token: string, igUserId: string, filePath: string, caption: string) {
  // Instagram requires a publicly accessible video URL
  // We expose the clip via our own server
  const fileName = filePath.split("/").pop();
  const parts    = filePath.split("/");
  const subId    = parts[parts.length - 3]; // /tmp/clipflow/{subId}/clips/clip-N.mp4
  const clipIdx  = (fileName || "clip-0.mp4").replace("clip-","").replace(".mp4","");
  const videoUrl = `${BASE}/api/clip/${subId}/${clipIdx}`;

  // Step 1 — create media container
  const container = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "REELS", video_url: videoUrl, caption, access_token: token }),
  }).then(r => r.json());

  if (!container.id) throw new Error(container.error?.message || "Failed to create media container");

  // Step 2 — wait for container to process
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const check = await fetch(`https://graph.facebook.com/v19.0/${container.id}?fields=status_code&access_token=${token}`).then(r => r.json());
    if (check.status_code === "FINISHED") break;
    if (check.status_code === "ERROR") throw new Error("Instagram video processing failed");
  }

  // Step 3 — publish
  const pub = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  }).then(r => r.json());

  if (!pub.id) throw new Error(pub.error?.message || "Failed to publish");
  return { postUrl: `https://www.instagram.com/p/${pub.id}/` };
}

export async function POST(req: NextRequest) {
  const { clipId, platform, accountId, caption } = await req.json();

  const clip    = await prisma.clip.findUnique({ where: { id: clipId } });
  if (!clip)    return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  // Use specific account if provided, otherwise fall back to first account for platform
  const account = accountId
    ? await prisma.socialAccount.findUnique({ where: { id: accountId } })
    : await prisma.socialAccount.findFirst({ where: { platform } });
  if (!account) return NextResponse.json({ error: `No ${platform} account connected` }, { status: 400 });

  const log = await prisma.postLog.create({ data: { clipId, platform, status: "pending" } });

  try {
    let result: { postUrl?: string } = {};

    if (platform === "tiktok") {
      result = await postToTikTok(account.accessToken, clip.filePath, caption || clip.caption || clip.title);
    } else if (platform === "instagram") {
      if (!account.accountId) throw new Error("No Instagram Business account linked — check Meta app setup");
      result = await postToInstagram(account.accessToken, account.accountId, clip.filePath, caption || clip.caption || clip.title);
    }

    await prisma.postLog.update({ where: { id: log.id }, data: { status: "posted", postUrl: result.postUrl || "", postedAt: new Date() } });
    await prisma.clip.update({ where: { id: clipId }, data: { status: "approved" } });

    return NextResponse.json({ ok: true, postUrl: result.postUrl });
  } catch (err) {
    const msg = (err as Error).message;
    await prisma.postLog.update({ where: { id: log.id }, data: { status: "failed", error: msg } });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
