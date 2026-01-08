import React from 'react';

const CashForecast = ({ cases }) => {
  // 1. Setup Buckets
  let thisWeekSum = 0;
  let nextWeekSum = 0;
  let totalPipeline = 0;
  
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7); // 7 days from now

  // 2. Process Data
  cases.forEach(c => {
    // Only look at OPEN cases that have a valid prediction
    // We check for 'is_open_flag' or fallback logic (amount > 0)
    const isOpen = c.isOpen !== '0' && c.outstanding_amount > 0;
    
    if (isOpen && c.predicted_payment_date && c.predicted_payment_date !== "—") {
      const pDate = new Date(c.predicted_payment_date);
      const amount = Number(c.outstanding_amount || 0);

      totalPipeline += amount;

      // Bucket Logic
      if (pDate <= nextWeek) {
        thisWeekSum += amount;
      } else {
        nextWeekSum += amount;
      }
    }
  });

  // 3. Render Widget
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h3 style={styles.title}>💰 AI Cash Flow Projection</h3>
        <span style={styles.badge}>Next 7 Days</span>
      </div>
      
      {/* Primary Number: This Week */}
      <div style={styles.primaryBlock}>
        <div style={styles.label}>CLEARING THIS WEEK</div>
        <div style={styles.bigNumber}>
          ${thisWeekSum.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
        </div>
        <div style={styles.subText}>
          Based on {cases.length} active predictions
        </div>
      </div>

      {/* Secondary Number: Later */}
      <div style={styles.secondaryBlock}>
        <div style={styles.row}>
            <span style={styles.label}>Pipeline (Later)</span>
            <span style={styles.value}>${nextWeekSum.toLocaleString()}</span>
        </div>
        <div style={styles.progressBarBg}>
            {/* Visual bar showing how much is coming this week vs total */}
            <div style={{
                ...styles.progressBarFill, 
                width: `${(thisWeekSum / (totalPipeline || 1)) * 100}%`
            }}></div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  card: { background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: '700' },
  badge: { fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontWeight: '600' },
  
  primaryBlock: { marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' },
  label: { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' },
  bigNumber: { fontSize: '32px', fontWeight: '800', color: '#059669', margin: '4px 0' },
  subText: { fontSize: '12px', color: '#94a3b8' },

  secondaryBlock: { display: 'flex', flexDirection: 'column', gap: '8px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  value: { fontWeight: '600', color: '#475569' },
  
  progressBarBg: { height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' },
  progressBarFill: { height: '100%', background: '#059669', borderRadius: '3px' }
};

export default CashForecast;