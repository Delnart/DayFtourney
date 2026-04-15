/**
 * Double Elimination Bracket Engine
 * Generates qualifiers down to 16 teams, then a fixed 16-team main event.
 *
 * Match ID scheme:
 *   Stage 1: 1..N (qualifiers)
 *   Stage 2: 17..46 (main event)
 *
 * Each match has: nextWinMatchId, nextLoseMatchId (null if eliminated)
 */

/**
 * Returns the smallest power of 2 >= n
 */
function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Generates a seeded list of [team1Idx, team2Idx] pairs for the first round
 * using standard tournament seeding (1 vs last, 2 vs second-to-last, etc.)
 * Teams beyond teamCount are "byes" (null).
 */
function generateFirstRoundPairs(teams, slotCount) {
  // Pad teams with byes to fill slotCount
  const padded = [...teams];
  while (padded.length < slotCount) padded.push(null);

  const pairs = [];
  const seeds = [];
  // Standard bracket seeding
  function seed(lo, hi) {
    if (lo === hi) { seeds.push(lo); return; }
    const mid = Math.floor((lo + hi) / 2);
    seed(lo, mid);
    seed(mid + 1, hi);
  }
  seed(0, slotCount - 1);

  for (let i = 0; i < seeds.length; i += 2) {
    pairs.push([padded[seeds[i]], padded[seeds[i + 1]]]);
  }

  // Flip so lower seed vs higher seed
  return pairs;
}

function getMatchWinnerTeam(match) {
  if (!match?.winnerId) return null;
  if (match.team1?.id === match.winnerId) return match.team1;
  if (match.team2?.id === match.winnerId) return match.team2;
  return null;
}

/**
 * Main function: generate the full bracket
 * @param {Array} teams - Array of { id, name, logoUrl }
 * @param {Object} options - { qualifierTeams: 16 } how many advance to main event
 * @returns {Object} { matches: Record<string, MatchDef>, rounds: RoundDef[] }
 */
function generateBracket(teams, options = {}) {
  const matches = {};
  const rounds = [];

  if (options.stageType === 'single') {
    const targetAdvanceCount = options.targetAdvanceCount || 16;
    return generateSingleElim(teams, targetAdvanceCount, matches, rounds);
  }

  return generateDoubleElim(teams, matches, rounds);
}

function createMatch(id, { team1, team2, roundName, bracket, bo, scheduledDate, streamUrl, nextWinMatchId, nextLoseMatchId }) {
  return {
    id,
    roundName,
    bracket,          // 'UB' | 'LB' | 'GF' | 'THIRD'
    bo: bo || 1,
    scheduledDate: scheduledDate || null,
    streamUrl: streamUrl || null,
    team1: team1 || null,
    team2: team2 || null,
    score1: null,
    score2: null,
    winnerId: null,
    loserId: null,
    state: (team1 || team2) ? ((team1 && team2) ? 'upcoming' : 'bye') : 'tbd',
    nextWinMatchId: nextWinMatchId || null,
    nextLoseMatchId: nextLoseMatchId || null,
  };
}

/**
 * Single elimination generator (for qualifier stage)
 */
function generateSingleElim(teams, targetAdvanceCount, matches, rounds) {
  if (teams.length <= targetAdvanceCount) {
    return { matches, rounds };
  }

  const roundSizes = [];
  let currentRoundSize = nextPowerOf2(teams.length);
  while (currentRoundSize > targetAdvanceCount) {
    roundSizes.push(currentRoundSize);
    currentRoundSize = Math.floor(currentRoundSize / 2);
  }

  const firstRoundPairs = generateFirstRoundPairs(teams, roundSizes[0]);
  let matchCounter = 1;

  roundSizes.forEach((roundSize, roundIndex) => {
    const matchCount = roundSize / 2;
    const matchIds = [];
    const roundStartId = matchCounter;
    const nextRound = roundSizes[roundIndex + 1];
    const nextRoundStartId = nextRound ? roundStartId + matchCount : null;
    const roundName = `Round of ${roundSize}`;

    for (let slot = 0; slot < matchCount; slot++) {
      const id = String(matchCounter++);
      matchIds.push(id);

      let team1 = null;
      let team2 = null;
      if (roundIndex === 0) {
        const pair = firstRoundPairs[slot] || [null, null];
        [team1, team2] = pair;
      }

      const nextWinMatchId = nextRoundStartId ? String(nextRoundStartId + Math.floor(slot / 2)) : null;

      matches[id] = createMatch(id, {
        team1,
        team2,
        roundName,
        bracket: 'UB',
        bo: 1,
        nextWinMatchId,
        nextLoseMatchId: null,
      });

      if (roundIndex === 0 && (!team1 || !team2)) {
        const winner = team1 || team2;
        matches[id].winnerId = winner?.id || null;
        matches[id].state = 'bye';
      }
    }

    rounds.push({
      id: `stage1_r${roundIndex + 1}`,
      name: roundName,
      bracket: 'UB',
      day: 1,
      matchIds,
    });
  });

  return { matches, rounds };
}

/**
 * Double elimination generator (for main event).
 * Fixed 16-team bracket with the exact 30-match main event structure.
 */
function generateDoubleElim(teams, matches, rounds) {
  const mainTeams = [...teams.slice(0, 16)];
  while (mainTeams.length < 16) mainTeams.push(null);

  const ro16Pairs = generateFirstRoundPairs(mainTeams, 16);

  const roundDefinitions = {
    ro16: { id: 'stage2_ro16', name: 'RO16 UB', bracket: 'UB', day: 2, matchIds: ['17', '18', '19', '20', '21', '22', '23', '24'] },
    lb1: { id: 'stage2_lb1', name: 'LB Stage 1', bracket: 'LB', day: 2, matchIds: ['25', '26', '27', '28'] },
    qf: { id: 'stage2_qf', name: 'Quarterfinal UB', bracket: 'UB', day: 2, matchIds: ['29', '30', '31', '32'] },
    lb2: { id: 'stage2_lb2', name: 'LB Stage 2', bracket: 'LB', day: 2, matchIds: ['33', '34', '35', '36'] },
    sf: { id: 'stage2_sf', name: 'Semifinal UB', bracket: 'UB', day: 3, matchIds: ['37', '38'] },
    lb3: { id: 'stage2_lb3', name: 'LB Stage 3', bracket: 'LB', day: 3, matchIds: ['39', '40'] },
    lb4: { id: 'stage2_lb4', name: 'LB Stage 4', bracket: 'LB', day: 3, matchIds: ['41', '42'] },
    lbSemi: { id: 'stage2_lbSemi', name: 'LB Semifinal', bracket: 'LB', day: 3, matchIds: ['43'] },
    ubFinal: { id: 'stage2_ubFinal', name: 'UB Final', bracket: 'UB', day: 4, matchIds: ['44'] },
    lbFinal: { id: 'stage2_lbFinal', name: 'LB Final (3rd Place)', bracket: 'LB', day: 4, matchIds: ['45'] },
    gf: { id: 'stage2_gf', name: 'Grand Final', bracket: 'GF', day: 4, matchIds: ['46'] },
  };

  const ro16NextLose = ['25', '26', '27', '28', '28', '27', '26', '25'];
  const qfNextLose = ['36', '35', '34', '33'];
  const sfNextLose = ['42', '41'];

  const createRoundMatches = (round, builder) => {
    round.matchIds.forEach((matchId, index) => {
      builder(matchId, index);
    });
    rounds.push(round);
  };

  createRoundMatches(roundDefinitions.ro16, (matchId, index) => {
    const pair = ro16Pairs[index] || [null, null];
    matches[matchId] = createMatch(matchId, {
      team1: pair[0],
      team2: pair[1],
      roundName: roundDefinitions.ro16.name,
      bracket: 'UB',
      bo: 1,
      nextWinMatchId: roundDefinitions.qf.matchIds[Math.floor(index / 2)],
      nextLoseMatchId: ro16NextLose[index] || null,
    });

    if (!pair[0] || !pair[1]) {
      const winner = pair[0] || pair[1];
      matches[matchId].winnerId = winner?.id || null;
      matches[matchId].state = 'bye';
    }
  });

  createRoundMatches(roundDefinitions.lb1, (matchId, index) => {
    matches[matchId] = createMatch(matchId, {
      team1: null,
      team2: null,
      roundName: roundDefinitions.lb1.name,
      bracket: 'LB',
      bo: 1,
      nextWinMatchId: roundDefinitions.lb2.matchIds[index],
      nextLoseMatchId: null,
    });
  });

  createRoundMatches(roundDefinitions.qf, (matchId, index) => {
    matches[matchId] = createMatch(matchId, {
      team1: null,
      team2: null,
      roundName: roundDefinitions.qf.name,
      bracket: 'UB',
      bo: 1,
      nextWinMatchId: roundDefinitions.sf.matchIds[Math.floor(index / 2)],
      nextLoseMatchId: qfNextLose[index] || null,
    });
  });

  createRoundMatches(roundDefinitions.lb2, (matchId, index) => {
    matches[matchId] = createMatch(matchId, {
      team1: null,
      team2: null,
      roundName: roundDefinitions.lb2.name,
      bracket: 'LB',
      bo: 1,
      nextWinMatchId: roundDefinitions.lb3.matchIds[Math.floor(index / 2)],
      nextLoseMatchId: null,
    });
  });

  createRoundMatches(roundDefinitions.sf, (matchId, index) => {
    matches[matchId] = createMatch(matchId, {
      team1: null,
      team2: null,
      roundName: roundDefinitions.sf.name,
      bracket: 'UB',
      bo: 1,
      nextWinMatchId: roundDefinitions.ubFinal.matchIds[0],
      nextLoseMatchId: sfNextLose[index] || null,
    });
  });

  createRoundMatches(roundDefinitions.lb3, (matchId, index) => {
    matches[matchId] = createMatch(matchId, {
      team1: null,
      team2: null,
      roundName: roundDefinitions.lb3.name,
      bracket: 'LB',
      bo: 1,
      nextWinMatchId: roundDefinitions.lb4.matchIds[index],
      nextLoseMatchId: null,
    });
  });

  createRoundMatches(roundDefinitions.lb4, (matchId, index) => {
    matches[matchId] = createMatch(matchId, {
      team1: null,
      team2: null,
      roundName: roundDefinitions.lb4.name,
      bracket: 'LB',
      bo: 1,
      nextWinMatchId: roundDefinitions.lbSemi.matchIds[0],
      nextLoseMatchId: null,
    });
  });

  createRoundMatches(roundDefinitions.lbSemi, (matchId) => {
    matches[matchId] = createMatch(matchId, {
      team1: null,
      team2: null,
      roundName: roundDefinitions.lbSemi.name,
      bracket: 'LB',
      bo: 1,
      nextWinMatchId: roundDefinitions.lbFinal.matchIds[0],
      nextLoseMatchId: null,
    });
  });

  createRoundMatches(roundDefinitions.ubFinal, (matchId) => {
    matches[matchId] = createMatch(matchId, {
      team1: null,
      team2: null,
      roundName: roundDefinitions.ubFinal.name,
      bracket: 'UB',
      bo: 3,
      nextWinMatchId: roundDefinitions.gf.matchIds[0],
      nextLoseMatchId: roundDefinitions.lbFinal.matchIds[0],
    });
  });

  createRoundMatches(roundDefinitions.lbFinal, (matchId) => {
    matches[matchId] = createMatch(matchId, {
      team1: null,
      team2: null,
      roundName: roundDefinitions.lbFinal.name,
      bracket: 'LB',
      bo: 3,
      nextWinMatchId: roundDefinitions.gf.matchIds[0],
      nextLoseMatchId: null,
    });
  });

  createRoundMatches(roundDefinitions.gf, (matchId) => {
    matches[matchId] = createMatch(matchId, {
      team1: null,
      team2: null,
      roundName: roundDefinitions.gf.name,
      bracket: 'GF',
      bo: 3,
      nextWinMatchId: null,
      nextLoseMatchId: null,
    });
  });

  return { matches, rounds };
}

/**
 * Process a match result: set winner/loser, advance teams to next matches.
 * @param {Object} tournament - full tournament data
 * @param {string} matchId
 * @param {string} winnerId - team ID of winner
 * @param {number} score1
 * @param {number} score2
 * @returns {Object} updated tournament
 */
function processMatchResult(tournament, matchId, winnerId, score1, score2) {
  const match = tournament.matches[matchId];
  if (!match) throw new Error(`Match ${matchId} not found`);

  const team1 = match.team1;
  const team2 = match.team2;
  if (!team1 || !team2) throw new Error(`Match ${matchId} missing teams`);

  const winner = team1.id === winnerId ? team1 : team2;
  const loser = team1.id === winnerId ? team2 : team1;

  match.winnerId = winner.id;
  match.loserId = loser.id;
  match.score1 = score1;
  match.score2 = score2;
  match.state = 'finished';

  // Advance winner to next match
  if (match.nextWinMatchId) {
    const nextWinMatch = tournament.matches[match.nextWinMatchId];
    if (nextWinMatch) {
      if (!nextWinMatch.team1) nextWinMatch.team1 = winner;
      else if (!nextWinMatch.team2) nextWinMatch.team2 = winner;
      if (nextWinMatch.team1 && nextWinMatch.team2 && nextWinMatch.state === 'tbd') {
        nextWinMatch.state = 'upcoming';
      }
    }
  }

  // Send loser to LB (if applicable)
  if (match.nextLoseMatchId) {
    const nextLoseMatch = tournament.matches[match.nextLoseMatchId];
    if (nextLoseMatch) {
      if (!nextLoseMatch.team1) nextLoseMatch.team1 = loser;
      else if (!nextLoseMatch.team2) nextLoseMatch.team2 = loser;
      if (nextLoseMatch.team1 && nextLoseMatch.team2 && nextLoseMatch.state === 'tbd') {
        nextLoseMatch.state = 'upcoming';
      }
    }
  }

  return tournament;
}

module.exports = { generateBracket, generateSingleElim, generateDoubleElim, processMatchResult, nextPowerOf2, getMatchWinnerTeam };
