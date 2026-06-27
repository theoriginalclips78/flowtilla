import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import crypto from "crypto";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";

async function getCreds() {
  const s = await prisma.userSettings.findUnique({ where: { id: "default" } });
  return s || {};
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const { platform } = params;
  const creds = await getCreds() as Record<string, string>;

  if (platform === "tiktok") {
    const clientKey = creds.tiktokClientKey || process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) return NextResponse.redirect(`${BASE}/settings?social_error=missing_tiktok_key`);
    const state    = crypto.randomBytes(16).toString("hex");
    const redirect = encodeURIComponent(`${BASE}/api/social/callback/tiktok`);
    const scope    = "user.info.basic,video.publish,video.upload";
    return NextResponse.redirect(
      `https://www.tiktok.com/v2/auth/authorize?client_key=${clientKey}&scope=${scope}&response_type=code&redirect_uri=${redirect}&state=${state}`
    );
  }

  if (platform === "instagram") {
    const appId = creds.metaAppId || process.env.META_APP_ID;
    if (!appId) return NextResponse.redirect(`${BASE}/settings?social_error=missing_meta_key`);
    const redirect = encodeURIComponent(`${BASE}/api/social/callback/instagram`);
    const scope    = "instagram_basic,instagram_content_publish,pages_read_engagement";
    return NextResponse.redirect(
      `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirect}&scope=${scope}&response_type=code`
    );
  }

  return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
}
