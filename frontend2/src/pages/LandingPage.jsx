// ==========================================
// FILE: src/pages/LandingPage.jsx
// ==========================================

import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div style={styles.container}>
      
      {/* --- Navbar / Header --- */}
      <nav style={styles.nav}>
        <div style={styles.logo}>FedEx <span style={{ fontWeight: 'normal', color: '#666' }}>DCA System</span></div>
        <div style={styles.navLinks}>
          <span style={styles.navItem}>Contact Support</span>
          <span style={styles.navItem}>System Status: <span style={{color: '#2ecc71'}}>● Online</span></span>
        </div>
      </nav>

      {/* --- Main Content Split --- */}
      <div style={styles.heroSection}>
        <h1 style={styles.headline}>Intelligent Collections Management</h1>
        <p style={styles.subheadline}>
          Select your portal to continue.
        </p>

        <div style={styles.cardContainer}>
          
          {/* 1. ADMIN CARD */}
          <div style={styles.card}>
            <div style={styles.iconCircle}>🛡️</div>
            <h2 style={styles.cardTitle}>Staff & Administrators</h2>
            <p style={styles.cardText}>
              Access the AI-powered dashboard, manage escalation queues, and monitor payment zones.
            </p>
            <Link to="/admin/dashboard" style={styles.adminBtn}>
              Login to Admin Console
            </Link>
          </div>

          {/* 2. CLIENT CARD */}
          <div style={styles.card}>
            <div style={styles.iconCircle}>🏢</div>
            <h2 style={styles.cardTitle}>Client Portal</h2>
            <p style={styles.cardText}>
              View your outstanding invoices, make secure payments, and manage your account profile.
            </p>
            <Link to="/portal" style={styles.clientBtn}>
              Access Company Portal
            </Link>
          </div>

        </div>
      </div>

      {/* --- Footer --- */}
      <footer style={styles.footer}>
        © {new Date().getFullYear()} FedEx. All rights reserved. | Internal System v2.0
      </footer>
    </div>
  );
};

// --- CSS-in-JS Styles ---
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    // ✨ NEW: Wallpaper Background with Dark Overlay
    backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.7)), url(/wallpaper.avif)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    color: '#fff',
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 3rem',
    // Slight transparency to blend with wallpaper
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(5px)',
    borderBottom: '1px solid rgba(0,0,0,0.1)',
  },
  logo: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: '#4D148C', // FedEx Purple
    letterSpacing: '-0.5px',
  },
  navLinks: {
    display: 'flex',
    gap: '2rem',
    fontSize: '0.9rem',
    color: '#666',
    fontWeight: '500',
  },
  navItem: {
    cursor: 'pointer',
  },
  heroSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    textAlign: 'center',
  },
  headline: {
    fontSize: '3rem',
    fontWeight: '800',
    marginBottom: '1rem',
    color: '#ffffff', // Changed to white for contrast
    maxWidth: '800px',
    lineHeight: '1.1',
    textShadow: '0 2px 10px rgba(0,0,0,0.3)', // Added shadow for readability
  },
  subheadline: {
    fontSize: '1.25rem',
    color: '#e0e0e0', // Light grey for contrast
    marginBottom: '4rem',
    maxWidth: '600px',
    textShadow: '0 1px 5px rgba(0,0,0,0.3)',
  },
  cardContainer: {
    display: 'flex',
    gap: '2rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '3rem 2rem',
    width: '320px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)', // Stronger shadow for depth
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    transition: 'transform 0.2s ease',
    border: 'none',
  },
  iconCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#f4f4f4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    marginBottom: '1.5rem',
  },
  cardTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    marginBottom: '1rem',
    color: '#333',
  },
  cardText: {
    color: '#666',
    lineHeight: '1.6',
    marginBottom: '2rem',
    fontSize: '0.95rem',
  },
  adminBtn: {
    display: 'inline-block',
    width: '100%',
    padding: '14px 0',
    backgroundColor: '#4D148C', // FedEx Purple
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    transition: 'background 0.2s',
  },
  clientBtn: {
    display: 'inline-block',
    width: '100%',
    padding: '14px 0',
    backgroundColor: '#FF6200', // FedEx Orange
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    transition: 'background 0.2s',
  },
  footer: {
    textAlign: 'center',
    padding: '2rem',
    color: 'rgba(255, 255, 255, 0.7)', // Semi-transparent white
    fontSize: '0.85rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
};

export default LandingPage;