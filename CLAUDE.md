# GameRef — Claude Orientation Guide

Quick reference for Claude Code. Read this before making any changes.

---

## Stack

- **Framework**: Next.js (App Router, `src/` layout), React 19, TypeScript, Tailwind CSS 3
- **Database**: Neon PostgreSQL via Prisma 7 (`src/lib/prisma.ts`)
- **Auth**: Auth.js v5 — Google + Discord OAuth. Edge-split config: `auth.config.ts` (edge-safe) vs `auth.ts` (full, Node only). Sessions use JWT.
- **Real-time**: Liveblocks v3.18.x — Storage for structured state, Broadcast for fire-and-forget events
- **Editor**: TipTap v3 — GDD only. `useLiveblocksExtension()` for Yjs sync.

---

## File Map

### Pages
| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Landing / login page |
| `src/app/canvas/page.tsx` | Main app shell — ribbon nav, project selector, mounts all canvases |

### Canvas Components
| Import path | File(s) | Notes |
|-------------|---------|-------|
| `@/components/GDDEditor` | `GDDEditor/index.tsx`, `PageEditor.tsx`, `extensions.tsx` | Multi-page TipTap editor with Liveblocks Yjs |
| `@/components/ProgressBoard` | `ProgressBoard/index.tsx`, `CardModal.tsx` | Kanban board, Liveblocks Storage |
| `@/components/ScriptEditor` | `ScriptEditor/index.tsx`, `ScriptBlock.tsx` | Screenplay editor, Liveblocks Storage |
| `@/components/CodeLayout` | `CodeLayout.tsx` | Class/object diagram, Liveblocks Storage |
| `@/components/TeamCanvas` | `TeamCanvas.tsx` | Members/roles/invitations, Liveblocks Broadcast |
| `@/components/RefBoard` | `RefBoard.tsx` | Image reference board, localStorage only |
| `@/components/ProjectsBoard` | `ProjectsBoard.tsx` | Project list/selector |
| `@/components/SettingsCanvas` | `SettingsCanvas.tsx` | User account settings |

### Lib
| File | Purpose |
|------|---------|
| `src/lib/canvasStorage.ts` | `loadCanvasData` / `syncCanvasData` — DB-primary storage with localStorage cache |
| `src/lib/liveblocks.ts` | Liveblocks context for GDD (TipTap Yjs). Exports `RoomProvider`, `useOthers`. |
| `src/lib/liveblocks-kanban.ts` | Liveblocks context for ProgressBoard. Storage: `{ boardJson: string }` |
| `src/lib/liveblocks-canvas.ts` | Liveblocks context for CodeLayout, ScriptEditor, TeamCanvas. Storage: `{ canvasJson: string }`. Exports `useBroadcastEvent`, `useEventListener` too. |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/email.ts` | Resend email helper for invitations |

### API Routes
| Route | Purpose |
|-------|---------|
| `POST /api/liveblocks-auth` | Liveblocks token endpoint. Validates room IDs, checks project membership. |
| `GET/POST /api/projects` | List / create projects |
| `GET/PUT/DELETE /api/projects/[id]` | Single project CRUD |
| `GET/POST /api/projects/[id]/canvas` | Load / save `CanvasData` for a canvas type |
| `GET /api/projects/[id]/members` | List project members + current user ID |
| `POST/DELETE /api/projects/[id]/roles` | Create / delete custom roles |
| `POST /api/projects/[id]/roles/[roleId]/assign` | Assign role to member |
| `POST /api/projects/[id]/invite` | Send email invitation |
| `GET/POST/DELETE /api/projects/[id]/invite-link` | Invite link management |
| `GET/POST /api/projects/[id]/invitations` | Pending invitations |
| `POST /api/invite` | Accept invite via token |
| `GET/POST /api/user` | Current user profile (username, avatar) |

---

## Key Patterns

### Canvas storage (all canvases except RefBoard)
Every canvas uses the **outer/inner pattern**:
1. **Outer** component: loads from DB via `loadCanvasData`, falls back to localStorage, then mounts `RoomProvider` with `initialStorage`.
2. **Inner** component: uses `useStorage` / `useMutation` to read/write Liveblocks. Every write also calls `syncCanvasData` (debounced DB write) + localStorage.

```ts
// Outer
const dbData = await loadCanvasData(projectId, "type");
<RoomProvider id={`type_${projectId}`} initialStorage={{ canvasJson: JSON.stringify(data) }}>
  <Inner />
</RoomProvider>

// Inner
const canvasJson = useStorage(root => root.canvasJson);
const setCanvasJson = useMutation(({ storage }, json) => storage.set("canvasJson", json), []);
function update(fn) {
  const next = fn(current);
  localStorage.setItem(key, JSON.stringify(next));
  syncCanvasData(projectId, "type", next);
  setCanvasJson(JSON.stringify(next));
}
```

### TeamCanvas is different
TeamCanvas has no `CanvasData` — it uses direct API routes for members/roles/invitations. Real-time sync uses **Liveblocks Broadcast**: after any mutation, `broadcast({ type: "refresh" })`. All other clients call `refreshTeamData()` on receiving the event.

### GDDEditor is different
GDD uses TipTap + Yjs via `useLiveblocksExtension()`. One Liveblocks room per page (`gdd_{projectId}_{pageId}`). Page metadata (list, activeId, HTML snapshots) is stored in `CanvasData` via `syncCanvasData`. The `RoomProvider` is remounted on page switch via `key={projectId-pageId}`.

### TipTap internal links
Never use `<a href>` for links inside TipTap — Chrome will navigate away. Use `<span data-page-id="...">` via the custom `PageLink` mark. Click handled in `editorProps.handleDOMEvents.click`.

### New fields on saved data
Always use `?? default` when reading saved canvas JSON to avoid crashes from data saved before the field existed.

### Liveblocks auth
`/api/liveblocks-auth` validates room IDs with a combined regex that accepts:
- `gdd_{projectId}_{anything}` — GDD pages
- `progress_{projectId}` — ProgressBoard
- `codelayout_{projectId}` — CodeLayout
- `script_{projectId}` — ScriptEditor
- `team_{projectId}` — TeamCanvas

---

## Role & Permission System

- Projects have an owner (the creator).
- Members have a `role` field on the `ProjectMember` model.
- Custom roles are stored in the `Role` model with `name` and `color`.
- Color convention: light pastel background + dark text; top 8 roles spaced ~45° apart on the hue wheel for max differentiation.

---

## Commit & Deploy

After every completed feature: commit, then `git push` to trigger a Vercel deployment. Do this unprompted — don't wait for the user to ask.
