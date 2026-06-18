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
    bet_logic            TEXT,                        -- why the bet was taken + post-settlement verdict
    created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration: add bet_logic to databases created before this column existed.
const hasBetLogic = db.prepare("PRAGMA table_info(bets)").all().some((c) => c.name === 'bet_logic');
if (!hasBetLogic) {
  db.exec('ALTER TABLE bets ADD COLUMN bet_logic TEXT');
}

// --- Seed starter bets on first boot ----------------------------------------
const count = db.prepare('SELECT COUNT(*) AS n FROM bets').get().n;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO bets (match, date, market, odds, stake, status, return_actual, notes, bet_logic)
    VALUES (@match, @date, @market, @odds, @stake, @status, @return_actual, @notes, @bet_logic)
  `);

  const seedBets = [
    {
      match: 'Qatar vs Switzerland',
      date: '2026-06-13',
      market: 'Under 2.5',
      odds: 2.15,
      stake: 10,
      status: 'won',
      return_actual: 21.5,
      notes: 'Opening bet — World Cup 2026 group stage.',
      bet_logic: 'Under 2.5 @ 2.15. Model prior 56% vs 44% implied. Structural lean: WC opener (2.38 avg goals), midday heat, Qatar bus-parking, Almoez Ali benched. Pinnacle confirmed soft line. VERDICT: Good bet, good outcome.',
    },
    {
      match: 'Brazil vs Morocco',
      date: '2026-06-14',
      market: 'Morocco over 0.5 goals',
      odds: 2.20,
      stake: 10,
      status: 'won',
      return_actual: 22.0,
      notes: null,
      bet_logic: 'Morocco over 0.5 goals @ 2.20. Implied 45.5% vs realistic ~75% for any competitive team to score. Elo gap only +164 — genuinely competitive match. VERDICT: Good bet, good outcome.',
    },
    {
      match: 'Haiti vs Scotland',
      date: '2026-06-14',
      market: 'Scotland win + over 2.5 goals',
      odds: 2.45,
      stake: 10,
      status: 'lost',
      return_actual: 0,
      notes: null,
      bet_logic: 'Scotland win + over 2.5 combo @ 2.45. Scotland win ~65% × over 2.5 ~45% = joint ~29%. Breakeven needs 40.8%. Combo destroyed individual leg value. VERDICT: Bad bet — parlay trap. Outcome irrelevant.',
    },
    {
      match: 'Turkey vs Australia',
      date: '2026-06-14',
      market: 'Kerem Aktürkoglu to score or assist',
      odds: 2.00,
      stake: 10,
      status: 'lost',
      return_actual: 0,
      notes: null,
      bet_logic: 'Kerem Aktürkoglu score or assist @ 2.00. Implies 50% but realistic probability ~25-35% for any winger per game. VERDICT: Bad bet — overpriced prop.',
    },
    {
      match: 'Germany vs Curaçao',
      date: '2026-06-14',
      market: 'Curaçao Total Goals Over 0.5',
      odds: 3.75,
      stake: 5,
      status: 'won',
      return_actual: 18.75,
      notes: null,
      bet_logic: "Curaçao to score in WC opener. Breakeven 26.7%; true est. 30-37% (blowout-consolation: Germany rests starters once ahead, minnow commits forward with zero pressure). Fair-to-slightly-positive at 3.75; bad bet at standard 2.75. VERDICT: Sensible flutter, good outcome — a fair bet that landed, not an edge.",
    },
    {
      match: 'Netherlands vs Japan',
      date: '2026-06-14',
      market: 'Double Chance — Japan or Draw',
      odds: 1.88,
      stake: 5,
      status: 'won',
      return_actual: 9.40,
      notes: null,
      bet_logic: "Japan win-or-draw. Breakeven 53.2%; est. 54-57% on Japan's elite low-event defence vs leaky Netherlands. CAVEAT: Endo (defensive anchor) + Mitoma out late, dropping edge to borderline/thin — genuinely close call, debated passing. VERDICT: Marginal bet, won, result doesn't validate the read.",
    },
    {
      match: 'Belgium vs Egypt',
      date: '2026-06-15',
      market: 'Double Chance — Draw or Egypt',
      odds: 2.51,
      stake: 10,
      status: 'won',
      return_actual: 25.10,
      notes: null,
      bet_logic: "Egypt win-or-draw. Breakeven 39.8%; est. 42-45% — Belgium weakened (Lukaku benched, makeshift Ngoy-Mechele CB pairing untested vs Egypt's elite transition duo Salah+Marmoush). Biggest edge since Curaçao. CAVEAT: Egypt also patched own defence (Fathy makeshift CB); Courtois in goal helps Belgium. Loses on any Belgium win incl. likely 1-0/2-0 — positive-EV underdog, expected to lose more often than win. RESULT: 1-1. Egypt led ~40 mins, Belgium equalised 62'. Held through late Belgium pressure to the whistle. Thesis (weakened Belgium defence vs Egypt transition) played out. NOTE: won, but a 1-1 draw is one of the outcomes we priced — result consistent with the read, not proof of edge.",
    },
    {
      match: 'Saudi Arabia vs Uruguay',
      date: '2026-06-15',
      market: 'Double Chance — Saudi Arabia or Draw',
      odds: 2.83,
      stake: 10,
      status: 'won',
      return_actual: 28.30,
      notes: null,
      bet_logic: "Saudi Arabia win-or-draw. Breakeven 35.3%; est. 38-42% — banking on a rotated/fatigued Uruguay and De Arrascaeta absence. RESULT: Saudi avoided defeat. Confirmed XI showed Uruguay near first-choice spine (Valverde, Bentancur, Núñez) — less rotated than hoped, so edge was thin end of 38-42%. Fatigue + De Arrascaeta absence thesis held. NOTE: marginal bet that won; do not over-weight.",
    },
    {
      match: 'Austria vs Jordan',
      date: '2026-06-17',
      market: 'Under 2.5 Goals',
      odds: 1.95,
      stake: 5.35,
      status: 'lost',
      return_actual: 0,
      notes: null,
      bet_logic: "Total xG ~1.7-1.8 throughout, consistent with under thesis. Held through 1-1 at 40' remaining vs cashout offer of €2.55 (guaranteed loss) based on ~58% estimated win probability / €6.05 EV vs €2.55. Final 2-1 — match overperformed low cumulative xG late. VERDICT: Good bet, good in-play hold decision, bad outcome. Process was sound throughout; pure variance.",
    },
    {
      match: 'Portugal vs DR Congo',
      date: '2026-06-17',
      market: 'BTTS Yes',
      odds: 2.33,
      stake: 5,
      status: 'won',
      return_actual: 11.65,
      notes: null,
      bet_logic: "Initial xG estimate (Portugal 2.20/Congo 0.85) gave ~50-54% vs 42.9% breakeven. Verification of Congo's actual recent form trimmed edge to thin ~1-3%, stake correctly downgraded from €10 to €5. VERDICT: Good bet, properly resized after verification, good outcome.",
    },
    {
      match: 'Portugal vs DR Congo',
      date: '2026-06-17',
      market: 'Bruno Fernandes Over 0.5 Assists',
      odds: 3.15,
      stake: 7,
      status: 'lost',
      return_actual: 0,
      notes: null,
      bet_logic: "Verified club assist rate (21 in 35) and Portugal history (multi-assist vs Ghana/Slovakia/USA), plus confirmed advanced #10 role and set-piece duties via independent sources. Estimate ~42-50% vs 31.7% breakeven. VERDICT: Well-verified, good bet, bad outcome — assists are inherently high-variance even with sound logic.",
    },
    {
      match: 'England vs Croatia',
      date: '2026-06-17',
      market: 'Under 2.5 Goals',
      odds: 1.95,
      stake: 5,
      status: 'lost',
      return_actual: 0,
      notes: null,
      bet_logic: "Poisson on combined xG 2.10 gave ~65% vs breakeven — strong edge, independently corroborated by CBS (Eimer, -144 same side), FOX Sports pick, and England's own scoring pattern (no 3+ goal game since Oct except a blowout). FINAL: England 4-2 Croatia — goals from the 2nd minute, never a cagey game at any point. VERDICT: Bad bet in hindsight, not just bad outcome. Multiple independent sources shared the same blind spot (qualifying form ≠ tournament-opener intensity); strong consensus is not immunity from being collectively wrong. Distinct from the Austria-Jordan loss, which genuinely was a good process beaten by late variance.",
    },
  ];

  for (const bet of seedBets) insert.run(bet);
  console.log('[db] seeded starter bets');
}

// --- World Cup data model: teams, form, fixtures, odds ----------------------
// These power the xG pipeline (Phase 2), odds pipeline (Phase 3) and the
// per-match briefing export (Phase 4). Additive only — does not touch `bets`.
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL UNIQUE,
    elo             REAL,
    avg_xg_for      REAL,                 -- rolling average xG scored (last 15)
    avg_xg_against  REAL,                 -- rolling average xG conceded (last 15)
    adj_xg_for      REAL,                 -- opponent-strength-adjusted xG for
    adj_xg_against  REAL,                 -- opponent-strength-adjusted xG against
    last_updated    TEXT
  );

  CREATE TABLE IF NOT EXISTS team_matches (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id       INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    date          TEXT    NOT NULL,       -- ISO yyyy-mm-dd
    opponent      TEXT    NOT NULL,
    score_for     INTEGER,
    score_against INTEGER,
    xg_for        REAL,
    xg_against    REAL
  );
  CREATE INDEX IF NOT EXISTS idx_team_matches_team ON team_matches(team_id, date);

  CREATE TABLE IF NOT EXISTS fixtures (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL,        -- ISO yyyy-mm-dd
    home_team    TEXT    NOT NULL,
    away_team    TEXT    NOT NULL,
    "group"      TEXT,
    city         TEXT,
    kickoff_time TEXT                     -- HH:MM, local kickoff
  );

  CREATE TABLE IF NOT EXISTS odds (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fixture_id      INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
    bookmaker       TEXT    NOT NULL,
    market          TEXT    NOT NULL,     -- h2h | totals | spreads | btts
    outcome         TEXT    NOT NULL,     -- e.g. "Home", "Over 2.5", "+0.5"
    decimal_odds    REAL    NOT NULL,
    implied_prob    REAL,                 -- raw 1/decimal_odds
    devig_prob      REAL,                 -- overround-normalised probability
    pulled_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_odds_fixture ON odds(fixture_id, market, pulled_at);
`);

export default db;
