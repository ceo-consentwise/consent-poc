// frontend/consent-frontend/src/api.js

/**
 * Minimal, deployment-safe API client for the Consent PoC.
 *
 * Goals:
 * - Avoid double prefixes like /api/v1/api/v1
 * - Work locally AND on Render with separate frontend/backend domains
 * - Keep existing simple login (no JWT/OAuth) intact
 * - Be tolerant to Day7 vs Day8 endpoint shapes (grant/revoke)
 */

// ====== BASE resolution ======
const LOCAL_BASE = "http://127.0.0.1:8000/api/v1";
const RELATIVE_BASE = "/api/v1"; // used only when frontend & backend are same-origin
const RENDER_BACKEND_BASE = "https://consent-poc.onrender.com/api/v1"; // <-- your backend
const BASE_KEY = "api_base_override"; // optional override via localStorage

function trimSlashes(s) {
  return String(s).replace(/\/+$/, "");
}

/**
 * Decide which base URL to use:
 * 1) If localStorage override is set, use it (allows hot fixes without redeploy)
 * 2) If we're on your Render frontend host, use the Render backend domain
 * 3) If running on localhost, use local FastAPI
 * 4) Fallback to relative base (for same-origin setups)
 */
function resolveBase() {
  try {
    const override = localStorage.getItem(BASE_KEY);
    if (override && override.trim()) {
      return trimSlashes(override.trim());
    }
  } catch {}

  const host =
    typeof window !== "undefined" && window.location
      ? window.location.hostname
      : "";

  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  if (isLocal) return LOCAL_BASE;

  // Your Render FE host -> use the Render BE domain
  if (host.includes("consent-poc-1.onrender.com")) {
    return RENDER_BACKEND_BASE;
  }

  // Same-origin fallback (behind reverse proxy mapping /api/v1 -> backend)
  return RELATIVE_BASE;
}

const BASE = resolveBase();

/** Build final URL safely: no duplicate /api/v1 and no double slashes */
function buildUrl(path, query) {
  const base = trimSlashes(BASE);
  const cleanPath = String(path || "").replace(/^\/+/, ""); // remove leading /
  let url = `${base}/${cleanPath}`;

  if (query && typeof query === "object") {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).length) {
        qs.append(k, String(v));
      }
    });
    const qstr = qs.toString();
    if (qstr) url += `?${qstr}`;
  }
  return url;
}

// ====== Simple client-side "auth" (unchanged logic) ======
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

// ====== Fetch helper ======
async function doFetch(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch {}
    const msg = text || res.statusText || "Request failed";
    const e = new Error(`${res.status} ${msg}`);
    e.status = res.status;
    e.body = text;
    throw e;
  }
  const ctype = res.headers.get("content-type") || "";
  if (ctype.includes("application/json")) return res.json();
  return res;
}

// ====== API: Consents / Audit ======

/**
 * Grant consent
 * Body: { subject_id, data_use_case, meta? }
 * We also send purpose=data_use_case for Day7 compatibility.
 * Try POST /consents first (Day8+), then fallback to POST /consents/grant (Day7).
 */
export async function grantConsent({ subject_id, data_use_case, meta }) {
  const body = {
    subject_id,
    data_use_case,
    purpose: data_use_case,
    meta,
  };

  // Try new shape: POST /consents
  try {
    return await doFetch(buildUrl("consents"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Fallback to Day7: POST /consents/grant
    if (e.status === 404 || e.status === 405) {
      return await doFetch(buildUrl("consents/grant"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    throw e;
  }
}

/**
 * List consents
 * Optional filter: subject_id
 */
export async function listConsents(subject_id) {
  const url = buildUrl("consents", subject_id ? { subject_id } : undefined);
  return await doFetch(url, { method: "GET" });
}

/**
 * Revoke consent
 * Try PATCH /consents/{id}/revoke (Day8+), fallback to POST /consents/{id}/revoke (Day7).
 */
export async function revokeConsent(id) {
  const patchUrl = buildUrl(`consents/${encodeURIComponent(id)}/revoke`);
  try {
    return await doFetch(patchUrl, { method: "PATCH" });
  } catch (e) {
    if (e.status === 405 || e.status === 404) {
      // Day7 fallback
      return await doFetch(patchUrl, { method: "POST" });
    }
    throw e;
  }
}

/**
 * List audit events
 * Optional: consent_id
 */
export async function listAudit(consent_id) {
  const url = buildUrl("audit", consent_id ? { consent_id } : undefined);
  return await doFetch(url, { method: "GET" });
}

/**
 * Export consents CSV (server-side)
 * Query: subject_id?, start_date?, end_date?
 */
export async function exportConsentsCSV({ subject_id, start_date, end_date } = {}) {
  const url = buildUrl("consents/export.csv", {
    subject_id,
    start_date,
    end_date,
  });
  const res = await doFetch(url, { method: "GET" }); // doFetch returns Response if not JSON
  // Download
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

// Optional: quick health probe (ok if 404; not used by UI)
export async function ping() {
  try {
    const r = await fetch(buildUrl("health"));
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Helpers to manage/inspect the base at runtime (useful during debugging).
 */
export function setApiBaseOverride(url) {
  localStorage.setItem(BASE_KEY, trimSlashes(url));
  return getApiBase();
}
export function clearApiBaseOverride() {
  localStorage.removeItem(BASE_KEY);
  return getApiBase();
}
export function getApiBase() {
  return BASE;
}
