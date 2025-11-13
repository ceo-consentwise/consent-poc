// frontend/consent-frontend/src/api.js

<<<<<<< HEAD


const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api/v1";


=======
>>>>>>> 772f969823ca69a2538fdff83399cb4b21efe281
/**
 * Deployment-safe API client
 * - Local dev default: http://127.0.0.1:8000/api/v1
 * - Render (separate FE/BE): set VITE_API_BASE or localStorage override
 * - Avoids /api/v1/api/v1 by normalizing slashes
 * - Endpoint fallback: tries canonical paths, then alternative backend paths
 */

// -------------------- BASE resolution --------------------
const LOCAL_BASE = "http://127.0.0.1:8000/api/v1";
const RELATIVE_BASE = "/api/v1"; // for same-origin proxy setups
const BASE_KEY = "api_base_override"; // localStorage key

function normalizeBase(u) {
  // Remove trailing slashes
  return String(u || "").replace(/\/+$/, "");
}

function resolveBase() {
  // 1) explicit override via env (Render recommended)
  const envBase = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE)
    ? import.meta.env.VITE_API_BASE
    : "";

  if (envBase && envBase.trim()) return normalizeBase(envBase);

  // 2) runtime override for quick fixes (no rebuild)
  try {
    const ls = localStorage.getItem(BASE_KEY);
    if (ls && ls.trim()) return normalizeBase(ls);
  } catch {}

  // 3) heuristic: localhost vs hosted
  const host = (typeof window !== "undefined" && window.location && window.location.hostname) ? window.location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) return normalizeBase(LOCAL_BASE);

  // 4) default to relative (works only if you proxy /api/v1 at the FE domain)
  return normalizeBase(RELATIVE_BASE);
}

export const BASE = resolveBase();

// -------------------- Simple client-side auth (unchanged behavior) --------------------
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

// -------------------- Fetch helper --------------------
async function doFetch(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${init?.method || "GET"} ${url} failed: ${res.status} ${text || res.statusText}`);
  }
  return res;
}

// -------------------- Consents --------------------

// Create/grant consent.
// Canonical: POST `${BASE}/consents`
// Fallback (your backend observation): POST `${BASE}/`
export async function grantConsent(body) {
  const first = `${BASE}/consents`;
  const second = `${BASE}/`; // fallback

  // try canonical
  {
    const res = await fetch(first, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    if (res.ok) return res.json();
    // If the server says 404 or 405 etc., try fallback
    if (res.status !== 200 && res.status !== 201) {
      // proceed to fallback
    } else {
      // if other non-ok, still throw
      const text = await res.text().catch(() => "");
      throw new Error(`Grant failed: ${res.status} ${text}`);
    }
  }

  // fallback: POST /
  {
    const res = await fetch(second, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Grant failed (fallback): ${res.status} ${text}`);
    }
    return res.json();
  }
}

// List consents.
// Canonical: GET `${BASE}/consents?subject_id=...`
// Fallback:  GET `${BASE}/?subject_id=...`  (in case list also lives at root)
export async function listConsents(subject_id) {
  const q = subject_id ? `?subject_id=${encodeURIComponent(subject_id)}` : "";
  const first = `${BASE}/consents${q}`;
  const second = `${BASE}/${q}`;

  // try canonical
  {
    const res = await fetch(first);
    if (res.ok) return res.json();
  }

  // fallback
  {
    const res = await fetch(second);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`List failed: ${res.status} ${text}`);
    }
    return res.json();
  }
}

// Revoke consent.
// Canonical (earlier docs): PATCH `${BASE}/consents/{id}/revoke`
// Your correction (observed backend): PATCH `${BASE}/{id}/revoke`
export async function revokeConsent(id) {
  const first = `${BASE}/consents/${encodeURIComponent(id)}/revoke`;
  const second = `${BASE}/${encodeURIComponent(id)}/revoke`;

  // try canonical
  {
    const res = await fetch(first, { method: "PATCH" });
    if (res.ok) return res.json();
  }

  // fallback (your backend wiring)
  {
    const res = await fetch(second, { method: "PATCH" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Revoke failed: ${res.status} ${text}`);
    }
    return res.json();
  }
}

// -------------------- Audit --------------------

// List audit events for a given consent_id.
// (This one appears stable in your backend)
export async function listAudit(consent_id) {
  const url = `${BASE}/audit?consent_id=${encodeURIComponent(consent_id)}`;
  const res = await doFetch(url, { method: "GET" });
  return res.json();
}

// Server CSV export for consents.
// Canonical: GET `${BASE}/consents/export.csv?subject_id=&start_date=&end_date=`
export async function exportConsentsCSV({ subject_id, start_date, end_date } = {}) {
  const params = new URLSearchParams();
  if (subject_id) params.set("subject_id", subject_id);
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

// Optional tiny health check (not used by UI)
export async function ping() {
  try {
    const res = await fetch(`${BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
