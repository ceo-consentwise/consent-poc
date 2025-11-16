import { useState, useEffect } from "react";
import {
  ingestBranchInitiate,
  ingestBranchVerifyOtp,
  ingestBranchCreateConsent,
  listTemplates, // <-- new
} from "../api";



import InlineMessage from "./InlineMessage";

const PRODUCTS = ["LOAN", "CASA", "CARD", "INSURANCE"];
const PURPOSES = ["regulatory", "service", "marketing"];

// Read-only consent templates (same wording as CMP / customer ingestion)
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
    byProduct[purpose] ||
    "No template defined for this product and purpose."
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


export default function IngestionBranch() {
  // Branch officer + customer identifiers
  const [templates, setTemplates] = useState(null);
  const [branchOfficerId, setBranchOfficerId] = useState("bo_user");
  const [mobileNumber, setMobileNumber] = useState("");
  const [applicationNumber, setApplicationNumber] = useState("");

  // Product + purpose
  const [productId, setProductId] = useState("LOAN");
  const [purpose, setPurpose] = useState("regulatory");

  // OTP flow
  const [transactionId, setTransactionId] = useState("");
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);

  // UX
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // For showing result after consent creation
  const [lastConsent, setLastConsent] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      try {
        const data = await listTemplates();
        if (!cancelled) {
          setTemplates(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.warn("Failed to load templates for branch ingestion:", e);
      }
    }

    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);


  const shell = {
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  };

  const sectionTitle = {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 8,
    color: "#111827",
  };

  const label = { display: "grid", gap: 4, fontSize: 13 };
  const input = {
    padding: 8,
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
  };
  const button = {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "#f9fafb",
    cursor: "pointer",
    fontSize: 13,
  };
  const primaryBtn = {
    ...button,
    background: "#1d4ed8",
    borderColor: "#1d4ed8",
    color: "#ffffff",
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
    setOtpVerified(false);
    setTransactionId("");
    setOtp("");
    if (!branchOfficerId || !mobileNumber) {
      setErr("Branch Officer ID and Mobile Number are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await ingestBranchInitiate({
        branch_officer_id: branchOfficerId,
        mobile_number: mobileNumber,
        application_number: applicationNumber || null,
      });
      setTransactionId(res.transaction_id);
      // For PoC we may also get `otp` in response (SIMULATED mode)
      if (res.otp) {
        setMsg(
          `OTP generated (SIMULATED). Transaction: ${res.transaction_id}, OTP: ${res.otp}`,
        );
      } else {
        setMsg(
          `OTP generated. Transaction ID: ${res.transaction_id}. Please check SMS.`,
        );
      }
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
    setOtpVerified(false);
    if (!transactionId || !otp) {
      setErr("Transaction ID and OTP are required to verify.");
      return;
    }
    setLoading(true);
    try {
      const res = await ingestBranchVerifyOtp({
        transaction_id: transactionId,
        otp,
      });
      if (res.status === "verified") {
        setOtpVerified(true);
        setMsg(
          `OTP verified for mobile ${res.mobile_number} / application ${res.application_number || "—"}.`,
        );
      } else {
        setErr("OTP verification failed.");
      }
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateConsent(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLastConsent(null);
    if (!otpVerified) {
      setErr("Please verify OTP before creating consent.");
      return;
    }
    if (!transactionId) {
      setErr("Missing transaction ID.");
      return;
    }
    setLoading(true);
    try {
      // Tenant id is optional here; we can keep it null or use DEMO_BANK
      const res = await ingestBranchCreateConsent({
        transaction_id: transactionId,
        branch_officer_id: branchOfficerId,
        tenant_id: null,
        product_id: productId,
        purpose,
        version: null, // backend derives from ConsentTemplate
        meta: {
          channel: "branch_ingestion",
          ui_source: "web_ingestion_branch",
        },
      });
      setLastConsent(res);
      setMsg(
        `Consent created successfully (ID: ${res.id}). Template version: v${res.version ?? "?"}.`,
      );
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  function handleResetFlow() {
    setBranchOfficerId("bo_user");
    setMobileNumber("");
    setApplicationNumber("");
    setTransactionId("");
    setOtp("");
    setOtpVerified(false);
    setLastConsent(null);
    setMsg("");
    setErr("");
  }

  const dynamicText = resolveDynamicTemplate(productId, purpose, templates);
  const templateText = dynamicText || getTemplateText(productId, purpose);


  return (
    <div style={shell}>
      <h2 style={{ fontSize: 16, margin: 0, marginBottom: 4 }}>
        Branch Officer Ingestion – OTP + Consent
      </h2>
      <div style={{ fontSize: 13, color: "#4b5563", marginBottom: 8 }}>
        Branch officer triggers consent for the customer using OTP-based
        verification, with the same product & purpose options as the
        customer ingestion flow.
      </div>

      <InlineMessage type="error" text={err} />
      <InlineMessage type="success" text={msg} />

      {/* Step 1: Branch officer + customer info */}
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <div style={sectionTitle}>Step 1 – Branch Officer + Customer</div>
        <form
          onSubmit={handleSendOtp}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            alignItems: "end",
          }}
        >
          <label style={label}>
            <span>Branch Officer ID</span>
            <input
              style={input}
              value={branchOfficerId}
              onChange={(e) => setBranchOfficerId(e.target.value)}
              placeholder="bo_user"
            />
          </label>
          <label style={label}>
            <span>Customer Mobile Number</span>
            <input
              style={input}
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="9999999999"
            />
          </label>
          <label style={label}>
            <span>Application Number (optional)</span>
            <input
              style={input}
              value={applicationNumber}
              onChange={(e) => setApplicationNumber(e.target.value)}
              placeholder="APP-123456"
            />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={loading}
              style={primaryBtn}
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
            <button
              type="button"
              style={ghostBtn}
              onClick={handleResetFlow}
              disabled={loading}
            >
              Reset
            </button>
          </div>
        </form>
        {transactionId && (
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginTop: 4,
            }}
          >
            Current transaction ID:{" "}
            <code>{transactionId}</code>
          </div>
        )}
      </div>

      {/* Step 2: OTP verification */}
      <div style={{ marginBottom: 12 }}>
        <div style={sectionTitle}>Step 2 – Verify OTP</div>
        <form
          onSubmit={handleVerifyOtp}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label style={label}>
            <span>OTP</span>
            <input
              style={input}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="123456"
            />
          </label>
          <button
            type="submit"
            disabled={loading || !transactionId}
            style={primaryBtn}
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
          {otpVerified && (
            <span
              style={{
                fontSize: 12,
                color: "#16a34a",
                marginLeft: 4,
              }}
            >
              ✓ OTP verified
            </span>
          )}
        </form>
      </div>

      {/* Step 3: Consent creation */}
      <div style={{ marginBottom: 12 }}>
        <div style={sectionTitle}>Step 3 – Capture Consent</div>
        <form
          onSubmit={handleCreateConsent}
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            <label style={label}>
              <span>Product</span>
              <select
                style={input}
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
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
                style={input}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              >
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            style={{
              marginTop: 4,
              padding: 10,
              borderRadius: 6,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Consent template (read-only)
            </div>
            <div>{templateText}</div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginTop: 4,
              flexWrap: "wrap",
            }}
          >
            <button
              type="submit"
              disabled={loading || !otpVerified}
              style={primaryBtn}
            >
              {loading ? "Creating..." : "Create Consent"}
            </button>
            {!otpVerified && (
              <span
                style={{
                  fontSize: 12,
                  color: "#f97316",
                }}
              >
                Verify OTP before creating consent.
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Step 4: Summary */}
      {lastConsent && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: "1px dashed #e5e7eb",
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Latest consent summary
          </div>
          <div style={{ marginBottom: 2 }}>
            Consent ID: <code>{lastConsent.id}</code>
          </div>
          <div style={{ marginBottom: 2 }}>
            Version:{" "}
            {lastConsent.version != null
              ? `v${lastConsent.version}`
              : "—"}
          </div>
          <div style={{ marginBottom: 2 }}>
            Subject ID: {lastConsent.subject_id || "—"}
          </div>
          <div style={{ marginBottom: 2 }}>
            Product: {lastConsent.product_id || "—"}; Purpose:{" "}
            {lastConsent.purpose || "—"}
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
