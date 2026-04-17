"use client";

// ScriptEditor — screenplay-formatted game script editor with real-time sync.
// Outer: loads from DB/localStorage, seeds RoomProvider.
// Inner: reads/writes Liveblocks storage for live updates across clients.

import { useState, useEffect, useRef } from "react";
import { BookOpen, X } from "lucide-react";
import { loadCanvasData, syncCanvasData } from "@/lib/canvasStorage";
import { RoomProvider, useStorage, useMutation } from "@/lib/liveblocks-canvas";
import {
  ScriptBlock, BLOCK_CONFIG, NEXT_TYPE, ALL_TYPES, makeId,
  type Block, type BlockType, type ScriptData,
} from "./ScriptBlock";
import CanvasLoader from "@/components/CanvasLoader";


// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultData(): ScriptData {
  return {
    title: "Untitled Script",
    subtitle: "Game Narrative Script",
    author: "",
    blocks: [
      { id: makeId(), type: "act",     text: "CHAPTER 1" },
      { id: makeId(), type: "scene",   text: "Scene 1"   },
      { id: makeId(), type: "setting", text: ""          },
      { id: makeId(), type: "at-rise", text: ""          },
    ],
  };
}

// ── Outer shell: loads from DB then mounts the Liveblocks room ────────────────

export default function ScriptEditor({ projectId }: { projectId: string }) {
  const STORAGE_KEY = `gameref_script_${projectId}_v1`;
  const [initialJson, setInitialJson] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const dbData = await loadCanvasData(projectId, "script");
      if (dbData) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dbData)); } catch {}
        setInitialJson(JSON.stringify(dbData));
        return;
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as ScriptData) : null;
        const initial = parsed ?? defaultData();
        setInitialJson(JSON.stringify(initial));
        if (parsed) syncCanvasData(projectId, "script", parsed);
      } catch {
        setInitialJson(JSON.stringify(defaultData()));
      }
    })();
  }, [projectId]);

  if (!initialJson) return <CanvasLoader />;

  return (
    <RoomProvider id={`script_${projectId}`} initialStorage={{ canvasJson: initialJson }}>
      <ScriptEditorInner key={projectId} projectId={projectId} />
    </RoomProvider>
  );
}

// ── Inner editor: reads/writes Liveblocks storage for real-time sync ──────────

function ScriptEditorInner({ projectId }: { projectId: string }) {
  const STORAGE_KEY = `gameref_script_${projectId}_v1`;

  const canvasJson    = useStorage((root) => root.canvasJson);
  const setCanvasJson = useMutation(({ storage }, newJson: string) => {
    storage.set("canvasJson", newJson);
  }, []);

  const [focusedId, setFocusedId]   = useState<string | null>(null);
  const [showGuide, setShowGuide]   = useState(true);
  const pendingFocusRef             = useRef<string | null>(null);
  const taRefs                      = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    if (pendingFocusRef.current) {
      const id = pendingFocusRef.current;
      pendingFocusRef.current = null;
      setFocusedId(id);
      const el = taRefs.current[id];
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
  });

  if (!canvasJson) return <CanvasLoader />;

  const script = JSON.parse(canvasJson) as ScriptData;

  function updateScript(fn: (prev: ScriptData) => ScriptData) {
    const next = fn(script);
    const nextJson = JSON.stringify(next);
    try { localStorage.setItem(STORAGE_KEY, nextJson); } catch {}
    syncCanvasData(projectId, "script", next);
    setCanvasJson(nextJson);
  }

  function updateBlock(id: string, text: string) {
    updateScript((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, text } : b)),
    }));
  }

  function setBlockType(id: string, type: BlockType) {
    updateScript((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, type } : b)),
    }));
    setFocusedId(id);
    setTimeout(() => taRefs.current[id]?.focus(), 0);
  }

  function insertBlockAfter(afterId: string, type: BlockType) {
    const newId = makeId();
    updateScript((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === afterId);
      const blocks = [...prev.blocks];
      blocks.splice(idx + 1, 0, { id: newId, type, text: "" });
      return { ...prev, blocks };
    });
    pendingFocusRef.current = newId;
  }

  function deleteBlock(id: string) {
    if (script.blocks.length <= 1) return;
    const idx = script.blocks.findIndex((b) => b.id === id);
    const prevId = script.blocks[Math.max(0, idx - 1)]?.id;
    updateScript((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== id),
    }));
    if (prevId) {
      pendingFocusRef.current = prevId;
      setFocusedId(prevId);
    }
  }

  const focusedBlock = script.blocks.find((b) => b.id === focusedId) ?? null;

  return (
    <main className="flex-1 flex h-full overflow-hidden bg-neutral-900">

      {/* Script scroll area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-10 px-6">

          {/* Title block */}
          <div className="text-center mb-10" style={{ fontFamily: "Courier New, monospace" }}>
            <input
              value={script.title}
              onChange={(e) => updateScript((p) => ({ ...p, title: e.target.value }))}
              className="w-full text-center bg-transparent text-neutral-100 font-bold uppercase outline-none border-b border-neutral-700 focus:border-neutral-400 pb-1 mb-2 text-lg tracking-wide"
              style={{ fontFamily: "Courier New, monospace" }}
              placeholder="SCRIPT TITLE"
            />
            <input
              value={script.subtitle}
              onChange={(e) => updateScript((p) => ({ ...p, subtitle: e.target.value }))}
              className="w-full text-center bg-transparent text-neutral-500 outline-none pb-1 mb-1"
              style={{ fontFamily: "Courier New, monospace", fontSize: 14 }}
              placeholder="A Play in One Act"
            />
            <div className="text-neutral-600" style={{ fontFamily: "Courier New, monospace", fontSize: 14 }}>by</div>
            <input
              value={script.author}
              onChange={(e) => updateScript((p) => ({ ...p, author: e.target.value }))}
              className="w-full text-center bg-transparent text-neutral-500 outline-none pb-1"
              style={{ fontFamily: "Courier New, monospace", fontSize: 14 }}
              placeholder="Author Name"
            />
          </div>

          {/* Paper */}
          <div
            className="rounded-lg shadow-2xl px-12 py-10 min-h-96"
            style={{ background: "#fafaf8", fontFamily: "Courier New, monospace", fontSize: 14, color: "#1a1a1a", lineHeight: 1.7, overflow: "visible" }}
          >
            <div style={{ position: "relative" }}>
              {script.blocks.map((block: Block) => (
                <ScriptBlock
                  key={block.id}
                  block={block}
                  isFocused={focusedId === block.id}
                  taRef={(el) => { taRefs.current[block.id] = el; }}
                  onFocus={() => setFocusedId(block.id)}
                  onBlur={() => setTimeout(() => setFocusedId((p) => p === block.id ? null : p), 120)}
                  onChange={(text) => updateBlock(block.id, text)}
                  onTypeChange={(type) => setBlockType(block.id, type)}
                  onEnter={() => insertBlockAfter(block.id, NEXT_TYPE[block.type])}
                  onDelete={() => deleteBlock(block.id)}
                  canDelete={script.blocks.length > 1}
                />
              ))}
            </div>

            {/* Add block buttons */}
            <div className="mt-8 pt-5 border-t border-neutral-200 flex flex-wrap gap-2">
              {ALL_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    const lastId = script.blocks[script.blocks.length - 1]?.id;
                    if (lastId) insertBlockAfter(lastId, type);
                  }}
                  className="text-xs px-2 py-0.5 rounded border transition-opacity hover:opacity-80"
                  style={{
                    borderColor: BLOCK_CONFIG[type].color,
                    color: BLOCK_CONFIG[type].color,
                    background: `${BLOCK_CONFIG[type].color}15`,
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  + {BLOCK_CONFIG[type].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Guide toggle button */}
      {!showGuide && (
        <button
          onClick={() => setShowGuide(true)}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-neutral-700 text-neutral-300 hover:bg-neutral-600 transition-colors"
        >
          <BookOpen size={13} />
          Guide
        </button>
      )}

      {/* Guide panel */}
      {showGuide && (
        <div className="w-72 shrink-0 h-full bg-neutral-800 border-l border-neutral-700 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
              <BookOpen size={14} />
              Game Script Guide
            </div>
            <button onClick={() => setShowGuide(false)} className="text-neutral-500 hover:text-neutral-300 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">
            {focusedBlock && (
              <div
                className="rounded-lg p-3 text-xs leading-relaxed shrink-0"
                style={{
                  background: `${BLOCK_CONFIG[focusedBlock.type].color}18`,
                  borderLeft: `3px solid ${BLOCK_CONFIG[focusedBlock.type].color}`,
                }}
              >
                <div className="font-bold mb-1" style={{ color: BLOCK_CONFIG[focusedBlock.type].color }}>
                  Currently editing: {BLOCK_CONFIG[focusedBlock.type].label}
                </div>
                <div className="text-neutral-300">{BLOCK_CONFIG[focusedBlock.type].hint}</div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Elements</div>
              {ALL_TYPES.map((type) => (
                <div key={type}>
                  <div className="text-xs font-semibold mb-0.5" style={{ color: BLOCK_CONFIG[type].color }}>
                    {BLOCK_CONFIG[type].label}
                  </div>
                  <div className="text-xs text-neutral-500 leading-relaxed">{BLOCK_CONFIG[type].hint}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-neutral-700 pt-4 flex flex-col gap-2">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Tips</div>
              {[
                ["Enter", "Adds the next logical block automatically"],
                ["Shift+Enter", "Adds a new line within the current block"],
                ["Backspace", "On an empty block, deletes it"],
                ["Type selector", "Click any colored label above a focused block to change its type"],
                ["V.O.", "Add (V.O.) after a name for voiceover — heard but not seen on screen"],
                ["O.S.", "Add (O.S.) for off-screen — the character is nearby but not visible"],
                ["Delivery", "Keep delivery notes very short — voice actors interpret best with minimal direction"],
                ["cont.", "Write CHARACTER (cont.) after a Direction if the same character keeps speaking"],
                ["Direction", "Describe only what the camera or player sees — not internal thoughts"],
              ].map(([key, desc]) => (
                <div key={key} className="flex gap-2 text-xs">
                  <span className="text-neutral-300 font-medium shrink-0">{key}:</span>
                  <span className="text-neutral-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
