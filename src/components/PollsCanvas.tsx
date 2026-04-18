"use client";

import { useState, useEffect } from "react";
import { Plus, X, Trash2, Pencil, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult, DraggableProvidedDraggableProps, DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { loadCanvasData, syncCanvasData } from "@/lib/canvasStorage";
import { RoomProvider, useStorage, useMutation } from "@/lib/liveblocks-polls";
import CanvasLoader from "@/components/CanvasLoader";


// ── Types ─────────────────────────────────────────────────────────────────────

type PollOption = {
  id: string;
  text: string;
  voterIds: string[];
};

type Poll = {
  id: string;
  question: string;
  options: PollOption[];
};

type PollsState = {
  polls: Poll[];
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultState(): PollsState {
  return { polls: [] };
}

// ── Outer shell ───────────────────────────────────────────────────────────────

export default function PollsCanvas({ projectId }: { projectId: string }) {
  const STORAGE_KEY = `gameref_polls_${projectId}_v1`;
  const [initialJson, setInitialJson] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const dbData = await loadCanvasData(projectId, "polls");
      if (dbData) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dbData)); } catch {}
        setInitialJson(JSON.stringify(dbData));
        return;
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          setInitialJson(raw);
          syncCanvasData(projectId, "polls", JSON.parse(raw));
        } else {
          setInitialJson(JSON.stringify(defaultState()));
        }
      } catch {
        setInitialJson(JSON.stringify(defaultState()));
      }
    })();
  }, [projectId]);

  if (!initialJson) return <CanvasLoader />;

  return (
    <RoomProvider id={`polls_${projectId}`} initialStorage={{ pollsJson: initialJson }}>
      <PollsCanvasInner projectId={projectId} />
    </RoomProvider>
  );
}

// ── Inner component ───────────────────────────────────────────────────────────

function PollsCanvasInner({ projectId }: { projectId: string }) {
  const STORAGE_KEY = `gameref_polls_${projectId}_v1`;

  const pollsJson    = useStorage((root) => root.pollsJson);
  const setPollsJson = useMutation(({ storage }, json: string) => {
    storage.set("pollsJson", json);
  }, []);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newPollIds, setNewPollIds]        = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setCurrentUserId(data?.user?.id ?? null))
      .catch(() => {});
  }, []);

  if (!pollsJson) return <CanvasLoader />;

  const state = JSON.parse(pollsJson) as PollsState;

  function update(fn: (prev: PollsState) => PollsState) {
    const next = fn(state);
    const nextJson = JSON.stringify(next);
    try { localStorage.setItem(STORAGE_KEY, nextJson); } catch {}
    syncCanvasData(projectId, "polls", next);
    setPollsJson(nextJson);
  }

  function addPoll() {
    const id = makeId();
    const poll: Poll = {
      id,
      question: "",
      options: [
        { id: makeId(), text: "", voterIds: [] },
        { id: makeId(), text: "", voterIds: [] },
      ],
    };
    setNewPollIds((prev) => new Set(prev).add(id));
    update((prev) => ({ ...prev, polls: [...prev.polls, poll] }));
  }

  function updatePoll(id: string, patch: Partial<Poll>) {
    update((prev) => ({
      ...prev,
      polls: prev.polls.map((p) => p.id === id ? { ...p, ...patch } : p),
    }));
  }

  function deletePoll(id: string) {
    update((prev) => ({ ...prev, polls: prev.polls.filter((p) => p.id !== id) }));
  }

  function vote(pollId: string, optionId: string) {
    if (!currentUserId) return;
    update((prev) => ({
      ...prev,
      polls: prev.polls.map((p) => {
        if (p.id !== pollId) return p;
        const alreadyVoted = p.options.find((o) => o.id === optionId)?.voterIds.includes(currentUserId);
        return {
          ...p,
          options: p.options.map((o) => {
            if (o.id === optionId) {
              // toggle this option
              return {
                ...o,
                voterIds: alreadyVoted
                  ? o.voterIds.filter((id) => id !== currentUserId)
                  : [...o.voterIds, currentUserId],
              };
            }
            // single-choice: remove vote from all other options
            return { ...o, voterIds: o.voterIds.filter((id) => id !== currentUserId) };
          }),
        };
      }),
    }));
  }

  function onDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;
    update((prev) => {
      const polls = [...prev.polls];
      const [moved] = polls.splice(source.index, 1);
      polls.splice(destination.index, 0, moved);
      return { ...prev, polls };
    });
  }

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="polls-columns" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex gap-3 p-4 h-full overflow-x-auto overflow-y-hidden"
            >
              {state.polls.map((poll, index) => (
                <Draggable key={poll.id} draggableId={poll.id} index={index}>
                  {(drag, snapshot) => (
                    <PollColumn
                      poll={poll}
                      currentUserId={currentUserId}
                      initialEditing={newPollIds.has(poll.id)}
                      isDragging={snapshot.isDragging}
                      draggableRef={drag.innerRef}
                      draggableProps={drag.draggableProps}
                      dragHandleProps={drag.dragHandleProps}
                      onUpdate={(patch) => updatePoll(poll.id, patch)}
                      onVote={(optionId) => vote(poll.id, optionId)}
                      onDelete={() => deletePoll(poll.id)}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {/* Add Poll */}
              <div
                style={{ flexShrink: 0, width: "calc(20% - 9.6px)" }}
                className="flex items-center justify-center rounded-xl border-2 border-dashed border-neutral-700 hover:border-neutral-500 transition-colors cursor-pointer group min-h-0"
                onClick={addPoll}
              >
                <div className="flex flex-col items-center gap-2 text-neutral-600 group-hover:text-neutral-400 transition-colors select-none">
                  <Plus size={24} />
                  <span className="text-sm">New Poll</span>
                </div>
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </main>
  );
}

// ── Poll column ───────────────────────────────────────────────────────────────

function PollColumn({
  poll,
  currentUserId,
  initialEditing,
  isDragging,
  draggableRef,
  draggableProps,
  dragHandleProps,
  onUpdate,
  onVote,
  onDelete,
}: {
  poll: Poll;
  currentUserId: string | null;
  initialEditing: boolean;
  isDragging: boolean;
  draggableRef: (el: HTMLElement | null) => void;
  draggableProps: DraggableProvidedDraggableProps;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
  onUpdate: (patch: Partial<Poll>) => void;
  onVote: (optionId: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing]             = useState(initialEditing);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const totalVotes = poll.options.reduce((sum, o) => sum + o.voterIds.length, 0);
  const myVotedId  = poll.options.find((o) =>
    currentUserId && o.voterIds.includes(currentUserId)
  )?.id ?? null;

  function updateOption(optionId: string, text: string) {
    onUpdate({
      options: poll.options.map((o) => o.id === optionId ? { ...o, text } : o),
    });
  }

  function addOption() {
    onUpdate({
      options: [...poll.options, { id: Math.random().toString(36).slice(2, 10), text: "", voterIds: [] }],
    });
  }

  function removeOption(optionId: string) {
    if (poll.options.length <= 2) return; // minimum 2 options
    onUpdate({ options: poll.options.filter((o) => o.id !== optionId) });
  }

  return (
    <div
      ref={draggableRef}
      {...draggableProps}
      style={{ flexShrink: 0, width: "calc(20% - 9.6px)", ...draggableProps.style }}
      className={`flex flex-col rounded-xl bg-neutral-800 max-h-full overflow-hidden transition-shadow ${
        isDragging ? "shadow-2xl shadow-black/70 opacity-95" : ""
      }`}
    >
      {/* Question header */}
      <div className="shrink-0 px-4 pt-3 pb-3 border-b border-neutral-700/60 flex items-center gap-2">
        <div
          {...dragHandleProps}
          className="shrink-0 text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing transition-colors"
        >
          <GripVertical size={15} />
        </div>
        {editing ? (
          <input
            value={poll.question}
            onChange={(e) => onUpdate({ question: e.target.value })}
            className="flex-1 bg-transparent text-neutral-100 font-bold text-xl outline-none border-b border-neutral-600 pb-1 placeholder:text-neutral-600 transition-colors"
            placeholder="Poll question…"
            autoFocus
          />
        ) : (
          <h2 className="flex-1 text-xl font-bold text-neutral-100 leading-tight break-words">
            {poll.question || <span className="text-neutral-600 font-normal italic">Untitled poll</span>}
          </h2>
        )}
      </div>

      {/* Scrollable body */}
      <div className="scrollbar-dark flex-1 overflow-y-auto min-h-0 px-4 py-4 flex flex-col gap-3">

        {editing ? (
          // ── Edit mode ──
          <>
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Options</p>
            {poll.options.map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-neutral-600 shrink-0" />
                <input
                  value={option.text}
                  onChange={(e) => updateOption(option.id, e.target.value)}
                  placeholder="Option text…"
                  className="flex-1 bg-neutral-700/60 text-neutral-200 text-sm rounded-lg px-3 py-1.5 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-500"
                />
                <button
                  onClick={() => removeOption(option.id)}
                  disabled={poll.options.length <= 2}
                  className="shrink-0 text-neutral-600 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={addOption}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors mt-1"
            >
              <Plus size={13} />
              Add option
            </button>
          </>
        ) : (
          // ── Vote mode ──
          <>
            {poll.options.map((option) => {
              const votes   = option.voterIds.length;
              const pct     = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
              const isMyVote = option.id === myVotedId;
              return (
                <button
                  key={option.id}
                  onClick={() => onVote(option.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                    isMyVote
                      ? "bg-lime-500/10 ring-1 ring-lime-500/40"
                      : "bg-neutral-700/40 hover:bg-neutral-700/70"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    {/* Vote indicator */}
                    <div
                      className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isMyVote ? "border-lime-500 bg-lime-500" : "border-neutral-500"
                      }`}
                    >
                      {isMyVote && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className={`flex-1 text-sm leading-snug ${isMyVote ? "text-neutral-100 font-medium" : "text-neutral-300"}`}>
                      {option.text || <span className="italic text-neutral-600">Untitled option</span>}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                      {votes}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isMyVote ? "bg-lime-500" : "bg-neutral-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-right text-xs text-neutral-600 mt-1 tabular-nums">{pct}%</p>
                </button>
              );
            })}

            {/* Total votes */}
            <p className="text-xs text-neutral-600 text-center pt-1">
              {totalVotes === 0
                ? "No votes yet"
                : `${totalVotes} vote${totalVotes !== 1 ? "s" : ""} total`}
            </p>
          </>
        )}

      </div>

      {/* Footer */}
      <div className="shrink-0 px-3 py-2.5 border-t border-neutral-700/50 flex items-center justify-between">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">Delete this poll?</span>
            <button onClick={onDelete} className="text-red-400 hover:text-red-300 font-medium transition-colors">
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-neutral-500 hover:text-neutral-300 transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-neutral-600 hover:text-red-400 transition-colors"
              title="Delete poll"
            >
              <Trash2 size={14} />
            </button>
            {editing ? (
              <button
                onClick={() => setEditing(false)}
                className="text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg px-3 py-1 transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-200 hover:bg-neutral-700 rounded-lg px-3 py-1 transition-colors"
              >
                <Pencil size={12} />
                Edit
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
