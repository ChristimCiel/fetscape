# Local API

Base URL: `http://127.0.0.1:4180`. JSON requests use `Content-Type: application/json`. No authentication is implemented; the server binds to loopback.

| Method     | Endpoint                                                  | Result                                                  |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------- |
| GET        | `/api/health`                                             | Engine version, research mode, live-monitoring status   |
| GET        | `/api/datasets`                                           | Available normalized snapshots with provenance          |
| POST       | `/api/datasets/import`                                    | Validate and save a local GP JSON / TLE snapshot        |
| POST       | `/api/analyses`                                           | Calculate and save an analysis                          |
| GET        | `/api/analyses`                                           | Latest 50 saved-run summaries                           |
| GET        | `/api/analyses/:id`                                       | Complete run, including input snapshot and trajectories |
| GET / POST | `/api/analyses/:id/decisions`                             | Read or append an event review                          |
| GET        | `/api/analyses/:id/report`                                | Text report download                                    |
| GET        | `/api/analyses/:id/export`                                | Full JSON with schema version, analysis and decisions   |
| GET        | `/api/targets?datasetId=…&servicerId=…`                   | Preliminary target comparisons                          |
| GET        | `/api/targets/report?datasetId=…&servicerId=…&targetId=…` | Target brief, exact pair inputs and missing data        |

## Calculate a synthetic encounter

```bash
curl -sS http://127.0.0.1:4180/api/analyses \
  -H 'Content-Type: application/json' \
  -d '{"datasetId":"synthetic-lab","primaryId":"SIM-SERVICER","startUtc":"2026-11-11T11:15:00Z","hours":1,"cadenceSeconds":30,"thresholdKm":10}'
```

The response includes a run `id`, full input `dataset`, parameters, frame/time contracts, all accepted local minima, sampled trajectories, failures, exclusions and limitations. The `thresholdKm` is a user-selected geometric filter. It does not change search coverage or create a risk metric.

Bounds: 1–24 hours, 15–120 s cadence, 0.1–2,000 km filter, window within ±7 days of the primary epoch. These are prototype constraints. Other object epochs may be older; inspect the event offsets. Work is synchronous and bounded, not a queued fleet-scale job.

## Save a review

Replace `RUN_ID` and `EVENT_ID` with values returned by the analysis:

```bash
curl -sS http://127.0.0.1:4180/api/analyses/RUN_ID/decisions \
  -H 'Content-Type: application/json' \
  -d '{"eventId":"EVENT_ID","action":"request_data","author":"Local analyst","note":"Request authoritative ephemeris and covariance before an operational assessment."}'
```

Actions: `review`, `request_data`, `coordinate`. The note and author label are required; labels are not verified identities. The API rejects events that do not belong to the selected run. Nothing is sent to another operator.

## Import

```json
{
  "name": "Operator supplied test snapshot",
  "source": "Local file; source and rights to be verified",
  "format": "omm",
  "data": ["replace with 2–24 GP objects"]
}
```

`data` accepts a JSON array or a JSON-encoded string for `omm`; `tle` takes a text string. Supported GP fields and constants are specified in `packages/orbital-core/src/catalog.ts`. XML, KVN, CSV, CDM, OEM, covariance and observations are not supported by this importer. Additional supplied physical properties are not treated as measurements or inferred facts.

Request bodies are limited to 1 MiB; text import content to 500,000 characters. Invalid request shapes return `400`; malformed/unsupported element data or analysis bounds return `422`; unknown records return `404`; non-loopback browser origins return `403`. Errors are visible in the UI. Unexpected calculation errors return `500` without saving a fabricated result.

There are no command, burn, Pc, external-notification, automatic fetch or dataset-delete endpoints.
