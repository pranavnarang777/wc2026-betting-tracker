import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// On Render's free tier the filesystem is ephemeral (resets on deploy/restart).
// DB_PATH lets you point at a mounted disk if you add one; otherwise it lives
// next to the server and is seeded on first boot.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'bets.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS bets (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    match                TEXT    NOT NULL,
    date                 TEXT    NOT NULL,            -- ISO yyyy-mm-dd
    market               TEXT    NOT NULL,
    odds                 REAL    NOT NULL,            -- decimal odds
    stake                REAL    NOT NULL,            -- EUR
    status               TEXT    NOT NULL DEFAULT 'open', -- open | won | lost | cashout
    return_actual        REAL,                        -- total returned, NULL until settled
    closing_odds         REAL,                        -- Pinnacle closing line (for CLV)
    in_play_cashout_price REAL,                       -- optional in-play cashout price
    notes                TEXT,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- Seed one starter bet on first boot ------------------------------------
const count = db.prepare('SELECT COUNT(*) AS n FROM bets').get().n;
if (count === 0) {
  db.prepare(`
    INSERT INTO bets (match, date, market, odds, stake, status, notes)
    VALUES (@match, @date, @market, @odds, @stake, @status, @notes)
  `).run({
    match: 'Qatar vs Switzerland',
    date: '2026-06-13',
    market: 'Under 2.5',
    odds: 2.15,
    stake: 10,
    status: 'open',
    notes: 'Opening bet — World Cup 2026 group stage.',
  });
  console.log('[db] seeded starter bet');
}

export default db;
