"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Save, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

function MaskedInput({ label, placeholder }: { label: string; placeholder: string }) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState("");
  return (
    <div>
      <label className="text-xs font-medium text-white/60 block mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="glass-input pr-10"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="liquid-glass rounded-2xl p-6 border border-white/10" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="mb-4">
        <h2 className="font-medium text-white">{title}</h2>
        {desc && <p className="text-xs text-white/40 mt-0.5">{desc}</p>}
      </div>
      <div className="h-px bg-white/10 -mx-6 mb-4" />
      {children}
    </div>
  );
}

interface Settings {
  tiktokHandle: string;
  instagramHandle: string;
  youtubeHandle: string;
  kickHandle: string;
  twitchHandle: string;
  defaultLength: number;
  defaultRatio: string;
  subtitleStyle: string;
  colorGrade: string;
  autoEdit: boolean;
  outputFolder: string;
  maxClipsPerVideo: number;
}

const defaultSettings: Settings = {
  tiktokHandle: "",
  instagramHandle: "",
  youtubeHandle: "",
  kickHandle: "",
  twitchHandle: "",
  defaultLength: 60,
  defaultRatio: "9:16",
  subtitleStyle: "viral-word",
  colorGrade: "viral",
  autoEdit: true,
  outputFolder: "/tmp/clipflow",
  maxClipsPerVideo: 10,
};

function HandleInput({ label, icon, placeholder, value, onChange }: {
  label: string; icon: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-white/50 block mb-1.5">{label}</label>
      <div className="flex items-center glass-input p-0 overflow-hidden">
        <span className="pl-3 text-base flex-shrink-0">{icon}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-2 py-2.5 text-sm bg-transparent text-white placeholder:text-white/30 focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => { setSettings((prev) => ({ ...prev, ...data })); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const patch = (key: keyof Settings, value: string | number | boolean) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
    setSaving(false);
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5 pb-10">
      <div className="flex items-center justify-between mb-2 animate-fade-up delay-1">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-white/40 mt-0.5">Configure ClipFlow to work with your accounts and preferences</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle size={15} /> : <Save size={15} />}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="animate-fade-up delay-2">
        <Section title="My Accounts" desc="Your handles are auto-inserted into captions and watermarks for every campaign.">
          <div className="grid grid-cols-1 gap-3">
            <HandleInput label="TikTok" icon="🎵" placeholder="@yourhandle" value={settings.tiktokHandle} onChange={(v) => patch("tiktokHandle", v)} />
            <HandleInput label="Instagram" icon="📸" placeholder="@yourhandle" value={settings.instagramHandle} onChange={(v) => patch("instagramHandle", v)} />
            <HandleInput label="YouTube" icon="🎬" placeholder="@YourChannel" value={settings.youtubeHandle} onChange={(v) => patch("youtubeHandle", v)} />
            <div className="grid grid-cols-2 gap-3">
              <HandleInput label="Twitch" icon="🎮" placeholder="yourusername" value={settings.twitchHandle} onChange={(v) => patch("twitchHandle", v)} />
              <HandleInput label="Kick" icon="⚡" placeholder="yourusername" value={settings.kickHandle} onChange={(v) => patch("kickHandle", v)} />
            </div>
          </div>
        </Section>
      </div>

      <div className="animate-fade-up delay-3">
        <Section title="Default Clip Settings" desc="These defaults apply to every new campaign. Can be overridden per-campaign.">
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-white/50">Default Clip Length</label>
                <span className="text-sm font-medium text-white">{settings.defaultLength}s</span>
              </div>
              <input type="range" min={15} max={180} step={15} value={settings.defaultLength}
                onChange={(e) => patch("defaultLength", Number(e.target.value))}
                className="w-full accent-[#C0392B]" />
              <div className="flex justify-between text-[10px] text-white/30 mt-1">
                <span>15s</span><span>30s</span><span>45s</span><span>60s</span><span>90s</span><span>2m</span><span>3m</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-white/50 block mb-1.5">Default Aspect Ratio</label>
              <div className="flex gap-2">
                {[{ value: "9:16", label: "9:16", desc: "Vertical" }, { value: "16:9", label: "16:9", desc: "Landscape" }, { value: "1:1", label: "1:1", desc: "Square" }].map((opt) => (
                  <button key={opt.value} onClick={() => patch("defaultRatio", opt.value)}
                    className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors"
                    style={settings.defaultRatio === opt.value
                      ? { background: "rgba(192,57,43,0.2)", borderColor: "rgba(192,57,43,0.5)", color: "white" }
                      : { background: "transparent", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }}>
                    {opt.label}
                    <span className="block text-[10px] font-normal opacity-60">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-white/50 block mb-1.5">Subtitle Style</label>
              <select value={settings.subtitleStyle} onChange={(e) => patch("subtitleStyle", e.target.value)} className="glass-input">
                <option value="viral-word">Viral word-by-word (white Impact, black stroke)</option>
                <option value="standard">Standard (white, bottom center)</option>
                <option value="none">No subtitles</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-white/50 block mb-1.5">Color Grade</label>
              <select value={settings.colorGrade} onChange={(e) => patch("colorGrade", e.target.value)} className="glass-input">
                <option value="viral">Viral (+saturation, +contrast)</option>
                <option value="cinematic">Cinematic (warm tones)</option>
                <option value="natural">Natural (minimal processing)</option>
                <option value="none">No color grade</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-white/50">Max Clips Per Video</label>
                <span className="text-sm font-medium text-white">{settings.maxClipsPerVideo}</span>
              </div>
              <input type="range" min={3} max={25} step={1} value={settings.maxClipsPerVideo}
                onChange={(e) => patch("maxClipsPerVideo", Number(e.target.value))}
                className="w-full accent-[#C0392B]" />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div>
                <p className="text-sm font-medium text-white">Auto-edit on generate</p>
                <p className="text-xs text-white/40 mt-0.5">Apply color grade, subtitles, hook text, and watermark automatically</p>
              </div>
              <button onClick={() => patch("autoEdit", !settings.autoEdit)}
                className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0"
                style={{ background: settings.autoEdit ? "#C0392B" : "rgba(255,255,255,0.15)" }}>
                <div className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm"
                  style={{ left: settings.autoEdit ? "22px" : "2px" }} />
              </button>
            </div>
          </div>
        </Section>
      </div>

      <div className="animate-fade-up delay-4">
        <Section title="API Keys" desc="Stored in your .env.local file, never sent to our servers.">
          <div className="space-y-4">
            <MaskedInput label="Anthropic API Key" placeholder="sk-ant-..." />
            <MaskedInput label="Groq API Key" placeholder="gsk_..." />
            <p className="text-xs text-white/30">To update API keys, edit your <code className="bg-white/10 px-1 rounded text-white/50">.env.local</code> file directly.</p>
          </div>
        </Section>
      </div>

      <div className="animate-fade-up delay-5">
        <Section title="Storage">
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1.5">Output Folder</label>
            <input value={settings.outputFolder} onChange={(e) => patch("outputFolder", e.target.value)}
              className="glass-input font-mono" />
          </div>
        </Section>
      </div>
    </div>
  );
}
