"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Minus,
} from "lucide-react";

const STORAGE_KEY = "gameref_gdd_v1";

function loadContent(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? ""; }
  catch { return ""; }
}

function saveContent(html: string) {
  try { localStorage.setItem(STORAGE_KEY, html); }
  catch { console.warn("GameRef: localStorage full — GDD may not persist."); }
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolBtn({
  onClick, active, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 4,
        border: "none",
        cursor: "pointer",
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        color: active ? "#e5e5e5" : "#737373",
        transition: "background 0.1s, color 0.1s",
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div style={{ width: 1, height: 18, background: "#404040", margin: "0 4px", flexShrink: 0 }} />
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

export default function GDDEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {},
        orderedList: {},
        horizontalRule: {},
      }),
      Underline,
      Placeholder.configure({ placeholder: "Start writing your game design document…" }),
    ],
    content: loadContent(),
    onUpdate({ editor }) {
      saveContent(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "gdd-editor",
      },
    },
  });

  if (!editor) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", overflow: "hidden", background: "#171717" }}>
      {/* Toolbar */}
      <div
        onMouseDown={e => e.preventDefault()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "0 12px",
          height: 44,
          flexShrink: 0,
          borderBottom: "1px solid #2a2a2a",
          background: "#1a1a1a",
          flexWrap: "wrap",
        }}
      >
        <ToolBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={16} />
        </ToolBtn>
        <ToolBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={16} />
        </ToolBtn>
        <ToolBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={16} />
        </ToolBtn>

        <Divider />

        <ToolBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={15} />
        </ToolBtn>
        <ToolBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </ToolBtn>
        <ToolBtn title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={15} />
        </ToolBtn>
        <ToolBtn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={15} />
        </ToolBtn>

        <Divider />

        <ToolBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={15} />
        </ToolBtn>
        <ToolBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={15} />
        </ToolBtn>

        <Divider />

        <ToolBtn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus size={15} />
        </ToolBtn>
      </div>

      {/* Editor content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "32px 0" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 32px" }}>
          <EditorContent editor={editor} />
        </div>
      </div>

      <style>{`
        .gdd-editor {
          outline: none;
          color: #d4d4d4;
          font-family: inherit;
          font-size: 15px;
          line-height: 1.75;
          caret-color: #d4d4d4;
          min-height: 100%;
        }

        .gdd-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #404040;
          pointer-events: none;
          float: left;
          height: 0;
        }

        .gdd-editor h1 {
          font-size: 2em;
          font-weight: 700;
          color: #f5f5f5;
          margin: 1.4em 0 0.5em;
          line-height: 1.2;
          border-bottom: 1px solid #2a2a2a;
          padding-bottom: 0.3em;
        }
        .gdd-editor h1:first-child { margin-top: 0; }

        .gdd-editor h2 {
          font-size: 1.45em;
          font-weight: 700;
          color: #e5e5e5;
          margin: 1.3em 0 0.4em;
          line-height: 1.3;
        }

        .gdd-editor h3 {
          font-size: 1.15em;
          font-weight: 600;
          color: #d4d4d4;
          margin: 1.2em 0 0.3em;
          line-height: 1.4;
        }

        .gdd-editor p {
          margin: 0.5em 0;
        }

        .gdd-editor strong { color: #f5f5f5; font-weight: 700; }
        .gdd-editor em { color: #c4c4c4; font-style: italic; }
        .gdd-editor u { text-decoration: underline; text-underline-offset: 3px; }
        .gdd-editor s { text-decoration: line-through; color: #737373; }

        .gdd-editor ul, .gdd-editor ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .gdd-editor li { margin: 0.2em 0; }
        .gdd-editor li p { margin: 0; }

        .gdd-editor ul > li { list-style-type: disc; }
        .gdd-editor ul > li > ul > li { list-style-type: circle; }
        .gdd-editor ol > li { list-style-type: decimal; }

        .gdd-editor hr {
          border: none;
          border-top: 1px solid #2a2a2a;
          margin: 1.5em 0;
        }

        .gdd-editor code {
          background: #2a2a2a;
          color: #86efac;
          border-radius: 3px;
          padding: 1px 5px;
          font-size: 0.88em;
          font-family: 'Menlo', 'Consolas', monospace;
        }

        .gdd-editor pre {
          background: #1e1e1e;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          padding: 14px 16px;
          overflow-x: auto;
          margin: 1em 0;
        }
        .gdd-editor pre code {
          background: none;
          padding: 0;
          color: #86efac;
          font-size: 0.88em;
        }

        .gdd-editor blockquote {
          border-left: 3px solid #404040;
          margin: 1em 0;
          padding: 0.2em 0 0.2em 1em;
          color: #a3a3a3;
        }
      `}</style>
    </div>
  );
}
