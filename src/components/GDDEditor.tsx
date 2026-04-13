"use client";

import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Mark, Node as TipTapNode, mergeAttributes } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/core";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Minus,
  ChevronDown, Plus, X, Check, Pencil, Link2, Link2Off,
  Image as ImageIcon, ExternalLink,
} from "lucide-react";

const STORAGE_KEY = "gameref_gdd_v1";

// ── Custom PageLink mark ──────────────────────────────────────────────────────
// Renders as <span data-page-id="..."> — no <a href>, so Chrome can't follow it.

const PageLink = Mark.create({
  name: "pageLink",

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: el => el.getAttribute("data-page-id"),
        renderHTML: attrs => ({ "data-page-id": attrs.pageId }),
      },
    };
  },

  parseHTML() { return [{ tag: "span[data-page-id]" }]; },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({ class: "gdd-page-link" }, HTMLAttributes), 0];
  },
});

// ── Image reference system ────────────────────────────────────────────────────

// Context lets the NodeView call back to the GDDEditor without prop-drilling
// through TipTap's extension machinery.
const GDDImageContext = createContext<{ onImageRefClick: (id: string) => void }>({
  onImageRefClick: () => {},
});

// NodeView rendered inside TipTap — shows a small thumbnail chip
function ImageRefNodeView({ node }: NodeViewProps) {
  const { onImageRefClick } = useContext(GDDImageContext);
  const imageId: string = node.attrs.imageId;
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("gameref_refboard_v1");
      if (!raw) return;
      const imgs = JSON.parse(raw) as Array<{ id: string; src: string }>;
      const found = imgs.find(i => i.id === imageId);
      if (found) setThumb(found.src);
    } catch {}
  }, [imageId]);

  return (
    <NodeViewWrapper as="span" style={{ display: "inline-block", verticalAlign: "middle", lineHeight: 1 }}>
      <span
        contentEditable={false}
        onClick={() => onImageRefClick(imageId)}
        title="Open in Reference Board"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: "#1e1e1e", border: "1px solid #333", borderRadius: 5,
          padding: "2px 8px 2px 3px", cursor: "pointer", userSelect: "none",
          verticalAlign: "middle", transition: "border-color 0.15s",
        }}
      >
        {thumb ? (
          <img src={thumb} style={{ height: 26, width: "auto", maxWidth: 40, objectFit: "cover", borderRadius: 3, display: "block" }} />
        ) : (
          <div style={{ width: 26, height: 26, background: "#2a2a2a", borderRadius: 3, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 11, color: "#7dd3fc", whiteSpace: "nowrap" }}>Ref Board</span>
        <ExternalLink size={10} style={{ color: "#404040", flexShrink: 0 }} />
      </span>
    </NodeViewWrapper>
  );
}

// Inline atom node — stored as <span data-image-id="...">
const ImageRef = TipTapNode.create({
  name: "imageRef",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      imageId: {
        default: null,
        parseHTML: el => el.getAttribute("data-image-id"),
        renderHTML: attrs => ({ "data-image-id": attrs.imageId }),
      },
    };
  },

  parseHTML() { return [{ tag: "span[data-image-id]" }]; },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({ class: "gdd-image-ref" }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageRefNodeView);
  },
});

// Picker popup — reads from RefBoard's localStorage, shows thumbnails
function ImagePicker({ pos, onSelect, onClose }: {
  pos: { x: number; y: number };
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<Array<{ id: string; src: string }>>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("gameref_refboard_v1");
      if (raw) setImages(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const clamped = clampToViewport(pos.x, pos.y, 304, 360);

  return (
    <div
      ref={ref}
      onMouseDown={e => e.preventDefault()}
      style={{
        position: "fixed", left: clamped.x, top: clamped.y, zIndex: 300,
        width: 304, background: "#1e1e1e", border: "1px solid #333",
        borderRadius: 7, boxShadow: "0 8px 28px rgba(0,0,0,0.6)", overflow: "hidden",
      }}
    >
      <div style={{ padding: "7px 12px 5px", fontSize: 10.5, color: "#525252", letterSpacing: "0.07em", fontWeight: 600 }}>
        INSERT IMAGE REFERENCE
      </div>
      {images.length === 0 ? (
        <div style={{ padding: "4px 12px 12px", fontSize: 12, color: "#404040" }}>
          No images on the Reference Board yet.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "4px 10px 10px" }}>
          {images.map(img => (
            <button
              key={img.id}
              onClick={() => onSelect(img.id)}
              style={{
                padding: 0, background: "#2a2a2a", border: "1px solid #333",
                borderRadius: 5, cursor: "pointer", overflow: "hidden",
                transition: "border-color 0.15s",
              }}
            >
              <img src={img.src} style={{ width: "100%", height: 62, objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type GDDPage = { id: string; title: string; content: string };
type GDDData  = { pages: GDDPage[]; activeId: string };

// ── Storage ───────────────────────────────────────────────────────────────────

function defaultData(): GDDData {
  return { pages: [{ id: "home", title: "Home", content: "" }], activeId: "home" };
}

function loadData(): GDDData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed.pages) {
      return { pages: [{ id: "home", title: "Home", content: typeof parsed === "string" ? parsed : "" }], activeId: "home" };
    }
    return parsed as GDDData;
  } catch { return defaultData(); }
}

function saveData(data: GDDData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch { console.warn("GameRef: localStorage full — GDD may not persist."); }
}

// ── Breadcrumb helpers ────────────────────────────────────────────────────────

/** Pull every data-page-id value out of a page's saved HTML. */
function extractLinkedIds(html: string): string[] {
  const ids: string[] = [];
  const re = /data-page-id="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) ids.push(m[1]);
  return [...new Set(ids)];
}

/**
 * BFS from `fromId` through the page link graph to find the shortest path
 * to `toId`. Returns the full path (including both endpoints) or null if
 * the target is unreachable.
 */
function findBreadcrumbPath(pages: GDDPage[], fromId: string, toId: string): string[] | null {
  if (fromId === toId) return [fromId];

  const adj: Record<string, string[]> = {};
  for (const p of pages) adj[p.id] = extractLinkedIds(p.content);

  const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];
  const visited = new Set([fromId]);

  while (queue.length) {
    const { id, path } = queue.shift()!;
    for (const nextId of adj[id] ?? []) {
      if (nextId === toId) return [...path, nextId];
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push({ id: nextId, path: [...path, nextId] });
      }
    }
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Keep a popup within the viewport. width/height are rough estimates. */
function clampToViewport(x: number, y: number, w = 210, h = 260) {
  return {
    x: Math.min(x, window.innerWidth  - w - 8),
    y: Math.min(y, window.innerHeight - h - 8),
  };
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolBtn({ onClick, active, disabled, title, children }: {
  onClick: () => void; active?: boolean; disabled?: boolean;
  title: string; children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); if (!disabled) onClick(); }}
      title={title}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: 4, border: "none",
        cursor: disabled ? "default" : "pointer",
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        color: disabled ? "#404040" : active ? "#e5e5e5" : "#737373",
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

// ── Page picker popup ─────────────────────────────────────────────────────────

function PagePicker({ pos, pages, currentId, onSelect, onUnlink, canUnlink, onClose }: {
  pos: { x: number; y: number };
  pages: GDDPage[];
  currentId: string;
  onSelect: (id: string) => void;
  onUnlink: () => void;
  canUnlink: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const others = pages.filter(p => p.id !== currentId);

  // Close on outside mousedown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const clamped = clampToViewport(pos.x, pos.y);

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", width: "100%",
    padding: "0 12px", height: 32, background: "none", border: "none",
    cursor: "pointer", color: "#c4c4c4", fontSize: 13, textAlign: "left",
    gap: 8,
  };

  return (
    <div
      ref={ref}
      onMouseDown={e => e.preventDefault()}
      style={{
        position: "fixed", left: clamped.x, top: clamped.y, zIndex: 300,
        minWidth: 200, background: "#1e1e1e", border: "1px solid #333",
        borderRadius: 7, boxShadow: "0 8px 28px rgba(0,0,0,0.6)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "7px 12px 5px", fontSize: 10.5, color: "#525252", letterSpacing: "0.07em", fontWeight: 600 }}>
        LINK TO PAGE
      </div>

      {others.length === 0 ? (
        <div style={{ padding: "4px 12px 10px", fontSize: 12, color: "#404040" }}>
          No other pages yet.
        </div>
      ) : (
        <div style={{ paddingBottom: 4 }}>
          {others.map(page => (
            <button key={page.id} style={rowStyle} onClick={() => onSelect(page.id)}>
              <Link2 size={13} style={{ flexShrink: 0, color: "#525252" }} />
              {page.title}
            </button>
          ))}
        </div>
      )}

      {canUnlink && (
        <>
          <div style={{ borderTop: "1px solid #2a2a2a" }} />
          <button style={{ ...rowStyle, color: "#f87171", paddingTop: 2, paddingBottom: 2 }} onClick={onUnlink}>
            <Link2Off size={13} style={{ flexShrink: 0 }} />
            Remove link
          </button>
        </>
      )}
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

export default function GDDEditor({ onImageRefClick }: {
  onImageRefClick?: (imageId: string) => void;
}) {
  const [pages, setPages]         = useState<GDDPage[]>(() => defaultData().pages);
  const [activeId, setActiveId]   = useState<string>("home");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renamingId, setRenamingId]     = useState<string | null>(null);
  const [renameValue, setRenameValue]   = useState("");
  const [pickerPos, setPickerPos]       = useState<{ x: number; y: number } | null>(null);
  const [imgPickerPos, setImgPickerPos] = useState<{ x: number; y: number } | null>(null);

  const activeIdRef    = useRef(activeId);
  const pagesRef       = useRef(pages);
  const isSwitching    = useRef(false);
  const hasLoaded      = useRef(false);
  const dropdownRef    = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const linkBtnRef     = useRef<HTMLButtonElement>(null);
  const imgBtnRef      = useRef<HTMLButtonElement>(null);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  // ── Editor instance ─────────────────────────────────────────────────────────

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Placeholder.configure({ placeholder: "Start writing…" }),
      PageLink,
      ImageRef,
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
    editorProps: {
      attributes: { class: "gdd-editor" },
      handleDOMEvents: {
        click(view, event) {
          const el = (event.target as HTMLElement).closest("[data-page-id]") as HTMLElement | null;
          const pageId = el?.getAttribute("data-page-id");
          if (pageId) {
            switchPageRef.current(pageId);
            return true;
          }
          return false;
        },
      },
    },
  });

  // Load from storage once editor is ready
  useEffect(() => {
    if (!editor || hasLoaded.current) return;
    hasLoaded.current = true;
    const loaded = loadData();
    const homePage = loaded.pages.find(p => p.id === "home");
    isSwitching.current = true;
    editor.commands.setContent(homePage?.content ?? "");
    requestAnimationFrame(() => { isSwitching.current = false; });
    setPages(loaded.pages);
    setActiveId("home");
  }, [editor]);

  // Intercept clicks on internal page links
  const switchPageRef = useRef<(id: string) => void>(() => {});

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // Close pages dropdown on outside click
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
    setPages(prev => { saveData({ pages: prev, activeId: id }); return prev; });
    setDropdownOpen(false);
    setRenamingId(null);
    setPickerPos(null);
  };
  switchPageRef.current = switchPage;

  const addPage = () => {
    const newPage: GDDPage = { id: crypto.randomUUID(), title: `Page ${pagesRef.current.length + 1}`, content: "" };
    isSwitching.current = true;
    editor?.commands.setContent("");
    requestAnimationFrame(() => { isSwitching.current = false; });
    setPages(prev => { const next = [...prev, newPage]; saveData({ pages: next, activeId: newPage.id }); return next; });
    setActiveId(newPage.id);
    setRenamingId(newPage.id);
    setRenameValue(newPage.title);
    setDropdownOpen(true);
  };

  const commitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) setPages(prev => { const next = prev.map(p => p.id === id ? { ...p, title: trimmed } : p); saveData({ pages: next, activeId: activeIdRef.current }); return next; });
    setRenamingId(null);
  };

  const deletePage = (id: string) => {
    if (id === "home") return;
    const nextPages = pagesRef.current.filter(p => p.id !== id);
    let nextActiveId = activeIdRef.current;
    if (nextActiveId === id) {
      nextActiveId = "home";
      const home = nextPages.find(p => p.id === "home");
      isSwitching.current = true;
      editor?.commands.setContent(home?.content ?? "");
      requestAnimationFrame(() => { isSwitching.current = false; });
      setActiveId("home");
    }
    setPages(nextPages);
    saveData({ pages: nextPages, activeId: nextActiveId });
  };

  // ── Link actions ────────────────────────────────────────────────────────────

  const openPickerFromToolbar = () => {
    if (!editor) return;
    // If cursor is inside a page link with no selection, just unlink
    if (editor.isActive("pageLink") && editor.state.selection.empty) {
      editor.chain().focus().unsetMark("pageLink").run();
      return;
    }
    if (editor.state.selection.empty && !editor.isActive("pageLink")) return;
    const rect = linkBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPickerPos({ x: rect.left, y: rect.bottom + 6 });
  };

  const applyPageLink = (pageId: string) => {
    editor?.chain().focus().setMark("pageLink", { pageId }).run();
    setPickerPos(null);
  };

  const removeLink = () => {
    editor?.chain().focus().unsetMark("pageLink").run();
    setPickerPos(null);
  };

  const openImagePicker = () => {
    const rect = imgBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setImgPickerPos({ x: rect.left, y: rect.bottom + 6 });
  };

  const insertImageRef = (imageId: string) => {
    editor?.chain().focus().insertContent({ type: "imageRef", attrs: { imageId } }).run();
    setImgPickerPos(null);
  };

  // Right-click on editor: open page picker when text is selected
  const handleEditorContextMenu = (e: React.MouseEvent) => {
    if (!editor || editor.state.selection.empty) return;
    e.preventDefault();
    setPickerPos({ x: e.clientX, y: e.clientY });
  };

  // ── Breadcrumbs ─────────────────────────────────────────────────────────────

  // BFS from Home each time pages or activeId changes. Null = unreachable/Home.
  const breadcrumbPath = useMemo(() => {
    if (activeId === "home") return null;
    return findBreadcrumbPath(pages, "home", activeId);
  }, [pages, activeId]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!editor) return null;

  const activePage   = pages.find(p => p.id === activeId);
  const hasSelection = !editor.state.selection.empty;
  const isLinked     = editor.isActive("pageLink");
  const linkBtnActive = isLinked;
  const linkBtnDisabled = !hasSelection && !isLinked;

  return (
    <GDDImageContext.Provider value={{ onImageRefClick: onImageRefClick ?? (() => {}) }}>
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
        {/* Formatting */}
        <ToolBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={16} /></ToolBtn>
        <ToolBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></ToolBtn>
        <ToolBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></ToolBtn>
        <Divider />
        <ToolBtn title="Bold"          active={editor.isActive("bold")}      onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolBtn>
        <ToolBtn title="Italic"        active={editor.isActive("italic")}    onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolBtn>
        <ToolBtn title="Underline"     active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolBtn>
        <ToolBtn title="Strikethrough" active={editor.isActive("strike")}    onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></ToolBtn>
        <Divider />
        <ToolBtn title="Bullet list"   active={editor.isActive("bulletList")}  onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolBtn>
        <ToolBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolBtn>
        <Divider />
        <ToolBtn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={15} /></ToolBtn>
        <Divider />

        {/* Link to page */}
        <button
          ref={linkBtnRef}
          onMouseDown={e => { e.preventDefault(); openPickerFromToolbar(); }}
          title={isLinked ? "Remove link / change link" : "Link to page"}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: 4, border: "none",
            cursor: linkBtnDisabled ? "default" : "pointer",
            background: linkBtnActive ? "rgba(125,211,252,0.15)" : "transparent",
            color: linkBtnDisabled ? "#404040" : linkBtnActive ? "#7dd3fc" : "#737373",
            transition: "background 0.1s, color 0.1s",
          }}
        >
          <Link2 size={15} />
        </button>

        <Divider />

        {/* Insert image reference */}
        <button
          ref={imgBtnRef}
          onMouseDown={e => { e.preventDefault(); openImagePicker(); }}
          title="Insert Reference Board image"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: 4, border: "none",
            cursor: "pointer", background: "transparent", color: "#737373",
            transition: "background 0.1s, color 0.1s",
          }}
        >
          <ImageIcon size={15} />
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Pages dropdown */}
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
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{activePage?.title ?? "Home"}</span>
            <ChevronDown size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
          </button>

          {dropdownOpen && (
            <div
              onMouseDown={e => e.preventDefault()}
              style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)",
                minWidth: 200, maxWidth: 280, background: "#1e1e1e",
                border: "1px solid #333", borderRadius: 7,
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)", overflow: "hidden", zIndex: 100,
              }}
            >
              <div style={{ padding: "4px 0" }}>
                {pages.map(page => {
                  const isActive   = page.id === activeId;
                  const isRenaming = renamingId === page.id;
                  return (
                    <div key={page.id} style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 6px 0 10px", height: 34, background: isActive ? "rgba(255,255,255,0.06)" : "transparent" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: isActive ? "#737373" : "transparent", marginRight: 4 }} />
                      {isRenaming ? (
                        <>
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") commitRename(page.id); if (e.key === "Escape") setRenamingId(null); }}
                            style={{ flex: 1, minWidth: 0, background: "#2a2a2a", border: "1px solid #444", borderRadius: 3, color: "#e5e5e5", fontSize: 13, padding: "2px 6px", outline: "none" }}
                          />
                          <button onClick={() => commitRename(page.id)} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "#4ade80", display: "flex", alignItems: "center", borderRadius: 3, flexShrink: 0 }}>
                            <Check size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => switchPage(page.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", color: isActive ? "#e5e5e5" : "#a3a3a3", fontSize: 13, padding: "0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {page.title}
                          </button>
                          {page.id !== "home" && (
                            <>
                              <button onClick={() => { setRenamingId(page.id); setRenameValue(page.title); }} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "#525252", display: "flex", alignItems: "center", borderRadius: 3, flexShrink: 0 }} title="Rename page"><Pencil size={12} /></button>
                              <button onClick={() => deletePage(page.id)} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "#525252", display: "flex", alignItems: "center", borderRadius: 3, flexShrink: 0 }} title="Delete page"><X size={12} /></button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ borderTop: "1px solid #2a2a2a" }}>
                <button onClick={addPage} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "0 10px", height: 34, background: "none", border: "none", cursor: "pointer", color: "#737373", fontSize: 13 }}>
                  <Plus size={13} /> New Page
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Breadcrumbs */}
      {breadcrumbPath && breadcrumbPath.length > 1 && (
        <div style={{
          flexShrink: 0,
          borderBottom: "1px solid #1f1f1f",
          background: "#171717",
        }}>
          <div style={{
            maxWidth: 760, margin: "0 auto", padding: "0 32px",
            height: 30, display: "flex", alignItems: "center", gap: 4,
          }}>
            {breadcrumbPath.map((id, i) => {
              const page = pages.find(p => p.id === id);
              const isLast = i === breadcrumbPath.length - 1;
              return (
                <span key={id} style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                  {i > 0 && (
                    <span style={{ color: "#303030", fontSize: 11, flexShrink: 0 }}>›</span>
                  )}
                  {isLast ? (
                    <span style={{ fontSize: 12, color: "#4a4a4a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {page?.title}
                    </span>
                  ) : (
                    <button
                      onClick={() => switchPage(id)}
                      style={{
                        fontSize: 12, background: "none", border: "none",
                        cursor: "pointer", color: "#525252", padding: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                    >
                      {page?.title}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Editor content */}
      <div
        style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "32px 0" }}
        onContextMenu={handleEditorContextMenu}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 32px" }}>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Page picker popup */}
      {pickerPos && (
        <PagePicker
          pos={pickerPos}
          pages={pages}
          currentId={activeId}
          onSelect={applyPageLink}
          onUnlink={removeLink}
          canUnlink={isLinked}
          onClose={() => setPickerPos(null)}
        />
      )}

      {/* Image picker popup */}
      {imgPickerPos && (
        <ImagePicker
          pos={imgPickerPos}
          onSelect={insertImageRef}
          onClose={() => setImgPickerPos(null)}
        />
      )}

      <style>{`
        .gdd-editor {
          outline: none; color: #d4d4d4; font-family: inherit;
          font-size: 15px; line-height: 1.75; caret-color: #d4d4d4; min-height: 100%;
        }
        .gdd-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder); color: #404040;
          pointer-events: none; float: left; height: 0;
        }
        .gdd-editor h1 { font-size: 2em; font-weight: 700; color: #f5f5f5; margin: 1.4em 0 0.5em; line-height: 1.2; border-bottom: 1px solid #2a2a2a; padding-bottom: 0.3em; }
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
        .gdd-editor code { background: #2a2a2a; color: #86efac; border-radius: 3px; padding: 1px 5px; font-size: 0.88em; font-family: 'Menlo', 'Consolas', monospace; }
        .gdd-editor pre { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 6px; padding: 14px 16px; overflow-x: auto; margin: 1em 0; }
        .gdd-editor pre code { background: none; padding: 0; color: #86efac; font-size: 0.88em; }
        .gdd-editor blockquote { border-left: 3px solid #404040; margin: 1em 0; padding: 0.2em 0 0.2em 1em; color: #a3a3a3; }

        /* Internal page links (span, no href — safe from browser navigation) */
        .gdd-editor span.gdd-page-link {
          color: #7dd3fc;
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-color: rgba(125,211,252,0.4);
          cursor: pointer;
          transition: color 0.1s;
        }
        .gdd-editor span.gdd-page-link:hover {
          color: #bae6fd;
          text-decoration-color: rgba(186,230,253,0.5);
        }
      `}</style>
    </div>
    </GDDImageContext.Provider>
  );
}
