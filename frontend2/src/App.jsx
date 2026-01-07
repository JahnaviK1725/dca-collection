import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import CaseDetail from "./pages/CaseDetail.jsx";
import CustomerProfile from "./pages/CustomerProfile"; // Import new page
import Navbar from "./components/Navbar";
import CustomerSearch from "./pages/CustomerSearch";

function App() {
  return (
    <BrowserRouter>
    <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/case/:id" element={<CaseDetail />} />
        <Route path="/customer/:customerId" element={<CustomerProfile />} />
        <Route path="/customers" element={<CustomerSearch />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
