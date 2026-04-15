/**
 * canvasStorage — DB-backed canvas persistence with localStorage as a fast cache.
 *
 * Load strategy  : API first → localStorage fallback + auto-migrate to DB.
 * Save strategy  : localStorage immediately (snappy UI) + debounced DB write.
 */

const DEBOUNCE_MS = 1500;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Fetch canvas data from the database.
 * Returns the parsed JSON value, or null if nothing is stored yet / on error.
 */
export async function loadCanvasData(
  projectId: string,
  canvasType: string,
): Promise<unknown> {
  if (!projectId) return null;
  try {
    const res = await fetch(`/api/projects/${projectId}/canvas/${canvasType}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Debounced save to the database.
 * Calling this rapidly (e.g. on every keystroke) batches into a single write
 * that fires 1.5 s after the last call for the given project+canvas.
 */
export function syncCanvasData(
  projectId: string,
  canvasType: string,
  data: unknown,
): void {
  if (!projectId) return;
  const key = `${projectId}:${canvasType}`;

  const existing = timers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    timers.delete(key);
    fetch(`/api/projects/${projectId}/canvas/${canvasType}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    }).catch(() => {}); // fire-and-forget; localStorage is the safety net
  }, DEBOUNCE_MS);

  timers.set(key, timer);
}
