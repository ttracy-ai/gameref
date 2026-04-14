"use client";

import {
  ScrollText, Images, ChevronLeft, ChevronRight, BarChart2,
  Code2, Map, Users, PenLine, FolderOpen,
} from "lucide-react";
import { useState } from "react";

import RefBoard from "@/components/RefBoard";
import GDDEditor from "@/components/GDDEditor";
import ProgressBoard from "@/components/ProgressBoard";
import ScriptEditor from "@/components/ScriptEditor";
import CodeLayout from "@/components/CodeLayout";
import ProjectsBoard, { type Project } from "@/components/ProjectsBoard";

type ActiveProject = { id: string; name: string };

type RibbonItem = {
  id: string;
  icon: React.ReactNode;
  label: string;
};

const canvasItems: RibbonItem[] = [
  { id: "progress",    icon: <BarChart2 size={22} />, label: "Progress" },
  { id: "gdd",         icon: <ScrollText size={22} />, label: "Game Design Document" },
  { id: "refboard",    icon: <Images size={22} />,    label: "Reference Board" },
  { id: "code-layout", icon: <Code2 size={22} />,     label: "Code Layout" },
  { id: "map-layout",  icon: <Map size={22} />,       label: "Map Layout" },
  { id: "team",        icon: <Users size={22} />,     label: "Team / Credits" },
  { id: "writing",     icon: <PenLine size={22} />,   label: "Writing" },
];

function Placeholder({ label }: { label: string }) {
  return (
    <main className="flex-1 flex items-center justify-center text-neutral-700 select-none text-sm">
      {label} — coming soon
    </main>
  );
}

export default function CanvasPage() {
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null);
  const [active, setActive] = useState<string>("projects");
  const [collapsed, setCollapsed] = useState(false);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  function handleOpenProject(project: Project) {
    setActiveProject({ id: project.id, name: project.name });
    setActive("progress");
  }

  function handleImageRefClick(imageId: string) {
    setPendingFocusId(imageId);
    setActive("refboard");
  }

  const projectId = activeProject?.id ?? "";

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-neutral-900">

      {/* Left ribbon */}
      <aside
        className={`
          relative flex flex-col items-center h-full
          bg-neutral-800 border-r border-neutral-700
          transition-all duration-200 ease-in-out shrink-0
          ${collapsed ? "w-4" : "w-14"}
        `}
      >
        {!collapsed && (
          <div className="flex flex-col items-center gap-1 w-full py-3">

            {/* Projects — always accessible */}
            <button
              onClick={() => setActive("projects")}
              title="Projects"
              aria-label="Projects"
              className={`
                group relative flex items-center justify-center
                w-10 h-10 rounded-lg transition-colors
                ${
                  active === "projects"
                    ? "bg-neutral-600 text-neutral-100"
                    : "text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100"
                }
              `}
            >
              <FolderOpen size={22} />
              <span className="pointer-events-none absolute left-12 z-50 whitespace-nowrap rounded-md bg-neutral-700 px-2 py-1 text-xs text-neutral-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                Projects
              </span>
            </button>

            {/* Active project name + divider */}
            {activeProject && (
              <div className="w-full px-2 pt-1 pb-1">
                <div className="border-t border-neutral-700 pt-1">
                  <p className="text-neutral-600 text-center truncate" style={{ fontSize: 9 }} title={activeProject.name}>
                    {activeProject.name}
                  </p>
                </div>
              </div>
            )}

            {/* Canvas items — disabled when no project */}
            {canvasItems.map((item) => {
              const enabled = !!activeProject;
              return (
                <button
                  key={item.id}
                  onClick={() => { if (enabled) setActive(item.id); }}
                  title={item.label}
                  aria-label={item.label}
                  disabled={!enabled}
                  className={`
                    group relative flex items-center justify-center
                    w-10 h-10 rounded-lg transition-colors
                    ${!enabled ? "opacity-30 cursor-not-allowed" : ""}
                    ${
                      active === item.id && enabled
                        ? "bg-neutral-600 text-neutral-100"
                        : enabled
                        ? "text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100"
                        : "text-neutral-400"
                    }
                  `}
                >
                  {item.icon}
                  {enabled && (
                    <span className="pointer-events-none absolute left-12 z-50 whitespace-nowrap rounded-md bg-neutral-700 px-2 py-1 text-xs text-neutral-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Version */}
        {!collapsed && (
          <span className="absolute bottom-10 text-neutral-600 select-none" style={{ fontSize: 9 }}>
            {process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute bottom-3 flex items-center justify-center w-4 h-6 rounded-sm text-neutral-500 hover:text-neutral-200 hover:bg-neutral-700 transition-colors"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Main area */}
      {active === "projects" ? (
        <ProjectsBoard
          activeProjectId={activeProject?.id ?? null}
          onOpenProject={handleOpenProject}
        />
      ) : !activeProject ? (
        <ProjectsBoard
          activeProjectId={null}
          onOpenProject={handleOpenProject}
        />
      ) : active === "progress" ? (
        <ProgressBoard key={projectId} projectId={projectId} onImageRefClick={handleImageRefClick} />
      ) : active === "refboard" ? (
        <RefBoard
          key={projectId}
          projectId={projectId}
          pendingFocusId={pendingFocusId}
          onFocusConsumed={() => setPendingFocusId(null)}
        />
      ) : active === "gdd" ? (
        <GDDEditor key={projectId} projectId={projectId} onImageRefClick={handleImageRefClick} />
      ) : active === "code-layout" ? (
        <CodeLayout key={projectId} projectId={projectId} />
      ) : active === "map-layout" ? (
        <Placeholder label="Map Layout" />
      ) : active === "team" ? (
        <Placeholder label="Team / Credits" />
      ) : active === "writing" ? (
        <ScriptEditor key={projectId} projectId={projectId} />
      ) : null}

    </div>
  );
}
