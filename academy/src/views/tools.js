/**
 * #/tools (Phase 10A) — the hub's live toolkits, grouped by system, one click from every page (header "Tools").
 * Moved here from the home page; the list is non-critical: a failure shows a retryable error in this region only.
 */
import { h, icon } from '../core/dom.js';
import { dataRegion } from '../ui/components.js';
import { pageHead, linkBtn } from '../ui/academy.js';

export function toolsView(ctx) {
  const { t, i18n, repos, config } = ctx;
  const head = pageHead(ctx, { eyebrow: t('app.name'), title: t('x10a.tools.title'), lede: t('x10a.tools.lede'),
    actions: [h('a', { class: 'btn btn-secondary', href: config.platformBase + '#tools', 'aria-describedby': 'ext-note', dataset: { nav: 'hub-tools' } }, t('x10a.tools.openHub'), ' ', icon('external'))] });
  const tools = h('section', { class: 'section', 'aria-labelledby': 'tools-h' },
    h('h2', { id: 'tools-h', tabindex: '-1' }, t('home.toolsTitle')),
    dataRegion({ t, skeleton: true, load: () => repos.platformModules.listVisible(ctx.session.roles).then(items => ({ items, systems: ctx.platformSystems })),
      render: ({ items, systems }) => {
        const bySystem = {};
        for (const m of items) (bySystem[m.system] ||= []).push(m);
        return h('div', null,
          h('p', { class: 'note' }, t('home.toolsSub', { n: i18n.number(items.length) })),
          h('div', { class: 'tools' }, Object.entries(bySystem).map(([sid, mods]) => h('div', { class: 'tgroup' },
            h('h3', null, systems[sid]?.[i18n.locale] || sid),
            h('ul', null, mods.map(m => h('li', null,
              h('a', { class: 'tlink', href: m.href.replace(/^\.\.\//, config.platformBase), dataset: { module: m.id, access: m.access || 'open' }, 'aria-label': t('home.openTool', { name: m.name[i18n.locale] }) + (m.access === 'account' ? ' — ' + t('gd.account') : '') },
                h('span', { class: 'n' }, m.name[i18n.locale], m.access === 'account' ? h('span', { class: 'acc', 'aria-hidden': 'true' }, t('gd.accountShort')) : null),
                h('span', { class: 'd' }, m.note[i18n.locale]),
                icon('external')))))))));
      } }));
  return h('div', null, head, tools, h('p', null, linkBtn('#/library?tab=guides', t('x10a.tools.guides'))));
}
