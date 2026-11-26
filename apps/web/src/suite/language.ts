import type { Language } from '../fetscape/types';

const STORAGE_KEY = 'sx-lang';

export function detectLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('lang');
  if (fromQuery === 'zh-TW' || fromQuery === 'en') return fromQuery;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh-TW' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || 'en').toLowerCase();
  return nav.startsWith('zh') ? 'zh-TW' : 'en';
}

export function persistLanguage(lang: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
}

export function siblingProductUrl(lang: Language): string {
  const base = 'https://subsnotes.tagstory.co';
  return `${base}/?lang=${encodeURIComponent(lang)}`;
}
