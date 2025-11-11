// frontend/consent-frontend/src/api.js

/**
 * Minimal, deployment-safe API client
 * - Local dev default: http://127.0.0.1:8000/api/v1
 * - Same-origin (Render/Nginx/etc.): /api/v1
 * - Optional runtime override: localStorage.setItem("api_base_override", "<url>")
 */

// ---------- BASE resolution ----------
const LOCAL_BASE = "http://127.0.0.1:8000/api/v1";
const RELATIVE_BASE = "/api/v1";
const BASE_KEY = "api_base_override";

function getOverrideBase() {
  try {
    const v = localStorage.getItem(BASE_KEY);
    return v && typeof v === "string" ? v.trim() : "";
  } catch {
    return "";
  }
}

function resolveBase() {
  const override = getOverrideBase();
  if (override) return override;
  // Heuristic: if we're not on localhost-like, assume same origin reverse proxy
  const host = (typeof window !== "undefined" && window.location && window.location.hostname) || "";
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.endsWith(".local");
  return isLocal ? LOCAL_BASE : RELATIVE_BASE;
}

const BASE = resolveBase();

// ---------- Small helpers ----------
function joinUrl(base, path) {
  // Ensures no double slashes and no double /api/v1
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

// ---------- Auth (client-side only) ----------
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
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function clearAuthState() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {}
}

// ---------- Fetch wrapper ----------
async function doFetch(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch {}
    const msg = text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res;
}

// ---------- Consents & Audit API ----------
// NOTE: All paths below are **relative** (no /api/v1 here). BASE already includes /api/v1.

export async function grantConsent({ subject_id, data_use_case, meta }) {
  // Send both `data_use_case` and legacy `purpose` for compatibility
  const body = { subject_id, data_use_case, purpose: data_use_case, meta };
  const url = joinUrl(BASE, "consents");
  const res = await doFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function listConsents(subject_id) {
  const url = new URL(joinUrl(BASE, "consents"), window.location.origin);
  if (subject_id) url.searchParams.set("subject_id", subject_id);
  const res = await doFetch(url.toString());
  return res.json();
}

export async function revokeConsent(id) {
  const url = joinUrl(BASE, `consents/${encodeURIComponent(id)}/revoke`);
  const res = await doFetch(url, { method: "PATCH" });
  return res.json();
}

export async function listAudit(consent_id) {
  const url = new URL(joinUrl(BASE, "audit"), window.location.origin);
  if (consent_id) url.searchParams.set("consent_id", consent_id);
  const res = await doFetch(url.toString());
  return res.json();
}

// Server CSV export for consents
export async function exportConsentsCSV({ subject_id, start_date, end_date } = {}) {
  const url = new URL(joinUrl(BASE, "consents/export.csv"), window.location.origin);
  if (subject_id) url.searchParams.set("subject_id", subject_id);
  if (start_date) url.searchParams.set("start_date", start_date);
  if (end_date) url.searchParams.set("end_date", end_date);

  const res = await doFetch(url.toString());
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

// Optional: quick runtime switcher for debugging
export function setApiBaseOverride(url) {
  try {
    if (!url) localStorage.removeItem(BASE_KEY);
    else localStorage.setItem(BASE_KEY, url);
  } catch {}
}

export function getApiBase() {
  return BASE;
}
