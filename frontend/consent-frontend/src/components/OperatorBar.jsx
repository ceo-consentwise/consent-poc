export default function OperatorBar({ operator, setOperator }) {
  return (
    <div style={{
      display: "flex", gap: 8, alignItems: "center",
      padding: "8px 12px", background: "#f7f7f9",
      border: "1px solid #eee", borderRadius: 8, marginBottom: 12
    }}>
      <span style={{fontWeight: 600}}>Operator:</span>
      <input
        value={operator}
        onChange={(e) => {
          setOperator(e.target.value);
          try { localStorage.setItem("operator", e.target.value || ""); } catch {}
        }}
        placeholder="your.email@company.com"
        style={{ padding: "6px 8px", border: "1px solid #cfcfcf", borderRadius: 6, minWidth: 280 }}
      />
      <span style={{color:"#666", fontSize: 12}}>
        Will be recorded as <code>actor</code> in the audit log
      </span>
    </div>
  );
}
