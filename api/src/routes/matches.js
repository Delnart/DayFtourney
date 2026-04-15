const { Router } = require('express');
const { requireApiKey } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { validate, z } = require('../middleware/validate');
const { loadData, saveData } = require('../db');
const { processMatchResult } = require('../bracketEngine');

// For webhook sending
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const sendWebhook = async (match, stage, winnerId) => {
  if (!webhookUrl) return;
  try {
    const isStage1 = stage === 'stage1';
    const stageName = isStage1 ? "Stage 1: Qualifiers" : "Stage 2: Main Event";
    const teams = Object.values((await loadData()).teams);
    const w = teams.find(t => t.id === winnerId);
    
    // We do a simple discord api post
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: `Match Result - ${stageName}`,
          description: `**Winner:** ${w?.name || 'TBD'}\n**Score:** ${match.score1 ?? '?'} - ${match.score2 ?? '?'}`,
          color: 0x50C878, // Green
          footer: { text: "Official Tournament Bracket • Auto-posted" }
        }]
      })
    });
  } catch(e) {
    console.error("Webhook failed to send", e);
  }
};

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
    const updated = processMatchResult(stageData, matchId, winnerId, score1 ?? null, score2 ?? null);
    data[stage] = updated;
    await saveData(data);
    await sendWebhook(data[stage].matches[matchId], stage, winnerId);
    res.json({ success: true, match: data[stage].matches[matchId] });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PATCH /api/matches/schedule
router.patch('/schedule', requireApiKey, writeLimiter, validate(ScheduleSchema), async (req, res) => {
  const { stage, matchId, scheduledDate, bo } = req.body;
  const data = await loadData();

  const match = data[stage]?.matches?.[matchId];
  if (!match) return res.status(404).json({ error: 'Match not found' });

  if (scheduledDate !== undefined) match.scheduledDate = scheduledDate;
  if (bo !== undefined) match.bo = bo;
  await saveData(data);
  res.json({ success: true, match });
});

module.exports = router;
