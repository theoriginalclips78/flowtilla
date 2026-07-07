"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Play, Bot } from "lucide-react";
import { Campaign, useCampaignStore } from "@/store/campaignStore";
import { BriefData } from "@/lib/campaign/briefReader";
import CampaignWorkspaceCard from "@/components/workspace/CampaignWorkspaceCard";
import AddCampaignModal from "@/components/workspace/AddCampaignModal";

interface Source {
  id: string;
  url: string;
  platform: string;
}

interface WorkspaceEntry {
  campaign: Campaign;
  sources: Source[];
  autoStart?: boolean;
}

interface ReadResult {
  campaign: Campaign;
  briefData: BriefData;
  videoCount?: number;
}

export default function AgentPage() {
  const { setCampaigns, addCampaign, deleteCampaign } = useCampaignStore();
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data: Campaign[]) => {
        if (!Array.isArray(data)) return;
        setCampaigns(data);
        Promise.all(
          data.map((c) =>
            fetch("/api/campaigns/" + c.id + "/sources")
              .then((r) => r.json())
              .then((d) => ({ campaign: c, sources: Array.isArray(d) ? d : [] }))
              .catch(() => ({ campaign: c, sources: [] }))
          )
        ).then((results) => setEntries(results));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = (result: ReadResult, autoStart?: boolean) => {
    addCampaign(result.campaign);
    setEntries((prev) => [...prev, { campaign: result.campaign, sources: [], autoStart: !!autoStart }]);
    setActiveTab(entries.length);
  };

  const handleRemove = async (campaignId: string) => {
    const snapshot = entries;
    setEntries((prev) => prev.filter((e) => e.campaign.id !== campaignId));
    deleteCampaign(campaignId);
    try {
      const r = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
    } catch {
      // Delete failed on the server — restore it so the user isn't misled.
      setEntries(snapshot);
      alert("Couldn't delete that campaign — please try again.");
    }
  };

  const scrollToCard = (index: number) => {
    setActiveTab(index);
    cardRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm p-5 flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-[var(--text)]">Agent Workspace</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{entries.length} campaign{entries.length !== 1 ? "s" : ""} active</p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button className="flex items-center gap-2 bg-[var(--chip)] text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-[var(--accent-hover)] transition-colors text-sm">
              <Play size={14} fill="white" /> Run All
            </button>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--accent)] text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-[var(--accent-hover)] transition-colors text-sm"
          >
            <Plus size={16} /> Add Campaign
          </button>
        </div>
      </div>

      {/* Global stats bar */}
      {entries.length > 0 && (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm px-5 py-3 flex items-center gap-6 text-sm">
          <Stat label="Campaigns" value={String(entries.length)} />
          <div className="w-px h-4 bg-[var(--border)]" />
          <Stat label="Total Clips" value="0" />
          <div className="w-px h-4 bg-[var(--border)]" />
          <Stat label="Approved" value="0" />
          <div className="w-px h-4 bg-[var(--border)]" />
          <Stat label="Est. Earnings" value="~$0" />
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)] text-xs">Idle</span>
          </div>
        </div>
      )}

      {/* Campaign tabs */}
      {entries.length > 1 && (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm flex overflow-x-auto">
          {entries.map((entry, i) => (
            <button
              key={entry.campaign.id}
              onClick={() => scrollToCard(i)}
              className={`px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === i
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {entry.campaign.name}
            </button>
          ))}
        </div>
      )}

      {/* Workspace cards */}
      {entries.length === 0 ? (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 bg-[var(--surface-2)] rounded-2xl flex items-center justify-center">
            <Bot size={28} className="text-[var(--text-muted)]" />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-[18px] text-[var(--text)] mb-1">No campaigns yet</h3>
            <p className="text-sm text-[var(--text-muted)] mb-5">Add your first campaign to start generating clips.</p>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 bg-[var(--accent)] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[var(--accent-hover)] transition-colors mx-auto"
            >
              <Plus size={16} /> Add Campaign
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry, i) => (
            <div
              key={entry.campaign.id}
              ref={(el) => { cardRefs.current[i] = el; }}
            >
              <CampaignWorkspaceCard
                campaign={entry.campaign}
                sources={entry.sources}
                autoRun={entry.autoStart}
                onRemove={handleRemove}
                onUpdate={(updated) => setEntries(prev => prev.map(e => e.campaign.id === updated.id ? { ...e, campaign: updated } : e))}
              />
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <AddCampaignModal onAdd={handleAdd} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[var(--text-muted)]">{label}:</span>
      <span className="font-semibold text-[var(--text)]">{value}</span>
    </div>
  );
}
