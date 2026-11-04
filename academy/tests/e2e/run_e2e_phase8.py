#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 8 suite (PMI / PMO / P3O Academy). Playwright + axe-core.

A. Reviewer journey (drafts visible with a preview banner): PMI landing, certification explorer (filters in the URL, comparison
   table, pending facts link to PMI), certification page (verified badges, claims banner, study plan, hours planner with invalid
   input), course page (glance, study panel, linked certifications, exam-prep label), lesson player (blocks, guide panel, check,
   complete toggle), practice guides (evidence ladder, how-to-read, P3M3 maturity questions, cross-guide links), evidence-based
   starting point (profile → PM readiness → PMO route), route skipping, recommendation suppression.
B. Learner: Phase 8 drafts stay hidden until approved (no dead links, honest empty states, one h1), published guides are open.
C. Responsive matrix (AR/EN × 390/768/1280), console, axe (light + dark), storage keys.
Usage: python3 tests/e2e/run_e2e_phase8.py [--evidence DIR]   Results: <evidence>/e2e-phase8-results.json (only executed checks).
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
CERTS = SEED('certifications.json')
PUBLISHED = lambda r: r['governance']['content_status'] == 'published'
ROUTES = ['/academy/pmi', '/academy/pmi/certifications', '/academy/pmi/certifications/pmp', '/academy/courses/pmp-study-strategy',
          '/academy/courses/scope-schedule-cost/L04', '/guides/iso-21500/pj.bc', '/guides/p3m3/ben', '/guides/pmo-excellence']

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

def store(page, collection):
    return page.evaluate('c => { const k = Object.keys(localStorage).find(k => k.startsWith("cia:v1:") && k.endsWith(":" + c)); return k ? JSON.parse(localStorage.getItem(k)).items : []; }', collection)

def axe(page):
    page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")

def layout(page):
    return page.evaluate('() => ({ h1: document.querySelectorAll("h1").length, over: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, dir: document.documentElement.dir, lang: document.documentElement.lang })')

try:
  with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- A. Reviewer journey ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    as_role(page, 'reviewer')
    go(page, '/academy/pmi')
    stats = page.locator('.pmi-hero .stat').count()
    drafts = any(not PUBLISHED(c) for c in COURSES.values() if c.get('ecosystem') in ('pmi', 'pmo', 'p3o')) or any(not PUBLISHED(c) for c in CERTS)
    record('PMI landing: hero with four live counts, a preview banner only while drafts remain, starting point "explore" without a profile',
           stats == 4 and page.locator('[data-preview]').count() == (1 if drafts else 0) and page.get_attribute('[data-start]', 'data-start') == 'explore', f'{stats} drafts={drafts}')
    n_routes = page.locator('[data-route^="ROUTE-"]').count(); n_certs = page.locator('#pm-certs ~ * [data-cert], section[aria-labelledby=pm-certs] [data-cert]').count()
    n_courses = page.locator('section[aria-labelledby=pm-courses] [data-course]').count(); n_guides = page.locator('section[aria-labelledby=pm-guides] [data-guide]').count()
    tools = page.locator('section[aria-labelledby=pm-learnuse] [data-module]')
    record('PMI landing lists 5 routes, 8 certifications, 10 courses, 4 practice guides and the PMO toolkits with their access rule',
           n_routes == 5 and n_certs == 8 and n_courses == 10 and n_guides == 4 and tools.count() == 4 and all(tools.nth(i).get_attribute('data-access') == 'account' for i in range(tools.count())),
           f'{n_routes} {n_certs} {n_courses} {n_guides} {tools.count()}')

    # explorer
    go(page, '/academy/pmi/certifications')
    total = page.locator('#cert-list [data-cert]').count()
    page.select_option('#pf-stage', 'senior'); page.wait_for_timeout(200)
    senior = page.locator('#cert-list [data-cert]').count(); url = page.url
    rows = page.locator('section[aria-labelledby=cert-compare] tbody tr').count()
    pend = page.locator('section[aria-labelledby=cert-compare] a.pending')
    pend_ok = pend.count() > 0 and all((pend.nth(i).get_attribute('href') or '').startswith('https://www.pmi.org/') for i in range(pend.count()))
    record('explorer: 8 certifications, stage filter (senior → 2) kept in the URL, comparison table of 8 rows, unconfirmed facts link to PMI',
           total == 8 and senior == 2 and 'stage=senior' in url and rows == 8 and pend_ok, f'{total} {senior} {url} {rows} {pend.count()}')
    go(page, '/academy/pmi/certifications?stage=senior')
    record('explorer filter survives a reload', page.locator('#cert-list [data-cert]').count() == 2 and page.input_value('#pf-stage') == 'senior')

    # certification page
    go(page, '/academy/pmi/certifications/pmp')
    states = {page.locator('[data-fact]').nth(i).get_attribute('data-fact'): page.locator('[data-fact]').nth(i).get_attribute('data-state') for i in range(page.locator('[data-fact]').count())}
    claims = page.inner_text('[data-claims]')
    record('PMP page: verified eligibility, exam, fee and domains; renewal pending (sends to PMI); the claims banner says CIA is not a PMI partner and awards no PDUs',
           states == {'eligibility': 'verified', 'exam': 'verified', 'fee': 'verified', 'renewal': 'pending', 'domains': 'verified'} and 'not a PMI Authorized Training Partner' in claims and 'PDUs' in claims,
           f'{states}')
    plan_steps = page.locator('.plan > li').count(); bars = page.locator('.bars li').count()
    page.fill('#hp-total', '200'); page.wait_for_timeout(150)
    hrs = page.locator('.planner-out tbody tr td:last-child').all_inner_texts()
    page.fill('#hp-total', '5'); page.wait_for_timeout(150)
    invalid = page.get_attribute('#hp-total', 'aria-invalid') == 'true' and page.locator('#hp-err').is_visible()
    record('PMP page: 6-phase study plan, 3 weighted domain bars, hours planner recalculates (200 h → 33 practice, 55/68/43) and rejects invalid input accessibly',
           plan_steps == 6 and bars == 3 and hrs == ['55', '68', '43', '33'] and invalid, f'{plan_steps} {bars} {hrs} {invalid}')

    # course page
    go(page, '/academy/courses/pmp-study-strategy')
    glance = page.locator('.glance li').count(); study = page.locator('section[aria-labelledby=c-study] .howto-steps li').count()
    linked = page.locator('section[aria-labelledby=c-links] a[href="#/academy/pmi/certifications/pmp"]').count()
    label = page.inner_text('.phead .badges')
    record('course page: 8-fact glance strip, 6-step "how to study", weekly plan, link to the PMP certification page, exam-preparation label',
           glance == 8 and study == 6 and page.locator('.weekplan').count() == 1 and linked == 1 and 'xam' in label, f'{glance} {study} {linked} {label}')

    # lesson player
    go(page, '/academy/courses/scope-schedule-cost/L04')
    blocks = [page.locator('.lblock').nth(i).get_attribute('data-block') for i in range(page.locator('.lblock').count())]
    gpanel = page.locator('[data-guide-refs]').count()
    page.check('.kc input[type=radio] >> nth=0'); page.click('[data-action=check-answer]'); page.wait_for_timeout(150)
    fb = page.locator('.kc .feedback p').count()
    page.click('[data-action=toggle-complete]'); page.wait_for_timeout(300)
    done = 'CRS-PM-SSC-L04' in (next((x for x in store(page, 'course_progress') if x['id'] == 'CRS-PM-SSC'), {}).get('completed_lessons') or [])
    record('lesson player (Phase 8 lesson): five blocks in order, "from the guides" panel, knowledge check feedback, completion saved',
           blocks == ['concept', 'worked_example', 'scenario', 'common_mistake', 'evidence'] and gpanel == 1 and fb >= 1 and done, f'{blocks} {gpanel} {fb} {done}')

    # practice guides
    go(page, '/guides/iso-21500/pj.bc')
    rungs = page.locator('.ladder li').count(); acts = page.locator('[data-block=actions] li').count()
    page.click('details.howto > summary'); page.wait_for_timeout(100)
    howto = page.locator('details.howto[open] .howto-steps li').count()
    learn = page.locator('section[aria-labelledby=gi-learn] a').count()
    record('practice item: 3-rung evidence ladder, actions, owner/KPI, "how to read this page" opens with 6 steps, lessons that teach it',
           rungs == 3 and acts >= 2 and page.locator('.ownerkpi').count() == 1 and howto == 6 and learn >= 1, f'{rungs} {acts} {howto} {learn}')
    go(page, '/guides/p3m3/ben')
    mq = page.locator('.mq').count(); lv = page.locator('.mq >> nth=0').locator('.levels li').count()
    record('P3M3 perspective: four maturity questions with levels 2–5 and roadmap activities', mq == 4 and lv == 4 and page.locator('[data-block=roadmap] li').count() >= 1, f'{mq} {lv}')
    go(page, '/guides/pmo-excellence/gov.1')
    cross = page.locator('[data-block=cross] a')
    hrefs = [cross.nth(i).get_attribute('href') for i in range(cross.count())]
    if hrefs: page.click('[data-block=cross] a[href^="#/guides/iso-21500/"] >> nth=0'); page.wait_for_timeout(300)
    record('PMO Excellence practice links to the same practice in the other guides, and the link opens it',
           any(h.startswith('#/guides/iso-21500/') for h in hrefs) and any(h.startswith('#/guides/p3o/') for h in hrefs) and page.locator('article.guide-item[data-guide="iso-21500"]').count() == 1, hrefs)
    go(page, '/guides/p3o?tab=templates')
    page.click('.tplfields > summary >> nth=0'); page.wait_for_timeout(100)
    record('P3O templates show the worked example fields', page.locator('.tplfields[open] dl.facts dt').count() >= 3)
    go(page, '/guides')
    record('guides index groups the four practice guides in their own section', page.locator('section[aria-labelledby=gd-prac] [data-kind=practice]').count() == 4)

    # evidence-based starting point
    go(page, '/profile')
    page.fill('input[name=current_role]', 'PMO officer'); page.select_option('select[name=target_role]', 'ROLE-PMOA')
    page.click('[data-action=save-profile]'); page.wait_for_timeout(300)
    go(page, '/academy/pmi')
    sp0 = page.get_attribute('[data-start]', 'data-start'); href0 = page.get_attribute('[data-action=pm-start]', 'href')
    go(page, '/assessments/pm-readiness')
    unknown_ok = page.locator('[data-unknown]').count() == len(ASSESS['ASM-READY-PM-001']['question_ids'])
    for qid in ASSESS['ASM-READY-PM-001']['question_ids']:  # demonstrate the foundations; say "I don't know" on PMO design
        if QUESTIONS[qid]['competency'] == 'PMO-01': page.check(f'[data-unknown="{qid}"]')
        else: page.check(f'input[name="q-{qid}"][value="{QUESTIONS[qid]["correct_answer"]}"]')
    page.click('[data-action=submit-assessment]'); page.wait_for_timeout(500)
    go(page, '/academy/pmi')
    sp1 = page.get_attribute('[data-start]', 'data-start'); tgt = page.get_attribute('[data-start]', 'data-target')
    record('PMO analyst without evidence → "assess" (readiness check, with "I don\'t know" on every item); after demonstrating the foundations (PMO design answered "I don\'t know") → PMO design, not foundations',
           sp0 == 'assess' and href0 == '#/assessments/pm-readiness' and unknown_ok and sp1 == 'pmo' and tgt == 'CRS-PMO-DESIGN', f'{sp0} {href0} {unknown_ok} {sp1} {tgt}')
    go(page, '/learning-path?route=ROUTE-PMO')
    st = page.get_attribute('[data-step="CRS-PM-101"]', 'data-status') if page.locator('[data-step="CRS-PM-101"]').count() else None
    record('ROUTE-PMO skips Project Management Foundations once PM-01..03 are demonstrated', st == 'skipped', st)
    go(page, '/recommendations')
    rec_ids = page.evaluate('() => [...document.querySelectorAll("[data-rec]")].map(e => e.dataset.target)')
    record('recommendations no longer offer Project Management Foundations (suppressed by demonstrated evidence)', 'CRS-PM-101' not in rec_ids and len(rec_ids) > 0, rec_ids[:12])
    record('no console errors in the reviewer journey', not logs, logs[:5])
    keys = page.evaluate('Object.keys(localStorage)')
    record('storage: the Academy writes only cia:v1:* keys (plus the shared cia-lang)', all(k.startswith('cia:v1:') or k == 'cia-lang' for k in keys), keys)
    ctx.close()

    # ---------- B. Learner ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    go(page, '/academy/pmi')
    pub_courses = [c for c in COURSES.values() if c.get('ecosystem') in ('pmi', 'pmo', 'p3o') and PUBLISHED(c)]
    shown = page.locator('section[aria-labelledby=pm-courses] [data-course]').count()
    record(f'learner: the PMI landing shows only published courses ({len(pub_courses)}) and honest empty states otherwise; one h1, no preview banner',
           shown == len([c for c in pub_courses if not c.get('guide')]) and layout(page)['h1'] == 1 and page.locator('[data-preview]').count() == 0, f'{shown}')
    go(page, '/academy/pmi/certifications')
    pub_certs = [c for c in CERTS if PUBLISHED(c) and c.get('body', 'PMI') == 'PMI']
    record('learner: the explorer shows published certifications only, with one h1', page.locator('#cert-list [data-cert]').count() == len(pub_certs) and layout(page)['h1'] == 1)
    draft_course = next((c for c in COURSES.values() if c['id'].startswith('CRS-PM') and not PUBLISHED(c)), None)
    if draft_course:
        go(page, f'/academy/courses/{draft_course["slug"]}')
        record('learner: a Phase 8 draft course is not reachable by direct link (honest "not available" page)', page.locator('[data-unavailable]').count() == 1, draft_course['id'])
    go(page, '/guides/iso-21500')
    record('learner: the published ISO 21500 practice guide is open to everyone', page.locator('article.guide[data-kind=practice]').count() == 1 and page.locator('.gitems li').count() >= 50)
    go(page, '/')
    record('home: an "Academies" section links to the ISO Academy, the PMI / PMO Academy and the guides', page.locator('section[aria-labelledby=acad-h] a[href="#/academy/pmi"]').count() == 1)
    nav_ok = page.evaluate('() => [...document.querySelectorAll("a")].some(a => a.getAttribute("href") === "#/academy/pmi/certifications")')
    record('navigation: the Certification entry is a live link (no longer "Phase 8")', nav_ok)
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
    record(f'axe-core WCAG 2.1 A/AA + best practice: 0 violations on {len(ROUTES)} Phase 8 routes (AR@390, EN@1280, light + dark)', not ax, ' | '.join(ax[:3]))
    b.close()
finally:
    srv.terminate()

(EVID / 'e2e-phase8-results.json').write_text(json.dumps({'suite': 'phase8', 'date': time.strftime('%Y-%m-%d'), 'results': results}, ensure_ascii=False, indent=1), encoding='utf-8')
print(f"{sum(r['ok'] for r in results)}/{len(results)} passed")
sys.exit(0 if all(r['ok'] for r in results) else 1)
