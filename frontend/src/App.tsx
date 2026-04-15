import { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { BracketStage1 } from './components/BracketStage1';
import { BracketStage2 } from './components/BracketStage2';
import { BracketPlayoffs } from './components/BracketPlayoffs';
import { useTournamentData } from './hooks/useTournamentData';
import { AdminDashboard } from './pages/AdminPortal';
import logoSrc from './assets/Logo.png';

function BracketHome() {
  const [activeStage, setActiveStage] = useState<'stage1' | 'stage2' | 'playoffs'>('stage1');
  const { data, loading, error } = useTournamentData();

  const tournamentName = data.config?.name || 'Day F 2026';

  return (
    <div className="app-container">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div className="logo-container" style={{
            width: '90px', height: '90px',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--panel-bg)',
            border: '4px solid #111',
            boxShadow: '4px 4px 0 #111'
          }}>
            <img src={logoSrc} alt="FICE Logo" style={{ width: '86px', height: '86px', objectFit: 'contain' }} />
          </div>
          <div>
            <h1 style={{ marginBottom: 0 }}>{tournamentName}</h1>
            {error && (
              <p style={{ color: '#E75A4D', marginTop: '0.2rem', fontSize: '0.85rem' }}>
                Offline (API unavailable)
              </p>
            )}
          </div>
        </div>

        <div className="stage-switcher">
          <button
            className={`stage-btn ${activeStage === 'stage1' ? 'active' : ''}`}
            onClick={() => setActiveStage('stage1')}
          >
            Stage 1
          </button>
          <button
            className={`stage-btn ${activeStage === 'stage2' ? 'active' : ''}`}
            onClick={() => setActiveStage('stage2')}
          >
            Stage 2
          </button>
          <button
            className={`stage-btn ${activeStage === 'playoffs' ? 'active' : ''}`}
            onClick={() => setActiveStage('playoffs')}
          >
            Playoffs
          </button>
        </div>
      </header>

      <main>
        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚙️</div>
            <p>Connecting to tournament server...</p>
          </div>
        )}
        {!loading && activeStage === 'stage1' && <BracketStage1 stage={data.stage1} />}
        {!loading && activeStage === 'stage2' && <BracketStage2 stage={data.stage2} />}
        {!loading && activeStage === 'playoffs' && <BracketPlayoffs stage={data.stage2} />}
      </main>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<BracketHome />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
