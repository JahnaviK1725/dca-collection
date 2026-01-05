import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase.js";
import CaseTable from "../components/CaseTable.jsx";
import { getZone } from "../utils/zones";
import ZoneSummary from "../components/ZoneSummary.jsx";
import SlaBreachList from "../components/SlaBreachList.jsx";
import CallsOverview from "../components/CallsOverview.jsx";



/* =========================================================
   🔒 TIME ANCHOR (VERY IMPORTANT)
   Dataset is from 2019–2020, so we anchor time
========================================================= */
const REFERENCE_DATE = new Date(2020, 3, 30); // April 30, 2020

/* =========================================================
   ✅ CORRECT CSV DATE PARSER (YYYYMMDD)
========================================================= */
const parseYYYYMMDD = (value) => {
  if (!value) return null;

  const str = value.toString();
  if (str.length !== 8) return null;

  const year = Number(str.slice(0, 4));
  const month = Number(str.slice(4, 6)) - 1;
  const day = Number(str.slice(6, 8));

  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
};

/* =========================================================
   📊 DAYS OVERDUE (ANCHOR-BASED)
========================================================= */
const calculateDaysOverdue = (dueDate) => {
  if (!(dueDate instanceof Date)) return 0;

  const diffMs = REFERENCE_DATE - dueDate;
  return Math.max(0, Math.floor(diffMs / 86400000));
};

/* =========================================================
   🔮 MOCK ML (REALISTIC + SAFE)
========================================================= */
const mockPredictedClearDate = (daysOverdue, dueDate) => {
  const r = Math.random(); // 0 → 1

  // Pre-due → mostly GREEN
  if (REFERENCE_DATE < dueDate) {
    return new Date(dueDate.getTime() - 5 * 86400000);
  }

  // Recently due
  if (daysOverdue <= 10) {
    if (r < 0.7) {
      // 70% → YELLOW
      return new Date(REFERENCE_DATE.getTime() + 10 * 86400000);
    } else {
      // 30% → ORANGE
      return new Date(REFERENCE_DATE.getTime() + 90 * 86400000);
    }
  }

  // Moderately overdue
  if (daysOverdue <= 40) {
    if (r < 0.5) {
      // ORANGE
      return new Date(REFERENCE_DATE.getTime() + 90 * 86400000);
    } else {
      // RED
      return new Date(REFERENCE_DATE.getTime() + 150 * 86400000);
    }
  }

  // Heavily overdue → mostly RED
  return new Date(REFERENCE_DATE.getTime() + 180 * 86400000);
};

const MOCK_CALLS = [
  {
    id: "1",
    customer: "WAL-MART",
    outcome: "PROMISE_TO_PAY",
    timestamp: new Date("2020-04-30T10:00:00"),
    nextActionDate: new Date("2020-05-01"),
  },
  {
    id: "2",
    customer: "COSTCO",
    outcome: "NO_ANSWER",
    timestamp: new Date("2020-04-30T09:00:00"),
  },
];


/* =========================================================
   🧠 DASHBOARD
========================================================= */
const Dashboard = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoneFilter, setZoneFilter] = useState("ALL");


  useEffect(() => {
    const q = query(
      collection(db, "cases"),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = [];

        snapshot.docs.forEach((doc) => {
          try {
            const d = doc.data();

            // ✅ Correct due date
            const dueDate =
              parseYYYYMMDD(d.due_in_date) || REFERENCE_DATE;

            // ✅ Days overdue (anchored)
            const daysOverdue = calculateDaysOverdue(dueDate);

            // ✅ SLA = 60 days after due
            const SLA_date = new Date(
              dueDate.getTime() + 60 * 86400000
            );

            // ✅ Mock ML
            const predicted_clear_date =
              mockPredictedClearDate(daysOverdue, dueDate);

            // ✅ Zone logic
            const zone = getZone({
              due_date: dueDate,
              SLA_date,
              predicted_clear_date,
              today: REFERENCE_DATE,
            });

            rows.push({
              id: doc.id,
              invoice_id: d.invoice_id || doc.id,
              name_customer: d.name_customer || "—",
              total_open_amount: Number(d.total_open_amount) || 0,
              daysOverdue,
              zone,
            });
          } catch (e) {
            console.error("Skipping bad row:", doc.id, e);
          }
        });

        setCases(rows);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Firestore error:", err);
        setError("Failed to load cases");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredCases =
  zoneFilter === "ALL"
    ? cases
    : cases.filter((c) => c.zone === zoneFilter);

    const slaBreachedCases = cases.filter(
  (c) => c.zone === "RED"
);


  /* =========================================================
     UI STATES
  ========================================================= */
  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Loading cases…</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <h2>{error}</h2>
      </div>
    );
  }





 return (
  <div style={{ padding: 40 }}>
    <h1>DCA Dashboard ({cases.length} cases)</h1>

    <ZoneSummary cases={cases} />

    {/* MAIN CONTENT ROW */}
    <div
      style={{
        display: "flex",
        gap: 24,
        alignItems: "flex-start",
      }}
    >
      {/* LEFT: Filters + Table */}
      <div style={{ flex: 3 }}>
        {/* FILTER BUTTONS */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {["ALL", "RED", "ORANGE", "YELLOW"].map((zone) => {
            const isActive = zoneFilter === zone;

            return (
              <button
                key={zone}
                onClick={() => setZoneFilter(zone)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: "1px solid #ddd",
                  background: isActive ? "#111" : "#fff",
                  color: isActive ? "#fff" : "#333",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {zone}
              </button>
            );
          })}
        </div>

        {/* TABLE */}
        <CaseTable cases={filteredCases} />
      </div>

      {/* RIGHT: SLA BREACH LIST */}
      <div style={{ flex: 1 }}>
        <SlaBreachList cases={slaBreachedCases} />
        <CallsOverview calls={MOCK_CALLS} />


      </div>
    </div>
  </div>
);



};

export default Dashboard;
