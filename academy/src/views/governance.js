/** Governance & build plan: content rules, approved labels, build progress, reference register. */
import { h } from '../core/dom.js';
import { StatusLabel, Table, ProgressRing, EmptyState, dataRegion, Badge } from '../ui/components.js';
import { buildCompletion } from '../data/progress.js';
import { planEntries } from '../nav/registry.js';

const TONE = { complete: 'ok', in_progress: 'info', next: 'gold', planned: 'neutral', pending_decision: 'warn', open: 'warn', resolved: 'ok' };

export function governanceView(ctx) {
  const { t, i18n, repos, session, taxonomies } = ctx;
  const canReview = session.hasRole('reviewer') || session.hasRole('admin');

  const principles = h('section', { class: 'section', 'aria-labelledby': 'pr-h' },
    h('h2', { id: 'pr-h' }, t('governance.principlesTitle')),
    h('ul', { class: 'principles' }, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => h('li', null, t('governance.principles.' + k)))));

  const group = (title, kind, values, prefix, needsEvidence = []) => h('div', { class: 'card' },
    h('h3', null, title),
    h('div', { class: 'badges' }, values.map(v => StatusLabel({ kind, value: v, label: t(prefix + v) }))),
    needsEvidence.length ? h('p', { class: 'note' }, t('governance.evidenceNote') + ': ' + i18n.list(needsEvidence.map(v => t(prefix + v)))) : null);
  const labels = h('section', { class: 'section', 'aria-labelledby': 'lb-h' },
    h('h2', { id: 'lb-h' }, t('governance.labelsTitle')),
    h('div', { class: 'split' },
      group(t('governance.courseStatus'), 'course', taxonomies.courseStatus, 'labels.courseStatus.', taxonomies.courseStatusRequiresEvidence),
      group(t('governance.certType'), 'certificate', taxonomies.certificateType, 'labels.certificateType.', taxonomies.certificateTypeRequiresEvidence),
      group(t('governance.states'), 'governance', taxonomies.governanceStates, 'labels.governance.')));

  const build = h('section', { class: 'section', 'aria-labelledby': 'bd-h' },
    h('h2', { id: 'bd-h' }, t('governance.buildTitle')),
    dataRegion({ t, load: () => ctx.loadSeed('build-status'), render: (bs) => {
      const ratio = buildCompletion(bs.phases);
      return h('div', { class: 'stack' },
        h('div', { class: 'btnrow' }, ProgressRing({ ratio, label: t('governance.buildTitle'), valueText: i18n.percent(ratio) }),
          h('p', { class: 'bigpct', dataset: { metric: 'build-completion' } }, t('governance.buildLede', { pct: i18n.percent(ratio) }))),
        Table({ caption: t('governance.phaseTable'), columns: [{ key: 'p', label: t('governance.phaseCol') }, { key: 'n', label: t('governance.phaseName') }, { key: 's', label: t('governance.statusCol') }, { key: 'w', label: t('governance.weightCol'), num: true }],
          rows: bs.phases.map(p => ({ p: i18n.digitize(p.id), n: t('governance.phases.' + p.id), s: Badge({ label: t('governance.status.' + p.status), tone: TONE[p.status] }), w: i18n.number(p.weight) })) }),
        h('p', { class: 'note' }, t('governance.buildMethod', { method: bs.method })),
        h('h3', null, t('governance.blockersTitle')),
        h('ul', null, bs.blockers.map(b => h('li', null, Badge({ label: t('governance.status.' + b.status), tone: TONE[b.status] }), ' ', h('strong', null, b.id + ':'), ' ', t('governance.blockers.' + b.id)))));
    } }));

  const registry = h('section', { class: 'section', 'aria-labelledby': 'rg-h' },
    h('h2', { id: 'rg-h' }, t('governance.registryTitle')),
    dataRegion({ t, load: async () => ({ eco: await repos.ecosystems.listVisible(session.roles), all: await repos.ecosystems.listAll(), rel: ctx.relationships }), render: ({ eco, all, rel }) => {
      if (!canReview) return h('div', null, h('p', null, t('governance.registryCount', { n: i18n.number(all.length) })), h('p', { class: 'note' }, t('governance.registryRestricted')));
      return h('div', null, h('p', { class: 'note' }, t('governance.registryHint')),
        Table({ caption: t('governance.registryTable'), columns: [{ key: 'n', label: t('governance.ecoCol') }, { key: 'l', label: t('governance.toolsCol'), num: true }, { key: 'g', label: t('governance.govCol') }],
          rows: eco.map(e => ({ n: e.name[i18n.locale], l: i18n.number(rel.from('ecosystem', e.id).length), g: StatusLabel({ kind: 'governance', value: e.governance.content_status, label: t('labels.governance.' + e.governance.content_status) }) })) }));
    } }));

  const sources = h('section', { class: 'section', 'aria-labelledby': 'sr-h' },
    h('h2', { id: 'sr-h' }, t('governance.sourcesTitle')),
    dataRegion({ t, load: () => repos.sources.list(), render: items => items.length
      ? Table({ caption: t('governance.sourcesTable'), columns: [{ key: 'title', label: t('governance.sourcesTitle') }], rows: items })
      : EmptyState({ title: t('governance.sourcesEmptyTitle'), body: t('governance.sourcesEmpty'), iconName: 'info' }) }));

  /* Phase 10A: "About our content" for learners; the build plan (phases, future navigation entries) only for reviewers and admins. */
  const plan = canReview ? h('section', { class: 'section', 'aria-labelledby': 'np-h', dataset: { plan: 'nav' } },
    h('h2', { id: 'np-h' }, t('x10a.about.planNav')), h('p', { class: 'note' }, t('x10a.about.planNavNote')),
    h('ul', { class: 'plain' }, planEntries(ctx.nav, session.roles).map(e => h('li', { dataset: { nav: e.id, phase: String(e.phase) } },
      Badge({ label: t('nav.phase', { phase: i18n.digitize(e.phase) }), tone: 'neutral' }), ' ', t(e.labelKey))))) : null;
  return h('div', null,
    h('div', { class: 'phead' }, h('h1', null, t('x10a.about.title')), h('p', null, t('x10a.about.lede'))),
    principles, labels, registry, sources, canReview ? build : null, plan);
}
