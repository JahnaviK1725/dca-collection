import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase.js";
import { useNavigate } from "react-router-dom";

const CustomerSearch = () => {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; // Show 9 cards per page (3x3 grid)

  const navigate = useNavigate();

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "company_features"));
        const list = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setCustomers(list);
      } catch (error) {
        console.error("Error fetching customers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  // 1. FILTER Logic
  const filtered = customers.filter(c => 
    (c.company_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cust_number || "").includes(searchTerm)
  );

  // 2. PAGINATION Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  // Handle Page Change
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Reset to Page 1 on search
  const handleSearch = (e) => {
      setSearchTerm(e.target.value);
      setCurrentPage(1);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1>👥 Customer Directory</h1>
        <p style={{color: '#64748b'}}>Search and analyze payment behaviors across your portfolio.</p>
      </div>

      {/* SEARCH BAR */}
      <div style={styles.searchContainer}>
        <input 
          type="text" 
          placeholder="🔍 Search by Company Name or ID..." 
          value={searchTerm}
          onChange={handleSearch}
          style={styles.searchInput}
        />
      </div>

      {/* RESULTS LIST */}
      <div style={styles.results}>
        {loading ? (
           <div style={{textAlign: 'center', padding: 20, color: '#64748b'}}>Loading directory...</div>
        ) : (
           <>
             <div style={styles.countText}>
                Showing {filtered.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, filtered.length)} of {filtered.length} customers
             </div>
             
             <div style={styles.grid}>
               {currentItems.map(cust => {
                 const isRisky = cust.late_payment_ratio > 0.5;
                 
                 return (
                   <div key={cust.id} style={styles.card} onClick={() => navigate(`/customer/${cust.cust_number}`)}>
                      <div style={styles.cardTop}>
                        <div style={styles.avatar}>{cust.company_name?.charAt(0) || "?"}</div>
                        <div>
                          <div style={styles.name}>
                              {cust.company_name?.length > 20 ? cust.company_name.substring(0, 20) + '...' : cust.company_name || "Unknown"}
                          </div>
                          <div style={styles.id}>ID: {cust.cust_number}</div>
                        </div>
                      </div>
                      
                      <div style={styles.statsRow}>
                        <div style={styles.stat}>
                          <span style={styles.statLabel}>Avg Delay</span>
                          <span style={styles.statValue}>{cust.avg_payment_delay?.toFixed(1)}d</span>
                        </div>
                        <div style={styles.stat}>
                          <span style={styles.statLabel}>Late Freq</span>
                          <span style={styles.statValue}>{(cust.late_payment_ratio * 100).toFixed(0)}%</span>
                        </div>
                      </div>

                      <div style={{...styles.badge, background: isRisky ? '#fee2e2' : '#dcfce7', color: isRisky ? '#991b1b' : '#166534'}}>
                        {isRisky ? '⚠️ Habitual Late Payer' : '✅ Reliable Payer'}
                      </div>
                   </div>
                 );
               })}
             </div>

             {/* EMPTY STATE */}
             {currentItems.length === 0 && (
                <div style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>
                    No customers found matching "{searchTerm}"
                </div>
             )}

             {/* PAGINATION CONTROLS */}
             {filtered.length > itemsPerPage && (
                <div style={styles.pagination}>
                    <button 
                        onClick={() => paginate(currentPage - 1)} 
                        disabled={currentPage === 1}
                        style={{...styles.pageBtn, opacity: currentPage === 1 ? 0.5 : 1}}
                    >
                        Previous
                    </button>
                    
                    <span style={styles.pageInfo}>
                        Page {currentPage} of {totalPages}
                    </span>
                    
                    <button 
                        onClick={() => paginate(currentPage + 1)} 
                        disabled={currentPage === totalPages}
                        style={{...styles.pageBtn, opacity: currentPage === totalPages ? 0.5 : 1}}
                    >
                        Next
                    </button>
                </div>
             )}
           </>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: { width: "100%", padding: "40px 20px", boxSizing: "border-box", minHeight: "100vh", backgroundColor: "#f8fafc" },
  header: { textAlign: "center", marginBottom: "30px" },
  searchContainer: { display: "flex", justifyContent: "center", marginBottom: "30px" },
  searchInput: { width: "100%", maxWidth: "600px", padding: "16px", fontSize: "16px", borderRadius: "30px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", outline: "none" },
  
  countText: { marginBottom: "20px", color: "#64748b", fontWeight: "600", fontSize: '13px', textAlign: 'right' },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" },
  
  card: { background: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  cardTop: { display: "flex", gap: "15px", alignItems: "center", marginBottom: "20px" },
  avatar: { width: "42px", height: "42px", background: "#3b82f6", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "18px" },
  name: { fontWeight: "bold", fontSize: "16px", color: "#1e293b" },
  id: { fontSize: "12px", color: "#94a3b8", fontFamily: "monospace" },
  
  statsRow: { display: "flex", justifyContent: "space-between", marginBottom: "15px", paddingBottom: "15px", borderBottom: "1px solid #f1f5f9" },
  stat: { display: "flex", flexDirection: "column" },
  statLabel: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "600" },
  statValue: { fontWeight: "bold", color: "#334155", fontSize: "15px" },
  
  badge: { fontSize: "12px", textAlign: "center", padding: "8px", borderRadius: "8px", fontWeight: "700" },

  // Pagination Styles
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: "15px", marginTop: "40px" },
  pageBtn: { padding: "8px 16px", border: "1px solid #cbd5e1", background: "white", borderRadius: "6px", cursor: "pointer", fontWeight: "600", color: "#475569" },
  pageInfo: { fontSize: "14px", color: "#64748b", fontWeight: "500" }
};

export default CustomerSearch;