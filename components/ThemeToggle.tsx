"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

// Dark / light toggle. Applies the `dark` class to <html> and remembers the choice.
// A tiny inline script in the root layout applies it before paint (no flash).
export default function ThemeToggle({ variant = "rail" }: { variant?: "rail" | "row" }) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setReady(true);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("montview_theme", next ? "dark" : "light"); } catch { /* ignore */ }
  };

  if (variant === "row") {
    return (
      <button onClick={toggle} title="Toggle dark mode"
        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors">
        {ready && dark ? <Sun size={16} /> : <Moon size={16} />}
        {ready ? (dark ? "Light mode" : "Dark mode") : "Theme"}
      </button>
    );
  }

  return (
    <button onClick={toggle} title="Toggle dark mode"
      className="w-11 h-11 rounded-xl flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors">
      {ready && dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
