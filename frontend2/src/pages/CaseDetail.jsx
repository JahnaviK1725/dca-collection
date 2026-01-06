import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { useEffect, useState } from "react";

const CaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCase = async () => {
      const ref = doc(db, "cases", id);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setCaseData(snap.data());
      }

      setLoading(false);
    };

    fetchCase();
  }, [id]);

  if (loading) return <div style={{ padding: 40 }}>Loading case…</div>;

  if (!caseData)
    return <div style={{ padding: 40 }}>Case not found</div>;

  return (
    <div style={{ padding: 40 }}>
      <button onClick={() => navigate(-1)}>← Back</button>

      <h1 style={{ marginTop: 20 }}>
        Invoice #{caseData.invoice_id}
      </h1>

      <p><strong>Customer:</strong> {caseData.name_customer}</p>
      <p><strong>Amount:</strong> ₹{caseData.total_open_amount}</p>
      <p><strong>Due Date:</strong> {caseData.due_in_date}</p>
      <p><strong>Zone:</strong> {caseData.zone}</p>

      {/* Future sections */}
      {/* Call history */}
      {/* Notes */}
      {/* Actions */}
    </div>
  );
};

export default CaseDetail;
