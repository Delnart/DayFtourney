const { Router } = require('express');
const { requireApiKey } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { validate, z } = require('../middleware/validate');
const { loadData, saveData } = require('../db');

const router = Router();

const TeamSchema = z.object({
  name: z.string().min(1).max(64),
  logoUrl: z.string().url().optional().nullable(),
  day: z.string().max(32).optional().nullable(),
});

const TeamUpdateSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  logoUrl: z.string().url().optional().nullable(),
  day: z.string().max(32).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided',
});

function syncTeamReferences(data, team) {
  for (const stageKey of ['stage1', 'stage2']) {
    const stage = data[stageKey];
    if (!stage?.matches) continue;

    for (const match of Object.values(stage.matches)) {
      if (match.team1?.id === team.id) {
        match.team1 = { ...match.team1, ...team };
      }
      if (match.team2?.id === team.id) {
        match.team2 = { ...match.team2, ...team };
      }
    }
  }
}

function findTeamReferences(data, teamId) {
  const references = [];
  for (const stageKey of ['stage1', 'stage2']) {
    const stage = data[stageKey];
    if (!stage?.matches) continue;

    for (const match of Object.values(stage.matches)) {
      if (match.team1?.id === teamId || match.team2?.id === teamId) {
        references.push(`${stageKey}:${match.id}`);
      }
    }
  }
  return references;
}

// GET /api/teams
router.get('/', async (req, res) => {
  const data = await loadData();
  res.json(Object.values(data.teams));
});

// POST /api/teams
router.post('/', requireApiKey, writeLimiter, validate(TeamSchema), async (req, res) => {
  const { name, logoUrl, day } = req.body;
  const data = await loadData();

  // Prevent duplicate names
  const duplicate = Object.values(data.teams).find(t => t.name.toLowerCase() === name.toLowerCase());
  if (duplicate) return res.status(409).json({ error: `Team "${name}" already exists` });

  const id = `team_${Date.now()}`;
  data.teams[id] = { id, name, logoUrl: logoUrl ?? null, day: day ?? null };
  await saveData(data);
  res.status(201).json({ success: true, team: data.teams[id] });
});

// PATCH /api/teams/:id
router.patch('/:id', requireApiKey, writeLimiter, validate(TeamUpdateSchema), async (req, res) => {
  const data = await loadData();
  const team = data.teams[req.params.id];
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const { name, logoUrl, day } = req.body;

  if (name && Object.values(data.teams).some(t => t.id !== team.id && t.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: `Team "${name}" already exists` });
  }

  if (name !== undefined) team.name = name;
  if (logoUrl !== undefined) team.logoUrl = logoUrl ?? null;
  if (day !== undefined) team.day = day ?? null;

  syncTeamReferences(data, team);
  await saveData(data);
  res.json({ success: true, team });
});

// DELETE /api/teams/:id
router.delete('/:id', requireApiKey, writeLimiter, async (req, res) => {
  const data = await loadData();
  const team = data.teams[req.params.id];
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const references = findTeamReferences(data, team.id);
  if (references.length > 0) {
    return res.status(409).json({
      error: `Team is used in ${references.length} match(es). Clear or reassign those matches before deleting.`,
    });
  }

  delete data.teams[req.params.id];
  await saveData(data);
  res.json({ success: true, deleted: team });
});

module.exports = router;
