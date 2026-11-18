/**
 * Phase 15 — visual lessons: every lesson as a slide deck (pure, no DOM).
 *
 * The deck only RE-PRESENTS published lesson text: each slide quotes the lesson's own blocks (authored lessons) or the
 * guide item it comes from (guide lessons), shortened to sentences, with an icon chosen from the words. Diagrams of named
 * models (PDCA, DMAIC, fishbone …) use the Phase 9 figure templates with the models' standard names only — no new claims,
 * numbers or requirements (D-122). The full lesson text stays on the page below the deck (D-95: folding, never shortening).
 * © 2026 Modather Salama — Continual Improvement Academy.
 */

export const MAX_SLIDES = 12;
export const MAX_POINTS = 4;
export const MAX_WORDS = 34;

const B = (en, ar) => ({ en, ar });
const T = (v, lang) => (v && typeof v === 'object' ? (v[lang] || v.en || v.ar || '') : String(v ?? ''));

/* ------------------------------------------------------------------ icons from words */
/** Keyword → icon (names from src/core/dom.js ICONS). First match wins; Arabic and English. */
export const ICON_RULES = [
  [/audit|auditor|تدقيق|مدقق/i, 'clipboard'], [/risk|hazard|خطر|مخاطر|مخاطرة/i, 'shield'], [/root cause|cause|سبب|أسباب|fishbone|عظم السمكة/i, 'fish'],
  [/evidence|record|proof|دليل|أدلة|سجل/i, 'doc'], [/certif|شهادة|مانحة/i, 'award'], [/accredit|اعتماد/i, 'medal'],
  [/customer|client|عميل|عملاء/i, 'users'], [/supplier|vendor|مورد|موردين/i, 'truck'], [/safety|ppe|سلامة|وقاية/i, 'hardhat'],
  [/security|confidential|أمن المعلومات|سرية/i, 'lock'], [/measure|kpi|indicator|metric|قياس|مؤشر/i, 'gauge'], [/objective|target|goal|هدف|أهداف|مستهدف/i, 'target'],
  [/leader|top management|قيادة|الإدارة العليا/i, 'crown'], [/improv|continual|تحسين/i, 'trend'], [/cost|price|fee|تكلفة|رسوم/i, 'coins'],
  [/plan|schedule|date|خطة|جدول|موعد/i, 'calendar'], [/process|procedure|عملية|إجراء/i, 'cycle'], [/document|policy|manual|وثيقة|سياسة|دليل الجودة/i, 'doc'],
  [/data|statistic|chart|بيانات|إحصاء/i, 'chart'], [/decision|judg|قرار|حكم/i, 'scale'], [/competen|training|skill|كفاءة|تدريب|مهارة/i, 'ladder'],
  [/project|portfolio|program|مشروع|محفظة|برنامج/i, 'briefcase'], [/team|people|staff|فريق|العاملين|موظف/i, 'users'], [/standard|iso|مواصفة|معيار/i, 'book'],
  [/check|verify|inspect|تحقق|فحص/i, 'check'], [/mistake|wrong|error|خطأ|أخطاء/i, 'alert'], [/question|why|لماذا|سؤال/i, 'question'],
  [/time|minute|duration|وقت|دقيقة|مدة/i, 'clock'], [/search|find|بحث/i, 'magnify'], [/map|context|scope|سياق|نطاق/i, 'map']
];
export function iconFor(text = '', fallback = 'bulb') {
  const s = String(text);
  for (const [re, name] of ICON_RULES) if (re.test(s)) return name;
  return fallback;
}

/* ------------------------------------------------------------------ text helpers */
/** Sentences of a text (Arabic and English punctuation), each cut to MAX_WORDS words with an ellipsis. */
export function sentences(text = '', max = MAX_POINTS) {
  const s = String(text).replace(/\s+/g, ' ').trim();
  if (!s) return [];
  const parts = s.split(/(?<=[.!?؟؛])\s+(?=\S)/u).map(x => x.trim()).filter(x => x.length > 1);
  return parts.slice(0, max).map(x => shorten(x, MAX_WORDS));
}
export function shorten(text = '', words = MAX_WORDS) {
  const w = String(text).trim().split(/\s+/);
  return w.length <= words ? w.join(' ') : w.slice(0, words).join(' ') + ' …';
}
/** Two quoted phrases in an example ("“wrong” … “right”") become a before / after comparison. */
export function quotedPair(text = '') {
  const q = [...String(text).matchAll(/[“"«]([^”"»]{6,260})[”"»]/gu)].map(m => m[1].trim());
  return q.length >= 2 ? [q[0], q[1]] : null;
}

/* ------------------------------------------------------------------ named models (standard names only) */
const st = (en, ar, den = '', dar = '') => ({ t: B(en, ar), ...(den ? { d: B(den, dar) } : {}) });
/** Model diagrams: standard, widely published names of the steps only (no requirement text, no numbers). */
export const MODELS = {
  pdca: { re: /pdca|plan[- ]do[- ]check|خطط.{0,6}نفذ|دورة deming|دورة ديمنغ/i, title: B('The PDCA cycle', 'دورة PDCA'),
    spec: { template: 'cycle', center: B('PDCA', 'PDCA'), steps: [st('Plan', 'خطّط'), st('Do', 'نفّذ'), st('Check', 'تحقّق'), st('Act', 'تصرّف')] } },
  dmaic: { re: /dmaic|six sigma|سيجما/i, title: B('DMAIC', 'مراحل DMAIC'),
    spec: { template: 'flow', steps: [{ t: B('Define', 'التعريف'), tag: B('D', 'D') }, { t: B('Measure', 'القياس'), tag: B('M', 'M') }, { t: B('Analyse', 'التحليل'), tag: B('A', 'A') }, { t: B('Improve', 'التحسين'), tag: B('I', 'I') }, { t: B('Control', 'الضبط'), tag: B('C', 'C') }] } },
  fishbone: { re: /fishbone|ishikawa|cause[- ]and[- ]effect|عظم السمكة|إيشيكاوا|السبب والنتيجة/i, title: B('Cause and effect (fishbone)', 'السبب والنتيجة (عظم السمكة)'),
    spec: { template: 'fishbone', effect: B('Problem', 'المشكلة'), bones: [
      { t: B('People', 'الأفراد'), causes: [] }, { t: B('Method', 'الأسلوب'), causes: [] }, { t: B('Machine', 'الآلة'), causes: [] },
      { t: B('Material', 'المواد'), causes: [] }, { t: B('Measurement', 'القياس'), causes: [] }, { t: B('Environment', 'البيئة'), causes: [] }] } },
  whys: { re: /5 whys|five whys|why[- ]why|لماذا الخمس|خمسة لماذا|الأسئلة الخمسة/i, title: B('Five whys', 'لماذا الخمس'),
    spec: { template: 'ladder', levels: [st('Why? 1', 'لماذا؟ 1'), st('Why? 2', 'لماذا؟ 2'), st('Why? 3', 'لماذا؟ 3'), st('Why? 4', 'لماذا؟ 4'), st('Why? 5 → root cause', 'لماذا؟ 5 ← السبب الجذري')] } },
  fmea: { re: /fmea|failure mode|أنماط الفشل|نمط الفشل/i, title: B('FMEA: severity × occurrence × detection', 'FMEA: الشدة × الحدوث × الاكتشاف'),
    spec: { template: 'tiles', items: [{ icon: 'alert', t: B('Severity', 'الشدة') }, { icon: 'refresh', t: B('Occurrence', 'الحدوث') }, { icon: 'eye', t: B('Detection', 'الاكتشاف') }, { icon: 'gauge', t: B('Priority → action', 'الأولوية ← الإجراء') }] } },
  hierarchy: { re: /hierarchy of controls|تسلسل الضوابط|هرم الضوابط|eliminat.{0,40}substitut/i, title: B('Hierarchy of controls', 'تسلسل الضوابط'),
    spec: { template: 'funnel', stages: [B('Elimination', 'الإزالة'), B('Substitution', 'الاستبدال'), B('Engineering controls', 'الضوابط الهندسية'), B('Administrative controls', 'الضوابط الإدارية'), B('PPE', 'معدات الوقاية الشخصية')] } },
  riskmatrix: { re: /risk matrix|likelihood.{0,30}(consequence|impact|severity)|مصفوفة المخاطر|الاحتمالية.{0,30}(الأثر|العواقب|الشدة)/i, title: B('Likelihood × consequence', 'الاحتمالية × الأثر'),
    spec: { template: 'matrix', rows: 3, cols: 3, cells: [[B('Medium', 'متوسط'), B('High', 'مرتفع'), B('High', 'مرتفع')], [B('Low', 'منخفض'), B('Medium', 'متوسط'), B('High', 'مرتفع')], [B('Low', 'منخفض'), B('Low', 'منخفض'), B('Medium', 'متوسط')]] } },
  capa: { re: /corrective action|capa|إجراء تصحيحي|الإجراء التصحيحي|الإجراءات التصحيحية/i, title: B('From nonconformity to effective action', 'من عدم المطابقة إلى إجراء فعّال'),
    spec: { template: 'flow', steps: [{ t: B('Nonconformity', 'عدم المطابقة') }, { t: B('Correction', 'التصحيح') }, { t: B('Root cause', 'السبب الجذري') }, { t: B('Corrective action', 'الإجراء التصحيحي') }, { t: B('Effectiveness check', 'التحقق من الفعالية') }] } },
  audit: { re: /audit programme|audit program|audit process|conduct(ing)? (an )?audit|برنامج التدقيق|عملية التدقيق|تنفيذ التدقيق/i, title: B('The audit cycle', 'دورة التدقيق'),
    spec: { template: 'cycle', center: B('Audit', 'التدقيق'), steps: [st('Plan', 'التخطيط'), st('Conduct', 'التنفيذ'), st('Report', 'التقرير'), st('Follow up', 'المتابعة')] } },
  certification: { re: /accreditation|accredited|certification body|الاعتماد|جهة منح الشهادة|جهات منح الشهادات/i, title: B('Who does what', 'من يفعل ماذا'),
    spec: { template: 'flow', steps: [{ t: B('Standard (ISO)', 'المواصفة (ISO)') }, { t: B('Accreditation body', 'جهة الاعتماد') }, { t: B('Certification body', 'جهة منح الشهادة') }, { t: B('Organization', 'المنظمة') }] } },
  sipoc: { re: /sipoc|process approach|نهج العمليات|النهج القائم على العمليات/i, title: B('A process: SIPOC', 'العملية: SIPOC'),
    spec: { template: 'flow', steps: [{ t: B('Suppliers', 'الموردون'), tag: B('S', 'S') }, { t: B('Inputs', 'المدخلات'), tag: B('I', 'I') }, { t: B('Process', 'العملية'), tag: B('P', 'P') }, { t: B('Outputs', 'المخرجات'), tag: B('O', 'O') }, { t: B('Customers', 'العملاء'), tag: B('C', 'C') }] } },
  radar: { re: /radar|efqm/i, title: B('RADAR logic', 'منطق RADAR'),
    spec: { template: 'cycle', center: B('RADAR', 'RADAR'), steps: [st('Results', 'النتائج'), st('Approaches', 'المناهج'), st('Deploy', 'النشر'), st('Assess & refine', 'التقييم والتحسين')] } },
  lifecycle: { re: /project life ?cycle|initiat.{0,20}clos|دورة حياة المشروع/i, title: B('Project life cycle', 'دورة حياة المشروع'),
    spec: { template: 'flow', steps: [{ t: B('Initiate', 'البدء') }, { t: B('Plan', 'التخطيط') }, { t: B('Execute', 'التنفيذ') }, { t: B('Monitor', 'المراقبة') }, { t: B('Close', 'الإغلاق') }] } },
  pareto: { re: /pareto|80\/20|باريتو/i, title: B('Pareto: the vital few', 'باريتو: القلة الحيوية'),
    spec: { template: 'tiles', items: [{ icon: 'chart', t: B('Count by category', 'العدّ حسب الفئة') }, { icon: 'trend', t: B('Sort largest first', 'رتّب من الأكبر') }, { icon: 'target', t: B('Act on the vital few', 'ركّز على القلة الحيوية') }] } },
  triangulate: { re: /triangulat|interview.{0,40}observ.{0,40}record|مقابلة.{0,40}ملاحظة|قاطِع الأدلة/i, title: B('Three sources of evidence', 'ثلاثة مصادر للأدلة'),
    spec: { template: 'triad', corners: [B('Interviews', 'المقابلات'), B('Observation', 'المشاهدة'), B('Records', 'السجلات')], center: B('Evidence', 'الدليل') } },
  context: { re: /interested parties|context of the organi|الأطراف المعنية|سياق المنظمة/i, title: B('Context around the system', 'السياق حول النظام'),
    spec: { template: 'nested', rings: [{ t: B('External issues and interested parties', 'القضايا الخارجية والأطراف المعنية') }, { t: B('Internal issues', 'القضايا الداخلية') }, { t: B('Management system scope', 'نطاق نظام الإدارة') }] } }
};
export const MODEL_ORDER = ['pdca', 'dmaic', 'fishbone', 'whys', 'fmea', 'hierarchy', 'riskmatrix', 'capa', 'triangulate', 'audit', 'certification', 'sipoc', 'radar', 'lifecycle', 'pareto', 'context'];

/** Named models the lesson talks about (title first, then its text), at most `max`. */
export function modelsFor(texts = [], max = 2) {
  const out = [];
  for (const s of texts) for (const k of MODEL_ORDER) if (!out.includes(k) && MODELS[k].re.test(String(s))) out.push(k);
  return out.slice(0, max);
}

/* ------------------------------------------------------------------ the deck */
/**
 * Build the slides of one lesson. `lesson`: course lesson; `item`: its guide item (guide lessons) or null; `course`;
 * `figures`: published figures already placed on this lesson; `lang`.
 * Slide kinds: cover · goals · idea · model · figure · steps · example · compare · scenario · avoid · evidence · tips · summary.
 * Every text comes from the lesson record or its guide item; `src` names the block so the deck can be checked against it.
 */
export function buildDeck({ lesson = {}, item = null, course = {}, figures = [], lang = 'en' } = {}) {
  const L = v => T(v, lang);
  const blocks = Object.fromEntries((lesson.content_blocks || []).map(b => [b.type, L(b.text)]));
  const title = L(lesson.title);
  const slides = [];
  const add = s => { if (slides.length < MAX_SLIDES) slides.push(s); };

  add({ kind: 'cover', icon: iconFor(title + ' ' + L(course.title), 'book'), title, kicker: L(course.title), minutes: lesson.estimated_minutes || null, src: 'title' });
  const goals = (lesson.objectives || []).map(L).filter(Boolean);
  if (goals.length) add({ kind: 'goals', icon: 'target', points: goals.slice(0, MAX_POINTS).map(g => ({ icon: iconFor(g, 'target'), text: shorten(g) })), src: 'objectives' });

  const ideaText = item ? L(item.req) : blocks.concept;
  if (ideaText) add({ kind: 'idea', icon: iconFor(ideaText), points: sentences(ideaText).map(s => ({ icon: iconFor(s), text: s })), src: item ? 'item.req' : 'concept' });

  const models = modelsFor([title, L(course.title), ideaText || '', blocks.worked_example || '', L(item?.ex)]);
  for (const k of models) add({ kind: 'model', icon: 'image', model: k, title: L(MODELS[k].title), spec: MODELS[k].spec, src: 'model' });
  for (const f of (figures || []).slice(0, 2)) add({ kind: 'figure', icon: 'image', figure: f, title: L(f.caption), src: 'figure:' + f.id });

  const how = (item?.how || []).map(L).filter(Boolean);
  if (how.length) add({ kind: 'steps', icon: 'steps', points: how.slice(0, 6).map((s, i) => ({ n: i + 1, icon: iconFor(s, 'chevron'), text: shorten(s, 24) })), src: 'item.how' });

  const exText = item ? L(item.ex) : blocks.worked_example;
  if (exText) {
    const pair = quotedPair(exText);
    if (pair) add({ kind: 'compare', icon: 'scale', before: shorten(pair[0], 30), after: shorten(pair[1], 40), note: sentences(exText.replace(/[“"«][^”"»]*[”"»]/gu, '…'), 1)[0] || '', src: item ? 'item.ex' : 'worked_example' });
    else add({ kind: 'example', icon: iconFor(exText, 'spark'), points: sentences(exText, 3).map(s => ({ icon: iconFor(s, 'spark'), text: s })), src: item ? 'item.ex' : 'worked_example' });
  }
  if (blocks.scenario) add({ kind: 'scenario', icon: 'users', text: shorten(blocks.scenario, 60), src: 'scenario' });

  const mistakes = item ? (item.gaps || []).map(L).filter(Boolean) : (blocks.common_mistake ? sentences(blocks.common_mistake, 3) : []);
  const evidence = item ? (item.ev || []).map(L).filter(Boolean) : (blocks.evidence ? sentences(blocks.evidence, 3) : []);
  if (mistakes.length && evidence.length) add({ kind: 'avoid', icon: 'alert', avoid: mistakes.slice(0, 3).map(s => shorten(s, 20)), show: evidence.slice(0, 3).map(s => shorten(s, 20)), src: item ? 'item.gaps+ev' : 'common_mistake+evidence' });
  else if (evidence.length) add({ kind: 'evidence', icon: 'doc', points: evidence.slice(0, MAX_POINTS).map(s => ({ icon: 'check', text: shorten(s, 22) })), src: item ? 'item.ev' : 'evidence' });
  else if (mistakes.length) add({ kind: 'evidence', icon: 'alert', warn: true, points: mistakes.slice(0, MAX_POINTS).map(s => ({ icon: 'alert', text: shorten(s, 22) })), src: item ? 'item.gaps' : 'common_mistake' });

  const tips = [...(item?.tips || []), ...(item?.checks || [])].map(L).filter(Boolean);
  if (tips.length) add({ kind: 'tips', icon: 'bulb', points: tips.slice(0, MAX_POINTS).map(s => ({ icon: iconFor(s, 'bulb'), text: shorten(s, 22) })), src: 'item.tips+checks' });

  /* Summary: the first sentence of the main idea, the example and the evidence — what to remember. */
  const take = [ideaText, exText, evidence[0] || mistakes[0]].map(x => (x ? sentences(x, 1)[0] : null)).filter(Boolean);
  add({ kind: 'summary', icon: 'star', points: take.slice(0, 3).map(s => ({ icon: iconFor(s, 'check'), text: s })), src: 'summary' });
  return slides;
}
