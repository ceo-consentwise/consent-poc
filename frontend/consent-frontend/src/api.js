// frontend/consent-frontend/src/api.js

const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api/v1";

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
  // We send both `data_use_case` and legacy `purpose` to remain compatible
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

/**
 * ---- Export Consents CSV (server-side) ----
 * Optional filters: subject_id, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
 * On success => triggers download.
 * On 404 => throws a friendly error (no data).
 */
export async function exportConsentsCSV({ subject_id, start_date, end_date }) {
  const params = new URLSearchParams();
  if (subject_id) params.set("subject_id", subject_id);
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);

  const url = `${BASE}/consents/export.csv${
    params.toString() ? "?" + params.toString() : ""
  }`;
  const res = await fetch(url);
  if (res.status === 404) {
    await res.text().catch(() => "");
    throw new Error("No matching consents found for the selected filters.");
  }
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

// ---------- Ingestion: Customer flows ----------

export async function customerLoginInitiate(mobileNumber, applicationNumber) {
  const res = await fetch(`${BASE}/ingest/customer/login-initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mobile_number: mobileNumber,
      application_number: applicationNumber || null,
    }),
  });
  if (!res.ok) {
    throw new Error(`Customer login-initiate failed: ${res.status}`);
  }
  return res.json(); // { transaction_id, mode, otp }
}

export async function customerVerifyOtp(transactionId, otp) {
  const res = await fetch(`${BASE}/ingest/customer/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction_id: transactionId,
      otp,
    }),
  });
  if (!res.ok) {
    throw new Error(`Customer verify-otp failed: ${res.status}`);
  }
  return res.json(); // { status, transaction_id, mobile_number, application_number }
}

export async function customerCreateConsent({
  transactionId,
  tenantId,
  productId,
  purpose,
  version,
  meta,
}) {
  const res = await fetch(`${BASE}/ingest/customer/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction_id: transactionId,
      tenant_id: tenantId || null,
      product_id: productId || null,
      purpose,
      version: version || null,
      meta: meta || null,
    }),
  });
  if (!res.ok) {
    throw new Error(`Customer consent create failed: ${res.status}`);
  }
  return res.json(); // ConsentOut
}

// ---------- Ingestion: Branch flows ----------

export async function branchInitiate(
  branchOfficerId,
  mobileNumber,
  applicationNumber,
) {
  const res = await fetch(`${BASE}/ingest/branch/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branch_officer_id: branchOfficerId,
      mobile_number: mobileNumber,
      application_number: applicationNumber || null,
    }),
  });
  if (!res.ok) {
    throw new Error(`Branch initiate failed: ${res.status}`);
  }
  return res.json(); // { transaction_id, mode, otp }
}

export async function branchVerifyOtp(transactionId, otp) {
  const res = await fetch(`${BASE}/ingest/branch/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction_id: transactionId,
      otp,
    }),
  });
  if (!res.ok) {
    throw new Error(`Branch verify-otp failed: ${res.status}`);
  }
  return res.json(); // { status, transaction_id, mobile_number, application_number, branch_officer_id }
}

export async function branchCreateConsent({
  transactionId,
  branchOfficerId,
  tenantId,
  productId,
  purpose,
  version,
  meta,
}) {
  const res = await fetch(`${BASE}/ingest/branch/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction_id: transactionId,
      branch_officer_id: branchOfficerId,
      tenant_id: tenantId || null,
      product_id: productId || null,
      purpose,
      version: version || null,
      meta: meta || null,
    }),
  });
  if (!res.ok) {
    throw new Error(`Branch consent create failed: ${res.status}`);
  }
  return res.json(); // ConsentOut
}

// ---------- Object-style ingestion wrappers (used by ingestion components) ----------

export async function ingestCustomerLoginInitiate({
  mobile_number,
  application_number,
}) {
  return customerLoginInitiate(mobile_number, application_number);
}

export async function ingestCustomerVerifyOtp({ transaction_id, otp }) {
  return customerVerifyOtp(transaction_id, otp);
}

export async function ingestCustomerCreateConsent({
  transaction_id,
  tenant_id,
  product_id,
  purpose,
  version,
  meta,
}) {
  return customerCreateConsent({
    transactionId: transaction_id,
    tenantId: tenant_id,
    productId: product_id,
    purpose,
    version,
    meta,
  });
}

export async function ingestBranchInitiate({
  branch_officer_id,
  mobile_number,
  application_number,
}) {
  return branchInitiate(branch_officer_id, mobile_number, application_number);
}

export async function ingestBranchVerifyOtp({ transaction_id, otp }) {
  return branchVerifyOtp(transaction_id, otp);
}

export async function ingestBranchCreateConsent({
  transaction_id,
  branch_officer_id,
  tenant_id,
  product_id,
  purpose,
  version,
  meta,
}) {
  return branchCreateConsent({
    transactionId: transaction_id,
    branchOfficerId: branch_officer_id,
    tenantId: tenant_id,
    productId: product_id,
    purpose,
    version,
    meta,
  });
}

// ---------- NEW: subject-level audit (mobile + application) ----------

export async function listAuditForSubject(mobileNumber, applicationNumber) {
  const params = new URLSearchParams();
  if (mobileNumber) params.set("mobile_number", mobileNumber);
  if (applicationNumber) params.set("application_number", applicationNumber);

  const url = `${BASE}/audit${params.toString() ? "?" + params.toString() : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audit list failed: ${res.status}`);
  return res.json();
}

// Global audit list (for Regulator CMP)
export async function listAuditGlobal() {
  // Use the same base URL pattern you use for other endpoints.
  // Example (adapt to your file):
  // const res = await fetch(`${API_BASE}/audit`);
  const res = await fetch(`${BASE}/audit`);
  if (!res.ok) {
    throw new Error("Failed to load global audit events");
  }
  return res.json();
}


// ---------- Consent Template management ----------

export async function listTemplates() {
  const res = await fetch(`${BASE}/consents/templates`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Template list failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function createTemplateVersion(payload) {
  // payload: { tenant_id, product_id, purpose, template_type, title?, body_text? }
  const res = await fetch(`${BASE}/consents/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Template create failed: ${res.status} ${text}`);
  }
  return res.json();
}
