"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Save, Loader2, CheckCircle, Link, Unlink } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface SocialAccount { id: string; platform: string; accountName: string; expiresAt?: string; }

function ConnectedAccounts() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch("/api/social/accounts").then(r => r.json()).then(d => setAccounts(Array.isArray(d) ? d : []));
    const connected = searchParams.get("social_connected");
    const error     = searchParams.get("social_error");
    if (connected) toast.success(`${connected} connected successfully!`);
    if (error)     toast.error(`Connection failed: ${decodeURIComponent(error)}`);
  }, []);

  const disconnect = async (id: string, platform: string) => {
    await fetch("/api/social/accounts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setAccounts(prev => prev.filter(a => a.id !== id));
    toast.success(`${platform} disconnected`);
  };

  const platforms = [
    { key: "tiktok",    label: "TikTok",    icon: "🎵", color: "#000000" },
    { key: "instagram", label: "Instagram", icon: "📸", color: "#E1306C" },
  ];

  return (
    <div id="social" className="panel p-6">
      <div className="mb-4">
        <h2 className="font-semibold text-[#0F1E3C]">Connected Accounts</h2>
        <p className="text-xs text-[#64748B] mt-0.5">Connect your social accounts to post clips directly from FlowTilla.</p>
      </div>
      <div className="h-px bg-[#E2E8F0] -mx-6 mb-4" />
      <div className="space-y-3">
        {platforms.map(p => {
          const acct = accounts.find(a => a.platform === p.key);
          return (
            <div key={p.key} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <span className="text-2xl">{p.icon}</span>
              <div className="flex-1">
                <p className="font-semibold text-sm text-[#0F1E3C]">{p.label}</p>
                {acct
                  ? <p className="text-xs text-green-600 mt-0.5">✓ Connected as <strong>{acct.accountName}</strong></p>
                  : <p className="text-xs text-[#94A3B8] mt-0.5">Not connected</p>}
              </div>
              {acct ? (
                <button onClick={() => disconnect(acct.id, p.label)}
                  className="btn-secondary py-1.5 px-3 text-xs gap-1.5 hover:text-red-500 hover:border-red-200">
                  <Unlink size={12} /> Disconnect
                </button>
              ) : (
                <a href={`/api/social/connect/${p.key}`}
                  className="btn-primary py-1.5 px-3 text-xs gap-1.5">
                  <Link size={12} /> Connect
                </a>
              )}
            </div>
          );
        })}
      </div>
      {/* App Credentials */}
      <AppCredentials />
    </div>
  );
}

function AppCredentials() {
  const [keys, setKeys] = useState({ tiktokClientKey: "", tiktokClientSecret: "", metaAppId: "", metaAppSecret: "", youtubeApiKey: "" });
  const [saved, setSaved] = useState(false);
  const [show, setShow] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      setKeys({ tiktokClientKey: d.tiktokClientKey || "", tiktokClientSecret: d.tiktokClientSecret || "", metaAppId: d.metaAppId || "", metaAppSecret: d.metaAppSecret || "", youtubeApiKey: d.youtubeApiKey || "" });
    });
  }, []);

  const save = async () => {
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(keys) });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const field = (label: string, k: keyof typeof keys, placeholder: string) => (
    <div>
      <label className="text-xs font-bold text-[#64748B] block mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show[k] ? "text" : "password"}
          value={keys[k]}
          onChange={e => setKeys(p => ({ ...p, [k]: e.target.value }))}
          placeholder={placeholder}
          className="glass-input pr-10 font-mono text-xs"
        />
        <button type="button" onClick={() => setShow(p => ({ ...p, [k]: !p[k] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F1E3C]">
          {show[k] ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-semibold text-[#0F1E3C]">App Credentials</h2>
          <p className="text-xs text-[#64748B] mt-0.5">Paste your developer keys — required to connect TikTok, Instagram &amp; YouTube.</p>
        </div>
        <button onClick={save} className="btn-primary py-1.5 px-3 text-xs gap-1.5">
          {saved ? <><CheckCircle size={12} /> Saved!</> : <><Save size={12} /> Save Keys</>}
        </button>
      </div>
      <div className="h-px bg-[#E2E8F0] -mx-6 mb-5" />

      {/* TikTok */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🎵</span>
          <p className="font-semibold text-sm text-[#0F1E3C]">TikTok</p>
          <a href="https://developers.tiktok.com/apps" target="_blank" rel="noopener noreferrer"
            className="ml-auto text-[11px] text-red-800 hover:underline flex items-center gap-1">
            Get keys → developers.tiktok.com
          </a>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("Client Key", "tiktokClientKey", "Paste Client Key...")}
          {field("Client Secret", "tiktokClientSecret", "Paste Client Secret...")}
        </div>
        <p className="text-[11px] text-[#94A3B8] mt-2">
          Create an app → Products → Login Kit + Content Posting API. Set redirect URI to <code className="bg-[#F1F5F9] px-1 rounded">http://localhost:3001/api/social/callback/tiktok</code>
        </p>
      </div>

      {/* Meta / Instagram */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📸</span>
          <p className="font-semibold text-sm text-[#0F1E3C]">Instagram / Facebook</p>
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer"
            className="ml-auto text-[11px] text-red-800 hover:underline">
            Get keys → developers.facebook.com
          </a>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("App ID", "metaAppId", "Paste App ID...")}
          {field("App Secret", "metaAppSecret", "Paste App Secret...")}
        </div>
        <p className="text-[11px] text-[#94A3B8] mt-2">
          Create a Meta app → Add Instagram product. Set redirect URI to <code className="bg-[#F1F5F9] px-1 rounded">http://localhost:3001/api/social/callback/instagram</code>
        </p>
      </div>

      {/* YouTube */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">▶️</span>
          <p className="font-semibold text-sm text-[#0F1E3C]">YouTube Data API</p>
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
            className="ml-auto text-[11px] text-red-800 hover:underline">
            Get key → console.cloud.google.com
          </a>
        </div>
        {field("API Key", "youtubeApiKey", "Paste YouTube Data API v3 key...")}
        <p className="text-[11px] text-[#94A3B8] mt-2">
          Google Cloud Console → Enable YouTube Data API v3 → Create API Key. Used for discovering creator videos.
        </p>
      </div>
    </div>
  );
}

function MaskedInput({ label, placeholder }: { label: string; placeholder: string }) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState("");
  return (
    <div>
      <label className="text-xs font-semibold text-[#64748B] block mb-1.5">{label}</label>
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
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F1E3C] transition-colors"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="panel p-6">
      <div className="mb-4">
        <h2 className="font-semibold text-[#0F1E3C]">{title}</h2>
        {desc && <p className="text-xs text-[#64748B] mt-0.5">{desc}</p>}
      </div>
      <div className="h-px bg-[#E2E8F0] -mx-6 mb-4" />
      {children}
    </div>
  );
}

interface Settings {
  tiktokHandle: string; instagramHandle: string; youtubeHandle: string;
  kickHandle: string; twitchHandle: string; defaultLength: number;
  defaultRatio: string; subtitleStyle: string; colorGrade: string;
  autoEdit: boolean; outputFolder: string; maxClipsPerVideo: number;
}

const defaultSettings: Settings = {
  tiktokHandle: "", instagramHandle: "", youtubeHandle: "",
  kickHandle: "", twitchHandle: "", defaultLength: 60,
  defaultRatio: "9:16", subtitleStyle: "viral-word", colorGrade: "viral",
  autoEdit: true, outputFolder: "/tmp/clipflow", maxClipsPerVideo: 10,
};

function HandleInput({ label, icon, placeholder, value, onChange }: {
  label: string; icon: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#64748B] block mb-1.5">{label}</label>
      <div className="flex items-center glass-input p-0 overflow-hidden">
        <span className="pl-3 text-base flex-shrink-0">{icon}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-2 py-2.5 text-sm bg-transparent text-[#0F1E3C] placeholder:text-[#CBD5E1] focus:outline-none"
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
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      toast.success("Settings saved");
    } catch { toast.error("Failed to save settings"); }
    setSaving(false);
  };

  if (!loaded) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-[#94A3B8]" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5 pb-10">
      <div className="flex items-center justify-between mb-2 animate-fade-up delay-1">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1E3C]">Settings</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Configure FlowTilla to work with your accounts and preferences</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle size={15} /> : <Save size={15} />}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="animate-fade-up delay-2">
        <Suspense fallback={null}><ConnectedAccounts /></Suspense>
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
                <label className="text-xs font-semibold text-[#64748B]">Default Clip Length</label>
                <span className="text-sm font-bold text-[#0F1E3C]">{settings.defaultLength}s</span>
              </div>
              <input type="range" min={15} max={180} step={15} value={settings.defaultLength}
                onChange={(e) => patch("defaultLength", Number(e.target.value))}
                className="w-full accent-[#9B1C1C]" />
              <div className="flex justify-between text-[10px] text-[#94A3B8] mt-1">
                <span>15s</span><span>30s</span><span>45s</span><span>60s</span><span>90s</span><span>2m</span><span>3m</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#64748B] block mb-1.5">Default Aspect Ratio</label>
              <div className="flex gap-2">
                {[{ value: "9:16", label: "9:16", desc: "Vertical" }, { value: "16:9", label: "16:9", desc: "Landscape" }, { value: "1:1", label: "1:1", desc: "Square" }].map((opt) => (
                  <button key={opt.value} onClick={() => patch("defaultRatio", opt.value)}
                    className="flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all"
                    style={settings.defaultRatio === opt.value
                      ? { background: "#FFF5F5", borderColor: "#9B1C1C", color: "#7F1D1D" }
                      : { background: "#FFFFFF", borderColor: "#E2E8F0", color: "#64748B" }}>
                    {opt.label}
                    <span className="block text-[10px] font-normal opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#64748B] block mb-1.5">Subtitle Style</label>
              <select value={settings.subtitleStyle} onChange={(e) => patch("subtitleStyle", e.target.value)} className="glass-input">
                <option value="viral-word">Viral word-by-word (white Impact, black stroke)</option>
                <option value="standard">Standard (white, bottom center)</option>
                <option value="none">No subtitles</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#64748B] block mb-1.5">Color Grade</label>
              <select value={settings.colorGrade} onChange={(e) => patch("colorGrade", e.target.value)} className="glass-input">
                <option value="viral">Viral (+saturation, +contrast)</option>
                <option value="cinematic">Cinematic (warm tones)</option>
                <option value="natural">Natural (minimal processing)</option>
                <option value="none">No color grade</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#64748B]">Max Clips Per Video</label>
                <span className="text-sm font-bold text-[#0F1E3C]">{settings.maxClipsPerVideo}</span>
              </div>
              <input type="range" min={3} max={25} step={1} value={settings.maxClipsPerVideo}
                onChange={(e) => patch("maxClipsPerVideo", Number(e.target.value))}
                className="w-full accent-[#9B1C1C]" />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0]">
              <div>
                <p className="text-sm font-semibold text-[#0F1E3C]">Auto-edit on generate</p>
                <p className="text-xs text-[#64748B] mt-0.5">Apply color grade, subtitles, hook text, and watermark automatically</p>
              </div>
              <button onClick={() => patch("autoEdit", !settings.autoEdit)}
                className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0"
                style={{ background: settings.autoEdit ? "#9B1C1C" : "#E2E8F0" }}>
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
            <p className="text-xs text-[#94A3B8]">To update API keys, edit your <code className="bg-[#F1F5F9] px-1.5 py-0.5 rounded text-[#475569] font-mono">.env.local</code> file directly.</p>
          </div>
        </Section>
      </div>

      <div className="animate-fade-up delay-5">
        <Section title="Storage">
          <div>
            <label className="text-xs font-semibold text-[#64748B] block mb-1.5">Output Folder</label>
            <input value={settings.outputFolder} onChange={(e) => patch("outputFolder", e.target.value)}
              className="glass-input font-mono" />
          </div>
        </Section>
      </div>
    </div>
  );
}
