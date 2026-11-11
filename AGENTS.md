# Repository instructions

- Product scope and accepted capability boundaries live in `docs/PRODUCT.md` and `docs/SCIENTIFIC_METHOD.md`.
- Keep this repository independent of the older rehearsal and research demonstrators. No import may depend on a sibling folder or absolute machine path.
- Deterministic orbital math belongs in `packages/orbital-core`; SGP4 runs in the API. Browser runtime imports use the `geometry`, `removal` or synthetic `capture` / `mechanism` subpaths, never the core barrel. Core type-only imports are fine.
- Never infer mass, size, tumble, uncertainty or Pc from GP/TLE. Unknown physical properties stay null. Do not add risk scores or burn instructions.
- Keep `public_elements`, `synthetic`, and `user_import` classifications visible in the UI and exports. Synthetic IDs never become real NORAD identities.
- An empty/failed/partial screen cannot be labelled safe. Log propagation failures and identical-element exclusions. Do not interpolate across failed trajectory samples.
- Reports include source, hash, frame, times, parameters and limitations. Human author labels are not authenticated identities.
- For orbital changes run meaningful analytic and independent reference tests. For flow changes run the API and browser checks that cover the changed boundary. Build before E2E.
- Use Node 24.x, `npm ci`, and the lockfile. Run `npm run format` after edits. Keep databases, credentials, screenshots and virtual environments out of git.
- No cloud dependency, external message delivery, remote deployment or GitHub publishing is required for local development.

## User-authorized capture rehearsal expansion

- Tim explicitly requested integration of the eight supplied Meshy Blender files and a first-person debris-catching experience. Scope includes conversion, pilot controls, synthetic approach/capture/abort, model inspection and rehearsal export.
- Preserve original `.blend` files. Seven unique GLBs represent all eight sources; upper-stage duplicates share a source hash. Sources have no rigs or actions. Authored software bones/pivots may animate actual mesh geometry; do not claim hardware articulation, sensing, contact or capture validation.
- Asset shape and synthetic dimensions are not observations of a selected catalog target. Keep planning context separate from local synthetic state. See `docs/CAPTURE_REHEARSAL.md`.
- Asset changes require `npm run validate:assets`; capture logic requires meaningful state-machine tests. Run capture E2E after flow changes. Lazy-load Three.js and release GPU resources/listeners on exit.

## Current script and mechanism direction

- The user explicitly asked to match the current pitch/script and animate the actual segmented collector and robotic arm. Use the latest Fetscape script preserved in `docs/pitch` and its source hashes. Value hypothesis: one servicing/RPO engineering pilot that tests whether planning mistakes can be exposed before execution.
- Default to segmented collector. Actual `model_part3`/`model_part4` use authored pivots; robotic-arm vertices use authored bones and IK. No placeholder capture rails.
- Keep the public-data geometry, frozen HCW/Kalman fault comparison, and kinematic mechanism concept distinct. The fault replay is not the 3D engine.
- Preserve capture-entry evidence before berthing changes separation. Export commanded joint/anchor geometry as simulation evidence, never force/latch sensing or measured accuracy.
