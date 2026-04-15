const jwt = require('jsonwebtoken');

/**
 * Checks X-API-Key header against API_SECRET env var OR verifies a JWT token in Authorization: Bearer.
 * If API_SECRET is not set, allows all requests (dev mode).
 */
function requireApiKey(req, res, next) {
  const secret = process.env.API_SECRET;
  if (!secret) return next(); // Dev mode: no secret configured

  // 1. Check API Key
  const provided = req.headers['x-api-key'];
  if (provided && provided === secret) {
    return next();
  }

  // 2. Check JWT
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      if (process.env.JWT_SECRET) {
        jwt.verify(token, process.env.JWT_SECRET);
        return next();
      }
    } catch (e) {
      // invalid token
    }
  }

  return res.status(401).json({ error: 'Unauthorized: invalid or missing API key or admin session' });
}

module.exports = { requireApiKey };
