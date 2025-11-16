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
  listAuditForSubject,
} from "./api";
import AuditTimeline from "./components/AuditTimeline";
import StatusChip from "./components/StatusChip";
import InlineMessage from "./components/InlineMessage";
import IngestionCustomer from "./components/IngestionCustomer";
import IngestionBranch from "./components/IngestionBranch";
import TemplateManagement from "./components/TemplateManagement";
import RegulatorAudit from "./components/RegulatorAudit";

/** Display helper: render ISO -> IST (Asia/Kolkata), 24h */
function fmtIST(iso) {
  try {
    if (!iso) return "";

    // If timestamp has no timezone (no Z or offset), treat it as UTC explicitly
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

/** Simple BFSI consent templates (still kept, but only for possible future use) */
const CONSENT_TEMPLATES = {
  LOAN: {
    regulatory:
      "I hereby consent to the collection and processing of my data for loan underwriting, KYC and regulatory reporting purposes, in accordance with applicable laws and bank policies.",
    service:
      "I consent to the use of my data to provide loan-related services, account notifications, and service updates related to my loan relationship.",
    marketing:
      "I consent to receive loan-related offers, promotions, and marketing communications through SMS, email, or other channels, as permitted by applicable regulations.",
  },
  CASA: {
    regulatory:
      "I consent to the collection and processing of my data for opening and operating CASA accounts, including KYC, AML, and regulatory reporting.",
    service:
      "I consent to the use of my data for CASA account servicing, alerts, and operational notifications.",
    marketing:
      "I consent to receive CASA-related promotional messages, cross-sell offers, and marketing communications.",
  },
  CARD: {
    regulatory:
      "I consent to the processing of my data for card issuance, usage monitoring, risk, and regulatory compliance purposes.",
    service:
      "I consent to the use of my data for card servicing, transaction alerts, and customer support.",
    marketing:
      "I consent to receive card offers, rewards updates, and promotional communications.",
  },
  INSURANCE: {
    regulatory:
      "I consent to the processing of my data for insurance proposal evaluation, policy issuance, and regulatory reporting.",
    service:
      "I consent to the use of my data for policy servicing, renewals, and service notifications.",
    marketing:
      "I consent to receive insurance-related offers and marketing communications.",
  },
};

function getTemplateText(productId, purpose) {
  const byProduct = CONSENT_TEMPLATES[productId] || {};
  return (
    byProduct[purpose] || "No template defined for this product and purpose."
  );
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
    <div
      style={{
        maxWidth: 420,
        margin: "80px auto",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <h2 style={{ marginBottom: 8 }}>Login</h2>
      <div style={{ color: "#666", marginBottom: 12 }}>
        Enter credentials to access the Consent Management PoC.
      </div>
      <InlineMessage type="error" text={err} />
      <form
        onSubmit={onSubmit}
        style={{
          display: "grid",
          gap: 10,
          background: "#fff",
          padding: 16,
          border: "1px solid #eee",
          borderRadius: 8,
        }}
      >
        <label style={{ display: "grid", gap: 4 }}>
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{
              padding: 8,
              border: "1px solid #cfcfcf",
              borderRadius: 6,
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: 8,
              border: "1px solid #cfcfcf",
              borderRadius: 6,
            }}
          />
        </label>
        <button
          type="submit"
          style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer" }}
        >
          Login
        </button>
      </form>
    </div>
  );
}

export default function App() {
  // ---- Auth ----
  const [auth, setAuth] = useState(() => getAuthState()); // { username, loggedIn }

  // ---- Role selection after login ----
  // "regulator_admin" | "regulator_analyst" | "subscriber_support"
  const [role, setRole] = useState("regulator_admin");

  const isRegAdmin = role === "regulator_admin";
  const isRegAnalyst = role === "regulator_analyst";
  const isSubscriberSupport = role === "subscriber_support";

  // Views:
  // - Regulator Admin: Core CMP, Regulator CMP, Templates, Ingestion
  // - Regulator Analyst: Core CMP, Regulator CMP
  // - Subscriber Support: Core CMP, Ingestion
  const canSeeCoreCMP = true;
  const canSeeRegulatorCMP = isRegAdmin || isRegAnalyst;
  const canSeeTemplates = isRegAdmin;
  const canSeeIngestion = isRegAdmin || isSubscriberSupport;

  // Revoke from Core CMP:
  // - Admin: YES
  // - Analyst: NO
  // - Subscriber Support: YES
  const canRevokeFromCMP = isRegAdmin || isSubscriberSupport;

  function canSeeIngestionFor(r) {
    return r === "regulator_admin" || r === "subscriber_support";
  }

  function canSeeRegulatorFor(r) {
    return r === "regulator_admin" || r === "regulator_analyst";
  }

  function handleRoleChange(nextRole) {
    setRole(nextRole);
    setActiveView((prev) => {
      if (prev === "ingestion" && !canSeeIngestionFor(nextRole)) {
        return "core";
      }
      if (prev === "templates" && nextRole !== "regulator_admin") {
        return "core";
      }
      if (prev === "regulator" && !canSeeRegulatorFor(nextRole)) {
        return "core";
      }
      return prev;
    });
  }

  // ---- App state ----
  const [subjectId, setSubjectId] = useState("APP-LOAN-007");
  const [dataUseCase, setDataUseCase] = useState("marketing");
  const [productId, setProductId] = useState("LOAN");
  const [meta, setMeta] = useState('{"campaign":"diwali"}');

  const [consents, setConsents] = useState([]);
  const [audit, setAudit] = useState([]);
  const [auditFilters, setAuditFilters] = useState({
    product: "",
    purpose: "",
    sourceChannel: "",
    actorType: "",
    eventType: "",
    mobile: "",
    from: "",
    to: "",
  });
  const [knownSubjects, setKnownSubjects] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]); // for quick-select full list
  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // ---- Export filters ----
  const [expSubject, setExpSubject] = useState("");
  const [expStart, setExpStart] = useState(""); // YYYY-MM-DD
  const [expEnd, setExpEnd] = useState(""); // YYYY-MM-DD

  // Minimal: grant timestamp fallback per consent id
  const [grantAtById, setGrantAtById] = useState({}); // { [consentId]: isoString }

  // View: core CMP vs ingestion portal vs templates vs regulator
  const [activeView, setActiveView] = useState("core"); // "core" | "ingestion"| "templates" | "regulator"

  useEffect(() => {
    if (auth.loggedIn) {
      refresh();
      loadAllSubjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loggedIn]);

  async function loadAllSubjects() {
    try {
      const list = await listConsents(); // no subject filter → last N consents
      if (!Array.isArray(list)) return;
      const s = new Set();
      list.forEach((c) => {
        const subj =
          c.subject_id ||
          c.subjectId ||
          c.application_number ||
          c.applicationNumber;
        if (subj) s.add(subj);
      });
      setAllSubjects(Array.from(s).sort());
    } catch (e) {
      console.warn("Failed to load subjects for quick-select:", e);
    }
  }

  async function refresh() {
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const list = await listConsents(subjectId);
      setConsents(list);
      setMsg(`Loaded ${list.length} consents for "${subjectId}"`);

      // Track subjects that actually have consents so we can show them as quick options
      if (subjectId && Array.isArray(list) && list.length > 0) {
        setKnownSubjects((prev) =>
          prev.includes(subjectId) ? prev : [...prev, subjectId],
        );
      }

      // Fallback: if consent lacks created_at, derive from its audit (first grant)
      const needs = list
        .filter((c) => {
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
        .map((c) => c.id);

      if (needs.length) {
        const entries = await Promise.all(
          needs.map(async (id) => {
            try {
              const events = await listAudit(id);
              let chosen = null;
              if (Array.isArray(events) && events.length) {
                const grants = events.filter((e) =>
                  String(e.action || "")
                    .toLowerCase()
                    .includes("grant"),
                );
                chosen = grants[0] || events[0] || null;
              }
              const t =
                chosen?.timestamp ||
                chosen?.time ||
                chosen?.created_at ||
                null;
              return [id, t];
            } catch {
              return [id, null];
            }
          }),
        );
        const merged = Object.fromEntries(entries.filter(([, v]) => !!v));
        if (Object.keys(merged).length) {
          setGrantAtById((prev) => ({ ...prev, ...merged }));
        }
      }
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function onRevoke(id) {
    if (!auth.loggedIn) return setErr("Please login first.");
    if (!canRevokeFromCMP) return;
    const ok = window.confirm(
      "Are you sure you want to revoke this consent?",
    );
    if (!ok) return;
    setLoading(true);
    setErr("");
    setMsg("");
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

  // Group audit primarily by application_number, then mobile, then consent id
  async function onShowAudit(consent) {
    if (!auth.loggedIn) return setErr("Please login first.");
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const mobile = consent.mobile_number ?? consent.mobileNumber ?? "";
      const appNo =
        consent.application_number ?? consent.applicationNumber ?? "";

      let events;

      if (appNo) {
        // Group by application number only (handles mobile typos)
        events = await listAuditForSubject(null, appNo);
        setMsg(
          "Loaded " +
            events.length +
            ' audit events for application "' +
            appNo +
            '".',
        );
      } else if (mobile) {
        // Fallback: group by mobile only if no application number
        events = await listAuditForSubject(mobile, null);
        setMsg(
          "Loaded " +
            events.length +
            ' audit events for mobile "' +
            mobile +
            '".',
        );
      } else {
        // Final fallback: per-consent audit
        events = await listAudit(consent.id);
        setMsg(
          "Loaded " +
            events.length +
            " audit events for selected consent.",
        );
      }

      setAudit(events);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function onExportConsents() {
    if (!auth.loggedIn) return setErr("Please login first.");
    setErr("");
    setMsg("");
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
    setMsg(
      "Subject filter cleared. Click Refresh List to load all or set a subject.",
    );
  }

  function onLogout() {
    clearAuthState();
    setAuth({ username: "", loggedIn: false });
    setConsents([]);
    setAudit([]);
    setMsg("");
    setErr("");
  }

  // ---- Styles ----
  const shell = {
    padding: 20,
    maxWidth: 1024,
    margin: "0 auto",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  };
  const label = { display: "grid", gap: 4 };
  const input = {
    padding: 8,
    border: "1px solid #cfcfcf",
    borderRadius: 6,
  };
  const button = {
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
  };
  const ghostBtn = {
    ...button,
    background: "#f6f7f8",
    border: "1px solid #e6e6e6",
  };

  if (!auth.loggedIn) {
    return <LoginPanel onLoggedIn={(next) => setAuth(next)} />;
  }

  // We still compute templateText in case you want to show it later in read-only mode
  const templateText = getTemplateText(productId, dataUseCase);

  // Precompute latest consent per (application_number, product_id, purpose, template_type)
  const latestConsentByGroup = {};
  const chainsByGroup = {};
  if (Array.isArray(consents)) {
    consents.forEach((c) => {
      const app = c.application_number || c.applicationNumber || null;
      if (!app) {
        return;
      }
      const product = c.product_id || c.productId || "";
      const purpose = c.purpose || c.data_use_case || c.use_case || "";
      const templateType = c.template_type || c.templateType || "";
      const key = `${app}||${product}||${purpose}||${templateType}`;

      latestConsentByGroup[key] = c.id;

      if (!chainsByGroup[key]) {
        chainsByGroup[key] = [];
      }
      chainsByGroup[key].push(c);
    });
  }

  // Normalised version chains for rendering (using template_version primarily)
  const versionChains = Object.entries(chainsByGroup).map(([key, items]) => {
    const [appNo, product, purpose, templateType] = key.split("||");

    items.sort((a, b) => {
      const vaRaw =
        a.template_version ||
        a.templateVersion ||
        a.version ||
        0;
      const vbRaw =
        b.template_version ||
        b.templateVersion ||
        b.version ||
        0;
      const va =
        typeof vaRaw === "number" ? vaRaw : parseInt(vaRaw, 10) || 0;
      const vb =
        typeof vbRaw === "number" ? vbRaw : parseInt(vbRaw, 10) || 0;
      if (va !== vb) return va - vb;

      const ta =
        a.created_at ||
        a.createdAt ||
        a.timestamp ||
        a.updated_at ||
        a.updatedAt ||
        "";
      const tb =
        b.created_at ||
        b.createdAt ||
        b.timestamp ||
        b.updated_at ||
        b.updatedAt ||
        "";
      return String(ta).localeCompare(String(tb));
    });

    const latestId = latestConsentByGroup[key];

    return {
      key,
      application_number: appNo,
      product_id: product || "",
      purpose: purpose || "",
      template_type: templateType || "",
      latestId,
      items,
    };
  });

  // Build distinct values for audit filters
  const productSet = new Set();
  const purposeSet = new Set();
  const sourceChannelSet = new Set();
  const actorTypeSet = new Set();
  const eventTypeSet = new Set();

  // Product / purpose taxonomy – derive from consents
  if (Array.isArray(consents)) {
    consents.forEach((c) => {
      const product = c.product_id || c.productId || "";
      const purpose = c.purpose || c.data_use_case || c.use_case || "";
      if (product) productSet.add(product);
      if (purpose) purposeSet.add(purpose);
    });
  }

  // Channel / actor / event type – derive from audit events
  if (Array.isArray(audit)) {
    audit.forEach((ev) => {
      const sourceChannel = ev.source_channel || ev.channel || "";
      const actorType = ev.actor_type || ev.actorType || "";
      const action = ev.action || ev.event_type || ev.type || "";

      if (sourceChannel) sourceChannelSet.add(sourceChannel);
      if (actorType) actorTypeSet.add(actorType);
      if (action) eventTypeSet.add(action);
    });
  }

  const productOptions = Array.from(productSet);
  const purposeOptions = Array.from(purposeSet);
  const sourceChannelOptions = Array.from(sourceChannelSet);
  const actorTypeOptions = Array.from(actorTypeSet);
  const eventTypeOptions = Array.from(eventTypeSet);

  const consentsById = {};
  if (Array.isArray(consents)) {
    consents.forEach((c) => {
      if (c.id) {
        consentsById[c.id] = c;
      }
    });
  }

  const filteredAudit = Array.isArray(audit)
    ? audit.filter((ev) => {
        let product = ev.product_id || ev.productId || "";
        let purpose = ev.purpose || ev.data_use_case || ev.use_case || "";
        const sourceChannel = ev.source_channel || ev.channel || "";
        const actorType = ev.actor_type || ev.actorType || "";
        const action = ev.action || ev.event_type || ev.type || "";
        const mobile = ev.mobile_number || ev.msisdn || "";

        if ((!product || !purpose) && (ev.consent_id || ev.consentId)) {
          const cid = ev.consent_id || ev.consentId;
          const c = consentsById[cid];
          if (c) {
            if (!product) {
              product = c.product_id || c.productId || "";
            }
            if (!purpose) {
              purpose = c.purpose || c.data_use_case || c.use_case || "";
            }
          }
        }

        if (auditFilters.product && product !== auditFilters.product) {
          return false;
        }
        if (auditFilters.purpose && purpose !== auditFilters.purpose) {
          return false;
        }
        if (
          auditFilters.sourceChannel &&
          sourceChannel !== auditFilters.sourceChannel
        ) {
          return false;
        }
        if (
          auditFilters.actorType &&
          actorType !== auditFilters.actorType
        ) {
          return false;
        }
        if (
          auditFilters.eventType &&
          action !== auditFilters.eventType
        ) {
          return false;
        }
        if (
          auditFilters.mobile &&
          mobile &&
          !String(mobile)
            .toLowerCase()
            .includes(auditFilters.mobile.toLowerCase())
        ) {
          return false;
        }

        const tsRaw =
          ev.created_at ||
          ev.createdAt ||
          ev.timestamp ||
          ev.event_time ||
          ev.eventTime ||
          null;
        if ((auditFilters.from || auditFilters.to) && tsRaw) {
          const ts = new Date(tsRaw);
          if (!Number.isNaN(ts.getTime())) {
            if (auditFilters.from) {
              const from = new Date(auditFilters.from);
              if (ts < from) return false;
            }
            if (auditFilters.to) {
              const to = new Date(auditFilters.to);
              const endOfTo = new Date(
                to.getFullYear(),
                to.getMonth(),
                to.getDate(),
                23,
                59,
                59,
                999,
              );
              if (ts > endOfTo) return false;
            }
          }
        }

        return true;
      })
    : [];

  const nowIST = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  return (
    <div style={shell}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>Consent Management PoC</h1>
          <div style={{ color: "#666", marginBottom: 8 }}>
            Core CMP is now read-only: filter consents, view audit, export CSV.
          </div>
        </div>
        <div
          style={{
            fontSize: 14,
            color: "#555",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <span>
            Logged in as <strong>{auth.username || "user"}</strong>
          </span>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>Persona:</span>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "1px solid #ccc",
                fontSize: 13,
              }}
            >
              <option value="regulator_admin">Regulator Admin</option>
              <option value="regulator_analyst">Regulator Analyst</option>
              <option value="subscriber_support">Subscriber Support</option>
            </select>
          </label>
          <button
            onClick={onLogout}
            style={{ marginLeft: 8, ...button }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* View switcher */}
      <div
        style={{
          margin: "8px 0 12px 0",
          display: "flex",
          gap: 8,
        }}
      >
        {canSeeCoreCMP && (
          <button
            type="button"
            onClick={() => setActiveView("core")}
            style={{
              ...ghostBtn,
              background: activeView === "core" ? "#e2f0ff" : "#f6f7f8",
              borderColor:
                activeView === "core" ? "#5b8def" : "#e6e6e6",
            }}
          >
            Core CMP
          </button>
        )}

        {canSeeIngestion && (
          <button
            type="button"
            onClick={() => setActiveView("ingestion")}
            style={{
              ...ghostBtn,
              background:
                activeView === "ingestion" ? "#e2f0ff" : "#f6f7f8",
              borderColor:
                activeView === "ingestion" ? "#5b8def" : "#e6e6e6",
            }}
          >
            Ingestion Portal
          </button>
        )}

        {canSeeTemplates && (
          <button
            type="button"
            onClick={() => setActiveView("templates")}
            style={{
              ...ghostBtn,
              background:
                activeView === "templates" ? "#e2f0ff" : "#f6f7f8",
              borderColor:
                activeView === "templates" ? "#5b8def" : "#e6e6e6",
            }}
          >
            Templates
          </button>
        )}

        {canSeeRegulatorCMP && (
          <button
            type="button"
            onClick={() => setActiveView("regulator")}
            style={{
              ...ghostBtn,
              background:
                activeView === "regulator" ? "#e2f0ff" : "#f6f7f8",
              borderColor:
                activeView === "regulator" ? "#5b8def" : "#e6e6e6",
            }}
          >
            Regulator CMP
          </button>
        )}
      </div>

      {/* Global errors always visible */}
      <InlineMessage type="error" text={err} />
      {/* Success messages only for Core CMP */}
      {activeView === "core" && (
        <InlineMessage type="success" text={msg} />
      )}

      {/* ---------- CORE CMP VIEW ---------- */}
      {activeView === "core" && canSeeCoreCMP && (
        <>
          {/* Subject filter bar (no grant consent) */}
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: "#fff",
              border: "1px solid #eee",
              borderRadius: 8,
              maxWidth: 820,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>
              Subject Filter
            </h3>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
              <label style={{ ...label, flex: "1 1 220px" }}>
                <span>Subject (customer) ID (choose from drop-down)</span>
                <input
                  style={input}
                  list="subject-history"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  placeholder="user-123 / CIF / Application no."
                />
                <datalist id="subject-history">
                  {[
                    ...new Set([...knownSubjects, ...allSubjects]),
                  ].map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={refresh}
                  disabled={loading}
                  style={ghostBtn}
                >
                  Refresh List
                </button>
                <button
                  type="button"
                  onClick={onResetSubject}
                  disabled={loading}
                  style={ghostBtn}
                >
                  Clear Subject Filter
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#777", marginTop: 6 }}>
              Core CMP will only view consents. All grant/renew flows must
              happen via the Ingestion Portal.
            </div>
          </div>

          {/* Consents list */}
          <h2 style={{ marginTop: 8 }}>Consents</h2>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 600,
              }}
            >
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    Consent ID & Template
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    Subject
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    Use Case / Purpose
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    Created At (IST)
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {consents.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: 10,
                        textAlign: "center",
                        color: "#777",
                      }}
                    >
                      No consents found for current filter.
                    </td>
                  </tr>
                )}
                {consents.map((c) => {
                  const createdRaw =
                    c.created_at ??
                    c.createdAt ??
                    c.created ??
                    c.timestamp ??
                    grantAtById[c.id] ??
                    null;
                  const createdIST = fmtIST(createdRaw);

                  const appNo =
                    c.application_number || c.applicationNumber || null;
                  const product = c.product_id || c.productId || "";
                  const purpose =
                    c.purpose || c.data_use_case || c.use_case || "";
                  const templateType =
                    c.template_type || c.templateType || "";
                  const templateVersionRaw =
                    c.template_version ||
                    c.templateVersion ||
                    c.version ||
                    null;
                  const templateVersionLabel = templateVersionRaw
                    ? `v${templateVersionRaw}`
                    : "v?";

                  let isLatestForGroup = true;
                  if (appNo) {
                    const key = `${appNo}||${product}||${purpose}||${templateType}`;
                    const recId = latestConsentByGroup[key];
                    isLatestForGroup = !recId || recId === c.id;
                  }

                  return (
                    <tr key={c.id}>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #eee",
                          fontSize: 13,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: 12,
                          }}
                        >
                          {c.id}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#555",
                            marginTop: 2,
                          }}
                        >
                          Product: {product || "—"} | Purpose:{" "}
                          {purpose || "—"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#555",
                          }}
                        >
                          Template: {templateType || "—"} (
                          {templateVersionLabel})
                          {isLatestForGroup && !String(c.status || "")
                            .toLowerCase()
                            .includes("revoked") &&
                            " • latest"}
                          {String(c.status || "")
                            .toLowerCase()
                            .includes("revoked") && " • revoked"}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #eee",
                          fontSize: 13,
                        }}
                      >
                        {c.subject_id || c.subjectId || "—"}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #eee",
                          fontSize: 13,
                        }}
                      >
                        {purpose || "—"}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #eee",
                          fontSize: 13,
                        }}
                      >
                        <StatusChip status={c.status} />
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #eee",
                          fontSize: 13,
                        }}
                      >
                        {createdIST || "—"}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #eee",
                          fontSize: 13,
                        }}
                      >
                        {c.status !== "revoked" &&
                          isLatestForGroup &&
                          canRevokeFromCMP && (
                            <button
                              type="button"
                              onClick={() => onRevoke(c.id)}
                              style={{
                                ...ghostBtn,
                                fontSize: 12,
                                padding: "4px 8px",
                              }}
                            >
                              Revoke
                            </button>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Version & Renewal History */}
          {versionChains.length > 0 && (
            <div
              style={{
                marginTop: 24,
                padding: 12,
                background: "#fff",
                border: "1px solid #eee",
                borderRadius: 8,
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>
                Version &amp; Renewal History
              </h2>
              <div
                style={{
                  fontSize: 12,
                  color: "#777",
                  marginBottom: 8,
                }}
              >
                For each application + product + purpose + template type,
                the chain shows how consent versions evolved. The latest
                version matches the current revocable consent in the list
                above.
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 600,
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Application No.
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Product
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Purpose
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Template Type
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Version Chain
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionChains.map((chain) => (
                      <tr key={chain.key}>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #eee",
                            fontFamily: "monospace",
                            fontSize: 12,
                          }}
                        >
                          {chain.application_number || "—"}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          {chain.product_id || "—"}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          {chain.purpose || "—"}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          {chain.template_type || "—"}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #eee",
                            fontSize: 12,
                          }}
                        >
                          {chain.items.map((c, idx) => {
                            const isLatest =
                              chain.latestId && chain.latestId === c.id;
                            const isRevoked =
                              String(c.status || "").toLowerCase() ===
                              "revoked";
                            const verRaw =
                              c.template_version ||
                              c.templateVersion ||
                              c.version ||
                              null;
                            const verLabel = verRaw
                              ? `v${verRaw}`
                              : "v?";

                            return (
                              <span key={c.id}>
                                {idx > 0 && (
                                  <span
                                    style={{
                                      margin: "0 4px",
                                      color: "#999",
                                    }}
                                  >
                                    →
                                  </span>
                                )}
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    fontWeight: isLatest ? 600 : 400,
                                    color: isRevoked
                                      ? "#b3261e"
                                      : isLatest
                                      ? "#1e5bb3"
                                      : "#333",
                                  }}
                                  title={`Consent ID: ${c.id}${
                                    isRevoked ? " (revoked)" : ""
                                  }${isLatest ? " (latest)" : ""}`}
                                >
                                  {verLabel}
                                  {isLatest && !isRevoked && " (latest)"}
                                  {isRevoked && " (revoked)"}
                                </span>
                              </span>
                            );
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Export Consents Panel */}
          <div
            style={{
              margin: "12px 0",
              padding: 12,
              background: "#fff",
              border: "1px solid #eee",
              borderRadius: 8,
              maxWidth: 820,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>
              Consents CSV Export (server-side)
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
                marginBottom: 8,
                alignItems: "end",
              }}
            >
              <label style={label}>
                <span>Subject ID (optional)</span>
                <input
                  style={input}
                  value={expSubject}
                  onChange={(e) => setExpSubject(e.target.value)}
                  placeholder="Filter by subject"
                />
              </label>
              <label style={label}>
                <span>Start date (YYYY-MM-DD)</span>
                <input
                  style={input}
                  type="date"
                  value={expStart}
                  onChange={(e) => setExpStart(e.target.value)}
                />
              </label>
              <label style={label}>
                <span>End date (YYYY-MM-DD)</span>
                <input
                  style={input}
                  type="date"
                  value={expEnd}
                  onChange={(e) => setExpEnd(e.target.value)}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onExportConsents}
                disabled={loading}
                style={{
                  ...button,
                  background: "#1259e0",
                  color: "#fff",
                  border: "none",
                }}
              >
                Export Consents CSV
              </button>
              <button
                type="button"
                onClick={onResetExportFilters}
                disabled={loading}
                style={ghostBtn}
              >
                Reset Filters
              </button>
            </div>
          </div>
        </>
      )}

      {/* ---------- INGESTION PORTAL VIEW ---------- */}
      {activeView === "ingestion" && canSeeIngestion && (
        <>
          <IngestionCustomer />
          <IngestionBranch />
        </>
      )}

      {/* ---------- TEMPLATE MANAGEMENT VIEW ---------- */}
      {activeView === "templates" && canSeeTemplates && (
        <TemplateManagement />
      )}

      {/* ---------- REGULATOR CMP VIEW ---------- */}
      {activeView === "regulator" &&
        canSeeRegulatorCMP && <RegulatorAudit />}
    </div>
  );
}
