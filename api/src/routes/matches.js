const { Router } = require('express');
const { requireApiKey } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { validate, z } = require('../middleware/validate');
const { loadData, saveData } = require('../db');
const { processMatchResult } = require('../bracketEngine');

const router = Router();

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
  scheduledDate: z.string().max(64).optional(),
  bo: z.number().int().min(1).max(5).optional(),
});

// POST /api/matches/result
router.post('/result', requireApiKey, writeLimiter, validate(ResultSchema), (req, res) => {
  const { stage, matchId, winnerId, score1, score2 } = req.body;
  const data = loadData();

  const stageData = data[stage];
  if (!stageData?.generated) {
    return res.status(400).json({ error: `Stage "${stage}" is not generated yet` });
  }
  if (!stageData.matches[matchId]) {
    return res.status(404).json({ error: `Match "${matchId}" not found` });
  }

  try {
    const updated = processMatchResult(stageData, matchId, winnerId, score1 ?? null, score2 ?? null);
    data[stage] = updated;
    saveData(data);
    res.json({ success: true, match: data[stage].matches[matchId] });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PATCH /api/matches/schedule
router.patch('/schedule', requireApiKey, writeLimiter, validate(ScheduleSchema), (req, res) => {
  const { stage, matchId, scheduledDate, bo } = req.body;
  const data = loadData();

  const match = data[stage]?.matches?.[matchId];
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (scheduledDate !== undefined) match.scheduledDate = scheduledDate;
  if (bo !== undefined) match.bo = bo;
  saveData(data);
  res.json({ success: true, match });
});

module.exports = router;
