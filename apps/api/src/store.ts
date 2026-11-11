import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Analysis, Dataset, Decision } from '@orbit/core';

/** Single-user local storage. Prepared statements; no cloud database or tenant isolation claim. */
export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS datasets(id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS analyses(id TEXT PRIMARY KEY, created_at TEXT NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS decisions(id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL REFERENCES analyses(id), created_at TEXT NOT NULL, body TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS decisions_analysis ON decisions(analysis_id);
      INSERT OR IGNORE INTO schema_migrations(version) VALUES(1);`);
  }
  seed(dataset: Dataset) {
    this.db
      .prepare('INSERT OR IGNORE INTO datasets VALUES(?,?)')
      .run(dataset.id, JSON.stringify(dataset));
  }
  datasets(): Dataset[] {
    return this.db
      .prepare('SELECT body FROM datasets ORDER BY id')
      .all()
      .map((row) => JSON.parse(row.body as string));
  }
  dataset(id: string): Dataset | undefined {
    const row = this.db.prepare('SELECT body FROM datasets WHERE id=?').get(id);
    return row ? JSON.parse(row.body as string) : undefined;
  }
  saveAnalysis(run: Analysis) {
    this.db
      .prepare('INSERT INTO analyses VALUES(?,?,?)')
      .run(run.id, run.createdAt, JSON.stringify(run));
  }
  analysis(id: string): Analysis | undefined {
    const row = this.db.prepare('SELECT body FROM analyses WHERE id=?').get(id);
    return row ? JSON.parse(row.body as string) : undefined;
  }
  history() {
    return this.db
      .prepare('SELECT body FROM analyses ORDER BY created_at DESC LIMIT 50')
      .all()
      .map((row) => {
        const r = JSON.parse(row.body as string) as Analysis;
        return {
          id: r.id,
          createdAt: r.createdAt,
          datasetName: r.dataset.name,
          kind: r.dataset.kind,
          parameters: r.parameters,
          eventCount: r.events.length,
          status: r.coverage.status,
        };
      });
  }
  saveDecision(d: Decision) {
    this.db
      .prepare('INSERT INTO decisions VALUES(?,?,?,?)')
      .run(d.id, d.analysisId, d.createdAt, JSON.stringify(d));
  }
  decisions(id: string): Decision[] {
    return this.db
      .prepare('SELECT body FROM decisions WHERE analysis_id=? ORDER BY created_at DESC')
      .all(id)
      .map((row) => JSON.parse(row.body as string));
  }
  close() {
    this.db.close();
  }
}
