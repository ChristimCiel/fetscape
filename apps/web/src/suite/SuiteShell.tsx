/**
 * Suite UI shell — shared nav/footer/coach chrome for Fetscape product + Lab.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Language } from '../fetscape/types';
import { persistLanguage, siblingProductUrl } from './language';
import { tSuite } from './i18n';

export type LabPage = 'operations' | 'removal' | 'capture' | 'datasets' | 'history' | 'methodology';

export type ProductTab = 'mission' | 'debris';

/** Exact accessible names required by capture/pages/workspaces tests. */
export const LAB_RAIL: { id: LabPage; name: string }[] = [
  { id: 'operations', name: 'Satellite operations' },
  { id: 'removal', name: 'Debris removal lab' },
  { id: 'capture', name: 'Capture rehearsal' },
  { id: 'datasets', name: 'Data sources' },
  { id: 'history', name: 'Analysis history' },
  { id: 'methodology', name: 'Scientific basis' },
];

interface SuiteShellProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  judgeMode: boolean;
  onJudgeModeChange: (on: boolean) => void;
  view: 'mission' | 'debris' | 'lab';
  labPage?: LabPage;
  onSelectMission: () => void;
  onSelectDebris: () => void;
  onSelectLab: (page: LabPage) => void;
  children: ReactNode;
  showLabRail?: boolean;
}

export default function SuiteShell({
  language,
  onLanguageChange,
  judgeMode,
  onJudgeModeChange,
  view,
  labPage,
  onSelectMission,
  onSelectDebris,
  onSelectLab,
  children,
  showLabRail = false,
}: SuiteShellProps) {
  const [suiteOpen, setSuiteOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const suiteRef = useRef<HTMLDivElement>(null);
  const labRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    persistLanguage(language);
  }, [language]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (suiteRef.current && !suiteRef.current.contains(t)) setSuiteOpen(false);
      if (labRef.current && !labRef.current.contains(t)) setLabOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function toggleLang() {
    onLanguageChange(language === 'en' ? 'zh-TW' : 'en');
  }

  const tabs = (
    <>
      <button
        type="button"
        data-testid="tab-mission"
        aria-selected={view === 'mission'}
        className={view === 'mission' ? 'active' : ''}
        onClick={onSelectMission}
      >
        {tSuite('nav.mission', language)}
      </button>
      <button
        type="button"
        data-testid="tab-debris"
        aria-selected={view === 'debris'}
        className={view === 'debris' ? 'active' : ''}
        onClick={onSelectDebris}
      >
        {tSuite('nav.debris', language)}
      </button>
      <div className="sx-lab-menu" ref={labRef}>
        <button
          type="button"
          aria-selected={view === 'lab'}
          className={view === 'lab' ? 'active' : ''}
          aria-haspopup="menu"
          aria-expanded={labOpen}
          onClick={() => setLabOpen((v) => !v)}
        >
          {tSuite('nav.lab', language)} ▾
        </button>
        {labOpen ? (
          <div className="sx-lab-menu__panel" role="menu">
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
    </>
  );

  return (
    <div className="sx-shell" data-product="fetscape">
      <header className="sx-nav">
        <a className="skip-link" href="#main" data-testid="skip-link">
          Skip to workspace
        </a>
        <div className="sx-nav__inner">
          <button type="button" className="sx-wordmark" onClick={onSelectMission}>
            <span className="sx-mark" aria-hidden="true" />
            <span data-testid="fetscape-brand">Fetscape</span>
          </button>
          <div className="sx-suite" ref={suiteRef}>
            <button
              type="button"
              className="sx-suite__btn"
              aria-expanded={suiteOpen}
              onClick={() => setSuiteOpen((v) => !v)}
            >
              {tSuite('nav.suite', language)} ▾
            </button>
            {suiteOpen ? (
              <div className="sx-suite__menu" role="menu">
                <a
                  href={siblingProductUrl(language)}
                  target="_blank"
                  rel="noreferrer"
                  role="menuitem"
                >
                  {tSuite('nav.switchSubsNotes', language)}
                </a>
              </div>
            ) : null}
          </div>
          <nav className="sx-tabs" aria-label={tSuite('nav.tabs', language)}>
            {tabs}
          </nav>
          <div className="sx-nav__right">
            <button
              type="button"
              className="sx-judge-pill"
              data-testid="judge-mode-badge"
              aria-pressed={judgeMode}
              onClick={() => onJudgeModeChange(!judgeMode)}
            >
              {tSuite('nav.judge', language)}
            </button>
            <button
              type="button"
              className="sx-lang"
              data-testid="language-toggle"
              onClick={toggleLang}
            >
              {language === 'en' ? '中文' : 'English'}
            </button>
          </div>
        </div>
      </header>
      <div className="sx-tabs--row" role="tablist" aria-label={tSuite('nav.tabs', language)}>
        {tabs}
      </div>

      <div className="sx-shell__main">
        <div className={`sx-shell__body ${showLabRail ? '' : ''}`}>
          {showLabRail ? (
            <nav className="sx-rail" aria-label="Lab">
              <span className="sx-rail__label">{tSuite('nav.lab', language)}</span>
              {LAB_RAIL.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={labPage === item.id ? 'page' : undefined}
                  onClick={() => onSelectLab(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </nav>
          ) : null}
          <div className="sx-shell__content" id="main" tabIndex={-1}>
            {children}
          </div>
        </div>
      </div>

      <footer className="sx-footer">
        Fetscape · {tSuite('footer.decisionSupport', language)} ·{' '}
        <a href={siblingProductUrl(language)} target="_blank" rel="noreferrer">
          SubsNotes
        </a>{' '}
        ·{' '}
        <a href="https://github.com/ChristimCiel/fetscape" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}
