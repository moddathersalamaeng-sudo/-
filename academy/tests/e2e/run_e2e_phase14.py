#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 14 suite (accounts, server records, administration). Playwright + axe-core + PostgreSQL.

Runs a fresh database and the API (tests/server/e2e_backend.mjs) serving a temporary copy of the platform from the same origin,
so the publishing script can run on it without touching the real seed files. Needs CIA_TEST_PG (a PostgreSQL superuser URL).

Journeys: signed-out page with the backend configured (nothing sent); sign-up → previewed move of device records → second
browser context signs in and finds them; admin creates a draft → a different reviewer approves → the publishing script (pre-review,
existing decision script, rebuild) → the learner sees the change; a learner cannot open admin or another person's data (server
refuses); company administrator sees a consented share appear and disappear on withdrawal; a reviewer scores another learner's
written lab task and the learner's status changes by the existing rule; a verification-center edit shows on the certification
page; responsive 390/768/1280/1920 × AR/EN, axe light + dark, console, CSP violations = 0, no third-party request.
Usage: CIA_TEST_PG=postgres://… python3 tests/e2e/run_e2e_phase14.py [--evidence DIR]
"""
import json, os, sys, time, shutil, subprocess, pathlib, tempfile, urllib.request, hashlib
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
AXE = (ACADEMY / 'tests' / 'vendor' / 'axe.min.js').read_text(encoding='utf-8')
if not os.environ.get('CIA_TEST_PG'):
    print('SKIP: set CIA_TEST_PG to a PostgreSQL superuser URL (the Phase 14 suite needs a database).'); sys.exit(2)

# ---------- a temporary copy of the platform (the publishing step writes seed files)
TMP = pathlib.Path(tempfile.mkdtemp(prefix='cia-e2e14-'))
COPY = TMP / 'platform'
shutil.copytree(PLATFORM, COPY, ignore=shutil.ignore_patterns('node_modules', 'out', '.git', 'hub-tests'))
CA = COPY / 'academy'
SEED = lambda f: json.loads((CA / 'data' / 'seed' / f).read_text(encoding='utf-8'))['items']
LAB = next(l for l in SEED('labs.json') if l['id'] == 'LAB-AUDIT-SIM')
COURSE = next(c for c in SEED('courses.json') if c['id'] == 'CRS-ISO-101')
COMPS = [c['id'] for c in json.loads((CA / 'data' / 'seed' / 'competency' / 'competencies.json').read_text(encoding='utf-8'))['items'] if c['governance']['content_status'] == 'published']
MARK = 'CMS-E2E-MARKER'

be = subprocess.Popen(['node', str(ACADEMY / 'tests' / 'server' / 'e2e_backend.mjs'), str(COPY), str(CA / 'data')], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=ACADEMY)
BASE = json.loads(be.stdout.readline())['base']
def cmd(line):
    be.stdin.write(line + '\n'); be.stdin.flush(); return be.stdout.readline().strip()

results = []
def record(name, ok, detail=''):
    results.append({'test': name, 'ok': bool(ok), 'detail': str(detail)[:900]})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''))
requests = []
CSP_INIT = "window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));"
EXPECTED = {'on': False, 'seen': []}   # windows where a test provokes a refusal on purpose (forged role, self-approval)
def watch(page, logs):
    page.add_init_script(CSP_INIT)
    page.on('console', lambda m: (EXPECTED['seen'] if EXPECTED['on'] else logs).append(f'{m.type}: {m.text} @ {page.url.split("#")[-1][:40]} {(m.location or {}).get("url", "")[-50:]}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
    page.on('request', lambda r: requests.append(r.url))
def settle(page):
    page.wait_for_selector('html[data-ready]')
    page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=20000)
    page.wait_for_timeout(300)
def go(page, route, lang='en', reload=False):
    """Open a route; reload=True starts the app again (a hash-only change does not), which is when the device pulls the account copy."""
    page.goto(f'{BASE}/academy/?lang={lang}#{route}')
    if reload: page.reload()
    settle(page)
def axe(page):
    # Phase 14: Academy pages carry a Content-Security-Policy (script-src 'self'), so axe is loaded from the site's own origin there;
    # other pages (hub, review build) still get it inline. The assertions are unchanged.
    page.add_script_tag(url=BASE + '/academy/tests/vendor/axe.min.js') if page.url.startswith(BASE + '/academy/') else page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")
def auth(page):
    raw = page.evaluate('localStorage.getItem("cia:v1:auth")'); return json.loads(raw) if raw else None
def api(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + '/api/v1' + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={**({'Content-Type': 'application/json'} if body is not None else {}), **({'Authorization': 'Bearer ' + token} if token else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'null')
def after_reload(page, action):
    """Signing in reloads the app; wait until the old page is gone (a window marker disappears) and the new one is ready."""
    page.evaluate('window.__beforeReload = 1'); action()
    page.wait_for_function('() => window.__beforeReload === undefined && document.documentElement.dataset.ready === "true"', timeout=20000); settle(page)
def sign_up(page, name, email, pw='correct horse battery'):
    go(page, '/account'); page.fill('#su-name', name); page.fill('#su-email', email); page.fill('#su-pw', pw)
    after_reload(page, lambda: page.click('[data-action=acct-signup]'))
    return auth(page)
def sign_in(page, email, pw='correct horse battery'):
    go(page, '/account'); page.fill('#si-email', email); page.fill('#si-pw', pw)
    after_reload(page, lambda: page.click('[data-action=acct-signin]'))
    return auth(page)
def wait_sync(page):
    page.wait_for_function('() => document.documentElement.dataset.sync === "synced"', timeout=15000)
def local(page, uid, coll):
    raw = page.evaluate(f'localStorage.getItem("cia:v1:{uid}:{coll}")'); return (json.loads(raw) if raw else {'items': []})['items']

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        # ---------- 1. Signed out, backend configured: unchanged Academy, an account entry, nothing sent
        c1 = b.new_context(viewport={'width': 1280, 'height': 900}); pg1 = c1.new_page(); logs = []; watch(pg1, logs)
        go(pg1, '/')
        pg1.click('[data-action=user]'); entry = pg1.locator('[data-nav=account]').inner_text()
        api_calls = [u for u in requests if '/api/v1/' in u]
        record('signed out with a backend configured: the Academy opens as before, the account menu offers "Sign in", and nothing is sent to the API',
               'Sign in' in entry and not api_calls and pg1.evaluate('Object.keys(localStorage).every(k => k.startsWith("cia:v1:") || k === "cia-lang")'), [entry, api_calls[:3]])

        # device records made before signing in (the learner's own signed-out records)
        pg1.evaluate("""() => { const env = items => JSON.stringify({ schema: 1, updatedAt: new Date().toISOString(), items });
          localStorage.setItem('cia:v1:local:bookmarks', env([{ id: 'course:CRS-ISO-101', type: 'course', target_id: 'CRS-ISO-101', href: '#/academy/courses/iso-foundations', title: { ar: 'أساسيات', en: 'Foundations' }, saved_at: '2026-11-18T08:00:00Z' }]));
          localStorage.setItem('cia:v1:local:cpd', env([{ id: 'CPD-1', date: '2026-11-01', title: 'Workshop', category: 'workshop', hours: 6, status: 'self_declared' }]));
          localStorage.setItem('cia:v1:local:review_decisions', env([{ id: 'd1' }])); }""")

        # ---------- 2. Sign up → previewed move → apply
        A = sign_up(pg1, 'Learner One', 'learner.one@example.test')
        on_move = pg1.evaluate('location.hash').startswith('#/account/move')
        pg1.wait_for_selector('[data-move-plan]')
        plan_n = int(pg1.get_attribute('[data-move-plan]', 'data-move-plan')); skipped = pg1.get_attribute('[data-move-skipped]', 'data-move-skipped') or ''
        pg1.click('[data-action=apply-move]'); pg1.wait_for_selector('[data-move-result=ok]')
        added = int(pg1.get_attribute('[data-move-result]', 'data-added'))
        st, srv_bm = api('GET', '/collections/bookmarks', A['token'])
        record('sign-up → the move preview lists the device records (device-only screens not moved) → applying moves them into the account',
               A and on_move and plan_n == 2 and added == 2 and 'review_decisions' in skipped and srv_bm['items'][0]['id'] == 'course:CRS-ISO-101', [on_move, plan_n, added, skipped])
        go(pg1, '/account/move', reload=True); again = pg1.locator('main .state.empty').count()
        record('moving again changes nothing (idempotent) and the device copy is kept', again == 1 and pg1.evaluate('!!localStorage.getItem("cia:v1:local:bookmarks")'), again)

        # ---------- 3. Second browser context signs in and finds the records
        c2 = b.new_context(viewport={'width': 1280, 'height': 900}); pg2 = c2.new_page(); logs2 = []; watch(pg2, logs2)
        A2 = sign_in(pg2, 'learner.one@example.test'); go(pg2, '/my', reload=True); wait_sync(pg2)
        found = [r['id'] for r in local(pg2, A2['user']['id'], 'bookmarks')] + [r['id'] for r in local(pg2, A2['user']['id'], 'cpd')]
        record('a second device signs in and finds the records (bookmark and CPD entry pulled into its device copy)', set(found) == {'course:CRS-ISO-101', 'CPD-1'}, found)
        # a change on device 2 reaches device 1
        st, _ = api('PUT', '/collections/cpd', A['token'], {'items': [{'id': 'CPD-1', 'hours': 6}, {'id': 'CPD-2', 'hours': 2, 'updated_at': '2026-11-18T09:00:00Z'}]})
        go(pg1, '/my', reload=True); wait_sync(pg1)
        record('sync: a change saved from one device appears on the other after its next start', {r['id'] for r in local(pg1, A['user']['id'], 'cpd')} == {'CPD-1', 'CPD-2'}, local(pg1, A['user']['id'], 'cpd'))

        # ---------- 4. Learner cannot open admin; the server refuses another person's data
        go(pg1, '/admin', reload=True); forb = pg1.locator('main').inner_text()
        st_admin, _ = api('GET', '/admin/users', A['token']); st_queue, _ = api('GET', '/reviews/queue', A['token'])
        c3 = b.new_context(viewport={'width': 1280, 'height': 900}); pg3 = c3.new_page(); logs3 = []; watch(pg3, logs3)
        B_ = sign_up(pg3, 'Learner Two', 'learner.two@example.test')
        _, other = api('GET', '/collections/bookmarks', B_['token'])
        EXPECTED['on'] = True
        tampered = pg3.evaluate(f"""async () => {{ const t = JSON.parse(localStorage.getItem('cia:v1:auth')).token;
          const r = await fetch('/api/v1/collections/passport_verifications', {{ method: 'PUT', headers: {{ 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }}, body: JSON.stringify({{ items: [{{ id: 'v', decision: 'verified' }}] }}) }}); return r.status; }}""")
        pg3.evaluate("() => { const a = JSON.parse(localStorage.getItem('cia:v1:auth')); a.user.roles = ['admin', 'reviewer']; localStorage.setItem('cia:v1:auth', JSON.stringify(a)); }")
        go(pg3, '/admin?tab=users', reload=True); pg3.wait_for_timeout(800)
        forged_ui = pg3.locator('main').inner_text()
        go(pg3, '/account', reload=True); EXPECTED['on'] = False
        record('a learner cannot open administration (page and server refuse); another learner sees none of their records; a forged role in the browser gets nothing from the server; a learner cannot write verifications',
               ('not allowed' in forb.lower() or 'permission' in forb.lower() or 'access' in forb.lower()) and st_admin == 403 and st_queue == 403 and other['items'] == [] and tampered == 403 and 'learner.one@example.test' not in forged_ui,
               [forb[:120], st_admin, st_queue, other, tampered])

        # ---------- 5. Admin draft → different reviewer approves → publishing script → learner sees it
        cA = b.new_context(viewport={'width': 1440, 'height': 900}); adm = cA.new_page(); logsA = []; watch(adm, logsA)
        AD = sign_up(adm, 'Content Admin', 'admin@example.test'); cmd(f"role {AD['user']['id']} admin")
        cR = b.new_context(viewport={'width': 1440, 'height': 900}); rev = cR.new_page(); logsR = []; watch(rev, logsR)
        RV = sign_up(rev, 'Named Reviewer', 'reviewer@example.test'); cmd(f"role {RV['user']['id']} reviewer")
        go(adm, '/account', reload=True)
        go(adm, '/admin?tab=content'); adm.select_option('#cms-coll', 'courses'); adm.fill('#cms-filter', 'CRS-ISO-101'); adm.wait_for_selector('[data-action=cms-edit][data-record="CRS-ISO-101"]')
        adm.click('[data-action=cms-edit][data-record="CRS-ISO-101"]'); adm.wait_for_selector('#cms-json')
        adm.evaluate(f"""() => {{ const ta = document.querySelector('#cms-json'); const d = JSON.parse(ta.value);
          d.overview = {{ en: d.overview.en + ' {MARK}.', ar: d.overview.ar + ' {MARK}.' }}; ta.value = JSON.stringify(d, null, 2); ta.dispatchEvent(new Event('input')); }}""")
        adm.fill('#cms-note', 'overview wording'); adm.click('[data-action=cms-save]'); adm.wait_for_selector('[data-draft-status=draft]')
        hist = int(adm.get_attribute('[data-draft]', 'data-draft-version'))
        adm.click('[data-action=cms-submit]'); adm.wait_for_selector('[data-draft-status=submitted]')
        # the author cannot approve their own draft
        go(adm, '/admin?tab=decisions'); adm.wait_for_selector('[data-decide]')
        own_flag = adm.get_attribute('[data-decide]', 'data-mine'); EXPECTED['on'] = True; adm.click('[data-action=approve]'); adm.wait_for_selector('[data-decided]')
        own_res = adm.get_attribute('[data-decided]', 'data-decided'); adm.wait_for_timeout(300); EXPECTED['on'] = False
        go(rev, '/admin?tab=decisions', reload=True); rev.wait_for_selector('[data-decide]'); rev.click('[data-action=approve]'); rev.wait_for_selector('[data-decided=approve]')
        go(adm, '/admin?tab=export'); adm.wait_for_selector('[data-export-ready="1"]')
        with adm.expect_download() as d1: adm.click('[data-action=cms-export]')
        dl = d1.value
        st, ex = api('GET', '/admin/export', AD['token'])
        (TMP / 'drafts.json').write_text(json.dumps(ex['drafts']), encoding='utf-8'); (TMP / 'decisions.json').write_text(json.dumps(ex['decisions']), encoding='utf-8')
        pub = subprocess.run([sys.executable, str(CA / 'tools' / 'cms_publish.py'), str(TMP / 'drafts.json'), str(TMP / 'decisions.json'), '--apply'], capture_output=True, text=True, cwd=CA, timeout=600)
        cmd('reload')
        seed_rec = next(c for c in SEED('courses.json') if c['id'] == 'CRS-ISO-101')
        go(pg1, f"/academy/courses/{COURSE['slug']}", reload=True); seen = MARK in pg1.locator('main').inner_text()
        record('admin edits a draft (new version, history kept), submits it; the author cannot approve it; a different named reviewer approves; the export downloads; the publishing script runs the pre-review and the existing decision script; the learner sees the change',
               hist >= 1 and own_flag == 'true' and own_res == 'error' and dl.suggested_filename.startswith('cms-drafts-') and pub.returncode == 0 and seed_rec['governance']['reviewer'] == 'Named Reviewer' and seed_rec['governance']['content_status'] == 'published' and seen,
               [hist, own_flag, own_res, pub.returncode, pub.stdout[-400:], seed_rec['governance'].get('reviewer'), seen])
        adm.click('[data-action=cms-mark-exported]'); adm.wait_for_timeout(500)

        # ---------- 6. Shared review: a reviewer scores another learner's written task; status changes by the existing rule
        answers = {t['id']: None for t in LAB['tasks']}
        answers['T9'] = 'The finding cites clause 7.5, the record sampled, the date and the gap between the requirement and what was seen.'
        att = json.loads(subprocess.run(['node', '-e', f"import('{(CA / 'src' / 'domain' / 'labs.mjs').as_posix()}').then(m => console.log(JSON.stringify(m.makeLabAttempt({json.dumps(LAB)}, {json.dumps(answers)}, {{ attemptNo: 1 }}))))"], capture_output=True, text=True).stdout)
        api('PUT', '/collections/lab_attempts', B_['token'], {'items': [att]})
        go(pg3, '/account', reload=True); wait_sync(pg3); go(pg3, '/account', reload=True)
        pg3.wait_for_selector(f'[data-action=send-review][data-attempt="{att["id"]}"]'); pg3.click(f'[data-action=send-review][data-attempt="{att["id"]}"]')
        pg3.wait_for_selector('[data-review-request][data-status=open]')
        go(rev, '/admin?tab=evidence'); rev.wait_for_selector('[data-request]')
        q_text = rev.locator('[data-evidence-queue]').inner_text(); sla_flag = rev.get_attribute('[data-sla]', 'data-sla')
        rev.click('[data-action=claim]'); rev.wait_for_selector('[data-score-for="T9"]')
        rev.fill('[data-score-for="T9"]', '4'); rev.click('[data-action=submit-scores]'); rev.wait_for_timeout(1200)
        st, after = api('GET', '/collections/lab_attempts', B_['token'])
        a2 = after['items'][0]
        go(pg3, '/account', reload=True); pg3.wait_for_selector('[data-review-request][data-status=completed]')
        record('a learner sends a written lab task to the shared queue; the reviewer sees no name or e-mail and no invented service level; after scoring, the learner\'s attempt is re-scored by the existing rule (awaiting review → complete) with the reviewer\'s name',
               'Learner Two' not in q_text and 'learner.two@' not in q_text and sla_flag == 'not_set' and a2['pending_review'] == 0 and a2['status'] == 'complete' and a2['reviews']['T9']['reviewer'] == 'Named Reviewer',
               [sla_flag, a2.get('status'), a2.get('pending_review'), a2.get('reviews')])

        # ---------- 7. Company on accounts: share appears live and disappears on withdrawal
        go(adm, '/admin?tab=users'); adm.fill('#org-name', 'Pilot Company'); adm.fill('#org-admin', 'boss@example.test'); adm.click('[data-action=create-org]')
        adm.wait_for_selector('[data-org-invite]'); invite_boss = adm.input_value('[data-org-invite]')
        cB = b.new_context(viewport={'width': 1280, 'height': 900}); boss = cB.new_page(); logsB = []; watch(boss, logsB)
        BO = sign_up(boss, 'Company Boss', 'boss@example.test')
        boss.goto(invite_boss.replace('#/', '?lang=en#/')); settle(boss)
        if os.environ.get('E2E_DEBUG'): boss.wait_for_timeout(1500); print('DEBUG-BOSS', boss.locator('main').inner_text()[:300].replace('\n', ' | '))
        boss.wait_for_selector('[data-invite-result=ok]')
        go(boss, '/company/live', reload=True); boss.wait_for_selector('[data-live-org]')
        boss.fill('#lv-email', 'learner.two@example.test'); boss.click('[data-action=invite]'); boss.wait_for_selector('[data-invite-link]')
        invite_emp = boss.input_value('[data-invite-link]')
        pg3.goto(invite_emp.replace('#/', '?lang=en#/')); settle(pg3)
        if os.environ.get('E2E_DEBUG'): pg3.wait_for_timeout(1500); print('DEBUG-EMP', pg3.url, pg3.locator('main').inner_text()[:300].replace('\n', ' | '))
        pg3.wait_for_selector('[data-invite-result=ok]')
        api('PUT', '/collections/self_levels', B_['token'], {'items': [{'id': COMPS[0], 'level': 3}, {'id': COMPS[1], 'level': 2}]})
        go(pg3, '/my?tab=passport&p=company', reload=True); wait_sync(pg3); go(pg3, '/my?tab=passport&p=company', reload=True)
        pg3.wait_for_selector('[data-account-shares]'); pg3.fill('#cs-name', 'Learner Two'); pg3.check('#cs-part-competencies'); pg3.check('#cs-consent')
        pg3.click('[data-action=grant-consent]'); pg3.wait_for_selector('[data-account-shares="1"]')
        go(boss, '/company/live', reload=True); boss.wait_for_selector('[data-live-shares]'); appear = boss.get_attribute('[data-live-shares]', 'data-live-shares')
        live_text = boss.locator('main').inner_text()
        st_admin_sh, _ = api('GET', f"/orgs/{BO and json.loads(cmd('sql select id from cia.orgs'))[0]['id']}/shares", AD['token'])
        pg3.click('[data-action=withdraw-consent]'); pg3.click('dialog .btn-danger'); pg3.wait_for_selector('[data-account-shares="0"]')
        go(boss, '/company/live', reload=True); boss.wait_for_selector('[data-live-shares]'); gone = boss.get_attribute('[data-live-shares]', 'data-live-shares')
        record('company administrator joins by invitation, invites an employee; the employee consents in the passport and the share appears live (name, no e-mail); the platform administrator is refused; withdrawal removes it at once',
               appear == '1' and 'Learner Two' in live_text and 'learner.two@example.test' not in live_text.split('Invite')[0] and st_admin_sh == 403 and gone == '0', [appear, gone, st_admin_sh])

        # ---------- 8. Verification center edit shows on the certification page
        go(adm, '/admin?tab=verification'); adm.wait_for_selector('[data-action=verify-edit][data-cert="CERT-PMP"]')
        adm.click('[data-action=verify-edit][data-cert="CERT-PMP"]'); adm.wait_for_selector('[data-verify-form="CERT-PMP"]')
        adm.select_option('#vf-status', 'verified'); adm.fill('#vf-source_url', 'https://www.pmi.org/certifications/project-management-pmp')
        adm.fill('#vf-last_verified', time.strftime('%Y-%m-%d')); adm.fill('#vf-verifier', 'Content Admin'); adm.fill('#vf-next_review', '2027-03-01')
        adm.click('[data-action=verify-save]'); adm.wait_for_timeout(800)
        go(pg1, '/academy/pmi/certifications/pmp', reload=True); pg1.wait_for_selector('[data-verification-line=verified]')
        line = pg1.locator('[data-verification-line]').inner_text()
        record('a verification-center edit (named verifier, date, official https source, next review) shows on the certification page without a code change; the dated facts stay as governed content',
               'Content Admin' in line and 'checked at the issuer' in line, line)

        # ---------- 9. Analytics: first-party counts, nothing personal
        go(adm, '/admin?tab=analytics'); adm.wait_for_selector('[data-analytics]')
        a_text = adm.locator('main').inner_text()
        stored = cmd('sql select event, dim, count from cia.analytics_daily')
        _, an = api('GET', '/admin/analytics', AD['token'])
        small = next((r for r in an['rows'] if r['event'] == 'move_to_account'), {})
        record('usage page shows first-party counts with small counts hidden (API returns none for counts under 5); stored rows hold no e-mail, name or account id',
               'Counts under 5 are hidden' in a_text and small.get('count', 'x') is None and small.get('suppressed') is True and 'example.test' not in stored and A['user']['id'] not in stored and 'page_view' in stored, [small, stored[:200]])

        # ---------- 10. Responsive, axe light + dark, console, CSP, third-party requests
        pages = [('/account', pg1), ('/account/move', pg1), ('/admin?tab=content', adm), ('/admin?tab=verification', adm), ('/admin?tab=evidence', rev), ('/company/live', boss)]
        bad, ax, overflow = [], [], []
        for w in (390, 768, 1280, 1920):
            for lang in ('ar', 'en'):
                for route, pg in pages:
                    pg.set_viewport_size({'width': w, 'height': 900}); go(pg, route, lang, reload=True)
                    h1 = pg.locator('main h1').count()
                    ow = pg.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
                    if h1 != 1 or ow: overflow.append(f'{route}@{w}/{lang} h1={h1} overflow={ow}')
                    if w in (390, 1280) and lang == 'en':
                        for theme in ('light', 'dark'):
                            pg.evaluate(f'document.documentElement.dataset.theme = "{theme}"'); pg.wait_for_timeout(100)
                            ax += [f'{route}@{w}/{theme}: {v["id"]} ({v["n"]}) {v["t"][:1]}' for v in axe(pg)]
        signed_out = b.new_context(); so = signed_out.new_page(); logsS = []; watch(so, logsS)
        for lang in ('ar', 'en'):
            for w in (390, 1280):
                so.set_viewport_size({'width': w, 'height': 900}); go(so, '/account', lang, reload=True)
                if so.locator('main h1').count() != 1 or so.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1'): overflow.append(f'signed-out /account@{w}/{lang}')
        ax += [f'/account signed out: {v["id"]}' for v in axe(so)]
        record('responsive: account, move, admin tabs, review queue and live company pages × 390/768/1280/1920 × AR/EN — one h1, no horizontal overflow', not overflow, overflow[:6])
        record('accessibility: axe (WCAG 2.1 A/AA + best practice) on the new pages, light and dark — 0 violations', not ax, ax[:6])
        csp = sum((pg.evaluate('window.__csp || []') for pg in (pg1, pg2, pg3, adm, rev, boss, so)), [])
        record('Content-Security-Policy: 0 violations across every page used in this suite', not csp, csp[:5])
        third = [u for u in requests if not (u.startswith(BASE) or u.startswith('data:') or u.startswith('blob:'))]
        record('no third-party request (fonts, scripts, analytics and API all on the site\'s own origin)', not third, third[:5])
        allc = logs + logs2 + logs3 + logsA + logsR + logsB + logsS
        record('no console errors or warnings in any journey (outside the two marked windows where a refusal is provoked on purpose — tampering, a forged role, self-approval — which must show only 403 refusals)',
               not allc and all('403' in x or 'forbidden' in x for x in EXPECTED['seen']), [allc[:5], EXPECTED['seen'][:4]])
        b.close()
finally:
    try: cmd('quit')
    except Exception: pass
    be.terminate()

# ---------- 11. Hub and toolkit integrity (the real tree, not the copy)
base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = [f for h, f in (l.split(maxsplit=1) for l in base.read_text().splitlines()) if (PLATFORM / f).exists() and hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest() != h]
    record('integrity: hub and toolkit files byte-identical to the baseline apart from the D-08 and D-22 patches; the real seed files were not touched by this suite',
           set(changed) <= {'index.html', 'sw.js'} and MARK not in (ACADEMY / 'data' / 'seed' / 'courses.json').read_text(encoding='utf-8'), changed)
shutil.rmtree(TMP, ignore_errors=True)

passed = sum(r['ok'] for r in results)
(EVID / 'e2e-phase14-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
