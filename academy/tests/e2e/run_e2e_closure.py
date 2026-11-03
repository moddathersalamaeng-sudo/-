#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 7 closure suite (Playwright + axe-core).

Runs as a LEARNER (no reviewer role) against the published slice: profile → readiness → evidence-based starting point →
a published course's lessons (hand-authored and guide-based) → final assessment → course completed → route updated.
Also checks honesty labels (review basis on course pages), that future-phase drafts stay hidden, the service worker
(network-first for /academy/, stale-while-revalidate for the hub, offline fallback), layout and accessibility.
Usage: python3 tests/e2e/run_e2e_closure.py [--evidence DIR]
Results: <evidence>/e2e-closure-results.json (only executed checks are recorded).
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
READY = ASSESS['ASM-READY-ISO-001']
ROUTES = ['/academy/courses', '/academy/courses/read-iso-standards', '/academy/courses/read-iso-standards/L02', '/academy/courses/pdca-method/L01',
          '/assessments', '/assessments/read-iso-standards-final', '/profile/competencies', '/recommendations', '/learning-path?route=ROUTE-AWARE', '/academy/iso/9001']

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

def store(page, collection):
    return page.evaluate('c => { const k = Object.keys(localStorage).find(k => k.startsWith("cia:v1:") && k.endsWith(":" + c)); return k ? JSON.parse(localStorage.getItem(k)).items : []; }', collection)

def axe(page):
    page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")

def answer(page, qid):
    q = QUESTIONS[qid]; k = q['correct_answer']
    if q['type'] in ('single_choice',): page.check(f'input[name="q-{qid}"][value="{k}"]')
    elif q['type'] == 'true_false': page.check(f'input[name="q-{qid}"][value="{str(k).lower()}"]')
    else: raise ValueError(q['type'])

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- A. Learner journey on the published slice ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    go(page, '/')
    roles = page.evaluate('() => { try { return JSON.parse(localStorage.getItem("cia:v1:session") || "{}").roles || ["learner"]; } catch (e) { return ["learner"]; } }')
    go(page, '/academy/courses')
    n_courses = page.locator('#course-list [data-course]').count()
    hidden = all(page.locator(f'#course-list [data-course="{cid}"]').count() == 0 for cid in ('CRS-PM-101', 'CRS-EFQM-101', 'CRS-P3O-101', 'CRS-QMS-201'))
    record(f'learner (roles {roles}) sees the {n_courses} published courses; the 4 future-phase drafts stay hidden', roles == ['learner'] and n_courses == 38 and hidden, f'{roles} {n_courses} {hidden}')

    go(page, '/academy/courses/read-iso-standards')
    facts = page.inner_text('section[aria-label] dl.facts') if page.locator('section[aria-label] dl.facts').count() else ''
    honest = 'not an independent expert review' in facts.lower() and 'مدثر سلامه' in facts
    no_preview = page.locator('[data-preview]').count() == 0 and page.locator('aside.gov').count() == 0
    record('course page tells every learner how it was approved (owner approval after AI pre-review, not an expert review); no reviewer-only panels', honest and no_preview, facts[-300:])

    # profile → readiness → starting point
    go(page, '/profile')
    page.fill('input[name=current_role]', 'Quality engineer'); page.select_option('select[name=target_role]', 'ROLE-IA')
    page.click('[data-action=save-profile]'); page.wait_for_timeout(300)
    go(page, '/academy/iso')
    sp0 = page.get_attribute('[data-start]', 'data-start'); href0 = page.get_attribute('[data-action=start-point]', 'href')
    record('learner with a profile and no evidence: starting point "assess" now links to the published readiness check', sp0 == 'assess' and href0 == '#/assessments/iso-readiness', f'{sp0} {href0}')
    go(page, '/assessments/iso-readiness')
    for qid in READY['question_ids']:
        q = QUESTIONS[qid]
        if q['competency'] in ('ISO-01', 'ISO-02') and q['type'] in ('single_choice', 'true_false'): answer(page, qid)
        elif q['type'] in ('single_choice', 'true_false', 'multiple_choice', 'matching'): page.check(f'[data-unknown="{qid}"]')
        else: page.fill(f'#q-{qid}', 'I would check the calibration record, the equipment ID and which lots were inspected with it.')
    page.click('[data-action=submit-assessment]'); page.wait_for_timeout(500)
    go(page, '/academy/iso')
    sp1 = page.get_attribute('[data-start]', 'data-start'); href1 = page.get_attribute('[data-action=start-point]', 'href')
    record('evidence moves the learner to the audit starting point, and its link opens a published course', sp1 == 'audit' and href1 == '#/academy/courses/auditing-fundamentals', f'{sp1} {href1}')
    go(page, href1.lstrip('#'))
    record('the recommended course opens for the learner (no "not published" page)', page.locator('[data-unavailable]').count() == 0 and page.locator('[data-course="CRS-ISO-AUD"]').count() == 1)

    # complete CRS-ISO-READ: four lessons + final assessment
    c = COURSES['CRS-ISO-READ']
    for l in [l for m in c['modules'] for l in m['lessons']]:
        go(page, f'/academy/courses/read-iso-standards/{l["id"].split("-")[-1]}')
        if page.get_attribute('[data-action=toggle-complete]', 'aria-pressed') != 'true':
            page.click('[data-action=toggle-complete]'); page.wait_for_timeout(250)
    go(page, '/academy/courses/read-iso-standards/L04')
    panel = page.locator('.gfrom details').count()
    final = ASSESS[c['assessments']['final']]
    go(page, f'/assessments/{final["slug"]}')
    for qid in final['question_ids']: answer(page, qid)
    page.click('[data-action=submit-assessment]'); page.wait_for_timeout(500)
    att = [a for a in store(page, 'assessment_attempts') if a['assessment_id'] == final['id']]
    go(page, '/academy/courses/read-iso-standards')
    state = page.locator('main .badges .badge').all_inner_texts()
    go(page, '/learning-path?route=ROUTE-AWARE')
    step = page.get_attribute('[data-step="CRS-ISO-READ"]', 'data-status')
    # The Phase 6 path engine marks a step with skip_if_completed as "skipped" once it is completed; both count as done.
    record('learner completes a course: 4 lessons marked, guide panel on the mapped lesson, final passed (100 %), course shows Completed, route step done',
           panel >= 1 and att and att[-1]['passed'] and att[-1]['score'] == 100 and state[:2] == ['CIA internal course', 'Completed'] and step in ('completed', 'skipped'), f'{panel} {att[-1]["score"] if att else None} {state} {step}')

    # guide-based course as learner
    go(page, '/academy/courses/pdca-method/L01')
    gblocks = page.eval_on_selector_all('main [data-block]', 'els => els.map(e => e.dataset.block)')
    kc = page.locator('.kc input[type=radio]').count()
    record('learner opens a guide-based lesson: the guide item renders with its check question (4 options + "I don\'t know")', {'reqMethod', 'how', 'gaps'} <= set(gblocks) and kc == 5, f'{gblocks} {kc}')

    # competencies now published
    go(page, '/profile/competencies')
    rows = page.locator('[data-self]').count() + page.locator('main table tbody tr').count()
    record('learner sees the published competency framework (gap view is no longer empty)', page.locator('main .state.empty').count() == 0 and rows > 0, rows)

    # future-phase draft stays unavailable even by direct link
    slug = COURSES['CRS-PM-101']['slug']
    go(page, f'/academy/courses/{slug}')
    record('a future-phase draft is not reachable by direct link (honest "not available" page)', page.locator('[data-unavailable]').count() == 1, slug)
    keys = page.evaluate('Object.keys(localStorage)')
    record('storage: the Academy writes only cia:v1:* keys (plus the shared cia-lang)', all(k.startswith('cia:v1:') or k == 'cia-lang' for k in keys), keys)
    record('no console errors in the learner journey', not logs, logs[:3])
    ctx.close()

    # ---------- B. Service worker (D-19) ----------
    hub_probe, aca_probe = PLATFORM / 'sw-probe.txt', ACADEMY / 'sw-probe.txt'
    try:
        hub_probe.write_text('v1'); aca_probe.write_text('v1')
        ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page()
        page.goto(BASE + '/'); page.wait_for_function('() => navigator.serviceWorker && navigator.serviceWorker.controller !== undefined', timeout=10000)
        page.evaluate('() => navigator.serviceWorker.ready'); page.reload(); page.wait_for_function('() => !!navigator.serviceWorker.controller', timeout=15000)
        version = page.evaluate('() => caches.keys()')
        get = lambda u: page.evaluate('u => fetch(u).then(r => r.text())', u)
        first = (get('./sw-probe.txt'), get('./academy/sw-probe.txt'))
        hub_probe.write_text('v2'); aca_probe.write_text('v2')
        second = (get('./sw-probe.txt'), get('./academy/sw-probe.txt'))
        ctx.set_offline(True)
        offline = get('./academy/sw-probe.txt')
        ctx.set_offline(False)
        record('service worker: hub files stay stale-while-revalidate; Academy files are network-first (new build on the first visit) and still served offline from cache',
               first == ('v1', 'v1') and second == ('v1', 'v2') and offline == 'v2' and any('1.0.1-2026-11-03-academy' in k for k in version), f'{version} {first} {second} {offline}')
        ctx.close()
    finally:
        hub_probe.unlink(missing_ok=True); aca_probe.unlink(missing_ok=True)

    # ---------- C. Responsive matrix (learner) ----------
    fails, n = [], 0
    for lang in ['ar', 'en']:
        for w in [360, 390, 768, 1440]:
            ctx = b.new_context(viewport={'width': w, 'height': 900}); page = ctx.new_page(); logs = watch(page)
            for r in ROUTES:
                go(page, r, lang); n += 1
                d = page.evaluate('[document.documentElement.lang, document.documentElement.dir, document.documentElement.scrollWidth - document.documentElement.clientWidth, document.querySelectorAll("main h1").length]')
                if d[0] != lang or d[1] != ('rtl' if lang == 'ar' else 'ltr') or d[2] > 0 or d[3] != 1: fails.append(f'{lang}@{w}{r}: {d}')
                if w in (390, 1440) and r in ('/academy/courses', '/academy/courses/read-iso-standards', '/academy/courses/pdca-method/L01'):
                    page.screenshot(path=str(EVID / f'cl-{lang}-{w}{r.replace("/", "_").replace("?", "_")}.png'), full_page=w == 390)
            if logs: fails.append(f'{lang}@{w} console: {logs[:2]}')
            ctx.close()
    record(f'responsive matrix (learner): {n} loads ({len(ROUTES)} routes × 4 widths × AR/EN) — lang/dir, one h1, no horizontal overflow, no console errors', not fails, '; '.join(fails[:5]))

    # ---------- D. Accessibility (learner) ----------
    ax = []
    for scheme in ['light', 'dark']:
        for lang in ['ar', 'en']:
            ctx = b.new_context(viewport={'width': 390 if lang == 'ar' else 1280, 'height': 900}, color_scheme=scheme); page = ctx.new_page()
            for r in ROUTES:
                go(page, r, lang)
                v = axe(page)
                if v: ax.append(f'{scheme}/{lang}{r}: ' + json.dumps(v, ensure_ascii=False))
            ctx.close()
    record(f'axe-core WCAG 2.1 A/AA + best practice: 0 violations on {len(ROUTES)} learner routes (AR@390, EN@1280, light + dark)', not ax, ' | '.join(ax[:3]))
    b.close()

srv.terminate()
passed = sum(r['ok'] for r in results)
(EVID / 'e2e-closure-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
