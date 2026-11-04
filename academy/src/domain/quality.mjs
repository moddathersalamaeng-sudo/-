/**
 * Quality (ASQ-informed) Academy logic (Phase 9): deterministic, explained starting point, role → route defaults, and the
 * CMQ/OE Center calculations (results per Body of Knowledge area, readiness, weak areas, study hours by weight and weakness).
 * Pure functions, no DOM. Assessment results never equal professional competence or an exam prediction, and years of
 * experience are never used as evidence.
 */
import { MASTERY_THRESHOLD, WEAK_THRESHOLD } from './learner-model.mjs';

export const Q_ROUTES = ['ROUTE-Q-FOUND', 'ROUTE-Q-ENGINEER', 'ROUTE-Q-AUDITOR', 'ROUTE-Q-SSGB', 'ROUTE-Q-CMQOE'];
export const Q_ROLE_ROUTE = { 'ROLE-QE': 'ROUTE-Q-ENGINEER', 'ROLE-QMGR': 'ROUTE-Q-CMQOE', 'ROLE-CIS': 'ROUTE-Q-SSGB' };
export const Q_FOUNDATION = ['QM-01', 'QM-02', 'QM-03'];
export const CMQOE_DIAG = 'ASM-CMQOE-DIAG';

const T = (en, ar) => ({ en, ar });
const pct = (ev, c) => (Number.isFinite(ev?.[c]?.percent) ? ev[c].percent : null);
const text = p => `${p?.interests || ''} ${p?.career_objectives || ''} ${p?.target_certifications || ''}`.toLowerCase();

/** What the learner is aiming at in quality, from the profile's own words and target role. */
export function qualityIntent(profile) {
  const s = text(profile);
  if (profile?.target_role === 'ROLE-QMGR' || /cmq|organi[sz]ational excellence|quality manager|مدير الجودة|مدير جودة/.test(s)) return 'cmqoe';
  if (profile?.target_role === 'ROLE-CIS' || /six sigma|green belt|black belt|cssgb|cssbb|lean|سيجما|الحزام/.test(s)) return 'ssgb';
  if (/\bcqa\b|quality audit|مدقق جودة|تدقيق الجودة/.test(s)) return 'auditor';
  if (profile?.target_role === 'ROLE-QE' || /\bcqe\b|\bcqt\b|quality engineer|spc|مهندس جودة/.test(s)) return 'engineer';
  return null;
}

const ROUTE_OF = { cmqoe: 'ROUTE-Q-CMQOE', ssgb: 'ROUTE-Q-SSGB', auditor: 'ROUTE-Q-AUDITOR', engineer: 'ROUTE-Q-ENGINEER' };
const NEXT = {
  cmqoe: { key: 'cmqoe', target_id: CMQOE_DIAG, href: '#/academy/quality/cmqoe', title: T('Open the CMQ/OE Center', 'افتح مركز CMQ/OE'),
    reason: T('Your aim is quality management and your foundations are demonstrated. The CMQ/OE Center diagnoses you by Body of Knowledge area and builds a study plan.', 'هدفك إدارة الجودة وأساسياتك مثبتة. ويشخّصك مركز CMQ/OE حسب مجالات المعرفة ويبني خطة مذاكرة.') },
  ssgb: { key: 'ssgb', target_id: 'CRS-LSS-GB', href: '#/learning-path?route=ROUTE-Q-SSGB', title: T('Lead improvement projects with DMAIC', 'قُد مشاريع التحسين بمنهج DMAIC'),
    reason: T('Your aim is Lean Six Sigma and your foundations are demonstrated, so the Green Belt route starts with SPC and DMAIC.', 'هدفك لين ستة سيجما وأساسياتك مثبتة، لذا يبدأ مسار الحزام الأخضر بالضبط الإحصائي وDMAIC.') },
  auditor: { key: 'auditor', target_id: 'CRS-Q-AUDIT', href: '#/academy/courses/quality-auditing', title: T('Audit processes, not only documents', 'دقّق العمليات لا الوثائق فقط'),
    reason: T('Your aim is quality auditing and your foundations are demonstrated, so the auditor route starts with process, product and system audits.', 'هدفك تدقيق الجودة وأساسياتك مثبتة، لذا يبدأ مسار المدقق بتدقيق العمليات والمنتجات والأنظمة.') },
  engineer: { key: 'engineer', target_id: 'CRS-Q-SPC', href: '#/academy/courses/spc-basics', title: T('Control processes with data', 'اضبط العمليات بالبيانات'),
    reason: T('Your aim is quality engineering and your foundations are demonstrated, so the route continues with statistical process control.', 'هدفك هندسة الجودة وأساسياتك مثبتة، لذا يستمر المسار بالضبط الإحصائي للعمليات.') }
};

/**
 * @param {{profile?:object|null, evidence?:object, completed?:string[]}} input
 * @returns {{key, route_id, target_id, href, title, reason, factors[]}}
 */
export function qualityStartingPoint({ profile = null, evidence = {}, completed = [] } = {}) {
  const done = id => completed.includes(id);
  const found = Q_FOUNDATION.map(c => pct(evidence, c)).filter(v => v !== null);
  const foundationDemonstrated = done('CRS-QMS-201') || (found.length === Q_FOUNDATION.length && Math.min(...found) >= MASTERY_THRESHOLD);
  const intent = qualityIntent(profile);
  const factors = [];
  if (found.length) factors.push({ code: 'q_evidence', value: Math.min(...found) });
  if (done('CRS-QMS-201')) factors.push({ code: 'foundation_completed' });
  if (profile?.target_role) factors.push({ code: 'target_role', value: profile.target_role });
  if (intent) factors.push({ code: 'intent', value: intent });

  if (!profile) return { key: 'explore', route_id: 'ROUTE-Q-FOUND', target_id: 'KA-015', href: '#/knowledge/quality/quality-qa-qc', factors,
    title: T('Start with what quality means', 'ابدأ بمعنى الجودة'),
    reason: T('Read how quality, assurance and control differ, then create your profile so the Academy can suggest a route.', 'اقرأ الفرق بين الجودة وضمانها وضبطها، ثم أنشئ ملفك المهني لتقترح الأكاديمية مسارًا.') };

  if (!found.length && !done('CRS-QMS-201')) return { key: 'assess', route_id: Q_ROLE_ROUTE[profile.target_role] || ROUTE_OF[intent] || 'ROUTE-Q-FOUND', target_id: 'ASM-READY-Q-001', href: '#/assessments/quality-readiness', factors,
    title: T('Assess what you already know', 'قيّم ما تعرفه بالفعل'),
    reason: T('There is no assessment evidence yet. A 20-minute diagnostic avoids repeating foundations you can already demonstrate. Years of experience alone are not used as evidence.', 'لا توجد أدلة تقييم بعد. يساعد تقييم تشخيصي مدته 20 دقيقة على تجنب تكرار أساسيات تستطيع إثباتها. ولا تُستخدم سنوات الخبرة وحدها دليلًا.') };

  if (!foundationDemonstrated) {
    const weak = found.some(v => v < WEAK_THRESHOLD);
    return { key: 'foundation', route_id: 'ROUTE-Q-FOUND', target_id: 'CRS-QMS-201', href: '#/academy/courses/quality-practice', factors,
      title: T('Build the quality foundation first', 'ابنِ أساس الجودة أولًا'),
      reason: weak
        ? T('Your latest diagnostic shows gaps in quality planning, tools or problem solving (QM-01 to QM-03). Foundations come before specialist routes.', 'يُظهر آخر تقييم فجوات في تخطيط الجودة أو أدواتها أو حل المشكلات (QM-01 إلى QM-03). تأتي الأساسيات قبل المسارات التخصصية.')
        : T('Your evidence is close but below the 70% mastery mark, or one of the three areas was not assessed.', 'أدلتك قريبة لكنها دون عتبة الإتقان 70%، أو أن أحد المجالات الثلاثة لم يُقيَّم.') };
  }
  const next = NEXT[intent] || { key: 'tools', target_id: 'CRS-Q-TOOLS', href: '#/learning-path?route=ROUTE-Q-FOUND', title: T('Continue the foundations route', 'تابع مسار الأساسيات'),
    reason: T('Your foundations are demonstrated. The foundations route skips what you have shown; add a target role or certification to your profile for a specialist route.', 'أساسياتك مثبتة. ويتجاوز مسار الأساسيات ما أثبتّه؛ وأضف دورًا أو شهادة مستهدفة إلى ملفك لمسار تخصصي.') };
  return { ...next, route_id: ROUTE_OF[intent] || 'ROUTE-Q-FOUND', factors };
}

/**
 * Results per Body of Knowledge area from the latest attempt of the CMQ/OE diagnostic.
 * @param {object[]} attempts  learner attempts
 * @param {object}   assessment the diagnostic (with bok_areas: {question_id: area index})
 * @param {object[]} areas     certification domains [{name, questions}]
 * @returns {{attempt:object|null, areas:{index, name, questions, items, earned, max, unknown, percent:number|null, state:'ok'|'weak'|'mid'|'none'}[]}}
 */
export function bokAreaResults(attempts = [], assessment = null, areas = []) {
  const map = assessment?.bok_areas || {};
  const mine = attempts.filter(a => a.assessment_id === assessment?.id).sort((a, b) => String(b.submitted_at || '').localeCompare(String(a.submitted_at || '')));
  const at = mine[0] || null;
  const rows = areas.map((d, i) => ({ index: i, name: d.name, questions: d.questions || 0, items: 0, earned: 0, max: 0, unknown: 0, percent: null, state: 'none' }));
  if (at) for (const x of at.detail || []) {
    const i = map[x.question_id];
    if (!Number.isInteger(i) || !rows[i] || (!x.auto && !x.reviewed)) continue;
    rows[i].items++; rows[i].earned += x.earned || 0; rows[i].max += x.max || 0; if (x.unknown) rows[i].unknown++;
  }
  for (const r of rows) if (r.max > 0) {
    r.percent = Math.round(r.earned / r.max * 100);
    r.state = r.percent >= MASTERY_THRESHOLD ? 'ok' : r.percent < WEAK_THRESHOLD ? 'weak' : 'mid';
  }
  return { attempt: at, areas: rows };
}

/**
 * Readiness index: each area's percent weighted by its share of exam questions; null until every area has evidence.
 * A study signal only — never an exam prediction.
 */
export function readinessIndex(rows = []) {
  if (!rows.length || rows.some(r => r.percent === null)) return null;
  const tot = rows.reduce((a, r) => a + (r.questions || 0), 0) || 1;
  return Math.round(rows.reduce((a, r) => a + r.percent * (r.questions || 0), 0) / tot);
}

/**
 * Study hours per area: proportional to question weight × a weakness factor (1.5 for weak, 1.2 for mid, 1 for ok or unknown),
 * keeping one sixth for timed practice. Rounded hours always add up to the total.
 */
export function weightedStudyHours(rows = [], totalHours = 100, practiceShare = 1 / 6) {
  const practice = Math.round(totalHours * practiceShare);
  const left = totalHours - practice;
  const f = { weak: 1.5, mid: 1.2, ok: 1, none: 1 };
  const w = rows.map(r => (r.questions || 0) * (f[r.state] || 1));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const raw = w.map(x => left * x / sum);
  const out = raw.map(Math.floor);
  let rest = left - out.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { out[i]++; rest--; } });
  return { practice, areas: rows.map((r, i) => ({ ...r, hours: out[i] })) };
}

/** The weakest areas first (assessed only), then the heaviest unassessed ones. */
export function weakAreas(rows = [], n = 3) {
  const assessed = rows.filter(r => r.percent !== null && r.percent < MASTERY_THRESHOLD).sort((a, b) => a.percent - b.percent || b.questions - a.questions);
  return assessed.slice(0, n);
}

/** CIA courses that teach each CMQ/OE major area (index as in the certification's domains). */
export const CMQOE_AREA_COURSES = {
  0: ['CRS-CMQOE-PREP'], 1: ['CRS-CMQOE-PREP', 'CRS-M-SWOT', 'CRS-M-PESTLE'], 2: ['CRS-PM-101', 'CRS-Q-COQ', 'CRS-QMS-201'],
  3: ['CRS-Q-TOOLS', 'CRS-Q-CAPA', 'CRS-Q-SPC'], 4: ['CRS-QMS-201', 'CRS-CMQOE-PREP'], 5: ['CRS-Q-SUPPLIER'], 6: ['CRS-CMQOE-PREP']
};
/** Readiness band for a readiness index (study guidance only). */
export const readinessBand = v => (v === null || v === undefined ? null : v >= 75 ? 'high' : v >= 55 ? 'mid' : 'low');
