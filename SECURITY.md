# Local research boundary

This build binds to loopback and stores data on the local machine. It has no login, verified identity, tenant isolation, encryption-at-rest service or tamper-evident audit system. Those capabilities are prerequisites for a shared customer pilot, not features of this build.

The API uses prepared SQLite statements, bounded request bodies, bounded object counts/time windows, format validation and a loopback-origin check. There is no server-side arbitrary URL fetch endpoint and no credentials are required. Those controls do not establish production security.

Do not place credentials, restricted Space-Track material, customer CDMs, operator ephemerides or non-public mission data in the tracked fixtures. `.local`, `.env*`, SQLite files, test output and virtual environments are ignored.

Before a hosted pilot: authenticated users and authorization, data entitlements and retention, tenant isolation, API quotas, asynchronous bounded jobs, observability, backups and restore, dependency review and a defined vulnerability-reporting route are required. The production architecture is described in `docs/ARCHITECTURE.md`; it has not been deployed or tested here.
