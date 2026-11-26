/**
 * Phase 17 — #/my?tab=review: daily review cards (spaced repetition, D-124). The deck fills itself from the learner's own
 * missed assessment questions and missed lesson checks; a practice set of an academy's published questions can be added.
 * One session a day (up to 20 cards): answer → the card turns over → feedback, the correct option and its rationale,
 * a link back to the lesson or academy → next. Review answers are practice only: they never change a score, a level or the
 * passport. Records: review_cards, review_log (the learner's own collections).
 */
import { h, icon } from '../core/dom.js';
import { dataRegion, Button, ProgressBar, toast } from '../ui/components.js';
import { L } from '../ui/academy.js';
import { loadQuestions } from '../data/learner-state.js';
import { UNKNOWN, optionFeedback } from '../domain/assessments.mjs';
import { ACADEMIES } from '../domain/academies.mjs';
import * as R from '../domain/review.mjs';

export const localDay = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const CAT_ACADEMY = { iso: 'iso', auditing: 'iso', quality: 'quality', excellence: 'excellence', pmo: 'pmi', project_management: 'pmi', p3o: 'pmi' };

/** Fill the deck from missed assessment questions (new cards and resets). Returns the deck after saving. */
export async function syncDeck(ctx, today = localDay()) {
  const r = ctx.repos;
  const [cards, attempts] = await Promise.all([r.reviewCards.list(), r.assessmentAttempts.list()]);
  const missed = [...new Set(attempts.flatMap(a => (a.detail || []).filter(d => d && d.auto && !d.correct).map(d => d.question_id)))];
  if (!missed.length) return cards;
  const qs = await loadQuestions(ctx, missed);
  const { add, reset } = R.cardsFromAttempts(attempts, new Map(qs.map(q => [q.id, q])), cards, today);
  for (const c of [...add, ...reset]) await r.reviewCards.save(c);
  return add.length || reset.length ? r.reviewCards.list() : cards;
}

/** Called by the lesson player when a knowledge check is missed. Quiet: returns true when a card was added or reset. */
export async function noteLessonMiss(ctx, q, lessonId) {
  try {
    const card = R.cardFromLessonMiss(q, await ctx.repos.reviewCards.list(), { lessonId, today: localDay() });
    if (!card) return false;
    await ctx.repos.reviewCards.save(card); return true;
  } catch { return false; }
}

function questionHref(q, courses) {
  const c = q.course_id ? courses.find(x => x.id === q.course_id) : null;
  if (c) return `#/academy/courses/${c.slug}`;
  const a = ACADEMIES.find(x => x.key === CAT_ACADEMY[q.category]);
  return a ? `#${a.route}` : '#/academy/courses';
}

/** One review session over `queue` (cards with their questions). */
function session(ctx, { queue, courses, today, onDone }) {
  const { t, i18n } = ctx;
  let i = 0, right = 0, log = null;
  const host = h('section', { class: 'rv-session', 'aria-labelledby': 'rv-sess-h', dataset: { session: 'on' } });
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const show = () => {
    if (i >= queue.length) return finish();
    const { card, q } = queue[i];
    let answer = q.type === 'multiple_choice' ? [] : null;
    const name = 'rv-' + q.id;
    const input = (o, n) => h('label', { class: 'choice rv-choice' },
      h('input', { type: q.type === 'multiple_choice' ? 'checkbox' : 'radio', name, value: String(o.id), dataset: { option: String(o.id) },
        onchange: e => { if (q.type === 'multiple_choice') answer = e.target.checked ? [...answer, o.id] : answer.filter(x => x !== o.id); else answer = o.id; } }),
      h('span', { class: 'rv-key', 'aria-hidden': 'true' }, String(n + 1)), h('span', null, L(ctx, o.text)));
    const opts = (q.options || []).map(input);
    const unknown = h('label', { class: 'choice choice-unknown' }, h('input', { type: 'radio', name, value: UNKNOWN, onchange: () => { answer = UNKNOWN; } }), h('span', null, t('p7.asm.unknown')));
    const err = h('p', { class: 'err', 'aria-live': 'polite' });
    const back = h('div', { class: 'rv-back', hidden: true });
    const card3d = h('article', { class: 'rv-card', dataset: { card: card.id, box: String(card.box) } },
      h('header', { class: 'rv-cardhead' }, h('span', { class: 'rv-boxchip' }, icon('layers'), ' ', card.mastered ? t('rv17.mastered') : t('rv17.box', { n: i18n.number(card.box) })),
        h('span', { class: 'rv-src' }, t('rv17.src.' + (card.source?.kind || 'practice')))),
      h('fieldset', { class: 'fs rv-front' }, h('legend', { class: 'rv-q' }, L(ctx, q.prompt)), ...opts, unknown),
      err, back);
    const check = Button({ label: t('rv17.check'), variant: 'primary', iconName: 'check', attrs: { 'data-action': 'rv-check' }, onClick: async () => {
      if (answer == null || (Array.isArray(answer) && !answer.length)) { err.textContent = t('p7.lesson.chooseFirst'); return; }
      err.textContent = '';
      const ok = R.gradeReview(q, answer);
      const next = R.answerCard(card, ok, today);
      await ctx.repos.reviewCards.save(next);
      log = R.logDay(log ? [log] : [await ctx.repos.reviewLog.get(today).catch(() => null)].filter(Boolean), today, { reviewed: 1, correct: ok ? 1 : 0 });
      await ctx.repos.reviewLog.save(log);
      if (ok) right++;
      const f = optionFeedback(q, answer);
      card3d.querySelectorAll('input').forEach(x => { x.disabled = true; });
      card3d.querySelectorAll('[data-option]').forEach(x => { if ([].concat(q.correct_answer).includes(x.dataset.option)) x.closest('label').classList.add('is-correct'); else if (x.checked) x.closest('label').classList.add('is-wrong'); });
      back.hidden = false;
      back.replaceChildren(
        h('p', { class: 'rv-verdict ' + (ok ? 'oksum' : 'errsum'), dataset: { result: ok ? 'right' : 'wrong' } }, icon(ok ? 'check' : 'close'), ' ', ok ? t('p7.asm.correct') : answer === UNKNOWN ? t('rv17.unknownBack') : t('p7.asm.incorrect')),
        f?.chosen && !ok && f.chosen.why ? h('p', null, h('strong', null, t('p7.asm.yourChoice')), ' ', L(ctx, f.chosen.why)) : null,
        f?.correct ? h('p', null, h('strong', null, t('p7.asm.correctAnswer')), ' ', L(ctx, f.correct.text), f.correct.why ? [' — ', L(ctx, f.correct.why)] : null) : null,
        q.explanation ? h('p', { class: 'note' }, L(ctx, q.explanation)) : null,
        h('p', { class: 'rv-sched' }, icon('calendar'), ' ', next.mastered ? t('rv17.nextMastered', { date: i18n.date(next.due) }) : t('rv17.nextOn', { date: i18n.date(next.due), n: i18n.number(next.box) }),
          ' · ', h('a', { href: questionHref(q, courses), dataset: { action: 'rv-study' } }, icon('book'), ' ', t('rv17.study'))));
      card3d.classList.add('is-turned');
      live.textContent = ok ? t('p7.asm.correct') : t('p7.asm.incorrect');
      foot.replaceChildren(Button({ label: i + 1 < queue.length ? t('rv17.next') : t('rv17.finish'), variant: 'primary', iconName: 'chevron', attrs: { 'data-action': 'rv-next' }, onClick: () => { i++; show(); } }));
      foot.querySelector('button')?.focus();
    } });
    const foot = h('div', { class: 'btnrow rv-foot' }, check);
    card3d.addEventListener('keydown', e => {
      if (card3d.classList.contains('is-turned') || e.target.tagName === 'BUTTON') return;
      const n = Number(e.key); if (n >= 1 && n <= opts.length) { const inp = opts[n - 1].querySelector('input'); inp.click(); inp.focus(); e.preventDefault(); }
    });
    host.replaceChildren(h('h2', { id: 'rv-sess-h' }, icon('layers'), ' ', t('rv17.sessionTitle')),
      ProgressBar({ value: i, max: queue.length, label: t('rv17.progress'), valueText: t('rv17.progressText', { n: i18n.number(i + 1), total: i18n.number(queue.length) }) }),
      card3d, foot, live);
    card3d.querySelector('input')?.focus({ preventScroll: true });
  };
  const finish = () => {
    host.dataset.session = 'done';
    host.replaceChildren(h('h2', { id: 'rv-sess-h' }, icon('award'), ' ', t('rv17.doneTitle')),
      h('p', { class: 'rv-donebig', dataset: { right: String(right), total: String(queue.length) } }, t('rv17.doneLine', { right: i18n.number(right), total: i18n.number(queue.length) })),
      h('p', null, t('rv17.doneBody')),
      Button({ label: t('rv17.backToDeck'), variant: 'primary', attrs: { 'data-action': 'rv-back' }, onClick: onDone }));
    host.querySelector('button')?.focus();
  };
  show();
  return host;
}

export function reviewPanel(ctx) {
  const { t, i18n } = ctx;
  const today = localDay();
  const region = dataRegion({ t, load: async () => {
    const cards = await syncDeck(ctx, today);
    const [log, idx] = await Promise.all([ctx.repos.reviewLog.list(), (ctx.repos.coursesIndex || ctx.repos.courses).listVisible(ctx.session.roles).catch(() => [])]);
    const due = R.dueCards(cards, today);
    const qs = await loadQuestions(ctx, due.map(c => c.id));
    const byId = new Map(qs.map(q => [q.id, q]));
    const allQ = cards.length ? await loadQuestions(ctx, R.activeCards(cards).map(c => c.id)) : [];
    return { cards, log, courses: idx, queue: due.filter(c => R.reviewable(byId.get(c.id))).map(card => ({ card, q: byId.get(card.id) })), prompts: new Map(allQ.map(q => [q.id, q])) };
  }, render: ({ cards: deck, log, courses, queue, prompts }) => {
    const cards = R.activeCards(deck);
    const s = R.summary(cards, log, today);
    const tile = (k, v, ic) => h('div', { class: 'rv-tile', dataset: { stat: k } }, icon(ic), h('span', { class: 'rv-tv' }, i18n.number(v)), h('span', { class: 'rv-tl' }, t('rv17.stat.' + k)));
    const strip = h('ol', { class: 'rv-strip', 'aria-label': t('rv17.last14') }, ...s.last14.map(d => h('li', { class: d.reviewed ? 'on' : '', title: `${i18n.date(d.day)} — ${i18n.number(d.reviewed)}`, 'aria-label': t('rv17.dayLine', { date: i18n.date(d.day), n: i18n.number(d.reviewed) }) })));
    const boxes = h('ol', { class: 'rv-boxes', 'aria-label': t('rv17.boxesLabel') }, ...s.boxes.map((n, k) => h('li', { dataset: { box: String(k + 1) } },
      h('span', { class: 'rv-bn' }, i18n.number(n)), h('span', { class: 'rv-bl' }, t('rv17.boxShort', { n: i18n.number(k + 1), d: i18n.number(R.INTERVALS[k]) })))),
      h('li', { dataset: { box: 'mastered' } }, h('span', { class: 'rv-bn' }, i18n.number(s.mastered)), h('span', { class: 'rv-bl' }, t('rv17.mastered'))));
    const host = h('div', { class: 'rv-host' });
    const start = queue.length ? Button({ label: t('rv17.start', { n: i18n.number(queue.length) }), variant: 'primary', iconName: 'play', attrs: { 'data-action': 'rv-start' },
      onClick: () => { overview.hidden = true; host.replaceChildren(session(ctx, { queue, courses, today, onDone: () => region.refresh() })); } }) : null;
    const status = !cards.length ? h('div', { class: 'rv-empty', dataset: { deck: 'empty' } }, icon('layers'), h('p', { class: 'rv-et' }, t('rv17.emptyTitle')), h('p', null, t('rv17.emptyBody')))
      : queue.length ? h('div', { class: 'rv-cta', dataset: { deck: 'due' } }, h('p', { class: 'rv-ct' }, t('rv17.dueTitle', { n: i18n.number(queue.length) })), h('p', { class: 'note' }, t('rv17.dueBody')), start)
      : h('div', { class: 'rv-cta rv-clear', dataset: { deck: 'clear' } }, icon('check'), h('p', { class: 'rv-ct' }, t('rv17.clearTitle')), s.next ? h('p', { class: 'note' }, t('rv17.nextReview', { date: i18n.date(s.next) })) : null);
    /* Practice set */
    const sel = h('select', { class: 'select', id: 'rv-academy', 'aria-describedby': 'rv-add-note' }, ...ACADEMIES.map(a => h('option', { value: a.key }, t('nav.items.' + a.navId))));
    const add = Button({ label: t('rv17.addSet', { n: i18n.number(R.PRACTICE_SET) }), variant: 'secondary', iconName: 'layers', attrs: { 'data-action': 'rv-add-set' }, onClick: async () => {
      const key = sel.value;
      const pool = ctx.split ? await ctx.split.readShards('questions', [key]) : (await ctx.repos.questions.listAll()).filter(q => CAT_ACADEMY[q.category] === key);
      const set = R.practiceSet(pool, await ctx.repos.reviewCards.list(), { today, academy: key });
      for (const c of set) await ctx.repos.reviewCards.save(c);
      toast(set.length ? t('rv17.added', { n: i18n.number(set.length) }) : t('rv17.addedNone'));
      region.refresh();
    } });
    const practice = h('section', { class: 'rv-add section', 'aria-labelledby': 'rv-add-h' }, h('h3', { id: 'rv-add-h' }, t('rv17.addTitle')),
      h('div', { class: 'rv-addrow' }, h('label', { for: 'rv-academy' }, t('rv17.addLabel')), sel, add), h('p', { class: 'note', id: 'rv-add-note' }, t('rv17.addNote')));
    /* The deck */
    const list = cards.length ? h('details', { class: 'rv-deck', dataset: { cards: String(cards.length) } }, h('summary', null, t('rv17.deckTitle', { n: i18n.number(cards.length) })),
      h('ul', { class: 'plain rv-list' }, ...[...cards].sort((a, b) => a.due.localeCompare(b.due)).map(c => h('li', { dataset: { cardRow: c.id } },
        h('span', { class: 'rv-lq' }, prompts.get(c.id) ? L(ctx, prompts.get(c.id).prompt) : c.id),
        h('span', { class: 'note' }, c.mastered ? t('rv17.mastered') : t('rv17.box', { n: i18n.number(c.box) }), ' · ', t('rv17.dueOn', { date: i18n.date(c.due) }), ' · ', t('rv17.src.' + (c.source?.kind || 'practice'))),
        Button({ label: t('rv17.remove'), variant: 'quiet', attrs: { 'data-action': 'rv-remove', 'aria-label': t('rv17.removeNamed', { id: c.id }) }, onClick: async () => { await ctx.repos.reviewCards.save(R.removeCard(c, today)); toast(t('rv17.removed')); region.refresh(); } }))))) : null;
    const overview = h('div', { class: 'rv-overview' },
      h('div', { class: 'rv-tiles' }, tile('due', s.due, 'calendar'), tile('streak', s.streak, 'spark'), tile('learning', s.learning, 'layers'), tile('mastered', s.mastered, 'medal')),
      status, cards.length ? h('div', { class: 'rv-charts' }, h('div', null, h('h3', null, t('rv17.boxesLabel')), boxes), h('div', null, h('h3', null, t('rv17.last14')), strip)) : null,
      practice, list, h('p', { class: 'note rv-honest' }, icon('info'), ' ', t('rv17.honest')));
    return h('div', { class: 'rv', dataset: { due: String(queue.length), streak: String(s.streak) } }, h('h2', { class: 'sr-only' }, t('rv17.title')), overview, host);
  } });
  return h('div', null, region);
}
