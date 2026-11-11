import { PUBLIC_DEMO } from './deployment';

export async function api<T>(path: string, body?: unknown): Promise<T> {
  if (PUBLIC_DEMO) return (await import('./demo/public-api')).publicApi<T>(path, body);
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error([data.error, ...(data.details ?? [])].join(' · '));
  return data as T;
}
export const utc = (value: string | number) =>
  new Date(value)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');
export const number = (value: number, digits = 1) =>
  value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
