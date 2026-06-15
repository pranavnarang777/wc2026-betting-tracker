import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { summarise, runningPnl, potentialReturn } from '../lib/stats.js';
import { money, signedMoney, signedPct, pct, prettyDate, shortDate, odds as fmtOdds } from '../lib/format.js';

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: '#141B26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px', fontSize: 13 }}>
      <div className="muted" style={{ marginBottom: 3 }}>{prettyDate(label)}</div>
      <div className="mono" style={{ color: p.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
        {signedMoney(p.pnl)} <span className="muted" style={{ fontWeight: 400 }}>cumulative</span>
      </div>
      <div className="mono muted" style={{ fontSize: 12 }}>{signedMoney(p.dayPnl)} on day</div>
    </div>
  );
}

export default function Dashboard({ bets, onAdd }) {
  const s = useMemo(() => summarise(bets), [bets]);
  const series = useMemo(() => runningPnl(bets), [bets]);
  const openBets = useMemo(
    () => bets.filter((b) => b.status === 'open').sort((a, b) => a.date.localeCompare(b.date)),
    [bets],
  );

  const pnlClass = s.pnl > 0 ? 'pos' : s.pnl < 0 ? 'neg' : '';
  const lineColor = s.pnl >= 0 ? '#22E3A0' : '#FF5470';

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Dashboard</h1>
          <p className="page__sub">
            An AI + data exploration of World Cup 2026 — Elo, xG and odds models, tested with a small real stake to keep the analysis honest.
          </p>
        </div>
      </div>

      <div className="grid cols-3" style={{ alignItems: 'stretch' }}>
        {/* Hero P&L — spans 2 cols on wide screens */}
        <div className={`card hero ${s.pnl < 0 ? 'is-neg' : ''}`} style={{ gridColumn: 'span 2' }}>
          <div className="hero__label">Net Profit / Loss</div>
          <div className={`hero__value ${pnlClass}`}>{signedMoney(s.pnl)}</div>
          <div className="hero__meta">
            <div>
              <b className={s.roi > 0 ? 'pos' : s.roi < 0 ? 'neg' : ''}>{signedPct(s.roi)}</b>
              <span>ROI</span>
            </div>
            <div>
              <b>{money(s.totalStaked)}</b>
              <span>Total Staked</span>
            </div>
            <div>
              <b>{s.settledCount}</b>
              <span>Settled</span>
            </div>
            <div>
              <b className="pos">{money(s.openPotentialReturn)}</b>
              <span>Open Upside</span>
            </div>
            {s.avgClv != null && (
              <div>
                <b className={s.avgClv > 0 ? 'pos' : s.avgClv < 0 ? 'neg' : ''}>{signedPct(s.avgClv, 2)}</b>
                <span>Avg CLV ({s.avgClvCount})</span>
              </div>
            )}
          </div>
        </div>

        {/* Win rate spotlight */}
        <div className="card stat" style={{ justifyContent: 'center' }}>
          <div className="stat__label">Win Rate</div>
          <div className="stat__value">{pct(s.winRate, 0)}</div>
          <div className="stat__foot">{s.wins}W · {s.losses}L{s.cashouts ? ` · ${s.cashouts}C` : ''} (decided)</div>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginTop: 16 }}>
        <Stat label="Bets Placed" value={s.betsPlaced} foot={`${s.openCount} open · ${s.settledCount} settled`} />
        <Stat label="Total Staked" value={money(s.totalStaked)} foot={`${money(s.settledStaked)} settled`} />
        <Stat label="ROI" value={signedPct(s.roi)} valueClass={s.roi > 0 ? 'pos' : s.roi < 0 ? 'neg' : ''} foot="on settled stake" />
        <Stat label="Open Exposure" value={money(s.openStake)} foot={`${money(s.openPotentialReturn)} potential`} />
      </div>

      <div className="grid cols-3" style={{ marginTop: 16 }}>
        {/* Running P&L chart */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card__head">
            <div className="card__title">Running P&amp;L</div>
            <div className="muted" style={{ fontSize: 12.5 }}>cumulative · settled bets</div>
          </div>
          <div className="card__pad chart-card" style={{ height: 300 }}>
            {series.length === 0 ? (
              <div className="empty">No settled bets yet — your P&amp;L curve appears here once you settle a bet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 14, right: 16, bottom: 6, left: -10 }}>
                  <defs>
                    <linearGradient id="pnlLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={lineColor} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={lineColor} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} stroke="#5C6677" tick={{ fontSize: 12 }} tickMargin={8} />
                  <YAxis tickFormatter={(v) => `€${v}`} stroke="#5C6677" tick={{ fontSize: 12 }} width={56} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                  <Line
                    type="monotone" dataKey="pnl" stroke="url(#pnlLine)" strokeWidth={2.5}
                    dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: lineColor }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Open bets */}
        <div className="card">
          <div className="card__head">
            <div className="card__title">Open Bets</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{openBets.length} live</div>
          </div>
          {openBets.length === 0 ? (
            <div className="empty">
              No open bets.
              <div style={{ marginTop: 12 }}>
                <button className="btn btn--sm" onClick={onAdd}>+ Add a bet</button>
              </div>
            </div>
          ) : (
            <div>
              {openBets.map((b) => (
                <div className="openbet" key={b.id}>
                  <div className="openbet__match">
                    <b>{b.match}</b>
                    <small>{b.market} @ {fmtOdds(b.odds)} · {prettyDate(b.date)}</small>
                  </div>
                  <div className="openbet__ret">
                    <b>{money(potentialReturn(b))}</b>
                    <small>from {money(b.stake)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <HowWeBet />
    </div>
  );
}

function HowWeBet() {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card__head">
        <div className="card__title">How The Model Works</div>
        <div className="muted" style={{ fontSize: 12.5 }}>data and process, not vibes</div>
      </div>

      <div className="card__pad howwebet">
        <p className="lede">
          We can’t beat the market — sharp books price these games better than we can.
          The aim isn’t profit, it’s discipline: estimate each outcome’s true
          probability from <b>Elo + recent xG + structural factors</b>, compare it to the
          breakeven the odds demand (<span className="mono">1 ÷ odds</span>), and bet only
          when there’s a real cushion. Stakes are small (€200 bankroll, €25 max, scaled to
          edge), and the honest measure of success is <b>closing-line value</b>, not P&amp;L.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link to="/methodology" className="btn btn--sm">Read the full methodology →</Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, foot, valueClass = '' }) {
  return (
    <div className="card stat">
      <div className="stat__top">
        <div className="stat__label">{label}</div>
      </div>
      <div className={`stat__value ${valueClass}`}>{value}</div>
      {foot && <div className="stat__foot">{foot}</div>}
    </div>
  );
}
