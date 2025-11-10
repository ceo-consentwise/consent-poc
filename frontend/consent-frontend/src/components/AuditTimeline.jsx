// frontend/consent-frontend/src/components/AuditTimeline.jsx

function safeJson(v) {
  try { return typeof v === "string" ? JSON.parse(v) : v; }
  catch { return v; }
}

/** Convert timestamps to Indian Standard Time (Asia/Kolkata) */
function fmtIST(iso) {
  try {
    if (!iso) return "";
    // If no timezone info present, treat as UTC
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
      hour12: false
    }).replace(",", "");
  } catch {
    return iso;
  }
}

function timeAgo(iso) {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    let s = Math.max(0, Math.floor((now - then) / 1000));
    const units = [
      ["y", 60*60*24*365],
      ["mo", 60*60*24*30],
      ["d", 60*60*24],
      ["h", 60*60],
      ["m", 60],
      ["s", 1]
    ];
    for (const [u, v] of units) {
      if (s >= v) return `${Math.floor(s / v)}${u} ago`;
    }
    return "just now";
  } catch { return ""; }
}

function Dot({ action }) {
  const a = String(action || "").toLowerCase();
  const isGranted = a === "granted";
  const color = isGranted ? "#22c55e" : "#ef4444";       // green / red
  const ring  = isGranted ? "#bbf7d0" : "#fecaca";       // light ring
  return (
    <span
      title={action}
      style={{
        width: 12, height: 12, background: color, borderRadius: "50%",
        position: "absolute", left: -8, top: 6, boxShadow: `0 0 0 4px ${ring}`
      }}
    />
  );
}

export default function AuditTimeline({ events }) {
  if (!events || events.length === 0) {
    return (
      <div style={{
        padding: 12, border: "1px dashed #d6d6d6", borderRadius: 8,
        background: "#fafafa", color: "#777"
      }}>
        No audit data yet. Trigger an action (grant or revoke) and check again.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ borderLeft: "3px solid #e3e3e3", paddingLeft: 16 }}>
        {events.map((ev, i) => {
          const details = safeJson(ev.details);
          const relative = ev.timestamp ? timeAgo(ev.timestamp) : "";

          return (
            <div key={i} style={{ marginBottom: 18, position: "relative" }}>
              {/* Left-side colored dot (T3) */}
              <Dot action={ev.action} />

              {/* Action, timestamp (IST), relative */}
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700 }}>
                  {String(ev.action || "").toUpperCase()}
                </div>
                <div style={{ color: "#222" }}>
                  {fmtIST(ev.timestamp)} {/* <--- now in IST */}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {relative && `(${relative})`}
                </div>
              </div>

              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
                {ev.actor ? <>actor: <code>{ev.actor}</code></> : "actor: –"}
              </div>

              {details && (
                <pre style={{
                  background:"#f7f7f7", padding:"8px 10px", borderRadius:6,
                  marginTop:6, maxWidth: "100%", overflow:"auto",
                  border: "1px solid #ececec"
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
