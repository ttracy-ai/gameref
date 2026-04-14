"use client";

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Plus, X } from "lucide-react";

const STORAGE_KEY = "gameref_progress_v1";

const CARD_COLORS = [
  { strip: "#737373" },  // 0: gray
  { strip: "#f59e0b" },  // 1: amber
  { strip: "#ec4899" },  // 2: pink
  { strip: "#3b82f6" },  // 3: blue
  { strip: "#22c55e" },  // 4: green
  { strip: "#a855f7" },  // 5: purple
  { strip: "#f97316" },  // 6: orange
];

const DEFAULT_COLOR_LABELS = ["Misc", "", "", "Code", "Art", "Audio", "Other"];

// Display order for the color swatches in the card modal.
// Indices reference CARD_COLORS: 0=gray,1=amber,2=pink,3=blue,4=green,5=purple,6=orange
const SWATCH_ORDER = [0, 4, 3, 5, 6, 1, 2]; // gray, green, blue, purple, orange, amber, pink

const DEFAULT_COLUMNS: Column[] = [
  { id: "backlog",  title: "Backlog" },
  { id: "todo",     title: "To Do" },
  { id: "working",  title: "Working" },
  { id: "qa",       title: "QA" },
  { id: "complete", title: "Complete" },
];

type Card = {
  id: string;
  title: string;
  shortDetails: string;
  details: string;
  colorIdx: number;
};

type Column = {
  id: string;
  title: string;
};

type BoardState = {
  columns: Column[];
  cards: Record<string, Card[]>;
  colorLabels: string[];
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultState(): BoardState {
  return {
    columns: DEFAULT_COLUMNS,
    cards: Object.fromEntries(DEFAULT_COLUMNS.map((c) => [c.id, []])),
    colorLabels: DEFAULT_COLOR_LABELS,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProgressBoard() {
  const [board, setBoard] = useState<BoardState | null>(null);
  const [editingCard, setEditingCard] = useState<{ colId: string; card: Card } | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BoardState;
        if (!parsed.colorLabels) parsed.colorLabels = DEFAULT_COLOR_LABELS;
        setBoard(parsed);
      } else {
        setBoard(defaultState());
      }
    } catch {
      setBoard(defaultState());
    }
  }, []);

  function update(fn: (prev: BoardState) => BoardState) {
    setBoard((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function onDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    update((prev) => {
      const cards = { ...prev.cards };
      const src = [...(cards[source.droppableId] ?? [])];
      const [moved] = src.splice(source.index, 1);

      if (source.droppableId === destination.droppableId) {
        src.splice(destination.index, 0, moved);
        cards[source.droppableId] = src;
      } else {
        const dst = [...(cards[destination.droppableId] ?? [])];
        dst.splice(destination.index, 0, moved);
        cards[source.droppableId] = src;
        cards[destination.droppableId] = dst;
      }
      return { ...prev, cards };
    });
  }

  function addCard(colId: string) {
    const title = newCardTitle.trim();
    if (!title) {
      setAddingTo(null);
      return;
    }
    const card: Card = { id: makeId(), title, shortDetails: "", details: "", colorIdx: 0 };
    update((prev) => ({
      ...prev,
      cards: { ...prev.cards, [colId]: [...(prev.cards[colId] ?? []), card] },
    }));
    setNewCardTitle("");
    setAddingTo(null);
  }

  function updateCard(colId: string, updated: Card) {
    update((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [colId]: prev.cards[colId].map((c) => (c.id === updated.id ? updated : c)),
      },
    }));
  }

  function deleteCard(colId: string, cardId: string) {
    update((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [colId]: prev.cards[colId].filter((c) => c.id !== cardId),
      },
    }));
    setEditingCard(null);
  }

  function updateColorLabel(idx: number, label: string) {
    update((prev) => {
      const colorLabels = [...prev.colorLabels];
      colorLabels[idx] = label;
      return { ...prev, colorLabels };
    });
  }

  if (!board) return null;

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 p-4 h-full overflow-x-auto overflow-y-hidden">
          {board.columns.map((col) => {
            const colCards = board.cards[col.id] ?? [];
            return (
              <div
                key={col.id}
                className="flex flex-col flex-1 min-w-0 rounded-xl bg-neutral-800 max-h-full"
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
                  <span className="text-sm font-semibold text-neutral-200">
                    {col.title}
                  </span>
                  <span className="text-xs text-neutral-500 bg-neutral-700 rounded-full px-2 py-0.5 tabular-nums">
                    {colCards.length}
                  </span>
                </div>

                {/* Cards */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto min-h-0 px-2 pb-1 flex flex-col gap-2 transition-colors rounded-lg ${
                        snapshot.isDraggingOver ? "bg-neutral-700/20" : ""
                      }`}
                    >
                      {colCards.map((card, index) => {
                        const strip = CARD_COLORS[card.colorIdx]?.strip ?? CARD_COLORS[0].strip;
                        const label = board.colorLabels[card.colorIdx] ?? "";
                        return (
                          <Draggable
                            key={card.id}
                            draggableId={card.id}
                            index={index}
                          >
                            {(drag, dragSnapshot) => (
                              <div
                                ref={drag.innerRef}
                                {...drag.draggableProps}
                                {...drag.dragHandleProps}
                                onClick={() =>
                                  setEditingCard({ colId: col.id, card })
                                }
                                className={`rounded-lg cursor-pointer select-none transition-all overflow-hidden ${
                                  dragSnapshot.isDragging
                                    ? "shadow-2xl shadow-black/60 opacity-95 rotate-1"
                                    : "hover:brightness-110"
                                }`}
                                style={{
                                  background: `color-mix(in srgb, ${strip} 18%, #e8e8e8)`,
                                  borderLeft: `4px solid ${strip}`,
                                  ...drag.draggableProps.style,
                                }}
                              >
                                <div className="px-3 py-2.5">
                                  {label && (
                                    <p
                                      className="text-xs font-semibold uppercase tracking-wider mb-1"
                                      style={{ color: strip, fontSize: 10 }}
                                    >
                                      {label}
                                    </p>
                                  )}
                                  <p className="text-sm text-neutral-900 leading-snug font-medium">
                                    {card.title}
                                  </p>
                                  {card.shortDetails && (
                                    <p className="text-xs text-neutral-700 mt-0.5 line-clamp-2 leading-relaxed">
                                      {card.shortDetails}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Add card */}
                <div className="shrink-0 px-2 pb-2">
                  {addingTo === col.id ? (
                    <div className="bg-neutral-700/50 rounded-lg p-2">
                      <textarea
                        autoFocus
                        value={newCardTitle}
                        onChange={(e) => setNewCardTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            addCard(col.id);
                          }
                          if (e.key === "Escape") {
                            setAddingTo(null);
                            setNewCardTitle("");
                          }
                        }}
                        placeholder="Card title…"
                        rows={2}
                        className="w-full bg-neutral-700 text-neutral-100 text-sm rounded-md px-2.5 py-1.5 resize-none outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-500"
                      />
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => addCard(col.id)}
                          className="text-xs bg-neutral-600 hover:bg-neutral-500 text-neutral-100 rounded-md px-3 py-1 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setAddingTo(null);
                            setNewCardTitle("");
                          }}
                          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTo(col.id)}
                      className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700/40 rounded-lg transition-colors"
                    >
                      <Plus size={13} />
                      Add card
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {editingCard && (
        <CardModal
          card={editingCard.card}
          colorLabels={board.colorLabels}
          onUpdate={(updated) => {
            updateCard(editingCard.colId, updated);
            setEditingCard({ ...editingCard, card: updated });
          }}
          onUpdateLabel={updateColorLabel}
          onDelete={() => deleteCard(editingCard.colId, editingCard.card.id)}
          onClose={() => setEditingCard(null)}
        />
      )}
    </main>
  );
}

// ─── Card detail modal ────────────────────────────────────────────────────────

function CardModal({
  card,
  colorLabels,
  onUpdate,
  onUpdateLabel,
  onDelete,
  onClose,
}: {
  card: Card;
  colorLabels: string[];
  onUpdate: (card: Card) => void;
  onUpdateLabel: (idx: number, label: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [shortDetails, setShortDetails] = useState(card.shortDetails ?? "");
  const [details, setDetails] = useState(card.details);
  const [colorIdx, setColorIdx] = useState(card.colorIdx);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function saveAndClose() {
    onUpdate({
      ...card,
      title: title.trim() || card.title,
      shortDetails,
      details,
      colorIdx,
    });
    onClose();
  }

  const strip = CARD_COLORS[colorIdx]?.strip ?? CARD_COLORS[0].strip;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={saveAndClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
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
          <button
            onClick={saveAndClose}
            className="text-neutral-500 hover:text-neutral-200 transition-colors"
          >
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

        <div className="px-4 pb-4 flex flex-col gap-4">
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
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5 block">
              Short Details
            </label>
            <input
              value={shortDetails}
              onChange={(e) => setShortDetails(e.target.value)}
              placeholder="Subtitle or brief summary visible on the card…"
              className="w-full bg-neutral-700 text-neutral-200 text-sm rounded-lg px-3 py-2 outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-500"
            />
          </div>

          {/* Details */}
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5 block">
              Details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add details, acceptance criteria, links, notes…"
              rows={6}
              className="w-full bg-neutral-700 text-neutral-200 text-sm rounded-lg px-3 py-2.5 resize-none outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-500 leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-700">
          {confirmDelete ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-neutral-400">Delete this card?</span>
              <button
                onClick={onDelete}
                className="text-red-400 hover:text-red-300 font-medium transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-neutral-600 hover:text-red-400 transition-colors"
            >
              Delete card
            </button>
          )}
          <button
            onClick={saveAndClose}
            className="text-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg px-4 py-1.5 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
