import db from './db.js';

// ---------------------------------------------------------------------------
// Imports xG form data for national teams (fed by the GitHub Action in
// scripts/fetch_xg.py, which scrapes FBref via soccerdata).
//
// Payload shape:
//   {
//     teams: [
//       {
//         name: "Argentina",
//         elo: 2100.5,          // optional
//         matches: [
//           { date, opponent, score_for, score_against, xg_for, xg_against },
//           ... up to 15, most recent last
//         ]
//       },
//       ...
//     ]
//   }
//
// For each team, replaces its stored matches with the supplied list, then
// recomputes avg_xg_for/avg_xg_against (simple rolling average) and
// adj_xg_for/adj_xg_against (adjusted for the strength of each opponent
// faced, relative to the league-wide average) across ALL teams, so stats
// stay consistent even when only some teams are updated in a given run.
// ---------------------------------------------------------------------------

const upsertTeam = db.prepare(`
  INSERT INTO teams (name, elo, last_updated)
  VALUES (@name, @elo, @last_updated)
  ON CONFLICT(name) DO UPDATE SET
    elo = COALESCE(@elo, elo),
    last_updated = @last_updated
`);

const getTeamId = db.prepare('SELECT id FROM teams WHERE name = ?');
const deleteMatches = db.prepare('DELETE FROM team_matches WHERE team_id = ?');
const insertMatch = db.prepare(`
  INSERT INTO team_matches (team_id, date, opponent, score_for, score_against, xg_for, xg_against)
  VALUES (@team_id, @date, @opponent, @score_for, @score_against, @xg_for, @xg_against)
`);
const updateTeamStats = db.prepare(`
  UPDATE teams SET
    avg_xg_for = @avg_xg_for, avg_xg_against = @avg_xg_against,
    adj_xg_for = @adj_xg_for, adj_xg_against = @adj_xg_against
  WHERE id = @id
`);

function avg(values) {
  const valid = values.filter((v) => Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function importXgData(teamsPayload) {
  const now = new Date().toISOString();

  const tx = db.transaction((teams) => {
    for (const t of teams) {
      const name = String(t.name).trim();
      if (!name) continue;

      upsertTeam.run({ name, elo: t.elo ?? null, last_updated: now });
      const { id } = getTeamId.get(name);

      deleteMatches.run(id);
      for (const m of (t.matches ?? []).slice(-15)) {
        insertMatch.run({
          team_id: id,
          date: m.date,
          opponent: m.opponent,
          score_for: m.score_for ?? null,
          score_against: m.score_against ?? null,
          xg_for: m.xg_for ?? null,
          xg_against: m.xg_against ?? null,
        });
      }
    }
  });
  tx(teamsPayload);

  recomputeAdjustedXg();

  return { teamsUpdated: teamsPayload.length, updatedAt: now };
}

function recomputeAdjustedXg() {
  const teams = db.prepare('SELECT id, name FROM teams').all();
  const byName = new Map(teams.map((t) => [t.name, t]));

  const rawRows = db.prepare(`
    SELECT team_id, AVG(xg_for) AS avg_for, AVG(xg_against) AS avg_against
    FROM team_matches
    WHERE xg_for IS NOT NULL AND xg_against IS NOT NULL
    GROUP BY team_id
  `).all();
  const rawById = new Map(rawRows.map((r) => [r.team_id, r]));

  // League-wide baseline: what an "average" opponent scores/concedes.
  const leagueAvgFor = avg(rawRows.map((r) => r.avg_for));
  const leagueAvgAgainst = avg(rawRows.map((r) => r.avg_against));

  const tx = db.transaction(() => {
    for (const team of teams) {
      const raw = rawById.get(team.id);
      const matches = db.prepare(`
        SELECT opponent, xg_for, xg_against FROM team_matches
        WHERE team_id = ? AND xg_for IS NOT NULL AND xg_against IS NOT NULL
      `).all(team.id);

      let adjFor = null;
      let adjAgainst = null;

      if (matches.length && leagueAvgFor && leagueAvgAgainst) {
        const adjForValues = [];
        const adjAgainstValues = [];

        for (const m of matches) {
          const opp = byName.get(m.opponent);
          const oppRaw = opp ? rawById.get(opp.id) : null;

          // Scoring against a stingy defence (low avg_against) is worth more.
          const oppDefenceFactor = oppRaw?.avg_against
            ? leagueAvgAgainst / oppRaw.avg_against
            : 1;
          // Conceding to a potent attack (high avg_for) is penalised less.
          const oppAttackFactor = oppRaw?.avg_for
            ? leagueAvgFor / oppRaw.avg_for
            : 1;

          adjForValues.push(m.xg_for * (Number.isFinite(oppDefenceFactor) && oppDefenceFactor > 0 ? oppDefenceFactor : 1));
          adjAgainstValues.push(m.xg_against * (Number.isFinite(oppAttackFactor) && oppAttackFactor > 0 ? oppAttackFactor : 1));
        }

        adjFor = avg(adjForValues);
        adjAgainst = avg(adjAgainstValues);
      }

      updateTeamStats.run({
        id: team.id,
        avg_xg_for: raw?.avg_for ?? null,
        avg_xg_against: raw?.avg_against ?? null,
        adj_xg_for: adjFor,
        adj_xg_against: adjAgainst,
      });
    }
  });
  tx();
}
