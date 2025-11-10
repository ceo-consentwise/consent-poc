// frontend/consent-frontend/src/App.jsx

import { useEffect, useState } from "react";
import {
  getAuthState,
  setAuthState,
  clearAuthState,
  grantConsent,
  listConsents,
  revokeConsent,
  listAudit,
  exportConsentsCSV,
} from "./api";
import AuditTimeline from "./components/AuditTimeline";
import StatusChip from "./components/StatusChip";
import InlineMessage from "./components/InlineMessage";

/** Display helper: render ISO -> IST (Asia/Kolkata), 24h, with seconds */
/** Display helper: render ISO -> IST (Asia/Kolkata), 24h */
function fmtIST(iso) {
  try {
    if (!iso) return "";

    // If timestamp has no timezone (no Z or offset), treat it as UTC explicitly
    let normalized = iso;
    if (!/Z$|[+-]\d\d:\d\d$/.test(iso)) {
      normalized = iso + "Z";
    }

    return new Date(normalized).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).replace(",", "");
  } catch {
    return iso;
  }
}

function LoginPanel({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    // Simple PoC login (no backend): user/user123
    if (username === "user" && password === "user123") {
      const next = setAuthState({ username, loggedIn: true });
      onLoggedIn(next);
    } else {
      setErr("Invalid credentials. Use user / user123 for PoC.");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h2 style={{ marginBottom: 8 }}>Login</h2>
      <div style={{ color: "#666", marginBottom: 12 }}>Enter credentials to access the Consent Management PoC.</div>
      <InlineMessage type="error" text={err} />
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, background:"#fff", padding:16, border:"1px solid #eee", borderRadius:8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Username</span>
          <input value={username} onChange={(e)=>setUsername(e.target.value)} required
                 style={{ padding: 8, border: "1px solid #cfcfcf", borderRadius: 6 }} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Password</span>
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required
                 style={{ padding: 8, border: "1px solid #cfcfcf", borderRadius: 6 }} />
        </label>
        <button type="submit" style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}>Login</button>
      </form>
    </div>
  );
}

export default function App() {
  // ---- Auth ----
  const [auth, setAuth] = useState(() => getAuthState()); // { username, loggedIn }
  // ---- App state ----
  const [subjectId, setSubjectId] = useState("user-123");
  const [dataUseCase, setDataUseCase] = useState("marketing");
  const [meta, setMeta] = useState('{"campaign":"diwali"}');

  const [consents, setConsents] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // ---- Export filters ----
  const [expSubject, setExpSubject] = useState("");
  const [expStart, setExpStart] = useState(""); // YYYY-MM-DD
  const [expEnd, setExpEnd] = useState("");     // YYYY-MM-DD

  // NEW (minimal): grant timestamp fallback per consent id
  const [grantAtById, setGrantAtById] = useState({}); // { [consentId]: isoString }

  useEffect(() => { if (auth.loggedIn) refresh(); }, [auth.loggedIn]);

  async function refresh() {
    setLoading(true); setErr(""); setMsg("");
    try {
      const list = await listConsents(subjectId);
      setConsents(list);
      setMsg(`Loaded ${list.length} consents for "${subjectId}"`);

      // --- Minimal fallback: if a consent lacks created_at, derive from its audit (first 'grant') ---
      const needs = list
        .filter(c => {
          const createdRaw =
            c.created_at ??
            c.createdAt ??
            c.created ??
            c.timestamp ??
            c.updated_at ??
            c.updatedAt ??
            null;
          return !createdRaw && !(c.id in grantAtById);
        })
        .map(c => c.id);

      if (needs.length) {
        const entries = await Promise.all(needs.map(async (id) => {
          try {
            const events = await listAudit(id);
            // find grant, else earliest
            let chosen = null;
            if (Array.isArray(events) && events.length) {
              const grants = events.filter(e => String(e.action || "").toLowerCase().includes("grant"));
              chosen = (grants[0] || events[0]) || null;
            }
            const t = chosen?.timestamp || chosen?.time || chosen?.created_at || null;
            return [id, t];
          } catch {
            return [id, null];
          }
        }));
        const merged = Object.fromEntries(entries.filter(([,v]) => !!v));
        if (Object.keys(merged).length) {
          setGrantAtById(prev => ({ ...prev, ...merged }));
        }
      }
      // --- end fallback ---
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function onGrant(e) {
    e.preventDefault();
    if (!auth.loggedIn) return setErr("Please login first.");
    setLoading(true); setErr(""); setMsg("");
    try {
      let metaObj = null;
      if (meta && meta.trim()) {
        try { metaObj = JSON.parse(meta); }
        catch { throw new Error('Meta must be valid JSON, e.g. {"campaign":"diwali"}'); }
      }
      await grantConsent({ subject_id: subjectId, data_use_case: dataUseCase, meta: metaObj });
      await refresh();
      setMsg("Consent granted successfully.");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function onRevoke(id) {
    if (!auth.loggedIn) return setErr("Please login first.");
    const ok = window.confirm("Are you sure you want to revoke this consent?");
    if (!ok) return;
    setLoading(true); setErr(""); setMsg("");
    try {
      await revokeConsent(id);
      await refresh();
      setMsg("Consent revoked successfully.");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function onShowAudit(id) {
    if (!auth.loggedIn) return setErr("Please login first.");
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

  async function onExportConsents() {
    if (!auth.loggedIn) return setErr("Please login first.");
    setErr(""); setMsg("");
    try {
      await exportConsentsCSV({
        subject_id: expSubject.trim() || undefined,
        start_date: expStart || undefined,
        end_date: expEnd || undefined,
      });
      setMsg("Consents CSV downloaded.");
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  function onResetExportFilters() {
    setExpSubject("");
    setExpStart("");
    setExpEnd("");
  }

  function onResetSubject() {
    setSubjectId("");
    setAudit([]);
    setConsents([]);
    setMsg("Subject filter cleared. Click Refresh List to load all or set a subject.");
  }

  function onLogout() {
    clearAuthState();
    setAuth({ username: "", loggedIn: false });
    setConsents([]); setAudit([]); setMsg(""); setErr("");
  }

  // ---- Styles ----
  const shell = { padding: 20, maxWidth: 1024, margin: "0 auto",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" };
  const label = { display: "grid", gap: 4 };
  const input = { padding: 8, border: "1px solid #cfcfcf", borderRadius: 6 };
  const button = { padding: "8px 12px", borderRadius: 6, cursor: "pointer" };
  const ghostBtn = { ...button, background: "#f6f7f8", border: "1px solid #e6e6e6" };

  if (!auth.loggedIn) {
    return <LoginPanel onLoggedIn={(next) => setAuth(next)} />;
  }

  return (
    <div style={shell}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Consent Management PoC</h1>
          <div style={{ color: "#666", marginBottom: 8 }}>
            Enterprise flow — Grant → List → Revoke → Audit + CSV Exports
          </div>
        </div>
        <div style={{ fontSize: 14, color: "#555" }}>
          Logged in as <strong>{auth.username || "user"}</strong>&nbsp;
          <button onClick={onLogout} style={{ marginLeft: 8, ...button }}>Logout</button>
        </div>
      </div>

      <InlineMessage type="error" text={err} />
      <InlineMessage type="success" text={msg} />

      {/* Grant form (includes Subject filter) */}
      <form onSubmit={onGrant} style={{ display: "grid", gap: 10, marginBottom: 18, maxWidth: 760, background:"#fff", padding:12, border:"1px solid #eee", borderRadius:8 }}>
        <label style={label}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Subject ID</span>
            {/* R1: quick reset adjacent to subject filter */}
            <button type="button" onClick={onResetSubject} style={ghostBtn}>Reset</button>
          </span>
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

      {/* Export Consents Panel */}
      <div style={{ margin: "12px 0", padding: 12, background:"#fff", border:"1px solid #eee", borderRadius:8, maxWidth: 760 }}>
        <h3 style={{ marginTop: 0 }}>Export Consents (Server CSV)</h3>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={expSubject}
              onChange={(e)=>setExpSubject(e.target.value)}
              placeholder="Subject ID (optional)"
              style={{ ...input, minWidth: 220 }}
            />
            <input
              type="date"
              value={expStart}
              onChange={(e)=>setExpStart(e.target.value)}
              placeholder="Start date"
              style={input}
            />
            <input
              type="date"
              value={expEnd}
              onChange={(e)=>setExpEnd(e.target.value)}
              placeholder="End date"
              style={input}
            />
            <button onClick={onExportConsents} disabled={loading} style={button}>
              Download Consents CSV
            </button>
            {/* R1: Reset Filters inline with date/subject controls */}
            <button type="button" onClick={onResetExportFilters} style={ghostBtn}>
              Reset Filters
            </button>
          </div>
          <div style={{ color: "#666", fontSize: 12 }}>
            Tip: leave Subject blank to export all consents in the date range.
          </div>
        </div>
      </div>

      {/* Consents list */}
      <h2 style={{ marginTop: 8 }}>Consents</h2>
      <div style={{ overflowX: "auto" }}>
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
          <thead style={{ background: "#f6f7f8" }}>
            <tr>
              <th style={{ textAlign: "left", width: 320 }}>ID</th>
              <th style={{ textAlign: "left", width: 180 }}>Subject</th>
              <th style={{ textAlign: "left", width: 220 }}>Data Use Case</th>
              <th style={{ textAlign: "left", width: 120 }}>Status</th>
              <th style={{ textAlign: "left", width: 220 }}>Created At (IST)</th>
              <th style={{ textAlign: "left", width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {consents.length > 0 ? (
              consents.map((c) => {
                // Prefer consent's own created time; else fallback to derived grant timestamp
                const createdRaw =
                  c.created_at ??
                  c.createdAt ??
                  c.created ??
                  c.timestamp ??
                  c.updated_at ??
                  c.updatedAt ??
                  grantAtById[c.id] ??
                  null;

                return (
                  <tr key={c.id}>
                    <td title={c.id} style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.id}
                    </td>
                    <td>{c.subject_id}</td>
                    <td>{c.data_use_case || c.purpose}</td>
                    <td><StatusChip status={c.status} /></td>
                    <td>{createdRaw ? fmtIST(createdRaw) : "—"}</td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => onRevoke(c.id)} disabled={loading || String(c.status).toLowerCase() === "revoked"} style={button}>
                        Revoke
                      </button>
                      <button onClick={() => onShowAudit(c.id)} disabled={loading} style={button}>
                        Audit
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan="6" style={{ textAlign: "center", padding: 12, color: "#777" }}>No consents yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Audit timeline */}
      <h2 style={{ marginTop: 24 }}>Audit Timeline</h2>
      <AuditTimeline events={audit} />
      {audit?.length > 0 && (
        <button
          onClick={() => {
            // client-side CSV (audit) remains available if you had it elsewhere
            const rows = audit.map(ev => ({
              timestamp: ev.timestamp ?? "",
              action: ev.action ?? "",
              actor: ev.actor ?? "",
              details: typeof ev.details === "string" ? ev.details : JSON.stringify(ev.details ?? {}),
            }));
            if (!rows.length) return;
            const headers = Object.keys(rows[0]);
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
          }}
          style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6 }}
        >
          Export Audit (client CSV)
        </button>
      )}
    </div>
  );
}
