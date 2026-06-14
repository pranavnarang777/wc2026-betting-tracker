// ---------------------------------------------------------------------------
// Pure betting analytics. Everything the dashboard / analytics pages render is
// derived here from the raw bet list, so the maths lives in one place.
// ---------------------------------------------------------------------------

const SETTLED = new Set(['won', 'lost', 'cashout']);

// Profit/loss for a single bet, in EUR. Open bets have no realised P&L (null).
export function betPnl(bet) {
  if (!SETTLED.has(bet.status)) return null;
  if (bet.status === 'lost') return -bet.stake;
  // won + cashout: return_actual is the TOTAL returned (stake + profit).
  const ret = bet.return_actual ?? 0;
  return ret - bet.stake;
}

// Potential return if an open bet wins (stake * odds).
export function potentialReturn(bet) {
  return bet.stake * bet.odds;
}

export function potentialProfit(bet) {
  return bet.stake * (bet.odds - 1);
}

export function isSettled(bet) {
  return SETTLED.has(bet.status);
}

// ---- Dashboard summary -----------------------------------------------------
export function summarise(bets) {
  const settled = bets.filter(isSettled);
  const open = bets.filter((b) => b.status === 'open');

  const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
  const settledStaked = settled.reduce((s, b) => s + b.stake, 0);
  const pnl = settled.reduce((s, b) => s + (betPnl(b) ?? 0), 0);

  const wins = settled.filter((b) => b.status === 'won').length;
  const losses = settled.filter((b) => b.status === 'lost').length;
  const cashouts = settled.filter((b) => b.status === 'cashout').length;

  // Win rate is decided bets only (won vs lost); cashouts are excluded as they
  // are neither a clean win nor loss.
  const decided = wins + losses;
  const winRate = decided ? (wins / decided) * 100 : null;

  const roi = settledStaked ? (pnl / settledStaked) * 100 : null;

  const openStake = open.reduce((s, b) => s + b.stake, 0);
  const openPotentialReturn = open.reduce((s, b) => s + potentialReturn(b), 0);

  return {
    pnl,
    roi,
    winRate,
    totalStaked,
    settledStaked,
    betsPlaced: bets.length,
    settledCount: settled.length,
    wins,
    losses,
    cashouts,
    openCount: open.length,
    openStake,
    openPotentialReturn,
  };
}

// ---- Running P&L by date (cumulative) --------------------------------------
export function runningPnl(bets) {
  const settled = bets
    .filter(isSettled)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  // Group same-day settlements so the line has one point per date.
  const byDate = new Map();
  for (const b of settled) {
    byDate.set(b.date, (byDate.get(b.date) ?? 0) + (betPnl(b) ?? 0));
  }

  let cum = 0;
  const points = [];
  for (const [date, dayPnl] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    cum += dayPnl;
    points.push({ date, pnl: Number(cum.toFixed(2)), dayPnl: Number(dayPnl.toFixed(2)) });
  }
  return points;
}

// ---- P&L by market type ----------------------------------------------------
export function pnlByMarket(bets) {
  const map = new Map();
  for (const b of bets.filter(isSettled)) {
    const cur = map.get(b.market) ?? { market: b.market, pnl: 0, bets: 0, staked: 0 };
    cur.pnl += betPnl(b) ?? 0;
    cur.staked += b.stake;
    cur.bets += 1;
    map.set(b.market, cur);
  }
  return [...map.values()]
    .map((m) => ({ ...m, pnl: Number(m.pnl.toFixed(2)) }))
    .sort((a, b) => b.pnl - a.pnl);
}

// ---- Win rate by odds bucket ----------------------------------------------
const ODDS_BUCKETS = [
  { label: '1.50–2.00', min: 1.5, max: 2.0 },
  { label: '2.00–2.50', min: 2.0, max: 2.5 },
  { label: '2.50–3.00', min: 2.5, max: 3.0 },
  { label: '3.00+', min: 3.0, max: Infinity },
];

export function winRateByOdds(bets) {
  const decided = bets.filter((b) => b.status === 'won' || b.status === 'lost');
  return ODDS_BUCKETS.map(({ label, min, max }) => {
    const inBucket = decided.filter((b) => b.odds >= min && b.odds < max);
    const wins = inBucket.filter((b) => b.status === 'won').length;
    const n = inBucket.length;
    return {
      bucket: label,
      winRate: n ? Number(((wins / n) * 100).toFixed(1)) : 0,
      wins,
      total: n,
    };
  });
}

// ---- Average odds: winners vs losers --------------------------------------
export function avgOddsWinnersLosers(bets) {
  const winners = bets.filter((b) => b.status === 'won');
  const losers = bets.filter((b) => b.status === 'lost');
  const avg = (arr) => (arr.length ? arr.reduce((s, b) => s + b.odds, 0) / arr.length : null);
  return {
    winners: avg(winners),
    losers: avg(losers),
    winnersCount: winners.length,
    losersCount: losers.length,
  };
}

// ---- CLV: your price vs Pinnacle closing line ------------------------------
// Edge% per bet = (yourOdds / closingOdds - 1) * 100. Positive means you took a
// better price than the market close — the long-run hallmark of +EV betting.
export function clv(bets) {
  const withClose = bets.filter((b) => b.closing_odds && b.closing_odds > 1);
  const rows = withClose.map((b) => ({
    id: b.id,
    match: b.match,
    market: b.market,
    date: b.date,
    yourOdds: b.odds,
    closingOdds: b.closing_odds,
    edge: Number(((b.odds / b.closing_odds - 1) * 100).toFixed(2)),
  }));
  const avgEdge = rows.length ? rows.reduce((s, r) => s + r.edge, 0) / rows.length : null;
  const beatCount = rows.filter((r) => r.edge > 0).length;
  const beatRate = rows.length ? (beatCount / rows.length) * 100 : null;
  return { rows, avgEdge, beatRate, count: rows.length };
}
