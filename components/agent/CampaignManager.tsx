"use client";

import { useEffect, useState } from "react";
import { useCampaignStore, Campaign } from "@/store/campaignStore";
import { useAgentStore } from "@/store/agentStore";
import BriefInput from "./BriefInput";
import CampaignPreviewCard from "./CampaignPreviewCard";
import CampaignQueue from "./CampaignQueue";
import CampaignFormSheet from "./CampaignFormSheet";
import { BriefData } from "@/lib/campaign/briefReader";
import { toast } from "sonner";

interface QueueItem {
  campaign: Campaign;
  videoCount: number;
  status: "queued" | "running" | "complete";
}

interface ReadResult {
  campaign: Campaign;
  briefData: BriefData;
  videoCount?: number;
}

export default function CampaignManager() {
  const { setCampaigns, addCampaign } = useCampaignStore();
  const { setActiveCampaign, setStatus } = useAgentStore();

  const [preview, setPreview] = useState<ReadResult | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then(setCampaigns)
      .catch(() => {});
  }, [setCampaigns]);

  const handleCampaignReady = (result: ReadResult) => {
    addCampaign(result.campaign);
    setPreview(result);
  };

  const handleQueue = () => {
    if (!preview) return;
    setQueue((q) => [
      ...q,
      { campaign: preview.campaign, videoCount: preview.videoCount || 0, status: "queued" },
    ]);
    setPreview(null);
    toast.success(`${preview.campaign.name} added to queue`);
  };

  const handleRemove = (id: string) => {
    setQueue((q) => q.filter((item) => item.campaign.id !== id));
  };

  const handleRun = async (campaignId: string) => {
    setQueue((q) =>
      q.map((item) =>
        item.campaign.id === campaignId ? { ...item, status: "running" } : item
      )
    );
    setActiveCampaign(campaignId);
    setStatus("running");
    // Trigger via agent store — AgentControlPanel picks it up via SSE
    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    if (res.ok) {
      setQueue((q) =>
        q.map((item) =>
          item.campaign.id === campaignId ? { ...item, status: "complete" } : item
        )
      );
    }
  };

  const handleRunAll = async () => {
    for (const item of queue.filter((i) => i.status === "queued")) {
      await handleRun(item.campaign.id);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pr-1">
      <BriefInput onCampaignReady={handleCampaignReady} />

      {preview && (
        <CampaignPreviewCard
          result={preview}
          onEdit={() => { setEditCampaign(preview.campaign); setSheetOpen(true); }}
          onQueue={handleQueue}
          onDismiss={() => setPreview(null)}
        />
      )}

      <CampaignQueue
        queue={queue}
        onRemove={handleRemove}
        onRun={handleRun}
        onRunAll={handleRunAll}
      />

      <CampaignFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        editCampaign={editCampaign}
      />
    </div>
  );
}
