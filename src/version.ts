// Detects a newer deploy and reloads. Only touches sessionStorage (loop guard) — never the
// progress data in localStorage, which survives a reload untouched.
const CHECK_EVERY_MS = 5 * 60_000;
let updateReady: string | null = null;
const listeners = new Set<(b: string | null) => void>();
export function onUpdate(cb: (b: string | null) => void) { listeners.add(cb); cb(updateReady); return () => { listeners.delete(cb); }; }

export async function checkForUpdate(): Promise<string | null> {
  if (import.meta.env.DEV) return null;
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const { build } = (await res.json()) as { build?: string };
    if (build && build !== __BUILD_ID__) {
      updateReady = build;
      listeners.forEach((l) => l(build));
      return build;
    }
  } catch { /* offline: ignore */ }
  return null;
}

/** Reload into the new build; the query string bypasses any cached index.html. */
export function applyUpdate(build: string) {
  const key = 'keysreader.reloadedFor';
  if (sessionStorage.getItem(key) === build) return; // already tried once this session → avoid loops
  sessionStorage.setItem(key, build);
  const url = new URL(location.href);
  url.searchParams.set('v', build);
  location.replace(url.toString());
}

export function startVersionWatch() {
  // first check shortly after start-up (not during the initial load burst)
  setTimeout(() => void checkForUpdate(), 2500);
  setInterval(() => void checkForUpdate(), CHECK_EVERY_MS);
  // iOS Safari restores tabs from memory / bfcache without reloading: re-check when the page comes back.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkForUpdate(); });
  window.addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) void checkForUpdate(); });
  window.addEventListener('focus', () => void checkForUpdate());
}
