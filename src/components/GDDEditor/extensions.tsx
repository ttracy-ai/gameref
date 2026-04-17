"use client";

// TipTap extensions and image context for the GDD editor.
// PageLink: internal page links rendered as <span data-page-id> — never <a href>.
// ImageRef: block node that renders a Reference Board image inline.
// GDDImageContext: passes onImageRefClick + refboardKey down to ImageRefNodeView.

import { createContext, useContext, useEffect, useState } from "react";
import { Mark, Node as TipTapNode, mergeAttributes } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { ExternalLink, X, Check, Maximize2, Minimize2 } from "lucide-react";


// ── Context ───────────────────────────────────────────────────────────────────

export const GDDImageContext = createContext<{
  onImageRefClick: (id: string) => void;
  refboardKey: string;
}>({
  onImageRefClick: () => {},
  refboardKey: "",
});

// ── PageLink mark ─────────────────────────────────────────────────────────────
// Renders as <span data-page-id="..."> — no <a href>, so Chrome can't follow it.
// Click handled via editorProps.handleDOMEvents.click in CollaborativePageEditor.

export const PageLink = Mark.create({
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

// ── ImageRef node ─────────────────────────────────────────────────────────────

function ImageRefNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const { onImageRefClick, refboardKey } = useContext(GDDImageContext);
  const imageId: string   = node.attrs.imageId;
  const imgHeight: number = node.attrs.imgHeight ?? 0;
  const [thumb, setThumb]                 = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(refboardKey);
      if (!raw) return;
      const imgs = JSON.parse(raw) as Array<{ id: string; src: string }>;
      const found = imgs.find(i => i.id === imageId);
      if (found) setThumb(found.src);
    } catch {}
  }, [imageId, refboardKey]);

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = imgHeight > 0 ? imgHeight : 200;
    const onMove = (ev: PointerEvent) => {
      const h = Math.max(60, Math.round(startH + (ev.clientY - startY)));
      updateAttributes({ imgHeight: h });
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const btnStyle: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer", padding: 3,
    display: "flex", alignItems: "center", color: "#525252",
    borderRadius: 3, transition: "color 0.1s",
  };

  if (imgHeight === 0) {
    return (
      <NodeViewWrapper as="div" style={{ display: "block", margin: "4px 0" }}>
        <div
          contentEditable={false}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: 5,
            padding: "2px 6px 2px 3px", userSelect: "none",
          }}
        >
          {thumb ? (
            <img src={thumb} style={{ height: 26, width: "auto", maxWidth: 40, objectFit: "cover", borderRadius: 3, display: "block" }} />
          ) : (
            <div style={{ width: 26, height: 26, background: "#2a2a2a", borderRadius: 3, flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 11, color: "#7dd3fc", whiteSpace: "nowrap" }}>Ref Board</span>
          <button onClick={() => onImageRefClick(imageId)} title="Open in Reference Board" style={btnStyle}>
            <ExternalLink size={11} />
          </button>
          <button onClick={() => updateAttributes({ imgHeight: 200 })} title="Expand image" style={btnStyle}>
            <Maximize2 size={11} />
          </button>
          {confirmDelete ? (
            <>
              <span style={{ fontSize: 10.5, color: "#f87171", whiteSpace: "nowrap" }}>Remove?</span>
              <button onClick={() => deleteNode()} style={{ ...btnStyle, color: "#f87171" }} title="Yes, remove"><Check size={11} /></button>
              <button onClick={() => setConfirmDelete(false)} style={btnStyle} title="Cancel"><X size={11} /></button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} title="Remove reference" style={{ ...btnStyle, color: "#6b2222" }}>
              <X size={11} />
            </button>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" style={{ display: "block", margin: "8px 0" }}>
      <div contentEditable={false} style={{ width: "100%", borderRadius: 6, overflow: "hidden", border: "1px solid #2a2a2a", background: "#111", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 6px 3px 10px", background: "#1a1a1a", borderBottom: "1px solid #222" }}>
          <span style={{ fontSize: 10.5, color: "#404040", letterSpacing: "0.05em", fontWeight: 600 }}>REF BOARD</span>
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={() => updateAttributes({ imgHeight: 0 })} title="Collapse to chip" style={btnStyle}><Minimize2 size={12} /></button>
            <button onClick={() => onImageRefClick(imageId)} title="Open in Reference Board" style={btnStyle}><ExternalLink size={12} /></button>
            {confirmDelete ? (
              <>
                <span style={{ fontSize: 10.5, color: "#f87171", whiteSpace: "nowrap" }}>Remove?</span>
                <button onClick={() => deleteNode()} style={{ ...btnStyle, color: "#f87171" }} title="Yes, remove"><Check size={12} /></button>
                <button onClick={() => setConfirmDelete(false)} style={btnStyle} title="Cancel"><X size={12} /></button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} title="Remove reference" style={{ ...btnStyle, color: "#6b2222" }}><X size={12} /></button>
            )}
          </div>
        </div>
        <div style={{ height: imgHeight, overflow: "hidden" }}>
          {thumb ? (
            <img src={thumb} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#1e1e1e" }} />
          )}
        </div>
        <div onPointerDown={handleResizeStart} title="Drag to resize" style={{ height: 8, background: "#1a1a1a", borderTop: "1px solid #222", cursor: "ns-resize", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 28, height: 2, background: "#333", borderRadius: 1 }} />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const ImageRef = TipTapNode.create({
  name: "imageRef",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      imageId: {
        default: null,
        parseHTML: el => el.getAttribute("data-image-id"),
        renderHTML: attrs => ({ "data-image-id": attrs.imageId }),
      },
      imgHeight: {
        default: 0,
        parseHTML: el => parseInt(el.getAttribute("data-img-height") ?? "0", 10),
        renderHTML: attrs => ({ "data-img-height": String(attrs.imgHeight) }),
      },
    };
  },

  parseHTML() { return [{ tag: "div[data-image-id]" }]; },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ class: "gdd-image-ref" }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageRefNodeView);
  },
});
