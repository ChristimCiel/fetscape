/**
 * Fetscape product surface — Mission readiness + Debris removal (Suite UI).
 */

import { useEffect, useMemo, useState } from 'react';
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
import { tSuite } from '../suite/i18n';
import './styles.css';

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

const PRESET_KEYS = ['preset.taiwan', 'preset.commercial', 'preset.crewed'] as const;

export default function FetscapeApp({
  mode = 'judge',
  apiKey,
  language,
  productTab,
  onProductTabChange,
  judgeMode = true,
  onJudgeModeChange,
}: FetscapeAppProps) {
  const [judgeStep, setJudgeStep] = useState(0);
  const [coachHidden, setCoachHidden] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [missionIndex, setMissionIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftAltitude, setDraftAltitude] = useState(DEMO_MISSIONS[0].orbit.altitude ?? 510);
  const [draftMass, setDraftMass] = useState(DEMO_MISSIONS[0].mass ?? 10);
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

  useEffect(() => {
    if (judgeMode) setCoachHidden(false);
  }, [judgeMode]);

  async function runReadiness(nextProfile: MissionProfile = profile) {
    setAnalyzing(true);
    setProgressLabel(language === 'en' ? 'Running deterministic tools…' : '執行確定性工具…');
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
    if (judgeStep >= walkthrough.length - 1) return;
    const next = judgeStep + 1;
    setJudgeStep(next);
    if (judgeStep === 1) await runReadiness(profile);
    if (next === 3) onProductTabChange?.('debris');
  }

  function selectPreset(index: number) {
    const mission = DEMO_MISSIONS[index];
    setMissionIndex(index);
    setProfile(mission);
    setDraftAltitude(mission.orbit.altitude ?? 500);
    setDraftMass(mission.mass ?? 10);
    setReadiness(computeReadiness(mission));
    setEditing(false);
  }

  function applyEdits() {
    const next: MissionProfile = {
      ...profile,
      mass: draftMass,
      orbit: { ...profile.orbit, altitude: draftAltitude },
    };
    setProfile(next);
    setReadiness(computeReadiness(next));
    setEditing(false);
  }

  function requestExport(kind: 'evidence' | 'ranking') {
    setApprovalKind(kind);
    setPendingApprovals([
      {
        id: `approval-${Date.now()}`,
        type: 'export',
        title:
          kind === 'evidence'
            ? tSuite('approval.exportTitle', language)
            : tSuite('approval.exportRanking', language),
        description: t('approval.description', language),
        payload:
          kind === 'evidence'
            ? { trace, readiness, profile }
            : { ranking: ranked, report: debrisReport },
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
  }

  const stepperStates = ['profile', 'screen', 'lifetime', 'rules', 'signoff'] as const;
  const activeStepIndex = approvalKind ? 4 : readiness ? 3 : 0;

  return (
    <div className="fetscape-app" data-testid="fetscape-app">
      {productTab === 'mission' ? (
        <>
          <section className="sx-hero">
            <div className="sx-hero__copy">
              <span className="sx-eyebrow">{tSuite('hero.eyebrow', language)}</span>
              <h1>{tSuite('hero.h1', language)}</h1>
              <p>{tSuite('hero.sub', language)}</p>
              <div className="sx-hero__actions">
                <button
                  type="button"
                  className="sx-btn sx-btn--primary"
                  onClick={() => void runReadiness()}
                  disabled={analyzing}
                >
                  {tSuite('hero.run', language)}
                </button>
                <button
                  type="button"
                  className="sx-btn sx-btn--ghost"
                  onClick={() => setEditing((v) => !v)}
                >
                  {tSuite('hero.edit', language)}
                </button>
              </div>
              <span className="sx-chip">
                {tSuite('hero.chip', language)} · CelesTrak {readiness.shellSnapshotDate}
              </span>
            </div>
            <div className="sx-hero__artifact">
              <div className="sx-card sx-card--focus">
                <div className="sx-preset-row" role="group" aria-label="Mission presets">
                  {DEMO_MISSIONS.map((m, i) => (
                    <button
                      key={m.name}
                      type="button"
                      aria-pressed={missionIndex === i}
                      onClick={() => selectPreset(i)}
                    >
                      {tSuite(PRESET_KEYS[i], language)}
                    </button>
                  ))}
                </div>
                <div className="sx-mission-fields">
                  <div>
                    {tSuite('hero.mass', language)}{' '}
                    <strong className="sx-num">{profile.mass ?? '—'} kg</strong>
                  </div>
                  <div>
                    {tSuite('hero.altitude', language)}{' '}
                    <strong className="sx-num">{profile.orbit.altitude ?? '—'} km</strong>
                  </div>
                  <div>
                    {tSuite('hero.incl', language)}{' '}
                    <strong className="sx-num">{profile.orbit.inclination}°</strong>
                  </div>
                  <div>
                    {tSuite('hero.propulsion', language)}{' '}
                    <strong>
                      {profile.hasNoPropulsion
                        ? tSuite('hero.propulsionNone', language)
                        : tSuite('hero.propulsionYes', language)}
                    </strong>
                  </div>
                </div>
                {editing ? (
                  <div className="sx-mission-fields">
                    <label>
                      {tSuite('hero.altitude', language)}
                      <input
                        type="number"
                        className="sx-num"
                        value={draftAltitude}
                        onChange={(e) => setDraftAltitude(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      {tSuite('hero.mass', language)}
                      <input
                        type="number"
                        className="sx-num"
                        value={draftMass}
                        onChange={(e) => setDraftMass(Number(e.target.value))}
                      />
                    </label>
                    <button type="button" className="sx-btn sx-btn--secondary" onClick={applyEdits}>
                      {tSuite('hero.run', language)}
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="sx-btn sx-btn--primary"
                  data-testid="run-readiness"
                  onClick={() => void runReadiness()}
                  disabled={analyzing}
                >
                  {tSuite('hero.run', language)}
                </button>
              </div>
            </div>
          </section>

          <ol className="sx-stepper" aria-label="Readiness steps">
            {stepperStates.map((key, i) => (
              <li
                key={key}
                className={
                  i < activeStepIndex ? 'is-done' : i === activeStepIndex ? 'is-active' : 'is-todo'
                }
              >
                {tSuite(
                  (
                    {
                      profile: 'stepper.profile',
                      screen: 'stepper.screen',
                      lifetime: 'stepper.lifetime',
                      rules: 'stepper.rules',
                      signoff: 'stepper.signoff',
                    } as const
                  )[key],
                  language,
                )}
              </li>
            ))}
          </ol>

          <div className="sx-stats" data-testid="analysis-results">
            <div className="sx-card sx-stat">
              <span className="sx-stat__label">{tSuite('stat.deorbit', language)}</span>
              <span className="sx-stat__value sx-num">{readiness.lifetimeYears} yr</span>
              <span className="sx-stat__meta sx-num">
                {readiness.lifetimeRange[0]}–{readiness.lifetimeRange[1]} yr
              </span>
              <details className="sx-disclosure">
                <summary>{tSuite('stat.how', language)}</summary>
                <p className="sx-muted">
                  {readiness.method}. {readiness.uncertainties[0]}
                </p>
              </details>
            </div>
            <div className="sx-card sx-stat">
              <span className="sx-stat__label">{tSuite('stat.nstc', language)}</span>
              <span
                className={`sx-status ${readiness.complies25Year ? 'sx-status--positive' : 'sx-status--caution'}`}
              >
                {readiness.complies25Year
                  ? tSuite('stat.within', language)
                  : tSuite('stat.exceeds', language)}
              </span>
              <details className="sx-disclosure">
                <summary>{tSuite('stat.source', language)}</summary>
                <p className="sx-muted">NSTC disposal guidance · screening estimate</p>
              </details>
            </div>
            <div className="sx-card sx-stat">
              <span className="sx-stat__label">{tSuite('stat.fcc', language)}</span>
              <span
                className={`sx-status ${readiness.complies5Year ? 'sx-status--positive' : 'sx-status--caution'}`}
              >
                {readiness.complies5Year
                  ? tSuite('stat.within', language)
                  : tSuite('stat.exceeds', language)}
              </span>
              <details className="sx-disclosure">
                <summary>{tSuite('stat.source', language)}</summary>
                <p className="sx-muted">FCC 5-year rule · screening estimate</p>
              </details>
            </div>
            <div className="sx-card sx-stat">
              <span className="sx-stat__label">{tSuite('stat.shell', language)}</span>
              <span className="sx-stat__value sx-num">
                {readiness.shellObjects}{' '}
                <span style={{ fontSize: '13px', fontWeight: 400 }}>
                  {tSuite('stat.objects', language)}
                </span>
              </span>
              <span
                className="sx-status sx-status--neutral"
                data-testid="verification-status"
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
              >
                {t(`common.${trace?.verificationStatus ?? 'verified'}`, language)}
              </span>
              <details className="sx-disclosure">
                <summary>{tSuite('stat.snapshot', language)}</summary>
                <p className="sx-muted">
                  {readiness.shellSource} · {readiness.shellSnapshotDate}
                </p>
              </details>
            </div>
          </div>
          <p className="sx-muted">{tSuite('stat.meaning', language)}</p>

          <div className="sx-note sx-note--safety" data-testid="safety-disclaimers">
            <strong>{t('safety.title', language)}</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: '1.1rem' }}>
              <li>{t('missionReadiness.disclaimers.geometricOnly', language)}</li>
              <li>{t('missionReadiness.disclaimers.decisionSupport', language)}</li>
              <li>{t('missionReadiness.disclaimers.noManeuvers', language)}</li>
              <li>{t('missionReadiness.disclaimers.noCommanding', language)}</li>
            </ul>
            <p style={{ marginTop: 8 }}>{tSuite('safety.note', language)}</p>
          </div>

          <pre className="fetscape-report" data-testid="evidence-pack">
            {trace?.finalResponse ??
              `GEOMETRIC SCREENING ONLY. Not probability of collision (Pc).\nDeorbit screening: ${readiness.lifetimeYears} yr · shell objects (bundled snapshot ±25 km): ${readiness.shellObjects}.\nDecision support for a qualified operator.`}
          </pre>

          <div className="sx-hero__actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="sx-btn sx-btn--primary"
              onClick={() => requestExport('evidence')}
            >
              {tSuite('approval.exportTitle', language)}
            </button>
          </div>

          <section className="sx-card" data-testid="live-mode-panel" style={{ marginTop: 24 }}>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>{tSuite('proximity.title', language)}</h2>
            <label
              className="fetscape-live-toggle"
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            >
              <input
                type="checkbox"
                className="sx-switch"
                data-testid="live-mode-toggle"
                checked={liveOptIn}
                onChange={(e) => setLiveOptIn(e.target.checked)}
              />
              {tSuite('proximity.live', language)}
            </label>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="sx-btn sx-btn--secondary"
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
            </div>
            <p data-testid="screen-mode-label" className="sx-muted">
              {screenResult.mode === 'live'
                ? tSuite('proximity.modeLive', language)
                : `${tSuite('proximity.modeReplay', language)}${screenResult.reason ? ` (${screenResult.reason})` : ''}`}
            </p>
            <div className="sx-note sx-note--safety" data-testid="proximity-disclaimer">
              <strong>{screenResult.snapshot.disclaimer}</strong>
              <p className="sx-muted">{tSuite('proximity.illustrative', language)}</p>
            </div>
            <table className="sx-table sx-table--stack" data-testid="proximity-table">
              <caption className="sx-muted" style={{ textAlign: 'left', padding: '8px 12px' }}>
                Geometric proximity
              </caption>
              <thead>
                <tr>
                  <th>Object</th>
                  <th>TCA (UTC)</th>
                  <th className="sx-num">Miss (km)</th>
                  <th className="sx-num">Rel. V (km/s)</th>
                </tr>
              </thead>
              <tbody>
                {screenResult.snapshot.approaches.map((a) => (
                  <tr key={a.targetId + a.tcaUtc}>
                    <td data-label="Object">{a.targetName}</td>
                    <td data-label="TCA" className="sx-num">
                      {a.tcaUtc.slice(0, 16)}
                    </td>
                    <td data-label="Miss (km)" className="sx-num sx-proximity">
                      {a.missDistanceKm.toFixed(1)}
                    </td>
                    <td data-label="Rel. V" className="sx-num sx-proximity">
                      {a.relativeVelocityKmS.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}

      {productTab === 'debris' ? (
        <section data-testid="debris-planner">
          <div className="sx-note" data-testid="concept-study-banner">
            {tSuite('debris.decisionBanner', language)}
          </div>
          <h2>{tSuite('debris.h2', language)}</h2>
          <p className="sx-muted">{tSuite('debris.sub', language)}</p>
          <p data-testid="derelict-source">
            {language === 'en' ? 'Source: ' : '來源：'}
            {derelict.meta.source}
            <br />
            <code className="sx-mono">SHA-256 {derelict.meta.contentSha256.slice(0, 20)}…</code>
          </p>
          <table className="sx-table sx-table--stack" data-testid="derelict-ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Object</th>
                <th>Class</th>
                <th className="sx-num">Alt (km)</th>
                <th className="sx-num">Lifetime (yr)</th>
                <th className="sx-num">Score</th>
              </tr>
            </thead>
            <tbody>
              {visibleRanked.map((row, idx) => (
                <tr
                  key={row.id}
                  className={selected?.id === row.id ? 'selected' : ''}
                  data-testid={`derelict-row-${row.catalogId}`}
                >
                  <td data-label="#">{idx + 1}</td>
                  <td data-label="Object">
                    <button
                      type="button"
                      className="sx-btn sx-btn--ghost"
                      style={{ height: 'auto', padding: 0 }}
                      onClick={() => setSelectedTargetId(row.id)}
                    >
                      {row.name}
                    </button>
                    <span
                      className="sx-score-bar"
                      style={{ width: `${Math.round(row.rankingScore * 80)}px`, marginLeft: 8 }}
                      title={`score ${row.rankingScore}`}
                    />
                  </td>
                  <td data-label="Class">{row.objectClass}</td>
                  <td data-label="Alt" className="sx-num">
                    {Math.round(row.altitude)}
                  </td>
                  <td data-label="Lifetime" className="sx-num">
                    {row.estimatedLifetimeYears}
                  </td>
                  <td data-label="Score" className="sx-num">
                    {row.rankingScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sx-hero__actions">
            <button
              type="button"
              className="sx-btn sx-btn--secondary"
              onClick={() => setShowAllDebris((v) => !v)}
            >
              {showAllDebris
                ? tSuite('debris.showTop', language)
                : `${tSuite('debris.showAll', language)} ${ranked.length}`}
            </button>
            <button
              type="button"
              className="sx-btn sx-btn--primary"
              onClick={() => requestExport('ranking')}
            >
              {tSuite('debris.export', language)}
            </button>
          </div>

          {selected ? (
            <div className="sx-card" data-testid="derelict-detail" style={{ marginTop: 16 }}>
              <h3>
                {selected.name} <span className="sx-muted sx-num">NORAD {selected.catalogId}</span>
              </h3>
              <ul data-testid="derelict-criteria">
                {selected.criteriaDetail.map((c) => (
                  <li key={c.criterion}>
                    <strong>{c.criterion}</strong> (w={c.weight}, score={c.score.toFixed(2)}):{' '}
                    {c.value}
                    <br />
                    <span className="sx-muted">source: {c.source}</span>
                    <br />
                    <span className="sx-muted">trade-off: {c.tradeOff}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <pre className="fetscape-report" data-testid="debris-report">
            {debrisReport}
          </pre>
        </section>
      ) : null}

      {pendingApprovals.some((a) => a.status === 'pending') && approvalKind ? (
        <section
          className="sx-approval"
          data-testid="approval-card"
          role="region"
          aria-labelledby="sx-approval-heading"
        >
          <div className="sx-approval-banner">
            <strong id="sx-approval-heading">{tSuite('approval.needs', language)}</strong>
            <span>
              {approvalKind === 'evidence'
                ? tSuite('approval.exportTitle', language)
                : tSuite('approval.exportRanking', language)}
            </span>
          </div>
          {pendingApprovals
            .filter((a) => a.status === 'pending')
            .map((approval) => (
              <div key={approval.id}>
                <dl className="sx-approval__facts">
                  <div>
                    <dt>{tSuite('approval.what', language)}</dt>
                    <dd>{tSuite('approval.whatBody', language)}</dd>
                  </div>
                  <div>
                    <dt>{tSuite('approval.scope', language)}</dt>
                    <dd>{tSuite('approval.scopeBody', language)}</dd>
                  </div>
                  <div>
                    <dt>{tSuite('approval.files', language)}</dt>
                    <dd className="sx-mono">fetscape-analysis-*.json</dd>
                  </div>
                  <div>
                    <dt>{tSuite('approval.destination', language)}</dt>
                    <dd>{tSuite('approval.destinationBody', language)}</dd>
                  </div>
                  <div>
                    <dt>{tSuite('approval.executedBy', language)}</dt>
                    <dd>{tSuite('approval.executedByBody', language)}</dd>
                  </div>
                </dl>
                <div className="sx-approval__actions">
                  <button
                    type="button"
                    data-testid="approve-export"
                    className="sx-btn sx-btn--primary"
                    onClick={() => handleApproval(approval.id, true)}
                  >
                    {tSuite('approval.approveExport', language)}
                  </button>
                  <button
                    type="button"
                    data-testid="reject-export"
                    className="sx-btn sx-btn--ghost"
                    onClick={() => handleApproval(approval.id, false)}
                  >
                    {tSuite('approval.notNow', language)}
                  </button>
                </div>
                <p className="sx-approval__reassurance">
                  {tSuite('approval.reassurance', language)}
                </p>
                <details className="sx-disclosure">
                  <summary>{tSuite('approval.preview', language)}</summary>
                  <pre className="fetscape-report">
                    {approvalKind === 'ranking'
                      ? debrisReport.slice(0, 1200)
                      : (trace?.finalResponse ?? JSON.stringify(readiness, null, 2))}
                  </pre>
                </details>
              </div>
            ))}
        </section>
      ) : null}

      {judgeMode && !coachHidden ? (
        <aside className="sx-coach" data-testid="judge-walkthrough">
          <div className="sx-coach__meta" data-testid="judge-mode-meta">
            {t('judge.title', language)} — {judgeStep + 1} / {walkthrough.length}
          </div>
          <h2 data-testid="walkthrough-title">{currentWalkthroughStep.title[language]}</h2>
          <p data-testid="walkthrough-description">
            {currentWalkthroughStep.description[language]}
          </p>
          <div className="sx-coach__actions">
            {judgeStep > 0 ? (
              <button
                type="button"
                className="sx-btn sx-btn--ghost"
                data-testid="walkthrough-prev"
                onClick={() => setJudgeStep(Math.max(0, judgeStep - 1))}
              >
                {tSuite('coach.back', language)}
              </button>
            ) : null}
            <button
              type="button"
              className="sx-btn sx-btn--primary"
              data-testid="walkthrough-next"
              onClick={() => void handleJudgeNext()}
            >
              {judgeStep === walkthrough.length - 1
                ? t('judge.finish', language)
                : tSuite('coach.next', language)}
            </button>
            <button
              type="button"
              className="sx-btn sx-btn--ghost"
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

      {analyzing ? (
        <div className="fetscape-overlay" data-testid="analysis-progress" role="status">
          <div className="fetscape-overlay-card">
            <div className="fetscape-spinner" aria-hidden="true" />
            <div>{t('missionReadiness.analyzing', language)}</div>
            <p>{progressLabel || t('common.loading', language)}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
