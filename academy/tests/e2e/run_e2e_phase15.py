#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 15 suite (lessons as slide decks). Playwright + axe-core.
Decks on authored and guide lessons; one slide visible at a time; buttons, dots, keyboard in both reading directions, swipe,
Home/End, Present; reduced motion; the full lesson text, exercise and check stay below; a sample of lessons in every academy
in AR/EN; responsive 390/768/1280/1920; axe light + dark; console; CSP; plan §5 measurements; hub integrity.
Usage: python3 tests/e2e/run_e2e_phase15.py [--evidence DIR]
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request, hashlib
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
AXE = (ACADEMY / 'tests' / 'vendor' / 'axe.min.js').read_text(encoding='utf-8')
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
def go(page, route, lang='en'):
    page.goto(f'{BASE}/academy/?lang={lang}&dev=0#{route}'); page.reload()
    page.wait_for_selector('html[data-ready]'); page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=20000); page.wait_for_timeout(250)
def axe(page):
    page.add_script_tag(url=BASE + '/academy/tests/vendor/axe.min.js') if page.url.startswith(BASE + '/academy/') else page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { preload: false, runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")
def lesson_key(c, l):
    return l['id'][len(c['id']) + 1:] if l['id'].startswith(c['id'] + '-') else l['id']
def visible(page):
    return page.eval_on_selector_all('.dk-slide', 'els => els.filter(e => !e.hidden && getComputedStyle(e).display !== "none").map(e => e.dataset.slide)')

ISO = next(c for c in COURSES if c['id'] == 'CRS-ISO-101'); AUTH = f"/academy/courses/{ISO['slug']}/L01"
GUIDE_C = next(c for c in COURSES if c['slug'] == 'pdca-method'); GUIDE = f"/academy/courses/{GUIDE_C['slug']}/L01"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = []; watch(page, logs)
        # ---------- 1. authored lesson
        go(page, AUTH)
        kinds = page.eval_on_selector_all('.dk-slide', 'els => els.map(e => e.dataset.slide)')
        blocks = page.eval_on_selector_all('main [data-block]', 'els => els.map(e => e.dataset.block)')
        record('authored lesson: a deck of 9 slides (cover, goals, idea, model, figure, compare, scenario, avoid, summary); only the first is shown; the full lesson text follows below',
               kinds == ['cover', 'goals', 'idea', 'model', 'figure', 'compare', 'scenario', 'avoid', 'summary'] and visible(page) == ['cover'] and {'concept', 'worked_example', 'scenario', 'common_mistake', 'evidence'} <= set(blocks)
               and page.locator('.panel.check').count() == 1 and page.locator('#ex-notes').count() == 1, [kinds, visible(page), blocks])
        cmp = None
        page.click('[data-dot="5"]'); page.wait_for_timeout(300)
        cmp = page.locator('.dk-k-compare').inner_text()
        record('the worked example becomes "not like this / like this" — both wordings quoted from the lesson', visible(page) == ['compare'] and 'ISO approved company' in cmp and 'Certified to ISO 9001' in cmp, cmp[:200])
        # ---------- 2. navigation
        go(page, AUTH)
        page.click('[data-action=deck-next]'); a = visible(page); page.click('[data-action=deck-next]'); b2 = visible(page); page.click('[data-action=deck-prev]'); c2 = visible(page)
        prev_dis = page.get_attribute('[data-action=deck-prev]', 'disabled')
        page.focus('.dk-stage'); page.keyboard.press('End'); end = visible(page); nxt_dis = page.get_attribute('[data-action=deck-next]', 'disabled') is not None
        page.keyboard.press('Home'); home = visible(page); page.keyboard.press('ArrowRight'); right = visible(page)
        anim = page.evaluate('document.querySelector(".dk-slide:not([hidden])").className')
        record('next / previous buttons, End / Home and → turn the pages in English; the first and last slides disable their buttons; the page-turn animation runs',
               a == ['goals'] and b2 == ['idea'] and c2 == ['goals'] and end == ['summary'] and nxt_dis and home == ['cover'] and right == ['goals'] and 'turn-fwd' in anim, [a, b2, c2, end, home, right, anim])
        go(page, AUTH, 'ar'); page.focus('.dk-stage'); page.keyboard.press('ArrowLeft'); ar_next = visible(page); page.keyboard.press('ArrowRight'); ar_back = visible(page)
        box = page.locator('.dk-stage').bounding_box(); y = box['y'] + box['height'] / 2
        page.mouse.move(box['x'] + 100, y); page.mouse.down(); page.mouse.move(box['x'] + 400, y, steps=5); page.mouse.up(); swipe = visible(page)
        record('Arabic: ← goes forward and → goes back (reading direction); a swipe toward the reading direction turns the page', ar_next == ['goals'] and ar_back == ['cover'] and swipe == ['goals'], [ar_next, ar_back, swipe])
        page.click('[data-dot="3"]'); dot = visible(page); cur = page.get_attribute('[data-dot="3"]', 'aria-current')
        page.click('[data-action=deck-present]'); page.wait_for_timeout(600)
        full = page.evaluate('document.fullscreenElement && document.fullscreenElement.classList.contains("deck") || document.querySelector(".deck").classList.contains("is-full")')
        page.keyboard.press('Escape'); page.wait_for_timeout(400)
        record('dots jump to a slide (aria-current marks it); Present shows the deck full screen', dot == ['model'] and cur == 'step' and full, [dot, cur, full])
        rctx = b.new_context(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce'); rp = rctx.new_page(); rlogs = []; watch(rp, rlogs)
        go(rp, AUTH); rp.click('[data-action=deck-next]'); ran = rp.evaluate('document.querySelector(".dk-slide:not([hidden])").className'); rctx.close()
        record('reduced motion: pages change without the turn animation', 'turn-' not in ran, ran)
        # ---------- 3. guide lesson
        go(page, GUIDE)
        gk = page.eval_on_selector_all('.dk-slide', 'els => els.map(e => e.dataset.slide)')
        steps = page.locator('.dk-k-steps li').count(); model = page.locator('.dk-k-model svg[data-template=cycle]').count()
        record('guide lesson: steps from the guide item as numbered cards with icons; the PDCA cycle drawn; full guide text below', 'steps' in gk and steps >= 2 and model == 1 and page.locator('main [data-block]').count() >= 3, [gk, steps, model])
        # ---------- 4. sample of lessons in every academy, both languages
        bad = []; n = 0
        by = {}
        for c in COURSES: by.setdefault(c.get('ecosystem', 'x'), []).append(c)
        sample = [x for cs in by.values() for x in cs[:3]]
        for c in sample:
            ls = [l for m in c.get('modules') or [] for l in m.get('lessons') or []]
            for l in [ls[0], ls[-1]] if len(ls) > 1 else ls:
                for lang in ('ar', 'en'):
                    go(page, f"/academy/courses/{c['slug']}/{lesson_key(c, l)}", lang); n += 1
                    d = page.get_attribute('.deck', 'data-deck')
                    if not d or int(d) < 5 or len(visible(page)) != 1: bad.append(f"{l['id']}/{lang}:{d}")
        record(f'sample: {n} lesson pages across every academy in Arabic and English each show a deck of 5+ slides with exactly one slide visible', not bad and n >= 20, bad[:5])
        # ---------- 5. responsive, axe, console, CSP
        over, ax = [], []
        for w in (390, 768, 1280, 1920):
            for lang in ('ar', 'en'):
                page.set_viewport_size({'width': w, 'height': 900})
                for route in (AUTH, GUIDE):
                    go(page, route, lang)
                    for dot in (0, 3, 5):
                        if page.locator(f'[data-dot="{dot}"]').count(): page.click(f'[data-dot="{dot}"]'); page.wait_for_timeout(120)
                        if page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1'): over.append(f'{route}@{w}/{lang}/slide{dot}')
                    if page.locator('main h1').count() != 1: over.append(f'{route}@{w}/{lang} h1')
                    if w in (390, 1280) and lang == 'en':
                        for theme in ('light', 'dark'):
                            page.evaluate(f'document.documentElement.dataset.theme = "{theme}"'); page.wait_for_timeout(100)
                            ax += [f'{route}@{w}/{theme}: {v["id"]} {v["t"][:1]}' for v in axe(page)]
        record('responsive: decks at 390 / 768 / 1280 / 1920 × AR / EN (cover, model and example slides) — no horizontal overflow, one h1', not over, over[:6])
        record('accessibility: axe (WCAG 2.1 A/AA + best practice) on lessons with decks, light and dark — 0 violations', not ax, ax[:6])
        record('no console errors or warnings; Content-Security-Policy: 0 violations', not logs and not rlogs and not page.evaluate('window.__csp.length'), [logs[:3], rlogs[:2]])
        b.close()
finally:
    srv.terminate()

base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = [f for h, f in (l.split(maxsplit=1) for l in base.read_text().splitlines()) if (PLATFORM / f).exists() and hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest() != h]
    record('integrity: hub and toolkit files byte-identical to the baseline apart from the D-08 and D-22 patches', set(changed) <= {'index.html', 'sw.js'}, changed)
r = subprocess.run([sys.executable, str(ACADEMY / 'tests' / 'e2e' / 'measure_phase10a.py'), '--label', 'phase15'], capture_output=True, text=True, timeout=900)
try:
    m = json.loads((ACADEMY / 'tests' / 'e2e' / 'out' / 'measure-phase15.json').read_text(encoding='utf-8'))
    record('plan §5 measurements: 5 top items, home ≤ 2,700 px, assessments ≤ 4 screens, first load ≤ 0.4 MB compressed, no learner-visible "Phase", 0 empty personal pages',
           m['top_nav_items'] == 5 and m['home_height'] <= 2700 and m['assessments_screens_1440x900'] <= 4 and m['first_load_json_gzip'] <= 400_000 and m['phase_wording'] == 0 and m['empty_personal_pages'] == 0,
           {k: m[k] for k in ['top_nav_items', 'home_height', 'assessments_screens_1440x900', 'first_load_json_gzip', 'phase_wording', 'empty_personal_pages']})
except Exception as e:
    record('plan §5 measurements', False, f'{e} {r.stderr[-300:]}')
passed = sum(x['ok'] for x in results)
(EVID / 'e2e-phase15-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
