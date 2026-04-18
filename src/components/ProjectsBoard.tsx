"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, FolderOpen, Loader2, Pencil, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  role: string;
  ownerId: string;
};

const ORDER_KEY = "gameref_projects_order_v1";

function applyOrder(projects: Project[], order: string[]): Project[] {
  if (order.length === 0) return projects;
  const map = new Map(projects.map((p) => [p.id, p]));
  const sorted: Project[] = [];
  for (const id of order) { const p = map.get(id); if (p) sorted.push(p); }
  for (const p of projects) { if (!order.includes(p.id)) sorted.push(p); }
  return sorted;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ProjectsBoard({
  activeProjectId,
  onOpenProject,
}: {
  activeProjectId: string | null;
  onOpenProject: (project: Project) => void;
}) {
  const [projects, setProjects]         = useState<Project[] | null>(null);
  const [adding, setAdding]             = useState(false);
  const [newName, setNewName]           = useState("");
  const [saving, setSaving]             = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [renamingId, setRenamingId]     = useState<string | null>(null);
  const [renameValue, setRenameValue]   = useState("");
  const [error, setError]               = useState<string | null>(null);
  const newInputRef    = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        const fetched: Project[] = data.projects ?? [];
        try {
          const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]") as string[];
          setProjects(applyOrder(fetched, saved));
        } catch {
          setProjects(fetched);
        }
      })
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => { if (adding)    newInputRef.current?.focus();    }, [adding]);
  useEffect(() => { if (renamingId) renameInputRef.current?.focus(); }, [renamingId]);

  function onDragEnd(result: DropResult) {
    if (!result.destination || result.source.index === result.destination.index) return;
    setProjects((prev) => {
      const items = [...(prev ?? [])];
      const [moved] = items.splice(result.source.index, 1);
      items.splice(result.destination!.index, 0, moved);
      try { localStorage.setItem(ORDER_KEY, JSON.stringify(items.map((p) => p.id))); } catch {}
      return items;
    });
  }

  async function createProject() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      const project: Project = await res.json();
      setProjects((prev) => {
        const next = [...(prev ?? []), project];
        try { localStorage.setItem(ORDER_KEY, JSON.stringify(next.map((p) => p.id))); } catch {}
        return next;
      });
      setNewName(""); setAdding(false);
      onOpenProject(project);
    } catch {
      setError("Failed to create project. Please try again.");
    } finally { setSaving(false); }
  }

  async function renameProject(id: string) {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      setProjects((prev) => (prev ?? []).map((p) => p.id === id ? { ...p, name } : p));
    } catch {
      setError("Failed to rename project.");
    } finally { setRenamingId(null); }
  }

  async function deleteProject(id: string) {
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => {
        const next = (prev ?? []).filter((p) => p.id !== id);
        try { localStorage.setItem(ORDER_KEY, JSON.stringify(next.map((p) => p.id))); } catch {}
        return next;
      });
      setDeleteConfirm(null);
    } catch { setError("Failed to delete project."); }
  }

  if (projects === null) {
    return (
      <main className="flex-1 flex items-center justify-center bg-neutral-900">
        <Loader2 size={20} className="text-neutral-600 animate-spin" />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-10 px-6">

          <div className="mb-8">
            <h1 className="text-neutral-200 text-xl font-semibold">Projects</h1>
            <p className="text-neutral-500 text-sm mt-1">
              Open a project to access its canvases, or create a new one.
            </p>
          </div>

          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="projects-grid" direction="horizontal">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {projects.map((project, index) => {
                    const isRenaming = renamingId === project.id;
                    return (
                      <Draggable key={project.id} draggableId={project.id} index={index}>
                        {(drag, snapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            style={drag.draggableProps.style}
                            onClick={() => { if (!isRenaming) onOpenProject(project); }}
                            className={`relative group rounded-xl border transition-colors p-5 ${
                              isRenaming ? "cursor-default" : "cursor-pointer"
                            } ${
                              snapshot.isDragging
                                ? "shadow-2xl shadow-black/60 opacity-95 bg-neutral-700 border-neutral-500"
                                : activeProjectId === project.id
                                ? "bg-neutral-700 border-neutral-500"
                                : "bg-neutral-800 border-neutral-700 hover:border-neutral-500"
                            }`}
                          >
                            {/* Drag handle */}
                            <div
                              {...drag.dragHandleProps}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing transition-opacity"
                            >
                              <GripVertical size={14} />
                            </div>

                            {activeProjectId === project.id && !isRenaming && (
                              <span className="absolute top-3 right-3 text-xs text-neutral-400 bg-neutral-600 px-2 py-0.5 rounded-full">
                                open
                              </span>
                            )}

                            <FolderOpen size={20} className="text-neutral-400 mb-3" />

                            {isRenaming ? (
                              <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); renameProject(project.id); }
                                  if (e.key === "Escape") setRenamingId(null);
                                }}
                                onBlur={() => renameProject(project.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-neutral-700 text-neutral-100 font-semibold text-sm rounded px-2 py-1 outline-none border border-neutral-500 mb-1"
                              />
                            ) : (
                              <h2 className="text-neutral-200 font-semibold text-sm mb-1 pr-10">
                                {project.name}
                              </h2>
                            )}

                            <p className="text-neutral-600 text-xs">{formatDate(project.createdAt)}</p>
                            {project.role !== "team_leader" && (
                              <p className="text-neutral-700 text-xs mt-1">Member</p>
                            )}

                            {/* Rename + Delete — team leader only */}
                            {project.role === "team_leader" && !isRenaming && (
                              deleteConfirm === project.id ? (
                                <div
                                  className="absolute bottom-3 right-3 flex items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-xs text-neutral-400">Delete?</span>
                                  <button onClick={() => deleteProject(project.id)} className="text-xs text-red-400 hover:text-red-300">Yes</button>
                                  <button onClick={() => setDeleteConfirm(null)} className="text-xs text-neutral-500 hover:text-neutral-300">No</button>
                                </div>
                              ) : (
                                <div
                                  className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => { setRenamingId(project.id); setRenameValue(project.name); }}
                                    className="text-neutral-600 hover:text-neutral-300 transition-colors"
                                    title="Rename project"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(project.id)}
                                    className="text-neutral-600 hover:text-red-400 transition-colors"
                                    title="Delete project"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}

                  {provided.placeholder}

                  {/* New project — not draggable */}
                  {adding ? (
                    <div className="rounded-xl border border-neutral-600 bg-neutral-800 p-5">
                      <FolderOpen size={20} className="text-neutral-400 mb-3" />
                      <input
                        ref={newInputRef}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") createProject();
                          if (e.key === "Escape") { setAdding(false); setNewName(""); }
                        }}
                        placeholder="Project name…"
                        className="w-full bg-transparent text-neutral-200 text-sm font-semibold outline-none placeholder:text-neutral-600 mb-4"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={createProject}
                          disabled={!newName.trim() || saving}
                          className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                        >
                          {saving ? "Creating…" : "Create"}
                        </button>
                        <button
                          onClick={() => { setAdding(false); setNewName(""); }}
                          className="text-xs px-3 py-1.5 rounded-md text-neutral-500 hover:text-neutral-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAdding(true)}
                      className="rounded-xl border border-dashed border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/50 p-5 flex flex-col items-center justify-center gap-2 text-neutral-600 hover:text-neutral-400 transition-all min-h-[120px]"
                    >
                      <Plus size={20} />
                      <span className="text-sm">New Project</span>
                    </button>
                  )}

                </div>
              )}
            </Droppable>
          </DragDropContext>

        </div>
      </div>
    </main>
  );
}
