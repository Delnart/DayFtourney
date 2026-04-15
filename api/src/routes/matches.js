const { Router } = require('express');
const { requireApiKey } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { validate, z } = require('../middleware/validate');
const { loadData, saveData } = require('../db');
const { processMatchResult } = require('../bracketEngine');

const router = Router();

function deriveMatchState(match) {
  if (match.team1 && match.team2) return 'upcoming';
  if (match.team1 || match.team2) return 'bye';
  return 'tbd';
}

function resetMatch(match, keepTeams = false) {
  if (!keepTeams) {
    match.team1 = null;
    match.team2 = null;
  }
  match.score1 = null;
  match.score2 = null;
  match.winnerId = null;
  match.loserId = null;
  match.state = deriveMatchState(match);
}

function clearDownstream(stageData, matchId, visited = new Set()) {
  if (!matchId || visited.has(matchId)) return;
  visited.add(matchId);

  const match = stageData.matches[matchId];
  if (!match) return;

  for (const childId of [match.nextWinMatchId, match.nextLoseMatchId]) {
    if (!childId) continue;
    clearDownstream(stageData, childId, visited);
    const child = stageData.matches[childId];
    if (child) resetMatch(child, false);
  }
}

const ResultSchema = z.object({
  stage: z.enum(['stage1', 'stage2']),
  matchId: z.string().min(1),
  winnerId: z.string().min(1),
  score1: z.number().int().min(0).nullable().optional(),
  score2: z.number().int().min(0).nullable().optional(),
});

const ScheduleSchema = z.object({
  stage: z.enum(['stage1', 'stage2']),
  matchId: z.string().min(1),
  scheduledDate: z.union([z.string().max(64), z.null()]).optional(),
  bo: z.number().int().min(1).max(5).optional(),
  streamUrl: z.union([z.string().trim().url().max(512), z.null()]).optional(),
});

const AssignSchema = z.object({
  stage: z.enum(['stage1', 'stage2']),
  matchId: z.string().min(1),
  team1Id: z.string().min(1).nullable().optional(),
  team2Id: z.string().min(1).nullable().optional(),
});

// POST /api/matches/result
router.post('/result', requireApiKey, writeLimiter, validate(ResultSchema), async (req, res) => {
  const { stage, matchId, winnerId, score1, score2 } = req.body;
  const data = await loadData();

  const stageData = data[stage];
  if (!stageData?.generated) {
    return res.status(400).json({ error: `Stage "${stage}" is not generated yet` });
  }
  if (!stageData.matches[matchId]) {
    return res.status(404).json({ error: `Match "${matchId}" not found` });
  }

  try {
    clearDownstream(stageData, matchId);
    const updated = processMatchResult(stageData, matchId, winnerId, score1 ?? null, score2 ?? null);
    data[stage] = updated;
    await saveData(data);
    res.json({ success: true, match: data[stage].matches[matchId] });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/matches/result
router.delete('/result', requireApiKey, writeLimiter, async (req, res) => {
  const { stage, matchId } = req.body || {};
  if (!stage || !matchId) {
    return res.status(400).json({ error: 'Stage and matchId are required' });
  }

  const data = await loadData();
  const stageData = data[stage];
  if (!stageData?.generated) {
    return res.status(400).json({ error: `Stage "${stage}" is not generated yet` });
  }

  const match = stageData.matches[matchId];
  if (!match) {
    return res.status(404).json({ error: `Match "${matchId}" not found` });
  }

  clearDownstream(stageData, matchId);
  resetMatch(match, true);
  await saveData(data);
  res.json({ success: true, match });
});

// PATCH /api/matches/assign
router.patch('/assign', requireApiKey, writeLimiter, validate(AssignSchema), async (req, res) => {
  const { stage, matchId, team1Id, team2Id } = req.body;
  const data = await loadData();
  const stageData = data[stage];

  if (!stageData?.generated) {
    return res.status(400).json({ error: `Stage "${stage}" is not generated yet` });
  }

  const match = stageData.matches[matchId];
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (team1Id && team2Id && team1Id === team2Id) {
    return res.status(400).json({ error: 'Team 1 and Team 2 cannot be the same team' });
  }

  const team1 = team1Id ? data.teams[team1Id] || null : null;
  const team2 = team2Id ? data.teams[team2Id] || null : null;

  if (team1Id && !team1) return res.status(404).json({ error: `Team "${team1Id}" not found` });
  if (team2Id && !team2) return res.status(404).json({ error: `Team "${team2Id}" not found` });

  clearDownstream(stageData, matchId);
  match.team1 = team1;
  match.team2 = team2;
  resetMatch(match, true);
  await saveData(data);
  res.json({ success: true, match });
});

// PATCH /api/matches/schedule
router.patch('/schedule', requireApiKey, writeLimiter, validate(ScheduleSchema), async (req, res) => {
  const { stage, matchId, scheduledDate, bo, streamUrl } = req.body;
  const data = await loadData();

  const match = data[stage]?.matches?.[matchId];
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (scheduledDate !== undefined) match.scheduledDate = scheduledDate;
  if (bo !== undefined) match.bo = bo;
  if (streamUrl !== undefined) match.streamUrl = streamUrl;
  await saveData(data);
  res.json({ success: true, match });
});

module.exports = router;
