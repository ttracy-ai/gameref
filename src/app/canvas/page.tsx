"use client";

import { ScrollText } from "lucide-react";
import { useState } from "react";

type RibbonItem = {
  id: string;
  icon: React.ReactNode;
  label: string;
};

const ribbonItems: RibbonItem[] = [
  {
    id: "gdd",
    icon: <ScrollText size={22} />,
    label: "Game Design Document",
  },
];

export default function CanvasPage() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-neutral-900">
      {/* Left ribbon */}
      <aside className="flex flex-col items-center gap-1 w-14 h-full bg-neutral-800 border-r border-neutral-700 py-3 shrink-0">
        {ribbonItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(active === item.id ? null : item.id)}
            title={item.label}
            aria-label={item.label}
            className={`
              group relative flex items-center justify-center
              w-10 h-10 rounded-lg transition-colors
              ${
                active === item.id
                  ? "bg-indigo-600 text-white"
                  : "text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100"
              }
            `}
          >
            {item.icon}

            {/* Tooltip */}
            <span className="pointer-events-none absolute left-12 z-50 whitespace-nowrap rounded-md bg-neutral-700 px-2 py-1 text-xs text-neutral-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {item.label}
            </span>
          </button>
        ))}
      </aside>

      {/* Canvas area */}
      <main className="flex-1 flex items-center justify-center text-neutral-600 select-none text-sm">
        Canvas coming soon
      </main>
    </div>
  );
}
