import { useMemo } from 'react';
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
          <p className="page__sub">Your World Cup 2026 betting performance at a glance.</p>
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

const STRUCTURAL_FACTORS = [
  'Travel distance & altitude shifts between fixtures',
  'Rest days & fixture congestion vs the opponent',
  'Kickoff time, heat & humidity at the venue',
  'Squad rotation and "dead rubber" group games',
  'Confirmed late injuries / suspensions to key players',
  'Historic head-to-head tempo (high vs low-event games)',
  'Referee tendencies and likely game-state (cards, fouls, time-wasting)',
  'Market overreaction to big-name reputation vs current form',
];

function HowWeBet() {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card__head">
        <div className="card__title">How We Bet</div>
        <div className="muted" style={{ fontSize: 12.5 }}>process, not vibes</div>
      </div>

      <div className="card__pad howwebet">
        <div className="howwebet__grid">
          <div className="howwebet__item">
            <div className="howwebet__num">01</div>
            <h3>Elo + Poisson baseline</h3>
            <p>
              Every match starts with team Elo ratings converted into expected goals
              for each side. Those expected goals feed a Poisson model that prices
              scorelines, totals (over/under), both-teams-to-score and handicap lines —
              giving us a model probability for every market before we look at the odds.
            </p>
          </div>

          <div className="howwebet__item">
            <div className="howwebet__num">02</div>
            <h3>Pinnacle close as the value filter</h3>
            <p>
              The model price alone isn't enough — we compare it against <b>Pinnacle's
              closing line</b>, the sharpest number the market produces. If our price beats
              the close (positive CLV), that's evidence of genuine edge. If the close moves
              against us, the bet is treated as a model error, win or lose.
            </p>
          </div>

          <div className="howwebet__item howwebet__item--wide">
            <div className="howwebet__num">03</div>
            <h3>Eight structural &amp; hidden factors</h3>
            <p>Before staking, every fixture is screened for the situational edges a pure ratings model misses:</p>
            <ol className="howwebet__factors">
              {STRUCTURAL_FACTORS.map((f) => <li key={f}>{f}</li>)}
            </ol>
          </div>

          <div className="howwebet__item">
            <div className="howwebet__num">04</div>
            <h3>Markets: target vs avoid</h3>
            <div className="howwebet__markets">
              <div>
                <span className="pill pill--won" style={{ marginBottom: 8 }}>Target</span>
                <ul>
                  <li>Totals — over/under goals</li>
                  <li>Draw markets</li>
                  <li>Underdogs &amp; handicap dogs</li>
                </ul>
              </div>
              <div>
                <span className="pill pill--lost" style={{ marginBottom: 8 }}>Avoid</span>
                <ul>
                  <li>Combos / parlays</li>
                  <li>Unconfirmed player props</li>
                  <li>Heavily juiced favourites</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="howwebet__item">
            <div className="howwebet__num">05</div>
            <h3>Bankroll rules</h3>
            <div className="howwebet__bankroll">
              <div><b>€200</b><span>Total bankroll</span></div>
              <div><b>€25</b><span>Max single bet</span></div>
              <div><b>0</b><span>Loss-chasing bets</span></div>
            </div>
            <p>
              Stakes never exceed 12.5% of bankroll on a single bet, and a losing run never
              changes the process — no doubling up, no revenge bets.
            </p>
          </div>
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
