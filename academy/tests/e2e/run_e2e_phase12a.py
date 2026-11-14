#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 12A suite (Company Portal, ADD-13). Playwright + axe-core.

Company set-up from an empty state (no dead end); an employee shares from My space → Passport → My company (chooses parts, the
file content is checked against the choice, consent required); the administrator imports three shares (one real, two built with
the same code), foreign / damaged / duplicate files are refused; matrix and training-needs analysis are compared with numbers
calculated independently here; the annual plan is exported in every format; an assignment to a person and to a department
travels to the employee as a file, appears in Progress and at the top of the weekly plan, and its completion comes back in the
next share; overdue / due-soon / completed states; withdrawal; sample company; workspace backup; responsive 390 / 768 / 1280 /
1920; axe light + dark; console; storage keys; hub / toolkit integrity; plan §5 measurements.
Usage: python3 tests/e2e/run_e2e_phase12a.py [--evidence DIR]
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request, hashlib, tempfile, datetime, math, re
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
TMP = pathlib.Path(tempfile.mkdtemp(prefix='cia12a-'))
AXE = (ACADEMY / 'tests' / 'vendor' / 'axe.min.js').read_text(encoding='utf-8')
SEED = lambda f: json.loads((ACADEMY / 'data' / 'seed' / f).read_text(encoding='utf-8'))['items']
ROLES = SEED('competency/target-roles.json'); COMPS = SEED('competency/competencies.json'); COURSES = SEED('courses.json')
QE = next(r for r in ROLES if r['id'] == 'ROLE-QE')
T = {c['id']: QE['targets'].get(c['id'], 0) for c in COMPS}
REQ = [c['id'] for c in COMPS if T[c['id']] > 0]
COURSE = next(c for c in COURSES if c['id'] == 'CRS-ISO-101')
LESSONS = [l['id'] for m in COURSE['modules'] for l in m['lessons']]
TODAY = datetime.date.today()
D = lambda n: (TODAY + datetime.timedelta(days=n)).isoformat()
jsround = lambda x: math.floor(x + 0.5)
r2 = lambda x: math.floor(x * 100 + 0.5) / 100

# ---------- numbers calculated here, independently of the application ----------
# A (the real employee): self-rated at the required level everywhere, except QM-02 rated 2 (required 4 → gap 2, critical).
# B: only QM-01 assessed at 75 % (→ level 3); nothing else shared.   C: QM-02 verified at 4; everything else self-rated one below (min 1).
LEV = {'A': {c: (2 if c == 'QM-02' else T[c]) for c in REQ}, 'B': {'QM-01': 3}, 'C': {c: (4 if c == 'QM-02' else max(1, T[c] - 1)) for c in REQ}}
def person(k):
    gaps = {c: max(0, T[c] - LEV[k].get(c, 0)) for c in REQ}
    return {'required': len(REQ), 'met': sum(1 for g in gaps.values() if g == 0), 'total': sum(gaps.values()), 'critical': sum(1 for g in gaps.values() if g >= 2), 'needs': sum(1 for g in gaps.values() if g > 0), 'gaps': gaps}
EXP = {k: person(k) for k in 'ABC'}
for k in EXP: EXP[k]['readiness'] = jsround(EXP[k]['met'] / EXP[k]['required'] * 100)
CO = {'required': 3 * len(REQ), 'met': sum(EXP[k]['met'] for k in 'ABC'), 'total': sum(EXP[k]['total'] for k in 'ABC')}
CO['readiness'] = jsround(CO['met'] / CO['required'] * 100); CO['mean'] = r2(CO['total'] / CO['required'])
NEEDS = {c: [k for k in 'ABC' if EXP[k]['gaps'][c] > 0] for c in REQ}; NEEDS = {c: v for c, v in NEEDS.items() if v}
HOLD = {c: [k for k in 'ABC' if LEV[k].get(c, 0) >= T[c]] for c in REQ}
SPOF = {c: len(v) for c, v in HOLD.items() if len(v) < 2}


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

def go(page, route, lang='en', extra='', reload=False):
    page.goto(f'{BASE}/academy/?lang={lang}{extra}#{route}')
    if reload: page.reload()
    settle(page)

def co(page, tab, lang='en'):
    go(page, f'/company?tab={tab}', lang, reload=True)
    page.wait_for_selector(f'[role=tabpanel][data-panel=co-{tab}]:not([hidden])'); settle(page)

def pp(page, tab='company', lang='en'):
    go(page, f'/my?tab=passport&p={tab}', lang, '&dev=0', reload=True)
    page.wait_for_selector(f'[role=tabpanel][data-panel=pp-{tab}]:not([hidden])'); settle(page)

def axe(page):
    page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")

def store(page, key):
    raw = page.evaluate(f'localStorage.getItem("cia:v1:local:{key}")')
    return (json.loads(raw) if raw else {'items': []})['items']

def put(page, key, items):
    page.evaluate('([k, v]) => localStorage.setItem(k, JSON.stringify({ schema: 1, updatedAt: new Date().toISOString(), items: v }))', [f'cia:v1:local:{key}', items])

def as_admin(page):
    go(page, '/')
    page.evaluate('localStorage.setItem("cia:v1:session", JSON.stringify({ roles: ["learner", "company_admin"] }))')

def dl(page, selector):
    with page.expect_download() as d: page.click(selector)
    p = TMP / d.value.suggested_filename; d.value.save_as(p); return p

raw = lambda path: path.read_bytes().decode('utf-8')

def build_share(page, key, name, rows, parts, share_id):
    return page.evaluate("""async ([key, name, rows, parts, id]) => { const C = await import('/academy/src/domain/company.mjs');
      return C.buildShare({ employee: { key, name, job_title: 'Engineer' }, parts, shareId: id, now: new Date(Date.now() - 3600e3).toISOString(), data: { competencies: rows, cpd: { total: 8, count: 2, by_year: {} } } }); }""", [key, name, rows, parts, share_id])

def digest_ok(page, f):
    return page.evaluate("async f => { const C = await import('/academy/src/domain/company.mjs'); const { digest, ...rest } = f; return C.digestOf(rest) === digest; }", f)

def place(page, key, dep_label, role_label):
    page.select_option(f'#pd-{key}', label=dep_label); settle(page); page.wait_for_selector(f'[data-person="{key}"]')
    page.select_option(f'#pr-{key}', label=role_label); settle(page); page.wait_for_selector(f'[data-person="{key}"][data-placed=true]')

try:
  with sync_playwright() as p:
    b = p.chromium.launch(); logs = []
    actx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); admin = actx.new_page(); watch(admin, logs)
    ectx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True); emp = ectx.new_page(); watch(emp, logs)

    # ---------- 1. Access and the empty state: no dead end ----------
    go(emp, '/company', extra='&dev=0')
    forbidden = emp.locator('main[data-route="/company"] h1').inner_text()
    go(emp, '/', extra='&dev=0'); emp.click('[data-action=user]')
    learner_menu = emp.locator('#user-menu [data-nav=company]').count()
    as_admin(admin); go(admin, '/company', reload=True)
    empty = admin.locator('[data-empty=company]').count() == 1
    steps = admin.get_attribute('[data-steps]', 'data-steps')
    starts = [admin.locator(f'[data-action={a}]').count() for a in ('start-setup', 'load-sample')]
    label = admin.inner_text('[data-company-label]')
    dead = []
    for tab, sel in [('setup', '[data-form=company]'), ('people', '#co-share-file'), ('matrix', '[data-action=go-people]'), ('tna', '[data-action=go-people]'), ('plan', '[data-action=go-people]'), ('assignments', '[data-action=go-people]')]:
        co(admin, tab)
        if admin.locator(f'[data-panel=co-{tab}] {sel}').count() < 1: dead.append(tab)
    admin.click('[data-action=user]'); menu = admin.locator('#user-menu [data-nav=company]').count(); admin.keyboard.press('Escape')
    go(admin, '/my'); door = admin.locator('[data-company-door] [data-action=open-company]').count()
    top = admin.locator('nav.pnav > a, nav.pnav > span').count()
    record('access and empty state: a learner gets 403 and no menu entry; the administrator finds the workspace in the account menu and My space (5 top items unchanged), with a labelled planning-aid note, 7 guided steps and a next action in every tab',
           "isn't available for your role" in forbidden and learner_menu == 0 and empty and steps == '0/7' and starts == [1, 1] and 'not a performance appraisal' in label and 'does not certify' in label and not dead and menu == 1 and door == 1 and top == 5,
           [forbidden, learner_menu, empty, steps, starts, dead, menu, door, top])

    # ---------- 2. Set-up: profile, departments, a company-defined role ----------
    co(admin, 'setup')
    admin.click('[data-action=save-company]'); err1 = admin.inner_text('#co-name-err'); inv = admin.get_attribute('#co-name', 'aria-invalid')
    admin.fill('#co-name', 'Najm Industrial Services'); admin.fill('#co-sector', 'Energy services'); admin.fill('#co-admin', 'HR Lead'); admin.fill('#co-year', '1990')
    admin.click('[data-action=save-company]'); err2 = admin.inner_text('#co-year-err')
    admin.fill('#co-year', '2027'); admin.click('[data-action=save-company]'); settle(admin)
    prof = store(admin, 'company_profile')
    admin.click('[data-action=save-department]'); err3 = admin.inner_text('#co-dep-name-err')
    for name, roles in [('Quality', ['ROLE-QE']), ('Empty Dept', ['ROLE-QE'])]:
        admin.fill('#co-dep-name', name)
        for r in roles: admin.check(f'[data-form=department] input[value="{r}"]')
        admin.click('[data-action=save-department]'); settle(admin)
    admin.fill('#co-dep-name', 'quality'); admin.click('[data-action=save-department]'); dup = admin.inner_text('#co-dep-name-err')
    admin.click('[data-form=role] summary'); admin.fill('#co-role-name', 'Site QA Inspector'); admin.click('[data-action=save-role]'); err4 = admin.inner_text('#co-role-t-err')
    admin.select_option('#co-role-base', 'ROLE-QE'); base_copied = admin.input_value('#co-rl-QM-02') == str(T['QM-02'])
    admin.select_option('#co-rl-QM-02', '5'); admin.click('[data-action=save-role]'); settle(admin)
    croles = store(admin, 'company_roles'); deps = store(admin, 'company_departments')
    record('set-up: required and range errors with aria-invalid; profile saved; two departments with their roles; duplicate department refused; a company role built from an Academy role and adjusted',
           err1 and inv == 'true' and err2 and prof and prof[0]['name'] == 'Najm Industrial Services' and prof[0]['plan_year'] == 2027 and err3 and len(deps) == 2 and deps[0]['roles'] == ['ROLE-QE'] and dup and err4 and base_copied
           and len(croles) == 1 and croles[0]['targets']['QM-02'] == 5 and croles[0]['based_on'] == 'ROLE-QE' and croles[0]['custom'] is True, [err1, err2, err3, dup, err4, len(deps), croles[:1]])

    # ---------- 3. The employee shares from My space → Passport → My company ----------
    pp(emp)
    tab_ok = emp.locator('[role=tab][data-tab=pp-company]').count() == 1
    empty_share = emp.locator('[data-share-empty]').count() == 1 and emp.locator('.co-part[data-available=true]').count() == 0
    put(emp, 'self_levels', [{'id': c, 'level': LEV['A'][c]} for c in REQ])
    put(emp, 'cpd', [{'id': 'cpd-1', 'title': 'Audit workshop', 'date': D(-20), 'hours': 6, 'category': 'workshop', 'provider': 'In-house', 'status': 'confirmed', 'created_at': D(-20), 'updated_at': D(-20)}])
    pp(emp)
    avail = {el.get_attribute('data-part'): el.get_attribute('data-available') for el in emp.locator('.co-part').all()}
    emp.click('[data-action=download-share]')
    e_name = emp.inner_text('#cs-name-err'); e_cons = emp.inner_text('#cs-consent-err')
    emp.fill('#cs-name', 'Sara Al-Amin'); emp.fill('#cs-job', 'Quality Engineer'); emp.fill('#cs-no', 'E-104')
    for part in ('competencies', 'cpd'):
        emp.check(f'#cs-part-{part}')
    for part in ('verified', 'credentials', 'roadmap', 'assignments'):
        if emp.locator(f'#cs-part-{part}:not([disabled])').count(): emp.uncheck(f'#cs-part-{part}')
    preview = emp.get_attribute('[data-share-preview]', 'data-share-preview'); nothing_else = emp.locator('.co-preview .ico-lock').count() == 1
    raw_preview = emp.text_content('[data-share-raw]') or ''
    emp.click('[data-action=download-share]'); still = emp.inner_text('#cs-consent-err')
    emp.check('#cs-consent'); share1 = dl(emp, '[data-action=download-share]'); settle(emp)
    f1 = json.loads(share1.read_text(encoding='utf-8'))
    EMPKEY = f1['employee']['key']
    lv = {r['id']: (r['level'], r['source']) for r in f1['data']['competencies']}
    log1 = emp.get_attribute('[data-share-log]', 'data-share-log'); res_parts = emp.get_attribute('[data-share-result]', 'data-parts')
    record('employee share: the tab exists; an empty passport offers next steps instead of a dead end; name and consent are required; the file lists exactly the ticked parts (competencies and CPD totals only), the name, the date, the bilingual consent and a valid digest; it is logged on the device',
           tab_ok and empty_share and avail == {'competencies': 'true', 'verified': 'false', 'cpd': 'true', 'credentials': 'false', 'roadmap': 'false', 'assignments': 'false'} and e_name and e_cons and still and preview == 'competencies,cpd' and nothing_else
           and '"includes"' in raw_preview and f1['schema'] == 'cia.passport-share.v1' and f1['includes'] == ['competencies', 'cpd'] and sorted(f1['data']) == ['competencies', 'cpd'] and f1['employee']['name'] == 'Sara Al-Amin' and f1['employee']['employee_no'] == 'E-104'
           and f1['shared_at'][:10] <= D(1) and f1['consent']['accepted'] is True and f1['consent']['name'] == 'Sara Al-Amin' and f1['consent']['text']['en'] and f1['consent']['text']['ar']
           and lv == {c: (LEV['A'][c], 'self') for c in REQ} and f1['data']['cpd'] == {'total': 6, 'count': 1, 'by_year': {D(-20)[:4]: 6}} and 'title' not in json.dumps(f1['data']['cpd']) and digest_ok(emp, f1) and log1 == '1' and res_parts == 'competencies,cpd',
           [tab_ok, empty_share, avail, bool(e_name), bool(e_cons), preview, f1['includes'], sorted(f1['data']), f1['data']['cpd'], log1])

    # ---------- 4. The administrator imports three shares; foreign, damaged and duplicate files are refused ----------
    fB = build_share(admin, 'EMP-TEST-B', 'Omar Haddad', [{'id': 'QM-01', 'level': 3, 'source': 'assessment', 'percent': 75, 'date': D(-5)}], ['competencies', 'cpd'], 'SHR-TEST-B')
    rowsC = [{'id': c, 'level': LEV['C'][c], 'source': 'self'} for c in REQ if c != 'QM-02'] + [{'id': 'QM-02', 'level': 4, 'source': 'verified', 'date': D(-30), 'verification': {'reviewer': 'Huda Karim', 'date': D(-30), 'method': 'work_sample'}}]
    fC = build_share(admin, 'EMP-TEST-C', 'Lina Noor', rowsC, ['competencies', 'verified'], 'SHR-TEST-C')
    bad = json.loads(json.dumps(fB)); bad['share_id'] = 'SHR-TEST-BAD'; bad['data']['competencies'][0]['percent'] = 99
    paths = {}
    for n, f in [('b', fB), ('c', fC), ('tampered', bad), ('foreign', {'app': 'cia-academy', 'schema': 'cia.passport.v1', 'data': {}})]:
        paths[n] = TMP / f'{n}.json'; paths[n].write_text(json.dumps(f, ensure_ascii=False), encoding='utf-8')
    (TMP / 'notjson.json').write_text('{oops', encoding='utf-8')
    co(admin, 'people')
    people_empty = admin.locator('[data-empty=people]').count() == 1
    admin.set_input_files('#co-share-file', [str(share1), str(paths['b']), str(paths['c']), str(paths['tampered']), str(paths['foreign']), str(TMP / 'notjson.json')]); settle(admin)
    admin.wait_for_selector('[data-share-import=ok]')
    imp = {k: admin.get_attribute('[data-share-import]', 'data-' + k) for k in ('added', 'rejected')}
    rej = sorted(el.get_attribute('data-rejected') for el in admin.locator('[data-share-import] [data-rejected]').all())
    admin.set_input_files('#co-share-file', [str(share1)]); settle(admin); admin.wait_for_selector('[data-share-import=error]')
    dup_code = admin.get_attribute('[data-share-import] [data-rejected]', 'data-rejected')
    stored = store(admin, 'company_shares')
    sA = next(s for s in stored if s['employee_key'] == EMPKEY)
    admin.click(f'[data-person="{EMPKEY}"] [data-action=view-share]'); dlg = admin.inner_text('[data-share-dialog]'); admin.click('dialog .btn-primary')
    record('import: three shares stored unchanged (only consented parts kept); a damaged file, a passport backup and a non-JSON file are each refused with its reason; importing the same share again is refused, never overwritten; the dialog shows what was and was not shared',
           people_empty and imp == {'added': '3', 'rejected': '3'} and rej == ['digest', 'json', 'schema'] and dup_code == 'duplicate' and len(stored) == 3 and sorted(sA['data']) == ['competencies', 'cpd'] and sA['includes'] == ['competencies', 'cpd']
           and 'Competency levels' in dlg and 'Not shared:' in dlg and 'Credentials' in dlg and 'awards no recognised CPD' in dlg, [people_empty, imp, rej, dup_code, len(stored)])

    # ---------- 5. Placement, people without a role, the matrix against independent numbers ----------
    place(admin, EMPKEY, 'Quality', 'Quality Engineer ★'); place(admin, 'EMP-TEST-B', 'Quality', 'Quality Engineer ★')
    co(admin, 'matrix')
    without = admin.get_attribute('[data-without-role]', 'data-without-role'); rows2 = admin.get_attribute('table.co-mx', 'data-rows')
    co(admin, 'people'); place(admin, 'EMP-TEST-C', 'Quality', 'Quality Engineer ★')
    co(admin, 'matrix')
    KEY = {'A': EMPKEY, 'B': 'EMP-TEST-B', 'C': 'EMP-TEST-C'}
    cell = lambda k, c: {a: admin.get_attribute(f'td[data-cell="{KEY[k]}:{c}"]', 'data-' + a) for a in ('state', 'level', 'required', 'gap', 'source')}
    cells_ok = (cell('A', 'QM-02') == {'state': 'critical', 'level': '2', 'required': str(T['QM-02']), 'gap': str(T['QM-02'] - 2), 'source': 'self'}
                and cell('A', 'QM-01') == {'state': 'met', 'level': str(T['QM-01']), 'required': str(T['QM-01']), 'gap': '0', 'source': 'self'}
                and cell('B', 'QM-01') == {'state': 'met', 'level': '3', 'required': str(T['QM-01']), 'gap': '0', 'source': 'assessment'}
                and cell('B', 'QM-02')['state'] == 'none' and cell('B', 'QM-02')['gap'] == str(T['QM-02']) and cell('B', 'QM-02')['source'] == 'none'
                and cell('C', 'QM-02') == {'state': 'met', 'level': '4', 'required': str(T['QM-02']), 'gap': '0', 'source': 'verified'})
    ready = {k: admin.get_attribute(f'tr[data-row="{KEY[k]}"] td[data-readiness]', 'data-readiness') for k in 'ABC'}
    cols = int(admin.get_attribute('table.co-mx', 'data-cols'))
    cover = {c: admin.get_attribute(f'td[data-cover="{c}"]', 'data-met') for c in ('QM-01', 'QM-02')}
    na = admin.locator('td.co-cell.is-na').count()
    spof_n = int(admin.get_attribute('.co-spof', 'data-spof'))
    spof_row = admin.get_attribute('[data-spof-row$=":QM-02"]', 'data-count') if 'QM-02' in SPOF else None
    text_first = all(admin.locator(f'td[data-cell="{KEY[k]}:QM-02"] .co-cell-main').inner_text().strip() for k in 'ABC') and admin.locator('.co-legend li').count() == 9
    admin.click(f'td[data-cell="{KEY["A"]}:QM-02"] button'); dtext = admin.inner_text('[data-cell-dialog]'); assign_link = admin.locator('[data-cell-dialog] [data-action=assign-from-cell]').count(); admin.click('dialog .btn-primary')
    admin.select_option('#mx-view', 'gap'); gap_txt = admin.locator(f'td[data-cell="{KEY["A"]}:QM-02"] .co-cell-main').inner_text()
    admin.select_option('#mx-dom', 'QM'); cols_qm = int(admin.get_attribute('table.co-mx', 'data-cols'))
    mcsv = raw(dl(admin, '[data-action=matrix-csv]'))
    record('matrix: a person without a role is named and left out; every cell shows level, source and gap as calculated independently; readiness per person, coverage, single points of failure; numbers and a source letter in every cell (never colour alone); cell detail, gap view, domain filter and CSV',
           without == '1' and rows2 == '2' and cells_ok and ready == {k: str(EXP[k]['readiness']) for k in 'ABC'} and cols == len(REQ) and cover == {c: str(len(HOLD[c])) for c in ('QM-01', 'QM-02')} and na == 0
           and spof_n == len(SPOF) and (spof_row is None or spof_row == str(SPOF['QM-02'])) and text_first and 'own rating' in dtext and 'never upgrades' in dtext and assign_link <= 1 and gap_txt.startswith('−')
           and cols_qm == sum(1 for c in REQ if c.startswith('QM-')) and mcsv.startswith('﻿') and 'Sara Al-Amin' in mcsv and f'2/{T["QM-02"]} self-rated' in mcsv,
           [without, rows2, cells_ok, ready, {k: EXP[k]['readiness'] for k in 'ABC'}, cols, len(REQ), cover, spof_n, len(SPOF), gap_txt, cols_qm])

    # ---------- 6. Training needs analysis against independent numbers ----------
    co(admin, 'tna')
    g = lambda sel, a: admin.get_attribute(sel, 'data-' + a)
    tco = {a: g('[data-tna=company]', a) for a in ('people', 'required', 'met', 'total-gap', 'mean-gap', 'readiness')}
    dq = next(d for d in store(admin, 'company_departments') if d['name'] == 'Quality')['id']; de = next(d for d in store(admin, 'company_departments') if d['name'] == 'Empty Dept')['id']
    tdep = {a: g(f'[data-tna-department="{dq}"]', a) for a in ('people', 'total-gap', 'readiness', 'needs')}
    empty_dep = g(f'[data-tna-department="{de}"]', 'people') == '0' and admin.locator(f'[data-tna-department="{de}"] [data-empty=department]').count() == 1
    tind = {k: (g(f'[data-tna-person="{KEY[k]}"]', 'total-gap'), g(f'[data-tna-person="{KEY[k]}"]', 'needs'), g(f'[data-tna-person="{KEY[k]}"]', 'readiness')) for k in 'ABC'}
    need_q = {a: admin.get_attribute('[data-tna=company] [data-need="QM-02"]', 'data-' + a) for a in ('people', 'total', 'mean')}
    n_needs = admin.locator('[data-tna=company] [data-need]').count()
    exp_q = {'people': str(len(NEEDS['QM-02'])), 'total': str(sum(EXP[k]['gaps']['QM-02'] for k in 'ABC'))}
    formula = 'Required level − current level = development need' in admin.inner_text('.co-formula')
    record('TNA: required − current per person, department and company equal the independent calculation (cells, met, total gap, mean gap, readiness, people affected); an empty department is shown with zero counts; needs carry a priority and a suggested course',
           tco['people'] == '3' and tco['required'] == str(CO['required']) and tco['met'] == str(CO['met']) and tco['total-gap'] == str(CO['total']) and abs(float(tco['mean-gap']) - CO['mean']) < 0.006 and tco['readiness'] == str(CO['readiness'])
           and tdep == {'people': '3', 'total-gap': str(CO['total']), 'readiness': str(CO['readiness']), 'needs': str(len(NEEDS))} and empty_dep
           and tind == {k: (str(EXP[k]['total']), str(EXP[k]['needs']), str(EXP[k]['readiness'])) for k in 'ABC'} and need_q['people'] == exp_q['people'] and need_q['total'] == exp_q['total'] and n_needs == len(NEEDS) and formula
           and admin.locator('[data-tna=company] [data-priority]').count() == len(NEEDS), [tco, CO, tdep, empty_dep, tind, need_q, exp_q, n_needs, len(NEEDS)])

    # ---------- 7. Annual plan: every export format, overrides, print view ----------
    co(admin, 'plan')
    pl = {a: g('.co-plan', a) for a in ('plan', 'lines', 'seats')}
    seats = sum(len(v) for v in NEEDS.values())
    first = admin.get_attribute('[data-plan-row]', 'data-plan-row'); q0 = admin.get_attribute(f'[data-plan-row="{first}"]', 'data-quarter')
    csv = raw(dl(admin, '[data-action=plan-csv]')); xls = raw(dl(admin, '[data-action=plan-xls]')); doc = raw(dl(admin, '[data-action=plan-doc]'))
    admin.select_option(f'#pq-{first}', 'Q4'); settle(admin); moved = admin.get_attribute(f'[data-plan-row="{first}"]', 'data-quarter')
    last = admin.locator('[data-plan-row]').last.get_attribute('data-plan-row'); admin.uncheck(f'#pi-{last}'); settle(admin)
    after = g('.co-plan', 'lines'); saved = store(admin, 'company_plan')[0]['overrides']
    go(admin, '/company/plan'); pr = int(admin.get_attribute('[data-plan-print]', 'data-plan-print')); h1 = admin.locator('main h1').count(); plabel = 'not a performance appraisal' in admin.inner_text('main')
    go(admin, '/company/plan', 'ar'); ar_title = admin.inner_text('main h1')
    co(admin, 'plan', 'ar'); csv_ar = raw(dl(admin, '[data-action=plan-csv]'))
    co(admin, 'plan'); admin.click('[data-action=plan-reset]'); settle(admin); reset = g('.co-plan', 'lines')
    record('annual plan: one line per need for the plan year with seats and hours; CSV (BOM, CRLF), Excel 2003 XML and Word exports carry the company, the lines and the honest label; a line can be moved to another quarter or left out and the change is kept; print view; Arabic export; reset',
           pl == {'plan': '2027', 'lines': str(len(NEEDS)), 'seats': str(seats)} and csv.startswith('﻿') and '\r\n' in csv and 'Najm Industrial Services' in csv and 'Annual training plan 2027' in csv and 'not a performance appraisal' in csv and csv.count('QM-02') >= 1
           and '<?mso-application progid="Excel.Sheet"?>' in xls and 'Najm Industrial Services' in xls and 'urn:schemas-microsoft-com:office:word' in doc and 'Sara Al-Amin' in doc and moved == 'Q4' and q0 in ('Q1', 'Q2', 'Q3', 'Q4')
           and after == str(len(NEEDS) - 1) and saved[first]['quarter'] == 'Q4' and saved[last]['skip'] is True and pr == len(NEEDS) - 1 and h1 == 1 and plabel and 'الخطة التدريبية السنوية' in ar_title and 'الخطة التدريبية السنوية' in csv_ar and 'أداة تخطيط' in csv_ar and reset == str(len(NEEDS)),
           [pl, len(NEEDS), seats, moved, after, pr, ar_title, reset])

    # ---------- 8. Assignments: to a person and to a department, file per person, due states ----------
    co(admin, 'assignments')
    admin.click('[data-action=create-assignment]'); a_err = [admin.inner_text(s) for s in ('#as-target-err', '#as-who-err')]
    admin.select_option('#as-type', 'course'); admin.select_option('#as-target', COURSE['id']); admin.select_option('#as-aud', 'person'); admin.select_option('#as-who', EMPKEY); admin.fill('#as-due', D(-1))
    admin.click('[data-action=create-assignment]'); past = admin.inner_text('#as-due-err')
    admin.fill('#as-due', D(30)); admin.fill('#as-note', 'Before the surveillance audit'); admin.click('[data-action=create-assignment]'); settle(admin)
    admin.select_option('#as-type', 'lab'); admin.select_option('#as-target', 'LAB-NC-WRITE'); admin.select_option('#as-aud', 'department'); admin.select_option('#as-who', de); admin.fill('#as-due', D(10))
    admin.click('[data-action=create-assignment]'); empty_aud = admin.inner_text('#as-who-err')
    admin.select_option('#as-who', dq); admin.click('[data-action=create-assignment]'); settle(admin)
    asg = store(admin, 'company_assignments'); a_course = next(a for a in asg if a['type'] == 'course'); a_lab = next(a for a in asg if a['type'] == 'lab')
    overdue = {**a_lab, 'id': 'ASG-TEST-OVERDUE', 'type': 'assessment', 'target_id': COURSE['assessments']['final'], 'title': {'en': 'Final assessment', 'ar': 'التقييم النهائي'}, 'href': '#/assessments', 'due': D(-3), 'audience': {'type': 'person', 'id': 'EMP-TEST-B'}, 'assignees': ['EMP-TEST-B']}
    put(admin, 'company_assignments', asg + [overdue]); co(admin, 'assignments')
    due = {a['id']: admin.get_attribute(f'[data-assignment="{a["id"]}"]', 'data-due') for a in (a_course, a_lab, overdue)}
    files_n = admin.get_attribute('[data-files]', 'data-files'); await_n = admin.get_attribute(f'[data-assignment="{a_lab["id"]}"]', 'data-awaiting')
    fileA = dl(admin, f'[data-action=assignment-file][data-person="{EMPKEY}"]'); fileB = dl(admin, '[data-action=assignment-file][data-person="EMP-TEST-B"]')
    fa = json.loads(fileA.read_text(encoding='utf-8'))
    record('assignments: missing target / audience, a past due date and an empty department are refused; a course for one person and a lab for a department are created; open, due-soon and overdue states; one file per person with exactly their items; "awaiting next share" until news arrives',
           all(a_err) and past and empty_aud and len(asg) == 2 and a_course['assignees'] == [EMPKEY] and sorted(a_lab['assignees']) == sorted(KEY.values()) and a_course['note'] == 'Before the surveillance audit'
           and due == {a_course['id']: 'open', a_lab['id']: 'due_soon', 'ASG-TEST-OVERDUE': 'overdue'} and files_n == '3' and await_n == '3' and fa['schema'] == 'cia.assignment.v1' and fa['employee']['key'] == EMPKEY
           and sorted(i['id'] for i in fa['items']) == sorted([a_course['id'], a_lab['id']]) and fa['company']['name'] == 'Najm Industrial Services' and digest_ok(admin, fa), [a_err, past, empty_aud, due, files_n, await_n])

    # ---------- 9. The employee imports the file: Progress, weekly plan, completion, next share ----------
    pp(emp)
    emp.set_input_files('#cs-asg-file', str(fileB)); emp.wait_for_selector('[data-assignment-import=error]'); other = emp.get_attribute('[data-assignment-import]', 'data-code')
    emp.set_input_files('#cs-asg-file', str(share1)); emp.wait_for_selector('[data-assignment-import=error][data-code=schema]')
    emp.set_input_files('#cs-asg-file', str(fileA)); emp.wait_for_selector('[data-assignment-import=ok]'); added = emp.get_attribute('[data-assignment-import]', 'data-added')
    emp.set_input_files('#cs-asg-file', str(fileA)); emp.wait_for_function('() => document.querySelector("[data-assignment-import]")?.dataset.added === "0"'); inbox = store(emp, 'assignments_inbox')
    go(emp, '/my?tab=progress', extra='&dev=0'); emp.wait_for_selector('[data-my-assignments="2"]')
    prog = {el.get_attribute('data-assignment'): (el.get_attribute('data-state'), el.get_attribute('data-due')) for el in emp.locator('.co-my-asg [data-assignment]').all()}
    note_shown = 'Before the surveillance audit' in emp.inner_text('.co-my-asg')
    go(emp, '/my?tab=path', extra='&dev=0'); emp.wait_for_selector('[data-plan=weekly]')
    plan_assigned = emp.get_attribute('[data-plan-assigned]', 'data-plan-assigned'); plan_first = emp.inner_text('.plan-list li:first-child') if emp.locator('.plan-list li').count() else ''
    first_lesson = COURSE['modules'][0]['lessons'][0]['title']['en']
    put(emp, 'course_progress', [{'id': COURSE['id'], 'completed_lessons': LESSONS, 'updated_at': TODAY.isoformat() + 'T08:00:00.000Z'}])
    put(emp, 'assessment_attempts', [{'id': 'att-12a', 'assessment_id': COURSE['assessments']['final'], 'passed': True, 'score': 90, 'submitted_at': TODAY.isoformat() + 'T08:30:00.000Z', 'competency_breakdown': {}, 'detail': []}])
    go(emp, '/my?tab=progress', extra='&dev=0'); emp.wait_for_selector('[data-my-assignments="2"]')
    done_state = emp.get_attribute(f'.co-my-asg [data-assignment="{a_course["id"]}"]', 'data-due')
    pp(emp)
    asg_part = emp.get_attribute('.co-part[data-part=assignments]', 'data-available')
    emp.check('#cs-part-assignments'); emp.check('#cs-consent'); share2 = dl(emp, '[data-action=download-share]'); settle(emp)
    f2 = json.loads(share2.read_text(encoding='utf-8'))
    rep = {a['id']: a['state'] for a in f2['data'].get('assignments', [])}
    record('employee side: a file for someone else and a non-assignment file are refused; the right file adds two items once (a second import adds nothing); they appear in Progress with due states and the note, and the assigned course leads the weekly plan; after completion the next share reports it under the same employee key',
           other == 'other_person' and added == '2' and len(inbox) == 2 and prog == {a_course['id']: ('not_started', 'open'), a_lab['id']: ('not_started', 'due_soon')} and note_shown and plan_assigned == '1' and first_lesson in plan_first
           and done_state == 'completed' and asg_part == 'true' and 'assignments' in f2['includes'] and rep == {a_course['id']: 'completed', a_lab['id']: 'not_started'} and f2['employee']['key'] == EMPKEY and f2['share_id'] != f1['share_id'],
           [other, added, len(inbox), prog, note_shown, plan_assigned, plan_first[:80], done_state, rep])

    # ---------- 10. Completion visible to the administrator after the next share ----------
    co(admin, 'people'); admin.set_input_files('#co-share-file', [str(share2)]); settle(admin); admin.wait_for_selector('[data-share-import=ok]')
    hist = admin.inner_text(f'[data-person="{EMPKEY}"]'); n_shares = len(store(admin, 'company_shares'))
    co(admin, 'assignments')
    row = lambda aid, key: {a: admin.get_attribute(f'[data-assignment="{aid}"] [data-assignee="{key}"]', 'data-' + a) for a in ('state', 'due', 'awaiting')}
    c_row = row(a_course['id'], EMPKEY); l_rowA = row(a_lab['id'], EMPKEY); l_rowB = row(a_lab['id'], 'EMP-TEST-B')
    c_card = admin.get_attribute(f'[data-assignment="{a_course["id"]}"]', 'data-due'); totals = {a: admin.get_attribute('[data-assignments]', 'data-' + a) for a in ('assignments', 'completed', 'overdue', 'due-soon', 'awaiting')}
    tcsv = raw(dl(admin, '[data-action=tracker-csv]'))
    admin.click(f'[data-assignment="{a_lab["id"]}"] [data-action=cancel-assignment]'); admin.click('dialog .btn-danger'); settle(admin)
    cancelled = admin.locator(f'[data-assignment="{a_lab["id"]}"]').count() == 0 and next(a for a in store(admin, 'company_assignments') if a['id'] == a_lab['id'])['cancelled'] is True
    record('follow-up: the newer share becomes current (the older one stays on file); the course shows completed for the employee, the lab shows not started for her and "awaiting next share" for the others; totals, tracker CSV; an assignment can be cancelled',
           n_shares == 4 and '2 shares on file' in hist and c_row == {'state': 'completed', 'due': 'completed', 'awaiting': 'false'} and l_rowA == {'state': 'not_started', 'due': 'due_soon', 'awaiting': 'false'} and l_rowB['awaiting'] == 'true' and c_card == 'completed'
           and totals == {'assignments': '3', 'completed': '1', 'overdue': '1', 'due-soon': '3', 'awaiting': '3'} and tcsv.startswith('﻿') and 'Awaiting next share' in tcsv and 'Completed' in tcsv and cancelled, [n_shares, c_row, l_rowA, l_rowB, c_card, totals, cancelled])

    # ---------- 11. Withdrawal: deleting a share removes the person everywhere ----------
    co(admin, 'people'); admin.click('[data-person="EMP-TEST-B"] [data-action=delete-share]'); body = admin.inner_text('dialog'); admin.click('dialog .btn-danger'); settle(admin)
    ppl = admin.get_attribute('[data-people-count]', 'data-people-count'); left = [s['employee_key'] for s in store(admin, 'company_shares')]
    co(admin, 'matrix'); mrows = admin.get_attribute('table.co-mx', 'data-rows'); gone = admin.locator('tr[data-row="EMP-TEST-B"]').count()
    co(admin, 'assignments'); wd = admin.locator('[data-assignment="ASG-TEST-OVERDUE"] [data-assignee="EMP-TEST-B"]').inner_text()
    pp(emp); emp.locator('[data-action=withdraw-share]').first.click(); wbody = emp.inner_text('dialog'); emp.click('dialog .btn-primary'); settle(emp)
    marked = emp.locator('[data-share][data-withdrawn=true]').count()
    record('withdrawal: the administrator deletes a person\'s shares and they leave the people list, the matrix and the analysis (their assignment row says "share withdrawn"); the employee is told honestly how withdrawal works and can mark a share as withdrawn in their own record',
           'disappears from the matrix' in body and ppl == '2' and 'EMP-TEST-B' not in left and mrows == '2' and gone == 0 and 'Share withdrawn' in wd and 'cannot delete a file that you already sent' in wbody and marked == 1, [ppl, left, mrows, gone, wd, marked])

    # ---------- 12. Workspace backup → a fresh browser; sample company ----------
    co(admin, 'setup'); backup = dl(admin, '[data-action=company-backup]'); bk = json.loads(backup.read_text(encoding='utf-8'))
    fctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True); fresh = fctx.new_page(); watch(fresh, logs)
    as_admin(fresh); co(fresh, 'setup')
    fresh.set_input_files('#co-backup-file', str(share1)); fresh.wait_for_selector('[data-company-import=error]')
    fresh.set_input_files('#co-backup-file', str(backup)); fresh.wait_for_selector('[data-company-import=ok]'); restored = fresh.get_attribute('[data-company-import]', 'data-added')
    fresh.set_input_files('#co-backup-file', str(backup)); fresh.wait_for_function('() => document.querySelector("[data-company-import]")?.dataset.added === "0"')
    same = (store(fresh, 'company_profile')[0]['name'], len(store(fresh, 'company_shares')), len(store(fresh, 'company_departments')), len(store(fresh, 'company_roles')))
    co(fresh, 'matrix'); frows = fresh.get_attribute('table.co-mx', 'data-rows')
    co(fresh, 'setup'); fresh.click('[data-action=clear-company]'); fresh.click('dialog .btn-danger'); settle(fresh)
    cleared = all(len(store(fresh, k)) == 0 for k in ('company_profile', 'company_shares', 'company_departments', 'company_roles', 'company_people', 'company_assignments'))
    go(fresh, '/company'); fresh.click('[data-action=load-sample]'); settle(fresh); fresh.wait_for_selector('table.co-mx')
    s_rows = int(fresh.get_attribute('table.co-mx', 'data-rows')); s_badge = fresh.locator('[data-sample=company]').count(); s_people = fresh.get_attribute('[data-company]', 'data-people')
    wide = []
    for w in (390, 1280):  # a wide right-to-left matrix must scroll inside its own wrapper, never stretch the page
        fresh.set_viewport_size({'width': w, 'height': 900}); co(fresh, 'matrix', 'ar')
        wide.append(fresh.evaluate('document.documentElement.scrollWidth - window.innerWidth'))
        fresh.locator('table.co-mx').scroll_into_view_if_needed(); wide.append(fresh.evaluate('Math.abs(window.scrollX)'))
    fresh.set_viewport_size({'width': 1280, 'height': 900})
    co(fresh, 'tna'); s_needs = fresh.locator('[data-tna=company] [data-need]').count()
    co(fresh, 'plan'); s_csv = raw(dl(fresh, '[data-action=plan-csv]'))
    co(fresh, 'setup'); fresh.click('[data-action=remove-sample]'); settle(fresh)
    s_gone = len(store(fresh, 'company_shares')) == 0 and len(store(fresh, 'company_profile')) == 0 and fresh.locator('[data-empty=company]').count() == 1
    record('backup and sample: the workspace backup (cia.company.v1) restores into a fresh browser once and never overwrites; a foreign file is refused; the workspace can be cleared; the labelled sample company gives a heatmap for at least five fictional employees and a TNA export, and is removed in one action; the wide Arabic matrix scrolls inside its wrapper at 390 and 1280 px',
           bk['schema'] == 'cia.company.v1' and int(restored) >= 8 and same == ('Najm Industrial Services', 3, 2, 1) and frows == '2' and cleared and wide == [0, 0, 0, 0] and s_rows >= 5 and s_badge == 1 and int(s_people) >= 5 and s_needs > 0 and 'Sample' in s_csv and s_gone,
           [bk['schema'], restored, same, frows, cleared, wide, s_rows, s_badge, s_needs, s_gone])
    fctx.close()

    # ---------- 13. Responsive, redirects, one h1 ----------
    issues = []
    ADMIN_PAGES = [f'/company?tab={t}' for t in ('overview', 'setup', 'people', 'matrix', 'tna', 'plan', 'assignments')] + ['/company/plan']
    EMP_PAGES = ['/my?tab=passport&p=company', '/my?tab=progress', '/my?tab=path']
    for w, hgt in [(390, 800), (768, 1024), (1280, 900), (1920, 1080)]:
        for lang in ('ar', 'en'):
            for pg, routes, extra in ((admin, ADMIN_PAGES, ''), (emp, EMP_PAGES, '&dev=0')):
                pg.set_viewport_size({'width': w, 'height': hgt}); n0 = len(logs)
                for r in routes:
                    go(pg, r, lang, extra)
                    over = pg.evaluate('document.documentElement.scrollWidth - window.innerWidth'); h1s = pg.locator('main h1').count()
                    if over > 1 or h1s != 1: issues.append(f'{lang}@{w} {r} overflow {over} h1 {h1s}')
                if len(logs) > n0: issues.append(f'{lang}@{w} console {logs[n0:n0 + 2]}')
    admin.set_viewport_size({'width': 1440, 'height': 900}); emp.set_viewport_size({'width': 1280, 'height': 900})
    go(emp, '/me', extra='&dev=0'); redirected = '/my' in emp.evaluate('location.hash')
    go(emp, '/company/plan', extra='&dev=0'); guard = "isn't available for your role" in emp.inner_text('main h1')
    record('responsive: 8 workspace pages and 3 employee pages × 4 widths × AR/EN — one h1, no horizontal page overflow, no console messages; an old address still redirects; the plan print view is role-guarded', not issues and redirected and guard, issues[:6])

    # ---------- 14. Accessibility ----------
    ax = []
    for theme in ('light', 'dark'):
        for pg, routes, extra, w, lang in ((admin, ADMIN_PAGES, '', 1280, 'en'), (admin, ADMIN_PAGES[3:6], '', 390, 'ar'), (emp, EMP_PAGES[:2], '&dev=0', 1280, 'en'), (emp, EMP_PAGES[:1], '&dev=0', 390, 'ar')):
            pg.set_viewport_size({'width': w, 'height': 900})
            for r in routes:
                go(pg, r, lang, extra); pg.evaluate(f'document.documentElement.dataset.theme = "{theme}"'); pg.wait_for_timeout(120)
                for v in axe(pg): ax.append(f'{theme} {lang}@{w} {r}: {v["id"]} ×{v["n"]} {v["t"]}')
    admin.set_viewport_size({'width': 1440, 'height': 900})
    co(admin, 'matrix'); admin.click('td.co-cell button >> nth=0'); admin.evaluate('document.documentElement.dataset.theme = "light"')
    for v in axe(admin): ax.append(f'cell dialog: {v["id"]} ×{v["n"]} {v["t"]}')
    admin.click('dialog .btn-primary')
    record('axe-core WCAG 2.1 A/AA + best practice: 0 violations on every workspace tab, the plan print view, the matrix cell dialog, the share tab and Progress (EN@1280, AR@390, light + dark)', not ax, ' | '.join(ax[:4]))

    # ---------- 15. Console and storage keys ----------
    record('no console errors or warnings during the Phase 12A journeys', not logs, logs[:5])
    keys = sorted(set(admin.evaluate('Object.keys(localStorage)') + emp.evaluate('Object.keys(localStorage)')))
    bad_keys = [k for k in keys if not (k.startswith('cia:v1:') or k == 'cia-lang')]
    need = ['company_profile', 'company_departments', 'company_roles', 'company_people', 'company_shares', 'company_assignments', 'company_plan', 'passport_shares', 'assignments_inbox']
    record('storage: only cia:v1:* and cia-lang are written; the workspace is the administrator\'s own cia:v1:<user>:company_* record and the employee keeps passport_shares and assignments_inbox', not bad_keys and all(f'cia:v1:local:{k}' in keys for k in need), [bad_keys, [k for k in need if f'cia:v1:local:{k}' not in keys]])
    b.close()
finally:
    srv.terminate()

# ---------- 16. Hub and toolkit integrity ----------
base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = [f for h, f in (l.split(maxsplit=1) for l in base.read_text().splitlines()) if (PLATFORM / f).exists() and hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest() != h]
    record('integrity: hub and toolkit files byte-identical to the baseline apart from the D-08 and D-22 patches (index.html, sw.js)', set(changed) <= {'index.html', 'sw.js'}, changed)

# ---------- 17. Plan §5 measurements still within target ----------
r = subprocess.run([sys.executable, str(ACADEMY / 'tests' / 'e2e' / 'measure_phase10a.py'), '--label', 'phase12a'], capture_output=True, text=True, timeout=600)
try:
    m = json.loads((ACADEMY / 'tests' / 'e2e' / 'out' / 'measure-phase12a.json').read_text(encoding='utf-8'))
    ok = m['top_nav_items'] == 5 and m['home_height'] <= 2700 and m['assessments_screens_1440x900'] <= 4 and m['first_load_json_gzip'] <= 400_000 and m['phase_wording'] == 0 and m['empty_personal_pages'] == 0
    record('plan §5 measurements: 5 top items, home ≤ 2,700 px, assessments ≤ 4 screens, first load ≤ 0.4 MB compressed, no learner-visible "Phase", 0 empty personal pages', ok,
           {k: m[k] for k in ['top_nav_items', 'home_height', 'assessments_screens_1440x900', 'first_load_json_gzip', 'phase_wording', 'empty_personal_pages']})
except Exception as e:
    record('plan §5 measurements', False, f'{e} {r.stderr[-300:]}')

passed = sum(r['ok'] for r in results)
(EVID / 'e2e-phase12a-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
