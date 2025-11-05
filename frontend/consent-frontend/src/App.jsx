import { useEffect, useState } from "react";
import { grantConsent, listConsents, revokeConsent, listAudit } from "./api";

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
      setMsg(`Loaded ${list.length} consents`);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function onGrant(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const metaObj = meta ? JSON.parse(meta) : null;
      await grantConsent({ subject_id: subjectId, purpose, meta: metaObj });
      await refresh();
      setMsg("Consent granted.");
    } catch (e) {
      setMsg(String(e));
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
      setMsg(String(e));
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
      setMsg(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{padding: 20, maxWidth: 900}}>
      <h1>Consent Management PoC</h1>

      <form onSubmit={onGrant} style={{display:"grid", gap:8, marginBottom:16}}>
        <label>
          Subject ID:
          <input value={subjectId} onChange={e=>setSubjectId(e.target.value)} required />
        </label>
        <label>
          Purpose:
          <input value={purpose} onChange={e=>setPurpose(e.target.value)} required />
        </label>
        <label>
          Meta (JSON):
          <input value={meta} onChange={e=>setMeta(e.target.value)} />
        </label>
        <div style={{display:"flex", gap:8}}>
          <button type="submit" disabled={loading}>Grant Consent</button>
          <button type="button" onClick={refresh} disabled={loading}>Refresh List</button>
        </div>
      </form>

      <p>{loading ? "Loading..." : msg}</p>

      <h2>Consents</h2>
      <table border="1" cellPadding="6" style={{borderCollapse:"collapse", width:"100%"}}>
        <thead>
          <tr><th>ID</th><th>Subject</th><th>Purpose</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {consents.map(c => (
            <tr key={c.id}>
              <td style={{maxWidth:280, overflow:"hidden", textOverflow:"ellipsis"}} title={c.id}>{c.id}</td>
              <td>{c.subject_id}</td>
              <td>{c.purpose}</td>
              <td>{c.status}</td>
              <td>
                <button onClick={() => onRevoke(c.id)} disabled={c.status === "revoked"}>Revoke</button>
                <button onClick={() => onShowAudit(c.id)}>Audit</button>
              </td>
            </tr>
          ))}
          {consents.length === 0 && (
            <tr><td colSpan="5">No consents yet</td></tr>
          )}
        </tbody>
      </table>

      <h2 style={{marginTop:24}}>Audit</h2>
      <pre style={{background:"#f7f7f7", padding:12, maxHeight:300, overflow:"auto"}}>
        {audit.length ? JSON.stringify(audit, null, 2) : "No audit loaded"}
      </pre>
    </div>
  );
}