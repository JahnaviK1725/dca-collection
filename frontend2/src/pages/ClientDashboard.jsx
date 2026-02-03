// ==========================================
// FILE: src/pages/ClientDashboard.jsx
// ==========================================
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore'; // Removed orderBy
import { Link, useNavigate } from 'react-router-dom';

// --- HELPER: ZONE STYLES ---
const getZoneBadge = (zone, predictedDelay) => {
  const styles = {
    padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "700", display: "inline-block"
  };

  switch (zone) {
    case "GREEN":
      return <span style={{ ...styles, background: "#dcfce7", color: "#166534" }}>✅ On Track</span>;
    case "YELLOW":
      return <span style={{ ...styles, background: "#fef9c3", color: "#854d0e" }}>⚠️ Due Soon</span>;
    case "ORANGE":
      return <span style={{ ...styles, background: "#ffedd5", color: "#9a3412" }}>🟠 Risk of Delay</span>;
    case "RED":
      return <span style={{ ...styles, background: "#fee2e2", color: "#991b1b" }}>🚨 Critical / Overdue</span>;
    default:
      if (predictedDelay > 5) return <span style={{ ...styles, background: "#fee2e2", color: "#991b1b" }}>🚨 Overdue</span>;
      return <span style={{ ...styles, background: "#f3f4f6", color: "#4b5563" }}>Open</span>;
  }
};

const ClientDashboard = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState("Valued Customer");
  const [selectedSubsidiary, setSelectedSubsidiary] = useState("All");

  const navigate = useNavigate();
  const clientId = localStorage.getItem("client_id");

  useEffect(() => {
    if (!clientId) {
      navigate('/portal');
      return;
    }

    const fetchClientCases = async () => {
      try {
        const casesRef = collection(db, "cases");
        
        // 🛠 FIX: Simplified Query
        // 1. We ONLY filter by cust_number here.
        // 2. We interpret 'isOpen', 'due_date', etc. in JavaScript to avoid Firestore index errors.
        const q = query(
          casesRef,
          where("cust_number", "==", clientId)
        );

        const snapshot = await getDocs(q);
        
        // --- CLIENT-SIDE PROCESSING ---
        const fetchedCases = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(c => {
             // Robust check for "Open" status
             // Checks for string "1", number 1, or boolean true
             return c.isOpen == "1" || c.isOpen === 1 || c.isOpen === true || c.is_open_flag === true;
          })
          .sort((a, b) => {
             // Robust Sort: Handles due_in_date OR due_date
             const dateA = a.due_in_date || a.due_date || "99999999";
             const dateB = b.due_in_date || b.due_date || "99999999";
             return dateB.localeCompare(dateA);
          });

        setCases(fetchedCases);

        if (fetchedCases.length > 0) {
          const firstName = fetchedCases[0].name_customer || "";
          setParentName(firstName.split(" ")[0] || "Company");
        }
      } catch (error) {
        console.error("Error fetching client cases:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClientCases();
  }, [clientId, navigate]);

  // --- 1. SUBSIDIARY EXTRACTION ---
  const subsidiaries = useMemo(() => {
    const names = new Set(cases.map(c => c.name_customer || "Unknown Entity"));
    return ["All", ...Array.from(names).sort()];
  }, [cases]);

  // --- 2. FILTERING LOGIC ---
  const filteredCases = useMemo(() => {
    if (selectedSubsidiary === "All") return cases;
    return cases.filter(c => (c.name_customer || "Unknown Entity") === selectedSubsidiary);
  }, [cases, selectedSubsidiary]);

  // --- 3. FINANCIAL TOTALS ---
  const totals = useMemo(() => {
    return filteredCases.reduce((acc, curr) => {
      const amount = parseFloat(curr.total_open_amount || 0);
      acc.total += amount;
      
      const isRed = curr.zone === "RED";
      // Handle both date field names
      const dateStr = curr.due_in_date || curr.due_date;
      let isPastDue = false;
      
      if (dateStr) {
         // robust date parsing for YYYYMMDD
         let dateObj;
         if (String(dateStr).length === 8 && !String(dateStr).includes("-")) {
             const y = String(dateStr).substr(0,4), m = String(dateStr).substr(4,2), d = String(dateStr).substr(6,2);
             dateObj = new Date(`${y}-${m}-${d}`);
         } else {
             dateObj = new Date(dateStr);
         }
         isPastDue = dateObj < new Date();
      }
      
      if (isRed || isPastDue) {
        acc.overdue += amount;
        acc.criticalCount++;
      }
      return acc;
    }, { total: 0, overdue: 0, criticalCount: 0 });
  }, [filteredCases]);

  if (loading) return <div style={styles.loader}>Loading your financial dashboard...</div>;

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.welcomeText}>Welcome, {parentName}</h1>
          <p style={styles.subText}>Customer ID: <span style={{fontFamily:'monospace'}}>{clientId}</span></p>
        </div>
        <div style={styles.dateBadge}>
          Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* METRICS */}
      <div style={styles.metricGrid}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Total Outstanding</div>
          <div style={styles.cardValue}>${totals.total.toLocaleString()}</div>
          <div style={styles.cardSub}>{filteredCases.length} open invoices</div>
        </div>
        
        <div style={styles.card}>
          <div style={styles.cardLabel}>Overdue / Critical</div>
          <div style={{...styles.cardValue, color: totals.overdue > 0 ? '#dc2626' : '#16a34a'}}>
            ${totals.overdue.toLocaleString()}
          </div>
          <div style={styles.cardSub}>{totals.criticalCount} invoices require attention</div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardLabel}>Subsidiary Filter</div>
          <select 
            value={selectedSubsidiary} 
            onChange={(e) => setSelectedSubsidiary(e.target.value)}
            style={styles.dropdown}
          >
            {subsidiaries.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div style={styles.tableContainer}>
        <h3 style={styles.sectionTitle}>
          {selectedSubsidiary === 'All' ? 'All Invoices' : `Invoices for ${selectedSubsidiary}`}
        </h3>

        {filteredCases.length === 0 ? (
          <div style={styles.emptyState}>
            <h3>🎉 No open invoices found!</h3>
            <p>You are all caught up for {selectedSubsidiary}.</p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.theadRow}>
                <th style={styles.th}>Invoice Details</th>
                <th style={styles.th}>Subsidiary</th>
                <th style={styles.th}>Due Date</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Status (Zone)</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((c) => {
                // Formatting Date with fallback for YYYYMMDD
                const dateStr = c.due_in_date || c.due_date;
                let formattedDate = "N/A";
                if(dateStr) {
                   if(String(dateStr).length === 8 && !String(dateStr).includes("-")) {
                      const y = String(dateStr).substr(0,4), m = String(dateStr).substr(4,2), d = String(dateStr).substr(6,2);
                      formattedDate = `${m}/${d}/${y}`;
                   } else {
                      formattedDate = new Date(dateStr).toLocaleDateString();
                   }
                }

                return (
                  <tr key={c.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.invId}>#{c.invoice_id}</div>
                      <div style={styles.docType}>{c.document_type || "Invoice"}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.subsidiaryBadge}>
                         🏢 {c.name_customer}
                      </span>
                    </td>
                    <td style={styles.td}>{formattedDate}</td>
                    <td style={styles.td}>
                      <div style={styles.amount}>
                        {c.invoice_currency || "$"} {parseFloat(c.total_open_amount).toLocaleString()}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {getZoneBadge(c.zone, c.predicted_delay)}
                      {c.predicted_delay > 0 && (
                        <div style={styles.delayText}>Est. +{Math.round(c.predicted_delay)} days late</div>
                      )}
                    </td>
                    <td style={styles.td}>
                      <Link 
                        to={`/pay/${c.id}`}
                        style={styles.payBtn}
                      >
                        Pay Now
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// --- STYLES ---
const styles = {
  loader: { padding: "40px", textAlign: "center", color: "#666", fontSize: "1.2rem" },
  container: { maxWidth: "1200px", margin: "0 auto", paddingBottom: "60px", fontFamily: "'Inter', sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "30px", borderBottom: "1px solid #e5e7eb", paddingBottom: "20px" },
  welcomeText: { fontSize: "2rem", fontWeight: "800", color: "#1f2937", margin: 0 },
  subText: { color: "#6b7280", margin: "4px 0 0 0", fontSize: "0.95rem" },
  dateBadge: { background: "#f3f4f6", padding: "8px 16px", borderRadius: "20px", color: "#4b5563", fontSize: "0.9rem", fontWeight: "500" },
  metricGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", marginBottom: "40px" },
  card: { background: "white", padding: "24px", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  cardLabel: { fontSize: "0.85rem", textTransform: "uppercase", color: "#6b7280", fontWeight: "600", marginBottom: "8px" },
  cardValue: { fontSize: "2rem", fontWeight: "700", color: "#111827" },
  cardSub: { fontSize: "0.9rem", color: "#6b7280", marginTop: "4px" },
  dropdown: { width: "100%", padding: "12px", fontSize: "1rem", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "4px", cursor: "pointer" },
  tableContainer: { background: "white", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" },
  sectionTitle: { padding: "20px", margin: 0, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontSize: "1.1rem" },
  table: { width: "100%", borderCollapse: "collapse" },
  theadRow: { background: "#f9fafb", textAlign: "left" },
  th: { padding: "16px", fontSize: "0.85rem", textTransform: "uppercase", color: "#6b7280", fontWeight: "600", borderBottom: "1px solid #e5e7eb" },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "16px", verticalAlign: "middle" },
  invId: { fontWeight: "600", color: "#374151" },
  docType: { fontSize: "0.8rem", color: "#9ca3af" },
  subsidiaryBadge: { display: "inline-block", background: "#eff6ff", color: "#1e40af", padding: "4px 8px", borderRadius: "6px", fontSize: "0.85rem", fontWeight: "500" },
  amount: { fontWeight: "700", color: "#111827", fontSize: "1rem" },
  delayText: { fontSize: "0.75rem", color: "#ef4444", marginTop: "4px" },
  payBtn: { display: "inline-block", background: "#FF6200", color: "white", padding: "10px 20px", borderRadius: "6px", textDecoration: "none", fontWeight: "600", fontSize: "0.9rem", transition: "background 0.2s" },
  emptyState: { padding: "60px", textAlign: "center", color: "#6b7280" }
};

export default ClientDashboard;