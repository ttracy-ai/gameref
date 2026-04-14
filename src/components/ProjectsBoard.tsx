"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, FolderOpen } from "lucide-react";

const PROJECTS_KEY = "gameref_projects_v1";

export type Project = {
  id: string;
  name: string;
  createdAt: string;
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ProjectsBoard({
  activeProjectId,
  onOpenProject,
}: {
  activeProjectId: string | null;
  onOpenProject: (project: Project) => void;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      setProjects(raw ? JSON.parse(raw) : []);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    if (adding) newInputRef.current?.focus();
  }, [adding]);

  function save(next: Project[]) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(next));
  }

  function createProject() {
    const name = newName.trim();
    if (!name) return;
    const project: Project = {
      id: makeId(),
      name,
      createdAt: new Date().toISOString(),
    };
    const next = [...(projects ?? []), project];
    setProjects(next);
    save(next);
    setNewName("");
    setAdding(false);
    onOpenProject(project);
  }

  function deleteProject(id: string) {
    const next = (projects ?? []).filter((p) => p.id !== id);
    setProjects(next);
    save(next);
    setDeleteConfirm(null);
  }

  if (projects === null) return null;

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-10 px-6">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-neutral-200 text-xl font-semibold">Projects</h1>
            <p className="text-neutral-500 text-sm mt-1">
              Open a project to access its canvases, or create a new one.
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => onOpenProject(project)}
                className={`relative group rounded-xl border cursor-pointer transition-colors p-5 ${
                  activeProjectId === project.id
                    ? "bg-neutral-700 border-neutral-500"
                    : "bg-neutral-800 border-neutral-700 hover:border-neutral-500"
                }`}
              >
                {activeProjectId === project.id && (
                  <span className="absolute top-3 right-3 text-xs text-neutral-400 bg-neutral-600 px-2 py-0.5 rounded-full">
                    open
                  </span>
                )}

                <FolderOpen size={20} className="text-neutral-400 mb-3" />
                <h2 className="text-neutral-200 font-semibold text-sm mb-1 pr-10">
                  {project.name}
                </h2>
                <p className="text-neutral-600 text-xs">{formatDate(project.createdAt)}</p>

                {/* Delete */}
                {deleteConfirm === project.id ? (
                  <div
                    className="absolute bottom-3 right-3 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs text-neutral-400">Delete?</span>
                    <button
                      onClick={() => deleteProject(project.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="text-xs text-neutral-500 hover:text-neutral-300"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(project.id);
                    }}
                    className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-600 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}

            {/* New project */}
            {adding ? (
              <div className="rounded-xl border border-neutral-600 bg-neutral-800 p-5">
                <FolderOpen size={20} className="text-neutral-400 mb-3" />
                <input
                  ref={newInputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createProject();
                    if (e.key === "Escape") {
                      setAdding(false);
                      setNewName("");
                    }
                  }}
                  placeholder="Project name…"
                  className="w-full bg-transparent text-neutral-200 text-sm font-semibold outline-none placeholder:text-neutral-600 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={createProject}
                    disabled={!newName.trim()}
                    className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setAdding(false);
                      setNewName("");
                    }}
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
        </div>
      </div>
    </main>
  );
}
