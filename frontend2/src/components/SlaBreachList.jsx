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