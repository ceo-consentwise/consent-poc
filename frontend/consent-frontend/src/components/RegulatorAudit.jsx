import { useEffect, useState } from "react";
import { listAuditGlobal } from "../api";
import AuditTimeline from "./AuditTimeline";

export default function RegulatorAudit() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [filters, setFilters] = useState({
    product: "",
    purpose: "",
    actorType: "",
    eventType: "",
    mobile: "",
    from: "",
    to: "",
  });

  // Do NOT auto-load on mount. User must click "Apply filters".
  useEffect(() => {
    // no-op on mount
  }, []);

  // Apply filters to events
  const filteredEvents = events.filter((ev) => {
    const product = ev.product_id || ev.productId || "";
    const purpose = ev.purpose || ev.data_use_case || ev.use_case || "";
    const actorType = ev.actor_type || ev.actorType || "";
    const action = ev.action || ev.event_type || ev.type || "";
    const mobile = ev.mobile_number || ev.msisdn || "";

    if (filters.product && product !== filters.product) return false;
    if (filters.purpose && purpose !== filters.purpose) return false;
    if (filters.actorType && actorType !== filters.actorType) return false;
    if (filters.eventType && action !== filters.eventType) return false;

    if (
      filters.mobile &&
      mobile &&
      !String(mobile).toLowerCase().includes(filters.mobile.toLowerCase())
    ) {
      return false;
    }

    // Date range (based on timestamp field)
    const tsRaw =
      ev.timestamp ||
      ev.created_at ||
      ev.createdAt ||
      ev.event_time ||
      ev.eventTime ||
      null;
    if ((filters.from || filters.to) && tsRaw) {
      const ts = new Date(tsRaw);
      if (!Number.isNaN(ts.getTime())) {
        if (filters.from) {
          const from = new Date(filters.from);
          if (ts < from) return false;
        }
        if (filters.to) {
          const to = new Date(filters.to);
          const endOfTo = new Date(
            to.getFullYear(),
            to.getMonth(),
            to.getDate(),
            23,
            59,
            59,
            999
          );
          if (ts > endOfTo) return false;
        }
      }
    }

    return true;
  });
  const totalCount = events.length;
  const filteredCount = filteredEvents.length;


  async function loadAudit() {
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const data = await listAuditGlobal();
      setEvents(Array.isArray(data) ? data : []);
      setMsg(
        `Loaded ${Array.isArray(data) ? data.length : 0} audit events (global).`
      );
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadCsv() {
    if (!filteredEvents || filteredEvents.length === 0) {
      setMsg("No audit events to download for current filters.");
      return;
    }

    const headers = [
      "timestamp",
      "action",
      "application_number",
      "mobile_number",
      "product_id",
      "purpose",
      "actor_type",
      "source_channel",
      "consent_id",
      "tenant_id",
    ];

    const lines = [];
    lines.push(headers.join(","));

    filteredEvents.forEach((ev) => {
      const row = {
        timestamp:
          ev.timestamp ||
          ev.created_at ||
          ev.createdAt ||
          ev.event_time ||
          ev.eventTime ||
          "",
        action: ev.action || ev.event_type || ev.type || "",
        application_number: ev.application_number || "",
        mobile_number: ev.mobile_number || ev.msisdn || "",
        product_id: ev.product_id || ev.productId || "",
        purpose: ev.purpose || ev.data_use_case || ev.use_case || "",
        actor_type: ev.actor_type || ev.actorType || "",
        source_channel: ev.source_channel || ev.channel || "",
        consent_id: ev.consent_id || ev.consentId || "",
        tenant_id: ev.tenant_id || "",
      };

      const values = headers.map((h) => {
        const raw = row[h] != null ? String(row[h]) : "";
        // Basic CSV escaping (wrap in quotes if contains comma, quote, or newline)
        if (/[",\n]/.test(raw)) {
          return '"' + raw.replace(/"/g, '""') + '"';
        }
        return raw;
      });
      lines.push(values.join(","));
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "regulator_audit_export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setMsg(
      `Downloaded ${filteredEvents.length} audit events as CSV for current filters.`
    );
  }

  // Build filter option sets from audit events themselves
  const productSet = new Set();
  const purposeSet = new Set();
  const actorTypeSet = new Set();
  const eventTypeSet = new Set();

  events.forEach((ev) => {
    const product = ev.product_id || ev.productId || "";
    const purpose = ev.purpose || ev.data_use_case || ev.use_case || "";
    const actorType = ev.actor_type || ev.actorType || "";
    const action = ev.action || ev.event_type || ev.type || "";
    if (product) productSet.add(product);
    if (purpose) purposeSet.add(purpose);
    if (actorType) actorTypeSet.add(actorType);
    if (action) eventTypeSet.add(action);
  });

  const productOptions = Array.from(productSet);
  const purposeOptions = Array.from(purposeSet);
  const actorTypeOptions = Array.from(actorTypeSet);
  const eventTypeOptions = Array.from(eventTypeSet);

  const shell = {
    marginTop: 8,
    padding: 12,
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 8,
  };

  const inputStyle = {
    padding: 6,
    borderRadius: 6,
    border: "1px solid #d4d4d4",
    fontSize: 12,
  };

  return (
    <div style={shell}>
      <h2 style={{ marginTop: 0, marginBottom: 4 }}>
        Regulator CMP – Global Audit
      </h2>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
        View and filter all audit events across products, purposes, customers
        and branches.
      </div>

      {err && (
        <div
          style={{
            marginBottom: 8,
            padding: 8,
            borderRadius: 6,
            background: "#fde7e9",
            color: "#b3261e",
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}
      {msg && (
        <div
          style={{
            marginBottom: 8,
            padding: 8,
            borderRadius: 6,
            background: "#e7f3ff",
            color: "#1e5bb3",
            fontSize: 13,
          }}
        >
          {msg}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500 }}>Audit Filters</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={loadAudit}
            disabled={loading}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #d4d4d4",
              background: "#ffffff",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() =>
              setFilters({
                product: "",
                purpose: "",
                actorType: "",
                eventType: "",
                mobile: "",
                from: "",
                to: "",
              })
            }
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #d4d4d4",
              background: "#ffffff",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={!filteredEvents || filteredEvents.length === 0}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #d4d4d4",
              background: "#ffffff",
              fontSize: 12,
              cursor: "pointer",
              opacity:
                !filteredEvents || filteredEvents.length === 0 ? 0.5 : 1,
            }}
          >
            Download CSV
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 8,
          marginBottom: 8,
        }}
      >
        {/* Product */}
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          <span>Product</span>
          <select
            value={filters.product}
            onChange={(e) =>
              setFilters((f) => ({ ...f, product: e.target.value }))
            }
            style={inputStyle}
          >
            <option value="">All</option>
            {productOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        {/* Purpose */}
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          <span>Purpose</span>
          <select
            value={filters.purpose}
            onChange={(e) =>
              setFilters((f) => ({ ...f, purpose: e.target.value }))
            }
            style={inputStyle}
          >
            <option value="">All</option>
            {purposeOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        {/* Actor type */}
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          <span>Actor type</span>
          <select
            value={filters.actorType}
            onChange={(e) =>
              setFilters((f) => ({ ...f, actorType: e.target.value }))
            }
            style={inputStyle}
          >
            <option value="">All</option>
            <option value="customer">customer</option>
            <option value="branch_officer">branch_officer</option>
            {actorTypeOptions
              .filter((v) => v !== "customer" && v !== "branch_officer")
              .map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
          </select>
        </label>

        {/* Event / action */}
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          <span>Event / action</span>
          <select
            value={filters.eventType}
            onChange={(e) =>
              setFilters((f) => ({ ...f, eventType: e.target.value }))
            }
            style={inputStyle}
          >
            <option value="">All</option>
            <option value="granted">granted</option>
            <option value="revoked">revoked</option>
            {eventTypeOptions
              .filter((v) => v !== "granted" && v !== "revoked")
              .map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
          </select>
        </label>

        {/* Mobile contains */}
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          <span>Mobile contains</span>
          <input
            value={filters.mobile}
            onChange={(e) =>
              setFilters((f) => ({ ...f, mobile: e.target.value }))
            }
            placeholder="e.g. 9876"
            style={inputStyle}
          />
        </label>

        {/* Date from */}
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          <span>Date from</span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) =>
              setFilters((f) => ({ ...f, from: e.target.value }))
            }
            style={inputStyle}
          />
        </label>

        {/* Date to */}
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          <span>Date to</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) =>
              setFilters((f) => ({ ...f, to: e.target.value }))
            }
            style={inputStyle}
          />
        </label>
      </div>

      {/* Global audit timeline */}
      <div
        style={{
          fontSize: 12,
          color: "#555",
          marginBottom: 4,
        }}
      >
        {totalCount === 0 ? (
          "No audit events loaded yet. Set filters and click Apply."
        ) : (
          <>
            Showing{" "}
            <span style={{ fontWeight: 600 }}>{filteredCount}</span> of{" "}
            <span style={{ fontWeight: 600 }}>{totalCount}</span> audit
            events for current filters.
          </>
        )}
      </div>

      <AuditTimeline events={filteredEvents} />
    </div>
  );
}
