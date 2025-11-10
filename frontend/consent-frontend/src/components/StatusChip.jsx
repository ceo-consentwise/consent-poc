export default function StatusChip({ status }) {
  const s = String(status || "").toLowerCase();
  const isGranted = s === "granted";
  const bg = isGranted ? "#e6f6ec" : "#fdecea";
  const fg = isGranted ? "#0a6a3b" : "#b01911";
  const label = isGranted ? "GRANTED" : "REVOKED";
  const dot = isGranted ? "#22c55e" : "#ef4444";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: bg, color: fg, padding: "2px 8px", borderRadius: 999,
      fontSize: 12, fontWeight: 600, border: `1px solid ${isGranted ? "#bfe6cf" : "#f5c6c2"}`
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%", background: dot
      }} />
      {label}
    </span>
  );
}
