import { useEffect, useState } from "react";
import { listTemplates, createTemplateVersion } from "../api";
import InlineMessage from "./InlineMessage";

/** Local IST formatter (copied minimal version, no change to App) */
function fmtIST(iso) {
  try {
    if (!iso) return "";
    let normalized = iso;
    if (!/Z$|[+-]\d\d:\d\d$/.test(iso)) {
      normalized = iso + "Z";
    }
    return new Date(normalized)
      .toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(",", "");
  } catch {
    return iso;
  }
}

export default function TemplateManagement() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Simple form state for creating new version
  const [tenantId, setTenantId] = useState("DEMO_BANK");
  const [productId, setProductId] = useState("LOAN");
  const [purpose, setPurpose] = useState("regulatory");
  const [templateType, setTemplateType] = useState("onboarding");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");

  async function refreshTemplates() {
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const rows = await listTemplates();
      setTemplates(Array.isArray(rows) ? rows : []);
      setMsg(`Loaded ${rows.length || 0} consent templates.`);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshTemplates();
  }, []);

  async function onCreateTemplate(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!tenantId || !productId || !purpose || !templateType) {
      setErr("Tenant, product, purpose, and template type are required.");
      return;
    }
    setLoading(true);
    try {
      await createTemplateVersion({
        tenant_id: tenantId,
        product_id: productId,
        purpose,
        template_type: templateType,
        title: title || null,
        body_text: bodyText || null,
      });
      setMsg("New template version created successfully.");
      // Clear only title/body; keep combo for quick versioning
      setTitle("");
      setBodyText("");
      await refreshTemplates();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  const cardStyle = {
    marginTop: 16,
    padding: 12,
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 8,
  };

  const label = { display: "grid", gap: 4, fontSize: 13 };
  const input = {
    padding: 8,
    border: "1px solid #cfcfcf",
    borderRadius: 6,
    fontSize: 13,
  };
  const textarea = {
    ...input,
    minHeight: 80,
    resize: "vertical",
  };
  const button = {
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  };
  const ghostBtn = {
    ...button,
    background: "#f6f7f8",
    border: "1px solid #e6e6e6",
  };

  return (
    <div style={{ marginTop: 8 }}>
      <h2 style={{ marginTop: 8 }}>Consent Templates</h2>
      <InlineMessage type="error" text={err} />
      <InlineMessage type="success" text={msg} />

      {/* List of templates */}
      <div style={{ ...cardStyle, overflowX: "auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0 }}>Existing Templates</h3>
          <button
            type="button"
            onClick={refreshTemplates}
            disabled={loading}
            style={ghostBtn}
          >
            Refresh
          </button>
        </div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 700,
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>
                Tenant
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>
                Product
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>
                Purpose
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>
                Template Type
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>
                Version
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>
                Active
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>
                Created At (IST)
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>
                Title
              </th>
            </tr>
          </thead>
          <tbody>
            {(!templates || templates.length === 0) && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 10,
                    textAlign: "center",
                    color: "#777",
                  }}
                >
                  No templates found.
                </td>
              </tr>
            )}
            {templates.map((t) => (
              <tr key={t.id}>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #eee",
                  }}
                >
                  {t.tenant_id}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #eee",
                  }}
                >
                  {t.product_id}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #eee",
                  }}
                >
                  {t.purpose}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #eee",
                  }}
                >
                  {t.template_type}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #eee",
                    fontFamily: "monospace",
                  }}
                >
                  {t.version}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #eee",
                  }}
                >
                  {t.is_active ? "Yes" : "No"}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #eee",
                  }}
                >
                  {fmtIST(t.created_at)}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #eee",
                    maxWidth: 260,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={t.title || ""}
                >
                  {t.title || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create new version form */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Create New Template Version</h3>
        <form
          onSubmit={onCreateTemplate}
          style={{ display: "grid", gap: 10, maxWidth: 640 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <label style={label}>
              <span>Tenant ID</span>
              <input
                style={input}
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="DEMO_BANK"
                required
              />
            </label>
            <label style={label}>
              <span>Product</span>
              <select
                style={input}
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="LOAN">LOAN</option>
                <option value="CASA">CASA</option>
                <option value="CARD">CARD</option>
                <option value="INSURANCE">INSURANCE</option>
              </select>
            </label>
            <label style={label}>
              <span>Purpose</span>
              <select
                style={input}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              >
                <option value="regulatory">regulatory</option>
                <option value="service">service</option>
                <option value="marketing">marketing</option>
              </select>
            </label>
            <label style={label}>
              <span>Template Type</span>
              <input
                style={input}
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                placeholder="onboarding / processing / sharing / confirmation"
                required
              />
            </label>
          </div>
          <label style={label}>
            <span>Title (optional)</span>
            <input
              style={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Loan Regulatory Consent v2"
            />
          </label>
          <label style={label}>
            <span>Body Text (optional / short)</span>
            <textarea
              style={textarea}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="You can paste the main consent text here (optional in this PoC)."
            />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                ...button,
                background: "#1259e0",
                color: "#fff",
                border: "none",
              }}
            >
              Create New Version
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#777" }}>
            Version number is auto-incremented based on existing templates for
            the same tenant + product + purpose + template_type.
          </div>
        </form>
      </div>
    </div>
  );
}
