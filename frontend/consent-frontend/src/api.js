// frontend/consent-frontend/src/api.js

// --- Base URL resolution (minimal + robust) ---
// Priority:
// 1) VITE_API_BASE (e.g. https://consent-poc.onrender.com)
// 2) If running on localhost, default to local FastAPI
// 3) Otherwise, fall back to same-origin (useful when front+back are under one domain)
const fromEnv = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) || "";
const envBase = fromEnv.replace(/\/+$/, ""); // trim trailing slash

const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const originBase =
  typeof window !== "undefined" ? window.location.origin.replace(/\/+$/, "") : "";

const DEFAULT_HTTP_BASE = envBase || (isLocal ? "http://127.0.0.1:8000" : originBase);

// Final API base including the /api/v1 prefix
const BASE = `${DEFAULT_HTTP_BASE}/api/v1`;

// ---- Auth (simple, client-side only) ----
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

// ---- Small fetch helpers ----
async function getJSON(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  return res.json();
}

async function sendJSON(url, method, bodyObj) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: bodyObj != null ? JSON.stringify(bodyObj) : undefined,
    credentials: "omit",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  return res.json();
}

// ---- Consents/Audit API (keeps existing signatures) ----
export async function grantConsent({ subject_id, data_use_case, meta }) {
  // send both data_use_case and purpose (backward-compat with Day 7)
  const body = { subject_id, data_use_case, purpose: data_use_case, meta };
  return sendJSON(`${BASE}/consents`, "POST", body);
}

export async function listConsents(subject_id) {
  const url = subject_id
    ? `${BASE}/consents?subject_id=${encodeURIComponent(subject_id)}`
    : `${BASE}/consents`;
  return getJSON(url);
}

export async function revokeConsent(id) {
  return sendJSON(`${BASE}/consents/${encodeURIComponent(id)}/revoke`, "PATCH");
}

export async function listAudit(consent_id) {
  const url = consent_id
    ? `${BASE}/audit?consent_id=${encodeURIComponent(consent_id)}`
    : `${BASE}/audit`;
  return getJSON(url);
}

export async function exportConsentsCSV({ subject_id, start_date, end_date }) {
  const params = new URLSearchParams();
  if (subject_id) params.set("subject_id", subject_id);
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);

  const res = await fetch(`${BASE}/consents/export.csv?${params.toString()}`);
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

// Optional: quick sanity check you can call from the UI console
export function __debug_api_base() { return { BASE, DEFAULT_HTTP_BASE, envBase }; }
