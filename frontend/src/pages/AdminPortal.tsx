import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTournamentData } from '../hooks/useTournamentData';
import { Match, Team, TournamentStageData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type AdminTab = 'matches' | 'teams' | 'tournament';
type StageKey = 'stage1' | 'stage2';

function getStageMatches(stage: TournamentStageData): Match[] {
  return stage.rounds.flatMap((round) => round.matchIds.map((matchId) => stage.matches[matchId]).filter(Boolean)) as Match[];
}

function summarizeStage(stage: TournamentStageData) {
  const matches = Object.values(stage.matches || {});
  return {
    generated: stage.generated,
    total: matches.length,
    finished: matches.filter((match) => match.state === 'finished').length,
    upcoming: matches.filter((match) => match.state === 'upcoming').length,
    tbd: matches.filter((match) => match.state === 'tbd').length,
  };
}

function formatTeamLabel(team: Team | null | undefined) {
  return team ? `${team.name} (${team.id})` : 'TBD';
}

function parseCommaSeparatedIds(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const cardStyle: CSSProperties = {
  background: '#FFF',
  border: '4px solid #111',
  borderRadius: '16px',
  boxShadow: '4px 4px 0 #111',
  padding: '1.25rem',
};

const subtleCardStyle: CSSProperties = {
  background: 'rgba(0, 0, 0, 0.03)',
  border: '2px solid #111',
  borderRadius: '12px',
  padding: '1rem',
};

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  border: '2px solid #111',
  borderRadius: '8px',
  background: '#FFF',
};

const secondaryButtonStyle: CSSProperties = {
  background: '#F6F0E1',
  color: '#111',
  padding: '0.75rem 1rem',
  border: '3px solid #111',
  borderRadius: '8px',
  cursor: 'pointer',
  fontFamily: 'var(--font-heading)',
  boxShadow: '2px 2px 0 #111',
};

const successButtonStyle: CSSProperties = {
  background: '#50C878',
  color: '#111',
  padding: '0.75rem 1rem',
  border: '3px solid #111',
  borderRadius: '8px',
  cursor: 'pointer',
  fontFamily: 'var(--font-heading)',
  boxShadow: '2px 2px 0 #111',
};

const dangerButtonStyle: CSSProperties = {
  background: '#E75A4D',
  color: '#FFF',
  padding: '0.75rem 1rem',
  border: '3px solid #111',
  borderRadius: '8px',
  cursor: 'pointer',
  fontFamily: 'var(--font-heading)',
  boxShadow: '2px 2px 0 #111',
};

export function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('matches');
  const [selectedStage, setSelectedStage] = useState<StageKey>('stage1');
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(0);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamLogoUrl, setTeamLogoUrl] = useState('');
  const [teamDay, setTeamDay] = useState('');
  const [matchTeam1Id, setMatchTeam1Id] = useState('');
  const [matchTeam2Id, setMatchTeam2Id] = useState('');
  const [matchScheduledDate, setMatchScheduledDate] = useState('');
  const [matchBo, setMatchBo] = useState(1);
  const [matchStreamUrl, setMatchStreamUrl] = useState('');
  const [winnerId, setWinnerId] = useState('');
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [tournamentName, setTournamentName] = useState('');
  const [adminRoleIdsInput, setAdminRoleIdsInput] = useState('');

  const { data, loading: dataLoading, refetch } = useTournamentData();
  const teams = Object.values(data.teams || {});
  const sortedTeams = [...teams].sort((left, right) => left.name.localeCompare(right.name));
  const stageData = data[selectedStage];
  const stageMatches = getStageMatches(stageData);
  const selectedMatch = stageMatches[selectedMatchIdx] ?? null;
  const matchReadyForResult = !!selectedMatch?.team1 && !!selectedMatch?.team2 && selectedMatch.state !== 'finished';
  const selectedTeam = selectedTeamId ? teams.find((team) => team.id === selectedTeamId) ?? null : null;
  const stage1Summary = summarizeStage(data.stage1);
  const stage2Summary = summarizeStage(data.stage2);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (!urlToken) return;

    setLoading(true);
    fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: urlToken }),
    })
      .then((res) => res.json())
      .then((res) => {
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
  }, [searchParams, navigate]);

  useEffect(() => {
    if (!tournamentName && data.config?.name) {
      setTournamentName(data.config.name);
    }
    if (!adminRoleIdsInput && data.config?.adminRoleIds) {
      setAdminRoleIdsInput((data.config.adminRoleIds || []).join(', '));
    }
  }, [data.config?.name, data.config?.adminRoleIds]);

  useEffect(() => {
    const match = stageMatches[selectedMatchIdx] ?? null;
    if (!match) {
      setMatchTeam1Id('');
      setMatchTeam2Id('');
      setMatchScheduledDate('');
      setMatchBo(1);
      setMatchStreamUrl('');
      setWinnerId('');
      setScore1(0);
      setScore2(0);
      return;
    }

    setMatchTeam1Id(match.team1?.id || '');
    setMatchTeam2Id(match.team2?.id || '');
    setMatchScheduledDate(match.scheduledDate || '');
    setMatchBo(match.bo || 1);
    setMatchStreamUrl(match.streamUrl || '');
    setWinnerId(match.winnerId || '');
    setScore1(match.score1 ?? 0);
    setScore2(match.score2 ?? 0);
  }, [selectedStage, selectedMatchIdx, selectedMatch?.id]);

  useEffect(() => {
    if (!selectedTeamId) {
      setTeamName('');
      setTeamLogoUrl('');
      setTeamDay('');
      return;
    }

    const team = teams.find((item) => item.id === selectedTeamId);
    if (!team) return;

    setTeamName(team.name);
    setTeamLogoUrl(team.logoUrl || '');
    setTeamDay(team.day || '');
  }, [selectedTeamId]);

  async function apiRequest(path: string, method: string, body?: unknown) {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || `Request failed (${response.status})`);
    }

    return payload;
  }

  async function runAction(action: string, handler: () => Promise<void>) {
    setBusyAction(action);
    try {
      await handler();
    } finally {
      setBusyAction(null);
    }
  }

  function selectStage(nextStage: StageKey) {
    setSelectedStage(nextStage);
    setSelectedMatchIdx(0);
  }

  function clearTeamForm() {
    setSelectedTeamId('');
    setTeamName('');
    setTeamLogoUrl('');
    setTeamDay('');
  }

  function selectTeam(team: Team) {
    setSelectedTeamId(team.id);
    setTeamName(team.name);
    setTeamLogoUrl(team.logoUrl || '');
    setTeamDay(team.day || '');
    setActiveTab('teams');
  }

  function clearMatchForm() {
    setMatchTeam1Id('');
    setMatchTeam2Id('');
    setMatchScheduledDate('');
    setMatchBo(1);
    setMatchStreamUrl('');
    clearResultFields();
  }

  function clearResultFields() {
    setWinnerId('');
    setScore1(0);
    setScore2(0);
  }

  function handleMatchSelection(index: number) {
    setSelectedMatchIdx(index);
  }

  async function handleSaveTeam() {
    await runAction('team-save', async () => {
      const payload = {
        name: teamName.trim(),
        logoUrl: teamLogoUrl.trim() || null,
        day: teamDay.trim() || null,
      };

      if (!payload.name) {
        throw new Error('Team name is required');
      }

      const endpoint = selectedTeamId ? `/api/teams/${selectedTeamId}` : '/api/teams';
      const method = selectedTeamId ? 'PATCH' : 'POST';
      const result = await apiRequest(endpoint, method, payload);

      if (result.team) {
        if (selectedTeamId) {
          setTeamName(result.team.name);
          setTeamLogoUrl(result.team.logoUrl || '');
          setTeamDay(result.team.day || '');
        } else {
          clearTeamForm();
        }
      }

      await refetch();
      alert(selectedTeamId ? 'Team updated.' : 'Team added.');
    });
  }

  async function handleDeleteTeam(team: Team) {
    if (!window.confirm(`Delete team "${team.name}"?`)) return;

    await runAction(`team-delete-${team.id}`, async () => {
      await apiRequest(`/api/teams/${team.id}`, 'DELETE');
      if (selectedTeamId === team.id) clearTeamForm();
      await refetch();
      alert('Team deleted.');
    });
  }

  async function handleAssignMatch() {
    if (!selectedMatch) return;

    await runAction('match-assign', async () => {
      await apiRequest('/api/matches/assign', 'PATCH', {
        stage: selectedStage,
        matchId: selectedMatch.id,
        team1Id: matchTeam1Id || null,
        team2Id: matchTeam2Id || null,
      });
      await refetch();
      clearResultFields();
      alert('Match pairing updated. Downstream matches were cleared.');
    });
  }

  async function handleSaveMatchDetails() {
    if (!selectedMatch) return;

    await runAction('match-details', async () => {
      await apiRequest('/api/matches/schedule', 'PATCH', {
        stage: selectedStage,
        matchId: selectedMatch.id,
        scheduledDate: matchScheduledDate.trim() || null,
        bo: matchBo,
        streamUrl: matchStreamUrl.trim() || null,
      });
      await refetch();
      alert('Match details saved.');
    });
  }

  async function handleSubmitResult() {
    if (!selectedMatch || !matchReadyForResult || !winnerId) return;

    await runAction('match-result', async () => {
      await apiRequest('/api/matches/result', 'POST', {
        stage: selectedStage,
        matchId: selectedMatch.id,
        winnerId,
        score1,
        score2,
      });
      await refetch();
      alert('Match result posted.');
    });
  }

  async function handleClearResult() {
    if (!selectedMatch) return;
    if (!window.confirm('Clear this result and all downstream match placements?')) return;

    await runAction('match-clear', async () => {
      await apiRequest('/api/matches/result', 'DELETE', {
        stage: selectedStage,
        matchId: selectedMatch.id,
      });
      await refetch();
      clearResultFields();
      alert('Match result cleared.');
    });
  }

  async function handleSaveTournamentConfig() {
    await runAction('config-save', async () => {
      const payload = {
        name: tournamentName.trim(),
        adminRoleIds: parseCommaSeparatedIds(adminRoleIdsInput),
      };

      if (!payload.name) {
        throw new Error('Tournament name is required');
      }

      await apiRequest('/api/tournament/config', 'PATCH', payload);
      await refetch();
      alert('Tournament config saved.');
    });
  }

  async function handleGenerateStage(stage: StageKey) {
    await runAction(`generate-${stage}`, async () => {
      if (!window.confirm(`Generate ${stage === 'stage1' ? 'Stage 1' : 'Stage 2'}? This will overwrite the current bracket.`)) {
        return;
      }

      await apiRequest(`/api/tournament/generate/${stage}`, 'POST');
      await refetch();
      alert(`${stage === 'stage1' ? 'Stage 1' : 'Stage 2'} generated.`);
    });
  }

  async function handleResetTournament() {
    if (!window.confirm('Reset all tournament data? This will remove teams and brackets.')) return;

    await runAction('reset-tournament', async () => {
      await apiRequest('/api/tournament/reset', 'POST');
      await refetch();
      clearTeamForm();
      clearMatchForm();
      alert('Tournament reset.');
    });
  }

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

  const tabButtonStyle: CSSProperties = {
    fontSize: '0.95rem',
    padding: '0.65rem 1.2rem',
  };

  const renderTabBar = () => (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
      <button className={`stage-btn ${activeTab === 'matches' ? 'active' : ''}`} style={tabButtonStyle} onClick={() => setActiveTab('matches')}>
        Matches
      </button>
      <button className={`stage-btn ${activeTab === 'teams' ? 'active' : ''}`} style={tabButtonStyle} onClick={() => setActiveTab('teams')}>
        Teams
      </button>
      <button className={`stage-btn ${activeTab === 'tournament' ? 'active' : ''}`} style={tabButtonStyle} onClick={() => setActiveTab('tournament')}>
        Tournament
      </button>
    </div>
  );

  const renderMatchesTab = () => {
    if (!stageData.generated && stageMatches.length === 0) {
      return (
        <div style={cardStyle}>
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.75rem' }}>No matches yet</h3>
          <p style={{ color: '#444' }}>Generate a bracket from the Tournament tab, then edit pairings and results here.</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={cardStyle}>
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Match Browser</h3>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button className={`stage-btn ${selectedStage === 'stage1' ? 'active' : ''}`} style={tabButtonStyle} onClick={() => selectStage('stage1')}>
              Stage 1
            </button>
            <button className={`stage-btn ${selectedStage === 'stage2' ? 'active' : ''}`} style={tabButtonStyle} onClick={() => selectStage('stage2')}>
              Stage 2
            </button>
          </div>

          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Select Match</label>
          <select
            value={selectedMatchIdx}
            onChange={(event) => handleMatchSelection(Number(event.target.value))}
            style={fieldStyle}
          >
            {stageMatches.map((match, index) => (
              <option key={match.id} value={index}>
                [{match.id}] {match.roundName} - {formatTeamLabel(match.team1)} vs {formatTeamLabel(match.team2)} ({match.state})
              </option>
            ))}
            {stageMatches.length === 0 && <option value={0}>No matches available</option>}
          </select>
        </div>

        {selectedMatch ? (
          <>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.25rem' }}>{selectedMatch.roundName}</h3>
                  <div style={{ color: '#444' }}>
                    Match [{selectedMatch.id}] · {selectedMatch.state}
                  </div>
                </div>
                {selectedMatch.streamUrl && (
                  <a href={selectedMatch.streamUrl} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-heading)', color: '#111' }}>
                    Open stream
                  </a>
                )}
              </div>

              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Team 1</label>
                  <select value={matchTeam1Id} onChange={(event) => setMatchTeam1Id(event.target.value)} style={fieldStyle}>
                    <option value="">TBD</option>
                    {sortedTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Team 2</label>
                  <select value={matchTeam2Id} onChange={(event) => setMatchTeam2Id(event.target.value)} style={fieldStyle}>
                    <option value="">TBD</option>
                    {sortedTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={busyAction === 'match-assign'}
                  onClick={handleAssignMatch}
                  style={successButtonStyle}
                >
                  {busyAction === 'match-assign' ? 'Saving...' : 'Save Pairing'}
                </button>
                <button
                  type="button"
                  disabled={busyAction === 'match-clear'}
                  onClick={handleClearResult}
                  style={dangerButtonStyle}
                >
                  {busyAction === 'match-clear' ? 'Clearing...' : 'Clear Result'}
                </button>
              </div>
              <p style={{ marginTop: '0.75rem', color: '#555' }}>Changing a pairing clears all downstream placements from this match.</p>
            </div>

            <div style={cardStyle}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Scheduling + Stream</h3>
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Scheduled Date</label>
                  <input
                    type="text"
                    value={matchScheduledDate}
                    onChange={(event) => setMatchScheduledDate(event.target.value)}
                    placeholder="25.04 18:00"
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>BO Format</label>
                  <select value={matchBo} onChange={(event) => setMatchBo(Number(event.target.value))} style={fieldStyle}>
                    <option value={1}>BO1</option>
                    <option value={3}>BO3</option>
                    <option value={5}>BO5</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Stream URL</label>
                <input
                  type="url"
                  value={matchStreamUrl}
                  onChange={(event) => setMatchStreamUrl(event.target.value)}
                  placeholder="https://..."
                  style={fieldStyle}
                />
              </div>
              <div style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  disabled={busyAction === 'match-details'}
                  onClick={handleSaveMatchDetails}
                  style={successButtonStyle}
                >
                  {busyAction === 'match-details' ? 'Saving...' : 'Save Match Details'}
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Result Editor</h3>
              {!matchReadyForResult && (
                <div style={{ ...subtleCardStyle, color: '#444', marginBottom: '1rem' }}>
                  This match is not ready for result entry yet. Assign both teams first.
                </div>
              )}

              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Winner</label>
                  <select value={winnerId} onChange={(event) => setWinnerId(event.target.value)} style={fieldStyle}>
                    <option value="">-- Choose Winner --</option>
                    <option value={selectedMatch.team1?.id || ''} disabled={!selectedMatch.team1}>
                      {selectedMatch.team1?.name || 'Team 1'}
                    </option>
                    <option value={selectedMatch.team2?.id || ''} disabled={!selectedMatch.team2}>
                      {selectedMatch.team2?.name || 'Team 2'}
                    </option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Score 1</label>
                  <input type="number" min="0" value={score1} onChange={(event) => setScore1(Number(event.target.value))} style={fieldStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Score 2</label>
                  <input type="number" min="0" value={score2} onChange={(event) => setScore2(Number(event.target.value))} style={fieldStyle} />
                </div>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={busyAction === 'match-result' || !matchReadyForResult}
                  onClick={handleSubmitResult}
                  style={successButtonStyle}
                >
                  {busyAction === 'match-result' ? 'Posting...' : 'Submit Result'}
                </button>
                <button
                  type="button"
                  disabled={busyAction === 'match-clear'}
                  onClick={handleClearResult}
                  style={secondaryButtonStyle}
                >
                  Clear Result
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={cardStyle}>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.75rem' }}>No match selected</h3>
            <p style={{ color: '#444' }}>Generate a bracket first, then use the match editor to manage pairings and results.</p>
          </div>
        )}
      </div>
    );
  };

  const renderTeamsTab = () => (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <div style={cardStyle}>
        <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>
          {selectedTeam ? 'Edit Team' : 'Add Team'}
        </h3>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Team Name</label>
            <input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Team name" style={fieldStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Logo URL</label>
            <input value={teamLogoUrl} onChange={(event) => setTeamLogoUrl(event.target.value)} placeholder="https://..." style={fieldStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Day / Group</label>
            <input value={teamDay} onChange={(event) => setTeamDay(event.target.value)} placeholder="Day 1 / A / Seed" style={fieldStyle} />
          </div>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" disabled={busyAction === 'team-save'} onClick={handleSaveTeam} style={successButtonStyle}>
            {busyAction === 'team-save' ? 'Saving...' : selectedTeam ? 'Update Team' : 'Add Team'}
          </button>
          <button type="button" onClick={clearTeamForm} style={secondaryButtonStyle}>
            New Team
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Existing Teams</h3>
        {sortedTeams.length === 0 ? (
          <p style={{ color: '#444' }}>No teams registered yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {sortedTeams.map((team) => (
              <div key={team.id} style={{ ...subtleCardStyle, display: 'grid', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-heading)' }}>{team.name}</div>
                    <div style={{ color: '#555', fontSize: '0.9rem' }}>{team.id}</div>
                    {team.day && <div style={{ color: '#555', fontSize: '0.9rem' }}>Day: {team.day}</div>}
                  </div>
                  {team.logoUrl && (
                    <a href={team.logoUrl} target="_blank" rel="noreferrer" style={{ color: '#111', fontWeight: 'bold' }}>
                      Logo
                    </a>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => selectTeam(team)} style={secondaryButtonStyle}>
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busyAction === `team-delete-${team.id}`}
                    onClick={() => handleDeleteTeam(team)}
                    style={dangerButtonStyle}
                  >
                    {busyAction === `team-delete-${team.id}` ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTournamentTab = () => (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <div style={cardStyle}>
        <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Tournament Config</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Tournament Name</label>
            <input value={tournamentName} onChange={(event) => setTournamentName(event.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.35rem' }}>Admin Role IDs</label>
            <input
              value={adminRoleIdsInput}
              onChange={(event) => setAdminRoleIdsInput(event.target.value)}
              placeholder="1234567890, 2345678901"
              style={fieldStyle}
            />
          </div>
        </div>
        <p style={{ color: '#555', marginTop: '0.75rem' }}>The tournament structure is fixed to qualifiers down to Top 16, then a 16-team double elimination bracket.</p>
        <div style={{ marginTop: '1rem' }}>
          <button type="button" disabled={busyAction === 'config-save'} onClick={handleSaveTournamentConfig} style={successButtonStyle}>
            {busyAction === 'config-save' ? 'Saving...' : 'Save Config'}
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Bracket Controls</h3>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={subtleCardStyle}>
            <strong>Stage 1</strong>
            <div style={{ color: '#555' }}>
              {stage1Summary.generated ? `Generated · ${stage1Summary.finished}/${stage1Summary.total} finished` : 'Not generated'}
            </div>
          </div>
          <div style={subtleCardStyle}>
            <strong>Stage 2</strong>
            <div style={{ color: '#555' }}>
              {stage2Summary.generated ? `Generated · ${stage2Summary.finished}/${stage2Summary.total} finished` : 'Not generated'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" disabled={busyAction === 'generate-stage1'} onClick={() => handleGenerateStage('stage1')} style={successButtonStyle}>
            {busyAction === 'generate-stage1' ? 'Generating...' : 'Generate Stage 1'}
          </button>
          <button type="button" disabled={busyAction === 'generate-stage2'} onClick={() => handleGenerateStage('stage2')} style={successButtonStyle}>
            {busyAction === 'generate-stage2' ? 'Generating...' : 'Generate Stage 2'}
          </button>
          <button type="button" disabled={busyAction === 'reset-tournament'} onClick={handleResetTournament} style={dangerButtonStyle}>
            {busyAction === 'reset-tournament' ? 'Resetting...' : 'Reset Tournament'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1280px', margin: '3rem auto', padding: '2rem', background: '#F4EEDD', borderRadius: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', color: '#111', marginBottom: '0.5rem' }}>🛡️ Admin Panel</h2>
          <p style={{ color: '#444' }}>Manage teams, pairings, results, and tournament controls from one place.</p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('adminToken');
            setToken('');
          }}
          style={dangerButtonStyle}
        >
          Logout
        </button>
      </div>

      {renderTabBar()}

      {activeTab === 'matches' && renderMatchesTab()}
      {activeTab === 'teams' && renderTeamsTab()}
      {activeTab === 'tournament' && renderTournamentTab()}
    </div>
  );
}
