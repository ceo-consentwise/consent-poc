// frontend/consent-frontend/src/api.js

// --- Base URL selection (robust for dev + Render) ---
const DEV_BASE = "http://127.0.0.1:8000/api/v1";
const PROD_BASE = "https://consent-poc.onrender.com/api/v1";

// Prefer an env var if you set one in your hosting (Render, Netlify, etc.)
let BASE = DEV_BASE;
try {
  const hasVite = typeof import.meta !== "undefined" && import.meta.env;
  if (hasVite && import.meta.env.VITE_API_BASE) {
    BASE = import.meta.env.VITE_API_BASE;
  } else if (
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith("onrender.com") ||
     window.location.hostname.endsWith("onrenderapp.com"))
  ) {
    BASE = PROD_BASE;
  }
} catch {
  // fall back to DEV_BASE
}

/**
 * ---- Auth (simple, client-side only) ----
 * We keep a tiny localStorage-based auth so your existing "simple login" works.
 * No headers are sent to the backend (keeps backend unchanged).
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
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function clearAuthState() {
  try { localStorage.removeItem(AUTH_KEY); } catch {}
}

/**
 * ---- Consents/Audit API ----
 */
export async function grantConsent({ subject_id, data_use_case, meta }) {
  // Send both fields to remain compatible with backend that mirrors data_use_case/purpose
  const body = { subject_id, data_use_case, purpose: data_use_case, meta };
  const res = await fetch(`${BASE}/consents`, {
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
    ? `${BASE}/consents?subject_id=${encodeURIComponent(subject_id)}`
    : `${BASE}/consents`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
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
  const url = consent_id
    ? `${BASE}/audit?consent_id=${encodeURIComponent(consent_id)}`
    : `${BASE}/audit`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audit list failed: ${res.status}`);
  return res.json();
}

// Server-side CSV export (Consents)
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

export { BASE }; // (optional) useful for debugging in UI
