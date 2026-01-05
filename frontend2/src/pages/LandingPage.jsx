// src/pages/LandingPage.jsx
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        padding: 60,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#f5f5f5",
      }}
    >
      <h1 style={{ fontSize: "3rem", marginBottom: "20px" }}>
        FedEx DCA 360
      </h1>
      <p style={{ fontSize: "1.2rem", maxWidth: "600px", marginBottom: "40px" }}>
        Reimagining Debt Collection Agency management using automation, real-time
        data, and AI-driven prioritization.
      </p>

      <button
        onClick={() => navigate("/dashboard")}
        style={{
          padding: "12px 24px",
          fontSize: "1rem",
          backgroundColor: "#0070f3",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          transition: "background-color 0.2s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#005bb5")}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#0070f3")}
      >
        Enter DCA Dashboard →
      </button>
    </div>
  );
};

export default LandingPage;
