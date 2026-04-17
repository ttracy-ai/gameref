"use client";

// CardModal — full-detail view for a Kanban card.
// Also exports shared types and constants used by both CardModal and ProgressBoardInner.

import { useEffect, useState } from "react";
import { X, ExternalLink, Images } from "lucide-react";


// ── Shared constants ──────────────────────────────────────────────────────────

export const CARD_COLORS = [
  { strip: "#737373" },  // 0: gray
  { strip: "#f59e0b" },  // 1: amber
  { strip: "#ec4899" },  // 2: pink
  { strip: "#3b82f6" },  // 3: blue
  { strip: "#22c55e" },  // 4: green
  { strip: "#a855f7" },  // 5: purple
  { strip: "#f97316" },  // 6: orange
];

export const DEFAULT_COLOR_LABELS = ["Misc", "", "", "Code", "Art", "Audio", "Other"];

// Display order for color swatches: gray, green, blue, purple, orange, amber, pink
export const SWATCH_ORDER = [0, 4, 3, 5, 6, 1, 2];

export function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

export type Member = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  role: string;
};

export type Card = {
  id: string;
  title: string;
  shortDetails: string;
  details: string;
  colorIdx: number;
  todos: TodoItem[];
  imageRefs: string[];
  showTodos: boolean;
  authorId?: string;
  assignedUserIds?: string[];
  // legacy fields from older saved data — kept only for migration
  authorUsername?: string;
  assignedUsers?: { id: string }[];
};

export type RefBoardImage = { id: string; src: string };

// ── CardModal ─────────────────────────────────────────────────────────────────

export function CardModal({
  card,
  colorLabels,
  refboardKey,
  members,
  currentUserId,
  onUpdate,
  onUpdateLabel,
  onImageRefClick,
  onDelete,
  onClose,
}: {
  card: Card;
  colorLabels: string[];
  refboardKey: string;
  members: Member[];
  currentUserId: string | null;
  onUpdate: (card: Card) => void;
  onUpdateLabel: (idx: number, label: string) => void;
  onImageRefClick?: (imageId: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle]               = useState(card.title);
  const [shortDetails, setShortDetails] = useState(card.shortDetails ?? "");
  const [details, setDetails]           = useState(card.details);
  const [colorIdx, setColorIdx]         = useState(card.colorIdx);
  const [todos, setTodos]               = useState<TodoItem[]>(card.todos ?? []);
  const [newTodo, setNewTodo]           = useState("");
  const [imageRefs, setImageRefs]       = useState<string[]>(card.imageRefs ?? []);
  const [showTodos, setShowTodos]       = useState(card.showTodos ?? false);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>(
    card.assignedUserIds ?? card.assignedUsers?.map((u) => u.id) ?? []
  );
  const [allImages, setAllImages]       = useState<RefBoardImage[]>([]);
  const [showPicker, setShowPicker]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(refboardKey);
      if (raw) setAllImages(JSON.parse(raw) as RefBoardImage[]);
    } catch {}
  }, [refboardKey]);

  function saveAndClose() {
    onUpdate({
      ...card,
      title: title.trim() || card.title,
      shortDetails,
      details,
      colorIdx,
      todos,
      imageRefs,
      showTodos,
      assignedUserIds,
    });
    onClose();
  }

  function addTodo() {
    const text = newTodo.trim();
    if (!text) return;
    setTodos((prev) => [...prev, { id: makeId(), text, done: false }]);
    setNewTodo("");
  }

  function toggleTodo(id: string) {
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  }

  function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  const strip = CARD_COLORS[colorIdx]?.strip ?? CARD_COLORS[0].strip;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={saveAndClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        style={{ borderTop: `4px solid ${strip}` }}
      >
        {/* Header row: color picker + close */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <div className="flex items-center gap-2">
            {SWATCH_ORDER.map((i) => { const c = CARD_COLORS[i]; return (
              <button
                key={i}
                onClick={() => {
                  setColorIdx(i);
                  onUpdate({ ...card, title, details, colorIdx: i });
                }}
                className={`w-5 h-5 rounded-full transition-all ${
                  colorIdx === i
                    ? "scale-125 ring-2 ring-white/50"
                    : "hover:scale-110 opacity-70 hover:opacity-100"
                }`}
                style={{ background: c.strip }}
                title={colorLabels[i] || `Color ${i + 1}`}
              />
            ); })}
          </div>
          <button onClick={saveAndClose} className="text-neutral-500 hover:text-neutral-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Editable label for current color */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: strip }} />
          <input
            value={colorLabels[colorIdx] ?? ""}
            onChange={(e) => onUpdateLabel(colorIdx, e.target.value)}
            placeholder="Label this color…"
            className="text-xs text-neutral-400 bg-transparent outline-none border-b border-transparent focus:border-neutral-600 flex-1 pb-0.5 placeholder:text-neutral-600 transition-colors"
          />
        </div>

        <div className="px-4 pb-4 flex flex-col gap-4 overflow-y-auto">
          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-neutral-100 font-semibold text-lg outline-none border-b border-neutral-700 focus:border-neutral-400 pb-1 transition-colors placeholder:text-neutral-600"
            placeholder="Card title"
            autoFocus
          />

          {/* Short Details */}
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5 block">Short Details</label>
            <input
              value={shortDetails}
              onChange={(e) => setShortDetails(e.target.value)}
              placeholder="Subtitle or brief summary visible on the card…"
              className="w-full bg-neutral-700 text-neutral-200 text-sm rounded-lg px-3 py-2 outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-500"
            />
          </div>

          {/* Details */}
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5 block">Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add details, acceptance criteria, links, notes…"
              rows={6}
              className="w-full bg-neutral-700 text-neutral-200 text-sm rounded-lg px-3 py-2.5 resize-none outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-500 leading-relaxed"
            />
          </div>

          {/* To Do list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-neutral-500 uppercase tracking-wider">To Do</label>
              <button
                onClick={() => setShowTodos((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                title={showTodos ? "Hide on card" : "Show on card"}
              >
                <span className="text-neutral-600">show on card</span>
                <div className="relative w-7 h-4 rounded-full transition-colors" style={{ background: showTodos ? strip : "#404040" }}>
                  <div className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all" style={{ left: showTodos ? "calc(100% - 14px)" : "2px" }} />
                </div>
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {todos.map((todo) => (
                <div key={todo.id} className="group flex items-center gap-2">
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className="shrink-0 w-4 h-4 rounded-full border transition-all flex items-center justify-center"
                    style={{ borderColor: todo.done ? strip : "#525252", background: todo.done ? strip : "transparent" }}
                  >
                    {todo.done && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span
                    className="flex-1 text-sm leading-snug"
                    style={{ color: todo.done ? "#525252" : "#d4d4d4", textDecoration: todo.done ? "line-through" : "none" }}
                  >
                    {todo.text}
                  </span>
                  <button onClick={() => deleteTodo(todo.id)} className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="shrink-0 w-4 h-4 rounded-full border border-neutral-600" />
              <input
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTodo(); } }}
                placeholder="Add an item…"
                className="flex-1 text-sm text-neutral-300 bg-transparent outline-none placeholder:text-neutral-600"
              />
              {newTodo.trim() && (
                <button onClick={addTodo} className="text-xs text-neutral-500 hover:text-neutral-200 transition-colors">Add</button>
              )}
            </div>
          </div>

          {/* Assignment */}
          {members.length > 0 && (
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">Assigned To</label>
              <div className="flex flex-wrap gap-1.5">
                {members.map((member) => {
                  const isAssigned = assignedUserIds.includes(member.id);
                  const displayName = member.username ?? member.name ?? "Unknown";
                  const isMe = member.id === currentUserId;
                  return (
                    <button
                      key={member.id}
                      onClick={() =>
                        setAssignedUserIds((prev) =>
                          isAssigned ? prev.filter((id) => id !== member.id) : [...prev, member.id]
                        )
                      }
                      className={`text-xs px-2.5 py-1 rounded-full transition-colors border ${
                        isAssigned
                          ? "bg-neutral-500 border-neutral-400 text-neutral-100"
                          : "bg-neutral-700 border-neutral-600 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500"
                      }`}
                    >
                      {displayName}{isMe ? " (you)" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Image references */}
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">Reference Images</label>
            {imageRefs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {imageRefs.map((imgId) => {
                  const img = allImages.find((i) => i.id === imgId);
                  return (
                    <div key={imgId} className="group flex items-center gap-1.5 bg-neutral-700 rounded-md px-2 py-1">
                      {img ? (
                        <img src={img.src} className="h-6 w-auto max-w-[40px] object-cover rounded" />
                      ) : (
                        <div className="h-6 w-6 bg-neutral-600 rounded" />
                      )}
                      <span className="text-xs text-sky-300">Ref Board</span>
                      {onImageRefClick && (
                        <button
                          onClick={() => { saveAndClose(); onImageRefClick(imgId); }}
                          className="text-neutral-500 hover:text-neutral-200 transition-colors"
                          title="Open in Reference Board"
                        >
                          <ExternalLink size={11} />
                        </button>
                      )}
                      <button
                        onClick={() => setImageRefs((prev) => prev.filter((id) => id !== imgId))}
                        className="text-neutral-600 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <Images size={13} />
              {showPicker ? "Hide picker" : "Add from Reference Board"}
            </button>
            {showPicker && (
              <div className="mt-2 grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto bg-neutral-900 rounded-lg p-2">
                {allImages.length === 0 && (
                  <p className="col-span-5 text-xs text-neutral-600 text-center py-4">No images on the Reference Board yet.</p>
                )}
                {allImages.map((img) => {
                  const selected = imageRefs.includes(img.id);
                  return (
                    <button
                      key={img.id}
                      onClick={() =>
                        setImageRefs((prev) =>
                          selected ? prev.filter((id) => id !== img.id) : [...prev, img.id]
                        )
                      }
                      className="relative rounded overflow-hidden aspect-square"
                      style={{ outline: selected ? `2px solid ${strip}` : "2px solid transparent" }}
                      title={selected ? "Remove" : "Add"}
                    >
                      <img src={img.src} className="w-full h-full object-cover" />
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${strip}55` }}>
                          <svg width="14" height="14" viewBox="0 0 8 8" fill="none">
                            <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-700">
          {confirmDelete ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-neutral-400">Delete this card?</span>
              <button onClick={onDelete} className="text-red-400 hover:text-red-300 font-medium transition-colors">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-neutral-500 hover:text-neutral-300 transition-colors">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-neutral-600 hover:text-red-400 transition-colors">
              Delete card
            </button>
          )}
          <button onClick={saveAndClose} className="text-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg px-4 py-1.5 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
