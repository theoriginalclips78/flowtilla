export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readAnyBrief } from "@/lib/campaign/briefReader";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: string = body.url || body.rawText || body.text || "";
    if (!input.trim()) {
      return NextResponse.json({ error: "No input provided" }, { status: 400 });
    }

    const { data, loginWall, rawText } = await readAnyBrief(input);

    if (loginWall) {
      return NextResponse.json(
        { error: "Page requires login — please paste the brief text directly", loginWall: true },
        { status: 422 }
      );
    }

    // Save campaign to DB
    const campaign = await prisma.campaign.create({
      data: {
        name: data.brandName || "Untitled Campaign",
        campaignType: data.campaignType || "clipping",
        cpm: data.cpm ?? 0,
        maxPerClip: data.maxPerClip ?? 0,
        minPayout: data.minPayout ?? 0,
        paymentModel: data.paymentModel || "cpm",
        aiInstructions: [data.aiInstructions || "", typeof body.extraInstructions === "string" ? body.extraInstructions.trim() : ""].filter(Boolean).join("\n\n"),
        contentRules: data.contentRules || "",
        rejectionReasons: Array.isArray(data.rejectionReasons) ? data.rejectionReasons.join("\n") : "",
        captionRules: data.captionRules || "",
        platforms: Array.isArray(data.platforms) ? data.platforms.join(",") : "",
        taggingJson: JSON.stringify(data.tagging || {}),
        submissionProcess: data.submissionProcess || "",
        minimumEngagement: data.minimumEngagement || "",
        audienceRequirement: data.audienceRequirement || "",
        postDuration: data.postDuration || "",
        videoLayout: "letterbox",
        minVirality: "medium",
        status: "active",
      },
    });

    // Attach any extra sources the user added alongside the brief (uploaded folder, pasted
    // paths/URLs) so the parsed brief + their footage become ONE campaign.
    const extraSources: { platform?: string; url: string }[] = Array.isArray(body.extraSources) ? body.extraSources : [];
    const localFolder: string = typeof body.localFolder === "string" ? body.localFolder.trim() : "";
    if (localFolder) extraSources.push({ platform: "local", url: localFolder });
    for (const s of extraSources) {
      if (!s?.url?.trim()) continue;
      await prisma.campaignSource.create({
        data: { campaignId: campaign.id, platform: s.platform || "other", url: s.url.trim() },
      });
    }

    // Save source URLs as CampaignSource rows
    const sourceUrls = data.sourceUrls || [];
    for (const url of sourceUrls) {
      if (!url?.trim()) continue;
      const platform = url.includes("tiktok") ? "tiktok"
        : url.includes("instagram") ? "instagram"
        : url.includes("twitch") ? "twitch"
        : url.includes("kick") ? "kick"
        : url.includes("youtube") || url.includes("youtu.be") ? "youtube"
        : "other";
      await prisma.campaignSource.create({
        data: { campaignId: campaign.id, platform, url: url.trim() },
      });
    }

    return NextResponse.json({
      campaign: {
        ...campaign,
        sources: sourceUrls,
        minPayout: campaign.minPayout,
        rejectionReasons: campaign.rejectionReasons,
        platforms: campaign.platforms,
        postDuration: campaign.postDuration,
        minimumEngagement: campaign.minimumEngagement,
        audienceRequirement: campaign.audienceRequirement,
      },
      briefData: data,
      rawText: rawText?.slice(0, 500),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
