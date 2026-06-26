import { create } from "zustand";

export interface CampaignSource {
  id: string;
  campaignId: string;
  platform: string;
  url: string;
}

export interface Campaign {
  id: string;
  name: string;
  cpm: number;
  maxPerClip: number;
  minPayout: number;
  aiInstructions: string;
  contentRules: string;
  rejectionReasons?: string;
  platforms?: string;
  postDuration?: string;
  minimumEngagement?: string;
  audienceRequirement?: string;
  clipCount: number;
  clipLength: number;
  aspectRatio: string;
  scheduleEnabled: boolean;
  scheduleFrequency?: string | null;
  scheduleTime?: string | null;
  status: string;
  createdAt: string;
  sources: CampaignSource[];
}

interface CampaignStore {
  campaigns: Campaign[];
  activeCampaign: Campaign | null;
  setCampaigns: (c: Campaign[]) => void;
  addCampaign: (c: Campaign) => void;
  updateCampaign: (id: string, data: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;
  setActiveCampaign: (c: Campaign) => void;
}

export const useCampaignStore = create<CampaignStore>((set) => ({
  campaigns: [],
  activeCampaign: null,

  setCampaigns: (campaigns) => set({ campaigns }),
  addCampaign: (campaign) =>
    set((state) => ({ campaigns: [...state.campaigns, campaign] })),
  updateCampaign: (id, data) =>
    set((state) => ({
      campaigns: state.campaigns.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    })),
  deleteCampaign: (id) =>
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.id !== id),
    })),
  setActiveCampaign: (campaign) => set({ activeCampaign: campaign }),
}));
