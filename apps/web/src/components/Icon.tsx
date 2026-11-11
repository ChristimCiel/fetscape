const paths: Record<string, string> = {
  camera: 'M3 7h12v12H3z M15 10l6-3v12l-6-3 M7 3h4v4',
  orbit: 'M20 12a8 8 0 1 1-8-8 M4 19 19 4 M15 4h4v4',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  target:
    'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  layers: 'm3 7 9-4 9 4-9 4z M3 12l9 4 9-4 M3 17l9 4 9-4',
  clock: 'M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  book: 'M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4z M12 5v15',
  download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  arrow: 'M5 12h14 m-5-5 5 5-5 5',
  play: 'm8 4 12 8-12 8z',
  pause: 'M8 4v16 M16 4v16',
  check: 'm5 12 4 4L19 6',
  info: 'M12 10v7 M12 6v1 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M6 6a8 8 0 0 1 14 6 M18 18a8 8 0 0 1-14-6',
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] ?? paths.info} />
    </svg>
  );
}
