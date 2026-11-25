/**
 * Fetscape v1 MVP - Main Application Component
 * AI-Native Space Operations Workspace
 */

import { useState, useEffect } from 'react';
import type { Language, MissionProfile, AgentTrace, ApprovalRequest } from './types';
import { AgentOrchestrator } from './agent/orchestrator';
import { Verifier } from './agent/verifier';
import { t } from './i18n/translations';
import { DEMO_MISSIONS, DEMO_TRACE, WALKTHROUGH_STEPS } from './demo-data';

interface FetscapeAppProps {
  mode?: 'full' | 'judge';
  apiKey?: string;
}

export default function FetscapeApp({ mode = 'judge', apiKey }: FetscapeAppProps) {
  const [language, setLanguage] = useState<Language>('en');
  const [currentTab, setCurrentTab] = useState<'mission' | 'debris'>('mission');
  const [judgeStep, setJudgeStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [trace, setTrace] = useState<AgentTrace | null>(mode === 'judge' ? DEMO_TRACE : null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [missionInput, setMissionInput] = useState('');

  const orchestrator = new AgentOrchestrator({
    language,
    provider: apiKey ? 'anthropic' : 'deterministic',
    apiKey,
    maxTokens: 10000,
  });

  const verifier = new Verifier();

  const isJudgeMode = mode === 'judge';
  const currentWalkthroughStep = WALKTHROUGH_STEPS[judgeStep];

  async function handleAnalyzeMission(profile: MissionProfile) {
    setAnalyzing(true);
    try {
      const result = await orchestrator.analyzeMissionReadiness(profile);
      setTrace(result);

      // Create approval request for export
      if (result.verificationStatus === 'verified') {
        const approval: ApprovalRequest = {
          id: `approval-${Date.now()}`,
          type: 'export',
          title: t('approval.exportReport', language),
          description: t('approval.description', language),
          payload: result,
          status: 'pending',
        };
        setPendingApprovals([approval]);
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  }

  function handleJudgeNext() {
    if (judgeStep < WALKTHROUGH_STEPS.length - 1) {
      setJudgeStep(judgeStep + 1);

      // Trigger actions based on step
      if (judgeStep === 1) {
        // Step 2: Start analysis
        handleAnalyzeMission(DEMO_MISSIONS[0]);
      }
    }
  }

  function handleApproval(id: string, approved: boolean) {
    setPendingApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: approved ? 'approved' : 'rejected' } : a)),
    );

    if (approved) {
      // Handle export
      const approval = pendingApprovals.find((a) => a.id === id);
      if (approval) {
        const dataStr = JSON.stringify(approval.payload, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fetscape-analysis-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  }

  return (
    <div className="fetscape-app" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <header
        style={{ marginBottom: '2rem', borderBottom: '2px solid #333', paddingBottom: '1rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 'bold' }}>
              {t('appName', language)}
            </h1>
            <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: '1.1rem' }}>
              {t('tagline', language)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {isJudgeMode && (
              <div
                style={{
                  padding: '0.5rem 1rem',
                  background: '#ff6b35',
                  color: 'white',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                }}
              >
                {t('judgeMode', language)}
              </div>
            )}
            <button
              onClick={() => setLanguage(language === 'en' ? 'zh-TW' : 'en')}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #333',
                background: 'white',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {language === 'en' ? '中文' : 'English'}
            </button>
          </div>
        </div>
      </header>

      {/* Judge Mode Walkthrough */}
      {isJudgeMode && (
        <div
          style={{
            background: '#f5f5f5',
            padding: '2rem',
            borderRadius: '8px',
            marginBottom: '2rem',
            border: '2px solid #ff6b35',
          }}
        >
          <div style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                color: '#ff6b35',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem',
              }}
            >
              {t('judge.title', language)} - Step {judgeStep + 1} / {WALKTHROUGH_STEPS.length}
            </div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>
              {currentWalkthroughStep.title[language]}
            </h2>
            <p style={{ margin: 0, color: '#555', lineHeight: 1.6 }}>
              {currentWalkthroughStep.description[language]}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {judgeStep > 0 && (
              <button
                onClick={() => setJudgeStep(Math.max(0, judgeStep - 1))}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #333',
                  background: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {t('judge.prevStep', language)}
              </button>
            )}
            <button
              onClick={handleJudgeNext}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: '#ff6b35',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              {judgeStep === WALKTHROUGH_STEPS.length - 1
                ? t('judge.finish', language)
                : currentWalkthroughStep.action[language]}
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!isJudgeMode && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #ddd' }}>
            <button
              onClick={() => setCurrentTab('mission')}
              style={{
                padding: '1rem 2rem',
                border: 'none',
                background: currentTab === 'mission' ? '#333' : 'transparent',
                color: currentTab === 'mission' ? 'white' : '#333',
                cursor: 'pointer',
                fontWeight: 'bold',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
              }}
            >
              {t('lanes.missionReadiness', language)}
            </button>
            <button
              onClick={() => setCurrentTab('debris')}
              style={{
                padding: '1rem 2rem',
                border: 'none',
                background: currentTab === 'debris' ? '#333' : 'transparent',
                color: currentTab === 'debris' ? 'white' : '#333',
                cursor: 'pointer',
                fontWeight: 'bold',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
              }}
            >
              {t('lanes.debrisRemoval', language)}
            </button>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {trace && (
        <div
          style={{
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '2rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'start',
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>
                {t('missionReadiness.title', language)}
              </h2>
              <p style={{ margin: 0, color: '#666' }}>{trace.task}</p>
            </div>
            <div
              style={{
                padding: '0.5rem 1rem',
                background:
                  trace.verificationStatus === 'verified'
                    ? '#4caf50'
                    : trace.verificationStatus === 'blocked'
                      ? '#f44336'
                      : '#ff9800',
                color: 'white',
                borderRadius: '4px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
              }}
            >
              {t(`common.${trace.verificationStatus}`, language)}
            </div>
          </div>

          {/* Safety Disclaimers */}
          <div
            style={{
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '4px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
              ⚠️ {t('safety.title', language)}
            </strong>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', lineHeight: 1.6 }}>
              <li>{t('missionReadiness.disclaimers.geometricOnly', language)}</li>
              <li>{t('missionReadiness.disclaimers.decisionSupport', language)}</li>
              <li>{t('missionReadiness.disclaimers.noManeuvers', language)}</li>
              <li>{t('missionReadiness.disclaimers.noCommanding', language)}</li>
            </ul>
          </div>

          {/* Analysis Steps */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.2rem' }}>
              {t('common.verification', language)} Steps
            </h3>
            {trace.steps.map((step, idx) => (
              <div
                key={idx}
                style={{
                  background: '#f9f9f9',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  padding: '1rem',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: '#555' }}>
                  Step {idx + 1}: {step.thought}
                </div>
                {step.results.map((result, ridx) => (
                  <div key={ridx} style={{ fontSize: '0.9rem', color: '#666' }}>
                    {result.success ? (
                      <span style={{ color: '#4caf50' }}>✓ Success</span>
                    ) : (
                      <span style={{ color: '#f44336' }}>✗ {result.error}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Final Report */}
          {trace.finalResponse && (
            <div
              style={{
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '1.5rem',
              }}
            >
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.2rem' }}>
                {t('missionReadiness.sections.evidencePack', language)}
              </h3>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'system-ui',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {trace.finalResponse}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Approval Cards */}
      {pendingApprovals.filter((a) => a.status === 'pending').length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.5rem' }}>
            {t('approval.title', language)}
          </h2>
          {pendingApprovals
            .filter((a) => a.status === 'pending')
            .map((approval) => (
              <div
                key={approval.id}
                style={{
                  background: 'white',
                  border: '2px solid #ff9800',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem' }}>{approval.title}</h3>
                  <p style={{ margin: 0, color: '#666' }}>{approval.description}</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => handleApproval(approval.id, true)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      border: 'none',
                      background: '#4caf50',
                      color: 'white',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    {t('common.approve', language)}
                  </button>
                  <button
                    onClick={() => handleApproval(approval.id, false)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      border: '1px solid #333',
                      background: 'white',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    {t('common.reject', language)}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Loading State */}
      {analyzing && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
              {t('missionReadiness.analyzing', language)}
            </div>
            <div style={{ color: '#666' }}>{t('common.loading', language)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
