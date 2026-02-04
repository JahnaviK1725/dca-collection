// ==========================================
// FILE: src/App.jsx
// ==========================================

import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";


// Admin Pages
import Dashboard from "./pages/Dashboard.jsx";
import CaseDetail from "./pages/CaseDetail.jsx";
import CustomerProfile from "./pages/CustomerProfile";
import CustomerSearch from "./pages/CustomerSearch";
import SearchCase from "./pages/SearchCase";
import AiLogs from "./pages/AiLogs.jsx";
import Analytics from "./pages/Analytics";
import EscalationPage from './pages/EscalationPage';
import Navbar from "./components/Navbar"; // The Admin Navbar
import AiBot from "./components/AiBot";

// Client/Shared Pages
import LandingPage from "./pages/LandingPage.jsx";
import PaymentPortal from "./pages/PaymentPortal";
import ClientLogin from "./pages/ClientLogin.jsx";
import ClientDashboard from "./pages/ClientDashboard.jsx";
import ClientNegotiation from "./pages/ClientNegotiation.jsx";

// 1. Layout for Admin (Includes Navbar + Chatbot)
const AdminLayout = () => (
  <>
    <Navbar />
    <div className="admin-container" style={{ padding: "20px" }}>
      <Outlet />
    </div>
    <AiBot />
  </>
);

// 2. Layout for Clients (Updated Layout)
const ClientLayout = () => (
  <div className="client-app" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
    <header style={{ 
      padding: "1rem 2rem", 
      borderBottom: "1px solid #333", // Darker border for dark theme compatibility
      display: "flex", 
      justifyContent: "space-between",
      alignItems: "center" // 👈 Centers items vertically
    }}>
      <h2 style={{ 
        color: "#4D148C", 
        fontWeight: "bold", 
        margin: 0, // 👈 Removes default top/bottom margin causing the offset
        fontSize: "24px"
      }}>
        FedEx Billing Portal
      </h2>
      <a 
        href="/" 
        style={{ 
          textDecoration: "none", 
          color: "#9ca3af", // Lighter grey for visibility on dark backgrounds
          fontWeight: "500",
          fontSize: "14px" 
        }}
      >
        Logout
      </a>
    </header>
    <div style={{ padding: "20px", flex: 1 }}>
      <Outlet />
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC / ENTRY */}
        <Route path="/" element={<LandingPage />} />
        
        {/* SHARED: Payment Portal (Accessible by link) */}
        <Route path="/pay/:id" element={<PaymentPortal />} />

        {/* 🔐 ADMIN FLOW (Restricted) */}
        <Route path="/admin" element={<AdminLayout />}>
          {/* Redirect /admin to /admin/dashboard */}
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="case/:id" element={<CaseDetail />} />
          <Route path="customers" element={<CustomerSearch />} />
          <Route path="customer/:customerId" element={<CustomerProfile />} />
          <Route path="search" element={<SearchCase />} />
          <Route path="ai-logs" element={<AiLogs />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="escalation" element={<EscalationPage />} />
        </Route>

        {/* 🏢 COMPANY/CLIENT FLOW */}
        <Route path="/portal" element={<ClientLayout />}>
          <Route index element={<ClientLogin />} />
          <Route path="dashboard" element={<ClientDashboard />} />
          <Route path="negotiate/:id" element={<ClientNegotiation />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;