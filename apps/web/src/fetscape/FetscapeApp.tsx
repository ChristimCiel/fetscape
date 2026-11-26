/**
 * Fetscape v2 — Orbit Instrument body (ready + debris panes).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Language, MissionProfile, AgentTrace, ApprovalRequest } from './types';
import { AgentOrchestrator } from './agent/orchestrator';
import { t } from './i18n/translations';
import { DEMO_MISSIONS, DEMO_TRACE, buildWalkthroughSteps } from './demo-data';
import { computeReadiness, type ReadinessResult } from './readiness';
import {
  formatDebrisRankingReport,
  getBundledDerelictCatalog,
  rankDerelictTargets,
  type RankedDerelict,
} from './tools/debris-ranking';
import {
  getReplayCloseApproachSnapshot,
  type CloseApproachSnapshot,
} from './tools/close-approach-replay';
import { runLiveOrReplayScreen } from './tools/live-screen';
import { REGULATIONS_DB } from './tools/regulations';
import { formatLifetimeYears, mapVerdict } from './tools/ruleAltitudes';
import { tSuite } from '../suite/i18n';
import OrbitShellPlot from './OrbitShellPlot';
import './instrument.css';

export type ProductTab = 'mission' | 'debris';

interface FetscapeAppProps {
  mode?: 'full' | 'judge';
  apiKey?: string;
  language: Language;
  productTab: ProductTab;
  onProductTabChange?: (tab: ProductTab) => void;
  judgeMode?: boolean;
  onJudgeModeChange?: (on: boolean) => void;
}

const PRESET_KEYS = ['v2.preset.0', 'v2.preset.1', 'v2.preset.2'] as const;

export default function FetscapeApp({
  mode = 'judge',
  apiKey,
  language,
  productTab,
  onProductTabChange,
  judgeMode = false,
  onJudgeModeChange,
}: FetscapeAppProps) {
  const [judgeStep, setJudgeStep] = useState(0);
  const [coachHidden, setCoachHidden] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [missionIndex, setMissionIndex] = useState(0);
  const [altitude, setAltitude] = useState(DEMO_MISSIONS[0].orbit.altitude ?? 510);
  const [profile, setProfile] = useState<MissionProfile>(DEMO_MISSIONS[0]);
  const [readiness, setReadiness] = useState<ReadinessResult>(() =>
    computeReadiness(DEMO_MISSIONS[0]),
  );
  const [trace, setTrace] = useState<AgentTrace | null>(mode === 'judge' ? DEMO_TRACE : null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalKind, setApprovalKind] = useState<'evidence' | 'ranking' | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [showAllDebris, setShowAllDebris] = useState(false);
  const [liveOptIn, setLiveOptIn] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [nearOpen, setNearOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [highlightPreset, setHighlightPreset] = useState(false);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const livePanelRef = useRef<HTMLDetailsElement>(null);
  const [screenResult, setScreenResult] = useState<{
    mode: 'live' | 'replay';
    snapshot: CloseApproachSnapshot;
    reason?: string;
  }>({ mode: 'replay', snapshot: getReplayCloseApproachSnapshot() });

  const derelict = useMemo(() => getBundledDerelictCatalog(), []);
  const ranked = useMemo(
    () =>
      rankDerelictTargets(derelict.objects, {
        dataSource: derelict.meta.source,
        contentSha256: derelict.meta.contentSha256,
      }),
    [derelict],
  );
  const visibleRanked = showAllDebris ? ranked : ranked.slice(0, 5);
  const selected: RankedDerelict | undefined =
    ranked.find((r) => r.id === selectedTargetId) ?? ranked[0];
  const debrisReport = useMemo(
    () => formatDebrisRankingReport(ranked, language),
    [ranked, language],
  );
  const walkthrough = useMemo(() => buildWalkthroughSteps(readiness), [readiness]);
  const currentWalkthroughStep = walkthrough[judgeStep];
  const verdict = mapVerdict(readiness.complies5Year, readiness.complies25Year);
  const lifeLabel = formatLifetimeYears(readiness.lifetimeYears);
  const instrumentMode = productTab === 'debris' ? 'adr' : 'ready';

  useEffect(() => {
    if (judgeMode) setCoachHidden(false);
  }, [judgeMode]);

  useEffect(() => {
    if (!selectedTargetId && ranked[0]) setSelectedTargetId(ranked[0].id);
  }, [ranked, selectedTargetId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && approvalKind) {
        setApprovalKind(null);
        setPendingApprovals((prev) =>
          prev.map((a) => (a.status === 'pending' ? { ...a, status: 'rejected' } : a)),
        );
        ctaRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [approvalKind]);

  function applyAltitude(nextAlt: number, base: MissionProfile = profile) {
    const next: MissionProfile = {
      ...base,
      orbit: { ...base.orbit, altitude: nextAlt },
    };
    setAltitude(nextAlt);
    setProfile(next);
    setReadiness(computeReadiness(next));
  }

  async function runReadiness(nextProfile: MissionProfile = profile) {
    setAnalyzing(true);
    setProgressLabel(language === 'en' ? 'Verifying…' : '驗證中…');
    try {
      const next = computeReadiness(nextProfile);
      setReadiness(next);
      setProfile(nextProfile);
      const orchestrator = new AgentOrchestrator({
        language,
        provider: apiKey ? 'anthropic' : 'deterministic',
        apiKey,
        maxTokens: 10000,
      });
      const result = await orchestrator.analyzeMissionReadiness(nextProfile);
      setTrace(result);
      if (result.verificationStatus === 'verified') {
        setPendingApprovals([
          {
            id: `approval-${Date.now()}`,
            type: 'export',
            title: t('approval.exportReport', language),
            description: t('approval.description', language),
            payload: { ...result, readiness: next },
            status: 'pending',
          },
        ]);
        setApprovalKind('evidence');
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(false);
      setProgressLabel('');
    }
  }

  async function handleLiveScreen() {
    setLiveBusy(true);
    try {
      const result = await runLiveOrReplayScreen({ hours: 6, thresholdKm: 100 });
      setScreenResult(result);
    } finally {
      setLiveBusy(false);
    }
  }

  async function handleJudgeNext() {
    if (judgeStep >= walkthrough.length - 1) {
      onProductTabChange?.('mission');
      setNearOpen(false);
      return;
    }
    const next = judgeStep + 1;
    setJudgeStep(next);
    setHighlightPreset(next === 1);
    if (judgeStep === 1) await runReadiness(profile);
    if (next === 3) onProductTabChange?.('debris');
    if (next === 4) {
      onProductTabChange?.('mission');
      setNearOpen(true);
      requestAnimationFrame(() => {
        if (livePanelRef.current) livePanelRef.current.open = true;
      });
    }
    if (next === walkthrough.length - 1) onProductTabChange?.('mission');
  }

  function selectPreset(index: number) {
    const mission = DEMO_MISSIONS[index];
    setMissionIndex(index);
    setProfile(mission);
    const alt = mission.orbit.altitude ?? 500;
    setAltitude(alt);
    setReadiness(computeReadiness(mission));
  }

  function requestExport(kind: 'evidence' | 'ranking') {
    if (kind === 'evidence') {
      void runReadiness(profile);
      return;
    }
    setApprovalKind(kind);
    setPendingApprovals([
      {
        id: `approval-${Date.now()}`,
        type: 'export',
        title: tSuite('v2.adr.cta', language),
        description: t('approval.description', language),
        payload: { ranking: ranked, report: debrisReport },
        status: 'pending',
      },
    ]);
  }

  function handleApproval(id: string, approved: boolean) {
    setPendingApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: approved ? 'approved' : 'rejected' } : a)),
    );
    if (!approved) {
      setApprovalKind(null);
      ctaRef.current?.focus();
      return;
    }
    const approval = pendingApprovals.find((a) => a.id === id);
    if (!approval) return;
    const blob = new Blob([JSON.stringify(approval.payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fetscape-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setApprovalKind(null);
    setToast(tSuite('v2.toast.saved', language));
    window.setTimeout(() => setToast(''), 2800);
  }

  const evidenceText =
    trace?.finalResponse ??
    `GEOMETRIC SCREENING ONLY. Not probability of collision (Pc).\nDeorbit screening: ${readiness.lifetimeYears} yr · derelicts in sample (±25 km): ${readiness.shellObjects}.\nDecision support for a qualified operator.`;

  const citations = [
    ...(REGULATIONS_DB.taiwan ?? []).slice(0, 2),
    ...(REGULATIONS_DB.fcc ?? []).slice(0, 2),
  ];

  const missionSentence = tSuite('v2.mission', language)
    .replace('{mass}', String(profile.mass ?? '—'))
    .replace('{inc}', String(profile.orbit.inclination));

  return (
    <>
      <div className="fx-wrap" style={{ flex: 1 }}>
        <section className="fx-inst">
          <h1 className="fx-q">
            {instrumentMode === 'ready' ? tSuite('v2.h1', language) : tSuite('v2.h1.adr', language)}
          </h1>
          <p className="fx-qs">
            {instrumentMode === 'ready'
              ? tSuite('v2.h1.sub', language)
              : tSuite('v2.h1.adr.sub', language)}
          </p>

          {instrumentMode === 'ready' ? (
            <div className="fx-mission">
              <div
                className="fx-presets"
                style={
                  highlightPreset
                    ? { boxShadow: '0 0 0 2px var(--fx-cyan)', borderRadius: 12, padding: 4 }
                    : undefined
                }
              >
                {DEMO_MISSIONS.map((m, i) => (
                  <button
                    key={m.name}
                    type="button"
                    className="fx-preset"
                    aria-pressed={missionIndex === i}
                    onClick={() => selectPreset(i)}
                  >
                    {tSuite(PRESET_KEYS[i], language)}
                  </button>
                ))}
                <span className="fx-sentence">
                  {missionSentence.split(' · ').map((part, i, arr) => (
                    <span key={part}>
                      {i === 0 || i === 1 ? <b>{part}</b> : part}
                      {i < arr.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          ) : null}

          <OrbitShellPlot
            mode={instrumentMode}
            profile={profile}
            altitude={altitude}
            onAltitude={(n) => applyAltitude(n)}
            ranked={ranked}
            selectedId={selected?.id ?? ''}
            onSelect={setSelectedTargetId}
            language={language}
            yearsText={lifeLabel}
            highlightMarker={highlightPreset}
          />
        </section>

        <section className="fx-read" data-testid="analysis-results" aria-live="polite">
          {instrumentMode === 'ready' ? (
            <>
              <div className="fx-mctx">
                {tSuite(PRESET_KEYS[missionIndex], language)} ·{' '}
                <span className="mono">{altitude} km</span> ·{' '}
                <a href="#plot-anchor">{tSuite('v2.mctx.change', language)}</a>
              </div>

              <div>
                <div
                  className="fx-lbl"
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
                >
                  <span>{tSuite('v2.read.label', language)}</span>
                  <span
                    data-testid="verification-status"
                    style={{ color: 'var(--fx-pass)', textTransform: 'none', letterSpacing: 0 }}
                  >
                    {trace?.verificationStatus === 'verified' || approvalKind === 'evidence'
                      ? tSuite('v2.read.verified', language)
                      : tSuite('v2.read.verified', language)}
                  </span>
                </div>
                {analyzing ? (
                  <span data-testid="analysis-progress" className="fx-range">
                    {progressLabel || tSuite('v2.verifying', language)}
                  </span>
                ) : null}
                <div className="fx-life mono">
                  {lifeLabel}
                  <small>{tSuite('v2.read.unit', language)}</small>
                </div>
                <div className="fx-range mono">
                  {tSuite('v2.read.range', language)
                    .replace('{a}', String(readiness.lifetimeRange[0]))
                    .replace('{b}', formatLifetimeYears(readiness.lifetimeRange[1]))}
                  {readiness.lifetimeYears >= 1000 ? ` ${tSuite('v2.read.cap', language)}` : ''}
                </div>
              </div>

              <div className={`fx-verdict fx-verdict--${verdict}`} role="status">
                <i aria-hidden />
                {tSuite(`v2.verdict.${verdict}`, language)}
              </div>

              <div className="fx-rules">
                <div className="fx-rule">
                  <div>
                    <div className="n">{tSuite('v2.rule.nstc', language)}</div>
                    <div className="s">{tSuite('v2.rule.nstc.sub', language)}</div>
                  </div>
                  <div
                    className={`fx-st ${readiness.complies25Year ? 'fx-st--pass' : 'fx-st--miss'}`}
                  >
                    <i aria-hidden />
                    {readiness.complies25Year
                      ? tSuite('v2.rule.meets', language)
                      : tSuite('v2.rule.misses', language)}
                  </div>
                </div>
                <div className="fx-rule">
                  <div>
                    <div className="n">{tSuite('v2.rule.fcc', language)}</div>
                    <div className="s">{tSuite('v2.rule.fcc.sub', language)}</div>
                  </div>
                  <div
                    className={`fx-st ${readiness.complies5Year ? 'fx-st--pass' : 'fx-st--miss'}`}
                  >
                    <i aria-hidden />
                    {readiness.complies5Year
                      ? tSuite('v2.rule.meets', language)
                      : tSuite('v2.rule.misses', language)}
                  </div>
                </div>
              </div>

              <div className="fx-sample">
                <span>{tSuite('v2.sample', language).replace('{alt}', String(altitude))}</span>
                <span className="mono">{readiness.shellObjects}</span>
              </div>

              {approvalKind === 'evidence' ? (
                <section
                  className="fx-approval"
                  data-testid="approval-card"
                  role="region"
                  aria-labelledby="ap-title"
                >
                  <h2 id="ap-title">{tSuite('v2.ap.title', language)}</h2>
                  <dl>
                    <div>
                      <dt>Contents</dt>
                      <dd>{tSuite('v2.ap.contents', language)}</dd>
                    </div>
                    <div>
                      <dt>Goes to</dt>
                      <dd>{tSuite('v2.ap.dest', language)} (fetscape-analysis-*.json/.txt)</dd>
                    </div>
                    <div>
                      <dt>Reviewer</dt>
                      <dd>{tSuite('v2.ap.reviewer', language)}</dd>
                    </div>
                  </dl>
                  <pre className="fx-pack" data-testid="evidence-pack">
                    {evidenceText}
                  </pre>
                  {pendingApprovals
                    .filter((a) => a.status === 'pending')
                    .map((approval) => (
                      <div key={approval.id} className="fx-approval__actions">
                        <button
                          type="button"
                          className="fx-primary"
                          data-testid="approve-export"
                          onClick={() => handleApproval(approval.id, true)}
                        >
                          {tSuite('v2.ap.approve', language)}
                        </button>
                        <button
                          type="button"
                          className="fx-quiet"
                          data-testid="reject-export"
                          onClick={() => handleApproval(approval.id, false)}
                        >
                          {tSuite('v2.ap.reject', language)}
                        </button>
                      </div>
                    ))}
                </section>
              ) : (
                <>
                  <button
                    ref={ctaRef}
                    type="button"
                    className="fx-primary"
                    data-testid="run-readiness"
                    disabled={analyzing}
                    onClick={() => requestExport('evidence')}
                  >
                    {tSuite('v2.cta.evidence', language)}
                  </button>

                  <details>
                    <summary>{tSuite('v2.how', language)}</summary>
                    <p>{readiness.method}</p>
                    <p>{tSuite('v2.how.mass', language)}</p>
                    <ul>
                      {readiness.assumptions.slice(0, 3).map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                      {readiness.uncertainties.slice(0, 2).map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                    <ul>
                      {citations.map((c) => (
                        <li key={`${c.source}-${c.section}`}>
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noreferrer">
                              {c.source} §{c.section}
                            </a>
                          ) : (
                            `${c.source} §${c.section}`
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>

                  <details
                    ref={livePanelRef}
                    data-testid="live-mode-panel"
                    open={nearOpen || undefined}
                    onToggle={(e) => setNearOpen((e.target as HTMLDetailsElement).open)}
                  >
                    <summary>{tSuite('v2.near', language)}</summary>
                    <p data-testid="screen-mode-label" className="mono" style={{ fontSize: 12 }}>
                      {screenResult.mode === 'live'
                        ? tSuite('proximity.modeLive', language)
                        : tSuite('proximity.modeReplay', language)}
                    </p>
                    <label
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        margin: '10px 0',
                        color: 'var(--fx-ink-2)',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        className="fx-switch"
                        data-testid="live-mode-toggle"
                        checked={liveOptIn}
                        onChange={(e) => setLiveOptIn(e.target.checked)}
                      />
                      {tSuite('proximity.live', language)}
                    </label>
                    <button
                      type="button"
                      className="fx-quiet"
                      data-testid="run-proximity-screen"
                      disabled={liveBusy}
                      onClick={() => {
                        if (liveOptIn) void handleLiveScreen();
                        else
                          setScreenResult({
                            mode: 'replay',
                            snapshot: getReplayCloseApproachSnapshot(),
                          });
                      }}
                    >
                      {liveBusy
                        ? language === 'en'
                          ? 'Running…'
                          : '執行中…'
                        : liveOptIn
                          ? tSuite('proximity.runLive', language)
                          : tSuite('proximity.runReplay', language)}
                    </button>
                    <div data-testid="proximity-disclaimer" style={{ marginTop: 12 }}>
                      <strong>{screenResult.snapshot.disclaimer}</strong>
                      <p className="fx-range">{tSuite('proximity.illustrative', language)}</p>
                    </div>
                    <table className="fx-prox-table" data-testid="proximity-table">
                      <caption>Geometric proximity</caption>
                      <thead>
                        <tr>
                          <th>Object</th>
                          <th>TCA (UTC)</th>
                          <th>Miss (km)</th>
                          <th>Rel. V (km/s)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {screenResult.snapshot.approaches.map((a) => (
                          <tr key={a.targetId + a.tcaUtc}>
                            <td data-label="Object">{a.targetName}</td>
                            <td data-label="TCA">{a.tcaUtc.slice(0, 16)}</td>
                            <td data-label="Miss">{a.missDistanceKm.toFixed(1)}</td>
                            <td data-label="Rel. V">{a.relativeVelocityKmS.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              )}
              <span id="plot-anchor" hidden />
            </>
          ) : (
            <section data-testid="debris-planner">
              <p data-testid="concept-study-banner">{tSuite('v2.adr.banner', language)}</p>
              <p data-testid="derelict-source">
                {tSuite('v2.adr.source', language)
                  .replace('{source}', derelict.meta.source)
                  .replace('{date}', derelict.meta.acquiredAt.slice(0, 10))
                  .replace('{n}', String(derelict.objects.length))}
              </p>
              <ol className="fx-targets" data-testid="derelict-ranking-table">
                {visibleRanked.map((row, idx) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="fx-tc"
                      data-testid={`derelict-row-${row.catalogId}`}
                      aria-pressed={selected?.id === row.id}
                      onClick={() => setSelectedTargetId(row.id)}
                    >
                      <span className="rk">{String(idx + 1).padStart(2, '0')}</span>
                      <span>
                        <div className="nm">{row.name}</div>
                        <div className="mt mono">
                          NORAD {row.catalogId} · {Math.round(row.altitude)} km ·{' '}
                          {row.inclination.toFixed(1)}°
                        </div>
                      </span>
                      <span className="fx-sbar" aria-hidden>
                        <i style={{ width: `${Math.round(row.rankingScore * 100)}%` }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="fx-quiet"
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
                onClick={() => setShowAllDebris((v) => !v)}
              >
                {showAllDebris
                  ? language === 'en'
                    ? 'Show top 5'
                    : '顯示前 5'
                  : tSuite('v2.adr.showAll', language).replace('{n}', String(ranked.length))}
              </button>

              {selected ? (
                <div data-testid="derelict-detail" style={{ marginTop: 16 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>
                    {selected.name}{' '}
                    <span className="mono" style={{ color: 'var(--fx-ink-3)', fontWeight: 400 }}>
                      NORAD {selected.catalogId}
                    </span>
                  </h3>
                  <ul className="fx-crit" data-testid="derelict-criteria">
                    {selected.criteriaDetail.map((c) => (
                      <li key={c.criterion}>
                        <strong>{c.criterion}</strong> value {String(c.value)} score{' '}
                        {c.score.toFixed(2)}
                        <br />
                        source: {c.source}
                        <br />
                        trade-off: {c.tradeOff}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!approvalKind ? (
                <button
                  type="button"
                  className="fx-primary"
                  style={{ marginTop: 16 }}
                  onClick={() => requestExport('ranking')}
                >
                  {tSuite('v2.adr.cta', language)}
                </button>
              ) : (
                <section
                  className="fx-approval"
                  data-testid="approval-card"
                  role="region"
                  aria-labelledby="ap-title-adr"
                  style={{ marginTop: 16 }}
                >
                  <h2 id="ap-title-adr">{tSuite('v2.ap.title', language)}</h2>
                  <pre className="fx-pack" data-testid="evidence-pack">
                    {debrisReport.slice(0, 1200)}
                  </pre>
                  {pendingApprovals
                    .filter((a) => a.status === 'pending')
                    .map((approval) => (
                      <div key={approval.id} className="fx-approval__actions">
                        <button
                          type="button"
                          className="fx-primary"
                          data-testid="approve-export"
                          onClick={() => handleApproval(approval.id, true)}
                        >
                          {tSuite('v2.ap.approve', language)}
                        </button>
                        <button
                          type="button"
                          className="fx-quiet"
                          data-testid="reject-export"
                          onClick={() => handleApproval(approval.id, false)}
                        >
                          {tSuite('v2.ap.reject', language)}
                        </button>
                      </div>
                    ))}
                </section>
              )}

              <details style={{ marginTop: 16 }}>
                <summary>{tSuite('v2.adr.report', language)}</summary>
                <pre className="fx-pack" data-testid="debris-report">
                  {debrisReport}
                </pre>
              </details>
            </section>
          )}
        </section>
      </div>

      {judgeMode && !coachHidden ? (
        <aside className="fx-coach" data-testid="judge-walkthrough">
          <div className="fx-coach__meta" data-testid="judge-mode-meta">
            {t('judge.title', language)} — {judgeStep + 1} / {walkthrough.length}
          </div>
          <h2 data-testid="walkthrough-title">{currentWalkthroughStep.title[language]}</h2>
          <p data-testid="walkthrough-description">
            {currentWalkthroughStep.description[language]}
          </p>
          <div className="fx-coach__actions">
            {judgeStep > 0 ? (
              <button
                type="button"
                className="fx-quiet"
                data-testid="walkthrough-prev"
                onClick={() => setJudgeStep(Math.max(0, judgeStep - 1))}
              >
                {tSuite('coach.back', language)}
              </button>
            ) : null}
            <button
              type="button"
              className="fx-primary"
              style={{ width: 'auto', minHeight: 40, padding: '8px 14px' }}
              data-testid="walkthrough-next"
              onClick={() => void handleJudgeNext()}
            >
              {judgeStep === walkthrough.length - 1
                ? t('judge.finish', language)
                : tSuite('coach.next', language)}
            </button>
            <button
              type="button"
              className="fx-quiet"
              onClick={() => {
                setCoachHidden(true);
                onJudgeModeChange?.(false);
              }}
            >
              {tSuite('coach.hide', language)}
            </button>
          </div>
        </aside>
      ) : null}

      {toast ? (
        <div className="fx-toast" role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}
