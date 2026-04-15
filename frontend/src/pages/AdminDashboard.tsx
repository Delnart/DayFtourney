import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTournamentData } from '../hooks/useTournamentData';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { data, loading: dataLoading, refetch } = useTournamentData();
  
  // Variables for match form
  const [selectedStage, setSelectedStage] = useState<'stage1' | 'stage2'>('stage1');
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(0);
  const [winnerId, setWinnerId] = useState('');
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setLoading(true);
      fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: urlToken })
      })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          localStorage.setItem('adminToken', res.sessionToken);
          setToken(res.sessionToken);
          navigate('/admin', { replace: true });
        } else {
          setError(res.error || 'Failed to authenticate');
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    }
  }, [searchParams, navigate]);

  if (loading || dataLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: '2rem', color: '#E75A4D' }}>Error: {error}</div>;
  }

  if (!token) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#fff' }}>
        <h2>Unauthorized Area</h2>
        <p>Please use the <code>/admin</code> command in Discord to receive a login link.</p>
      </div>
    );
  }

  const stageData = data[selectedStage];
  if (!stageData || !stageData.generated) {
    return <div style={{ padding: '2rem', color: '#fff' }}>Stage not generated yet.</div>;
  }

  const matches = Object.values(stageData.matches || {});
  // Pick active matches (not finished, not bye, not undefined team)
  const activeMatches = matches.filter(m => m.state !== 'bye' && m.state !== 'finished' && m.team1 && m.team2);

  const handleResultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const match = activeMatches[selectedMatchIdx];
    if (!match || !winnerId) return;

    try {
      const res = await fetch(`${API_URL}/api/matches/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          stage: selectedStage,
          matchId: match.id,
          winnerId,
          score1: score1,
          score2: score2
        })
      });
      const resData = await res.json();
      if (resData.success) {
        alert('Match result posted successfully!');
        refetch(); // Reload data
      } else {
        alert('Error: ' + resData.error);
      }
    } catch(err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '3rem auto', padding: '2rem', background: '#FFF', borderRadius: '16px', boxShadow: '4px 4px 0 #111', border: '4px solid #111' }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', color: '#111', marginBottom: '1rem' }}>🛡️ Admin Panel</h2>
      <button onClick={() => { localStorage.removeItem('adminToken'); setToken(''); }} style={{ marginBottom: '2rem', background: '#E75A4D', color: '#FFF', border: '2px solid #111', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
        Logout
      </button>

      <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Enter Match Result</h3>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className={`stage-btn ${selectedStage === 'stage1' ? 'active' : ''}`} onClick={() => setSelectedStage('stage1')}>Stage 1</button>
        <button className={`stage-btn ${selectedStage === 'stage2' ? 'active' : ''}`} onClick={() => setSelectedStage('stage2')}>Stage 2</button>
      </div>

      <form onSubmit={handleResultSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold' }}>Select Match</label>
          <select value={selectedMatchIdx} onChange={e => setSelectedMatchIdx(e.target.value as any)} style={{ width: '100%', padding: '0.5rem', border: '2px solid #111', borderRadius: '4px' }}>
            {activeMatches.map((m, idx) => (
              <option key={m.id} value={idx}>
                [{m.id}] {m.team1?.name} vs {m.team2?.name}
              </option>
            ))}
            {activeMatches.length === 0 && <option value="">No pending matches</option>}
          </select>
        </div>

        {activeMatches[selectedMatchIdx] && (
          <>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold' }}>Select Winner</label>
              <select value={winnerId} onChange={e => setWinnerId(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '2px solid #111', borderRadius: '4px' }}>
                <option value="">-- Choose Winner --</option>
                <option value={activeMatches[selectedMatchIdx].team1?.id}>{activeMatches[selectedMatchIdx].team1?.name}</option>
                <option value={activeMatches[selectedMatchIdx].team2?.id}>{activeMatches[selectedMatchIdx].team2?.name}</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 'bold' }}>{activeMatches[selectedMatchIdx].team1?.name} Score</label>
                <input type="number" min="0" value={score1} onChange={e => setScore1(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', border: '2px solid #111', borderRadius: '4px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 'bold' }}>{activeMatches[selectedMatchIdx].team2?.name} Score</label>
                <input type="number" min="0" value={score2} onChange={e => setScore2(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', border: '2px solid #111', borderRadius: '4px' }} />
              </div>
            </div>

            <button type="submit" style={{ background: '#50C878', color: '#111', padding: '1rem', border: '3px solid #111', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-heading)', marginTop: '1rem', boxShadow: '2px 2px 0 #111' }}>
              Submit Result
            </button>
          </>
        )}
      </form>
    </div>
  );
}
