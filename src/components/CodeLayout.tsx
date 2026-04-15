"use client";

import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { loadCanvasData, syncCanvasData } from "@/lib/canvasStorage";


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

type Variable = {
  id: string;
  name: string;
  descriptions: Description[];
};

type GameObject = {
  id: string;
  name: string;
  variables: Variable[];
  methods: Method[];
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CodeLayout({ projectId }: { projectId: string }) {
  const STORAGE_KEY = `gameref_codelayout_${projectId}_v1`;
  const [objects, setObjects] = useState<GameObject[] | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const normalize = (parsed: unknown) =>
      (parsed as GameObject[]).map((o) => ({
        ...o,
        variables: (o.variables ?? []).map((v: Variable) => ({ ...v, descriptions: v.descriptions ?? [] })),
        methods: (o.methods ?? []).map((m: Method) => ({ ...m, descriptions: m.descriptions ?? [] })),
      }));

    (async () => {
      // 1. Try DB
      const dbData = await loadCanvasData(projectId, "codelayout");
      if (dbData) {
        const normalized = normalize(dbData);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch {}
        setObjects(normalized);
        return;
      }
      // 2. Fall back to localStorage and migrate
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const normalized = normalize(JSON.parse(raw));
          setObjects(normalized);
          syncCanvasData(projectId, "codelayout", normalized);
        } else {
          setObjects([]);
        }
      } catch {
        setObjects([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (pendingFocusId && inputRefs.current[pendingFocusId]) {
      inputRefs.current[pendingFocusId]?.focus();
      setPendingFocusId(null);
    }
  });

  function save(next: GameObject[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    syncCanvasData(projectId, "codelayout", next);
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
    update((prev) => [...prev, { id, name: "", variables: [], methods: [] }]);
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

  // ── Variable CRUD ───────────────────────────────────────────────────────────

  function addVariable(objectId: string) {
    const id = makeId();
    update((prev) => prev.map((o) =>
      o.id === objectId
        ? { ...o, variables: [...o.variables, { id, name: "", descriptions: [] }] }
        : o
    ));
    setPendingFocusId(id);
  }

  function updateVariableName(objectId: string, variableId: string, name: string) {
    update((prev) => prev.map((o) =>
      o.id === objectId
        ? { ...o, variables: o.variables.map((v) => v.id === variableId ? { ...v, name } : v) }
        : o
    ));
  }

  function deleteVariable(objectId: string, variableId: string) {
    update((prev) => prev.map((o) => {
      if (o.id !== objectId) return o;
      const idx = o.variables.findIndex((v) => v.id === variableId);
      const next = o.variables.filter((v) => v.id !== variableId);
      const focusTarget = next[idx - 1]?.id ?? next[0]?.id ?? objectId;
      setPendingFocusId(focusTarget);
      return { ...o, variables: next };
    }));
  }

  function addVariableDescription(objectId: string, variableId: string) {
    const id = makeId();
    update((prev) => prev.map((o) =>
      o.id === objectId
        ? {
            ...o,
            variables: o.variables.map((v) =>
              v.id === variableId
                ? { ...v, descriptions: [...v.descriptions, { id, text: "" }] }
                : v
            ),
          }
        : o
    ));
    setPendingFocusId(id);
  }

  function updateVariableDescription(objectId: string, variableId: string, descId: string, text: string) {
    update((prev) => prev.map((o) =>
      o.id === objectId
        ? {
            ...o,
            variables: o.variables.map((v) =>
              v.id === variableId
                ? { ...v, descriptions: v.descriptions.map((d) => d.id === descId ? { ...d, text } : d) }
                : v
            ),
          }
        : o
    ));
  }

  function deleteVariableDescription(objectId: string, variableId: string, descId: string) {
    update((prev) => prev.map((o) => {
      if (o.id !== objectId) return o;
      return {
        ...o,
        variables: o.variables.map((v) => {
          if (v.id !== variableId) return v;
          const idx = v.descriptions.findIndex((d) => d.id === descId);
          const next = v.descriptions.filter((d) => d.id !== descId);
          const focusTarget = next[idx - 1]?.id ?? next[0]?.id ?? variableId;
          setPendingFocusId(focusTarget);
          return { ...v, descriptions: next };
        }),
      };
    }));
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

                  {/* Variables */}
                  {obj.variables.map((variable) => (
                    <div key={variable.id} className="group/variable">

                      {/* Variable row */}
                      <div className="flex items-center gap-3 px-5 py-0.5">
                        <span className="w-6 shrink-0" />
                        <span className="w-5 shrink-0" />
                        <input
                          ref={(el) => { inputRefs.current[variable.id] = el; }}
                          value={variable.name}
                          onChange={(e) => updateVariableName(obj.id, variable.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); if (variable.descriptions.length === 0) addVariableDescription(obj.id, variable.id); }
                            if (e.key === "Backspace" && variable.name === "") { e.preventDefault(); deleteVariable(obj.id, variable.id); }
                          }}
                          placeholder="variableName"
                          className="flex-1 bg-transparent text-emerald-400 text-sm outline-none placeholder:text-neutral-700 font-mono"
                        />
                        {/* Add description — hover only, hidden if one already exists */}
                        {variable.descriptions.length === 0 && (
                          <button
                            onClick={() => addVariableDescription(obj.id, variable.id)}
                            className="opacity-0 group-hover/variable:opacity-100 text-xs text-neutral-600 hover:text-neutral-400 transition-all flex items-center gap-1 shrink-0"
                          >
                            <Plus size={10} />
                            add description
                          </button>
                        )}
                      </div>

                      {/* Variable description (max one) */}
                      {variable.descriptions.map((desc) => (
                        <div key={desc.id} className="flex items-start gap-3 px-5 py-0.5">
                          <span className="w-6 shrink-0" />
                          <span className="w-5 shrink-0" />
                          <span className="w-5 shrink-0" />
                          <input
                            ref={(el) => { inputRefs.current[desc.id] = el; }}
                            value={desc.text}
                            onChange={(e) => updateVariableDescription(obj.id, variable.id, desc.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && desc.text === "") { e.preventDefault(); deleteVariableDescription(obj.id, variable.id, desc.id); }
                            }}
                            placeholder="Describe what this variable holds…"
                            className="flex-1 bg-transparent text-neutral-500 text-sm outline-none placeholder:text-neutral-700 italic"
                          />
                        </div>
                      ))}

                    </div>
                  ))}

                  {/* Add variable */}
                  <div className="flex items-center gap-3 px-5 py-0.5 mt-0.5">
                    <span className="w-6 shrink-0" />
                    <span className="w-5 shrink-0" />
                    <button
                      onClick={() => addVariable(obj.id)}
                      className="text-xs text-neutral-700 hover:text-neutral-500 transition-colors flex items-center gap-1"
                    >
                      <Plus size={10} />
                      add variable
                    </button>
                  </div>

                  {/* Methods */}
                  {obj.methods.map((method) => (
                    <div key={method.id} className="group/method">

                      {/* Method row */}
                      <div className="flex items-center gap-3 px-5 py-0.5">
                        <span className="w-6 shrink-0" />
                        <span className="w-5 shrink-0" />
                        <input
                          ref={(el) => { inputRefs.current[method.id] = el; }}
                          value={method.name}
                          onChange={(e) => updateMethodName(obj.id, method.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); if (method.descriptions.length === 0) addDescription(obj.id, method.id); }
                            if (e.key === "Backspace" && method.name === "") { e.preventDefault(); deleteMethod(obj.id, method.id); }
                          }}
                          placeholder="methodName()"
                          className="flex-1 bg-transparent text-sky-400 text-sm outline-none placeholder:text-neutral-700 font-mono"
                        />
                        {/* Add description — hover only, hidden if one already exists */}
                        {method.descriptions.length === 0 && (
                          <button
                            onClick={() => addDescription(obj.id, method.id)}
                            className="opacity-0 group-hover/method:opacity-100 text-xs text-neutral-600 hover:text-neutral-400 transition-all flex items-center gap-1 shrink-0"
                          >
                            <Plus size={10} />
                            add description
                          </button>
                        )}
                      </div>

                      {/* Description (max one) */}
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
                              if (e.key === "Backspace" && desc.text === "") { e.preventDefault(); deleteDescription(obj.id, method.id, desc.id); }
                            }}
                            placeholder="Describe what this method does…"
                            className="flex-1 bg-transparent text-neutral-500 text-sm outline-none placeholder:text-neutral-700 italic"
                          />
                        </div>
                      ))}

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
