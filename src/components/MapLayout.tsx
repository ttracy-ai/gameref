"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X, Pencil, Pin, PinOff, MapPin, FileText, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { loadCanvasData, syncCanvasData } from "@/lib/canvasStorage";
import { RoomProvider, useStorage, useMutation } from "@/lib/liveblocks-map";

// ── Types ─────────────────────────────────────────────────────────────────────

type MapPin = {
  id: string;
  x: number; // 0–100 percent of image
  y: number; // 0–100 percent of image
  label: string;
  type: "note" | "image";
  note: string;
  imageRef: string; // PlacedImage id from RefBoard
  imageSrc: string; // snapshot src for display
  visible: boolean;
};

type MapLayer = {
  id: string;
  name: string;
  src: string; // blob URL or base64
  pins: MapPin[];
};

type MapState = {
  layers: MapLayer[];
};

type PlacedImage = {
  id: string; src: string;
  x: number; y: number; width: number; height: number;
};

const STORAGE_KEY_PREFIX = "gameref_maplayout_";

function toMapState(raw: unknown): MapState {
  if (raw && typeof raw === "object" && "layers" in raw && Array.isArray((raw as MapState).layers)) {
    return raw as MapState;
  }
  return { layers: [] };
}

// ── LayerTab ──────────────────────────────────────────────────────────────────

function LayerTab({ layer, isActive, canDelete, onSwitch, onDelete, onRename }: {
  layer: MapLayer; isActive: boolean; canDelete: boolean;
  onSwitch: () => void; onDelete: () => void; onRename: (name: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue]       = useState(layer.name);
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

  function commit() {
    const trimmed = value.trim();
    onRename(trimmed || layer.name);
    setValue(trimmed || layer.name);
    setRenaming(false);
  }

  return (
    <div
      onClick={onSwitch}
      className={`group/tab relative flex items-center gap-1 px-3 py-1.5 rounded-t-md text-xs cursor-pointer border-b-2 shrink-0 select-none transition-colors ${
        isActive
          ? "border-lime-500 text-neutral-100 bg-neutral-800"
          : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60"
      }`}
    >
      {renaming ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setValue(layer.name); setRenaming(false); } }}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent outline-none w-24 text-neutral-100"
        />
      ) : (
        <span>{layer.name}</span>
      )}
      {isActive && !renaming && (
        <button
          onClick={(e) => { e.stopPropagation(); setValue(layer.name); setRenaming(true); }}
          className="opacity-0 group-hover/tab:opacity-100 text-neutral-500 hover:text-neutral-300 transition-opacity"
        >
          <Pencil size={10} />
        </button>
      )}
      {canDelete && !renaming && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover/tab:opacity-100 text-neutral-600 hover:text-red-400 transition-opacity ml-0.5"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// ── Pin marker ────────────────────────────────────────────────────────────────

function PinMarker({ pin, onSelect }: { pin: MapPin; onSelect: () => void }) {
  if (!pin.visible) return null;
  const color = pin.type === "image" ? "#84cc16" : "#f59e0b";
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      title={pin.label || (pin.type === "note" ? pin.note : undefined)}
      style={{ position: "absolute", left: `${pin.x}%`, top: `${pin.y}%`, transform: "translate(-50%, -100%)", zIndex: 10 }}
      className="cursor-pointer group/pin"
    >
      <svg width="20" height="26" viewBox="0 0 20 26" fill="none">
        <path d="M10 0C4.477 0 0 4.477 0 10c0 7.5 10 16 10 16s10-8.5 10-16c0-5.523-4.477-10-10-10z" fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
        <circle cx="10" cy="10" r="4" fill="rgba(0,0,0,0.25)" />
      </svg>
    </div>
  );
}

// ── Pin modal ─────────────────────────────────────────────────────────────────

function PinModal({ pin, refImages, onSave, onDelete, onClose }: {
  pin: MapPin;
  refImages: PlacedImage[];
  onSave: (updated: MapPin) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<MapPin>({ ...pin });

  function field<K extends keyof MapPin>(k: K, v: MapPin[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function handleImageRefSelect(img: PlacedImage) {
    setDraft((d) => ({ ...d, imageRef: img.id, imageSrc: img.src }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 bg-neutral-800 border border-neutral-700 rounded-xl w-[420px] max-h-[80vh] overflow-y-auto shadow-2xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-neutral-200 font-semibold text-sm">Pin</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300"><X size={14} /></button>
        </div>

        {/* Label */}
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Label</label>
          <input
            value={draft.label}
            onChange={(e) => field("label", e.target.value)}
            placeholder="Pin label…"
            className="w-full bg-neutral-700 border border-neutral-600 rounded px-2 py-1.5 text-sm text-neutral-200 outline-none focus:border-neutral-500"
          />
        </div>

        {/* Type toggle */}
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => field("type", "note")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
                draft.type === "note"
                  ? "bg-amber-900/40 border-amber-600 text-amber-300"
                  : "bg-neutral-700 border-neutral-600 text-neutral-400 hover:border-neutral-500"
              }`}
            >
              <FileText size={12} /> Note
            </button>
            <button
              onClick={() => field("type", "image")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
                draft.type === "image"
                  ? "bg-lime-900/40 border-lime-600 text-lime-300"
                  : "bg-neutral-700 border-neutral-600 text-neutral-400 hover:border-neutral-500"
              }`}
            >
              <ImageIcon size={12} /> Reference Image
            </button>
          </div>
        </div>

        {/* Note content */}
        {draft.type === "note" && (
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Note</label>
            <textarea
              value={draft.note}
              onChange={(e) => field("note", e.target.value)}
              placeholder="Write a note…"
              rows={4}
              className="w-full bg-neutral-700 border border-neutral-600 rounded px-2 py-1.5 text-sm text-neutral-200 outline-none focus:border-neutral-500 resize-none"
            />
          </div>
        )}

        {/* Image ref picker */}
        {draft.type === "image" && (
          <div>
            <label className="text-xs text-neutral-500 mb-2 block">Reference Image</label>
            {refImages.length === 0 ? (
              <p className="text-xs text-neutral-600">No images in Reference Board yet.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto scrollbar-dark">
                {refImages.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => handleImageRefSelect(img)}
                    className={`relative aspect-square rounded overflow-hidden border-2 transition-colors ${
                      draft.imageRef === img.id ? "border-lime-500" : "border-transparent hover:border-neutral-500"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {draft.imageSrc && (
              <div className="mt-2 rounded overflow-hidden border border-neutral-700 max-h-32">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft.imageSrc} alt="Selected" className="w-full object-contain max-h-32" />
              </div>
            )}
          </div>
        )}

        {/* Visibility */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => field("visible", !draft.visible)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
              draft.visible
                ? "bg-neutral-700 border-neutral-600 text-neutral-300"
                : "bg-neutral-700/50 border-neutral-700 text-neutral-600"
            }`}
          >
            {draft.visible ? <Pin size={12} /> : <PinOff size={12} />}
            {draft.visible ? "Visible" : "Hidden"}
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-1">
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} /> Delete pin
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs px-3 py-1.5 text-neutral-500 hover:text-neutral-300 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => { onSave(draft); onClose(); }}
              className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inner ─────────────────────────────────────────────────────────────────────

function MapLayoutInner({ projectId, initialData }: { projectId: string; initialData: MapState }) {
  const raw          = useStorage((root) => root.mapJson);
  const setMapJson   = useMutation(({ storage }, json: string) => storage.set("mapJson", json), []);

  const [state, setState]             = useState<MapState>(initialData);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(initialData.layers[0]?.id ?? null);
  const [addingPin, setAddingPin]     = useState(false);
  const [selectedPin, setSelectedPin] = useState<{ layerId: string; pin: MapPin } | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [refImages, setRefImages]     = useState<PlacedImage[]>([]);
  const imgRef                        = useRef<HTMLImageElement>(null);
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const stateRef                      = useRef(state);
  stateRef.current                    = state;

  // Sync incoming Liveblocks changes from other clients
  useEffect(() => {
    if (!raw) return;
    try {
      const parsed = toMapState(JSON.parse(raw));
      setState(parsed);
      setActiveLayerId((cur) => {
        const ids = parsed.layers.map((l) => l.id);
        if (cur && ids.includes(cur)) return cur;
        return ids[0] ?? null;
      });
    } catch {}
  }, [raw]);

  // Load RefBoard images for pin picker
  useEffect(() => {
    const STORAGE_KEY = `gameref_refboard_${projectId}_v1`;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setRefImages(JSON.parse(saved) as PlacedImage[]);
    } catch {}
  }, [projectId]);

  function update(fn: (s: MapState) => MapState) {
    const next = fn(stateRef.current);
    setState(next);
    const json = JSON.stringify(next);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${projectId}`, json);
    syncCanvasData(projectId, "maplayout", next);
    setMapJson(json);
  }

  // ── Layer actions ────────────────────────────────────────────────────────────

  function addLayer(src: string) {
    const id   = crypto.randomUUID();
    const name = `Map ${stateRef.current.layers.length + 1}`;
    update((s) => ({ layers: [...s.layers, { id, name, src, pins: [] }] }));
    setActiveLayerId(id);
  }

  function renameLayer(id: string, name: string) {
    update((s) => ({ layers: s.layers.map((l) => l.id === id ? { ...l, name } : l) }));
  }

  function deleteLayer(id: string) {
    update((s) => {
      const layers = s.layers.filter((l) => l.id !== id);
      return { layers };
    });
    setActiveLayerId((cur) => {
      const remaining = stateRef.current.layers.filter((l) => l.id !== id);
      if (cur === id) return remaining[0]?.id ?? null;
      return cur;
    });
  }

  // ── Upload ────────────────────────────────────────────────────────────────────

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/refboard/upload?projectId=${projectId}`, { method: "POST", body: form });
      if (res.ok) {
        const { url } = await res.json();
        addLayer(url);
        return;
      }
    } catch {}
    // Fallback: base64
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) addLayer(e.target.result as string); };
    reader.readAsDataURL(file);
    setUploading(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) uploadFile(file);
  }

  // ── Pin actions ───────────────────────────────────────────────────────────────

  function handleMapClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!addingPin || !activeLayerId || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x    = ((e.clientX - rect.left) / rect.width) * 100;
    const y    = ((e.clientY - rect.top)  / rect.height) * 100;
    const newPin: MapPin = {
      id: crypto.randomUUID(), x, y,
      label: "", type: "note", note: "", imageRef: "", imageSrc: "", visible: true,
    };
    update((s) => ({
      layers: s.layers.map((l) =>
        l.id === activeLayerId ? { ...l, pins: [...l.pins, newPin] } : l
      ),
    }));
    setSelectedPin({ layerId: activeLayerId, pin: newPin });
    setAddingPin(false);
  }

  function savePin(layerId: string, updated: MapPin) {
    update((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId
          ? { ...l, pins: l.pins.map((p) => p.id === updated.id ? updated : p) }
          : l
      ),
    }));
  }

  function deletePin(layerId: string, pinId: string) {
    update((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId ? { ...l, pins: l.pins.filter((p) => p.id !== pinId) } : l
      ),
    }));
    setSelectedPin(null);
  }

  const activeLayer = state.layers.find((l) => l.id === activeLayerId) ?? null;

  // ── Empty state ───────────────────────────────────────────────────────────────

  if (state.layers.length === 0) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-neutral-900 gap-4">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-neutral-700 hover:border-neutral-500 rounded-2xl p-12 text-neutral-600 hover:text-neutral-400 transition-all cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 size={28} className="animate-spin" />
          ) : (
            <>
              <MapPin size={28} />
              <p className="text-sm">Drop a map image here, or click to upload</p>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
      </main>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────────

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900">
      {/* Layer tab bar */}
      <div className="flex items-end gap-0.5 px-4 pt-3 border-b border-neutral-700 bg-neutral-850 shrink-0 overflow-x-auto scrollbar-dark" style={{ background: "#1a1a1a" }}>
        {state.layers.map((layer) => (
          <LayerTab
            key={layer.id}
            layer={layer}
            isActive={layer.id === activeLayerId}
            canDelete={state.layers.length > 1}
            onSwitch={() => setActiveLayerId(layer.id)}
            onDelete={() => deleteLayer(layer.id)}
            onRename={(name) => renameLayer(layer.id, name)}
          />
        ))}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Add map layer"
          className="flex items-center gap-1 px-2.5 py-1.5 mb-px text-xs text-neutral-600 hover:text-neutral-400 transition-colors rounded-t-md hover:bg-neutral-800/60 shrink-0"
        >
          {uploading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          <span>Add map</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-700/60 bg-neutral-900 shrink-0">
        <button
          onClick={() => setAddingPin((v) => !v)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
            addingPin
              ? "bg-indigo-700 border-indigo-500 text-white"
              : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
          }`}
        >
          <MapPin size={13} />
          {addingPin ? "Click map to place pin" : "Add pin"}
        </button>
        <span className="text-xs text-neutral-700 ml-2">
          {activeLayer ? `${activeLayer.pins.filter((p) => p.visible).length} / ${activeLayer.pins.length} pins visible` : ""}
        </span>
      </div>

      {/* Map area */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-neutral-950 scrollbar-dark">
        {activeLayer && (
          <div className="relative" style={{ maxWidth: "80vw" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={activeLayer.src}
              alt={activeLayer.name}
              onClick={handleMapClick}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              style={{ maxWidth: "80vw", maxHeight: "75vh", display: "block", cursor: addingPin ? "crosshair" : "default" }}
              className="rounded-lg shadow-2xl select-none"
            />
            {/* Pins */}
            {activeLayer.pins.map((pin) => (
              <PinMarker
                key={pin.id}
                pin={pin}
                onSelect={() => setSelectedPin({ layerId: activeLayer.id, pin })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pin modal */}
      {selectedPin && (
        <PinModal
          pin={selectedPin.pin}
          refImages={refImages}
          onSave={(updated) => savePin(selectedPin.layerId, updated)}
          onDelete={() => deletePin(selectedPin.layerId, selectedPin.pin.id)}
          onClose={() => setSelectedPin(null)}
        />
      )}
    </main>
  );
}

// ── Outer (loads DB + mounts RoomProvider) ────────────────────────────────────

export default function MapLayout({ projectId }: { projectId: string }) {
  const [initial, setInitial] = useState<MapState | null>(null);

  useEffect(() => {
    async function load() {
      const localRaw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`);
      let localData: MapState | null = null;
      if (localRaw) {
        try { localData = toMapState(JSON.parse(localRaw)); } catch {}
      }

      const dbData = await loadCanvasData(projectId, "maplayout");
      const resolved = dbData
        ? toMapState(dbData)
        : (localData ?? { layers: [] });

      setInitial(resolved);
    }
    load();
  }, [projectId]);

  if (!initial) {
    return (
      <main className="flex-1 flex items-center justify-center bg-neutral-900">
        <Loader2 size={20} className="text-neutral-600 animate-spin" />
      </main>
    );
  }

  return (
    <RoomProvider
      id={`map_${projectId}`}
      initialStorage={{ mapJson: JSON.stringify(initial) }}
    >
      <MapLayoutInner projectId={projectId} initialData={initial} />
    </RoomProvider>
  );
}
