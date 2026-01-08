import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, deleteField } from "firebase/firestore";
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
  // eslint-disable-next-line no-unused-vars
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



  useEffect(() => {
    const fetchCase = async () => {
      try {
        const ref = doc(db, "cases", id);
        const snap = await getDoc(ref);
        if (snap.exists()) setCaseData(snap.data());
      } catch (err) {
        console.error("Error fetching case:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCase();
  }, [id]);

  const handleCloseCase = async () => {
    if (!window.confirm("Mark this case as resolved/closed?")) return;
    setClosing(true);
    const ref = doc(db, "cases", id);
    updateDoc(ref, {
        isOpen: '0',
        is_open_flag: false,
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
                
                {/* CALL ACTION (Orange/Red) */}
                {caseData.action === 'CALL' && (
                   <div style={styles.actionRow}>
                        <div style={styles.actionIcon}>📞</div>
                        <div>
                            <strong>Call Customer Immediately</strong>
                            <p style={styles.actionSub}>Talking points: "We see a potential delay past [SLA Date]. Can we expedite?"</p>
                        </div>
                   </div>
                )}

                {/* ✨ MAIL ACTION WITH AI DRAFTER (Yellow) ✨ */}
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
                                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', // Purple Gradient
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

                {/* NO ACTION (Green) */}
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
                    <span>Total Amount</span>
                    <span style={styles.statValue}>
                        {caseData.invoice_currency || 'USD'} {Number(caseData.total_open_amount).toLocaleString()}
                    </span>
                </div>
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
                      to={`/customer/${caseData.cust_number || caseData.customer_id}`} 
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

            {/* 3. ACTIVITY LOG */}
            <div style={styles.card}>
                <div style={styles.cardHeaderRow}>
                    <h3 style={styles.cardTitleNoBottom}>📜 Activity Log</h3>
                    <button style={styles.addBtn}>+ Log Call</button>
                </div>
                <div style={styles.logList}>
                    {/* 👇 CHANGED: Read from Firestore data & Sort Newest First */}
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
                                        // 🤖 Purple Text for AI
                                        color: log.action.includes("AI") ? '#7c3aed' : '#111827' 
                                    }}>
                                        {/* 🤖 Robot Icon for AI */}
                                        {log.action.includes("AI") ? "⚡ " : ""} 
                                        {log.action}
                                    </span>
                                    
                                    <span style={{
                                        ...styles.statusBadge, 
                                        // 🤖 Purple Badge for AI
                                        backgroundColor: log.action.includes("AI") ? '#f3e8ff' : '#f3f4f6',
                                        color: log.action.includes("AI") ? '#7e22ce' : '#4b5563',
                                        border: log.action.includes("AI") ? '1px solid #d8b4fe' : 'none'
                                    }}>
                                        {log.status || log.outcome}
                                    </span>
                                </div>
                                {/* 🤖 Monospace Font for System Notes */}
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
                    
                    {/* Fallback if no logs exist */}
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