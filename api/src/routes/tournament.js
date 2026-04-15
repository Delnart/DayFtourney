const { Router } = require('express');
const { requireApiKey } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { validate, z } = require('../middleware/validate');
const { loadData, saveData } = require('../db');
const { generateBracket, nextPowerOf2, getMatchWinnerTeam } = require('../bracketEngine');

const router = Router();

const ConfigSchema = z.object({
  name: z.string().max(128).optional(),
  stage1Advance: z.number().int().min(2).max(64).optional(),
  adminRoleIds: z.array(z.string()).optional(),
});

// GET /api/tournament
router.get('/', async (req, res) => {
  res.json(await loadData());
});

// POST /api/tournament/generate/:stage
router.post('/generate/:stage', requireApiKey, writeLimiter, async (req, res) => {
  const stage = req.params.stage;
  if (!['stage1', 'stage2'].includes(stage)) {
    return res.status(400).json({ error: 'Invalid stage. Use stage1 or stage2' });
  }

  const data = await loadData();

  if (stage === 'stage1') {
    const teams = Object.values(data.teams);
    if (teams.length < 2) return res.status(400).json({ error: 'Need at least 2 teams to generate bracket' });

    const { matches, rounds } = generateBracket(teams, { stageType: 'single', targetAdvanceCount: 16 });
    data.stage1 = { generated: true, matches, rounds };
    await saveData(data);
    return res.json({
      success: true,
      stage: 'stage1',
      teamCount: teams.length,
      bracketSize: Math.max(16, nextPowerOf2(teams.length)),
      matchCount: Object.keys(matches).length,
    });
  }

  if (stage === 'stage2') {
    const stage1Rounds = data.stage1?.rounds || [];
    const hasQualifierRounds = data.stage1.generated && stage1Rounds.length > 0;

    let s2Teams;
    if (hasQualifierRounds) {
      const lastRound = stage1Rounds[stage1Rounds.length - 1];
      const advancers = [];

      lastRound.matchIds?.forEach(mid => {
        const match = data.stage1.matches[mid];
        const winner = getMatchWinnerTeam(match);
        if (winner) advancers.push(winner);
      });

      if (advancers.length !== 16) {
        return res.status(400).json({
          error: `Stage 1 must finish with exactly 16 advancers before Stage 2 can be generated (currently ${advancers.length})`,
        });
      }

      s2Teams = advancers;
    } else {
      s2Teams = Object.values(data.teams);
      if (s2Teams.length > 16) {
        return res.status(400).json({ error: 'Generate stage1 first to reduce the field to 16 teams' });
      }
    }

    if (s2Teams.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 teams to generate the main event' });
    }

    const { matches, rounds } = generateBracket(s2Teams, { stageType: 'double' });
    data.stage2 = { generated: true, matches, rounds };
    await saveData(data);
    return res.json({
      success: true,
      stage: 'stage2',
      teamCount: s2Teams.length,
      bracketSize: 16,
      matchCount: Object.keys(matches).length,
    });
  }
});

// POST /api/tournament/reset
router.post('/reset', requireApiKey, writeLimiter, async (req, res) => {
  const data = await loadData();
  data.teams = {};
  data.stage1 = { generated: false, matches: {}, rounds: [] };
  data.stage2 = { generated: false, matches: {}, rounds: [] };
  await saveData(data);
  res.json({ success: true, message: 'Tournament reset' });
});

// PATCH /api/tournament/config
router.patch('/config', requireApiKey, writeLimiter, validate(ConfigSchema), async (req, res) => {
  const data = await loadData();
  Object.assign(data.config, req.body);
  await saveData(data);
  res.json({ success: true, config: data.config });
});

module.exports = router;
