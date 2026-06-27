import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";

async function getCreds() {
  const s = await prisma.userSettings.findUnique({ where: { id: "default" } });
  return (s || {}) as Record<string, string>;
}

export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const { platform } = params;
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${BASE}/settings?social_error=no_code`);

  const creds = await getCreds();

  try {
    if (platform === "tiktok") {
      const clientKey    = creds.tiktokClientKey    || process.env.TIKTOK_CLIENT_KEY!;
      const clientSecret = creds.tiktokClientSecret || process.env.TIKTOK_CLIENT_SECRET!;
      const redirect     = `${BASE}/api/social/callback/tiktok`;

      const res  = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirect }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error_description || data.error);

      const me = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,open_id", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      }).then(r => r.json());

      const accountId   = me?.data?.user?.open_id || "";
      const accountName = me?.data?.user?.display_name || "TikTok";

      // Upsert by platform + accountId so multiple TikTok accounts can coexist
      const existing = accountId
        ? await prisma.socialAccount.findFirst({ where: { platform: "tiktok", accountId } })
        : null;

      if (existing) {
        await prisma.socialAccount.update({
          where: { id: existing.id },
          data: { accessToken: data.access_token, refreshToken: data.refresh_token || "", accountName, expiresAt: new Date(Date.now() + (data.expires_in || 86400) * 1000) },
        });
      } else {
        await prisma.socialAccount.create({
          data: { platform: "tiktok", accessToken: data.access_token, refreshToken: data.refresh_token || "", accountName, accountId, expiresAt: new Date(Date.now() + (data.expires_in || 86400) * 1000) },
        });
      }
      return NextResponse.redirect(`${BASE}/settings?social_connected=tiktok&account=${encodeURIComponent(accountName)}`);
    }

    if (platform === "instagram") {
      const appId     = creds.metaAppId     || process.env.META_APP_ID!;
      const appSecret = creds.metaAppSecret || process.env.META_APP_SECRET!;
      const redirect  = `${BASE}/api/social/callback/instagram`;

      const res  = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const ll        = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${data.access_token}`).then(r => r.json());
      const longToken = ll.access_token || data.access_token;

      const pages = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longToken}`).then(r => r.json());
      const page  = pages.data?.[0];
      const igRes = page ? await fetch(`https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`).then(r => r.json()) : null;
      const igId  = igRes?.instagram_business_account?.id || "";
      const me    = await fetch(`https://graph.facebook.com/v19.0/me?fields=name&access_token=${longToken}`).then(r => r.json());
      const accountName = me.name || "Instagram";

      const existing = igId
        ? await prisma.socialAccount.findFirst({ where: { platform: "instagram", accountId: igId } })
        : null;

      if (existing) {
        await prisma.socialAccount.update({
          where: { id: existing.id },
          data: { accessToken: longToken, accountName, accountId: igId, expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000) },
        });
      } else {
        await prisma.socialAccount.create({
          data: { platform: "instagram", accessToken: longToken, accountName, accountId: igId, expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000) },
        });
      }
      return NextResponse.redirect(`${BASE}/settings?social_connected=instagram&account=${encodeURIComponent(accountName)}`);
    }

    return NextResponse.redirect(`${BASE}/settings?social_error=unknown_platform`);
  } catch (err) {
    return NextResponse.redirect(`${BASE}/settings?social_error=${encodeURIComponent((err as Error).message.slice(0, 120))}`);
  }
}
