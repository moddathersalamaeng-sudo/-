#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 11 suite (Practice Labs, smart templates, certificate of completion). Playwright + axe-core.

Every published lab end to end (invalid submit → error summary, answers kept after reload, save, feedback with model answer,
evidence, retry, attempt persisted after reload); the Audit Simulator answered entirely through the controls (radios, checkboxes,
selects, ordering buttons, text); one document per smart-template type generated, edited, saved as versions, exported (CSV,
Excel .xls, Word .doc, JSON), printed and restored from history; labs reachable from every academy's Tools & labs in ≤ 2 clicks;
course / lesson links; My space shows attempts and documents; bookmarks; search; certificate of completion; drafts hidden from
learners; responsive 390 / 768 / 1280 / 1920; axe light + dark; console; storage keys; hub / toolkit integrity.
Usage: python3 tests/e2e/run_e2e_phase11.py [--evidence DIR]
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request, hashlib
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
AXE = (ACADEMY / 'tests' / 'vendor' / 'axe.min.js').read_text(encoding='utf-8')
SEED = lambda f: json.loads((ACADEMY / 'data' / 'seed' / f).read_text(encoding='utf-8'))['items']
LABS = SEED('labs.json'); TPLS = SEED('smart-templates.json'); COURSES = SEED('courses.json')
PUB = lambda r: r['governance']['content_status'] == 'published'
PUB_LABS = [l for l in LABS if PUB(l)]
DRAFT = next(l for l in LABS if l.get('draft'))


def perfect(l):
    out = {}
    for t in l['tasks']:
        ty = t['type']
        out[t['id']] = (t['correct'] if ty == 'single_choice' else [o['id'] for o in t['options'] if o['correct']] if ty == 'multi_select'
                        else [x['id'] for x in t['items']] if ty == 'ordering' else {x['id']: x['category'] for x in t['items']} if ty == 'classify'
                        else str(t['answer']) if ty == 'numeric' else 'Model-style answer: requirement, traceable evidence with extent, and the gap, written neutrally. ' * 2)
    return out


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
    page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=20000)
    page.wait_for_timeout(250)

def go(page, route, lang='en', extra='&dev=0', reload=False):
    page.goto(f'{BASE}/academy/?lang={lang}{extra}#{route}')
    if reload: page.reload()
    settle(page)

def axe(page):
    page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")

def store(page, key):
    raw = page.evaluate(f'localStorage.getItem("cia:v1:local:{key}")')
    return (json.loads(raw) if raw else {'items': []})['items']

def put(page, key, items):
    page.evaluate('([k, v]) => localStorage.setItem(k, JSON.stringify({ schema: 1, updatedAt: new Date().toISOString(), items: v }))', [f'cia:v1:local:{key}', items])

try:
  with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True); page = ctx.new_page(); logs = watch(page)

    # ---------- 1. Labs reachable from each academy's Tools & labs (≤ 2 clicks) ----------
    reach = []
    for key in ['iso', 'pmi', 'quality']:
        go(page, f'/academy/{key}')
        panel = page.locator(f'[data-labs-panel={key}]')
        ok = panel.count() == 1 and page.locator(f'[data-tpl=tools] [data-labs-panel={key}]').count() == 1
        first = panel.locator('a[data-action=open-lab]').first
        if ok and first.count():
            first.click(); settle(page); ok = page.evaluate('location.hash').startswith('#/labs/') and page.locator('.lab-task').count() >= 3
        reach.append((key, ok))
    go(page, '/academy/excellence'); page.click('[data-action=open-lab]'); settle(page)
    reach.append(('excellence', page.evaluate('location.hash') == '#/academy/excellence/lab'))
    record('each academy\'s "Tools & labs" opens a practice lab in one click (ISO, PMI & PMO, Quality: Phase 11 labs; Excellence: the EFQM Assessment Lab)', all(ok for _, ok in reach), reach)

    # ---------- 2. Labs index, drafts hidden from learners, breadcrumbs ----------
    go(page, '/labs')
    shown = page.locator('.lab-card').count()
    efqm = page.locator('[data-lab=LAB-EFQM]').count()
    go(page, f'/labs/{DRAFT["slug"]}'); draft_hidden = page.locator('[data-unavailable=true]').count() == 1
    go(page, '/labs/audit-simulator')
    crumbs = page.locator('nav.crumbs li').all_inner_texts()
    record(f'#/labs lists the {len(PUB_LABS)} published labs + the EFQM Lab link; a draft lab is not available to learners; breadcrumb Home › academy › labs › lab',
           shown == len(PUB_LABS) and efqm == 1 and draft_hidden and len(crumbs) == 4 and 'ISO' in crumbs[1] and page.locator('h1').count() == 1, f'{shown} {efqm} {draft_hidden} {crumbs}')

    # ---------- 3. Audit Simulator through the real controls ----------
    lab = next(l for l in LABS if l['id'] == 'LAB-AUDIT-SIM'); key = perfect(lab)
    go(page, '/labs/audit-simulator')
    page.click('[data-action=submit-lab]'); page.wait_for_timeout(200)
    errs = int(page.get_attribute('.errsum', 'data-errors') or 0); focus_sum = page.evaluate('document.activeElement.classList.contains("errsum")')
    invalid = page.locator('.lab-task[aria-invalid=true]').count()
    for t in lab['tasks']:
        tid, ty = t['id'], t['type']
        if ty == 'single_choice': page.check(f'#lt-{tid}-{key[tid]}')
        elif ty == 'multi_select':
            for oid in key[tid]: page.check(f'#lt-{tid}-{oid}')
        elif ty == 'classify':
            for iid, cat in key[tid].items(): page.select_option(f'#lt-{tid}-{iid}', cat)
        elif ty == 'numeric': page.fill(f'#lt-{tid}-value', key[tid])
        elif ty == 'free_text': page.fill(f'#lt-{tid}-text', key[tid]); page.check(f'#lt-{tid}-R1')
        elif ty == 'ordering':
            want = key[tid]
            for target_i, item in enumerate(want):
                for _ in range(10):
                    cur = page.evaluate(f'[...document.querySelectorAll("[data-task={tid}] .lab-order li")].map(li => li.dataset.item)')
                    i = cur.index(item)
                    if i == target_i: break
                    page.click(f'[data-task={tid}] li[data-item={item}] [data-move=up]')
    page.wait_for_timeout(500)
    page.reload(); settle(page)
    restored = page.get_attribute('.lab-status', 'data-saved') == 'restored' and page.is_checked(f'#lt-T4-{key["T4"]}') and page.input_value('#lt-T9-text').startswith('Model-style')
    order_kept = page.evaluate('[...document.querySelectorAll("[data-task=T8] .lab-order li")].map(li => li.dataset.item)') == key['T8']
    page.click('[data-action=submit-lab]'); settle(page); page.wait_for_selector('.lab-result')
    res = page.locator('.lab-result')
    score, status = res.get_attribute('data-score'), res.get_attribute('data-status')
    fb = page.locator('.lab-fb').count(); pending = page.locator('.lab-fb[data-verdict=pending]').count(); correct = page.locator('.lab-fb[data-verdict=correct]').count()
    model = page.locator('.fb-model').count(); ev = page.locator('[data-comp=AUD-02]').count() == 1 and page.locator('[data-excluded=ISO-01]').count() == 1
    att = store(page, 'lab_attempts'); drafts = store(page, 'lab_drafts')
    record('Audit Simulator answered with every control type: empty submit lists all 9 tasks (focus on the summary, fields marked); answers and step order survive a reload; feedback for every task with the model answer; written task pending; evidence for AUD-02, ISO-01 excluded (one scored task)',
           errs == 9 and focus_sum and invalid == 9 and restored and order_kept and score == '100' and status == 'awaiting_review' and fb == 9 and pending == 1 and correct == 8 and model == 9 and ev
           and len(att) == 1 and att[0]['attempt_no'] == 1 and not drafts, f'{errs} {focus_sum} {invalid} {restored} {order_kept} {score} {status} {fb} {pending} {correct} {model} {ev} {len(att)} {drafts}')
    with page.expect_download() as dl: page.click('[data-action=export-attempt]')
    exp = json.loads(pathlib.Path(dl.value.path()).read_text(encoding='utf-8'))
    page.click('[data-action=retry-lab]'); page.wait_for_timeout(200)
    fresh = page.locator('.lab-task').count() == 9 and 'Attempt 2' in page.inner_text('#lab-tasks-h') and page.locator('.lab-history [data-history]').count() + page.locator('[data-history="1"]').count() >= 1
    page.check('#lt-T4-a'); page.wait_for_timeout(500)
    page.reload(); settle(page)
    record('export for review (JSON with label and the written task), retry opens attempt 2 with the history, and after a reload attempt 1 is still saved', exp['schema'] == 'cia.lab-attempt-export.v1' and 'not a certification' in exp['label']
           and len(exp['for_reviewer']) == 1 and fresh and len(store(page, 'lab_attempts')) == 1 and page.is_checked('#lt-T4-a'), f'{exp.get("schema")} {fresh}')

    # ---------- 4. Every other published lab end to end (answers seeded as a draft, then submitted through the page) ----------
    e2e = []
    for l in [x for x in PUB_LABS if x['id'] != 'LAB-AUDIT-SIM']:
        go(page, f'/labs/{l["slug"]}')
        page.click('[data-action=submit-lab]'); page.wait_for_timeout(150)
        bad = int(page.get_attribute('.errsum', 'data-errors') or 0) == len(l['tasks'])
        num = next((t for t in l['tasks'] if t['type'] == 'numeric'), None)
        if num:
            page.fill(f'#lt-{num["id"]}-value', 'abc'); page.click('[data-action=submit-lab]'); page.wait_for_timeout(150)
            bad = bad and 'number' in page.inner_text(f'#lt-{num["id"]}-err').lower()
        put(page, 'lab_drafts', [{'id': l['id'], 'answers': perfect(l), 'self_check': {}, 'updated_at': '2026-11-12T08:00:00Z'}])
        page.reload(); settle(page)
        page.click('[data-action=submit-lab]'); page.wait_for_selector('.lab-result'); settle(page)
        r = page.locator('.lab-result')
        okfb = r.get_attribute('data-score') == '100' and page.locator('.lab-fb').count() == len(l['tasks']) and page.locator('.lab-fb[data-verdict=pending]').count() == 1
        page.reload(); settle(page)
        persisted = page.locator(f'.lab-result[data-attempt="1"]').count() == 1
        e2e.append((l['id'], bad, okfb, persisted))
    record(f'each of the other {len(PUB_LABS) - 1} published labs: empty submit blocked, invalid number rejected, feedback at 100 % with one written task pending, attempt shown again after reload',
           all(a and b_ and c for _, a, b_, c in e2e), e2e)

    # ---------- 5. My space, bookmarks, search ----------
    go(page, '/labs/fmea'); page.click('.lab-hero [data-action=bookmark]'); page.wait_for_timeout(300)
    go(page, '/my')
    my_labs = int(page.get_attribute('[data-lab-attempts]', 'data-lab-attempts') or 0)
    bm = page.locator('[data-bookmark="lab:LAB-FMEA"]').count()
    go(page, '/search?q=FMEA&type=lab'); page.wait_for_timeout(500)
    hit = page.locator('[data-result=lab]').first.get_attribute('data-id') if page.locator('[data-result=lab]').count() else None
    go(page, '/search?q=' + 'سجل المخاطر', 'ar'); page.wait_for_timeout(500)
    tpl_hit = page.locator('[data-result=template] a[href="#/templates/risk-register"]').count()
    record('My space → Progress lists every lab attempted; a lab bookmark appears in Saved; search finds the FMEA lab and (in Arabic) the Risk Register template',
           my_labs == len(PUB_LABS) and bm == 1 and hit == 'LAB-FMEA' and tpl_hit == 1, f'{my_labs} {bm} {hit} {tpl_hit}')

    # ---------- 6. Course and lesson integration ----------
    go(page, '/academy/courses/' + next(c for c in COURSES if c['id'] == 'CRS-ISO-AUD')['slug'])
    course_link = page.locator('[data-action=practice-lab][data-lab=LAB-AUDIT-SIM]').count()
    go(page, '/academy/courses/' + next(c for c in COURSES if c['id'] == 'CRS-ISO-AUD')['slug'] + '/L05')
    lesson_link = page.locator('[data-action=practice-lab]').count()
    if lesson_link: page.click('[data-action=practice-lab] >> nth=0'); settle(page)
    record('a course\'s practical task and a lesson link to the lab that practises them', course_link == 1 and lesson_link >= 1 and page.evaluate('location.hash').startswith('#/labs/'), f'{course_link} {lesson_link}')

    # ---------- 7. Smart templates: one document per type ----------
    go(page, '/library?tab=templates'); lib_tpls = int(page.get_attribute('[data-smart-templates]', 'data-smart-templates') or 0)
    tres = []
    for t in TPLS:
        go(page, f'/templates/{t["slug"]}')
        page.click('[data-action=new-doc]'); page.wait_for_selector('.tpl-editor')
        page.click('[data-action=save-version]'); page.wait_for_timeout(150)
        blocked = int(page.get_attribute('.tpl-editor .errsum', 'data-errors') or 0) > 0
        page.fill('#tpl-title', f'{t["slug"]} test')
        for q in t['questions']:
            sel = f'#tq-{q["id"]}'
            if q['type'] == 'select': page.select_option(sel, q['options'][0]['value'])
            elif q['type'] == 'date': page.fill(sel, '2026-11-12')
            elif q['type'] == 'number': page.fill(sel, '3')
            else: page.fill(sel, f'{q["id"]} — "quoted", <tag> & =formula')
        for c in [c for c in t['table']['columns'] if c['type'] != 'computed']:
            sel = f'#tr-0-{c["id"]}'
            if c['type'] == 'select': page.select_option(sel, c['options'][-1]['value'])
            elif c['type'] == 'date': page.fill(sel, '2026-12-01')
            else: page.fill(sel, f'{c["id"]} cell')
        if t['slug'] == 'risk-register':
            page.select_option('#tr-0-l', '4'); page.select_option('#tr-0-c', '4')
        page.click('[data-action=add-row]'); page.click('[data-action=save-version]'); page.wait_for_timeout(300)
        v1 = page.locator('[data-version="1"]').count() == 1
        files = {}
        for kind in ['csv', 'xls', 'doc', 'json']:
            with page.expect_download() as dl: page.click(f'[data-action=export-{kind}]')
            files[kind] = pathlib.Path(dl.value.path()).read_bytes()
        esc = files['csv'].startswith(b'\xef\xbb\xbf') and b'""quoted""' in files['csv'] and b'<tag>' not in files['xls'] and b'&lt;tag&gt;' in files['xls'] and b'<tag>' not in files['doc'] \
            and json.loads(files['json'])['schema'] == 'cia.smart-doc-export.v1'
        computed = t['slug'] != 'risk-register' or '16' in page.inner_text('[data-computed="0"]')
        first_q = t['questions'][0]
        if first_q['type'] in ('text', 'textarea'): page.fill(f'#tq-{first_q["id"]}', 'edited value')
        page.fill('#tpl-note', 'second'); page.click('[data-action=save-version]'); page.wait_for_timeout(300)
        v2 = page.locator('[data-version="2"]').count() == 1
        page.click('[data-version="1"] [data-action=restore-version]'); page.wait_for_timeout(400)
        restored = page.locator('[data-version="3"]').count() == 1 and (first_q['type'] not in ('text', 'textarea') or page.input_value(f'#tq-{first_q["id"]}') != 'edited value')
        page.click('[data-action=export-print]'); settle(page)
        printed = page.locator('.tpl-print .doc-assembled').count() == 1 and page.locator('h1').count() == 1
        page.reload(); settle(page)
        persisted = page.locator('.tpl-print .doc-assembled').count() == 1
        tres.append((t['slug'], blocked, v1, esc, computed, v2, restored, printed, persisted))
    docs = store(page, 'smart_documents')
    record('Library → Templates lists the 6 smart templates; each type: empty save blocked, Q&A + register → version 1, CSV / Excel / Word / JSON downloaded with escaping, computed score, edit → v2, restore v1 → v3, print view, persisted after reload',
           lib_tpls == 6 and all(all(x[1:]) for x in tres) and len(docs) == 6 and all(d['version'] == 3 for d in docs), f'{lib_tpls} {tres} {[d["version"] for d in docs]}')
    go(page, '/my'); my_docs = int(page.get_attribute('[data-my-docs]', 'data-my-docs') or 0)
    record('My space lists the six generated documents', my_docs == 6, my_docs)

    # ---------- 8. Certificate of completion ----------
    c = next(x for x in COURSES if x['id'] == 'CRS-ISO-AUD')
    put(page, 'course_progress', [{'id': c['id'], 'completed_lessons': [l['id'] for m in c['modules'] for l in m['lessons']], 'exercise_notes': {}, 'updated_at': '2026-11-12T08:00:00Z'}])
    put(page, 'assessment_attempts', [{'id': 'a1', 'assessment_id': c['assessments']['final'], 'attempt_no': 1, 'submitted_at': '2026-11-12T08:00:00Z', 'answers': {}, 'score': 90, 'passed': True, 'pending_review': 0, 'unknown': 0, 'competency_breakdown': {}, 'domain_breakdown': {}, 'detail': []}])
    go(page, f'/academy/courses/{c["slug"]}', reload=True); cert_link = page.locator('[data-action=open-certificate]').count()
    page.click('[data-action=open-certificate]'); settle(page)
    eligible = page.locator('[data-cert=eligible]').count() == 1
    page.fill('#cert-name', '<b>x'); page.click('[data-action=make-certificate]'); page.wait_for_timeout(150)
    name_err = page.get_attribute('#cert-name', 'aria-invalid') == 'true'
    page.fill('#cert-name', 'Test Learner'); page.click('[data-action=make-certificate]'); page.wait_for_timeout(300)
    sheet = page.locator('.cert-sheet').count() == 1 and 'not a professional certification' in page.inner_text('[data-cert-disclaimer]')
    num = page.get_attribute('.cert-sheet', 'data-cert-number') or ''
    page.reload(); settle(page); kept = (page.get_attribute('.cert-sheet', 'data-cert-number') or '') == num and page.input_value('#cert-name') == 'Test Learner'
    other = next(x for x in COURSES if x['id'] == 'CRS-Q-CAPA')
    go(page, f'/certificate/{other["slug"]}'); not_eligible = page.locator('[data-cert=not-eligible]').count() == 1
    record('certificate of completion: offered on a completed course, invalid name rejected, sheet with number and "not a professional certification", kept after reload; refused for an unfinished course',
           cert_link == 1 and eligible and name_err and sheet and num.startswith('CIA-C-') and kept and not_eligible, f'{cert_link} {eligible} {name_err} {sheet} {num} {kept} {not_eligible}')

    # ---------- 9. Arabic and storage ----------
    go(page, '/labs/capa', 'ar')
    rtl = page.evaluate('document.documentElement.dir') == 'rtl' and 'مختبر' in page.inner_text('main')
    keys = page.evaluate('Object.keys(localStorage)')
    record('Arabic lab page right-to-left; storage holds only cia:v1:* keys and the shared cia-lang', rtl and all(k.startswith('cia:v1:') or k == 'cia-lang' for k in keys), keys)
    record('no console errors or warnings during the Phase 11 journeys', not logs, logs[:5])
    ctx.close()

    # ---------- 10. Responsive matrix ----------
    mx = []
    routes = ['/labs', '/labs/audit-simulator', '/labs/project-risk', '/templates/risk-register', '/library?tab=templates', '/certificate/' + c['slug']]
    for w in [390, 768, 1280, 1920]:
        for lang in ['ar', 'en']:
            cx = b.new_context(viewport={'width': w, 'height': 900}); pg = cx.new_page(); lg = watch(pg)
            for r in routes:
                go(pg, r, lang)
                m = pg.evaluate('() => ({ h1: document.querySelectorAll("h1").length, over: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })')
                if m['h1'] != 1 or m['over']: mx.append(f'{lang}@{w}{r}: {m}')
                if w in (390, 1280) and lang == 'ar' and r in ('/labs/audit-simulator', '/templates/risk-register'): pg.screenshot(path=str(EVID / f'p11-{lang}-{w}{r.replace("/", "_")}.png'), full_page=True)
            if lg: mx.append(f'{lang}@{w} console {lg[:3]}')
            cx.close()
    record(f'responsive: {len(routes)} Phase 11 pages × 4 widths × AR/EN — one h1, no horizontal overflow, no console errors', not mx, mx[:5])

    # ---------- 11. Accessibility ----------
    ax = []
    for scheme in ['light', 'dark']:
        for w, lang in [(390, 'ar'), (1280, 'en')]:
            cx = b.new_context(viewport={'width': w, 'height': 900}, color_scheme=scheme); pg = cx.new_page()
            for r in routes + ['/academy/iso', '/my']:
                go(pg, r, lang); v = axe(pg)
                if v: ax.append(f'{scheme}/{w}/{lang}{r}: ' + json.dumps(v, ensure_ascii=False))
            go(pg, '/labs/risk-assessment', lang); pg.click('[data-action=submit-lab]'); pg.wait_for_timeout(200); v = axe(pg)
            if v: ax.append(f'{scheme}/{w}/{lang} lab errors: ' + json.dumps(v, ensure_ascii=False))
            l = next(x for x in LABS if x['id'] == 'LAB-RISK')
            put(pg, 'lab_drafts', [{'id': l['id'], 'answers': perfect(l), 'self_check': {}, 'updated_at': '2026-11-12T08:00:00Z'}]); pg.reload(); settle(pg)
            pg.click('[data-action=submit-lab]'); pg.wait_for_selector('.lab-result'); v = axe(pg)
            if v: ax.append(f'{scheme}/{w}/{lang} lab feedback: ' + json.dumps(v, ensure_ascii=False))
            go(pg, '/templates/ncr', lang); pg.click('[data-action=new-doc]'); pg.wait_for_selector('.tpl-editor'); pg.click('[data-action=save-version]'); pg.wait_for_timeout(200); v = axe(pg)
            if v: ax.append(f'{scheme}/{w}/{lang} template editor: ' + json.dumps(v, ensure_ascii=False))
            cx.close()
    record('axe-core WCAG 2.1 A/AA + best practice: 0 violations on labs, a lab with errors and with feedback, the template editor, Library templates, certificate (AR@390, EN@1280, light + dark)', not ax, ' | '.join(ax[:3]))
    b.close()
finally:
    srv.terminate()

# ---------- 12. Hub and toolkit integrity ----------
base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = [f for h, f in (l.split(maxsplit=1) for l in base.read_text().splitlines()) if (PLATFORM / f).exists() and hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest() != h]
    record('integrity: hub and toolkit files byte-identical to the baseline apart from the D-08 and D-22 patches (index.html, sw.js)', set(changed) <= {'index.html', 'sw.js'}, changed)

passed = sum(r['ok'] for r in results)
(EVID / 'e2e-phase11-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
