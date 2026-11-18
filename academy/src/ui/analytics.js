/**
 * Phase 14 — first-party analytics on the device side (D-119). Only when the backend is configured AND the person is
 * signed in; signed out nothing is sent. Events are an allow-listed name and one cleaned dimension (no user id, no free
 * text except a cleaned search term); the server repeats the cleaning and counts per day.
 * Events come from record changes (eventsFromChange) so views do not need analytics code.
 */
import { cleanEvent, band } from '../domain/production.mjs';

const newIds = (before = [], after = []) => { const had = new Set((before || []).map(x => x?.id)); return (after || []).filter(x => x && !had.has(x.id)); };

/** Record change → events. Pure (tested). */
export function eventsFromChange(collection, before = [], after = []) {
  const out = [];
  const added = newIds(before, after);
  if (collection === 'course_progress') {
    const prev = new Map((before || []).map(x => [x.id, x]));
    for (const r of after || []) {
      const p = prev.get(r.id);
      if (!p) out.push({ name: 'course_start', dim: r.course_id || r.id });
      const done = x => x && (x.status === 'completed' || x.completed_at);
      if (done(r) && !done(p)) out.push({ name: 'course_complete', dim: r.course_id || r.id });
    }
  }
  if (collection === 'assessment_attempts') for (const a of added) {
    out.push({ name: 'assessment_submit', dim: a.assessment_id || '' });
    for (const [c, v] of Object.entries(a.competency_breakdown || a.by_competency || {}).slice(0, 10)) {
      const pct = typeof v === 'number' ? v : v?.percent;
      if (Number.isFinite(pct)) out.push({ name: 'assessment_outcome', dim: `${c}:${band(pct)}` });
    }
  }
  if (collection === 'lab_attempts') for (const a of added) out.push({ name: 'lab_attempt', dim: a.lab_id || '' });
  if (collection === 'interview_sessions') for (const _ of added) out.push({ name: 'coach_use', dim: 'interview' });
  return out.map(e => cleanEvent(e.name, e.dim) && { name: e.name, dim: e.dim }).filter(Boolean);
}

export class AnalyticsQueue {
  constructor({ api, enabled = () => true, max = 20, everyMs = 15_000 }) {
    Object.assign(this, { api, enabled, max }); this.items = []; this.timer = null; this.everyMs = everyMs;
  }
  push(events = []) {
    if (!this.enabled()) return;
    for (const e of events) { const c = cleanEvent(e?.name, e?.dim); if (c) this.items.push({ name: c.event, dim: c.dim }); }
    if (this.items.length >= this.max) this.flush(); else if (!this.timer && this.items.length) this.timer = setTimeout(() => this.flush(), this.everyMs);
  }
  flush() {
    clearTimeout(this.timer); this.timer = null;
    if (!this.items.length || !this.enabled()) { this.items = []; return; }
    const batch = this.items.splice(0, this.max);
    this.api.post('/events', { events: batch }).catch(() => { /* analytics are best effort and never retried */ });
  }
}
