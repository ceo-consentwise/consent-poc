const BASE = "http://127.0.0.1:8000/api/v1";

export async function grantConsent({ subject_id, data_use_case, meta }, operator) {
  const body = { subject_id, data_use_case, purpose: data_use_case, meta };
  const res = await fetch(`${BASE}/consents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Actor": operator || ""
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Grant failed: ${res.status}`);
  return res.json();
}

export async function listConsents(subject_id) {
  const url = subject_id ? `${BASE}/consents?subject_id=${encodeURIComponent(subject_id)}` : `${BASE}/consents`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

export async function revokeConsent(id, operator) {
  const res = await fetch(`${BASE}/consents/${id}/revoke`, {
    method: "PATCH",
    headers: { "X-Actor": operator || "" }
  });
  if (!res.ok) throw new Error(`Revoke failed: ${res.status}`);
  return res.json();
}

export async function listAudit(consent_id) {
  const url = consent_id ? `${BASE}/audit?consent_id=${encodeURIComponent(consent_id)}` : `${BASE}/audit`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audit list failed: ${res.status}`);
  return res.json();
}
