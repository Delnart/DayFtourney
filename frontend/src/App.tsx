import { useState } from 'react';
import { BracketStage1 } from './components/BracketStage1';
import { BracketStage2 } from './components/BracketStage2';
import { BracketPlayoffs } from './components/BracketPlayoffs';
import { useTournamentData } from './hooks/useTournamentData';
import logoSrc from './assets/Logo.png';

function App() {
  const [activeStage, setActiveStage] = useState<'stage1' | 'stage2' | 'playoffs'>('stage1');
  const { data, loading, error, lastUpdated } = useTournamentData();

  const tournamentName = data.config?.name || 'Day F 2026';

  return (
    <div className="app-container">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div className="logo-container" style={{
            width: '90px', height: '90px',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.0)'
          }}>
            <img src={logoSrc} alt="FICE Logo" style={{ width: '86px', height: '86px', objectFit: 'contain' }} />
          </div>
          <div>
            <h1 style={{ marginBottom: 0 }}>{tournamentName}</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.85rem' }}>
              Official Tournament Bracket
            </p>
            {/* Live Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: error ? '#E75A4D' : '#50C878',
                display: 'inline-block',
                boxShadow: error ? 'none' : '0 0 6px #50C878',
              }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {loading ? 'Connecting...' : error ? 'Offline (API unavailable)' : `Live • Updated ${lastUpdated?.toLocaleTimeString()}`}
              </span>
            </div>
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

export default App;
