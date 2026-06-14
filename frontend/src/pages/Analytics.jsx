import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList,
} from 'recharts';
import {
  pnlByMarket, winRateByOdds, avgOddsWinnersLosers, clv,
} from '../lib/stats.js';
import { signedMoney, money, pct, signedPct, odds as fmtOdds } from '../lib/format.js';

const GREEN = '#22E3A0';
const RED = '#FF5470';
const BLUE = '#4DA8FF';

export default function Analytics({ bets }) {
  const markets = useMemo(() => pnlByMarket(bets), [bets]);
  const oddsBuckets = useMemo(() => winRateByOdds(bets), [bets]);
  const avgOdds = useMemo(() => avgOddsWinnersLosers(bets), [bets]);
  const clvData = useMemo(() => clv(bets), [bets]);

  const hasSettled = markets.length > 0;

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Analytics</h1>
          <p className="page__sub">Edge, market breakdown and closing-line value.</p>
        </div>
      </div>

      {/* P&L by market */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <div className="card__title">P&amp;L by Market</div>
          <div className="muted" style={{ fontSize: 12.5 }}>settled bets · EUR</div>
        </div>
        <div className="card__pad chart-card" style={{ height: 320 }}>
          {!hasSettled ? (
            <div className="empty">Settle some bets to see which markets make you money.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={markets} margin={{ top: 20, right: 16, bottom: 6, left: -8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="market" stroke="#5C6677" tick={{ fontSize: 12 }} tickMargin={8} interval={0} angle={markets.length > 5 ? -15 : 0} height={markets.length > 5 ? 44 : 30} />
                <YAxis tickFormatter={(v) => `€${v}`} stroke="#5C6677" tick={{ fontSize: 12 }} width={56} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{ background: '#141B26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}
                  formatter={(v, _n, p) => [signedMoney(v), `${p.payload.bets} bet${p.payload.bets === 1 ? '' : 's'}`]}
                />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {markets.map((m) => <Cell key={m.market} fill={m.pnl >= 0 ? GREEN : RED} />)}
                  <LabelList dataKey="pnl" position="top" formatter={(v) => signedMoney(v)} style={{ fill: '#8B97A8', fontSize: 11, fontFamily: 'Space Mono' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid cols-2">
        {/* Win rate by odds bucket */}
        <div className="card">
          <div className="card__head">
            <div className="card__title">Win Rate by Odds Range</div>
            <div className="muted" style={{ fontSize: 12.5 }}>decided bets</div>
          </div>
          <div className="card__pad chart-card" style={{ height: 280 }}>
            {oddsBuckets.every((b) => b.total === 0) ? (
              <div className="empty">No won/lost bets yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={oddsBuckets} margin={{ top: 20, right: 16, bottom: 6, left: -16 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="bucket" stroke="#5C6677" tick={{ fontSize: 11.5 }} tickMargin={8} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#5C6677" tick={{ fontSize: 12 }} width={44} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{ background: '#141B26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}
                    formatter={(v, _n, p) => [`${v}%`, `${p.payload.wins}/${p.payload.total} won`]}
                  />
                  <Bar dataKey="winRate" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {oddsBuckets.map((b) => (
                      <Cell key={b.bucket} fill={b.total === 0 ? 'rgba(255,255,255,0.08)' : BLUE} />
                    ))}
                    <LabelList dataKey="winRate" position="top" formatter={(v) => `${v}%`} style={{ fill: '#8B97A8', fontSize: 11, fontFamily: 'Space Mono' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Average odds winners vs losers */}
        <div className="card">
          <div className="card__head">
            <div className="card__title">Average Odds · Winners vs Losers</div>
          </div>
          <div className="card__pad" style={{ paddingTop: 22 }}>
            <AvgOddsBars avg={avgOdds} />
            <p className="hint" style={{ marginTop: 18 }}>
              Winning at <b>higher</b> average odds than you lose at is a hallmark of value betting —
              it means you’re finding edges the market underrates.
            </p>
          </div>
        </div>
      </div>

      {/* CLV */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__head">
          <div className="card__title">Closing Line Value (CLV)</div>
          <div className="muted" style={{ fontSize: 12.5 }}>your price vs Pinnacle close</div>
        </div>
        <div className="card__pad">
          {clvData.count === 0 ? (
            <div className="empty">
              Add a <b>closing odds</b> figure to your bets to track CLV — your edge against the sharpest line in the market.
            </div>
          ) : (
            <>
              <div className="grid cols-3" style={{ marginBottom: 16 }}>
                <div className="kpi-mini" style={{ flexDirection: 'column', gap: 2 }}>
                  <b className={clvData.avgEdge > 0 ? 'pos' : clvData.avgEdge < 0 ? 'neg' : ''}>{signedPct(clvData.avgEdge, 2)}</b>
                  <span>Average edge vs close</span>
                </div>
                <div className="kpi-mini" style={{ flexDirection: 'column', gap: 2 }}>
                  <b className={clvData.beatRate >= 50 ? 'pos' : ''}>{pct(clvData.beatRate, 0)}</b>
                  <span>Bets that beat the close</span>
                </div>
                <div className="kpi-mini" style={{ flexDirection: 'column', gap: 2 }}>
                  <b>{clvData.count}</b>
                  <span>Bets with a closing line</span>
                </div>
              </div>

              <div className="table-wrap">
                <table className="bets">
                  <thead>
                    <tr>
                      <th>Match</th><th>Market</th>
                      <th style={{ textAlign: 'right' }}>Your Odds</th>
                      <th style={{ textAlign: 'right' }}>Close</th>
                      <th style={{ textAlign: 'right' }}>Edge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clvData.rows.map((r) => (
                      <tr key={r.id}>
                        <td><b style={{ fontWeight: 600 }}>{r.match}</b></td>
                        <td><span className="market-tag">{r.market}</span></td>
                        <td className="num">{fmtOdds(r.yourOdds)}</td>
                        <td className="num">{fmtOdds(r.closingOdds)}</td>
                        <td className={`num ${r.edge > 0 ? 'pos' : r.edge < 0 ? 'neg' : ''}`} style={{ fontWeight: 700 }}>
                          {signedPct(r.edge, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AvgOddsBars({ avg }) {
  const max = Math.max(avg.winners ?? 0, avg.losers ?? 0, 1) * 1.1;
  const rows = [
    { lab: 'Winners', val: avg.winners, n: avg.winnersCount, color: GREEN },
    { lab: 'Losers', val: avg.losers, n: avg.losersCount, color: RED },
  ];
  return (
    <div className="vs-bars">
      {rows.map((r) => (
        <div className="vs-row" key={r.lab}>
          <div className="lab">{r.lab}<br /><span className="muted" style={{ fontSize: 11 }}>{r.n} bet{r.n === 1 ? '' : 's'}</span></div>
          <div className="vs-track">
            <div
              className="vs-fill"
              style={{
                width: r.val ? `${(r.val / max) * 100}%` : '0%',
                background: `linear-gradient(90deg, ${r.color}55, ${r.color})`,
              }}
            />
          </div>
          <div className="vs-val">{r.val ? fmtOdds(r.val) : '—'}</div>
        </div>
      ))}
    </div>
  );
}
