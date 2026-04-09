"use client";

import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-neutral-900">
      {/* Left ribbon */}
      <aside
        className={`
          relative flex flex-col items-center h-full
          bg-neutral-800 border-r border-neutral-700
          transition-all duration-200 ease-in-out shrink-0
          ${collapsed ? "w-4" : "w-14"}
        `}
      >
        {/* Icons — hidden when collapsed */}
        {!collapsed && (
          <div className="flex flex-col items-center gap-1 w-full py-3">
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
          </div>
        )}

        {/* Collapse toggle — pinned to bottom */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute bottom-3 flex items-center justify-center w-4 h-6 rounded-sm text-neutral-500 hover:text-neutral-200 hover:bg-neutral-700 transition-colors"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Canvas area */}
      <main className="flex-1 flex items-center justify-center text-neutral-600 select-none text-sm">
        Canvas coming soon
      </main>
    </div>
  );
}
