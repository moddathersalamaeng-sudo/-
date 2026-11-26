#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 17 suite (daily review cards). Playwright + axe-core.
Deck fills from missed assessment questions; session: answer → the card turns → feedback, right / wrong options marked,
next date; Leitner scheduling persisted; day log and streak; "I don't know" counts as wrong; empty answer blocked; keyboard 1–4;
practice set per academy (10 published, no duplicates); remove; missed lesson check adds a card; review never changes scores;
responsive 390/768/1280/1920 × AR/EN; axe light + dark; console; CSP.
Usage: python3 tests/e2e/run_e2e_phase17.py [--evidence DIR]
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request, hashlib, datetime
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
QS = [q for q in json.loads((ACADEMY / 'data' / 'seed' / 'questions.json').read_text(encoding='utf-8'))['items'] if q['governance']['content_status'] == 'published' and q['type'] == 'single_choice']
QD = {q['id']: q for q in QS}
COURSES = [c for c in json.loads((ACADEMY / 'data' / 'seed' / 'courses.json').read_text(encoding='utf-8'))['items'] if c['governance']['content_status'] == 'published']

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
CSP_INIT = "window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))"
def watch(page, logs):
    page.add_init_script(CSP_INIT)
    page.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
def settle(page):
    page.wait_for_selector('html[data-ready]'); page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=20000); page.wait_for_timeout(250)
def go(page, route, lang='en'):
    page.goto(f'{BASE}/academy/?lang={lang}&dev=0#{route}'); page.reload(); settle(page)
def axe(page):
    page.add_script_tag(url=BASE + '/academy/tests/vendor/axe.min.js')
    return page.evaluate("async () => { const r = await axe.run(document, { preload: false, runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")
def put(page, key, items): page.evaluate('([k, v]) => localStorage.setItem(k, JSON.stringify({ schema: 1, updatedAt: new Date().toISOString(), items: v }))', [f'cia:v1:local:{key}', items])
def store(page, key):
    raw = page.evaluate(f'localStorage.getItem("cia:v1:local:{key}")'); return (json.loads(raw) if raw else {'items': []})['items']
def today(page): return page.evaluate('(() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })()')
def plus(day, n): return (datetime.date.fromisoformat(day) + datetime.timedelta(days=n)).isoformat()
def answer(page, right):
    cid = page.get_attribute('.rv-card', 'data-card'); q = QD[cid]
    opt = q['correct_answer'] if right else next(o['id'] for o in q['options'] if o['id'] != q['correct_answer'])
    page.click(f'.rv-card [data-option="{opt}"]'); page.click('[data-action=rv-check]'); page.wait_for_selector('.rv-back:not([hidden])'); return cid

MISSED = [q['id'] for q in QS if q['category'] == 'quality'][:5]
ATT = [{'id': 'att-1', 'assessment_id': 'ASM-TEST', 'attempt_no': 1, 'submitted_at': '2026-11-20T08:00:00Z', 'score': 40, 'passed': False,
        'detail': [{'question_id': q, 'auto': True, 'correct': False, 'unknown': i == 4} for i, q in enumerate(MISSED)] + [{'question_id': QS[0]['id'], 'auto': True, 'correct': True}]}]
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = []; watch(page, logs)
        go(page, '/my?tab=review')
        empty = page.locator('[data-deck=empty]').count() == 1
        record('empty deck: an explained empty state and the practice-set form (no dead end)', empty and page.locator('[data-action=rv-add-set]').count() == 1)
        put(page, 'assessment_attempts', ATT); go(page, '/my?tab=review', 'ar'); T = today(page)
        cards = store(page, 'review_cards')
        record('the deck fills itself from missed assessment questions (wrong and "I don\'t know"), not from right answers; all due today, box 1',
               sorted(c['id'] for c in cards) == sorted(MISSED) and all(c['box'] == 1 and c['due'] == T and c['source']['kind'] == 'assessment' for c in cards)
               and page.get_attribute('.rv', 'data-due') == '5', [len(cards), page.get_attribute('.rv', 'data-due')])
        page.screenshot(path=str(EVID / 'p17-overview-ar.png'), full_page=True)
        go(page, '/my?tab=review', 'ar'); again = len(store(page, 'review_cards'))
        record('opening the tab again adds nothing twice', again == 5, again)
        # ---------- session
        page.click('[data-action=rv-start]'); page.wait_for_selector('.rv-card')
        page.click('[data-action=rv-check]'); blocked = page.locator('.rv-back:not([hidden])').count() == 0 and page.inner_text('.rv-card .err') != ''
        page.keyboard.press('Tab'); page.focus('.rv-card input'); page.keyboard.press('2'); key_ok = page.evaluate('document.querySelectorAll(".rv-card input")[1].checked')
        page.click('.rv-card .choice-unknown input'); page.click('[data-action=rv-check]'); page.wait_for_selector('.rv-back:not([hidden])')
        c1 = page.get_attribute('.rv-card', 'data-card'); v1 = page.get_attribute('[data-result]', 'data-result')
        marked = page.locator('.rv-choice.is-correct').count() == 1 and page.get_attribute('.rv-card .is-turned, .rv-card.is-turned', 'class') is not None
        record('session: empty answer blocked with a message; number keys pick options; "I don\'t know" counts as wrong; the card turns and marks the correct option',
               blocked and key_ok and v1 == 'wrong' and marked, [blocked, key_ok, v1, marked])
        page.click('[data-action=rv-next]'); c2 = answer(page, True); v2 = page.get_attribute('[data-result]', 'data-result')
        page.locator('.rv-session').screenshot(path=str(EVID / 'p17-card-right-ar.png'))
        page.click('[data-action=rv-next]'); c3 = answer(page, False)
        page.locator('.rv-session').screenshot(path=str(EVID / 'p17-card-wrong-ar.png'))
        page.click('[data-action=rv-next]'); c4 = answer(page, True); page.click('[data-action=rv-next]'); c5 = answer(page, True)
        page.click('[data-action=rv-next]'); page.wait_for_selector('[data-session=done]')
        done = (page.get_attribute('.rv-donebig', 'data-right'), page.get_attribute('.rv-donebig', 'data-total'))
        cards = {c['id']: c for c in store(page, 'review_cards')}; log = store(page, 'review_log')
        sched = cards[c1]['box'] == 1 and cards[c1]['due'] == plus(T, 1) and cards[c2]['box'] == 2 and cards[c2]['due'] == plus(T, 3) and cards[c3]['lapses'] == 1 and cards[c3]['due'] == plus(T, 1)
        record('scheduling (Leitner): right → box 2 in 3 days; wrong or unknown → box 1 tomorrow; end screen 3 / 5; day log written', v2 == 'right' and sched and done == ('3', '5')
               and log == [{'id': T, 'reviewed': 5, 'correct': 3}], [done, {k: (v['box'], v['due']) for k, v in cards.items()}, log])
        page.click('[data-action=rv-back]'); settle(page)
        record('after the session: nothing due today, the next review date and a 1-day streak are shown', page.locator('[data-deck=clear]').count() == 1 and page.get_attribute('.rv', 'data-streak') == '1')
        # mastering path: a box-5 card answered right → mastered, 90 days
        cards[c2].update({'box': 5, 'due': T}); put(page, 'review_cards', list(cards.values())); go(page, '/my?tab=review', 'en')
        page.click('[data-action=rv-start]'); page.wait_for_selector('.rv-card'); answer(page, True)
        m = {c['id']: c for c in store(page, 'review_cards')}[c2]
        record('a right answer in box 5 marks the card mastered and schedules a check in 90 days', m['mastered'] and m['due'] == plus(T, 90), (m['box'], m['due']))
        # streak across days
        put(page, 'review_log', [{'id': plus(T, -2), 'reviewed': 4, 'correct': 2}, {'id': plus(T, -1), 'reviewed': 3, 'correct': 3}, {'id': T, 'reviewed': 1, 'correct': 1}])
        go(page, '/my?tab=review', 'en'); st = page.get_attribute('.rv', 'data-streak'); strip_on = page.locator('.rv-strip li.on').count()
        record('streak counts consecutive days (3) and the 14-day strip lights those days', st == '3' and strip_on == 3, [st, strip_on])
        # a new miss resets a card
        ATT2 = ATT + [{'id': 'att-2', 'assessment_id': 'ASM-TEST', 'attempt_no': 2, 'submitted_at': plus(T, 0) + 'T23:59:00Z', 'score': 50, 'passed': False, 'detail': [{'question_id': c2, 'auto': True, 'correct': False}]}]
        put(page, 'assessment_attempts', ATT2); go(page, '/my?tab=review', 'en'); r = {c['id']: c for c in store(page, 'review_cards')}[c2]
        record('missing a mastered question again in a later assessment sends its card back to box 1, due today', r['box'] == 1 and not r['mastered'] and r['due'] == T, (r['box'], r['due'], r['mastered']))
        # ---------- practice set and remove
        page.select_option('#rv-academy', 'quality'); page.click('[data-action=rv-add-set]'); page.wait_for_timeout(800); settle(page)
        deck = store(page, 'review_cards'); prac = [c for c in deck if c['source']['kind'] == 'practice']
        page.select_option('#rv-academy', 'quality'); page.click('[data-action=rv-add-set]'); page.wait_for_timeout(800); settle(page)
        deck2 = store(page, 'review_cards')
        cat_ok = all(QD.get(c['id'], {}).get('category') == 'quality' for c in prac)
        record('practice set: 10 published Quality questions added (due today), a second set adds 10 others — no duplicates', len(prac) == 10 and cat_ok and len(deck2) == len(deck) + 10 and len({c['id'] for c in deck2}) == len(deck2), [len(prac), cat_ok, len(deck), len(deck2)])
        page.click('.rv-deck summary'); n0 = int(page.get_attribute('.rv-deck', 'data-cards')); gone = page.get_attribute('[data-card-row]', 'data-card-row')
        page.locator('[data-action=rv-remove]').first.click(); page.wait_for_timeout(500); settle(page); go(page, '/my?tab=review', 'en')
        n1 = int(page.get_attribute('.rv-deck', 'data-cards')); still = page.locator(f'[data-card-row="{gone}"]').count()
        record('a card can be removed from the deck, and an old miss does not bring it back on the next visit', n1 == n0 - 1 and still == 0, [n0, n1, still])
        # ---------- review never changes scores
        att_after = store(page, 'assessment_attempts')
        record('review answers never change assessment records (attempts unchanged)', att_after == ATT2)
        # ---------- lesson check miss → card
        lesson = None
        for c in COURSES:
            for m_ in c['modules']:
                for l in m_['lessons']:
                    if l.get('check_question_id') in QD and l['check_question_id'] not in {x['id'] for x in deck2}: lesson = (c, l); break
                if lesson: break
            if lesson: break
        c, l = lesson; key = l['id'][len(c['id']) + 1:] if l['id'].startswith(c['id'] + '-') else l['id']; q = QD[l['check_question_id']]
        go(page, f'/academy/courses/{c["slug"]}/{key}', 'en')
        wrong = next(o['id'] for o in q['options'] if o['id'] != q['correct_answer'])
        page.click(f'.kc input[value="{wrong}"]'); page.click('[data-action=check-answer]'); page.wait_for_selector('[data-rv-added]', timeout=5000)
        lc = {x['id']: x for x in store(page, 'review_cards')}.get(q['id'])
        record('a missed lesson check adds a card (source: lesson) and says so with a link to the daily review', lc is not None and lc['source']['kind'] == 'lesson' and lc['source']['ref'] == l['id'], lc and lc['source'])
        go(page, '/my', 'en'); link = page.locator('[data-action=open-review]').count() == 1
        record('My space → Progress links to the daily review; the tab sits second', link and page.eval_on_selector_all('[role=tab]', 'els => els.map(e => e.dataset.tab)')[1:2] == ['review'])
        # ---------- responsive, axe, console, CSP
        over, ax = [], []
        for w in (390, 768, 1280, 1920):
            for lang in ('ar', 'en'):
                page.set_viewport_size({'width': w, 'height': 900}); go(page, '/my?tab=review', lang)
                if page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1'): over.append(f'overview@{w}/{lang}')
                if page.locator('[data-action=rv-start]').count():
                    page.click('[data-action=rv-start]'); page.wait_for_selector('.rv-card'); answer(page, False)
                    if page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1'): over.append(f'card@{w}/{lang}')
                    if w in (390, 1280) and lang == 'en':
                        for theme in ('light', 'dark'):
                            page.evaluate(f'document.documentElement.dataset.theme = "{theme}"'); page.wait_for_timeout(80); ax += [f'card@{w}/{theme}: {v["id"]} {v["t"][:1]}' for v in axe(page)]
                    if w == 390 and lang == 'ar': page.screenshot(path=str(EVID / 'p17-phone-ar.png'), full_page=True)
                if w in (390, 1280) and lang == 'en':
                    go(page, '/my?tab=review', lang)
                    for theme in ('light', 'dark'):
                        page.evaluate(f'document.documentElement.dataset.theme = "{theme}"'); page.wait_for_timeout(80); ax += [f'overview@{w}/{theme}: {v["id"]} {v["t"][:1]}' for v in axe(page)]
        record('responsive: overview and card at 390 / 768 / 1280 / 1920 × AR / EN — no horizontal overflow', not over, over[:6])
        record('accessibility: axe (WCAG 2.1 A/AA + best practice) on the overview and a turned card, light and dark — 0 violations', not ax, ax[:6])
        record('no console errors or warnings; Content-Security-Policy: 0 violations', not logs and not page.evaluate('window.__csp.length'), logs[:4])
        b.close()
finally:
    srv.terminate()
base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = [f for h, f in (l.split(maxsplit=1) for l in base.read_text().splitlines()) if (PLATFORM / f).exists() and hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest() != h]
    record('integrity: hub and toolkit files byte-identical to the baseline apart from the D-08 and D-22 patches', set(changed) <= {'index.html', 'sw.js'}, changed)
r = subprocess.run([sys.executable, str(ACADEMY / 'tests' / 'e2e' / 'measure_phase10a.py'), '--label', 'phase17'], capture_output=True, text=True, timeout=900)
try:
    m = json.loads((ACADEMY / 'tests' / 'e2e' / 'out' / 'measure-phase17.json').read_text(encoding='utf-8'))
    record('plan §5 measurements: 5 top items, home ≤ 2,700 px, assessments ≤ 4 screens, first load ≤ 0.4 MB compressed, no learner-visible "Phase", 0 empty personal pages',
           m['top_nav_items'] == 5 and m['home_height'] <= 2700 and m['assessments_screens_1440x900'] <= 4 and m['first_load_json_gzip'] <= 400_000 and m['phase_wording'] == 0 and m['empty_personal_pages'] == 0,
           {k: m[k] for k in ['top_nav_items', 'home_height', 'assessments_screens_1440x900', 'first_load_json_gzip', 'phase_wording', 'empty_personal_pages']})
except Exception as e:
    record('plan §5 measurements', False, f'{e} {r.stderr[-300:]}')
passed = sum(x['ok'] for x in results)
(EVID / 'e2e-phase17-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
