#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 1 end-to-end suite (platform shell; Phase 7 flows are in run_e2e_phase7.py) (Playwright + axe-core).
Serves the whole platform root (hub + modules + academy) and checks:
routes x widths x languages, console, overflow, dir/lang, axe a11y, keyboard nav,
links, persistence, export/import, role guard, components, hub/toolkit regression,
storage isolation. Usage: python3 tests/e2e/run_e2e.py [--evidence DIR]
"""
import json, sys, os, time, socket, subprocess, pathlib, hashlib, urllib.request, re
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
AXE = (ACADEMY / 'tests' / 'vendor' / 'axe.min.js').read_text(encoding='utf-8')
ROUTES = ['/', '/me', '/settings', '/about-governance', '/nope-404']
WIDTHS = [360, 390, 768, 1024, 1280, 1440]

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
    results.append({'test': name, 'ok': bool(ok), 'detail': detail})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''))

EXTERNAL_BLOCKED = []  # third-party requests blocked by the sandbox egress proxy (hub's Google Fonts) — environment, not app, errors

def watch(page):
    logs = []
    def on_console(m):
        if m.type not in ('error', 'warning'): return
        url = (m.location or {}).get('url', '')
        if url and not url.startswith(BASE):
            EXTERNAL_BLOCKED.append(url); return
        logs.append(f'{m.type}: {m.text}')
    page.on('console', on_console)
    page.on('requestfailed', lambda r: EXTERNAL_BLOCKED.append(r.url) if not r.url.startswith(BASE) else logs.append('requestfailed: ' + r.url))
    page.on('response', lambda r: EXTERNAL_BLOCKED.append(r.url) if (r.status >= 400 and not r.url.startswith(BASE)) else None)
    page.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
    return logs

def open_route(page, route, lang=None, extra=''):
    q = f'?lang={lang}{extra}' if lang else (('?' + extra.lstrip('&')) if extra else '')
    page.goto(f'{BASE}/academy/{q}#{route}')
    page.wait_for_selector('html[data-ready]')
    page.wait_for_timeout(250)

def axe(page, context='main'):
    page.add_script_tag(content=AXE)
    r = page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes.slice(0,3).map(n => n.target.join(' '))})) }")
    return r

with sync_playwright() as p:
    b = p.chromium.launch()

    # 1. Routes x widths x languages: load, dir/lang, console clean, no overflow
    matrix_fail = []
    count = 0
    for lang in ['ar', 'en']:
        for w in WIDTHS:
            ctx = b.new_context(viewport={'width': w, 'height': 900}); page = ctx.new_page(); logs = watch(page)
            for r in ROUTES:
                open_route(page, r, lang); count += 1
                d = page.evaluate('[document.documentElement.lang, document.documentElement.dir, document.documentElement.scrollWidth - document.documentElement.clientWidth, document.querySelector("main")?.dataset.route]')
                exp_dir = 'rtl' if lang == 'ar' else 'ltr'
                if d[0] != lang or d[1] != exp_dir or d[2] > 0: matrix_fail.append(f'{lang}@{w}{r}: {d}')
                if r == '/nope-404' and d[3] != '404': matrix_fail.append(f'{lang}@{w}{r}: 404 not rendered')
            if logs: matrix_fail.append(f'{lang}@{w} console: {logs}')
            if w in (390, 1440):
                for r in ['/', '/about-governance']:
                    open_route(page, r, lang); page.screenshot(path=str(EVID / f'{lang}-{w}{r.replace("/", "_") or "_home"}.png'), full_page=True)
            ctx.close()
    record(f'route matrix: {count} loads (5 routes x 6 widths x 2 languages) — dir/lang, zero console errors, no horizontal overflow', not matrix_fail, '; '.join(matrix_fail[:5]))

    # 2. Dark mode render + overflow
    ctx = b.new_context(viewport={'width': 390, 'height': 900}, color_scheme='dark'); page = ctx.new_page(); logs = watch(page)
    open_route(page, '/', 'ar'); page.screenshot(path=str(EVID / 'ar-390-dark_home.png'), full_page=True)
    bg = page.evaluate('getComputedStyle(document.body).backgroundColor')
    record('dark mode follows device preference', bg == 'rgb(11, 30, 61)' and not logs, bg)
    ctx.close()

    # 3. Accessibility (axe) on every route, both languages, desktop + mobile, light + dark
    ax_fail = []
    for scheme in ['light', 'dark']:
        for w in [390, 1280]:
            for lang in ['ar', 'en']:
                ctx = b.new_context(viewport={'width': w, 'height': 900}, color_scheme=scheme); page = ctx.new_page()
                for r in ROUTES:
                    open_route(page, r, lang)
                    v = axe(page)
                    if v: ax_fail.append(f'{scheme}/{w}/{lang}{r}: ' + json.dumps(v, ensure_ascii=False))
                # drawer open state
                open_route(page, '/', lang); page.click('[data-action=menu]'); v = axe(page)
                if v: ax_fail.append(f'{scheme}/{w}/{lang} drawer: ' + json.dumps(v, ensure_ascii=False))
                ctx.close()
    record('axe-core WCAG 2.1 A/AA + best practice: 0 violations (5 routes + open menu, AR/EN, 390/1280, light/dark)', not ax_fail, ' | '.join(ax_fail[:3]))

    # 4. Keyboard navigation of the menu
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    open_route(page, '/', 'en')
    page.keyboard.press('Tab'); skip = page.evaluate('document.activeElement.className')
    page.focus('[data-action=menu]'); page.keyboard.press('Enter')
    opened = page.get_attribute('[data-action=menu]', 'aria-expanded') == 'true' and page.is_visible('#nav-drawer')
    page.keyboard.press('Tab'); first = page.evaluate('document.activeElement.closest("#nav-drawer") !== null')
    page.keyboard.press('Escape')
    closed = page.is_hidden('#nav-drawer') and page.evaluate('document.activeElement.dataset.action') == 'menu'
    record('keyboard: skip link first, menu opens with Enter, focus enters drawer, Escape closes and returns focus', skip == 'skip' and opened and first and closed, f'{skip} {opened} {first} {closed}')

    # 5. Coming entries: not links, aria-disabled, focusable tooltip; every entry present
    page.click('[data-action=menu]')
    coming = page.eval_on_selector_all('#nav-drawer [data-nav].coming', 'els => els.map(e => ({id: e.dataset.nav, tag: e.tagName, dis: e.getAttribute("aria-disabled"), tip: !!document.getElementById(e.getAttribute("aria-describedby")), href: e.getAttribute("href")}))')
    ok = coming and all(c['tag'] == 'SPAN' and c['dis'] == 'true' and c['tip'] and c['href'] is None for c in coming)
    record(f'navigation: {len(coming)} future-phase entries are disabled, labelled with their phase, never dead links', ok, str(coming[:2]))
    learner_ids = page.eval_on_selector_all('#nav-drawer [data-nav]', 'els => els.map(e => e.dataset.nav)')
    record('role-aware nav: learner does not see Admin / Company Portal / Component library', not {'admin', 'company', 'components'} & set(learner_ids), str(learner_ids))
    ctx.close()

    # 6. Link check across all routes (hash routes resolve; platform links return 200)
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page()
    hrefs = set()
    for r in ROUTES[:-1]:
        open_route(page, r, 'en'); page.click('[data-action=menu]')
        hrefs |= set(page.eval_on_selector_all('a[href]', 'els => els.map(e => e.href)'))
    bad = []
    for h in sorted(hrefs):
        if h.startswith(BASE + '/academy/') and '#/' in h:
            page.goto(h); page.wait_for_selector('html[data-ready]'); page.wait_for_timeout(150)
            if page.evaluate('document.querySelector("main").dataset.route') == '404': bad.append(h)
        elif h.startswith(BASE):
            url = h.split('#')[0]
            try:
                if urllib.request.urlopen(url).status != 200: bad.append(h)
            except Exception as e: bad.append(f'{h} {e}')
        elif not h.startswith(BASE + '/academy/'):
            bad.append('external? ' + h)
    record(f'link check: {len(hrefs)} unique links, 0 broken', not bad, str(bad[:5]))
    ctx.close()

    # 7. Persistence: theme, digits, language shared with the hub
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    open_route(page, '/settings')
    page.check('input[name=theme][value=dark]'); page.select_option('select[name=digits]', 'arab')
    page.reload(); page.wait_for_selector('html[data-ready]'); page.wait_for_timeout(200)
    theme = page.evaluate('document.documentElement.dataset.theme'); dig = page.input_value('select[name=digits]')
    page.check('input[name=locale][value=en]'); page.wait_for_timeout(200)
    shared = page.evaluate('localStorage.getItem("cia-lang")'); dir_now = page.evaluate('document.documentElement.dir')
    page.goto(BASE + '/'); page.wait_for_timeout(600)
    hub_lang = page.evaluate('document.documentElement.lang')
    page.evaluate('localStorage.setItem("cia-lang","ar")'); open_route(page, '/')
    back = page.evaluate('document.documentElement.dir')
    record('persistence: theme + digits survive reload; language choice is shared with the hub both ways', theme == 'dark' and dig == 'arab' and shared == 'en' and dir_now == 'ltr' and hub_lang == 'en' and back == 'rtl', f'{theme} {dig} {shared} {dir_now} {hub_lang} {back}')
    digits_ok = re.search('[٠-٩]', page.inner_text('.journey')) and not re.search('[0-9]', page.inner_text('.journey'))
    record('Eastern Arabic digit preference applied to rendered numbers', bool(digits_ok))

    # 8. Export / clear / import round-trip + invalid import
    open_route(page, '/settings', 'en')
    with page.expect_download() as dl: page.click('[data-action=export]')
    path = EVID / 'export-sample.json'; dl.value.save_as(str(path)); exported = json.loads(path.read_text())
    page.click('[data-action=clear]'); page.wait_for_selector('dialog[open]')
    page.get_by_role('button', name='Delete data').click(); page.wait_for_timeout(300)
    after_clear = page.evaluate('Object.keys(localStorage).filter(k => k.startsWith("cia:v1:local:")).length')
    page.set_input_files('#import-file', str(path)); page.wait_for_timeout(400)
    after_import = page.evaluate('Object.keys(localStorage).filter(k => k.startsWith("cia:v1:local:")).length')
    bad_file = EVID / 'bad-import.json'; bad_file.write_text('{"app":"other","schema":1,"collections":{}}')
    page.set_input_files('#import-file', str(bad_file)); page.wait_for_timeout(300)
    rejected = 'rejected' in page.inner_text('.toasts')
    nj = EVID / 'not-json.json'; nj.write_text('not json at all')
    page.set_input_files('#import-file', str(nj)); page.wait_for_timeout(300)
    rejected2 = 'not valid JSON' in page.inner_text('.toasts')
    record('export -> delete -> import round-trips; wrong-app and non-JSON files are rejected', exported['app'] == 'cia-academy' and 'prefs' in exported['collections'] and after_clear == 0 and after_import == len(exported['collections']) and rejected and rejected2,
           f'{list(exported["collections"])} {after_clear} {after_import} {rejected} {rejected2}')
    record('no console errors during settings/data flows', not logs, str(logs[:3]))
    ctx.close()

    # 9. Storage isolation: other toolkits' data untouched after full Academy use
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page()
    page.goto(BASE + '/academy/'); page.wait_for_selector('html[data-ready]')
    seed = {'iso9001tk:v1': '{"keep":1}', 'iso9001_clause4': 'x', 'audit-center:v1': '{"a":1}', 'cia-workspace:v1': '{"w":1}'}
    page.evaluate('s => Object.entries(s).forEach(([k,v]) => localStorage.setItem(k,v))', seed)
    open_route(page, '/settings', 'en'); page.check('input[name=theme][value=light]')
    page.click('[data-action=clear]'); page.get_by_role('button', name='Delete data').click(); page.wait_for_timeout(300)
    for r in ROUTES: open_route(page, r, 'ar')
    after = page.evaluate('s => Object.keys(s).map(k => localStorage.getItem(k))', seed)
    record('storage isolation: toolkit stores (iso9001tk, iso9001_*, audit-center, cia-workspace) untouched', after == list(seed.values()), str(after))
    ctx.close()

    # 10. Role guard + dev role switcher; production mode has no switcher
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    open_route(page, '/dev/components', 'en')
    forbidden = page.evaluate('document.querySelector("[data-status]")?.dataset.status')
    open_route(page, '/settings', 'en')
    page.check('input[name=dev-role][value=admin]'); page.click('[data-action=apply-roles]'); page.wait_for_timeout(200)
    open_route(page, '/dev/components', 'en')
    allowed = page.is_visible('[data-showcase=c-form]')
    page.click('[data-action=menu]'); admin_nav = page.eval_on_selector_all('#nav-drawer [data-nav]', 'els => els.map(e => e.dataset.nav)')
    open_route(page, '/about-governance', 'en'); registry_rows = page.locator('section[aria-labelledby=rg-h] tbody tr').count()
    open_route(page, '/settings', 'en', '&dev=0'); prod_switcher = page.locator('[data-dev=roles]').count()
    open_route(page, '/dev/components', 'en', '&dev=0'); prod_forbidden = page.evaluate('document.querySelector("[data-status]")?.dataset.status')
    record('role guard: learner gets 403 on component library; dev admin gets it + admin nav + review register; production has no role switcher', forbidden == '403' and allowed and 'admin' in admin_nav and 'company' in admin_nav and registry_rows == 14 and prod_switcher == 0 and prod_forbidden == '403',
           f'{forbidden} {allowed} {registry_rows} {prod_switcher} {prod_forbidden}')

    # 11. Component showcase interactions (admin), AR + EN
    comp_fail = []
    for lang in ['en', 'ar']:
        open_route(page, '/dev/components', lang)
        page.click('[data-form=demo] button[type=submit]'); page.wait_for_timeout(150)
        invalid = page.locator('[data-form=demo] [aria-invalid=true]').count()
        focused_invalid = page.evaluate('document.activeElement.getAttribute("aria-invalid") === "true" || document.activeElement.closest("fieldset")?.getAttribute("aria-invalid") === "true"')
        page.fill('input[name=fullName]', 'ab'); page.fill('input[name=email]', 'bad@'); page.click('[data-form=demo] button[type=submit]')
        msgs = page.locator('[data-form=demo] .err').all_inner_texts()
        page.fill('input[name=fullName]', 'Modather Salama'); page.fill('input[name=email]', 'm@example.com')
        page.select_option('select[name=role]', 'aud'); page.check('input[name=level][value=high]'); page.check('input[name=agree]')
        page.click('[data-form=demo] button[type=submit]'); page.wait_for_timeout(100)
        valid = page.locator('.oksum').count() == 1 and page.locator('[data-form=demo] [aria-invalid=true]').count() == 0
        if not (invalid >= 5 and focused_invalid and len([m for m in msgs if m]) >= 4 and valid): comp_fail.append(f'{lang} form {invalid} {focused_invalid} {msgs} {valid}')
        # tabs: arrow key respects direction
        tab0 = page.locator('[data-showcase=c-tabs] [role=tab]').first; tab0.focus()
        page.keyboard.press('ArrowLeft' if lang == 'ar' else 'ArrowRight')
        sel = page.evaluate('document.activeElement.getAttribute("aria-selected") === "true" && document.activeElement.id.endsWith("t1")')
        page.keyboard.press('End'); end = page.evaluate('document.activeElement.id.endsWith("t2")')
        if not (sel and end): comp_fail.append(f'{lang} tabs {sel} {end}')
        # dialog focus management
        page.click('[data-action=open-dialog]'); inside = page.evaluate('!!document.activeElement.closest("dialog")')
        page.keyboard.press('Escape'); page.wait_for_timeout(100)
        returned = page.evaluate('document.activeElement.dataset.action') == 'open-dialog' and page.locator('dialog').count() == 0
        if not (inside and returned): comp_fail.append(f'{lang} dialog {inside} {returned}')
        page.click('[data-action=toast]'); toast_ok = page.locator('.toasts[role=status] .toast').count() == 1
        if not toast_ok: comp_fail.append(f'{lang} toast')
        page.screenshot(path=str(EVID / f'{lang}-1280_components.png'), full_page=True)
        for scheme in ['light', 'dark']:
            page.emulate_media(color_scheme=scheme); open_route(page, '/dev/components', lang); v = axe(page)
            if v: comp_fail.append(f'{lang}/{scheme} axe: ' + json.dumps(v, ensure_ascii=False))
        page.emulate_media(color_scheme='light')
    record('component library: validation (required/email/min-length, aria-invalid, focus first error), RTL-aware tabs, dialog focus return, toast, axe 0 violations light/dark — AR + EN', not comp_fail, '; '.join(comp_fail))
    record('no console errors in admin flows', not logs, str(logs[:3]))
    ctx.close()

    # 12. Error states with working retry (non-critical tool list; governance data region)
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page()
    def failing_once(pattern):
        st = {'n': 0}
        def h(route):
            if st['n'] == 0: st['n'] += 1; route.fulfill(status=500, body='boom')
            else: route.continue_()
        page.route(pattern, h)
    failing_once('**/data/seed/platform-modules.json*')
    page.goto(BASE + '/academy/?lang=en&dev=0&t=1#/'); page.wait_for_selector('html[data-ready]'); page.wait_for_timeout(300)
    booted = page.evaluate('document.documentElement.dataset.ready') == 'true'
    tools_err = page.locator('section[aria-labelledby=tools-h] .state.error').count() == 1
    page.locator('section[aria-labelledby=tools-h]').get_by_role('button', name='Try again').click(); page.wait_for_timeout(400)
    n_tools = len(json.loads((ACADEMY / 'data/seed/platform-modules.json').read_text())['items'])
    tools_ok = page.locator('section[aria-labelledby=tools-h] a.tlink').count() == n_tools
    record(f'tool list failure does not block the Academy; retry recovers all {n_tools} tools', booted and tools_err and tools_ok, f'{booted} {tools_err} {tools_ok}')
    failing_once('**/data/seed/build-status.json*')
    page.goto(BASE + '/academy/?lang=en&dev=0&t=2#/about-governance'); page.wait_for_selector('html[data-ready]'); page.wait_for_timeout(300)
    had_err = page.locator('.state.error').count() == 1
    page.get_by_role('button', name='Try again').click(); page.wait_for_timeout(300)
    recovered = page.locator('[data-metric=build-completion]').count() == 1 and page.locator('.state.error').count() == 0
    record('governance data region: error state with working retry', had_err and recovered, f'{had_err} {recovered}')
    page.route('**/data/i18n/ar.json*', lambda r: r.fulfill(status=500, body='x'))
    page.goto(BASE + '/academy/?lang=ar&dev=0&t=3#/'); page.wait_for_selector('html[data-ready]'); page.wait_for_timeout(200)
    record('critical boot failure shows a bilingual reload message instead of a blank page', page.evaluate('document.documentElement.dataset.ready') == 'error' and page.locator('main .state.error button').count() == 1)
    ctx.close()

    # 13. Regression: hub + all 17 toolkits
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    page.goto(BASE + '/'); page.wait_for_timeout(800)
    train = page.get_attribute('#trainBtn', 'href'); aria = page.get_attribute('#trainBtn', 'aria-disabled')
    hub_ok = any(x in page.title() for x in ('Continual Improvement Academy', 'أكاديمية التحسين المستمر')) and train == './academy/' and aria is None  # live hub title is Arabic-first since Oct 2026
    record('hub loads and its Training button now points to the Academy (D-08)', hub_ok and not [l for l in logs if 'pageerror' in l], f'{train} {aria} {logs[:2]}')
    mods = json.loads((ACADEMY / 'data/seed/platform-modules.json').read_text())['items']
    mod_fail = []
    for m in mods:
        mp = b.new_page(viewport={'width': 1280, 'height': 900}); ml = []
        mp.on('pageerror', lambda e, ml=ml: ml.append(str(e)))
        mp.goto(BASE + '/' + m['file'].replace('../', ''), wait_until='load'); mp.wait_for_timeout(300)
        if ml or not mp.title(): mod_fail.append(f'{m["id"]}: {ml[:1]}')
        mp.close()
    page.goto(BASE + '/#m=iso9001'); page.wait_for_timeout(800)
    overlay = page.evaluate('document.getElementById("modOverlay").classList.contains("on") && document.getElementById("modFrame").src.endsWith("iso9001.html")')
    record(f'regression: all {len(mods)} toolkits load with 0 page errors; hub deep link #m=iso9001 opens the toolkit', not mod_fail and overlay, str(mod_fail))
    ctx.close()
    b.close()

srv.terminate()
# 14. File integrity vs baseline
base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = []
    for line in base.read_text().splitlines():
        h, f = line.split(maxsplit=1)
        cur = hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest()
        if cur != h: changed.append(f)
    # Owner-approved hub changes: index.html (D-08, one line) and sw.js (D-22, network-first for /academy/). Each must match its patch exactly.
    patched = {}
    for f, patch in (('index.html', 'hub-training-url.patch'), ('sw.js', 'sw-academy-network-first.patch')):
        if f in changed:
            r = subprocess.run(['patch', '-R', '--dry-run', '-p1', '-s', '-i', str(PLATFORM.parent / 'patches' / patch)], cwd=PLATFORM, capture_output=True, text=True)
            patched[f] = r.returncode == 0
    others = [f for f in changed if f not in ('index.html', 'sw.js')]
    record(f'integrity: all {sum(1 for _ in base.read_text().splitlines()) - 2} other baseline toolkit/asset files byte-identical; hub changes are exactly the D-08 and D-22 patches',
           not others and set(changed) == {'index.html', 'sw.js'} and all(patched.values()), f'changed={changed} patch_ok={patched}')

passed = sum(r['ok'] for r in results)
(EVID / 'e2e-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results, 'environment_blocked_external': sorted(set(EXTERNAL_BLOCKED))}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
