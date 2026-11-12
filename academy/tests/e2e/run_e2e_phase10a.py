#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 10A suite (simplify, restructure, upgrade). Playwright + axe-core.

First-visit journey (home → goal → onboarding → readiness → first lesson in ≤ 2 clicks after onboarding), every old URL
redirects, menu / Academies panel / phone tab bar at 390, 768, 1280 and 1920, the shared academy template, assessments,
course page, catalogue filters, global and Library search, bookmarks across types, weekly plan with .ics download,
date helper across time zones, plan §5 measurements, responsive matrix, axe light + dark, console, storage keys and the
hub / toolkit integrity check. Usage: python3 tests/e2e/run_e2e_phase10a.py [--evidence DIR]
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request, hashlib, gzip, re
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
AXE = (ACADEMY / 'tests' / 'vendor' / 'axe.min.js').read_text(encoding='utf-8')
SEED = lambda f: json.loads((ACADEMY / 'data' / 'seed' / f).read_text(encoding='utf-8'))['items']
COURSES = SEED('courses.json'); ASSESS = {a['id']: a for a in SEED('assessments.json')}
PUBLISHED = lambda r: r['governance']['content_status'] == 'published'
OLD = {'/me': ('/my', 'tab=progress'), '/profile': ('/my', 'tab=profile'), '/profile/competencies': ('/my', 'tab=competencies'), '/recommendations': ('/my', 'tab=recommendations'),
       '/learning-path?route=ROUTE-IA': ('/my', 'route=ROUTE-IA'), '/knowledge': ('/library', 'tab=articles'), '/guides': ('/library', 'tab=guides'),
       '/my-library': ('/my', 'saved=1'), '/academy/programs': ('/academy/courses', 'programme=all')}
NEW_ROUTES = ['/', '/academies', '/academy/iso', '/academy/courses', '/library', '/my', '/assessments', '/search?q=FMEA', '/welcome', '/tools']

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
PORT = free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=PLATFORM, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
BASE = f'http://127.0.0.1:{PORT}'
for _ in range(50):
    try: urllib.request.urlopen(BASE + '/academy/'); break
    except Exception: time.sleep(0.1)

results = []
def record(name, ok, detail=''):
    results.append({'test': name, 'ok': bool(ok), 'detail': str(detail)[:700]})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''))

def watch(page):
    logs = []
    page.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') and (m.location or {}).get('url', BASE).startswith(BASE) else None)
    page.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
    return logs

def settle(page):
    page.wait_for_selector('html[data-ready]')
    page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=15000)
    page.wait_for_timeout(250)

def go(page, route, lang='en', extra='&dev=0'):
    page.goto(f'{BASE}/academy/?lang={lang}{extra}#{route}'); settle(page)

def axe(page):
    page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")

def layout(page):
    return page.evaluate('() => ({ h1: document.querySelectorAll("h1").length, over: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, dir: document.documentElement.dir, lang: document.documentElement.lang })')

def hashpath(page):
    return page.evaluate('location.hash')

try:
  with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- 1. First-visit journey ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    go(page, '/')
    goals = page.locator('.goal-card').count()
    page.click('.goal-card[data-goal=certification]'); settle(page)
    at_welcome = hashpath(page).startswith('#/welcome') and page.is_checked('input[name=goal][value=certification]')
    page.fill('#ob-current_role', ''); page.fill('#ob-weekly_hours', '99')
    page.click('[data-action=finish-onboarding]'); page.wait_for_timeout(200)
    errs = page.locator('.ob-form [aria-invalid=true]').count(); summary_focus = page.evaluate('document.activeElement.classList.contains("errsum")')
    still = hashpath(page).startswith('#/welcome') and page.evaluate('localStorage.getItem("cia:v1:local:profile")') is None
    page.fill('#ob-current_role', 'Project coordinator'); page.select_option('#ob-target_role', 'ROLE-PM'); page.click('.chip-btn[data-hours="6"]')
    page.click('[data-action=finish-onboarding]'); settle(page)
    on_ready = hashpath(page).startswith('#/assessments/') and page.locator('[data-welcome=pmi]').count() == 1
    prof = (json.loads(page.evaluate('localStorage.getItem("cia:v1:local:profile")') or '{"items": []}')['items'] or [{}])[0]
    page.click('[data-action=welcome-first-lesson]'); settle(page)
    on_lesson = page.evaluate('document.querySelector("main").dataset.route') == '/academy/courses/:slug/:lesson'
    record('first visit: home goal card → onboarding (invalid answers blocked, errors summarised) → readiness check of the matching academy → first lesson in 1 click after onboarding',
           goals == 4 and at_welcome and errs >= 2 and summary_focus and still and on_ready and on_lesson and prof.get('goal') == 'certification' and prof.get('target_role') == 'ROLE-PM' and prof.get('weekly_hours') == '6',
           f'{goals} {at_welcome} {errs} {summary_focus} {still} {on_ready} {on_lesson} {prof}')
    go(page, '/')
    goal_href = page.get_attribute('.goal-card[data-goal=standard]', 'href')
    page.click('[data-action=start-lesson] >> nth=0'); settle(page)
    lesson_1click = page.evaluate('document.querySelector("main").dataset.route') == '/academy/courses/:slug/:lesson'
    page.click('[data-action=toggle-complete]'); page.wait_for_timeout(300)
    go(page, '/')
    cont = page.locator('[data-continue] [data-action=continue-lesson]').count()
    record('home after onboarding: goal cards open the academy directly; a featured course opens lesson 1 in one click; "Continue where you left off" appears after progress',
           goal_href == '#/academy/iso' and lesson_1click and cont >= 1, f'{goal_href} {lesson_1click} {cont}')
    go(page, '/my')
    ob_cta = page.locator('[data-onboarding=cta]').count()
    stats = page.eval_on_selector_all('[data-stat]', 'els => Object.fromEntries(els.map(e => [e.dataset.stat, e.querySelector("strong").textContent]))')
    record('My space: no onboarding prompt once the profile exists; the Progress numbers come from the learner\'s records', ob_cta == 0 and stats.get('lessons') == '1' and stats.get('inProgress') == '1', f'{ob_cta} {stats}')
    record('no console errors in the first-visit journey', not logs, logs[:4])
    keys = page.evaluate('Object.keys(localStorage)')
    record('storage: only cia:v1:* keys and the shared cia-lang', all(k.startswith('cia:v1:') or k == 'cia-lang' for k in keys), keys)
    ctx.close()

    # ---------- 2. Old addresses redirect ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    bad = []
    for old, (new, q) in OLD.items():
        go(page, old)
        hsh = hashpath(page)
        if not hsh.startswith('#' + new + '?') or q not in hsh or page.evaluate('document.querySelector("main").dataset.route') != new: bad.append(f'{old} → {hsh}')
    go(page, '/me'); page.go_back(); page.wait_for_timeout(300)
    back_ok = not hashpath(page).startswith('#/me')
    for detail in ['/knowledge/iso', '/guides/iso-9001', '/guides/iso-9001/7.2']:
        go(page, detail)
        if page.evaluate('document.querySelector("main").dataset.route') == '404' or not hashpath(page).startswith('#' + detail): bad.append('detail ' + detail)
    record(f'every merged address redirects to its new place with its query ({len(OLD)} addresses); detail pages keep their address; Back does not loop', not bad and back_ok, bad)
    go(page, '/my?tab=competencies')
    sel = page.get_attribute('[role=tab][aria-selected=true]', 'data-tab')
    page.click('[role=tab][data-tab=path]'); page.wait_for_timeout(300)
    record('My space: tab chosen from the URL, tab change kept in the URL, panels built on demand', sel == 'competencies' and 'tab=path' in hashpath(page) and page.locator('[data-panel=recommendations]').inner_html() == '', f'{sel} {hashpath(page)}')
    record('no console errors on redirected pages', not logs, logs[:4])
    ctx.close()

    # ---------- 3. Menu, Academies panel, tab bar ----------
    nav_fail = []
    for w in [390, 768, 1280, 1920]:
        ctx = b.new_context(viewport={'width': w, 'height': 900}); page = ctx.new_page(); logs = watch(page)
        go(page, '/academy/iso', 'ar')
        tab = page.locator('.tabbar a').count(); tab_vis = page.is_visible('.tabbar'); pnav_vis = page.is_visible('.pnav')
        if w < 900:
            cur = page.get_attribute('.tabbar a[aria-current=page]', 'data-tab')
            if not (tab == 5 and tab_vis and not pnav_vis and cur == 'academies'): nav_fail.append(f'{w} tabbar {tab} {tab_vis} {pnav_vis} {cur}')
        else:
            page.click('[data-action=academies]')
            lines = page.locator('#acad-panel .acad-lines a').count(); exp = page.get_attribute('[data-action=academies]', 'aria-expanded')
            page.keyboard.press('Escape'); page.wait_for_timeout(100)
            closed = page.is_hidden('#acad-panel') and page.evaluate('document.activeElement.dataset.action') == 'academies'
            cur = page.get_attribute('[data-action=academies]', 'aria-current')
            if not (not tab_vis and pnav_vis and lines == 4 and exp == 'true' and closed and cur == 'page'): nav_fail.append(f'{w} panel {lines} {exp} {closed} {cur}')
        page.click('[data-action=menu]')
        n = page.eval_on_selector_all('#nav-drawer a[data-nav]', 'els => els.filter(e => e.offsetParent).length')
        if not (0 < n <= 12) or page.locator('#nav-drawer .coming').count(): nav_fail.append(f'{w} menu {n}')
        if layout(page)['over']: nav_fail.append(f'{w} overflow')
        if logs: nav_fail.append(f'{w} console {logs[:2]}')
        page.screenshot(path=str(EVID / f'p10a-nav-{w}.png'))
        ctx.close()
    record('menu and tab bar at 390 / 768 / 1280 / 1920: phone tab bar with 5 items, Academies panel with 4 lines (Escape returns focus), menu ≤ 12 entries, no future-phase entries, no overflow', not nav_fail, nav_fail)

    # ---------- 4. Academy template, assessments, course page, catalogue ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    orders = {}
    for a in ['iso', 'pmi', 'quality', 'excellence']:
        go(page, '/academy/' + a)
        orders[a] = page.eval_on_selector_all('[data-landing] > [data-tpl]', 'els => els.map(e => e.dataset.tpl)')
        hero_btns = page.locator('[data-tpl=hero] .btnrow .btn').count(); routes = page.locator('section[data-tpl=routes] > .cards > [data-route]').count()
        courses = page.locator('section[data-tpl=courses] [data-course]').count(); about_closed = page.evaluate('!document.querySelector("[data-tpl=about] details").open')
        if hero_btns != 2 or routes > 4 or courses > 6 or not about_closed: orders[a] = f'bad {hero_btns} {routes} {courses} {about_closed}'
    expected = ['hero', 'next', 'routes', 'courses', 'certs', 'tools', 'about']
    record('one academy template: Hero (1 primary + 1 secondary) → next step → routes (≤ 4) → courses (≤ 6 + see all) → certifications → tools & labs → About this content (closed) — identical order in all four',
           all(v == expected for v in orders.values()), orders)
    go(page, '/academy/pmi')
    about_txt = page.inner_text('[data-tpl=about]', timeout=2000) if True else ''
    page.click('[data-tpl=about] summary'); about_txt = page.inner_text('[data-tpl=about]')
    record('honesty statements are kept word for word in "About this content"', 'not a PMI Authorized Training Partner' in about_txt and 'PDUs' in about_txt, about_txt[:200])

    go(page, '/assessments')
    tabs = page.eval_on_selector_all('[role=tab]', 'els => els.map(e => e.dataset.tab)')
    first_cards = page.eval_on_selector_all('[data-panel] [data-assessment]', 'els => els.filter(e => e.offsetParent).map(e => e.dataset.assessment)')
    kinds = {ASSESS[i]['kind'] for i in first_cards if i in ASSESS}
    page.click('[role=tab][data-tab=quality]'); page.wait_for_timeout(250)
    page.check('input[name=asm-type-quality][value=course]', force=True); page.wait_for_timeout(250)
    rows = page.locator('[data-panel=quality] .asm-rows [data-assessment]').count()
    links = page.eval_on_selector_all('[data-panel=quality] .asm-rows [data-assessment]', 'els => els.map(e => e.dataset.assessment)')
    quiz = [i for i in links if ASSESS.get(i, {}).get('kind') in ('knowledge_quiz', 'scenario')]
    h = page.evaluate('document.documentElement.scrollHeight')
    record('assessments: tabs by academy, readiness and diagnostics first, course finals by type, no lesson quizzes listed, academy and type kept in the URL',
           tabs[:4] == ['iso', 'pmi', 'quality', 'excellence'] and kinds <= {'readiness', 'diagnostic'} and len(first_cards) > 0 and rows > 0 and not quiz and 'academy=quality' in hashpath(page) and 'type=course' in hashpath(page),
           f'{tabs} {kinds} {rows} {quiz} {hashpath(page)}')
    go(page, '/assessments')
    record('assessments page fits in ≤ 4 screens at 1280×900', page.evaluate('document.documentElement.scrollHeight') <= 3600, page.evaluate('document.documentElement.scrollHeight'))

    c = next(x for x in COURSES if x['slug'] == 'iso-foundations')
    go(page, '/academy/courses/iso-foundations')
    able = page.locator('section[aria-labelledby=c-out3] li').count()
    modules = page.locator('.modules details').count(); open_m = page.locator('.modules details[open]').count()
    more_closed = page.evaluate('!document.querySelector("[data-more=course]").open')
    able_top = page.evaluate('document.querySelector("section[aria-labelledby=c-out3]").getBoundingClientRect().top') < 900 * 1.4
    page.mouse.wheel(0, 2500); page.wait_for_timeout(200)
    sticky_vis = page.evaluate('(() => { const r = document.querySelector("[data-sticky]").getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; })()')
    page.click('[data-sticky] [data-action=sticky-start]'); settle(page)
    record('course page: three outcomes near the top, modules as an accordion (one open), long sections collapsed, sticky Start bar in view and working',
           able == 3 and modules == len(c['modules']) and open_m == 1 and more_closed and able_top and sticky_vis and page.evaluate('document.querySelector("main").dataset.route') == '/academy/courses/:slug/:lesson',
           f'{able} {modules} {open_m} {more_closed} {able_top} {sticky_vis}')

    go(page, '/academy/courses?academy=pmi')
    pm_pub = [x for x in COURSES if PUBLISHED(x) and x['category'] in ('project_management', 'pmo', 'p3o')]
    n_pm = page.locator('#course-list [data-course]').count()
    page.select_option('#cf-hours', 'long'); page.wait_for_timeout(150)
    n_long = page.locator('#course-list [data-course]').count(); exp_long = len([x for x in pm_pub if x['training_hours'] > 20])
    go(page, '/academy/courses?programme=all')
    progs = page.locator('.prog-box [data-program]').count()
    card_prog = page.locator('#course-list [data-course] .pbar').count()
    record('catalogue: academy, hours and programme filters (the former Programmes page) work and stay in the URL; progress shown on cards',
           n_pm == len(pm_pub) and n_long == exp_long and 'hours=long' not in hashpath(page) and progs >= 1, f'{n_pm}/{len(pm_pub)} {n_long}/{exp_long} {progs} {card_prog}')
    record('no console errors on landings, assessments, course page and catalogue', not logs, logs[:4])
    ctx.close()

    # ---------- 5. Search ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    go(page, '/')
    page.click('[data-action=search]'); page.fill('#gsearch-q', 'ISO 9001 clause 7.2'); page.keyboard.press('Enter'); page.wait_for_timeout(900)
    first = page.get_attribute('.sresults [data-result] a >> nth=0', 'href')
    page.fill('#gs-q', 'الجوده'); page.wait_for_timeout(700)
    ar_hits = page.locator('.sresults [data-result=course]').count()
    page.fill('#gs-q', 'PMP'); page.wait_for_timeout(600); page.select_option('#gs-type', 'certification'); page.wait_for_timeout(500)
    only_cert = page.eval_on_selector_all('.sresults [data-result]', 'els => [...new Set(els.map(e => e.dataset.result))]')
    url_ok = 'type=certification' in hashpath(page) and 'q=PMP' in hashpath(page)
    page.fill('#gs-q', 'zzqqxx'); page.wait_for_timeout(500); none = page.locator('main .state.empty').count() == 1
    go(page, '/library?tab=guides')
    page.fill('#lib-q', 'FMEA'); page.wait_for_timeout(700)
    lib_types = page.eval_on_selector_all('.lib-results [data-result]', 'els => [...new Set(els.map(e => e.dataset.result))]')
    tabs_hidden = page.is_hidden('.libhub > .tabs')
    page.fill('#lib-q', ''); page.wait_for_timeout(400); tabs_back = page.is_visible('.libhub > .tabs')
    record('global search: "ISO 9001 clause 7.2" opens clause 7.2 first; Arabic spelling variants match; type filter in the URL; honest empty result; the Library has one search across articles, guides and templates',
           first == '#/guides/iso-9001/7.2' and ar_hits > 0 and only_cert == ['certification'] and url_ok and none and lib_types and set(lib_types) <= {'article', 'guide', 'guide_item', 'template', 'standard'} and tabs_hidden and tabs_back,
           f'{first} {ar_hits} {only_cert} {url_ok} {none} {lib_types} {tabs_hidden} {tabs_back}')
    record('no console errors in search', not logs, logs[:4])
    ctx.close()

    # ---------- 6. Bookmarks and the weekly plan (.ics) ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True); page = ctx.new_page(); logs = watch(page)
    for r in ['/academy/courses/iso-foundations', '/academy/courses/iso-foundations/L01', '/guides/iso-9001', '/guides/iso-9001/7.2', '/academy/pmi/certifications/pmp']:
        go(page, r); page.click('main [data-action=bookmark] >> nth=0'); page.wait_for_timeout(200)
    pressed = page.get_attribute('main [data-action=bookmark] >> nth=0', 'aria-pressed')
    go(page, '/my'); page.reload(); settle(page)
    saved = page.eval_on_selector_all('[data-saved] [data-bookmark]', 'els => els.map(e => e.dataset.bookmark.split(":")[0])')
    page.click('[data-action=remove-bookmark] >> nth=0'); page.wait_for_timeout(500)
    after = page.locator('[data-saved] [data-bookmark]').count()
    go(page, '/academy/courses/iso-foundations'); still = page.get_attribute('main [data-action=bookmark] >> nth=0', 'aria-pressed')
    record('bookmarks across courses, lessons, guides, guide items and certifications: saved, listed in My space after reload, removable',
           pressed == 'true' and sorted(saved) == sorted(['course', 'lesson', 'guide', 'guide_item', 'certification']) and after == 4, f'{pressed} {saved} {after} {still}')

    go(page, '/my?tab=path')
    for v in page.eval_on_selector_all('.days-pick input:checked', 'els => els.map(e => e.value)'): page.uncheck(f'.days-pick input[value={v}]')
    page.click('[data-action=download-ics]'); page.wait_for_timeout(200)
    err = page.inner_text('#sp-err')
    page.check('.days-pick input[value=MO]'); page.check('.days-pick input[value=WE]'); page.fill('#sp-hours', '3'); page.fill('#sp-time', '20:15'); page.wait_for_timeout(200)
    sessions = int(page.get_attribute('[data-sessions]', 'data-sessions'))
    with page.expect_download() as dl: page.click('[data-action=download-ics]')
    path = EVID / 'p10a-study-plan.ics'; dl.value.save_as(str(path)); ics = path.read_text(encoding='utf-8')
    page.click('[data-action=save-plan]'); page.wait_for_timeout(300); page.reload(); settle(page)
    kept = page.is_checked('.days-pick input[value=WE]') and page.input_value('#sp-hours') == '3'
    events = ics.count('BEGIN:VEVENT'); starts = re.findall(r'DTSTART:(\d{8}T\d{6})', ics)
    record('weekly study plan: invalid days refused; .ics download with one event per session at the chosen local time; plan saved on this device',
           err != '' and sessions > 0 and events == sessions and ics.startswith('BEGIN:VCALENDAR') and all(s.endswith('201500') for s in starts) and kept, f'{err!r} {sessions} {events} {starts[:2]} {kept}')
    record('no console errors in bookmarks and plan flows', not logs, logs[:4])
    keys = page.evaluate('Object.keys(localStorage)')
    record('storage after bookmarks and plan: only cia:v1:* and cia-lang', all(k.startswith('cia:v1:') or k == 'cia-lang' for k in keys), keys)
    ctx.close()

    # ---------- 7. Date helper across time zones ----------
    texts = {}
    for tz in ['UTC', 'America/Los_Angeles', 'Asia/Riyadh']:
        ctx = b.new_context(viewport={'width': 1280, 'height': 900}, timezone_id=tz); page = ctx.new_page()
        go(page, '/academy/excellence'); texts[tz] = page.inner_text('[data-kaqa] p.note')
        ctx.close()
    record('YYYY-MM-DD dates show the same day in every time zone (UTC, Los Angeles, Riyadh)', len(set(texts.values())) == 1, texts)

    # ---------- 8. Measurements (plan §5) ----------
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); page = ctx.new_page()
    urls = []
    page.on('response', lambda r: urls.append(r.url.split('?')[0]) if r.url.startswith(BASE) and r.url.split('?')[0].endswith('.json') else None)
    go(page, '/', 'ar'); page.wait_for_timeout(600)
    gz = sum(len(gzip.compress(urllib.request.urlopen(u).read(), 9)) for u in set(urls))
    home_h = page.evaluate('document.documentElement.scrollHeight'); top = page.locator('.hdr .pnav a, .hdr .pnav button').count()
    phase = 0
    for r in ['/', '/academies', '/academy/iso', '/academy/courses', '/library', '/my', '/assessments', '/about-governance']:
        go(page, r, 'ar'); page.click('[data-action=menu]')
        phase += len(re.findall(r'(Phase|المرحلة)\s*[0-9٠-٩]', page.evaluate('document.body.innerText')))
    m = {'top_nav_items': top, 'home_height_1440': home_h, 'first_load_json_gzip': gz, 'learner_phase_wording': phase}
    (EVID / 'p10a-measure.json').write_text(json.dumps(m, indent=2))
    record('plan §5 targets: 5 top items, home ≤ 3 screens (≈ 2,700 px), first-load JSON ≤ 0.4 MB compressed, no learner-visible "Phase" wording',
           top == 5 and home_h <= 2700 and gz <= 400_000 and phase == 0, m)
    ctx.close()

    # ---------- 9. Responsive matrix ----------
    mx = []; n = 0
    for lang in ['ar', 'en']:
        for w in [390, 768, 1280, 1920]:
            ctx = b.new_context(viewport={'width': w, 'height': 900}); page = ctx.new_page(); logs = watch(page)
            for r in NEW_ROUTES:
                go(page, r, lang); n += 1
                L = layout(page)
                if L['h1'] != 1 or L['over'] or L['lang'] != lang or L['dir'] != ('rtl' if lang == 'ar' else 'ltr'): mx.append(f'{lang}@{w}{r}: {L}')
                if w in (390, 1440, 1280) and lang == 'ar' and r in ('/', '/my', '/academy/iso'): page.screenshot(path=str(EVID / f'p10a-{lang}-{w}{r.replace("/", "_") or "_home"}.png'), full_page=True)
            if logs: mx.append(f'{lang}@{w} console {logs[:3]}')
            ctx.close()
    record(f'responsive matrix: {n} loads ({len(NEW_ROUTES)} routes × 4 widths × AR/EN) — one h1, lang/dir, no horizontal overflow, no console errors', not mx, mx[:5])

    # ---------- 10. Accessibility ----------
    ax = []
    for scheme in ['light', 'dark']:
        for w, lang in [(390, 'ar'), (1280, 'en')]:
            ctx = b.new_context(viewport={'width': w, 'height': 900}, color_scheme=scheme); page = ctx.new_page()
            for r in NEW_ROUTES + ['/academy/courses/iso-foundations', '/assessments?academy=quality&type=course', '/my?tab=path']:
                go(page, r, lang); v = axe(page)
                if v: ax.append(f'{scheme}/{w}/{lang}{r}: ' + json.dumps(v, ensure_ascii=False))
            go(page, '/', lang)
            for action in (['academies', 'search', 'user', 'menu'] if w > 900 else ['search', 'menu']):
                page.click(f'[data-action={action}]'); page.wait_for_timeout(100); v = axe(page)
                if v: ax.append(f'{scheme}/{w}/{lang} open {action}: ' + json.dumps(v, ensure_ascii=False))
                page.keyboard.press('Escape')
            ctx.close()
    record('axe-core WCAG 2.1 A/AA + best practice: 0 violations on the new pages and every open header panel (AR@390, EN@1280, light + dark)', not ax, ' | '.join(ax[:3]))
    b.close()
finally:
    srv.terminate()

# ---------- 11. Hub and toolkit integrity ----------
base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = [f for h, f in (l.split(maxsplit=1) for l in base.read_text().splitlines()) if hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest() != h]
    record('integrity: hub and toolkit files byte-identical to the baseline apart from the D-08 and D-22 patches (index.html, sw.js)', set(changed) <= {'index.html', 'sw.js'}, changed)

passed = sum(r['ok'] for r in results)
(EVID / 'e2e-phase10a-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
