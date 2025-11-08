import { useEffect, useState } from "react";
import { grantConsent, listConsents, revokeConsent, listAudit } from "./api";
import AuditTimeline from "./components/AuditTimeline";
import StatusChip from "./components/StatusChip";
import InlineMessage from "./components/InlineMessage";
import OperatorBar from "./components/OperatorBar";

// CSV export helper for audit
function exportCSV(events) {
  if (!events || events.length === 0) return;
  const rows = events.map(ev => ({
    timestamp: ev.timestamp ?? "",
    action: ev.action ?? "",
    actor: ev.actor ?? "",
    details: typeof ev.details === "string" ? ev.details : JSON.stringify(ev.details ?? {}),
  }));
  const headers = Object.keys(rows[0] || {timestamp:"",action:"",actor:"",details:""});
  const csv = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => {
        const cell = String(r[h] ?? "");
        const needsQuote = /[",\n]/.test(cell);
        const escaped = cell.replace(/"/g, '""');
        return needsQuote ? `"${escaped}"` : escaped;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "audit_log.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [subjectId, setSubjectId] = useState("user-123");
  const [dataUseCase, setDataUseCase] = useState("marketing");
  const [meta, setMeta] = useState('{"campaign":"diwali"}');

  const [consents, setConsents] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [operator, setOperator] = useState(() => {
    try { return localStorage.getItem("operator") || ""; } catch { return ""; }
  });

  async function refresh() {
    setLoading(true); setErr(""); setMsg("");
    try {
      const list = await listConsents(subjectId);
      setConsents(list);
      setMsg(`Loaded ${list.length} consents for "${subjectId}"`);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function onGrant(e) {
    e.preventDefault();
    setLoading(true); setErr(""); setMsg("");
    try {
      let metaObj = null;
      if (meta && meta.trim()) {
        try { metaObj = JSON.parse(meta); }
        catch { throw new Error('Meta must be valid JSON, e.g. {"campaign":"diwali"}'); }
      }
      await grantConsent({ subject_id: subjectId, data_use_case: dataUseCase, meta: metaObj }, operator);
      await refresh();
      setMsg("Consent granted successfully.");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function onRevoke(id) {
    const ok = window.confirm("Are you sure you want to revoke this consent?");
    if (!ok) return;
    setLoading(true); setErr(""); setMsg("");
    try {
      await revokeConsent(id, operator);
      await refresh();
      setMsg("Consent revoked successfully.");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function onShowAudit(id) {
    setLoading(true); setErr(""); setMsg("");
    try {
      const events = await listAudit(id);
      setAudit(events);
      setMsg(`Loaded ${events.length} audit events for selected consent.`);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  const shell = { padding: 20, maxWidth: 1024, margin: "0 auto",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" };
  const label = { display: "grid", gap: 4 };
  const input = { padding: 8, border: "1px solid #cfcfcf", borderRadius: 6 };
  const button = { padding: "8px 12px", borderRadius: 6, cursor: "pointer" };

  return (
    <div style={shell}>
      <h1 style={{ marginBottom: 4 }}>Consent Management PoC</h1>
      <div style={{ color: "#666", marginBottom: 16 }}>
        Enterprise flow — Grant → List → Revoke → Audit Timeline
      </div>

      <OperatorBar operator={operator} setOperator={setOperator} />

      <InlineMessage type="error" text={err} />
      <InlineMessage type="success" text={msg} />

      <form onSubmit={onGrant} style={{ display: "grid", gap: 10, marginBottom: 18, maxWidth: 760, background:"#fff", padding:12, border:"1px solid #eee", borderRadius:8 }}>
        <label style={label}>
          <span>Subject ID</span>
          <input value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setAudit([]); }} required style={input} />
        </label>
        <label style={label}>
          <span>Data Use Case</span>
          <input value={dataUseCase} onChange={(e) => setDataUseCase(e.target.value)} required style={input} />
        </label>
        <label style={label}>
          <span>Meta (JSON)</span>
          <input value={meta} onChange={(e) => setMeta(e.target.value)} placeholder='{"campaign":"diwali"}' style={input} />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button type="submit" disabled={loading} style={button}>Grant Consent</button>
          <button type="button" onClick={refresh} disabled={loading} style={button}>Refresh List</button>
        </div>
      </form>

      <h2 style={{ marginTop: 8 }}>Consents</h2>
      <div style={{ overflowX: "auto" }}>
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
          <thead style={{ background: "#f6f7f8" }}>
            <tr>
              <th style={{ textAlign: "left", width: 320 }}>ID</th>
              <th style={{ textAlign: "left", width: 180 }}>Subject</th>
              <th style={{ textAlign: "left", width: 220 }}>Data Use Case</th>
              <th style={{ textAlign: "left", width: 120 }}>Status</th>
              <th style={{ textAlign: "left", width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {consents.length > 0 ? (
              consents.map((c) => (
                <tr key={c.id}>
                  <td title={c.id} style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.id}
                  </td>
                  <td>{c.subject_id}</td>
                  <td>{c.data_use_case || c.purpose}</td>
                  <td><StatusChip status={c.status} /></td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => onRevoke(c.id)} disabled={loading || c.status === "revoked"} style={button}>
                      Revoke
                    </button>
                    <button onClick={() => onShowAudit(c.id)} disabled={loading} style={button}>
                      Audit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5" style={{ textAlign: "center", padding: 12, color: "#777" }}>No consents yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 24 }}>Audit Timeline</h2>
      <AuditTimeline events={audit} />
      {audit?.length > 0 && (
        <button onClick={() => exportCSV(audit)} style={{ marginTop: 12, ...button }}>
          Export Audit to CSV
        </button>
      )}
    </div>
  );
}
