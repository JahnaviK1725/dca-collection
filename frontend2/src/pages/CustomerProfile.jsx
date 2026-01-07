import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { orderBy } from "firebase/firestore";

const CustomerProfile = () => {
  const { customerId } = useParams(); // URL will be /customer/123
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch "Company DNA" (ML Features)
        // Your Python script saves this in 'company_features' collection
        const docRef = doc(db, "company_features", customerId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setProfile(docSnap.data());
        }

        // 2. Fetch recent invoices for this customer to show history
        const q = query(
          collection(db, "cases"),
          where("cust_number", "==", customerId),
          orderBy("document_create_date", "desc")
        );
        const querySnapshot = await getDocs(q);
        const invList = [];
        querySnapshot.forEach((doc) =>
          invList.push({ id: doc.id, ...doc.data() })
        );
        setInvoices(invList);
      } catch (error) {
        console.error("Error fetching customer:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [customerId]);

  if (loading)
    return <div style={{ padding: 40 }}>Loading Customer DNA...</div>;
  if (!profile)
    return (
      <div style={{ padding: 40 }}>
        Customer Profile Not Found (Run ML Job first)
      </div>
    );

  // Determine Persona
  const isVolatile = profile.std_payment_delay > 5;
  const isHabitual = profile.late_payment_ratio > 0.5;

  return (
    <div style={styles.page}>
      <button onClick={() => navigate(-1)} style={styles.backBtn}>
        ← Back
      </button>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{profile.company_name}</h1>
          <span style={styles.subId}>ID: {profile.cust_number}</span>
        </div>
        <div style={styles.badges}>
          {isHabitual && (
            <span style={styles.badBadge}>⚠️ Habitual Late Payer</span>
          )}
          {isVolatile && (
            <span style={styles.warnBadge}>⚡ Volatile Behavior</span>
          )}
          {!isHabitual && !isVolatile && (
            <span style={styles.goodBadge}>💎 Strategic Partner</span>
          )}
        </div>
      </div>

      <div style={styles.grid}>
        {/* LEFT: BEHAVIOR METRICS */}
        <div style={styles.card}>
          <h3>🧬 Behavior Analysis (ML Derived)</h3>

          <div style={styles.metricRow}>
            <div style={styles.metric}>
              <span style={styles.label}>Avg Delay</span>
              <span style={styles.value}>
                {profile.avg_payment_delay?.toFixed(1)} Days
              </span>
            </div>
            <div style={styles.metric}>
              <span style={styles.label}>Predictability (Std Dev)</span>
              <span style={styles.value}>
                ±{profile.std_payment_delay?.toFixed(1)} Days
              </span>
            </div>
            <div style={styles.metric}>
              <span style={styles.label}>Late Frequency</span>
              <span style={styles.value}>
                {(profile.late_payment_ratio * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div style={styles.chartArea}>
            <p style={styles.label}>Paying Habit Spectrum</p>

            {/* The Spectrum Bar */}
            <div
              style={{
                ...styles.barBg,
                position: "relative", // Needed for the absolute pointer
                height: "10px", // slightly thicker for visibility
                background:
                  "linear-gradient(to right, #10b981, #f59e0b, #ef4444)", // Green -> Yellow -> Red
                borderRadius: "5px",
                marginTop: "10px",
                marginBottom: "10px",
              }}
            >
              {/* The Pointer */}
              <div
                style={{
                  position: "absolute",
                  left: `${profile.late_payment_ratio * 100}%`, // Position based on ratio
                  top: "50%", // Center vertically relative to bar
                  transform: "translate(-48%, -48%)", // Center the pointer itself
                  width: "16px",
                  height: "16px",
                  backgroundColor: "#fff",
                  border: "4px solid #a11aa6ff", // Dark border to make it pop
                  borderRadius: "50%", // Make it circular
                  boxShadow: "0 2px 4px rgba(223, 22, 182, 0.2)",
                  transition: "left 0.3s ease-in-out", // Smooth movement
                }}
              ></div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "#666",
              }}
            >
              <span>Always On Time</span>
              <span>Always Late</span>
            </div>
          </div>
        </div>

        {/* RIGHT: INVOICE HISTORY */}
        <div style={styles.card}>
          <h3>🗂 Recent Invoices ({invoices.length})</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Invoice #</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                // NEW CODE (Copy & Paste this block)
                <tbody>
                  {invoices.slice(0, 5).map((inv) => {
                    // 1. Calculate Amount safely
                    const amount = Number(
                      inv.total_open_amount || inv.invoice_amount || 0
                    );

                    // 2. Determine "Open" status using Business Logic
                    // It is OPEN if:
                    // - The 'is_open_flag' is explicitly true OR '1'
                    // - OR: The Amount is > 0 AND it has no 'clear_date' AND it's not explicitly flagged false
                    const hasClearDate =
                      inv.clear_date &&
                      inv.clear_date !== "NaN" &&
                      inv.clear_date !== "";
                    const isExplicitlyClosed =
                      inv.is_open_flag === false ||
                      inv.isOpen === "0" ||
                      inv.isOpen === 0;

                    const isOpen =
                      inv.is_open_flag === true ||
                      inv.isOpen === "1" ||
                      (amount > 0 && !hasClearDate && !isExplicitlyClosed);

                    return (
                      <tr key={inv.id}>
                        <td style={styles.td}>
                          <span style={{ fontWeight: "500", color: "#334155" }}>
                            {inv.invoice_id || inv.invoice_number || inv.id}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {/* Display Amount */}
                          {inv.invoice_currency || "$"}{" "}
                          {amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td style={styles.td}>
                          {/* Status Pill */}
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 10px",
                              borderRadius: "20px",
                              fontSize: "12px",
                              fontWeight: "600",
                              backgroundColor: isOpen ? "#e0f2fe" : "#f1f5f9", // Light Blue vs Grey
                              color: isOpen ? "#0284c7" : "#64748b", // Dark Blue vs Grey
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: isOpen ? "#0284c7" : "#94a3b8",
                              }}
                            ></span>
                            {isOpen ? "Open" : "Closed"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: { padding: "40px", maxWidth: "1200px", margin: "0 auto" },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    marginBottom: "20px",
    color: "#64748b",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    marginBottom: "40px",
  },
  title: { margin: 0, fontSize: "32px", color: "#1e293b" },
  subId: { color: "#94a3b8", fontSize: "14px", fontFamily: "monospace" },
  badges: { display: "flex", gap: "10px" },
  badBadge: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "bold",
  },
  warnBadge: {
    background: "#ffedd5",
    color: "#9a3412",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "bold",
  },
  goodBadge: {
    background: "#dcfce7",
    color: "#166534",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "bold",
  },

  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  card: {
    background: "white",
    padding: "24px",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    border: "1px solid #e2e8f0",
  },

  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "30px",
    marginTop: "20px",
  },
  metric: { display: "flex", flexDirection: "column" },
  label: {
    fontSize: "12px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  value: { fontSize: "24px", fontWeight: "bold", color: "#0f172a" },

  barBg: {
    height: "12px",
    background: "#f1f5f9",
    borderRadius: "6px",
    overflow: "hidden",
  },
  barFill: { height: "100%" },

  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "10px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: "12px",
    color: "#64748b",
  },
  td: { padding: "10px", borderBottom: "1px solid #f1f5f9", fontSize: "14px" },
  statusDot: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    marginRight: "8px",
  },
};

export default CustomerProfile;
