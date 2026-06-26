"use client";

import { useState } from "react";
import { Plus, MoreHorizontal, Folder } from "lucide-react";

const SORT_OPTIONS = ["Newest", "Oldest", "A–Z"];

export default function ProjectsPage() {
  const [sort, setSort] = useState("Newest");
  const projects: never[] = [];

  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
          <button className="flex items-center gap-2 bg-[#C0392B] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#C0392B]/90">
            <Plus size={16} /> Create New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-[#6B7280]">
            <Folder size={56} className="mb-4 opacity-20" />
            <p className="font-semibold text-lg">No projects yet</p>
            <p className="text-sm mt-1">Create a project to organize your clips</p>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-4">
            {projects.map((_, i) => (
              <ProjectCard key={i} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProjectCard({ index }: { index: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="bg-[#0F1E3C] aspect-video flex items-center justify-center">
        <span className="text-white/30 text-xs">VIDEO</span>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-sm text-[#111827]">Project {index + 1}</h3>
            <span className="text-[11px] bg-gray-100 text-[#6B7280] px-2 py-0.5 rounded mt-1 inline-block">VIDEO</span>
          </div>
          <button className="p-1 hover:bg-gray-100 rounded">
            <MoreHorizontal size={14} className="text-[#6B7280]" />
          </button>
        </div>
        <p className="text-[11px] text-[#6B7280] mt-2">Just now</p>
      </div>
    </div>
  );
}
