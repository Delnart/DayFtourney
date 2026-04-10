const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/tournament.json');

const DEFAULT_DATA = {
  config: {
    name: "Day F 2026",
    stage1Advance: 16,
    adminRoleIds: []
  },
  teams: {},
  stage1: { generated: false, matches: {}, rounds: [] },
  stage2: { generated: false, matches: {}, rounds: [] }
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    // Ensure directory exists
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Write default data
    saveData(DEFAULT_DATA);
    return DEFAULT_DATA;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { loadData, saveData };
