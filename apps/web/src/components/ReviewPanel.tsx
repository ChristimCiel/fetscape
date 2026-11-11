import { useState } from 'react';
import type { Analysis, Decision, Encounter } from '@orbit/core';
import { api, utc } from '../api';
import { Icon } from './Icon';
export function ReviewPanel({
  run,
  event,
  decisions,
  onSaved,
  onError,
}: {
  run: Analysis;
  event: Encounter;
  decisions: Decision[];
  onSaved: (d: Decision) => void;
  onError: (message: string) => void;
}) {
  const [author, setAuthor] = useState('Local analyst'),
    [note, setNote] = useState(''),
    [action, setAction] = useState<Decision['action']>('review'),
    [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const d = await api<Decision>(`/api/analyses/${run.id}/decisions`, {
        eventId: event.id,
        action,
        author,
        note,
      });
      onSaved(d);
      setNote('');
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const filtered = decisions.filter((d) => d.eventId === event.id);
  return (
    <section className="panel review-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">HUMAN IN THE LOOP</span>
          <h2>Record the next step</h2>
        </div>
        <Icon name="check" />
      </div>
      <form onSubmit={save}>
        <div className="review-fields">
          <label>
            Action
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as Decision['action'])}
            >
              <option value="review">Continue review</option>
              <option value="request_data">Request better data</option>
              <option value="coordinate">Coordinate with operator</option>
            </select>
          </label>
          <label>
            Author label
            <input
              required
              maxLength={80}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </label>
        </div>
        <label>
          Review note
          <textarea
            required
            maxLength={4000}
            rows={3}
            placeholder="What do we know, what is missing, and who should act next?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button className="button primary" disabled={saving || !note.trim() || !author.trim()}>
          {saving ? 'Saving…' : 'Save review record'}
          <Icon name="arrow" size={15} />
        </button>
      </form>
      <p className="fine-print">
        Stored locally. Author labels are self-declared; no message or spacecraft command is sent.
      </p>
      {filtered.length ? (
        <div className="review-log">
          {filtered.map((d) => (
            <article key={d.id}>
              <strong>
                {d.author} · {d.action.replaceAll('_', ' ')}
              </strong>
              <time>{utc(d.createdAt)}</time>
              <p>{d.note}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
