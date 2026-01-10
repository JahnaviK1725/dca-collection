// src/pages/LandingPage.jsx
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        // Layout & Sizing
        height: "100vh",
        width: "100vw",
        boxSizing: "border-box", // Prevents padding from increasing total height
        overflow: "hidden",      // Cuts off any potential overflow to stop scrolling
        padding: 60,
        
        // Flexbox Centering
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",

        // Background Image
        backgroundImage: "url('/wallpaper.avif')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Content Card with Glassmorphism */}
      <div style={{ 
        backgroundColor: "rgba(255, 255, 255, 0.85)", 
        padding: "40px", 
        borderRadius: "16px",
        backdropFilter: "blur(5px)",
        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
        maxWidth: "90%", // Ensures card doesn't overflow horizontally on mobile
      }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "20px", color: "#1e293b" }}>
          FedEx DCA 360
        </h1>
        <p style={{ fontSize: "1.2rem", maxWidth: "600px", marginBottom: "40px", color: "#475569" }}>
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
            transition: "all 0.2s",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = "#005bb5";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "#0070f3";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Enter DCA Dashboard →
        </button>
      </div>
    </div>
  );
};

export default LandingPage;