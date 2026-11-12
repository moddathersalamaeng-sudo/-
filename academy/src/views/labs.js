/**
 * Practice Labs (Phase 11).
 *
 *  #/labs?academy=          labsIndexView — every published lab by academy (the EFQM Assessment Lab is linked, not rebuilt)
 *  #/labs/:slug?attempt=n   labView       — scenario → tasks → "Check my answers" → explained feedback → attempt record
 *
 * Labs live inside the five-item structure: each academy's "Tools & labs" section lists its labs (labsToolPanel), courses
 * and lessons link to the lab that practises them (practiceLinks), My space → Progress lists attempts. Answers in progress are
 * kept in cia:v1:<user>:lab_drafts; submitted attempts in cia:v1:<user>:lab_attempts. Results are practice evidence, not a
 * certification; written answers stay "pending human review" and never count until a person scores them.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, EmptyState, Badge, Button, Table, toast } from '../ui/components.js';
import { L, linkBtn, isReviewer, previewBanner, notAvailable, minutes, facts, toolLink, setHashQuery } from '../ui/academy.js';
import { BookmarkButton } from '../ui/bookmark.js';
import { courseCover } from '../ui/art.js';
import { Figure } from '../ui/figures.js';
import { isVisible, validateGovernance } from '../data/governance.js';
import { ACADEMIES, academyByKey } from '../domain/academies.mjs';
import { LAB_UNKNOWN, LAB_AUTO_TYPES, validateResponses, makeLabAttempt, attemptsFor, nextAttemptNo, shuffledIds, moveItem, exportAttempt, labProgress, gradeTask, verdictOf } from '../domain/labs.mjs';

const VERDICT_TONE = { correct: 'ok', reviewed: 'ok', partial: 'warn', incorrect: 'bad', unknown: 'neutral', pending: 'info' };
export const labHref = lab => `#/labs/${lab.slug}`;
const academyName = (ctx, key) => ctx.t('nav.items.' + (academyByKey(key)?.navId || 'isoAcademy'));

/* ------------------------------------------------------------------ data */

export async function loadLabsIndex(ctx) {
  return ctx.repos.labsIndex ? ctx.repos.labsIndex.listVisible(ctx.session.roles).catch(err => { console.warn('[cia] labs index failed:', err?.message); return []; }) : [];
}

/** Full record of one lab from its academy shard, or null when missing or not visible to this viewer. */
export async function loadFullLab(ctx, light) {
  if (!light) return null;
  if (light.split?.full !== false || !ctx.split) return light;
  const shard = await ctx.split.readShards('labs', [light.split.academy]);
  const full = shard.find(x => x.id === light.id);
  return full && validateGovernance(full).length === 0 && isVisible(full, ctx.session.roles) ? full : null;
}

const draftBadge = (ctx, lab) => lab.governance?.content_status !== 'published' ? Badge({ label: ctx.t('lab11.preview'), tone: 'warn' }) : null;

/* ------------------------------------------------------------------ cards and panels (academy landings, index) */

export function labCard(ctx, lab, row = null) {
  const { t, i18n } = ctx;
  const status = row ? (row.awaiting ? Badge({ label: t('lab11.awaitingShort'), tone: 'info' }) : Badge({ label: t('lab11.bestScore', { n: i18n.number(row.best) }), tone: row.passed ? 'ok' : 'neutral' })) : null;
  return h('article', { class: 'card lab-card', dataset: { lab: lab.id } },
    h('div', { class: 'lab-cover' }, courseCover({ id: lab.id, code: lab.code }, { family: academyByKey(lab.academy)?.family || 'iso', topic: lab.cover, compact: true })),
    h('div', { class: 'lab-card-body' },
      h('p', { class: 'eyebrow' }, icon('flask'), ' ', t('lab11.eyebrow'), ' · ', t('lab11.kind.' + lab.kind)),
      h('h3', null, h('a', { href: labHref(lab), dataset: { action: 'open-lab' } }, L(ctx, lab.title))),
      h('p', { class: 'note' }, L(ctx, lab.summary)),
      h('p', { class: 'lab-meta' }, icon('clock'), ' ', minutes(ctx, lab.minutes), ' · ', t('lab11.tasks', { n: i18n.number(lab.task_count || lab.tasks?.length || 0) }), ' ', status, ' ', draftBadge(ctx, lab))));
}

/** The "Practice labs" panel inside an academy's "Tools & labs" section (loads itself; never blanks the landing). */
export function labsToolPanel(ctx, academyKey) {
  const { t } = ctx;
  return dataRegion({ t, load: async () => ({ labs: (await loadLabsIndex(ctx)).filter(l => l.academy === academyKey), attempts: await ctx.repos.labAttempts.list().catch(() => []) }), render: ({ labs, attempts }) => {
    const rows = new Map(labProgress(labs, attempts).map(r => [r.lab.id, r]));
    return h('div', { class: 'panel tool-panel labs-panel', dataset: { labsPanel: academyKey, count: String(labs.length) } },
      h('h3', null, icon('flask'), ' ', t('lab11.panelTitle')),
      h('p', null, t('lab11.panelBody')),
      labs.length ? h('ul', { class: 'plain lab-mini' }, labs.map(l => h('li', { dataset: { lab: l.id } },
        h('a', { href: labHref(l), dataset: { action: 'open-lab' } }, L(ctx, l.title)), ' ', h('span', { class: 'note' }, minutes(ctx, l.minutes)), ' ',
        rows.get(l.id) ? Badge({ label: rows.get(l.id).awaiting ? t('lab11.awaitingShort') : t('lab11.bestScore', { n: ctx.i18n.number(rows.get(l.id).best) }), tone: 'neutral' }) : null, ' ', draftBadge(ctx, l))))
        : h('p', { class: 'note' }, t('lab11.panelEmpty')),
      h('p', null, h('a', { href: '#/labs', dataset: { action: 'all-labs' } }, t('lab11.allLabs'), ' ', icon('chevron'))));
  } });
}

/** Links from a course page or lesson to the labs that practise it. */
export function practiceLinks(ctx, labs = [], { courseId = null, lessonId = null } = {}) {
  const { t } = ctx;
  const hits = labs.filter(l => (lessonId && (l.lessons || []).includes(lessonId)) || (!lessonId && courseId && (l.courses || []).includes(courseId)));
  const more = lessonId ? labs.filter(l => !hits.includes(l) && courseId && (l.courses || []).includes(courseId)) : [];
  const list = [...hits, ...more].slice(0, 3);
  if (!list.length) return null;
  return h('aside', { class: 'panel practice-links', 'aria-labelledby': 'pl-h' + (lessonId || courseId), dataset: { practice: String(list.length) } },
    h('h2', { class: 'h-sm', id: 'pl-h' + (lessonId || courseId) }, icon('flask'), ' ', t(lessonId ? 'lab11.practiseLesson' : 'lab11.practiseCourse')),
    h('ul', { class: 'plain' }, list.map(l => h('li', null, h('a', { href: labHref(l), dataset: { action: 'practice-lab', lab: l.id } }, L(ctx, l.title)), ' · ', h('span', { class: 'note' }, minutes(ctx, l.minutes))))));
}

/* ------------------------------------------------------------------ #/labs */

export function labsIndexView(ctx, match) {
  const { t } = ctx;
  const want = match.query?.academy || '';
  const region = dataRegion({ t, load: async () => ({ labs: await loadLabsIndex(ctx), attempts: await ctx.repos.labAttempts.list().catch(() => []),
    efqm: await ctx.repos.excellence.listVisible(ctx.session.roles).then(xs => xs.find(x => x.id === 'LAB-EFQM') || null).catch(() => null) }), render: ({ labs, attempts, efqm }) => {
    const rows = new Map(labProgress(labs, attempts).map(r => [r.lab.id, r]));
    const groups = ACADEMIES.filter(a => !want || a.key === want).map(a => ({ a, xs: labs.filter(l => l.academy === a.key) }));
    return h('div', null,
      h('header', { class: 'phead' }, h('p', { class: 'eyebrow' }, icon('flask'), ' ', t('lab11.eyebrow')), h('h1', null, t('lab11.indexTitle')), h('p', null, t('lab11.indexLede')),
        h('p', { class: 'banner banner-info', role: 'note' }, icon('shield'), ' ', t('lab11.honesty'))),
      previewBanner(ctx, labs),
      groups.map(({ a, xs }) => h('section', { class: 'section', 'aria-labelledby': 'lg-' + a.key, dataset: { academy: a.key } },
        h('h2', { id: 'lg-' + a.key }, academyName(ctx, a.key)),
        xs.length ? h('div', { class: 'cards lab-cards' }, xs.map(l => labCard(ctx, l, rows.get(l.id)))) : null,
        a.key === 'excellence' && efqm ? h('div', { class: 'panel lab-link-efqm', dataset: { lab: 'LAB-EFQM' } }, h('h3', null, icon('clipboard'), ' ', t('ex10.labTitle')), h('p', null, t('ex10.labBody')),
          linkBtn('#/academy/excellence/lab', t('ex10.labCta'), 'secondary', { 'data-action': 'open-efqm-lab' })) : null,
        !xs.length && !(a.key === 'excellence' && efqm) ? h('p', { class: 'note' }, t('lab11.panelEmpty')) : null)),
      !labs.length && !efqm ? EmptyState({ title: t('lab11.noneTitle'), body: t('lab11.noneBody'), iconName: 'lock', level: 2 }) : null);
  } });
  return h('div', { class: 'labs-index' }, region);
}

/* ------------------------------------------------------------------ #/labs/:slug */

export function labView(ctx, match) {
  const { t } = ctx;
  const slug = match.params.slug;
  const region = dataRegion({ t, load: async () => {
    const labs = await loadLabsIndex(ctx);
    const light = labs.find(l => l.slug === slug) || null;
    const lab = light ? await loadFullLab(ctx, light) : null;
    const [attempts, draft, figures] = await Promise.all([ctx.repos.labAttempts.list().catch(() => []), lab ? ctx.repos.labDrafts.get(lab.id).catch(() => null) : null,
      lab ? ctx.repos.figures.listVisible(ctx.session.roles).catch(() => []) : []]);
    const courses = lab ? await (ctx.repos.coursesIndex || ctx.repos.courses).listVisible(ctx.session.roles).catch(() => []) : [];
    const tools = lab ? await ctx.repos.platformModules.listVisible(ctx.session.roles).catch(() => []) : [];
    const templates = lab ? await ctx.repos.smartTemplates.listVisible(ctx.session.roles).catch(() => []) : [];
    const guides = {};
    for (const g of [...new Set((lab?.refs || []).map(r => r.guide))]) guides[g] = await ctx.loadGuide(g).catch(() => null);
    return { lab, attempts, draft, figures, courses, tools, templates, guides };
  }, render: d => {
    if (!d.lab) return notAvailable(ctx, { title: t('lab11.notFound'), body: t('lab11.notFoundBody'), action: linkBtn('#/labs', t('lab11.indexTitle')) });
    ctx.setTrail?.([{ label: academyName(ctx, d.lab.academy), href: '#' + academyByKey(d.lab.academy).route }, { label: t('lab11.indexTitle'), href: '#/labs' }], L(ctx, d.lab.title));
    return labPage(ctx, d, match);
  } });
  return h('div', { class: 'lab-page' }, region);
}

function refName(guides, r) {
  const g = guides[r.guide];
  for (const cl of g?.clauses || []) for (const it of cl.items || []) if (it.ref === r.ref) return it.title;
  return null;
}

function scenarioBlock(ctx, lab) {
  const { t } = ctx;
  const sc = lab.scenario;
  const exhibit = x => h('div', { class: 'exhibit', dataset: { exhibit: x.id } }, h('h3', { class: 'h-sm' }, icon('doc'), ' ', L(ctx, x.title)),
    x.text ? h('p', null, L(ctx, x.text)) : null,
    x.rows ? Table({ caption: L(ctx, x.title), columns: x.columns.map((c, i) => ({ key: 'c' + i, label: L(ctx, c) })), rows: x.rows.map(r => Object.fromEntries(r.map((v, i) => ['c' + i, L(ctx, v)]))) }) : null);
  return h('section', { class: 'section lab-scenario', 'aria-labelledby': 'lab-sc-h' },
    h('h2', { id: 'lab-sc-h' }, icon('book'), ' ', t('lab11.scenario'), ': ', L(ctx, sc.title)),
    sc.context.map(p => h('p', null, L(ctx, p))),
    sc.facts?.length ? facts(sc.facts.map(f => [L(ctx, f.label), L(ctx, f.value)])) : null,
    (sc.exhibits || []).length ? h('div', { class: 'exhibits' }, sc.exhibits.map(exhibit)) : null);
}

function labPage(ctx, d, match) {
  const { t, i18n } = ctx;
  const { lab } = d;
  const mine = attemptsFor(d.attempts, lab.id);
  const fig = (lab.figures || []).map(id => d.figures.find(f => f.id === id)).filter(Boolean);
  const relCourses = (lab.courses || []).map(id => d.courses.find(c => c.id === id)).filter(Boolean);
  const relTools = (lab.toolkits || []).map(id => d.tools.find(m => m.id === id)).filter(Boolean);
  const relTpl = (lab.templates || []).map(id => d.templates.find(x => x.id === id)).filter(Boolean);
  const refs = (lab.refs || []).map(r => ({ r, name: refName(d.guides, r) })).filter(x => x.name);

  const hero = h('header', { class: 'lab-hero', dataset: { family: academyByKey(lab.academy)?.family } },
    h('div', { class: 'lab-hero-cover' }, courseCover({ id: lab.id, code: lab.code }, { family: academyByKey(lab.academy)?.family || 'iso', topic: lab.cover, code: lab.code })),
    h('div', { class: 'lab-hero-text' },
      h('p', { class: 'eyebrow' }, icon('flask'), ' ', academyName(ctx, lab.academy), ' · ', t('lab11.eyebrow'), ' ', draftBadge(ctx, lab)),
      h('h1', null, L(ctx, lab.title)),
      h('p', null, L(ctx, lab.summary)),
      h('ul', { class: 'lab-facts' }, h('li', null, icon('clock'), ' ', minutes(ctx, lab.minutes)), h('li', null, icon('clipboard'), ' ', t('lab11.tasks', { n: i18n.number(lab.tasks.length) })),
        h('li', null, icon('target'), ' ', t('lab11.passMark', { n: i18n.number(lab.pass_mark) })), mine.length ? h('li', null, icon('chart'), ' ', t('lab11.attemptsN', { n: i18n.number(mine.length) })) : null),
      h('div', { class: 'btnrow' }, BookmarkButton(ctx, { type: 'lab', id: lab.id, href: labHref(lab), title: lab.title }))));
  const label = h('p', { class: 'banner banner-warn lab-label', role: 'note', dataset: { labLabel: 'true' } }, icon('shield'), ' ', h('strong', null, L(ctx, lab.label)), ' — ', t('lab11.honesty'));
  const objectives = lab.objectives?.length ? h('section', { class: 'section', 'aria-labelledby': 'lab-obj-h' }, h('h2', { id: 'lab-obj-h', class: 'h-sm' }, t('lab11.objectives')),
    h('ul', null, lab.objectives.map(o => h('li', null, L(ctx, o))))) : null;

  const work = h('div', { class: 'lab-work' });
  const side = h('div', { class: 'lab-related' },
    fig.length ? h('section', { class: 'section', 'aria-labelledby': 'lab-fig-h' }, h('h2', { id: 'lab-fig-h', class: 'h-sm' }, icon('image'), ' ', t('lab11.figure')), fig.map(f => Figure(ctx, f))) : null,
    refs.length ? h('section', { class: 'section', 'aria-labelledby': 'lab-ref-h' }, h('h2', { id: 'lab-ref-h', class: 'h-sm' }, icon('book'), ' ', t('lab11.criteria')),
      h('ul', { class: 'plain' }, refs.map(({ r, name }) => h('li', null, h('a', { href: `#/guides/${r.guide}/${encodeURIComponent(r.ref)}` }, r.ref, ' ', L(ctx, name))))),
      h('p', { class: 'note' }, t('lab11.criteriaNote'))) : null,
    relCourses.length || relTpl.length || relTools.length ? h('section', { class: 'section', 'aria-labelledby': 'lab-rel-h' }, h('h2', { id: 'lab-rel-h', class: 'h-sm' }, icon('link'), ' ', t('lab11.related')),
      relCourses.length ? h('div', null, h('h3', { class: 'h-sm' }, t('lab11.relCourses')), h('ul', { class: 'plain' }, relCourses.map(c => h('li', null, h('a', { href: `#/academy/courses/${c.slug}` }, L(ctx, c.title)))))) : null,
      relTpl.length ? h('div', null, h('h3', { class: 'h-sm' }, t('lab11.relTemplates')), h('ul', { class: 'plain' }, relTpl.map(x => h('li', null, h('a', { href: `#/templates/${x.slug}` }, L(ctx, x.title)))))) : null,
      relTools.length ? h('div', null, h('h3', { class: 'h-sm' }, t('lab11.relTools')), h('ul', { class: 'tools-mini' }, relTools.map(m => h('li', null, toolLink(ctx, m))))) : null) : null);

  const state = { attempts: [...d.attempts] };
  const showAttempt = (no) => {
    const at = attemptsFor(state.attempts, lab.id).find(a => a.attempt_no === no);
    if (!at) { showForm(); return; }
    setHashQuery(`/labs/${lab.slug}`, { attempt: no });
    work.replaceChildren(resultView(ctx, lab, at, { onRetry: () => { setHashQuery(`/labs/${lab.slug}`, {}); showForm(true); }, history: attemptsFor(state.attempts, lab.id), onOpen: showAttempt }));
  };
  const showForm = (focus = false) => {
    work.replaceChildren(formView(ctx, lab, { draft: d.draft, attemptNo: nextAttemptNo(state.attempts, lab.id), history: attemptsFor(state.attempts, lab.id), onOpen: showAttempt,
      onSubmit: async (attempt) => {
        await ctx.repos.labAttempts.save(attempt);
        await ctx.repos.labDrafts.remove(lab.id).catch(() => {});
        d.draft = null;
        state.attempts = [...state.attempts.filter(a => a.id !== attempt.id), attempt];
        toast(t('lab11.saved'));
        showAttempt(attempt.attempt_no);
        work.querySelector('.lab-result-head')?.focus();
      } }));
    if (focus) work.querySelector('.lab-task legend')?.closest('fieldset')?.querySelector('input,select,textarea,button')?.focus();
  };
  const want = Number(match.query?.attempt);
  if (want && mine.some(a => a.attempt_no === want)) showAttempt(want); else showForm();

  return h('div', { class: 'lab' }, hero, label, previewBanner(ctx, [lab]), objectives, scenarioBlock(ctx, lab), h('div', { class: 'lab-grid' }, work, side));
}

/* ------------------------------------------------------------------ the task form */

function formView(ctx, lab, { draft, attemptNo, history, onOpen, onSubmit }) {
  const { t, i18n } = ctx;
  const answers = { ...(draft?.answers || {}) };
  const selfCheck = { ...(draft?.self_check || {}) };
  const seed = `${lab.id}#${attemptNo}`;
  let timer = null;
  const status = h('p', { class: 'note lab-status', role: 'status', 'aria-live': 'polite', dataset: { saved: draft ? 'restored' : 'idle' } }, draft ? t('lab11.restored') : '');
  const persist = () => { clearTimeout(timer); timer = setTimeout(async () => {
    try { await ctx.repos.labDrafts.save({ id: lab.id, answers, self_check: selfCheck, updated_at: new Date().toISOString() }); status.dataset.saved = 'ok'; status.textContent = t('lab11.draftSaved'); }
    catch { status.dataset.saved = 'error'; status.textContent = t('lab11.draftFailed'); }
  }, 300); };
  const set = (id, v) => { answers[id] = v; persist(); const fs = form.querySelector(`[data-task="${id}"]`); if (fs) { fs.removeAttribute('aria-invalid'); fs.querySelector('.field-error')?.setAttribute('hidden', ''); } };

  const unknownBox = (task, onToggle) => {
    const id = `lt-${task.id}-unknown`;
    return h('label', { class: 'choice lab-unknown', for: id }, h('input', { type: 'checkbox', id, checked: answers[task.id] === LAB_UNKNOWN, dataset: { unknown: task.id },
      onchange: e => onToggle(e.target.checked) }), t('p7.asm.unknown'));
  };

  const control = (task) => {
    const p = `lt-${task.id}`;
    switch (task.type) {
      case 'single_choice': {
        const ids = shuffledIds(task.options.map(o => o.id), seed + task.id);
        return h('div', { class: 'lab-opts' }, ids.map(oid => { const o = task.options.find(x => x.id === oid);
          return h('label', { class: 'choice', for: `${p}-${oid}` }, h('input', { type: 'radio', id: `${p}-${oid}`, name: p, value: oid, checked: answers[task.id] === oid, onchange: () => set(task.id, oid) }), L(ctx, o.text)); }),
        h('label', { class: 'choice lab-unknown', for: `${p}-unknown` }, h('input', { type: 'radio', id: `${p}-unknown`, name: p, value: LAB_UNKNOWN, checked: answers[task.id] === LAB_UNKNOWN, dataset: { unknown: task.id }, onchange: () => set(task.id, LAB_UNKNOWN) }), t('p7.asm.unknown')));
      }
      case 'multi_select': {
        const ids = shuffledIds(task.options.map(o => o.id), seed + task.id);
        const box = h('div', { class: 'lab-opts' });
        const read = () => [...box.querySelectorAll('input[data-opt]:checked')].map(x => x.value);
        const unk = unknownBox(task, on => { if (on) { box.querySelectorAll('input[data-opt]').forEach(x => { x.checked = false; }); set(task.id, LAB_UNKNOWN); } else set(task.id, read()); });
        box.append(...ids.map(oid => { const o = task.options.find(x => x.id === oid);
          return h('label', { class: 'choice', for: `${p}-${oid}` }, h('input', { type: 'checkbox', id: `${p}-${oid}`, value: oid, dataset: { opt: oid }, checked: Array.isArray(answers[task.id]) && answers[task.id].includes(oid),
            onchange: () => { unk.querySelector('input').checked = false; set(task.id, read()); } }), L(ctx, o.text)); }), unk);
        return box;
      }
      case 'ordering': {
        const key = task.items.map(x => x.id);
        let list = Array.isArray(answers[task.id]) && answers[task.id].length === key.length ? [...answers[task.id]] : shuffledIds(key, seed + task.id);
        const ol = h('ol', { class: 'lab-order', 'aria-label': t('lab11.orderList') });
        const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
        const paint = (focusId, dir) => {
          ol.replaceChildren(...list.map((id, i) => { const it = task.items.find(x => x.id === id); const name = L(ctx, it.text);
            return h('li', { dataset: { item: id } }, h('span', { class: 'ord-n' }, i18n.number(i + 1)), h('span', { class: 'ord-t' }, name),
              h('span', { class: 'ord-btns' },
                h('button', { type: 'button', class: 'iconbtn', disabled: i === 0, 'aria-label': t('lab11.moveUp', { name }), dataset: { move: 'up', item: id }, onclick: () => { list = moveItem(list, i, -1); set(task.id, [...list]); paint(id, 'up'); live.textContent = t('lab11.moved', { name, n: i18n.number(i) }); } }, icon('caret')),
                h('button', { type: 'button', class: 'iconbtn ord-down', disabled: i === list.length - 1, 'aria-label': t('lab11.moveDown', { name }), dataset: { move: 'down', item: id }, onclick: () => { list = moveItem(list, i, 1); set(task.id, [...list]); paint(id, 'down'); live.textContent = t('lab11.moved', { name, n: i18n.number(i + 2) }); } }, icon('caret')))); }));
          if (focusId) { const b = ol.querySelector(`[data-item="${focusId}"] [data-move="${dir}"]:not([disabled])`) || ol.querySelector(`[data-item="${focusId}"] button:not([disabled])`); b?.focus(); }
        };
        /* The order counts as an answer only after the learner moves a step or confirms the order shown (never pre-filled). */
        paint();
        const unk = unknownBox(task, on => { if (on) set(task.id, LAB_UNKNOWN); else if (Array.isArray(answers[task.id])) set(task.id, [...list]); else { delete answers[task.id]; persist(); } });
        const keep = h('button', { type: 'button', class: 'btn btn-quiet', dataset: { action: 'confirm-order', task: task.id }, onclick: () => { unk.querySelector('input').checked = false; set(task.id, [...list]); live.textContent = t('lab11.orderConfirmed'); } }, icon('check'), ' ', t('lab11.orderKeep'));
        return h('div', null, h('p', { class: 'hint' }, t('lab11.orderHint')), ol, live, h('div', { class: 'btnrow' }, keep), unk);
      }
      case 'classify': {
        const a = answers[task.id] && typeof answers[task.id] === 'object' ? { ...answers[task.id] } : {};
        const box = h('div', { class: 'lab-classify' });
        const unk = unknownBox(task, on => { if (on) { box.querySelectorAll('select').forEach(s => { s.value = ''; }); set(task.id, LAB_UNKNOWN); } else set(task.id, { ...a }); });
        box.append(h('ul', { class: 'plain' }, task.items.map(it => { const sid = `${p}-${it.id}`;
          return h('li', { class: 'cls-row' }, h('label', { for: sid }, L(ctx, it.text)),
            h('select', { class: 'select', id: sid, dataset: { item: it.id }, onchange: e => { a[it.id] = e.target.value; Object.keys(a).forEach(k => { if (!a[k]) delete a[k]; }); unk.querySelector('input').checked = false; set(task.id, { ...a }); } },
              h('option', { value: '' }, t('pf.choose')), task.categories.map(c => h('option', { value: c.id, selected: a[it.id] === c.id }, L(ctx, c.label))))); })), unk);
        return box;
      }
      case 'numeric': {
        const inp = h('input', { class: 'input input-short', id: `${p}-value`, type: 'text', inputmode: 'decimal', autocomplete: 'off', value: answers[task.id] === LAB_UNKNOWN ? '' : (answers[task.id] ?? ''),
          'aria-describedby': `${p}-err`, oninput: e => { unk.querySelector('input').checked = false; set(task.id, e.target.value); } });
        const unk = unknownBox(task, on => { if (on) { inp.value = ''; set(task.id, LAB_UNKNOWN); } else set(task.id, inp.value); });
        return h('div', { class: 'lab-num' }, h('label', { for: `${p}-value` }, t('lab11.yourValue')), ' ', inp, ' ', h('span', { class: 'note' }, L(ctx, task.unit)), unk);
      }
      case 'free_text': {
        const ticks = new Set(selfCheck[task.id] || []);
        const count = h('span', { class: 'note', 'aria-live': 'off' });
        const ta = h('textarea', { class: 'textarea', id: `${p}-text`, rows: 6, maxlength: 4000, 'aria-describedby': `${p}-rubric ${p}-err`,
          oninput: e => { set(task.id, e.target.value); count.textContent = t('lab11.chars', { n: i18n.number(e.target.value.trim().length), min: i18n.number(task.min_chars) }); } }, answers[task.id] || '');
        count.textContent = t('lab11.chars', { n: i18n.number(String(answers[task.id] || '').trim().length), min: i18n.number(task.min_chars) });
        return h('div', { class: 'lab-free' }, h('label', { for: `${p}-text` }, t('lab11.yourAnswer')), ta, count,
          h('div', { class: 'lab-rubric', id: `${p}-rubric` }, h('p', { class: 'note' }, icon('info'), ' ', t('lab11.rubricNote')),
            h('fieldset', { class: 'fs' }, h('legend', null, t('lab11.selfCheck')), task.rubric.map(r => h('label', { class: 'choice', for: `${p}-${r.id}` },
              h('input', { type: 'checkbox', id: `${p}-${r.id}`, checked: ticks.has(r.id), dataset: { self: r.id }, onchange: e => { if (e.target.checked) ticks.add(r.id); else ticks.delete(r.id); selfCheck[task.id] = [...ticks]; persist(); } }), L(ctx, r.text))))));
      }
      default: return h('p', null, '—');
    }
  };

  const taskBlock = (task, i) => h('fieldset', { class: 'lab-task', id: `task-${task.id}`, dataset: { task: task.id, type: task.type } },
    h('legend', null, h('span', { class: 'task-no' }, t('lab11.taskN', { n: i18n.number(i + 1), total: i18n.number(lab.tasks.length) })), ' ', h('span', { class: 'task-prompt' }, L(ctx, task.prompt))),
    h('p', { class: 'task-meta note' }, Badge({ label: t(LAB_AUTO_TYPES.includes(task.type) ? 'lab11.autoScored' : 'lab11.humanScored'), tone: LAB_AUTO_TYPES.includes(task.type) ? 'neutral' : 'info' }), ' ', t('lab11.points', { n: i18n.number(task.weight) })),
    task.hint ? h('details', { class: 'task-hint' }, h('summary', null, icon('bulb'), ' ', t('lab11.hint')), h('p', null, L(ctx, task.hint))) : null,
    control(task),
    h('p', { class: 'field-error', id: `lt-${task.id}-err`, role: 'alert', hidden: true }));

  const errBox = h('div', { class: 'errsum', tabindex: '-1', hidden: true, dataset: { errors: '0' } });
  const form = h('form', { class: 'lab-form-main', novalidate: true, 'aria-labelledby': 'lab-tasks-h', onsubmit: e => {
    e.preventDefault();
    const problems = validateResponses(lab, answers);
    form.querySelectorAll('.lab-task').forEach(fs => { fs.removeAttribute('aria-invalid'); fs.querySelector('.field-error').hidden = true; });
    if (problems.length) {
      for (const p of problems) { const fs = form.querySelector(`[data-task="${p.task_id}"]`); fs.setAttribute('aria-invalid', 'true'); const er = fs.querySelector('.field-error'); er.hidden = false; er.textContent = t('lab11.err.' + p.code); }
      errBox.hidden = false; errBox.dataset.errors = String(problems.length);
      errBox.replaceChildren(h('p', null, h('strong', null, t('lab11.errTitle', { n: i18n.number(problems.length) }))),
        h('ul', null, problems.map(p => { const i = lab.tasks.findIndex(x => x.id === p.task_id);
          return h('li', null, h('a', { href: `#task-${p.task_id}`, onclick: ev => { ev.preventDefault(); const fs = form.querySelector(`[data-task="${p.task_id}"]`); fs.scrollIntoView({ block: 'center' }); fs.querySelector('input,select,textarea,button')?.focus(); } },
            t('lab11.taskN', { n: i18n.number(i + 1), total: i18n.number(lab.tasks.length) }), ' — ', t('lab11.err.' + p.code))); })));
      errBox.focus();
      return;
    }
    clearTimeout(timer);
    onSubmit(makeLabAttempt(lab, answers, { attemptNo, selfCheck }));
  } },
    h('h2', { id: 'lab-tasks-h' }, icon('clipboard'), ' ', t('lab11.yourTasks'), ' ', h('span', { class: 'note' }, t('lab11.attemptNo', { n: i18n.number(attemptNo) }))),
    h('p', { class: 'note' }, t('lab11.formNote')), status, errBox,
    lab.tasks.map(taskBlock),
    h('div', { class: 'btnrow lab-submit' }, h('button', { type: 'submit', class: 'btn btn-primary', dataset: { action: 'submit-lab' } }, icon('check'), ' ', t('lab11.submit')),
      Button({ label: t('lab11.clear'), variant: 'quiet', attrs: { 'data-action': 'clear-lab' }, onClick: async () => { await ctx.repos.labDrafts.remove(lab.id).catch(() => {}); Object.keys(answers).forEach(k => delete answers[k]); Object.keys(selfCheck).forEach(k => delete selfCheck[k]);
        const fresh = formView(ctx, lab, { draft: null, attemptNo, history, onOpen, onSubmit }); form.closest('.lab-work')?.replaceChildren(fresh); toast(t('lab11.cleared')); } })));
  return h('div', null, form, historyBlock(ctx, lab, history, onOpen));
}

/* ------------------------------------------------------------------ feedback */

function answerSummary(ctx, task, answer, g) {
  const { t, i18n } = ctx;
  if (answer === LAB_UNKNOWN) return h('p', null, t('lab11.youUnknown'));
  switch (task.type) {
    case 'single_choice': {
      const chosen = task.options.find(o => o.id === answer), right = task.options.find(o => o.id === task.correct);
      return h('div', null, h('p', null, h('strong', null, t('lab11.yourChoice')), ' ', L(ctx, chosen?.text), chosen ? h('span', { class: 'note block' }, L(ctx, chosen.why)) : null),
        chosen?.id !== right.id ? h('p', null, h('strong', null, t('lab11.rightChoice')), ' ', L(ctx, right.text), h('span', { class: 'note block' }, L(ctx, right.why))) : null);
    }
    case 'multi_select':
      return h('ul', { class: 'plain fb-opts' }, task.options.map(o => { const picked = Array.isArray(answer) && answer.includes(o.id); const ok = picked === o.correct;
        return h('li', { dataset: { ok: String(ok) } }, icon(ok ? 'check' : 'close'), ' ', L(ctx, o.text), ' ', Badge({ label: t(o.correct ? 'lab11.shouldPick' : 'lab11.shouldSkip'), tone: 'neutral' }), picked ? [' ', Badge({ label: t('lab11.youPicked'), tone: 'info' })] : null,
          h('span', { class: 'note block' }, L(ctx, o.why))); }));
    case 'ordering':
      return h('div', null, h('p', null, h('strong', null, t('lab11.rightOrder'))), h('ol', null, task.items.map(it => { const at = Array.isArray(answer) ? answer.indexOf(it.id) : -1;
        return h('li', null, L(ctx, it.text), ' ', h('span', { class: 'note' }, t('lab11.youPlaced', { n: i18n.number(at + 1) }))); })),
        h('p', { class: 'note' }, t('lab11.pairShare', { pct: i18n.number(Math.round(g.ratio * 100)) })));
    case 'classify':
      return Table({ caption: t('lab11.classifyTable'), columns: [{ key: 'i', label: t('lab11.colItem') }, { key: 'y', label: t('lab11.colYours') }, { key: 'r', label: t('lab11.colRight') }, { key: 'w', label: t('lab11.colWhy') }],
        rows: task.items.map(it => { const y = task.categories.find(c => c.id === answer?.[it.id]); const r = task.categories.find(c => c.id === it.category);
          return { i: L(ctx, it.text), y: h('span', null, icon(y?.id === r.id ? 'check' : 'close'), ' ', y ? L(ctx, y.label) : '—'), r: L(ctx, r.label), w: L(ctx, it.why) }; }) });
    case 'numeric':
      return h('p', null, h('strong', null, t('lab11.yourValue')), ' ', h('bdi', null, String(answer ?? '')), ' ', L(ctx, task.unit), ' · ', h('strong', null, t('lab11.rightValue')), ' ', h('bdi', null, i18n.number(task.answer)), ' ', L(ctx, task.unit));
    case 'free_text':
      return h('div', null, h('p', null, h('strong', null, t('lab11.yourAnswer'))), h('blockquote', { class: 'lab-quote' }, String(answer || '')),
        h('p', { class: 'note' }, t('lab11.pendingBody')));
    default: return null;
  }
}

function resultView(ctx, lab, at, { onRetry, history, onOpen }) {
  const { t, i18n } = ctx;
  const autoOnly = at.max > 0;
  const headline = at.pending_review && !autoOnly ? t('lab11.allPending')
    : at.pending_review ? t('lab11.partPending', { pct: i18n.number(at.score), n: i18n.number(at.pending_review) }) + (at.mark_met ? ' ' + t('lab11.markMetScored', { pass: i18n.number(lab.pass_mark) }) : '')
      : at.passed ? t('lab11.passed', { pct: i18n.number(at.score), pass: i18n.number(lab.pass_mark) }) : t('lab11.notYet', { pct: i18n.number(at.score), pass: i18n.number(lab.pass_mark) });
  const evComps = Object.entries(at.competency_breakdown || {});
  const evidence = h('section', { class: 'panel lab-evidence', 'aria-labelledby': 'lab-ev-h', dataset: { evidence: String(evComps.length) } },
    h('h3', { id: 'lab-ev-h' }, icon('award'), ' ', t('lab11.evidenceTitle')),
    evComps.length ? h('ul', { class: 'plain' }, evComps.map(([c, v]) => h('li', { dataset: { comp: c } }, icon('check'), ' ', h('strong', null, c), ' — ', t('lab11.evidenceRow', { pct: i18n.number(v.percent), n: i18n.number(v.items) })))) : h('p', null, t('lab11.evidenceNone')),
    (at.evidence_excluded || []).length ? h('ul', { class: 'plain note' }, at.evidence_excluded.map(x => h('li', { dataset: { excluded: x.competency } }, icon('info'), ' ', x.competency, ' — ', t('lab11.excluded.' + x.reason)))) : null,
    h('p', { class: 'note' }, t('lab11.evidenceRule')));
  const tasks = lab.tasks.map((task, i) => {
    const det = at.detail.find(x => x.task_id === task.id) || {};
    const g = gradeTask(task, at.answers[task.id], at.reviews?.[task.id] || null);
    const v = det.verdict || verdictOf(g);
    return h('article', { class: 'lab-fb', dataset: { task: task.id, verdict: v } },
      h('h3', null, h('span', { class: 'task-no' }, t('lab11.taskN', { n: i18n.number(i + 1), total: i18n.number(lab.tasks.length) })), ' ', L(ctx, task.prompt)),
      h('p', null, Badge({ label: t('lab11.verdict.' + v), tone: VERDICT_TONE[v] }), ' ', v === 'pending' ? null : t('lab11.earned', { e: i18n.number(det.earned ?? g.earned), m: i18n.number(task.weight) })),
      answerSummary(ctx, task, at.answers[task.id], g),
      h('div', { class: 'fb-model' }, h('p', null, h('strong', null, icon('bulb'), ' ', t('lab11.model'))), h('p', null, L(ctx, task.model_answer)),
        h('p', { class: 'note' }, h('strong', null, t('lab11.reasoning')), ' ', L(ctx, task.reasoning)),
        task.type === 'free_text' ? h('div', null, h('p', { class: 'note' }, h('strong', null, t('lab11.rubric'))), h('ul', null, task.rubric.map(r => h('li', null, L(ctx, r.text), (at.self_check?.[task.id] || []).includes(r.id) ? [' ', Badge({ label: t('lab11.youTicked'), tone: 'neutral' })] : null)))) : null));
  });
  const download = () => {
    const data = JSON.stringify(exportAttempt(lab, at, ctx.i18n.locale), null, 2);
    const a = h('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: `cia-lab-${lab.slug}-attempt-${at.attempt_no}.json` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(t('lab11.exported'));
  };
  return h('div', { class: 'lab-result', dataset: { attempt: String(at.attempt_no), status: at.status, score: String(at.score), passed: String(at.passed) } },
    h('h2', { class: 'lab-result-head', tabindex: '-1' }, icon('chart'), ' ', t('lab11.resultTitle', { n: i18n.number(at.attempt_no) })),
    h('p', { class: at.pending_review ? 'banner banner-info' : at.passed ? 'oksum' : 'errsum', role: 'status', dataset: { headline: 'true', markMet: String(!!at.mark_met) } }, headline),
    h('p', { class: 'note' }, t('lab11.submittedAt', { d: i18n.date(new Date(at.submitted_at), { dateStyle: 'medium', timeStyle: 'short' }) }), ' · ', t('lab11.practiceNote')),
    evidence,
    h('div', { class: 'btnrow no-print' }, Button({ label: t('lab11.retry'), variant: 'primary', iconName: 'refresh', onClick: onRetry, attrs: { 'data-action': 'retry-lab' } }),
      Button({ label: t('lab11.export'), variant: 'secondary', iconName: 'download', onClick: download, attrs: { 'data-action': 'export-attempt' } }),
      Button({ label: t('lab11.print'), variant: 'quiet', onClick: () => window.print(), attrs: { 'data-action': 'print-attempt' } })),
    h('div', { class: 'lab-fbs' }, tasks),
    historyBlock(ctx, lab, history, onOpen, at.attempt_no));
}

function historyBlock(ctx, lab, history, onOpen, current = null) {
  const { t, i18n } = ctx;
  if (!history.length) return null;
  return h('section', { class: 'section lab-history no-print', 'aria-labelledby': 'lab-h-h', dataset: { history: String(history.length) } },
    h('h2', { id: 'lab-h-h', class: 'h-sm' }, icon('clock'), ' ', t('lab11.history')),
    Table({ caption: t('lab11.history'), columns: [{ key: 'n', label: t('lab11.colAttempt') }, { key: 'd', label: t('lab11.colDate') }, { key: 's', label: t('lab11.colScore'), num: true }, { key: 'st', label: t('lab11.colStatus') }],
      rows: [...history].reverse().map(a => ({ n: a.attempt_no === current ? h('span', null, i18n.number(a.attempt_no), ' ', Badge({ label: t('lab11.current'), tone: 'neutral' }))
        : h('a', { href: `#/labs/${lab.slug}?attempt=${a.attempt_no}`, onclick: e => { e.preventDefault(); onOpen(a.attempt_no); } }, i18n.number(a.attempt_no)),
      d: i18n.date(new Date(a.submitted_at), { dateStyle: 'medium' }), s: i18n.number(a.score) + '%', st: [t(a.mark_met ? 'lab11.metMark' : 'lab11.belowMark'), a.status === 'awaiting_review' ? ' · ' + t('lab11.awaitingShort') : ''].join('') })) }));
}
