require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { readLimiter } = require('./middleware/rateLimit');

const teamsRouter = require('./routes/teams');
const matchesRouter = require('./routes/matches');
const tournamentRouter = require('./routes/tournament');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Security headers ---
app.use(helmet());

// --- CORS — only allow your frontend domain ---
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin requests (e.g. curl in dev), or whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
}));

app.use(express.json({ limit: '50kb' })); // Prevent huge payloads
app.use(readLimiter);                      // Global read rate limit

// --- Routes ---
app.use('/api/teams', teamsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/tournament', tournamentRouter);
app.use('/api/auth', authRouter);

// --- Health check ---
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// --- 404 handler ---
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// --- Error handler ---
app.use((err, req, res, next) => {
  if (err.message?.startsWith('CORS')) return res.status(403).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`[API] Running on port ${PORT}`));
module.exports = app;
