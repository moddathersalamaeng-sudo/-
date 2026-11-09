#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 10 suite (Excellence Academy, EFQM recognition explorer, EFQM Assessment Lab). Playwright + axe-core.

A. Reviewer journey (drafts visible with a preview banner): Excellence landing (hero, counts, starting point, Lab panel, routes, courses
   with covers, recognition options, King Abdulaziz Quality Award facts, toolkits), EFQM explorer (filters in the URL, comparison
   table, pending facts link to efqm.org), recognition pages (verified / pending states, names-only criteria, claims), course page and
   lesson figure, home tile, full-width layout.
   Lab journey: invalid inputs (empty evidence, unsafe link, short finding, out-of-range score) → add evidence → findings → RADAR-style
   rating (criterion rating, unsupported flag) → analysis → prioritised plan → export JSON → reload persists → printable summary →
   clear (cancel and confirm) → import restores.
   Evidence journey: profile → readiness → self-assessment route that skips demonstrated courses.
B. Learner: Phase 10 drafts stay hidden until approved (honest empty states, one h1), the Lab waits for approval, nav entry live.
C. Responsive matrix (AR/EN × 390/768/1280), console, axe (light + dark), storage keys, hub and toolkit hashes.
Usage: python3 tests/e2e/run_e2e_phase10.py [--evidence DIR]   Results: <evidence>/e2e-phase10-results.json (only executed checks).
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request, hashlib
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
CERTS = [c for c in SEED('certifications.json') if c.get('body') == 'EFQM']
LAB = {x['id']: x for x in SEED('excellence-lab.json')}
PUBLISHED = lambda r: r['governance']['content_status'] == 'published'
XC = [c for c in COURSES.values() if c.get('ecosystem') == 'efqm' and not c.get('guide')]
ROUTES = ['/academy/excellence', '/academy/excellence/recognition', '/academy/excellence/recognition/advanced-recognised', '/academy/excellence/lab',
          '/academy/excellence/lab/summary', '/academy/courses/radar-logic', '/academy/courses/radar-logic/CRS-EX-RADAR-L01', '/']


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

def lab_state(page):
    return page.evaluate('() => { const k = Object.keys(localStorage).find(k => k.endsWith(":excellence_lab")); return k ? JSON.parse(localStorage.getItem(k)).items[0] : null; }')

try:
  with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- A. Reviewer journey ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True); page = ctx.new_page(); logs = watch(page)
    as_role(page, 'reviewer')
    go(page, '/academy/excellence')
    stats = page.locator('.ex-hero .stat').count(); art = page.locator('.ex-hero > svg.banner-art').count()
    drafts = any(not PUBLISHED(c) for c in XC) or any(not PUBLISHED(c) for c in CERTS)
    record('Excellence landing: illustrated hero with four live counts, a preview banner while drafts remain, starting point "explore" without a profile, the Lab panel',
           stats == 4 and art == 1 and page.locator('[data-preview]').count() == (1 if drafts else 0) and page.get_attribute('[data-start]', 'data-start') == 'explore'
           and page.locator('[data-lab=feature] a[href="#/academy/excellence/lab"]').count() == 1, f'{stats} {art}')
    n_routes = page.locator('section[aria-labelledby=ex-routes] [data-route^="ROUTE-EX-"]').count()
    n_courses = page.locator('section[aria-labelledby=ex-courses] [data-course]').count()
    covers = page.locator('section[aria-labelledby=ex-courses] [data-course] .cover svg.cover-art').count()
    n_certs = page.locator('section[aria-labelledby=ex-certs] [data-cert]').count()
    kaqa = page.locator('section[aria-labelledby=ex-kaqa] li').count(); kaqa_links = page.locator('section[aria-labelledby=ex-kaqa] a[href*=".gov.sa/"]').count()
    tools = page.locator('section[aria-labelledby=ex-learnuse] [data-module]').count()
    record('Excellence landing lists 4 routes, 7 courses each with a cover, 5 EFQM recognition options, 3 dated KAQA facts linked to gov.sa pages and the 4 excellence toolkits',
           n_routes == 4 and n_courses == 7 and covers == 7 and n_certs == 5 and kaqa == 3 and kaqa_links == 3 and tools == 4, f'{n_routes} {n_courses} {covers} {n_certs} {kaqa} {kaqa_links} {tools}')

    go(page, '/academy/excellence/recognition')
    page.select_option('#pf-area', 'award'); page.wait_for_timeout(200)
    shown = page.locator('#cert-list [data-cert]').count(); url_ok = 'area=award' in page.url
    page.reload(); page.wait_for_selector('html[data-ready]'); page.wait_for_timeout(400)
    kept = page.locator('#cert-list [data-cert]').count() == 1 and page.input_value('#pf-area') == 'award'
    pend = page.locator('.table-wrap a.pending')
    pend_ok = pend.count() >= 5 and all('efqm.org' in (pend.nth(i).get_attribute('href') or '') for i in range(pend.count()))
    record('EFQM explorer: type filter (award) kept in the URL and after reload; the comparison table sends unconfirmed facts (fees, validity) to efqm.org',
           shown == 1 and url_ok and kept and pend_ok, f'{shown} {url_ok} {kept} {pend.count()}')
    go(page, '/academy/pmi/certifications'); pmi_n = page.locator('#cert-list [data-cert]').count()
    go(page, '/academy/quality/certifications'); asq_n = page.locator('#cert-list [data-cert]').count()
    record('the PMI and ASQ explorers still show only their own 8 and 9 certifications', pmi_n == 8 and asq_n == 9, f'{pmi_n} {asq_n}')

    go(page, '/academy/excellence/recognition/advanced-recognised')
    st = {g: page.get_attribute(f'[data-fact={g}]', 'data-state') for g in ('eligibility', 'exam', 'fee', 'renewal', 'domains')}
    names = page.locator('section[data-fact=domains] .name-list li').count()
    rows_txt = page.inner_text('section[data-fact=exam]')
    claims = page.locator('[data-claims]').count() == 1 and 'not an EFQM partner' in page.inner_text('[data-claims]')
    record('Advanced Assessment page: eligibility, how it works and the 7 criterion names verified; fees and validity "check EFQM"; 1,000-point scale shown; claims banner; no hours planner',
           st == {'eligibility': 'verified', 'exam': 'verified', 'fee': 'pending', 'renewal': 'pending', 'domains': 'verified'} and names == 7 and '1,000' in rows_txt and claims
           and page.locator('[data-planner]').count() == 0 and 'efqm.org' in (page.get_attribute('section[data-fact=fee] a', 'href') or ''), f'{st} {names}')
    go(page, '/academy/excellence/recognition/global-award')
    record('Global Award page: the 2027 timeline (jury April 2027, gala June 2027) and Diamond ratings come from EFQM\'s page, with the stars/diamonds difference disclosed',
           'April 2027' in page.inner_text('section[data-fact=exam]') and 'Diamond' in page.inner_text('section[data-fact=exam]') and 'stars' in page.inner_text('section[data-fact=exam]'))
    go(page, '/academy/excellence/recognition/validated-by-efqm')
    states = [page.get_attribute(f'[data-fact={g}]', 'data-state') for g in ('eligibility', 'exam', 'fee', 'renewal', 'domains')]
    record('Validated by EFQM page: every fact pending (sent to efqm.org); the 2021 brochure appears only as a dated note',
           states == ['pending'] * 5 and '2021' in page.inner_text('main') and 'not confirmed' in page.inner_text('main'), states)

    go(page, '/academy/courses/excellence-foundations')
    chip = page.locator('a[href="#/academy/excellence/recognition/rapid-recognised"]').count()
    record('course page: Organisational Excellence Foundations has its cover and figures and links to the EFQM recognition option it supports',
           page.locator('.chero .cover svg').count() >= 1 and page.locator('figure.fig').count() >= 1 and chip >= 1, f'chip={chip}')
    go(page, '/academy/courses/excellence-foundations/CRS-EFQM-101-L04')
    fig = page.locator('article.lesson figure.fig[data-figure=FIG-EX-MODEL]')
    alt = fig.locator("svg.fig-svg").get_attribute("aria-label") if fig.count() else ''
    record('lesson: the seven-criteria figure is numbered, has a text alternative with the criterion names and a "how to read" note',
           fig.count() == 1 and 'Purpose, Vision & Strategy' in (alt or '') and fig.locator('.fig-no').count() == 1 and fig.locator('details.fig-read').count() == 1, alt[:80] if alt else '')

    # --- Lab journey
    go(page, '/academy/excellence/lab')
    label_ok = page.locator('[data-lab-label]').count() == 1 and 'not an EFQM assessment' in page.inner_text('[data-lab-label]')
    crit = page.locator('details.lab-crit').count()
    record('Lab: labelled "Self-assessment aid — not an EFQM assessment"; seven criteria in Direction / Execution / Results; empty plan state',
           label_ok and crit == 7 and page.locator('[data-group=direction] details.lab-crit').count() == 2 and page.locator('[data-group=results] details.lab-crit').count() == 2
           and page.locator('[data-empty=plan]').count() == 1, f'{crit}')
    page.fill('#lab-org-name', 'Example Utility'); page.locator('#lab-org-name').dispatch_event('change')
    page.fill('#lab-org-scope', 'Whole organisation'); page.locator('#lab-org-scope').dispatch_event('change')
    page.click('#lab-C1 > summary')
    page.click('#lab-C1 [data-form=evidence] button[type=submit]'); page.wait_for_timeout(150)
    e1 = page.is_visible('#ev-C1-err') and page.get_attribute('#ev-C1-title', 'aria-invalid') == 'true'
    page.fill('#ev-C1-title', 'Strategy 2026–2030'); page.fill('#ev-C1-source', 'Board-approved document'); page.fill('#ev-C1-link', 'javascript:alert(1)')
    page.click('#lab-C1 [data-form=evidence] button[type=submit]'); page.wait_for_timeout(150)
    e2 = 'https://' in page.inner_text('#ev-C1-err') and page.locator('#lab-C1 [data-list=evidence] li').count() == 0
    page.fill('#ev-C1-link', 'https://intranet.example/strategy'); page.fill('#ev-C1-date', '2026-01-15'); page.fill('#ev-C1-owner', 'Strategy office')
    page.click('#lab-C1 [data-form=evidence] button[type=submit]'); page.wait_for_timeout(200)
    added = page.locator('#lab-C1 [data-list=evidence] li').count() == 1 and page.evaluate('() => document.activeElement?.id') == 'ev-C1-title'
    record('Lab evidence: empty and unsafe-link entries are rejected accessibly (message, aria-invalid, focus); a valid entry is added and focus returns to the form', e1 and e2 and added, f'{e1} {e2} {added}')
    page.fill('#fd-C1-strengths', 'short'); page.click('#lab-C1 [data-form=strengths] button[type=submit]'); page.wait_for_timeout(120)
    short = page.is_visible('#fd-C1-strengths-err')
    page.fill('#fd-C1-strengths', 'Strategy is built from a documented stakeholder and environment analysis, reviewed every year by the board.')
    page.click('#lab-C1 [data-form=strengths] button[type=submit]'); page.wait_for_timeout(150)
    page.fill('#fd-C1-afis', 'There is limited evidence that strategic objectives are cascaded beyond directors, which may slow deployment.')
    page.click('#lab-C1 [data-form=afis] button[type=submit]'); page.wait_for_timeout(150)
    page.click('#rt-C1-approach-75'); page.wait_for_timeout(120); page.click('#rt-C1-deployment-50'); page.wait_for_timeout(120); page.click('#rt-C1-refinement-50'); page.wait_for_timeout(150)
    crating = page.get_attribute('#lab-C1 [data-crating]', 'data-crating')
    page.click('#lab-C3 > summary')
    page.fill('#fd-C3-afis', 'There is limited evidence that partner feedback is collected and used, which may limit joint improvement.')
    page.click('#lab-C3 [data-form=afis] button[type=submit]'); page.wait_for_timeout(150)
    page.click('#rt-C3-approach-75'); page.wait_for_timeout(150)
    unsup = page.locator('#lab-C3 [data-unsupported]').count() == 1
    row_c1 = page.inner_text('[data-analysis] tbody tr:nth-child(1)'); row_c3 = page.inner_text('[data-analysis] tbody tr:nth-child(3)')
    record('Lab findings and rating: a short finding is rejected; strengths and AFIs added; C1 rated 75/50/50 → criterion 58%; a rating above "some evidence" with no evidence is flagged; analysis table updates',
           short and crating == '58' and unsup and '58%' in row_c1 and 'not supported' in row_c3 and page.inner_text('[data-progress]').startswith('1 of 7'), f'{short} {crating} {unsup} {row_c3[:80]}')
    items = page.locator('[data-plan] li.plan-item')
    first_afi = items.nth(0).get_attribute('data-afi')
    c3_afi = [items.nth(i).get_attribute('data-afi') for i in range(items.count()) if 'partner feedback' in items.nth(i).inner_text()][0]
    page.fill(f'#pl-{c3_afi}-impact', '9'); page.locator(f'#pl-{c3_afi}-impact').dispatch_event('change'); page.wait_for_timeout(120)
    bad = page.is_visible(f'#pl-{c3_afi}-err') and page.get_attribute(f'#pl-{c3_afi}-impact', 'aria-invalid') == 'true'
    page.fill(f'#pl-{c3_afi}-impact', '5'); page.locator(f'#pl-{c3_afi}-impact').dispatch_event('change'); page.wait_for_timeout(150)
    page.fill(f'#pl-{c3_afi}-ease', '4'); page.locator(f'#pl-{c3_afi}-ease').dispatch_event('change'); page.wait_for_timeout(150)
    page.fill(f'#pl-{c3_afi}-action', 'Add partner reviews with shared measures'); page.locator(f'#pl-{c3_afi}-action').dispatch_event('change')
    page.fill(f'#pl-{c3_afi}-owner', 'Procurement director'); page.locator(f'#pl-{c3_afi}-owner').dispatch_event('change')
    page.fill(f'#pl-{c3_afi}-due', '2027-03-31'); page.locator(f'#pl-{c3_afi}-due').dispatch_event('change'); page.wait_for_timeout(150)
    top = page.locator('[data-plan] li.plan-item').nth(0)
    record('Lab plan: an out-of-range score is rejected accessibly; impact 5 × ease 4 = priority 20 in the "quick win" zone, sorted first; action, owner and due date saved',
           bad and top.get_attribute('data-afi') == c3_afi and top.get_attribute('data-priority') == '20' and top.get_attribute('data-zone') == 'quick' and first_afi != c3_afi, f'{bad} {top.get_attribute("data-priority")} {top.get_attribute("data-zone")}')
    with page.expect_download() as dl:
        page.click('[data-action=lab-export]')
    path = dl.value.path(); exported = json.loads(pathlib.Path(path).read_text(encoding='utf-8'))
    record('Lab export: a JSON file labelled "Self-assessment aid — not an EFQM assessment" with the analysis and the prioritised plan, and no 1,000-point total',
           exported.get('schema') == 'cia.efqm-lab.v1' and exported['label']['en'] == 'Self-assessment aid — not an EFQM assessment' and exported['prioritised_plan'][0]['priority'] == 20
           and exported['analysis']['withEvidence'] == 1 and dl.value.suggested_filename.startswith('cia-efqm-lab-') and '"1000"' not in json.dumps(exported), dl.value.suggested_filename)
    page.reload(); page.wait_for_selector('html[data-ready]'); page.wait_for_timeout(500)
    s = lab_state(page)
    persisted = s and s['org']['name'] == 'Example Utility' and len(s['criteria']['C1']['evidence']) == 1 and s['criteria']['C1']['ratings'] == {'approach': 75, 'deployment': 50, 'refinement': 50} \
        and s['plan'][c3_afi]['impact'] == 5 and page.locator('[data-plan] li.plan-item').nth(0).get_attribute('data-priority') == '20' and page.input_value('#lab-org-name') == 'Example Utility'
    record('Lab persistence: after reload the organisation, evidence, ratings and plan are restored from the learner\'s own cia:v1:*:excellence_lab record', persisted, json.dumps(s)[:200] if s else 'none')
    go(page, '/academy/excellence/lab/summary')
    summ = page.inner_text('main')
    record('printable summary: label, organisation, dimension ratings, findings per criterion and top priorities; a print button; navigation hidden when printing',
           'not an EFQM assessment' in summ and 'Example Utility' in summ and 'partner reviews' in summ and page.locator('[data-action=print]').count() == 1
           and page.locator('[data-criterion]').count() == 7, summ[:120])
    page.emulate_media(media='print'); hdr_hidden = page.evaluate('() => getComputedStyle(document.querySelector(".hdr")).display === "none"'); page.emulate_media(media='screen')
    go(page, '/academy/excellence/lab')
    page.click('[data-action=lab-reset]'); page.wait_for_selector('dialog.dlg[open]')
    page.click('dialog.dlg button:has-text("Keep my work")'); page.wait_for_timeout(200)
    kept_after_cancel = lab_state(page) is not None
    page.click('[data-action=lab-reset]'); page.wait_for_selector('dialog.dlg[open]')
    page.click('dialog.dlg button:has-text("Yes, clear everything")'); page.wait_for_timeout(600)
    cleared = (lab_state(page) is None) and page.inner_text('[data-progress]').startswith('0 of 7')
    page.set_input_files('#lab-import', path); page.wait_for_timeout(700)
    s2 = lab_state(page)
    restored = s2 and len(s2['criteria']['C1']['evidence']) == 1 and s2['plan'][c3_afi]['impact'] == 5 and page.inner_text('[data-progress]').startswith('1 of 7')
    bad_file = EVID / 'not-a-lab.json'; bad_file.write_text('{"app": "something-else"}', encoding='utf-8')
    page.set_input_files('#lab-import', str(bad_file)); page.wait_for_timeout(400)
    rejected = 'not an EFQM Assessment Lab export' in page.inner_text('main') and lab_state(page) is not None
    record('Lab clear and import: "Keep my work" cancels, "Yes, clear everything" clears; importing the exported file restores everything; a foreign file is rejected without data loss; print hides navigation',
           hdr_hidden and kept_after_cancel and cleared and restored and rejected, f'{hdr_hidden} {kept_after_cancel} {cleared} {restored} {rejected}')

    go(page, '/')
    tiles = page.locator('.acad-tiles .acad-tile').count(); xtile = page.locator('.acad-tiles a[href="#/academy/excellence"]').count()
    record('home: five illustrated academy tiles including the Excellence Academy', tiles == 5 and xtile == 1 and page.locator('.acad-tiles svg.banner-art').count() == 5, f'{tiles} {xtile}')
    keys = page.evaluate('() => Object.keys(localStorage)')
    record('storage: the Academy writes only cia:v1:* and cia-lang (the Lab record included)', all(k.startswith('cia:v1:') or k == 'cia-lang' for k in keys) and any(k.endswith(':excellence_lab') for k in keys), keys)
    record('no console errors or warnings in the reviewer and Lab journeys', not logs, logs[:5])
    ctx.close()

    # full-width layout (owner request): the main area uses the window width with gutters
    ctx = b.new_context(viewport={'width': 1920, 'height': 1000}); page = ctx.new_page()
    as_role(page, 'reviewer'); go(page, '/academy/excellence')
    w = page.evaluate('() => ({ main: document.querySelector("main").getBoundingClientRect().width, hdr: document.querySelector(".hdr-in").getBoundingClientRect().width, vw: document.documentElement.clientWidth })')
    record('full-width layout: at 1920 px the header and main area span the window (with side gutters), not a centred 76rem column', w['main'] >= w['vw'] * 0.9 and w['hdr'] >= w['vw'] * 0.9, w)
    ctx.close()

    # evidence journey (fresh learner record): profile → readiness → self-assessment route; route skipping
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    as_role(page, 'reviewer')
    go(page, '/profile')
    page.fill('input[name=current_role]', 'Excellence coordinator'); page.select_option('select[name=target_role]', 'ROLE-OEL')
    page.click('[data-action=save-profile]'); page.wait_for_timeout(300)
    go(page, '/academy/excellence')
    s0 = page.get_attribute('[data-start]', 'data-start'); h0 = page.get_attribute('[data-action=ex-start]', 'href')
    go(page, '/assessments/excellence-readiness')
    answer(page, 'ASM-READY-EX-001')
    go(page, '/academy/excellence')
    s1 = page.get_attribute('[data-start]', 'data-start'); t1 = page.get_attribute('[data-start]', 'data-target')
    mine = page.locator('[data-route="ROUTE-EX-SA"].card-current').count()
    go(page, '/learning-path?route=ROUTE-EX-SA')
    step = page.locator('[data-step="CRS-EFQM-101"], [data-target="CRS-EFQM-101"]')
    skipped = step.first.inner_text() if step.count() else page.inner_text('main')
    record('excellence lead without evidence → "assess"; after demonstrating OE-01/OE-02 → facilitation on the self-assessment route, marked "your route"; the route skips the foundations course',
           s0 == 'assess' and h0 == '#/assessments/excellence-readiness' and s1 == 'selfassess' and t1 == 'CRS-EX-SA' and mine == 1 and 'kipped' in skipped, f'{s0} {h0} {s1} {t1} {mine}')
    record('no console errors in the evidence journey', not logs, logs[:5])
    ctx.close()

    # ---------- B. Learner ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    as_role(page, 'learner')
    go(page, '/academy/excellence')
    pub = [c for c in XC if PUBLISHED(c)]
    shown = page.locator('section[aria-labelledby=ex-courses] [data-course]').count()
    record(f'learner: the Excellence landing shows only published courses ({len(pub)}) with honest empty states otherwise; one h1; no preview banner',
           shown == len(pub) and layout(page)['h1'] == 1 and page.locator('[data-preview]').count() == 0, f'{shown}')
    go(page, '/academy/excellence/recognition')
    pub_c = [c for c in CERTS if PUBLISHED(c)]
    record('learner: the EFQM explorer shows published options only, with one h1', page.locator('#cert-list [data-cert]').count() == len(pub_c) and layout(page)['h1'] == 1)
    go(page, '/academy/excellence/lab')
    lab_pub = PUBLISHED(LAB['LAB-EFQM'])
    record('learner: the Lab opens only once its definition is approved (otherwise an honest "under review" state, one h1)',
           (page.locator('details.lab-crit').count() == 7) if lab_pub else (page.locator('details.lab-crit').count() == 0 and 'under review' in page.inner_text('main') and layout(page)['h1'] == 1))
    draft = next((c for c in XC if not PUBLISHED(c)), None)
    if draft:
        go(page, f"/academy/courses/{draft['slug']}")
        record('learner: a Phase 10 draft course is not reachable by direct link (honest "not available" page)', page.locator('[data-unavailable]').count() == 1, draft['id'])
    nav_ok = page.evaluate('() => [...document.querySelectorAll("a")].some(a => a.getAttribute("href") === "#/academy/excellence")')
    record('navigation: the Excellence Academy entry is a live link', nav_ok)
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
                if r == '/academy/excellence/lab': page.click('#lab-C1 > summary'); page.wait_for_timeout(150)
                v = axe(page)
                if v: ax.append(f'{scheme} {lang} {r}: {v}')
            ctx.close()
    record(f'axe-core WCAG 2.1 A/AA + best practice: 0 violations on {len(ROUTES)} Phase 10 routes incl. an open Lab criterion (AR@390, EN@1280, light + dark)', not ax, ' | '.join(ax[:3]))
    b.close()
finally:
    srv.terminate()

# hub and toolkit files unchanged apart from the two recorded patches
base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = [f for h, f in (l.split(maxsplit=1) for l in base.read_text().splitlines()) if hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest() != h]
    record('integrity: hub and toolkit files byte-identical to the baseline apart from the D-08 and D-22 patches (index.html, sw.js)', set(changed) <= {'index.html', 'sw.js'}, changed)

(EVID / 'e2e-phase10-results.json').write_text(json.dumps({'suite': 'phase10', 'date': time.strftime('%Y-%m-%d'), 'results': results}, ensure_ascii=False, indent=1), encoding='utf-8')
print(f"{sum(r['ok'] for r in results)}/{len(results)} passed")
sys.exit(0 if all(r['ok'] for r in results) else 1)
