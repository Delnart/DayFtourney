const mongoose = require('mongoose');

// We use Mixed because the schema can vary depending on brackets.
// We strictly maintain the single document pattern as it was on JSON.
const TournamentSchema = new mongoose.Schema({
  _id: { type: String, default: 'main_tournament' },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  teams: { type: mongoose.Schema.Types.Mixed, default: {} },
  stage1: { type: mongoose.Schema.Types.Mixed, default: { generated: false, matches: {}, rounds: [] } },
  stage2: { type: mongoose.Schema.Types.Mixed, default: { generated: false, matches: {}, rounds: [] } },
}, { minimize: false, strict: false });

module.exports = mongoose.model('Tournament', TournamentSchema);
