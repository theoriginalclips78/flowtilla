import { Film, Layers, Clock, ChevronRight, Plus, Play } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 animate-fade-up delay-1">
        <StatCard
          icon={<Film size={20} className="text-white" />}
          label="Clips Today"
          value="0"
          sub="No clips generated yet"
        />
        <StatCard
          icon={<Layers size={20} className="text-white" />}
          label="Active Campaigns"
          value="0"
          sub="Add your first campaign"
        />
        <StatCard
          icon={<Clock size={20} className="text-white" />}
          label="Next Scheduled Run"
          value="—"
          sub="No schedule set"
        />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-4 animate-fade-up delay-2">
        {/* Recent Clips */}
        <div className="liquid-glass rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-white">Recent Clips</h2>
            <button className="text-sm text-white/50 hover:text-white flex items-center gap-1 transition-colors">
              View all <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="w-12 h-12 rounded-full liquid-glass flex items-center justify-center mb-1" style={{ background: "rgba(255,255,255,0.08)" }}>
              <Film size={22} className="text-white/30" />
            </div>
            <p className="text-sm font-medium text-white/70">No clips yet</p>
            <p className="text-xs text-white/40">Run the agent to start generating clips</p>
          </div>
        </div>

        {/* Agent Activity */}
        <div className="liquid-glass rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-white">Agent Activity</h2>
            <span className="text-xs liquid-glass rounded-lg px-2.5 py-1 text-white/50" style={{ background: "rgba(255,255,255,0.08)" }}>
              Idle
            </span>
          </div>
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="w-12 h-12 rounded-full liquid-glass flex items-center justify-center mb-1" style={{ background: "rgba(255,255,255,0.08)" }}>
              <Play size={22} className="text-white/30 ml-0.5" />
            </div>
            <p className="text-sm font-medium text-white/70">Agent is idle</p>
            <p className="text-xs text-white/40">Go to Agent to start a campaign</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="liquid-glass rounded-2xl p-5 animate-fade-up delay-3" style={{ background: "rgba(255,255,255,0.06)" }}>
        <h2 className="font-medium text-white mb-4">Quick Actions</h2>
        <div className="flex gap-3">
          <a href="/agent" className="btn-primary">
            <Plus size={15} /> Add Campaign
          </a>
          <a href="/agent" className="btn-secondary">
            <Play size={15} fill="white" /> Run Agent
          </a>
          <a href="/assets" className="btn-secondary">
            <Film size={15} /> View Assets
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="liquid-glass rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="w-10 h-10 rounded-xl liquid-glass flex items-center justify-center mb-3" style={{ background: "rgba(255,255,255,0.12)" }}>
        {icon}
      </div>
      <p className="text-white/50 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-white text-3xl font-light mt-1 mb-1">{value}</p>
      <p className="text-white/40 text-xs">{sub}</p>
    </div>
  );
}
