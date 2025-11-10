// frontend/consent-frontend/src/api.js

/**
 * Minimal, deployment-safe API client:
 * - Local dev default: http://127.0.0.1:8000/api/v1
 * - In prod/same-origin (behind reverse proxy): /api/v1
 * - Optional runtime override: localStorage.setItem("api_base_override", "<url>")
 */

// ---- BASE resolution ----
const LOCAL_BASE = "http://127.0.0.1:8000/api/v1";
const RELATIVE_BASE = "/api/v1";
const BASE_KEY = "api_base_override";

function resolveBase() {
  try {
    const override = localStorage.getItem(BASE_KEY);
    if (override && typeof override === "string" && override.trim()) {
      return override.trim().replace(/\/+$/, "");
    }
  } catch {}
  // If not localhost, prefer relative (works behind reverse proxy / Render same-origin)
  const host = (typeof window !== "undefined" && window.location && window.location.hostname) ? window.location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal ? LOCAL_BASE : RELATIVE_BASE;
}

let BASE = resolveBase();

export function getApiBase() {
  return BASE;
}

export function setApiBase(next) {
  if (typeof next === "string" && next.trim()) {
    try { localStorage.setItem(BASE_KEY, next.trim().replace(/\/+$/, "")); } catch {}
    BASE = resolveBase();
  }
}

// ---- Simple client-side auth state (unchanged behaviour) ----
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

// ---- Fetch helper (keeps behaviour but improves errors) ----
async function doFetch(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Keep previous error style while providing more context
    throw new Error(`${init?.method || "GET"} ${url} → ${res.status} ${text || res.statusText}`);
  }
  return res;
}

// ---- Consents/Audit API (same shapes as before) ----
export async function grantConsent({ subject_id, data_use_case, meta }) {
  // Send both data_use_case and purpose for compatibility
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

// ---- CSV export (server-side) ----
export async function exportConsentsCSV({ subject_id, start_date, end_date } = {}) {
  const params = new URLSearchParams();
  if (subject_id) params.set("subject_id", subject_id);
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);

  const url = `${BASE}/consents/export.csv${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await doFetch(url);

  // download
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

// ---- Optional small health check (handy for deployments; no UI coupling) ----
export async function ping() {
  try {
    const res = await fetch(`${BASE}/health`); // ok if 404; purely optional
    return res.ok;
  } catch { return false; }
}
