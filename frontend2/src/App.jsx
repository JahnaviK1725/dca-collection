import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import CaseDetail from "./pages/CaseDetail.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/case/:id" element={<CaseDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
