/**
 * Double Elimination Bracket Engine
 * Generates a complete tournament bracket for N teams (any count).
 * Adds "bye" slots automatically if N is not a power of 2.
 *
 * Match ID scheme:
 *   UB: ub_r{round}_m{slot}
 *   LB: lb_r{round}_m{slot}
 *   GF: gf_1
 *   3rd: third_1
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

/**
 * Main function: generate the full bracket
 * @param {Array} teams - Array of { id, name, logoUrl }
 * @param {Object} options - { qualifierTeams: 16 } how many advance to main event
 * @returns {Object} { matches: Record<string, MatchDef>, rounds: RoundDef[] }
 */
function generateBracket(teams, options = {}) {
  const { stageType = 'double' } = options;
  const n = teams.length;
  const bracketSize = nextPowerOf2(n);
  const byes = bracketSize - n;

  const matches = {};
  const rounds = [];

  if (stageType === 'single') {
    return generateSingleElim(teams, bracketSize, matches, rounds);
  }

  return generateDoubleElim(teams, bracketSize, matches, rounds);
}

function createMatch(id, { team1, team2, roundName, bracket, bo, scheduledDate, nextWinMatchId, nextLoseMatchId }) {
  return {
    id,
    roundName,
    bracket,          // 'UB' | 'LB' | 'GF' | 'THIRD'
    bo: bo || 1,
    scheduledDate: scheduledDate || null,
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
function generateSingleElim(teams, bracketSize, matches, rounds) {
  const ubRound1Count = bracketSize / 2;
  const pairs = generateFirstRoundPairs(teams, bracketSize);
  let matchCounter = 1;

  // Build round structure bottom-up
  function buildUBRound(roundNum, count) {
    const roundMatches = [];
    for (let slot = 1; slot <= count; slot++) {
      const id = `ub_r${roundNum}_m${slot}`;
      roundMatches.push(id);
    }
    return roundMatches;
  }

  // Generate all UB round slot IDs
  const allRounds = [];
  let count = ubRound1Count;
  let r = 1;
  while (count >= 1) {
    allRounds.push({ round: r, count });
    count = Math.floor(count / 2);
    r++;
  }

  // Create matches from last round to first (to know nextWinMatchId)
  for (let ri = allRounds.length - 1; ri >= 0; ri--) {
    const { round, count } = allRounds[ri];
    const nextRound = allRounds[ri + 1];

    for (let slot = 1; slot <= count; slot++) {
      const id = `ub_r${round}_m${slot}`;
      const nextWinMatchId = nextRound
        ? `ub_r${nextRound.round}_m${Math.ceil(slot / 2)}`
        : null;

      let team1 = null, team2 = null;
      if (round === 1) {
        const pair = pairs[slot - 1];
        team1 = pair[0];
        team2 = pair[1];
      }

      // Handle byes: if one team is null, auto-advance the other
      if (round === 1 && (team1 === null || team2 === null)) {
        const winner = team1 || team2;
        matches[id] = createMatch(id, {
          team1, team2,
          roundName: `Round of ${bracketSize * 2}`,
          bracket: 'UB',
          nextWinMatchId,
          nextLoseMatchId: null,
          state: 'bye',
        });
        matches[id].winnerId = winner?.id || null;
        matches[id].state = 'bye';
      } else {
        matches[id] = createMatch(id, {
          team1,
          team2,
          roundName: round === allRounds.length ? 'Final' : `Round of ${bracketSize * 2 / Math.pow(2, round - 1)}`,
          bracket: 'UB',
          nextWinMatchId,
          nextLoseMatchId: null,
        });
      }
    }
    rounds.push({ id: `ub_r${round}`, name: `Round of ${bracketSize * 2 / Math.pow(2, round - 1)}`, bracket: 'UB' });
  }

  return { matches, rounds };
}

/**
 * Double elimination generator (for main event).
 * For N teams (must be power of 2).
 * UB has log2(N) rounds feeding into GF.
 * LB has 2*(log2(N)-1) rounds.
 */
function generateDoubleElim(teams, bracketSize, matches, rounds) {
  const n = bracketSize;
  const ubRounds = Math.log2(n); // e.g. 16 teams → 4 UB rounds
  const lbRounds = 2 * (ubRounds - 1); // e.g. 6 LB rounds

  const pairs = generateFirstRoundPairs(teams, n);

  // --- Build UB round structure ---
  // UB R1: n/2 matches, R2: n/4, ..., UB Final: 1 match
  const ubMatchIds = {};
  for (let r = 1; r <= ubRounds; r++) {
    const count = n / Math.pow(2, r);
    ubMatchIds[r] = [];
    for (let s = 1; s <= count; s++) {
      ubMatchIds[r].push(`ub_r${r}_m${s}`);
    }
  }

  // --- Build LB round structure ---
  // LB has 2*(ubRounds-1) rounds. Counts:
  // LB R1: n/4, LB R2: n/4, LB R3: n/8, LB R4: n/8, ...
  const lbMatchIds = {};
  let lbCount = n / 4;
  for (let r = 1; r <= lbRounds; r++) {
    lbMatchIds[r] = [];
    const count = r % 2 === 1 ? lbCount : lbCount; // same count for pairs of rounds
    for (let s = 1; s <= count; s++) {
      lbMatchIds[r].push(`lb_r${r}_m${s}`);
    }
    if (r % 2 === 0 && lbCount > 1) lbCount = Math.floor(lbCount / 2);
  }

  // GF and 3rd place
  const gfId = 'gf_1';
  const thirdId = 'third_1';

  // --- Create UB matches forward (R1 first, last round = UB Final) ---
  for (let r = 1; r <= ubRounds; r++) {
    const ids = ubMatchIds[r];
    const nextRoundIds = ubMatchIds[r + 1];
    // LB round that receives losers from UB round r
    const lbDropRound = r === 1 ? 1 : r * 2 - 2;

    ids.forEach((id, idx) => {
      const slot = idx + 1;
      const nextWinMatchId = r < ubRounds
        ? ubMatchIds[r + 1][Math.floor(idx / 2)]
        : gfId;

      // Losers from UB R1 → LB R1, UB R2 → LB R2, etc.
      const lbDropMatchIds = lbMatchIds[lbDropRound] || [];
      const nextLoseMatchId = lbDropMatchIds[Math.floor(idx / 2)] || null;

      let team1 = null, team2 = null;
      if (r === 1) {
        const pair = pairs[idx];
        team1 = pair ? pair[0] : null;
        team2 = pair ? pair[1] : null;
      }

      const roundName = r === ubRounds ? 'UB Final'
        : r === ubRounds - 1 ? 'UB Semifinals'
        : r === ubRounds - 2 ? 'UB Quarterfinals'
        : `UB Round ${r}`;

      matches[id] = createMatch(id, {
        team1, team2, roundName, bracket: 'UB',
        nextWinMatchId, nextLoseMatchId,
        bo: r >= ubRounds - 1 ? 3 : 1,
      });

      // Auto-advance byes
      if (r === 1 && (!team1 || !team2)) {
        const winner = team1 || team2;
        matches[id].winnerId = winner?.id || null;
        matches[id].state = 'bye';
      }
    });
    rounds.push({ id: `ub_r${r}`, name: ubMatchIds[r][0] ? matches[ubMatchIds[r][0]]?.roundName : `UB R${r}`, bracket: 'UB', matchIds: ids });
  }

  // --- Create LB matches ---
  for (let r = 1; r <= lbRounds; r++) {
    const ids = lbMatchIds[r];
    const nextRoundIds = lbMatchIds[r + 1] || [];
    const isLastLBRound = r === lbRounds;

    ids.forEach((id, idx) => {
      const nextWinMatchId = isLastLBRound
        ? gfId  // LB Final winner goes to GF
        : nextRoundIds[Math.floor(idx / 2)] || null;

      // Loser of first GF goes to 3rd place match if doing best-of-3 GF
      const roundName = isLastLBRound ? 'LB Final'
        : r === lbRounds - 1 ? 'LB Semifinals'
        : `LB Round ${r}`;

      matches[id] = createMatch(id, {
        team1: null, team2: null, roundName, bracket: 'LB',
        nextWinMatchId, nextLoseMatchId: null, // losers eliminated from LB
        bo: isLastLBRound || r === lbRounds - 1 ? 3 : 1,
      });
    });
    rounds.push({ id: `lb_r${r}`, name: matches[lbMatchIds[r][0]]?.roundName || `LB R${r}`, bracket: 'LB', matchIds: ids });
  }

  // --- Grand Final ---
  matches[gfId] = createMatch(gfId, {
    team1: null, team2: null, roundName: 'Grand Final',
    bracket: 'GF', bo: 3,
    nextWinMatchId: null, nextLoseMatchId: thirdId,
  });

  // --- 3rd Place ---
  matches[thirdId] = createMatch(thirdId, {
    team1: null, team2: null, roundName: '3rd Place',
    bracket: 'THIRD', bo: 3,
    nextWinMatchId: null, nextLoseMatchId: null,
  });

  rounds.push({ id: 'gf', name: 'Grand Final', bracket: 'GF', matchIds: [gfId] });
  rounds.push({ id: 'third', name: '3rd Place', bracket: 'THIRD', matchIds: [thirdId] });

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

module.exports = { generateBracket, generateSingleElim, generateDoubleElim, processMatchResult, nextPowerOf2 };
