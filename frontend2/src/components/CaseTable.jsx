const ZoneBadge = ({ zone }) => {
  const colors = {
    GREEN: "#2ecc71",
    YELLOW: "#f1c40f",
    ORANGE: "#e67e22",
    RED: "#e74c3c",
    UNKNOWN: "#95a5a6",
  };

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 12,
        background: colors[zone],
        color: "#fff",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {zone}
    </span>
  );
};

const CaseTable = ({ cases }) => {
  return (
    <table width="100%" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#f4f6f8" }}>
          <th align="left">Invoice</th>
          <th align="left">Customer</th>
          <th align="right">Amount</th>
          <th align="right">Days Overdue</th>
          <th align="center">Zone</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => (
          <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
            <td>{c.invoice_id}</td>
            <td>{c.name_customer}</td>
            <td align="right">₹{c.total_open_amount.toFixed(2)}</td>
            <td align="right">{c.daysOverdue}</td>
            <td align="center">
              <ZoneBadge zone={c.zone} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default CaseTable;
