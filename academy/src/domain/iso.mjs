/**
 * ISO Academy logic (Phase 7): deterministic, explainable starting point and route choice.
 * Assessment results and reading progress never equal professional competence.
 */
import { MASTERY_THRESHOLD, WEAK_THRESHOLD } from './learner-model.mjs';

export const ISO_ROUTES = ['ROUTE-AWARE', 'ROUTE-IMPL', 'ROUTE-IA', 'ROUTE-LA', 'ROUTE-IMS', 'ROUTE-MR'];
export const ROLE_ROUTE = { 'ROLE-QE': 'ROUTE-IMPL', 'ROLE-IA': 'ROUTE-IA', 'ROLE-LA': 'ROUTE-LA', 'ROLE-QMGR': 'ROUTE-MR', 'ROLE-HSEQM': 'ROUTE-IMS', 'ROLE-PMOA': 'ROUTE-AWARE' };

const T = (en, ar) => ({ en, ar });
const pct = (ev, c) => (Number.isFinite(ev?.[c]?.percent) ? ev[c].percent : null);

/**
 * @param {{profile?:object|null, evidence?:object, completed?:string[], standards?:object[]}} input
 *   evidence: competency → {percent} from assessmentEvidence(); completed: completedTargets().
 * @returns {{key, route_id, target_id, href, title, reason, factors[]}}
 */
export function isoStartingPoint({ profile = null, evidence = {}, completed = [], standards = [] } = {}) {
  const done = id => completed.includes(id);
  const foundKnown = ['ISO-01', 'ISO-02'].map(c => pct(evidence, c)).filter(v => v !== null);
  const audit = ['AUD-01', 'AUD-02', 'AUD-03'].map(c => pct(evidence, c)).filter(v => v !== null);
  const foundationDemonstrated = done('CRS-ISO-101') || (foundKnown.length === 2 && Math.min(...foundKnown) >= MASTERY_THRESHOLD);
  const auditDemonstrated = done('CRS-ISO-AUD') || (audit.length === 3 && Math.min(...audit) >= MASTERY_THRESHOLD);
  const roleRoute = ROLE_ROUTE[profile?.target_role] || 'ROUTE-AWARE';
  const auditRoute = profile?.target_role === 'ROLE-LA' ? 'ROUTE-LA' : 'ROUTE-IA';
  const focus = standards.find(s => s.id === profile?.iso_focus) || null;
  const factors = [];
  if (foundKnown.length) factors.push({ code: 'foundation_evidence', value: Math.min(...foundKnown) });
  if (audit.length) factors.push({ code: 'audit_evidence', value: Math.min(...audit) });
  if (done('CRS-ISO-101')) factors.push({ code: 'foundation_completed' });
  if (profile?.target_role) factors.push({ code: 'target_role', value: profile.target_role });
  if (focus) factors.push({ code: 'focus_standard', value: focus.id });

  if (!profile) return { key: 'explore', route_id: 'ROUTE-AWARE', target_id: 'KA-001', href: '#/knowledge/iso/what-is-iso', factors,
    title: T('Start with the ISO landscape', 'ابدأ بخريطة ISO'),
    reason: T('Read the published fundamentals, then create your profile so the Academy can suggest a route.', 'اقرأ الأساسيات المنشورة، ثم أنشئ ملفك المهني لتقترح الأكاديمية مسارًا مناسبًا.') };

  if (!foundKnown.length && !done('CRS-ISO-101')) return { key: 'assess', route_id: roleRoute, target_id: 'ASM-READY-ISO-001', href: '#/assessments/iso-readiness', factors,
    title: T('Assess what you already know', 'قيّم ما تعرفه بالفعل'),
    reason: T('There is no assessment evidence yet. A short diagnostic avoids repeating foundations you can already demonstrate. Years of experience alone are not used as evidence.', 'لا توجد أدلة تقييم بعد. يساعد تقييم تشخيصي قصير على تجنب تكرار أساسيات تستطيع إثباتها. ولا تُستخدم سنوات الخبرة وحدها دليلًا.') };

  if (!foundationDemonstrated) {
    const weak = foundKnown.some(v => v < WEAK_THRESHOLD);
    return { key: 'foundation', route_id: 'ROUTE-AWARE', target_id: 'CRS-ISO-101', href: '#/academy/courses/iso-foundations', factors,
      title: T('Build the ISO foundation first', 'ابنِ أساس ISO أولًا'),
      reason: weak
        ? T('Your latest diagnostic shows gaps in interpreting or implementing requirements (ISO-01/ISO-02). Foundations and reading standards come before audit practice.', 'يُظهر آخر تقييم تشخيصي فجوات في تفسير المتطلبات أو تطبيقها (ISO-01/ISO-02). تأتي الأساسيات وقراءة المواصفات قبل ممارسة التدقيق.')
        : T('Your foundation evidence is close but below the 70% mastery mark, or one of the two areas was not assessed.', 'أدلة الأساسيات لديك قريبة لكنها دون عتبة الإتقان 70%، أو أن أحد المجالين لم يُقيَّم.') };
  }

  if (focus) return { key: 'standard', route_id: roleRoute, target_id: focus.foundation_course_id, href: `#/academy/iso/${focus.slug}`, factors,
    title: T(`Continue with ${focus.name.en}`, `تابع مع ${focus.name.ar}`),
    reason: T('You chose this standard and your foundations are demonstrated, so its standard-specific content and its practical toolkit come next.', 'اخترت هذه المواصفة وأساسياتك مثبتة، لذا يأتي بعدها المحتوى الخاص بها وأداتها العملية.') };

  const imsInterest = /\bims\b|integrat|متكامل/i.test(`${profile.interests || ''} ${profile.career_objectives || ''}`);
  if (profile.target_role === 'ROLE-HSEQM' || imsInterest) return { key: 'ims', route_id: 'ROUTE-IMS', target_id: 'CRS-ISO-IMS', href: '#/academy/courses/integrated-management-systems', factors,
    title: T('Integrate your management systems', 'ادمج نظم الإدارة لديك'),
    reason: T('Your target role or stated interest points to integrated systems and your foundations are demonstrated, so the integrated route skips the beginner course.', 'يشير دورك المستهدف أو اهتمامك المعلن إلى النظم المتكاملة، وأساسياتك مثبتة، لذا يتجاوز المسار المتكامل دورة المبتدئين.') };

  if (!auditDemonstrated) return { key: 'audit', route_id: auditRoute, target_id: 'CRS-ISO-AUD', href: '#/academy/courses/auditing-fundamentals', factors,
    title: T('Move from concepts to auditing', 'انتقل من المفاهيم إلى التدقيق'),
    reason: audit.length
      ? T('Foundations are demonstrated, but audit planning, evidence or reporting is below 70% or not yet assessed. The audit route starts without repeating the foundation course.', 'الأساسيات مثبتة، لكن تخطيط التدقيق أو الأدلة أو إعداد التقارير دون 70% أو لم يُقيَّم بعد. يبدأ مسار التدقيق دون تكرار دورة الأساسيات.')
      : T('Foundations are demonstrated; auditing skills have not been assessed yet, so auditing fundamentals are the next step.', 'الأساسيات مثبتة، ولم تُقيَّم مهارات التدقيق بعد، لذا فأساسيات التدقيق هي الخطوة التالية.') };

  const nextRoute = profile.target_role === 'ROLE-LA' ? 'ROUTE-LA' : roleRoute;
  return { key: 'advance', route_id: nextRoute, target_id: 'CRS-ISO-9001-AUD', href: '#/learning-path?route=' + nextRoute, factors,
    title: T('Apply your skills to a specific standard', 'طبّق مهاراتك على مواصفة محددة'),
    reason: T('Foundation and audit evidence are both at mastery level. Continue with standard-specific audit practice; practical competence still needs reviewed evidence.', 'أدلة الأساسيات والتدقيق كلاهما عند مستوى الإتقان. تابع بممارسة تدقيق خاصة بمواصفة محددة، وتظل الكفاءة العملية بحاجة إلى دليل مُراجَع.') };
}

/** Everything a standard page needs, resolved from ids. Callers pass only the lists the viewer may see. */
export function standardBundle(standard, { courses = [], assessments = [], articles = [], tools = [], paths = [] } = {}) {
  const byId = (list, id) => list.find(x => x.id === id) || null;
  return {
    courses: courses.filter(c => (c.standard_ids || []).includes(standard.id)),
    specificCourses: courses.filter(c => (c.standard_ids || []).length === 1 && c.standard_ids[0] === standard.id),
    diagnostic: byId(assessments, standard.assessment_id),
    articles: (standard.knowledge_ids || []).map(id => byId(articles, id)).filter(Boolean),
    tool: byId(tools, standard.toolkit_id),
    routes: paths.filter(p => (p.standard_ids || []).includes(standard.id))
  };
}
