"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Minus,
  ChevronDown, Plus, X, Check, Pencil,
} from "lucide-react";

const STORAGE_KEY = "gameref_gdd_v1";

// ── Types ─────────────────────────────────────────────────────────────────────

type GDDPage = {
  id: string;
  title: string;
  content: string;
};

type GDDData = {
  pages: GDDPage[];
  activeId: string;
};

// ── Storage ───────────────────────────────────────────────────────────────────

function defaultData(): GDDData {
  return { pages: [{ id: "home", title: "Home", content: "" }], activeId: "home" };
}

function loadData(): GDDData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    // Migrate from old single-string format
    if (!parsed.pages) {
      return {
        pages: [{ id: "home", title: "Home", content: typeof parsed === "string" ? parsed : "" }],
        activeId: "home",
      };
    }
    return parsed as GDDData;
  } catch { return defaultData(); }
}

function saveData(data: GDDData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
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
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: 4, border: "none", cursor: "pointer",
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
  return <div style={{ width: 1, height: 18, background: "#404040", margin: "0 4px", flexShrink: 0 }} />;
}

// ── Editor ────────────────────────────────────────────────────────────────────

export default function GDDEditor() {
  const [pages, setPages] = useState<GDDPage[]>(() => defaultData().pages);
  const [activeId, setActiveId] = useState<string>("home");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const activeIdRef = useRef(activeId);
  const pagesRef = useRef(pages);
  const isSwitching = useRef(false);
  const hasLoaded = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  // ── Editor instance ─────────────────────────────────────────────────────────

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: "",
    onUpdate({ editor }) {
      if (isSwitching.current) return;
      const html = editor.getHTML();
      const id = activeIdRef.current;
      setPages(prev => {
        const next = prev.map(p => p.id === id ? { ...p, content: html } : p);
        saveData({ pages: next, activeId: activeIdRef.current });
        return next;
      });
    },
    editorProps: { attributes: { class: "gdd-editor" } },
  });

  // Load from storage once editor is ready
  useEffect(() => {
    if (!editor || hasLoaded.current) return;
    hasLoaded.current = true;
    const loaded = loadData();
    const activePage = loaded.pages.find(p => p.id === loaded.activeId);
    isSwitching.current = true;
    editor.commands.setContent(activePage?.content ?? "");
    requestAnimationFrame(() => { isSwitching.current = false; });
    setPages(loaded.pages);
    setActiveId(loaded.activeId);
  }, [editor]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setRenamingId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  // ── Page actions ────────────────────────────────────────────────────────────

  const switchPage = (id: string) => {
    if (id === activeIdRef.current) { setDropdownOpen(false); return; }
    const page = pagesRef.current.find(p => p.id === id);
    if (!page || !editor) return;
    isSwitching.current = true;
    editor.commands.setContent(page.content ?? "");
    requestAnimationFrame(() => { isSwitching.current = false; });
    setActiveId(id);
    setPages(prev => {
      saveData({ pages: prev, activeId: id });
      return prev;
    });
    setDropdownOpen(false);
    setRenamingId(null);
  };

  const addPage = () => {
    const newPage: GDDPage = {
      id: crypto.randomUUID(),
      title: `Page ${pagesRef.current.length + 1}`,
      content: "",
    };
    isSwitching.current = true;
    editor?.commands.setContent("");
    requestAnimationFrame(() => { isSwitching.current = false; });
    setPages(prev => {
      const next = [...prev, newPage];
      saveData({ pages: next, activeId: newPage.id });
      return next;
    });
    setActiveId(newPage.id);
    setRenamingId(newPage.id);
    setRenameValue(newPage.title);
    setDropdownOpen(true);
  };

  const commitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      setPages(prev => {
        const next = prev.map(p => p.id === id ? { ...p, title: trimmed } : p);
        saveData({ pages: next, activeId: activeIdRef.current });
        return next;
      });
    }
    setRenamingId(null);
  };

  const deletePage = (id: string) => {
    if (id === "home") return;
    const currentPages = pagesRef.current;
    const nextPages = currentPages.filter(p => p.id !== id);
    let nextActiveId = activeIdRef.current;
    if (nextActiveId === id) {
      nextActiveId = "home";
      const homePage = nextPages.find(p => p.id === "home");
      isSwitching.current = true;
      editor?.commands.setContent(homePage?.content ?? "");
      requestAnimationFrame(() => { isSwitching.current = false; });
      setActiveId("home");
    }
    setPages(nextPages);
    saveData({ pages: nextPages, activeId: nextActiveId });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!editor) return null;

  const activePage = pages.find(p => p.id === activeId);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", overflow: "hidden", background: "#171717" }}>

      {/* Toolbar */}
      <div
        onMouseDown={e => e.preventDefault()}
        style={{
          display: "flex", alignItems: "center", gap: 2,
          padding: "0 8px 0 12px", height: 44, flexShrink: 0,
          borderBottom: "1px solid #2a2a2a", background: "#1a1a1a",
        }}
      >
        {/* ── Formatting buttons (left) ── */}
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

        {/* ── Spacer ── */}
        <div style={{ flex: 1 }} />

        {/* ── Pages dropdown (right) ── */}
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => { setDropdownOpen(v => !v); setRenamingId(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              height: 28, padding: "0 10px", borderRadius: 5,
              border: "1px solid #333", background: dropdownOpen ? "#2a2a2a" : "transparent",
              color: "#a3a3a3", cursor: "pointer", fontSize: 13,
              transition: "background 0.1s, color 0.1s",
              whiteSpace: "nowrap", maxWidth: 180,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {activePage?.title ?? "Home"}
            </span>
            <ChevronDown size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
          </button>

          {dropdownOpen && (
            <div
              onMouseDown={e => e.preventDefault()}
              style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)",
                minWidth: 200, maxWidth: 280,
                background: "#1e1e1e", border: "1px solid #333",
                borderRadius: 7, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                overflow: "hidden", zIndex: 100,
              }}
            >
              {/* Page list */}
              <div style={{ padding: "4px 0" }}>
                {pages.map(page => {
                  const isActive = page.id === activeId;
                  const isRenaming = renamingId === page.id;
                  return (
                    <div
                      key={page.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 2,
                        padding: "0 6px 0 10px", height: 34,
                        background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                      }}
                    >
                      {/* Active dot */}
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                        background: isActive ? "#737373" : "transparent",
                        marginRight: 4,
                      }} />

                      {isRenaming ? (
                        /* Inline rename input */
                        <>
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") commitRename(page.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            style={{
                              flex: 1, minWidth: 0, background: "#2a2a2a",
                              border: "1px solid #444", borderRadius: 3,
                              color: "#e5e5e5", fontSize: 13, padding: "2px 6px",
                              outline: "none",
                            }}
                          />
                          <button
                            onClick={() => commitRename(page.id)}
                            style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "#4ade80", display: "flex", alignItems: "center", borderRadius: 3, flexShrink: 0 }}
                          >
                            <Check size={13} />
                          </button>
                        </>
                      ) : (
                        /* Page name — click to navigate */
                        <>
                          <button
                            onClick={() => switchPage(page.id)}
                            style={{
                              flex: 1, minWidth: 0, textAlign: "left",
                              background: "none", border: "none", cursor: "pointer",
                              color: isActive ? "#e5e5e5" : "#a3a3a3",
                              fontSize: 13, padding: "0 2px",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}
                          >
                            {page.title}
                          </button>
                          {/* Rename & delete — not available for Home */}
                          {page.id !== "home" && (
                            <>
                              <button
                                onClick={() => { setRenamingId(page.id); setRenameValue(page.title); }}
                                style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "#525252", display: "flex", alignItems: "center", borderRadius: 3, flexShrink: 0 }}
                                title="Rename page"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => deletePage(page.id)}
                                style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "#525252", display: "flex", alignItems: "center", borderRadius: 3, flexShrink: 0 }}
                                title="Delete page"
                              >
                                <X size={12} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Separator + New Page */}
              <div style={{ borderTop: "1px solid #2a2a2a" }}>
                <button
                  onClick={addPage}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "100%", padding: "0 10px", height: 34,
                    background: "none", border: "none", cursor: "pointer",
                    color: "#737373", fontSize: 13, textAlign: "left",
                  }}
                >
                  <Plus size={13} />
                  New Page
                </button>
              </div>
            </div>
          )}
        </div>
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
          font-size: 2em; font-weight: 700; color: #f5f5f5;
          margin: 1.4em 0 0.5em; line-height: 1.2;
          border-bottom: 1px solid #2a2a2a; padding-bottom: 0.3em;
        }
        .gdd-editor h1:first-child { margin-top: 0; }
        .gdd-editor h2 { font-size: 1.45em; font-weight: 700; color: #e5e5e5; margin: 1.3em 0 0.4em; line-height: 1.3; }
        .gdd-editor h3 { font-size: 1.15em; font-weight: 600; color: #d4d4d4; margin: 1.2em 0 0.3em; line-height: 1.4; }
        .gdd-editor p { margin: 0.5em 0; }
        .gdd-editor strong { color: #f5f5f5; font-weight: 700; }
        .gdd-editor em { color: #c4c4c4; font-style: italic; }
        .gdd-editor u { text-decoration: underline; text-underline-offset: 3px; }
        .gdd-editor s { text-decoration: line-through; color: #737373; }
        .gdd-editor ul, .gdd-editor ol { padding-left: 1.5em; margin: 0.5em 0; }
        .gdd-editor li { margin: 0.2em 0; }
        .gdd-editor li p { margin: 0; }
        .gdd-editor ul > li { list-style-type: disc; }
        .gdd-editor ul > li > ul > li { list-style-type: circle; }
        .gdd-editor ol > li { list-style-type: decimal; }
        .gdd-editor hr { border: none; border-top: 1px solid #2a2a2a; margin: 1.5em 0; }
        .gdd-editor code {
          background: #2a2a2a; color: #86efac; border-radius: 3px;
          padding: 1px 5px; font-size: 0.88em;
          font-family: 'Menlo', 'Consolas', monospace;
        }
        .gdd-editor pre {
          background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 6px;
          padding: 14px 16px; overflow-x: auto; margin: 1em 0;
        }
        .gdd-editor pre code { background: none; padding: 0; color: #86efac; font-size: 0.88em; }
        .gdd-editor blockquote {
          border-left: 3px solid #404040; margin: 1em 0;
          padding: 0.2em 0 0.2em 1em; color: #a3a3a3;
        }
      `}</style>
    </div>
  );
}
