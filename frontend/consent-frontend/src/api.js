// frontend/consent-frontend/src/api.js

/**
 * Minimal, deployment-safe API client:
 * - Local dev default: http://127.0.0.1:8000/api/v1/
 * - In prod/same-origin (behind reverse proxy): /api/v1/
 * - Optional runtime override: localStorage.setItem("api_base_override", "<url>")
 * - Optional build-time override: VITE_API_BASE
 */

// ---- BASE resolution ----
const LOCAL_BASE = "http://127.0.0.1:8000/api/v1/";
const RELATIVE_BASE = "/api/v1/";
const BASE_KEY = "api_base_override";

function resolveBase() {
  // 1) localStorage override (highest priority)
  try {
    const ls = localStorage.getItem(BASE_KEY);
    if (ls && typeof ls === "string" && ls.trim()) {
      return normalizeBase(ls);
    }
  } catch {}

  // 2) Vite env (build-time)
  try {
    const env = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || "";
    if (env && typeof env === "string" && env.trim()) {
      return normalizeBase(env);
    }
  } catch {}

  // 3) Heuristic: if running locally, use local base; otherwise use relative
  const host = (typeof location !== "undefined" && location.hostname) || "";
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.endsWith(".local");
  return normalizeBase(isLocal ? LOCAL_BASE : RELATIVE_BASE);
}

function normalizeBase(u) {
  // ensure exactly one trailing slash
  const trimmed = String(u).trim();
  return trimmed.endsWith("/") ? trimmed : trimmed + "/";
}

// Build final BASE once
const BASE = resolveBase();

/** Join base + path safely (avoids double /api/v1 etc.) */
function api(path) {
  const p = String(path || "").replace(/^\/+/, ""); // strip leading slashes from path
  return new URL(p, BASE).toString();
}

/** ---------- Simple client-side auth (unchanged) ---------- */
const AUTH_KEY = "simple_auth"; // { username: "user", loggedIn: true }

export function getAuthState() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : { username: "", loggedIn: false };
  } catch {
    return { username: "", loggedIn: false };
  }
}

export function setAuthState(next) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function clearAuthState() {
  try { localStorage.removeItem(AUTH_KEY); } catch {}
}

/** ---------- Fetch helper for clearer errors ---------- */
async function doFetch(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const snippet = text ? ` ${text}` : "";
    throw new Error(`${init?.method || "GET"} ${url} failed: ${res.status}${snippet}`);
  }
  return res;
}

/** ---------- Consents & Audit API (kept compatible) ---------- */

export async function grantConsent({ subject_id, data_use_case, meta }) {
  // Send both `data_use_case` and legacy `purpose` for compatibility
  const body = { subject_id, data_use_case, purpose: data_use_case, meta };
  const res = await doFetch(api("consents"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function listConsents(subject_id) {
  const url = subject_id
    ? api(`consents?subject_id=${encodeURIComponent(subject_id)}`)
    : api("consents");
  const res = await doFetch(url);
  return res.json();
}

export async function revokeConsent(id) {
  const res = await doFetch(api(`consents/${encodeURIComponent(id)}/revoke`), {
    method: "PATCH",
  });
  return res.json();
}

export async function listAudit(consent_id) {
  const url = consent_id
    ? api(`audit?consent_id=${encodeURIComponent(consent_id)}`)
    : api("audit");
  const res = await doFetch(url);
  return res.json();
}

/** Server-side CSV export (Consents) */
export async function exportConsentsCSV({ subject_id, start_date, end_date } = {}) {
  const q = new URLSearchParams();
  if (subject_id) q.set("subject_id", subject_id);
  if (start_date) q.set("start_date", start_date);
  if (end_date) q.set("end_date", end_date);

  const url = api(`consents/export.csv${q.toString() ? `?${q.toString()}` : ""}`);
  const res = await doFetch(url);
  const blob = await res.blob();

  const a = document.createElement("a");
  const downloadUrl = URL.createObjectURL(blob);
  a.href = downloadUrl;
  a.download = "consents_export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(downloadUrl);
}

/** (Optional) If you later want server CSV for audit, you can add:
export async function exportAuditCSV({ consent_id, start_date, end_date } = {}) {
  const q = new URLSearchParams();
  if (consent_id) q.set("consent_id", consent_id);
  if (start_date) q.set("start_date", start_date);
  if (end_date) q.set("end_date", end_date);
  const url = api(\`audit/export.csv\${q.toString() ? \`?\${q.toString()}\` : ""}\`);
  const res = await doFetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  const downloadUrl = URL.createObjectURL(blob);
  a.href = downloadUrl;
  a.download = "audit_export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(downloadUrl);
}
*/
