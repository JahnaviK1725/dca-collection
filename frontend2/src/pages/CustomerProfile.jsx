import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase.js";

const CustomerProfile = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- 1. STRATEGY LOGIC ENGINE ---
  const getCustomerStrategy = (p) => {
    const lateRatio = p.late_payment_ratio || 0;
    const volatility = p.std_payment_delay || 0;
    const avgDelay = p.avg_payment_delay || 0;

    if (lateRatio > 0.7) {
      return {
        mode: "⛔ STRICT / HARD",
        color: "#991b1b",
        bg: "#fee2e2",
        advice: "Do not offer grace periods. This customer habitually pays late.",
        script: `"We noticed a pattern of late payments on 70%+ of invoices. To avoid credit hold, we need immediate settlement."`,
        nextStep: "Escalate to Manager if not paid in 24h."
      };
    } else if (volatility > 10) {
      return {
        mode: "⚡ UNPREDICTABLE",
        color: "#9a3412",
        bg: "#ffedd5",
        advice: "Payment timing is chaotic. Pin them down to a specific date.",
        script: `"I see your payments vary widely. Can we agree on a fixed date for this week to avoid system flags?"`,
        nextStep: "Get a 'Promise to Pay' date in writing."
      };
    } else if (avgDelay > 5) {
      return {
        mode: "⚠️ FIRM REMINDER",
        color: "#854d0e",
        bg: "#fef9c3",
        advice: "Usually pays, but slowly. Nudge them back on track.",
        script: `"You're usually quite reliable, but this one is slipping. Is there an issue with the invoice?"`,
        nextStep: "Send 'Friendly Reminder' email template."
      };
    } else {
      return {
        mode: "🤝 RELATIONSHIP BUILDING",
        color: "#166534",
        bg: "#dcfce7",
        advice: "Excellent customer. Treat with white-glove service.",
        script: `"Just a courtesy check-in on this invoice. Let us know if you need any documentation."`,
        nextStep: "No action required. Monitor only."
      };
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, "company_features", customerId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setProfile(docSnap.data());

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

  if (loading) return <div style={{ padding: 40 }}>Loading Customer DNA...</div>;
  if (!profile) return <div style={{ padding: 40 }}>Customer Profile Not Found</div>;

  const strategy = getCustomerStrategy(profile);
  const isVolatile = profile.std_payment_delay > 5;
  const isHabitual = profile.late_payment_ratio > 0.5;

  return (
    <div style={styles.page}>
      <button onClick={() => navigate(-1)} style={styles.backBtn}>← Back</button>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{profile.company_name}</h1>
          <span style={styles.subId}>ID: {profile.cust_number}</span>
        </div>
        <div style={styles.badges}>
          {isHabitual && <span style={styles.badBadge}>⚠️ Habitual Late Payer</span>}
          {isVolatile && <span style={styles.warnBadge}>⚡ Volatile Behavior</span>}
          {!isHabitual && !isVolatile && <span style={styles.goodBadge}>💎 Strategic Partner</span>}
        </div>
      </div>

      <div style={styles.grid}>
        
        {/* LEFT COLUMN: METRICS & STRATEGY */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
          
          {/* 1. METRICS CARD */}
          <div style={styles.card}>
            <h3>🧬 Behavior Analysis (ML Derived)</h3>
            <div style={styles.metricRow}>
              <div style={styles.metric}>
                <span style={styles.label}>Avg Delay</span>
                <span style={styles.value}>{profile.avg_payment_delay?.toFixed(1)} Days</span>
              </div>
              <div style={styles.metric}>
                <span style={styles.label}>Volatility</span>
                <span style={styles.value}>±{profile.std_payment_delay?.toFixed(1)} Days</span>
              </div>
              <div style={styles.metric}>
                <span style={styles.label}>Late Freq</span>
                <span style={styles.value}>{(profile.late_payment_ratio * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* 2. AI STRATEGY CONSOLE (NEW FEATURE) */}
          <div style={{...styles.card, borderLeft: `6px solid ${strategy.color}`}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '15px'}}>
                <h3 style={{margin:0}}>🧠 AI Collection Strategy</h3>
                <span style={{
                    background: strategy.bg, color: strategy.color, 
                    padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold'
                }}>
                    {strategy.mode}
                </span>
            </div>

            <div style={{marginBottom: '20px'}}>
                <div style={styles.stratLabel}>💡 Recommendation</div>
                <div style={styles.stratText}>{strategy.advice}</div>
            </div>

            <div style={{marginBottom: '20px'}}>
                <div style={styles.stratLabel}>🗣️ Suggested Script</div>
                <div style={styles.scriptBox}>
                    <i>{strategy.script}</i>
                </div>
            </div>

            <div>
                <div style={styles.stratLabel}>⏩ Next Best Action</div>
                <div style={{fontSize: '14px', fontWeight: '500', color: '#1f2937'}}>
                    {strategy.nextStep}
                </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: INVOICE LIST */}
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
                  {invoices.slice(0, 8).map((inv) => {
                    // Safe Number Conversion
                    const amount = Number(inv.total_open_amount || inv.invoice_amount || 0);
                    
                    // Open logic
                    const hasClearDate = inv.clear_date && inv.clear_date !== "NaN" && inv.clear_date !== "";
                    const isExplicitlyClosed = inv.is_open_flag === false || String(inv.isOpen) === "0";
                    const isOpen = inv.is_open_flag === true || String(inv.isOpen) === "1" || (amount > 0 && !hasClearDate && !isExplicitlyClosed);

                    return (
                      <tr key={inv.id}>
                        <td style={styles.td}>
                          <span style={{ fontWeight: "500", color: "#334155" }}>
                            #{inv.invoice_id}
                          </span>
                          <div style={{fontSize: '11px', color: '#94a3b8'}}>{inv.document_create_date}</div>
                        </td>
                        <td style={styles.td}>
                          ${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </td>
                        <td style={styles.td}>
                          <span style={{
                              padding: "4px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "bold",
                              backgroundColor: isOpen ? "#e0f2fe" : "#f1f5f9",
                              color: isOpen ? "#0284c7" : "#64748b",
                            }}>
                            {isOpen ? "Open" : "Closed"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: { padding: "40px", maxWidth: "1100px", margin: "0 auto", fontFamily: "Inter, sans-serif" },
  backBtn: { background: "none", border: "none", cursor: "pointer", marginBottom: "20px", color: "#64748b", fontWeight: "500" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "30px" },
  title: { margin: 0, fontSize: "28px", color: "#1e293b", fontWeight: "800" },
  subId: { color: "#94a3b8", fontSize: "14px", fontFamily: "monospace" },
  badges: { display: "flex", gap: "10px" },
  badBadge: { background: "#fee2e2", color: "#991b1b", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" },
  warnBadge: { background: "#ffedd5", color: "#9a3412", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" },
  goodBadge: { background: "#dcfce7", color: "#166534", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" },

  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  card: { background: "white", padding: "24px", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", border: "1px solid #e2e8f0" },

  metricRow: { display: "flex", justifyContent: "space-between" },
  metric: { display: "flex", flexDirection: "column" },
  label: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600" },
  value: { fontSize: "24px", fontWeight: "bold", color: "#0f172a", marginTop: "4px" },

  // Strategy Console Styles
  stratLabel: { fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', marginBottom: '6px' },
  stratText: { fontSize: '15px', color: '#374151', lineHeight: '1.5' },
  scriptBox: { background: '#f8fafc', padding: '12px', borderLeft: '3px solid #cbd5e1', color: '#4b5563', fontSize: '14px' },

  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px", borderBottom: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b", textTransform: 'uppercase' },
  td: { padding: "12px 10px", borderBottom: "1px solid #f8fafc", fontSize: "14px" },
};

export default CustomerProfile;