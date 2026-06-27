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

  const handleAdd = (result: ReadResult) => {
    addCampaign(result.campaign);
    setEntries((prev) => [...prev, { campaign: result.campaign, sources: [] }]);
    setActiveTab(entries.length);
  };

  const handleRemove = async (campaignId: string) => {
    setEntries((prev) => prev.filter((e) => e.campaign.id !== campaignId));
    deleteCampaign(campaignId);
    await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
  };

  const scrollToCard = (index: number) => {
    setActiveTab(index);
    cardRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-5 flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-[#111827]">Agent Workspace</h2>
          <p className="text-sm text-[#6B7280] mt-0.5">{entries.length} campaign{entries.length !== 1 ? "s" : ""} active</p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button className="flex items-center gap-2 bg-[#0F1E3C] text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-[#0d1b35] transition-colors text-sm">
              <Play size={14} fill="white" /> Run All
            </button>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-[#C0392B] text-white font-semibold px-4 py-2.5 rounded-xl hover:bg-[#a93226] transition-colors text-sm"
          >
            <Plus size={16} /> Add Campaign
          </button>
        </div>
      </div>

      {/* Global stats bar */}
      {entries.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm px-5 py-3 flex items-center gap-6 text-sm">
          <Stat label="Campaigns" value={String(entries.length)} />
          <div className="w-px h-4 bg-[#E5E7EB]" />
          <Stat label="Total Clips" value="0" />
          <div className="w-px h-4 bg-[#E5E7EB]" />
          <Stat label="Approved" value="0" />
          <div className="w-px h-4 bg-[#E5E7EB]" />
          <Stat label="Est. Earnings" value="~$0" />
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#6B7280]" />
            <span className="text-[#6B7280] text-xs">Idle</span>
          </div>
        </div>
      )}

      {/* Campaign tabs */}
      {entries.length > 1 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm flex overflow-x-auto">
          {entries.map((entry, i) => (
            <button
              key={entry.campaign.id}
              onClick={() => scrollToCard(i)}
              className={`px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === i
                  ? "border-[#C0392B] text-[#C0392B]"
                  : "border-transparent text-[#6B7280] hover:text-[#111827]"
              }`}
            >
              {entry.campaign.name}
            </button>
          ))}
        </div>
      )}

      {/* Workspace cards */}
      {entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 bg-[#F8F9FB] rounded-2xl flex items-center justify-center">
            <Bot size={28} className="text-[#6B7280]" />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-[18px] text-[#111827] mb-1">No campaigns yet</h3>
            <p className="text-sm text-[#6B7280] mb-5">Add your first campaign to start generating clips.</p>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 bg-[#C0392B] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#a93226] transition-colors mx-auto"
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
      <span className="text-[#6B7280]">{label}:</span>
      <span className="font-semibold text-[#111827]">{value}</span>
    </div>
  );
}
