/**
 * Fetscape v1 MVP — AI-native space operations workspace (judge + full modes)
 */

import { useMemo, useState } from 'react';
import type { Language, MissionProfile, AgentTrace, ApprovalRequest } from './types';
import { AgentOrchestrator } from './agent/orchestrator';
import { t } from './i18n/translations';
import { DEMO_MISSIONS, DEMO_TRACE, WALKTHROUGH_STEPS } from './demo-data';
import {
  DEFAULT_CRITERIA,
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
import './styles.css';

interface FetscapeAppProps {
  mode?: 'full' | 'judge';
  apiKey?: string;
}

export default function FetscapeApp({ mode = 'judge', apiKey }: FetscapeAppProps) {
  const [language, setLanguage] = useState<Language>('en');
  const [currentTab, setCurrentTab] = useState<'mission' | 'debris'>('mission');
  const [judgeStep, setJudgeStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [trace, setTrace] = useState<AgentTrace | null>(mode === 'judge' ? DEMO_TRACE : null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
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
        criteria: DEFAULT_CRITERIA,
        dataSource: derelict.meta.source,
        contentSha256: derelict.meta.contentSha256,
      }),
    [derelict],
  );
  const selected: RankedDerelict | undefined =
    ranked.find((r) => r.id === selectedTargetId) ?? ranked[0];
  const debrisReport = useMemo(
    () => formatDebrisRankingReport(ranked, language),
    [ranked, language],
  );

  const isJudgeMode = mode === 'judge';
  const currentWalkthroughStep = WALKTHROUGH_STEPS[judgeStep];

  async function handleAnalyzeMission(profile: MissionProfile) {
    setAnalyzing(true);
    setProgressLabel(language === 'en' ? 'Orchestrator planning steps…' : '編排器規劃步驟中…');
    try {
      const orchestrator = new AgentOrchestrator({
        language,
        provider: apiKey ? 'anthropic' : 'deterministic',
        apiKey,
        maxTokens: 10000,
      });
      setProgressLabel(
        language === 'en' ? 'Running deterministic tools (replay)…' : '執行確定性工具（重播）…',
      );
      const result = await orchestrator.analyzeMissionReadiness(profile);
      setProgressLabel(language === 'en' ? 'Verifier checking outputs…' : '驗證器檢查輸出…');
      setTrace(result);
      if (result.verificationStatus === 'verified') {
        setPendingApprovals([
          {
            id: `approval-${Date.now()}`,
            type: 'export',
            title: t('approval.exportReport', language),
            description: t('approval.description', language),
            payload: result,
            status: 'pending',
          },
        ]);
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
    if (judgeStep >= WALKTHROUGH_STEPS.length - 1) return;
    const next = judgeStep + 1;
    setJudgeStep(next);
    if (judgeStep === 1) await handleAnalyzeMission(DEMO_MISSIONS[0]);
    if (next === 3) setCurrentTab('debris');
  }

  function handleApproval(id: string, approved: boolean) {
    setPendingApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: approved ? 'approved' : 'rejected' } : a)),
    );
    if (!approved) return;
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
  }

  return (
    <div className="fetscape-app" data-testid="fetscape-app">
      <header className="fetscape-header">
        <div>
          <h1 data-testid="fetscape-brand">{t('appName', language)}</h1>
          <p className="fetscape-tagline">{t('tagline', language)}</p>
        </div>
        <div className="fetscape-header-actions">
          {isJudgeMode ? (
            <div className="fetscape-badge" data-testid="judge-mode-badge">
              {t('judgeMode', language)}
            </div>
          ) : null}
          <button
            type="button"
            data-testid="language-toggle"
            className="fetscape-lang"
            onClick={() => setLanguage(language === 'en' ? 'zh-TW' : 'en')}
          >
            {language === 'en' ? '中文' : 'English'}
          </button>
        </div>
      </header>

      {isJudgeMode ? (
        <section className="fetscape-walkthrough" data-testid="judge-walkthrough">
          <div className="fetscape-walkthrough-meta">
            {t('judge.title', language)} — Step {judgeStep + 1} / {WALKTHROUGH_STEPS.length}
          </div>
          <h2 data-testid="walkthrough-title">{currentWalkthroughStep.title[language]}</h2>
          <p data-testid="walkthrough-description">
            {currentWalkthroughStep.description[language]}
          </p>
          <div className="fetscape-walkthrough-actions">
            {judgeStep > 0 ? (
              <button
                type="button"
                data-testid="walkthrough-prev"
                onClick={() => setJudgeStep(Math.max(0, judgeStep - 1))}
              >
                {t('judge.prevStep', language)}
              </button>
            ) : null}
            <button
              type="button"
              data-testid="walkthrough-next"
              className="fetscape-primary"
              onClick={() => void handleJudgeNext()}
            >
              {judgeStep === WALKTHROUGH_STEPS.length - 1
                ? t('judge.finish', language)
                : currentWalkthroughStep.action[language]}
            </button>
          </div>
        </section>
      ) : null}

      <div className="fetscape-tabs" role="tablist" aria-label="Fetscape lanes">
        <button
          type="button"
          role="tab"
          data-testid="tab-mission"
          aria-selected={currentTab === 'mission'}
          className={currentTab === 'mission' ? 'active' : ''}
          onClick={() => setCurrentTab('mission')}
        >
          {t('lanes.missionReadiness', language)}
        </button>
        <button
          type="button"
          role="tab"
          data-testid="tab-debris"
          aria-selected={currentTab === 'debris'}
          className={currentTab === 'debris' ? 'active' : ''}
          onClick={() => setCurrentTab('debris')}
        >
          {t('lanes.debrisRemoval', language)}
        </button>
      </div>

      {currentTab === 'mission' ? (
        <>
          <section className="fetscape-panel" data-testid="live-mode-panel">
            <div className="fetscape-panel-head">
              <div>
                <h2>{language === 'en' ? 'Geometric proximity screening' : '幾何接近篩選'}</h2>
                <p>
                  {language === 'en'
                    ? 'Judge default is bundled replay. Opt in to live CelesTrak + SGP4 in a Web Worker; failures fall back to replay.'
                    : '評審預設使用內建重播。可選擇以 Web Worker 即時抓取 CelesTrak 並執行 SGP4；失敗則回退重播。'}
                </p>
              </div>
            </div>
            <label className="fetscape-live-toggle">
              <input
                type="checkbox"
                data-testid="live-mode-toggle"
                checked={liveOptIn}
                onChange={(e) => setLiveOptIn(e.target.checked)}
              />
              {language === 'en'
                ? 'Enable live mode (opt-in, network required)'
                : '啟用即時模式（需連線）'}
            </label>
            <div className="fetscape-walkthrough-actions">
              <button
                type="button"
                className="fetscape-primary"
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
                    ? 'Running live worker…'
                    : '執行即時 Worker…'
                  : liveOptIn
                    ? language === 'en'
                      ? 'Run live proximity screen'
                      : '執行即時接近篩選'
                    : language === 'en'
                      ? 'Show replay proximity screen'
                      : '顯示重播接近篩選'}
              </button>
            </div>
            <p data-testid="screen-mode-label" className="fetscape-muted">
              {screenResult.mode === 'live'
                ? language === 'en'
                  ? 'Mode: LIVE (Web Worker)'
                  : '模式：即時（Web Worker）'
                : language === 'en'
                  ? `Mode: REPLAY${screenResult.reason ? ` (fallback: ${screenResult.reason})` : ''}`
                  : `模式：重播${screenResult.reason ? `（回退：${screenResult.reason}）` : ''}`}
            </p>
            <div className="fetscape-safety" data-testid="proximity-disclaimer">
              <strong>{screenResult.snapshot.disclaimer}</strong>
              <p className="fetscape-muted">
                {language === 'en'
                  ? 'Miss distance is geometric proximity only — not Pc.'
                  : '最近距離僅為幾何接近，非 Pc。'}
              </p>
            </div>
            <table className="fetscape-table" data-testid="proximity-table">
              <thead>
                <tr>
                  <th>Object</th>
                  <th>TCA (UTC)</th>
                  <th>Miss (km)</th>
                  <th>Rel. V (km/s)</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {screenResult.snapshot.approaches.map((a) => (
                  <tr key={a.targetId + a.tcaUtc}>
                    <td>{a.targetName}</td>
                    <td>{a.tcaUtc.slice(0, 16)}</td>
                    <td>{a.missDistanceKm.toFixed(1)}</td>
                    <td>{a.relativeVelocityKmS.toFixed(2)}</td>
                    <td>{a.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {trace ? (
            <section className="fetscape-panel" data-testid="analysis-results">
              <div className="fetscape-panel-head">
                <div>
                  <h2>{t('missionReadiness.title', language)}</h2>
                  <p>{trace.task}</p>
                </div>
                <div
                  className={`fetscape-status ${trace.verificationStatus}`}
                  data-testid="verification-status"
                >
                  {t(`common.${trace.verificationStatus}`, language)}
                </div>
              </div>
              <div className="fetscape-safety" data-testid="safety-disclaimers">
                <strong>⚠ {t('safety.title', language)}</strong>
                <ul>
                  <li>{t('missionReadiness.disclaimers.geometricOnly', language)}</li>
                  <li>{t('missionReadiness.disclaimers.decisionSupport', language)}</li>
                  <li>{t('missionReadiness.disclaimers.noManeuvers', language)}</li>
                  <li>{t('missionReadiness.disclaimers.noCommanding', language)}</li>
                </ul>
              </div>
              {trace.finalResponse ? (
                <pre className="fetscape-report" data-testid="evidence-pack">
                  {trace.finalResponse}
                </pre>
              ) : (
                <p className="fetscape-muted">
                  {language === 'en'
                    ? 'Preloaded judge trace. Continue the walkthrough to generate a verified evidence pack.'
                    : '預載評審軌跡。繼續導覽以產生已驗證的證據包。'}
                </p>
              )}
            </section>
          ) : null}
        </>
      ) : null}

      {currentTab === 'debris' ? (
        <section className="fetscape-panel" data-testid="debris-planner">
          <div className="fetscape-concept-banner" data-testid="concept-study-banner">
            {language === 'en'
              ? 'Decision support for a qualified operator only. Concept-study ranking from a frozen CelesTrak derelict snapshot — no maneuver advice, no commanding, not Pc.'
              : '僅供合格操作員決策支援。來自凍結 CelesTrak 廢棄物體快照的概念排序——無機動建議、無指令、非 Pc。'}
          </div>
          <h2>{t('debrisRemoval.title', language)}</h2>
          <p data-testid="derelict-source">
            {language === 'en' ? 'Source: ' : '來源：'}
            {derelict.meta.source}
            <br />
            <code>SHA-256 {derelict.meta.contentSha256.slice(0, 20)}…</code>
            <br />
            {derelict.meta.note}
          </p>
          <table className="fetscape-table" data-testid="derelict-ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Object</th>
                <th>Class</th>
                <th>Alt (km)</th>
                <th>Lifetime (yr)</th>
                <th>Shell N</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, idx) => (
                <tr
                  key={row.id}
                  className={selected?.id === row.id ? 'selected' : ''}
                  data-testid={`derelict-row-${row.catalogId}`}
                >
                  <td>{idx + 1}</td>
                  <td>
                    <button type="button" onClick={() => setSelectedTargetId(row.id)}>
                      {row.name}
                    </button>
                  </td>
                  <td>{row.objectClass}</td>
                  <td>{Math.round(row.altitude)}</td>
                  <td>{row.estimatedLifetimeYears}</td>
                  <td>{row.shellDensityNearby}</td>
                  <td>{row.rankingScore}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {selected ? (
            <div className="fetscape-target-detail" data-testid="derelict-detail">
              <h3>
                {selected.name} <span className="fetscape-muted">NORAD {selected.catalogId}</span>
              </h3>
              <p className="fetscape-muted">
                {language === 'en'
                  ? 'Trade-offs cite the data source for each score. Mass/size are not observed from GP.'
                  : '每項分數皆標明資料來源。質量／尺寸並非由 GP 觀測而得。'}
              </p>
              <ul data-testid="derelict-criteria">
                {selected.criteriaDetail.map((c) => (
                  <li key={c.criterion}>
                    <strong>{c.criterion}</strong> (w={c.weight}, score={c.score.toFixed(2)}):{' '}
                    {c.value}
                    <br />
                    <span className="fetscape-muted">source: {c.source}</span>
                    <br />
                    <span className="fetscape-muted">trade-off: {c.tradeOff}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <pre className="fetscape-report" data-testid="debris-report">
            {debrisReport}
          </pre>
          <p className="fetscape-muted">
            {language === 'en'
              ? 'Open Capture rehearsal from the sidebar for a near-field rendezvous concept simulation. Planning context stays separate from local synthetic state.'
              : '從側邊欄開啟捕獲演練以進行近場交會概念模擬。規劃脈絡與本地合成狀態保持分離。'}
          </p>
        </section>
      ) : null}

      {pendingApprovals.some((a) => a.status === 'pending') ? (
        <section className="fetscape-approval" data-testid="approval-card">
          <div className="fetscape-approval-banner">
            <strong>{t('approval.title', language)}</strong>
            <span>{t('approval.description', language)}</span>
          </div>
          {pendingApprovals
            .filter((a) => a.status === 'pending')
            .map((approval) => (
              <div key={approval.id} className="fetscape-approval-body">
                <h3>{approval.title}</h3>
                <p>{approval.description}</p>
                <div className="fetscape-approval-actions">
                  <button
                    type="button"
                    data-testid="approve-export"
                    className="fetscape-approve"
                    onClick={() => handleApproval(approval.id, true)}
                  >
                    {t('common.approve', language)}
                  </button>
                  <button
                    type="button"
                    data-testid="reject-export"
                    onClick={() => handleApproval(approval.id, false)}
                  >
                    {t('common.reject', language)}
                  </button>
                </div>
              </div>
            ))}
        </section>
      ) : null}

      {analyzing ? (
        <div className="fetscape-overlay" data-testid="analysis-progress" role="status">
          <div className="fetscape-overlay-card">
            <div className="fetscape-spinner" aria-hidden="true" />
            <div>{t('missionReadiness.analyzing', language)}</div>
            <p>{progressLabel || t('common.loading', language)}</p>
            <div className="fetscape-progress-track">
              <div className="fetscape-progress-bar" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
