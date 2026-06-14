const eur = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Currency with an explicit +/- sign — used for P&L figures.
export function money(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return eur.format(value);
}

export function signedMoney(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${eur.format(Math.abs(value))}`;
}

export function pct(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function signedPct(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export function odds(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(2);
}

// 2026-06-13 -> "13 Jun 2026"
export function prettyDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function shortDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
