"use client";

import { useEffect, useState } from "react";
import { Plus, Minus, RotateCcw } from "lucide-react";

// Daily "posts today" tally. Every time you post a clip, tap +1 — it draws tally marks and
// keeps the count for the day. Auto-resets on a new calendar day; manual reset too.
// Stored in localStorage so it survives refreshes with no backend.

function today() { return new Date().toISOString().slice(0, 10); }

function FiveMark() {
  return (
    <svg width="46" height="42" viewBox="0 0 46 42" fill="none" className="inline-block">
      {[7, 16, 25, 34].map((x) => (
        <line key={x} x1={x} y1="6" x2={x} y2="36" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      ))}
      <line x1="3" y1="34" x2="43" y2="8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
function PartialMark({ n }: { n: number }) {
  const xs = [7, 16, 25, 34].slice(0, n);
  return (
    <svg width={Math.max(14, n * 9 + 8)} height="42" viewBox={`0 0 ${Math.max(14, n * 9 + 8)} 42`} fill="none" className="inline-block">
      {xs.map((x) => (
        <line key={x} x1={x} y1="6" x2={x} y2="36" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      ))}
    </svg>
  );
}

export default function TallyTracker() {
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("montview_tally");
      const data = raw ? JSON.parse(raw) : null;
      if (data && data.date === today() && typeof data.count === "number") setCount(data.count);
      else { setCount(0); localStorage.setItem("montview_tally", JSON.stringify({ date: today(), count: 0 })); }
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  const save = (n: number) => {
    setCount(n);
    try { localStorage.setItem("montview_tally", JSON.stringify({ date: today(), count: n })); } catch { /* ignore */ }
  };

  const groups = Math.floor(count / 5);
  const rem = count % 5;
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-[var(--text)]">Posts today</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{dateLabel}</p>
        </div>
        <div className="text-right">
          <div className="text-[34px] font-extrabold leading-none grad-text">{ready ? count : "—"}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-light)] mt-0.5">clips</div>
        </div>
      </div>

      {/* tally marks */}
      <div className="mt-4 min-h-[52px] flex flex-wrap items-center gap-x-3 gap-y-2 text-[var(--red)]">
        {ready && count === 0 && <span className="text-sm text-[var(--text-light)]">No posts yet — tap below when you post one.</span>}
        {Array.from({ length: groups }).map((_, i) => <FiveMark key={i} />)}
        {rem > 0 && <PartialMark n={rem} />}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => save(count + 1)}
          className="btn-blue flex-1 justify-center !py-2.5 text-sm">
          <Plus size={15} /> Posted a clip
        </button>
        <button onClick={() => save(Math.max(0, count - 1))} title="Undo one"
          disabled={count === 0}
          className="flex items-center justify-center w-11 py-2.5 rounded-full text-[var(--text-muted)] border border-[var(--border-dark)] hover:bg-[var(--cream-dark)] disabled:opacity-40 transition-colors">
          <Minus size={15} />
        </button>
        <button onClick={() => save(0)} title="Reset for a new day"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-full text-sm font-medium text-[var(--text-muted)] border border-[var(--border-dark)] hover:bg-[var(--cream-dark)] transition-colors">
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );
}
