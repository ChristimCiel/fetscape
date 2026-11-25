/**
 * Fetscape v1 MVP — AI-native space operations workspace (judge + full modes)
 */

import { useState } from 'react';
import type { Language, MissionProfile, AgentTrace, ApprovalRequest } from './types';
import { AgentOrchestrator } from './agent/orchestrator';
import { t } from './i18n/translations';
import { DEMO_MISSIONS, DEMO_TRACE, WALKTHROUGH_STEPS } from './demo-data';
import {
  DEFAULT_CRITERIA,
  formatDebrisRankingReport,
  generateMissionConcept,
  rankDebrisTargets,
} from './tools/debris-ranking';
import type { GPObject } from './tools/celestrak';
import './styles.css';

interface FetscapeAppProps {
  mode?: 'full' | 'judge';
  apiKey?: string;
}

const DEMO_DEBRIS_CATALOG: GPObject[] = [
  {
    OBJECT_NAME: 'COSMOS 2251 DEB',
    OBJECT_ID: '1993-036ABC',
    EPOCH: '2026-11-10T00:00:00.000Z',
    MEAN_MOTION: 15.2,
    ECCENTRICITY: 0.002,
    INCLINATION: 74.0,
    RA_OF_ASC_NODE: 120,
    ARG_OF_PERICENTER: 10,
    MEAN_ANOMALY: 20,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: 34454,
    ELEMENT_SET_NO: 1,
    REV_AT_EPOCH: 1,
    BSTAR: 1e-4,
    MEAN_MOTION_DOT: 0,
    MEAN_MOTION_DDOT: 0,
  },
  {
    OBJECT_NAME: 'SL-16 R/B',
    OBJECT_ID: '1993-016B',
    EPOCH: '2026-11-10T00:00:00.000Z',
    MEAN_MOTION: 15.05,
    ECCENTRICITY: 0.001,
    INCLINATION: 71.0,
    RA_OF_ASC_NODE: 80,
    ARG_OF_PERICENTER: 30,
    MEAN_ANOMALY: 40,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: 22566,
    ELEMENT_SET_NO: 1,
    REV_AT_EPOCH: 1,
    BSTAR: 5e-5,
    MEAN_MOTION_DOT: 0,
    MEAN_MOTION_DDOT: 0,
  },
  {
    OBJECT_NAME: 'IRIDIUM 33 DEB',
    OBJECT_ID: '1997-051C',
    EPOCH: '2026-11-10T00:00:00.000Z',
    MEAN_MOTION: 14.95,
    ECCENTRICITY: 0.003,
    INCLINATION: 86.4,
    RA_OF_ASC_NODE: 200,
    ARG_OF_PERICENTER: 50,
    MEAN_ANOMALY: 60,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: 33757,
    ELEMENT_SET_NO: 1,
    REV_AT_EPOCH: 1,
    BSTAR: 2e-4,
    MEAN_MOTION_DOT: 0,
    MEAN_MOTION_DDOT: 0,
  },
];

export default function FetscapeApp({ mode = 'judge', apiKey }: FetscapeAppProps) {
  const [language, setLanguage] = useState<Language>('en');
  const [currentTab, setCurrentTab] = useState<'mission' | 'debris'>('mission');
  const [judgeStep, setJudgeStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [trace, setTrace] = useState<AgentTrace | null>(mode === 'judge' ? DEMO_TRACE : null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [debrisReport, setDebrisReport] = useState('');

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

  function runDebrisRanking() {
    const ranked = rankDebrisTargets(DEMO_DEBRIS_CATALOG, DEFAULT_CRITERIA);
    setDebrisReport(formatDebrisRankingReport(ranked, DEFAULT_CRITERIA, language));
    if (ranked[0]) generateMissionConcept(ranked[0]);
  }

  async function handleJudgeNext() {
    if (judgeStep >= WALKTHROUGH_STEPS.length - 1) return;
    const next = judgeStep + 1;
    setJudgeStep(next);
    // After "mission input" step, run offline analysis so approval appears.
    if (judgeStep === 1) {
      await handleAnalyzeMission(DEMO_MISSIONS[0]);
    }
    if (next === 3) {
      setCurrentTab('debris');
      runDebrisRanking();
    }
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
          onClick={() => {
            setCurrentTab('debris');
            if (!debrisReport) runDebrisRanking();
          }}
        >
          {t('lanes.debrisRemoval', language)}
        </button>
      </div>

      {currentTab === 'mission' && trace ? (
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

      {currentTab === 'debris' ? (
        <section className="fetscape-panel" data-testid="debris-planner">
          <div className="fetscape-concept-banner" data-testid="concept-study-banner">
            {t('debrisRemoval.disclaimers.conceptOnly', language)}
          </div>
          <h2>{t('debrisRemoval.title', language)}</h2>
          <p>{t('debrisRemoval.subtitle', language)}</p>
          <button
            type="button"
            className="fetscape-primary"
            data-testid="rank-debris"
            onClick={runDebrisRanking}
          >
            {t('debrisRemoval.selectTarget', language)}
          </button>
          {debrisReport ? (
            <pre className="fetscape-report" data-testid="debris-report">
              {debrisReport}
            </pre>
          ) : null}
          <p className="fetscape-muted">
            {language === 'en'
              ? 'Open Capture rehearsal from the sidebar to explore a near-field rendezvous concept simulation. Planning context and local synthetic state stay separate.'
              : '從側邊欄開啟捕獲演練以探索近場交會概念模擬。規劃脈絡與本地合成狀態保持分離。'}
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
