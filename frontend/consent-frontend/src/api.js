// frontend/consent-frontend/src/api.js

/**
 * Minimal, deployment-safe API client:
 * - Local dev default: http://127.0.0.1:8000
 * - Same-origin prod (behind a reverse proxy): window.origin
 * - Optional runtime override (no /api/v1 in the value):
 *     localStorage.setItem("api_base_override", "https://consent-poc.onrender.com")
 *
 * This module guarantees "/api/v1" is appended **exactly once**.
 */

// ---------- BASE resolution ----------
const AUTH_KEY = "simple_auth";            // { username: "user", loggedIn: true }
const BASE_OVERRIDE_KEY = "api_base_override";
const API_SUFFIX = "/api/v1";

/** remove trailing slashes and any trailing /api/v1 */
function normalizeOrigin(u) {
  if (!u) return "";
  try {
    // if full URL, use origin (protocol+host+port)
    const url = new URL(u, window.location.origin);
    u = url.origin + url.pathname; // keeps potential path (for custom proxies)
  } catch {
    // plain string (e.g., "http://127.0.0.1:8000" or "/backend")
  }
  // strip trailing slashes
  while (u.endsWith("/")) u = u.slice(0, -1);
  // remove a trailing /api/v1 if present
  if (u.toLowerCase().endsWith(API_SUFFIX)) {
    u = u.slice(0, -API_SUFFIX.length);
  }
  return u;
}

function resolveApiBase() {
  // 1) Explicit override
  const override = localStorage.getItem(BASE_OVERRIDE_KEY);
  if (override) {
    return normalizeOrigin(override) + API_SUFFIX;
  }

  // 2) Local dev heuristics
  const host = (typeof window !== "undefined" ? window.location.hostname : "localhost") || "localhost";
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://127.0.0.1:8000" + API_SUFFIX;
  }

  // 3) Same-origin by default (Render reverse proxy case)
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return normalizeOrigin(origin) + API_SUFFIX;
}

const BASE = resolveApiBase(); // e.g., "http://127.0.0.1:8000/api/v1" or "https://consent-poc.onrender.com/api/v1"

// ---------- Auth (client-side only, unchanged) ----------
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

// ---------- Fetch helper ----------
async function doFetch(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${init?.method || "GET"} ${url} -> ${res.status} ${text}`);
  }
  return res;
}

// ---------- API: Consents & Audit ----------
export async function grantConsent({ subject_id, data_use_case, meta }) {
  // Send both `data_use_case` and `purpose` to remain compatible with Day 7 backend.
  const body = { subject_id, data_use_case, purpose: data_use_case, meta };
  const res = await doFetch(`${BASE}/consents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function listConsents(subject_id) {
  const url = subject_id
    ? `${BASE}/consents?subject_id=${encodeURIComponent(subject_id)}`
    : `${BASE}/consents`;
  const res = await doFetch(url);
  return res.json();
}

export async function revokeConsent(id) {
  const res = await doFetch(`${BASE}/consents/${encodeURIComponent(id)}/revoke`, {
    method: "PATCH",
  });
  return res.json();
}

export async function listAudit(consent_id) {
  const url = consent_id
    ? `${BASE}/audit?consent_id=${encodeURIComponent(consent_id)}`
    : `${BASE}/audit`;
  const res = await doFetch(url);
  return res.json();
}

export async function exportConsentsCSV({ subject_id, start_date, end_date } = {}) {
  const params = new URLSearchParams();
  if (subject_id) params.set("subject_id", subject_id);
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);

  const url = `${BASE}/consents/export.csv${params.toString() ? `?${params}` : ""}`;
  const res = await doFetch(url, { method: "GET" });

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

// ---- Utilities to help during deploy/debug (optional) ----
export function getResolvedBase() { return BASE; }           // for quick console checks
export function setApiBaseOverride(url) {                    // call from console if needed
  localStorage.setItem(BASE_OVERRIDE_KEY, url || "");
  // reload to take effect
  if (typeof window !== "undefined") window.location.reload();
}
export function clearApiBaseOverride() {
  localStorage.removeItem(BASE_OVERRIDE_KEY);
  if (typeof window !== "undefined") window.location.reload();
}
