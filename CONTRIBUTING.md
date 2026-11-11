# Development

Use Node 24.x and `npm ci`. Run `npm run dev` for the API and web app. The API binds to `127.0.0.1`; do not expose this single-user prototype as a public service.

Before a review:

```bash
npm run format
npm run check
npm test
npm run validate:reference
npm run validate:assets
npm run build
npm run test:e2e
```

Install a Playwright browser once, or set `PLAYWRIGHT_CHANNEL=chrome` locally. E2E uses `4188` and an isolated in-memory database.

Scientific changes should identify the input format and units, frame/time conventions, model assumptions, independent comparison and changed limits. A matching implementation is not a matching physical orbit. Do not weaken numerical tolerances to make a test pass without explaining the discrepancy.

UI changes should preserve data provenance, unknown values, error/empty/partial states, labelled controls, keyboard access, responsive layouts and readable exported records. Use native CSS/SVG assets; no external font, map or media dependency is needed.

Add dependencies only for a concrete capability. Keep exact runtime versions and a reviewed lockfile. Future integrations must define data rights, authentication, time/frame contracts and failure behavior before handling operator data.

For capture/model changes, also follow `docs/CAPTURE_REHEARSAL.md`. Preserve source Blender files and inspect every converted asset. Do not promote synthetic simulator values to measured navigation or contact performance.
