// frontend/consent-frontend/src/api.js

// ===== Base URL resolution (works locally, same-origin, or cross-domain) =====
const LOCAL_BASE = "http://127.0.0.1:8000/api/v1";
const RELATIVE_BASE = "/api/v1";
const BASE_KEY = "api_base_override";

/**
 * Choose the API base:
 * 1) If localStorage has "api_base_override" use that (e.g. https://consent-poc.onrender.com/api/v1)
 * 2) If running on localhost/127.0.0.1, use LOCAL_BASE
 * 3) Otherwise, assume same-origin path /api/v1 (behind a reverse proxy)
 */
function resolveBase() {
  try {
    const override = localStorage.getItem(BASE_KEY);
    if (override && override.trim()) {
      return stripTrailingSlash(override.trim());
    }
  } catch {}
  const host = (typeof window !== "undefined" && window.location && window.location.hostname) ? window.location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal ? LOCAL_BASE : RELATIVE_BASE;
}

function stripTrailingSlash(s) {
  return s.replace(/\/+$/, "");
}

const BASE = resolveBase(); // e.g. "https://consent-poc.onrender.com/api/v1" or "/api/v1"

// ===== Tiny auth helper (client-side only; your PoC login) =====
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

// ===== Fetch helper (uniform errors) =====
async function doFetch(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = "";
    try { msg = await res.text(); } catch {}
    throw new Error(`${init?.method || "GET"} ${url} → ${res.status} ${msg || res.statusText}`);
  }
  return res;
}

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

// ===== Consents & Audit API (with fallbacks to support both endpoint shapes) =====

/**
 * Grant consent.
 * Primary:   POST /api/v1/consents                      (Shape A)
 * Fallback:  POST /api/v1/consents/grant                (Shape B / older)
 */
export async function grantConsent({ subject_id, data_use_case, meta }) {
  const body = JSON.stringify({
    subject_id,
    data_use_case,
    // keep compatibility for servers that still look at "purpose"
    purpose: data_use_case,
    meta,
  });

  // Try Shape A
  try {
    const res = await doFetch(`${BASE}/consents`, {
      method: "POST",
      headers: jsonHeaders(),
      body,
    });
    return res.json();
  } catch (e) {
    // Only fall back on 404/405 (route missing or method mismatch)
    if (!/ 404 | 405 /.test(" " + String(e.message) + " ")) throw e;
  }

  // Fallback Shape B
  const res2 = await doFetch(`${BASE}/consents/grant`, {
    method: "POST",
    headers: jsonHeaders(),
    body,
  });
  return res2.json();
}

/**
 * Revoke consent.
 * Primary:   PATCH /api/v1/consents/{id}/revoke         (Shape A)
 * Fallback:  POST  /api/v1/consents/{id}/revoke         (some stacks use POST)
 */
export async function revokeConsent(id) {
  // Try PATCH first
  try {
    const res = await doFetch(`${BASE}/consents/${encodeURIComponent(id)}/revoke`, {
      method: "PATCH",
    });
    return res.json();
  } catch (e) {
    if (!/ 404 | 405 /.test(" " + String(e.message) + " ")) throw e;
  }

  // Fallback: POST
  const res2 = await doFetch(`${BASE}/consents/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
  });
  return res2.json();
}

/**
 * List consents. Supports filtering by subject_id
 * GET /api/v1/consents?subject_id=...
 */
export async function listConsents(subject_id) {
  const url = subject_id
    ? `${BASE}/consents?subject_id=${encodeURIComponent(subject_id)}`
    : `${BASE}/consents`;
  const res = await doFetch(url, { method: "GET" });
  return res.json();
}

/**
 * List audit events. Supports filtering by consent_id
 * GET /api/v1/audit?consent_id=...
 */
export async function listAudit(consent_id) {
  const url = consent_id
    ? `${BASE}/audit?consent_id=${encodeURIComponent(consent_id)}`
    : `${BASE}/audit`;
  const res = await doFetch(url, { method: "GET" });
  return res.json();
}

/**
 * Export Consents CSV (server-side)
 * GET /api/v1/consents/export.csv?subject_id=&start_date=&end_date=
 */
export async function exportConsentsCSV(params = {}) {
  const q = new URLSearchParams();
  if (params.subject_id) q.set("subject_id", params.subject_id);
  if (params.start_date) q.set("start_date", params.start_date);
  if (params.end_date) q.set("end_date", params.end_date);

  const url = `${BASE}/consents/export.csv${q.toString() ? `?${q.toString()}` : ""}`;
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

// ===== Convenience: optional health ping =====
export async function ping() {
  try {
    const res = await fetch(`${BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ===== Helper to set/clear runtime override from UI if needed =====
export function setApiBaseOverride(urlOrEmpty) {
  if (!urlOrEmpty) {
    try { localStorage.removeItem(BASE_KEY); } catch {}
    return;
  }
  try { localStorage.setItem(BASE_KEY, stripTrailingSlash(String(urlOrEmpty))); } catch {}
}
