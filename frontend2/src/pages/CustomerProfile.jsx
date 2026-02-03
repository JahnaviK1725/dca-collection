// ==========================================
// FILE: src/pages/CustomerProfile.jsx
// ==========================================

import { useEffect, useState, useMemo } from "react";
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
  const [allInvoices, setAllInvoices] = useState([]); // Store ALL invoices
  const [loading, setLoading] = useState(true);
  
  // New State for handling name collisions
  const [subEntities, setSubEntities] = useState([]); 
  const [selectedEntity, setSelectedEntity] = useState("All");

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
        const namesSet = new Set();

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          invList.push({ id: doc.id, ...data });
          if (data.name_customer) namesSet.add(data.name_customer.trim());
        });

        setAllInvoices(invList);
        
        const uniqueNames = Array.from(namesSet).sort();
        if (uniqueNames.length > 1) {
            setSubEntities(["All", ...uniqueNames]);
        }

      } catch (error) {
        console.error("Error fetching customer:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [customerId]);

  // Filter invoices based on selection
  const filteredInvoices = useMemo(() => {
      if (selectedEntity === "All") return allInvoices;
      return allInvoices.filter(inv => inv.name_customer?.trim() === selectedEntity);
  }, [selectedEntity, allInvoices]);

  // --- NEW: CALCULATE TOTAL DEBT DYNAMICALLY ---
  const { totalDebt, openCount } = useMemo(() => {
    let debt = 0;
    let count = 0;

    filteredInvoices.forEach(inv => {
        const amount = Number(inv.total_open_amount || 0);
        
        // Robust "Is Open" check matching your Python/Table logic
        const hasClearDate = inv.clear_date && inv.clear_date !== "NaN" && inv.clear_date !== "";
        const isExplicitlyClosed = inv.is_open_flag === false || String(inv.isOpen) === "0";
        // Logic: It is open if flagged open OR (amount > 0 AND not explicitly closed)
        const isOpen = inv.is_open_flag === true || String(inv.isOpen) === "1" || (amount > 0 && !hasClearDate && !isExplicitlyClosed);

        if (isOpen) {
            debt += amount;
            count += 1;
        }
    });

    return { totalDebt: debt, openCount: count };
  }, [filteredInvoices]);

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!profile) return <div style={{ padding: 40 }}>Profile Not Found</div>;

  const strategy = getCustomerStrategy(profile);
  const isVolatile = profile.std_payment_delay > 5;
  const isHabitual = profile.late_payment_ratio > 0.5;

  return (
    <div style={styles.page}>
      <button onClick={() => navigate(-1)} style={styles.backBtn}>← Back</button>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            {selectedEntity !== "All" ? selectedEntity : profile.company_name}
          </h1>
          <span style={styles.subId}>ID: {profile.cust_number}</span>
        </div>
        
        <div style={styles.badges}>
          {isHabitual && <span style={styles.badBadge}>⚠️ Habitual Late Payer</span>}
          {isVolatile && <span style={styles.warnBadge}>⚡ Volatile Behavior</span>}
          {!isHabitual && !isVolatile && <span style={styles.goodBadge}>💎 Strategic Partner</span>}
        </div>
      </div>

      {/* SUB-ENTITY SELECTOR */}
      {subEntities.length > 0 && (
          <div style={{marginBottom: '20px'}}>
              <span style={{fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginRight: '10px'}}>
                  FILTER BY BRANCH:
              </span>
              {subEntities.map(name => (
                  <button 
                    key={name}
                    onClick={() => setSelectedEntity(name)}
                    style={{
                        ...styles.filterBtn,
                        backgroundColor: selectedEntity === name ? '#3b82f6' : '#f1f5f9',
                        color: selectedEntity === name ? 'white' : '#475569'
                    }}
                  >
                      {name}
                  </button>
              ))}
          </div>
      )}

      <div style={styles.grid}>
        
        {/* LEFT COLUMN */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
          
          {/* 1. ANALYSIS CARD */}
          <div style={styles.card}>
            <h3>🧬 Behavior Analysis</h3>
            
            {/* --- TOTAL DEBT COMPONENT --- */}
            <div style={styles.debtContainer}>
                <div style={styles.debtLabel}>Total Outstanding Debt</div>
                <div style={styles.debtAmount}>
                    ${totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={styles.debtSub}>
                    Across {openCount} open invoices
                </div>
            </div>
            {/* ---------------------------------- */}

            {/* SPECTRUM CHART */}
            <div style={styles.chartArea}>
              <p style={styles.label}>Paying Habit Spectrum</p>
              <div style={{
                  ...styles.barBg,
                  position: "relative",
                  height: "10px",
                  background: "linear-gradient(to right, #10b981, #f59e0b, #ef4444)",
                  marginTop: "10px",
                  marginBottom: "10px",
                }}
              >
                <div style={{
                    position: "absolute",
                    left: `${Math.min(100, Math.max(0, profile.late_payment_ratio * 100))}%`,
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "16px",
                    height: "16px",
                    backgroundColor: "#fff",
                    border: "4px solid #a11aa6ff",
                    borderRadius: "50%",
                    boxShadow: "0 2px 4px rgba(223, 22, 182, 0.2)",
                    transition: "left 0.3s ease-in-out",
                  }}
                ></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666", marginBottom: "20px" }}>
                <span>Always On Time</span>
                <span>Always Late</span>
              </div>
            </div>

            {/* METRICS ROW */}
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

          {/* 2. AI STRATEGY CARD */}
          <div style={{...styles.card, borderLeft: `6px solid ${strategy.color}`}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '15px'}}>
                <h3 style={{margin:0}}>🧠 AI Collection Strategy</h3>
                <span style={{ background: strategy.bg, color: strategy.color, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
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
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3>🗂 Invoices ({filteredInvoices.length})</h3>
            {selectedEntity !== 'All' && <span style={{fontSize:'12px', color:'#64748b'}}>Filtered by: {selectedEntity}</span>}
          </div>
          
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
                  {filteredInvoices.slice(0, 10).map((inv) => {
                    // 🟢 ROBUST AMOUNT DISPLAY LOGIC
                    const currentAmount = Number(inv.total_open_amount || 0);
                    const originalAmount = Number(inv.original_amount || inv.invoice_amount || currentAmount);

                    const hasClearDate = inv.clear_date && inv.clear_date !== "NaN" && inv.clear_date !== "";
                    const isExplicitlyClosed = inv.is_open_flag === false || String(inv.isOpen) === "0";
                    const isOpen = inv.is_open_flag === true || String(inv.isOpen) === "1" || (currentAmount > 0 && !hasClearDate && !isExplicitlyClosed);

                    // If OPEN -> Show Current Balance
                    // If CLOSED -> Show Original Invoice Amount
                    const displayAmount = isOpen ? currentAmount : originalAmount;

                    return (
                      <tr key={inv.id}>
                        <td style={styles.td}>
                          <span style={{ fontWeight: "500", color: "#334155" }}>
                            #{inv.invoice_id}
                          </span>
                          <div style={{fontSize: '11px', color: '#94a3b8'}}>{inv.document_create_date}</div>
                        </td>
                        <td style={styles.td}>
                          ${displayAmount.toLocaleString(undefined, { minimumFractionDigits: 0 })}
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
  
  filterBtn: { border: 'none', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', marginRight: '8px', fontWeight: '500', transition: 'all 0.2s' },

  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  card: { background: "white", padding: "24px", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", border: "1px solid #e2e8f0" },
  
  // New Debt Styles
  debtContainer: { background: "#f8fafc", padding: "16px", borderRadius: "12px", marginBottom: "24px", border: "1px solid #e2e8f0", textAlign: 'center' },
  debtLabel: { fontSize: "12px", textTransform: "uppercase", color: "#64748b", fontWeight: "bold", letterSpacing: "0.5px" },
  debtAmount: { fontSize: "32px", fontWeight: "800", color: "#0f172a", margin: "4px 0" },
  debtSub: { fontSize: "12px", color: "#94a3b8" },

  metricRow: { display: "flex", justifyContent: "space-between" },
  metric: { display: "flex", flexDirection: "column" },
  label: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600" },
  value: { fontSize: "24px", fontWeight: "bold", color: "#0f172a", marginTop: "4px" },
  
  chartArea: { marginBottom: "10px" },
  barBg: { width: "100%", borderRadius: "6px" },
  
  stratLabel: { fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', marginBottom: '6px' },
  stratText: { fontSize: '15px', color: '#374151', lineHeight: '1.5' },
  scriptBox: { background: '#f8fafc', padding: '12px', borderLeft: '3px solid #cbd5e1', color: '#4b5563', fontSize: '14px' },
  
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px", borderBottom: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b", textTransform: 'uppercase' },
  td: { padding: "12px 10px", borderBottom: "1px solid #f8fafc", fontSize: "14px" },
};

export default CustomerProfile;