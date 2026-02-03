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