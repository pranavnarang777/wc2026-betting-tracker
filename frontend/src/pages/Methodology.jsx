// Methodology — explains the forecasting/betting model behind the project.
// Reuses the `howwebet__*` design-system classes from the Dashboard explainer.

const ESTIMATION_INPUTS = [
  'Elo ratings — the baseline strength gap between the two sides',
  'Recent xG form — how many chances each team actually creates and concedes',
  'Opponent-adjusted xG — form weighted by the quality of who it came against',
  'Opener conservatism — first games trend cagey and low-event',
  'Fatigue, travel and altitude across a congested fixture list',
  'Defensive matchups and confirmed late lineups / absences',
];

export default function Methodology() {
  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Methodology</h1>
          <p className="page__sub">
            What the model is actually trying to do — and, just as importantly, what it is not.
          </p>
        </div>
      </div>

      {/* Core principle */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <div className="card__title">The core principle</div>
          <div className="muted" style={{ fontSize: 12.5 }}>honesty before edge</div>
        </div>
        <div className="card__pad howwebet">
          <p className="lede">
            We cannot beat the market. World Cup odds are set by sharp bookmakers with
            more data, better models and far deeper pockets than this project. There is
            no system that reliably prints profit against an efficient market — anyone
            selling one is selling the dream, not the maths.
          </p>
          <p className="lede" style={{ marginTop: 12 }}>
            So the goal is not profit. It is <b>disciplined, sensible betting</b>: take
            only the bets that are priced fair-or-better, pass on everything else, and
            accept that the honest expected outcome is roughly break-even — with a
            coin-flip chance of finishing the tournament up. Played that way, the
            entertainment is close to free. That is the win condition. Not getting rich.
          </p>
        </div>
      </div>

      {/* Decision rule */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <div className="card__title">The decision rule</div>
          <div className="muted" style={{ fontSize: 12.5 }}>price &gt; probability</div>
        </div>
        <div className="card__pad howwebet">
          <p className="lede">
            A bet is only sensible when our estimated <b>true probability</b> of the
            outcome is higher than the <b>breakeven probability</b> the price demands:
          </p>
          <div className="formula">
            breakeven&nbsp;=&nbsp;1&nbsp;÷&nbsp;decimal&nbsp;odds
          </div>
          <p className="lede">
            “Likely to happen” is <b>not</b> the test. A heavy favourite at short odds
            usually wins — and is usually still a bad bet, because the price already
            more than accounts for it. The only question that matters is: <b>is this
            price fair or better for the real probability?</b> A 35% shot at odds of
            3.50 (breakeven 28.6%) is a good bet; a 90% shot at 1.05 (breakeven 95.2%)
            is a bad one.
          </p>
        </div>
      </div>

      {/* Process per match */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <div className="card__title">The process, per match</div>
          <div className="muted" style={{ fontSize: 12.5 }}>four steps</div>
        </div>
        <div className="card__pad howwebet">
          <div className="howwebet__grid">
            <div className="howwebet__item howwebet__item--wide">
              <div className="howwebet__num">01</div>
              <h3>Estimate the true probability</h3>
              <p>Build a number for the outcome from the model’s inputs:</p>
              <ol className="howwebet__factors">
                {ESTIMATION_INPUTS.map((f) => <li key={f}>{f}</li>)}
              </ol>
            </div>

            <div className="howwebet__item">
              <div className="howwebet__num">02</div>
              <h3>Calculate what the price demands</h3>
              <p>
                Turn the odds into the breakeven probability (1 ÷ odds). That is the bar
                the outcome has to clear just to make the bet a wash.
              </p>
            </div>

            <div className="howwebet__item">
              <div className="howwebet__num">03</div>
              <h3>Require a real cushion</h3>
              <p>
                Bet only when the true probability clears breakeven by roughly <b>3
                percentage points or more</b>. Thinner edges live inside our own
                estimation error — they aren’t real, so they aren’t worth it.
              </p>
            </div>

            <div className="howwebet__item howwebet__item--wide">
              <div className="howwebet__num">04</div>
              <h3>Cross-check the sharps</h3>
              <p>
                Compare our number against market consensus wherever possible. If we
                wildly disagree with the sharpest books, the base-rate assumption is
                that <b>we are wrong, not them</b> — and the bet gets dropped. The model
                looks for prices the market has been lazy about, not prices it has
                thought hard about and disagreed with us on.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Markets */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <div className="card__title">Where the lazy prices live</div>
          <div className="muted" style={{ fontSize: 12.5 }}>target vs avoid</div>
        </div>
        <div className="card__pad howwebet">
          <div className="howwebet__markets">
            <div>
              <span className="pill pill--won" style={{ marginBottom: 8 }}>Target</span>
              <ul>
                <li><b>Double Chance</b> — two of three results, lower variance</li>
                <li><b>Totals</b> — over / under goals, many paths to landing</li>
                <li><b>Team to score</b> — robust, simple, often mispriced on minnows</li>
              </ul>
              <p style={{ marginTop: 8 }}>
                Lower-variance, many-paths markets — especially on smaller matches the
                books price lazily.
              </p>
            </div>
            <div>
              <span className="pill pill--lost" style={{ marginBottom: 8 }}>Avoid</span>
              <ul>
                <li><b>Juiced favourites</b> — no value in being right about who wins</li>
                <li><b>Combos / parlays</b> — multiply the vig, destroy leg value</li>
                <li><b>Boosted player props</b> — marketing, not information leaks</li>
                <li><b>Early-payout markets</b> — structurally inferior by design</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Validation */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <div className="card__title">How we know if it’s working</div>
          <div className="muted" style={{ fontSize: 12.5 }}>CLV, not P&amp;L</div>
        </div>
        <div className="card__pad howwebet">
          <p className="lede">
            Win/loss results over a small sample tell us almost nothing. A good bet can
            lose and a bad bet can win. Our own <b>Qatar Under 2.5 won despite the game
            producing ~4.0 xG</b> — a bad bet rescued by a lucky scoreline. The result
            flattered a poor decision.
          </p>
          <p className="lede" style={{ marginTop: 12 }}>
            The only honest measure of whether the process has an edge is <b>Closing Line
            Value (CLV)</b>: did the price we took beat the price at kickoff, once the
            market had finished moving? Consistently positive CLV is real evidence of
            edge; P&amp;L over a handful of bets is mostly noise. So we track CLV on every
            settled bet and treat <i>that</i> — not the running total — as the signal.
          </p>
        </div>
      </div>

      {/* Staking */}
      <div className="card">
        <div className="card__head">
          <div className="card__title">Staking &amp; bankroll</div>
          <div className="muted" style={{ fontSize: 12.5 }}>small, scaled, never chased</div>
        </div>
        <div className="card__pad howwebet">
          <div className="howwebet__bankroll">
            <div><b>€200</b><span>Total bankroll</span></div>
            <div><b>€25</b><span>Max single bet</span></div>
            <div><b>0</b><span>Loss-chasing bets</span></div>
          </div>
          <p className="lede">
            Stake is scaled to the size of the edge, not to a hunch: a thin,
            borderline edge is a <b>€5 flutter</b>; a clear one is around <b>€10</b>. No
            single bet exceeds €25, and a losing run never changes the process — no
            doubling up, no revenge bets. The bankroll is small on purpose. It exists to
            keep the analysis honest, not to make money.
          </p>
        </div>
      </div>
    </div>
  );
}
