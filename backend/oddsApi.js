import db from './db.js';

// ---------------------------------------------------------------------------
// The Odds API integration — pulls match odds for the World Cup, computes
// de-vigged (overround-stripped) probabilities, and stores a timestamped
// snapshot per bookmaker/market/outcome in the `odds` table.
//
// Cost control: one call per pull, one region, four markets combined — The
// Odds API bills per (market x region), so this is ~4 "requests" per pull.
// Twice daily = ~8/day = ~240/month, comfortably under the 500/month free cap.
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.the-odds-api.com/v4';
const SPORT_KEY = process.env.ODDS_API_SPORT_KEY || 'soccer_fifa_world_cup';
const REGIONS = process.env.ODDS_API_REGIONS || 'eu';
const MARKETS = 'h2h,totals,spreads,btts';

function impliedProb(decimalOdds) {
  return 1 / decimalOdds;
}

// Outcomes that should be normalised against each other to strip the
// bookmaker's overround: h2h and btts as a whole market, totals/spreads
// per line (point), since Over 2.5 only pairs against Under 2.5, not Over 3.5.
function devigGroupKey(marketKey, point) {
  return `${marketKey}::${point ?? ''}`;
}

// Human-readable outcome label stored in the single `outcome` text column.
function outcomeLabel(marketKey, outcome) {
  const { name, point } = outcome;
  if (marketKey === 'totals') return `${name} ${point}`; // "Over 2.5"
  if (marketKey === 'spreads') return `${name} ${point > 0 ? '+' : ''}${point}`; // "France -0.5"
  return name; // h2h: team name / "Draw"; btts: "Yes" / "No"
}

// Fixtures aren't seeded separately yet, so the odds pull is also the source
// of fixture rows: find an existing fixture for this matchup/date, or create
// a bare one (group/city are filled in later from the official schedule).
function findOrCreateFixture({ home_team, away_team, commence_time }) {
  const date = commence_time.slice(0, 10);
  const existing = db
    .prepare('SELECT id FROM fixtures WHERE home_team = ? AND away_team = ? AND date = ?')
    .get(home_team, away_team, date);
  if (existing) return existing.id;

  const info = db
    .prepare(`INSERT INTO fixtures (date, home_team, away_team, "group", city, kickoff_time) VALUES (?, ?, ?, NULL, NULL, ?)`)
    .run(date, home_team, away_team, commence_time.slice(11, 16));
  return info.lastInsertRowid;
}

export async function pullOdds() {
  if (!process.env.ODDS_API_KEY) {
    throw new Error('ODDS_API_KEY is not set');
  }

  const url = `${API_BASE}/sports/${SPORT_KEY}/odds`
    + `?apiKey=${process.env.ODDS_API_KEY}`
    + `&regions=${REGIONS}`
    + `&markets=${MARKETS}`
    + `&oddsFormat=decimal&dateFormat=iso`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Odds API error ${res.status}: ${body.slice(0, 300)}`);
  }
  const events = await res.json();

  const insertOdds = db.prepare(`
    INSERT INTO odds (fixture_id, bookmaker, market, outcome, decimal_odds, implied_prob, devig_prob, pulled_at)
    VALUES (@fixture_id, @bookmaker, @market, @outcome, @decimal_odds, @implied_prob, @devig_prob, @pulled_at)
  `);
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insertOdds.run(row);
  });

  const pulledAt = new Date().toISOString();
  let fixtureCount = 0;
  let oddsCount = 0;

  for (const event of events) {
    const fixtureId = findOrCreateFixture(event);
    fixtureCount += 1;

    const rows = [];
    for (const bookmaker of event.bookmakers ?? []) {
      for (const market of bookmaker.markets ?? []) {
        // Bucket outcomes that get de-vigged against each other.
        const groups = new Map();
        for (const outcome of market.outcomes ?? []) {
          const key = devigGroupKey(market.key, outcome.point);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(outcome);
        }
        for (const outcomes of groups.values()) {
          const probs = outcomes.map((o) => impliedProb(o.price));
          const sum = probs.reduce((a, b) => a + b, 0);
          outcomes.forEach((o, i) => {
            rows.push({
              fixture_id: fixtureId,
              bookmaker: bookmaker.key,
              market: market.key,
              outcome: outcomeLabel(market.key, o),
              decimal_odds: o.price,
              implied_prob: probs[i],
              devig_prob: sum > 0 ? probs[i] / sum : null,
              pulled_at: pulledAt,
            });
          });
        }
      }
    }
    insertMany(rows);
    oddsCount += rows.length;
  }

  return {
    pulledAt,
    eventCount: events.length,
    fixtureCount,
    oddsRowCount: oddsCount,
    requestsUsed: res.headers.get('x-requests-used'),
    requestsRemaining: res.headers.get('x-requests-remaining'),
  };
}
