import React, { useState } from 'react';
import { TournamentStageData } from '../types';
import { MatchNode } from './MatchNode';

interface BracketStage2Props {
  stage: TournamentStageData;
}

export const BracketStage2: React.FC<BracketStage2Props> = ({ stage }) => {
  const [view, setView] = useState<'UB' | 'LB'>('UB');

  if (!stage.generated) {
    return (
      <div className="empty-state">
        <h3>⏳ Stage 2 not generated yet</h3>
        <p>Use <code>/tournament generate stage2</code> in Discord after Stage 1 is complete.</p>
      </div>
    );
  }

  const ubRounds = stage.rounds.filter(r => r.bracket === 'UB');
  const lbRounds = stage.rounds.filter(r => r.bracket === 'LB');

  const renderBracket = (rounds: typeof ubRounds) => (
    <div className="bracket-wrapper" style={{ paddingTop: '4rem' }}>
      {rounds.map((round, rIdx) => {
        const matches = round.matchIds.map(mid => stage.matches[mid]).filter(Boolean);
        const isOnly = matches.length === 1;
        const isLast = rIdx === rounds.length - 1;

        return (
          <div
            key={round.id}
            className={`round-column ${isOnly ? 'straight-lines' : ''} ${isLast ? 'no-lines' : ''}`}
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
      })}
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', fontWeight: 400 }}>
        <strong style={{ color: 'var(--text-main)' }}>Stage 2: Main Event</strong> • Double Elimination
      </h2>

      {/* UB / LB Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        <button
          className={`stage-btn ${view === 'UB' ? 'active' : ''}`}
          style={{ fontSize: '0.9rem', padding: '0.5rem 1.5rem' }}
          onClick={() => setView('UB')}
        >
          ⬆️ Upper Bracket
        </button>
        <button
          className={`stage-btn ${view === 'LB' ? 'active' : ''}`}
          style={{ fontSize: '0.9rem', padding: '0.5rem 1.5rem' }}
          onClick={() => setView('LB')}
        >
          ⬇️ Lower Bracket
        </button>
      </div>

      {view === 'UB' && (
        <div style={{ background: 'rgba(139, 92, 246, 0.04)', padding: '2rem', borderRadius: '16px', border: '4px solid rgba(139, 92, 246, 0.2)', boxShadow: '4px 4px 0 rgba(0,0,0,0.15)' }}>
          <h3 style={{ marginBottom: '2rem', color: 'var(--accent)', fontFamily: 'var(--font-heading)', fontSize: '1.4rem' }}>
            ⬆️ UPPER BRACKET
          </h3>
          {renderBracket(ubRounds)}
        </div>
      )}

      {view === 'LB' && (
        <div style={{ background: 'rgba(231, 90, 77, 0.04)', padding: '2rem', borderRadius: '16px', border: '4px solid rgba(231, 90, 77, 0.2)', boxShadow: '4px 4px 0 rgba(0,0,0,0.15)' }}>
          <h3 style={{ marginBottom: '2rem', color: 'var(--accent)', fontFamily: 'var(--font-heading)', fontSize: '1.4rem' }}>
            ⬇️ LOWER BRACKET
          </h3>
          {lbRounds.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>No lower bracket matches yet — losers will appear here after UB results are entered.</p>
          ) : renderBracket(lbRounds)}
        </div>
      )}
    </div>
  );
};
