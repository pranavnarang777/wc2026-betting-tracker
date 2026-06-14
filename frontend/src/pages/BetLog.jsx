import { useMemo, useState } from 'react';
import StatusPill from '../components/StatusPill.jsx';
import SettleModal from '../components/SettleModal.jsx';
import { betPnl, isSettled, potentialReturn } from '../lib/stats.js';
import { money, signedMoney, odds as fmtOdds, prettyDate } from '../lib/format.js';

const COLUMNS = [
  { key: 'date', label: 'Date', sortable: true, align: 'left' },
  { key: 'match', label: 'Match', sortable: false, align: 'left' },
  { key: 'market', label: 'Market', sortable: true, align: 'left' },
  { key: 'odds', label: 'Odds', sortable: true, align: 'right' },
  { key: 'stake', label: 'Stake', sortable: true, align: 'right' },
  { key: 'status', label: 'Status', sortable: false, align: 'left' },
  { key: 'return', label: 'Return', sortable: false, align: 'right' },
  { key: 'pnl', label: 'P&L', sortable: false, align: 'right' },
  { key: 'actions', label: '', sortable: false, align: 'right' },
];

export default function BetLog({ bets, onUpdate, onDelete, onAdd, flash }) {
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [settling, setSettling] = useState(null);

  const sorted = useMemo(() => {
    const arr = bets.slice();
    const { key, dir } = sort;
    const mul = dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let cmp;
      if (key === 'date') cmp = a.date.localeCompare(b.date) || a.id - b.id;
      else if (key === 'market') cmp = a.market.localeCompare(b.market);
      else cmp = (a[key] ?? 0) - (b[key] ?? 0);
      return cmp * mul;
    });
    return arr;
  }, [bets, sort]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  async function remove(bet) {
    if (!window.confirm(`Delete bet "${bet.match} · ${bet.market}"? This can’t be undone.`)) return;
    try {
      await onDelete(bet.id);
    } catch (e) {
      flash?.(e.message, true);
    }
  }

  const arrow = (key) => (sort.key === key ? <span className="arrow">{sort.dir === 'asc' ? '↑' : '↓'}</span> : null);

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Bet Log</h1>
          <p className="page__sub">{bets.length} bet{bets.length === 1 ? '' : 's'} · click a column to sort, settle inline.</p>
        </div>
        <button className="btn btn--primary" onClick={onAdd}>+ Add Bet</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="bets">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={c.sortable ? 'sortable' : ''}
                    style={{ textAlign: c.align }}
                    onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                  >
                    {c.label}{c.sortable && arrow(c.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={COLUMNS.length}><div className="empty">No bets yet. Add your first wager to get started.</div></td></tr>
              ) : (
                sorted.map((b) => {
                  const pnl = betPnl(b);
                  const settled = isSettled(b);
                  return (
                    <tr key={b.id}>
                      <td className="num" style={{ textAlign: 'left' }}>{prettyDate(b.date)}</td>
                      <td className="match-cell">
                        <b>{b.match}</b>
                        {b.notes && <small>{b.notes}</small>}
                      </td>
                      <td><span className="market-tag">{b.market}</span></td>
                      <td className="num">{fmtOdds(b.odds)}</td>
                      <td className="num">{money(b.stake)}</td>
                      <td><StatusPill status={b.status} /></td>
                      <td className="num">
                        {settled ? money(b.return_actual ?? 0) : <span className="muted">{money(potentialReturn(b))}*</span>}
                      </td>
                      <td className={`num ${pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : ''}`} style={{ fontWeight: 700 }}>
                        {pnl == null ? <span className="muted" style={{ fontWeight: 400 }}>—</span> : signedMoney(pnl)}
                      </td>
                      <td className="num">
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button className="btn btn--sm" onClick={() => setSettling(b)}>
                            {settled ? 'Edit' : 'Settle'}
                          </button>
                          <button className="btn btn--sm btn--danger" onClick={() => remove(b)} aria-label="Delete bet">✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>* potential return shown for open bets.</p>

      {settling && (
        <SettleModal
          bet={settling}
          onClose={() => setSettling(null)}
          onSave={onUpdate}
          flash={flash}
        />
      )}
    </div>
  );
}
