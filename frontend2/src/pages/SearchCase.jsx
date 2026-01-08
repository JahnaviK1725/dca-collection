import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase.js";
import { Link, useNavigate } from "react-router-dom";

const SearchCase = () => {
  const [cases, setCases] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const q = query(collection(db, "cases"), orderBy("last_predicted_at", "desc"));
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          list.push({
            id: doc.id,
            invoice_id: d.invoice_id || d.doc_id || doc.id,
            customer: d.company_name || d.name_customer || "Unknown",
            amount: Number(d.total_open_amount || d.invoice_amount || 0),
            status: d.isOpen == 1 ? "Open" : "Closed",
            zone: d.zone || "UNKNOWN"
          });
        });
        setCases(list);
      } catch (error) {
        console.error("Error fetching cases:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  // Filter Logic
  const filtered = cases.filter(c => 
    String(c.invoice_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(c.customer).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1>🔎 Invoice Search</h1>
        <p style={{color: '#64748b'}}>Find any case by Invoice ID or Customer Name.</p>
      </div>

      {/* SEARCH BAR */}
      <div style={styles.searchContainer}>
        <input 
          type="text" 
          placeholder="Type Invoice ID (e.g., 2960...) or Customer Name..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
          autoFocus
        />
      </div>

      {/* RESULTS TABLE */}
      <div style={styles.results}>
        {loading ? (
           <div style={{textAlign: 'center', padding: 20}}>Loading invoices...</div>
        ) : (
           <>
             <div style={styles.countText}>Found {filtered.length} matches</div>
             
             <table style={styles.table}>
                <thead>
                    <tr style={{textAlign: 'left', color: '#64748b', fontSize: '13px'}}>
                        <th style={{padding: '12px'}}>Invoice ID</th>
                        <th style={{padding: '12px'}}>Customer</th>
                        <th style={{padding: '12px'}}>Amount</th>
                        <th style={{padding: '12px'}}>Status</th>
                        <th style={{padding: '12px'}}>Risk Zone</th>
                        <th style={{padding: '12px'}}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {filtered.map(c => (
                        <tr key={c.id} style={styles.row}>
                            <td style={styles.td}><strong>#{c.invoice_id}</strong></td>
                            <td style={styles.td}>{c.customer}</td>
                            <td style={styles.td}>${c.amount.toLocaleString()}</td>
                            <td style={styles.td}>
                                <span style={{
                                    padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                                    background: c.status === 'Open' ? '#dbeafe' : '#f1f5f9',
                                    color: c.status === 'Open' ? '#1e40af' : '#64748b'
                                }}>
                                    {c.status}
                                </span>
                            </td>
                            <td style={styles.td}>
                                <span style={{
                                    padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
                                    background: c.zone === 'RED' ? '#fee2e2' : c.zone === 'ORANGE' ? '#ffedd5' : c.zone === 'YELLOW' ? '#fef9c3' : '#dcfce7',
                                    color: c.zone === 'RED' ? '#991b1b' : c.zone === 'ORANGE' ? '#9a3412' : c.zone === 'YELLOW' ? '#854d0e' : '#166534'
                                }}>
                                    {c.zone}
                                </span>
                            </td>
                            <td style={styles.td}>
                                <button onClick={() => navigate(`/case/${c.id}`)} style={styles.btn}>View →</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
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
  countText: { marginBottom: "10px", color: "#64748b", fontWeight: "600", fontSize: '14px' },
  table: { width: "100%", borderCollapse: "collapse", background: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  row: { borderBottom: "1px solid #f1f5f9" },
  td: { padding: "14px 12px", fontSize: "14px", color: "#334155" },
  btn: { background: "none", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#475569" }
};

export default SearchCase;