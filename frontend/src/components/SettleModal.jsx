import { useMemo, useState } from 'react';
import { money, signedMoney, odds as fmtOdds, prettyDate } from '../lib/format.js';

// Settle (or re-settle) a bet. Lets the user mark won / lost / cashout and
// enter the actual return, with a live P&L preview before saving.
export default function SettleModal({ bet, onClose, onSave, flash }) {
  const fullReturn = +(bet.stake * bet.odds).toFixed(2);

  const [outcome, setOutcome] = useState(bet.status === 'open' ? 'won' : bet.status);
  const [ret, setRet] = useState(() => {
    if (bet.status === 'won' || bet.status === 'cashout') return String(bet.return_actual ?? fullReturn);
    return String(fullReturn);
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // The return figure only applies to won / cashout; a loss always returns 0.
  const returnValue = outcome === 'lost' ? 0 : Number(ret);
  const pnl = useMemo(() => {
    if (outcome === 'lost') return -bet.stake;
    if (!Number.isFinite(returnValue)) return null;
    return returnValue - bet.stake;
  }, [outcome, returnValue, bet.stake]);

  async function save() {
    setErr(null);
    if (outcome !== 'lost') {
      if (!Number.isFinite(returnValue) || returnValue < 0) {
        setErr('Enter a valid return amount (€).');
        return;
      }
    }
    setSaving(true);
    try {
      await onSave(bet.id, {
        status: outcome,
        return_actual: outcome === 'lost' ? 0 : returnValue,
      });
      onClose();
    } catch (e) {
      setErr(e.message);
      flash?.(e.message, true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <div className="modal__title">Settle bet</div>
            <div className="modal__sub">
              {bet.match} · {bet.market} @ {fmtOdds(bet.odds)} · {prettyDate(bet.date)}
            </div>
          </div>
          <button className="x-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal__body">
          <div className="field">
            <label>Outcome</label>
            <div className="seg">
              <button
                className={outcome === 'won' ? 'on-won' : ''}
                onClick={() => { setOutcome('won'); setRet(String(fullReturn)); }}
              >Won</button>
              <button
                className={outcome === 'lost' ? 'on-lost' : ''}
                onClick={() => setOutcome('lost')}
              >Lost</button>
              <button
                className={outcome === 'cashout' ? 'on-cash' : ''}
                onClick={() => setOutcome('cashout')}
              >Cashout</button>
            </div>
          </div>

          {outcome !== 'lost' && (
            <div className="field">
              <label>{outcome === 'cashout' ? 'Cashout return (€)' : 'Actual return (€)'}</label>
              <input
                className="input mono"
                type="number" step="0.01" min="0" inputMode="decimal"
                value={ret}
                onChange={(e) => setRet(e.target.value)}
                autoFocus
              />
              <div className="hint">
                Total returned including stake. Full win pays {money(fullReturn)} (stake {money(bet.stake)} @ {fmtOdds(bet.odds)}).
              </div>
            </div>
          )}

          <div
            className="card__pad"
            style={{
              marginTop: 4, borderRadius: 12,
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line-soft)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span className="muted" style={{ fontSize: 13 }}>Resulting P&amp;L</span>
            <b className={`mono ${pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : ''}`} style={{ fontSize: 20 }}>
              {signedMoney(pnl)}
            </b>
          </div>

          {err && <div className="form-error">{err}</div>}
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Settle bet'}
          </button>
        </div>
      </div>
    </div>
  );
}
