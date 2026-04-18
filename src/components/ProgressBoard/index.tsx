"use client";

// ProgressBoard — Kanban board with real-time sync via Liveblocks.
// Outer: loads from DB/localStorage, seeds RoomProvider.
// Inner: reads/writes Liveblocks storage for live updates across clients.

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import { loadCanvasData, syncCanvasData } from "@/lib/canvasStorage";
import { RoomProvider, useStorage, useMutation } from "@/lib/liveblocks-kanban";
import {
  CardModal, CARD_COLORS, DEFAULT_COLOR_LABELS, makeId,
  type Card, type Member, type RefBoardImage,
} from "./CardModal";
import CanvasLoader from "@/components/CanvasLoader";


// ── Types ─────────────────────────────────────────────────────────────────────

type Column = { id: string; title: string };

type BoardState = {
  columns: Column[];
  cards: Record<string, Card[]>;
  colorLabels: string[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: Column[] = [
  { id: "backlog",  title: "Backlog"  },
  { id: "todo",     title: "To Do"    },
  { id: "working",  title: "Working"  },
  { id: "qa",       title: "QA"       },
  { id: "complete", title: "Complete" },
];

function defaultState(): BoardState {
  return {
    columns: DEFAULT_COLUMNS,
    cards: Object.fromEntries(DEFAULT_COLUMNS.map((c) => [c.id, []])),
    colorLabels: DEFAULT_COLOR_LABELS,
  };
}

// ── Outer shell: loads from DB then mounts the Liveblocks room ────────────────

export default function ProgressBoard({ projectId, onImageRefClick }: {
  projectId: string;
  onImageRefClick?: (imageId: string) => void;
}) {
  const STORAGE_KEY = `gameref_progress_${projectId}_v1`;
  const [initialBoardJson, setInitialBoardJson] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const dbData = await loadCanvasData(projectId, "progress");
      if (dbData) {
        const parsed = dbData as BoardState;
        if (!parsed.colorLabels) parsed.colorLabels = DEFAULT_COLOR_LABELS;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); } catch {}
        setInitialBoardJson(JSON.stringify(parsed));
        return;
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as BoardState;
          if (!parsed.colorLabels) parsed.colorLabels = DEFAULT_COLOR_LABELS;
          setInitialBoardJson(JSON.stringify(parsed));
          syncCanvasData(projectId, "progress", parsed);
        } else {
          setInitialBoardJson(JSON.stringify(defaultState()));
        }
      } catch {
        setInitialBoardJson(JSON.stringify(defaultState()));
      }
    })();
  }, [projectId]);

  if (!initialBoardJson) return <CanvasLoader />;

  return (
    <RoomProvider id={`progress_${projectId}`} initialStorage={{ boardJson: initialBoardJson }}>
      <ProgressBoardInner key={projectId} projectId={projectId} onImageRefClick={onImageRefClick} />
    </RoomProvider>
  );
}

// ── Inner board: reads/writes Liveblocks storage for real-time sync ───────────

function ProgressBoardInner({ projectId, onImageRefClick }: {
  projectId: string;
  onImageRefClick?: (imageId: string) => void;
}) {
  const STORAGE_KEY  = `gameref_progress_${projectId}_v1`;
  const REFBOARD_KEY = `gameref_refboard_${projectId}_v1`;

  const boardJson    = useStorage((root) => root.boardJson);
  const setBoardJson = useMutation(({ storage }, newJson: string) => {
    storage.set("boardJson", newJson);
  }, []);

  const [editingCard, setEditingCard] = useState<{ colId: string; card: Card } | null>(null);
  const [addingTo, setAddingTo]       = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [refImages, setRefImages]     = useState<RefBoardImage[]>([]);
  const [members, setMembers]         = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REFBOARD_KEY);
      if (raw) setRefImages(JSON.parse(raw) as RefBoardImage[]);
    } catch {}
  }, []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/members`)
      .then((r) => r.json())
      .then((data) => {
        setMembers(data.members ?? []);
        setCurrentUserId(data.currentUserId ?? null);
      })
      .catch(() => {});
  }, [projectId]);

  if (!boardJson) return <CanvasLoader />;

  const board = JSON.parse(boardJson) as BoardState;

  function update(fn: (prev: BoardState) => BoardState) {
    const next = fn(board);
    const nextJson = JSON.stringify(next);
    try { localStorage.setItem(STORAGE_KEY, nextJson); } catch {}
    syncCanvasData(projectId, "progress", next);
    setBoardJson(nextJson);
  }

  function onDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

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
    if (!title) { setAddingTo(null); return; }
    const card: Card = {
      id: makeId(), title, shortDetails: "", details: "", colorIdx: 0,
      todos: [], imageRefs: [], showTodos: false,
      authorId: currentUserId ?? undefined,
      assignedUserIds: [],
    };
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
      cards: { ...prev.cards, [colId]: prev.cards[colId].filter((c) => c.id !== cardId) },
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

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 p-4 h-full overflow-x-auto overflow-y-hidden">
          {board.columns.map((col) => {
            const colCards = board.cards[col.id] ?? [];
            return (
              <div key={col.id} className="flex flex-col flex-1 min-w-0 rounded-xl bg-neutral-800 max-h-full">
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
                  <span className="text-sm font-semibold text-neutral-200">{col.title}</span>
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
                      className={`scrollbar-dark flex-1 overflow-y-auto min-h-0 px-2 pb-1 flex flex-col gap-2 transition-colors rounded-lg ${
                        snapshot.isDraggingOver ? "bg-neutral-700/20" : ""
                      }`}
                    >
                      {colCards.map((card, index) => {
                        const strip = CARD_COLORS[card.colorIdx]?.strip ?? CARD_COLORS[0].strip;
                        const label = board.colorLabels[card.colorIdx] ?? "";
                        return (
                          <Draggable key={card.id} draggableId={card.id} index={index}>
                            {(drag, dragSnapshot) => (
                              <div
                                ref={drag.innerRef}
                                {...drag.draggableProps}
                                {...drag.dragHandleProps}
                                onClick={() => setEditingCard({ colId: col.id, card })}
                                className={`shrink-0 rounded-lg cursor-pointer select-none transition-all overflow-hidden ${
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
                                  {(() => {
                                    const assignedIds = card.assignedUserIds ?? card.assignedUsers?.map((u) => u.id) ?? [];
                                    const assignedMembers = assignedIds.map((id) => members.find((m) => m.id === id)).filter(Boolean) as Member[];
                                    const author = members.find((m) => m.id === card.authorId);
                                    const byLine = assignedMembers.length > 0
                                      ? `Assigned: ${assignedMembers.map((m) => m.username ?? m.name ?? "?").join(", ")}`
                                      : author
                                      ? `Author: ${author.username ?? author.name}`
                                      : null;
                                    return (label || byLine) ? (
                                      <div className="flex items-start justify-between gap-1 mb-1">
                                        <span className="font-semibold uppercase tracking-wider" style={{ color: strip, fontSize: 10 }}>{label}</span>
                                        {byLine && (
                                          <span className="text-right shrink-0 truncate max-w-[55%]" style={{ fontSize: 10, color: "#737373", lineHeight: 1.3 }}>
                                            {byLine}
                                          </span>
                                        )}
                                      </div>
                                    ) : null;
                                  })()}
                                  <p className="text-sm text-neutral-900 leading-snug font-medium">{card.title}</p>
                                  {card.shortDetails && (
                                    <p className="text-xs text-neutral-700 mt-0.5 line-clamp-2 leading-relaxed">{card.shortDetails}</p>
                                  )}
                                  {card.showTodos && (card.todos ?? []).length > 0 && (
                                    <div className="mt-1.5 flex flex-col gap-1">
                                      {(card.todos ?? []).map((todo) => (
                                        <div key={todo.id} className="flex items-center gap-1.5">
                                          <div
                                            className="shrink-0 w-3 h-3 rounded-full border flex items-center justify-center"
                                            style={{ borderColor: todo.done ? strip : "#737373", background: todo.done ? strip : "transparent" }}
                                          >
                                            {todo.done && (
                                              <svg width="6" height="6" viewBox="0 0 8 8" fill="none">
                                                <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                              </svg>
                                            )}
                                          </div>
                                          <span
                                            className="text-xs leading-snug truncate"
                                            style={{ color: todo.done ? "#737373" : "#404040", textDecoration: todo.done ? "line-through" : "none" }}
                                          >
                                            {todo.text}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {(card.imageRefs ?? []).length > 0 && (
                                  <div className="flex gap-1 px-3 pb-2.5">
                                    {(card.imageRefs ?? []).map((imgId) => {
                                      const img = refImages.find((i) => i.id === imgId);
                                      return img ? (
                                        <img key={imgId} src={img.src} className="h-10 w-10 object-cover rounded flex-shrink-0" style={{ boxShadow: `0 0 0 1.5px ${strip}44` }} />
                                      ) : null;
                                    })}
                                  </div>
                                )}
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
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addCard(col.id); }
                          if (e.key === "Escape") { setAddingTo(null); setNewCardTitle(""); }
                        }}
                        placeholder="Card title…"
                        rows={2}
                        className="w-full bg-neutral-700 text-neutral-100 text-sm rounded-md px-2.5 py-1.5 resize-none outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-500"
                      />
                      <div className="flex gap-2 mt-1.5">
                        <button onClick={() => addCard(col.id)} className="text-xs bg-neutral-600 hover:bg-neutral-500 text-neutral-100 rounded-md px-3 py-1 transition-colors">Add</button>
                        <button onClick={() => { setAddingTo(null); setNewCardTitle(""); }} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Cancel</button>
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
          refboardKey={REFBOARD_KEY}
          members={members}
          currentUserId={currentUserId}
          onUpdate={(updated) => {
            updateCard(editingCard.colId, updated);
            setEditingCard({ ...editingCard, card: updated });
          }}
          onUpdateLabel={updateColorLabel}
          onImageRefClick={onImageRefClick}
          onDelete={() => deleteCard(editingCard.colId, editingCard.card.id)}
          onClose={() => setEditingCard(null)}
        />
      )}
    </main>
  );
}
