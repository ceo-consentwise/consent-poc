export default function InlineMessage({ type="info", text }) {
  if (!text) return null;
  const color = type === "error" ? "#b01911" : "#0a6a3b";
  const bg    = type === "error" ? "#fdecea" : "#e6f6ec";
  const border= type === "error" ? "#f5c6c2" : "#bfe6cf";
  return (
    <div style={{
      background: bg, color, border: `1px solid ${border}`,
      padding: "8px 10px", borderRadius: 8, margin: "8px 0"
    }}>
      {text}
    </div>
  );
}
