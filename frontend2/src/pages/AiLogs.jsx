import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const AiLogs = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Query the NEW 'ai_logs' collection we created in the python script
    const q = query(collection(db, "ai_logs"), orderBy("timestamp", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data);
    });

    return () => unsubscribe();
  }, []);

  // Split into columns
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
            <span style={{ fontSize: "20px" }}>📞 Scheduled Calls</span>
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
                <div style={styles.bodyPreview}>
                   {log.content}
                </div>
                <div style={{...styles.status, color: '#f97316', background: '#ffedd5'}}>
                    ⏳ Queued for Agent
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