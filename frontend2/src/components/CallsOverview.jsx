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