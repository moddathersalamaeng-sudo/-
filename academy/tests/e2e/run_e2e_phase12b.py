#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 12B suite (guided experience; lessons from the Sumud Navigator study). Playwright + axe-core.

Guided assessment: start screen with counters, stages grouped by competency (re-derived here from the questions shown), Next
blocked until answered or "I don't know", autosave + resume after reload, restart, review screen with Edit, submit → the
questions leave and the result is at the top (ring, counters, competency bars and bands checked against the saved attempt,
"how we calculated this", reading, a 30/60/90 plan whose links are published records covering the top priority, retake last),
draft removed; one-page view; the result-below-questions bug is gone. Guided labs (one task, rail, validation per task, draft
resume, scenario link, all-tasks view). Catalogue grouped by academy (four per group, show all, filters give a flat list, phone
fold). Course quick facts and numbered outcomes. Lesson key-idea flip cards (back = start of the block). Readiness band on home
and on the four academies with counts calculated here from the seed. Responsive 390/768/1280/1920 × AR/EN, axe light + dark,
print view, console, storage keys, measurements before → after.
Usage: python3 tests/e2e/run_e2e_phase12b.py [--evidence DIR]
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request, hashlib, re
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
AXE = (ACADEMY / 'tests' / 'vendor' / 'axe.min.js').read_text(encoding='utf-8')
SEED = lambda f: json.loads((ACADEMY / 'data' / 'seed' / f).read_text(encoding='utf-8'))['items']
ASSESS = {a['id']: a for a in SEED('assessments.json')}
BY_SLUG = {a['slug']: a for a in ASSESS.values()}
QUESTIONS = {q['id']: q for q in SEED('questions.json')}
COURSES = SEED('courses.json'); COURSE_BY = {c['id']: c for c in COURSES}
LABS = SEED('labs.json'); LAB_BY_SLUG = {l['slug']: l for l in LABS}
pub = lambda r: (r.get('governance') or {}).get('content_status') == 'published' and not r.get('draft')
PUB_COURSES = [c for c in COURSES if pub(c)]
READY = BY_SLUG['iso-readiness']

CAT = {'iso': 'iso', 'quality': 'quality', 'efqm': 'excellence', 'project_management': 'pmi', 'pmo': 'pmi', 'p3o': 'pmi'}
def academy_of_course(c):
    return CAT.get(c.get('category')) or ('excellence' if c.get('ecosystem') == 'efqm' else 'pmi' if c.get('ecosystem') in ('pmi', 'pmo', 'p3o') else 'quality' if c.get('ecosystem') == 'quality' else 'iso')
def academy_of_assessment(a):
    c = COURSE_BY.get(a.get('course_id'))
    if c: return academy_of_course(c)
    i = a['id']
    if re.match(r'^ASM-(READY-)?ISO', i): return 'iso'
    if re.match(r'^ASM-(READY-)?PM', i): return 'pmi'
    if re.match(r'^ASM-(READY-)?Q-|^ASM-CMQOE|^ASM-READY-Q', i): return 'quality'
    if re.match(r'^ASM-(READY-)?EX', i): return 'excellence'
    return 'general'
def band_counts(key=None):
    checks = [a for a in ASSESS.values() if pub(a) and a['kind'] in ('diagnostic', 'readiness') and (key is None or academy_of_assessment(a) == key)]
    comps = {m['competency'] for c in PUB_COURSES if key is None or academy_of_course(c) == key for m in c.get('competency_mappings', [])}
    return [len(checks), sum(len(a['question_ids']) for a in checks), len(comps)]
def expected_stages(qids, cap=4):
    order, groups = [], {}
    for q in qids:
        k = QUESTIONS[q].get('competency') or None
        if k not in groups: groups[k] = []; order.append(k)
        groups[k].append(q)
    if len([k for k in order if k]) < 2: return [[q] for q in qids]
    out = []
    for k in order:
        xs = groups[k]; out += [xs[i:i + cap] for i in range(0, len(xs), cap)]
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
    results.append({'test': name, 'ok': bool(ok), 'detail': str(detail)[:900]})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''))
def watch(page, logs):
    page.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') and (m.location or {}).get('url', BASE).startswith(BASE) else None)
    page.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
def settle(page):
    page.wait_for_selector('html[data-ready]')
    page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=20000)
    page.wait_for_timeout(250)
def go(page, route, lang='en', extra='&dev=0', reload=False):
    page.goto(f'{BASE}/academy/?lang={lang}{extra}#{route}')
    if reload: page.reload()
    settle(page)
def axe(page):
    # Phase 14: Academy pages carry a Content-Security-Policy (script-src 'self'), so axe is loaded from the site's own origin there;
    # other pages (hub, review build) still get it inline. The assertions are unchanged.
    page.add_script_tag(url=BASE + '/academy/tests/vendor/axe.min.js') if page.url.startswith(BASE + '/academy/') else page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { preload: false, runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")
def store(page, key):
    raw = page.evaluate(f'localStorage.getItem("cia:v1:local:{key}")')
    return (json.loads(raw) if raw else {'items': []})['items']
def visible_qids(page):
    return page.eval_on_selector_all('.asm-form .qcard', 'els => els.filter(e => !e.hidden).map(e => e.dataset.question)')
def answer_card(page, qid, unknown=False):
    c = page.locator(f'#qc-{qid}')
    if unknown and c.locator('input[data-unknown]').count(): c.locator('input[data-unknown]').check(); return
    q = QUESTIONS[qid]
    if c.locator('.opts input[type=radio]').count():
        ca = q.get('correct_answer'); r = c.locator(f'input[type=radio][value="{ca}"]')
        (r if r.count() else c.locator('.opts input[type=radio]').first).check()
    elif c.locator('.opts input[type=checkbox]').count():
        ca = q.get('correct_answer') if isinstance(q.get('correct_answer'), list) else []
        done = False
        for v in ca:
            el = c.locator(f'.opts input[type=checkbox][value="{v}"]')
            if el.count(): el.check(); done = True
        if not done: c.locator('.opts input[type=checkbox]').first.check()
    elif c.locator('select').count():
        for i in range(c.locator('select').count()): c.locator('select').nth(i).select_option(index=1)
    elif c.locator('textarea').count():
        c.locator('textarea').fill('A written answer for the reviewer, long enough to be accepted by the form.')

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        logs = []
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}); page = ctx.new_page(); watch(page, logs)

        # ---------- 1. Start screen ----------
        go(page, '/assessments/iso-readiness')
        nq = len(READY['question_ids'])
        vals = page.eval_on_selector_all('.gx-intro .gx-cval', 'els => els.map(e => e.textContent.trim())')
        before_start_hidden = page.locator('.asm-form').is_hidden() and page.locator('.qcard:visible').count() == 0
        honest = page.locator('.gx-intro .gx-honest').count() == 1
        record('start screen: counters (questions, minutes, pass mark, stages), three "how it works" lines, the honesty line; no question shown before Start',
               vals[:3] == [str(nq), str(READY.get('estimated_minutes', '—')), f'{READY["scoring"]["passing_score"]}%'] and page.locator('.gx-how li').count() == 3 and honest and before_start_hidden, [vals, before_start_hidden])

        # ---------- 2. Stages ----------
        page.click('[data-action=asm-start]'); page.wait_for_timeout(200)
        order = page.eval_on_selector_all('.asm-form .qcard', 'els => els.map(e => e.dataset.question)')
        exp = expected_stages(order)
        rail_n = page.locator('.gx-rail .gx-step').count() - 1  # minus the review step
        first_visible = visible_qids(page)
        cur = page.locator('.gx-step [aria-current=step]').count()
        h_stage = page.evaluate('document.documentElement.scrollHeight')
        record(f'stages grouped by competency (≤ 4 per stage) = {len(exp)} re-derived here from the questions shown; stage 1 shows only its own questions; aria-current marks it; page ≤ 1,400 px',
               rail_n == len(exp) and first_visible == exp[0] and cur == 1 and h_stage <= 1400, [rail_n, len(exp), first_visible, exp[0], h_stage])

        # ---------- 3. Next is blocked until answered; "I don't know" counts as an answer ----------
        page.click('[data-action=asm-next]'); page.wait_for_timeout(150)
        blocked = page.locator('.qcard.invalid').count() >= 1 and visible_qids(page) == exp[0]
        focus_in = page.evaluate('!!document.activeElement.closest(".qcard")')
        for q in exp[0]: answer_card(page, q, unknown=True)
        page.click('[data-action=asm-next]'); page.wait_for_timeout(150)
        moved = visible_qids(page) == exp[1]
        record('Next is refused on an unanswered stage (marked, focus in the question) and accepted after "I don\'t know"', blocked and focus_in and moved, [blocked, focus_in, moved])

        # ---------- 4. Autosave and resume ----------
        for q in exp[1]: answer_card(page, q)
        page.wait_for_timeout(700)
        drafts = store(page, 'assessment_drafts')
        saved_n = len(drafts[0]['answers']) if drafts else 0
        answered_now = len(exp[0]) + len(exp[1])
        go(page, '/assessments/iso-readiness', reload=True)
        resume = page.locator('[data-action=asm-resume]')
        resume_txt = resume.inner_text() if resume.count() else ''
        resume.click(); page.wait_for_timeout(200)
        restored_ok = all(page.locator(f'#qc-{q} input[data-unknown]').is_checked() for q in exp[0] if page.locator(f'#qc-{q} input[data-unknown]').count())
        record(f'autosave: {answered_now} answers saved on the device (cia:v1:local:assessment_drafts) and offered back after a reload ("{answered_now} of {nq}"); answers restored into the controls',
               saved_n == answered_now and f'{answered_now} of {nq}' in resume_txt and restored_ok, [saved_n, resume_txt, restored_ok])

        # ---------- 5. Restart clears the draft ----------
        go(page, '/assessments/iso-readiness', reload=True)
        page.click('[data-action=asm-restart]'); page.wait_for_timeout(500)
        cleared = not store(page, 'assessment_drafts') and visible_qids(page) == exp[0] and all(not page.locator(f'#qc-{q} input[data-unknown]').is_checked() for q in exp[0] if page.locator(f'#qc-{q} input[data-unknown]').count())
        record('"Start again" deletes the draft and clears every control', cleared)

        # ---------- 6. Answer everything; review screen with Edit ----------
        for i, st in enumerate(exp):
            for q in st: answer_card(page, q, unknown=(i == len(exp) - 1 and QUESTIONS[q]['type'] in ('single_choice', 'true_false')))
            page.click('[data-action=asm-next]'); page.wait_for_timeout(120)
        rv = page.locator('.gx-reviewlist li').count(); open_rv = page.locator('.gx-reviewlist li.is-open').count()
        page.locator('.gx-reviewlist [data-action=asm-edit]').nth(0).click(); page.wait_for_timeout(150)
        edit_ok = visible_qids(page) == exp[0]
        page.locator('.gx-rail .gx-step').last.locator('button').click(); page.wait_for_timeout(150)
        back_in_review = page.locator('.gx-review:visible').count() == 1 and page.locator('[data-action=submit-assessment]:visible').count() == 1
        record(f'review screen lists all {nq} questions with their state (0 open), Edit returns to the stage, the rail returns to the review; Submit only there',
               rv == nq and open_rv == 0 and edit_ok and back_in_review, [rv, open_rv, edit_ok, back_in_review])

        # ---------- 7. Result at the top ----------
        page.click('[data-action=submit-assessment]'); page.wait_for_timeout(800)
        att = sorted([a for a in store(page, 'assessment_attempts') if a['assessment_id'] == READY['id']], key=lambda a: a['submitted_at'])[-1]
        form_gone = page.locator('.asm-form').is_hidden() and page.locator('.qcard:visible').count() == 0
        top = page.evaluate("document.querySelector('#asm-result').getBoundingClientRect().top")
        ring = page.get_attribute('.gx-ring', 'aria-label') or ''
        d = att['detail']
        exp_counts = [sum(1 for x in d if x['auto'] and x['correct']), sum(1 for x in d if x['auto'] and not x['correct'] and not x.get('unknown')), sum(1 for x in d if x.get('unknown')), sum(1 for x in d if not x['auto'] and not x.get('reviewed'))]
        got = [int(x) for x in page.eval_on_selector_all('.gx-reshead .gx-cval', 'els => els.map(e => e.textContent.trim())')]
        exp_shown = exp_counts[:3] + ([exp_counts[3]] if exp_counts[3] else [])
        record('after submitting the questions and the start screen leave; the result starts in the first screen (bug fixed); ring = saved score; counters = saved detail (correct · incorrect · "I don\'t know" · awaiting review)',
               form_gone and 0 <= top < 900 and f'{att["score"]}' in ring and got == exp_shown, [form_gone, top, ring, att['score'], got, exp_shown])

        bd = att['competency_breakdown']
        bars = page.eval_on_selector_all('.gx-bar', 'els => els.map(e => [e.dataset.competency, e.dataset.band])')
        band = lambda pct: 'mastered' if pct >= 70 else 'developing' if pct >= 60 else 'gap'
        record('one bar per competency with the band from the 70 / 60 thresholds; "show as table" and "how we calculated this" present',
               sorted(bars) == sorted([[k, band(v['percent'])] for k, v in bd.items()]) and page.locator('.gx-tableview table').count() == 1 and page.locator('.gx-method li').count() >= 5, [bars, bd])

        pri = sorted([k for k, v in bd.items() if v['percent'] < 60], key=lambda k: (bd[k]['percent'], k)) + sorted([k for k, v in bd.items() if 60 <= v['percent'] < 70], key=lambda k: (bd[k]['percent'], k))
        plan = page.eval_on_selector_all('.gx-plan li[data-plan]', 'els => els.map(e => [e.dataset.plan, e.dataset.id || "", (e.querySelector("a")||{}).getAttribute ? e.querySelector("a").getAttribute("href") : ""])')
        windows = page.get_attribute('.gx-plan', 'data-windows') if page.locator('.gx-plan').count() else ''
        ok_links = all((t == 'course' and pub(COURSE_BY.get(i, {})) and h == f'#/academy/courses/{COURSE_BY[i]["slug"]}') or (t == 'lab' and any(l['id'] == i and pub(l) and h == f'#/labs/{l["slug"]}' for l in LABS)) for t, i, h in plan if t != 'retake')
        first = plan[0] if plan else None
        covers = bool(first) and pri and ((first[0] == 'course' and pri[0] in [m['competency'] for m in COURSE_BY[first[1]]['competency_mappings']]) or (first[0] == 'lab' and pri[0] in next(l for l in LABS if l['id'] == first[1])['competencies']))
        record(f'30/60/90 plan: windows {windows}; every link is a published course or lab; the first item covers the top priority ({pri[:1]}); "retake" is the last item',
               (not pri or (covers and windows.startswith('30'))) and ok_links and plan and plan[-1][0] == 'retake', [pri, plan, windows])
        record('the draft is removed after submitting; the attempt is saved once', not store(page, 'assessment_drafts') and len([a for a in store(page, 'assessment_attempts') if a['assessment_id'] == READY['id']]) == 1)

        # print view
        page.emulate_media(media='print')
        print_ok = page.evaluate("getComputedStyle(document.querySelector('.gx-result .no-print')).display") == 'none'
        page.emulate_media(media='screen')
        record('print: the result prints without its buttons (print stylesheet)', print_ok)

        # ---------- 8. One-page view ----------
        go(page, '/assessments/pm-readiness?view=all')
        nq2 = len(BY_SLUG['pm-readiness']['question_ids'])
        all_view = page.locator('.qcard:visible').count() == nq2 and page.locator('.gx-rail:visible').count() == 0 and page.locator('[data-action=submit-assessment]:visible').count() == 1
        page.click('[data-action=asm-view]'); page.wait_for_timeout(150)
        toggled = page.locator('.qcard:visible').count() < nq2 and page.locator('.gx-rail:visible').count() == 1
        record('?view=all shows every question with Submit (the earlier layout); the switch returns to stages', all_view and toggled, [all_view, toggled])

        # ---------- 9. Guided lab ----------
        lab = LAB_BY_SLUG['audit-simulator']; nt = len(lab['tasks'])
        go(page, '/labs/audit-simulator', reload=True)
        one = page.locator('.lab-task:visible').count() == 1 and page.locator('.gx-rail .gx-step').count() == nt and page.locator('[data-action=submit-lab]').is_hidden()
        page.click('[data-action=lab-next]'); page.wait_for_timeout(150)
        lab_blocked = page.locator('.lab-task[aria-invalid=true]:visible').count() == 1
        page.locator('.lab-task:visible input[data-unknown], .lab-task:visible input[value="__unknown__"]').first.check(); page.wait_for_timeout(100)
        page.click('[data-action=lab-next]'); page.wait_for_timeout(150)
        second = page.locator('.lab-task:visible').get_attribute('data-task') == lab['tasks'][1]['id']
        page.wait_for_timeout(500)
        go(page, '/labs/audit-simulator', reload=True)
        resumed = page.locator('.lab-task:visible').get_attribute('data-task') == lab['tasks'][1]['id']
        page.click('[data-action=lab-scenario]'); page.wait_for_timeout(150)
        scen_focus = page.evaluate('document.activeElement.id') == 'lab-sc-h'
        page.click('[data-action=lab-view]'); page.wait_for_timeout(150)
        all_tasks = page.locator('.lab-task:visible').count() == nt and page.locator('[data-action=submit-lab]:visible').count() == 1
        lab_h = page.evaluate("document.querySelector('.lab-work').getBoundingClientRect().height") if False else None
        record(f'guided lab: one task of {nt} with a rail, "Check" hidden until the last task; Next validates the task; the draft resumes at the first open task; the scenario link focuses the scenario; the all-tasks view shows {nt}',
               one and lab_blocked and second and resumed and scen_focus and all_tasks, [one, lab_blocked, second, resumed, scen_focus, all_tasks])
        page.click('[data-action=lab-view]'); page.wait_for_timeout(150)
        lab_work_h = page.evaluate("document.querySelector('.lab-work .lab-form-main').getBoundingClientRect().height")
        record('a lab task screen is ≤ 1,600 px high while answering', lab_work_h <= 1600, lab_work_h)

        # ---------- 10. Catalogue ----------
        go(page, '/academy/courses')
        groups = page.eval_on_selector_all('#course-list .gx-cat-group', 'els => els.map(e => [e.dataset.academy, e.querySelectorAll("[data-course]").length, [...e.querySelectorAll("[data-course]")].filter(x => !x.hidden).length])')
        per = {}
        for c in PUB_COURSES: per[academy_of_course(c)] = per.get(academy_of_course(c), 0) + 1
        total = page.locator('#course-list [data-course]').count()
        page.locator('[data-action=cat-more][data-academy=iso]').click(); page.wait_for_timeout(150)
        iso_open = page.locator('.gx-cat-group[data-academy=iso] [data-course]:visible').count() == per.get('iso')
        page.select_option('#cf-level', '2'); page.wait_for_timeout(200)
        flat = page.locator('#course-list .gx-cat-group').count() == 0 and page.locator('#course-list [data-course]').count() == sum(1 for c in PUB_COURSES if str(c['level']) == '2')
        record(f'catalogue grouped by academy ({len(groups)} groups, 4 shown each, every card still in the page = {len(PUB_COURSES)}); "Show all" opens a group; a filter gives the flat list',
               all(g[2] == min(4, per[g[0]]) and g[1] == per[g[0]] for g in groups) and total == len(PUB_COURSES) and iso_open and flat, [groups, per, total, iso_open, flat])

        # ---------- 11. Course page ----------
        go(page, '/academy/courses/iso-foundations')
        nums = page.eval_on_selector_all('section[aria-labelledby=c-out3] .gx-num', 'els => els.map(e => e.textContent.trim())')
        facts_txt = page.inner_text('.hero-facts')
        record('course page: outcomes as numbered cards 01–03; quick facts add delivery and certificate', nums == ['01', '02', '03'] and 'Self-paced' in facts_txt and 'completion' in facts_txt.lower(), [nums, facts_txt])

        # ---------- 12. Lesson key ideas ----------
        c = COURSE_BY['CRS-ISO-101']; l0 = c['modules'][0]['lessons'][0]
        go(page, f'/academy/courses/{c["slug"]}/{l0["id"].replace(c["id"] + "-", "")}')
        flips = page.locator('.gx-keyideas .gx-flip')
        n_f = flips.count()
        flips.first.click(); pressed = flips.first.get_attribute('aria-pressed') == 'true'
        back = page.locator('.gx-keyideas .gx-flip').first.locator('.gx-flip-detail').inner_text().rstrip('…').strip()
        concept = next(bk for bk in l0['content_blocks'] if bk['type'] == 'concept')['text']['en']
        five = page.locator('[data-block]').count() == 5
        record('lesson: three key-idea flip cards (idea, mistake, evidence) toggle aria-pressed; the back is the start of the full block; the five blocks are unchanged',
               n_f == 3 and pressed and concept.startswith(back) and len(back) < len(concept) and five, [n_f, pressed, back[:60], five])

        # ---------- 13. Readiness band ----------
        go(page, '/')
        home_vals = [int(x) for x in page.eval_on_selector_all('[data-readiness=all] .gx-cval', 'els => els.map(e => e.textContent.trim())')]
        home_href = page.get_attribute('[data-readiness=all] [data-action=band-start]', 'href')
        acad = {}
        for key, route in (('iso', '/academy/iso'), ('pmi', '/academy/pmi'), ('quality', '/academy/quality'), ('excellence', '/academy/excellence')):
            go(page, route)
            acad[key] = ([int(x) for x in page.eval_on_selector_all(f'[data-readiness={key}] .gx-cval', 'els => els.map(e => e.textContent.trim())')],
                         page.get_attribute(f'[data-readiness={key}] [data-action=band-start]', 'href'),
                         page.eval_on_selector_all('[data-landing] > [data-tpl]', 'els => els.map(e => e.dataset.tpl)'))
        slugs = {'iso': 'iso-readiness', 'pmi': 'pm-readiness', 'quality': 'quality-readiness', 'excellence': 'excellence-readiness'}
        ok_a = all(v[0] == band_counts(k) and v[1] == f'#/assessments/{slugs[k]}' and v[2] == acad['iso'][2] for k, v in acad.items())
        record(f'readiness band: home counts {home_vals} = calculated from the seed {band_counts()}, opens the assessments list (the general diagnostic is not published); each academy shows its own counts and readiness check; the landing template order is unchanged',
               home_vals == band_counts() and home_href == '#/assessments' and ok_a, [home_vals, band_counts(), home_href, {k: (v[0], band_counts(k), v[1]) for k, v in acad.items()}])

        # ---------- 14. Phone ----------
        mctx = b.new_context(viewport={'width': 390, 'height': 844}); m = mctx.new_page(); watch(m, logs)
        go(m, '/academy/courses', 'ar')
        folded = m.evaluate('!document.querySelector(".gx-filtfold").open') and m.locator('#cf-level').is_hidden()
        cat_h = m.evaluate('document.documentElement.scrollHeight')
        go(m, '/assessments/iso-readiness', 'ar'); m.click('[data-action=asm-start]'); m.wait_for_timeout(200)
        m_stage_h = m.evaluate('document.documentElement.scrollHeight'); m_over = m.evaluate('document.documentElement.scrollWidth - window.innerWidth')
        record('phone (390 px, Arabic): catalogue filters folded under one control, catalogue ≤ 12,000 px; an assessment stage has no horizontal overflow',
               folded and cat_h <= 12000 and m_over <= 1, [folded, cat_h, m_stage_h, m_over])
        mctx.close()

        # ---------- 15. Responsive matrix ----------
        issues = []
        rctx = b.new_context(); r = rctx.new_page(); watch(r, logs)
        for w in (390, 768, 1280, 1920):
            r.set_viewport_size({'width': w, 'height': 900})
            for lang in ('ar', 'en'):
                for route in ('/', '/academy/courses', '/assessments/iso-readiness', '/labs/audit-simulator', '/academy/courses/iso-foundations', '/academy/quality'):
                    go(r, route, lang)
                    over = r.evaluate('document.documentElement.scrollWidth - window.innerWidth'); h1s = r.locator('main h1').count()
                    if over > 1 or h1s != 1: issues.append(f'{lang}@{w} {route} overflow {over} h1 {h1s}')
        record('responsive: 6 pages × 4 widths × AR/EN — one h1 and no horizontal overflow', not issues, issues[:6])

        # ---------- 16. Accessibility ----------
        ax = []
        for theme in ('light', 'dark'):
            for w, lang in ((1280, 'en'), (390, 'ar')):
                r.set_viewport_size({'width': w, 'height': 900})
                r.evaluate('localStorage.clear()') if False else None
                for route, step in (('/', None), ('/academy/courses', None), ('/assessments/iso-readiness', None), ('/assessments/iso-readiness', 'start'),
                                    ('/labs/audit-simulator', None), ('/academy/courses/iso-foundations', None), ('/academy/courses/iso-foundations/L01', 'flip'), ('/academy/iso', None)):
                    go(r, route, lang)
                    if step == 'start' and r.locator('[data-action=asm-start]').count(): r.click('[data-action=asm-start]')
                    if step == 'start' and r.locator('[data-action=asm-resume]').count(): r.click('[data-action=asm-resume]')
                    if step == 'flip' and r.locator('.gx-flip').count(): r.locator('.gx-flip').first.click()
                    r.evaluate(f'document.documentElement.dataset.theme = "{theme}"'); r.wait_for_timeout(150)
                    for v in axe(r): ax.append(f'{theme} {lang}@{w} {route} {step or ""}: {v["id"]} ×{v["n"]} {v["t"]}')
        # result and review screens (light, EN, wide) — reuse the page with the submitted attempt
        go(page, '/assessments/iso-readiness'); page.click('details.prev summary') if page.locator('details.prev summary').count() else None
        for v in axe(page): ax.append(f'previous result: {v["id"]} ×{v["n"]} {v["t"]}')
        record('axe-core WCAG 2.1 A/AA + best practice: 0 violations on home band, grouped catalogue, start screen, a stage, guided lab, course page, lesson flip cards, academy landing and a previous result (EN@1280, AR@390, light + dark)', not ax, ' | '.join(ax[:5]))
        rctx.close()

        # ---------- 17. English result direction ----------
        go(page, '/assessments/iso-readiness', 'en')
        page.click('details.prev summary')
        ltr = page.evaluate('document.documentElement.dir') == 'ltr'
        fill_start = page.evaluate("(() => { const f = document.querySelector('.gx-barfill'); const t = f.parentElement.getBoundingClientRect(); return Math.abs(f.getBoundingClientRect().left - t.left) < 2; })()")
        go(page, '/assessments/iso-readiness', 'ar'); page.click('details.prev summary')
        fill_rtl = page.evaluate("(() => { const f = document.querySelector('.gx-barfill'); const t = f.parentElement.getBoundingClientRect(); return Math.abs(f.getBoundingClientRect().right - t.right) < 2; })()")
        record('competency bars grow from the start edge: left in English, right in Arabic', ltr and fill_start and fill_rtl, [ltr, fill_start, fill_rtl])

        # ---------- 18. Console and storage ----------
        record('no console errors or warnings during the Phase 12B journeys', not logs, logs[:5])
        keys = sorted(set(page.evaluate('Object.keys(localStorage)')))
        record('storage: only cia:v1:* and cia-lang; drafts live in cia:v1:<user>:assessment_drafts', all(k.startswith('cia:v1:') or k == 'cia-lang' for k in keys), keys)
        b.close()
finally:
    srv.terminate()

# ---------- 19. Hub and toolkit integrity ----------
base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = [f for h, f in (l.split(maxsplit=1) for l in base.read_text().splitlines()) if (PLATFORM / f).exists() and hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest() != h]
    record('integrity: hub and toolkit files byte-identical to the baseline apart from the D-08 and D-22 patches (index.html, sw.js)', set(changed) <= {'index.html', 'sw.js'}, changed)

# ---------- 20. Plan §5 measurements still within target ----------
r = subprocess.run([sys.executable, str(ACADEMY / 'tests' / 'e2e' / 'measure_phase10a.py'), '--label', 'phase12b'], capture_output=True, text=True, timeout=600)
try:
    m = json.loads((ACADEMY / 'tests' / 'e2e' / 'out' / 'measure-phase12b.json').read_text(encoding='utf-8'))
    ok = m['top_nav_items'] == 5 and m['home_height'] <= 2700 and m['assessments_screens_1440x900'] <= 4 and m['first_load_json_gzip'] <= 400_000 and m['phase_wording'] == 0 and m['empty_personal_pages'] == 0
    record('plan §5 measurements: 5 top items, home ≤ 2,700 px, assessments ≤ 4 screens, first load ≤ 0.4 MB compressed, no learner-visible "Phase", 0 empty personal pages', ok,
           {k: m[k] for k in ['top_nav_items', 'home_height', 'assessments_screens_1440x900', 'first_load_json_gzip', 'phase_wording', 'empty_personal_pages']})
except Exception as e:
    record('plan §5 measurements', False, f'{e} {r.stderr[-300:]}')

passed = sum(r['ok'] for r in results)
(EVID / 'e2e-phase12b-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
