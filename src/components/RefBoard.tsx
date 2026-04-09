"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const STORAGE_KEY = "gameref_refboard_v1";

// ── Types ────────────────────────────────────────────────────────────────────

type PlacedImage = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type MoveOp = {
  kind: "move";
  startX: number;
  startY: number;
  origPositions: Record<string, { x: number; y: number }>;
};

type ResizeOp = {
  kind: "resize";
  startX: number;
  groupLeft: number;
  groupTop: number;
  groupOrigWidth: number;
  origSizes: Record<string, { x: number; y: number; width: number; height: number }>;
};

type BoxOp = {
  kind: "box";
  startX: number;
  startY: number;
};

type ActiveOp = MoveOp | ResizeOp | BoxOp;

type BoxState = {
  startX: number; startY: number;
  currentX: number; currentY: number;
} | null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getScaledSize(nW: number, nH: number, cW: number, cH: number) {
  const maxW = cW * 0.45, maxH = cH * 0.45, minDim = 180;
  let w = nW, h = nH;
  if (w > maxW || h > maxH) { const s = Math.min(maxW / w, maxH / h); w *= s; h *= s; }
  if (Math.max(w, h) < minDim) { const s = minDim / Math.max(w, h); w *= s; h *= s; }
  return { width: Math.round(w), height: Math.round(h) };
}

async function blobToDataUrl(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function extractImageSrc(dt: DataTransfer): Promise<string | null> {
  if (dt.files.length > 0) {
    const file = dt.files[0];
    if (file.type.startsWith("image/")) return URL.createObjectURL(file);
  }
  const uriList = dt.getData("text/uri-list");
  if (uriList) {
    const first = uriList.split("\n").map(u => u.trim()).find(u => u && !u.startsWith("#"));
    if (first) return first;
  }
  const html = dt.getData("text/html");
  if (html) {
    const match = html.match(/src=["']([^"']+)["']/);
    if (match?.[1]) return match[1];
  }
  return null;
}

function normalizeBox(b: NonNullable<BoxState>) {
  return {
    x: Math.min(b.startX, b.currentX), y: Math.min(b.startY, b.currentY),
    w: Math.abs(b.currentX - b.startX), h: Math.abs(b.currentY - b.startY),
  };
}

function boxIntersects(img: PlacedImage, box: { x: number; y: number; w: number; h: number }) {
  return img.x < box.x + box.w && img.x + img.width > box.x &&
         img.y < box.y + box.h && img.y + img.height > box.y;
}

function groupBoundsOf(imgs: PlacedImage[]) {
  if (imgs.length === 0) return null;
  const x = Math.min(...imgs.map(i => i.x));
  const y = Math.min(...imgs.map(i => i.y));
  const right = Math.max(...imgs.map(i => i.x + i.width));
  const bottom = Math.max(...imgs.map(i => i.y + i.height));
  return { x, y, width: right - x, height: bottom - y };
}

function loadFromStorage(): PlacedImage[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}

function saveToStorage(images: PlacedImage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(images)); }
  catch { console.warn("GameRef: localStorage full — some images may not persist."); }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RefBoard() {
  const [images, setImages] = useState<PlacedImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [boxState, setBoxState] = useState<BoxState>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const activeOp = useRef<ActiveOp | null>(null);
  const imagesRef = useRef(images);
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Shift") setShiftHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === "Shift") setShiftHeld(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ── Persistence ────────────────────────────────────────────────────────────

  useEffect(() => { setImages(loadFromStorage()); }, []);
  useEffect(() => { saveToStorage(images); }, [images]);

  // ── Drop from Chrome ───────────────────────────────────────────────────────

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    let src = await extractImageSrc(e.dataTransfer);
    if (!src) return;
    if (src.startsWith("blob:")) {
      const dataUrl = await blobToDataUrl(src);
      URL.revokeObjectURL(src);
      src = dataUrl;
    }
    const rect = canvas.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;
    const finalSrc = src;
    const img = new Image();
    img.src = finalSrc;
    img.onload = () => {
      const { width, height } = getScaledSize(img.naturalWidth, img.naturalHeight, rect.width, rect.height);
      setImages(prev => [...prev, {
        id: crypto.randomUUID(), src: finalSrc,
        x: Math.max(0, dropX - width / 2), y: Math.max(0, dropY - height / 2),
        width, height,
      }]);
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (activeOp.current) return; // ignore during move/resize
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  // ── Canvas background → start box select ──────────────────────────────────

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== canvasRef.current) return;
    setSelectedIds(new Set());
    if (!e.shiftKey) return; // box select requires shift
    const rect = canvasRef.current!.getBoundingClientRect();
    activeOp.current = {
      kind: "box",
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
    };
  }, []);

  // ── Image pointer down ─────────────────────────────────────────────────────

  const handleImagePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation();

    if (e.shiftKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
      return;
    }

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const current = selectedIdsRef.current;
    const idsToMove = current.has(id) ? [...current] : [id];
    if (!current.has(id)) setSelectedIds(new Set([id]));

    setImages(prev => {
      const moving = prev.filter(i => idsToMove.includes(i.id));
      const rest = prev.filter(i => !idsToMove.includes(i.id));
      return [...rest, ...moving];
    });

    const origPositions: Record<string, { x: number; y: number }> = {};
    for (const imgId of idsToMove) {
      const img = imagesRef.current.find(i => i.id === imgId);
      if (img) origPositions[imgId] = { x: img.x, y: img.y };
    }
    activeOp.current = { kind: "move", startX: e.clientX, startY: e.clientY, origPositions };
  }, []);

  // ── Group resize handle pointer down ───────────────────────────────────────

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const selected = imagesRef.current.filter(i => selectedIdsRef.current.has(i.id));
    const bounds = groupBoundsOf(selected);
    if (!bounds) return;

    const origSizes: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const img of selected) {
      origSizes[img.id] = { x: img.x, y: img.y, width: img.width, height: img.height };
    }

    activeOp.current = {
      kind: "resize",
      startX: e.clientX,
      groupLeft: bounds.x,
      groupTop: bounds.y,
      groupOrigWidth: bounds.width,
      origSizes,
    };
  }, []);

  // ── Pointer move ───────────────────────────────────────────────────────────

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const op = activeOp.current;
    if (!op) return;

    if (op.kind === "box") {
      const rect = canvasRef.current!.getBoundingClientRect();
      setBoxState({
        startX: op.startX, startY: op.startY,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
      });
      return;
    }

    if (op.kind === "move") {
      const dx = e.clientX - op.startX, dy = e.clientY - op.startY;
      setImages(prev => prev.map(img => {
        const orig = op.origPositions[img.id];
        return orig ? { ...img, x: orig.x + dx, y: orig.y + dy } : img;
      }));
      return;
    }

    if (op.kind === "resize") {
      const dx = e.clientX - op.startX;
      const scale = Math.max(0.05, (op.groupOrigWidth + dx) / op.groupOrigWidth);
      setImages(prev => prev.map(img => {
        const orig = op.origSizes[img.id];
        if (!orig) return img;
        // Scale position relative to group origin so spacing is preserved
        return {
          ...img,
          x: Math.round(op.groupLeft + (orig.x - op.groupLeft) * scale),
          y: Math.round(op.groupTop + (orig.y - op.groupTop) * scale),
          width: Math.max(10, Math.round(orig.width * scale)),
          height: Math.max(10, Math.round(orig.height * scale)),
        };
      }));
    }
  }, []);

  // ── Pointer up ─────────────────────────────────────────────────────────────

  const handlePointerUp = useCallback(() => {
    const op = activeOp.current;
    activeOp.current = null;

    if (op?.kind === "box") {
      const bs = boxState;
      setBoxState(null);
      if (!bs) return;
      const box = normalizeBox(bs);
      if (box.w < 4 && box.h < 4) return;
      const hits = imagesRef.current.filter(img => boxIntersects(img, box));
      if (hits.length > 0) setSelectedIds(new Set(hits.map(i => i.id)));
    } else {
      setBoxState(null);
    }
  }, [boxState]);

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedImages = images.filter(img => selectedIds.has(img.id));
  const groupBounds = groupBoundsOf(selectedImages);
  const normalizedBox = boxState ? normalizeBox(boxState) : null;
  const PAD = 6; // padding around group selection box

  return (
    <div
      ref={canvasRef}
      className={`relative flex-1 h-full overflow-hidden transition-colors duration-150 ${
        isDragOver ? "bg-neutral-800" : "bg-neutral-900"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Empty state */}
      {images.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-600 select-none pointer-events-none text-sm">
          Drag images from Chrome to place them
        </div>
      )}

      {/* File drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 border-2 border-dashed border-indigo-500 rounded pointer-events-none z-50 flex items-center justify-center">
          <span className="text-indigo-400 text-sm select-none">Drop to place</span>
        </div>
      )}

      {/* Rubber-band selection box */}
      {normalizedBox && normalizedBox.w > 2 && (
        <div
          className="pointer-events-none absolute border border-green-400 bg-green-400/10 z-50"
          style={{ left: normalizedBox.x, top: normalizedBox.y, width: normalizedBox.w, height: normalizedBox.h }}
        />
      )}

      {/* Images */}
      {images.map(img => (
        <div
          key={img.id}
          onPointerDown={e => handleImagePointerDown(e, img.id)}
          style={{
            position: "absolute",
            left: img.x, top: img.y,
            width: img.width, height: img.height,
            cursor: "grab",
            touchAction: "none",
            userSelect: "none",
          }}
        >
          <img
            src={img.src}
            alt=""
            draggable={false}
            style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
          />
        </div>
      ))}

      {/* Group selection box + single resize handle */}
      {groupBounds && (
        <div
          style={{
            position: "absolute",
            left: groupBounds.x - PAD,
            top: groupBounds.y - PAD,
            width: groupBounds.width + PAD * 2,
            height: groupBounds.height + PAD * 2,
            border: "2px solid #22c55e",
            pointerEvents: "none",
            zIndex: 30,
          }}
        >
          {/* Resize handle — only visible while shift is held */}
          {shiftHeld && (
            <div
              onPointerDown={handleResizePointerDown}
              style={{
                position: "absolute",
                bottom: -7, right: -7,
                width: 14, height: 14,
                background: "#22c55e",
                border: "2px solid #15803d",
                borderRadius: 2,
                cursor: "se-resize",
                pointerEvents: "auto",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
