import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
// 👇 1. IMPORT deleteField
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "../firebase"; 
import Confetti from "react-confetti"; 

const PaymentPortal = () => {
  const { id } = useParams(); 
  const [caseData, setCaseData] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    const fetchCase = async () => {
      if (!id) return;
      const snap = await getDoc(doc(db, "cases", id));
      if (snap.exists()) {
        setCaseData(snap.data());
      }
    };
    fetchCase();
  }, [id]);

  const handlePay = async () => {
    setStatus("processing");

    setTimeout(async () => {
      try {
        const caseRef = doc(db, "cases", id);
        
        await updateDoc(caseRef, {
          is_open_flag: false,          
          status: "PAID",               
          zone: "GREEN",                
          action: "RESOLVED",
          payment_date: serverTimestamp(),
          amount_collected: caseData.total_open_amount,
          
          // 👇 2. DELETE THE FIELD HERE
          last_predicted_at: deleteField(), 
          
          history_logs: arrayUnion({
            date: new Date().toISOString(),
            action: "💳 Payment Verified",
            outcome: "Success",
            note: `Payment of $${caseData.total_open_amount} received via Secure Link.`,
            status: "Closed"
          })
        });

        setStatus("success");
      } catch (err) {
        console.error("Update failed:", err);
        alert("Error updating system. Check console.");
        setStatus("idle");
      }
    }, 2000);
  };

  if (!caseData) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  // ... (Rest of your component UI remains the same)
  if (status === "success") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-green-50">
        <Confetti numberOfPieces={200} recycle={false} />
        <h1 className="text-4xl font-bold text-green-800">Payment Successful!</h1>
        <p className="mt-4 text-gray-600">The system has been updated automatically.</p>
        <p className="text-sm text-gray-400 mt-2">Check your dashboard now.</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-xl w-96 text-center">
        <h2 className="text-2xl font-bold mb-4">FedEx Secure Pay</h2>
        <p className="text-gray-500">Invoice #{caseData.invoice_id}</p>
        <h1 className="text-4xl font-bold my-6">${caseData.total_open_amount}</h1>
        
        <button 
          onClick={handlePay}
          disabled={status === "processing"}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
        >
          {status === "processing" ? "Processing..." : "Pay Now"}
        </button>
      </div>
    </div>
  );
};

export default PaymentPortal;