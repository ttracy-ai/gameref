"use client";

import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";

const STORAGE_KEY = "gameref_codelayout_v1";

type GameObject = {
  id: string;
  name: string;
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function CodeLayout() {
  const [objects, setObjects] = useState<GameObject[] | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const latestInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setObjects(raw ? JSON.parse(raw) : []);
    } catch {
      setObjects([]);
    }
  }, []);

  function save(next: GameObject[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addObject() {
    const newObj: GameObject = { id: makeId(), name: "" };
    setObjects((prev) => {
      const next = [...(prev ?? []), newObj];
      save(next);
      return next;
    });
    setTimeout(() => latestInputRef.current?.focus(), 0);
  }

  function updateName(id: string, name: string) {
    setObjects((prev) => {
      const next = (prev ?? []).map((o) => (o.id === id ? { ...o, name } : o));
      save(next);
      return next;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      addObject();
    }
    if (e.key === "Backspace") {
      const obj = objects?.find((o) => o.id === id);
      if (obj?.name === "") {
        e.preventDefault();
        deleteObject(id);
      }
    }
  }

  function deleteObject(id: string) {
    setObjects((prev) => {
      const next = (prev ?? []).filter((o) => o.id !== id);
      save(next);
      return next;
    });
  }

  if (objects === null) return null;

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-10 px-6">

          {/* Document header */}
          <div className="mb-6">
            <h1 className="text-neutral-200 text-xl font-semibold">Code Layout</h1>
            <p className="text-neutral-500 text-sm mt-1">A structured list of game objects in your project.</p>
          </div>

          {/* Document body */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">

            {/* Column header */}
            <div className="flex items-center gap-4 px-5 py-2.5 border-b border-neutral-700 bg-neutral-750">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Game Object</span>
            </div>

            {/* Object rows */}
            <div className="divide-y divide-neutral-700/60">
              {objects.length === 0 && (
                <div className="px-5 py-8 text-center text-neutral-600 text-sm select-none">
                  No game objects yet. Click "Add Game Object" to get started.
                </div>
              )}
              {objects.map((obj, i) => (
                <div key={obj.id} className="flex items-center gap-3 px-5 py-2 group">
                  <span className="text-neutral-600 text-xs w-6 text-right shrink-0 select-none tabular-nums">
                    {i + 1}
                  </span>
                  <input
                    ref={i === objects.length - 1 ? latestInputRef : undefined}
                    value={obj.name}
                    onChange={(e) => updateName(obj.id, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, obj.id)}
                    placeholder="GameObject"
                    className="flex-1 bg-transparent text-neutral-200 text-sm outline-none placeholder:text-neutral-600"
                  />
                </div>
              ))}
            </div>

            {/* Add button */}
            <div className="px-4 py-3 border-t border-neutral-700">
              <button
                onClick={addObject}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <Plus size={15} />
                Add Game Object
              </button>
            </div>
          </div>

          <div ref={bottomRef} />
        </div>
      </div>
    </main>
  );
}
