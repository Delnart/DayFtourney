import React from 'react';
import { TournamentStageData } from '../types';
import { MatchNode } from './MatchNode';

interface BracketPlayoffsProps {
  stage: TournamentStageData;
}

export const BracketPlayoffs: React.FC<BracketPlayoffsProps> = ({ stage }) => {
  if (!stage.generated) {
    return (
      <div className="empty-state">
        <h3>⏳ Playoffs not started yet</h3>
        <p>Playoffs will appear automatically once Stage 2 progresses.</p>
      </div>
    );
  }

  // GF + 3rd place are separate rounds
  const gfRound = stage.rounds.find(r => r.bracket === 'GF');
  const thirdRound = stage.rounds.find(r => r.bracket === 'THIRD');

  // The last UB rounds (SF, Final) and last LB rounds (SF, Final) also show here
  const ubFinalRounds = stage.rounds.filter(r => r.bracket === 'UB').slice(-2);
  const lbFinalRounds = stage.rounds.filter(r => r.bracket === 'LB').slice(-2);

  const renderRound = (round: typeof gfRound, noLines = false) => {
    if (!round) return null;
    const matches = round.matchIds.map(mid => stage.matches[mid]).filter(Boolean);
    return (
      <div
        className={`round-column ${matches.length === 1 ? 'straight-lines' : ''} ${noLines ? 'no-lines' : ''}`}
        style={{ minWidth: '300px' }}
      >
        <div className="round-title">{round.name}</div>
        <div className="round-matches">
          {matches.map(match => (
            <div key={match.id} className="match-cell">
              <MatchNode match={match} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <h2 style={{ marginBottom: '2rem', color: 'var(--text-muted)', fontWeight: 400 }}>
        <strong style={{ color: 'var(--text-main)' }}>Stage 3: Playoffs</strong> • LAN Finals
      </h2>

      {/* Upper Bracket Final stages */}
      <div style={{ background: 'rgba(139, 92, 246, 0.04)', padding: '2rem', borderRadius: '16px', border: '4px solid rgba(139, 92, 246, 0.2)', boxShadow: '4px 4px 0 rgba(0,0,0,0.15)', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '2rem', color: 'var(--accent)', fontFamily: 'var(--font-heading)', fontSize: '1.3rem' }}>⬆️ UPPER BRACKET FINALS</h3>
        <div className="bracket-wrapper" style={{ paddingTop: '3.5rem' }}>
          {ubFinalRounds.map((r, i) => renderRound(r, i === ubFinalRounds.length - 1))}
        </div>
      </div>

      {/* Lower Bracket Final stages */}
      {lbFinalRounds.length > 0 && (
        <div style={{ background: 'rgba(231, 90, 77, 0.04)', padding: '2rem', borderRadius: '16px', border: '4px solid rgba(231, 90, 77, 0.2)', boxShadow: '4px 4px 0 rgba(0,0,0,0.15)', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '2rem', color: '#E75A4D', fontFamily: 'var(--font-heading)', fontSize: '1.3rem' }}>⬇️ LOWER BRACKET FINALS</h3>
          <div className="bracket-wrapper" style={{ paddingTop: '3.5rem' }}>
            {lbFinalRounds.map((r, i) => renderRound(r, i === lbFinalRounds.length - 1))}
          </div>
        </div>
      )}

      {/* Grand Final + 3rd Place */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {gfRound && (
          <div style={{ background: 'rgba(80, 200, 120, 0.05)', padding: '2rem', borderRadius: '16px', border: '4px solid rgba(80, 200, 120, 0.3)', boxShadow: '4px 4px 0 #111' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--win-color)', fontFamily: 'var(--font-heading)', fontSize: '1.5rem' }}>🏆 GRAND FINAL</h3>
            <div className="bracket-wrapper no-lines" style={{ paddingTop: '0', minHeight: 'unset' }}>
              {renderRound(gfRound, true)}
            </div>
          </div>
        )}
        {thirdRound && (
          <div style={{ background: 'rgba(234, 178, 58, 0.05)', padding: '2rem', borderRadius: '16px', border: '4px solid rgba(234, 178, 58, 0.3)', boxShadow: '4px 4px 0 #111' }}>
            <h3 style={{ marginBottom: '1.5rem', color: '#EAB23A', fontFamily: 'var(--font-heading)', fontSize: '1.5rem' }}>🥉 3RD PLACE</h3>
            <div className="bracket-wrapper no-lines" style={{ paddingTop: '0', minHeight: 'unset' }}>
              {renderRound(thirdRound, true)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
