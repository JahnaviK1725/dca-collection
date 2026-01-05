export function getZone({
  due_date,
  SLA_date,
  predicted_clear_date,
  today, // 👈 injected reference date
}) {
  // Safety checks
  if (!due_date || !SLA_date || !predicted_clear_date || !today) {
    return "UNKNOWN";
  }

  const due = new Date(due_date);
  const sla = new Date(SLA_date);
  const predicted = new Date(predicted_clear_date);
  const now = new Date(today);

  if (
    isNaN(due.getTime()) ||
    isNaN(sla.getTime()) ||
    isNaN(predicted.getTime()) ||
    isNaN(now.getTime())
  ) {
    return "UNKNOWN";
  }

  // 🟢 PRE-DUE
  if (now < due) {
    return "GREEN";
  }

  // 🟡 POST-DUE, EXPECTED BEFORE SLA
  if (
    now >= due &&
    now < predicted &&
    predicted <= sla
  ) {
    return "YELLOW";
  }

  // 🟠 WILL BREACH SLA
  if (
    now < sla &&
    predicted > sla
  ) {
    return "ORANGE";
  }

  // 🔴 SLA BREACHED
  if (now >= sla) {
    return "RED";
  }

  return "UNKNOWN";
}
