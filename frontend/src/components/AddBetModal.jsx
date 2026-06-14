import { useState } from 'react';
import { money } from '../lib/format.js';

const MARKET_SUGGESTIONS = [
  'Under 2.5', 'Over 2.5', 'Both Teams to Score', 'Draw',
  'Home Win', 'Away Win', 'Asian Handicap -0.5', 'Asian Handicap +0.5',
  'Double Chance', 'Correct Score', 'First Goalscorer',
];

const today = new Date().toISOString().slice(0, 10);

export default function AddBetModal({ onClose, onSave, flash }) {
  const [form, setForm] = useState({
    match: '', date: today, market: '', odds: '', stake: '',
    closing_odds: '', in_play_cashout_price: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const odds = Number(form.odds);
  const stake = Number(form.stake);
  const potential = Number.isFinite(odds) && Number.isFinite(stake) && odds > 1 && stake > 0
    ? stake * odds
    : null;

  async function save() {
    setErr(null);
    if (!form.match.trim()) return setErr('Match is required.');
    if (!form.market.trim()) return setErr('Market is required.');
    if (!(odds > 1)) return setErr('Odds must be a decimal greater than 1.');
    if (!(stake >= 0) || form.stake === '') return setErr('Stake must be 0 or more.');

    setSaving(true);
    try {
      await onSave({
        match: form.match.trim(),
        date: form.date,
        market: form.market.trim(),
        odds,
        stake,
        status: 'open',
        closing_odds: form.closing_odds === '' ? null : Number(form.closing_odds),
        in_play_cashout_price: form.in_play_cashout_price === '' ? null : Number(form.in_play_cashout_price),
        notes: form.notes.trim() || null,
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
            <div className="modal__title">New bet</div>
            <div className="modal__sub">Log a wager to your World Cup ledger.</div>
          </div>
          <button className="x-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal__body">
          <div className="field">
            <label>Match</label>
            <input className="input" placeholder="Qatar vs Switzerland" value={form.match} onChange={set('match')} autoFocus />
          </div>

          <div className="row2">
            <div className="field">
              <label>Date</label>
              <input className="input" type="date" value={form.date} onChange={set('date')} />
            </div>
            <div className="field">
              <label>Market</label>
              <input className="input" placeholder="Under 2.5" value={form.market} onChange={set('market')} list="markets" />
              <datalist id="markets">
                {MARKET_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label>Odds (decimal)</label>
              <input className="input mono" type="number" step="0.01" min="1.01" inputMode="decimal" placeholder="2.15" value={form.odds} onChange={set('odds')} />
            </div>
            <div className="field">
              <label>Stake (€)</label>
              <input className="input mono" type="number" step="0.01" min="0" inputMode="decimal" placeholder="10.00" value={form.stake} onChange={set('stake')} />
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label>Closing odds <span className="muted">· optional</span></label>
              <input className="input mono" type="number" step="0.01" min="1.01" inputMode="decimal" placeholder="Pinnacle close" value={form.closing_odds} onChange={set('closing_odds')} />
              <div className="hint">Pinnacle closing line — powers CLV tracking.</div>
            </div>
            <div className="field">
              <label>In-play cashout <span className="muted">· optional</span></label>
              <input className="input mono" type="number" step="0.01" min="0" inputMode="decimal" placeholder="Offered price" value={form.in_play_cashout_price} onChange={set('in_play_cashout_price')} />
            </div>
          </div>

          <div className="field">
            <label>Notes <span className="muted">· optional</span></label>
            <textarea className="textarea" placeholder="Reasoning, line movement, conditions…" value={form.notes} onChange={set('notes')} />
          </div>

          {potential != null && (
            <div className="hint">Potential return if it wins: <b className="pos mono">{money(potential)}</b></div>
          )}
          {err && <div className="form-error">{err}</div>}
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Add bet'}
          </button>
        </div>
      </div>
    </div>
  );
}
