import React from 'react';
import { Match } from '../types';

interface MatchNodeProps {
  match: Match;
}

function TeamRow({ team, score, isWinner, isLoser }: { team: { name: string } | null; score: number | null; isWinner: boolean; isLoser: boolean }) {
  const name = team?.name ?? 'TBD';
  const isTbd = !team;

  return (
    <div className={`team-row ${isWinner ? 'winner' : ''} ${isLoser ? 'loser' : ''}`}>
      <div className="team-info">
        <div className="team-logo">{name.charAt(0)}</div>
        <span className="team-name">{name}</span>
        {isLoser && (
          <span className="loser-tag">↓ LB</span>
        )}
      </div>
      <span className="team-score">
        {score !== null && score !== undefined ? score : (isTbd ? '–' : '?')}
      </span>
    </div>
  );
}

export const MatchNode: React.FC<MatchNodeProps> = ({ match }) => {
  const isTbd = !match.team1 && !match.team2;
  const isBye = match.state === 'bye';
  const isFinished = match.state === 'finished';
  const bo = match.bo || 1;

  if (isTbd) {
    return (
      <div className="match-node tbd-node">
        <div className="match-node-header">
          <span className="bo-badge">BO{bo}</span>
          {match.scheduledDate && <span className="schedule-badge">📅 {match.scheduledDate}</span>}
        </div>
        <div className="team-row"><div className="team-info"><div className="team-logo">?</div><span className="team-name">TBD</span></div><span className="team-score">–</span></div>
        <div className="team-row"><div className="team-info"><div className="team-logo">?</div><span className="team-name">TBD</span></div><span className="team-score">–</span></div>
      </div>
    );
  }

  if (isBye) {
    const advancer = match.team1 || match.team2;
    return (
      <div className="match-node bye-node">
        <div className="match-node-header">
          <span className="bye-badge">BYE</span>
        </div>
        <div className="team-row winner">
          <div className="team-info"><div className="team-logo">{advancer?.name.charAt(0) ?? '?'}</div><span className="team-name">{advancer?.name ?? 'TBD'}</span></div>
          <span className="team-score">✓</span>
        </div>
        <div className="team-row loser">
          <div className="team-info"><div className="team-logo">–</div><span className="team-name">No opponent</span></div>
          <span className="team-score">–</span>
        </div>
      </div>
    );
  }

  const t1IsWinner = isFinished && match.winnerId === match.team1?.id;
  const t2IsWinner = isFinished && match.winnerId === match.team2?.id;
  const t1IsLoser = isFinished && !t1IsWinner && !!match.nextLoseMatchId;
  const t2IsLoser = isFinished && !t2IsWinner && !!match.nextLoseMatchId;

  return (
    <div className={`match-node ${isFinished ? 'finished' : ''}`}>
      <div className="match-node-header">
        <span className="bo-badge">BO{bo}</span>
        {match.scheduledDate && <span className="schedule-badge">📅 {match.scheduledDate}</span>}
        {match.streamUrl && (
          <a className="stream-badge" href={match.streamUrl} target="_blank" rel="noreferrer">
            📺 Stream
          </a>
        )}
        {match.bracket === 'LB' && <span className="bracket-badge lb">LB</span>}
        {match.bracket === 'UB' && <span className="bracket-badge ub">UB</span>}
        {match.bracket === 'GF' && <span className="bracket-badge gf">GF</span>}
      </div>
      <TeamRow team={match.team1} score={match.score1} isWinner={t1IsWinner} isLoser={t1IsLoser} />
      <TeamRow team={match.team2} score={match.score2} isWinner={t2IsWinner} isLoser={t2IsLoser} />
    </div>
  );
};
