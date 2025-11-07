export default function StatusChip({ status }) {
  const s = String(status || "").toLowerCase();
  const isGranted = s === "granted";
  const bg = isGranted ? "#e6f6ec" : "#fdecea";
  const fg = isGranted ? "#0a6a3b" : "#b01911";
  const label = isGranted ? "GRANTED" : "REVOKED";
  return (
    <span style={{
      background: bg, color: fg, padding: "2px 8px", borderRadius: 999,
      fontSize: 12, fontWeight: 600, border: `1px solid ${isGranted ? "#bfe6cf" : "#f5c6c2"}`
    }}>
      {label}
    </span>
  );
}
