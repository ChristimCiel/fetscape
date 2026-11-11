export const PUBLIC_DEMO = import.meta.env.MODE === 'pages';

export const assetUrl = (path: string) => import.meta.env.BASE_URL + path.replace(/^\/+/, '');

export function downloadUrl(path: string): string {
  if (!PUBLIC_DEMO) return path;
  const url = new URL(path, 'https://demo.invalid');
  const analysis = /^\/api\/analyses\/([^/]+)\/(report|export)$/.exec(url.pathname);
  if (analysis)
    return assetUrl(
      `demo/reports/${encodeURIComponent(analysis[1])}.${analysis[2] === 'report' ? 'txt' : 'json'}`,
    );
  if (url.pathname === '/api/targets/report') {
    const ids = ['datasetId', 'servicerId', 'targetId'].map((key) => {
      const value = url.searchParams.get(key);
      if (!value) throw new Error('Target brief is missing an object or dataset identifier.');
      return encodeURIComponent(value);
    });
    return assetUrl(`demo/targets/${ids.join('--')}.txt`);
  }
  throw new Error('This download is unavailable in the public demo.');
}
