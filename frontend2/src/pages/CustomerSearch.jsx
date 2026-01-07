import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase.js";
import { Link, useNavigate } from "react-router-dom";

const CustomerSearch = () => {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        // We fetch the 'company_features' collection because it has 
        // one document per customer (the "DNA" records)
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

  // Filter Logic: Matches Name OR Customer ID
  const filtered = customers.filter(c => 
    (c.company_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cust_number || "").includes(searchTerm)
  );

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
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* RESULTS LIST */}
      <div style={styles.results}>
        {loading ? (
           <div style={{padding: 20}}>Loading directory...</div>
        ) : (
           <>
             <div style={styles.countText}>Found {filtered.length} customers</div>
             
             <div style={styles.grid}>
               {filtered.map(cust => {
                 // Determine Risk Badge
                 const isRisky = cust.late_payment_ratio > 0.5;
                 
                 return (
                   <div key={cust.id} style={styles.card} onClick={() => navigate(`/customer/${cust.cust_number}`)}>
                      <div style={styles.cardTop}>
                        <div style={styles.avatar}>{cust.company_name?.charAt(0) || "?"}</div>
                        <div>
                          <div style={styles.name}>{cust.company_name || "Unknown"}</div>
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
           </>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: { maxWidth: "1000px", margin: "0 auto", padding: "40px 20px" },
  header: { textAlign: "center", marginBottom: "30px" },
  searchContainer: { display: "flex", justifyContent: "center", marginBottom: "40px" },
  searchInput: { width: "100%", maxWidth: "600px", padding: "16px", fontSize: "18px", borderRadius: "30px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", outline: "none" },
  
  countText: { marginBottom: "20px", color: "#64748b", fontWeight: "600" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" },
  
  card: { background: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", cursor: "pointer", transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  cardTop: { display: "flex", gap: "15px", alignItems: "center", marginBottom: "20px" },
  avatar: { width: "40px", height: "40px", background: "#3b82f6", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "18px" },
  name: { fontWeight: "bold", fontSize: "16px", color: "#1e293b" },
  id: { fontSize: "12px", color: "#94a3b8" },
  
  statsRow: { display: "flex", justifyContent: "space-between", marginBottom: "15px", paddingBottom: "15px", borderBottom: "1px solid #f1f5f9" },
  stat: { display: "flex", flexDirection: "column" },
  statLabel: { fontSize: "11px", color: "#64748b", textTransform: "uppercase" },
  statValue: { fontWeight: "bold", color: "#334155" },
  
  badge: { fontSize: "12px", textAlign: "center", padding: "6px", borderRadius: "6px", fontWeight: "600" }
};

export default CustomerSearch;