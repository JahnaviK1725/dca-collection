import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

const DashboardCharts = () => {
  const [data, setData] = useState({ risk: [], topDebtors: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 1. Fetch only OPEN cases
        const q = query(collection(db, "cases"), where("isOpen", "==", '1'));
        const snapshot = await getDocs(q);
        
        const zoneCounts = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
        const debtorMap = {};

        snapshot.forEach(doc => {
          const d = doc.data();
          const amount = Number(d.total_open_amount || 0);
          
          // A. Risk Counts
          const zone = d.zone || "GREEN";
          if (zoneCounts[zone] !== undefined) zoneCounts[zone]++;

          // B. Debtor Aggregation
          const name = d.name_customer || d.company_name || "Unknown";
          if (!debtorMap[name]) debtorMap[name] = 0;
          debtorMap[name] += amount;
        });

        // --- FIXED: SEPARATED ORANGE AND RED ---
        const riskData = [
          { name: "Safe (Green)", value: zoneCounts.GREEN, color: "#10b981" },       // Emerald
          { name: "Watch (Yellow)", value: zoneCounts.YELLOW, color: "#f59e0b" },    // Amber
          { name: "Priority (Orange)", value: zoneCounts.ORANGE, color: "#f97316" }, // Orange
          { name: "Critical (Red)", value: zoneCounts.RED, color: "#ef4444" },       // Red
        ].filter(d => d.value > 0);

        // Format for Bar Chart (Top 5)
        const topDebtors = Object.entries(debtorMap)
          .map(([name, amount]) => ({ name: name.substring(0, 10) + '..', fullName: name, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        setData({ risk: riskData, topDebtors });
      } catch (err) {
        console.error("Error loading charts:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div style={styles.loading}>Loading Analytics...</div>;

  return (
    <div style={styles.container}>
      
      {/* CHART 1: RISK EXPOSURE */}
      <div style={styles.card}>
        <h3 style={styles.title}>🛡️ Portfolio Risk</h3>
        <div style={{ width: "100%", height: 250 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data.risk}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.risk.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} Cases`, "Count"]} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CHART 2: TOP DEBTORS */}
      <div style={styles.card}>
        <h3 style={styles.title}>💰 Top 5 Highest Balances</h3>
        <div style={{ width: "100%", height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={data.topDebtors} layout="vertical" margin={{left: 10, right: 30}}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={80} style={{fontSize: '11px'}} />
              <Tooltip 
                cursor={{fill: '#f1f5f9'}}
                formatter={(value) => [`$${value.toLocaleString()}`, "Debt"]}
                labelFormatter={(label, payload) => payload[0]?.payload.fullName}
              />
              <Bar dataKey="amount" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

const styles = {
  container: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "30px" },
  card: { background: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" },
  title: { margin: "0 0 20px 0", fontSize: "16px", color: "#1e293b", fontWeight: "600" },
  loading: { padding: "20px", color: "#64748b", fontSize: "14px", fontStyle: "italic" }
};

export default DashboardCharts;