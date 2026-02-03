import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <nav style={styles.nav}>
      <div style={styles.logo}>
        <Link to="/" style={{ textDecoration: "none", color: "white" }}>
          🤖 FedEx DCA <span style={styles.badge}>AI SYSTEM</span>
        </Link>
      </div>
      <div style={styles.links}>
        {/* 👇 UPDATED PATHS: Added /admin prefix */}
        <Link to="/admin/dashboard" style={styles.link}>
          Dashboard
        </Link>
        <Link to="/admin/escalation" style={{ ...styles.link, color: "#f87171" }}>
          🚨 Escalations
        </Link>
        
        <Link to="/admin/analytics" style={styles.link}>
          📊 Analytics
        </Link>
        <Link to="/admin/customers" style={styles.link}>
          Customers
        </Link>
        <Link to="/admin/ai-logs" style={styles.link}>
          ⚡ AI Logs
        </Link>
        <Link to="/admin/search" style={styles.link}>
          Search Case
        </Link>
        <div style={styles.divider}>|</div>
        <span style={styles.user}>Admin View</span>
      </div>
    </nav>
  );
};

// ... keep existing styles ...
const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 40px",
    backgroundColor: "#1e293b",
    color: "white",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    position: "sticky",
    top: 0,
    zIndex: 100, 
  },
  logo: { fontSize: "20px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px" },
  badge: { fontSize: "10px", backgroundColor: "#3b82f6", padding: "2px 6px", borderRadius: "4px", letterSpacing: "1px", marginLeft: "8px" },
  links: { display: "flex", gap: "20px", alignItems: "center", fontSize: "14px" },
  link: { color: "#e2e8f0", textDecoration: "none", fontWeight: "500", transition: "color 0.2s" },
  divider: { color: "#475569" },
  user: { color: "#94a3b8" },
};

export default Navbar;