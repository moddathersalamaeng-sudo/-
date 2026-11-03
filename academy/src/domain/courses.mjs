export const CERTIFICATE_TYPES=['attendance','completion','assessment_passed','platform_credential','professional_certification','externally_accredited'];
export const COURSE_STATUSES=['CIA INTERNAL COURSE','EXAM PREPARATION COURSE','EXTERNAL ACCREDITATION PENDING','EXTERNALLY ACCREDITED','OFFICIAL PARTNER COURSE'];
export function validateCourse(c){const e=[];for(const k of ['id','slug','title','level','duration','training_hours','delivery_modes','languages','target_audience','prerequisites','learning_outcomes','modules','certificate_type','governance'])if(c?.[k]==null)e.push('missing_'+k);if(!CERTIFICATE_TYPES.includes(c?.certificate_type))e.push('bad_certificate_type');if(!COURSE_STATUSES.includes(c?.status_label))e.push('bad_status_label');if(!Array.isArray(c?.modules)||c.modules.some((m,i)=>m.order!==i+1||!Array.isArray(m.lessons)))e.push('bad_curriculum_order');return [...new Set(e)];}
export function validateProgram(p,courseIds=[]){const e=[];if(!p?.id||!p?.title||!Array.isArray(p?.stages)||!p.stages.length)e.push('missing_program_fields');if(!CERTIFICATE_TYPES.includes(p?.certificate_type))e.push('bad_certificate_type');if(p?.stages?.some((s,i)=>s.order!==i+1||!courseIds.includes(s.course_id)))e.push('bad_program_stage');return e;}
export function prerequisiteState(course,completed=[]){const open=(course.prerequisites||[]).filter(x=>x.course_id&&!completed.includes(x.course_id));const missing=open.filter(x=>x.required!==false);const advised=open.filter(x=>x.required===false);return {eligible:missing.length===0,missing,advised};}
export function courseProgress(course,completedLessons=[]){const ids=(course.modules||[]).flatMap(m=>m.lessons||[]).map(l=>l.id);const done=ids.filter(x=>completedLessons.includes(x)).length;return {done,total:ids.length,percent:ids.length?Math.round(done/ids.length*100):null};}
export function searchCourses(items,q='',filters={}){const n=s=>String(s||'').toLowerCase().normalize('NFKD');const qq=n(q);return items.filter(c=>(!qq||n([c.title?.en,c.title?.ar,c.overview?.en,c.overview?.ar].join(' ')).includes(qq))&&(!filters.level||String(c.level)===String(filters.level))&&(!filters.delivery||c.delivery_modes.includes(filters.delivery))&&(!filters.language||c.languages.includes(filters.language)));}

/** Phase 7 completion contract for a course. Returns the list of missing items (empty = complete). */
export const LESSON_BLOCKS = ['concept', 'worked_example', 'scenario', 'common_mistake', 'evidence'];
/**
 * A lesson either carries its own five teaching blocks and exercise, or is built from a guide item
 * (`source: { guide, ref }`) whose text is rendered at runtime; `resolveSource(source)` (optional) confirms the
 * item exists and is teachable. Both kinds need a knowledge-check question.
 */
export function courseCompleteness(course, { questionIds = [], assessmentIds = [], resolveSource = null } = {}) {
  const miss = [];
  const bi = v => v && typeof v.en === 'string' && v.en.trim() && typeof v.ar === 'string' && v.ar.trim();
  if (!bi(course.title) || !bi(course.overview)) miss.push('bilingual_title_overview');
  if (!(course.learning_outcomes?.length >= 3 && course.learning_outcomes.length <= 6 && course.learning_outcomes.every(bi))) miss.push('outcomes_3_to_6');
  if (!course.target_audience?.length) miss.push('audience');
  const lessons = (course.modules || []).flatMap(m => m.lessons || []);
  if ((course.modules || []).length < 2 || lessons.length < 4) miss.push('min_two_modules_four_lessons');
  for (const l of lessons) {
    if (l.source) {
      if (typeof l.source.guide !== 'string' || !l.source.guide || typeof l.source.ref !== 'string' || !l.source.ref) miss.push('lesson_source:' + l.id);
      else if (resolveSource && !resolveSource(l.source)) miss.push('lesson_source_unresolved:' + l.id);
      if (!bi(l.title)) miss.push('lesson_bilingual:' + l.id);
      if (!questionIds.includes(l.check_question_id)) miss.push('lesson_check:' + l.id);
      continue;
    }
    const types = (l.content_blocks || []).map(b => b.type);
    if (LESSON_BLOCKS.some(t => !types.includes(t))) miss.push('lesson_blocks:' + l.id);
    if ((l.content_blocks || []).some(b => !bi(b.text))) miss.push('lesson_bilingual:' + l.id);
    if (!bi(l.exercise?.prompt) || !bi(l.exercise?.model_answer)) miss.push('lesson_exercise:' + l.id);
    if (!questionIds.includes(l.check_question_id)) miss.push('lesson_check:' + l.id);
  }
  if (!course.practical_task?.rubric?.length) miss.push('practical_rubric');
  for (const k of ['quiz', 'final', 'practical']) if (!assessmentIds.includes(course.assessments?.[k])) miss.push('assessment_' + k);
  if (!course.daily_schedule?.length) miss.push('day_plan');
  if (!course.source_references?.length) miss.push('sources');
  if (!course.competency_mappings?.length) miss.push('competencies');
  return [...new Set(miss)];
}

/** Lessons in order with their module, for prev/next navigation. */
export function flatLessons(course) {
  return (course.modules || []).flatMap(m => (m.lessons || []).map(l => ({ ...l, module: m })));
}
