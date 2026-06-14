import express from 'express';
import cors from 'cors';
import db from './db.js';
import { pullOdds } from './oddsApi.js';

const app = express();
app.use(cors());
app.use(express.json());

const STATUSES = new Set(['open', 'won', 'lost', 'cashout']);

// ---- helpers ---------------------------------------------------------------
function toNumberOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalise an incoming bet payload and validate it.
 * Returns { value } on success or { error } on failure.
 */
function parseBet(body, { partial = false } = {}) {
  const out = {};
  const required = ['match', 'date', 'market', 'odds', 'stake'];

  if (!partial) {
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || body[f] === '') {
        return { error: `Missing required field: ${f}` };
      }
    }
  }

  if (body.match !== undefined) out.match = String(body.match).trim();
  if (body.date !== undefined) out.date = String(body.date).trim();
  if (body.market !== undefined) out.market = String(body.market).trim();

  if (body.odds !== undefined) {
    const odds = Number(body.odds);
    if (!Number.isFinite(odds) || odds <= 1) return { error: 'odds must be a decimal > 1' };
    out.odds = odds;
  }
  if (body.stake !== undefined) {
    const stake = Number(body.stake);
    if (!Number.isFinite(stake) || stake < 0) return { error: 'stake must be >= 0' };
    out.stake = stake;
  }
  if (body.status !== undefined) {
    const status = String(body.status).toLowerCase();
    if (!STATUSES.has(status)) return { error: `status must be one of ${[...STATUSES].join(', ')}` };
    out.status = status;
  }
  if (body.return_actual !== undefined) out.return_actual = toNumberOrNull(body.return_actual);
  if (body.closing_odds !== undefined) out.closing_odds = toNumberOrNull(body.closing_odds);
  if (body.in_play_cashout_price !== undefined) {
    out.in_play_cashout_price = toNumberOrNull(body.in_play_cashout_price);
  }
  if (body.notes !== undefined) out.notes = body.notes == null ? null : String(body.notes);
  if (body.bet_logic !== undefined) out.bet_logic = body.bet_logic == null ? null : String(body.bet_logic);

  return { value: out };
}

// ---- routes ----------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/bets', (_req, res) => {
  const rows = db.prepare('SELECT * FROM bets ORDER BY date DESC, id DESC').all();
  res.json(rows);
});

app.get('/api/bets/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM bets WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/bets', (req, res) => {
  const { value, error } = parseBet(req.body);
  if (error) return res.status(400).json({ error });

  const stmt = db.prepare(`
    INSERT INTO bets (match, date, market, odds, stake, status, return_actual, closing_odds, in_play_cashout_price, notes, bet_logic)
    VALUES (@match, @date, @market, @odds, @stake, @status, @return_actual, @closing_odds, @in_play_cashout_price, @notes, @bet_logic)
  `);
  const info = stmt.run({
    match: value.match,
    date: value.date,
    market: value.market,
    odds: value.odds,
    stake: value.stake,
    status: value.status ?? 'open',
    return_actual: value.return_actual ?? null,
    closing_odds: value.closing_odds ?? null,
    in_play_cashout_price: value.in_play_cashout_price ?? null,
    notes: value.notes ?? null,
    bet_logic: value.bet_logic ?? null,
  });
  const row = db.prepare('SELECT * FROM bets WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.put('/api/bets/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM bets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { value, error } = parseBet(req.body, { partial: true });
  if (error) return res.status(400).json({ error });

  const merged = { ...existing, ...value };

  // When a bet is settled to lost, its actual return is zero unless given.
  if (merged.status === 'lost' && req.body.return_actual === undefined) {
    merged.return_actual = 0;
  }
  // Reverting to open clears the settlement figure.
  if (merged.status === 'open' && req.body.return_actual === undefined) {
    merged.return_actual = null;
  }

  db.prepare(`
    UPDATE bets SET
      match = @match, date = @date, market = @market, odds = @odds, stake = @stake,
      status = @status, return_actual = @return_actual, closing_odds = @closing_odds,
      in_play_cashout_price = @in_play_cashout_price, notes = @notes, bet_logic = @bet_logic
    WHERE id = @id
  `).run({
    id: existing.id,
    match: merged.match,
    date: merged.date,
    market: merged.market,
    odds: merged.odds,
    stake: merged.stake,
    status: merged.status,
    return_actual: merged.return_actual ?? null,
    closing_odds: merged.closing_odds ?? null,
    in_play_cashout_price: merged.in_play_cashout_price ?? null,
    notes: merged.notes ?? null,
    bet_logic: merged.bet_logic ?? null,
  });

  const row = db.prepare('SELECT * FROM bets WHERE id = ?').get(existing.id);
  res.json(row);
});

app.delete('/api/bets/:id', (req, res) => {
  const info = db.prepare('DELETE FROM bets WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---- fixtures & odds --------------------------------------------------------
app.get('/api/fixtures', (_req, res) => {
  const rows = db.prepare('SELECT * FROM fixtures ORDER BY date ASC, id ASC').all();
  res.json(rows);
});

app.get('/api/fixtures/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM fixtures WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// All odds rows for a fixture, most recent pulls first. Pass ?latest=1 to get
// only the most recent pull per bookmaker/market/outcome.
app.get('/api/fixtures/:id/odds', (req, res) => {
  const fixture = db.prepare('SELECT id FROM fixtures WHERE id = ?').get(req.params.id);
  if (!fixture) return res.status(404).json({ error: 'Not found' });

  if (req.query.latest) {
    const rows = db.prepare(`
      SELECT o.* FROM odds o
      WHERE o.fixture_id = ?
        AND o.pulled_at = (SELECT MAX(o2.pulled_at) FROM odds o2 WHERE o2.fixture_id = o.fixture_id)
      ORDER BY o.market, o.bookmaker, o.outcome
    `).all(req.params.id);
    return res.json(rows);
  }

  const rows = db.prepare('SELECT * FROM odds WHERE fixture_id = ? ORDER BY pulled_at DESC, market, bookmaker, outcome')
    .all(req.params.id);
  res.json(rows);
});

// ---- cron-triggered odds pull ----------------------------------------------
// Protected by CRON_SECRET — pass it as ?key=... or header x-cron-key.
// Intended to be hit by cron-job.org twice daily.
function checkCronSecret(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'CRON_SECRET is not configured on the server' });
    return false;
  }
  const provided = req.get('x-cron-key') || req.query.key;
  if (provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

async function handleOddsPull(req, res) {
  if (!checkCronSecret(req, res)) return;
  try {
    const result = await pullOdds();
    console.log('[odds] pull complete', result);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[odds] pull failed', e);
    res.status(502).json({ error: e.message });
  }
}

app.get('/api/cron/pull-odds', handleOddsPull);
app.post('/api/cron/pull-odds', handleOddsPull);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[api] listening on :${PORT}`));
