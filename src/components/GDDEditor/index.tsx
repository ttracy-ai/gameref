"use client";

// GDDEditor — top-level component.
// Manages page list state, DB load/sync, and page CRUD.
// Delegates all rendering to CollaborativePageRoom (PageEditor.tsx).

import { useCallback, useEffect, useRef, useState } from "react";
import { loadCanvasData, syncCanvasData } from "@/lib/canvasStorage";
import { CollaborativePageRoom, GDDPage, GDDData } from "./PageEditor";
import CanvasLoader from "@/components/CanvasLoader";


// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultData(): GDDData {
  return { pages: [{ id: "home", title: "Home", content: "" }], activeId: "home" };
}

function loadLocalData(storageKey: string): GDDData {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed.pages) {
      return { pages: [{ id: "home", title: "Home", content: typeof parsed === "string" ? parsed : "" }], activeId: "home" };
    }
    return parsed as GDDData;
  } catch { return defaultData(); }
}

// ── GDDEditor ─────────────────────────────────────────────────────────────────

export default function GDDEditor({ projectId, onImageRefClick }: {
  projectId: string;
  onImageRefClick?: (imageId: string) => void;
}) {
  const storageKey  = `gameref_gdd_${projectId}_v1`;
  const refboardKey = `gameref_refboard_${projectId}_v1`;

  const [pages, setPages]             = useState<GDDPage[]>(() => defaultData().pages);
  const [activeId, setActiveId]       = useState<string>("home");
  const [hasDbLoaded, setHasDbLoaded] = useState(false);
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [renamingId, setRenamingId]       = useState<string | null>(null);
  const [renameValue, setRenameValue]     = useState("");

  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Load from DB (or localStorage fallback) once on mount
  useEffect(() => {
    (async () => {
      const dbData = await loadCanvasData(projectId, "gdd");
      if (dbData) {
        const loaded = dbData as GDDData;
        try { localStorage.setItem(storageKey, JSON.stringify(loaded)); } catch {}
        setPages(loaded.pages);
        setActiveId(loaded.activeId ?? "home");
      } else {
        const loaded = loadLocalData(storageKey);
        setPages(loaded.pages);
        setActiveId(loaded.activeId ?? "home");
        if (loaded.pages.some(p => p.content)) {
          syncCanvasData(projectId, "gdd", loaded);
        }
      }
      setHasDbLoaded(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Page actions ─────────────────────────────────────────────────────────────

  const switchPage = (id: string) => {
    if (id === activeId) { setDropdownOpen(false); return; }
    setActiveId(id);
    setDropdownOpen(false);
    setRenamingId(null);
    setPages(prev => { syncCanvasData(projectId, "gdd", { pages: prev, activeId: id }); return prev; });
  };

  const addPage = () => {
    const newPage: GDDPage = { id: crypto.randomUUID(), title: `Page ${pages.length + 1}`, content: "" };
    setPages(prev => {
      const next = [...prev, newPage];
      syncCanvasData(projectId, "gdd", { pages: next, activeId: newPage.id });
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
        syncCanvasData(projectId, "gdd", { pages: next, activeId: activeIdRef.current });
        return next;
      });
    }
    setRenamingId(null);
  };

  const deletePage = (id: string) => {
    if (id === "home") return;
    const nextActiveId = activeId === id ? "home" : activeId;
    if (activeId === id) setActiveId("home");
    setPages(prev => {
      const next = prev.filter(p => p.id !== id);
      syncCanvasData(projectId, "gdd", { pages: next, activeId: nextActiveId });
      return next;
    });
  };

  // Relayed from CollaborativePageEditor; keeps pages[] in sync for breadcrumbs + DB backup
  const handleContentChange = useCallback((pid: string, html: string) => {
    setPages(prev => {
      const next = prev.map(p => p.id === pid ? { ...p, content: html } : p);
      syncCanvasData(projectId, "gdd", { pages: next, activeId: activeIdRef.current });
      return next;
    });
  }, [projectId]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!hasDbLoaded) return <CanvasLoader />;

  return (
    <CollaborativePageRoom
      key={`${projectId}-${activeId}`}
      projectId={projectId}
      pageId={activeId}
      pages={pages}
      activeId={activeId}
      initialHtml={pages.find(p => p.id === activeId)?.content ?? ""}
      dropdownOpen={dropdownOpen}
      setDropdownOpen={setDropdownOpen}
      renamingId={renamingId}
      setRenamingId={setRenamingId}
      renameValue={renameValue}
      setRenameValue={setRenameValue}
      onSwitchPage={switchPage}
      onAddPage={addPage}
      onDeletePage={deletePage}
      onCommitRename={commitRename}
      onContentChange={handleContentChange}
      onImageRefClick={onImageRefClick}
      refboardKey={refboardKey}
    />
  );
}
