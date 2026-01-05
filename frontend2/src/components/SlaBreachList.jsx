const SlaBreachList = ({ cases }) => {
  const count = cases.length;

  return (
    <div
      style={{
        background: "#fff",
        padding: 20,
        borderRadius: 14,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        borderLeft: "4px solid #e74c3c",
        position: "sticky",
        top: 20,
      }}
    >
      <h3 style={{ marginBottom: 12, color: "#e74c3c" }}>
        🚨 SLA Breaches
      </h3>

      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        {count}
      </div>

      {count === 0 ? (
        <div style={{ fontSize: 14, color: "#777" }}>
          ✅ No SLA breaches detected
        </div>
      ) : (
        <>
          <ul style={{ paddingLeft: 16 }}>
            {cases.slice(0, 5).map((c) => (
              <li key={c.id} style={{ marginBottom: 6 }}>
                <strong>{c.name_customer}</strong> — ₹
                {c.total_open_amount.toLocaleString()}
              </li>
            ))}
          </ul>

          {count > 5 && (
            <div style={{ fontSize: 12, color: "#777" }}>
              Showing top 5 breached cases
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SlaBreachList;
