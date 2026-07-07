"use client";
import { useEffect, useState } from "react";
import { Film, Layers, Clock, ChevronRight, Plus, Play, RefreshCw } from "lucide-react";
import Link from "next/link";
import TallyTracker from "@/components/TallyTracker";
import MontviewLogo from "@/components/MontviewLogo";

interface Clip { id: string; title: string; thumbnailUrl: string; downloadUrl: string; status: string; campaignId: string; createdAt: string; viralityScore: string; }
interface Campaign { id: string; name: string; status: string; }

export default function DashboardPage() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/clips").then(r => r.json()).catch(() => []),
      fetch("/api/campaigns").then(r => r.json()).catch(() => []),
    ]).then(([c, camp]) => {
      setClips(Array.isArray(c) ? c : []);
      setCampaigns(Array.isArray(camp) ? camp : []);
      setLoading(false);
    });
  }, []);

  const today = new Date().toDateString();
  const clipsToday = clips.filter(c => new Date(c.createdAt).toDateString() === today).length;
  const activeCampaigns = campaigns.filter(c => c.status === "active").length;
  const recentClips = clips.slice(0, 6);
  const campaignMap: Record<string, string> = {};
  campaigns.forEach(c => { campaignMap[c.id] = c.name; });

  return (
    <div className="space-y-6">
      {/* Montview brand header */}
      <div className="flex items-center gap-4 animate-fade-up">
        <MontviewLogo size={40} />
        <div>
          <h1 className="text-[32px] leading-none font-extrabold tracking-tight grad-text">Montview</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1.5">Precision Clips. Premium Results.</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 animate-fade-up delay-1">
        <StatCard
          icon={<Film size={20} className="text-[var(--accent)]" />}
          label="Clips Today"
          value={loading ? "…" : String(clipsToday)}
          sub={loading ? "" : clips.length > 0 ? `${clips.length} total clips` : "No clips generated yet"}
        />
        <StatCard
          icon={<Layers size={20} className="text-[var(--accent)]" />}
          label="Active Campaigns"
          value={loading ? "…" : String(activeCampaigns)}
          sub={loading ? "" : activeCampaigns > 0 ? campaigns.filter(c=>c.status==="active").map(c=>c.name).join(", ").slice(0,40) : "Add your first campaign"}
        />
        <StatCard
          icon={<Clock size={20} className="text-[var(--accent)]" />}
          label="Approved Clips"
          value={loading ? "…" : String(clips.filter(c=>c.status==="approved").length)}
          sub={loading ? "" : `${clips.filter(c=>c.status==="pending").length} pending review`}
        />
      </div>

      {/* Daily post tally */}
      <div className="animate-fade-up delay-2">
        <TallyTracker />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-4 animate-fade-up delay-2">
        {/* Recent Clips */}
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--text)]">Recent Clips</h2>
            <Link href="/clips" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1 transition-colors">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw size={18} className="animate-spin text-[var(--text-light)]" />
            </div>
          ) : recentClips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div className="w-12 h-12 rounded-full bg-[var(--accent-soft)] flex items-center justify-center mb-1">
                <Film size={22} className="text-[var(--accent)]" />
              </div>
              <p className="text-sm font-medium text-[var(--text)]">No clips yet</p>
              <p className="text-xs text-[var(--text-light)]">Run the agent to start generating clips</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {recentClips.map(clip => (
                <Link href="/clips" key={clip.id} className="group relative rounded-xl overflow-hidden bg-[var(--chip)] aspect-video block">
                  {clip.thumbnailUrl
                    ? <img src={clip.thumbnailUrl} alt={clip.title} className="w-full h-full object-cover" />
                    : <video src={clip.downloadUrl} className="w-full h-full object-cover" preload="none" />
                  }
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={14} className="text-white" fill="white" />
                  </div>
                  {clip.status === "approved" && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[8px] text-white font-bold">✓</span>
                  )}
                  <p className="absolute bottom-0 left-0 right-0 text-[9px] text-white px-1.5 py-1 truncate" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}>
                    {campaignMap[clip.campaignId] || ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Campaign Overview */}
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--text)]">Campaigns</h2>
            <Link href="/agent" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1 transition-colors">
              Manage <ChevronRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw size={18} className="animate-spin text-[var(--text-light)]" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div className="w-12 h-12 rounded-full bg-[var(--accent-soft)] flex items-center justify-center mb-1">
                <Play size={22} className="text-[var(--accent)] ml-0.5" />
              </div>
              <p className="text-sm font-medium text-[var(--text)]">No campaigns yet</p>
              <p className="text-xs text-[var(--text-light)]">Go to Agent to create your first campaign</p>
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map(c => {
                const campClips = clips.filter(cl => cl.campaignId === c.id);
                const approved = campClips.filter(cl => cl.status === "approved").length;
                const pending = campClips.filter(cl => cl.status === "pending").length;
                return (
                  <Link href="/agent" key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[var(--accent-soft)] transition-colors group">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: "var(--accent)" }}>
                        {c.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">{c.name}</p>
                        <p className="text-[10px] text-[var(--text-light)]">{campClips.length} clips · {approved} approved · {pending} pending</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: c.status === "active" ? "#F0FDF4" : "var(--surface-2)", color: c.status === "active" ? "#16A34A" : "var(--text-muted)" }}>
                      {c.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="panel p-5 animate-fade-up delay-3">
        <h2 className="font-semibold text-[var(--text)] mb-4">Quick Actions</h2>
        <div className="flex gap-3">
          <Link href="/agent" className="btn-primary">
            <Plus size={15} /> Add Campaign
          </Link>
          <Link href="/agent" className="btn-secondary">
            <Play size={15} /> Run Agent
          </Link>
          <Link href="/clips" className="btn-secondary">
            <Film size={15} /> Review Clips
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="panel p-6">
      <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider font-medium">{label}</p>
      <p className="text-[var(--text)] text-3xl font-bold mt-1 mb-1">{value}</p>
      <p className="text-[var(--text-light)] text-xs truncate">{sub}</p>
    </div>
  );
}
