/**
 * Shared shell: one header, navigation drawer, breadcrumb and footer
 * (replaces the prototype's 14 duplicated copies — Audit §3.2).
 */
import { h, icon, nextId } from '../core/dom.js';
import { visibleEntries } from '../nav/registry.js';

const GROUP_ORDER = ['learn', 'grow', 'platform', 'manage', 'utility'];

function brandMark() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 36 36'); svg.setAttribute('class', 'brand-mark'); svg.setAttribute('aria-hidden', 'true');
  const parts = [
    ['rect', { x: 1, y: 1, width: 34, height: 34, rx: 8, fill: 'none', stroke: '#C6A15B', 'stroke-width': 1.5 }],
    ['path', { d: 'M25.5 12.5A9 9 0 1 0 27 18', fill: 'none', stroke: '#C6A15B', 'stroke-width': 2.4, 'stroke-linecap': 'round' }],
    ['path', { d: 'M22.5 11.5l3.4 1.2-.9 3.5', fill: 'none', stroke: '#C6A15B', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }],
    ['path', { d: 'M13.5 21.5l3-3 2.5 2 4-4.5', fill: 'none', stroke: '#F7F5F0', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]
  ];
  for (const [tag, attrs] of parts) { const el = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); svg.appendChild(el); }
  return svg;
}

export function entryHref(e, platformBase) {
  if (e.status !== 'active') return null;
  if (e.kind === 'route') return '#' + e.route;
  return e.href.replace(/^\.\.\//, platformBase);
}

function navItem(e, ctx, currentPath, cls) {
  const { t, config } = ctx;
  const label = t(e.labelKey);
  if (e.status === 'coming') {
    const tipId = nextId('tip');
    return h('span', { class: `${cls} coming`, role: 'link', 'aria-disabled': 'true', tabindex: '0', 'aria-describedby': tipId, dataset: { nav: e.id, phase: String(e.phase) } },
      h('span', null, label),
      h('span', { class: 'ph', 'aria-hidden': 'true' }, t('nav.phase', { phase: ctx.i18n.digitize(e.phase) })),
      h('span', { class: 'tip', role: 'tooltip', id: tipId }, t('a11y.comingTip', { phase: ctx.i18n.digitize(e.phase) })));
  }
  const href = entryHref(e, config.platformBase);
  const current = e.kind === 'route' && e.route === currentPath;
  return h('a', { class: cls, href, 'aria-current': current ? 'page' : null, dataset: { nav: e.id }, 'aria-describedby': e.kind === 'platform' ? 'ext-note' : null },
    h('span', null, label), e.kind === 'platform' ? icon('external') : null);
}

export function renderShell(ctx, { currentPath, crumbs }) {
  const { t, i18n, session } = ctx;
  const entries = visibleEntries(ctx.nav, session.roles);
  const other = i18n.locale === 'ar' ? 'en' : 'ar';

  const drawerId = 'nav-drawer';
  const drawer = h('div', { class: 'drawer', id: drawerId, hidden: true },
    h('nav', { class: 'drawer-in', 'aria-label': t('a11y.allSections') },
      GROUP_ORDER.map(g => {
        const items = entries.filter(e => e.group === g);
        if (!items.length) return null;
        const hid = nextId('grp');
        return h('section', { 'aria-labelledby': hid },
          h('h2', { id: hid }, t('nav.groups.' + g)),
          h('ul', null, items.map(e => h('li', null, navItem(e, ctx, currentPath, 'navlink')))));
      })));

  const menuBtn = h('button', { class: 'iconbtn', type: 'button', 'aria-expanded': 'false', 'aria-controls': drawerId, dataset: { action: 'menu' } },
    icon('menu'), h('span', { class: 'lbl' }, t('nav.menu')));
  const setOpen = (open) => {
    drawer.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.replaceChildren(icon(open ? 'close' : 'menu'), h('span', { class: 'lbl' }, t('nav.menu')));
    menuBtn.setAttribute('aria-label', t(open ? 'a11y.menuClose' : 'a11y.menuOpen'));
  };
  menuBtn.setAttribute('aria-label', t('a11y.menuOpen'));
  menuBtn.addEventListener('click', () => setOpen(drawer.hidden));
  drawer.addEventListener('keydown', e => { if (e.key === 'Escape') { setOpen(false); menuBtn.focus(); } });
  drawer.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });

  const langBtn = h('button', { class: 'iconbtn', type: 'button', lang: other, dataset: { action: 'lang' }, 'aria-label': t('a11y.switchTo'), onclick: () => ctx.setLocale(other) },
    icon('globe'), h('span', { class: 'lbl' }, other === 'ar' ? 'العربية' : 'English'));

  const primary = entries.filter(e => e.primary && e.status === 'active');
  const header = h('header', { class: 'hdr' },
    h('div', { class: 'hdr-in' },
      h('a', { class: 'brand', href: '#/', 'aria-label': t('app.name') }, brandMark(),
        h('span', { class: 'brand-name' }, h('span', { class: 'bn-full' }, t('app.name')), h('span', { class: 'bn-short', 'aria-hidden': 'true' }, t('app.nameShort')), h('span', { class: 'brand-sub' }, t('app.tagline')))),
      h('nav', { class: 'pnav', 'aria-label': t('a11y.mainNav') }, primary.map((e, i) => {
        const a = navItem(e, ctx, currentPath, '');
        if (i >= 3) a.classList.add('secondary');
        return a;
      })),
      h('div', { class: 'hdr-tools' }, langBtn, menuBtn)),
    drawer);

  const crumbNav = crumbs && crumbs.length > 1 ? h('nav', { class: 'crumbs', 'aria-label': t('a11y.breadcrumb') },
    h('ol', null, crumbs.map((c, i) => h('li', null,
      i > 0 ? icon('chevron') : null,
      i < crumbs.length - 1 ? h('a', { href: c.href }, c.label) : h('span', { 'aria-current': 'page' }, c.label))))) : null;

  const footer = h('footer', { class: 'ftr' },
    h('div', { class: 'ftr-in' },
      h('p', null, t('footer.rights')),
      h('nav', { 'aria-label': t('nav.groups.utility') },
        h('a', { href: '#/about-governance' }, t('nav.items.governance')),
        h('a', { href: '#/settings' }, t('nav.items.settings')),
        h('a', { href: ctx.config.platformBase, dataset: { nav: 'hub' } }, t('nav.backToHub'))),
      h('p', { class: 'note' }, t('footer.version'), ' ', h('bdi', { dir: 'ltr' }, ctx.config.version))),
    h('span', { id: 'ext-note', class: 'sr-only' }, t('a11y.external')));

  return { header, crumbNav, footer, closeMenu: () => setOpen(false) };
}
