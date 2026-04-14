"use client";

import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";

const STORAGE_KEY = "gameref_codelayout_v1";

// ── Types ─────────────────────────────────────────────────────────────────────

type Description = {
  id: string;
  text: string;
};

type Method = {
  id: string;
  name: string;
  descriptions: Description[];
};

type GameObject = {
  id: string;
  name: string;
  methods: Method[];
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CodeLayout() {
  const [objects, setObjects] = useState<GameObject[] | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setObjects(raw ? JSON.parse(raw) : []);
    } catch {
      setObjects([]);
    }
  }, []);

  useEffect(() => {
    if (pendingFocusId && inputRefs.current[pendingFocusId]) {
      inputRefs.current[pendingFocusId]?.focus();
      setPendingFocusId(null);
    }
  });

  function save(next: GameObject[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function update(fn: (prev: GameObject[]) => GameObject[]) {
    setObjects((prev) => {
      const next = fn(prev ?? []);
      save(next);
      return next;
    });
  }

  // ── Game object CRUD ────────────────────────────────────────────────────────

  function addObject() {
    const id = makeId();
    update((prev) => [...prev, { id, name: "", methods: [] }]);
    setPendingFocusId(id);
  }

  function updateObjectName(id: string, name: string) {
    update((prev) => prev.map((o) => o.id === id ? { ...o, name } : o));
  }

  function deleteObject(id: string) {
    update((prev) => {
      const idx = prev.findIndex((o) => o.id === id);
      const next = prev.filter((o) => o.id !== id);
      const focusTarget = next[idx - 1]?.id ?? next[0]?.id ?? null;
      if (focusTarget) setPendingFocusId(focusTarget);
      return next;
    });
  }

  // ── Method CRUD ─────────────────────────────────────────────────────────────

  function addMethod(objectId: string) {
    const id = makeId();
    update((prev) => prev.map((o) =>
      o.id === objectId
        ? { ...o, methods: [...o.methods, { id, name: "", descriptions: [] }] }
        : o
    ));
    setPendingFocusId(id);
  }

  function updateMethodName(objectId: string, methodId: string, name: string) {
    update((prev) => prev.map((o) =>
      o.id === objectId
        ? { ...o, methods: o.methods.map((m) => m.id === methodId ? { ...m, name } : m) }
        : o
    ));
  }

  function deleteMethod(objectId: string, methodId: string) {
    update((prev) => prev.map((o) => {
      if (o.id !== objectId) return o;
      const idx = o.methods.findIndex((m) => m.id === methodId);
      const next = o.methods.filter((m) => m.id !== methodId);
      const focusTarget = next[idx - 1]?.id ?? next[0]?.id ?? objectId;
      setPendingFocusId(focusTarget);
      return { ...o, methods: next };
    }));
  }

  // ── Description CRUD ────────────────────────────────────────────────────────

  function addDescription(objectId: string, methodId: string) {
    const id = makeId();
    update((prev) => prev.map((o) =>
      o.id === objectId
        ? {
            ...o,
            methods: o.methods.map((m) =>
              m.id === methodId
                ? { ...m, descriptions: [...m.descriptions, { id, text: "" }] }
                : m
            ),
          }
        : o
    ));
    setPendingFocusId(id);
  }

  function addDescriptionAfter(objectId: string, methodId: string, afterId: string) {
    const id = makeId();
    update((prev) => prev.map((o) =>
      o.id === objectId
        ? {
            ...o,
            methods: o.methods.map((m) => {
              if (m.id !== methodId) return m;
              const idx = m.descriptions.findIndex((d) => d.id === afterId);
              const descs = [...m.descriptions];
              descs.splice(idx + 1, 0, { id, text: "" });
              return { ...m, descriptions: descs };
            }),
          }
        : o
    ));
    setPendingFocusId(id);
  }

  function updateDescription(objectId: string, methodId: string, descId: string, text: string) {
    update((prev) => prev.map((o) =>
      o.id === objectId
        ? {
            ...o,
            methods: o.methods.map((m) =>
              m.id === methodId
                ? { ...m, descriptions: m.descriptions.map((d) => d.id === descId ? { ...d, text } : d) }
                : m
            ),
          }
        : o
    ));
  }

  function deleteDescription(objectId: string, methodId: string, descId: string) {
    update((prev) => prev.map((o) => {
      if (o.id !== objectId) return o;
      return {
        ...o,
        methods: o.methods.map((m) => {
          if (m.id !== methodId) return m;
          const idx = m.descriptions.findIndex((d) => d.id === descId);
          const next = m.descriptions.filter((d) => d.id !== descId);
          const focusTarget = next[idx - 1]?.id ?? next[0]?.id ?? methodId;
          setPendingFocusId(focusTarget);
          return { ...m, descriptions: next };
        }),
      };
    }));
  }

  if (objects === null) return null;

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-10 px-6">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-neutral-200 text-xl font-semibold">Code Layout</h1>
            <p className="text-neutral-500 text-sm mt-1">
              Map out your game objects, their methods, and what each one does.
            </p>
          </div>

          {/* Document */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">

            {/* Column header */}
            <div className="px-5 py-2.5 border-b border-neutral-700">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Game Objects
              </span>
            </div>

            {/* Empty state */}
            {objects.length === 0 && (
              <div className="px-5 py-10 text-center text-neutral-600 text-sm select-none">
                No game objects yet. Click "Add Game Object" to get started.
              </div>
            )}

            {/* Objects */}
            <div className="divide-y divide-neutral-700/50">
              {objects.map((obj, objIdx) => (
                <div key={obj.id} className="py-2">

                  {/* Game object row */}
                  <div className="flex items-center gap-3 px-5 py-1">
                    <span className="text-neutral-600 text-xs w-6 text-right shrink-0 tabular-nums select-none">
                      {objIdx + 1}
                    </span>
                    <input
                      ref={(el) => { inputRefs.current[obj.id] = el; }}
                      value={obj.name}
                      onChange={(e) => updateObjectName(obj.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addMethod(obj.id); }
                        if (e.key === "Backspace" && obj.name === "") { e.preventDefault(); deleteObject(obj.id); }
                      }}
                      placeholder="GameObjectName"
                      className="flex-1 bg-transparent text-neutral-200 font-semibold text-sm outline-none placeholder:text-neutral-600"
                    />
                  </div>

                  {/* Methods */}
                  {obj.methods.map((method) => (
                    <div key={method.id}>

                      {/* Method row */}
                      <div className="flex items-center gap-3 px-5 py-0.5">
                        <span className="w-6 shrink-0" />
                        <span className="w-5 shrink-0" />
                        <input
                          ref={(el) => { inputRefs.current[method.id] = el; }}
                          value={method.name}
                          onChange={(e) => updateMethodName(obj.id, method.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); addDescription(obj.id, method.id); }
                            if (e.key === "Backspace" && method.name === "") { e.preventDefault(); deleteMethod(obj.id, method.id); }
                          }}
                          placeholder="methodName()"
                          className="flex-1 bg-transparent text-sky-400 text-sm outline-none placeholder:text-neutral-700 font-mono"
                        />
                      </div>

                      {/* Descriptions */}
                      {method.descriptions.map((desc) => (
                        <div key={desc.id} className="flex items-start gap-3 px-5 py-0.5">
                          <span className="w-6 shrink-0" />
                          <span className="w-5 shrink-0" />
                          <span className="w-5 shrink-0" />
                          <input
                            ref={(el) => { inputRefs.current[desc.id] = el; }}
                            value={desc.text}
                            onChange={(e) => updateDescription(obj.id, method.id, desc.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); addDescriptionAfter(obj.id, method.id, desc.id); }
                              if (e.key === "Backspace" && desc.text === "") { e.preventDefault(); deleteDescription(obj.id, method.id, desc.id); }
                            }}
                            placeholder="Describe what this method does…"
                            className="flex-1 bg-transparent text-neutral-500 text-sm outline-none placeholder:text-neutral-700 italic"
                          />
                        </div>
                      ))}

                      {/* Add description */}
                      <div className="flex items-center gap-3 px-5 py-0.5">
                        <span className="w-6 shrink-0" />
                        <span className="w-5 shrink-0" />
                        <span className="w-5 shrink-0" />
                        <button
                          onClick={() => addDescription(obj.id, method.id)}
                          className="text-xs text-neutral-700 hover:text-neutral-500 transition-colors flex items-center gap-1"
                        >
                          <Plus size={10} />
                          add description
                        </button>
                      </div>

                    </div>
                  ))}

                  {/* Add method */}
                  <div className="flex items-center gap-3 px-5 py-0.5 mt-0.5">
                    <span className="w-6 shrink-0" />
                    <span className="w-5 shrink-0" />
                    <button
                      onClick={() => addMethod(obj.id)}
                      className="text-xs text-neutral-700 hover:text-neutral-500 transition-colors flex items-center gap-1"
                    >
                      <Plus size={10} />
                      add method
                    </button>
                  </div>

                </div>
              ))}
            </div>

            {/* Add game object */}
            <div className="px-5 py-3 border-t border-neutral-700">
              <button
                onClick={addObject}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <Plus size={15} />
                Add Game Object
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
