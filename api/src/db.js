const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/tournament.json');

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { loadData, saveData };
