// ==========================================
// START OF FILE: ./App.jsx
// ==========================================

// ==========================================
// FILE: src/App.jsx
// ==========================================

import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";


// Admin Pages
import Dashboard from "./pages/Dashboard.jsx";
import CaseDetail from "./pages/CaseDetail.jsx";
import CustomerProfile from "./pages/CustomerProfile";
import CustomerSearch from "./pages/CustomerSearch";
import SearchCase from "./pages/SearchCase";
import AiLogs from "./pages/AiLogs.jsx";
import Analytics from "./pages/Analytics";
import EscalationPage from './pages/EscalationPage';
import Navbar from "./components/Navbar"; // The Admin Navbar
import AiBot from "./components/AiBot";

// Client/Shared Pages
import LandingPage from "./pages/LandingPage.jsx";
import PaymentPortal from "./pages/PaymentPortal";
import ClientLogin from "./pages/ClientLogin.jsx";
import ClientDashboard from "./pages/ClientDashboard.jsx";
import ClientNegotiation from "./pages/ClientNegotiation.jsx";

// 1. Layout for Admin (Includes Navbar + Chatbot)
const AdminLayout = () => (
  <>
    <Navbar />
    <div className="admin-container" style={{ padding: "20px" }}>
      <Outlet />
    </div>
    <AiBot />
  </>
);

// 2. Layout for Clients (Updated Layout)
const ClientLayout = () => (
  <div className="client-app" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
    <header style={{ 
      padding: "1rem 2rem", 
      borderBottom: "1px solid #333", // Darker border for dark theme compatibility
      display: "flex", 
      justifyContent: "space-between",
      alignItems: "center" // 👈 Centers items vertically
    }}>
      <h2 style={{ 
        color: "#4D148C", 
        fontWeight: "bold", 
        margin: 0, // 👈 Removes default top/bottom margin causing the offset
        fontSize: "24px"
      }}>
        FedEx Billing Portal
      </h2>
      <a 
        href="/" 
        style={{ 
          textDecoration: "none", 
          color: "#9ca3af", // Lighter grey for visibility on dark backgrounds
          fontWeight: "500",
          fontSize: "14px" 
        }}
      >
        Logout
      </a>
    </header>
    <div style={{ padding: "20px", flex: 1 }}>
      <Outlet />
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC / ENTRY */}
        <Route path="/" element={<LandingPage />} />
        
        {/* SHARED: Payment Portal (Accessible by link) */}
        <Route path="/pay/:id" element={<PaymentPortal />} />

        {/* 🔐 ADMIN FLOW (Restricted) */}
        <Route path="/admin" element={<AdminLayout />}>
          {/* Redirect /admin to /admin/dashboard */}
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="case/:id" element={<CaseDetail />} />
          <Route path="customers" element={<CustomerSearch />} />
          <Route path="customer/:customerId" element={<CustomerProfile />} />
          <Route path="search" element={<SearchCase />} />
          <Route path="ai-logs" element={<AiLogs />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="escalation" element={<EscalationPage />} />
        </Route>

        {/* 🏢 COMPANY/CLIENT FLOW */}
        <Route path="/portal" element={<ClientLayout />}>
          <Route index element={<ClientLogin />} />
          <Route path="dashboard" element={<ClientDashboard />} />
          <Route path="negotiate/:id" element={<ClientNegotiation />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;

// ==========================================
// START OF FILE: ./main.jsx
// ==========================================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


// ==========================================
// START OF FILE: ./pages/CaseDetail.jsx
// ==========================================

import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, updateDoc, serverTimestamp, deleteField, onSnapshot } from "firebase/firestore"; // <--- ADD onSnapshot
import { db } from "../firebase.js";
import { useEffect, useState } from "react";

// --- 1. THEME GENERATOR ---
const getZoneTheme = (zone) => {
  switch (zone) {
    case "GREEN": return { bg: "#e6f4ea", text: "#137333", border: "#137333", icon: "🟢" };
    case "YELLOW": return { bg: "#fef7e0", text: "#b06000", border: "#b06000", icon: "🟡" };
    case "ORANGE": return { bg: "#fce8e6", text: "#c5221f", border: "#c5221f", icon: "🟠" };
    case "RED": return { bg: "#fce8e6", text: "#a50e0e", border: "#a50e0e", icon: "🔴" };
    default: return { bg: "#f1f3f4", text: "#3c4043", border: "#dadce0", icon: "⚪" };
  }
};

// --- 2. ROBUST DATE PARSER ---
const formatDate = (dateVal) => {
  if (!dateVal) return "N/A";
  try {
    if (dateVal.toDate && typeof dateVal.toDate === 'function') {
      return dateVal.toDate().toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const strVal = String(dateVal).trim();
    if (strVal.length === 8 && !isNaN(strVal)) {
      const year = strVal.substring(0, 4);
      const month = strVal.substring(4, 6);
      const day = strVal.substring(6, 8);
      return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const dateObj = new Date(dateVal);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return "Invalid Format";
  } catch (e) {
    return "Error";
  }
};

const CaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  
  // ✨ NEW STATE FOR AI EMAIL ✨
  const [showEmail, setShowEmail] = useState(false);

  // --- UPDATED: REAL-TIME LISTENER ---
  useEffect(() => {
    setLoading(true);
    const caseRef = doc(db, "cases", id);

    // onSnapshot creates a live connection.
    // Whenever the doc changes (e.g. AI adds a log), this runs again.
    const unsubscribe = onSnapshot(caseRef, (docSnap) => {
        if (docSnap.exists()) {
            setCaseData(docSnap.data());
        } else {
            console.log("No such document!");
        }
        setLoading(false);
    }, (error) => {
        console.error("Error listening to case:", error);
        setLoading(false);
    });

    // Clean up the listener when the user leaves the page
    return () => unsubscribe();
  }, [id]);

  const handleCloseCase = async () => {
    if (!window.confirm("Mark this case as resolved/closed?")) return;
    setClosing(true);
    const ref = doc(db, "cases", id);
    await updateDoc(ref, {
        isOpen: '0',
        is_open_flag: false,
        total_open_amount: 0, // Zero out the balance
        zone: 'GREEN',
        action: 'NO_ACTION',
        closed_at: serverTimestamp(),
        last_predicted_at: deleteField()
    }).catch(console.error);
    navigate(-1); 
  };

  // ✨ NEW AI GENERATOR FUNCTION ✨
  const getEmailTemplate = () => {
    const amount = Number(caseData.total_open_amount).toLocaleString();
    const date = formatDate(caseData.due_date);
    
    return `Subject: Payment Reminder - Invoice #${caseData.invoice_id || id}

Dear ${caseData.name_customer},

I hope you are having a productive week.

This is a friendly reminder that Invoice #${caseData.invoice_id || id} for $${amount} was due on ${date}.

Our records show that you typically clear payments within ${caseData.avg_payment_delay?.toFixed(0) || 30} days. We value our relationship and want to ensure everything is on track.

If you have already sent payment, please disregard this message. Otherwise, could you please confirm the status?

Best regards,
FedEx Accounts Receivable`;
  };

  if (loading) return <div style={styles.center}>Loading case analytics...</div>;
  if (!caseData) return <div style={styles.center}>Case not found</div>;

  const theme = getZoneTheme(caseData.zone);
  const isBreach = caseData.predicted_delay > caseData.sla_days;
  const isOpen = caseData.is_open_flag !== false;
  const originalAmount = Number(caseData.original_amount || caseData.total_open_amount || 0);
  const currentAmount = Number(caseData.total_open_amount || 0);
  
  // If Closed, we show the Original Amount in the header stats
  // If Open, we show the Current Amount
  const displayAmount = isOpen ? currentAmount : originalAmount;
  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
            <button onClick={() => navigate(-1)} style={styles.backBtn}>← Back</button>
            <span style={styles.invoiceLabel}>Invoice #{caseData.invoice_id || caseData.invoice_number || id}</span>
            <span style={{
                ...styles.statusBadge, 
                background: isOpen ? '#dbeafe' : '#dcfce7',
                color: isOpen ? '#1e40af' : '#166534'
            }}>
                {isOpen ? "OPEN" : "CLOSED"}
            </span>
        </div>
        {isOpen && (
            <button onClick={handleCloseCase} disabled={closing} style={styles.closeBtn}>
                {closing ? "Processing..." : "✓ Mark as Resolved"}
            </button>
        )}
      </div>

      {/* BANNER */}
      <div style={{ ...styles.banner, backgroundColor: theme.bg, borderColor: theme.border }}>
        <div style={styles.bannerContent}>
          <div style={styles.bannerIcon}>{theme.icon}</div>
          <div>
            <h2 style={{ ...styles.bannerTitle, color: theme.text }}>{caseData.zone} ZONE DETECTED</h2>
            <p style={{ ...styles.bannerText, color: theme.text }}>
              <strong>Why?</strong> Predicted delay (+{caseData.predicted_delay?.toFixed(1)} days) 
              {isBreach ? " exceeds " : " is within "} 
              the SLA limit of {caseData.sla_days} days.
            </p>
          </div>
        </div>
        <div style={styles.bannerAction}>
          <span style={{ fontSize: '12px', opacity: 0.8, color: theme.text }}>RECOMMENDED ACTION</span>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: theme.text }}>{caseData.action}</div>
        </div>
      </div>

      <div style={styles.grid}>
        
        {/* --- LEFT COLUMN --- */}
        <div style={styles.col}>
          {/* TIMELINE */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📅 Payment Timeline Prediction</h3>
            <div style={styles.timelineWrapper}>
                <div style={styles.timelineStep}>
                    <div style={styles.timelineDot}></div>
                    <div style={styles.timelineLine}></div>
                    <div style={styles.timelineContent}>
                        <div style={styles.stepLabel}>Contractual Due Date</div>
                        <div style={styles.stepDate}>{formatDate(caseData.due_in_date || caseData.due_date)}</div>
                    </div>
                </div>
                <div style={styles.timelineStep}>
                    <div style={{...styles.timelineDot, background: '#f59e0b'}}></div>
                    <div style={styles.timelineLine}></div>
                    <div style={styles.timelineContent}>
                        <div style={styles.stepLabel}>Internal SLA Limit</div>
                        <div style={styles.stepDate}>
                            {caseData.sla_date ? formatDate(caseData.sla_date) : `+${caseData.sla_days} days grace`}
                        </div>
                    </div>
                </div>
                <div style={styles.timelineStep}>
                    <div style={{...styles.timelineDot, background: isBreach ? '#ef4444' : '#10b981'}}></div>
                    <div style={styles.timelineContent}>
                        <div style={styles.stepLabel}>AI Predicted Payment</div>
                        <div style={{...styles.stepDate, color: isBreach ? '#ef4444' : '#10b981', fontWeight: 'bold'}}>
                           {caseData.predicted_payment_date ? formatDate(caseData.predicted_payment_date) : "Calculating..."}
                        </div>
                    </div>
                </div>
            </div>
          </div>

          {/* ACTION QUEUE */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>🎯 Next Best Action</h3>
            <div style={styles.actionContainer}>
                
                {/* CALL ACTION */}
                {caseData.action === 'CALL' && (
                   <div style={styles.actionRow}>
                        <div style={styles.actionIcon}>📞</div>
                        <div>
                            <strong>Call Customer Immediately</strong>
                            <p style={styles.actionSub}>Talking points: "We see a potential delay past [SLA Date]. Can we expedite?"</p>
                        </div>
                   </div>
                )}
                {/* ESCALATE ACTION */}
                {caseData.action === 'ESCALATE' && (
                     <div style={styles.actionRow}>
                        <div style={styles.actionIcon}>⚠️</div>
                        <div>
                            <strong>Escalate to Supervisor</strong>
                            <p style={styles.actionSub}>Notify your lawyer about the SLA breach.</p>
                        </div>
                   </div>
                )}
                {/* MAIL ACTION */}
                {caseData.action === 'MAIL' && (
                   <div style={styles.actionRow}>
                        <div style={styles.actionIcon}>✉️</div>
                        <div style={{width: '100%'}}>
                            <strong>Send Reminder Email</strong>
                            <p style={styles.actionSub}>Use "Friendly Reminder" template. No escalation needed yet.</p>
                            
                            {/* AI BUTTON */}
                            <button 
                                onClick={() => setShowEmail(!showEmail)}
                                style={{
                                    marginTop: '10px',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                    color: 'white', border: 'none', 
                                    padding: '8px 16px', borderRadius: '20px', cursor: 'pointer',
                                    fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                                }}
                            >
                                ✨ {showEmail ? "Hide Draft" : "Generate AI Draft"}
                            </button>

                            {/* GENERATED EMAIL BOX */}
                            {showEmail && (
                                <div style={{marginTop: '12px', animation: 'fadeIn 0.3s ease-in'}}>
                                    <textarea 
                                        readOnly 
                                        value={getEmailTemplate()}
                                        style={{
                                            width: '95%', height: '180px', 
                                            padding: '12px', borderRadius: '8px', 
                                            border: '1px solid #cbd5e1',
                                            fontFamily: 'monospace', fontSize: '13px', 
                                            background: '#f8fafc', color: '#334155',
                                            lineHeight: '1.5', resize: 'none'
                                        }}
                                    />
                                    <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '6px'}}>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(getEmailTemplate());
                                                alert("Email copied to clipboard!");
                                            }}
                                            style={{background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'}}
                                        >
                                            📋 Copy to Clipboard
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                   </div>
                )}

                {/* NO ACTION */}
                {caseData.action === 'NO_ACTION' && (
                   <div style={styles.actionRow}>
                        <div style={styles.actionIcon}>💤</div>
                        <div>
                            <strong>No Action Required</strong>
                            <p style={styles.actionSub}>Customer is predicted to pay within terms.</p>
                        </div>
                   </div>
                )}
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN --- */}
        <div style={styles.col}>
            
            {/* 1. INVOICE DETAILS */}
            <div style={styles.card}>
                <h3 style={styles.cardTitle}>📄 Invoice Details</h3>
                <div style={styles.statRow}>
                    <span>{isOpen ? "Outstanding Amount" : "Original Loan Amount"}</span>
                    <span style={styles.statValue}>
                        { 'USD'} {displayAmount.toLocaleString()}
                    </span>
                </div>
                {isOpen && originalAmount > currentAmount && (
                   <div style={styles.statRow}>
                       <span>Original Amount</span>
                       <span style={{color: '#94a3b8'}}>
                           {Number(originalAmount).toLocaleString()}
                       </span>
                   </div>
               )}
                <div style={styles.statRow}>
                    <span>Invoice Date</span>
                    <span>{formatDate(caseData.document_create_date)}</span>
                </div>
                <div style={styles.statRow}>
                    <span>Days Outstanding</span>
                    <span>{caseData.due_days} days</span>
                </div>
            </div>

            {/* 2. CUSTOMER RELIABILITY */}
            <div style={styles.card}>
                <h3 style={styles.cardTitle}>🏢 Customer Reliability</h3>
                <div style={styles.trustScoreContainer}>
                    <div style={styles.trustLabel}>Trust Score</div>
                    <div style={styles.trustBarBg}>
                        <div style={{
                            ...styles.trustBarFill, 
                            width: `${Math.max(2, 100 - (caseData.late_payment_ratio * 100))}%`,
                            backgroundColor: caseData.late_payment_ratio > 0.5 ? '#ef4444' : '#10b981'
                        }}></div>
                    </div>
                </div>
                
                <div style={styles.statRow}>
                    <span>Name</span>
                    <Link 
                      to={`/admin/customer/${caseData.cust_number || caseData.customer_id}`} 
                      style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 'bold', borderBottom: '1px dotted #2563eb' }}
                    >
                        {caseData.name_customer || "Unknown Customer"} ↗
                    </Link>
                </div>

                <div style={styles.statRow}>
                    <span>Late Payment Freq</span>
                    <span>{(caseData.late_payment_ratio * 100).toFixed(0)}% of invoices</span>
                </div>
                <div style={styles.insightBox}>
                    💡 <strong>Insight:</strong> 
                    {caseData.late_payment_ratio > 0.5 
                     ? " This customer has a habit of paying late." 
                     : " This is normally a good payer."}
                </div>
            </div>

            {/* 3. ACTIVITY LOG (Live Updates) */}
            <div style={styles.card}>
                <div style={styles.cardHeaderRow}>
                    <h3 style={styles.cardTitleNoBottom}>📜 Activity Log</h3>
                    <button style={styles.addBtn}>+ Log Call</button>
                </div>
                <div style={styles.logList}>
                    {(caseData.history_logs || [])
                        .sort((a, b) => new Date(b.date) - new Date(a.date)) 
                        .map((log, index) => (
                        <div key={index} style={styles.logItem}>
                            <div style={styles.logDateBox}>
                                <span style={styles.logMonth}>
                                    {new Date(log.date).toLocaleDateString('en-US',{month:'short'})}
                                </span>
                                <span style={styles.logDay}>
                                    {new Date(log.date).getDate()}
                                </span>
                            </div>
                            <div style={styles.logContent}>
                                <div style={styles.logHeader}>
                                    <span style={{
                                        fontSize: '14px', 
                                        fontWeight: '600',
                                        color: log.action.includes("AI") ? '#7c3aed' : '#111827' 
                                    }}>
                                        {log.action.includes("AI") ? "⚡ " : ""} 
                                        {log.action}
                                    </span>
                                    
                                    <span style={{
                                        ...styles.statusBadge, 
                                        backgroundColor: log.action.includes("AI") ? '#f3e8ff' : '#f3f4f6',
                                        color: log.action.includes("AI") ? '#7e22ce' : '#4b5563',
                                        border: log.action.includes("AI") ? '1px solid #d8b4fe' : 'none'
                                    }}>
                                        {log.status || log.outcome}
                                    </span>
                                </div>
                                <div style={{
                                    ...styles.logNote,
                                    fontFamily: log.action.includes("AI") ? 'monospace' : 'inherit',
                                    fontSize: log.action.includes("AI") ? '12px' : '13px',
                                    color: log.action.includes("AI") ? '#475569' : '#4b5563'
                                }}>
                                    "{log.note}"
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {(!caseData.history_logs || caseData.history_logs.length === 0) && (
                        <div style={{color: '#94a3b8', fontStyle: 'italic', fontSize: '13px', textAlign: 'center', padding: '10px'}}>
                            No activity recorded yet.
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

// --- STYLES ---
const styles = {
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666', fontFamily: 'sans-serif' },
  container: { maxWidth: '1100px', margin: '0 auto', padding: '40px 20px', fontFamily: '-apple-system, system-ui, sans-serif', color: '#1f2937' },
  
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: '15px', fontWeight: '500' },
  invoiceLabel: { fontSize: '20px', fontWeight: '700', color: '#111827' },
  statusBadge: { fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px' },
  closeBtn: { background: '#fff', border: '1px solid #d1d5db', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },

  banner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderRadius: '12px', border: '1px solid', marginBottom: '32px' },
  bannerContent: { display: 'flex', gap: '16px', alignItems: 'flex-start' },
  bannerIcon: { fontSize: '32px' },
  bannerTitle: { margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700' },
  bannerText: { margin: 0, fontSize: '14px', maxWidth: '500px' },
  bannerAction: { textAlign: 'right' },

  grid: { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' },
  col: { display: 'flex', flexDirection: 'column', gap: '24px' },

  card: { background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' },
  cardTitle: { margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' },

  timelineWrapper: { paddingLeft: '8px' },
  timelineStep: { display: 'flex', gap: '16px', position: 'relative', paddingBottom: '32px' },
  timelineDot: { width: '12px', height: '12px', borderRadius: '50%', background: '#9ca3af', zIndex: 1, marginTop: '6px' },
  timelineLine: { position: 'absolute', left: '5px', top: '18px', bottom: '-6px', width: '2px', background: '#e5e7eb' },
  timelineContent: { marginTop: '0px' },
  stepLabel: { fontSize: '12px', color: '#6b7280', fontWeight: '500', marginBottom: '2px' },
  stepDate: { fontSize: '16px', color: '#111827', fontWeight: '500' },

  actionContainer: { background: '#f9fafb', padding: '16px', borderRadius: '8px' },
  actionRow: { display: 'flex', gap: '16px', alignItems: 'flex-start' },
  actionIcon: { fontSize: '24px' },
  actionSub: { fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' },

  statRow: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f3f4f6', fontSize: '14px', color: '#4b5563' },
  statValue: { fontWeight: '600', color: '#111827' },
  
  trustScoreContainer: { marginBottom: '20px' },
  trustLabel: { fontSize: '12px', color: '#6b7280', marginBottom: '6px' },
  trustBarBg: { height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' },
  trustBarFill: { height: '100%', borderRadius: '4px' },
  insightBox: { marginTop: '16px', padding: '12px', background: '#eff6ff', borderRadius: '6px', fontSize: '13px', color: '#1e40af', border: '1px solid #dbeafe' },

  cardHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  cardTitleNoBottom: { margin: 0, fontSize: '16px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' },
  addBtn: { background: '#2563eb', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  logList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  logItem: { display: 'flex', gap: '12px', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '1px solid #f3f4f6' },
  logDateBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px', background: '#f9fafb', padding: '6px', borderRadius: '6px', border: '1px solid #e5e7eb' },
  logMonth: { fontSize: '10px', textTransform: 'uppercase', color: '#6b7280', fontWeight: '700' },
  logDay: { fontSize: '16px', fontWeight: 'bold', color: '#1f2937' },
  logContent: { flex: 1 },
  logHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  logAction: { fontSize: '14px', fontWeight: '600', color: '#111827' },
  logNote: { fontSize: '13px', color: '#4b5563', fontStyle: 'italic', lineHeight: '1.4' }
};

export default CaseDetail;

// ==========================================
// START OF FILE: ./pages/AiLogs.jsx
// ==========================================

import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const AiLogs = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "ai_logs"), orderBy("timestamp", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data);
    });

    return () => unsubscribe();
  }, []);

  const mailLogs = logs.filter(l => l.type === "MAIL");
  const callLogs = logs.filter(l => l.type === "CALL");

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "10px" }}>🤖 AI Agent Activity Logs</h1>
      <p style={{ color: "#64748b", marginBottom: "40px" }}>
        Real-time monitoring of automated actions taken by the system today.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
        
        {/* COLUMN 1: EMAILS */}
        <div style={styles.column}>
          <div style={styles.colHeader}>
            <span style={{ fontSize: "20px" }}>✉️ Sent Emails</span>
            <span style={styles.countBadge}>{mailLogs.length}</span>
          </div>
          
          <div style={styles.list}>
            {mailLogs.map(log => (
              <div key={log.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <strong style={{ color: "#1e293b" }}>{log.company_name}</strong>
                  <span style={styles.time}>
                    {log.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <div style={styles.target}>{log.target}</div>
                <div style={styles.bodyPreview}>
                    "{log.content}"
                </div>
                <div style={styles.status}>
                    ✅ Sent via SMTP
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN 2: CALLS */}
        <div style={styles.column}>
          <div style={styles.colHeader}>
            <span style={{ fontSize: "20px" }}>📞 Automated Calls</span>
            <span style={styles.countBadge}>{callLogs.length}</span>
          </div>

          <div style={styles.list}>
            {callLogs.map(log => (
              <div key={log.id} style={{ ...styles.card, borderLeft: "4px solid #f97316" }}>
                <div style={styles.cardTop}>
                  <strong style={{ color: "#1e293b" }}>{log.company_name}</strong>
                  <span style={styles.time}>
                    {log.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                
                <div style={styles.target}>Orange Zone • High Priority</div>
                
                {/* Script Text */}
                <div style={styles.bodyPreview}>
                   "{log.content}"
                </div>

                {/* AUDIO PLAYER */}
                {log.audio_url ? (
                  <div style={{ marginTop: "10px", marginBottom: "10px" }}>
                    <audio controls src={log.audio_url} style={{ width: "100%", height: "30px" }} />
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", color: "red" }}>Audio unavailable</div>
                )}

                <div style={{...styles.status, color: '#f97316', background: '#ffedd5'}}>
                    🎧 Voicemail Generated
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

const styles = {
  column: { background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" },
  colHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  countBadge: { background: "#cbd5e1", padding: "4px 12px", borderRadius: "20px", fontWeight: "bold", fontSize: "14px" },
  list: { display: "flex", flexDirection: "column", gap: "16px" },
  card: { background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", borderLeft: "4px solid #3b82f6", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  cardTop: { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  time: { fontSize: "12px", color: "#94a3b8" },
  target: { fontSize: "12px", color: "#64748b", fontFamily: "monospace", marginBottom: "8px" },
  bodyPreview: { fontSize: "13px", color: "#334155", fontStyle: "italic", marginBottom: "12px", lineHeight: "1.4" },
  status: { display: "inline-block", fontSize: "11px", fontWeight: "bold", background: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "4px" }
};

export default AiLogs;

// ==========================================
// START OF FILE: ./pages/LandingPage.jsx
// ==========================================

// ==========================================
// FILE: src/pages/LandingPage.jsx
// ==========================================

import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div style={styles.container}>
      
      {/* --- Navbar / Header --- */}
      <nav style={styles.nav}>
        <div style={styles.logo}>FedEx <span style={{ fontWeight: 'normal', color: '#666' }}>DCA System</span></div>
        <div style={styles.navLinks}>
          <span style={styles.navItem}>Contact Support</span>
          <span style={styles.navItem}>System Status: <span style={{color: '#2ecc71'}}>● Online</span></span>
        </div>
      </nav>

      {/* --- Main Content Split --- */}
      <div style={styles.heroSection}>
        <h1 style={styles.headline}>Intelligent Collections Management</h1>
        <p style={styles.subheadline}>
          Select your portal to continue.
        </p>

        <div style={styles.cardContainer}>
          
          {/* 1. ADMIN CARD */}
          <div style={styles.card}>
            <div style={styles.iconCircle}>🛡️</div>
            <h2 style={styles.cardTitle}>Staff & Administrators</h2>
            <p style={styles.cardText}>
              Access the AI-powered dashboard, manage escalation queues, and monitor payment zones.
            </p>
            <Link to="/admin/dashboard" style={styles.adminBtn}>
              Login to Admin Console
            </Link>
          </div>

          {/* 2. CLIENT CARD */}
          <div style={styles.card}>
            <div style={styles.iconCircle}>🏢</div>
            <h2 style={styles.cardTitle}>Client Portal</h2>
            <p style={styles.cardText}>
              View your outstanding invoices, make secure payments, and manage your account profile.
            </p>
            <Link to="/portal" style={styles.clientBtn}>
              Access Company Portal
            </Link>
          </div>

        </div>
      </div>

      {/* --- Footer --- */}
      <footer style={styles.footer}>
        © {new Date().getFullYear()} FedEx. All rights reserved. | Internal System v2.0
      </footer>
    </div>
  );
};

// --- CSS-in-JS Styles ---
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    // ✨ NEW: Wallpaper Background with Dark Overlay
    backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.7)), url(/wallpaper.avif)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    color: '#fff',
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 3rem',
    // Slight transparency to blend with wallpaper
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(5px)',
    borderBottom: '1px solid rgba(0,0,0,0.1)',
  },
  logo: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: '#4D148C', // FedEx Purple
    letterSpacing: '-0.5px',
  },
  navLinks: {
    display: 'flex',
    gap: '2rem',
    fontSize: '0.9rem',
    color: '#666',
    fontWeight: '500',
  },
  navItem: {
    cursor: 'pointer',
  },
  heroSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    textAlign: 'center',
  },
  headline: {
    fontSize: '3rem',
    fontWeight: '800',
    marginBottom: '1rem',
    color: '#ffffff', // Changed to white for contrast
    maxWidth: '800px',
    lineHeight: '1.1',
    textShadow: '0 2px 10px rgba(0,0,0,0.3)', // Added shadow for readability
  },
  subheadline: {
    fontSize: '1.25rem',
    color: '#e0e0e0', // Light grey for contrast
    marginBottom: '4rem',
    maxWidth: '600px',
    textShadow: '0 1px 5px rgba(0,0,0,0.3)',
  },
  cardContainer: {
    display: 'flex',
    gap: '2rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '3rem 2rem',
    width: '320px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)', // Stronger shadow for depth
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    transition: 'transform 0.2s ease',
    border: 'none',
  },
  iconCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#f4f4f4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    marginBottom: '1.5rem',
  },
  cardTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    marginBottom: '1rem',
    color: '#333',
  },
  cardText: {
    color: '#666',
    lineHeight: '1.6',
    marginBottom: '2rem',
    fontSize: '0.95rem',
  },
  adminBtn: {
    display: 'inline-block',
    width: '100%',
    padding: '14px 0',
    backgroundColor: '#4D148C', // FedEx Purple
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    transition: 'background 0.2s',
  },
  clientBtn: {
    display: 'inline-block',
    width: '100%',
    padding: '14px 0',
    backgroundColor: '#FF6200', // FedEx Orange
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    transition: 'background 0.2s',
  },
  footer: {
    textAlign: 'center',
    padding: '2rem',
    color: 'rgba(255, 255, 255, 0.7)', // Semi-transparent white
    fontSize: '0.85rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
};

export default LandingPage;

// ==========================================
// START OF FILE: ./pages/Analytics.jsx
// ==========================================

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    riskData: [],
    forecastData: [],
    agingData: [],
    topDebtors: [],
    totalOutstanding: 0,
    totalPredictedRecoverable: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, "cases"), where("isOpen", "==", '1'));
        const snapshot = await getDocs(q);
        
        // Init Counters
        const riskCounts = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
        const forecastMap = { "Overdue": 0, "Week 1": 0, "Week 2": 0, "Week 3": 0, "Future": 0 };
        const agingMap = { "Current": 0, "1-30 Days": 0, "31-60 Days": 0, "60+ Days": 0 };
        const debtorMap = {};
        let totalSum = 0;
        let recoverableSum = 0;

        const today = new Date();
        today.setHours(0,0,0,0);
        
        const next7 = new Date(today); next7.setDate(today.getDate() + 7);
        const next14 = new Date(today); next14.setDate(today.getDate() + 14);
        const next21 = new Date(today); next21.setDate(today.getDate() + 21);

        snapshot.forEach(doc => {
          const d = doc.data();
          const amount = Number(d.total_open_amount || 0);
          totalSum += amount;

          // 1. RISK PIE
          const zone = d.zone || "GREEN";
          if (riskCounts[zone] !== undefined) riskCounts[zone]++;

          // 2. CASH FORECAST
          if (d.predicted_payment_date) {
            const predDate = new Date(d.predicted_payment_date);
            
            // We still track 'Overdue' for logic, but we won't graph it
            if (predDate < today) {
                forecastMap["Overdue"] = (forecastMap["Overdue"] || 0) + amount;
            } 
            else if (predDate <= next7) forecastMap["Week 1"] += amount;
            else if (predDate <= next14) forecastMap["Week 2"] += amount;
            else if (predDate <= next21) forecastMap["Week 3"] += amount;
            else forecastMap["Future"] += amount;
            
            if ((d.predicted_delay || 0) < 90) recoverableSum += amount;
          } else {
             forecastMap["Future"] += amount;
          }

          // 3. AGING BUCKETS
          const dueDate = d.due_date ? new Date(d.due_date) : new Date();
          const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
          
          if (daysOverdue <= 0) agingMap["Current"] += amount;
          else if (daysOverdue <= 30) agingMap["1-30 Days"] += amount;
          else if (daysOverdue <= 60) agingMap["31-60 Days"] += amount;
          else agingMap["60+ Days"] += amount;

          // 4. TOP DEBTORS
          const name = d.name_customer || d.company_name || "Unknown";
          if (!debtorMap[name]) debtorMap[name] = 0;
          debtorMap[name] += amount;
        });

        // --- FORMATTING DATA ---

        // Pie Data
        const riskData = [
          { name: "Safe (Green)", value: riskCounts.GREEN, color: "#10b981" },
          { name: "Watch (Yellow)", value: riskCounts.YELLOW, color: "#f59e0b" },
          { name: "Priority (Orange)", value: riskCounts.ORANGE, color: "#f97316" },
          { name: "Critical (Red)", value: riskCounts.RED, color: "#ef4444" },
        ].filter(d => d.value > 0);

        // Forecast Data (EXPLICITLY EXCLUDING OVERDUE)
        const forecastData = [
            { name: "Week 1", amount: forecastMap["Week 1"] },
            { name: "Week 2", amount: forecastMap["Week 2"] },
            { name: "Week 3", amount: forecastMap["Week 3"] },
            { name: "Future", amount: forecastMap["Future"] }
        ];

        // Aging Data
        const agingData = Object.keys(agingMap).map(k => ({
            name: k, amount: agingMap[k]
        }));

        // Top Debtors
        const topDebtors = Object.entries(debtorMap)
          .map(([name, amount]) => ({ name: name.substring(0, 15) + (name.length>15?'..':''), fullName: name, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        setStats({ riskData, forecastData, agingData, topDebtors, totalOutstanding: totalSum, totalPredictedRecoverable: recoverableSum });

      } catch (err) {
        console.error("Error loading analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div style={styles.loading}>Loading Intelligence...</div>;

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>📊 Financial Command Center</h1>
      
      {/* KPI CARDS */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Total Outstanding</div>
            <div style={styles.kpiValue}>${(stats.totalOutstanding / 1000000).toFixed(2)}M</div>
        </div>
        <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Projected Recovery (30 Days)</div>
            <div style={{...styles.kpiValue, color: '#10b981'}}>${(stats.totalPredictedRecoverable / 1000000).toFixed(2)}M</div>
        </div>
        <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Critical Cases (Red/Orange)</div>
            <div style={{...styles.kpiValue, color: '#ef4444'}}>
                { (stats.riskData.find(x=>x.name.includes("Critical"))?.value || 0) + (stats.riskData.find(x=>x.name.includes("Priority"))?.value || 0) }
            </div>
        </div>
      </div>

      <div style={styles.grid}>
        
        {/* CHART 1: RISK EXPOSURE (PIE) */}
        <div style={styles.card}>
            <h3 style={styles.cardTitle}>🛡️ Risk Distribution</h3>
            <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={stats.riskData} innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                            {stats.riskData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* CHART 2: CASH FORECAST (BAR) */}
        <div style={styles.card}>
            <h3 style={styles.cardTitle}>🔮 ML Cash Forecast (Incoming)</h3>
            <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={stats.forecastData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 12}} />
                        
                        <YAxis 
                            tickFormatter={(val) => val === 0 ? '$0' : `$${(val / 1000000).toFixed(1)}M`} 
                            tick={{fontSize: 12}} 
                        />
                        
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} cursor={{fill: '#f1f5f9'}} />
                        
                        <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* CHART 3: AGING BUCKETS */}
        <div style={styles.card}>
            <h3 style={styles.cardTitle}>⏳ Aging Buckets (Debt Age)</h3>
            <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={stats.agingData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 12}} />
                        
                        <YAxis 
                            tickFormatter={(val) => val === 0 ? '$0' : `$${(val / 1000000).toFixed(1)}M`} 
                            tick={{fontSize: 12}} 
                        />
                        
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} cursor={{fill: '#f1f5f9'}} />
                        <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* CHART 4: TOP DEBTORS */}
        <div style={styles.card}>
            <h3 style={styles.cardTitle}>💰 Top 5 Debtors</h3>
            <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={stats.topDebtors} layout="vertical" margin={{left: 0, right: 30}}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} style={{fontSize: '11px', fontWeight: '500'}} />
                        <Tooltip cursor={{fill: '#f1f5f9'}} formatter={(value) => `$${value.toLocaleString()}`} labelFormatter={(l, p) => p[0]?.payload.fullName}/>
                        <Bar dataKey="amount" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

      </div>
    </div>
  );
};

const styles = {
  page: { width: "100%", padding: "40px", boxSizing: "border-box", minHeight: "100vh", background: "#f8fafc" },
  pageTitle: { margin: "0 0 30px 0", fontSize: "28px", color: "#1e293b", fontWeight: "800" },
  loading: { padding: "40px", textAlign: "center", color: "#64748b" },
  
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "30px" },
  kpiCard: { background: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  kpiLabel: { fontSize: "12px", textTransform: "uppercase", color: "#64748b", fontWeight: "600", marginBottom: "8px" },
  kpiValue: { fontSize: "32px", fontWeight: "800", color: "#0f172a" },

  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  card: { background: "white", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" },
  cardTitle: { margin: "0 0 20px 0", fontSize: "16px", color: "#334155", fontWeight: "700" }
};

export default Analytics;

// ==========================================
// START OF FILE: ./pages/EscalationPage.jsx
// ==========================================

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import "./EscalationPage.css";

const EscalationPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""); // 🔍 NEW
  const navigate = useNavigate();

  // ======================
  // FETCH RED CASES
  // ======================
  useEffect(() => {
    const q = query(collection(db, "cases"), where("zone", "==", "RED"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ======================
  // FILTER BY AGENT NAME
  // ======================
  const filteredTasks = tasks.filter((t) =>
    (t.assigned_agent_name || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // ======================
  // RENDER
  // ======================
  return (
    <div className="escalation-page">
      <div className="escalation-container">
        {/* HEADER */}
        <div className="escalation-header">
          <div>
            <h1 className="escalation-title">Escalation Control Tower</h1>
            <p className="escalation-subtitle">
              Overseeing {tasks.length} critical breaches across the recovery
              network.
            </p>
          </div>

          {/* 🔍 SEARCH BAR */}
          <input
            type="text"
            placeholder="Search by agent name…"
            className="agent-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* CONTENT */}
        {loading ? (
          <p>Loading escalations…</p>
        ) : filteredTasks.length === 0 ? (
          <p className="no-results">No cases found for this agent.</p>
        ) : (
          <div className="escalation-grid">
            {filteredTasks.map((t) => (
              <div key={t.id} className="escalation-card">
                {/* CARD HEADER */}
                <div className="card-header">
                  <div className="client-name">
                    {t.name_customer || "Unknown Client"}
                  </div>
                  <span className="risk-critical">CRITICAL</span>
                </div>

                {/* AMOUNT */}
                <div>
                  <div className="amount-label">Total Outstanding</div>
                  <div className="amount">
                    ₹{Math.round(t.total_open_amount || 0).toLocaleString()}
                  </div>
                  <div className="delay">
                    +{Math.round(t.predicted_delay || 0)} days delay
                  </div>
                </div>

                {/* FOOTER */}
                <div className="card-footer">
                  <div className="agent-row">
                    {t.assigned_agent_photo && (
                      <img
                        src={t.assigned_agent_photo}
                        alt={t.assigned_agent_name}
                        className="agent-avatar"
                      />
                    )}
                    <div className="agent-name">
                      Agent: {t.assigned_agent_name || "Unassigned"}
                    </div>
                  </div>

                  <button
                    className="view-btn"
                    onClick={() =>
                      navigate(`/admin/case/${t.invoice_id || t.id}`)
                    }
                  >
                    View Case →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EscalationPage;


// ==========================================
// START OF FILE: ./pages/ClientDashboard.jsx
// ==========================================

import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { Link, useNavigate } from 'react-router-dom';

// --- HELPER: ZONE STYLES ---
const getZoneBadge = (zone, predictedDelay) => {
  const styles = {
    padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "700", display: "inline-block"
  };

  switch (zone) {
    case "GREEN": return <span style={{ ...styles, background: "#dcfce7", color: "#166534" }}>✅ On Track</span>;
    case "YELLOW": return <span style={{ ...styles, background: "#fef9c3", color: "#854d0e" }}>⚠️ Due Soon</span>;
    case "ORANGE": return <span style={{ ...styles, background: "#ffedd5", color: "#9a3412" }}>🟠 Risk of Delay</span>;
    case "RED": return <span style={{ ...styles, background: "#fee2e2", color: "#991b1b" }}>🚨 Critical / Overdue</span>;
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
        const q = query(casesRef, where("cust_number", "==", clientId));
        const snapshot = await getDocs(q);
        
        const fetchedCases = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(c => c.isOpen == "1" || c.isOpen === 1 || c.isOpen === true || c.is_open_flag === true)
          .sort((a, b) => {
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

  const subsidiaries = useMemo(() => {
    const names = new Set(cases.map(c => c.name_customer || "Unknown Entity"));
    return ["All", ...Array.from(names).sort()];
  }, [cases]);

  const filteredCases = useMemo(() => {
    if (selectedSubsidiary === "All") return cases;
    return cases.filter(c => (c.name_customer || "Unknown Entity") === selectedSubsidiary);
  }, [cases, selectedSubsidiary]);

  const totals = useMemo(() => {
    return filteredCases.reduce((acc, curr) => {
      const amount = parseFloat(curr.total_open_amount || 0);
      acc.total += amount;
      
      const isRed = curr.zone === "RED";
      const dateStr = curr.due_in_date || curr.due_date;
      let isPastDue = false;
      
      if (dateStr) {
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
                        {"$"} {parseFloat(c.total_open_amount).toLocaleString()}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {getZoneBadge(c.zone, c.predicted_delay)}
                      {c.predicted_delay > 0 && (
                        <div style={styles.delayText}>Est. +{Math.round(c.predicted_delay)} days late</div>
                      )}
                    </td>
                    
                    {/* 🟢 THIS COLUMN IS WHERE THE BUTTON WAS MISSING */}
                    <td style={styles.td}>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <Link 
                          to={`/pay/${c.id}`}
                          style={styles.payBtn}
                        >
                          Pay Now
                        </Link>
                        
                        {/* 💬 ADDED NEGOTIATE BUTTON */}
                        <button
                            onClick={() => navigate(`/portal/negotiate/${c.id}`)}
                            style={styles.negotiateBtn}
                        >
                            💬 Negotiate
                        </button>
                      </div>
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
  
  // BUTTONS
  payBtn: { display: "inline-block", background: "#FF6200", color: "white", padding: "8px 16px", borderRadius: "6px", textDecoration: "none", fontWeight: "600", fontSize: "0.85rem", transition: "background 0.2s" },
  
  // 🟢 NEGOTIATE BUTTON STYLE ADDED HERE
  negotiateBtn: { background: "white", color: "#475569", border: "1px solid #cbd5e1", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "0.85rem", transition: "all 0.2s" },
  
  emptyState: { padding: "60px", textAlign: "center", color: "#6b7280" }
};

export default ClientDashboard;

// ==========================================
// START OF FILE: ./pages/Dashboard.jsx
// ==========================================

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "../firebase.js";
import CaseTable from "../components/CaseTable.jsx";
import ZoneSummary from "../components/ZoneSummary.jsx";
import SlaBreachList from "../components/SlaBreachList.jsx";
import CallsOverview from "../components/CallsOverview.jsx";
import CashForecast from "../components/CashForecast.jsx";
import AddCaseModal from "../components/AddCaseModal.jsx";

const Dashboard = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters & Modal
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    // 1. QUERY: Fetch all to ensure Summary Widgets have accurate totals
    const q = query(
      collection(db, "cases"),
      orderBy("last_predicted_at", "desc"),
      
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = [];
        snapshot.docs.forEach((doc) => {
          const d = doc.data();
          const originalAmount = Number(d.original_amount || d.total_open_amount || 0);
        
        // 2. Get the Dynamic Open Amount
        const currentOpenAmount = Number(d.total_open_amount || 0);
        
        // 3. Determine "Display Amount" based on Status
        // If Open: Show what is owed (Current)
        // If Closed: Show what the loan WAS (Original)
        const isOpen = d.isOpen == '1' || d.is_open_flag === true;
        const displayAmount = isOpen ? currentOpenAmount : originalAmount;
          rows.push({
            id: doc.id,
            invoice_id: d.invoice_id || d.doc_id || doc.id,
            company_name: d.company_name || d.name_customer || "Unknown Company",
            invoice_amount: displayAmount, 
            
            // We keep these for other logic/calculations
            outstanding_amount: currentOpenAmount,
            original_amount: originalAmount,
            due_date: d.due_date ? new Date(d.due_date).toLocaleDateString() : "—",
            predicted_payment_date: d.predicted_payment_date || "—",
            predicted_delay: d.predicted_delay !== undefined ? Number(d.predicted_delay) : null,
            sla_days: d.sla_days,
            sla_date: d.sla_date,
            zone: d.zone || "UNKNOWN",
            action: d.action || "NO_ACTION",
            escalated: Boolean(d.escalated),
            last_predicted_at: d.last_predicted_at,
            total_open_amount: d.total_open_amount,
            isOpen: isOpen
          });
        });

        setCases(rows);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Firestore Error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. RESET PAGE ON FILTER CHANGE
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [zoneFilter]);

  // 3. FILTERING LOGIC
  const filteredCases = zoneFilter === "ALL" 
    ? cases 
    : cases.filter((c) => c.zone === zoneFilter);

  // 4. PAGINATION LOGIC
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTableData = filteredCases.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);

  // Derive specialized lists (Use 'cases' so sidebars show GLOBAL stats, not just page stats)
  const slaBreachedCases = cases.filter((c) => c.escalated === true);
  const callActionCases = cases.filter((c) => c.action === "CALL");

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Optional: Scroll to top of table
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    }
    
  };

  if (loading) return <div style={{ padding: 40 }}>Loading Dashboard...</div>;
  if (error) return <div style={{ padding: 40, color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: 40, background: "#f8f9fa", minHeight: "100vh" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>DCA Dashboard ({cases.length} active cases)</h1>
        
        <button 
          onClick={() => setShowAddModal(true)}
          style={styles.addBtn}
        >
          + New Case
        </button>
      </div>
      <ZoneSummary cases={cases} />

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        
        {/* LEFT COLUMN: Main Table */}
        <div style={{ flex: 3 }}>
          
          {/* Filter Pills */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {["ALL", "GREEN", "YELLOW", "ORANGE"].map((zone) => (
              <button
                key={zone}
                onClick={() => setZoneFilter(zone)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: "none",
                  background: zoneFilter === zone ? "#2c3e50" : "#fff",
                  color: zoneFilter === zone ? "#fff" : "#333",
                  cursor: "pointer",
                  fontWeight: "600",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
                }}
              >
                {zone}
              </button>
            ))}
          </div>

          {/* TABLE (Shows only 100 rows) */}
          <CaseTable cases={currentTableData} />

          {/* PAGINATION CONTROLS */}
          {filteredCases.length > 0 && (
            <div style={styles.paginationContainer}>
                <span style={styles.pageInfo}>
                    Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredCases.length)} of {filteredCases.length}
                </span>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={{...styles.pageBtn, opacity: currentPage === 1 ? 0.5 : 1}}
                    >
                        Previous
                    </button>
                    
                    <span style={styles.pageNumber}>
                        Page {currentPage} of {totalPages}
                    </span>

                    <button 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        style={{...styles.pageBtn, opacity: currentPage === totalPages ? 0.5 : 1}}
                    >
                        Next
                    </button>
                </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Sidebar Widgets (Shows GLOBAL stats) */}
        <div style={{ flex: 1, minWidth: "300px" }}>
          <CashForecast cases={cases} />
          <SlaBreachList cases={slaBreachedCases} />
          <CallsOverview cases={callActionCases} />
        </div>
      </div>

      {showAddModal && (
        <AddCaseModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
};

// Styling for Pagination Controls
const styles = {
    addBtn: {
        background: "#2563eb", 
        color: "white", 
        border: "none", 
        padding: "10px 20px", 
        borderRadius: "8px", 
        cursor: "pointer", 
        fontWeight: "bold",
        display: "flex", alignItems: "center", gap: "8px",
        boxShadow: "0 2px 5px rgba(37, 99, 235, 0.3)"
    },
    paginationContainer: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "20px",
        padding: "10px",
        background: "#fff",
        borderRadius: "8px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
    },
    pageInfo: {
        fontSize: "14px",
        color: "#64748b",
        fontWeight: "500"
    },
    pageBtn: {
        padding: "8px 16px",
        border: "1px solid #e2e8f0",
        background: "white",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "600",
        color: "#334155"
    },
    pageNumber: {
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        fontSize: "14px",
        fontWeight: "600",
        color: "#334155"
    }
};

export default Dashboard;

// ==========================================
// START OF FILE: ./pages/ClientNegotiation.jsx
// ==========================================

import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";

// --- 1. CONFIGURATION ---
const AGENTS = [
  { id: "agent_001", name: "Sarah Connor", role: "Senior Recovery Specialist", avatar: "👩‍💼" },
  { id: "agent_002", name: "John Wick", role: "Escalation Manager", avatar: "👨‍💼" },
  { id: "agent_003", name: "Ethan Hunt", role: "Resolution Officer", avatar: "🕵️‍♂️" }
];

const ClientNegotiation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Data State
  const [caseData, setCaseData] = useState(null);
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [inputMode, setInputMode] = useState("loading"); // 'financials', 'decision', 'done'
  
  // Financial Form State
  const [financials, setFinancials] = useState({
    cashBalance: "",
    monthlyRevenue: "",
    liabilities: ""
  });

  const scrollRef = useRef(null);

  // --- 2. INITIALIZATION: ASSIGN AGENT & LOAD CHAT ---
  useEffect(() => {
    const initCase = async () => {
      try {
        const caseRef = doc(db, "cases", id);
        const snap = await getDoc(caseRef);

        if (snap.exists()) {
          const data = snap.data();
          let assignedAgent = AGENTS.find(a => a.name === data.assigned_agent_name);

          // If no agent assigned, pick one randomly and save it
          if (!assignedAgent) {
            assignedAgent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
            await updateDoc(caseRef, {
              assigned_agent_name: assignedAgent.name,
              assigned_agent_id: assignedAgent.id,
              status: "NEGOTIATION_ACTIVE",
              zone: "YELLOW", // Risk reduced because they are engaging
              last_contacted_at: serverTimestamp()
            });
          }

          setCaseData(data);
          setAgent(assignedAgent);
          
          // Start the Chat Sequence
          setMessages([
            { sender: "bot", text: `Hello, I am the automated assistant for ${assignedAgent.name}.` },
            { sender: "bot", text: `We understand that cash flow issues happen. To see if you qualify for a relief plan (EMI or Discount), I need to assess your current financial standing.` },
            { sender: "bot", text: "Please provide your current financial estimates below to proceed." }
          ]);
          setInputMode("financials");
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };
    initCase();
  }, [id]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  // --- 3. THE RULE ENGINE 🧠 ---
  const calculateOffer = () => {
    const debt = Number(caseData.total_open_amount);
    const cash = Number(financials.cashBalance);
    const revenue = Number(financials.monthlyRevenue);
    
    // Logic:
    // 1. If they have enough cash to pay 80% of debt immediately -> No Relief
    if (cash > debt * 0.8) {
        return {
            type: "REJECT",
            text: "Based on your cash reserves, it appears you have sufficient liquidity to settle this invoice. We cannot offer a discount at this time. Immediate full payment is required.",
            plan: null
        };
    }

    // 2. If Cash is low, but Revenue is strong -> EMI Plan
    if (revenue > debt * 0.5) {
        const monthly = (debt / 3).toFixed(2);
        return {
            type: "EMI",
            text: `We can offer you a 3-Month Installment Plan. This will help manage your cash flow while keeping the account active.`,
            plan: {
                title: "3-Month EMI Plan",
                detail: `Pay $${monthly} / month for 3 months.`,
                actionVal: "EMI_ACCEPTED"
            }
        };
    }

    // 3. If Cash AND Revenue are low -> Distress -> Offer Discount (OTS)
    // One Time Settlement
    const discountAmount = (debt * 0.85).toFixed(2); // 15% discount
    const saved = (debt * 0.15).toFixed(2);
    return {
        type: "DISCOUNT",
        text: `It looks like you are in a tight spot. To close this today, ${agent.name} has authorized a One-Time Settlement (OTS).`,
        plan: {
            title: "15% Discount Settlement",
            detail: `Pay $${discountAmount} today and we waive the remaining $${saved}.`,
            actionVal: "OTS_ACCEPTED"
        }
    };
  };


  // --- 4. HANDLERS ---
  const handleFinancialSubmit = (e) => {
    e.preventDefault();
    // 1. Add User Input to Chat
    // eslint-disable-next-line no-unused-vars
    const userMsg = `Cash: $${financials.cashBalance}, Rev: $${financials.monthlyRevenue}`;
    setMessages(prev => [...prev, { sender: "user", text: "Here are my details." }]);
    setInputMode("thinking");

    // 2. Simulate AI "Thinking"
    setTimeout(() => {
        const offer = calculateOffer();
        setMessages(prev => [...prev, { sender: "bot", text: "Analyzing your eligibility..." }]);
        
        setTimeout(() => {
            setMessages(prev => [...prev, 
                { sender: "bot", text: offer.text },
                { sender: "system", offer: offer } // Special message type for the Offer Card
            ]);
            setInputMode("decision");
        }, 1500);
    }, 1000);
  };

  const handleDecision = async (decision, offerDetails) => {
    setInputMode("done");
    const caseRef = doc(db, "cases", id);

    if (decision === "ACCEPT") {
        setMessages(prev => [...prev, 
            { sender: "user", text: `I accept the ${offerDetails.title}.` },
            { sender: "bot", text: "Thank you. I have updated the agreement. You will receive a confirmation email shortly." }
        ]);

        // Update Firebase with the Plan
        await updateDoc(caseRef, {
            status: "PLAN_AGREED",
            zone: "GREEN", // Risk neutralized
            negotiation_outcome: offerDetails.title,
            history_logs: arrayUnion({
                date: new Date().toISOString(),
                action: "🤝 Negotiation",
                outcome: "Success",
                note: `Customer accepted ${offerDetails.title} via AI Chat.`,
                status: "Resolved"
            })
        });
    } else {
        setMessages(prev => [...prev, 
            { sender: "user", text: "I cannot agree to this." },
            { sender: "bot", text: `Understood. I have flagged this case for ${agent.name} to review personally. They will call you shortly.` }
        ]);

        await updateDoc(caseRef, {
            status: "NEGOTIATION_FAILED",
            zone: "RED", // High risk now
            action: "CALL", // Tell agent to call
            history_logs: arrayUnion({
                date: new Date().toISOString(),
                action: "🚫 Negotiation",
                outcome: "Failed",
                note: `Customer rejected AI offer. Manual Intervention Required.`,
                status: "Open"
            })
        });
    }
  };

  if (loading) return <div style={styles.center}>Initializing Secure Channel...</div>;

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button onClick={() => navigate('/portal/dashboard')} style={styles.backBtn}>← Dashboard</button>
        <div style={styles.agentBadge}>
            <span style={{fontSize: '20px'}}>{agent?.avatar}</span>
            <div style={{textAlign: 'left'}}>
                <div style={{fontSize: '12px', fontWeight: 'bold'}}>{agent?.name}</div>
                <div style={{fontSize: '10px', opacity: 0.8}}>Assigned Specialist • Online</div>
            </div>
        </div>
      </div>

      <div style={styles.chatContainer}>
        {/* MESSAGES AREA */}
        <div style={styles.messagesList}>
            {messages.map((m, i) => (
                <div key={i} style={{
                    ...styles.messageRow, 
                    justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start'
                }}>
                    {m.sender === 'bot' && <div style={styles.botAvatar}>🤖</div>}
                    
                    {m.sender !== 'system' ? (
                        <div style={{
                            ...styles.bubble,
                            background: m.sender === 'user' ? '#4D148C' : '#f1f5f9',
                            color: m.sender === 'user' ? 'white' : '#334155',
                            borderBottomLeftRadius: m.sender === 'bot' ? 0 : 16,
                            borderBottomRightRadius: m.sender === 'user' ? 0 : 16,
                        }}>
                            {m.text}
                        </div>
                    ) : (
                        // SPECIAL OFFER CARD RENDER
                        <div style={styles.offerCard}>
                            {m.offer.type === 'REJECT' ? (
                                <div style={{color: '#dc2626', fontWeight: 'bold'}}>❌ Request Denied</div>
                            ) : (
                                <>
                                    <div style={{color: '#16a34a', fontWeight: 'bold', marginBottom: 5}}>✨ Special Offer Generated</div>
                                    <h3 style={{margin: '5px 0', color: '#1e293b'}}>{m.offer.plan.title}</h3>
                                    <p style={{margin: '5px 0 15px', color: '#64748b', fontSize: '14px'}}>{m.offer.plan.detail}</p>
                                    
                                    {inputMode === 'decision' && (
                                        <div style={{display: 'flex', gap: 10}}>
                                            <button onClick={() => handleDecision("ACCEPT", m.offer.plan)} style={styles.acceptBtn}>Accept Deal</button>
                                            <button onClick={() => handleDecision("REJECT")} style={styles.rejectBtn}>Decline</button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            ))}
            {inputMode === 'thinking' && <div style={{fontSize: '12px', color: '#94a3b8', marginLeft: 40}}>Typing...</div>}
            <div ref={scrollRef} />
        </div>

        {/* INPUT AREA */}
        <div style={styles.inputArea}>
            {inputMode === 'financials' && (
                <form onSubmit={handleFinancialSubmit} style={styles.formGrid}>
                    <div style={styles.inputGroup}>
                        <label>Current Cash Reserve ($)</label>
                        <input 
                            type="number" required 
                            style={styles.input} 
                            placeholder="e.g. 5000"
                            onChange={e => setFinancials({...financials, cashBalance: e.target.value})}
                        />
                    </div>
                    <div style={styles.inputGroup}>
                        <label>Monthly Revenue ($)</label>
                        <input 
                            type="number" required 
                            style={styles.input} 
                            placeholder="e.g. 12000"
                            onChange={e => setFinancials({...financials, monthlyRevenue: e.target.value})}
                        />
                    </div>
                    <button type="submit" style={styles.submitBtn}>Submit for Analysis</button>
                </form>
            )}
            
            {inputMode === 'done' && (
                <div style={{textAlign: 'center', color: '#64748b', fontSize: '14px'}}>
                    Chat session ended. You can return to the dashboard.
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: { minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' },
  center: { height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", color: "#64748b" },
  
  topBar: { background: "white", padding: "15px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 },
  backBtn: { border: "none", background: "transparent", color: "#64748b", cursor: "pointer", fontWeight: "600" },
  agentBadge: { display: "flex", alignItems: "center", gap: "10px", background: "#f0fdf4", padding: "5px 12px", borderRadius: "30px", border: "1px solid #bbf7d0", color: "#166534" },

  chatContainer: { flex: 1, maxWidth: "800px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column" },
  messagesList: { flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "15px" },
  
  messageRow: { display: "flex", gap: "10px", alignItems: "flex-end" },
  botAvatar: { width: "30px", height: "30px", background: "#e2e8f0", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "16px" },
  bubble: { padding: "12px 16px", borderRadius: "16px", maxWidth: "70%", lineHeight: "1.5", fontSize: "14px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  
  offerCard: { background: "white", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", maxWidth: "80%", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" },
  acceptBtn: { background: "#16a34a", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  rejectBtn: { background: "transparent", color: "#dc2626", border: "1px solid #dc2626", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },

  inputArea: { background: "white", padding: "20px", borderTop: "1px solid #e2e8f0", position: "sticky", bottom: 0 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "10px", alignItems: "end" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px", color: "#64748b", fontWeight: "600" },
  input: { padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none" },
  submitBtn: { padding: "12px 20px", background: "#4D148C", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }
};

export default ClientNegotiation;

// ==========================================
// START OF FILE: ./pages/CustomerProfile.jsx
// ==========================================

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

// ==========================================
// START OF FILE: ./pages/CustomerSearch.jsx
// ==========================================

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase.js";
import { useNavigate } from "react-router-dom";

const CustomerSearch = () => {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; // Show 9 cards per page (3x3 grid)

  const navigate = useNavigate();

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "company_features"));
        const list = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setCustomers(list);
      } catch (error) {
        console.error("Error fetching customers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  // 1. FILTER Logic
  const filtered = customers.filter(c => 
    (c.company_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cust_number || "").includes(searchTerm)
  );

  // 2. PAGINATION Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  // Handle Page Change
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Reset to Page 1 on search
  const handleSearch = (e) => {
      setSearchTerm(e.target.value);
      setCurrentPage(1);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1>👥 Customer Directory</h1>
        <p style={{color: '#64748b'}}>Search and analyze payment behaviors across your portfolio.</p>
      </div>

      {/* SEARCH BAR */}
      <div style={styles.searchContainer}>
        <input 
          type="text" 
          placeholder="🔍 Search by Company Name or ID..." 
          value={searchTerm}
          onChange={handleSearch}
          style={styles.searchInput}
        />
      </div>

      {/* RESULTS LIST */}
      <div style={styles.results}>
        {loading ? (
           <div style={{textAlign: 'center', padding: 20, color: '#64748b'}}>Loading directory...</div>
        ) : (
           <>
             <div style={styles.countText}>
                Showing {filtered.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, filtered.length)} of {filtered.length} customers
             </div>
             
             <div style={styles.grid}>
               {currentItems.map(cust => {
                 const isRisky = cust.late_payment_ratio > 0.5;
                 
                 return (
                   <div key={cust.id} style={styles.card} onClick={() => navigate(`/customer/${cust.cust_number}`)}>
                      <div style={styles.cardTop}>
                        <div style={styles.avatar}>{cust.company_name?.charAt(0) || "?"}</div>
                        <div>
                          <div style={styles.name}>
                              {cust.company_name?.length > 20 ? cust.company_name.substring(0, 20) + '...' : cust.company_name || "Unknown"}
                          </div>
                          <div style={styles.id}>ID: {cust.cust_number}</div>
                        </div>
                      </div>
                      
                      <div style={styles.statsRow}>
                        <div style={styles.stat}>
                          <span style={styles.statLabel}>Avg Delay</span>
                          <span style={styles.statValue}>{cust.avg_payment_delay?.toFixed(1)}d</span>
                        </div>
                        <div style={styles.stat}>
                          <span style={styles.statLabel}>Late Freq</span>
                          <span style={styles.statValue}>{(cust.late_payment_ratio * 100).toFixed(0)}%</span>
                        </div>
                      </div>

                      <div style={{...styles.badge, background: isRisky ? '#fee2e2' : '#dcfce7', color: isRisky ? '#991b1b' : '#166534'}}>
                        {isRisky ? '⚠️ Habitual Late Payer' : '✅ Reliable Payer'}
                      </div>
                   </div>
                 );
               })}
             </div>

             {/* EMPTY STATE */}
             {currentItems.length === 0 && (
                <div style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>
                    No customers found matching "{searchTerm}"
                </div>
             )}

             {/* PAGINATION CONTROLS */}
             {filtered.length > itemsPerPage && (
                <div style={styles.pagination}>
                    <button 
                        onClick={() => paginate(currentPage - 1)} 
                        disabled={currentPage === 1}
                        style={{...styles.pageBtn, opacity: currentPage === 1 ? 0.5 : 1}}
                    >
                        Previous
                    </button>
                    
                    <span style={styles.pageInfo}>
                        Page {currentPage} of {totalPages}
                    </span>
                    
                    <button 
                        onClick={() => paginate(currentPage + 1)} 
                        disabled={currentPage === totalPages}
                        style={{...styles.pageBtn, opacity: currentPage === totalPages ? 0.5 : 1}}
                    >
                        Next
                    </button>
                </div>
             )}
           </>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: { width: "100%", padding: "40px 20px", boxSizing: "border-box", minHeight: "100vh", backgroundColor: "#f8fafc" },
  header: { textAlign: "center", marginBottom: "30px" },
  searchContainer: { display: "flex", justifyContent: "center", marginBottom: "30px" },
  searchInput: { width: "100%", maxWidth: "600px", padding: "16px", fontSize: "16px", borderRadius: "30px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", outline: "none" },
  
  countText: { marginBottom: "20px", color: "#64748b", fontWeight: "600", fontSize: '13px', textAlign: 'right' },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" },
  
  card: { background: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  cardTop: { display: "flex", gap: "15px", alignItems: "center", marginBottom: "20px" },
  avatar: { width: "42px", height: "42px", background: "#3b82f6", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "18px" },
  name: { fontWeight: "bold", fontSize: "16px", color: "#1e293b" },
  id: { fontSize: "12px", color: "#94a3b8", fontFamily: "monospace" },
  
  statsRow: { display: "flex", justifyContent: "space-between", marginBottom: "15px", paddingBottom: "15px", borderBottom: "1px solid #f1f5f9" },
  stat: { display: "flex", flexDirection: "column" },
  statLabel: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "600" },
  statValue: { fontWeight: "bold", color: "#334155", fontSize: "15px" },
  
  badge: { fontSize: "12px", textAlign: "center", padding: "8px", borderRadius: "8px", fontWeight: "700" },

  // Pagination Styles
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: "15px", marginTop: "40px" },
  pageBtn: { padding: "8px 16px", border: "1px solid #cbd5e1", background: "white", borderRadius: "6px", cursor: "pointer", fontWeight: "600", color: "#475569" },
  pageInfo: { fontSize: "14px", color: "#64748b", fontWeight: "500" }
};

export default CustomerSearch;

// ==========================================
// START OF FILE: ./pages/ClientLogin.jsx
// ==========================================

// ==========================================
// FILE: src/pages/ClientLogin.jsx
// ==========================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ClientLogin = () => {
  const [custId, setCustId] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (custId.trim()) {
      // In a real app, you'd verify this ID against Firebase Auth or Firestore
      localStorage.setItem("client_id", custId);
      navigate('/portal/dashboard');
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", textAlign: "center", padding: "2rem", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
      <h1 style={{ color: "#FF6200" }}>Client Access</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>Enter your Customer ID to view your invoices.</p>
      
      <form onSubmit={handleLogin}>
        <input 
          type="text" 
          placeholder="Customer ID (e.g. 12345)" 
          value={custId}
          onChange={(e) => setCustId(e.target.value)}
          style={{ width: "100%", padding: "12px", marginBottom: "1rem", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <button 
          type="submit" 
          style={{ width: "100%", padding: "12px", background: "#4D148C", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
        >
          View My Invoices
        </button>
      </form>
    </div>
  );
};

export default ClientLogin;

// ==========================================
// START OF FILE: ./pages/SearchCase.jsx
// ==========================================

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase.js";
import { useNavigate } from "react-router-dom";

const SearchCase = () => {
  const [cases, setCases] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  
  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Change this to show more rows

  const navigate = useNavigate();

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const q = query(collection(db, "cases"), orderBy("last_predicted_at", "desc"));
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          list.push({
            id: doc.id,
            invoice_id: d.invoice_id || d.doc_id || doc.id,
            customer: d.company_name || d.name_customer || "Unknown",
            amount: Number(d.total_open_amount || d.invoice_amount || 0),
            status: d.isOpen == 1 ? "Open" : "Closed",
            zone: d.zone || "UNKNOWN"
          });
        });
        setCases(list);
      } catch (error) {
        console.error("Error fetching cases:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  // 1. FILTER Logic (Search)
  const filtered = cases.filter(c => 
    String(c.invoice_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(c.customer).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. PAGINATION Logic (Slice the filtered list)
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  // Handle Page Change
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Reset to Page 1 when searching
  const handleSearch = (e) => {
      setSearchTerm(e.target.value);
      setCurrentPage(1);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1>🔎 Invoice Search</h1>
        <p style={{color: '#64748b'}}>Find any case by Invoice ID or Customer Name.</p>
      </div>

      {/* SEARCH BAR */}
      <div style={styles.searchContainer}>
        <input 
          type="text" 
          placeholder="Type Invoice ID (e.g., 2960...) or Customer Name..." 
          value={searchTerm}
          onChange={handleSearch}
          style={styles.searchInput}
          autoFocus
        />
      </div>

      {/* RESULTS TABLE */}
      <div style={styles.results}>
        {loading ? (
           <div style={{textAlign: 'center', padding: 20}}>Loading invoices...</div>
        ) : (
           <>
             <div style={styles.countText}>
                Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filtered.length)} of {filtered.length} matches
             </div>
             
             <table style={styles.table}>
                <thead>
                    <tr style={{textAlign: 'left', color: '#64748b', fontSize: '13px', background: '#f8fafc'}}>
                        <th style={{padding: '12px'}}>Invoice ID</th>
                        <th style={{padding: '12px'}}>Customer</th>
                        <th style={{padding: '12px'}}>Amount</th>
                        <th style={{padding: '12px'}}>Status</th>
                        <th style={{padding: '12px'}}>Risk Zone</th>
                        <th style={{padding: '12px'}}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {currentItems.map(c => (
                        <tr key={c.id} style={styles.row}>
                            <td style={styles.td}><strong>#{c.invoice_id}</strong></td>
                            <td style={styles.td}>{c.customer}</td>
                            <td style={styles.td}>${c.amount.toLocaleString()}</td>
                            <td style={styles.td}>
                                <span style={{
                                    padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                                    background: c.status === 'Open' ? '#dbeafe' : '#f1f5f9',
                                    color: c.status === 'Open' ? '#1e40af' : '#64748b'
                                }}>
                                    {c.status}
                                </span>
                            </td>
                            <td style={styles.td}>
                                <span style={{
                                    padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
                                    background: c.zone === 'RED' ? '#fee2e2' : c.zone === 'ORANGE' ? '#ffedd5' : c.zone === 'YELLOW' ? '#fef9c3' : '#dcfce7',
                                    color: c.zone === 'RED' ? '#991b1b' : c.zone === 'ORANGE' ? '#9a3412' : c.zone === 'YELLOW' ? '#854d0e' : '#166534'
                                }}>
                                    {c.zone}
                                </span>
                            </td>
                            <td style={styles.td}>
                                <button onClick={() => navigate(`/admin/case/${c.id}`)} style={styles.btn}>
        View →
    </button>
                            </td>
                        </tr>
                    ))}
                    {currentItems.length === 0 && (
                        <tr>
                            <td colSpan="6" style={{padding: '20px', textAlign: 'center', color: '#94a3b8'}}>
                                No invoices found matching "{searchTerm}"
                            </td>
                        </tr>
                    )}
                </tbody>
             </table>

             {/* PAGINATION CONTROLS */}
             {filtered.length > itemsPerPage && (
                <div style={styles.pagination}>
                    <button 
                        onClick={() => paginate(currentPage - 1)} 
                        disabled={currentPage === 1}
                        style={{...styles.pageBtn, opacity: currentPage === 1 ? 0.5 : 1}}
                    >
                        Previous
                    </button>
                    
                    <span style={styles.pageInfo}>
                        Page {currentPage} of {totalPages}
                    </span>
                    
                    <button 
                        onClick={() => paginate(currentPage + 1)} 
                        disabled={currentPage === totalPages}
                        style={{...styles.pageBtn, opacity: currentPage === totalPages ? 0.5 : 1}}
                    >
                        Next
                    </button>
                </div>
             )}
           </>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: { width: "100%", padding: "40px 20px", boxSizing: "border-box", minHeight: "100vh" },
  header: { textAlign: "center", marginBottom: "30px" },
  searchContainer: { display: "flex", justifyContent: "center", marginBottom: "30px" },
  searchInput: { width: "100%", maxWidth: "600px", padding: "16px", fontSize: "16px", borderRadius: "30px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", outline: "none" },
  countText: { marginBottom: "10px", color: "#64748b", fontWeight: "600", fontSize: '13px', textAlign: 'right' },
  
  table: { width: "100%", borderCollapse: "collapse", background: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  row: { borderBottom: "1px solid #f1f5f9" },
  td: { padding: "14px 12px", fontSize: "14px", color: "#334155" },
  btn: { background: "none", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#475569" },

  // Pagination Styles
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: "15px", marginTop: "25px" },
  pageBtn: { padding: "8px 16px", border: "1px solid #cbd5e1", background: "white", borderRadius: "6px", cursor: "pointer", fontWeight: "600", color: "#475569" },
  pageInfo: { fontSize: "14px", color: "#64748b", fontWeight: "500" }
};

export default SearchCase;

// ==========================================
// START OF FILE: ./pages/PaymentPortal.jsx
// ==========================================

// ==========================================
// FILE: src/pages/PaymentPortal.jsx
// ==========================================

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "../firebase"; 
import Confetti from "react-confetti"; 

const PaymentPortal = () => {
  const { id } = useParams(); 
  const navigate = useNavigate(); // <--- Make sure this is here
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Payment States
  const [paymentMode, setPaymentMode] = useState("full"); 
  const [partialAmount, setPartialAmount] = useState("");
  const [status, setStatus] = useState("idle"); 

  useEffect(() => {
    // ... (Keep existing fetch logic)
    const fetchCase = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "cases", id));
        if (snap.exists()) {
          const data = snap.data();
          setCaseData(data);
          setPartialAmount(Math.floor(Number(data.total_open_amount) / 2));
        } else {
            alert("Invoice not found");
            navigate("/");
        }
      } catch (err) {
          console.error("Error fetching case:", err);
      } finally {
          setLoading(false);
      }
    };
    fetchCase();
  }, [id, navigate]);

  // ... (Keep handleFullPay and handlePartialPay logic exactly the same) ...
  const handleFullPay = async () => {
      // ... same code as before ...
      if (!window.confirm(`Confirm full payment of $${Number(caseData.total_open_amount).toLocaleString()}?`)) return;
      setStatus("processing");
      setTimeout(async () => {
        try {
          const caseRef = doc(db, "cases", id);
          await updateDoc(caseRef, {
            is_open_flag: false, isOpen: "0", status: "PAID", zone: "GREEN", action: "RESOLVED",
            payment_date: serverTimestamp(), amount_collected: caseData.total_open_amount, total_open_amount: 0,
            last_predicted_at: deleteField(), 
            history_logs: arrayUnion({
              date: new Date().toISOString(), action: "💳 Full Payment", outcome: "Success",
              note: `Full payment of $${Number(caseData.total_open_amount).toLocaleString()} received via Portal.`, status: "Closed"
            })
          });
          setStatus("success_full");
        } catch (err) { console.error(err); setStatus("idle"); }
      }, 1500);
  };

  const handlePartialPay = async (e) => {
      // ... same code as before ...
      e.preventDefault();
      const payAmount = Number(partialAmount);
      const totalDue = Number(caseData.total_open_amount);
      if (payAmount <= 0) return alert("Invalid amount");
      if (payAmount >= totalDue) return handleFullPay();

      setStatus("processing");
      const newBalance = totalDue - payAmount;
      setTimeout(async () => {
          try {
              const caseRef = doc(db, "cases", id);
              await updateDoc(caseRef, {
                  total_open_amount: newBalance, last_contacted_at: serverTimestamp(),
                  history_logs: arrayUnion({
                      date: new Date().toISOString(), action: "💸 Partial Payment", outcome: "In Progress",
                      note: `Partial payment of $${payAmount.toLocaleString()} received. Remaining: $${newBalance.toLocaleString()}`, status: "Open"
                  })
              });
              setCaseData(prev => ({ ...prev, total_open_amount: newBalance }));
              setStatus("success_partial");
          } catch (err) { console.error(err); setStatus("idle"); }
      }, 1500);
  };

  if (loading) return <div style={styles.loader}>Loading secure portal...</div>;
  if (!caseData) return null;

  // --- 👇 UPDATED SUCCESS SCREEN (FULL) ---
  if (status === "success_full") {
    return (
      <div style={styles.successContainer}>
        <Confetti numberOfPieces={300} recycle={false} />
        <div style={styles.successCard}>
            <div style={{fontSize: '60px', marginBottom: '20px'}}>🎉</div>
            <h1 style={styles.successTitle}>Payment Complete!</h1>
            <p style={styles.successText}>Thank you for settling Invoice #{caseData.invoice_id}.</p>
            <div style={styles.receiptBox}>
                <div style={styles.receiptRow}>
                    <span>Amount Paid</span>
                    <strong>${Number(caseData.total_open_amount).toLocaleString()}</strong>
                </div>
                <div style={styles.receiptRow}>
                    <span>Transaction ID</span>
                    <span>TXN-{Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                </div>
            </div>
            
            {/* 👇 FIXED BUTTON: Redirects instead of closing */}
            <button 
                onClick={() => navigate('/portal/dashboard')} 
                style={styles.closeBtn}
            >
                Return to Dashboard
            </button>
        </div>
      </div>
    );
  }

  // --- SUCCESS SCREEN (PARTIAL) ---
  if (status === "success_partial") {
    return (
      <div style={styles.successContainer}>
        <div style={styles.successCard}>
            <div style={{fontSize: '60px', marginBottom: '20px'}}>💸</div>
            <h1 style={styles.successTitle}>Payment Received</h1>
            <p style={styles.successText}>We have updated your balance for Invoice #{caseData.invoice_id}.</p>
            
            <div style={styles.receiptBox}>
                <div style={styles.receiptRow}>
                    <span>Amount Paid</span>
                    <strong style={{color: '#166534'}}>${Number(partialAmount).toLocaleString()}</strong>
                </div>
                <div style={{...styles.receiptRow, marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1'}}>
                    <span>Remaining Balance</span>
                    <strong style={{color: '#c2410c'}}>${Number(caseData.total_open_amount).toLocaleString()}</strong>
                </div>
            </div>

            <div style={styles.actions}>
                <button onClick={() => setStatus("idle")} style={styles.secondaryBtn}>Make Another Payment</button>
                {/* 👇 Added Return Button here too */}
                <button 
                    onClick={() => navigate('/portal/dashboard')} 
                    style={{...styles.secondaryBtn, background: '#f1f5f9', border: 'none'}}
                >
                    Return to Dashboard
                </button>
            </div>
        </div>
      </div>
    );
  }

  // --- MAIN PAYMENT UI (Same as before) ---
  const currentDue = Number(caseData.total_open_amount);

  return (
    <div style={styles.page}>
      <div style={styles.nav}>
         <span style={{fontWeight:'bold', fontSize:'1.2rem'}}>FedEx <span style={{fontWeight:'normal'}}>SecurePay</span></span>
         <span style={{fontSize:'0.9rem', opacity: 0.8}}>🔒 256-bit SSL Encrypted</span>
      </div>

      <div style={styles.mainGrid}>
         {/* LEFT COL */}
         <div style={styles.detailsCol}>
             <div style={styles.merchantInfo}>
                 <div style={styles.avatar}>{caseData.name_customer?.charAt(0) || "C"}</div>
                 <div>
                     <div style={styles.merchantLabel}>Paying to</div>
                     <div style={styles.merchantName}>FedEx Corporation</div>
                 </div>
             </div>

             <div style={styles.invoiceBox}>
                 <div style={styles.invLabel}>INVOICE DETAILS</div>
                 <h2 style={styles.invNumber}>#{caseData.invoice_id || id}</h2>
                 
                 <div style={styles.lineItem}>
                     <span>Customer</span>
                     <span>{caseData.name_customer}</span>
                 </div>
                 <div style={styles.lineItem}>
                     <span>Due Date</span>
                     <span>{caseData.due_date || "Immediate"}</span>
                 </div>
                 <div style={{...styles.lineItem, marginTop: '20px', fontSize: '1.2rem', fontWeight: 'bold', color: '#1f2937'}}>
                     <span>Total Due</span>
                     <span>${currentDue.toLocaleString()}</span>
                 </div>
             </div>
         </div>

         {/* RIGHT COL */}
         <div style={styles.paymentCol}>
             <h2 style={styles.payTitle}>Make a Payment</h2>
             <div style={styles.toggleContainer}>
                 <button style={{...styles.toggleBtn, ...(paymentMode === 'full' ? styles.toggleActive : {})}} onClick={() => setPaymentMode('full')}>Pay Full Amount</button>
                 <button style={{...styles.toggleBtn, ...(paymentMode === 'partial' ? styles.toggleActive : {})}} onClick={() => setPaymentMode('partial')}>Pay Partial Amount</button>
             </div>

             {paymentMode === 'full' ? (
                 <div style={styles.payContent}>
                     <div style={styles.bigAmount}>${currentDue.toLocaleString()}</div>
                     <p style={styles.helperText}>Pay the entire outstanding balance now.</p>
                     <button onClick={handleFullPay} disabled={status === 'processing'} style={styles.payBtnFull}>
                        {status === 'processing' ? 'Processing...' : `Pay $${currentDue.toLocaleString()}`}
                     </button>
                 </div>
             ) : (
                 <form onSubmit={handlePartialPay} style={styles.payContent}>
                     <label style={styles.label}>Enter Amount</label>
                     <div style={styles.inputWrapper}>
                        <span style={styles.currency}>$</span>
                        <input type="number" style={styles.input} value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} max={currentDue} min={1}/>
                     </div>
                     <p style={styles.helperText}>Remaining balance: <strong>${(currentDue - (Number(partialAmount) || 0)).toLocaleString()}</strong></p>
                     <button type="submit" disabled={status === 'processing'} style={styles.payBtnPartial}>
                         {status === 'processing' ? 'Processing...' : `Pay $${Number(partialAmount).toLocaleString()}`}
                     </button>
                 </form>
             )}
             <div style={styles.footer}><p>Powered by FedEx Digital Collections</p></div>
         </div>
      </div>
    </div>
  );
};

// ... (Keep existing styles) ...
const styles = {
  loader: { height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f8fafc", color: "#64748b" },
  page: { minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Inter', sans-serif" },
  nav: { background: "#4D148C", color: "white", padding: "16px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  mainGrid: { maxWidth: "900px", margin: "40px auto", display: "grid", gridTemplateColumns: "1fr 1.2fr", boxShadow: "0 10px 40px -10px rgba(0,0,0,0.1)", borderRadius: "16px", overflow: "hidden" },
  detailsCol: { background: "#fff", padding: "40px", borderRight: "1px solid #f1f5f9" },
  merchantInfo: { display: "flex", gap: "16px", alignItems: "center", marginBottom: "40px" },
  avatar: { width: "48px", height: "48px", background: "#FF6200", borderRadius: "12px", color: "white", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "24px", fontWeight: "bold" },
  merchantLabel: { fontSize: "12px", color: "#64748b", textTransform: "uppercase", fontWeight: "600" },
  merchantName: { fontSize: "16px", fontWeight: "bold", color: "#1e293b" },
  invoiceBox: { background: "#f8fafc", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" },
  invLabel: { fontSize: "11px", color: "#64748b", letterSpacing: "1px", fontWeight: "bold" },
  invNumber: { margin: "4px 0 20px 0", fontSize: "20px", color: "#334155" },
  lineItem: { display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "14px", color: "#475569" },
  paymentCol: { background: "#ffffff", padding: "40px", display: "flex", flexDirection: "column" },
  payTitle: { marginTop: 0, marginBottom: "24px", color: "#1e293b" },
  toggleContainer: { display: "flex", background: "#f1f5f9", padding: "4px", borderRadius: "8px", marginBottom: "30px" },
  toggleBtn: { flex: 1, padding: "10px", border: "none", background: "transparent", cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#64748b", borderRadius: "6px", transition: "all 0.2s" },
  toggleActive: { background: "white", color: "#4D148C", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" },
  payContent: { flex: 1 },
  bigAmount: { fontSize: "42px", fontWeight: "800", color: "#1e293b", marginBottom: "10px" },
  helperText: { color: "#64748b", fontSize: "14px", marginBottom: "30px" },
  payBtnFull: { width: "100%", padding: "16px", background: "#4D148C", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", marginTop: "auto" },
  payBtnPartial: { width: "100%", padding: "16px", background: "white", color: "#4D148C", border: "2px solid #4D148C", borderRadius: "8px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", marginTop: "auto" },
  label: { fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "8px", display: "block" },
  inputWrapper: { position: "relative", marginBottom: "10px" },
  currency: { position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: "18px" },
  input: { width: "100%", padding: "14px 14px 14px 30px", fontSize: "18px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box" },
  footer: { marginTop: "30px", textAlign: "center", fontSize: "12px", color: "#94a3b8" },
  successContainer: { height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f8fafc" },
  successCard: { background: "white", padding: "40px", borderRadius: "16px", boxShadow: "0 20px 50px rgba(0,0,0,0.1)", textAlign: "center", maxWidth: "400px", width: "90%" },
  successTitle: { fontSize: "24px", color: "#1e293b", margin: "0 0 10px 0" },
  successText: { color: "#64748b", marginBottom: "30px", lineHeight: "1.5" },
  receiptBox: { background: "#f1f5f9", padding: "20px", borderRadius: "12px", marginBottom: "30px" },
  receiptRow: { display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#475569", marginBottom: "8px" },
  closeBtn: { width: "100%", padding: "12px", background: "#1e293b", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  secondaryBtn: { width: "100%", padding: "12px", background: "white", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", flex: 1 },
  actions: { display: 'flex', gap: '10px', marginTop: '20px' }
};

export default PaymentPortal;

// ==========================================
// START OF FILE: ./utils/zones.jsx
// ==========================================

export function getZone({
  due_date,
  SLA_date,
  predicted_clear_date,
  today, // 👈 injected reference date
}) {
  // Safety checks
  if (!due_date || !SLA_date || !predicted_clear_date || !today) {
    return "UNKNOWN";
  }

  const due = new Date(due_date);
  const sla = new Date(SLA_date);
  const predicted = new Date(predicted_clear_date);
  const now = new Date(today);

  if (
    isNaN(due.getTime()) ||
    isNaN(sla.getTime()) ||
    isNaN(predicted.getTime()) ||
    isNaN(now.getTime())
  ) {
    return "UNKNOWN";
  }

  // 🟢 PRE-DUE
  if (now < due) {
    return "GREEN";
  }

  // 🟡 POST-DUE, EXPECTED BEFORE SLA
  if (
    now >= due &&
    now < predicted &&
    predicted <= sla
  ) {
    return "YELLOW";
  }

  // 🟠 WILL BREACH SLA
  if (
    now < sla &&
    predicted > sla
  ) {
    return "ORANGE";
  }

  // 🔴 SLA BREACHED
  if (now >= sla) {
    return "RED";
  }

  return "UNKNOWN";
}


// ==========================================
// START OF FILE: ./components/AddCaseModal.jsx
// ==========================================

import { useState, useEffect, useRef } from "react";
import { collection, addDoc, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";

const AddCaseModal = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [existingCompanies, setExistingCompanies] = useState([]);
  
  // --- NEW: Search States ---
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const wrapperRef = useRef(null); // To handle clicking outside

  const [formData, setFormData] = useState({
    invoice_id: "",
    customer_name: "",
    amount: "",
    due_date: ""
  });

  const deriveSlaDays = (lateRatio) => {
    if (typeof lateRatio !== 'number') return 15;
    if (lateRatio >= 0.8) return 3;
    else if (lateRatio >= 0.5) return 5;
    else if (lateRatio >= 0.2) return 10;
    else return 15;
  };

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const snapshot = await getDocs(collection(db, "company_features"));
        const list = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.company_name) {
                list.push({ 
                    id: doc.id, 
                    name: data.company_name,
                    late_payment_ratio: data.late_payment_ratio || 0 
                });
            }
        });
        setExistingCompanies(list);
        setFilteredCompanies(list); // Initialize filtered list
      } catch (err) {
        console.error("Error loading companies:", err);
      }
    };
    fetchCompanies();
  }, []);

  // --- NEW: Close dropdown if clicked outside ---
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // --- NEW: Handle Input Change & Filtering ---
  const handleNameChange = (e) => {
    const val = e.target.value;
    setFormData({ ...formData, customer_name: val });
    
    // Filter the list based on typing
    const matches = existingCompanies.filter(c => 
        c.name.toLowerCase().includes(val.toLowerCase())
    );
    setFilteredCompanies(matches);
    setShowSuggestions(true);
  };

  // --- NEW: Handle Selection from Dropdown ---
  const selectCompany = (name) => {
    setFormData({ ...formData, customer_name: name });
    setShowSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanName = formData.customer_name.trim();
      
      const match = existingCompanies.find(
          c => c.name.toLowerCase() === cleanName.toLowerCase()
      );

      let finalCustNumber = "";
      let currentLateRatio = 0.0;

      if (match) {
          finalCustNumber = match.id;
          currentLateRatio = match.late_payment_ratio;
      } else {
          finalCustNumber = `MANUAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`; 
          const default_company = {
            avg_due_days: 30, avg_payment_delay: 0, std_payment_delay: 0,
            avg_days_to_clear: 30, avg_invoice_amount: 0, transaction_count: 0, 
            late_payment_ratio: 0.0, company_name: cleanName, cust_number: finalCustNumber
          };
          await setDoc(doc(db, "company_features", finalCustNumber), default_company);
      }

      const calculatedSlaDays = deriveSlaDays(currentLateRatio);
      const slaDateObj = new Date();
      slaDateObj.setDate(slaDateObj.getDate() + calculatedSlaDays);
      const slaDateString = slaDateObj.toISOString().split('T')[0];
      const amountVal = Number(formData.amount);
      await addDoc(collection(db, "cases"), {
        invoice_id: formData.invoice_id,
        name_customer: cleanName,
        cust_number: finalCustNumber,
        total_open_amount: amountVal,
        original_amount: amountVal,
        due_date: formData.due_date,
        document_create_date: new Date().toISOString().split('T')[0],
        predicted_delay: 0.0,
        predicted_payment_date: null,
        sla_days: parseInt(calculatedSlaDays),
        sla_date: slaDateString, 
        zone: "GREEN",
        action: "NO_ACTION",
        escalated: false,
        late_payment_ratio: Number(currentLateRatio),
        last_predicted_at: serverTimestamp(),
        is_open_flag: true,
        isOpen: '1'
      });

      alert(`Success! Added invoice for ${cleanName}`);
      onClose();
    } catch (err) {
      console.error("Error adding case:", err);
      alert("Failed to add case.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3>📝 Manually Log New Case</h3>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            <label style={styles.label}>Invoice ID</label>
            <input 
              required 
              style={styles.input}
              value={formData.invoice_id}
              onChange={e => setFormData({...formData, invoice_id: e.target.value})}
              placeholder="#INV-2024-001"
            />
          </div>

          <div style={styles.row}>
            <label style={styles.label}>Customer Name</label>
            
            {/* --- CUSTOM DROPDOWN WRAPPER --- */}
            <div style={{ position: "relative" }} ref={wrapperRef}>
                <input 
                  required 
                  style={styles.input}
                  value={formData.customer_name}
                  onChange={handleNameChange}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Start typing to search..."
                  autoComplete="off"
                />
                
                {/* --- CUSTOM DROPDOWN LIST --- */}
                {showSuggestions && filteredCompanies.length > 0 && (
                    <ul style={styles.dropdownList}>
                        {filteredCompanies.map((c) => (
                            <li 
                                key={c.id} 
                                onClick={() => selectCompany(c.name)}
                                style={styles.dropdownItem}
                            >
                                {c.name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
          </div>

          <div style={styles.grid}>
            <div style={styles.row}>
                <label style={styles.label}>Amount ($)</label>
                <input 
                  type="number"
                  required 
                  style={styles.input}
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                />
            </div>
            <div style={styles.row}>
                <label style={styles.label}>Due Date</label>
                <input 
                  type="date"
                  required 
                  style={styles.input}
                  value={formData.due_date}
                  onChange={e => setFormData({...formData, due_date: e.target.value})}
                />
            </div>
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? "Processing..." : "Add Case"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modal: { background: "white", padding: "24px", borderRadius: "12px", width: "400px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  closeBtn: { background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#64748b" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  row: { display: "flex", flexDirection: "column", gap: "6px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  label: { fontSize: "13px", fontWeight: "600", color: "#475569" },
  input: { padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", width: "100%", boxSizing: 'border-box' }, // Added boxSizing
  actions: { display: "flex", gap: "12px", marginTop: "10px" },
  cancelBtn: { flex: 1, padding: "10px", background: "none", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontWeight: "600" },
  submitBtn: { flex: 1, padding: "10px", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" },
  
  // --- NEW STYLES FOR DROPDOWN ---
  dropdownList: {
    position: "absolute",
    top: "100%", // Pushes it directly below input
    left: 0,
    right: 0,
    background: "white",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    maxHeight: "150px",
    overflowY: "auto",
    zIndex: 10,
    listStyle: "none",
    padding: 0,
    margin: "4px 0 0 0",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
  },
  dropdownItem: {
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: "14px",
    color: "#334155",
    borderBottom: "1px solid #f1f5f9"
  }
};

export default AddCaseModal;

// ==========================================
// START OF FILE: ./components/CashForecast.jsx
// ==========================================

import React from 'react';

const CashForecast = ({ cases }) => {
  // 1. Setup Buckets
  let thisWeekSum = 0;
  let nextWeekSum = 0;
  let totalPipeline = 0;
  
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7); // 7 days from now

  // 2. Process Data
  cases.forEach(c => {
    // Only look at OPEN cases that have a valid prediction
    // We check for 'is_open_flag' or fallback logic (amount > 0)
    const isOpen = c.isOpen !== '0' && c.outstanding_amount > 0;
    
    if (isOpen && c.predicted_payment_date && c.predicted_payment_date !== "—") {
      const pDate = new Date(c.predicted_payment_date);
      const amount = Number(c.outstanding_amount || 0);

      totalPipeline += amount;

      // Bucket Logic
      if (pDate <= nextWeek) {
        thisWeekSum += amount;
      } else {
        nextWeekSum += amount;
      }
    }
  });

  // 3. Render Widget
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h3 style={styles.title}>💰 AI Cash Flow Projection</h3>
        <span style={styles.badge}>Next 7 Days</span>
      </div>
      
      {/* Primary Number: This Week */}
      <div style={styles.primaryBlock}>
        <div style={styles.label}>CLEARING THIS WEEK</div>
        <div style={styles.bigNumber}>
          ${thisWeekSum.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
        </div>
        <div style={styles.subText}>
          Based on {cases.length} active predictions
        </div>
      </div>

      {/* Secondary Number: Later */}
      <div style={styles.secondaryBlock}>
        <div style={styles.row}>
            <span style={styles.label}>Pipeline (Later)</span>
            <span style={styles.value}>${nextWeekSum.toLocaleString()}</span>
        </div>
        <div style={styles.progressBarBg}>
            {/* Visual bar showing how much is coming this week vs total */}
            <div style={{
                ...styles.progressBarFill, 
                width: `${(thisWeekSum / (totalPipeline || 1)) * 100}%`
            }}></div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  card: { background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: '700' },
  badge: { fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontWeight: '600' },
  
  primaryBlock: { marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' },
  label: { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' },
  bigNumber: { fontSize: '32px', fontWeight: '800', color: '#059669', margin: '4px 0' },
  subText: { fontSize: '12px', color: '#94a3b8' },

  secondaryBlock: { display: 'flex', flexDirection: 'column', gap: '8px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  value: { fontWeight: '600', color: '#475569' },
  
  progressBarBg: { height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' },
  progressBarFill: { height: '100%', background: '#059669', borderRadius: '3px' }
};

export default CashForecast;

// ==========================================
// START OF FILE: ./components/AiBot.jsx
// ==========================================

import { useState, useEffect } from "react";
import Spline from "@splinetool/react-spline";

const AiBot = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [message, setMessage] = useState("System Online.");

  useEffect(() => {
    const insights = [
      "📢 Tip: Click 'Analytics' for charts.",
      "⚠️ Alert: 3 High Risk accounts.",
      "✅ Success: Payment from Costco.",
      "📉 Risk dropped by 12%."
    ];
    let i = 0;
    const interval = setInterval(() => {
      setMessage(insights[i]);
      i = (i + 1) % insights.length;
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', 
        pointerEvents: 'none', 
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}
    >
      
      {/* 💬 CHAT BUBBLE */}
      <div 
        className={`
            relative mb-2 text-center 
            pointer-events-auto transition-all duration-500 ease-in-out
            shadow-sm border border-blue-100
            ${isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"}
        `}
        style={{ 
            animation: 'float 4s ease-in-out infinite',
            backgroundColor: '#F0F9FF', 
            color: '#0c4a6e',           
            borderRadius: '16px',
            minWidth: '160px', 
            maxWidth: '200px',
            padding: '10px 14px', 
        }}
      >
           {/* 🟢 NEW GREETING LINE */}
           <div className="text-[12px] font-bold text-slate-800 mb-1">
             Hi, I'm Feddie! 👋
           </div>

           {/* HEADER ROW (Centered) */}
           <div className="flex items-center justify-center w-full mb-2">
             <div className="flex items-center gap-1.5 bg-blue-100/50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                <span className="text-[7px] font-extrabold uppercase tracking-widest text-blue-600 opacity-90 whitespace-nowrap">AI Insight</span>
             </div>
           </div>

           {/* Message Body */}
           <p className="text-[10px] font-medium leading-relaxed text-slate-600">
             {message}
           </p>

           {/* 👇 The Tail */}
           <div 
             style={{ 
                position: 'absolute',
                bottom: '-4px',
                left: '50%',
                transform: 'translate(-50%) rotate(45deg)',
                width: '8px',
                height: '8px',
                backgroundColor: '#F0F9FF', 
                borderBottom: '1px solid #e0f2fe',
                borderRight: '1px solid #e0f2fe',
                borderRadius: '0 0 1px 0',
             }}
           ></div>
      </div>

      {/* 🤖 ROBOT CONTAINER */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="group hover:scale-105 transition-transform duration-300"
        style={{
          width: '180px',    
          height: '180px',   
          cursor: 'pointer',
          pointerEvents: 'auto',
          position: 'relative',
          overflow: 'hidden', 
          borderRadius: '50%',
        }}
      >
        {/* 🔍 ZOOM WRAPPER */}
        <div style={{
            position: 'absolute',
            width: '170%',      
            height: '170%',
            top: '-35%',        
            left: '-35%',       
        }}>
            <Spline 
              scene="https://prod.spline.design/6gxFy1AjbR2-yc6w/scene.splinecode"
              style={{ 
                width: '100%', 
                height: '100%',
                backgroundColor: 'transparent', 
              }}
            />
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
          100% { transform: translateY(0px); }
        }
      `}</style>

    </div>
  );
};

export default AiBot;

// ==========================================
// START OF FILE: ./components/CaseTable.jsx
// ==========================================

import React from "react";
import { useNavigate } from "react-router-dom";

const ZoneBadge = ({ zone }) => {
  const colors = {
    GREEN: "#27ae60",
    YELLOW: "#f1c40f",
    ORANGE: "#e67e22",
    RED: "#c0392b",
    UNKNOWN: "#95a5a6",
  };

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 12,
        background: colors[zone] || colors.UNKNOWN,
        color: "#fff",
        fontSize: 11,
        fontWeight: "bold",
        textTransform: "uppercase",
      }}
    >
      {zone}
    </span>
  );
};

const CaseTable = ({ cases = [] }) => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      background: "#fff", 
      borderRadius: 8, 
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      overflow: "hidden" 
    }}>
      <table width="100%" style={{ borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #eee" }}>
            <th align="left" style={{ padding: "12px 16px", color: "#666" }}>Customer</th>
            <th align="left" style={{ padding: "12px 16px", color: "#666" }}>Invoice ID</th>
            <th align="right" style={{ padding: "12px 16px", color: "#666" }}>Amount</th>
            <th align="right" style={{ padding: "12px 16px", color: "#666" }}>Pred. Delay</th>
            <th align="center" style={{ padding: "12px 16px", color: "#666" }}>Zone</th>
          </tr>
        </thead>

        <tbody>
          {cases.length === 0 ? (
            <tr>
              <td colSpan="5" align="center" style={{ padding: 24, color: "#999" }}>
                No cases found for this filter.
              </td>
            </tr>
          ) : (
            cases.map((c) => {
              const delay = c.predicted_delay !== null ? Math.round(c.predicted_delay) : null;
              
              return (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/admin/case/${c.id}`)}
                  style={{
                    borderBottom: "1px solid #eee",
                    cursor: "pointer",
                    transition: "background 0.1s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px 16px", fontWeight: 500 }}>
                    {c.company_name}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#666" }}>
                    #{c.invoice_id}
                  </td>
                  <td align="right" style={{ padding: "12px 16px", fontFamily: "monospace" }}>
                    ₹{c.invoice_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td align="right" style={{ padding: "12px 16px" }}>
                    {delay === null ? "—" : (
                      <span style={{ color: delay > 5 ? "#e74c3c" : "#27ae60", fontWeight: 600 }}>
                        {delay > 0 ? `+${delay} days` : `${delay} days`}
                      </span>
                    )}
                  </td>
                  <td align="center" style={{ padding: "12px 16px" }}>
                    <ZoneBadge zone={c.zone} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CaseTable;

// ==========================================
// START OF FILE: ./components/CallsOverview.jsx
// ==========================================

import React from "react";

const CallsOverview = ({ cases = [] }) => {
  // Logic: "Promise to Pay" candidates are those we need to call, 
  // but ML predicts they will pay soon (e.g. within 5 days), 
  // so the conversation is likely positive.
  const likelyToPaySoon = cases.filter(c => 
    c.predicted_delay !== null && c.predicted_delay <= 5
  ).length;


  return (
    <div
      style={{
        background: "#fff",
        padding: 20,
        borderRadius: 14,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>📞 Today's Call List</h3>

      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {/* Metric 1 */}
        <div style={{ flex: 1, textAlign: "center", background: "#f8f9fa", padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#2c3e50" }}>{cases.length}</div>
          <div style={{ fontSize: 11, color: "#777", textTransform: "uppercase" }}>Total Calls</div>
        </div>

        {/* Metric 2 */}
        <div style={{ flex: 1, textAlign: "center", background: "#e8f6f3", padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#27ae60" }}>{likelyToPaySoon}</div>
          <div style={{ fontSize: 11, color: "#27ae60", textTransform: "uppercase" }}>Likely to Pay</div>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#555" }}>
        Prioritized List
      </div>

      {cases.length === 0 ? (
        <div style={{ fontSize: 13, color: "#999" }}>No calls required right now.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {cases.slice(0, 5).map((c) => (
            <li key={c.id} style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div 
                style={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: "50%", 
                  background: c.predicted_delay > 10 ? "#e74c3c" : "#f1c40f",
                  marginRight: 10 
                }} 
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.company_name}</div>
                <div style={{ fontSize: 11, color: "#777" }}>Pred: {Math.round(c.predicted_delay)}d late</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                ₹{(c.invoice_amount / 1000).toFixed(1)}k
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CallsOverview;

// ==========================================
// START OF FILE: ./components/ZoneSummary.jsx
// ==========================================

const ZONE_COLORS = {
  GREEN: "#2ecc71",
  YELLOW: "#f1c40f",
  ORANGE: "#e67e22",
  RED: "#e74c3c",
};

const ZoneSummary = ({ cases }) => {
  const zones = ["GREEN", "YELLOW", "ORANGE", "RED"];

  const stats = zones.map((zone) => {
    const filtered = cases.filter((c) => c.zone === zone);
    const count = filtered.length;

    const amount = filtered.reduce(
      (sum, c) => sum + (c.total_open_amount || 0),
      0
    );

    return { zone, count, amount };
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
        margin: "24px 0 40px",
      }}
    >
      {stats.map(({ zone, count, amount }) => (
        <div
          key={zone}
          style={{
            padding: 20,
            borderRadius: 14,
            background: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            borderLeft: `6px solid ${ZONE_COLORS[zone]}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#666",
              marginBottom: 6,
            }}
          >
            {zone}
          </div>

          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            {count}
          </div>

          <div
            style={{
              fontSize: 13,
              color: "#888",
            }}
          >
            ₹{amount.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ZoneSummary;


// ==========================================
// START OF FILE: ./components/SlaBreachList.jsx
// ==========================================

import React from "react";

const SlaBreachList = ({ cases = [] }) => {
  const count = cases.length;

  return (
    <div
      style={{
        background: "#fff",
        padding: 20,
        borderRadius: 14,
        boxShadow: "0 4px 12px rgba(231, 76, 60, 0.1)",
        borderLeft: "5px solid #e74c3c",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: "#e74c3c", fontSize: 16 }}>
          🚨 SLA Breaches
        </h3>
        <span style={{ 
          background: "#e74c3c", 
          color: "white", 
          padding: "2px 8px", 
          borderRadius: 10, 
          fontSize: 12, 
          fontWeight: "bold" 
        }}>
          {count}
        </span>
      </div>

      {count === 0 ? (
        <div style={{ fontSize: 13, color: "#777", fontStyle: "italic" }}>
          ✅ All clear. No escalations.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {cases.slice(0, 5).map((c) => (
            <li 
              key={c.id} 
              style={{ 
                marginBottom: 12, 
                paddingBottom: 12, 
                borderBottom: "1px solid #f0f0f0" 
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <strong style={{ fontSize: 14 }}>{c.company_name}</strong>
                <span style={{ fontSize: 13, fontWeight: 600 }}>₹{c.invoice_amount.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666" }}>
                <span>Breach: {c.sla_date || "Unknown"}</span>
                <span style={{ color: "#e74c3c" }}>Escalated</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      
      {count > 5 && (
        <div style={{ textAlign: "center", fontSize: 12, color: "#999", marginTop: 8 }}>
          + {count - 5} more cases
        </div>
      )}
    </div>
  );
};

export default SlaBreachList;

// ==========================================
// START OF FILE: ./components/DashboardCharts.jsx
// ==========================================

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

const DashboardCharts = () => {
  const [data, setData] = useState({ risk: [], topDebtors: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 1. Fetch only OPEN cases
        const q = query(collection(db, "cases"), where("isOpen", "==", '1'));
        const snapshot = await getDocs(q);
        
        const zoneCounts = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
        const debtorMap = {};

        snapshot.forEach(doc => {
          const d = doc.data();
          const amount = Number(d.total_open_amount || 0);
          
          // A. Risk Counts
          const zone = d.zone || "GREEN";
          if (zoneCounts[zone] !== undefined) zoneCounts[zone]++;

          // B. Debtor Aggregation
          const name = d.name_customer || d.company_name || "Unknown";
          if (!debtorMap[name]) debtorMap[name] = 0;
          debtorMap[name] += amount;
        });

        // --- FIXED: SEPARATED ORANGE AND RED ---
        const riskData = [
          { name: "Safe (Green)", value: zoneCounts.GREEN, color: "#10b981" },       // Emerald
          { name: "Watch (Yellow)", value: zoneCounts.YELLOW, color: "#f59e0b" },    // Amber
          { name: "Priority (Orange)", value: zoneCounts.ORANGE, color: "#f97316" }, // Orange
          { name: "Critical (Red)", value: zoneCounts.RED, color: "#ef4444" },       // Red
        ].filter(d => d.value > 0);

        // Format for Bar Chart (Top 5)
        const topDebtors = Object.entries(debtorMap)
          .map(([name, amount]) => ({ name: name.substring(0, 10) + '..', fullName: name, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        setData({ risk: riskData, topDebtors });
      } catch (err) {
        console.error("Error loading charts:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div style={styles.loading}>Loading Analytics...</div>;

  return (
    <div style={styles.container}>
      
      {/* CHART 1: RISK EXPOSURE */}
      <div style={styles.card}>
        <h3 style={styles.title}>🛡️ Portfolio Risk</h3>
        <div style={{ width: "100%", height: 250 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data.risk}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.risk.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} Cases`, "Count"]} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CHART 2: TOP DEBTORS */}
      <div style={styles.card}>
        <h3 style={styles.title}>💰 Top 5 Highest Balances</h3>
        <div style={{ width: "100%", height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={data.topDebtors} layout="vertical" margin={{left: 10, right: 30}}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={80} style={{fontSize: '11px'}} />
              <Tooltip 
                cursor={{fill: '#f1f5f9'}}
                formatter={(value) => [`$${value.toLocaleString()}`, "Debt"]}
                labelFormatter={(label, payload) => payload[0]?.payload.fullName}
              />
              <Bar dataKey="amount" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

const styles = {
  container: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "30px" },
  card: { background: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" },
  title: { margin: "0 0 20px 0", fontSize: "16px", color: "#1e293b", fontWeight: "600" },
  loading: { padding: "20px", color: "#64748b", fontSize: "14px", fontStyle: "italic" }
};

export default DashboardCharts;

// ==========================================
// START OF FILE: ./components/Navbar.jsx
// ==========================================

import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <nav style={styles.nav}>
      <div style={styles.logo}>
        <Link to="/" style={{ textDecoration: "none", color: "white" }}>
          🤖 FedEx DCA <span style={styles.badge}>AI SYSTEM</span>
        </Link>
      </div>
      <div style={styles.links}>
        {/* 👇 UPDATED PATHS: Added /admin prefix */}
        <Link to="/admin/dashboard" style={styles.link}>
          Dashboard
        </Link>
        <Link to="/admin/escalation" style={{ ...styles.link, color: "#f87171" }}>
          🚨 Escalations
        </Link>
        
        <Link to="/admin/analytics" style={styles.link}>
          📊 Analytics
        </Link>
        <Link to="/admin/customers" style={styles.link}>
          Customers
        </Link>
        <Link to="/admin/ai-logs" style={styles.link}>
          ⚡ AI Logs
        </Link>
        <Link to="/admin/search" style={styles.link}>
          Search Case
        </Link>
        <div style={styles.divider}>|</div>
        <span style={styles.user}>Admin View</span>
      </div>
    </nav>
  );
};

// ... keep existing styles ...
const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 40px",
    backgroundColor: "#1e293b",
    color: "white",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    position: "sticky",
    top: 0,
    zIndex: 100, 
  },
  logo: { fontSize: "20px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px" },
  badge: { fontSize: "10px", backgroundColor: "#3b82f6", padding: "2px 6px", borderRadius: "4px", letterSpacing: "1px", marginLeft: "8px" },
  links: { display: "flex", gap: "20px", alignItems: "center", fontSize: "14px" },
  link: { color: "#e2e8f0", textDecoration: "none", fontWeight: "500", transition: "color 0.2s" },
  divider: { color: "#475569" },
  user: { color: "#94a3b8" },
};

export default Navbar;

