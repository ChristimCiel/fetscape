# Fetscape · Mission Verification

**Plan the approach. Test the escape.**

A local software prototype for mission and GNC engineers to review orbital encounters and early mission constraints using traceable data and deterministic calculations. The pilot hypothesis is that these scenarios can expose planning mistakes before execution.

The current focus is mission verification and human decision support for collision-avoidance analysis and debris-removal mission planning. Image-based sensing, onboard relative navigation and autonomous flight control are not implemented.

## Quick start

Requires **Node.js 24.x** and npm. The API uses Node's built-in `node:sqlite`. Normal application use does not require Python, API keys, a cloud account or an external map service.

```bash
git clone https://github.com/ChristimCiel/fetscape.git
cd fetscape
npm ci
npm run dev
```

Open <http://127.0.0.1:5175>. The development server proxies `/api` to the local API on port `4180`.

To run the production build locally:

```bash
npm run build
npm start
```

Open <http://127.0.0.1:4180>. Records persist in `.local/orbit.sqlite` across restarts. Set `ORBIT_DB_PATH` to change the database location, or use `:memory:` for tests. Set `PORT` to change the API and production-server port. The server binds to loopback only.

The first-person capture rehearsal is at <http://127.0.0.1:4180/#/capture>. See [Capture rehearsal](docs/CAPTURE_REHEARSAL.md) for controls and assumptions.

## Workspaces

| Workspace                  | Available features                                                                                                                                                                                                                              | Capability boundary                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Satellite operations       | Dataset and primary-object selection; UTC window and geometry filters; SGP4 orbital replay; playback, speed and time controls; TCA, miss distance and relative speed; human review, history and reports                                         | Geometry analysis for the selected objects. No collision probability (Pc), avoidance maneuvers or live alerts.                                                   |
| Debris removal lab         | Candidate objects; orbital-plane angles; conceptual circular-orbit transfer and separate plane-change proxies; RIC relative geometry; missing-data checks and target briefs                                                                     | Preliminary comparison. No complete rendezvous, physical capture, detumbling, reentry or multi-target optimization.                                              |
| Capture rehearsal          | First-person and mechanism cameras; manual and guided approach; braking; capture-entry gates; authored joints driving the actual segmented collector and arm meshes; abort and retreat; seven model inspections, exploded views and JSON export | Independent synthetic local motion. Values are simulator truth, without camera-based sensing, contact forces or coupled-body dynamics.                           |
| Degraded-thrust comparison | Frozen seed-7 replay of the independent study, with original and revised model outputs, fault timing and a custom endpoint criterion                                                                                                            | A separate synthetic model. Revised thrust availability is supplied by the simulator; hardware fault diagnosis and general safe withdrawal are not demonstrated. |
| Shared foundation          | GP JSON and TLE import validation; SGP4; UTC and TEME; data classifications, source hashes, SQLite and JSON exports                                                                                                                             | Only the documented format subsets. No observation-based orbit determination or covariance propagation.                                                          |

The interface is in English. Data and rendering assets are served locally, so the demonstration works offline after installation.

Public-data SGP4 analysis, the frozen fault study and the near-field mechanism rehearsal are separate models connected through a review workflow. They do not form a validated, unified GNC system.

## Three-minute walkthrough

1. Open **Public elements · frozen replay** and inspect the acquisition time, provenance and element age. This is a fixed snapshot, not live monitoring.
2. Select **Synthetic orbital laboratory** and click **Run analysis**. `SIM-*` objects are fictional; their trajectories are calculated with SGP4.
3. Select `SIM-CROSSING` from the queue, then play the encounter or jump to TCA. Matching a geometry threshold does not establish collision risk.
4. Save a review note, refresh the page, then export the text report and full JSON.
5. Open **Debris removal lab**, compare targets, inspect unknown properties and export a target brief.
6. Use **Data sources** to import GP JSON or checksum-valid TLE data for 2–24 unique objects. Reopen saved runs in **Analysis history**.

For the pitch demonstration, follow the [90-second demo click sheet](docs/pitch/DEMO_CLICK_SHEET.md): inspect orbital geometry, test degraded thrust, track the grasp point and export the evidence.

## Verification

```bash
npm run check
npm test
npm run validate:reference
npm run validate:assets
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

If Chrome is already installed, use `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`. Browser tests use a separate in-memory database on port `4188`, leaving user records untouched. Build before running E2E tests.

GitHub Actions installs dependencies from a clean checkout and runs software verification, the paired fault-study reproduction, 11 Python research tests and Chromium E2E tests. Python 3.12 and NumPy are used for the independent research reproduction; the application does not need Python to run.

The independent reference contains **18 python-sgp4 states** covering public GP data and Vallado near-Earth and deep-space TLE cases. Fixed inputs and expected results are included. Python is only needed to regenerate the fixture:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install sgp4==2.27
.venv/bin/python scripts/generate-reference.py
npm run validate:reference
```

The current reference comparison has a maximum position difference of about **5.92 m**, primarily in cases where a source GP epoch with microsecond precision is initialized through a JavaScript millisecond date. **This is an implementation difference, not orbital-position error or a guaranteed accuracy.** See [Scientific method and validation boundaries](docs/SCIENTIFIC_METHOD.md).

## Repository structure

```text
apps/web/                 React + Vite workspaces, orbital views and capture rehearsal
apps/api/                 Fastify API, SQLite, frozen datasets and exports
packages/orbital-core/    Formats, propagation, geometry, screening, capture and reporting
data/                    Public snapshot subset, provenance and frozen verification data
research/rpo/            Independent approach/retreat study and Python tests
tests/                   Core, API, reference, asset and end-to-end tests
scripts/                 Reference generation, reproduction and validation tools
docs/                    Product scope, architecture, methods, API, pitch and roadmap
```

## Further reading

Supporting documentation includes English and Traditional Chinese.

- [Product scope and servicing/RPO pilot hypothesis](docs/PRODUCT.md)
- [Fetscape pitch demo click sheet](docs/pitch/DEMO_CLICK_SHEET.md)
- [Architecture and data flow](docs/ARCHITECTURE.md)
- [Scientific methods, required inputs and limitations](docs/SCIENTIFIC_METHOD.md)
- [API examples](docs/API.md)
- [30/90/180-day software roadmap](docs/ROADMAP.md)
- [Validation record](docs/VALIDATION.md)
- [First-person capture, asset provenance and controls](docs/CAPTURE_REHEARSAL.md)
- [Contributing](CONTRIBUTING.md) · [Security and deployment boundaries](SECURITY.md)
- [Public-data sources and terms](data/README.md)

The prototype does not provide authentication, multi-tenancy, background jobs, notification delivery or availability guarantees. No public source-code license has been selected. A `private` package flag does not establish commercial-use or redistribution rights for third-party data or assets.
