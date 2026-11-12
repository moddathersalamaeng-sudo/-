/**
 * Shared shell (Phase 1, restructured in Phase 10A): one header, five top items, the Academies panel, search,
 * a Tools button, the account menu, a short "More" menu, the phone tab bar, breadcrumb and footer.
 * Every entry comes from the navigation registry (data/seed/navigation.json); future-phase entries are never shown
 * here — reviewers and admins see them on the build plan (About our content).
 */
import { h, icon, nextId } from '../core/dom.js';
import { shellEntries } from '../nav/registry.js';
import { ACADEMIES } from '../domain/academies.mjs';

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

/** Is `path` inside the section an entry stands for (e.g. a course page is inside "Courses")? */
export function isCurrent(e, path) {
  if (!path || e.kind !== 'route') return false;
  if (e.route === '/') return path === '/';
  if (e.id === 'academies') return path === '/academies' || ACADEMIES.some(a => path === a.route || path.startsWith(a.route + '/'));
  if (e.id === 'library') return ['/library', '/knowledge', '/guides'].some(r => path === r || path.startsWith(r + '/'));
  if (e.id === 'mySpace') return path === '/my' || path === '/welcome';
  return path === e.route || path.startsWith(e.route + '/');
}

function navLink(e, ctx, currentPath, cls) {
  const href = entryHref(e, ctx.config.platformBase);
  const current = isCurrent(e, currentPath);
  return h('a', { class: cls, href, 'aria-current': current ? 'page' : null, dataset: { nav: e.id }, 'aria-describedby': e.kind === 'platform' ? 'ext-note' : null },
    h('span', null, ctx.t(e.labelKey)), e.kind === 'platform' ? icon('external') : null);
}

/* One popover open at a time; Escape or a click outside closes it and returns focus to its button. */
let openPop = null;
function closeOpen(focus = false) { if (openPop) { const p = openPop; openPop = null; p.close(focus); } }
if (typeof document !== 'undefined' && !globalThis.__ciaShellListeners) {
  globalThis.__ciaShellListeners = true;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openPop) { e.preventDefault(); closeOpen(true); } });
  document.addEventListener('click', e => { if (openPop && !openPop.contains(e.target)) closeOpen(false); });
}

function popover({ btn, panel, label, iconName, onOpen }) {
  const pop = {
    open() { closeOpen(); panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); openPop = pop; onOpen?.(); },
    close(focus) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (focus) btn.focus(); },
    contains: n => btn.contains(n) || panel.contains(n)
  };
  btn.addEventListener('click', e => { e.stopPropagation(); panel.hidden ? pop.open() : closeOpen(false); });
  panel.addEventListener('click', e => { if (e.target.closest('a')) closeOpen(false); });
  return pop;
}

export function renderShell(ctx, { currentPath, crumbs }) {
  const { t, i18n, session } = ctx;
  const roles = session.roles;
  const top = shellEntries(ctx.nav, roles, 'top');
  const menu = shellEntries(ctx.nav, roles, 'menu');
  const user = shellEntries(ctx.nav, roles, 'user');
  const panelItems = shellEntries(ctx.nav, roles, 'panel');
  const toolsEntry = shellEntries(ctx.nav, roles, 'button').find(e => e.id === 'tools');
  const other = i18n.locale === 'ar' ? 'en' : 'ar';
  closeOpen();

  /* --- Academies panel: one line per academy */
  const acadId = 'acad-panel';
  const acadBtn = h('button', { class: 'pnav-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': acadId, dataset: { nav: 'academies', action: 'academies' },
    'aria-current': top.some(e => e.id === 'academies' && isCurrent(e, currentPath)) ? 'page' : null }, h('span', null, t('nav.items.academies')), icon('caret'));
  const acadPanel = h('div', { class: 'pop pop-acad', id: acadId, hidden: true },
    h('nav', { 'aria-label': t('nav.items.academies') },
      h('ul', { class: 'acad-lines' }, panelItems.map(e => {
        const a = ACADEMIES.find(x => x.navId === e.id);
        return h('li', null, h('a', { href: '#' + e.route, dataset: { nav: e.id }, 'aria-current': isCurrent({ ...e, id: 'x' }, currentPath) ? 'page' : null },
          h('span', { class: 'ai', dataset: { family: a?.family } }, icon(a?.icon || 'book')),
          h('span', { class: 'at' }, h('strong', null, t(e.labelKey)), h('span', null, t('x10a.acad.' + (a?.key || e.id) + '.line')))));
      })),
      h('p', null, h('a', { href: '#/academies', class: 'more-link', dataset: { nav: 'academies-all' } }, t('x10a.acad.all'), ' ', icon('chevron')))));
  popover({ btn: acadBtn, panel: acadPanel });

  /* --- Search */
  const searchId = 'search-panel';
  const searchBtn = h('button', { class: 'iconbtn', type: 'button', 'aria-expanded': 'false', 'aria-controls': searchId, dataset: { action: 'search' }, 'aria-label': t('x10a.search.open') },
    icon('search'), h('span', { class: 'lbl' }, t('x10a.search.label')));
  const sInput = h('input', { class: 'input', type: 'search', id: 'gsearch-q', name: 'q', autocomplete: 'off', placeholder: t('x10a.search.placeholder'), 'aria-describedby': 'gsearch-hint' });
  const searchPanel = h('div', { class: 'pop pop-search', id: searchId, hidden: true },
    h('form', { role: 'search', 'aria-label': t('x10a.search.label'), onsubmit: e => { e.preventDefault(); const q = sInput.value.trim(); closeOpen(); location.hash = '#/search' + (q ? '?q=' + encodeURIComponent(q) : ''); } },
      h('label', { for: 'gsearch-q', class: 'sr-only' }, t('x10a.search.label')),
      h('div', { class: 'srow' }, sInput, h('button', { class: 'btn btn-primary', type: 'submit' }, icon('search'), t('x10a.search.go'))),
      h('p', { class: 'hint', id: 'gsearch-hint' }, t('x10a.search.hint'))));
  popover({ btn: searchBtn, panel: searchPanel, onOpen: () => setTimeout(() => sInput.focus(), 0) });

  /* --- Account menu (settings, history, review queue for reviewers) */
  const userId = 'user-menu';
  const userBtn = h('button', { class: 'iconbtn', type: 'button', 'aria-expanded': 'false', 'aria-controls': userId, dataset: { action: 'user' }, 'aria-label': t('x10a.user.open') },
    icon('user'), h('span', { class: 'lbl' }, t('x10a.user.label')));
  const userPanel = h('div', { class: 'pop pop-user', id: userId, hidden: true },
    h('nav', { 'aria-label': t('x10a.user.label') }, h('ul', null,
      h('li', null, h('a', { href: '#/my', dataset: { nav: 'user-my' } }, icon('user'), ' ', t('nav.items.mySpace'))),
      user.map(e => h('li', null, navLink(e, ctx, currentPath, ''))))));
  popover({ btn: userBtn, panel: userPanel });

  /* --- More menu (≤ 12 entries, nothing that is already in the top bar) */
  const drawerId = 'nav-drawer';
  const drawer = h('div', { class: 'drawer', id: drawerId, hidden: true },
    h('nav', { class: 'drawer-in', 'aria-label': t('a11y.allSections') },
      GROUP_ORDER.map(g => {
        const items = menu.filter(e => e.group === g);
        if (!items.length && g !== 'platform') return null;
        const hid = nextId('grp');
        return h('section', { 'aria-labelledby': hid },
          h('h2', { id: hid }, t('nav.groups.' + g)),
          h('ul', null, items.map(e => h('li', null, navLink(e, ctx, currentPath, 'navlink'))),
            g === 'platform' ? h('li', null, h('a', { class: 'navlink', href: ctx.config.platformBase, dataset: { nav: 'hub' } }, h('span', null, t('nav.backToHub')))) : null));
      }),
      /* Phones: the Tools button and the account menu do not fit in the header, so they live here (hidden on wider screens). */
      h('section', { class: 'phone-only', 'aria-labelledby': 'grp-acc' }, h('h2', { id: 'grp-acc' }, t('x10a.user.label')),
        h('ul', null, toolsEntry ? h('li', null, h('a', { class: 'navlink', href: '#' + toolsEntry.route, dataset: { nav: 'tools-m' } }, h('span', null, t('x10a.tools.button')))) : null,
          user.map(e => h('li', null, h('a', { class: 'navlink', href: entryHref(e, ctx.config.platformBase), dataset: { nav: e.id + '-m' } }, h('span', null, t(e.labelKey)))))))));
  const menuBtn = h('button', { class: 'iconbtn', type: 'button', 'aria-expanded': 'false', 'aria-controls': drawerId, dataset: { action: 'menu' }, 'aria-label': t('a11y.menuOpen') },
    icon('menu'), h('span', { class: 'lbl' }, t('nav.menu')));
  popover({ btn: menuBtn, panel: drawer, onOpen: () => menuBtn.setAttribute('aria-label', t('a11y.menuClose')) });
  const setOpen = open => { if (open) menuBtn.click(); else closeOpen(false); };

  const langBtn = h('button', { class: 'iconbtn', type: 'button', lang: other, dataset: { action: 'lang' }, 'aria-label': t('a11y.switchTo'), onclick: () => ctx.setLocale(other) },
    icon('globe'), h('span', { class: 'lbl' }, other === 'ar' ? 'العربية' : 'English'));
  const toolsBtn = toolsEntry ? h('a', { class: 'iconbtn tools-btn', href: '#' + toolsEntry.route, dataset: { nav: 'tools' }, 'aria-current': currentPath === '/tools' ? 'page' : null },
    icon('grid'), h('span', { class: 'lbl' }, t('x10a.tools.button'))) : null;

  const pnav = h('nav', { class: 'pnav', 'aria-label': t('a11y.mainNav') }, top.map(e => e.id === 'academies'
    ? h('span', { class: 'pnav-acad' }, acadBtn)
    : navLink(e, ctx, currentPath, '')));

  const header = h('header', { class: 'hdr' },
    h('div', { class: 'hdr-in' },
      h('a', { class: 'brand', href: '#/', 'aria-label': t('app.name') }, brandMark(),
        h('span', { class: 'brand-name' }, h('span', { class: 'bn-full' }, t('app.name')), h('span', { class: 'bn-short', 'aria-hidden': 'true' }, t('app.nameShort')), h('span', { class: 'brand-sub' }, t('app.tagline')))),
      pnav,
      h('div', { class: 'hdr-tools' }, searchBtn, toolsBtn, langBtn, userBtn, menuBtn)),
    acadPanel, searchPanel, userPanel, drawer);

  /* --- Phone tab bar: the same five top items */
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': t('x10a.tabbar') }, top.map(e => h('a', { href: '#' + e.route, dataset: { tab: e.id }, 'aria-current': isCurrent(e, currentPath) ? 'page' : null },
    icon(e.icon || 'book'), h('span', null, t(e.id === 'academies' ? 'x10a.tab.academies' : e.labelKey)))));

  const crumbNav = crumbs && crumbs.length > 1 ? h('nav', { class: 'crumbs', 'aria-label': t('a11y.breadcrumb') },
    h('ol', null, crumbs.map((c, i) => h('li', null,
      i > 0 ? icon('chevron') : null,
      i < crumbs.length - 1 ? h('a', { href: c.href }, c.label) : h('span', { 'aria-current': 'page' }, c.label))))) : null;

  const footerEntries = shellEntries(ctx.nav, roles, 'footer');
  const footer = h('footer', { class: 'ftr' },
    h('div', { class: 'ftr-in' },
      h('p', null, t('footer.rights')),
      h('nav', { 'aria-label': t('nav.groups.utility') },
        footerEntries.map(e => h('a', { href: '#' + e.route, dataset: { nav: e.id } }, t(e.labelKey))),
        h('a', { href: ctx.config.platformBase, dataset: { nav: 'hub' } }, t('nav.backToHub'))),
      h('p', { class: 'note' }, t('footer.version'), ' ', h('bdi', { dir: 'ltr' }, ctx.config.version))),
    h('span', { id: 'ext-note', class: 'sr-only' }, t('a11y.external')));

  return { header, crumbNav, footer, tabbar, closeMenu: () => setOpen(false) };
}
