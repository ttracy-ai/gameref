"use client";

import { useState, useRef, useCallback } from "react";

type PlacedImage = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragState = {
  id: string;
  startX: number;
  startY: number;
  imgX: number;
  imgY: number;
};

/** Scale natural image dimensions to something reasonable for the canvas. */
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

  // Scale down if too large for the canvas
  if (w > maxW || h > maxH) {
    const scale = Math.min(maxW / w, maxH / h);
    w *= scale;
    h *= scale;
  }

  // Scale up if tiny
  if (Math.max(w, h) < minDim) {
    const scale = minDim / Math.max(w, h);
    w *= scale;
    h *= scale;
  }

  return { width: Math.round(w), height: Math.round(h) };
}

/** Pull an image src out of whatever Chrome drops. */
async function extractImageSrc(dt: DataTransfer): Promise<string | null> {
  // Local file drag (from desktop / file explorer)
  if (dt.files.length > 0) {
    const file = dt.files[0];
    if (file.type.startsWith("image/")) {
      return URL.createObjectURL(file);
    }
  }

  // Image dragged from a web page — URI list is most reliable
  const uriList = dt.getData("text/uri-list");
  if (uriList) {
    const first = uriList
      .split("\n")
      .map((u) => u.trim())
      .find((u) => u && !u.startsWith("#"));
    if (first) return first;
  }

  // Fallback: parse src from the HTML snippet Chrome provides
  const html = dt.getData("text/html");
  if (html) {
    const match = html.match(/src=["']([^"']+)["']/);
    if (match?.[1]) return match[1];
  }

  return null;
}

export default function RefBoard() {
  const [images, setImages] = useState<PlacedImage[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Drop from Chrome ────────────────────────────────────────────────────────

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const src = await extractImageSrc(e.dataTransfer);
    if (!src) return;

    const rect = canvas.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;

    const img = new Image();
    img.src = src;

    img.onload = () => {
      const { width, height } = getScaledSize(
        img.naturalWidth,
        img.naturalHeight,
        rect.width,
        rect.height
      );
      setImages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          src,
          x: Math.max(0, dropX - width / 2),
          y: Math.max(0, dropY - height / 2),
          width,
          height,
        },
      ]);
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // ── Move images around the canvas ───────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, id: string, imgX: number, imgY: number) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        imgX,
        imgY,
      };
      // Bring clicked image to top
      setImages((prev) => {
        const target = prev.find((i) => i.id === id);
        if (!target) return prev;
        return [...prev.filter((i) => i.id !== id), target];
      });
    },
    []
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    setImages((prev) =>
      prev.map((img) =>
        img.id === ds.id
          ? { ...img, x: ds.imgX + dx, y: ds.imgY + dy }
          : img
      )
    );
  }, []);

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  return (
    <div
      ref={canvasRef}
      className={`relative flex-1 h-full overflow-hidden transition-colors duration-150 ${
        isDragOver ? "bg-neutral-800" : "bg-neutral-900"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Empty state hint */}
      {images.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-600 select-none pointer-events-none">
          <span className="text-sm">Drag images from Chrome to place them</span>
        </div>
      )}

      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 border-2 border-dashed border-indigo-500 rounded pointer-events-none z-50 flex items-center justify-center">
          <span className="text-indigo-400 text-sm select-none">Drop to place</span>
        </div>
      )}

      {/* Placed images */}
      {images.map((img) => (
        <img
          key={img.id}
          src={img.src}
          alt=""
          draggable={false}
          onPointerDown={(e) => handlePointerDown(e, img.id, img.x, img.y)}
          style={{
            position: "absolute",
            left: img.x,
            top: img.y,
            width: img.width,
            height: img.height,
            cursor: dragState.current?.id === img.id ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
          }}
        />
      ))}
    </div>
  );
}
