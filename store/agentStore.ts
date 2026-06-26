import { create } from "zustand";

export type AgentStatus = "idle" | "running" | "completed" | "error";

export interface LogEntry {
  timestamp: string;
  step: string;
  status: "started" | "complete" | "progress" | "error";
  message: string;
}

export interface ClipResult {
  id: string;
  jobId: string;
  campaignId: string;
  title: string;
  filePath: string;
  downloadUrl: string;
  startTime: number;
  endTime: number;
  viralityScore: string;
  reason: string;
  status: string;
}

interface AgentStore {
  activeCampaignId: string | null;
  jobId: string | null;
  agentStatus: AgentStatus;
  currentTask: string;
  progress: number;
  logEntries: LogEntry[];
  results: ClipResult[];
  setActiveCampaign: (id: string) => void;
  setJobId: (id: string) => void;
  setStatus: (status: AgentStatus) => void;
  setCurrentTask: (task: string) => void;
  setProgress: (n: number) => void;
  addLog: (entry: LogEntry) => void;
  setResults: (clips: ClipResult[]) => void;
  resetAgent: () => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  activeCampaignId: null,
  jobId: null,
  agentStatus: "idle",
  currentTask: "",
  progress: 0,
  logEntries: [],
  results: [],

  setActiveCampaign: (id) => set({ activeCampaignId: id }),
  setJobId: (id) => set({ jobId: id }),
  setStatus: (status) => set({ agentStatus: status }),
  setCurrentTask: (task) => set({ currentTask: task }),
  setProgress: (n) => set({ progress: n }),
  addLog: (entry) =>
    set((state) => ({ logEntries: [...state.logEntries, entry] })),
  setResults: (clips) => set({ results: clips }),
  resetAgent: () =>
    set({
      agentStatus: "idle",
      currentTask: "",
      progress: 0,
      logEntries: [],
      results: [],
      jobId: null,
    }),
}));
