// frontend/consent-frontend/src/api.js

/**
 * Base resolution:
 * - In dev: defaults to http://127.0.0.1:8000
 * - In prod: defaults to window.location.origin (e.g., Render backend URL if same origin)
 * - Override with VITE_API_BASE or window.__API_BASE__ (no trailing /)
 *
 * This file GUARANTEES we append the API prefix exactly once.
 */

const API_PREFIX = "/api/v1";

// Pick a starting base
const RAW_BASE =
  (typeof import !== "undefined" &&
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  (typeof window !== "undefined" && window.__API_BASE__) ||
  (typeof window !== "undefined" && window.location && !window.location.hostname.includes("localhost")
    ? window.location.origin
    : "http://127.0.0.1:8000");

// Normalize a base by removing trailing slashes and any duplicated api prefix
function normalizeBase(base) {
  if (!base) return "";
  let b = String(base).trim();

  // drop trailing slashes
  while (b.endsWith("/")) b = b.slice(0, -1);

  // If someone put /api or /api/v1 in the base, strip it to avoid double-prefix
  const stripOnce = (s, suffix) =>
    s.toLowerCase().endsWith(suffix) ? s.slice(0, s.length - suffix.length) : s;

  b = stripOnce(b, "/api/v1");
  b = stripOnce(b, "/api");

  // drop trailing slash again if any
  while (b.endsWith("/")) b = b.slice(0, -1);

  return b;
}

const BASE_ROOT = normalizeBase(RAW_BASE);

// Join helper that guarantees a single prefix occurrence
function endpoint(path) {
  // path must start with '/'
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_ROOT}${API_PREFIX}${p}`;
}

/**
 * ---- Auth (simple, client-side only) ----
 * We keep a tiny localStorage-based auth so your existing "simple login" works.
 */
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

/**
 * ---- Consents/Audit API ----
 */
export async function grantConsent({ subject_id, data_use_case, meta }) {
  // Send both data_use_case and purpose for compatibility
  const body = { subject_id, data_use_case, purpose: data_use_case, meta };
  const res = await fetch(endpoint("/consents"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Grant failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function listConsents(subject_id) {
  const url = subject_id
    ? `${endpoint("/consents")}?subject_id=${encodeURIComponent(subject_id)}`
    : endpoint("/consents");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

export async function revokeConsent(id) {
  const res = await fetch(endpoint(`/consents/${id}/revoke`), { method: "PATCH" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Revoke failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function listAudit(consent_id) {
  const url = consent_id
    ? `${endpoint("/audit")}?consent_id=${encodeURIComponent(consent_id)}`
    : endpoint("/audit");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audit list failed: ${res.status}`);
  return res.json();
}

export async function exportConsentsCSV({ subject_id, start_date, end_date }) {
  const params = new URLSearchParams();
  if (subject_id) params.set("subject_id", subject_id);
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);

  const url = `${endpoint("/consents/export.csv")}${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Export failed: ${res.status} ${text}`);
  }

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

// Expose the resolved base for quick debugging if needed
export const __API_DEBUG__ = { RAW_BASE, BASE_ROOT, API_PREFIX, endpoint: (p) => endpoint(p) };
