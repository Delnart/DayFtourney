import React from 'react';
import { TournamentStageData } from '../types';
import { MatchNode } from './MatchNode';

interface BracketStage1Props {
  stage: TournamentStageData;
}

export const BracketStage1: React.FC<BracketStage1Props> = ({ stage }) => {
  if (!stage.generated) {
    return (
      <div className="empty-state">
        <h3>⏳ Stage 1 not generated yet</h3>
        <p>Wait for the tournament admins to start this stage.</p>
      </div>
    );
  }

  // Group rounds
  const rounds = stage.rounds.filter(r => r.bracket === 'UB');

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <h2 style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>
        <strong style={{ color: 'var(--text-main)' }}>Stage 1: Qualifiers</strong> • Single Elimination • Top {/* show bracket size / 2 */} advance
      </h2>

      <div className="bracket-wrapper" style={{ paddingTop: '4rem' }}>
        {rounds.map((round) => {
          const matches = round.matchIds.map(mid => stage.matches[mid]).filter(Boolean);

          return (
            <div
              key={round.id}
              className={`round-column ${matches.length === 1 ? 'straight-lines' : ''}`}
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

        {/* Qualified column */}
        {rounds.length > 0 && (
          <div className="round-column no-lines" style={{ minWidth: '220px' }}>
            <div className="round-title">✅ Advances to Stage 2</div>
            <div className="round-matches">
              {rounds[rounds.length - 1]?.matchIds.map((mid, i) => {
                const m = stage.matches[mid];
                const winner = m?.winnerId ? m.team1?.id === m.winnerId ? m.team1 : m.team2 : null;
                return (
                  <div key={`adv_${i}`} className="match-cell">
                    <div className="qualified-node">
                      {winner ? `🚀 ${winner.name}` : 'TBD'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
