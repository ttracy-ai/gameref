"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus, X, Pencil, Pin, PinOff, MapPin as MapPinIcon, FileText,
  Image as ImageIcon, Loader2, Trash2, ZoomIn, ZoomOut, Layers,
  Eye, EyeOff, ChevronDown, ChevronRight,
} from "lucide-react";
import { loadCanvasData, syncCanvasData } from "@/lib/canvasStorage";
import { RoomProvider, useStorage, useMutation } from "@/lib/liveblocks-map";

// ── Types ─────────────────────────────────────────────────────────────────────

type PinGroup = {
  id: string;
  name: string;
  visible: boolean;
};

type MapPin = {
  id: string;
  x: number;        // 0–100 percent of image width
  y: number;        // 0–100 percent of image height
  label: string;
  type: "note" | "image";
  note: string;
  imageRef: string;
  imageSrc: string;
  visible: boolean;
  groupId: string;  // "" = ungrouped
};

type MapLayer = {
  id: string;
  name: string;
  src: string;
  pins: MapPin[];
  groups: PinGroup[];
};

type MapState = { layers: MapLayer[] };

type PlacedImage = { id: string; src: string; x: number; y: number; width: number; height: number };

const STORAGE_KEY_PREFIX = "gameref_maplayout_";
const ZOOM_KEY           = (pid: string) => `gameref_maplayout_zoom_${pid}`;

function toMapState(raw: unknown): MapState {
  if (raw && typeof raw === "object" && "layers" in raw && Array.isArray((raw as MapState).layers)) {
    return {
      layers: (raw as MapState).layers.map((l) => ({
        ...l,
        groups: l.groups ?? [],
        pins: (l.pins ?? []).map((p) => ({ ...p, groupId: p.groupId ?? "" })),
      })),
    };
  }
  return { layers: [] };
}

function isPinEffectivelyVisible(pin: MapPin, layer: MapLayer): boolean {
  if (!pin.visible) return false;
  if (pin.groupId) {
    const group = layer.groups.find((g) => g.id === pin.groupId);
    if (group && !group.visible) return false;
  }
  return true;
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
    const t = value.trim();
    onRename(t || layer.name);
    setValue(t || layer.name);
    setRenaming(false);
  }

  return (
    <div
      onClick={onSwitch}
      className={`group/tab relative flex items-center gap-1 px-3 py-1.5 rounded-t-md text-xs cursor-pointer border-b-2 shrink-0 select-none transition-colors ${
        isActive ? "border-lime-500 text-neutral-100 bg-neutral-800"
                 : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60"
      }`}
    >
      {renaming ? (
        <input
          ref={inputRef} value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setValue(layer.name); setRenaming(false); } }}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent outline-none w-24 text-neutral-100"
        />
      ) : <span>{layer.name}</span>}
      {isActive && !renaming && (
        <button onClick={(e) => { e.stopPropagation(); setValue(layer.name); setRenaming(true); }}
          className="opacity-0 group-hover/tab:opacity-100 text-neutral-500 hover:text-neutral-300 transition-opacity">
          <Pencil size={10} />
        </button>
      )}
      {canDelete && !renaming && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover/tab:opacity-100 text-neutral-600 hover:text-red-400 transition-opacity ml-0.5">
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// ── PinMarker ─────────────────────────────────────────────────────────────────

function PinMarker({ pin, onSelect }: { pin: MapPin; onSelect: () => void }) {
  const color = pin.type === "image" ? "#84cc16" : "#f59e0b";
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      title={pin.label || undefined}
      style={{ position: "absolute", left: `${pin.x}%`, top: `${pin.y}%`, transform: "translate(-50%, -100%)", zIndex: 10 }}
      className="cursor-pointer"
    >
      <svg width="20" height="26" viewBox="0 0 20 26" fill="none">
        <path d="M10 0C4.477 0 0 4.477 0 10c0 7.5 10 16 10 16s10-8.5 10-16c0-5.523-4.477-10-10-10z"
          fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
        <circle cx="10" cy="10" r="4" fill="rgba(0,0,0,0.25)" />
      </svg>
    </div>
  );
}

// ── PinModal ──────────────────────────────────────────────────────────────────

function PinModal({ pin, layer, refImages, onSave, onDelete, onClose }: {
  pin: MapPin; layer: MapLayer; refImages: PlacedImage[];
  onSave: (updated: MapPin) => void; onDelete: () => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<MapPin>({ ...pin });

  function field<K extends keyof MapPin>(k: K, v: MapPin[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 bg-neutral-800 border border-neutral-700 rounded-xl w-[420px] max-h-[80vh] overflow-y-auto shadow-2xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-neutral-200 font-semibold text-sm">Pin</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300"><X size={14} /></button>
        </div>

        {/* Label */}
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Label</label>
          <input value={draft.label} onChange={(e) => field("label", e.target.value)}
            placeholder="Pin label…"
            className="w-full bg-neutral-700 border border-neutral-600 rounded px-2 py-1.5 text-sm text-neutral-200 outline-none focus:border-neutral-500" />
        </div>

        {/* Type */}
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Type</label>
          <div className="flex gap-2">
            <button onClick={() => field("type", "note")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
                draft.type === "note" ? "bg-amber-900/40 border-amber-600 text-amber-300"
                                      : "bg-neutral-700 border-neutral-600 text-neutral-400 hover:border-neutral-500"}`}>
              <FileText size={12} /> Note
            </button>
            <button onClick={() => field("type", "image")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
                draft.type === "image" ? "bg-lime-900/40 border-lime-600 text-lime-300"
                                       : "bg-neutral-700 border-neutral-600 text-neutral-400 hover:border-neutral-500"}`}>
              <ImageIcon size={12} /> Reference Image
            </button>
          </div>
        </div>

        {/* Note */}
        {draft.type === "note" && (
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Note</label>
            <textarea value={draft.note} onChange={(e) => field("note", e.target.value)}
              placeholder="Write a note…" rows={4}
              className="w-full bg-neutral-700 border border-neutral-600 rounded px-2 py-1.5 text-sm text-neutral-200 outline-none focus:border-neutral-500 resize-none" />
          </div>
        )}

        {/* Image ref */}
        {draft.type === "image" && (
          <div>
            <label className="text-xs text-neutral-500 mb-2 block">Reference Image</label>
            {refImages.length === 0 ? (
              <p className="text-xs text-neutral-600">No images in Reference Board yet.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto scrollbar-dark">
                {refImages.map((img) => (
                  <button key={img.id}
                    onClick={() => setDraft((d) => ({ ...d, imageRef: img.id, imageSrc: img.src }))}
                    className={`aspect-square rounded overflow-hidden border-2 transition-colors ${
                      draft.imageRef === img.id ? "border-lime-500" : "border-transparent hover:border-neutral-500"}`}>
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

        {/* Group */}
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Group</label>
          <select
            value={draft.groupId}
            onChange={(e) => field("groupId", e.target.value)}
            className="w-full bg-neutral-700 border border-neutral-600 rounded px-2 py-1.5 text-sm text-neutral-200 outline-none focus:border-neutral-500"
          >
            <option value="">No group</option>
            {layer.groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* Visibility */}
        <div>
          <button onClick={() => field("visible", !draft.visible)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
              draft.visible ? "bg-neutral-700 border-neutral-600 text-neutral-300"
                            : "bg-neutral-700/50 border-neutral-700 text-neutral-600"}`}>
            {draft.visible ? <Pin size={12} /> : <PinOff size={12} />}
            {draft.visible ? "Visible" : "Hidden"}
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-1">
          <button onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 transition-colors">
            <Trash2 size={12} /> Delete pin
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs px-3 py-1.5 text-neutral-500 hover:text-neutral-300 transition-colors">Cancel</button>
            <button onClick={() => { onSave(draft); onClose(); }}
              className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PinListPanel ──────────────────────────────────────────────────────────────

function PinListPanel({ layer, onClose, onTogglePin, onToggleGroup, onAddGroup, onRenameGroup, onDeleteGroup, onSelectPin }: {
  layer: MapLayer;
  onClose: () => void;
  onTogglePin: (pinId: string) => void;
  onToggleGroup: (groupId: string) => void;
  onAddGroup: () => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onSelectPin: (pin: MapPin) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [renameValue, setRenameValue]     = useState("");
  const renameRef                         = useRef<HTMLInputElement>(null);

  useEffect(() => { if (renamingGroup) renameRef.current?.focus(); }, [renamingGroup]);

  function commitRename(id: string) {
    const t = renameValue.trim();
    if (t) onRenameGroup(id, t);
    setRenamingGroup(null);
  }

  const grouped   = layer.groups.map((g) => ({ group: g, pins: layer.pins.filter((p) => p.groupId === g.id) }));
  const ungrouped = layer.pins.filter((p) => !p.groupId);

  function PinRow({ pin }: { pin: MapPin }) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-700/50 group/pin-row">
        <span
          className="flex-1 text-xs text-neutral-400 truncate cursor-pointer hover:text-neutral-200 transition-colors"
          onClick={() => onSelectPin(pin)}
        >
          {pin.label || (pin.type === "note" ? "(note)" : "(image)")}
        </span>
        <button
          onClick={() => onTogglePin(pin.id)}
          className="opacity-0 group-hover/pin-row:opacity-100 transition-opacity text-neutral-600 hover:text-neutral-300"
          title={pin.visible ? "Hide pin" : "Show pin"}
        >
          {pin.visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-0 right-0 z-20 w-64 bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl flex flex-col max-h-[calc(100%-2rem)] m-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-700 shrink-0">
        <span className="text-xs font-semibold text-neutral-300">Pins</span>
        <button onClick={onClose} className="text-neutral-600 hover:text-neutral-300 transition-colors"><X size={13} /></button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-dark py-1">
        {layer.pins.length === 0 && (
          <p className="text-xs text-neutral-600 px-3 py-2">No pins yet.</p>
        )}

        {/* Groups */}
        {grouped.map(({ group, pins }) => {
          const isExpanded = expanded[group.id] !== false; // default expanded
          return (
            <div key={group.id} className="mb-0.5">
              {/* Group header */}
              <div className="flex items-center gap-1 px-2 py-1 rounded hover:bg-neutral-700/40 group/grp">
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [group.id]: !isExpanded }))}
                  className="text-neutral-600 hover:text-neutral-300 transition-colors shrink-0"
                >
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>

                {renamingGroup === group.id ? (
                  <input
                    ref={renameRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(group.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(group.id); if (e.key === "Escape") setRenamingGroup(null); }}
                    className="flex-1 bg-neutral-700 rounded px-1.5 py-0.5 text-xs text-neutral-100 outline-none border border-neutral-500"
                  />
                ) : (
                  <span
                    className="flex-1 text-xs font-medium text-neutral-300 truncate cursor-pointer"
                    onDoubleClick={() => { setRenameValue(group.name); setRenamingGroup(group.id); }}
                  >
                    {group.name}
                    <span className="text-neutral-600 font-normal ml-1">({pins.length})</span>
                  </span>
                )}

                <div className="flex items-center gap-0.5 opacity-0 group-hover/grp:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setRenameValue(group.name); setRenamingGroup(group.id); }}
                    className="text-neutral-600 hover:text-neutral-300 transition-colors"
                    title="Rename group"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => onToggleGroup(group.id)}
                    className="text-neutral-600 hover:text-neutral-300 transition-colors"
                    title={group.visible ? "Hide group" : "Show group"}
                  >
                    {group.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                  </button>
                  <button
                    onClick={() => onDeleteGroup(group.id)}
                    className="text-neutral-600 hover:text-red-400 transition-colors"
                    title="Delete group"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              {/* Group pins */}
              {isExpanded && (
                <div className="ml-4">
                  {pins.length === 0
                    ? <p className="text-xs text-neutral-700 px-2 py-1">Empty</p>
                    : pins.map((p) => <PinRow key={p.id} pin={p} />)
                  }
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped */}
        {ungrouped.length > 0 && (
          <div>
            {layer.groups.length > 0 && (
              <div className="px-2 pt-2 pb-1">
                <span className="text-xs text-neutral-600 font-medium">Ungrouped</span>
              </div>
            )}
            {ungrouped.map((p) => <PinRow key={p.id} pin={p} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-neutral-700 px-3 py-2 shrink-0">
        <button
          onClick={onAddGroup}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <Plus size={12} /> Add group
        </button>
      </div>
    </div>
  );
}

// ── Inner ─────────────────────────────────────────────────────────────────────

function MapLayoutInner({ projectId, initialData, initialZoom }: {
  projectId: string; initialData: MapState; initialZoom: number;
}) {
  const raw        = useStorage((root) => root.mapJson);
  const setMapJson = useMutation(({ storage }, json: string) => storage.set("mapJson", json), []);

  const [state, setState]                 = useState<MapState>(initialData);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(initialData.layers[0]?.id ?? null);
  const [addingPin, setAddingPin]         = useState(false);
  const [selectedPin, setSelectedPin]     = useState<{ layerId: string; pin: MapPin } | null>(null);
  const [uploading, setUploading]         = useState(false);
  const [zoom, setZoomState]              = useState(initialZoom);
  const [showPinPanel, setShowPinPanel]   = useState(false);
  const [refImages, setRefImages]         = useState<PlacedImage[]>([]);
  const imgRef                            = useRef<HTMLImageElement>(null);
  const fileInputRef                      = useRef<HTMLInputElement>(null);
  const stateRef                          = useRef(state);
  stateRef.current                        = state;

  function setZoom(v: number | ((prev: number) => number)) {
    setZoomState((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      try { localStorage.setItem(ZOOM_KEY(projectId), String(next)); } catch {}
      return next;
    });
  }

  // Sync from Liveblocks
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

  // Load RefBoard images
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`gameref_refboard_${projectId}_v1`);
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

  // ── Layer actions ─────────────────────────────────────────────────────────────

  function addLayer(src: string) {
    const id = crypto.randomUUID();
    update((s) => ({ layers: [...s.layers, { id, name: `Map ${s.layers.length + 1}`, src, pins: [], groups: [] }] }));
    setActiveLayerId(id);
  }

  function renameLayer(id: string, name: string) {
    update((s) => ({ layers: s.layers.map((l) => l.id === id ? { ...l, name } : l) }));
  }

  function deleteLayer(id: string) {
    update((s) => ({ layers: s.layers.filter((l) => l.id !== id) }));
    setActiveLayerId((cur) => {
      const rem = stateRef.current.layers.filter((l) => l.id !== id);
      return cur === id ? (rem[0]?.id ?? null) : cur;
    });
  }

  // ── Upload ────────────────────────────────────────────────────────────────────

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/refboard/upload?projectId=${projectId}`, { method: "POST", body: form });
      if (res.ok) { const { url } = await res.json(); addLayer(url); setUploading(false); return; }
    } catch {}
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) { addLayer(e.target.result as string); setUploading(false); } };
    reader.readAsDataURL(file);
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
    const newPin: MapPin = { id: crypto.randomUUID(), x, y, label: "", type: "note", note: "", imageRef: "", imageSrc: "", visible: true, groupId: "" };
    update((s) => ({ layers: s.layers.map((l) => l.id === activeLayerId ? { ...l, pins: [...l.pins, newPin] } : l) }));
    setSelectedPin({ layerId: activeLayerId, pin: newPin });
    setAddingPin(false);
  }

  function savePin(layerId: string, updated: MapPin) {
    update((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId ? { ...l, pins: l.pins.map((p) => p.id === updated.id ? updated : p) } : l
      ),
    }));
  }

  function deletePin(layerId: string, pinId: string) {
    update((s) => ({ layers: s.layers.map((l) => l.id === layerId ? { ...l, pins: l.pins.filter((p) => p.id !== pinId) } : l) }));
    setSelectedPin(null);
  }

  function togglePin(layerId: string, pinId: string) {
    update((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId ? { ...l, pins: l.pins.map((p) => p.id === pinId ? { ...p, visible: !p.visible } : p) } : l
      ),
    }));
  }

  // ── Group actions ─────────────────────────────────────────────────────────────

  function addGroup(layerId: string) {
    const id = crypto.randomUUID();
    update((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId ? { ...l, groups: [...l.groups, { id, name: "New Group", visible: true }] } : l
      ),
    }));
  }

  function toggleGroup(layerId: string, groupId: string) {
    update((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId
          ? { ...l, groups: l.groups.map((g) => g.id === groupId ? { ...g, visible: !g.visible } : g) }
          : l
      ),
    }));
  }

  function renameGroup(layerId: string, groupId: string, name: string) {
    update((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId
          ? { ...l, groups: l.groups.map((g) => g.id === groupId ? { ...g, name } : g) }
          : l
      ),
    }));
  }

  function deleteGroup(layerId: string, groupId: string) {
    update((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId
          ? { ...l, groups: l.groups.filter((g) => g.id !== groupId), pins: l.pins.map((p) => p.groupId === groupId ? { ...p, groupId: "" } : p) }
          : l
      ),
    }));
  }

  const activeLayer = state.layers.find((l) => l.id === activeLayerId) ?? null;

  // ── Empty state ───────────────────────────────────────────────────────────────

  if (state.layers.length === 0) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-neutral-900 gap-4">
        <div
          onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-neutral-700 hover:border-neutral-500 rounded-2xl p-12 text-neutral-600 hover:text-neutral-400 transition-all cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 size={28} className="animate-spin" /> : (
            <><MapPinIcon size={28} /><p className="text-sm">Drop a map image here, or click to upload</p></>
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
      <div className="flex items-end gap-0.5 px-4 pt-3 border-b border-neutral-700 shrink-0 overflow-x-auto scrollbar-dark" style={{ background: "#1a1a1a" }}>
        {state.layers.map((layer) => (
          <LayerTab key={layer.id} layer={layer} isActive={layer.id === activeLayerId} canDelete={state.layers.length > 1}
            onSwitch={() => setActiveLayerId(layer.id)} onDelete={() => deleteLayer(layer.id)} onRename={(n) => renameLayer(layer.id, n)} />
        ))}
        <button onClick={() => fileInputRef.current?.click()} title="Add map layer"
          className="flex items-center gap-1 px-2.5 py-1.5 mb-px text-xs text-neutral-600 hover:text-neutral-400 transition-colors rounded-t-md hover:bg-neutral-800/60 shrink-0">
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
            addingPin ? "bg-indigo-700 border-indigo-500 text-white"
                      : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"}`}
        >
          <MapPinIcon size={13} />
          {addingPin ? "Click map to place pin" : "Add pin"}
        </button>

        <div className="ml-auto flex items-center gap-1">
          {/* Pin list toggle */}
          <button
            onClick={() => setShowPinPanel((v) => !v)}
            title="Pin list"
            className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${
              showPinPanel ? "bg-neutral-700 text-neutral-200" : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800"}`}
          >
            <Layers size={14} />
          </button>

          <div className="w-px h-4 bg-neutral-700 mx-1" />

          {/* Zoom */}
          <button onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} disabled={zoom <= 0.25}
            title="Zoom out"
            className="flex items-center justify-center w-7 h-7 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ZoomOut size={14} />
          </button>
          <button onClick={() => setZoom(1)} title="Reset zoom"
            className="text-xs text-neutral-600 hover:text-neutral-300 w-10 text-center transition-colors">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} disabled={zoom >= 4}
            title="Zoom in"
            className="flex items-center justify-center w-7 h-7 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* Map area (relative so pin panel can be absolute inside it) */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 overflow-auto scrollbar-dark flex items-center justify-center bg-neutral-950 p-6">
          {activeLayer && (
            <div className="relative shrink-0" style={{ width: `calc(80vw * ${zoom})` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={activeLayer.src}
                alt={activeLayer.name}
                onClick={handleMapClick}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{ width: "100%", display: "block", cursor: addingPin ? "crosshair" : "default" }}
                className="rounded-lg shadow-2xl select-none"
              />
              {activeLayer.pins
                .filter((pin) => isPinEffectivelyVisible(pin, activeLayer))
                .map((pin) => (
                  <PinMarker key={pin.id} pin={pin}
                    onSelect={() => setSelectedPin({ layerId: activeLayer.id, pin })} />
                ))}
            </div>
          )}
        </div>

        {/* Pin list panel */}
        {showPinPanel && activeLayer && (
          <PinListPanel
            layer={activeLayer}
            onClose={() => setShowPinPanel(false)}
            onTogglePin={(pinId) => togglePin(activeLayer.id, pinId)}
            onToggleGroup={(groupId) => toggleGroup(activeLayer.id, groupId)}
            onAddGroup={() => addGroup(activeLayer.id)}
            onRenameGroup={(groupId, name) => renameGroup(activeLayer.id, groupId, name)}
            onDeleteGroup={(groupId) => deleteGroup(activeLayer.id, groupId)}
            onSelectPin={(pin) => {
              setSelectedPin({ layerId: activeLayer.id, pin });
              setShowPinPanel(false);
            }}
          />
        )}
      </div>

      {/* Pin modal */}
      {selectedPin && activeLayer && (
        <PinModal
          pin={selectedPin.pin}
          layer={activeLayer}
          refImages={refImages}
          onSave={(updated) => savePin(selectedPin.layerId, updated)}
          onDelete={() => deletePin(selectedPin.layerId, selectedPin.pin.id)}
          onClose={() => setSelectedPin(null)}
        />
      )}
    </main>
  );
}

// ── Outer ─────────────────────────────────────────────────────────────────────

export default function MapLayout({ projectId }: { projectId: string }) {
  const [initial, setInitial] = useState<MapState | null>(null);
  const [initialZoom, setInitialZoom] = useState(1);

  useEffect(() => {
    async function load() {
      const localRaw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`);
      let localData: MapState | null = null;
      if (localRaw) { try { localData = toMapState(JSON.parse(localRaw)); } catch {} }

      const dbData   = await loadCanvasData(projectId, "maplayout");
      const resolved = dbData ? toMapState(dbData) : (localData ?? { layers: [] });

      const savedZoom = parseFloat(localStorage.getItem(ZOOM_KEY(projectId)) ?? "1");
      setInitialZoom(isFinite(savedZoom) && savedZoom > 0 ? savedZoom : 1);
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
    <RoomProvider id={`map_${projectId}`} initialStorage={{ mapJson: JSON.stringify(initial) }}>
      <MapLayoutInner projectId={projectId} initialData={initial} initialZoom={initialZoom} />
    </RoomProvider>
  );
}
