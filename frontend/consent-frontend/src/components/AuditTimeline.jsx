// consent-frontend/src/components/AuditTimeline.jsx
function safeJson(v) {
  try { return typeof v === "string" ? JSON.parse(v) : v; }
  catch { return v; }
}

export default function AuditTimeline({ events }) {
  if (!events || events.length === 0) {
    return <div style={{opacity:0.7}}>No audit data yet.</div>;
  }

  return (
    <div style={{marginTop: 12}}>
      <div style={{borderLeft: "3px solid #555", paddingLeft: 16}}>
        {events.map((ev, i) => {
          const details = safeJson(ev.details);
          return (
            <div key={i} style={{marginBottom: 18, position: "relative"}}>
              <span
                title={ev.action}
                style={{
                  width: 12, height: 12, background: "#555", borderRadius: "50%",
                  position: "absolute", left: -7.5, top: 4
                }}
              />
              <div style={{fontWeight: 600}}>
                {new Date(ev.timestamp).toLocaleString()} — {String(ev.action || "").toUpperCase()}
              </div>
              <div style={{fontSize: 13, opacity: 0.75}}>
                {ev.actor ? `actor: ${ev.actor}` : "actor: –"}
              </div>
              {details && (
                <pre style={{
                  background:"#f7f7f7", padding:"8px 10px", borderRadius:6,
                  marginTop:6, maxWidth: "100%", overflow:"auto"
                }}>
                  {JSON.stringify(details, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}