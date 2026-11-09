#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 9 suite (Quality Academy, ASQ explorer, CMQ/OE Center, visual layer). Playwright + axe-core.

A. Reviewer journey (drafts visible with a preview banner): Quality landing (hero art, four live counts, starting point, routes,
   courses with covers, ASQ certifications, method guides, toolkits), ASQ explorer (filters in the URL, comparison table, pending
   facts link to asq.org), CMQ/OE certification page (verified / secondary / pending states, retake fee, RUs, planner with invalid
   input), CMQ/OE Center (diagnostic with "I don't know" → weak area, readiness, hours planner), course page (marketing hero with
   cover, value strip, outcome cards, personas, figures strip, ASQ certification link), lesson player (numbered figures with an
   accessible text alternative and "how to read"), catalog covers, home academy tiles, evidence journey (profile → readiness →
   engineer route), route skipping.
B. Learner: Phase 9 drafts stay hidden until approved (honest empty states, one h1), figures hidden while unapproved, nav entry live.
C. Responsive matrix (AR/EN × 390/768/1280), console, axe (light + dark), storage keys.
Usage: python3 tests/e2e/run_e2e_phase9.py [--evidence DIR]   Results: <evidence>/e2e-phase9-results.json (only executed checks).
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
AXE = (ACADEMY / 'tests' / 'vendor' / 'axe.min.js').read_text(encoding='utf-8')
SEED = lambda f: json.loads((ACADEMY / 'data' / 'seed' / f).read_text(encoding='utf-8'))['items']
QUESTIONS = {q['id']: q for q in SEED('questions.json')}
ASSESS = {a['id']: a for a in SEED('assessments.json')}
COURSES = {c['id']: c for c in SEED('courses.json')}
CERTS = [c for c in SEED('certifications.json') if c.get('body') == 'ASQ']
FIGS = SEED('figures.json')
PUBLISHED = lambda r: r['governance']['content_status'] == 'published'
QC = [c for c in COURSES.values() if c.get('ecosystem') == 'quality' and not c.get('guide')]
ROUTES = ['/academy/quality', '/academy/quality/certifications', '/academy/quality/certifications/cmq-oe', '/academy/quality/cmqoe',
          '/academy/courses/spc-basics', '/academy/courses/spc-basics/L02', '/academy/courses', '/']


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
    results.append({'test': name, 'ok': bool(ok), 'detail': str(detail)[:600]})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''))

def watch(page):
    logs = []
    page.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') and (m.location or {}).get('url', BASE).startswith(BASE) else None)
    page.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
    return logs

def go(page, route, lang='en'):
    page.goto(f'{BASE}/academy/?lang={lang}#{route}')
    page.wait_for_selector('html[data-ready]')
    page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=10000)
    page.wait_for_timeout(250)

def as_role(page, role):
    page.goto(f'{BASE}/academy/'); page.wait_for_selector('html[data-ready]')
    page.evaluate('r => localStorage.setItem("cia:v1:session", JSON.stringify({ roles: [r] }))', role)

def axe(page):
    page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")

def layout(page):
    return page.evaluate('() => ({ h1: document.querySelectorAll("h1").length, over: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, dir: document.documentElement.dir, lang: document.documentElement.lang })')

def answer(page, aid, unknown=lambda q: False):
    for qid in ASSESS[aid]['question_ids']:
        if unknown(QUESTIONS[qid]): page.check(f'[data-unknown="{qid}"]')
        else: page.check(f'input[name="q-{qid}"][value="{QUESTIONS[qid]["correct_answer"]}"]')
    page.click('[data-action=submit-assessment]'); page.wait_for_timeout(600)

try:
  with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- A. Reviewer journey ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    as_role(page, 'reviewer')
    go(page, '/academy/quality')
    stats = page.locator('.q-hero .stat').count(); art = page.locator('.q-hero > svg.banner-art').count()
    drafts = any(not PUBLISHED(c) for c in QC) or any(not PUBLISHED(c) for c in CERTS)
    record('Quality landing: illustrated hero with four live counts, a preview banner while drafts remain, starting point "explore" without a profile',
           stats == 4 and art == 1 and page.locator('[data-preview]').count() == (1 if drafts else 0) and page.get_attribute('[data-start]', 'data-start') == 'explore', f'{stats} {art}')
    n_routes = page.locator('section[aria-labelledby=q-routes] [data-route^="ROUTE-Q-"]').count()
    n_courses = page.locator('section[aria-labelledby=q-courses] [data-course]').count()
    covers = page.locator('section[aria-labelledby=q-courses] [data-course] .cover svg.cover-art').count()
    n_certs = page.locator('section[aria-labelledby=q-certs] [data-cert]').count()
    n_methods = page.locator('section[aria-labelledby=q-methods] [data-course]').count()
    tools = page.locator('section[aria-labelledby=q-learnuse] [data-module]').count()
    record('Quality landing lists 5 routes, 9 courses each with a cover, 9 ASQ certifications, the method-guide courses and the quality toolkits',
           n_routes == 5 and n_courses == 9 and covers == 9 and n_certs == 9 and n_methods >= 12 and tools >= 10, f'{n_routes} {n_courses} {covers} {n_certs} {n_methods} {tools}')

    go(page, '/academy/quality/certifications')
    page.select_option('#pf-area', 'improvement'); page.wait_for_timeout(200)
    shown = page.locator('#cert-list [data-cert]').count(); url_ok = 'area=improvement' in page.url
    page.reload(); page.wait_for_selector('html[data-ready]'); page.wait_for_timeout(400)
    kept = page.locator('#cert-list [data-cert]').count() == 2 and page.input_value('#pf-area') == 'improvement'
    pend = page.locator('.table-wrap a.pending')
    pend_ok = pend.count() >= 1 and all('asq.org' in (pend.nth(i).get_attribute('href') or '') for i in range(pend.count()))
    record('ASQ explorer: area filter (Green and Black Belt) kept in the URL and after reload; comparison table sends unconfirmed facts to asq.org',
           shown == 2 and url_ok and kept and pend_ok, f'{shown} {url_ok} {kept} {pend.count()}')
    pmi_only = None
    go(page, '/academy/pmi/certifications'); pmi_only = page.locator('#cert-list [data-cert][data-body=ASQ]').count() == 0 and page.locator('#cert-list [data-cert]').count() == 8
    record('the PMI explorer still shows only the eight PMI certifications', pmi_only)

    go(page, '/academy/quality/certifications/cmq-oe')
    st = {g: page.get_attribute(f'[data-fact={g}]', 'data-state') for g in ('eligibility', 'exam', 'fee', 'renewal', 'domains')}
    bars = page.locator('section[data-fact=domains] .bars li').count()
    fee_txt = page.inner_text('section[data-fact=fee]'); ren_txt = page.inner_text('section[data-fact=renewal]')
    claims = page.locator('[data-claims]').count() == 1 and 'not an ASQ partner' in page.inner_text('[data-claims]')
    page.fill('#hp-total', '200'); page.wait_for_timeout(150); rows = page.locator('.planner-out tbody tr').count()
    page.fill('#hp-total', '5'); page.wait_for_timeout(150); invalid = page.get_attribute('#hp-total', 'aria-invalid') == 'true' and page.is_visible('#hp-err')
    record('CMQ/OE page: four groups verified, BoK counts marked "from a provider\'s summary", 7 area bars, retake fee and 18 RUs, claims banner, planner recalculates and rejects invalid input',
           st == {'eligibility': 'verified', 'exam': 'verified', 'fee': 'verified', 'renewal': 'verified', 'domains': 'secondary'} and bars == 7 and '385' in fee_txt and '18' in ren_txt and claims and rows == 8 and invalid,
           f'{st} {bars} {rows} {invalid}')
    go(page, '/academy/quality/certifications/cqia')
    record('CQIA page: the fee is "not confirmed — check ASQ" (two ASQ pages disagree) and recertification reads "lifetime"',
           page.get_attribute('[data-fact=fee]', 'data-state') == 'pending' and 'asq.org' in (page.get_attribute('section[data-fact=fee] a', 'href') or '') and 'ifetime' in page.inner_text('section[data-fact=renewal]'))

    # CMQ/OE Center: before and after the diagnostic
    go(page, '/academy/quality/cmqoe')
    before = page.get_attribute('[data-attempt]', 'data-attempt') == 'none' and page.get_attribute('[data-readiness]', 'data-readiness') == 'none' and page.locator('.bok-grid li[data-state=none]').count() == 7
    go(page, '/assessments/cmqoe-center-diagnostic')
    unk = page.locator('[data-unknown]').count() == 14
    area = ASSESS['ASM-CMQOE-DIAG']['bok_areas']
    answer(page, 'ASM-CMQOE-DIAG', unknown=lambda q: area.get(q['id']) == 5)   # "I don't know" on Supply Chain Management
    go(page, '/academy/quality/cmqoe')
    weak = page.get_attribute('.bok-grid li[data-area="5"]', 'data-state'); ok_n = page.locator('.bok-grid li[data-state=ok]').count()
    ri = page.get_attribute('[data-readiness]', 'data-readiness')
    page.fill('#cc-total', '120'); page.wait_for_timeout(150); prow = page.locator('[data-planner=cmqoe] tbody tr').count()
    page.fill('#cc-total', '1000'); page.wait_for_timeout(150); cinv = page.get_attribute('#cc-total', 'aria-invalid') == 'true'
    plan12 = page.locator('[data-plan12] .timeline > li').count()
    record('CMQ/OE Center: no evidence → nothing invented; after the diagnostic ("I don\'t know" on one area) that area is weak, six are demonstrated, readiness 88 %, hours planner and 12-week plan',
           before and unk and weak == 'weak' and ok_n == 6 and ri == str(round(100 * (165 - 19) / 165)) and prow == 8 and cinv and plan12 == 7, f'{before} {unk} {weak} {ok_n} {ri} {prow} {cinv} {plan12}')

    # course page and lesson player
    go(page, '/academy/courses/spc-basics')
    hero = page.locator('header.chero .cover svg.cover-art').count() == 1 and page.locator('header.chero h1').count() == 1
    vals = page.locator('.valuestrip li').count(); outc = page.locator('.outcards li').count(); pers = page.locator('.personas li').count()
    figs = page.locator('section[aria-labelledby=c-vis] .fig').count()
    asq_link = page.locator('section[aria-labelledby=c-links] a[href^="#/academy/quality/certifications/"]').count()
    record('course page: marketing hero with cover art, 4-point value strip, numbered outcome cards, persona cards, figures strip and ASQ certification links',
           hero and vals == 4 and outc == 4 and pers == 3 and figs >= 2 and asq_link >= 2, f'{hero} {vals} {outc} {pers} {figs} {asq_link}')
    go(page, '/academy/courses/spc-basics/L02')
    lf = page.locator('article.lesson figure.fig')
    alt = lf.first.locator('svg.fig-svg').get_attribute('aria-label') or ''
    numbered = 'Figure 1.' in lf.first.inner_text()
    lf.first.locator('details.fig-read summary').click(); page.wait_for_timeout(100)
    read_open = lf.first.locator('details.fig-read').get_attribute('open') is not None
    pos = page.evaluate('() => { const b = [...document.querySelectorAll("article.lesson > *")]; return b.findIndex(x => x.matches("figure.fig")) > b.findIndex(x => x.matches("[data-block=concept]")); }')
    record('lesson player: figures placed after the concept, numbered, with an accessible text alternative built from the labels and a "how to read it" disclosure',
           lf.count() >= 2 and len(alt) > 40 and 'Subgroup' in alt and numbered and read_open and pos, f'{lf.count()} {len(alt)} {numbered} {read_open} {pos}')
    go(page, '/academy/courses/spc-basics/L02', 'ar')
    rtl_fig = page.locator('article.lesson svg.fig-svg[direction=rtl]').count() >= 2 and 'الشكل' in page.inner_text('article.lesson figure.fig >> nth=0')
    record('Arabic lesson: figures render right-to-left with Arabic labels and numbering', rtl_fig)

    go(page, '/academy/courses')
    cards = page.locator('article.ccard'); cv = page.locator('article.ccard .cover svg.cover-art').count()
    motifs = set(page.evaluate('() => [...document.querySelectorAll("article.ccard svg.cover-art")].map(s => s.dataset.motif)'))
    record('catalog: every course card has generated cover art (several motifs), level and family chips',
           cards.count() >= 60 and cv == cards.count() and len(motifs) >= 8 and page.locator('article.ccard .chip-level').count() == cards.count(), f'{cards.count()} {cv} {len(motifs)}')
    go(page, '/')
    tiles = page.locator('.acad-tiles .acad-tile').count(); qtile = page.locator('.acad-tiles a[href="#/academy/quality"]').count()
    record('home: illustrated academy tiles (four since Phase 9, five since Phase 10) including the Quality Academy', tiles >= 4 and qtile == 1 and page.locator('.acad-tiles svg.banner-art').count() == tiles, f'{tiles} {qtile}')

    keys = page.evaluate('() => Object.keys(localStorage)')
    record('storage: the Academy writes only cia:v1:* and cia-lang', all(k.startswith('cia:v1:') or k == 'cia-lang' for k in keys), keys)
    record('no console errors or warnings in the reviewer journey', not logs, logs[:5])
    ctx.close()

    # evidence journey (fresh learner record): profile → readiness → engineer route; route skipping
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    as_role(page, 'reviewer')
    go(page, '/profile')
    page.fill('input[name=current_role]', 'Quality engineer'); page.select_option('select[name=target_role]', 'ROLE-QE')
    page.click('[data-action=save-profile]'); page.wait_for_timeout(300)
    go(page, '/academy/quality')
    s0 = page.get_attribute('[data-start]', 'data-start'); h0 = page.get_attribute('[data-action=q-start]', 'href')
    go(page, '/assessments/quality-readiness')
    answer(page, 'ASM-READY-Q-001')
    go(page, '/academy/quality')
    s1 = page.get_attribute('[data-start]', 'data-start'); t1 = page.get_attribute('[data-start]', 'data-target')
    mine = page.locator('[data-route="ROUTE-Q-ENGINEER"].card-current').count()
    go(page, '/learning-path?route=ROUTE-Q-ENGINEER')
    skipped = page.locator('[data-step="CRS-QMS-201"], [data-target="CRS-QMS-201"]').first.inner_text() if page.locator('[data-step="CRS-QMS-201"], [data-target="CRS-QMS-201"]').count() else page.inner_text('main')
    record('quality engineer without evidence → "assess"; after demonstrating QM-01…03 → SPC on the engineer route, marked as "your route"; the route skips Quality Management Foundations',
           s0 == 'assess' and h0 == '#/assessments/quality-readiness' and s1 == 'engineer' and t1 == 'CRS-Q-SPC' and mine == 1 and ('Skipped' in skipped or 'kipped' in skipped),
           f'{s0} {h0} {s1} {t1} {mine}')
    record('no console errors in the evidence journey', not logs, logs[:5])
    ctx.close()

    # ---------- B. Learner ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    as_role(page, 'learner')
    go(page, '/academy/quality')
    pub = [c for c in QC if PUBLISHED(c)]
    shown = page.locator('section[aria-labelledby=q-courses] [data-course]').count()
    record(f'learner: the Quality landing shows only published courses ({len(pub)}) with honest empty states otherwise; one h1; no preview banner',
           shown == len(pub) and layout(page)['h1'] == 1 and page.locator('[data-preview]').count() == 0, f'{shown}')
    go(page, '/academy/quality/certifications')
    pub_c = [c for c in CERTS if PUBLISHED(c)]
    record('learner: the ASQ explorer shows published certifications only, with one h1', page.locator('#cert-list [data-cert]').count() == len(pub_c) and layout(page)['h1'] == 1)
    draft = next((c for c in QC if not PUBLISHED(c)), None)
    if draft:
        go(page, f"/academy/courses/{draft['slug']}")
        record('learner: a Phase 9 draft course is not reachable by direct link (honest "not available" page)', page.locator('[data-unavailable]').count() == 1, draft['id'])
    pub_figs = [f for f in FIGS if PUBLISHED(f)]
    go(page, '/academy/courses/iso-foundations/L03')
    record(f'learner: figures appear only once approved ({len(pub_figs)} published)', page.locator('article.lesson figure.fig').count() == (1 if any(f['id'] == 'FIG-ISO-HLS' for f in pub_figs) else 0))
    go(page, '/academy/quality/cmqoe')
    record('learner: the CMQ/OE Center renders honestly whatever is published (one h1, no error state)', layout(page)['h1'] == 1 and page.locator('.error-state, [data-error]').count() == 0)
    nav_ok = page.evaluate('() => [...document.querySelectorAll("a")].some(a => a.getAttribute("href") === "#/academy/quality")')
    record('navigation: the Quality Academy entry is a live link', nav_ok)
    record('no console errors as a learner', not logs, logs[:5])
    ctx.close()

    # ---------- C. Responsive matrix, axe ----------
    bad = []
    for lang in ('ar', 'en'):
        for w in (390, 768, 1280):
            ctx = b.new_context(viewport={'width': w, 'height': 900}); page = ctx.new_page(); logs = watch(page)
            as_role(page, 'reviewer')
            for r in ROUTES:
                go(page, r, lang)
                L = layout(page)
                if L['h1'] != 1 or L['over'] or L['lang'] != lang or L['dir'] != ('rtl' if lang == 'ar' else 'ltr'): bad.append(f'{lang}@{w} {r} {L}')
            if logs: bad.append(f'{lang}@{w} console {logs[:2]}')
            ctx.close()
    record(f'responsive matrix: {len(ROUTES) * 6} loads ({len(ROUTES)} routes × 3 widths × AR/EN) — one h1, lang/dir, no horizontal overflow, no console errors', not bad, bad[:4])
    ax = []
    for scheme in ('light', 'dark'):
        for lang in ('ar', 'en'):
            ctx = b.new_context(viewport={'width': 390 if lang == 'ar' else 1280, 'height': 900}, color_scheme=scheme); page = ctx.new_page()
            as_role(page, 'reviewer')
            for r in ROUTES:
                go(page, r, lang)
                v = axe(page)
                if v: ax.append(f'{scheme} {lang} {r}: {v}')
            ctx.close()
    record(f'axe-core WCAG 2.1 A/AA + best practice: 0 violations on {len(ROUTES)} Phase 9 routes (AR@390, EN@1280, light + dark)', not ax, ' | '.join(ax[:3]))
    b.close()
finally:
    srv.terminate()

(EVID / 'e2e-phase9-results.json').write_text(json.dumps({'suite': 'phase9', 'date': time.strftime('%Y-%m-%d'), 'results': results}, ensure_ascii=False, indent=1), encoding='utf-8')
print(f"{sum(r['ok'] for r in results)}/{len(results)} passed")
sys.exit(0 if all(r['ok'] for r in results) else 1)
