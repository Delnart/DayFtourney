/**
 * Checks X-API-Key header against API_SECRET env var.
 * If API_SECRET is not set, allows all requests (dev mode).
 */
function requireApiKey(req, res, next) {
  const secret = process.env.API_SECRET;
  if (!secret) return next(); // Dev mode: no secret configured

  const provided = req.headers['x-api-key'];
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
  }
  next();
}

module.exports = { requireApiKey };
