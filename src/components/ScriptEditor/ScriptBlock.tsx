"use client";

// ScriptBlock — a single screenplay-formatted block in the Script Editor.
// Also exports all block types, config, and shared constants.

import { useEffect, useRef } from "react";


// ── Types ─────────────────────────────────────────────────────────────────────

export type BlockType =
  | "act"
  | "scene"
  | "setting"
  | "at-rise"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "stage-direction";

export type Block = {
  id: string;
  type: BlockType;
  text: string;
};

export type ScriptData = {
  title: string;
  subtitle: string;
  author: string;
  blocks: Block[];
};

// ── Config ────────────────────────────────────────────────────────────────────

export type BlockConfig = {
  label: string;
  color: string;
  hint: string;
  placeholder: string;
};

export const BLOCK_CONFIG: Record<BlockType, BlockConfig> = {
  "act": {
    label: "Chapter",
    color: "#f59e0b",
    hint: "A major story division — like Chapter 1 or Act I in a game's narrative. Use this to separate your story into large sections (e.g. the opening, the rising action, the climax). Centered and underlined automatically.",
    placeholder: "CHAPTER 1",
  },
  "scene": {
    label: "Scene",
    color: "#fb923c",
    hint: "A specific cutscene or story beat within a chapter. Scenes change when the location shifts, time jumps, or a new story moment begins. Give it a number or a short name. Centered and underlined automatically.",
    placeholder: "Scene 1: The Awakening",
  },
  "setting": {
    label: "Location",
    color: "#60a5fa",
    hint: "Where this scene takes place. Describe the environment — the level, area, time of day, and atmosphere. Think of this as briefing the level designer and cinematics team. Formatted as 'SETTING: ...' automatically.",
    placeholder: "INT. ABANDONED RESEARCH FACILITY - NIGHT. Flickering fluorescent lights. Overturned equipment. Emergency sirens in the distance.",
  },
  "at-rise": {
    label: "Opens On",
    color: "#34d399",
    hint: "What the player sees and hears the instant this scene begins. Set the mood immediately — who is on screen, what are they doing, what is the camera showing? Formatted as 'AT RISE: ...' automatically.",
    placeholder: "KIRA crawls through a ventilation shaft, flashlight clenched in her teeth. She stops and peers through a grate below.",
  },
  "character": {
    label: "Character",
    color: "#c084fc",
    hint: "The name of the character who is about to speak — an NPC, the player character, a narrator, or even a radio voice. Always centered and in ALL CAPS. Add (V.O.) for voiceover or (O.S.) for off-screen. Add (cont.) if continuing after a Direction.",
    placeholder: "KIRA",
  },
  "parenthetical": {
    label: "Delivery",
    color: "#f472b6",
    hint: "A brief note to the voice actor on how to deliver the line — e.g. 'panicked', 'into radio', 'barely a whisper'. Keep it very short. Voice actors need room to interpret; over-directing kills the performance. Parentheses are added automatically.",
    placeholder: "into radio, hushed",
  },
  "dialogue": {
    label: "Line",
    color: "#94a3b8",
    hint: "The actual words spoken by the character. Write naturally — read it aloud to hear how it sounds. This is what the voice actor records and what appears in subtitles. Runs the full width of the page.",
    placeholder: "They already know we're here. We have maybe two minutes before this whole wing locks down.",
  },
  "stage-direction": {
    label: "Direction",
    color: "#4ade80",
    hint: "Describes what happens on screen — character actions, camera moves, environmental events, gameplay transitions, or cinematic beats. Write character names in ALL CAPS. Keep it lean: cinematics teams fill in the details. Parentheses and italics are added automatically.",
    placeholder: "KIRA drops from the vent. A GUARD rounds the corner and stops. They stare at each other.",
  },
};

export const NEXT_TYPE: Record<BlockType, BlockType> = {
  "act":             "scene",
  "scene":           "setting",
  "setting":         "at-rise",
  "at-rise":         "character",
  "character":       "dialogue",
  "parenthetical":   "dialogue",
  "dialogue":        "character",
  "stage-direction": "character",
};

export const ALL_TYPES: BlockType[] = [
  "act", "scene", "setting", "at-rise",
  "character", "parenthetical", "dialogue", "stage-direction",
];

export function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── ScriptBlock ───────────────────────────────────────────────────────────────

export function ScriptBlock({
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
      {isFocused && (
        <div style={{ position: "absolute", top: -24, left: 0, display: "flex", gap: 3, zIndex: 20, flexWrap: "wrap" }}>
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
