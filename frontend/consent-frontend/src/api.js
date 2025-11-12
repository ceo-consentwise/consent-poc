// frontend/consent-frontend/src/api.js

/**
 * Deployment-safe API client for Consent PoC
 * - Local dev default:  http://127.0.0.1:8000/api/v1
 * - Render (two-domain): https://consent-poc.onrender.com/api/v1
 * - Same-origin reverse proxy: /api/v1
 * - Optional runtime override: localStorage.setItem("api_base_override", "<url>")
 *
 * NOTE: We also honor VITE_API_BASE if you want to bake the base via env.
 */

// ---- BASE resolution ----
const LOCAL_BASE = "http://127.0.0.1:8000/api/v1";
const RELATIVE_BASE = "/api/v1"; // for same-origin deployments
const RENDER_BACKEND_BASE = "https://consent-poc.onrender.com/api/v1"; // your backend
const BASE_KEY = "api_base_override";

// If present at build time, this wins (e.g. Vite env)
const ENV_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  "";

function resolveBase() {
  // 1) Manual override (useful for debugging prod without rebuild)
  try {
    const override = localStorage.getItem(BASE_KEY);
    if (override && typeof override === "string" && override.trim()) {
      return override.trim().replace(/\/+$/, "");
    }
  } catch {}

  // 2) Build-time env
  if (ENV_BASE && typeof ENV_BASE === "string") {
    return ENV_BASE.trim().replace(/\/+$/, "");
  }

  // 3) Detect environment by hostname
  const host =
    typeof window !== "undefined" && window.location
      ? window.location.hostname
      : "";

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.endsWith(".local");

  if (isLocal) return LOCAL_BASE;

  // If we’re on your Render **frontend** domain, use your Render **backend** domain:
  if (host.includes("consent-poc-1.onrender.com")) {
    return RENDER_BACKEND_BASE;
  }

  // Otherwise assume same-origin reverse proxy
  return RELATIVE_BASE;
}

export const BASE = resolveBase();

// ---- Tiny client-side auth store (unchanged behavior) ----
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

// ---- Fetch helper: better errors, no double-prefix bugs ----
async function doFetch(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const msg = text && text.length < 400 ? text : res.statusText;
    throw new Error(`${res.status} ${msg || "Request failed"}`);
  }
  return res;
}

/**
 * ---- Consents/Audit API ----
 * Endpoints (per Day 7 carry-over):
 *   POST   /consents                  (grant)
 *   PATCH  /consents/{id}/revoke      (revoke)
 *   GET    /consents                  (list; ?subject_id=)
 *   GET    /audit                     (list; ?consent_id=)
 *   GET    /consents/export.csv       (CSV)
 *   GET    /audit/export.csv          (CSV)
 */

export async function grantConsent({ subject_id, data_use_case, meta }) {
  // Some earlier builds used POST /consents/grant. We try /consents first, then fall back.
  const body = {
    subject_id,
    data_use_case,
    purpose: data_use_case, // keep mirror for older responses
    meta,
  };

  // Try the canonical route first
  let res = await fetch(`${BASE}/consents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 405 || res.status === 404) {
    // Fallback to legacy route if backend expects it
    res = await fetch(`${BASE}/consents/grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Grant failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function listConsents(subject_id) {
  const qs = subject_id
    ? `?subject_id=${encodeURIComponent(subject_id)}`
    : "";
  const res = await doFetch(`${BASE}/consents${qs}`);
  return res.json();
}

export async function revokeConsent(id) {
  const res = await fetch(`${BASE}/consents/${id}/revoke`, { method: "PATCH" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Revoke failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function listAudit(consent_id) {
  const qs = consent_id
    ? `?consent_id=${encodeURIComponent(consent_id)}`
    : "";
  const res = await doFetch(`${BASE}/audit${qs}`);
  return res.json();
}

// ---- CSV Exports ----
export async function exportConsentsCSV({
  subject_id,
  start_date,
  end_date,
} = {}) {
  const params = new URLSearchParams();
  if (subject_id) params.set("subject_id", subject_id);
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);

  const url =
    params.toString().length > 0
      ? `${BASE}/consents/export.csv?${params.toString()}`
      : `${BASE}/consents/export.csv`;

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

export async function exportAuditCSV({
  consent_id,
  start_date,
  end_date,
} = {}) {
  const params = new URLSearchParams();
  if (consent_id) params.set("consent_id", consent_id);
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);

  const url =
    params.toString().length > 0
      ? `${BASE}/audit/export.csv?${params.toString()}`
      : `${BASE}/audit/export.csv`;

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

// ---- Optional: simple health check helper ----
export async function ping() {
  try {
    const res = await fetch(`${BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
