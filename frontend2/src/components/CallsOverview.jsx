const CallsOverview = ({ calls = [] }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /* ======================
     METRICS
  ====================== */

  const callsToday = calls.filter((c) => {
    const t = new Date(c.timestamp);
    t.setHours(0, 0, 0, 0);
    return t.getTime() === today.getTime();
  }).length;

  const pendingFollowUps = calls.filter(
    (c) =>
      c.nextActionDate &&
      new Date(c.nextActionDate) < new Date()
  ).length;

  const promiseToPay = calls.filter(
    (c) => c.outcome === "PROMISE_TO_PAY"
  ).length;

  const recentCalls = [...calls]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);

  /* ======================
     UI
  ====================== */

  return (
    <div
      style={{
        background: "#fff",
        padding: 20,
        borderRadius: 14,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        marginBottom: 32,
      }}
    >
      <h3 style={{ marginBottom: 16 }}>📞 Calls Overview</h3>

      {/* METRICS ROW */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <Metric label="Calls Today" value={callsToday} />
        <Metric label="Pending Follow-ups" value={pendingFollowUps} />
        <Metric label="Promise to Pay" value={promiseToPay} />
      </div>

      {/* RECENT CALLS */}
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 8,
            color: "#555",
          }}
        >
          Recent Calls
        </div>

        {recentCalls.length === 0 ? (
          <div style={{ fontSize: 13, color: "#777" }}>
            No calls logged yet
          </div>
        ) : (
          <ul style={{ paddingLeft: 16 }}>
            {recentCalls.map((c) => (
              <li key={c.id} style={{ marginBottom: 6 }}>
                <strong>{c.customer}</strong> —{" "}
                <OutcomePill outcome={c.outcome} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/* ======================
   SUB COMPONENTS
====================== */

const Metric = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 12, color: "#777" }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
  </div>
);

const OutcomePill = ({ outcome }) => {
  const colors = {
    CONNECTED: "#3498db",
    PROMISE_TO_PAY: "#2ecc71",
    NO_ANSWER: "#f1c40f",
    DISPUTED: "#e67e22",
  };

  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 12,
        background: colors[outcome] || "#ccc",
        color: "#fff",
        fontSize: 11,
        marginLeft: 6,
      }}
    >
      {outcome.replaceAll("_", " ")}
    </span>
  );
};

export default CallsOverview;
