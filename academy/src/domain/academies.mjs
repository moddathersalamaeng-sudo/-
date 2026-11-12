/**
 * Phase 10A — one model of "the four academies" and of the learner's space, shared by navigation, home,
 * onboarding, My space, the data-split loader and the build script. Pure functions, no DOM, no storage.
 * © 2026 Modather Salama — Continual Improvement Academy.
 */

/** The four academies, in display order. `prefix` keeps each landing's historic section ids stable. */
export const ACADEMIES = [
  { key: 'iso', route: '/academy/iso', family: 'iso', icon: 'shield', ready: 'ASM-READY-ISO-001', prefix: 'iso', navId: 'isoAcademy' },
  { key: 'pmi', route: '/academy/pmi', family: 'pmi', icon: 'briefcase', ready: 'ASM-READY-PM-001', prefix: 'pm', navId: 'pmiAcademy' },
  { key: 'quality', route: '/academy/quality', family: 'quality', icon: 'award', ready: 'ASM-READY-Q-001', prefix: 'q', navId: 'qualityAcademy' },
  { key: 'excellence', route: '/academy/excellence', family: 'excellence', icon: 'star', ready: 'ASM-READY-EX-001', prefix: 'ex', navId: 'excellenceAcademy' }
];
export const ACADEMY_KEYS = ACADEMIES.map(a => a.key);
export const academyByKey = key => ACADEMIES.find(a => a.key === key) || null;

/** Storage shard of a course (data split): decided by the course's category. Unknown categories fall back to ISO. */
const CATEGORY_ACADEMY = { iso: 'iso', quality: 'quality', efqm: 'excellence', project_management: 'pmi', pmo: 'pmi', p3o: 'pmi' };
export function academyOfCourse(c) {
  if (!c) return null;
  return CATEGORY_ACADEMY[c.category] || (c.ecosystem === 'efqm' ? 'excellence' : ['pmi', 'pmo', 'p3o'].includes(c.ecosystem) ? 'pmi' : c.ecosystem === 'quality' ? 'quality' : 'iso');
}

/** Academy of an assessment: its course's academy, else its id family; the general diagnostic is 'general'. */
export function academyOfAssessment(a, courseById = () => null) {
  const c = a?.course_id ? courseById(a.course_id) : null;
  if (c) return academyOfCourse(c);
  const id = String(a?.id || '');
  if (/^ASM-(READY-)?ISO/.test(id)) return 'iso';
  if (/^ASM-(READY-)?PM/.test(id)) return 'pmi';
  if (/^ASM-(READY-)?Q-|^ASM-CMQOE|^ASM-READY-Q/.test(id)) return 'quality';
  if (/^ASM-(READY-)?EX/.test(id)) return 'excellence';
  return 'general';
}

/** Diagnostics and readiness checks are the starting points; quizzes live inside their course. */
export const ASSESSMENT_TYPE = a => (['diagnostic', 'readiness'].includes(a?.kind) ? 'diagnostic' : a?.kind === 'knowledge_quiz' || a?.kind === 'scenario' ? 'quiz' : 'course');

/* ------------------------------------------------------------------ goals and onboarding */

export const GOALS = ['standard', 'certification', 'improve', 'team'];
const PM_ROLES = ['ROLE-PM', 'ROLE-PMOA'];
const QUALITY_ROLES = ['ROLE-QE', 'ROLE-QMGR', 'ROLE-CIS'];

/** Which academy a goal opens, refined by the role the learner is aiming at. Deterministic and explained by the UI. */
export function goalAcademy(goal, targetRole = '') {
  if (goal === 'standard') return 'iso';
  if (goal === 'certification') {
    if (PM_ROLES.includes(targetRole)) return 'pmi';
    if (targetRole === 'ROLE-OEL') return 'excellence';
    if (QUALITY_ROLES.includes(targetRole)) return 'quality';
    return 'pmi';
  }
  if (goal === 'improve') return targetRole === 'ROLE-CIS' || targetRole === 'ROLE-QE' ? 'quality' : 'excellence';
  if (goal === 'team') {
    if (PM_ROLES.includes(targetRole)) return 'pmi';
    if (QUALITY_ROLES.includes(targetRole)) return 'quality';
    if (targetRole === 'ROLE-OEL') return 'excellence';
    return 'iso';
  }
  return 'iso';
}

/** Validation of the three onboarding answers. Returns { field: messageKey } (empty = valid). */
export function validateOnboarding(input = {}, roleIds = []) {
  const e = {};
  const role = String(input.current_role || '').trim();
  if (!role) e.current_role = 'required'; else if (role.length < 2) e.current_role = 'short'; else if (role.length > 120) e.current_role = 'long';
  if (!input.target_role) e.target_role = 'required'; else if (roleIds.length && !roleIds.includes(input.target_role)) e.target_role = 'role';
  if (!GOALS.includes(input.goal)) e.goal = 'required';
  const wh = String(input.weekly_hours ?? '').trim();
  if (wh === '') e.weekly_hours = 'required';
  else if (!/^\d{1,2}$/.test(wh) || Number(wh) < 1 || Number(wh) > 40) e.weekly_hours = 'range';
  return e;
}

/** The onboarding answers merged into the learner's profile (existing answers are kept; nothing is invented). */
export function onboardingProfile(existing, input, base, now = new Date().toISOString()) {
  const p = { ...(base || {}), ...(existing || {}) };
  p.experience = { ...(base?.experience || {}), ...(existing?.experience || {}) };
  return { ...p, id: 'me', current_role: String(input.current_role).trim(), target_role: input.target_role, goal: input.goal,
    weekly_hours: String(Number(input.weekly_hours)), onboarded_at: existing?.onboarded_at || now, updated: now };
}

/* ------------------------------------------------------------------ progress, cards and the dashboard */

export const lessonsOf = c => (c?.modules || []).flatMap(m => m.lessons || []);
export const lessonMinutes = l => Number(l?.estimated_minutes) || 0;
export const courseMinutes = c => lessonsOf(c).reduce((a, l) => a + lessonMinutes(l), 0);

/** "3 of 4 lessons · 25 min left": lesson counts and the reading time of the lessons not yet done. */
export function cardProgress(c, progress = []) {
  const ls = lessonsOf(c);
  const saved = progress.find(p => p.id === c?.id);
  const doneSet = new Set(saved?.completed_lessons || []);
  const done = ls.filter(l => doneSet.has(l.id)).length;
  const left = ls.filter(l => !doneSet.has(l.id)).reduce((a, l) => a + lessonMinutes(l), 0);
  const next = ls.find(l => !doneSet.has(l.id)) || null;
  return { done, total: ls.length, minutesLeft: left, minutesTotal: courseMinutes(c), next, started: done > 0, updated_at: saved?.updated_at || null };
}

/** Courses the learner has started and not finished, most recently studied first, each with its next lesson. */
export function continueList(courses = [], progress = []) {
  return courses.map(c => ({ c, p: cardProgress(c, progress) }))
    .filter(x => x.p.started && x.p.done < x.p.total)
    .sort((a, b) => String(b.p.updated_at || '').localeCompare(String(a.p.updated_at || '')));
}

/** Numbers for My space → Progress: started, finished (all lessons read), lessons read, minutes of reading done. */
export function dashboardSummary(courses = [], progress = [], attempts = [], bookmarks = []) {
  let started = 0, finished = 0, lessons = 0, minutes = 0;
  for (const c of courses) {
    const p = cardProgress(c, progress);
    if (p.started) started++;
    if (p.total && p.done === p.total) finished++;
    lessons += p.done; minutes += p.minutesTotal - p.minutesLeft;
  }
  const passed = new Set(attempts.filter(a => a.passed).map(a => a.assessment_id)).size;
  return { started, finished, inProgress: started - finished, lessons, minutes, attempts: attempts.length, passed, bookmarks: bookmarks.length };
}

/* ------------------------------------------------------------------ bookmarks */

export const BOOKMARK_TYPES = ['course', 'lesson', 'guide', 'guide_item', 'certification', 'template', 'article', 'lab'];
export const bookmarkId = (type, id) => `${type}:${id}`;
export function makeBookmark({ type, id, href, title }, now = new Date().toISOString()) {
  if (!BOOKMARK_TYPES.includes(type)) throw new Error('Unknown bookmark type: ' + type);
  if (typeof id !== 'string' || !id) throw new Error('Bookmark needs an id');
  if (typeof href !== 'string' || !href.startsWith('#/')) throw new Error('Bookmark needs an Academy link');
  return { id: bookmarkId(type, id), type, target_id: id, href, title: { ar: String(title?.ar || title?.en || ''), en: String(title?.en || title?.ar || '') }, saved_at: now };
}

/* ------------------------------------------------------------------ weekly study plan and calendar export */

export const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * Turn the next unread lessons of the chosen courses into weekly study sessions.
 * days: weekday codes (e.g. ['SU','TU','TH']); time: 'HH:MM'; weeklyHours 1–40; start: Date (plan starts on the first
 * chosen weekday on or after it). Lessons are never split; a session holds at least one lesson. Capped at `maxWeeks`.
 */
export function weeklyPlan({ courses = [], progress = [], weeklyHours = 4, days = ['SU', 'TU', 'TH'], time = '19:00', start = new Date(), maxWeeks = 12 } = {}) {
  const wd = [...new Set(days)].filter(d => WEEKDAYS.includes(d)).sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
  if (!wd.length) return { sessions: [], sessionMinutes: 0, weeks: 0, unplanned: 0 };
  const hours = Math.max(1, Math.min(40, Number(weeklyHours) || 4));
  const sessionMinutes = Math.max(15, Math.round(hours * 60 / wd.length));
  const queue = [];
  for (const c of courses) {
    const done = new Set(progress.find(p => p.id === c.id)?.completed_lessons || []);
    for (const l of lessonsOf(c)) if (!done.has(l.id)) queue.push({ course: c, lesson: l, minutes: Math.max(5, lessonMinutes(l) || 15) });
  }
  const [hh, mm] = /^\d{2}:\d{2}$/.test(time) ? time.split(':').map(Number) : [19, 0];
  const first = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const sessions = [];
  let qi = 0;
  for (let dayOffset = 0; qi < queue.length && dayOffset < maxWeeks * 7; dayOffset++) {
    const d = new Date(first.getTime() + dayOffset * 86400000);
    if (!wd.includes(WEEKDAYS[d.getUTCDay()])) continue;
    const items = []; let used = 0;
    while (qi < queue.length && (items.length === 0 || used + queue[qi].minutes <= sessionMinutes)) { items.push(queue[qi]); used += queue[qi].minutes; qi++; }
    sessions.push({ date: d.toISOString().slice(0, 10), time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, minutes: Math.max(used, 15), items });
  }
  const weeks = sessions.length ? Math.ceil((Date.parse(sessions.at(-1).date) - Date.parse(sessions[0].date)) / (7 * 86400000)) + 1 : 0;
  return { sessions, sessionMinutes, weeks, unplanned: queue.length - qi };
}

const icsEscape = s => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
/** Fold a content line to 75 octets (RFC 5545 §3.1), never splitting a UTF-8 character. */
export function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = '', size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; size = 0; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const local = (date, time, addMin = 0) => {
  const [y, m, d] = date.split('-').map(Number); const [hh, mm] = time.split(':').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm) + addMin * 60000);
  return t.toISOString().slice(0, 16).replace(/[-:]/g, '') + '00';
};

/**
 * iCalendar (.ics) for a plan. Times are "floating" (no time zone), so each calendar shows them at the chosen local
 * time. `lang` picks the event titles; lesson names go in the description with an Academy link.
 */
export function planToIcs(plan, { lang = 'ar', title = { ar: 'جلسة دراسة — أكاديمية التحسين المستمر', en: 'Study session — Continual Improvement Academy' }, baseUrl = '', now = new Date(), uidSeed = 'local' } = {}) {
  const L = v => (typeof v === 'string' ? v : v?.[lang] || v?.en || v?.ar || '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Continual Improvement Academy//Study plan//' + (lang === 'ar' ? 'AR' : 'EN'), 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  plan.sessions.forEach((s, i) => {
    const desc = s.items.map(x => `• ${L(x.course.title)} — ${L(x.lesson.title)}`).join('\n') + (baseUrl ? `\n${baseUrl}` : '');
    lines.push('BEGIN:VEVENT', `UID:cia-${uidSeed}-${s.date}-${i}@academy`, `DTSTAMP:${stamp(now)}`, `DTSTART:${local(s.date, s.time)}`, `DTEND:${local(s.date, s.time, s.minutes)}`,
      `SUMMARY:${icsEscape(L(title))}`, `DESCRIPTION:${icsEscape(desc)}`, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
