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

// GET /api/teams
router.get('/', (req, res) => {
  const data = loadData();
  res.json(Object.values(data.teams));
});

// POST /api/teams
router.post('/', requireApiKey, writeLimiter, validate(TeamSchema), (req, res) => {
  const { name, logoUrl, day } = req.body;
  const data = loadData();

  // Prevent duplicate names
  const duplicate = Object.values(data.teams).find(t => t.name.toLowerCase() === name.toLowerCase());
  if (duplicate) return res.status(409).json({ error: `Team "${name}" already exists` });

  const id = `team_${Date.now()}`;
  data.teams[id] = { id, name, logoUrl: logoUrl ?? null, day: day ?? null };
  saveData(data);
  res.status(201).json({ success: true, team: data.teams[id] });
});

// DELETE /api/teams/:id
router.delete('/:id', requireApiKey, writeLimiter, (req, res) => {
  const data = loadData();
  if (!data.teams[req.params.id]) return res.status(404).json({ error: 'Team not found' });
  const team = data.teams[req.params.id];
  delete data.teams[req.params.id];
  saveData(data);
  res.json({ success: true, deleted: team });
});

module.exports = router;
