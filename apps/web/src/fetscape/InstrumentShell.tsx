/**
 * Fetscape v2 product chrome — Orbit Instrument shell (not used by Lab).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Language } from './types';
import { LAB_RAIL, type LabPage } from '../suite/SuiteShell';
import { persistLanguage, siblingProductUrl } from '../suite/language';
import { tSuite } from '../suite/i18n';
import './instrument.css';

export type InstrumentMode = 'ready' | 'adr';

interface InstrumentShellProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  judgeMode: boolean;
  onJudgeModeChange: (on: boolean) => void;
  mode: InstrumentMode;
  onModeChange: (mode: InstrumentMode) => void;
  onSelectLab: (page: LabPage) => void;
  children: ReactNode;
}

function OrbitGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="10" cy="10" r="3" fill="currentColor" />
      <ellipse
        cx="10"
        cy="10"
        rx="9"
        ry="4"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.6"
        transform="rotate(-20 10 10)"
      />
    </svg>
  );
}

export default function InstrumentShell({
  language,
  onLanguageChange,
  judgeMode,
  onJudgeModeChange,
  mode,
  onModeChange,
  onSelectLab,
  children,
}: InstrumentShellProps) {
  const [labOpen, setLabOpen] = useState(false);
  const labRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    persistLanguage(language);
  }, [language]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (labRef.current && !labRef.current.contains(e.target as Node)) setLabOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="fx" data-testid="fetscape-app">
      <a className="fx-skip" href="#fx-main" data-testid="skip-link">
        {tSuite('v2.skip', language)}
      </a>
      <header className="fx-bar">
        <a
          className="fx-brand"
          href="#/fetscape"
          data-testid="fetscape-brand"
          onClick={(e) => {
            e.preventDefault();
            onModeChange('ready');
            window.location.hash = '#/fetscape';
          }}
          style={{ color: 'var(--fx-cyan)' }}
        >
          <OrbitGlyph />
          <span style={{ color: 'var(--fx-ink)' }}>Fetscape</span>
        </a>
        <div className="fx-seg" role="tablist" aria-label="Mode">
          <button
            type="button"
            role="tab"
            data-testid="tab-mission"
            aria-selected={mode === 'ready'}
            onClick={() => onModeChange('ready')}
          >
            {tSuite('v2.mode.ready', language)}
          </button>
          <button
            type="button"
            role="tab"
            data-testid="tab-debris"
            aria-selected={mode === 'adr'}
            onClick={() => onModeChange('adr')}
          >
            {tSuite('v2.mode.adr', language)}
          </button>
        </div>
        <nav className="fx-bar__r">
          <div ref={labRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="fx-link"
              aria-haspopup="menu"
              aria-expanded={labOpen}
              onClick={() => setLabOpen((v) => !v)}
            >
              {tSuite('v2.lab', language)}
            </button>
            {labOpen ? (
              <div className="fx-lab-pop" role="menu">
                {LAB_RAIL.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setLabOpen(false);
                      onSelectLab(item.id);
                    }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="fx-link pill"
            data-testid="judge-mode-badge"
            aria-pressed={judgeMode}
            onClick={() => onJudgeModeChange(!judgeMode)}
          >
            {tSuite('v2.judge', language)}
          </button>
          <button
            type="button"
            className="fx-link"
            data-testid="language-toggle"
            onClick={() => onLanguageChange(language === 'en' ? 'zh-TW' : 'en')}
          >
            {language === 'en' ? '中文' : 'English'}
          </button>
        </nav>
      </header>
      <main id="fx-main" tabIndex={-1} className="fx-main">
        {children}
      </main>
      <footer className="fx-foot">
        <p data-testid="safety-disclaimers">{tSuite('v2.safety', language)}</p>
        <a href={siblingProductUrl(language)} rel="noreferrer">
          {tSuite('v2.sibling', language)}
        </a>
      </footer>
    </div>
  );
}
