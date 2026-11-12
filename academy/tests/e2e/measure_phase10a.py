#!/usr/bin/env python3
"""Phase 10A — measurements of WEBSITE_IMPROVEMENT_PLAN.md §5, taken in a real browser (Playwright + Chromium).

Usage: python3 tests/e2e/measure_phase10a.py [--label before|after] [--out FILE]
Run it from any Academy build (the old Phase 10 build gives the "before" numbers). Everything is measured as a
first-time learner (production mode, ?dev=0, empty storage), Arabic, desktop 1440 px unless stated.

  top_nav_items     links/buttons in the header's main navigation (excluding brand, language, menu button)
  menu_entries      entries inside the menu drawer (links + disabled "coming" entries)
  coming_entries    "coming in Phase N" entries visible to a learner
  home_height       document height of #/ at 1440 px; home_height_390 at 390 px
  assessments_height document height of #/assessments at 1440 px
  first_load_json   JSON bytes fetched to show #/ (raw and gzip-9), first visit
  clicks_to_lesson  fewest clicks from #/ to any lesson page (breadth-first over in-Academy links, depth ≤ 4)
  empty_personal    personal pages that show only an empty state to a new visitor
  phase_wording     learner-visible "Phase N" / "المرحلة N" occurrences on the main pages
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request, gzip, re
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
LABEL = sys.argv[sys.argv.index('--label') + 1] if '--label' in sys.argv else 'now'
OUT = pathlib.Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out' / f'measure-{LABEL}.json'
OUT.parent.mkdir(parents=True, exist_ok=True)

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
PORT = free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=PLATFORM, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
BASE = f'http://127.0.0.1:{PORT}'
for _ in range(50):
    try: urllib.request.urlopen(BASE + '/academy/'); break
    except Exception: time.sleep(0.1)

def go(page, route, lang='ar'):
    page.goto(f'{BASE}/academy/?lang={lang}&dev=0#{route}')
    page.wait_for_selector('html[data-ready]')
    page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=20000)
    page.wait_for_timeout(300)

PERSONAL_OLD = ['/me', '/profile/competencies', '/recommendations', '/learning-path', '/my-library']
LESSON_RE = re.compile(r'^/academy/courses/[^/]+/[^/]+$')
m = {'label': LABEL, 'measured_at': time.strftime('%Y-%m-%d %H:%M'), 'mode': 'learner, production (?dev=0), empty storage, Arabic'}

with sync_playwright() as p:
    b = p.chromium.launch()
    # --- navigation counts
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); page = ctx.new_page()
    go(page, '/')
    m['version'] = page.evaluate('fetch("./data/config.json").then(r => r.json()).then(c => c.version)')
    m['top_nav_items'] = page.evaluate('document.querySelectorAll(".hdr .pnav a, .hdr .pnav button").length')
    page.click('[data-action=menu]'); page.wait_for_timeout(200)
    m['menu_entries'] = page.evaluate('document.querySelectorAll("#nav-drawer [data-nav]").length')
    m['coming_entries'] = page.evaluate('document.querySelectorAll("[data-nav].coming, #nav-drawer .coming").length')
    m['home_height'] = page.evaluate('document.documentElement.scrollHeight')
    m['home_screens_1440x900'] = round(m['home_height'] / 900, 2)
    go(page, '/assessments')
    m['assessments_height'] = page.evaluate('document.documentElement.scrollHeight')
    m['assessments_screens_1440x900'] = round(m['assessments_height'] / 900, 2)
    ctx.close()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}); page = ctx.new_page()
    go(page, '/'); m['home_height_390'] = page.evaluate('document.documentElement.scrollHeight')
    ctx.close()

    # --- first-load JSON (fresh context, home only)
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); page = ctx.new_page()
    urls = []
    page.on('response', lambda r: urls.append(r.url) if r.url.startswith(BASE) and r.url.split('?')[0].endswith('.json') else None)
    go(page, '/'); page.wait_for_timeout(800)
    raw = gz = 0; files = []
    for u in sorted(set(urls)):
        body = urllib.request.urlopen(u.split('?')[0]).read()
        raw += len(body); g = len(gzip.compress(body, 9)); gz += g
        files.append({'file': u.split('/academy/')[-1].split('?')[0], 'bytes': len(body), 'gzip': g})
    m['first_load_json_bytes'] = raw; m['first_load_json_gzip'] = gz; m['first_load_files'] = sorted(files, key=lambda f: -f['bytes'])
    ctx.close()

    # --- phase wording on main pages
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); page = ctx.new_page()
    pw = {}
    for r in ['/', '/academies', '/academy/iso', '/academy/pmi', '/academy/quality', '/academy/excellence', '/academy/courses', '/library', '/knowledge', '/guides', '/assessments', '/my', '/me', '/about-governance']:
        go(page, r)
        page.evaluate('() => { const b = document.querySelector("[data-action=menu]"); if (b && b.getAttribute("aria-expanded") !== "true") b.click(); }')
        txt = page.evaluate('document.body.innerText')
        n = len(re.findall(r'(Phase|المرحلة)\s*[0-9٠-٩]', txt))
        if n: pw[r] = n
    m['phase_wording'] = sum(pw.values()); m['phase_wording_by_page'] = pw

    # --- personal pages that are only an empty state for a new visitor
    empties = []
    for r in PERSONAL_OLD + ['/my', '/profile']:
        go(page, r)
        only_empty = page.evaluate('''() => { const m = document.querySelector("main"); const st = m.querySelectorAll(".state.empty").length;
            const cards = m.querySelectorAll(".card, form, a.btn-primary[href*='/academy/courses/'], a[href*='/welcome']").length; return st > 0 && cards === 0; }''')
        if only_empty: empties.append(r)
    m['empty_personal_pages'] = len(empties); m['empty_personal_list'] = empties
    ctx.close()

    # --- fewest clicks from home to a lesson (breadth-first over in-Academy hash links)
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); page = ctx.new_page()
    seen = {'/'}; frontier = ['/']; depth = 0; found = None; visited = 0
    while frontier and depth < 4 and not found:
        depth += 1; nxt = []
        for r in frontier:
            go(page, r); visited += 1
            hrefs = page.evaluate('[...document.querySelectorAll("main a[href^=\'#/\']")].map(a => a.getAttribute("href").slice(1).split("?")[0])')
            for hrf in hrefs:
                if LESSON_RE.match(hrf): found = (depth, r, hrf); break
                if hrf not in seen and not hrf.startswith('/assessments/') and len(seen) < 400: seen.add(hrf); nxt.append(hrf)
            if found: break
        frontier = nxt[:60]
    m['clicks_to_lesson'] = found[0] if found else None
    m['clicks_path'] = list(found[1:]) if found else None
    ctx.close()
    b.close()
srv.terminate()
OUT.write_text(json.dumps(m, ensure_ascii=False, indent=2))
print(json.dumps({k: v for k, v in m.items() if k not in ('first_load_files',)}, ensure_ascii=False, indent=2))
