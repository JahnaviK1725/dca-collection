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
