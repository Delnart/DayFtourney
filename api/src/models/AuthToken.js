const mongoose = require('mongoose');

const AuthTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: '15m' }, // Expires after 15 minutes
});

module.exports = mongoose.model('AuthToken', AuthTokenSchema);
