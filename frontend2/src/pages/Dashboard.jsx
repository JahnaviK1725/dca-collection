import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "../firebase.js";
import CaseTable from "../components/CaseTable.jsx";
import ZoneSummary from "../components/ZoneSummary.jsx";
import SlaBreachList from "../components/SlaBreachList.jsx";
import CallsOverview from "../components/CallsOverview.jsx";
import CashForecast from "../components/CashForecast.jsx";
import AddCaseModal from "../components/AddCaseModal.jsx";

const Dashboard = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters & Modal
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    // 1. QUERY: Fetch all to ensure Summary Widgets have accurate totals
    const q = query(
      collection(db, "cases"),
      orderBy("last_predicted_at", "desc"),
      
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = [];
        snapshot.docs.forEach((doc) => {
          const d = doc.data();

          rows.push({
            id: doc.id,
            invoice_id: d.invoice_id || d.doc_id || doc.id,
            company_name: d.company_name || d.name_customer || "Unknown Company",
            invoice_amount: Number(d.total_open_amount || d.invoice_amount || 0),
            outstanding_amount: Number(d.total_open_amount || 0),
            due_date: d.due_date ? new Date(d.due_date).toLocaleDateString() : "—",
            predicted_payment_date: d.predicted_payment_date || "—",
            predicted_delay: d.predicted_delay !== undefined ? Number(d.predicted_delay) : null,
            sla_days: d.sla_days,
            sla_date: d.sla_date,
            zone: d.zone || "UNKNOWN",
            action: d.action || "NO_ACTION",
            escalated: Boolean(d.escalated),
            last_predicted_at: d.last_predicted_at,
            total_open_amount: d.total_open_amount,
          });
        });

        setCases(rows);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Firestore Error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. RESET PAGE ON FILTER CHANGE
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [zoneFilter]);

  // 3. FILTERING LOGIC
  const filteredCases = zoneFilter === "ALL" 
    ? cases 
    : cases.filter((c) => c.zone === zoneFilter);

  // 4. PAGINATION LOGIC
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTableData = filteredCases.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);

  // Derive specialized lists (Use 'cases' so sidebars show GLOBAL stats, not just page stats)
  const slaBreachedCases = cases.filter((c) => c.escalated === true);
  const callActionCases = cases.filter((c) => c.action === "CALL");

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Optional: Scroll to top of table
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    }
    
  };

  if (loading) return <div style={{ padding: 40 }}>Loading Dashboard...</div>;
  if (error) return <div style={{ padding: 40, color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: 40, background: "#f8f9fa", minHeight: "100vh" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>DCA Dashboard ({cases.length} active cases)</h1>
        
        <button 
          onClick={() => setShowAddModal(true)}
          style={styles.addBtn}
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

          {/* TABLE (Shows only 100 rows) */}
          <CaseTable cases={currentTableData} />

          {/* PAGINATION CONTROLS */}
          {filteredCases.length > 0 && (
            <div style={styles.paginationContainer}>
                <span style={styles.pageInfo}>
                    Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredCases.length)} of {filteredCases.length}
                </span>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={{...styles.pageBtn, opacity: currentPage === 1 ? 0.5 : 1}}
                    >
                        Previous
                    </button>
                    
                    <span style={styles.pageNumber}>
                        Page {currentPage} of {totalPages}
                    </span>

                    <button 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        style={{...styles.pageBtn, opacity: currentPage === totalPages ? 0.5 : 1}}
                    >
                        Next
                    </button>
                </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Sidebar Widgets (Shows GLOBAL stats) */}
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

// Styling for Pagination Controls
const styles = {
    addBtn: {
        background: "#2563eb", 
        color: "white", 
        border: "none", 
        padding: "10px 20px", 
        borderRadius: "8px", 
        cursor: "pointer", 
        fontWeight: "bold",
        display: "flex", alignItems: "center", gap: "8px",
        boxShadow: "0 2px 5px rgba(37, 99, 235, 0.3)"
    },
    paginationContainer: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "20px",
        padding: "10px",
        background: "#fff",
        borderRadius: "8px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
    },
    pageInfo: {
        fontSize: "14px",
        color: "#64748b",
        fontWeight: "500"
    },
    pageBtn: {
        padding: "8px 16px",
        border: "1px solid #e2e8f0",
        background: "white",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "600",
        color: "#334155"
    },
    pageNumber: {
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        fontSize: "14px",
        fontWeight: "600",
        color: "#334155"
    }
};

export default Dashboard;