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