// frontend/consent-frontend/src/api.js

// ---------- Base URL handling (fixes double /api/v1 and 404s) ----------
const LOCAL_DEFAULT = "http://127.0.0.1:8000"; // host only, no /api/v1

// Read from Vite env if available; fallback to local
const ENV_BASE =
  (typeof import.meta !== "undefined" &&
   import.meta.env &&
   import.meta.env.VITE_API_BASE) || LOCAL_DEFAULT;

// Ensure no trailing slash, then append /api/v1 exactly once
const API_BASE = String(ENV_BASE).replace(/\/+$/, "");
const BASE = `${API_BASE}/api/v1`;

// ---------- Simple client-side auth (unchanged) ----------
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

// ---------- API helpers (preserve existing features) ----------
export async function grantConsent({ subject_id, data_use_case, meta }) {
  // Send both `data_use_case` and `purpose` (compat with backend mapping)
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

export async function exportConsentsCSV({ subject_id, start_date, end_date }) {
  // GET /consents/export.csv?subject_id=&start_date=&end_date=
  const params = new URLSearchParams();
  if (subject_id) params.set("subject_id", subject_id);
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);

  const url = `${BASE}/consents/export.csv${params.toString() ? `?${params}` : ""}`;
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
