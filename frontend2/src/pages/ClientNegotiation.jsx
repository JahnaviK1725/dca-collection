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