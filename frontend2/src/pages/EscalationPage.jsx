import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import "./EscalationPage.css";

const EscalationPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""); // 🔍 NEW
  const navigate = useNavigate();

  // ======================
  // FETCH RED CASES
  // ======================
  useEffect(() => {
    const q = query(collection(db, "cases"), where("zone", "==", "RED"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ======================
  // FILTER BY AGENT NAME
  // ======================
  const filteredTasks = tasks.filter((t) =>
    (t.assigned_agent_name || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // ======================
  // RENDER
  // ======================
  return (
    <div className="escalation-page">
      <div className="escalation-container">
        {/* HEADER */}
        <div className="escalation-header">
          <div>
            <h1 className="escalation-title">Escalation Control Tower</h1>
            <p className="escalation-subtitle">
              Overseeing {tasks.length} critical breaches across the recovery
              network.
            </p>
          </div>

          {/* 🔍 SEARCH BAR */}
          <input
            type="text"
            placeholder="Search by agent name…"
            className="agent-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* CONTENT */}
        {loading ? (
          <p>Loading escalations…</p>
        ) : filteredTasks.length === 0 ? (
          <p className="no-results">No cases found for this agent.</p>
        ) : (
          <div className="escalation-grid">
            {filteredTasks.map((t) => (
              <div key={t.id} className="escalation-card">
                {/* CARD HEADER */}
                <div className="card-header">
                  <div className="client-name">
                    {t.name_customer || "Unknown Client"}
                  </div>
                  <span className="risk-critical">CRITICAL</span>
                </div>

                {/* AMOUNT */}
                <div>
                  <div className="amount-label">Total Outstanding</div>
                  <div className="amount">
                    ₹{Math.round(t.total_open_amount || 0).toLocaleString()}
                  </div>
                  <div className="delay">
                    +{Math.round(t.predicted_delay || 0)} days delay
                  </div>
                </div>

                {/* FOOTER */}
                <div className="card-footer">
                  <div className="agent-row">
                    {t.assigned_agent_photo && (
                      <img
                        src={t.assigned_agent_photo}
                        alt={t.assigned_agent_name}
                        className="agent-avatar"
                      />
                    )}
                    <div className="agent-name">
                      Agent: {t.assigned_agent_name || "Unassigned"}
                    </div>
                  </div>

                  <button
                    className="view-btn"
                    onClick={() =>
                      navigate(`/case/${t.invoice_id || t.id}`)
                    }
                  >
                    View Case →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EscalationPage;
