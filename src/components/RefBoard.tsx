"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { PanelRight, StickyNote, Plus, Eye, EyeOff, X, Pencil } from "lucide-react";
import { loadCanvasData, syncCanvasData } from "@/lib/canvasStorage";
import { RoomProvider, useStorage, useMutation } from "@/lib/liveblocks-canvas";
import CanvasLoader from "@/components/CanvasLoader";


// ── Types ─────────────────────────────────────────────────────────────────────

const NOTE_PALETTE = [
  { strip: "#f59e0b", body: "#fef08a" },
  { strip: "#f472b6", body: "#fce7f3" },
  { strip: "#60a5fa", body: "#dbeafe" },
  { strip: "#4ade80", body: "#dcfce7" },
  { strip: "#c084fc", body: "#f3e8ff" },
  { strip: "#fb923c", body: "#ffedd5" },
];

type ImageNote = {
  id: string; text: string; fx: number; fy: number; colorIdx: number;
};

type PlacedImage = {
  id: string; src: string;
  x: number; y: number; width: number; height: number;
  notes: ImageNote[];
};

type RefBoardPage = {
  id: string;
  title: string;
  images: PlacedImage[];
};

type RefBoardData = {
  pages: RefBoardPage[];
};

type MoveOp   = { kind: "move";   startX: number; startY: number; origPositions: Record<string, { x: number; y: number }> };
type ResizeOp = { kind: "resize"; startX: number; groupLeft: number; groupTop: number; groupOrigWidth: number; origSizes: Record<string, { x: number; y: number; width: number; height: number }> };
type BoxOp    = { kind: "box";    startX: number; startY: number };
type ActiveOp = MoveOp | ResizeOp | BoxOp;
type BoxState = { startX: number; startY: number; currentX: number; currentY: number } | null;
type NoteMode = "overlay" | "panel";


// ── Helpers ───────────────────────────────────────────────────────────────────

function getScaledSize(nW: number, nH: number, cW: number, cH: number) {
  const maxW = cW * 0.45, maxH = cH * 0.45, minDim = 180;
  let w = nW, h = nH;
  if (w > maxW || h > maxH) { const s = Math.min(maxW / w, maxH / h); w *= s; h *= s; }
  if (Math.max(w, h) < minDim) { const s = minDim / Math.max(w, h); w *= s; h *= s; }
  return { width: Math.round(w), height: Math.round(h) };
}

function normalizeBox(b: NonNullable<BoxState>) {
  return { x: Math.min(b.startX, b.currentX), y: Math.min(b.startY, b.currentY), w: Math.abs(b.currentX - b.startX), h: Math.abs(b.currentY - b.startY) };
}

function boxIntersects(img: PlacedImage, box: { x: number; y: number; w: number; h: number }) {
  return img.x < box.x + box.w && img.x + img.width > box.x && img.y < box.y + box.h && img.y + img.height > box.y;
}

function groupBoundsOf(imgs: PlacedImage[]) {
  if (imgs.length === 0) return null;
  return {
    x: Math.min(...imgs.map(i => i.x)), y: Math.min(...imgs.map(i => i.y)),
    width:  Math.max(...imgs.map(i => i.x + i.width))  - Math.min(...imgs.map(i => i.x)),
    height: Math.max(...imgs.map(i => i.y + i.height)) - Math.min(...imgs.map(i => i.y)),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateImages(raw: any[]): PlacedImage[] {
  return raw.map((img: any) => {
    if (!Array.isArray(img.notes)) {
      const notes: ImageNote[] = [];
      if (img.note) notes.push({ id: crypto.randomUUID(), text: img.note, fx: img.noteFx ?? 0.55, fy: img.noteFy ?? 0.55, colorIdx: 0 });
      const { note: _n, noteFx: _fx, noteFy: _fy, ...rest } = img;
      return { ...rest, notes };
    }
    return img as PlacedImage;
  });
}

function toRefBoardData(raw: unknown): RefBoardData {
  // Old format: PlacedImage[] — migrate to single default page
  if (Array.isArray(raw)) {
    return { pages: [{ id: "default", title: "Page 1", images: migrateImages(raw) }] };
  }
  const data = raw as Partial<RefBoardData>;
  if (!data.pages || !Array.isArray(data.pages)) {
    return { pages: [{ id: "default", title: "Page 1", images: [] }] };
  }
  return { pages: data.pages.map(p => ({ ...p, images: migrateImages(p.images ?? []) })) };
}

function allImages(data: RefBoardData): PlacedImage[] {
  return data.pages.flatMap(p => p.images);
}


// ── GrowTextarea ──────────────────────────────────────────────────────────────

function GrowTextarea({ value, onChange, placeholder, style }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string; style?: React.CSSProperties;
}) {
  const shared: React.CSSProperties = {
    fontFamily: "inherit", fontSize: style?.fontSize ?? 13,
    lineHeight: style?.lineHeight ?? 1.6, padding: style?.padding ?? "8px 10px",
    whiteSpace: "pre-wrap", wordBreak: "break-word", width: "100%", boxSizing: "border-box",
  };
  return (
    <div style={{ position: "relative", minHeight: 64 }}>
      <div aria-hidden style={{ ...shared, visibility: "hidden", minHeight: 64 }}>{value + "\u200b"}</div>
      <textarea value={value} onChange={onChange} placeholder={placeholder}
        style={{ ...style, ...shared, position: "absolute", inset: 0, height: "100%", resize: "none", overflow: "hidden", border: "none", outline: "none" }} />
    </div>
  );
}


// ── PageTab ───────────────────────────────────────────────────────────────────

function PageTab({ page, isActive, canDelete, onSwitch, onDelete, onRename }: {
  page: RefBoardPage; isActive: boolean; canDelete: boolean;
  onSwitch: () => void; onDelete: () => void; onRename: (title: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue]       = useState(page.title);

  function commit() {
    const trimmed = value.trim();
    onRename(trimmed || page.title);
    setValue(trimmed || page.title);
    setRenaming(false);
  }

  if (renaming) {
    return (
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setValue(page.title); setRenaming(false); }
        }}
        autoFocus
        className="shrink-0 h-7 px-2 text-xs bg-neutral-700 text-neutral-100 rounded outline-none border border-neutral-500"
        style={{ width: Math.max(60, value.length * 8 + 16) }}
      />
    );
  }

  return (
    <div
      onClick={onSwitch}
      className={`group shrink-0 flex items-center gap-1 px-3 h-7 rounded text-xs cursor-pointer transition-colors select-none ${
        isActive
          ? "bg-neutral-700 text-neutral-100"
          : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700/40"
      }`}
    >
      <span>{page.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); setRenaming(true); setValue(page.title); }}
        className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-neutral-300 transition-all ml-0.5 flex items-center"
        title="Rename page"
      >
        <Pencil size={10} />
      </button>
      {canDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all flex items-center"
          title="Delete page"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}


// ── Outer shell ───────────────────────────────────────────────────────────────

type RefBoardProps = {
  projectId: string;
  pendingFocusId?: string | null;
  onFocusConsumed?: () => void;
};

export default function RefBoard({ projectId, pendingFocusId, onFocusConsumed }: RefBoardProps) {
  // STORAGE_KEY: flat list of all images — read by ProgressBoard / IdeationCanvas pickers
  // BOARD_KEY:   full multi-page state — read/written only by RefBoard
  const STORAGE_KEY = `gameref_refboard_${projectId}_v1`;
  const BOARD_KEY   = `gameref_refboard_${projectId}_board_v1`;

  const [initialJson,   setInitialJson]   = useState<string | null>(null);
  const [initialPageId, setInitialPageId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const dbData = await loadCanvasData(projectId, "refboard");
      if (dbData) {
        const data = toRefBoardData(dbData);
        try { localStorage.setItem(BOARD_KEY,   JSON.stringify(data));          } catch {}
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allImages(data))); } catch {}
        setInitialPageId(data.pages[0]?.id ?? "default");
        setInitialJson(JSON.stringify(data));
        return;
      }
      // New-format cache
      try {
        const boardRaw = localStorage.getItem(BOARD_KEY);
        if (boardRaw) {
          const data = JSON.parse(boardRaw) as RefBoardData;
          setInitialPageId(data.pages[0]?.id ?? "default");
          setInitialJson(JSON.stringify(data));
          syncCanvasData(projectId, "refboard", data);
          return;
        }
      } catch {}
      // Old-format cache — migrate
      try {
        const oldRaw = localStorage.getItem(STORAGE_KEY);
        if (oldRaw) {
          const parsed = JSON.parse(oldRaw);
          // Only treat as old format if it's a flat array (not already a board)
          if (Array.isArray(parsed)) {
            const data = toRefBoardData(parsed);
            try { localStorage.setItem(BOARD_KEY, JSON.stringify(data)); } catch {}
            setInitialPageId(data.pages[0]?.id ?? "default");
            setInitialJson(JSON.stringify(data));
            syncCanvasData(projectId, "refboard", data);
            return;
          }
        }
      } catch {}
      // Empty board
      const data: RefBoardData = { pages: [{ id: "default", title: "Page 1", images: [] }] };
      setInitialPageId("default");
      setInitialJson(JSON.stringify(data));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!initialJson) return <CanvasLoader />;

  return (
    <RoomProvider id={`refboard_${projectId}`} initialStorage={{ canvasJson: initialJson }}>
      <RefBoardInner
        key={projectId}
        projectId={projectId}
        pendingFocusId={pendingFocusId}
        onFocusConsumed={onFocusConsumed}
        initialPageId={initialPageId}
      />
    </RoomProvider>
  );
}


// ── Inner board ───────────────────────────────────────────────────────────────

function RefBoardInner({ projectId, pendingFocusId, onFocusConsumed, initialPageId }: RefBoardProps & { initialPageId: string }) {
  const STORAGE_KEY = `gameref_refboard_${projectId}_v1`;
  const BOARD_KEY   = `gameref_refboard_${projectId}_board_v1`;

  // ── All hooks declared unconditionally ───────────────────────────────────

  const canvasJson    = useStorage((root) => root.canvasJson);
  const setCanvasJson = useMutation(({ storage }, json: string) => {
    storage.set("canvasJson", json);
  }, []);

  const [activePageId, setActivePageId] = useState(initialPageId);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [boxState, setBoxState]         = useState<BoxState>(null);
  const [isDragOver, setIsDragOver]     = useState(false);
  const [isUploading, setIsUploading]   = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [shiftHeld, setShiftHeld]       = useState(false);
  const [focusedId, setFocusedId]       = useState<string | null>(null);
  const [noteMode, setNoteMode]         = useState<NoteMode>("overlay");
  const [notesVisible, setNotesVisible] = useState(true);

  const canvasRef      = useRef<HTMLDivElement>(null);
  const activeOp       = useRef<ActiveOp | null>(null);
  const imagesRef      = useRef<PlacedImage[]>([]);
  const boardRef       = useRef<RefBoardData>({ pages: [] });
  const selectedIdsRef = useRef(selectedIds);
  const activePageIdRef = useRef(activePageId);
  const focusedIdRef   = useRef<string | null>(null);
  const focusOrigRef   = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const noteDragRef    = useRef<{ startX: number; startY: number; origFx: number; origFy: number; imageId: string; noteId: string } | null>(null);

  // Derive board data and active page images
  const boardData: RefBoardData = canvasJson ? toRefBoardData(JSON.parse(canvasJson)) : { pages: [{ id: initialPageId, title: "Page 1", images: [] }] };
  // If active page was deleted by a collaborator, fall back to first page
  const activePage = boardData.pages.find(p => p.id === activePageId) ?? boardData.pages[0];
  const images: PlacedImage[] = activePage?.images ?? [];
  imagesRef.current = images;
  boardRef.current  = boardData;

  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { activePageIdRef.current = activePageId; }, [activePageId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Shift") setShiftHeld(true); };
    const up   = (e: KeyboardEvent) => { if (e.key === "Shift") setShiftHeld(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ── update: write full board data to Liveblocks + DB + both localStorage keys ──

  const updateBoard = useCallback((fn: (prev: RefBoardData) => RefBoardData) => {
    const next = fn(boardRef.current);
    const nextJson = JSON.stringify(next);
    try { localStorage.setItem(BOARD_KEY,   nextJson);                              } catch {}
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allImages(next)));       } catch {}
    syncCanvasData(projectId, "refboard", next);
    setCanvasJson(nextJson);
  }, [projectId, setCanvasJson, BOARD_KEY, STORAGE_KEY]);

  // update: image-level changes scoped to the active page
  const update = useCallback((fn: (prev: PlacedImage[]) => PlacedImage[]) => {
    updateBoard(prev => ({
      ...prev,
      pages: prev.pages.map(p =>
        p.id === activePageIdRef.current ? { ...p, images: fn(p.images) } : p
      ),
    }));
  }, [updateBoard]);

  // ── Page management ───────────────────────────────────────────────────────

  function switchPage(id: string) {
    if (id === activePageId) return;
    // Restore and unfocus any focused image
    if (focusedIdRef.current) {
      const orig = focusOrigRef.current[focusedIdRef.current];
      if (orig) {
        update(prev => prev.map(i => i.id === focusedIdRef.current ? { ...i, ...orig } : i));
        delete focusOrigRef.current[focusedIdRef.current];
      }
      focusedIdRef.current = null;
      setFocusedId(null);
      setNoteMode("overlay");
    }
    setSelectedIds(new Set());
    setActivePageId(id);
    activePageIdRef.current = id;
  }

  function addPage() {
    const newId = crypto.randomUUID();
    updateBoard(prev => ({
      ...prev,
      pages: [...prev.pages, { id: newId, title: `Page ${prev.pages.length + 1}`, images: [] }],
    }));
    switchPage(newId);
  }

  function deletePage(id: string) {
    const data = boardRef.current;
    if (data.pages.length <= 1) return;
    updateBoard(prev => ({ ...prev, pages: prev.pages.filter(p => p.id !== id) }));
    if (activePageIdRef.current === id) {
      const remaining = data.pages.filter(p => p.id !== id);
      const fallback = remaining[0]?.id ?? "";
      setActivePageId(fallback);
      activePageIdRef.current = fallback;
    }
  }

  function renamePage(id: string, title: string) {
    updateBoard(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === id ? { ...p, title } : p),
    }));
  }

  // ── Focus image ───────────────────────────────────────────────────────────

  const focusImageById = useCallback((id: string) => {
    const img = imagesRef.current.find(i => i.id === id);
    if (!img) return;

    const currentFocused = focusedIdRef.current;
    if (currentFocused && currentFocused !== id) {
      const orig = focusOrigRef.current[currentFocused];
      if (orig) {
        update(prev => prev.map(i => i.id === currentFocused ? { ...i, ...orig } : i));
        delete focusOrigRef.current[currentFocused];
      }
      setNoteMode("overlay");
    }

    focusOrigRef.current[id] = { x: img.x, y: img.y, width: img.width, height: img.height };
    focusedIdRef.current = id;
    setFocusedId(id);
    setSelectedIds(new Set());

    update(prev => {
      const target = prev.find(i => i.id === id);
      const rest = prev.filter(i => i.id !== id);
      return target ? [...rest, target] : prev;
    });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const image = new window.Image();
    image.src = img.src;
    const zoom = () => {
      let w = image.naturalWidth, h = image.naturalHeight;
      const maxW = rect.width * 0.95, maxH = rect.height * 0.95;
      if (w > maxW || h > maxH) { const s = Math.min(maxW / w, maxH / h); w = Math.round(w * s); h = Math.round(h * s); }
      update(prev => prev.map(i => i.id === id ? { ...i, x: Math.round((rect.width - w) / 2), y: Math.round((rect.height - h) / 2), width: w, height: h } : i));
    };
    if (image.complete) zoom(); else image.onload = zoom;
  }, [update]);

  useEffect(() => {
    const id = focusedIdRef.current;
    if (!id) return;
    const imgData = imagesRef.current.find(i => i.id === id);
    if (!imgData) return;
    const t = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const image = new window.Image();
      image.src = imgData.src;
      const rezoom = () => {
        let w = image.naturalWidth, h = image.naturalHeight;
        if (w > rect.width || h > rect.height) { const s = Math.min(rect.width / w, rect.height / h); w = Math.round(w * s); h = Math.round(h * s); }
        update(prev => prev.map(i => i.id === id ? { ...i, x: Math.round((rect.width - w) / 2), y: Math.round((rect.height - h) / 2), width: w, height: h } : i));
      };
      if (image.complete) rezoom(); else image.onload = rezoom;
    }, 50);
    return () => clearTimeout(t);
  }, [noteMode, update]);

  // Handle focus navigation from other canvases — find the right page first
  useEffect(() => {
    if (!pendingFocusId) return;
    const data = boardRef.current;
    const targetPage = data.pages.find(p => p.images.some(img => img.id === pendingFocusId));
    if (!targetPage) { onFocusConsumed?.(); return; }
    if (targetPage.id !== activePageIdRef.current) {
      setActivePageId(targetPage.id);
      activePageIdRef.current = targetPage.id;
    }
    const t = setTimeout(() => {
      focusImageById(pendingFocusId);
      onFocusConsumed?.();
    }, 120);
    return () => clearTimeout(t);
  }, [pendingFocusId, focusImageById, onFocusConsumed]);

  // ── Place / upload ────────────────────────────────────────────────────────

  const placeImage = useCallback((src: string, dropX: number, dropY: number, canvasRect: DOMRect) => {
    const img = new Image();
    img.src = src;
    const place = () => {
      const { width, height } = getScaledSize(img.naturalWidth, img.naturalHeight, canvasRect.width, canvasRect.height);
      update(prev => [...prev, { id: crypto.randomUUID(), src, x: Math.max(0, dropX - width / 2), y: Math.max(0, dropY - height / 2), width, height, notes: [] }]);
    };
    if (img.complete && img.naturalWidth > 0) place(); else img.onload = place;
  }, [update]);

  const uploadAndPlace = useCallback(async (file: File, dropX: number, dropY: number, canvasRect: DOMRect) => {
    setIsUploading(true); setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/refboard/upload?projectId=${projectId}`, { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json() as { url: string };
        placeImage(url, dropX, dropY, canvasRect);
      } else {
        const reader = new FileReader();
        reader.onload = () => placeImage(reader.result as string, dropX, dropY, canvasRect);
        reader.readAsDataURL(file);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => placeImage(reader.result as string, dropX, dropY, canvasRect);
      reader.readAsDataURL(file);
    } finally { setIsUploading(false); }
  }, [projectId, placeImage]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false); setUploadError(null);
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dropX = e.clientX - rect.left, dropY = e.clientY - rect.top;
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) { await uploadAndPlace(file, dropX, dropY, rect); return; }
    }
    const uriList = e.dataTransfer.getData("text/uri-list");
    const html    = e.dataTransfer.getData("text/html");
    let srcUrl: string | null = null;
    if (uriList) srcUrl = uriList.split("\n").map(u => u.trim()).find(u => u && !u.startsWith("#")) ?? null;
    if (!srcUrl && html) { const m = html.match(/src=["']([^"']+)["']/); if (m?.[1]) srcUrl = m[1]; }
    if (!srcUrl) return;
    setIsUploading(true); setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("url", srcUrl);
      const res = await fetch(`/api/refboard/upload?projectId=${projectId}`, { method: "POST", body: formData });
      if (res.ok) { const { url } = await res.json() as { url: string }; placeImage(url, dropX, dropY, rect); }
      else { const msg = await res.text(); setUploadError(`Could not add image: ${msg}`); }
    } catch { setUploadError("Could not add image: network error"); }
    finally { setIsUploading(false); }
  }, [projectId, uploadAndPlace, placeImage]);

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); if (!activeOp.current) setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== canvasRef.current) return;
    setSelectedIds(new Set());
    if (!e.shiftKey) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    activeOp.current = { kind: "box", startX: e.clientX - rect.left, startY: e.clientY - rect.top };
  }, []);

  const handleImagePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (e.ctrlKey) {
      setSelectedIds(new Set());
      if (focusedIdRef.current === id) {
        const orig = focusOrigRef.current[id];
        if (orig) { update(prev => prev.map(i => i.id === id ? { ...i, ...orig } : i)); delete focusOrigRef.current[id]; }
        focusedIdRef.current = null; setFocusedId(null); setNoteMode("overlay");
      } else { focusImageById(id); }
      return;
    }
    if (e.shiftKey) {
      setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const current = selectedIdsRef.current;
    const idsToMove = current.has(id) ? [...current] : [id];
    if (!current.has(id)) setSelectedIds(new Set([id]));
    update(prev => { const moving = prev.filter(i => idsToMove.includes(i.id)); const rest = prev.filter(i => !idsToMove.includes(i.id)); return [...rest, ...moving]; });
    const origPositions: Record<string, { x: number; y: number }> = {};
    for (const imgId of idsToMove) { const img = imagesRef.current.find(i => i.id === imgId); if (img) origPositions[imgId] = { x: img.x, y: img.y }; }
    activeOp.current = { kind: "move", startX: e.clientX, startY: e.clientY, origPositions };
  }, [update, focusImageById]);

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const selected = imagesRef.current.filter(i => selectedIdsRef.current.has(i.id));
    const bounds = groupBoundsOf(selected); if (!bounds) return;
    const origSizes: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const img of selected) origSizes[img.id] = { x: img.x, y: img.y, width: img.width, height: img.height };
    activeOp.current = { kind: "resize", startX: e.clientX, groupLeft: bounds.x, groupTop: bounds.y, groupOrigWidth: bounds.width, origSizes };
  }, []);

  // ── Notes ─────────────────────────────────────────────────────────────────

  const addNote = useCallback((imageId: string) => {
    update(prev => prev.map(img => {
      if (img.id !== imageId) return img;
      const colorIdx = img.notes.length % NOTE_PALETTE.length;
      return { ...img, notes: [...img.notes, { id: crypto.randomUUID(), text: "", fx: 0.1 + img.notes.length * 0.04, fy: 0.1 + img.notes.length * 0.04, colorIdx }] };
    }));
  }, [update]);

  const deleteNote = useCallback((imageId: string, noteId: string) => {
    update(prev => prev.map(img => img.id !== imageId ? img : { ...img, notes: img.notes.filter(n => n.id !== noteId) }));
  }, [update]);

  const handleNoteChange = useCallback((imageId: string, noteId: string, text: string) => {
    update(prev => prev.map(img => img.id !== imageId ? img : { ...img, notes: img.notes.map(n => n.id === noteId ? { ...n, text } : n) }));
  }, [update]);

  const handleNoteDragStart = useCallback((e: React.PointerEvent, imageId: string, noteId: string) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const img = imagesRef.current.find(i => i.id === imageId);
    const note = img?.notes.find(n => n.id === noteId);
    if (!note) return;
    noteDragRef.current = { startX: e.clientX, startY: e.clientY, origFx: note.fx, origFy: note.fy, imageId, noteId };
  }, []);

  const handleNoteDragMove = useCallback((e: React.PointerEvent, imageId: string, noteId: string) => {
    e.stopPropagation();
    const op = noteDragRef.current;
    if (!op || op.imageId !== imageId || op.noteId !== noteId) return;
    const img = imagesRef.current.find(i => i.id === imageId); if (!img) return;
    update(prev => prev.map(i => i.id !== imageId ? i : { ...i, notes: i.notes.map(n => n.id !== noteId ? n : { ...n, fx: Math.max(0, Math.min(0.95, op.origFx + (e.clientX - op.startX) / img.width)), fy: Math.max(0, Math.min(0.95, op.origFy + (e.clientY - op.startY) / img.height)) }) }));
  }, [update]);

  const handleNoteDragEnd = useCallback((e: React.PointerEvent) => { e.stopPropagation(); noteDragRef.current = null; }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const op = activeOp.current; if (!op) return;
    if (op.kind === "box") {
      const rect = canvasRef.current!.getBoundingClientRect();
      setBoxState({ startX: op.startX, startY: op.startY, currentX: e.clientX - rect.left, currentY: e.clientY - rect.top });
      return;
    }
    if (op.kind === "move") {
      const dx = e.clientX - op.startX, dy = e.clientY - op.startY;
      update(prev => prev.map(img => { const orig = op.origPositions[img.id]; return orig ? { ...img, x: orig.x + dx, y: orig.y + dy } : img; }));
      return;
    }
    if (op.kind === "resize") {
      const scale = Math.max(0.05, (op.groupOrigWidth + (e.clientX - op.startX)) / op.groupOrigWidth);
      update(prev => prev.map(img => { const orig = op.origSizes[img.id]; if (!orig) return img; return { ...img, x: Math.round(op.groupLeft + (orig.x - op.groupLeft) * scale), y: Math.round(op.groupTop + (orig.y - op.groupTop) * scale), width: Math.max(10, Math.round(orig.width * scale)), height: Math.max(10, Math.round(orig.height * scale)) }; }));
    }
  }, [update]);

  const handlePointerUp = useCallback(() => {
    const op = activeOp.current; activeOp.current = null;
    if (op?.kind === "box") {
      const bs = boxState; setBoxState(null); if (!bs) return;
      const box = normalizeBox(bs);
      if (box.w < 4 && box.h < 4) return;
      const hits = imagesRef.current.filter(img => boxIntersects(img, box));
      if (hits.length > 0) setSelectedIds(new Set(hits.map(i => i.id)));
    } else { setBoxState(null); }
  }, [boxState]);

  // ── Early return after all hooks ──────────────────────────────────────────
  if (!canvasJson) return <CanvasLoader />;

  // ── Derived render values ─────────────────────────────────────────────────

  const selectedImages = images.filter(img => selectedIds.has(img.id));
  const groupBounds    = groupBoundsOf(selectedImages);
  const normalizedBox  = boxState ? normalizeBox(boxState) : null;
  const PAD = 6;
  const focusedImage = focusedId ? images.find(i => i.id === focusedId) ?? null : null;

  return (
    <div className="flex flex-1 h-full overflow-hidden flex-col">

      {/* Page tab bar */}
      <div className="scrollbar-dark shrink-0 flex items-center gap-0.5 px-2 overflow-x-auto border-b border-neutral-700/60 bg-neutral-900" style={{ height: 38 }}>
        {boardData.pages.map((page) => (
          <PageTab
            key={page.id}
            page={page}
            isActive={(activePage?.id ?? "") === page.id}
            canDelete={boardData.pages.length > 1}
            onSwitch={() => switchPage(page.id)}
            onDelete={() => deletePage(page.id)}
            onRename={(title) => renamePage(page.id, title)}
          />
        ))}
        <button
          onClick={addPage}
          title="Add page"
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded text-neutral-600 hover:text-neutral-300 hover:bg-neutral-700/50 transition-colors ml-1"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Canvas row */}
      <div className="flex flex-1 overflow-hidden">
        <div
          ref={canvasRef}
          className={`relative h-full overflow-hidden transition-colors duration-150 ${isDragOver ? "bg-neutral-800" : "bg-neutral-900"}`}
          style={{ flex: noteMode === "panel" && focusedId ? "2 1 0%" : "1 1 0%" }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={e => e.preventDefault()}
        >
          {images.length === 0 && !isUploading && (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-600 select-none pointer-events-none text-sm">
              Drag images from your computer or browser to place them
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
              <div style={{ background: "rgba(20,20,20,0.85)", borderRadius: 8, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 32 32" fill="none" style={{ animation: "canvas-spin 0.9s linear infinite", flexShrink: 0 }}>
                  <circle cx="16" cy="16" r="13" stroke="#2a2a2a" strokeWidth="3" />
                  <path d="M16 3 A13 13 0 0 1 29 16" stroke="#525252" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 13, color: "#a3a3a3" }}>Uploading…</span>
              </div>
              <style>{`@keyframes canvas-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {uploadError && (
            <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 60, background: "rgba(20,20,20,0.92)", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, maxWidth: 380 }}>
              <span style={{ fontSize: 13, color: "#f87171" }}>{uploadError}</span>
              <button onClick={() => setUploadError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#737373", display: "flex", alignItems: "center", padding: 2, flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          )}

          {isDragOver && (
            <div className="absolute inset-0 border-2 border-dashed border-indigo-500 rounded pointer-events-none z-50 flex items-center justify-center">
              <span className="text-indigo-400 text-sm select-none">Drop to upload</span>
            </div>
          )}

          {normalizedBox && normalizedBox.w > 2 && (
            <div className="pointer-events-none absolute border border-green-400 bg-green-400/10 z-50"
              style={{ left: normalizedBox.x, top: normalizedBox.y, width: normalizedBox.w, height: normalizedBox.h }} />
          )}

          {images.map(img => {
            const isFocused = focusedId === img.id;
            return (
              <div key={img.id} onPointerDown={e => handleImagePointerDown(e, img.id)}
                style={{ position: "absolute", left: img.x, top: img.y, width: img.width, height: img.height, cursor: "grab", touchAction: "none", userSelect: "none" }}>
                <img src={img.src} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />

                {!isFocused && img.notes.length > 0 && (
                  <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 3, pointerEvents: "none" }}>
                    {img.notes.slice(0, 4).map((note, i) => {
                      const colors = NOTE_PALETTE[note.colorIdx % NOTE_PALETTE.length];
                      return (
                        <div key={note.id} style={{ width: 13, height: 16, display: "flex", flexDirection: "column", boxShadow: "1px 2px 3px rgba(0,0,0,0.5)", transform: `rotate(${i % 2 === 0 ? 4 : -3}deg)` }}>
                          <div style={{ background: colors.strip, height: 4, flexShrink: 0 }} />
                          <div style={{ background: colors.body, flex: 1 }} />
                        </div>
                      );
                    })}
                  </div>
                )}

                {isFocused && (
                  <div onPointerDown={e => e.stopPropagation()} style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, zIndex: 45 }}>
                    {img.notes.length > 0 && (
                      <>
                        <button onClick={() => setNotesVisible(v => !v)} title={notesVisible ? "Hide notes" : "Show notes"}
                          style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(30,30,30,0.75)", border: "1px solid rgba(255,255,255,0.15)", color: "#e5e5e5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(4px)" }}>
                          {notesVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button onClick={() => setNoteMode("panel")} title="Expand to panel"
                          style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(30,30,30,0.75)", border: "1px solid rgba(255,255,255,0.15)", color: "#e5e5e5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(4px)" }}>
                          <PanelRight size={15} />
                        </button>
                      </>
                    )}
                    <button onClick={() => addNote(img.id)} title="Add note"
                      style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(30,30,30,0.75)", border: "1px solid rgba(255,255,255,0.15)", color: "#e5e5e5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(4px)" }}>
                      <Plus size={16} />
                    </button>
                    <button onClick={() => {
                      const orig = focusOrigRef.current[img.id];
                      if (orig) { update(prev => prev.map(i => i.id === img.id ? { ...i, ...orig } : i)); delete focusOrigRef.current[img.id]; }
                      focusedIdRef.current = null; setFocusedId(null); setNoteMode("overlay");
                    }} title="Unfocus"
                      style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(30,30,30,0.75)", border: "1px solid rgba(255,255,255,0.15)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(4px)" }}>
                      <X size={15} />
                    </button>
                  </div>
                )}

                {isFocused && noteMode === "overlay" && notesVisible && img.notes.map(note => {
                  const colors = NOTE_PALETTE[note.colorIdx % NOTE_PALETTE.length];
                  return (
                    <div key={note.id} onPointerDown={e => e.stopPropagation()}
                      style={{ position: "absolute", left: note.fx * img.width, top: note.fy * img.height, width: 220, display: "flex", flexDirection: "column", boxShadow: "4px 5px 16px rgba(0,0,0,0.6), 1px 1px 4px rgba(0,0,0,0.2)", transform: "rotate(-1.5deg)", zIndex: 40 }}>
                      <svg width="22" height="22" viewBox="0 0 22 22" style={{ position: "absolute", top: -18, left: -18, pointerEvents: "none", filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.4))" }}>
                        <polygon points="0,0 22,0 0,22" fill={colors.strip} />
                      </svg>
                      <div onPointerDown={e => handleNoteDragStart(e, img.id, note.id)} onPointerMove={e => handleNoteDragMove(e, img.id, note.id)} onPointerUp={handleNoteDragEnd}
                        style={{ background: colors.strip, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6, cursor: "grab" }}>
                        <button onPointerDown={e => e.stopPropagation()} onClick={() => setNoteMode("panel")} title="Expand to panel"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 3, display: "flex", alignItems: "center", color: "rgba(0,0,0,0.5)", borderRadius: 3 }}>
                          <PanelRight size={14} />
                        </button>
                        <button onPointerDown={e => e.stopPropagation()} onClick={() => deleteNote(img.id, note.id)} title="Delete note"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 3, display: "flex", alignItems: "center", color: "rgba(0,0,0,0.5)", borderRadius: 3 }}>
                          <X size={14} />
                        </button>
                      </div>
                      <div style={{ background: colors.body, padding: "8px 10px 26px", position: "relative" }}>
                        <textarea autoFocus={note.text === ""} value={note.text} onChange={e => handleNoteChange(img.id, note.id, e.target.value)} placeholder="Add a note…" rows={5}
                          style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontFamily: "inherit", fontSize: 13, color: "#1c1917", lineHeight: 1.6, padding: 0 }} />
                        <div style={{ position: "absolute", bottom: 0, right: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 0 22px 22px", borderColor: "transparent transparent #171717 transparent", filter: "drop-shadow(-1px -1px 2px rgba(0,0,0,0.25))" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {groupBounds && (
            <div style={{ position: "absolute", left: groupBounds.x - PAD, top: groupBounds.y - PAD, width: groupBounds.width + PAD * 2, height: groupBounds.height + PAD * 2, border: "2px solid #22c55e", pointerEvents: "none", zIndex: 30 }}>
              {shiftHeld && (
                <div onPointerDown={handleResizePointerDown} style={{ position: "absolute", bottom: -7, right: -7, width: 14, height: 14, background: "#22c55e", border: "2px solid #15803d", borderRadius: 2, cursor: "se-resize", pointerEvents: "auto" }} />
              )}
            </div>
          )}
        </div>

        {noteMode === "panel" && focusedImage && (
          <div onPointerDown={e => e.stopPropagation()} style={{ flex: "1 1 0%", display: "flex", flexDirection: "column", borderLeft: "1px solid #404040", overflow: "hidden", background: "#1a1a1a" }}>
            <div style={{ height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", borderBottom: "1px solid #404040" }}>
              <span style={{ fontSize: 11, color: "#737373", letterSpacing: "0.06em", fontWeight: 600 }}>NOTES</span>
              <button onClick={() => setNoteMode("overlay")} title="Switch to overlay view" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: "#737373", borderRadius: 3 }}>
                <StickyNote size={15} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12 }}>
              {focusedImage.notes.length === 0 && (
                <p style={{ fontSize: 12, color: "#525252", textAlign: "center", marginTop: 24 }}>No notes yet. Click + to add one.</p>
              )}
              {focusedImage.notes.map(note => {
                const colors = NOTE_PALETTE[note.colorIdx % NOTE_PALETTE.length];
                return (
                  <div key={note.id} style={{ borderRadius: 2, overflow: "hidden", boxShadow: "2px 3px 8px rgba(0,0,0,0.4)", marginBottom: 10 }}>
                    <div style={{ background: colors.strip, height: 26, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4 }}>
                      <button onClick={() => deleteNote(focusedImage.id, note.id)} title="Delete note" style={{ background: "none", border: "none", cursor: "pointer", padding: 3, display: "flex", alignItems: "center", color: "rgba(0,0,0,0.45)", borderRadius: 3 }}>
                        <X size={14} />
                      </button>
                    </div>
                    <GrowTextarea value={note.text} onChange={e => handleNoteChange(focusedImage.id, note.id, e.target.value)} placeholder="Add a note…"
                      style={{ background: colors.body, fontSize: 13, color: "#1c1917", lineHeight: 1.6, padding: "8px 10px" }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
