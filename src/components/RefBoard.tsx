"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const STORAGE_KEY = "gameref_refboard_v1";

type PlacedImage = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragState = {
  kind: "move";
  id: string;
  startX: number;
  startY: number;
  imgX: number;
  imgY: number;
} | {
  kind: "resize";
  id: string;
  startX: number;
  origWidth: number;
  origHeight: number;
  ratio: number;
};

function getScaledSize(
  naturalW: number,
  naturalH: number,
  canvasW: number,
  canvasH: number
): { width: number; height: number } {
  const maxW = canvasW * 0.45;
  const maxH = canvasH * 0.45;
  const minDim = 180;

  let w = naturalW;
  let h = naturalH;

  if (w > maxW || h > maxH) {
    const scale = Math.min(maxW / w, maxH / h);
    w *= scale;
    h *= scale;
  }

  if (Math.max(w, h) < minDim) {
    const scale = minDim / Math.max(w, h);
    w *= scale;
    h *= scale;
  }

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
    const first = uriList.split("\n").map((u) => u.trim()).find((u) => u && !u.startsWith("#"));
    if (first) return first;
  }

  const html = dt.getData("text/html");
  if (html) {
    const match = html.match(/src=["']([^"']+)["']/);
    if (match?.[1]) return match[1];
  }

  return null;
}

function loadFromStorage(): PlacedImage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PlacedImage[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(images: PlacedImage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
  } catch {
    console.warn("GameRef: localStorage full — some images may not persist.");
  }
}

export default function RefBoard() {
  const [images, setImages] = useState<PlacedImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const activeOp = useRef<DragState | null>(null);

  // ── Persistence ──────────────────────────────────────────────────────────────

  useEffect(() => { setImages(loadFromStorage()); }, []);
  useEffect(() => { saveToStorage(images); }, [images]);

  // ── Drop from Chrome ─────────────────────────────────────────────────────────

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
      setImages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          src: finalSrc,
          x: Math.max(0, dropX - width / 2),
          y: Math.max(0, dropY - height / 2),
          width,
          height,
        },
      ]);
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  // ── Canvas background click → deselect ───────────────────────────────────────

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target === canvasRef.current) setSelectedId(null);
  }, []);

  // ── Image pointer down: shift+click = select, plain click = move ─────────────

  const handleImagePointerDown = useCallback(
    (e: React.PointerEvent, id: string, imgX: number, imgY: number) => {
      e.stopPropagation();

      if (e.shiftKey) {
        setSelectedId((prev) => (prev === id ? null : id));
        return;
      }

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      activeOp.current = { kind: "move", id, startX: e.clientX, startY: e.clientY, imgX, imgY };

      // Bring to front
      setImages((prev) => {
        const target = prev.find((i) => i.id === id);
        if (!target) return prev;
        return [...prev.filter((i) => i.id !== id), target];
      });
    },
    []
  );

  // ── Resize handle pointer down ────────────────────────────────────────────────

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, id: string, origWidth: number, origHeight: number) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      activeOp.current = {
        kind: "resize",
        id,
        startX: e.clientX,
        origWidth,
        origHeight,
        ratio: origHeight / origWidth,
      };
    },
    []
  );

  // ── Pointer move: drives both move and resize ─────────────────────────────────

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const op = activeOp.current;
    if (!op) return;

    if (op.kind === "resize") {
      const dx = e.clientX - op.startX;
      const newWidth = Math.max(50, op.origWidth + dx);
      const newHeight = Math.round(newWidth * op.ratio);
      setImages((prev) =>
        prev.map((img) => img.id === op.id ? { ...img, width: newWidth, height: newHeight } : img)
      );
      return;
    }

    const dx = e.clientX - op.startX;
    const dy = e.clientY - op.startY;
    setImages((prev) =>
      prev.map((img) => img.id === op.id ? { ...img, x: op.imgX + dx, y: op.imgY + dy } : img)
    );
  }, []);

  const handlePointerUp = useCallback(() => { activeOp.current = null; }, []);

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
      {images.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-600 select-none pointer-events-none text-sm">
          Drag images from Chrome to place them
        </div>
      )}

      {isDragOver && (
        <div className="absolute inset-0 border-2 border-dashed border-indigo-500 rounded pointer-events-none z-50 flex items-center justify-center">
          <span className="text-indigo-400 text-sm select-none">Drop to place</span>
        </div>
      )}

      {images.map((img) => {
        const isSelected = selectedId === img.id;
        return (
          <div
            key={img.id}
            onPointerDown={(e) => handleImagePointerDown(e, img.id, img.x, img.y)}
            style={{
              position: "absolute",
              left: img.x,
              top: img.y,
              width: img.width,
              height: img.height,
              cursor: "grab",
              touchAction: "none",
              userSelect: "none",
              outline: isSelected ? "2px solid #22c55e" : "none",
              outlineOffset: "2px",
            }}
          >
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
            />

            {/* Resize handle — only when selected */}
            {isSelected && (
              <div
                onPointerDown={(e) => handleResizePointerDown(e, img.id, img.width, img.height)}
                style={{
                  position: "absolute",
                  bottom: -5,
                  right: -5,
                  width: 14,
                  height: 14,
                  background: "#22c55e",
                  border: "2px solid #15803d",
                  borderRadius: 2,
                  cursor: "se-resize",
                  zIndex: 10,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
