import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";

const AddCaseModal = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [existingCompanies, setExistingCompanies] = useState([]);
  
  const [formData, setFormData] = useState({
    invoice_id: "",
    customer_name: "",
    amount: "",
    due_date: ""
  });

  // 1. FETCH EXISTING COMPANIES FOR AUTOCOMPLETE
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const snapshot = await getDocs(collection(db, "company_features"));
        const list = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.company_name) {
                list.push({ 
                    id: doc.id, // This is the cust_number
                    name: data.company_name 
                });
            }
        });
        setExistingCompanies(list);
      } catch (err) {
        console.error("Error loading companies:", err);
      }
    };
    fetchCompanies();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanName = formData.customer_name.trim();
      
      // 2. CHECK IF COMPANY EXISTS
      const match = existingCompanies.find(
          c => c.name.toLowerCase() === cleanName.toLowerCase()
      );

      let finalCustNumber = "";

      if (match) {
          // A. EXISTING COMPANY: Use their ID
          finalCustNumber = match.id;
          console.log("Linked to existing company:", match.name);
      } else {
          // B. NEW COMPANY: Create Profile + Generate ID
          // Generate a simple ID like 'MANUAL-1709...'
          finalCustNumber = `MANUAL-${Date.now()}`; 
          
          const default_company = {
            avg_due_days: 30, 
            avg_payment_delay: 0, 
            std_payment_delay: 0,
            avg_days_to_clear: 30, 
            avg_invoice_amount: 0, 
            transaction_count: 0, 
            late_payment_ratio: 0,
            // Important: Save the name and ID too
            company_name: cleanName,
            cust_number: finalCustNumber
          };

          // Write to 'company_features' collection
          await setDoc(doc(db, "company_features", finalCustNumber), default_company);
          console.log("Created new company profile for:", cleanName);
      }

      // 3. CREATE THE CASE
      await addDoc(collection(db, "cases"), {
        // Core Fields
        invoice_id: formData.invoice_id,
        name_customer: cleanName,
        cust_number: finalCustNumber, // <--- Links invoice to the profile
        total_open_amount: Number(formData.amount),
        due_date: formData.due_date,
        
        // Defaults for Manual Entry
        is_open_flag: true,
        zone: "GREEN",
        action: "NO_ACTION",
        predicted_delay: 0,
        escalated: false,
        
        // Timestamps
        document_create_date: new Date().toISOString().split('T')[0],
        last_predicted_at: serverTimestamp()
      });

      alert(`Success! Added invoice for ${cleanName}`);
      onClose();
    } catch (err) {
      console.error("Error adding case:", err);
      alert("Failed to add case.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3>📝 Manually Log New Case</h3>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            <label style={styles.label}>Invoice ID</label>
            <input 
              required 
              style={styles.input}
              value={formData.invoice_id}
              onChange={e => setFormData({...formData, invoice_id: e.target.value})}
              placeholder="#INV-2024-001"
            />
          </div>

          <div style={styles.row}>
            <label style={styles.label}>Customer Name</label>
            <input 
              required 
              list="company-list" // <--- CONNECTS TO DATALIST
              style={styles.input}
              value={formData.customer_name}
              onChange={e => setFormData({...formData, customer_name: e.target.value})}
              placeholder="Start typing to search..."
              autoComplete="off"
            />
            {/* 4. AUTOCOMPLETE LIST */}
            <datalist id="company-list">
                {existingCompanies.map((c) => (
                    <option key={c.id} value={c.name} />
                ))}
            </datalist>
          </div>

          <div style={styles.grid}>
            <div style={styles.row}>
                <label style={styles.label}>Amount ($)</label>
                <input 
                  type="number"
                  required 
                  style={styles.input}
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                />
            </div>
            <div style={styles.row}>
                <label style={styles.label}>Due Date</label>
                <input 
                  type="date"
                  required 
                  style={styles.input}
                  value={formData.due_date}
                  onChange={e => setFormData({...formData, due_date: e.target.value})}
                />
            </div>
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? "Processing..." : "Add Case"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modal: { background: "white", padding: "24px", borderRadius: "12px", width: "400px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  closeBtn: { background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#64748b" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  row: { display: "flex", flexDirection: "column", gap: "6px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  label: { fontSize: "13px", fontWeight: "600", color: "#475569" },
  input: { padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" },
  actions: { display: "flex", gap: "12px", marginTop: "10px" },
  cancelBtn: { flex: 1, padding: "10px", background: "none", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontWeight: "600" },
  submitBtn: { flex: 1, padding: "10px", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }
};

export default AddCaseModal;