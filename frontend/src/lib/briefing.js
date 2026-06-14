// Formats the /api/fixtures/:id/briefing response into a single plain-text
// block, optimised for pasting into a chat — no styling, no truncation.

const MARKET_LABELS = { h2h: '1X2', totals: 'Totals', spreads: 'Handicap', btts: 'BTTS' };
const MARKET_ORDER = ['h2h', 'totals', 'spreads', 'btts'];

function num(v, digits = 2) {
  return v == null || Number.isNaN(v) ? 'N/A' : Number(v).toFixed(digits);
}

function pctStr(v, digits = 1) {
  return v == null || Number.isNaN(v) ? 'N/A' : `${(v * 100).toFixed(digits)}%`;
}

function formatTeamForm(side) {
  const { name, team, matches } = side;
  const lines = [`${name}:`];

  if (!matches.length) {
    lines.push('  No recorded match history.');
    return lines.join('\n');
  }

  let w = 0, d = 0, l = 0, scored = 0, conceded = 0;
  for (const m of matches) {
    if (m.score_for == null || m.score_against == null) continue;
    scored += m.score_for;
    conceded += m.score_against;
    if (m.score_for > m.score_against) w += 1;
    else if (m.score_for < m.score_against) l += 1;
    else d += 1;
  }
  lines.push(`  Record (last ${matches.length}): ${w}W ${d}D ${l}L | scored ${scored} conceded ${conceded}`);

  for (const m of matches) {
    lines.push(
      `  ${m.date} vs ${m.opponent}: ${m.score_for ?? '?'}-${m.score_against ?? '?'} | xGF ${num(m.xg_for)} xGA ${num(m.xg_against)}`,
    );
  }

  lines.push(
    `  Avg: xGF ${num(team?.avg_xg_for)} | xGA ${num(team?.avg_xg_against)} | Adj-xGF ${num(team?.adj_xg_for)} | Adj-xGA ${num(team?.adj_xg_against)}`,
  );

  return lines.join('\n');
}

function groupOddsBoard(board) {
  const groups = new Map();
  for (const row of board) {
    if (!groups.has(row.market)) groups.set(row.market, []);
    groups.get(row.market).push(row);
  }
  return MARKET_ORDER
    .filter((m) => groups.has(m))
    .map((m) => ({ label: MARKET_LABELS[m] || m, rows: groups.get(m) }));
}

export function formatBriefing(data) {
  const { fixture, home, away, h2h, odds_board, line_movement } = data;
  const lines = [];

  const kickoff = fixture.kickoff_time ? `${fixture.date} ${fixture.kickoff_time}` : fixture.date;
  lines.push(
    `MATCH: ${fixture.home_team} vs ${fixture.away_team} | ${fixture.group || 'Group TBD'} | ${kickoff} | ${fixture.city || 'City TBD'}`,
  );
  lines.push('');

  lines.push('==== FORM & xG (last 5, recent first) ====');
  lines.push(formatTeamForm(home));
  lines.push('');
  lines.push(formatTeamForm(away));
  lines.push('');

  lines.push('==== H2H (last 5) ====');
  if (h2h.length === 0) {
    lines.push('No recorded head-to-head matches.');
  } else {
    for (const m of h2h) {
      lines.push(`  ${m.date}: ${fixture.home_team} ${m.home_score ?? '?'}-${m.away_score ?? '?'} ${fixture.away_team}`);
    }
  }
  lines.push('');

  const homeElo = home.team?.elo;
  const awayElo = away.team?.elo;
  const gap = homeElo != null && awayElo != null ? (homeElo - awayElo).toFixed(1) : 'N/A';
  lines.push(`ELO: ${fixture.home_team} ${homeElo ?? 'N/A'} vs ${fixture.away_team} ${awayElo ?? 'N/A'} | gap ${gap}`);
  lines.push('');

  lines.push('==== ODDS BOARD (best price | consensus avg | de-vigged fair %) ====');
  const groups = groupOddsBoard(odds_board ?? []);
  if (groups.length === 0) {
    lines.push('No odds data available yet.');
  } else {
    for (const group of groups) {
      lines.push(`${group.label}:`);
      for (const row of group.rows) {
        lines.push(`  ${row.outcome}: best ${num(row.best_price)} | consensus ${num(row.consensus_price)} | fair ${pctStr(row.devig_prob)}`);
      }
    }
  }
  lines.push('');

  lines.push('==== LINE MOVEMENT (markets moved >5% since first pull) ====');
  if (!line_movement || line_movement.length === 0) {
    lines.push('No significant line movement.');
  } else {
    for (const m of line_movement) {
      const sign = m.delta_pct > 0 ? '+' : '';
      lines.push(
        `  ${MARKET_LABELS[m.market] || m.market} ${m.outcome}: ${pctStr(m.from_prob)} -> ${pctStr(m.to_prob)} (${sign}${m.delta_pct.toFixed(1)}pp)`,
      );
    }
  }
  lines.push('');

  lines.push('==== BETFIRST ====');
  lines.push('');

  return lines.join('\n');
}
