// ==========================================
// FILE: src/pages/ClientLogin.jsx
// ==========================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ClientLogin = () => {
  const [custId, setCustId] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (custId.trim()) {
      // In a real app, you'd verify this ID against Firebase Auth or Firestore
      localStorage.setItem("client_id", custId);
      navigate('/portal/dashboard');
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", textAlign: "center", padding: "2rem", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
      <h1 style={{ color: "#FF6200" }}>Client Access</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>Enter your Customer ID to view your invoices.</p>
      
      <form onSubmit={handleLogin}>
        <input 
          type="text" 
          placeholder="Customer ID (e.g. 12345)" 
          value={custId}
          onChange={(e) => setCustId(e.target.value)}
          style={{ width: "100%", padding: "12px", marginBottom: "1rem", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <button 
          type="submit" 
          style={{ width: "100%", padding: "12px", background: "#4D148C", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
        >
          View My Invoices
        </button>
      </form>
    </div>
  );
};

export default ClientLogin;