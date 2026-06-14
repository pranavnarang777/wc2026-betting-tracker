import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatBriefing } from '../lib/briefing.js';
import { prettyDate } from '../lib/format.js';

export default function Briefing({ flash }) {
  const [fixtures, setFixtures] = useState([]);
  const [fixturesErr, setFixturesErr] = useState(null);
  const [fixtureId, setFixtureId] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.listFixtures().then(setFixtures).catch((e) => setFixturesErr(e.message));
  }, []);

  const generate = async () => {
    if (!fixtureId) return;
    setLoading(true);
    setErr(null);
    setText('');
    try {
      const data = await api.getBriefing(fixtureId);
      setText(formatBriefing(data));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash?.('Briefing copied to clipboard');
    } catch {
      flash?.('Could not copy — select the text and copy manually', true);
    }
  };

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Generate Briefing</h1>
          <p className="page__sub">One copy-pasteable text block with form, xG, H2H, Elo, odds &amp; line movement for a fixture.</p>
        </div>
      </div>

      <div className="card card__pad" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="input"
          style={{ maxWidth: 360, flex: '1 1 280px' }}
          value={fixtureId}
          onChange={(e) => { setFixtureId(e.target.value); setText(''); setErr(null); }}
        >
          <option value="">Select a fixture…</option>
          {fixtures.map((f) => (
            <option key={f.id} value={f.id}>
              {f.home_team} vs {f.away_team} — {prettyDate(f.date)}
            </option>
          ))}
        </select>
        <button className="btn btn--primary" onClick={generate} disabled={!fixtureId || loading}>
          {loading ? 'Generating…' : 'Generate Briefing'}
        </button>
        {text && (
          <button className="btn" onClick={copy}>Copy to clipboard</button>
        )}
      </div>

      {fixturesErr && (
        <div className="card card__pad empty" style={{ marginTop: 16 }}>
          Couldn’t load fixtures: {fixturesErr}
        </div>
      )}

      {!fixturesErr && fixtures.length === 0 && (
        <div className="card card__pad empty" style={{ marginTop: 16 }}>
          No fixtures yet — fixtures are created automatically once the odds pipeline runs.
        </div>
      )}

      {err && (
        <div className="card card__pad empty" style={{ marginTop: 16 }}>
          {err}
        </div>
      )}

      {text && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card__pad">
            <textarea
              readOnly
              className="textarea mono"
              value={text}
              style={{ width: '100%', minHeight: 520, whiteSpace: 'pre' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
