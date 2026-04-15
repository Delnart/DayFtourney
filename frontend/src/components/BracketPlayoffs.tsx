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
        <h3>⏳ Day 4 finals not started yet</h3>
        <p>LAN finals will appear automatically once the online bracket reaches the final day.</p>
      </div>
    );
  }

  const finalsRounds = stage.rounds.filter(r => r.day === 4);
  const ubFinalRound = finalsRounds.find(r => r.bracket === 'UB');
  const lbFinalRound = finalsRounds.find(r => r.bracket === 'LB');
  const gfRound = finalsRounds.find(r => r.bracket === 'GF');

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
        <strong style={{ color: 'var(--text-main)' }}>Day 4: LAN Finals</strong> • BO3
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {ubFinalRound && (
          <div style={{ background: 'rgba(139, 92, 246, 0.04)', padding: '1.5rem', borderRadius: '16px', border: '4px solid rgba(139, 92, 246, 0.2)', boxShadow: '4px 4px 0 rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent)', fontFamily: 'var(--font-heading)', fontSize: '1.3rem' }}>⬆️ UPPER BRACKET FINAL</h3>
            <div className="bracket-wrapper no-lines" style={{ paddingTop: '0', minHeight: 'unset' }}>
              {renderRound(ubFinalRound, true)}
            </div>
          </div>
        )}

        {lbFinalRound && (
          <div style={{ background: 'rgba(231, 90, 77, 0.04)', padding: '1.5rem', borderRadius: '16px', border: '4px solid rgba(231, 90, 77, 0.2)', boxShadow: '4px 4px 0 rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginBottom: '1.5rem', color: '#E75A4D', fontFamily: 'var(--font-heading)', fontSize: '1.3rem' }}>🥉 LOWER BRACKET FINAL</h3>
            <div style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
              Winner advances to the Grand Final. Loser takes 3rd place.
            </div>
            <div className="bracket-wrapper no-lines" style={{ paddingTop: '0', minHeight: 'unset' }}>
              {renderRound(lbFinalRound, true)}
            </div>
          </div>
        )}

        {gfRound && (
          <div style={{ background: 'rgba(80, 200, 120, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '4px solid rgba(80, 200, 120, 0.3)', boxShadow: '4px 4px 0 #111' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--win-color)', fontFamily: 'var(--font-heading)', fontSize: '1.5rem' }}>🏆 GRAND FINAL</h3>
            <div className="bracket-wrapper no-lines" style={{ paddingTop: '0', minHeight: 'unset' }}>
              {renderRound(gfRound, true)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
