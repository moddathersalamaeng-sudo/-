/**
 * PMI / PMO / P3O Academy logic (Phase 8): deterministic, explainable starting point, route choice, certification facts and
 * a personal study plan. Pure functions, no DOM. Assessment results and reading progress never equal professional competence,
 * and years of experience are never used as evidence.
 */
import { MASTERY_THRESHOLD, WEAK_THRESHOLD } from './learner-model.mjs';

export const PM_ROUTES = ['ROUTE-PM-FOUND', 'ROUTE-PMP', 'ROUTE-PMO', 'ROUTE-PORTFOLIO', 'ROUTE-AGILE'];
export const PM_ROLE_ROUTE = { 'ROLE-PMOA': 'ROUTE-PMO', 'ROLE-PM': 'ROUTE-PMP' };
export const PM_FOUNDATION = ['PM-01', 'PM-02', 'PM-03'];
export const FACT_GROUPS = ['eligibility', 'exam', 'fee', 'renewal', 'domains'];

const T = (en, ar) => ({ en, ar });
const pct = (ev, c) => (Number.isFinite(ev?.[c]?.percent) ? ev[c].percent : null);
const text = p => `${p?.interests || ''} ${p?.career_objectives || ''} ${p?.target_certifications || ''}`.toLowerCase();

/** What the learner is aiming at, from the profile's own words (target role, certifications, interests). */
export function pmIntent(profile) {
  const s = text(profile);
  if (profile?.target_role === 'ROLE-PMOA' || /\bpmo\b|pmocp|p3m3|p3o|مكتب/.test(s)) return 'pmo';
  if (/portfolio|pfmp|pgmp|programme|program\b|محفظ|برنامج/.test(s)) return 'portfolio';
  if (/agile|scrum|kanban|acp|رشيق/.test(s)) return 'agile';
  if (profile?.target_role === 'ROLE-PM' || /\bpmp\b|capm|بي إم بي/.test(s)) return 'pmp';
  return null;
}

/**
 * @param {{profile?:object|null, evidence?:object, completed?:string[]}} input
 * @returns {{key, route_id, target_id, href, title, reason, factors[]}}
 */
export function pmiStartingPoint({ profile = null, evidence = {}, completed = [] } = {}) {
  const done = id => completed.includes(id);
  const found = PM_FOUNDATION.map(c => pct(evidence, c)).filter(v => v !== null);
  const pmo = pct(evidence, 'PMO-01');
  const foundationDemonstrated = done('CRS-PM-101') || (found.length === PM_FOUNDATION.length && Math.min(...found) >= MASTERY_THRESHOLD);
  const intent = pmIntent(profile);
  const factors = [];
  if (found.length) factors.push({ code: 'pm_evidence', value: Math.min(...found) });
  if (pmo !== null) factors.push({ code: 'pmo_evidence', value: pmo });
  if (done('CRS-PM-101')) factors.push({ code: 'foundation_completed' });
  if (profile?.target_role) factors.push({ code: 'target_role', value: profile.target_role });
  if (intent) factors.push({ code: 'intent', value: intent });

  if (!profile) return { key: 'explore', route_id: 'ROUTE-PM-FOUND', target_id: 'KA-011', href: '#/knowledge/pmi/project-program-portfolio', factors,
    title: T('Start with the project landscape', 'ابدأ بخريطة المشاريع'),
    reason: T('Read how projects, programmes and portfolios differ, then create your profile so the Academy can suggest a route.', 'اقرأ الفرق بين المشاريع والبرامج والمحافظ، ثم أنشئ ملفك المهني لتقترح الأكاديمية مسارًا.') };

  if (!found.length && !done('CRS-PM-101')) return { key: 'assess', route_id: PM_ROLE_ROUTE[profile.target_role] || 'ROUTE-PM-FOUND', target_id: 'ASM-READY-PM-001', href: '#/assessments/pm-readiness', factors,
    title: T('Assess what you already know', 'قيّم ما تعرفه بالفعل'),
    reason: T('There is no assessment evidence yet. A 20-minute diagnostic avoids repeating foundations you can already demonstrate. Years of experience alone are not used as evidence.', 'لا توجد أدلة تقييم بعد. يساعد تقييم تشخيصي مدته 20 دقيقة على تجنب تكرار أساسيات تستطيع إثباتها. ولا تُستخدم سنوات الخبرة وحدها دليلًا.') };

  if (!foundationDemonstrated) {
    const weak = found.some(v => v < WEAK_THRESHOLD);
    return { key: 'foundation', route_id: 'ROUTE-PM-FOUND', target_id: 'CRS-PM-101', href: '#/academy/courses/project-value', factors,
      title: T('Build the project foundation first', 'ابنِ أساس المشاريع أولًا'),
      reason: weak
        ? T('Your latest diagnostic shows gaps in planning, stakeholders or delivery approaches (PM-01 to PM-03). Foundations come before specialist routes.', 'يُظهر آخر تقييم فجوات في التخطيط أو أصحاب المصلحة أو نُهج التسليم (PM-01 إلى PM-03). تأتي الأساسيات قبل المسارات التخصصية.')
        : T('Your evidence is close but below the 70% mastery mark, or one of the three areas was not assessed.', 'أدلتك قريبة لكنها دون عتبة الإتقان 70%، أو أن أحد المجالات الثلاثة لم يُقيَّم.') };
  }

  if (intent === 'pmo') {
    const designed = done('CRS-PMO-DESIGN') || (pmo !== null && pmo >= MASTERY_THRESHOLD);
    return designed
      ? { key: 'pmo_maturity', route_id: 'ROUTE-PMO', target_id: 'CRS-PMO-KPI', href: '#/academy/courses/pmo-maturity-kpis', factors,
        title: T('Measure and grow your PMO', 'قِس مكتبك وطوّره'),
        reason: T('PMO design is demonstrated, so the route continues with maturity, KPIs and the one-level-up roadmap.', 'تصميم المكتب مثبت، لذا يستمر المسار بالنضج والمؤشرات وخارطة رفع المستوى.') }
      : { key: 'pmo', route_id: 'ROUTE-PMO', target_id: 'CRS-PMO-DESIGN', href: '#/academy/courses/pmo-design-services', factors,
        title: T('Design a PMO people want to use', 'صمّم مكتب مشاريع يرغب الناس في استخدامه'),
        reason: T('Your target role or stated interest is PMO work and your project foundations are demonstrated, so the PMO route starts with design and services.', 'دورك المستهدف أو اهتمامك المعلن عمل مكاتب المشاريع، وأساسيات المشاريع لديك مثبتة، لذا يبدأ مسار المكتب بالتصميم والخدمات.') };
  }
  if (intent === 'portfolio') return { key: 'portfolio', route_id: 'ROUTE-PORTFOLIO', target_id: 'CRS-PFM-PRIOR', href: '#/academy/courses/portfolio-prioritisation', factors,
    title: T('Choose and balance the right initiatives', 'اختر المبادرات الصحيحة ووازنها'),
    reason: T('Your stated interest is portfolio or programme work and the foundations are demonstrated, so portfolio prioritisation comes next.', 'اهتمامك المعلن عمل المحافظ أو البرامج والأساسيات مثبتة، لذا يأتي ترتيب أولويات المحفظة بعد ذلك.') };
  if (intent === 'agile') return { key: 'agile', route_id: 'ROUTE-AGILE', target_id: 'CRS-PM-AGILE', href: '#/academy/courses/agile-hybrid-delivery', factors,
    title: T('Deliver in agile and hybrid ways', 'سلّم بالطرق الرشيقة والهجينة'),
    reason: T('Your stated interest is agile delivery and the foundations are demonstrated, so the agile route skips the beginner course.', 'اهتمامك المعلن التسليم الرشيق والأساسيات مثبتة، لذا يتجاوز المسار الرشيق دورة المبتدئين.') };
  return { key: 'pmp', route_id: 'ROUTE-PMP', target_id: 'CRS-PMP-PREP', href: '#/learning-path?route=ROUTE-PMP', factors,
    title: T('Prepare for PMP® with a plan', 'استعد لـ PMP® بخطة'),
    reason: T('Your foundations are demonstrated. The PMP® route skips what you have shown and ends with the study-strategy course; check PMI’s eligibility before applying.', 'أساسياتك مثبتة. يتجاوز مسار PMP® ما أثبتّه وينتهي بدورة استراتيجية المذاكرة؛ وتحقق من أهلية PMI قبل التقديم.') };
}

/** Which fact groups of a certification may be shown as facts (verified) and which must send the learner to PMI (pending). */
export function certFactState(cert) {
  const s = cert?.facts_status || {};
  const out = {};
  for (const g of FACT_GROUPS) out[g] = s[g] === 'verified' ? 'verified' : 'pending';
  return out;
}

/** Problems with a certification record (empty = valid): verified groups must carry data; domain weights must add to 100. */
export function validateCertification(c) {
  const e = [];
  if (!c?.id || !c.slug || !c.name?.en || !c.name?.ar) e.push('missing_identity');
  if (!c?.official_url || !/^https:\/\/(www\.)?pmi\.org\//.test(c.official_url)) e.push('official_url_not_pmi');
  if (!c?.verified_date || !/^\d{4}-\d{2}-\d{2}$/.test(c.verified_date)) e.push('missing_verified_date');
  if (!c?.source_ids?.length) e.push('missing_sources');
  const st = certFactState(c);
  if (st.eligibility === 'verified' && !c.eligibility?.length) e.push('verified_without_eligibility');
  if (st.exam === 'verified' && !(c.exam?.questions > 0 && c.exam?.minutes > 0)) e.push('verified_without_exam');
  if (st.fee === 'verified' && !(c.fee?.member > 0 && c.fee?.non_member > 0)) e.push('verified_without_fee');
  if (st.renewal === 'verified' && !(c.renewal?.pdus > 0 && c.renewal?.years > 0)) e.push('verified_without_renewal');
  if (st.domains === 'verified') {
    const sum = (c.domains || []).reduce((a, d) => a + (d.weight || 0), 0);
    if (sum !== 100) e.push('domain_weights_not_100:' + sum);
  }
  /* Pending groups must not carry figures that the page did not confirm. */
  if (st.fee === 'pending' && c.fee) e.push('pending_fee_has_figures');
  if (st.exam === 'pending' && c.exam) e.push('pending_exam_has_figures');
  if (st.renewal === 'pending' && c.renewal) e.push('pending_renewal_has_figures');
  return e;
}

/**
 * Hours per domain for a study budget, proportional to the outline weights, keeping a reserve for timed practice.
 * @returns {{practice:number, domains:{name, weight, hours}[]}}
 */
export function domainHours(domains = [], totalHours = 120, practiceShare = 1 / 6) {
  const practice = Math.round(totalHours * practiceShare);
  const left = totalHours - practice;
  const sum = domains.reduce((a, d) => a + (d.weight || 0), 0) || 1;
  return { practice, domains: domains.map(d => ({ ...d, hours: Math.round(left * (d.weight || 0) / sum) })) };
}

/**
 * Personal course study plan: how many weeks the course takes at the learner's weekly hours, and which lessons fall in each week.
 * Lessons are kept whole; practical task and final assessment close the last week.
 */
export function studyWeeks(course, weeklyHours = 4) {
  const wk = Math.max(1, Math.min(40, Number(weeklyHours) || 4)) * 60;
  const lessons = (course?.modules || []).flatMap(m => (m.lessons || []).map(l => ({ id: l.id, title: l.title, minutes: (l.estimated_minutes || 15) + (l.source ? 5 : 20), module: m.title })));
  const tail = { id: 'final', minutes: (course?.practical_task?.minutes || 0) + 30 };
  const weeks = [];
  let cur = [], used = 0;
  for (const l of lessons) {
    if (used + l.minutes > wk && cur.length) { weeks.push(cur); cur = []; used = 0; }
    cur.push(l); used += l.minutes;
  }
  if (used + tail.minutes > wk && cur.length) { weeks.push(cur); cur = []; }
  cur.push(tail); weeks.push(cur);
  return weeks.map((items, i) => ({ week: i + 1, items, minutes: items.reduce((a, x) => a + x.minutes, 0) }));
}
