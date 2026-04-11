/**
 * API + static file base URL.
 * Local dev: leave VITE_API_URL unset → same-origin requests use the Vite proxy.
 * Production: set VITE_API_URL to your Render backend origin, e.g. https://budget-api.onrender.com (no trailing slash).
 */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw !== "string") return "";
  const t = raw.trim();
  return t.replace(/\/$/, "");
}

/** Absolute URL for an API path or `/uploads/...` (path must start with `/`). */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBase();
  return base ? `${base}${p}` : p;
}
