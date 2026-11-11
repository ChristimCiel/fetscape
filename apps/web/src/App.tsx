import { lazy, Suspense, useEffect, useState } from 'react';
import type { Analysis, Dataset, Decision, Encounter } from '@orbit/core';
import { evaluateTarget } from '@orbit/core/removal';
import { api, number, utc } from './api';
import { PUBLIC_DEMO, downloadUrl } from './deployment';
import { Icon } from './components/Icon';
import { OrbitView, RangeChart, RelativeView } from './components/OrbitView';
import { ReviewPanel } from './components/ReviewPanel';

const CaptureLab = lazy(() => import('./capture/CaptureLab'));
type Page = 'operations' | 'removal' | 'capture' | 'datasets' | 'history' | 'methodology';
type History = {
  id: string;
  createdAt: string;
  datasetName: string;
  kind: string;
  eventCount: number;
  status: string;
}[];
const NAV: [Page, string, string][] = [
  ['operations', 'Satellite operations', 'orbit'],
  ['removal', 'Debris removal lab', 'target'],
  ['capture', 'Capture rehearsal', 'camera'],
  ['datasets', 'Data sources', 'layers'],
  ['history', 'Analysis history', 'clock'],
  ['methodology', 'Scientific basis', 'book'],
];
const classification = (d: Dataset) =>
  d.kind === 'synthetic'
    ? 'SYNTHETIC · FICTIONAL OBJECTS'
    : d.kind === 'public_elements'
      ? 'FROZEN PUBLIC ELEMENTS'
      : 'USER IMPORT · UNVERIFIED SOURCE';
function Metric({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <p>{sub}</p>
    </div>
  );
}
function Countdown({ event, time }: { event: Encounter; time: number }) {
  const delta = (Date.parse(event.tcaUtc) - time) / 1000,
    abs = Math.abs(delta);
  return (
    <>
      <span className="eyebrow">
        {delta >= 0 ? 'SIMULATED TIME TO TCA' : 'SIMULATED TIME SINCE TCA'}
      </span>
      <strong className="countdown">
        {String(Math.floor(abs / 3600)).padStart(2, '0')}
        <em>h</em> {String(Math.floor((abs % 3600) / 60)).padStart(2, '0')}
        <em>m</em> {String(Math.floor(abs % 60)).padStart(2, '0')}
        <em>s</em>
      </strong>
    </>
  );
}
export default function App() {
  const [page, setPage] = useState<Page>(
      () =>
        NAV.find((n) => `#/${n[0]}` === location.hash)?.[0] ??
        (PUBLIC_DEMO ? 'capture' : 'operations'),
    ),
    [datasets, setDatasets] = useState<Dataset[]>([]),
    [run, setRun] = useState<Analysis | null>(null),
    [eventId, setEventId] = useState(''),
    [targetId, setTargetId] = useState('');
  const [datasetId, setDatasetId] = useState('public-replay'),
    [primaryId, setPrimaryId] = useState('norad-25544'),
    [start, setStart] = useState('2026-11-11T12:00'),
    [hours, setHours] = useState(24),
    [threshold, setThreshold] = useState(100);
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(60),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [decisions, setDecisions] = useState<Decision[]>([]),
    [history, setHistory] = useState<History>([]);
  const [importName, setImportName] = useState('My orbital snapshot'),
    [importSource, setImportSource] = useState(''),
    [importFormat, setImportFormat] = useState('omm'),
    [importText, setImportText] = useState('');
  useEffect(() => {
    window.history.replaceState(null, '', `#/${page}`);
    setPlaying(false);
  }, [page]);
  useEffect(() => {
    const changed = () => {
      const next = NAV.find((n) => `#/${n[0]}` === location.hash)?.[0];
      if (next) setPage(next);
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const formDataset = datasets.find((d) => d.id === datasetId);
  async function openScriptOrbit() {
    setPage('operations');
    setBusy(true);
    setError('');
    try {
      const r = await api<Analysis>('/api/analyses', {
        datasetId: 'public-replay',
        primaryId: 'norad-25544',
        startUtc: '2026-11-11T12:00:00.000Z',
        hours: 24,
        cadenceSeconds: 30,
        thresholdKm: 100,
      });
      applyRun(r);
      const e = r.events.find((e) => e.secondaryId === 'norad-66906');
      if (e) {
        setEventId(e.id);
        setTargetId(e.secondaryId);
        setTime(Date.parse(e.tcaUtc));
      }
      setHistory(await api('/api/analyses'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function applyRun(r: Analysis) {
    setRun(r);
    setDatasetId(r.dataset.id);
    setPrimaryId(r.parameters.primaryId);
    setStart(r.parameters.startUtc.slice(0, 16));
    setHours(r.parameters.hours);
    setThreshold(r.parameters.thresholdKm);
    setEventId(r.events[0]?.id ?? '');
    setTargetId(
      r.events[0]?.secondaryId ??
        r.dataset.objects.find((o) => o.id !== r.parameters.primaryId)!.id,
    );
    setTime(Date.parse(r.parameters.startUtc));
    setPlaying(false);
    setDecisions([]);
  }
  async function calculate(dId = datasetId, pId = primaryId, s = start, h = hours, th = threshold) {
    setBusy(true);
    setError('');
    setNotice('');
    setPlaying(false);
    try {
      const r = await api<Analysis>('/api/analyses', {
        datasetId: dId,
        primaryId: pId,
        startUtc: new Date(s.endsWith('Z') ? s : s + 'Z').toISOString(),
        hours: h,
        cadenceSeconds: 30,
        thresholdKm: th,
      });
      applyRun(r);
      setHistory(await api('/api/analyses'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    (async () => {
      setBusy(true);
      try {
        const [ds, hs] = await Promise.all([
          api<Dataset[]>('/api/datasets'),
          api<History>('/api/analyses'),
        ]);
        if (!active) return;
        setDatasets(ds);
        setHistory(hs);
        if (hs.length) {
          const r = await api<Analysis>(`/api/analyses/${hs[0].id}`);
          if (active) applyRun(r);
        } else {
          const d = ds.find((d) => d.id === 'public-replay')!;
          const r = await api<Analysis>('/api/analyses', {
            datasetId: d.id,
            primaryId: d.objects[0].id,
            startUtc: d.referenceStart,
            hours: 24,
            cadenceSeconds: 30,
            thresholdKm: 100,
          });
          if (active) {
            applyRun(r);
            setHistory(await api('/api/analyses'));
          }
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!run) return;
    let active = true;
    api<Decision[]>(`/api/analyses/${run.id}/decisions`)
      .then((d) => {
        if (active) setDecisions(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [run?.id]);
  useEffect(() => {
    if (!playing || !run) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(),
        dt = (now - last) * speed;
      last = now;
      setTime((t) => {
        const end = Date.parse(run.endUtc);
        return Math.min(t + dt, end);
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, speed, run]);
  useEffect(() => {
    if (run && playing && time >= Date.parse(run.endUtc)) setPlaying(false);
  }, [time, playing, run]);
  const event = run?.events.find((e) => e.id === eventId) ?? run?.events[0];
  const visibleTargetId = page === 'operations' && event ? event.secondaryId : targetId;
  const target = run?.dataset.objects.find((o) => o.id === visibleTargetId);
  const primary = run?.dataset.objects.find((o) => o.id === run.parameters.primaryId);
  const targetEvaluation = primary && target ? evaluateTarget(primary, target) : null;
  const dirty =
    !!run &&
    (datasetId !== run.dataset.id ||
      primaryId !== run.parameters.primaryId ||
      start !== run.parameters.startUtc.slice(0, 16) ||
      hours !== run.parameters.hours ||
      threshold !== run.parameters.thresholdKm);
  const matched = run?.events.filter((e) => e.matchesGeometryThreshold) ?? [];
  function selectEvent(e: Encounter) {
    setEventId(e.id);
    setTargetId(e.secondaryId);
    setTime(Math.max(Date.parse(run!.parameters.startUtc), Date.parse(e.tcaUtc) - 10 * 60000));
    setPlaying(false);
  }
  async function loadHistory(id: string) {
    setBusy(true);
    setError('');
    try {
      applyRun(await api(`/api/analyses/${id}`));
      setPage('operations');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importData(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api<Dataset>('/api/datasets/import', {
        name: importName,
        source: importSource,
        format: importFormat,
        data: importText,
      });
      setDatasets(await api('/api/datasets'));
      setDatasetId(d.id);
      setPrimaryId(d.objects[0].id);
      setStart(d.referenceStart.slice(0, 16));
      setNotice(`Imported ${d.objects.length} objects. Select Run analysis to calculate.`);
      setPage('operations');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const targetReportUrl =
    run && target
      ? `/api/targets/report?datasetId=${encodeURIComponent(run.dataset.id)}&servicerId=${encodeURIComponent(run.parameters.primaryId)}&targetId=${encodeURIComponent(target.id)}`
      : '';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage('operations');
          }}
        >
          <span className="brand-symbol">
            <Icon name="orbit" size={25} />
          </span>
          <span>
            Fetscape<small>MISSION VERIFICATION</small>
          </span>
        </a>
        <div className="sidebar-section">WORKSPACES</div>
        <nav aria-label="Main navigation">
          {NAV.map(([id, label, icon]) => (
            <button
              key={id}
              className={`${page === id ? 'active' : ''} ${id === 'datasets' ? 'nav-break' : ''}`}
              onClick={() => setPage(id)}
            >
              <Icon name={icon} />
              {label}
              {id === 'removal' || id === 'capture' ? <span className="nav-tag">LAB</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-mark">
            <i />
            {PUBLIC_DEMO ? 'PUBLIC INTERACTIVE DEMO' : 'LOCAL RESEARCH BUILD'}
          </span>
          <p>
            Traceable inputs.
            <br />
            Deterministic calculations.
            <br />
            Human decisions.
          </p>
          <div className="profile">
            <span>TC</span>
            <div>
              Research workspace
              <small>
                {PUBLIC_DEMO ? 'Bundled orbital replays' : 'Single-user · local storage'}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            Workspace <span>/</span> <strong>{NAV.find((n) => n[0] === page)?.[1]}</strong>
          </div>
          <div className="topbar-right">
            <span className="connection">
              <i />
              {PUBLIC_DEMO ? 'Public demo' : 'Local API'}
            </span>
            <span className="build-label">v0.1 · Research preview</span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === 'capture'
                  ? 'FIRST-PERSON CAPTURE LAB'
                  : page === 'removal'
                    ? 'MISSION EXPLORATION'
                    : 'ORBITAL DECISION SUPPORT'}
              </span>
              <h1>
                {page === 'operations'
                  ? 'Understand the encounter.'
                  : page === 'capture'
                    ? 'Plan the approach. Test the escape.'
                    : page === 'removal'
                      ? 'Evaluate the next target.'
                      : page === 'datasets'
                        ? 'Know your inputs.'
                        : page === 'history'
                          ? 'Every analysis, traceable.'
                          : 'The science behind the screen.'}
              </h1>
              <p>
                {page === 'operations'
                  ? 'Explore relative geometry, examine the evidence, and record a considered next step.'
                  : page === 'capture'
                    ? 'Prototype software for collision-avoidance analysis and debris-removal mission planning. Review the approach, test the escape, and preserve the evidence.'
                    : page === 'removal'
                      ? 'Compare orbital geometry and identify what a removal assessment still needs.'
                      : page === 'datasets'
                        ? 'Frozen snapshots and validated imports. Provenance travels with every result.'
                        : page === 'history'
                          ? 'Reopen a saved run with its original inputs, parameters, and review records.'
                          : 'Capabilities, assumptions, and limits are part of the product.'}
              </p>
            </div>
            {run && (page === 'operations' || page === 'removal') ? (
              <div className="heading-actions">
                <a
                  className="button secondary"
                  href={downloadUrl(
                    page === 'removal' ? targetReportUrl : `/api/analyses/${run.id}/report`,
                  )}
                  download
                >
                  <Icon name="download" size={16} />
                  {page === 'removal' ? 'Target brief' : 'Export report'}
                </a>
                <a
                  className="icon-button"
                  aria-label="Export full analysis JSON"
                  title="Export full analysis JSON"
                  href={downloadUrl(`/api/analyses/${run.id}/export`)}
                  download
                >
                  <Icon name="layers" />
                </a>
              </div>
            ) : null}
          </div>
          {PUBLIC_DEMO ? (
            <div className="public-demo-notice" role="note">
              <strong>Public interactive demo</strong>
              <span>
                Explore capture controls, the fault comparison and bundled orbital replays. Imports,
                new orbital calculations and saved reviews are available in the local edition.
              </span>
              <a href="https://github.com/ChristimCiel/fetscape" target="_blank" rel="noreferrer">
                Run the full local edition ↗
              </a>
            </div>
          ) : null}
          {error ? (
            <div role="alert" className="message error">
              <Icon name="info" />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                ×
              </button>
            </div>
          ) : null}
          {notice ? (
            <div role="status" className="message success">
              {notice}
            </div>
          ) : null}
          {page === 'operations' || page === 'removal' ? (
            <>
              <form
                className="analysis-controls"
                onSubmit={(e) => {
                  e.preventDefault();
                  void calculate();
                }}
              >
                <label>
                  Data source
                  <select
                    aria-label="Data source"
                    value={datasetId}
                    disabled={busy}
                    onChange={(e) => {
                      const d = datasets.find((d) => d.id === e.target.value)!;
                      setDatasetId(d.id);
                      setPrimaryId(d.objects[0].id);
                      setStart(d.referenceStart.slice(0, 16));
                      setPlaying(false);
                    }}
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {page === 'removal' ? 'Reference orbit' : 'Primary object'}
                  <select
                    aria-label="Primary object"
                    value={primaryId}
                    disabled={busy || PUBLIC_DEMO}
                    onChange={(e) => setPrimaryId(e.target.value)}
                  >
                    {formDataset?.objects.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start (UTC)
                  <input
                    aria-label="Analysis start UTC"
                    type="datetime-local"
                    required
                    value={start}
                    disabled={busy || PUBLIC_DEMO}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <label>
                  Window
                  <select
                    aria-label="Analysis window"
                    value={hours}
                    disabled={busy || PUBLIC_DEMO}
                    onChange={(e) => setHours(Number(e.target.value))}
                  >
                    {[1, 6, 12, 24].map((h) => (
                      <option key={h} value={h}>
                        {h} hours
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Geometry filter
                  <select
                    aria-label="Geometry threshold"
                    value={threshold}
                    disabled={busy || PUBLIC_DEMO}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                  >
                    {[10, 100, 500, 2000].map((k) => (
                      <option key={k} value={k}>
                        ≤ {number(k, 0)} km
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button primary run-button" disabled={busy || !datasets.length}>
                  <Icon name={busy ? 'refresh' : 'arrow'} size={16} />
                  {busy
                    ? PUBLIC_DEMO
                      ? 'Loading…'
                      : 'Calculating…'
                    : PUBLIC_DEMO
                      ? 'Load bundled replay'
                      : 'Run analysis'}
                </button>
              </form>
              {dirty ? (
                <div className="pending" role="status">
                  Parameters changed. Results below still belong to the last saved run. Run analysis
                  to apply changes.
                </div>
              ) : null}
              {run ? (
                <>
                  <div
                    className={`data-ribbon ${run.dataset.kind === 'synthetic' ? 'synthetic' : ''}`}
                  >
                    <span>
                      <i />
                      {classification(run.dataset)}
                    </span>
                    <span>
                      {run.dataset.objects.length} objects · {run.coverage.pairsScreened}{' '}
                      independent pairs ·{' '}
                      {run.coverage.status === 'partial' ? 'PARTIAL COVERAGE' : 'sampled coverage'}
                    </span>
                    <span>SGP4 / TEME / UTC</span>
                  </div>
                  {page === 'operations' ? (
                    <>
                      <section className="metrics" aria-label="Selected encounter metrics">
                        <Metric
                          label="SELECTED OBJECT"
                          value={target?.name ?? '—'}
                          sub={
                            target?.catalogId
                              ? `Catalog ID ${target.catalogId}`
                              : 'Fictional simulation identity'
                          }
                        />
                        <Metric
                          label="PREDICTED MISS DISTANCE"
                          value={event ? number(event.missDistanceKm) : '—'}
                          unit="km"
                          sub="Geometric separation · no uncertainty bound"
                        />
                        <Metric
                          label="RELATIVE VELOCITY AT TCA"
                          value={event ? number(event.relativeVelocityKmS, 3) : '—'}
                          unit="km/s"
                          sub="Relative TEME state vectors"
                        />
                        <Metric
                          label="PROBABILITY OF COLLISION"
                          value="Unavailable"
                          sub="Requires covariance + hard-body model"
                        />
                      </section>
                      {event?.matchesGeometryThreshold &&
                      Date.parse(event.tcaUtc) >= time &&
                      Date.parse(event.tcaUtc) - time <= 600000 ? (
                        <div role="status" className="pending">
                          Geometry reminder: the selected filter match is within 10 simulated
                          minutes. This is an in-workspace reminder, not an operational alert or
                          external notification.
                        </div>
                      ) : null}
                      <div className="analysis-grid">
                        <section className="scene-panel">
                          <OrbitView run={run} targetId={visibleTargetId} time={time} />
                          <div className="playback">
                            <button
                              className="play-button"
                              aria-label={playing ? 'Pause simulation' : 'Play simulation'}
                              disabled={busy || dirty}
                              onClick={() => {
                                if (time >= Date.parse(run.endUtc))
                                  setTime(Date.parse(run.parameters.startUtc));
                                setPlaying(!playing);
                              }}
                            >
                              <Icon name={playing ? 'pause' : 'play'} size={17} />
                            </button>
                            <div className="timeline">
                              <div>
                                <strong>{utc(time)}</strong>
                                <span>SIMULATION CLOCK</span>
                              </div>
                              <input
                                aria-label="Simulation time"
                                type="range"
                                min={Date.parse(run.parameters.startUtc)}
                                max={Date.parse(run.endUtc)}
                                step="1000"
                                value={Math.min(time, Date.parse(run.endUtc))}
                                onChange={(e) => {
                                  setTime(Number(e.target.value));
                                  setPlaying(false);
                                }}
                              />
                            </div>
                            <select
                              aria-label="Playback speed"
                              value={speed}
                              onChange={(e) => setSpeed(Number(e.target.value))}
                            >
                              {[1, 10, 60, 300, 1800].map((s) => (
                                <option key={s} value={s}>
                                  {s}×
                                </option>
                              ))}
                            </select>
                            <button
                              className="icon-button dark"
                              aria-label="Reset simulation"
                              onClick={() => {
                                setTime(Date.parse(run.parameters.startUtc));
                                setPlaying(false);
                              }}
                            >
                              <Icon name="refresh" size={17} />
                            </button>
                          </div>
                        </section>
                        <aside className="event-panel panel">
                          <div className="panel-heading">
                            <h2>Encounter queue</h2>
                            <span className="count-badge">{matched.length}</span>
                          </div>
                          <p className="panel-description">
                            {matched.length} local minima match the saved{' '}
                            {number(run.parameters.thresholdKm, 0)} km geometry filter. No
                            collision-risk classification.
                          </p>
                          {event ? (
                            <div className="countdown-box">
                              <Countdown event={event} time={time} />
                              <button
                                onClick={() => {
                                  setTime(Date.parse(event.tcaUtc));
                                  setPlaying(false);
                                }}
                              >
                                Jump to TCA <Icon name="arrow" size={14} />
                              </button>
                            </div>
                          ) : null}
                          <div className="event-list">
                            {run.events.slice(0, 16).map((e) => {
                              const o = run.dataset.objects.find((o) => o.id === e.secondaryId);
                              return (
                                <button
                                  key={e.id}
                                  className={event?.id === e.id ? 'selected' : ''}
                                  onClick={() => selectEvent(e)}
                                >
                                  <div>
                                    <strong>{o?.name}</strong>
                                    <span
                                      className={
                                        e.matchesGeometryThreshold ? 'event-tag' : 'event-tag muted'
                                      }
                                    >
                                      {e.matchesGeometryThreshold
                                        ? 'FILTER MATCH'
                                        : 'OUTSIDE FILTER'}
                                    </span>
                                  </div>
                                  <p>{utc(e.tcaUtc)}</p>
                                  <div>
                                    <span>
                                      Miss <b>{number(e.missDistanceKm)} km</b>
                                    </span>
                                    <span>{number(e.relativeVelocityKmS, 2)} km/s</span>
                                  </div>
                                </button>
                              );
                            })}
                            {!run.events.length ? (
                              <p className="empty">
                                No interior local minima found. This does not establish a safe
                                orbit.
                              </p>
                            ) : null}
                          </div>
                          <p className="fine-print">
                            Nearest 16 shown, sorted by miss distance. Full events remain in the
                            export.
                          </p>
                        </aside>
                      </div>
                      <div className="lower-grid">
                        <section className="panel">
                          <div className="panel-heading">
                            <div>
                              <span className="eyebrow">ENCOUNTER GEOMETRY</span>
                              <h2>Range around closest approach</h2>
                            </div>
                            <span className="plain-badge">TEME</span>
                          </div>
                          {event ? (
                            <RangeChart
                              run={run}
                              targetId={event.secondaryId}
                              eventTime={Date.parse(event.tcaUtc)}
                              miss={event.missDistanceKm}
                            />
                          ) : (
                            <p className="empty">Choose a run with an interior encounter.</p>
                          )}
                          <p className="fine-print">
                            Sampled display curve with the refined TCA inserted. Numerical precision
                            does not indicate tracking accuracy.
                          </p>
                          <div className="evidence-row">
                            <div>
                              <span>Primary epoch offset at TCA</span>
                              <strong>
                                {event ? `${number(event.primaryEpochOffsetHours)} h` : '—'}
                              </strong>
                            </div>
                            <div>
                              <span>Secondary epoch offset at TCA</span>
                              <strong>
                                {event ? `${number(event.secondaryEpochOffsetHours)} h` : '—'}
                              </strong>
                            </div>
                          </div>
                        </section>
                        {event ? (
                          <ReviewPanel
                            key={`${run.id}-${event.id}`}
                            run={run}
                            event={event}
                            decisions={decisions}
                            onSaved={(d) => {
                              setDecisions((ds) => [d, ...ds]);
                              setNotice('Review saved to the local analysis record.');
                            }}
                            onError={setError}
                          />
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="lab-notice">
                        <Icon name="info" />
                        <div>
                          <strong>Preliminary orbital comparison</strong>
                          <p>
                            Reference orbit is a calculation input, not a validated servicing
                            spacecraft. Target mass, size, tumble and capture readiness remain
                            unknown.
                          </p>
                        </div>
                      </div>
                      <div className="capture-entry">
                        <div>
                          <span className="eyebrow">NEAR-FIELD CONCEPT REHEARSAL</span>
                          <h2>Step into the servicer’s forward camera.</h2>
                          <p>
                            Use your Meshy models to rehearse approach, caging and abort.
                            Independent synthetic state; no observed target shape or capture
                            dynamics.
                          </p>
                        </div>
                        <button className="button primary" onClick={() => setPage('capture')}>
                          <Icon name="camera" size={17} />
                          Open first-person rehearsal
                        </button>
                      </div>
                      <div className="removal-grid">
                        <section className="panel targets-panel">
                          <div className="panel-heading">
                            <h2>Candidate objects</h2>
                            <span className="plain-badge">NO READINESS SCORE</span>
                          </div>
                          <div className="target-table">
                            <table>
                              <thead>
                                <tr>
                                  <th>Object</th>
                                  <th>Plane angle</th>
                                  <th>Approx. mean altitude</th>
                                  <th>Mass</th>
                                </tr>
                              </thead>
                              <tbody>
                                {run.dataset.objects
                                  .filter((o) => o.id !== run.parameters.primaryId)
                                  .map((o) => {
                                    const e = evaluateTarget(primary!, o);
                                    return (
                                      <tr
                                        key={o.id}
                                        className={targetId === o.id ? 'selected' : ''}
                                      >
                                        <td>
                                          <button onClick={() => setTargetId(o.id)}>
                                            <strong>{o.name}</strong>
                                            <small>
                                              {o.catalogId ? `NORAD ${o.catalogId}` : 'FICTIONAL'}
                                            </small>
                                          </button>
                                        </td>
                                        <td>{number(e.planeAngleDeg, 2)}°</td>
                                        <td>{number(e.meanAltitudeProxyKm, 0)} km</td>
                                        <td>
                                          <span className="unknown">Unknown</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </section>
                        <section className="panel">
                          <div className="panel-heading">
                            <div>
                              <span className="eyebrow">SELECTED TARGET</span>
                              <h2>{target?.name}</h2>
                            </div>
                            <Icon name="target" />
                          </div>
                          {targetEvaluation ? (
                            <>
                              <div className="target-metrics">
                                <div>
                                  <span>Circular altitude-transfer proxy</span>
                                  <strong>
                                    {targetEvaluation.circularHohmannDeltaVKmS === null
                                      ? 'Unsupported'
                                      : `${number(targetEvaluation.circularHohmannDeltaVKmS * 1000, 0)} m/s`}
                                  </strong>
                                </div>
                                <div>
                                  <span>Separate plane-change proxy</span>
                                  <strong>
                                    {targetEvaluation.standalonePlaneChangeDeltaVKmS === null
                                      ? 'Unsupported'
                                      : `${number(targetEvaluation.standalonePlaneChangeDeltaVKmS * 1000, 0)} m/s`}
                                  </strong>
                                </div>
                              </div>
                              <p className="fine-print">
                                {targetEvaluation.caveat}
                                {targetEvaluation.model === 'unsupported_eccentricity'
                                  ? ' Eccentricity exceeds the selected 0.02 approximation limit.'
                                  : ''}
                              </p>
                              <h3>Required before removal feasibility</h3>
                              <ul className="requirements">
                                {targetEvaluation.missing.map((m) => (
                                  <li key={m}>
                                    <span>?</span>
                                    {m}
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                        </section>
                      </div>
                      <div className="lower-grid">
                        <section className="panel">
                          <div className="panel-heading">
                            <div>
                              <span className="eyebrow">RELATIVE GEOMETRY</span>
                              <h2>Reference-centered motion</h2>
                            </div>
                            <span className="plain-badge">RIC PROJECTION</span>
                          </div>
                          <RelativeView run={run} targetId={targetId} />
                          <p className="fine-print">
                            First 90 minutes of propagated geometry. Projection hides cross-track
                            separation; not sensed relative navigation, controlled rendezvous,
                            capture or contact simulation.
                          </p>
                        </section>
                        <section className="panel next-step">
                          <span className="eyebrow">EVIDENCE ROADMAP</span>
                          <h2>Turn unknowns into testable inputs.</h2>
                          <p>
                            Begin with mission constraints and authoritative target data. Add
                            independently validated transfer and navigation models one capability at
                            a time.
                          </p>
                          <ol>
                            <li>Agree target and servicer data with a design partner.</li>
                            <li>Validate transfer geometry and phasing independently.</li>
                            <li>Connect relative sensors and fault scenarios.</li>
                            <li>Evaluate capture dynamics in a dedicated model.</li>
                          </ol>
                          <button className="text-button" onClick={() => setPage('methodology')}>
                            View scientific boundaries <Icon name="arrow" size={15} />
                          </button>
                        </section>
                      </div>
                    </>
                  )}
                  <div className="source-footer">
                    <Icon name="layers" size={15} />
                    <span>
                      {run.dataset.source} · acquired {utc(run.dataset.acquiredAt)}
                      <br />
                      <code>SHA-256 {run.dataset.contentSha256.slice(0, 20)}…</code>
                    </span>
                    <button onClick={() => setPage('datasets')}>
                      Inspect inputs <Icon name="arrow" size={13} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="loading-state">
                  {busy
                    ? 'Preparing the orbital workspace…'
                    : 'No analysis loaded. Select a source and run analysis.'}
                </div>
              )}
            </>
          ) : null}
          {page === 'capture' ? (
            <Suspense
              fallback={
                <div className="loading-state">Loading the first-person capture workspace…</div>
              }
            >
              <CaptureLab
                onOpenOrbit={() => void openScriptOrbit()}
                context={
                  run && primary && target
                    ? {
                        analysisId: run.id,
                        kind: run.dataset.kind,
                        referenceName: primary.name,
                        targetName: target.name,
                      }
                    : undefined
                }
              />
            </Suspense>
          ) : null}
          {page === 'datasets' ? (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Available snapshots</h2>
                  <span className="plain-badge">
                    {PUBLIC_DEMO ? 'BUNDLED REFERENCE DATA' : 'OFFLINE AFTER INSTALL'}
                  </span>
                </div>
                <div className="dataset-grid">
                  {datasets.map((d) => (
                    <article key={d.id} className="dataset-card">
                      <span className={`data-kind ${d.kind === 'synthetic' ? 'fictional' : ''}`}>
                        {classification(d)}
                      </span>
                      <h3>{d.name}</h3>
                      <p>{d.source}</p>
                      <dl>
                        <div>
                          <dt>Objects</dt>
                          <dd>{d.objects.length}</dd>
                        </div>
                        <div>
                          <dt>Acquired / generated</dt>
                          <dd>{utc(d.acquiredAt)}</dd>
                        </div>
                        <div>
                          <dt>Covariance</dt>
                          <dd>Not supplied</dd>
                        </div>
                        <div>
                          <dt>Physical properties</dt>
                          <dd>Unknown</dd>
                        </div>
                      </dl>
                      <code title={d.contentSha256}>{d.contentSha256}</code>
                      <button
                        className="text-button"
                        onClick={() => {
                          setDatasetId(d.id);
                          setPrimaryId(d.objects[0].id);
                          setStart(d.referenceStart.slice(0, 16));
                          setPage('operations');
                        }}
                      >
                        Use this snapshot <Icon name="arrow" size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              <section className="panel import-panel">
                <span className="eyebrow">BRING YOUR OWN ELEMENTS</span>
                <h2>Import an orbital snapshot</h2>
                <p>
                  2–24 unique objects. Supported subset: Earth / TEME / UTC / SGP4 GP JSON, or
                  checksum-valid TLE. This importer does not accept CDMs, observation streams,
                  covariance, or credentials.
                </p>
                {PUBLIC_DEMO ? (
                  <p className="public-demo-notice">
                    Import is available in the local edition. The public demo uses the bundled
                    snapshots above.
                  </p>
                ) : null}
                <form onSubmit={importData}>
                  <div className="review-fields">
                    <label>
                      Snapshot name
                      <input
                        required
                        maxLength={100}
                        disabled={PUBLIC_DEMO}
                        value={importName}
                        onChange={(e) => setImportName(e.target.value)}
                      />
                    </label>
                    <label>
                      Source / provenance
                      <input
                        required
                        maxLength={250}
                        disabled={PUBLIC_DEMO}
                        placeholder="Provider, file date, and permission context"
                        value={importSource}
                        onChange={(e) => setImportSource(e.target.value)}
                      />
                    </label>
                    <label>
                      Format
                      <select
                        value={importFormat}
                        disabled={PUBLIC_DEMO}
                        onChange={(e) => setImportFormat(e.target.value)}
                      >
                        <option value="omm">GP / OMM-compatible JSON</option>
                        <option value="tle">Two / three-line TLE</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Element data
                    <textarea
                      required
                      rows={7}
                      value={importText}
                      disabled={PUBLIC_DEMO}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Paste a GP JSON array or TLE records…"
                    />
                  </label>
                  <button
                    className="button primary"
                    disabled={PUBLIC_DEMO || busy || !importText.trim() || !importSource.trim()}
                  >
                    Validate and import <Icon name="arrow" size={15} />
                  </button>
                </form>
              </section>
            </>
          ) : null}
          {page === 'history' ? (
            <section className="panel">
              <div className="panel-heading">
                <h2>{PUBLIC_DEMO ? 'Bundled analyses' : 'Saved analyses'}</h2>
                <span className="plain-badge">{PUBLIC_DEMO ? 'READ-ONLY' : 'LOCAL SQLITE'}</span>
              </div>
              <div className="history-list">
                {history.length ? (
                  history.map((h) => (
                    <button key={h.id} disabled={busy} onClick={() => void loadHistory(h.id)}>
                      <div>
                        <strong>{h.datasetName}</strong>
                        <span>{utc(h.createdAt)}</span>
                        <code>{h.id}</code>
                      </div>
                      <div>
                        <span>
                          {h.eventCount} minima · {h.status}
                        </span>
                        <Icon name="arrow" />
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="empty">Run an analysis to create the first record.</p>
                )}
              </div>
              <p className="fine-print">
                {PUBLIC_DEMO
                  ? 'These reference runs are generated by the local API during the public build. No visitor data is saved to a server.'
                  : 'Latest 50 runs. Saved calculations are immutable through this API; this is local research storage, not a tamper-proof or authenticated audit system.'}
              </p>
            </section>
          ) : null}
          {page === 'methodology' ? (
            <>
              <div className="methodology-grid">
                <section className="panel">
                  <span className="eyebrow">DETERMINISTIC CORE</span>
                  <h2>What this version computes</h2>
                  <ul className="method-list">
                    <li>SGP4 propagation from supported GP JSON and TLE inputs.</li>
                    <li>Relative position, speed and range-rate in TEME.</li>
                    <li>
                      Interior local minima from negative-to-positive range-rate crossings; each
                      bracket is refined without a distance prefilter.
                    </li>
                    <li>
                      Separate, educational circular transfer and plane-change proxies, with a
                      near-circular applicability gate.
                    </li>
                    <li>
                      Reports and review records tied to frozen input data and calculation
                      parameters.
                    </li>
                  </ul>
                </section>
                <section className="panel">
                  <span className="eyebrow">DATA GATES</span>
                  <h2>What remains unavailable</h2>
                  <ul className="method-list">
                    <li>
                      Probability of Collision: needs defensible covariance, hard-body geometry, and
                      a validated calculation method.
                    </li>
                    <li>
                      Maneuver planning: needs operator ephemerides, spacecraft constraints, timing
                      and post-maneuver screening.
                    </li>
                    <li>
                      Mass, dimensions and tumble: require separate observations or authoritative
                      physical metadata.
                    </li>
                    <li>
                      Image-based sensing, controlled rendezvous, physical capture dynamics,
                      disposal and fleet optimization: not implemented. The first-person capture lab
                      is a separate synthetic kinematic rehearsal.
                    </li>
                    <li>
                      Live notifications, authenticated users, enterprise integration and an
                      operational SLA: not implemented.
                    </li>
                  </ul>
                </section>
              </div>
              <section className="panel">
                <h2>Read every result in context</h2>
                <div className="method-notes">
                  <article>
                    <h3>Frames & time</h3>
                    <p>
                      Analysis and globe use TEME, not a fixed Earth map. The RIC view is a
                      reference-centered projection. JavaScript dates use UTC at millisecond
                      resolution; leap seconds are not supported. Display interpolation does not
                      recompute SGP4.
                    </p>
                  </article>
                  <article>
                    <h3>Uncertainty & coverage</h3>
                    <p>
                      GP elements do not carry covariance in these snapshots. Epoch offsets describe
                      data age, not accuracy. A 30-second sample interval can miss multiple extrema
                      within one step. Failed propagation creates partial coverage; gaps are not
                      interpolated.
                    </p>
                  </article>
                  <article>
                    <h3>AI boundary</h3>
                    <p>
                      No AI service runs here. Future assistants may explain verified outputs or
                      prepare drafts with citations. Numerical calculations and spacecraft decisions
                      remain outside language-model generation.
                    </p>
                  </article>
                  <article>
                    <h3>Provenance & validation</h3>
                    <p>
                      Each saved run carries its full input snapshot and SHA-256. Tests cover
                      analytic encounters, failure gaps, frame transforms and independent SGP4
                      reference states. Agreement between implementations does not prove orbit
                      truth.
                    </p>
                  </article>
                </div>
                <div className="source-links">
                  <a
                    href="https://celestrak.org/NORAD/documentation/gp-data-formats.php"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CelesTrak GP formats ↗
                  </a>
                  <a
                    href="https://www.nasa.gov/conjunction-assessment/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    NASA CARA ↗
                  </a>
                  <a
                    href="https://celestrak.org/publications/AIAA/2006-6753/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Vallado SGP4 reference ↗
                  </a>
                </div>
              </section>
            </>
          ) : null}
          <footer className="app-footer">
            <span>Fetscape · Plan the approach. Test the escape.</span>
            <span>
              {PUBLIC_DEMO ? 'Public research demo' : 'Local research software'} · Human review
              required
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
