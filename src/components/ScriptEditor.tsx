"use client";

import { useState, useEffect, useRef } from "react";
import { BookOpen, X } from "lucide-react";

const STORAGE_KEY = "gameref_script_v1";

// ── Types ─────────────────────────────────────────────────────────────────────

type BlockType =
  | "act"
  | "scene"
  | "setting"
  | "at-rise"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "stage-direction";

type Block = {
  id: string;
  type: BlockType;
  text: string;
};

type ScriptData = {
  title: string;
  subtitle: string;
  author: string;
  blocks: Block[];
};

// ── Config ────────────────────────────────────────────────────────────────────

type BlockConfig = {
  label: string;
  color: string;
  hint: string;
  placeholder: string;
};

const BLOCK_CONFIG: Record<BlockType, BlockConfig> = {
  "act": {
    label: "Act",
    color: "#f59e0b",
    hint: "Marks a major division in your script. A full-length play typically has 2–3 acts. It will be centered and underlined automatically.",
    placeholder: "ACT I",
  },
  "scene": {
    label: "Scene",
    color: "#fb923c",
    hint: "A scene is a section within an act. Scenes change when the location or time shifts. Centered and underlined automatically.",
    placeholder: "Scene 1",
  },
  "setting": {
    label: "Setting",
    color: "#60a5fa",
    hint: "Describe what the stage looks like — furniture, atmosphere, lighting. This describes the space before anything happens. Formatted as 'SETTING: ...' automatically.",
    placeholder: "A dimly lit tavern. Wooden tables and flickering candles. A door stage left.",
  },
  "at-rise": {
    label: "At Rise",
    color: "#34d399",
    hint: "What is happening the exact moment the curtain rises or the scene begins. Who is on stage and what are they doing? Formatted as 'AT RISE: ...' automatically.",
    placeholder: "GARETH sits alone at the bar, nursing a drink. The room is empty.",
  },
  "character": {
    label: "Character",
    color: "#c084fc",
    hint: "The name of the character who is about to speak. Always centered and in ALL CAPS. If they continue after a stage direction, write their name followed by (cont.).",
    placeholder: "CHARACTER",
  },
  "parenthetical": {
    label: "Parenthetical",
    color: "#f472b6",
    hint: "A very brief acting note placed between the character name and their line. E.g. 'quietly' or 'to SARA'. Keep it short — actors need room to interpret. Parentheses are added automatically.",
    placeholder: "quietly",
  },
  "dialogue": {
    label: "Dialogue",
    color: "#94a3b8",
    hint: "The words a character speaks out loud. Write naturally — this runs the full width of the page. Think about how an actor would say these words aloud.",
    placeholder: "What do you mean it's gone?",
  },
  "stage-direction": {
    label: "Stage Direction",
    color: "#4ade80",
    hint: "Describes a physical action or event on stage. Write character names in ALL CAPS. Keep it brief — give actors the key action, not every detail. Parentheses and italic formatting are added automatically.",
    placeholder: "GARETH slams his fist on the bar and stands.",
  },
};

const NEXT_TYPE: Record<BlockType, BlockType> = {
  "act":             "scene",
  "scene":           "setting",
  "setting":         "at-rise",
  "at-rise":         "character",
  "character":       "dialogue",
  "parenthetical":   "dialogue",
  "dialogue":        "character",
  "stage-direction": "character",
};

const ALL_TYPES: BlockType[] = [
  "act", "scene", "setting", "at-rise",
  "character", "parenthetical", "dialogue", "stage-direction",
];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultData(): ScriptData {
  return {
    title: "Untitled Script",
    subtitle: "A Play in One Act",
    author: "",
    blocks: [
      { id: makeId(), type: "act",     text: "ACT I"   },
      { id: makeId(), type: "scene",   text: "Scene 1" },
      { id: makeId(), type: "setting", text: ""        },
      { id: makeId(), type: "at-rise", text: ""        },
    ],
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScriptEditor() {
  const [script, setScript]       = useState<ScriptData | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const pendingFocusRef = useRef<string | null>(null);
  const taRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setScript(raw ? JSON.parse(raw) : defaultData());
    } catch {
      setScript(defaultData());
    }
  }, []);

  useEffect(() => {
    if (pendingFocusRef.current) {
      const id = pendingFocusRef.current;
      pendingFocusRef.current = null;
      setFocusedId(id);
      const el = taRefs.current[id];
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
  });

  function save(data: ScriptData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function updateScript(fn: (prev: ScriptData) => ScriptData) {
    setScript((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      save(next);
      return next;
    });
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
    if (!script || script.blocks.length <= 1) return;
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

  if (!script) return null;

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
              {script.blocks.map((block) => (
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
              Script Format Guide
            </div>
            <button onClick={() => setShowGuide(false)} className="text-neutral-500 hover:text-neutral-300 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">

            {/* Active block hint */}
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

            {/* All types reference */}
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

            {/* Tips */}
            <div className="border-t border-neutral-700 pt-4 flex flex-col gap-2">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Tips</div>
              {[
                ["Enter", "Adds the next logical block automatically"],
                ["Shift+Enter", "Adds a new line within the current block"],
                ["Backspace", "On an empty block, deletes it"],
                ["Type selector", "Click any colored label above a focused block to change its type"],
                ["Parentheticals", "Use sparingly — actors prefer to make their own choices"],
                ["cont.", "Write CHARACTER (cont.) when continuing after a stage direction"],
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

// ── ScriptBlock ───────────────────────────────────────────────────────────────

function ScriptBlock({
  block, isFocused, taRef, onFocus, onBlur,
  onChange, onTypeChange, onEnter, onDelete, canDelete,
}: {
  block: Block;
  isFocused: boolean;
  taRef: (el: HTMLTextAreaElement | null) => void;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (text: string) => void;
  onTypeChange: (type: BlockType) => void;
  onEnter: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  function setRef(el: HTMLTextAreaElement | null) {
    localRef.current = el;
    taRef(el);
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    if (localRef.current) autoResize(localRef.current);
  }, [block.text]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnter();
    }
    if (e.key === "Backspace" && block.text === "" && canDelete) {
      e.preventDefault();
      onDelete();
    }
  }

  const monoBase: React.CSSProperties = {
    fontFamily: "Courier New, monospace",
    fontSize: 14,
    lineHeight: 1.7,
    background: "transparent",
    border: "none",
    outline: "none",
    resize: "none",
    overflow: "hidden",
    padding: 0,
    width: "100%",
  };

  function wrapperMargin(): React.CSSProperties {
    switch (block.type) {
      case "act":             return { marginTop: 36, marginBottom: 8 };
      case "scene":           return { marginTop: 4, marginBottom: 8 };
      case "setting":         return { marginTop: 16, marginBottom: 2 };
      case "at-rise":         return { marginTop: 2, marginBottom: 24 };
      case "character":       return { marginTop: 24, marginBottom: 2 };
      case "parenthetical":   return { marginTop: 0, marginBottom: 0 };
      case "dialogue":        return { marginBottom: 4 };
      case "stage-direction": return { marginTop: 8, marginBottom: 8 };
      default:                return {};
    }
  }

  function renderContent() {
    switch (block.type) {

      case "act":
        return (
          <textarea
            ref={setRef} value={block.text} rows={1}
            onChange={(e) => { onChange(e.target.value); autoResize(e.target); }}
            onFocus={onFocus} onBlur={onBlur} onKeyDown={handleKeyDown}
            placeholder="ACT I"
            style={{ ...monoBase, textAlign: "center", textTransform: "uppercase", fontWeight: "bold", textDecoration: "underline", color: "#1a1a1a" }}
          />
        );

      case "scene":
        return (
          <textarea
            ref={setRef} value={block.text} rows={1}
            onChange={(e) => { onChange(e.target.value); autoResize(e.target); }}
            onFocus={onFocus} onBlur={onBlur} onKeyDown={handleKeyDown}
            placeholder="Scene 1"
            style={{ ...monoBase, textAlign: "center", textDecoration: "underline", color: "#1a1a1a" }}
          />
        );

      case "setting":
      case "at-rise": {
        const label = block.type === "setting" ? "SETTING:" : "AT RISE:";
        return (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontFamily: "Courier New, monospace", fontSize: 14, lineHeight: 1.7, fontWeight: "bold", flexShrink: 0, minWidth: 90 }}>
              {label}
            </span>
            <textarea
              ref={setRef} value={block.text} rows={1}
              onChange={(e) => { onChange(e.target.value); autoResize(e.target); }}
              onFocus={onFocus} onBlur={onBlur} onKeyDown={handleKeyDown}
              placeholder={BLOCK_CONFIG[block.type].placeholder}
              style={{ ...monoBase, flex: 1, textTransform: "uppercase", color: "#1a1a1a" }}
            />
          </div>
        );
      }

      case "character":
        return (
          <textarea
            ref={setRef} value={block.text} rows={1}
            onChange={(e) => { onChange(e.target.value); autoResize(e.target); }}
            onFocus={onFocus} onBlur={onBlur} onKeyDown={handleKeyDown}
            placeholder="CHARACTER"
            style={{ ...monoBase, textAlign: "center", textTransform: "uppercase", color: "#1a1a1a" }}
          />
        );

      case "parenthetical":
        return (
          <div style={{ display: "flex", alignItems: "flex-start", paddingLeft: "26%", fontStyle: "italic", color: "#444" }}>
            <span style={{ fontFamily: "Courier New, monospace", fontSize: 14, lineHeight: 1.7 }}>(</span>
            <textarea
              ref={setRef} value={block.text} rows={1}
              onChange={(e) => { onChange(e.target.value); autoResize(e.target); }}
              onFocus={onFocus} onBlur={onBlur} onKeyDown={handleKeyDown}
              placeholder={BLOCK_CONFIG[block.type].placeholder}
              style={{ ...monoBase, flex: 1, fontStyle: "italic", color: "#444" }}
            />
            <span style={{ fontFamily: "Courier New, monospace", fontSize: 14, lineHeight: 1.7 }}>)</span>
          </div>
        );

      case "dialogue":
        return (
          <textarea
            ref={setRef} value={block.text} rows={1}
            onChange={(e) => { onChange(e.target.value); autoResize(e.target); }}
            onFocus={onFocus} onBlur={onBlur} onKeyDown={handleKeyDown}
            placeholder={BLOCK_CONFIG[block.type].placeholder}
            style={{ ...monoBase, color: "#1a1a1a" }}
          />
        );

      case "stage-direction":
        return (
          <div style={{ display: "flex", alignItems: "flex-start", paddingLeft: "16%", paddingRight: "8%", fontStyle: "italic", color: "#444" }}>
            <span style={{ fontFamily: "Courier New, monospace", fontSize: 14, lineHeight: 1.7 }}>(</span>
            <textarea
              ref={setRef} value={block.text} rows={1}
              onChange={(e) => { onChange(e.target.value); autoResize(e.target); }}
              onFocus={onFocus} onBlur={onBlur} onKeyDown={handleKeyDown}
              placeholder={BLOCK_CONFIG[block.type].placeholder}
              style={{ ...monoBase, flex: 1, fontStyle: "italic", color: "#444" }}
            />
            <span style={{ fontFamily: "Courier New, monospace", fontSize: 14, lineHeight: 1.7 }}>)</span>
          </div>
        );
    }
  }

  return (
    <div
      style={{
        position: "relative",
        ...wrapperMargin(),
        borderLeft: `2px solid ${isFocused ? BLOCK_CONFIG[block.type].color : "transparent"}`,
        paddingLeft: 8,
        transition: "border-color 0.1s",
      }}
    >
      {/* Type selector */}
      {isFocused && (
        <div
          style={{
            position: "absolute",
            top: -24,
            left: 0,
            display: "flex",
            gap: 3,
            zIndex: 20,
            flexWrap: "wrap",
          }}
        >
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              onMouseDown={(e) => { e.preventDefault(); onTypeChange(type); }}
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
                background: block.type === type ? BLOCK_CONFIG[type].color : `${BLOCK_CONFIG[type].color}28`,
                color: block.type === type ? "#000" : BLOCK_CONFIG[type].color,
                fontWeight: block.type === type ? 700 : 400,
                transition: "all 0.1s",
              }}
            >
              {BLOCK_CONFIG[type].label}
            </button>
          ))}
        </div>
      )}

      {renderContent()}
    </div>
  );
}
