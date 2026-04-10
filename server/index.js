const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { generateBracket, processMatchResult, nextPowerOf2 } = require('./bracketEngine');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'tournament.json');

app.use(cors());
app.use(express.json());

// --- Helpers ---

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function checkAdminKey(req, res) {
  const key = req.headers['x-api-key'];
  if (!process.env.API_SECRET || key === process.env.API_SECRET) return true;
  res.status(401).json({ error: 'Unauthorized' });
  return false;
}

// --- Routes ---

// GET /api/tournament — full state
app.get('/api/tournament', (req, res) => {
  try {
    const data = loadData();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// POST /api/team — add a team
app.post('/api/team', (req, res) => {
  if (!checkAdminKey(req, res)) return;
  const { id, name, logoUrl, day } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const data = loadData();
  const teamId = id || `team_${Date.now()}`;
  data.teams[teamId] = { id: teamId, name, logoUrl: logoUrl || null, day: day || null };
  saveData(data);
  res.json({ success: true, team: data.teams[teamId] });
});

// DELETE /api/team/:id — remove a team
app.delete('/api/team/:id', (req, res) => {
  if (!checkAdminKey(req, res)) return;
  const data = loadData();
  delete data.teams[req.params.id];
  saveData(data);
  res.json({ success: true });
});

// POST /api/tournament/generate/:stage — generate bracket for stage1 or stage2
app.post('/api/tournament/generate/:stage', (req, res) => {
  if (!checkAdminKey(req, res)) return;
  const stage = req.params.stage; // 'stage1' or 'stage2'
  if (!['stage1', 'stage2'].includes(stage)) {
    return res.status(400).json({ error: 'Invalid stage. Use stage1 or stage2' });
  }

  const data = loadData();
  let teams;

  if (stage === 'stage1') {
    teams = Object.values(data.teams);
    if (teams.length < 2) return res.status(400).json({ error: 'Need at least 2 teams' });
    const { matches, rounds } = generateBracket(teams, { stageType: 'single' });
    data.stage1 = { generated: true, matches, rounds };
    // Also generate stage2 placeholder for top N teams
    const stage1Advance = data.config.stage1Advance || 16;
    // Stage2 will be generated later once we know who advanced
    saveData(data);
    return res.json({ success: true, stage: 'stage1', teamCount: teams.length, bracketSize: nextPowerOf2(teams.length), matchCount: Object.keys(matches).length });
  }

  if (stage === 'stage2') {
    // Get stage1 winners (teams that won their last UB match)
    const stage1 = data.stage1;
    if (!stage1.generated) return res.status(400).json({ error: 'Generate stage1 first' });

    // Collect winners from stage1 final round
    const finalRoundId = stage1.rounds[stage1.rounds.length - 1]?.id;
    const finalRound = stage1.rounds.find(r => r.id === finalRoundId);
    const advancers = [];
    if (finalRound) {
      finalRound.matchIds?.forEach(mid => {
        const m = stage1.matches[mid];
        if (m?.winnerId) {
          const team = data.teams[m.winnerId];
          if (team) advancers.push(team);
        }
      });
    }

    // Fallback: if stage1 not complete, use all teams as requested
    const s2Teams = advancers.length >= 2 ? advancers : Object.values(data.teams).slice(0, data.config.stage1Advance || 16);
    const { matches, rounds } = generateBracket(s2Teams, { stageType: 'double' });
    data.stage2 = { generated: true, matches, rounds };
    saveData(data);
    return res.json({ success: true, stage: 'stage2', teamCount: s2Teams.length, matchCount: Object.keys(matches).length });
  }
});

// POST /api/tournament/reset — clear everything
app.post('/api/tournament/reset', (req, res) => {
  if (!checkAdminKey(req, res)) return;
  const data = loadData();
  data.teams = {};
  data.stage1 = { generated: false, matches: {}, rounds: [] };
  data.stage2 = { generated: false, matches: {}, rounds: [] };
  saveData(data);
  res.json({ success: true });
});

// POST /api/match/result — set match result
app.post('/api/match/result', (req, res) => {
  if (!checkAdminKey(req, res)) return;
  const { stage, matchId, winnerId, score1, score2 } = req.body;
  if (!stage || !matchId || !winnerId) {
    return res.status(400).json({ error: 'stage, matchId, winnerId required' });
  }

  const data = loadData();
  const stageData = data[stage];
  if (!stageData || !stageData.generated) {
    return res.status(400).json({ error: `Stage ${stage} not found or not generated` });
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

// PATCH /api/match/schedule — set schedule date for a match
app.patch('/api/match/schedule', (req, res) => {
  if (!checkAdminKey(req, res)) return;
  const { stage, matchId, scheduledDate, bo } = req.body;
  const data = loadData();
  const match = data[stage]?.matches?.[matchId];
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (scheduledDate !== undefined) match.scheduledDate = scheduledDate;
  if (bo !== undefined) match.bo = bo;
  saveData(data);
  res.json({ success: true, match });
});

// PATCH /api/config — update config (admin role IDs etc.)
app.patch('/api/config', (req, res) => {
  if (!checkAdminKey(req, res)) return;
  const data = loadData();
  Object.assign(data.config, req.body);
  saveData(data);
  res.json({ success: true, config: data.config });
});

app.listen(PORT, () => {
  console.log(`Tournament API running on port ${PORT}`);
});

module.exports = app;
