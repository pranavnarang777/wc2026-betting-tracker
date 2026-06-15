# Forecast — a World Cup 2026 data & model exploration

A single-user project for exploring sports forecasting with data and AI: Elo
ratings, xG form, and market odds feed a model for each World Cup 2026 fixture,
backed by a "Generate Briefing" export. A handful of small real-money bets sit
alongside the model as a way of keeping the analysis honest — track each one,
settle in a click, and review the model's calibration — P&L by market, win rate
by odds range, and closing-line value (CLV) against the Pinnacle close.

- **Frontend:** React + Vite + Recharts (deploy to Vercel)
- **Backend:** Node/Express + SQLite via `better-sqlite3` (deploy to Render, free tier)
- **No auth, single user.** Mobile responsive.

The look — *Forecast* — is a stadium-at-night dark theme: emerald "in-profit"
green, coral loss red, electric-blue accents, with Space Grotesk display type and
Space Mono tabular figures.

## Features

| Page | What it shows |
|------|---------------|
| **Dashboard** | Net P&L hero (green/red), ROI %, bets placed, win rate, total staked, open exposure & upside, open-bet list with potential return, cumulative running P&L line chart. |
| **Bet Log** | Sortable table (date / market / odds / stake), colour-coded status pills, actual return, per-bet P&L. Settle/edit via modal; delete with confirm. |
| **Analytics** | P&L by market (bar), win rate by odds bucket (1.5–2.0 / 2.0–2.5 / 2.5–3.0 / 3.0+), average odds of winners vs losers, and CLV (avg edge vs close, beat rate, per-bet table). |

A starter bet is seeded on first boot: **Qatar vs Switzerland, 13 Jun 2026,
Under 2.5, odds 2.15, €10, open.**

## Data model

Each bet: `id`, `match`, `date` (ISO), `market`, `odds` (decimal), `stake` (EUR),
`status` (`open`/`won`/`lost`/`cashout`), `return_actual` (null until settled),
`closing_odds` (optional, Pinnacle close — powers CLV), `in_play_cashout_price`
(optional), `notes`.

> `return_actual` is the **total** returned including stake. A full win pays
> `stake × odds`; a loss is `0`; a cashout is whatever you entered.

## Run locally

Two terminals:

```bash
# 1) API  → http://localhost:4000
cd backend
npm install
npm run dev

# 2) Web  → http://localhost:5173  (Vite proxies /api → :4000)
cd frontend
npm install
npm run dev
```

## API

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/health` | Liveness probe |
| GET | `/api/bets` | List all bets (newest first) |
| POST | `/api/bets` | Create a bet |
| PUT | `/api/bets/:id` | Update / settle (partial body) |
| DELETE | `/api/bets/:id` | Delete a bet |

## Deploy

### Backend → Render (free tier)
Use the included [`render.yaml`](render.yaml) blueprint (New → Blueprint), or
create a Web Service manually with **root dir** `backend`, build `npm install`,
start `npm start`, health-check path `/api/health`.

⚠️ The free tier has an **ephemeral filesystem** — the SQLite DB resets on every
deploy/restart (the starter bet re-seeds). To persist, attach a Render Disk and
set `DB_PATH` to a path on it (see comments in `render.yaml`).

### Frontend → Vercel
Import the repo, set **root directory** to `frontend`. Add an environment
variable `VITE_API_URL` = your Render URL (e.g. `https://wc2026-betting-api.onrender.com`).
SPA routing is handled by [`frontend/vercel.json`](frontend/vercel.json).
