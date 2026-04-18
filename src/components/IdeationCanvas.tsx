"use client";

import { useState, useEffect } from "react";
import { Plus, X, Images, Trash2, Pencil, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult, DraggableProvidedDraggableProps, DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { loadCanvasData, syncCanvasData } from "@/lib/canvasStorage";
import { RoomProvider, useStorage, useMutation } from "@/lib/liveblocks-ideation";
import CanvasLoader from "@/components/CanvasLoader";


// ── Types ─────────────────────────────────────────────────────────────────────

type IdeaColumn = {
  id: string;
  title: string;
  pitch: string;
  imageRefs: string[];
  details: string;
};

type IdeationState = {
  ideas: IdeaColumn[];
};

type RefBoardImage = { id: string; src: string };

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultState(): IdeationState {
  return { ideas: [] };
}

// ── Outer shell ───────────────────────────────────────────────────────────────

export default function IdeationCanvas({ projectId }: { projectId: string }) {
  const STORAGE_KEY = `gameref_ideation_${projectId}_v1`;
  const [initialJson, setInitialJson] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const dbData = await loadCanvasData(projectId, "ideation");
      if (dbData) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dbData)); } catch {}
        setInitialJson(JSON.stringify(dbData));
        return;
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          setInitialJson(raw);
          syncCanvasData(projectId, "ideation", JSON.parse(raw));
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
    <RoomProvider id={`ideation_${projectId}`} initialStorage={{ ideationJson: initialJson }}>
      <IdeationCanvasInner projectId={projectId} />
    </RoomProvider>
  );
}

// ── Inner component ───────────────────────────────────────────────────────────

function IdeationCanvasInner({ projectId }: { projectId: string }) {
  const STORAGE_KEY  = `gameref_ideation_${projectId}_v1`;
  const REFBOARD_KEY = `gameref_refboard_${projectId}_v1`;

  const ideationJson    = useStorage((root) => root.ideationJson);
  const setIdeationJson = useMutation(({ storage }, json: string) => {
    storage.set("ideationJson", json);
  }, []);

  const [refImages, setRefImages]         = useState<RefBoardImage[]>([]);
  const [showPickerFor, setShowPickerFor] = useState<string | null>(null);
  // IDs of ideas that were just created — start those in edit mode
  const [newIdeaIds, setNewIdeaIds]       = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REFBOARD_KEY);
      if (raw) setRefImages(JSON.parse(raw) as RefBoardImage[]);
    } catch {}
  }, [REFBOARD_KEY]);

  if (!ideationJson) return <CanvasLoader />;

  const state = JSON.parse(ideationJson) as IdeationState;

  function update(fn: (prev: IdeationState) => IdeationState) {
    const next = fn(state);
    const nextJson = JSON.stringify(next);
    try { localStorage.setItem(STORAGE_KEY, nextJson); } catch {}
    syncCanvasData(projectId, "ideation", next);
    setIdeationJson(nextJson);
  }

  function addIdea() {
    const id = makeId();
    const idea: IdeaColumn = { id, title: "", pitch: "", imageRefs: [], details: "" };
    setNewIdeaIds((prev) => new Set(prev).add(id));
    update((prev) => ({ ...prev, ideas: [...prev.ideas, idea] }));
  }

  function updateIdea(id: string, patch: Partial<IdeaColumn>) {
    update((prev) => ({
      ...prev,
      ideas: prev.ideas.map((idea) => idea.id === id ? { ...idea, ...patch } : idea),
    }));
  }

  function deleteIdea(id: string) {
    update((prev) => ({ ...prev, ideas: prev.ideas.filter((idea) => idea.id !== id) }));
    if (showPickerFor === id) setShowPickerFor(null);
  }

  function toggleImageRef(ideaId: string, imgId: string, current: string[]) {
    const next = current.includes(imgId)
      ? current.filter((id) => id !== imgId)
      : [...current, imgId];
    updateIdea(ideaId, { imageRefs: next });
  }

  function onDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;
    update((prev) => {
      const ideas = [...prev.ideas];
      const [moved] = ideas.splice(source.index, 1);
      ideas.splice(destination.index, 0, moved);
      return { ...prev, ideas };
    });
  }

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="ideation-columns" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex gap-3 p-4 h-full overflow-x-auto overflow-y-hidden"
            >
              {state.ideas.map((idea, index) => (
                <Draggable key={idea.id} draggableId={idea.id} index={index}>
                  {(drag, snapshot) => (
                    <IdeaCard
                      idea={idea}
                      refImages={refImages}
                      showPicker={showPickerFor === idea.id}
                      initialEditing={newIdeaIds.has(idea.id)}
                      isDragging={snapshot.isDragging}
                      draggableRef={drag.innerRef}
                      draggableProps={drag.draggableProps}
                      dragHandleProps={drag.dragHandleProps}
                      onTogglePicker={() =>
                        setShowPickerFor(showPickerFor === idea.id ? null : idea.id)
                      }
                      onUpdate={(patch) => updateIdea(idea.id, patch)}
                      onToggleImage={(imgId) => toggleImageRef(idea.id, imgId, idea.imageRefs)}
                      onDelete={() => deleteIdea(idea.id)}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {/* Add Idea — not draggable, always at the end */}
              <div
                style={{ flexShrink: 0, width: "calc(20% - 9.6px)" }}
                className="flex items-center justify-center rounded-xl border-2 border-dashed border-neutral-700 hover:border-neutral-500 transition-colors cursor-pointer group min-h-0"
                onClick={addIdea}
              >
                <div className="flex flex-col items-center gap-2 text-neutral-600 group-hover:text-neutral-400 transition-colors select-none">
                  <Plus size={24} />
                  <span className="text-sm">New Idea</span>
                </div>
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </main>
  );
}

// ── Idea column card ──────────────────────────────────────────────────────────

function IdeaCard({
  idea,
  refImages,
  showPicker,
  initialEditing,
  isDragging,
  draggableRef,
  draggableProps,
  dragHandleProps,
  onTogglePicker,
  onUpdate,
  onToggleImage,
  onDelete,
}: {
  idea: IdeaColumn;
  refImages: RefBoardImage[];
  showPicker: boolean;
  initialEditing: boolean;
  isDragging: boolean;
  draggableRef: (el: HTMLElement | null) => void;
  draggableProps: DraggableProvidedDraggableProps;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
  onTogglePicker: () => void;
  onUpdate: (patch: Partial<IdeaColumn>) => void;
  onToggleImage: (imgId: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing]           = useState(initialEditing);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      ref={draggableRef}
      {...draggableProps}
      style={{ flexShrink: 0, width: "calc(20% - 9.6px)", ...draggableProps.style }}
      className={`flex flex-col rounded-xl bg-neutral-800 max-h-full overflow-hidden transition-shadow ${
        isDragging ? "shadow-2xl shadow-black/70 opacity-95" : ""
      }`}
    >
      {/* Prominent title header — outside the scroll area */}
      <div className="shrink-0 px-4 pt-3 pb-3 border-b border-neutral-700/60 flex items-center gap-2">
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="shrink-0 text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing transition-colors"
        >
          <GripVertical size={15} />
        </div>
        {editing ? (
          <input
            value={idea.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="flex-1 bg-transparent text-neutral-100 font-bold text-xl outline-none border-b border-neutral-600 pb-1 placeholder:text-neutral-600 transition-colors"
            placeholder="Idea title…"
            autoFocus
          />
        ) : (
          <h2 className="flex-1 text-xl font-bold text-neutral-100 leading-tight break-words">
            {idea.title || <span className="text-neutral-600 font-normal italic">Untitled</span>}
          </h2>
        )}
      </div>

      {/* Scrollable body */}
      <div className="scrollbar-dark flex-1 overflow-y-auto min-h-0 px-4 py-4 flex flex-col gap-5">

        {editing ? (
          // ── Edit mode ──
          <>
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5 block">
                Elevator Pitch
              </label>
              <textarea
                value={idea.pitch}
                onChange={(e) => onUpdate({ pitch: e.target.value })}
                placeholder="Describe the idea in a few sentences…"
                rows={4}
                className="w-full bg-neutral-700/60 text-neutral-200 text-sm rounded-lg px-3 py-2 resize-none outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-600 leading-relaxed"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5 block">
                Reference Images
              </label>
              {idea.imageRefs.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {idea.imageRefs.map((imgId) => {
                    const img = refImages.find((i) => i.id === imgId);
                    return (
                      <div
                        key={imgId}
                        className="relative group aspect-square rounded-md overflow-hidden bg-neutral-700"
                      >
                        {img && <img src={img.src} alt="" className="w-full h-full object-cover" />}
                        <button
                          onClick={() => onToggleImage(imgId)}
                          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 bg-black/60 rounded-full p-0.5 text-neutral-300 hover:text-red-400 transition-all"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                onClick={onTogglePicker}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <Images size={13} />
                {showPicker ? "Hide picker" : "Add from Reference Board"}
              </button>
              {showPicker && (
                <div className="mt-2 grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto bg-neutral-900 rounded-lg p-2">
                  {refImages.length === 0 && (
                    <p className="col-span-3 text-xs text-neutral-600 text-center py-4">
                      No images on the Reference Board yet.
                    </p>
                  )}
                  {refImages.map((img) => {
                    const selected = idea.imageRefs.includes(img.id);
                    return (
                      <button
                        key={img.id}
                        onClick={() => onToggleImage(img.id)}
                        className="relative rounded-md overflow-hidden aspect-square"
                        style={{ outline: selected ? "2px solid #a3a3a3" : "2px solid transparent" }}
                      >
                        <img src={img.src} alt="" className="w-full h-full object-cover" />
                        {selected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
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

            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5 block">
                Details
              </label>
              <textarea
                value={idea.details}
                onChange={(e) => onUpdate({ details: e.target.value })}
                placeholder="Additional notes, links, or context…"
                rows={6}
                className="w-full bg-neutral-700/60 text-neutral-200 text-sm rounded-lg px-3 py-2 resize-none outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-600 leading-relaxed"
              />
            </div>
          </>
        ) : (
          // ── View mode ──
          <>
            {idea.pitch && (
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
                  Elevator Pitch
                </p>
                <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                  {idea.pitch}
                </p>
              </div>
            )}

            {idea.imageRefs.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
                  Reference Images
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {idea.imageRefs.map((imgId) => {
                    const img = refImages.find((i) => i.id === imgId);
                    return img ? (
                      <div
                        key={imgId}
                        className="aspect-square rounded-md overflow-hidden bg-neutral-700"
                      >
                        <img src={img.src} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {idea.details && (
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
                  Details
                </p>
                <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                  {idea.details}
                </p>
              </div>
            )}

            {!idea.pitch && !idea.details && idea.imageRefs.length === 0 && (
              <p className="text-sm text-neutral-600 italic">
                No content yet — click Edit to add details.
              </p>
            )}
          </>
        )}

      </div>

      {/* Footer */}
      <div className="shrink-0 px-3 py-2.5 border-t border-neutral-700/50 flex items-center justify-between">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">Delete this idea?</span>
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
              title="Delete idea"
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
