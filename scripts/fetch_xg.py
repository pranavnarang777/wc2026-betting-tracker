"""
Pulls each WC2026 team's last 15 international matches from FBref (via the
soccerdata/cloudscraper toolchain, which handles FBref's Cloudflare bot
protection), extracts xG/xGA, and POSTs the result to the betting tracker's
backend so it can compute rolling and opponent-adjusted xG.

Run via the "Update xG data" GitHub Action, or locally with:
    API_URL=https://your-backend.onrender.com CRON_SECRET=... python scripts/fetch_xg.py

Edit teams.json to add/remove teams as WC2026 squads are finalised.
"""

import json
import os
import re
import sys
import time
from io import StringIO
from pathlib import Path

import pandas as pd

try:
    import cloudscraper
    SCRAPER = cloudscraper.create_scraper()
except ImportError:
    import requests
    SCRAPER = requests.Session()

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; wc2026-betting-tracker xG fetch)"}
TEAMS_FILE = Path(__file__).parent / "teams.json"
REQUEST_DELAY_SECONDS = 6  # be polite to FBref (~10 req/min max)


def fetch(url):
    last_err = None
    for attempt in range(3):
        try:
            resp = SCRAPER.get(url, headers=HEADERS, timeout=30)
            if resp.status_code == 200:
                return resp.text
            last_err = f"HTTP {resp.status_code}"
        except Exception as e:  # noqa: BLE001
            last_err = str(e)
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"failed to fetch {url}: {last_err}")


def find_squad_url(team):
    """Locate a national team's FBref squad page via its country page."""
    country_url = f"https://fbref.com/en/country/{team['iso3']}/{team['slug']}-Football"
    html = fetch(country_url)
    time.sleep(REQUEST_DELAY_SECONDS)

    m = re.search(r'href="(/en/squads/[0-9a-f]{8}/[^"]*Men[^"]*National-Team-Stats)"', html)
    if not m:
        m = re.search(r'href="(/en/squads/[0-9a-f]{8}/[^"]*National-Team-Stats)"', html)
    if not m:
        return None
    return "https://fbref.com" + m.group(1)


def fetch_match_log(squad_url):
    """Fetch the Scores & Fixtures table (includes xG/xGA per match)."""
    fixtures_url = squad_url.replace("-Stats", "/Scores-and-Fixtures")
    html = fetch(fixtures_url)
    time.sleep(REQUEST_DELAY_SECONDS)

    tables = pd.read_html(StringIO(html))
    for df in tables:
        cols = [str(c) for c in df.columns]
        if "xG" in cols and "xGA" in cols and "Opponent" in cols:
            return df
    return None


def parse_goals(value):
    """FBref scores can include shootout notation, e.g. '2 (5)' -> 2."""
    m = re.match(r"\s*(\d+)", str(value))
    return int(m.group(1)) if m else None


def build_matches(df):
    df = df[df["Result"].notna() & df["Date"].notna()]
    matches = []
    for _, row in df.tail(15).iterrows():
        try:
            date = pd.to_datetime(row["Date"]).strftime("%Y-%m-%d")
            score_for = parse_goals(row["GF"])
            score_against = parse_goals(row["GA"])
            xg_for = float(row["xG"]) if pd.notna(row.get("xG")) else None
            xg_against = float(row["xGA"]) if pd.notna(row.get("xGA")) else None
            matches.append({
                "date": date,
                "opponent": str(row["Opponent"]).strip(),
                "score_for": score_for,
                "score_against": score_against,
                "xg_for": xg_for,
                "xg_against": xg_against,
            })
        except Exception:  # noqa: BLE001
            continue
    return matches


def main():
    api_url = os.environ.get("API_URL", "").rstrip("/")
    cron_secret = os.environ.get("CRON_SECRET", "")
    if not api_url or not cron_secret:
        print("API_URL and CRON_SECRET env vars are required", file=sys.stderr)
        sys.exit(1)

    teams = json.loads(TEAMS_FILE.read_text())
    payload_teams = []

    for team in teams:
        name = team["name"]
        try:
            squad_url = find_squad_url(team)
            if not squad_url:
                print(f"[skip] {name}: could not find FBref squad page", file=sys.stderr)
                continue

            df = fetch_match_log(squad_url)
            if df is None:
                print(f"[skip] {name}: no Scores & Fixtures table with xG found", file=sys.stderr)
                continue

            matches = build_matches(df)
            if not matches:
                print(f"[skip] {name}: no usable match rows", file=sys.stderr)
                continue

            payload_teams.append({"name": name, "matches": matches})
            print(f"[ok] {name}: {len(matches)} matches")
        except Exception as e:  # noqa: BLE001
            print(f"[error] {name}: {e}", file=sys.stderr)

    if not payload_teams:
        print("No team data collected — aborting without updating the API", file=sys.stderr)
        sys.exit(1)

    import requests as _requests
    resp = _requests.post(
        f"{api_url}/api/cron/update-xg?key={cron_secret}",
        json={"teams": payload_teams},
        timeout=60,
    )
    print(f"POST /api/cron/update-xg -> {resp.status_code} {resp.text}")
    resp.raise_for_status()


if __name__ == "__main__":
    main()
