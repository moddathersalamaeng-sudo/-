/**
 * Continual Improvement Academy — bootstrap (Phase 1 foundation, extended through Phase 10).
 * Mounted at /academy/ beside the live CIA hub (index.html) and its toolkits (modules/).
 * Views are plain functions (ctx, match) → Node; routes are declared once in ROUTES below.
 * © 2026 Modather Salama — Continual Improvement Academy. All rights reserved.
 */
import { h, clear } from './core/dom.js';
import { I18n, resolveInitialLocale, SHARED_LANG_KEY, LOCALES } from './core/i18n.js';
import { Router, canAccess } from './core/router.js';
import { redirectFor, hashFor } from './nav/redirects.js';
import { SplitJsonAdapter } from './data/adapters/split-json.js';
import { StaticJsonAdapter } from './data/adapters/static-json.js';
import { LocalStorageAdapter } from './data/adapters/local-storage.js';
import { MemoryAdapter } from './data/adapters/memory.js';
import { CollectionRepository, ContentRepository } from './data/repository.js';
import { RelationshipIndex } from './data/relationships.js';
import { LocalSession } from './session/session.js';
import { validateRegistry } from './nav/registry.js';
import { renderShell } from './ui/shell.js';
import { ErrorState } from './ui/components.js';
import { homeView } from './views/home.js';
import { meView } from './views/me.js';
import { settingsView } from './views/settings.js';
import { governanceView } from './views/governance.js';
import { componentsView } from './views/components.js';
import { notFoundView, forbiddenView } from './views/status.js';
import { profileView, myCompetenciesView, frameworkView, rolesView } from './views/profile.js';
import { courseCatalogView, courseDetailView, lessonView, programsView } from './views/courses.js';
import { reviewView } from './views/review.js';
import { assessmentsView, assessmentDetailView, assessmentHistoryView } from './views/assessments.js';
import { recommendationsView, learningPathView } from './views/recommendations.js';
import { isoAcademyView, isoStandardView } from './views/iso.js';
import { knowledgeIndexView, ecosystemView, articleView, libraryView, libraryItemView, myLibraryView } from './views/knowledge.js';
import { guidesIndexView, guideView, guideItemView } from './views/guides.js';
import { pmiAcademyView, certificationsView, certificationView } from './views/pmi.js';
import { qualityAcademyView, cmqoeCenterView } from './views/quality.js';
import { excellenceAcademyView, excellenceLabView, excellenceLabSummaryView } from './views/excellence.js';
import { academiesView } from './views/academies.js';
import { welcomeView } from './views/welcome.js';
import { mySpaceView } from './views/myspace.js';
import { libraryHubView } from './views/library-hub.js';
import { searchView } from './views/search.js';
import { toolsView } from './views/tools.js';

const ROUTES = [
  { path: '/', view: homeView, titleKey: 'home.title' },
  /* Phase 10A: the five-item structure. Old addresses (/me, /profile, /knowledge, /guides …) redirect — src/nav/redirects.js. */
  { path: '/academies', view: academiesView, titleKey: 'nav.items.academies' },
  { path: '/welcome', view: welcomeView, titleKey: 'x10a.welcome.title' },
  { path: '/my', view: mySpaceView, titleKey: 'nav.items.mySpace' },
  { path: '/library', view: libraryHubView, titleKey: 'nav.items.library' },
  { path: '/search', view: searchView, titleKey: 'x10a.search.title' },
  { path: '/tools', view: toolsView, titleKey: 'x10a.tools.title' },
  { path: '/me', view: meView, titleKey: 'me.title' },
  { path: '/settings', view: settingsView, titleKey: 'settings.title' },
  { path: '/about-governance', view: governanceView, titleKey: 'x10a.about.title' },
  { path: '/profile', view: profileView, titleKey: 'profile.title' },
  { path: '/profile/competencies', view: myCompetenciesView, titleKey: 'profile.competencies' },
  { path: '/competencies', view: frameworkView, titleKey: 'profile.framework' },
  { path: '/competencies/roles', view: rolesView, titleKey: 'profile.roles' },
  { path: '/academy/courses', view: courseCatalogView, titleKey: 'courses.title' },
  { path: '/academy/courses/:slug', view: courseDetailView, titleKey: 'courses.title' , parent: ['/academy/courses', 'courses.title'] },
  { path: '/academy/courses/:slug/:lesson', view: lessonView, titleKey: 'p7.lesson.title' , parent: ['/academy/courses', 'courses.title'] },
  { path: '/academy/iso', view: isoAcademyView, titleKey: 'nav.items.isoAcademy' },
  { path: '/academy/iso/:slug', view: isoStandardView, titleKey: 'nav.items.isoAcademy' },
  { path: '/academy/pmi', view: pmiAcademyView, titleKey: 'nav.items.pmiAcademy' },
  { path: '/academy/pmi/certifications', view: certificationsView, titleKey: 'nav.items.certification' },
  { path: '/academy/pmi/certifications/:slug', view: certificationView, titleKey: 'nav.items.certification' },
  { path: '/academy/quality', view: qualityAcademyView, titleKey: 'nav.items.qualityAcademy' },
  { path: '/academy/quality/certifications', view: (ctx, m) => certificationsView(ctx, m, 'ASQ'), titleKey: 'nav.items.certification' },
  { path: '/academy/quality/certifications/:slug', view: (ctx, m) => certificationView(ctx, m, 'ASQ'), titleKey: 'nav.items.certification' },
  { path: '/academy/quality/cmqoe', view: cmqoeCenterView, titleKey: 'q9.center.eyebrow' },
  { path: '/academy/excellence', view: excellenceAcademyView, titleKey: 'nav.items.excellenceAcademy' },
  { path: '/academy/excellence/recognition', view: (ctx, m) => certificationsView(ctx, m, 'EFQM'), titleKey: 'ex10.explorerTitle' },
  { path: '/academy/excellence/recognition/:slug', view: (ctx, m) => certificationView(ctx, m, 'EFQM'), titleKey: 'ex10.explorerTitle' },
  { path: '/academy/excellence/lab', view: excellenceLabView, titleKey: 'nav.items.excellenceLab' },
  { path: '/academy/excellence/lab/summary', view: excellenceLabSummaryView, titleKey: 'ex10.lab.summaryTitle' },
  { path: '/academy/programs', view: programsView, titleKey: 'programs.title' },
  { path: '/recommendations', view: recommendationsView, titleKey: 'recommendations.title' },
  { path: '/learning-path', view: learningPathView, titleKey: 'learningPath.title' },
  { path: '/assessments', view: assessmentsView, titleKey: 'assessments.title' },
  { path: '/assessments/history', view: assessmentHistoryView, titleKey: 'assessments.history' , parent: ['/assessments', 'assessments.title'] },
  { path: '/assessments/:slug', view: assessmentDetailView, titleKey: 'assessments.title' , parent: ['/assessments', 'assessments.title'] },
  { path: '/knowledge', view: knowledgeIndexView, titleKey: 'knowledge.title' },
  { path: '/knowledge/:ecosystem', view: ecosystemView, titleKey: 'knowledge.title' , parent: ['/library', 'nav.items.library'] },
  { path: '/knowledge/:ecosystem/:slug', view: articleView, titleKey: 'knowledge.title' , parent: ['/library', 'nav.items.library'] },
  { path: '/guides', view: guidesIndexView, titleKey: 'gd.title' },
  { path: '/guides/:slug', view: guideView, titleKey: 'gd.title' , parent: ['/library', 'nav.items.library'] },
  { path: '/guides/:slug/:ref', view: guideItemView, titleKey: 'gd.title' , parent: ['/library', 'nav.items.library'] },
  { path: '/library/:id', view: libraryItemView, titleKey: 'library.title' , parent: ['/library', 'nav.items.library'] },
  { path: '/my-library', view: myLibraryView, titleKey: 'library.my' },
  { path: '/review', view: reviewView, titleKey: 'p7.review.title', roles: ['reviewer', 'admin'] },
  { path: '/dev/components', view: componentsView, titleKey: 'components.title', roles: ['admin'] }
];

function storageOrNull() {
  try { const k = 'cia:v1:__probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch { return null; }
}

async function getJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

async function boot() {
  const root = document.getElementById('app');
  const config = await getJson('./data/config.json');
  const [ar, en, navDoc, taxonomies, relDoc] = await Promise.all([
    getJson('./data/i18n/ar.json'), getJson('./data/i18n/en.json'), getJson('./data/seed/navigation.json'),
    getJson('./data/seed/taxonomies.json'), getJson('./data/seed/relationships.json')
  ]);
  const navErrors = validateRegistry(navDoc.items);
  if (navErrors.length) throw new Error('Navigation registry invalid: ' + navErrors.join('; '));

  const storage = storageOrNull();
  const params = new URLSearchParams(location.search);
  /* A review build (config.reviewBuild) is a single-file preview for the content owner: it starts in the
     reviewer role and keeps the role switcher. Production builds never set it. */
  const devMode = (config.reviewBuild === true || config.devHosts.includes(location.hostname)) && params.get('dev') !== '0';
  const session = new LocalSession({ storage: storage || { getItem: () => null, setItem() {} }, devMode, defaultRoles: config.reviewBuild ? ['reviewer'] : null });
  const userAdapter = storage ? new LocalStorageAdapter({ storage, userId: session.user.id }) : new MemoryAdapter();
  const content = new StaticJsonAdapter({ base: './data/seed' });
  const competencyContent = new StaticJsonAdapter({ base: './data/seed/competency' });
  const guideContent = new StaticJsonAdapter({ base: './data/guides' });
  /* Phase 10A: courses and questions are split per academy and fetched on demand (data/seed/split/, D-49). */
  const split = new SplitJsonAdapter({ base: './data/seed/split' });
  let searchIndexP = null;
  const guideFiles = new Map();

  const locale = resolveInitialLocale({ search: location.search, storage });
  const prefsRepo = new CollectionRepository({ adapter: userAdapter, collection: 'prefs' });
  const loadPrefs = async () => ({ id: 'ui', theme: 'system', digits: config.defaultDigits[locale] || 'latn', ...(await prefsRepo.get('ui').catch(() => null) || {}) });
  let prefs = await loadPrefs();

  const i18n = new I18n({ dictionaries: { ar, en }, locale, digits: prefs.digits, onMissing: (k, l) => console.warn(`[i18n] missing ${l}:${k}`) });

  const ctx = {
    config, i18n, session, taxonomies, userAdapter, nav: navDoc.items, split,
    platformSystems: {},
    relationships: new RelationshipIndex(relDoc.items),
    t: (k, p) => i18n.t(k, p),
    get prefs() { return prefs; },
    repos: {
      enrollments: new CollectionRepository({ adapter: userAdapter, collection: 'enrollments' }),
      activity: new CollectionRepository({ adapter: userAdapter, collection: 'activity' }),
      sources: new CollectionRepository({ adapter: content, collection: 'sources' }),
      ecosystems: new ContentRepository({ adapter: content, collection: 'ecosystems' }),
      articles: new ContentRepository({ adapter: content, collection: 'knowledge-articles' }),
      courses: new ContentRepository({ adapter: split, collection: 'courses' }),
      coursesIndex: new ContentRepository({ adapter: split, collection: 'courses-index' }),
      bookmarks: new CollectionRepository({ adapter: userAdapter, collection: 'bookmarks' }),
      studyPlan: new CollectionRepository({ adapter: userAdapter, collection: 'study_plan' }),
      guides: new ContentRepository({ adapter: guideContent, collection: 'index' }),
      lessonGuideMap: new CollectionRepository({ adapter: content, collection: 'lesson-guide-map' }),
      isoStandards: new ContentRepository({ adapter: content, collection: 'iso-standards' }),
      certifications: new ContentRepository({ adapter: content, collection: 'certifications' }),
      /* Phase 9: explanatory figures (governed) and where they appear (plain map). Enrichment: failures never blank a page. */
      figures: new ContentRepository({ adapter: content, collection: 'figures' }),
      lessonFigures: new CollectionRepository({ adapter: content, collection: 'lesson-figures' }),
      programs: new ContentRepository({ adapter: content, collection: 'programs' }),
      /* Phase 10: the EFQM Assessment Lab definition and regional-award facts (governed), and the learner's own Lab (cia:v1:*). */
      excellence: new ContentRepository({ adapter: content, collection: 'excellence-lab' }),
      excellenceLab: new CollectionRepository({ adapter: userAdapter, collection: 'excellence_lab' }),
      competencies: new ContentRepository({ adapter: competencyContent, collection: 'competencies' }),
      targetRoles: new ContentRepository({ adapter: competencyContent, collection: 'target-roles' }),
      domains: new ContentRepository({ adapter: competencyContent, collection: 'domains' }),
      levels: new CollectionRepository({ adapter: competencyContent, collection: 'levels', idField: 'level' }),
      learningPaths: new CollectionRepository({ adapter: content, collection: 'learning-paths' }),
      recCatalog: new CollectionRepository({ adapter: content, collection: 'recommendation-catalog' }),
      reviewDecisions: new CollectionRepository({ adapter: userAdapter, collection: 'review_decisions' }),
      reviewSession: new CollectionRepository({ adapter: userAdapter, collection: 'review_session' }),
      questions: new ContentRepository({ adapter: split, collection: 'questions' }),
      assessments: new ContentRepository({ adapter: content, collection: 'assessments' }),
      recommendations: new CollectionRepository({ adapter: userAdapter, collection: 'recommendations' }),
      recommendationFeedback: new CollectionRepository({ adapter: userAdapter, collection: 'recommendation_feedback' }),
      userLearningPaths: new CollectionRepository({ adapter: userAdapter, collection: 'user_learning_paths' }),
      assessmentAttempts: new CollectionRepository({ adapter: userAdapter, collection: 'assessment_attempts' }),
      courseProgress: new CollectionRepository({ adapter: userAdapter, collection: 'course_progress' }),
      library: new ContentRepository({ adapter: content, collection: 'library-items' }),
      profile: new CollectionRepository({ adapter: userAdapter, collection: 'profile' }),
      selfLevels: new CollectionRepository({ adapter: userAdapter, collection: 'self_levels' }),
      competencyReview: new CollectionRepository({ adapter: userAdapter, collection: 'competency_review' }),
      libraryFavorites: new CollectionRepository({ adapter: userAdapter, collection: 'library_favorites' }),
      libraryNotes: new CollectionRepository({ adapter: userAdapter, collection: 'library_notes' }),
      libraryCollections: new CollectionRepository({ adapter: userAdapter, collection: 'library_collections' }),
      libraryDownloads: new CollectionRepository({ adapter: userAdapter, collection: 'library_downloads' }),
      platformModules: {
        repo: new ContentRepository({ adapter: content, collection: 'platform-modules' }),
        /** Non-critical: failure shows a retryable error in the tools region, never blocks boot. */
        async listVisible(roles) {
          const doc = await getJson('./data/seed/platform-modules.json');
          ctx.platformSystems = doc.systems || {};
          return this.repo.listVisible(roles);
        }
      }
    },
    loadSeed: name => getJson(`./data/seed/${name}.json`),
    /** The build-time search index (data/search-index.json), fetched the first time someone searches. */
    loadSearchIndex: () => (searchIndexP ||= getJson('./data/search-index.json').then(d => d.items).catch(err => { searchIndexP = null; throw err; })),
    navigate: (path) => { location.hash = '#' + path; },
    loadCompetency: name => getJson(`./data/seed/competency/${name}.json`),
    /** One guide file (data/guides/<slug>.json), cached. Callers check the guide's index record is visible first. */
    loadGuide: slug => {
      if (!/^[a-z0-9-]+$/.test(slug)) return Promise.reject(new Error('Bad guide slug'));
      if (!guideFiles.has(slug)) guideFiles.set(slug, getJson(`./data/guides/${slug}.json`).then(d => d.guide).catch(err => { guideFiles.delete(slug); throw err; }));
      return guideFiles.get(slug);
    },
    setLocale: (l) => {
      if (!(l in LOCALES)) return;
      try { storage?.setItem(SHARED_LANG_KEY, l); } catch { /* ignore */ }
      i18n.setLocale(l);
    },
    setPref: async (k, v) => { prefs = { ...prefs, [k]: v }; await prefsRepo.save(prefs); applyPrefs(); },
    reloadPrefs: async () => { prefs = await loadPrefs(); applyPrefs(); }
  };

  function applyPrefs() {
    const de = document.documentElement;
    if (prefs.theme === 'light' || prefs.theme === 'dark') de.dataset.theme = prefs.theme; else delete de.dataset.theme;
    i18n.setDigits(prefs.digits);
  }

  let firstRender = true;
  let current = null;
  function render(match) {
    current = match;
    const de = document.documentElement;
    de.lang = i18n.locale; de.dir = i18n.dir;
    let { route, path } = match;
    let view, titleKey;
    if (!route) { view = notFoundView; titleKey = 'notFound.title'; }
    else if (!canAccess(route, session.roles)) { view = forbiddenView; titleKey = 'forbidden.title'; }
    else { view = route.view; titleKey = route.titleKey; }
    const title = i18n.t(titleKey);
    document.title = i18n.t('app.docTitle', { page: title });
    const crumbs = path === '/' ? [] : [{ label: i18n.t('home.title'), href: '#/' }, ...(route?.parent && i18n.t(route.parent[1]) !== title ? [{ label: i18n.t(route.parent[1]), href: '#' + route.parent[0] }] : []), { label: title }];
    const shell = renderShell(ctx, { currentPath: route ? path : null, crumbs });
    const main = h('main', { id: 'main', class: 'main', tabindex: '-1', dataset: { route: route ? route.path : '404' } });
    try { main.append(view(ctx, match)); }
    catch (err) {
      console.warn('[cia] view failed:', err);
      main.append(ErrorState({ title: i18n.t('states.errorTitle'), body: i18n.t('states.errorBody'), retryLabel: i18n.t('states.retry'), onRetry: () => render(router.current()) }));
    }
    const banner = storage ? null : h('p', { class: 'errsum', role: 'status' }, i18n.t('states.storageBlocked'));
    clear(root).append(h('a', { class: 'skip', href: '#main', onclick: (e) => { e.preventDefault(); main.focus(); } }, i18n.t('a11y.skip')),
      h('div', { class: 'app' }, shell.header, shell.crumbNav, banner, main, shell.footer, shell.tabbar));
    if (!firstRender) { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    firstRender = false;
  }

  const router = new Router({ routes: ROUTES, render, redirect: redirectFor, hashFor });
  i18n.on('change', () => render(current || router.current()));
  session.on('change', () => render(router.current()));
  window.addEventListener('storage', (e) => { if (e.key === SHARED_LANG_KEY && e.newValue in LOCALES) i18n.setLocale(e.newValue); });
  applyPrefs();
  router.start();
  document.documentElement.dataset.ready = 'true';
}

boot().catch(err => {
  console.warn('[cia] boot failed:', err);
  const root = document.getElementById('app');
  const ar = document.documentElement.lang === 'ar';
  clear(root).append(h('main', { class: 'main' }, h('div', { class: 'state error', role: 'alert' },
    h('h1', null, ar ? 'تعذّر تشغيل الأكاديمية' : 'The Academy could not start'),
    h('p', null, ar ? 'افتح الصفحة عبر خادم ويب (وليس ملفًا محليًا) ثم أعد التحميل.' : 'Open the page through a web server (not as a local file), then reload.'),
    h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => location.reload() }, ar ? 'أعد التحميل' : 'Reload'))));
  document.documentElement.dataset.ready = 'error';
});
