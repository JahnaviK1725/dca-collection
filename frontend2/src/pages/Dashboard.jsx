import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy} from "firebase/firestore";
import { db } from "../firebase.js";

import CaseTable from "../components/CaseTable.jsx";
import ZoneSummary from "../components/ZoneSummary.jsx";
import SlaBreachList from "../components/SlaBreachList.jsx";
import CallsOverview from "../components/CallsOverview.jsx";
import CashForecast from "../components/CashForecast.jsx"; // <--- Add this
import AddCaseModal from "../components/AddCaseModal.jsx";

const Dashboard = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoneFilter, setZoneFilter] = useState("ALL");
const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    // 1. QUERY: We order by 'last_predicted_at' because that is the field 
    //    your ML Python script updates.
    const q = query(
      collection(db, "cases"),
      orderBy("last_predicted_at", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = [];
        snapshot.docs.forEach((doc) => {
          const d = doc.data();

          // 2. PARSING: Ensure we handle missing fields gracefully
          rows.push({
            id: doc.id,
            invoice_id: d.invoice_id || d.doc_id || doc.id,
            company_name: d.company_name || d.name_customer || "Unknown Company",
            
            // Numbers
            invoice_amount: Number(d.total_open_amount || d.invoice_amount || 0),
            outstanding_amount: Number(d.total_open_amount || 0),
            
            // Dates (Strings or Timestamps)
            due_date: d.due_date ? new Date(d.due_date).toLocaleDateString() : "—",
            predicted_payment_date: d.predicted_payment_date || "—",
            
            // ML Fields
            predicted_delay: d.predicted_delay !== undefined ? Number(d.predicted_delay) : null,
            sla_days: d.sla_days,
            sla_date: d.sla_date,
            
            zone: d.zone || "UNKNOWN",
            action: d.action || "NO_ACTION",
            escalated: Boolean(d.escalated),
            
            // Useful for sorting
            last_predicted_at: d.last_predicted_at
          });
        });

        setCases(rows);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Firestore Error:", err);
        // If the query fails (e.g. missing index), we show a friendly error
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter Logic
  const filteredCases = zoneFilter === "ALL" 
    ? cases 
    : cases.filter((c) => c.zone === zoneFilter);

  // Derive specialized lists
  const slaBreachedCases = cases.filter((c) => c.escalated === true);
  const callActionCases = cases.filter((c) => c.action === "CALL");

  if (loading) return <div style={{ padding: 40 }}>Loading Dashboard...</div>;
  if (error) return <div style={{ padding: 40, color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: 40, background: "#f8f9fa", minHeight: "100vh" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>DCA Dashboard ({cases.length} active cases)</h1>
        
        <button 
          onClick={() => setShowAddModal(true)}
          style={{
            background: "#2563eb", 
            color: "white", 
            border: "none", 
            padding: "10px 20px", 
            borderRadius: "8px", 
            cursor: "pointer", 
            fontWeight: "bold",
            display: "flex", alignItems: "center", gap: "8px",
            boxShadow: "0 2px 5px rgba(37, 99, 235, 0.3)"
          }}
        >
          + New Case
        </button>
      </div>
      <ZoneSummary cases={cases} />

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* LEFT COLUMN: Main Table */}
        <div style={{ flex: 3 }}>
          {/* Filter Pills */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {["ALL", "GREEN", "YELLOW", "ORANGE"].map((zone) => (
              <button
                key={zone}
                onClick={() => setZoneFilter(zone)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: "none",
                  background: zoneFilter === zone ? "#2c3e50" : "#fff",
                  color: zoneFilter === zone ? "#fff" : "#333",
                  cursor: "pointer",
                  fontWeight: "600",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
                }}
              >
                {zone}
              </button>
            ))}
          </div>

          <CaseTable cases={filteredCases} />
        </div>

        {/* RIGHT COLUMN: Sidebar Widgets */}
        <div style={{ flex: 1, minWidth: "300px" }}>
          <CashForecast cases={cases} />
          <SlaBreachList cases={slaBreachedCases} />
          <CallsOverview cases={callActionCases} />
        </div>
      </div>
      {showAddModal && (
        <AddCaseModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
};

export default Dashboard;