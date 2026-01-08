import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine
} from "recharts";

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    riskData: [],
    forecastData: [],
    agingData: [],
    topDebtors: [],
    totalOutstanding: 0,
    totalPredictedRecoverable: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, "cases"), where("isOpen", "==", '1'));
        const snapshot = await getDocs(q);
        
        // Init Counters
        const riskCounts = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
        const forecastMap = { "Week 1": 0, "Week 2": 0, "Week 3": 0, "Future": 0 };
        const agingMap = { "Current": 0, "1-30 Days": 0, "31-60 Days": 0, "60+ Days": 0 };
        const debtorMap = {};
        let totalSum = 0;
        let recoverableSum = 0;

        const today = new Date();
        const next7 = new Date(); next7.setDate(today.getDate() + 7);
        const next14 = new Date(); next14.setDate(today.getDate() + 14);
        const next21 = new Date(); next21.setDate(today.getDate() + 21);

        snapshot.forEach(doc => {
          const d = doc.data();
          const amount = Number(d.total_open_amount || 0);
          totalSum += amount;

          // 1. RISK PIE
          const zone = d.zone || "GREEN";
          if (riskCounts[zone] !== undefined) riskCounts[zone]++;

          // 2. CASH FORECAST (Using ML Predicted Date)
          if (d.predicted_payment_date) {
            const predDate = new Date(d.predicted_payment_date);
            if (predDate <= next7) forecastMap["Week 1"] += amount;
            else if (predDate <= next14) forecastMap["Week 2"] += amount;
            else if (predDate <= next21) forecastMap["Week 3"] += amount;
            else forecastMap["Future"] += amount;
            
            // Only count "recoverable" if predicted delay is reasonable (< 90 days)
            if ((d.predicted_delay || 0) < 90) recoverableSum += amount;
          } else {
             forecastMap["Future"] += amount;
          }

          // 3. AGING BUCKETS
          const dueDate = d.due_date ? new Date(d.due_date) : new Date();
          const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
          
          if (daysOverdue <= 0) agingMap["Current"] += amount;
          else if (daysOverdue <= 30) agingMap["1-30 Days"] += amount;
          else if (daysOverdue <= 60) agingMap["31-60 Days"] += amount;
          else agingMap["60+ Days"] += amount;

          // 4. TOP DEBTORS
          const name = d.name_customer || d.company_name || "Unknown";
          if (!debtorMap[name]) debtorMap[name] = 0;
          debtorMap[name] += amount;
        });

        // --- FORMATTING DATA FOR RECHARTS ---

        // Pie Data
        const riskData = [
          { name: "Safe (Green)", value: riskCounts.GREEN, color: "#10b981" },
          { name: "Watch (Yellow)", value: riskCounts.YELLOW, color: "#f59e0b" },
          { name: "Priority (Orange)", value: riskCounts.ORANGE, color: "#f97316" },
          { name: "Critical (Red)", value: riskCounts.RED, color: "#ef4444" },
        ].filter(d => d.value > 0);

        // Forecast Data
        const forecastData = Object.keys(forecastMap).map(k => ({
            name: k, amount: forecastMap[k]
        }));

        // Aging Data
        const agingData = Object.keys(agingMap).map(k => ({
            name: k, amount: agingMap[k]
        }));

        // Top Debtors
        const topDebtors = Object.entries(debtorMap)
          .map(([name, amount]) => ({ name: name.substring(0, 15) + (name.length>15?'..':''), fullName: name, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        setStats({ riskData, forecastData, agingData, topDebtors, totalOutstanding: totalSum, totalPredictedRecoverable: recoverableSum });

      } catch (err) {
        console.error("Error loading analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div style={styles.loading}>Loading Intelligence...</div>;

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>📊 Financial Command Center</h1>
      
      {/* KPI CARDS */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Total Outstanding</div>
            <div style={styles.kpiValue}>${(stats.totalOutstanding / 1000000).toFixed(2)}M</div>
        </div>
        <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Projected Recovery (30 Days)</div>
            <div style={{...styles.kpiValue, color: '#10b981'}}>${(stats.totalPredictedRecoverable / 1000000).toFixed(2)}M</div>
        </div>
        <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Critical Cases (Red/Orange)</div>
            <div style={{...styles.kpiValue, color: '#ef4444'}}>
                {stats.riskData.find(x=>x.name.includes("Critical"))?.value || 0 + stats.riskData.find(x=>x.name.includes("Priority"))?.value || 0}
            </div>
        </div>
      </div>

      <div style={styles.grid}>
        
        {/* CHART 1: RISK EXPOSURE (PIE) */}
        <div style={styles.card}>
            <h3 style={styles.cardTitle}>🛡️ Risk Distribution</h3>
            <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={stats.riskData} innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                            {stats.riskData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* CHART 2: CASH FORECAST (BAR) */}
        <div style={styles.card}>
            <h3 style={styles.cardTitle}>🔮 ML Cash Forecast (Next 4 Weeks)</h3>
            <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={stats.forecastData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 12}} />
                        <YAxis tickFormatter={(val)=>`$${val/1000}k`} tick={{fontSize: 12}} />
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} cursor={{fill: '#f1f5f9'}} />
                        <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* CHART 3: AGING BUCKETS */}
        <div style={styles.card}>
            <h3 style={styles.cardTitle}>⏳ Aging Buckets (Debt Age)</h3>
            <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={stats.agingData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 12}} />
                        <YAxis tickFormatter={(val)=>`$${val/1000}k`} tick={{fontSize: 12}} />
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} cursor={{fill: '#f1f5f9'}} />
                        <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* CHART 4: TOP DEBTORS */}
        <div style={styles.card}>
            <h3 style={styles.cardTitle}>💰 Top 5 Debtors</h3>
            <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={stats.topDebtors} layout="vertical" margin={{left: 0, right: 30}}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} style={{fontSize: '11px', fontWeight: '500'}} />
                        <Tooltip cursor={{fill: '#f1f5f9'}} formatter={(value) => `$${value.toLocaleString()}`} labelFormatter={(l, p) => p[0]?.payload.fullName}/>
                        <Bar dataKey="amount" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

      </div>
    </div>
  );
};

const styles = {
  page: { width: "100%", padding: "40px", boxSizing: "border-box", minHeight: "100vh", background: "#f8fafc" },
  pageTitle: { margin: "0 0 30px 0", fontSize: "28px", color: "#1e293b", fontWeight: "800" },
  loading: { padding: "40px", textAlign: "center", color: "#64748b" },
  
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "30px" },
  kpiCard: { background: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  kpiLabel: { fontSize: "12px", textTransform: "uppercase", color: "#64748b", fontWeight: "600", marginBottom: "8px" },
  kpiValue: { fontSize: "32px", fontWeight: "800", color: "#0f172a" },

  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  card: { background: "white", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" },
  cardTitle: { margin: "0 0 20px 0", fontSize: "16px", color: "#334155", fontWeight: "700" }
};

export default Analytics;