#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 13 suite (Learning Coach and interview practice). Playwright + axe-core.

Empty state without a dead end; guardrail refusals with the Academy page and the official link; grounded answers with per-part
source labels; the ACCEPTANCE JOURNEY (the same question asked by two learners with different history gives different,
correctly grounded answers); "explain my mistakes" after a real assessment and a real lab attempt (counts re-derived here from
the saved attempt); weak areas, repeated mistakes, practice questions that are not recorded, latest attempt wins; practice
scenario with rubric feedback (reviewer view — templates await approval) and the learner's empty state; plan my week with a
company assignment first and the .ics file; interview practice with adaptive follow-up, scored feedback, no verdict wording,
the session in the learner's own records and in the passport; lesson and course panels; the optional model adapter (absent by
default, no third-party request; with a configured endpoint: preview = payload, opt-in required, guarded request never sent);
responsive 390/768/1280/1920 × AR/EN, axe light + dark, console, storage keys, hub integrity, plan §5 measurements.
Usage: python3 tests/e2e/run_e2e_phase13.py [--evidence DIR]
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request, hashlib, re
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
AXE = (ACADEMY / 'tests' / 'vendor' / 'axe.min.js').read_text(encoding='utf-8')
SEED = lambda f: json.loads((ACADEMY / 'data' / 'seed' / f).read_text(encoding='utf-8'))['items']
QUESTIONS = {q['id']: q for q in SEED('questions.json')}
COURSES = SEED('courses.json')
CERTS = SEED('certifications.json'); PMP = next(c for c in CERTS if c['slug'] == 'pmp')
COACH = SEED('coach.json')
pub = lambda r: (r.get('governance') or {}).get('content_status') == 'published' and not r.get('draft')
COACH_PUBLISHED = [x for x in COACH if pub(x)]
VERDICT = re.compile(r'you (are|will be|would be) hired|not hireable|passed the interview|failed the interview|hiring verdict:|سيتم توظيفك|نجحت في المقابلة|رسبت في المقابلة', re.I)

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
requests = []
def watch(page, logs):
    page.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') and (m.location or {}).get('url', BASE).startswith(BASE) else None)
    page.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
    page.on('request', lambda r: requests.append(r.url))
def settle(page):
    page.wait_for_selector('html[data-ready]')
    page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=20000)
    page.wait_for_timeout(250)
def go(page, route, lang='en', extra='&dev=0'):
    page.goto(f'{BASE}/academy/?lang={lang}{extra}#{route}'); page.reload(); settle(page)
def axe(page):
    # Phase 14: Academy pages carry a Content-Security-Policy (script-src 'self'), so axe is loaded from the site's own origin there;
    # other pages (hub, review build) still get it inline. The assertions are unchanged.
    page.add_script_tag(url=BASE + '/academy/tests/vendor/axe.min.js') if page.url.startswith(BASE + '/academy/') else page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")
def store(page, key):
    raw = page.evaluate(f'localStorage.getItem("cia:v1:local:{key}")')
    return (json.loads(raw) if raw else {'items': []})['items']
def attempt(page, slug, wrong=True, extra='&dev=0'):
    """A real attempt through the one-page form: every single-choice question answered wrongly (or correctly)."""
    go(page, f'/assessments/{slug}?view=all', extra=extra)
    for qid in page.eval_on_selector_all('.asm-form .qcard', 'els => els.map(e => e.dataset.question)'):
        c = page.locator(f'#qc-{qid}'); q = QUESTIONS[qid]
        radios = c.locator('.opts input[type=radio]:not([data-unknown])')
        vals = [radios.nth(i).get_attribute('value') for i in range(radios.count())]
        pick = [v for v in vals if (v != str(q.get('correct_answer'))) == wrong and v != '__unknown__']
        if pick: c.locator(f'input[type=radio][value="{pick[0]}"]').first.check()
        elif c.locator('.opts input[type=checkbox]').count(): c.locator('.opts input[type=checkbox]').first.check()
        elif c.locator('select').count():
            for i in range(c.locator('select').count()): c.locator('select').nth(i).select_option(index=1)
        elif c.locator('textarea').count(): c.locator('textarea').fill('A written answer for the reviewer, long enough to be accepted by the form.')
        elif radios.count(): radios.first.check()
    page.click('[data-action=submit-assessment]'); page.wait_for_selector('.gx-result'); settle(page)
def weak_expected(attempts):
    """Re-derive the weak items here: the latest attempt that contains an item decides."""
    last, wrong = {}, {}
    for at in sorted(attempts, key=lambda a: a['submitted_at']):
        for d in at['detail']:
            if not d.get('auto'): continue
            last[d['question_id']] = (d['correct'], d.get('competency') or QUESTIONS[d['question_id']].get('competency'))
            wrong[d['question_id']] = wrong.get(d['question_id'], 0) + (0 if d['correct'] else 1)
    items = {q: (wrong[q], c) for q, (ok, c) in last.items() if not ok}
    return items, {c for _, c in items.values() if c}
def coach_tab(page, tab, lang='en', extra='&dev=0'):
    go(page, f'/my?tab=coach&p={tab}', lang, extra)
    page.wait_for_selector(f'[role=tabpanel][data-panel=coach-{tab}]:not([hidden])'); settle(page)
def ask(page, q, box='coach-ask-main'):
    page.fill('#' + box, q); page.locator(f'#{box}').press('Enter')
    page.wait_for_selector('.coach-answer'); page.wait_for_timeout(250)
    return page.locator('.coach-answer').last

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        logs = []
        ctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True); page = ctx.new_page(); watch(page, logs)

        # ---------- 1. Empty state: no dead end ----------
        coach_tab(page, 'weak')
        tabs = page.eval_on_selector_all('.myspace > .tabs > [role=tablist] > [role=tab]', 'els => els.map(e => e.dataset.tab)')
        top = page.locator('header nav a[aria-current], header .nav-top a, header nav[aria-label] > ul > li').count()
        empty = page.locator('[data-empty=weak]').count() == 1 and page.locator('[data-action=coach-take-check]').get_attribute('href').startswith('#/assessments') and page.locator('[data-action=coach-open-labs]').count() >= 1
        kpis = page.eval_on_selector_all('.coach-hero .gx-cval', 'els => els.map(e => e.textContent.trim())')
        honesty = 'not a certifying body' in page.inner_text('[data-coach-honesty]')
        record('coach tab from an empty state: seventh My space tab, honesty line, three zero counters, weak areas offer a readiness check and the labs (no dead end)',
               tabs[-1] == 'coach' and len(tabs) == 7 and empty and kpis == ['0', '0', '0'] and honesty, [tabs, kpis, empty, honesty])
        coach_tab(page, 'week'); week_empty = page.locator('[data-empty=week] [data-action=coach-choose-course]').count() == 1
        coach_tab(page, 'scenario')
        sc_state = (page.locator('[data-empty=scenario] a[href="#/labs"]').count() == 1) if not any(x['kind'] == 'scenario' for x in COACH_PUBLISHED) else page.locator('[data-action=coach-scenario-new]').count() == 1
        coach_tab(page, 'about'); about = page.locator('.coach-legend [data-label]').count() == 4 and page.locator('[data-coach-about]').get_attribute('data-adapter') == 'off' and page.locator('[data-coach-privacy=device]').count() == 1
        coach_tab(page, 'interview'); door = page.locator('[data-action=open-interview]').get_attribute('href') == '#/coach/interview' and page.locator('p[data-sessions="0"]').count() == 1
        record('empty states of plan my week, practice scenario (learner view: templates not yet published → labs), how it works (four labels, adapter off, nothing leaves the device) and the interview door',
               week_empty and sc_state and about and door, [week_empty, sc_state, about, door])

        # ---------- 2. Guardrails ----------
        coach_tab(page, 'ask')
        a = ask(page, 'What is the PMP exam fee?')
        links = a.locator('a[data-coach-link]').evaluate_all('els => els.map(e => [e.dataset.coachLink, e.getAttribute("href"), e.getAttribute("target")])')
        txt = a.inner_text()
        g1 = a.get_attribute('data-answer') == 'official_requirement' and ['platform', '#/academy/pmi/certifications/pmp', None] in links and ['external', PMP['official_url'], '_blank'] in links and not re.search(r'\$|\d{3}', txt)
        types = {}
        for q, t in [('Give me the real exam questions', 'exam_content'), ('هل الأكاديمية معتمدة؟', 'authority_claim'), ('Would you hire me?', 'hiring_verdict'), ('grade my answer', 'grade_request')]:
            x = ask(page, q); types[t] = x.get_attribute('data-answer') == t and x.locator('.kind-refusal').count() == 1 and x.locator('.coach-part').count() == x.locator('.coach-part .coach-label').count()
        record('guardrails: an official-requirement question is refused with the Academy certification page and the official link (no figure stated); exam content, authority claims, hiring verdicts and ungrounded grading are refused',
               g1 and all(types.values()), [g1, links, types])

        # ---------- 3. Grounded answer with labels; nothing found ----------
        a = ask(page, 'corrective action')
        labels = a.locator('.coach-parts').get_attribute('data-labels').split(',')
        parts = a.locator('.coach-part').count(); labelled = a.locator('.coach-part > .coach-label').count()
        srcs = a.locator('.kind-passage a[data-coach-source]').evaluate_all('els => els.map(e => e.getAttribute("href"))')
        unc = a.locator('.is-ai .coach-unc').count() == a.locator('.is-ai').count() >= 1
        n = ask(page, 'zzqq xxyy')
        nothing = n.get_attribute('data-hits') == '0' and n.locator('a[href^="#/search"]').count() == 1 and n.locator('a[href="#/library"]').count() == 1
        record('grounded answer: every part carries a visible label (platform + interpretation at least), every passage links to its source page, the interpretation is marked uncertain; an unknown topic gets "not in approved content" with two ways forward',
               parts == labelled and parts >= 2 and {'platform', 'ai'} <= set(labels) and srcs and all(s.startswith('#/') for s in srcs) and unc and nothing, [parts, labelled, labels, srcs[:2], unc, nothing])

        # ---------- 3b. A question asked as a sentence, in Arabic and in English (D-107) ----------
        sent = {}
        for lang_, q_ in (('ar', 'ما الفرق بين التصحيح والإجراء التصحيحي؟'), ('en', 'What is the difference between correction and corrective action?')):
            x = ask(page, q_)
            sent[lang_] = [int(x.get_attribute('data-hits') or 0), x.locator('.kind-passage a[data-coach-source]').evaluate_all('els => els.map(e => e.getAttribute("href"))')]
        p_ = ask(page, 'How do I build a risk register for a project?')
        partial = int(p_.get_attribute('data-hits') or 0) >= 1 and 'hold most of them' in p_.inner_text()
        record('a question asked as a full sentence finds the same grounded pages in Arabic and in English (correction versus corrective action); when no page holds every word the answer says the match is partial',
               all(v[0] >= 2 and any('nonconformity-corrective-action' in h_ or 'correction' in h_ for h_ in v[1]) for v in sent.values()) and partial, [sent, partial])

        # ---------- 4. Explain my mistakes after a real assessment ----------
        attempt(page, 'iso-readiness', wrong=True)
        at1 = store(page, 'assessment_attempts')[-1]
        wrong_auto = [d for d in at1['detail'] if d.get('auto') and not d['correct']]
        comps = {d.get('competency') or QUESTIONS[d['question_id']].get('competency') for d in wrong_auto}
        blk = page.locator('[data-coach=mistakes][data-kind=assessment]')
        closed = blk.locator('.coach-mistakes').count() == 0
        blk.locator('[data-action=explain-mistakes]').click(); page.wait_for_timeout(200)
        mm = blk.locator('.coach-mistakes')
        shown = blk.locator('.coach-mitem').evaluate_all('els => els.map(e => e.dataset.item)')
        lab2 = set(blk.locator('.coach-mitem .coach-part').evaluate_all('els => els.map(e => e.dataset.label)'))
        all_lab = blk.locator('.coach-part').count() == blk.locator('.coach-part > .coach-label').count()
        asked = set(at1['answers'].keys()) | {d['question_id'] for d in at1['detail']}
        record(f'explain my mistakes on the result screen: folded until asked; {len(wrong_auto)} wrong answers in {len(comps)} competencies (re-derived here from the saved attempt); stored rationales labelled as Academy content beside the learner\'s own answer; only attempted questions',
               closed and mm.get_attribute('data-mistakes') == str(len(wrong_auto)) and mm.get_attribute('data-groups') == str(len(comps)) and sorted(shown) == sorted(d['question_id'] for d in wrong_auto) and {'platform', 'user'} <= lab2 and all_lab and set(shown) <= asked,
               [len(wrong_auto), mm.get_attribute('data-mistakes'), len(comps), mm.get_attribute('data-groups'), lab2])

        # ---------- 5. Weak areas, practice not recorded ----------
        coach_tab(page, 'weak')
        items, wcomps = weak_expected(store(page, 'assessment_attempts'))
        root = page.locator('[data-coach=root]')
        cards = page.eval_on_selector_all('.coach-weak', 'els => els.map(e => [e.dataset.weak, e.dataset.wrong, e.dataset.items])')
        ok_cards = all(int(w) == sum(n for n, c in items.values() if c == comp) and int(i) == sum(1 for n, c in items.values() if c == comp) for comp, w, i in cards)
        n_before = len(store(page, 'assessment_attempts'))
        page.locator('[data-action=coach-practise]').first.click(); page.wait_for_selector('.coach-practice[data-questions]'); page.wait_for_timeout(300)
        pq = page.eval_on_selector_all('.coach-pq', 'els => els.map(e => e.dataset.practiceQuestion)')
        comp0 = cards[0][0]
        pq_ok = 1 <= len(pq) <= 2 and all(QUESTIONS[q]['competency'] == comp0 and pub(QUESTIONS[q]) for q in pq)
        first = page.locator('.coach-pq').first
        first.locator('[data-action=coach-practice-check]').click(); need = 'Choose' in first.locator('.err').inner_text()
        first.locator(f'input[value="{QUESTIONS[pq[0]]["correct_answer"]}"]').check(); first.locator('[data-action=coach-practice-check]').click(); page.wait_for_timeout(150)
        fb = first.get_attribute('data-correct') == 'true' and first.locator('.coach-part').count() >= 1
        record(f'weak areas: {len(wcomps)} competencies with wrong answers (counts re-derived here), evidence line from the learner\'s records, up to two practice questions of the same competency from published non-final assessments, feedback from stored rationales, nothing recorded as an attempt',
               root.get_attribute('data-weak') == str(len(wcomps)) and ok_cards and pq_ok and need and fb and len(store(page, 'assessment_attempts')) == n_before, [root.get_attribute('data-weak'), len(wcomps), cards[:2], pq, need, fb])

        # ---------- 6. Repeated mistakes; latest attempt wins ----------
        attempt(page, 'iso-readiness', wrong=True)
        coach_tab(page, 'weak')
        items2, _ = weak_expected(store(page, 'assessment_attempts'))
        rep = sum(1 for n, _ in items2.values() if n >= 2)
        rep_ok = page.locator('[data-coach=root]').get_attribute('data-repeated') == str(rep) and rep > 0 and page.locator('.coach-weak .badge-warn').count() >= 1
        why = page.locator('.coach-why').first; why.locator('summary').click()
        why_ok = why.locator('.is-platform').count() >= 1
        attempt(page, 'iso-readiness', wrong=False)
        coach_tab(page, 'weak')
        items3, wc3 = weak_expected(store(page, 'assessment_attempts'))
        record(f'repeated mistakes: {rep} items missed twice are marked "Repeated" with their stored reasoning; after a correct attempt they leave the list (the latest attempt wins)',
               rep_ok and why_ok and page.locator('[data-coach=root]').get_attribute('data-weak') == str(len(wc3)) and len(items3) < len(items2), [rep, rep_ok, why_ok, len(items2), len(items3)])

        # ---------- 7. Lesson and course panels ----------
        go(page, '/academy/courses/iso-9001-foundation/L01')
        panel = page.locator('[data-coach=lesson]')
        folded = panel.count() == 1 and panel.get_attribute('open') is None
        after_keys = page.evaluate("(() => { const k = document.querySelector('.gx-keyideas'), c = document.querySelector('[data-coach=lesson]'); return !k || !!(k.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); })()")
        panel.locator('summary').first.click()
        depth = {}
        for d in ('brief', 'standard', 'deep'):
            panel.locator(f'[data-action=coach-explain][data-depth={d}]').click(); page.wait_for_timeout(120)
            depth[d] = len(panel.locator('[data-coach-out=lesson]').inner_text())
        dl = set(panel.locator('[data-coach-out=lesson] .coach-part').evaluate_all('els => els.map(e => e.dataset.label)'))
        panel.locator('[data-action=coach-socratic]').click(); page.wait_for_timeout(120)
        soc = panel.locator('[data-coach-out=lesson] .kind-question.is-ai').count() == 2
        panel.locator('[data-action=coach-check]').click(); page.wait_for_timeout(120)
        chk_empty = panel.locator('[data-coach-out=lesson]').get_attribute('data-shown') == 'check-empty'
        page.fill('#ex-notes', 'Customer focus: we changed the label after a customer request. Leadership: the manager reviews the quality objectives. Evidence-based decisions: the scrap trend justified a new tool.')
        panel.locator('[data-action=coach-check]').click(); page.wait_for_timeout(150)
        chk = panel.locator('[data-coach-out=lesson] [data-terms]')
        chk_ok = chk.count() == 1 and int(chk.get_attribute('data-terms')) > 0 and 'do not grade' in panel.locator('[data-coach-out=lesson]').inner_text()
        panel.locator('[data-action=coach-review]').click(); page.wait_for_selector('[data-coach-out=lesson] [data-review]')
        go(page, '/academy/courses/iso-9001-foundation')
        cp = page.locator('[data-coach=course]'); cp.locator('summary').first.click(); page.wait_for_selector('[data-coach-out=course] [data-review]')
        record('lesson coach: a folded panel after the key-idea cards; three depths (each longer than the last) from the lesson\'s own text; two open questions marked as interpretation; "check my exercise answer" never grades (no stored criteria) and shows term coverage; "what to review first" on the lesson and the course page',
               folded and after_keys and depth['brief'] < depth['standard'] < depth['deep'] and dl == {'platform'} and soc and chk_empty and chk_ok and cp.count() == 1, [folded, after_keys, depth, dl, soc, chk_empty, chk_ok])

        # ---------- 8. Lab mistakes ----------
        go(page, '/labs/audit-simulator')
        page.click('[data-action=lab-view]'); page.wait_for_timeout(200)
        for el in page.locator('.lab-task input[data-unknown], .lab-task input[value="__unknown__"]').all():
            if el.is_visible(): el.check()
        for ta in page.locator('.lab-task textarea').all():
            if ta.is_visible() and not ta.input_value(): ta.fill('A written answer for the reviewer: the requirement, the evidence seen in the sample and the extent of the gap over the period.')
        page.click('[data-action=submit-lab]'); page.wait_for_selector('.lab-result'); settle(page)
        lat = store(page, 'lab_attempts')[-1]
        lw = [d for d in lat['detail'] if d.get('auto') and not d.get('pending') and not d['correct']]
        lb = page.locator('[data-coach=mistakes][data-kind=lab]')
        lb.locator('[data-action=explain-mistakes]').click(); page.wait_for_timeout(200)
        record(f'explain my mistakes on a practice-lab result: {len(lw)} auto-scored tasks not right (from the saved attempt), each with the stored model answer; written tasks awaiting review are left out',
               len(lw) > 0 and lb.locator('.coach-mistakes').get_attribute('data-mistakes') == str(len(lw)) and lb.locator('.coach-mitem').count() == len(lw) and lb.locator('.coach-part.is-platform').count() >= len(lw), [len(lw), lb.locator('.coach-mitem').count()])

        # ---------- 9. Plan my week with a company assignment ----------
        target = next(c for c in COURSES if pub(c) and c['slug'] == 'iso-foundations')
        page.evaluate("""c => localStorage.setItem('cia:v1:local:assignments_inbox', JSON.stringify({ schema: 1, items: [{ id: 'ASG-T1', schema: 'cia.assignment.v1', type: 'course', target_id: c.id, title: c.title, due: '2099-01-15', company: 'Test Co', created_at: '2026-11-16T08:00:00Z', cancelled: false }] }))""", {'id': target['id'], 'title': target['title']})
        attempt(page, 'pm-readiness', wrong=True)
        coach_tab(page, 'week')
        wk = page.locator('[data-week=plan]')
        sources = wk.get_attribute('data-sources').split(',')
        first_src = wk.locator('.coach-sources li').first
        first_ok = first_src.get_attribute('data-source') == 'assignment' and first_src.get_attribute('data-course') == target['id'] and 'due' in first_src.inner_text().lower()
        first_lesson = target['modules'][0]['lessons'][0]['title']['en']
        sess_ok = first_lesson in wk.locator('.coach-week li').first.inner_text() and int(wk.get_attribute('data-sessions')) >= 1
        rev = int(wk.get_attribute('data-reviews')) >= 1 and wk.locator('.coach-reviewline').count() >= 1
        with page.expect_download() as dlinfo: page.click('[data-action=coach-week-ics]')
        ics = pathlib.Path(dlinfo.value.path()).read_text(encoding='utf-8')
        ics_ok = ics.startswith('BEGIN:VCALENDAR') and ics.count('BEGIN:VEVENT') == int(wk.get_attribute('data-sessions')) and 'Weak-area review' in ics.replace('\r\n ', '')
        record('plan my week: the company assignment leads (soonest due date), then the latest 30-day plan; its first lesson opens the first session; weak-area reviews are added; the calendar file holds one event per session with the review line',
               sources[0] == 'assignment' and first_ok and sess_ok and rev and ics_ok, [sources, first_ok, sess_ok, rev, ics_ok])

        # ---------- 10. Interview practice (learner view) ----------
        go(page, '/coach/interview')
        setup = page.locator('[data-interview=setup]')
        roles_n = int(setup.get_attribute('data-roles')); bank_n = int(setup.get_attribute('data-bank'))
        nov = page.locator('[data-no-verdict]').count() >= 1
        page.select_option('#ci-role', 'ROLE-IA'); page.select_option('#ci-count', '3'); page.click('[data-action=interview-start]'); page.wait_for_selector('[data-interview=session]')
        s0 = page.locator('[data-interview=session]')
        follow0 = s0.get_attribute('data-follow-up') == 'true' and page.locator('[data-follow-up=true] #ci-follow').count() == 1
        gen = s0.get_attribute('data-generated') == ('false' if any(x['kind'] == 'interview_question' for x in COACH_PUBLISHED) else 'true')
        page.click('[data-action=interview-next]'); short = 'at least 8 words' in page.inner_text('#ci-err') and s0.get_attribute('data-index') == '0'
        ANSWER = 'First, I planned the audit around the processes with complaints and recent changes. For example, in my last audit I sampled ten records, then I traced the evidence to the requirement, and as a result the finding was accepted because it was factual.'
        for i in range(3):
            page.fill('#ci-answer', ANSWER)
            page.click('[data-action=interview-next]' if i < 2 else '[data-action=interview-finish]'); page.wait_for_timeout(300)
        page.wait_for_selector('[data-interview-result]')
        res = page.locator('[data-interview-result]')
        sess = store(page, 'interview_sessions')
        dims = dict(page.eval_on_selector_all('.coach-dims li', 'els => els.map(e => [e.dataset.dim, e.dataset.value])'))
        body = page.inner_text('main')
        s_ok = len(sess) == 1 and sess[0]['status'] == 'self_declared_practice' and sess[0]['evidence'] is False and len(sess[0]['items']) == 3 and all(k not in sess[0] for k in ('verdict', 'passed', 'result'))
        dims_ok = set(dims) == {'knowledge', 'depth', 'communication'} and all(str(sess[0]['totals'][k]) == v for k, v in dims.items()) and int(dims['depth']) > 0
        record(f'interview practice: {roles_n} roles; questions follow the role with the weaker competency first and an adaptive follow-up; a short answer is refused; the session is saved in the learner\'s own records as self-declared practice with three scores and no verdict wording anywhere',
               roles_n >= 9 and nov and follow0 and gen and short and s_ok and dims_ok and res.get_attribute('data-evidence') == 'false' and not VERDICT.search(body) and 'no hiring decision' in body, [roles_n, bank_n, follow0, gen, short, s_ok, dims])
        sid = sess[0]['id']
        go(page, '/my?tab=passport'); settle(page)
        line = page.locator('[data-interview-practice]')
        pass_ok = line.count() == 1 and line.get_attribute('data-interview-practice') == '1' and line.get_attribute('data-evidence') == 'false' and line.locator('[data-ev=self_declared]').count() == 1
        entries_none = page.locator('.pp-entry[data-kind=interview]').count() == 0
        go(page, f'/coach/interview?s={sid}'); reopened = page.locator(f'[data-interview-result="{sid}"]').count() == 1
        coach_tab(page, 'interview'); listed = page.locator(f'.coach-sessions [data-session="{sid}"]').count() == 1
        page.click('[data-action=delete-session]'); page.wait_for_selector('p[data-sessions="0"]')
        record('the session reopens from its address, is listed in the passport as self-declared practice (not an evidence entry) and can be deleted', pass_ok and entries_none and reopened and listed and not store(page, 'interview_sessions'), [pass_ok, entries_none, reopened, listed])

        # ---------- 11. No third-party request in the default configuration ----------
        foreign = sorted({u for u in requests if not u.startswith(BASE) and not u.startswith('data:') and not u.startswith('blob:')})
        record('default configuration: no network request leaves the site during every coach journey above; the model adapter is absent from the page', not foreign and page.locator('[data-coach-model]').count() == 0, foreign[:5])
        ctx.close()

        # ---------- 12. Acceptance journey: two learners, the same question ----------
        out = {}
        for who, slug in (('A', 'iso-readiness'), ('B', 'pm-readiness')):
            c2 = b.new_context(viewport={'width': 1280, 'height': 900}); pg = c2.new_page(); watch(pg, logs)
            attempt(pg, slug, wrong=True)
            coach_tab(pg, 'ask')
            a = ask(pg, 'risk')
            out[who] = {'passages': a.locator('.kind-passage a[data-coach-source]').evaluate_all('els => els.map(e => e.dataset.coachSource)'), 'labels': a.locator('.coach-parts').get_attribute('data-labels').split(','),
                        'hrefs': a.locator('.kind-passage a[data-coach-source]').evaluate_all('els => els.map(e => e.getAttribute("href"))'), 'weak': pg.locator('[data-coach=root]').get_attribute('data-weak'), 'note': a.locator('.is-ai').inner_text()}
            c2.close()
        index = {e['id']: e for e in json.loads((ACADEMY / 'data' / 'search-index.json').read_text(encoding='utf-8'))['items']}
        grounded = all(pid in index and index[pid]['h'] == h for w in out.values() for pid, h in zip(w['passages'], w['hrefs']))
        record('ACCEPTANCE: the same question ("risk") asked by two learners with different history (ISO readiness vs PM readiness) gives different passages, each a published record of the search index, with at least two different source labels',
               out['A']['passages'] and out['B']['passages'] and out['A']['passages'] != out['B']['passages'] and grounded and all(len(set(w['labels'])) >= 2 for w in out.values()) and out['A']['note'] != out['B']['note'], out)

        # ---------- 13. Reviewer view: scenario generation and rubric feedback ----------
        rctx = b.new_context(viewport={'width': 1280, 'height': 900}); rp = rctx.new_page(); watch(rp, logs)
        go(rp, '/', extra=''); rp.evaluate('localStorage.setItem("cia:v1:session", JSON.stringify({ roles: ["learner", "reviewer"] }))')
        coach_tab(rp, 'scenario', extra='')
        rp.select_option('#cs-comp', 'AUD-03'); rp.click('[data-action=coach-scenario-new]'); rp.wait_for_selector('.coach-sc')
        sc = rp.locator('.coach-scenario'); tid = sc.get_attribute('data-scenario'); seed1 = sc.get_attribute('data-seed'); tpl = next(x for x in COACH if x['id'] == tid)
        gen_lab = 'not an exam question' in rp.inner_text('[data-generated]') and rp.locator('.coach-sc').get_attribute('data-label') == 'generated_practice'
        filled = '{' not in rp.inner_text('.coach-sctext') and 'AUD-03' in tpl['competencies']
        rp.fill('#cs-answer', 'too short'); rp.click('[data-action=coach-rubric]'); short = 'at least 8 words' in rp.inner_text('#cs-err')
        rp.fill('#cs-answer', 'The procedure requires an approval signature on every record. In the sample, three of ten records observed had no signature over the last two months.'); rp.click('[data-action=coach-rubric]'); rp.wait_for_timeout(200)
        fb = rp.locator('[data-coach-out=rubric]')
        crit = fb.locator('.coach-crit').evaluate_all('els => els.map(e => [e.dataset.criterion, e.dataset.level])')
        rub_ok = fb.get_attribute('data-graded') == 'true' and fb.get_attribute('data-evidence') == 'false' and [c for c, _ in crit] == [r['id'] for r in tpl['rubric']] and all(l in ('meets', 'partial', 'not_yet') for _, l in crit)
        text = fb.inner_text()
        honest = 'cannot judge meaning' in text and 'never competency evidence' in text
        rp.click('[data-action=coach-scenario-next]'); rp.wait_for_timeout(200); seed2 = rp.locator('.coach-scenario').get_attribute('data-seed')
        record('practice scenario (reviewer view of the templates awaiting approval): labelled "generated practice — not an exam question", every slot filled, a short answer is not graded, feedback criterion by criterion from the stored rubric, marked as keyword-based practice and never evidence; nothing saved as an attempt',
               gen_lab and filled and short and rub_ok and honest and seed2 != seed1 and not store(rp, 'assessment_attempts'), [tid, gen_lab, filled, short, crit, honest])
        go(rp, '/review?collection=coach', extra=''); rv = rp.locator('main').inner_text()
        record('the review queue lists the coach templates (scenario templates and interview questions) for a reviewer', 'SCN-' in rv or 'IQ-' in rv or 'Coach templates' in rv, rv[:200])
        rctx.close()

        # ---------- 14. Optional model adapter with a configured endpoint ----------
        mctx = b.new_context(viewport={'width': 1280, 'height': 900}); mp = mctx.new_page(); mlogs = []; watch(mp, mlogs)
        cfg = json.loads((ACADEMY / 'data' / 'config.json').read_text(encoding='utf-8')); cfg['coach'] = {'enabled': True, 'endpoint': 'https://coach-proxy.example.test/ask', 'name': 'Test proxy'}
        sent = []
        mp.route('**/data/config.json', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(cfg)))
        # Phase 14: configuring the endpoint also adds its origin to the page's Content-Security-Policy (tools/build_phase14.py does
        # this for a real configuration); the test applies the same change to the page it serves. Assertions are unchanged.
        def csp_page(r):
            res = r.fetch(); body = res.text().replace("connect-src 'self'", "connect-src 'self' https://coach-proxy.example.test")
            r.fulfill(response=res, body=body)
        mp.route(lambda u: u.split('?')[0].split('#')[0].endswith('/academy/'), csp_page)
        def proxy(r):
            sent.append(json.loads(r.request.post_data or '{}'))
            r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps({'parts': ['Think about the cause before the fix.', 'You will definitely pass, guaranteed.']}))
        mp.route('https://coach-proxy.example.test/**', lambda r: (r.fulfill(status=204, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST'}) if r.request.method == 'OPTIONS' else proxy(r)))
        attempt(mp, 'iso-readiness', wrong=True)
        coach_tab(mp, 'ask')
        box = mp.locator('[data-coach-model=available]'); box.locator('summary').click()
        fields = [f for f in box.get_attribute('data-fields').split(',') if f]
        shown = box.locator('.coach-preview [data-field]').evaluate_all('els => els.map(e => e.dataset.field)')
        mp.fill('#coach-ask-main', 'How do I find a root cause?'); mp.click('[data-action=coach-model-send]'); mp.wait_for_timeout(300)
        no_consent = not sent and 'agreement' in mp.inner_text('#cm-err')
        mp.check('#cm-consent'); mp.fill('#coach-ask-main', 'What is the PMP exam fee?'); mp.click('[data-action=coach-model-send]'); mp.wait_for_timeout(400)
        guarded = not sent and mp.locator('[data-coach-out=model]').get_attribute('data-sent') == 'false'
        mp.fill('#coach-ask-main', 'How do I find a root cause?'); mp.click('[data-action=coach-model-send]'); mp.wait_for_selector('[data-coach-out=model][data-sent=true]')
        outm = mp.locator('[data-coach-out=model]')
        payload_ok = len(sent) == 1 and sorted(sent[0]['context'].keys()) == sorted(fields) == sorted(shown) and sent[0]['question'] == 'How do I find a root cause?' and set(sent[0].keys()) == {'schema', 'locale', 'question', 'context'}
        ai_ok = outm.locator('.coach-part').evaluate_all('els => els.map(e => e.dataset.label)') == ['ai'] and 'guaranteed' not in outm.inner_text() and outm.locator('.coach-unc').count() == 1
        record('optional model adapter (only with an endpoint the owner configures): the fields to be sent are shown first and equal the payload; nothing is sent without the tick; a guarded question is refused locally and never sent; the reply is labelled as interpretation, marked uncertain, and a promise of passing is dropped by the same guardrails',
               'weak_items' in fields and no_consent and guarded and payload_ok and ai_ok, [fields, shown, no_consent, guarded, payload_ok, ai_ok, mlogs[:2]])
        mctx.close()

        # ---------- 15. Responsive + axe ----------
        over, ax = [], []
        for w, hgt in ((390, 844), (768, 1024), (1280, 900), (1920, 1080)):
            for lang in ('ar', 'en'):
                c3 = b.new_context(viewport={'width': w, 'height': hgt}); pg = c3.new_page(); watch(pg, logs)
                attempt(pg, 'iso-readiness', wrong=True)
                for route, pre in (('/my?tab=coach&p=weak', None), ('/my?tab=coach&p=ask', 'ask'), ('/my?tab=coach&p=week', None), ('/my?tab=coach&p=about', None), ('/coach/interview', None), ('/academy/courses/iso-9001-foundation/L01', 'lesson'), ('/assessments/iso-readiness', 'result')):
                    go(pg, route, lang)
                    if pre == 'ask': ask(pg, 'corrective action')
                    if pre == 'lesson': pg.locator('[data-coach=lesson] summary').first.click(); pg.locator('[data-action=coach-explain][data-depth=standard]').click(); pg.wait_for_timeout(120)
                    if pre == 'result':
                        pg.click('details.prev summary'); pg.wait_for_timeout(150)
                        if pg.locator('[data-action=explain-mistakes]').count(): pg.locator('[data-action=explain-mistakes]').first.click(); pg.wait_for_timeout(150)
                    sw = pg.evaluate('document.documentElement.scrollWidth')
                    if sw > w + 1: over.append(f'{route}@{w}/{lang}: {sw}')
                    if (w, lang) in ((1280, 'en'), (390, 'ar')):
                        for theme in ('light', 'dark'):
                            pg.evaluate(f'document.documentElement.dataset.theme = "{theme}"'); pg.wait_for_timeout(60)
                            ax += [f'{route}@{w}/{lang}/{theme}: {v["id"]} ({v["n"]}) {v["t"][:1]}' for v in axe(pg)]
                c3.close()
        record('responsive: no horizontal overflow at 390 / 768 / 1280 / 1920 in Arabic and English on the coach tabs, interview practice, the lesson panel and the result block', not over, over[:6])
        record('axe-core WCAG 2.1 A/AA + best practice: 0 violations on the coach tabs, an answer, plan my week, interview practice, the lesson panel and the mistakes block (EN@1280, AR@390, light + dark)', not ax, ' | '.join(ax[:5]))

        # ---------- 16. Arabic interface and interview session at phone width ----------
        c4 = b.new_context(viewport={'width': 390, 'height': 844}); pg = c4.new_page(); watch(pg, logs)
        coach_tab(pg, 'about', 'ar')
        rtl = pg.evaluate('document.documentElement.dir') == 'rtl' and 'تفسير المدرب' in pg.inner_text('.coach-legend') and not re.search(r'coach13\.', pg.inner_text('main'))
        go(pg, '/coach/interview', 'ar'); pg.click('[data-action=interview-start]'); pg.wait_for_selector('[data-interview=session]')
        ar_q = bool(re.search(r'[؀-ۿ]{3,}', pg.inner_text('.coach-iprompt'))) and pg.evaluate('document.documentElement.scrollWidth') <= 391
        record('Arabic: right-to-left, labels and the interview question in Arabic, no missing string key shown, phone width without overflow', rtl and ar_q, [rtl, ar_q])
        keys = sorted(set(pg.evaluate('Object.keys(localStorage)')))
        c4.close()

        # ---------- 17. Console and storage ----------
        record('no console errors or warnings during the Phase 13 journeys', not logs, logs[:5])
        record('storage: only cia:v1:* and cia-lang', all(k.startswith('cia:v1:') or k == 'cia-lang' for k in keys), keys)
        b.close()
finally:
    srv.terminate()

# ---------- 18. Hub and toolkit integrity ----------
base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = [f for h, f in (l.split(maxsplit=1) for l in base.read_text().splitlines()) if (PLATFORM / f).exists() and hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest() != h]
    record('integrity: hub and toolkit files byte-identical to the baseline apart from the D-08 and D-22 patches (index.html, sw.js)', set(changed) <= {'index.html', 'sw.js'}, changed)

# ---------- 19. Plan §5 measurements still within target ----------
r = subprocess.run([sys.executable, str(ACADEMY / 'tests' / 'e2e' / 'measure_phase10a.py'), '--label', 'phase13'], capture_output=True, text=True, timeout=600)
try:
    m = json.loads((ACADEMY / 'tests' / 'e2e' / 'out' / 'measure-phase13.json').read_text(encoding='utf-8'))
    ok = m['top_nav_items'] == 5 and m['home_height'] <= 2700 and m['assessments_screens_1440x900'] <= 4 and m['first_load_json_gzip'] <= 400_000 and m['phase_wording'] == 0 and m['empty_personal_pages'] == 0
    record('plan §5 measurements: 5 top items, home ≤ 2,700 px, assessments ≤ 4 screens, first load ≤ 0.4 MB compressed, no learner-visible "Phase", 0 empty personal pages', ok,
           {k: m[k] for k in ['top_nav_items', 'home_height', 'assessments_screens_1440x900', 'first_load_json_gzip', 'phase_wording', 'empty_personal_pages']})
except Exception as e:
    record('plan §5 measurements', False, f'{e} {r.stderr[-300:]}')

passed = sum(r['ok'] for r in results)
(EVID / 'e2e-phase13-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
