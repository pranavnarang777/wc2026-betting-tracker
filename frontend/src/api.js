// Thin API client. In dev, VITE_API_URL is blank and Vite proxies /api to the
// backend. In production set VITE_API_URL to the Render URL.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).error || '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listBets: () => request('/api/bets'),
  createBet: (bet) => request('/api/bets', { method: 'POST', body: JSON.stringify(bet) }),
  updateBet: (id, patch) =>
    request(`/api/bets/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteBet: (id) => request(`/api/bets/${id}`, { method: 'DELETE' }),
};
