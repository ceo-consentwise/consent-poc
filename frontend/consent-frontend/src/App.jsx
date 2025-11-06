// consent-frontend/src/App.jsx
import { useEffect, useState } from "react";
import { grantConsent, listConsents, revokeConsent, listAudit } from "./api";
import AuditTimeline from "./components/AuditTimeline";

// CSV export helper
function exportCSV(events) {
  if (!events || events.length === 0) return;
  const rows = events.map(ev => ({
    timestamp: ev.timestamp ?? "",
    action: ev.action ?? "",
    actor: ev.actor ?? "",
    details:
      typeof ev.details === "string"
        ? ev.details
        : JSON.stringify(ev.details ?? {}),
  }));

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r =>
      headers
        .map(h => {
          const cell = String(r[h] ?? "");
          const needsQuote = /[",\n]/.test(cell);
          const escaped = cell.replace(/"/g, '""');
          return needsQuote ? `"${escaped}"` : escaped;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "audit_log.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [subjectId, setSubjectId] = useState("user-123");
  const [purpose, setPurpose] = useState("marketing");
  const [meta, setMeta] = useState('{"campaign":"diwali"}');
  const [consents, setConsents] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const list = await listConsents(subjectId);
      setConsents(list);
      setMsg(`Loaded ${list.length} consents for "${subjectId}"`);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Load once on mount
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onGrant(e) {
    e.preventDefault();
    setLoading(true);
    try {
      let metaObj = null;
      if (meta && meta.trim().length) {
        try {
          metaObj = JSON.parse(meta);
        } catch {
          throw new Error("Meta must be valid JSON (e.g., {\"campaign\":\"diwali\"})");
        }
      }
      await grantConsent({ subject_id: subjectId, purpose, meta: metaObj });
      await refresh();
      setMsg("Consent granted.");
    } catch (e) {
      setMsg(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function onRevoke(id) {
    setLoading(true);
    try {
      await revokeConsent(id);
      await refresh();
      setMsg("Consent revoked.");
    } catch (e) {
      setMsg(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function onShowAudit(id) {
    setLoading(true);
    try {
      const events = await listAudit(id);
      setAudit(events);
      setMsg(`Audit events: ${events.length}`);
    } catch (e) {
      setMsg(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 960, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ marginBottom: 8 }}>Consent Management PoC</h1>
      <div style={{ color: "#666", marginBottom: 16 }}>
        Grant → List → Revoke → View Audit Timeline · Demo UI
      </div>

      {/* Grant form */}
      <form onSubmit={onGrant} style={{ display: "grid", gap: 8, marginBottom: 16, maxWidth: 720 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Subject ID</span>
          <input
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            required
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span>Purpose</span>
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span>Meta (JSON)</span>
          <input
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            placeholder='{"campaign":"diwali"}'
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="submit" disabled={loading} style={{ padding: "8px 12px" }}>
            Grant Consent
          </button>
          <button type="button" onClick={refresh} disabled={loading} style={{ padding: "8px 12px" }}>
            Refresh List
          </button>
        </div>
      </form>

      {/* Status */}
      <p style={{ minHeight: 20 }}>{loading ? "Loading..." : msg}</p>

      {/* Consent list */}
      <h2 style={{ marginTop: 8 }}>Consents</h2>
      <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
        <thead style={{ background: "#f3f3f3" }}>
          <tr>
            <th style={{ textAlign: "left" }}>ID</th>
            <th style={{ textAlign: "left" }}>Subject</th>
            <th style={{ textAlign: "left" }}>Purpose</th>
            <th style={{ textAlign: "left" }}>Status</th>
            <th style={{ textAlign: "left" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {consents.length > 0 ? (
            consents.map((c) => (
              <tr key={c.id}>
                <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.id}>
                  {c.id}
                </td>
                <td>{c.subject_id}</td>
                <td>{c.purpose}</td>
                <td>{c.status}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onRevoke(c.id)} disabled={loading || c.status === "revoked"}>
                    Revoke
                  </button>
                  <button onClick={() => onShowAudit(c.id)} disabled={loading}>
                    Audit
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", padding: 12, color: "#777" }}>
                No consents yet
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Audit timeline */}
      <h2 style={{ marginTop: 24 }}>Audit Timeline</h2>
      <AuditTimeline events={audit} />
      {audit?.length > 0 && (
        <button onClick={() => exportCSV(audit)} style={{ marginTop: 12 }}>
          Export Audit to CSV
        </button>
      )}
    </div>
  );
}
