/**
 * Excellence (EFQM-informed) Academy logic (Phase 10): an explained starting point, role → route defaults, and the EFQM
 * Assessment Lab data model (evidence, findings, RADAR-style self-ratings, analysis, prioritised plan, export / import).
 * Pure functions, no DOM. Assessment results are not professional competence, years of experience are never evidence, and the
 * Lab's self-ratings are an internal self-assessment aid — never an EFQM assessment, score, star, diamond or recognition.
 */
import { MASTERY_THRESHOLD, WEAK_THRESHOLD } from './learner-model.mjs';

export const EX_ROUTES = ['ROUTE-EX-FOUND', 'ROUTE-EX-SA', 'ROUTE-EX-AWARD', 'ROUTE-EX-PLAN'];
export const EX_ROLE_ROUTE = { 'ROLE-OEL': 'ROUTE-EX-SA' };
export const EX_FOUNDATION = ['OE-01', 'OE-02'];
export const LAB_SCHEMA = 'cia.efqm-lab.v1';
export const LAB_LABEL = { en: 'Self-assessment aid — not an EFQM assessment', ar: 'أداة مساعدة للتقييم الذاتي — وليست تقييمًا من EFQM' };

const T = (en, ar) => ({ en, ar });
const pct = (ev, c) => (Number.isFinite(ev?.[c]?.percent) ? ev[c].percent : null);
const text = p => `${p?.interests || ''} ${p?.career_objectives || ''} ${p?.target_certifications || ''}`.toLowerCase();

/** What the learner is aiming at in excellence, from the profile's own words and target role (Arabic and English). */
export function excellenceIntent(profile) {
  const s = text(profile);
  if (/award|kaqa|king abdulaziz|recognition|recognised|جائزة|الجائزة|اعتراف/.test(s)) return 'award';
  if (profile?.target_role === 'ROLE-OEL' || /self-?assessment|assessor|facilitat|تقييم ذاتي|التقييم الذاتي|مقيّم|مقيم/.test(s)) return 'selfassess';
  if (/improvement plan|prioriti|roadmap|خطة تحسين|خطة التحسين|أولويات|تحسين/.test(s)) return 'plan';
  return null;
}

const ROUTE_OF = { selfassess: 'ROUTE-EX-SA', award: 'ROUTE-EX-AWARD', plan: 'ROUTE-EX-PLAN' };
const NEXT = {
  selfassess: { key: 'selfassess', target_id: 'CRS-EX-SA', href: '#/academy/courses/self-assessment-facilitation', title: T('Lead a self-assessment', 'قُد تقييمًا ذاتيًا'),
    reason: T('Your aim is to lead self-assessment and your excellence foundations are demonstrated, so the route continues with facilitation — practised in the EFQM Assessment Lab.', 'هدفك قيادة التقييم الذاتي وأساسيات التميز لديك مثبتة، لذا يستمر المسار بالتيسير — مع التطبيق في مختبر تقييم EFQM.') },
  award: { key: 'award', target_id: 'CRS-EX-AWARD', href: '#/learning-path?route=ROUTE-EX-AWARD', title: T('Prepare for recognition with evidence', 'استعد للاعتراف بالأدلة'),
    reason: T('Your aim is an award or recognition and your foundations are demonstrated. The route checks readiness honestly before the submission document and the site visit.', 'هدفك جائزة أو اعتراف وأساسياتك مثبتة. ويفحص المسار الجاهزية بصدق قبل وثيقة المشاركة والزيارة الميدانية.') },
  plan: { key: 'plan', target_id: 'CRS-EX-PLAN', href: '#/academy/courses/improvement-planning', title: T('Turn findings into a few owned priorities', 'حوّل الملاحظات إلى أولويات قليلة مملوكة'),
    reason: T('Your aim is improvement planning and your foundations are demonstrated, so the route starts with clustering and prioritisation.', 'هدفك تخطيط التحسين وأساسياتك مثبتة، لذا يبدأ المسار بالتجميع وترتيب الأولويات.') }
};

/**
 * @param {{profile?:object|null, evidence?:object, completed?:string[], labCriteriaWithEvidence?:number}} input
 * @returns {{key, route_id, target_id, href, title, reason, factors[]}}
 */
export function excellenceStartingPoint({ profile = null, evidence = {}, completed = [], labCriteriaWithEvidence = 0 } = {}) {
  const done = id => completed.includes(id);
  const found = EX_FOUNDATION.map(c => pct(evidence, c)).filter(v => v !== null);
  const foundationDemonstrated = done('CRS-EFQM-101') || (found.length === EX_FOUNDATION.length && Math.min(...found) >= MASTERY_THRESHOLD);
  const intent = excellenceIntent(profile);
  const factors = [];
  if (found.length) factors.push({ code: 'ex_evidence', value: Math.min(...found) });
  if (done('CRS-EFQM-101')) factors.push({ code: 'foundation_completed' });
  if (profile?.target_role) factors.push({ code: 'target_role', value: profile.target_role });
  if (intent) factors.push({ code: 'intent', value: intent });
  if (labCriteriaWithEvidence > 0) factors.push({ code: 'lab_started', value: labCriteriaWithEvidence });

  if (!profile) return { key: 'explore', route_id: 'ROUTE-EX-FOUND', target_id: 'KA-019', href: '#/knowledge/efqm/excellence-quality', factors,
    title: T('Start with what excellence means', 'ابدأ بمعنى التميز'),
    reason: T('Read how excellence differs from quality and compliance, then create your profile so the Academy can suggest a route.', 'اقرأ الفرق بين التميز والجودة والامتثال، ثم أنشئ ملفك المهني لتقترح الأكاديمية مسارًا.') };

  if (!found.length && !done('CRS-EFQM-101')) return { key: 'assess', route_id: EX_ROLE_ROUTE[profile.target_role] || ROUTE_OF[intent] || 'ROUTE-EX-FOUND', target_id: 'ASM-READY-EX-001', href: '#/assessments/excellence-readiness', factors,
    title: T('Assess what you already know', 'قيّم ما تعرفه بالفعل'),
    reason: T('There is no assessment evidence yet. A 20-minute diagnostic avoids repeating foundations you can already demonstrate. Years of experience alone are not used as evidence.', 'لا توجد أدلة تقييم بعد. يساعد تقييم تشخيصي مدته 20 دقيقة على تجنب تكرار أساسيات تستطيع إثباتها. ولا تُستخدم سنوات الخبرة وحدها دليلًا.') };

  if (!foundationDemonstrated) {
    const weak = found.some(v => v < WEAK_THRESHOLD);
    return { key: 'foundation', route_id: 'ROUTE-EX-FOUND', target_id: 'CRS-EFQM-101', href: '#/academy/courses/excellence-foundations', factors,
      title: T('Build the excellence foundation first', 'ابنِ أساس التميز أولًا'),
      reason: weak
        ? T('Your latest diagnostic shows gaps in evidence-based self-assessment or prioritisation (OE-01, OE-02). Foundations come before specialist routes.', 'يُظهر آخر تقييم فجوات في التقييم الذاتي القائم على الأدلة أو ترتيب الأولويات (OE-01 وOE-02). تأتي الأساسيات قبل المسارات التخصصية.')
        : T('Your evidence is close but below the 70% mastery mark, or one of the two areas was not assessed.', 'أدلتك قريبة لكنها دون عتبة الإتقان 70%، أو أن أحد المجالين لم يُقيَّم.') };
  }
  if (NEXT[intent]) return { ...NEXT[intent], route_id: ROUTE_OF[intent], factors };
  return { key: 'lab', route_id: 'ROUTE-EX-FOUND', target_id: 'CRS-EX-RADAR', href: '#/academy/excellence/lab', factors,
    title: labCriteriaWithEvidence ? T('Continue your self-assessment in the Lab', 'تابع تقييمك الذاتي في المختبر') : T('Apply what you know in the EFQM Assessment Lab', 'طبّق ما تعرفه في مختبر تقييم EFQM'),
    reason: T('Your foundations are demonstrated. Record real evidence for your organisation in the Lab; the foundations route continues with RADAR and evidence, skipping what you have shown. Add a target role or aim to your profile for a specialist route.',
      'أساسياتك مثبتة. سجّل أدلة حقيقية لمنظمتك في المختبر؛ ويستمر مسار الأساسيات بمنطق RADAR والأدلة متجاوزًا ما أثبتّه. وأضف دورًا أو هدفًا إلى ملفك لمسار تخصصي.') };
}

/* ------------------------------------------------------------------ EFQM Assessment Lab: data model */

const clean = (v, max = 400) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const uid = () => Math.random().toString(36).slice(2, 10);
export const RATING_VALUES = [0, 25, 50, 75, 100];

/** A new, empty Lab record (stored as the learner's own cia:v1:* record). */
export function newLab(now = new Date().toISOString()) {
  return { id: 'current', schema: LAB_SCHEMA, org: { name: '', scope: '', date: '' }, criteria: {}, plan: {}, created_at: now, updated_at: now };
}
const crit = (lab, id) => lab.criteria[id] || (lab.criteria[id] = { evidence: [], strengths: [], afis: [], ratings: {} });

/** Validate an evidence entry; returns error codes (empty = valid). */
export function validateEvidence(e, today = new Date().toISOString().slice(0, 10)) {
  const out = [];
  if (!clean(e?.title) || !clean(e?.source)) out.push('required');
  if (e?.link && !/^https?:\/\/[^\s]+$/i.test(String(e.link).trim())) out.push('link');
  if (e?.date && (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || Number.isNaN(Date.parse(e.date)) || e.date > today)) out.push('date');
  return out;
}

export function addEvidence(lab, criterionId, e, today) {
  const errors = validateEvidence(e, today);
  if (errors.length) return { lab, errors };
  crit(lab, criterionId).evidence.push({ id: 'ev-' + uid(), title: clean(e.title, 200), source: clean(e.source, 200), date: e.date || '', owner: clean(e.owner, 120), link: e.link ? String(e.link).trim().slice(0, 500) : '' });
  return { lab: touch(lab), errors: [] };
}

/** kind: 'strengths' | 'afis'. Findings need at least 10 characters. */
export function addFinding(lab, criterionId, kind, txt) {
  const s = clean(txt, 1000);
  if (!['strengths', 'afis'].includes(kind) || s.length < 10) return { lab, errors: ['required'] };
  const f = { id: (kind === 'afis' ? 'afi-' : 'str-') + uid(), text: s };
  crit(lab, criterionId)[kind].push(f);
  if (kind === 'afis') lab.plan[f.id] = { impact: null, ease: null, action: '', owner: '', due: '', status: 'open' };
  return { lab: touch(lab), errors: [] };
}

export function removeItem(lab, criterionId, kind, id) {
  const c = lab.criteria[criterionId];
  if (c && Array.isArray(c[kind])) c[kind] = c[kind].filter(x => x.id !== id);
  if (kind === 'afis') delete lab.plan[id];
  return touch(lab);
}

/** Self-rating of one element (0, 25, 50, 75, 100) or null to clear. */
export function setRating(lab, criterionId, element, value) {
  const c = crit(lab, criterionId);
  if (value === null || value === '' || value === undefined) delete c.ratings[element];
  else if (RATING_VALUES.includes(Number(value))) c.ratings[element] = Number(value);
  return touch(lab);
}

/** Impact or ease: whole numbers 1–5 (null clears). Returns {lab, error}. */
export function setPlanField(lab, afiId, field, value) {
  const p = lab.plan[afiId];
  if (!p) return { lab, error: 'unknown' };
  if (field === 'impact' || field === 'ease') {
    if (value === '' || value === null) { p[field] = null; return { lab: touch(lab), error: null }; }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 5) return { lab, error: 'score' };
    p[field] = n;
  } else if (field === 'status') { if (!['open', 'doing', 'done'].includes(value)) return { lab, error: 'status' }; p.status = value; }
  else if (field === 'due') { if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { lab, error: 'date' }; p.due = value || ''; }
  else if (field === 'action' || field === 'owner') p[field] = clean(value, field === 'action' ? 500 : 120);
  else return { lab, error: 'field' };
  return { lab: touch(lab), error: null };
}

function touch(lab) { lab.updated_at = new Date().toISOString(); return lab; }

/* ------------------------------------------------------------------ analysis */

/** Elements that apply to a criterion (enablers: approach, deployment, refinement; results: relevance, performance). */
export const elementsFor = (def, criterion) => (def?.elements?.[criterion.kind] || []).map(e => e.id);

/** Criterion self-rating = mean of its element ratings, only when every element is rated; otherwise null. */
export function criterionRating(lab, def, criterion) {
  const r = lab.criteria[criterion.id]?.ratings || {};
  const els = elementsFor(def, criterion);
  if (!els.length || els.some(e => !Number.isFinite(r[e]))) return null;
  return Math.round(els.reduce((a, e) => a + r[e], 0) / els.length);
}

/** True when a criterion has any element rated above “some evidence” (25) but no evidence recorded. */
export function unsupported(lab, criterion) {
  const c = lab.criteria[criterion.id];
  if (!c) return false;
  return (c.evidence || []).length === 0 && Object.values(c.ratings || {}).some(v => v > 25);
}

/** Per-criterion rows and per-dimension averages (of rated criteria only). */
export function labSummary(lab, def) {
  const rows = (def?.criteria || []).map(cr => {
    const c = lab.criteria[cr.id] || {};
    const rating = criterionRating(lab, def, cr);
    const ev = (c.evidence || []).length;
    return { id: cr.id, no: cr.no, group: cr.group, name: cr.name, evidence: ev, strengths: (c.strengths || []).length, afis: (c.afis || []).length, rating,
      flag: unsupported(lab, cr) ? 'unsupported' : ev === 0 ? 'no_evidence' : null };
  });
  const dims = (def?.groups || []).map(g => {
    const rated = rows.filter(r => r.group === g.id && r.rating !== null);
    return { id: g.id, name: g.name, criteria: rows.filter(r => r.group === g.id).length, rated: rated.length,
      rating: rated.length ? Math.round(rated.reduce((a, r) => a + r.rating, 0) / rated.length) : null };
  });
  return { rows, dims, withEvidence: rows.filter(r => r.evidence > 0).length, strengths: rows.reduce((a, r) => a + r.strengths, 0), afis: rows.reduce((a, r) => a + r.afis, 0) };
}

/* ------------------------------------------------------------------ prioritised plan */

/** Zone on the impact–ease matrix (high = 4 or 5). */
export function quadrant(impact, ease) {
  if (!Number.isInteger(impact) || !Number.isInteger(ease)) return 'unscored';
  const hi = impact >= 4, easy = ease >= 4;
  return hi && easy ? 'quick' : hi ? 'major' : easy ? 'fill' : 'reconsider';
}
export const priorityOf = (impact, ease) => (Number.isInteger(impact) && Number.isInteger(ease) ? impact * ease : null);
const ZONE_ORDER = { quick: 0, major: 1, fill: 2, reconsider: 3, unscored: 4 };

/** All AFIs with their plan fields, sorted: highest priority first, then zone, then criterion order; unscored last. */
export function planRows(lab, def) {
  const order = Object.fromEntries((def?.criteria || []).map((c, i) => [c.id, i]));
  const rows = [];
  for (const [cid, c] of Object.entries(lab.criteria || {})) for (const a of c.afis || []) {
    const p = lab.plan[a.id] || {};
    rows.push({ id: a.id, criterion: cid, text: a.text, impact: p.impact ?? null, ease: p.ease ?? null, priority: priorityOf(p.impact, p.ease), zone: quadrant(p.impact, p.ease),
      action: p.action || '', owner: p.owner || '', due: p.due || '', status: p.status || 'open' });
  }
  return rows.sort((a, b) => (b.priority ?? -1) - (a.priority ?? -1) || ZONE_ORDER[a.zone] - ZONE_ORDER[b.zone] || (order[a.criterion] ?? 99) - (order[b.criterion] ?? 99));
}

/* ------------------------------------------------------------------ export / import */

/** The export document: the learner's own Lab, labelled as a self-assessment aid, with the analysis and sorted plan. */
export function exportLab(lab, def, now = new Date().toISOString()) {
  return { schema: LAB_SCHEMA, app: 'cia-academy', label: LAB_LABEL, exported_at: now, model_note: def?.model || null,
    org: lab.org, criteria: lab.criteria, plan: lab.plan, analysis: labSummary(lab, def), prioritised_plan: planRows(lab, def) };
}

/** Parse an export back into a Lab record; returns {lab, error}. Only the Lab's own fields are kept. */
export function importLab(raw, def) {
  let d;
  try { d = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return { lab: null, error: 'json' }; }
  if (!d || d.schema !== LAB_SCHEMA || d.app !== 'cia-academy' || typeof d.criteria !== 'object') return { lab: null, error: 'schema' };
  const known = new Set((def?.criteria || []).map(c => c.id));
  const lab = newLab();
  lab.org = { name: clean(d.org?.name, 200), scope: clean(d.org?.scope, 300), date: /^\d{4}-\d{2}-\d{2}$/.test(d.org?.date || '') ? d.org.date : '' };
  for (const [cid, c] of Object.entries(d.criteria || {})) {
    if (!known.has(cid)) continue;
    const x = crit(lab, cid);
    for (const e of c.evidence || []) if (!validateEvidence(e, '9999-12-31').length) x.evidence.push({ id: clean(e.id, 40) || 'ev-' + uid(), title: clean(e.title, 200), source: clean(e.source, 200), date: e.date || '', owner: clean(e.owner, 120), link: e.link ? String(e.link).trim().slice(0, 500) : '' });
    for (const k of ['strengths', 'afis']) for (const f of c[k] || []) if (clean(f.text).length >= 10) x[k].push({ id: clean(f.id, 40) || k + '-' + uid(), text: clean(f.text, 1000) });
    for (const [el, v] of Object.entries(c.ratings || {})) if (RATING_VALUES.includes(v)) x.ratings[el] = v;
  }
  for (const c of Object.values(lab.criteria)) for (const a of c.afis) {
    const p = d.plan?.[a.id] || {};
    const sc = v => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);
    lab.plan[a.id] = { impact: sc(p.impact), ease: sc(p.ease), action: clean(p.action, 500), owner: clean(p.owner, 120), due: /^\d{4}-\d{2}-\d{2}$/.test(p.due || '') ? p.due : '', status: ['open', 'doing', 'done'].includes(p.status) ? p.status : 'open' };
  }
  return { lab, error: null };
}
