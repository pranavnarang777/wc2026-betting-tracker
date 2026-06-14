import db from './db.js';

// ---------------------------------------------------------------------------
// Builds the data behind the "Generate Briefing" page: form/xG for both
// teams, head-to-head, Elo, the latest odds board, and any markets that have
// moved >5 percentage points (de-vigged) since the first odds pull.
// ---------------------------------------------------------------------------

function avg(arr) {
  const valid = arr.filter((v) => Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function getTeamWithMatches(name) {
  const team = db.prepare('SELECT * FROM teams WHERE name = ?').get(name);
  if (!team) return { team: null, matches: [] };
  const matches = db.prepare(`
    SELECT * FROM team_matches WHERE team_id = ? ORDER BY date DESC, id DESC LIMIT 5
  `).all(team.id);
  return { team, matches };
}

// Looks for matches between the two teams from either team's match log
// (whichever side was scraped), de-duplicated by date, most recent first.
function getHeadToHead(homeName, awayName) {
  const homeTeam = db.prepare('SELECT id FROM teams WHERE name = ?').get(homeName);
  const awayTeam = db.prepare('SELECT id FROM teams WHERE name = ?').get(awayName);

  const rows = [];
  if (homeTeam) {
    rows.push(...db.prepare(`
      SELECT date, score_for AS home_score, score_against AS away_score
      FROM team_matches WHERE team_id = ? AND opponent = ?
    `).all(homeTeam.id, awayName));
  }
  if (awayTeam) {
    rows.push(...db.prepare(`
      SELECT date, score_against AS home_score, score_for AS away_score
      FROM team_matches WHERE team_id = ? AND opponent = ?
    `).all(awayTeam.id, homeName));
  }

  const seen = new Set();
  const out = [];
  for (const r of rows.sort((a, b) => b.date.localeCompare(a.date))) {
    if (seen.has(r.date)) continue;
    seen.add(r.date);
    out.push(r);
    if (out.length === 5) break;
  }
  return out;
}

function getOddsBoard(fixtureId) {
  const latest = db.prepare(`
    SELECT o.* FROM odds o
    WHERE o.fixture_id = ?
      AND o.pulled_at = (SELECT MAX(o2.pulled_at) FROM odds o2 WHERE o2.fixture_id = o.fixture_id)
  `).all(fixtureId);

  const groups = new Map();
  for (const row of latest) {
    const key = `${row.market}::${row.outcome}`;
    if (!groups.has(key)) groups.set(key, { market: row.market, outcome: row.outcome, prices: [], devigs: [] });
    const g = groups.get(key);
    g.prices.push(row.decimal_odds);
    if (row.devig_prob != null) g.devigs.push(row.devig_prob);
  }

  return [...groups.values()].map((g) => ({
    market: g.market,
    outcome: g.outcome,
    best_price: Math.max(...g.prices),
    consensus_price: avg(g.prices),
    devig_prob: avg(g.devigs),
  }));
}

// Compares the average de-vigged probability on the first pull vs the most
// recent pull, per market/outcome; flags moves >5 percentage points.
function getLineMovement(fixtureId) {
  const rows = db.prepare(`
    SELECT market, outcome, devig_prob, pulled_at FROM odds
    WHERE fixture_id = ? AND devig_prob IS NOT NULL
    ORDER BY pulled_at ASC
  `).all(fixtureId);

  const groups = new Map();
  for (const row of rows) {
    const key = `${row.market}::${row.outcome}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const movements = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const firstTs = list[0].pulled_at;
    const lastTs = list[list.length - 1].pulled_at;
    if (firstTs === lastTs) continue;

    const firstAvg = avg(list.filter((r) => r.pulled_at === firstTs).map((r) => r.devig_prob));
    const lastAvg = avg(list.filter((r) => r.pulled_at === lastTs).map((r) => r.devig_prob));
    if (firstAvg == null || lastAvg == null) continue;

    const deltaPct = (lastAvg - firstAvg) * 100;
    if (Math.abs(deltaPct) > 5) {
      movements.push({
        market: list[0].market,
        outcome: list[0].outcome,
        from_prob: firstAvg,
        to_prob: lastAvg,
        delta_pct: deltaPct,
        first_pulled_at: firstTs,
        last_pulled_at: lastTs,
      });
    }
  }
  return movements;
}

export function buildBriefing(fixtureId) {
  const fixture = db.prepare('SELECT * FROM fixtures WHERE id = ?').get(fixtureId);
  if (!fixture) return null;

  const home = getTeamWithMatches(fixture.home_team);
  const away = getTeamWithMatches(fixture.away_team);

  return {
    fixture,
    home: { name: fixture.home_team, team: home.team, matches: home.matches },
    away: { name: fixture.away_team, team: away.team, matches: away.matches },
    h2h: getHeadToHead(fixture.home_team, fixture.away_team),
    odds_board: getOddsBoard(fixtureId),
    line_movement: getLineMovement(fixtureId),
  };
}
