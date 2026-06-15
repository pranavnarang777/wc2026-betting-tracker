import { useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import Dashboard from './pages/Dashboard.jsx';
import BetLog from './pages/BetLog.jsx';
import Analytics from './pages/Analytics.jsx';
import Briefing from './pages/Briefing.jsx';
import AddBetModal from './components/AddBetModal.jsx';

function Logo() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M32 8 L52 19 V37 C52 48 43 55 32 58 C21 55 12 48 12 37 V19 Z"
        stroke="#22E3A0" strokeWidth="3.5" strokeLinejoin="round"
      />
      <path d="M23 33 l6 6 12-15" stroke="#22E3A0" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const flash = useCallback((msg, isErr = false) => {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.listBets();
      setBets(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = useCallback(
    async (payload) => {
      const created = await api.createBet(payload);
      setBets((prev) => [created, ...prev]);
      flash('Bet added');
    },
    [flash],
  );

  const handleUpdate = useCallback(
    async (id, patch) => {
      const updated = await api.updateBet(id, patch);
      setBets((prev) => prev.map((b) => (b.id === id ? updated : b)));
      flash('Bet updated');
      return updated;
    },
    [flash],
  );

  const handleDelete = useCallback(
    async (id) => {
      await api.deleteBet(id);
      setBets((prev) => prev.filter((b) => b.id !== id));
      flash('Bet deleted');
    },
    [flash],
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark"><Logo /></div>
          <div>
            <div className="brand__name">Fore<span>cast</span></div>
            <div className="brand__tag">WC2026 · Data, models &amp; a small live bet</div>
          </div>
        </div>

        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Dashboard</NavLink>
          <NavLink to="/bets" className={({ isActive }) => (isActive ? 'active' : '')}>Bet Log</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => (isActive ? 'active' : '')}>Analytics</NavLink>
          <NavLink to="/briefing" className={({ isActive }) => (isActive ? 'active' : '')}>Briefing</NavLink>
        </nav>

        <div className="topbar__spacer" />
        <button className="btn btn--primary" onClick={() => setAddOpen(true)}>
          <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          <span className="btn-label">Add Bet</span>
        </button>
      </header>

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <div className="page">
          <div className="card card__pad empty">
            <p>Couldn’t reach the API.</p>
            <p className="muted" style={{ fontSize: 13 }}>{error}</p>
            <button className="btn" style={{ marginTop: 14 }} onClick={load}>Retry</button>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/" element={<Dashboard bets={bets} onAdd={() => setAddOpen(true)} />} />
          <Route
            path="/bets"
            element={<BetLog bets={bets} onUpdate={handleUpdate} onDelete={handleDelete} onAdd={() => setAddOpen(true)} flash={flash} />}
          />
          <Route path="/analytics" element={<Analytics bets={bets} />} />
          <Route path="/briefing" element={<Briefing flash={flash} />} />
        </Routes>
      )}

      {addOpen && (
        <AddBetModal
          onClose={() => setAddOpen(false)}
          onSave={handleCreate}
          flash={flash}
        />
      )}

      {toast && <div className={`toast ${toast.isErr ? 'err' : ''}`}>{toast.msg}</div>}
    </div>
  );
}
