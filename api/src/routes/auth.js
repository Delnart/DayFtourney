const { Router } = require('express');
const { requireApiKey } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const AuthToken = require('../models/AuthToken');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const router = Router();

// Used by Bot to generate a one-time link
router.post('/generate', requireApiKey, writeLimiter, async (req, res) => {
  const rawToken = crypto.randomUUID();
  try {
    await AuthToken.create({ token: rawToken });
    // Assume frontend is hosted at same domain or defined in env
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.json({ success: true, link: `${frontendUrl}/admin?token=${rawToken}` });
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// Used by Frontend to login
router.post('/login', writeLimiter, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token missing' });

  const found = await AuthToken.findOneAndDelete({ token });
  if (!found) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Token is valid and consumed
  const sessionToken = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, sessionToken });
});

module.exports = router;
