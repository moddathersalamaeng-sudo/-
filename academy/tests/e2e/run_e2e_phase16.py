#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 16 suite (certificates with serial, seal and QR verification). Playwright + axe-core + OpenCV.
A. Static site (no accounts): certificate per course (own academy colours and seal), QR code decoded from the screen opens the
   verification page → "details intact"; edited link → "changed"; other serial → "mismatch"; serial form catches typos; serial only →
   "missing"; name correction keeps the serial and moves the seal; Phase 11 certificate still opens; print layout; responsive; axe; CSP.
B. With accounts (CIA_TEST_PG): the certificate is written to the Academy register; the QR page says "Issued by the Academy";
   the serial alone verifies; an administrator withdraws it → "Withdrawn".
Usage: [CIA_TEST_PG=postgres://…] python3 tests/e2e/run_e2e_phase16.py [--evidence DIR]
"""
import json, os, sys, time, socket, shutil, subprocess, pathlib, tempfile, urllib.request, urllib.parse, base64, hashlib
import numpy as np, cv2
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
COURSES = {c['id']: c for c in json.loads((ACADEMY / 'data' / 'seed' / 'courses.json').read_text(encoding='utf-8'))['items']}

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
    page.wait_for_selector('html[data-ready]'); page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=20000); page.wait_for_timeout(300)
def go(page, base, route, lang='en'):
    page.goto(f'{base}/academy/?lang={lang}&dev=0#{route}'); page.reload(); settle(page)
def axe(page, base):
    page.add_script_tag(url=base + '/academy/tests/vendor/axe.min.js')
    return page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")
def put(page, key, items, uid='local'):
    page.evaluate('([k, v]) => localStorage.setItem(k, JSON.stringify({ schema: 1, updatedAt: new Date().toISOString(), items: v }))', [f'cia:v1:{uid}:{key}', items])
def done(cids, score=91):
    prog, att = [], []
    for cid in cids:
        c = COURSES[cid]; prog.append({'id': cid, 'completed_lessons': [l['id'] for m in c['modules'] for l in m['lessons']], 'exercise_notes': {}, 'updated_at': '2026-11-18T08:00:00Z'})
        att.append({'id': 'a-' + cid, 'assessment_id': c['assessments']['final'], 'attempt_no': 1, 'submitted_at': '2026-11-18T08:00:00Z', 'answers': {}, 'score': score, 'passed': True, 'pending_review': 0, 'unknown': 0, 'competency_breakdown': {}, 'domain_breakdown': {}, 'detail': []})
    return prog, att
def decode_qr(page):
    png = page.locator('.cx-qrlink').screenshot()
    img = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_COLOR)
    img = cv2.copyMakeBorder(img, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    txt, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    return txt
def make(page, name):
    page.fill('#cert-name', name); page.click('[data-action=make-certificate]'); page.wait_for_selector('.cx-sheet'); page.wait_for_timeout(250)
def payload(href): return urllib.parse.parse_qs(href.split('#', 1)[1].split('?', 1)[1])['p'][0]
def edit_payload(p, **kw):
    raw = json.loads(base64.urlsafe_b64decode(p + '=' * (-len(p) % 4)).decode())
    for k, v in kw.items(): raw[{'n': 2, 'g': 5}[k]] = v
    return base64.urlsafe_b64encode(json.dumps(raw, ensure_ascii=False).encode()).decode().rstrip('=')

SAMPLE = ['CRS-ISO-AUD', 'CRS-PM-RISK', 'CRS-Q-CAPA', 'CRS-EX-RADAR']
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 1280, 'height': 1000}, device_scale_factor=2); page = ctx.new_page(); logs = []; watch(page, logs)
        go(page, BASE, '/')
        prog, att = done(SAMPLE); put(page, 'course_progress', prog); put(page, 'assessment_attempts', att)
        # ---------- A1. one design per course, QR decoded from the screen
        info = []
        for i, cid in enumerate(SAMPLE):
            lang = 'ar' if i % 2 == 0 else 'en'
            go(page, BASE, f'/certificate/{COURSES[cid]["slug"]}', lang)
            empty = page.locator('.cx-empty').count() == 1
            make(page, 'مدثر سلامه' if lang == 'ar' else 'Modather Salama')
            s = page.locator('.cx-sheet')
            info.append({'cid': cid, 'empty': empty, 'academy': s.get_attribute('data-academy'), 'serial': s.get_attribute('data-cert-number'), 'seal': s.get_attribute('data-seal'),
                         'ring': page.get_attribute('.cx-seal g path', 'd')[:200], 'href': s.get_attribute('data-verify-href'), 'qr': decode_qr(page),
                         'disc': 'not a professional certification' in page.inner_text('[data-cert-disclaimer]') or 'ليست شهادة مهنية' in page.inner_text('[data-cert-disclaimer]'),
                         'hl': page.locator('.cx-hl li').count(), 'score': '91' in page.inner_text('.cx-facts')})
            if i == 0: page.locator('.cx-sheet').screenshot(path=str(EVID / 'p16-certificate-iso-ar.png'))
        record('four courses in four academies: each certificate has its academy colours (iso / pmi / quality / excellence), its own serial and its own seal drawing; module highlights, final score and the disclaimer are printed',
               [x['academy'] for x in info] == ['iso', 'pmi', 'quality', 'excellence'] and len({x['serial'] for x in info}) == 4 and len({x['ring'] for x in info}) == 4
               and all(x['empty'] and x['disc'] and x['hl'] >= 2 and x['score'] and x['serial'].startswith('CIA-C-') for x in info), [(x['academy'], x['serial'], x['hl'], x['score']) for x in info])
        record('the QR code, decoded from a screenshot with OpenCV, is exactly the certificate\'s verification link (all four)',
               all(x['qr'] and x['qr'] == x['href'] and '#/verify/' + x['serial'] in x['qr'] for x in info), [(x['qr'][:60], x['href'][:60]) for x in info])
        # ---------- A2. verification page
        first = info[0]
        page.goto(first['qr']); page.reload(); settle(page)
        v_ok = (page.get_attribute('.vf-page', 'data-verdict'), page.get_attribute('[data-check=seal]', 'data-state'), page.get_attribute('[data-check=register]', 'data-state'), page.locator('[data-check=device]').count())
        name_shown = 'مدثر سلامه' in page.inner_text('.vf-card')
        page.screenshot(path=str(EVID / 'p16-verify-intact.png'), full_page=True)
        record('scanning opens the verification page: "details intact", seal check passed, register reported as not switched on, "made on this device", name and course shown',
               v_ok == ('intact', 'intact', 'off', 1) and name_shown, v_ok)
        pl = payload(first['href']); verdicts = {}
        for label, url in [('altered-name', f'#/verify/{first["serial"]}?p={edit_payload(pl, n="Someone Else")}'), ('altered-score', f'#/verify/{first["serial"]}?p={edit_payload(pl, g=100)}'),
                           ('mismatch', f'#/verify/{info[1]["serial"]}?p={pl}'), ('missing', f'#/verify/{first["serial"]}'), ('malformed', f'#/verify/{first["serial"]}?p=%%%')]:
            page.goto(f'{BASE}/academy/?lang=en&dev=0{url}'); page.reload(); settle(page); verdicts[label] = page.get_attribute('.vf-page', 'data-verdict')
        record('a changed name or score → "changed after it was made"; the same details under another serial → "changed"; serial only → "missing"; broken link → "malformed"',
               verdicts == {'altered-name': 'altered', 'altered-score': 'altered', 'mismatch': 'altered', 'missing': 'missing', 'malformed': 'malformed'}, verdicts)
        go(page, BASE, '/verify', 'ar')
        bad = first['serial'][:-1] + ('1' if first['serial'][-1] != '1' else '2')
        page.fill('#vf-serial', bad); page.click('[data-action=verify-serial]'); page.wait_for_timeout(200)
        typo = page.get_attribute('#vf-serial', 'aria-invalid') == 'true' and page.inner_text('#vf-msg') != '' and '/verify/' not in page.url
        page.fill('#vf-serial', 'hello'); page.click('[data-action=verify-serial]'); page.wait_for_timeout(200); mal = page.inner_text('#vf-msg') != ''
        page.fill('#vf-serial', first['serial'].lower()); page.click('[data-action=verify-serial]'); settle(page); went = page.url.endswith('/verify/' + first['serial'])
        record('serial form: a one-character typo is caught by the check character before any lookup; a non-CIA serial is refused; a correct serial (any case) opens its page',
               typo and mal and went, [typo, mal, went, page.url[-40:]])
        # ---------- A3. name correction, persistence, Phase 11 certificate, copy / open links
        go(page, BASE, f'/certificate/{COURSES["CRS-ISO-AUD"]["slug"]}', 'en')
        make(page, 'Modather M. Salama'); s2 = (page.get_attribute('.cx-sheet', 'data-cert-number'), page.get_attribute('.cx-sheet', 'data-seal'))
        page.reload(); settle(page); s3 = (page.get_attribute('.cx-sheet', 'data-cert-number'), page.get_attribute('.cx-sheet', 'data-seal'), page.input_value('#cert-name'))
        record('correcting the name keeps the serial, gives a new seal code and survives a reload', s2[0] == first['serial'] and s2[1] != first['seal'] and s3 == (s2[0], s2[1], 'Modather M. Salama'), [first['serial'], first['seal'], s2, s3])
        old = page.evaluate('JSON.parse(localStorage.getItem("cia:v1:local:certificates")).items.find(x => x.id === "CRS-PM-RISK")')
        old.update({'number': 'CIA-C-PMRISK-0ABCDEF', 'schema': 'cia.completion-certificate.v1'}); [old.pop(k, None) for k in ('seal', 'version', 'highlights', 'score', 'academy')]
        items = page.evaluate('JSON.parse(localStorage.getItem("cia:v1:local:certificates")).items'); items = [old if x['id'] == 'CRS-PM-RISK' else x for x in items]; put(page, 'certificates', items)
        go(page, BASE, f'/certificate/{COURSES["CRS-PM-RISK"]["slug"]}', 'en'); legacy_shown = page.get_attribute('.cx-sheet', 'data-cert-number') == 'CIA-C-PMRISK-0ABCDEF'
        make(page, 'Modather Salama'); legacy_kept = page.get_attribute('.cx-sheet', 'data-cert-number') == 'CIA-C-PMRISK-0ABCDEF'
        href = page.get_attribute('.cx-sheet', 'data-verify-href'); page.goto(href); page.reload(); settle(page); legacy_v = page.get_attribute('.vf-page', 'data-verdict')
        record('a certificate made before Phase 16 (old number) still opens, keeps its number when updated, and its new QR verifies as intact', legacy_shown and legacy_kept and legacy_v == 'intact', [legacy_shown, legacy_kept, legacy_v])
        go(page, BASE, f'/certificate/{COURSES["CRS-Q-CAPA"]["slug"]}', 'en')
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE)
        page.click('[data-action=copy-verify-link]'); page.wait_for_timeout(200); clip = page.evaluate('navigator.clipboard.readText()')
        page.click('[data-action=open-verify]'); settle(page); opened = page.get_attribute('.vf-page', 'data-verdict')
        record('"Copy verification link" copies the QR link; "Open the verification page" opens it (intact)', clip == info[2]['href'] and opened == 'intact', [clip[:50], opened])
        go(page, BASE, f'/certificate/{COURSES["CRS-ISO-101"]["slug"]}', 'en'); not_el = page.locator('[data-cert=not-eligible]').count() == 1 and page.locator('.cx-sheet').count() == 0
        record('an unfinished course shows no certificate (unchanged rule)', not_el)
        # ---------- A4. print layout
        go(page, BASE, f'/certificate/{COURSES["CRS-ISO-AUD"]["slug"]}', 'ar'); page.emulate_media(media='print'); page.wait_for_timeout(200)
        pr = page.evaluate('''() => { const s = document.querySelector('.cx-sheet').getBoundingClientRect(); const hdr = document.querySelector('header.hdr, .hdr, header');
              return { w: Math.round(s.width), h: Math.round(s.height), hidden: getComputedStyle(document.querySelector('.cert-page .phead')).visibility, qr: getComputedStyle(document.querySelector('.cx-qrlink')).visibility }; }''')
        page.pdf(path=str(EVID / 'p16-certificate.pdf'), landscape=True, format='A4', print_background=True, prefer_css_page_size=True)
        page.emulate_media(media='screen')
        record('print: the sheet alone, A4 landscape (297 × 210 mm), everything else hidden; a PDF is produced', abs(pr['w'] - 1123) <= 3 and abs(pr['h'] - 794) <= 3 and pr['hidden'] == 'hidden' and pr['qr'] == 'visible'
               and (EVID / 'p16-certificate.pdf').stat().st_size > 20000, pr)
        # ---------- A5. responsive, axe, console, CSP
        over, ax, qrs = [], [], []
        for w in (390, 768, 1280, 1920):
            for lang in ('ar', 'en'):
                page.set_viewport_size({'width': w, 'height': 900})
                for route in (f'/certificate/{COURSES["CRS-EX-RADAR"]["slug"]}', '/verify/' + first['serial'] + '?p=' + pl, '/verify'):
                    go(page, BASE, route, lang)
                    if page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1'): over.append(f'{route[:20]}@{w}/{lang}')
                    if page.locator('main h1').count() != 1: over.append(f'{route[:20]}@{w}/{lang} h1')
                    if route.startswith('/certificate') and w == 390: qrs.append(page.get_attribute('.cx-qrlink', 'href') == page.get_attribute('.cx-sheet', 'data-verify-href') and page.locator('.cx-qrlink').bounding_box()['width'] >= 30)
                    if w in (390, 1280) and lang == 'en':
                        for theme in ('light', 'dark'):
                            page.evaluate(f'document.documentElement.dataset.theme = "{theme}"'); page.wait_for_timeout(80)
                            ax += [f'{route[:20]}@{w}/{theme}: {v["id"]} {v["t"][:1]}' for v in axe(page, BASE)]
        record('responsive: certificate and verification pages at 390 / 768 / 1280 / 1920 × AR / EN — no overflow, one h1; on a 390 px phone the QR code is a tappable link to the same verification page', not over and qrs and all(qrs), [over[:5], qrs])
        record('accessibility: axe (WCAG 2.1 A/AA + best practice) on certificate, verification and serial-form pages, light and dark — 0 violations', not ax, ax[:6])
        record('no console errors or warnings; Content-Security-Policy: 0 violations', not logs and not page.evaluate('window.__csp.length'), logs[:4])
        ctx.close()

        # ---------- B. with accounts: the Academy register
        if os.environ.get('CIA_TEST_PG'):
            TMP = pathlib.Path(tempfile.mkdtemp(prefix='cia-e2e16-')); COPY = TMP / 'platform'
            shutil.copytree(PLATFORM, COPY, ignore=shutil.ignore_patterns('node_modules', 'out', '.git', 'hub-tests'))
            be = subprocess.Popen(['node', str(ACADEMY / 'tests' / 'server' / 'e2e_backend.mjs'), str(COPY), str(COPY / 'academy' / 'data')], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=ACADEMY)
            BB = json.loads(be.stdout.readline())['base']
            def cmd(line): be.stdin.write(line + '\n'); be.stdin.flush(); return be.stdout.readline().strip()
            def api(method, path, token=None, body=None):
                req = urllib.request.Request(BB + '/api/v1' + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                             headers={**({'Content-Type': 'application/json'} if body is not None else {}), **({'Authorization': 'Bearer ' + token} if token else {})})
                try:
                    with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'null')
                except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'null')
            try:
                st, su = api('POST', '/auth/signup', body={'email': 'learner16@example.test', 'password': 'correct horse battery', 'display_name': 'Learner Sixteen'})
                tok, uid = su['token'], su['user']['id']
                prog, att = done(['CRS-ISO-AUD'], score=86)
                api('PUT', '/collections/course_progress', tok, {'items': prog}); api('PUT', '/collections/assessment_attempts', tok, {'items': att})
                bctx = b.new_context(viewport={'width': 1280, 'height': 1000}, device_scale_factor=2); bp = bctx.new_page(); blogs = []; watch(bp, blogs)
                bp.goto(BB + '/academy/?lang=ar#/'); settle(bp)
                bp.evaluate('([t, u]) => localStorage.setItem("cia:v1:auth", JSON.stringify({ token: t, user: u }))', [tok, su['user']])
                bp.goto(BB + f'/academy/?lang=ar#/certificate/{COURSES["CRS-ISO-AUD"]["slug"]}'); bp.reload(); settle(bp)
                bp.wait_for_function('() => document.querySelector("[data-cert=eligible]")', timeout=20000)
                make(bp, 'متعلم ستة عشر'); bp.wait_for_timeout(500)
                reg_line = bp.get_attribute('.cx-regline', 'data-registered'); serial = bp.get_attribute('.cx-sheet', 'data-cert-number'); qr = decode_qr(bp)
                rows = json.loads(cmd(f"sql select serial, name, status from cia.certificates where user_id = '{uid}'"))
                bp.screenshot(path=str(EVID / 'p16-registered.png'), full_page=False)
                record('signed in: making the certificate writes it to the Academy register (same serial on the sheet and in the database); the page says it is recorded',
                       reg_line == 'true' and rows == [{'serial': serial, 'name': 'متعلم ستة عشر', 'status': 'valid'}], [reg_line, serial, rows])
                bp.goto(qr); bp.reload(); settle(bp); r1 = (bp.get_attribute('.vf-page', 'data-verdict'), bp.get_attribute('[data-check=register]', 'data-state'))
                bp.screenshot(path=str(EVID / 'p16-verify-registered.png'), full_page=True)
                v2 = bb = bp.context.new_page(); watch(v2, blogs)
                v2.goto(BB + f'/academy/?lang=en#/verify/{serial}'); v2.reload(); settle(v2); r2 = v2.get_attribute('.vf-page', 'data-verdict')
                record('the QR page says "Issued by the Academy" (register valid); the serial alone also verifies against the register', r1 == ('registered', 'valid') and r2 == 'registered', [r1, r2])
                st2, ad = api('POST', '/auth/signup', body={'email': 'admin16@example.test', 'password': 'correct horse battery', 'display_name': 'Admin Sixteen'}); cmd(f"role {ad['user']['id']} admin")
                refused = api('POST', f'/admin/certificates/{serial}/revoke', tok, {'reason': 'self'})[0]
                done_rv = api('POST', f'/admin/certificates/{serial}/revoke', ad['token'], {'reason': 'Issued in error'})[0]
                v2.reload(); settle(v2); r3 = v2.get_attribute('.vf-page', 'data-verdict')
                record('only an administrator can withdraw a certificate (learner refused); afterwards the verification page says "Withdrawn by the Academy"', refused == 403 and done_rv == 200 and r3 == 'revoked', [refused, done_rv, r3])
                record('with accounts: no console errors; CSP 0', not blogs and not bp.evaluate('window.__csp.length'), blogs[:4])
                bctx.close()
            finally:
                try: cmd('quit')
                except Exception: pass
                be.wait(timeout=20); shutil.rmtree(TMP, ignore_errors=True)
        else:
            print('NOTE: part B (Academy register) skipped — CIA_TEST_PG not set')
        b.close()
finally:
    srv.terminate()

base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = [f for h, f in (l.split(maxsplit=1) for l in base.read_text().splitlines()) if (PLATFORM / f).exists() and hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest() != h]
    record('integrity: hub and toolkit files byte-identical to the baseline apart from the D-08 and D-22 patches', set(changed) <= {'index.html', 'sw.js'}, changed)
r = subprocess.run([sys.executable, str(ACADEMY / 'tests' / 'e2e' / 'measure_phase10a.py'), '--label', 'phase16'], capture_output=True, text=True, timeout=900)
try:
    m = json.loads((ACADEMY / 'tests' / 'e2e' / 'out' / 'measure-phase16.json').read_text(encoding='utf-8'))
    record('plan §5 measurements: 5 top items, home ≤ 2,700 px, assessments ≤ 4 screens, first load ≤ 0.4 MB compressed, no learner-visible "Phase", 0 empty personal pages',
           m['top_nav_items'] == 5 and m['home_height'] <= 2700 and m['assessments_screens_1440x900'] <= 4 and m['first_load_json_gzip'] <= 400_000 and m['phase_wording'] == 0 and m['empty_personal_pages'] == 0,
           {k: m[k] for k in ['top_nav_items', 'home_height', 'assessments_screens_1440x900', 'first_load_json_gzip', 'phase_wording', 'empty_personal_pages']})
except Exception as e:
    record('plan §5 measurements', False, f'{e} {r.stderr[-300:]}')
passed = sum(x['ok'] for x in results)
(EVID / 'e2e-phase16-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
