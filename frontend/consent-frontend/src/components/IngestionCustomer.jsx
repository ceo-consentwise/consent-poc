import { useState, useEffect } from "react";
import {
  ingestCustomerLoginInitiate,
  ingestCustomerVerifyOtp,
  ingestCustomerCreateConsent,
  listTemplates, // <-- new
} from "../api";



import InlineMessage from "./InlineMessage";

const PRODUCTS = ["LOAN", "CASA", "CARD", "INSURANCE"];
const PURPOSES = ["regulatory", "service", "marketing"];

// Read-only template text (same as CMP preview)
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
      "I consent to receive insurance-related insurance offers and marketing communications.",
  },
};

function getTemplateText(productId, purpose) {
  const byProduct = CONSENT_TEMPLATES[productId] || {};
  return (
    byProduct[purpose] ||
    "No template defined for this product and purpose in the current PoC."
  );
}

function resolveDynamicTemplate(productId, purpose, templates) {
  if (!templates || !Array.isArray(templates) || !productId || !purpose) {
    return null;
  }

  const applicable = templates.filter(
    (t) =>
      t.product_id === productId &&
      t.purpose === purpose &&
      (t.tenant_id === "DEMO_BANK" || !t.tenant_id)
  );

  if (!applicable.length) return null;

  let latest = applicable[0];
  for (const t of applicable) {
    const ver = typeof t.version === "number" ? t.version : 0;
    const latestVer =
      typeof latest.version === "number" ? latest.version : 0;
    if (ver > latestVer) {
      latest = t;
    }
  }

  return latest.body_text || latest.title || null;
}

export default function IngestionCustomer() {
  const [templates, setTemplates] = useState(null);
  const [step, setStep] = useState("init"); // init | otp | consent | done
  const [mobile, setMobile] = useState("9999999999");
  const [applicationNumber, setApplicationNumber] = useState("APP-123456");
  const [transactionId, setTransactionId] = useState("");
  const [otp, setOtp] = useState("");
  const [otpHint, setOtpHint] = useState("123456 (demo)");
  const [productId, setProductId] = useState("LOAN");
  const [purpose, setPurpose] = useState("regulatory");
  const [version, setVersion] = useState(1);
  const [meta, setMeta] = useState(
    '{"channel":"customer","journey":"demo","campaign":"diwali"}',
  );

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [lastConsent, setLastConsent] = useState(null);
  const [lastVersion, setLastVersion] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      try {
        const data = await listTemplates();
        if (!cancelled) {
          setTemplates(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        // Silent failure: fall back to static CONSENT_TEMPLATES
        console.warn("Failed to load templates for ingestion:", e);
      }
    }

    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);


  const box = {
    background: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    border: "1px solid #e5e7eb",
  };

  const label = {
    display: "grid",
    gap: 4,
    fontSize: 12,
    color: "#374151",
  };

  const input = {
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
  };

  const select = {
    ...input,
    paddingRight: 24,
  };

  const button = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "none",
    background: "#0f766e",
    color: "#fff",
    fontSize: 12,
    cursor: "pointer",
  };

  const ghostBtn = {
    ...button,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  };

  async function handleSendOtp(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLastConsent(null);
    setLastVersion(null);
    setLoading(true);
    try {
      const res = await ingestCustomerLoginInitiate({
        mobile_number: mobile,
        application_number: applicationNumber,
      });
      setTransactionId(res.transaction_id);
      setOtpHint(res.demo_otp || "123456 (demo)");
      setStep("otp");
      setMsg("OTP initiated (simulated)");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      await ingestCustomerVerifyOtp({
        transaction_id: transactionId,
        otp,
      });
      setMsg("OTP verified (simulated)");
      setStep("consent");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitConsent(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      let metaObj = {};
      if (meta && meta.trim()) {
        try {
          metaObj = JSON.parse(meta);
        } catch {
          throw new Error(
            'Meta must be valid JSON, e.g. {"channel":"branch","journey":"demo"}',
          );
        }
      }

      const payload = {
        transaction_id: transactionId,
        tenant_id: "DEMO_BANK",
        product_id: productId,
        purpose,
        meta: metaObj,
      };

      const consent = await ingestCustomerCreateConsent(payload);

      // Align local version state with backend-applied version
      if (consent && typeof consent.version === "number") {
        setVersion(consent.version);
      }

      // NEW: capture real version from backend
      setLastConsent(consent);
      setLastVersion(
        consent && consent.version != null ? consent.version : null,
      );

      setMsg("Consent captured via ingestion portal.");
      setStep("done");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  function handleResetFlow() {
    setStep("init");
    setTransactionId("");
    setOtp("");
    setLastConsent(null);
    setLastVersion(null);
  }

  const dynamicText = resolveDynamicTemplate(productId, purpose, templates);
  const templateText = dynamicText || getTemplateText(productId, purpose);

  return (
    <div style={{ ...box, background: "#ffffff" }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 6,
          color: "#111827",
        }}
      >
        Customer Ingestion Flow
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>
        Simulates a retail customer receiving an OTP and granting consent via
        mobile + application number.
      </div>

      <InlineMessage type="error" text={err} />
      <InlineMessage type="success" text={msg} />

      {/* Step 1: Identify & send OTP */}
      <form
        onSubmit={handleSendOtp}
        style={{
          display: "grid",
          gap: 8,
          marginBottom: 12,
          opacity:
            step !== "init" && step !== "otp" && step !== "consent" ? 0.5 : 1,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#111827",
            marginBottom: 4,
          }}
        >
          1. Send OTP (Simulated)
        </div>
        <label style={label}>
          <span>Mobile number</span>
          <input
            style={input}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            disabled={step !== "init"}
          />
        </label>
        <label style={label}>
          <span>Application number</span>
          <input
            style={input}
            value={applicationNumber}
            onChange={(e) => setApplicationNumber(e.target.value)}
            disabled={step !== "init"}
          />
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="submit"
            disabled={loading || step !== "init"}
            style={{
              ...button,
              background: "#0f766e",
            }}
          >
            {loading && step === "init" ? "Working..." : "Send OTP (SIMULATED)"}
          </button>
          {otpHint && (
            <span style={{ fontSize: 11, color: "#6b7280" }}>
              Demo OTP: <code>{otpHint}</code>
            </span>
          )}
        </div>
      </form>

      {/* Step 2: Verify OTP */}
      <form
        onSubmit={handleVerifyOtp}
        style={{
          display: "grid",
          gap: 8,
          marginBottom: 12,
          opacity:
            step === "otp" || step === "consent" || step === "done" ? 1 : 0.4,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#111827",
            marginBottom: 4,
          }}
        >
          2. Verify OTP
        </div>
        <label style={label}>
          <span>OTP (demo)</span>
          <input
            style={input}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            disabled={step !== "otp"}
          />
        </label>
        <button
          type="submit"
          disabled={loading || step !== "otp"}
          style={{
            ...button,
            background: "#0369a1",
          }}
        >
          {loading && step === "otp" ? "Verifying..." : "Verify OTP"}
        </button>
      </form>

      {/* Step 3: Consent template & capture */}
      <form
        onSubmit={handleSubmitConsent}
        style={{
          display: "grid",
          gap: 8,
          marginBottom: 12,
          opacity: step === "consent" || step === "done" ? 1 : 0.4,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#111827",
            marginBottom: 4,
          }}
        >
          3. Capture Consent
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          <label style={label}>
            <span>Product</span>
            <select
              style={select}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={step !== "consent"}
            >
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label style={label}>
            <span>Purpose</span>
            <select
              style={select}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              disabled={step !== "consent"}
            >
              {PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Template preview */}
        <div
          style={{
            marginTop: 4,
            padding: 10,
            borderRadius: 8,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            fontSize: 12,
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: 4,
              color: "#111827",
            }}
          >
            Consent template (current active version)
          </div>
          <div
            style={{
              whiteSpace: "pre-wrap",
              color: "#111827",
            }}
          >
            {templateText}
          </div>
        </div>

        {/* Meta JSON field */}
        <label style={label}>
          <span>Meta (JSON)</span>
          <textarea
            style={{ ...input, minHeight: 48 }}
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            disabled={step !== "consent"}
          />
        </label>

        <button
          type="submit"
          disabled={loading || step !== "consent"}
          style={{
            ...button,
            background: "#4f46e5",
          }}
        >
          {loading && step === "consent" ? "Submitting..." : "Submit Consent"}
        </button>
      </form>

      {/* Final summary */}
      {lastConsent && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            fontSize: 12,
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: 4,
              color: "#111827",
            }}
          >
            Latest consent (via ingestion)
          </div>
          <div style={{ marginBottom: 4 }}>
            Template version:{" "}
            <strong>
              {lastVersion != null ? `v${lastVersion}` : "not set"}
            </strong>
          </div>
          <div style={{ marginBottom: 4 }}>
            Subject:{" "}
            <code>{lastConsent.subject_id || lastConsent.subjectId}</code>
          </div>
          <div style={{ marginBottom: 4 }}>
            Product: <code>{lastConsent.product_id || "—"}</code>
          </div>
          <div style={{ marginBottom: 4 }}>
            Purpose:{" "}
            <code>
              {lastConsent.data_use_case || lastConsent.purpose || "—"}
            </code>
          </div>
          <div style={{ marginBottom: 4 }}>
            Consent ID: <code>{lastConsent.id}</code>
          </div>
          <button
            type="button"
            style={{ ...ghostBtn, marginTop: 8 }}
            onClick={handleResetFlow}
          >
            Start New Flow
          </button>
        </div>
      )}
    </div>
  );
}
