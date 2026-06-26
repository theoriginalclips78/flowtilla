export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { burnSubtitles, SubtitleStyle } from "@/lib/editor/subtitles";
import { applyLayout, LayoutType, GameplayStyle } from "@/lib/editor/layout";
import { enhanceAudio, AudioOptions } from "@/lib/editor/audio";
import { addOverlays, OverlayOptions } from "@/lib/editor/overlays";
import { applyColorGrade, ColorPreset, ManualAdjustments } from "@/lib/editor/color";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clipId,
      jobId,
      clipIndex,
      subtitleStyle,
      transcript,
      layout,
      gameplayStyle,
      audio,
      overlays,
      colorPreset,
      colorManual,
    } = body;

    let filePath = `/tmp/clipflow/${jobId}/clips/clip-${clipIndex}.mp4`;

    // Apply in order: layout → color → audio → subtitles → overlays
    if (layout && layout !== "full") {
      filePath = await applyLayout(jobId, clipIndex, layout as LayoutType, gameplayStyle as GameplayStyle);
    }
    if (colorPreset && colorPreset !== "none") {
      filePath = await applyColorGrade(jobId, clipIndex, colorPreset as ColorPreset, colorManual as ManualAdjustments);
    }
    if (audio) {
      filePath = await enhanceAudio(jobId, clipIndex, audio as AudioOptions);
    }
    if (subtitleStyle && transcript?.length > 0) {
      filePath = await burnSubtitles(jobId, clipIndex, subtitleStyle as SubtitleStyle, transcript);
    }
    if (overlays && Object.keys(overlays).length > 0) {
      filePath = await addOverlays(jobId, clipIndex, overlays as OverlayOptions);
    }

    // Update clip in DB with new file path
    if (clipId) {
      await prisma.clip.update({
        where: { id: clipId },
        data: { filePath, status: "edited" },
      });
    }

    return NextResponse.json({ filePath, downloadUrl: `/api/clip/${jobId}/${clipIndex}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
