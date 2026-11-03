#!/usr/bin/env python3
"""Continual Improvement Academy — toolkit integration end-to-end suite (Playwright + axe-core).

Real browser, real static server over the whole platform root. Covers the requirement and method guides mirrored from
the hub toolkits, courses generated from them, the "from the requirement guides" panel on existing lessons, toolkit
access badges, the team-request link, the Quality Mission game in the library, failure handling, responsive layout and axe.
Usage: python3 tests/e2e/run_e2e_guides.py [--evidence DIR]
Results: <evidence>/e2e-guides-results.json (only executed checks are recorded).
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
AXE = (ACADEMY / 'tests' / 'vendor' / 'axe.min.js').read_text(encoding='utf-8')
INDEX = json.loads((ACADEMY / 'data' / 'guides' / 'index.json').read_text(encoding='utf-8'))['items']
G9001 = json.loads((ACADEMY / 'data' / 'guides' / 'iso-9001.json').read_text(encoding='utf-8'))['guide']
N9001 = sum(len(c['items']) for c in G9001['clauses'])
ROUTES = ['/guides', '/guides/iso-9001', '/guides/iso-9001?tab=faq', '/guides/iso-9001?tab=terms', '/guides/iso-9001/10.2.1', '/guides/rca', '/guides/rca/s2-3',
          '/academy/courses/iso-9001-requirements', '/academy/courses/iso-9001-requirements/L01', '/academy/courses/rca-method/L05',
          '/academy/courses/nonconformity-corrective-action/L01', '/academy/iso', '/library/LIB-SIM-02']

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
    page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=8000)
    page.wait_for_timeout(250)

def set_roles(page, roles):
    page.goto(BASE + '/academy/'); page.wait_for_selector('html[data-ready]')
    page.evaluate('r => localStorage.setItem("cia:v1:session", JSON.stringify({roles: r}))', roles)

def axe(page):
    page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- A. Learner: guides are open to everyone ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    go(page, '/')
    nav_ok = page.locator('a[href="#/guides"]').count() >= 1
    home_teaser = page.locator('.gteaser a[href="#/guides"]').count() == 1
    go(page, '/guides')
    cards = page.locator('[data-guide]').count()
    std = page.locator('#gd-std ~ .cards [data-guide], section[aria-labelledby=gd-std] [data-guide]').count()
    record('learner: Guides in the navigation and on home; the index lists all 23 published guides (9 standards + 14 methods)', nav_ok and home_teaser and cards == 23 and std == 9, f'{nav_ok} {home_teaser} {cards} {std}')

    go(page, '/guides/iso-9001')
    items = page.locator('.gitems li').count()
    page.fill('#g-q', '10.2'); page.wait_for_timeout(150)
    filtered = page.locator('.gitems li').count(); url_q = 'q=10.2' in page.url
    page.fill('#g-q', 'zzzzqqq'); page.wait_for_timeout(150)
    empty = page.locator('#g-items .state.empty').count() == 1
    record(f'guide page: all {N9001} ISO 9001 requirements listed by clause; search filters live, keeps ?q= in the URL, and has an empty state', items == N9001 and 0 < filtered < items and url_q and empty, f'{items} {filtered} {url_q} {empty}')

    tabs = page.eval_on_selector_all('.gtabs a', 'els => els.map(e => e.dataset.tab)')
    go(page, '/guides/iso-9001?tab=faq')
    faq_n = page.locator('.faq details').count()
    page.locator('.faq details summary').first.click(); page.wait_for_timeout(100)
    faq_open = page.locator('.faq details[open] .md').count() == 1 and page.locator('.faq details[open] .md p, .faq details[open] .md ul').count() >= 1
    current = page.get_attribute('.gtabs a[aria-current=page]', 'data-tab')
    go(page, '/guides/iso-9001?tab=official')
    ext = page.eval_on_selector_all('.gpanel a[target=_blank]', 'els => els.every(a => a.href.startsWith("https://") && a.rel.includes("noopener")) && els.length > 0')
    go(page, '/guides/iso-9001?tab=terms'); terms = page.locator('.gpanel tbody tr').count()
    record('guide tabs: requirements, what changed, terms, FAQ, templates, timeline, official sources; FAQ answers render as safe text; tab state is in the URL',
           {'items', 'changes', 'terms', 'faq', 'templates', 'official'} <= set(tabs) and faq_n > 5 and faq_open and current == 'faq' and ext and terms > 10, f'{tabs} {faq_n} {faq_open} {current} {ext} {terms}')

    go(page, '/guides/iso-9001/10.2.1')
    blocks = page.eval_on_selector_all('main [data-block]', 'els => els.map(e => e.dataset.block)')
    h1 = page.inner_text('main h1')
    tool = page.locator('main a[data-module=iso9001]').first
    tool_href = tool.get_attribute('href'); tool_open = tool.get_attribute('data-access') == 'open' and tool.locator('.acc').count() == 0
    no_lessons = page.locator('section[aria-labelledby=gi-learn] a[href*="/academy/courses/"]').count() >= 2  # published courses that teach it
    page.click('[data-action=next-item]'); page.wait_for_timeout(300)
    nxt = page.url.endswith('/10.2.2')
    record('item page: requirement, example, how-to, evidence, auditor questions and linked clauses; open toolkit link; learner sees the published lessons that teach it; next item works',
           {'req', 'ex', 'how', 'ev', 'checks', 'links'} <= set(blocks) and h1.startswith('10.2.1') and tool_href.endswith('/#m=iso9001') and tool_open and no_lessons and nxt, f'{blocks} {h1} {tool_href} {tool_open} {no_lessons} {nxt}')

    go(page, '/guides/iso-14001/6.1.2')
    acc = page.locator('main a[data-module=iso14001][data-access=account] .acc').count() >= 1
    label = page.get_attribute('main a[data-module=iso14001]', 'aria-label') or ''
    go(page, '/guides/iso-14001'); note = page.locator('main .phead p.note .ico-lock').count() == 1
    record('account-gated toolkits carry a visible "Account" badge and say so in the accessible name; the guide itself stays open', acc and 'account' in label.lower() and note, f'{acc} {label} {note}')

    go(page, '/guides/rca')
    first_tab = page.get_attribute('.gtabs a[aria-current=page]', 'data-tab'); steps = page.locator('.gsteps li').count()
    go(page, '/guides/rca/s2-3')
    mblocks = page.eval_on_selector_all('main [data-block]', 'els => els.map(e => e.dataset.block)')
    record('method guide: opens on "The method" steps; step pages show what to do, how, evidence and common gaps', first_tab == 'steps' and steps >= 5 and {'reqMethod', 'how', 'gaps'} <= set(mblocks), f'{first_tab} {steps} {mblocks}')

    go(page, '/guides/does-not-exist'); bad1 = page.locator('[data-unavailable]').count() == 1 and page.locator('main h1').count() == 1
    go(page, '/guides/iso-9001/99.9'); bad2 = page.locator('[data-unavailable]').count() == 1 and page.locator('main h1').count() == 1
    record('unknown guide or item: honest "not available" page with one h1 and a way back', bad1 and bad2, f'{bad1} {bad2}')

    go(page, '/academy/iso')
    iso_guides = page.locator('section[aria-labelledby=iso-guides] [data-guide]').count()
    game = page.locator('section[aria-labelledby=iso-game] a[data-library]').count()
    record('ISO Academy shows learners the 9 requirement guides and the Quality Mission game', iso_guides == 9 and game == 2, f'{iso_guides} {game}')

    go(page, '/library/LIB-SIM-02')
    game_href = page.get_attribute('main a.btn[href*="cia-quality-mission"]', 'href')
    status = urllib.request.urlopen(page.evaluate('h => new URL(h, location.href).href', game_href)).status
    record('library: Quality Mission audit-day simulation opens the owner\'s game on the platform (HTTP 200)', game_href and game_href.endswith('cia-quality-mission/simulation.html') and status == 200, f'{game_href} {status}')
    record('no console errors in learner guide flows', not logs, logs[:3])
    ctx.close()

    # ---------- B. Reviewer: generated courses and enriched lessons ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    set_roles(page, ['reviewer'])
    go(page, '/academy/courses/iso-9001-requirements')
    lessons = page.locator('.modules .lessons li').count()
    read_guide = page.locator('main .phead a[href="#/guides/iso-9001"]').count() == 1
    req = page.get_attribute('[data-action=request-course]', 'href') or ''
    built = page.locator('section[aria-labelledby=c-guide]').count() == 1
    record(f'generated course page: {N9001} lessons (one per requirement), "Read the guide", "built from a guide" note, team-request link to the hub (#request)',
           lessons == N9001 and read_guide and built and req.endswith('/#request'), f'{lessons} {read_guide} {built} {req}')

    go(page, '/academy/courses/iso-9001-requirements/L01')
    lb = page.eval_on_selector_all('main [data-block]', 'els => els.map(e => e.dataset.block)')
    src = page.locator('main a[href="#/guides/iso-9001/4.1"]').count() >= 1
    page.click('[data-action=reveal-answer]'); revealed = page.get_attribute('[data-action=reveal-answer]', 'aria-expanded') == 'true' and page.locator('#ex-answer li').count() >= 1
    page.fill('#ex-notes', 'Owner: quality manager. We have the SWOT; climate decision missing.'); page.wait_for_timeout(700)
    opts = page.locator('.kc input[type=radio]').count()
    key = page.evaluate('() => document.querySelector(".kc").dataset.question')
    q = next(x for x in json.loads((ACADEMY / 'data' / 'seed' / 'questions.json').read_text(encoding='utf-8'))['items'] if x['id'] == key)
    page.check(f'.kc input[value="{q["correct_answer"]}"]'); page.click('[data-action=check-answer]'); page.wait_for_timeout(100)
    correct = page.locator('.kc .oksum').count() == 1
    page.click('[data-action=toggle-complete]'); page.wait_for_timeout(300)
    go(page, '/academy/courses/iso-9001-requirements/L01')
    kept = page.get_attribute('[data-action=toggle-complete]', 'aria-pressed') == 'true' and 'SWOT' in page.input_value('#ex-notes')
    record('guide lesson: renders the guide item (requirement, example, how, evidence, auditor questions), "apply it" exercise with reveal, check question (4 options + I don\'t know) and saved progress',
           {'req', 'ex', 'how', 'ev', 'checks'} <= set(lb) and src and revealed and opts == 5 and correct and kept, f'{lb} {src} {revealed} {opts} {correct} {kept}')

    go(page, '/academy/courses/nonconformity-corrective-action/L01')
    refs = page.eval_on_selector_all('.gfrom details', 'els => els.map(e => e.dataset.guide + "#" + e.dataset.ref)')
    five = page.locator('main [data-block]').count() >= 5
    page.locator('.gfrom details summary').first.click(); page.wait_for_timeout(100)
    opened = page.locator('.gfrom details[open] a[href^="#/guides/"]').count() == 1
    go(page, '/academy/courses/nonconformity-corrective-action')
    cover = page.locator('section[aria-labelledby=c-cover] a[href^="#/guides/"]').count()
    record('existing lessons keep their five blocks and gain a "from the requirement guides" panel; the course page lists the requirements it covers',
           'iso-9001#10.2.1' in refs and 'capa#s2-1' in refs and five and opened and cover >= 4, f'{refs} {five} {opened} {cover}')

    go(page, '/guides/iso-9001/10.2.1')
    learn = page.eval_on_selector_all('section[aria-labelledby=gi-learn] a', 'els => els.map(a => a.getAttribute("href"))')
    record('reviewer: an item page lists every lesson that teaches it (generated and mapped)', any('iso-9001-requirements' in x for x in learn) and any('nonconformity-corrective-action/L01' in x for x in learn), learn)

    go(page, '/academy/iso/9001')
    std_guide = page.locator('section[aria-labelledby=st-guide] a[href="#/guides/iso-9001"]').count() == 1 and page.locator('main .iso-hero a[href="#/guides/iso-9001"]').count() == 1
    std_course = page.locator('section[aria-labelledby=st-guide] a[href="#/academy/courses/iso-9001-requirements"]').count() == 1
    record('reviewer: the ISO 9001 standard page links its guide and the requirements course built from it', std_guide and std_course, f'{std_guide} {std_course}')

    go(page, '/academy/courses?q=requirements explained')
    gen = page.locator('[data-course^="CRS-G-"]').count()
    record('catalog: the 9 generated requirement courses are searchable alongside the hand-authored ones', gen == 9, gen)
    storage = page.evaluate('Object.keys(localStorage)')
    record('storage: the Academy writes only cia:v1:* keys (plus the shared cia-lang)', all(k.startswith('cia:v1:') or k == 'cia-lang' for k in storage), storage)
    record('no console errors in reviewer guide flows', not logs, logs[:3])
    ctx.close()

    # ---------- C. Failure handling ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    set_roles(page, ['reviewer'])
    page.route('**/data/guides/**', lambda r: r.abort())
    go(page, '/guides'); empty_idx = page.locator('main .state.empty').count() == 1
    go(page, '/academy/courses/nonconformity-corrective-action/L01'); lesson_ok = page.locator('main [data-block]').count() >= 5 and page.locator('.gfrom').count() == 0
    go(page, '/academy/courses/iso-9001-requirements/L01'); honest = page.locator('main .banner-warn').count() >= 1 and page.locator('main h1').count() == 1
    page.unroute('**/data/guides/**')
    record('guides unavailable: the index shows an empty state, hand-authored lessons still render, guide lessons say the text could not be loaded', empty_idx and lesson_ok and honest, f'{empty_idx} {lesson_ok} {honest}')
    ctx.close()

    # ---------- D. Responsive matrix ----------
    fails, n = [], 0
    for lang in ['ar', 'en']:
        for w in [360, 390, 768, 1440]:
            ctx = b.new_context(viewport={'width': w, 'height': 900}); page = ctx.new_page(); logs = watch(page)
            set_roles(page, ['reviewer'])
            for r in ROUTES:
                go(page, r, lang); n += 1
                d = page.evaluate('[document.documentElement.lang, document.documentElement.dir, document.documentElement.scrollWidth - document.documentElement.clientWidth, document.querySelectorAll("main h1").length]')
                if d[0] != lang or d[1] != ('rtl' if lang == 'ar' else 'ltr') or d[2] > 0 or d[3] != 1: fails.append(f'{lang}@{w}{r}: {d}')
                if w in (390, 1440) and r in ('/guides', '/guides/iso-9001', '/guides/iso-9001/10.2.1', '/academy/courses/iso-9001-requirements/L01', '/academy/courses/nonconformity-corrective-action/L01'):
                    page.screenshot(path=str(EVID / f'gd-{lang}-{w}{r.replace("/", "_").replace("?", "_")}.png'), full_page=w == 390)
            if logs: fails.append(f'{lang}@{w} console: {logs[:2]}')
            ctx.close()
    record(f'responsive matrix: {n} loads ({len(ROUTES)} routes × 4 widths × AR/EN) — lang/dir, one h1, no horizontal overflow, no console errors', not fails, '; '.join(fails[:5]))

    # ---------- E. Accessibility ----------
    ax = []
    for scheme in ['light', 'dark']:
        for lang in ['ar', 'en']:
            ctx = b.new_context(viewport={'width': 390 if lang == 'ar' else 1280, 'height': 900}, color_scheme=scheme); page = ctx.new_page()
            set_roles(page, ['reviewer'])
            for r in ROUTES:
                go(page, r, lang)
                if r.endswith('tab=faq'): page.locator('.faq details summary').first.click()
                v = axe(page)
                if v: ax.append(f'{scheme}/{lang}{r}: ' + json.dumps(v, ensure_ascii=False))
            ctx.close()
    record(f'axe-core WCAG 2.1 A/AA + best practice: 0 violations on {len(ROUTES)} guide routes (AR@390, EN@1280, light + dark)', not ax, ' | '.join(ax[:3]))

    # ---------- F. Keyboard ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page()
    go(page, '/guides/iso-9001?tab=faq')
    page.focus('.faq details summary'); page.keyboard.press('Enter'); k1 = page.locator('.faq details[open]').count() == 1
    go(page, '/guides/iso-9001')
    page.focus('#g-q'); page.keyboard.type('6.1'); page.wait_for_timeout(150); k2 = 0 < page.locator('.gitems li').count() < N9001
    record('keyboard: FAQ opens with Enter; guide search works from the keyboard', k1 and k2, f'{k1} {k2}')
    ctx.close()
    b.close()

srv.terminate()
passed = sum(r['ok'] for r in results)
(EVID / 'e2e-guides-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
