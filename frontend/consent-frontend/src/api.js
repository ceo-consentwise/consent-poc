// frontend/consent-frontend/src/api.js

/**
 * Minimal, deployment-safe API client:
 * - Local dev default: http://127.0.0.1:8000/api/v1
 * - In prod/same-origin (behind reverse proxy / Render): /api/v1
 * - Optional runtime override: localStorage.setItem("api_base_override", "<url ending with /api/v1>")
 *
 * This file preserves existing features:
 * - Simple client-side auth (no JWT/RBAC)
 * - grantConsent, listConsents, revokeConsent, listAudit
 * - exportConsentsCSV
 */

// ---- BASE resolution ----
const LOCAL_BASE = "http://127.0.0.1:8000/api/v1";
const RELATIVE_BASE = "/api/v1";
const BASE_KEY = "api_base_override";

function trimTrailingSlash(s) {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

function resolveBase() {
  try {
    const override = localStorage.getItem(BASE_KEY);
    if (override && typeof override === "string" && override.trim()) {
      return trimTrailingSlash(override.trim());
    }
  } catch {}
  const host = (typeof window !== "undefined" && window.location && window.location.hostname) || "";
  if (host === "localhost" || host === "127.0.0.1") {
    return trimTrailingSlash(LOCAL_BASE);
  }
  // Render / same-origin reverse proxy
  return trimTrailingSlash(RELATIVE_BASE);
}

const BASE = resolveBase();

// ---- Auth (simple client-side) ----
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

// ---- Fetch helper (better error messages) ----
async function doFetch(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    // Read text safely for diagnostics
    let body = "";
    try { body = await res.text(); } catch {}
    throw new Error(`${init?.method || "GET"} ${url} -> ${res.status} ${res.statusText}${body ? ` | ${body}` : ""}`);
  }
  return res;
}

// ---- API: Consents & Audit ----
export async function grantConsent({ subject_id, data_use_case, meta }) {
  // Keep both data_use_case and purpose for compatibility with Day 7 backend
  const body = { subject_id, data_use_case, purpose: data_use_case, meta };
  const res = await doFetch(`${BASE}/consents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function listConsents(subject_id) {
  // Only include subject_id if provided
  const url = subject_id && subject_id.trim()
    ? `${BASE}/consents?subject_id=${encodeURIComponent(subject_id.trim())}`
    : `${BASE}/consents`;
  const res = await doFetch(url, { method: "GET" });
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
  const res = await doFetch(url, { method: "GET" });
  return res.json();
}

export async function exportConsentsCSV({ subject_id, start_date, end_date } = {}) {
  // Build query string safely
  const params = new URLSearchParams();
  if (subject_id && String(subject_id).trim()) params.set("subject_id", String(subject_id).trim());
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);

  const url = `${BASE}/consents/export.csv${params.toString() ? `?${params.toString()}` : ""}`;
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

// ---- Helpers for debugging base in the browser console ----
export function getResolvedBase() { return BASE; }
export function setApiBaseOverride(url) {
  if (!url) { localStorage.removeItem(BASE_KEY); return; }
  localStorage.setItem(BASE_KEY, url);
}
