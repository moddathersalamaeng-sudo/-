#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 12 suite (Professional Passport, CPD, wallet, practice logs, career roadmap). Playwright + axe-core.

Passport from an empty state (no dead end, every section has a next step); entries appear after a lesson, an assessment, a lab, a
smart-template document and a certificate of completion, each with the right evidence status; a written lab task stays awaiting
review until a named reviewer scores it on the reviewer screen, which changes the competency evidence; reviewer verification of a
document and of an external credential (wallet: self-declared → evidence → pending → issuer record checked, never "verified by
CIA"); CPD add with invalid input, edit, delete, confirmed suggestion, totals, CSV export; auditor / consultant / trainer logs;
roadmap with milestones and saved plan; CV builder (Word, text, print); print view; JSON backup → import into a fresh browser (never overwrites); responsive
390 / 768 / 1280 / 1920; axe light + dark; console; storage keys; hub / toolkit integrity; plan §5 measurements.
Usage: python3 tests/e2e/run_e2e_phase12.py [--evidence DIR]
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request, hashlib
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
AXE = (ACADEMY / 'tests' / 'vendor' / 'axe.min.js').read_text(encoding='utf-8')
SEED = lambda f: json.loads((ACADEMY / 'data' / 'seed' / f).read_text(encoding='utf-8'))['items']
LABS = SEED('labs.json'); TPLS = SEED('smart-templates.json'); COURSES = SEED('courses.json')
NCR = next(t for t in TPLS if t['slug'] == 'ncr')
LAB = next(l for l in LABS if l['id'] == 'LAB-NC-WRITE')
COURSE = next(c for c in COURSES if c['id'] == 'CRS-ISO-AUD')
LESSONS = [l['id'] for m in COURSE['modules'] for l in m['lessons']]
TODAY = time.strftime('%Y-%m-%d')


def perfect(l):
    out = {}
    for t in l['tasks']:
        ty = t['type']
        out[t['id']] = (t['correct'] if ty == 'single_choice' else [o['id'] for o in t['options'] if o['correct']] if ty == 'multi_select'
                        else [x['id'] for x in t['items']] if ty == 'ordering' else {x['id']: x['category'] for x in t['items']} if ty == 'classify'
                        else str(t['answer']) if ty == 'numeric' else 'Requirement 7.1.5 needs calibrated equipment; gauge G-14 was used on 3 batches after its calibration expired on 2 Oct; the organisation did not ensure valid results. ' * 2)
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
    results.append({'test': name, 'ok': bool(ok), 'detail': str(detail)[:700]})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''))

def watch(page):
    logs = []
    page.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') and (m.location or {}).get('url', BASE).startswith(BASE) else None)
    page.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
    return logs

def settle(page):
    page.wait_for_selector('html[data-ready]')
    page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=20000)
    page.wait_for_timeout(250)

def go(page, route, lang='en', extra='&dev=0', reload=False):
    page.goto(f'{BASE}/academy/?lang={lang}{extra}#{route}')
    if reload: page.reload()
    settle(page)

def pp(page, tab, lang='en', extra='&dev=0'):
    go(page, f'/my?tab=passport&p={tab}', lang, extra)
    page.wait_for_selector(f'[role=tabpanel][data-panel=pp-{tab}]:not([hidden])'); settle(page)

def axe(page):
    page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")

def store(page, key):
    raw = page.evaluate(f'localStorage.getItem("cia:v1:local:{key}")')
    return (json.loads(raw) if raw else {'items': []})['items']

def put(page, key, items):
    page.evaluate('([k, v]) => localStorage.setItem(k, JSON.stringify({ schema: 1, updatedAt: new Date().toISOString(), items: v }))', [f'cia:v1:local:{key}', items])

def status_of(page, key):
    return page.get_attribute(f'[data-entry="{key}"]', 'data-status')

def as_reviewer(page):
    page.evaluate('localStorage.setItem("cia:v1:session", JSON.stringify({ roles: ["reviewer"] }))')

def as_learner(page):
    page.evaluate('localStorage.removeItem("cia:v1:session")')

try:
  with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True); page = ctx.new_page(); logs = watch(page)

    # ---------- 1. Empty state: no dead end ----------
    go(page, '/my')
    tab_ok = page.locator('[role=tab][data-tab=passport]').count() == 1
    pp(page, 'overview')
    empty = page.locator('[data-empty=passport]').count() == 1
    starts = [page.locator(f'[data-panel=pp-overview] [data-action={a}]').count() for a in ('start-course', 'open-labs', 'add-cpd', 'add-credential')]
    label = 'not a certification' in page.inner_text('[data-passport-label]')
    rules = page.locator('[data-rules=statuses] dt').count()
    dead = []
    for k in ['competencies', 'cpd', 'wallet', 'logs', 'career', 'cv', 'export']:
        pp(page, k)
        panel = page.locator(f'[data-panel=pp-{k}]')
        if not (panel.locator('a[href], button, input, select').count() > 0): dead.append(k)
    pp(page, 'career'); career_cta = page.locator('[data-roadmap=no-role] [data-action=set-target-role]').count()
    record('passport from an empty state: My space → Passport tab, guidance with four next steps, honest label, the five statuses explained, every section has a control (no dead end), roadmap asks for a target role',
           tab_ok and empty and all(starts) and label and rules == 5 and not dead and career_cta == 1, f'{tab_ok} {empty} {starts} {label} {rules} {dead} {career_cta}')

    # ---------- 2. Entries appear after a lesson, an assessment, a lab, a document and a certificate ----------
    go(page, f'/academy/courses/{COURSE["slug"]}/{LESSONS[0].split("-")[-1]}')
    page.click('[data-action=toggle-complete]'); page.wait_for_timeout(300)
    pp(page, 'overview')
    lesson_entry = status_of(page, f'course:{COURSE["id"]}')
    # lab: answer every task through the draft, submit in the UI (written task stays awaiting review)
    put(page, 'lab_drafts', [{'id': LAB['id'], 'answers': perfect(LAB), 'self_check': {}, 'updated_at': '2026-11-12T08:00:00Z'}])
    go(page, f'/labs/{LAB["slug"]}', reload=True); page.click('[data-action=submit-lab]'); page.wait_for_selector('.lab-result'); settle(page)
    att = store(page, 'lab_attempts')[0]
    # document: NCR through the template UI
    go(page, '/templates/ncr'); page.click('[data-action=new-doc]'); page.wait_for_selector('.tpl-editor')
    page.fill('#tpl-title', 'NCR — calibration gauge G-14')
    for q in NCR['questions']:
        sel = f'#tq-{q["id"]}'
        if q['type'] == 'select': page.select_option(sel, q['options'][0]['value'])
        elif q['type'] == 'date': page.fill(sel, TODAY)
        elif q['type'] == 'number': page.fill(sel, '3')
        else: page.fill(sel, f'{q["id"]} text')
    for c in [c for c in NCR['table']['columns'] if c['type'] != 'computed']:
        sel = f'#tr-0-{c["id"]}'
        if c['type'] == 'select': page.select_option(sel, c['options'][-1]['value'])
        elif c['type'] == 'date': page.fill(sel, TODAY)
        else: page.fill(sel, f'{c["id"]} cell')
    page.click('[data-action=save-version]'); page.wait_for_timeout(300)
    doc = store(page, 'smart_documents')[0]
    # course completion + final passed, then the certificate of completion through the UI
    put(page, 'course_progress', [{'id': COURSE['id'], 'completed_lessons': LESSONS, 'exercise_notes': {}, 'updated_at': '2026-11-12T08:00:00Z'}])
    put(page, 'assessment_attempts', [{'id': 'a1', 'assessment_id': COURSE['assessments']['final'], 'attempt_no': 1, 'submitted_at': '2026-11-12T08:00:00Z', 'answers': {}, 'score': 90, 'passed': True,
                                       'pending_review': 0, 'unknown': 0, 'competency_breakdown': {'AUD-01': {'earned': 9, 'max': 10, 'percent': 90, 'items': 3}}, 'domain_breakdown': {}, 'detail': [{'auto': True}]}])
    go(page, f'/certificate/{COURSE["slug"]}', reload=True); page.fill('#cert-name', 'Test Learner'); page.click('[data-action=make-certificate]'); page.wait_for_timeout(300)
    pp(page, 'overview')
    st = {k: status_of(page, k) for k in [f'course:{COURSE["id"]}', f'assessment:{COURSE["assessments"]["final"]}', f'lab:{att["id"]}', f'document:{doc["id"]}', f'certificate:{COURSE["id"]}']}
    awaiting = 'awaiting review' in page.inner_text(f'[data-entry="lab:{att["id"]}"]')
    counts = {s: int(page.inner_text(f'[data-count={s}] strong')) for s in ['self_declared', 'course_assessed', 'platform_assessed', 'reviewer_verified', 'externally_certified']}
    page.select_option('#pp-f-status', 'platform_assessed'); filt = int(page.get_attribute('.pp-entries', 'data-shown'))
    record('entries appear after a lesson (self-declared), an assessment and a lab (platform-assessed, written task awaiting review), a document (self-declared), a completed course and its certificate (course-assessed); counts and filter agree',
           lesson_entry == 'self_declared' and st == {f'course:{COURSE["id"]}': 'course_assessed', f'assessment:{COURSE["assessments"]["final"]}': 'platform_assessed', f'lab:{att["id"]}': 'platform_assessed',
                                                      f'document:{doc["id"]}': 'self_declared', f'certificate:{COURSE["id"]}': 'course_assessed'} and awaiting and att['pending_review'] >= 1 and filt == counts['platform_assessed'] == 2,
           f'{lesson_entry} {st} {awaiting} {counts} {filt}')

    # ---------- 3. CPD: invalid, add, edit, suggestion, delete, totals, CSV ----------
    pp(page, 'cpd')
    page.fill('#cpd-hours', '0'); page.click('[data-action=save-cpd]'); page.wait_for_timeout(150)
    inv = page.locator('[data-panel=pp-cpd] .errsum:not([hidden]) li').count()
    aria = page.get_attribute('#cpd-title', 'aria-invalid') == 'true' and page.get_attribute('#cpd-hours', 'aria-invalid') == 'true'
    page.fill('#cpd-title', 'Risk-based auditing workshop'); page.select_option('#cpd-category', 'workshop'); page.fill('#cpd-date', '2026-10-15'); page.fill('#cpd-hours', '٣٫٥'); page.fill('#cpd-provider', 'Regional QA forum')
    page.fill('#cpd-evidence_url', 'javascript:alert(1)'); page.click('[data-action=save-cpd]'); page.wait_for_timeout(150)
    url_err = page.get_attribute('#cpd-evidence_url', 'aria-invalid') == 'true'
    page.fill('#cpd-evidence_url', 'https://example.org/attendance.pdf'); page.click('[data-action=save-cpd]'); pp(page, 'cpd')
    saved = store(page, 'cpd')
    page.click('[data-action=edit-cpd]'); page.fill('#cpd-hours', '4'); page.click('[data-action=save-cpd]'); pp(page, 'cpd')
    edited = store(page, 'cpd')
    sugg = page.locator('[data-suggestion]').count()
    page.click(f'[data-suggestion="course:{COURSE["id"]}"] [data-action=confirm-suggestion]'); pp(page, 'cpd')
    after_conf = store(page, 'cpd'); sugg2 = page.locator('[data-suggestion]').count()
    if sugg2: page.click('[data-suggestion] [data-action=dismiss-suggestion]'); pp(page, 'cpd')
    sugg3 = page.locator('[data-suggestion]').count()
    total = float(page.get_attribute('[data-cpd-total]', 'data-cpd-total'))
    with page.expect_download() as dl: page.click('[data-action=cpd-csv]')
    csv = pathlib.Path(dl.value.path()).read_bytes().decode('utf-8')
    conf_status = page.get_attribute(f'[data-cpd="{next(x["id"] for x in after_conf if x.get("source"))}"] .ev-badge', 'data-ev')
    record('CPD log: invalid input listed and marked; unsafe link refused; Arabic digits accepted; edit; a completed-course suggestion confirmed (inherits course-assessed), the lab one dismissed; totals; CSV with BOM; honesty note',
           inv >= 3 and aria and url_err and len(saved) == 1 and saved[0]['hours'] == 3.5 and edited[0]['hours'] == 4 and len(edited) == 1 and sugg == 2 and len(after_conf) == 2 and sugg2 == 1 and sugg3 == 0
           and total == 4 + COURSE['training_hours'] and csv.startswith('﻿') and 'Risk-based auditing workshop' in csv and conf_status == 'course_assessed'
           and 'does not award recognised CPD' in page.inner_text('[data-cpd-note]'),
           f'{inv} {aria} {url_err} {[x["hours"] for x in saved]} {[x["hours"] for x in edited]} {sugg} {len(after_conf)} {sugg2} {sugg3} {total} {conf_status}')
    page.click(f'[data-cpd="{edited[0]["id"]}"] [data-action=delete-cpd]'); page.click('dialog [data-variant=danger], dialog .btn-danger'); pp(page, 'cpd')
    deleted = len(store(page, 'cpd')) == 1
    record('CPD activity deleted through the in-page dialog (no browser confirm)', deleted, store(page, 'cpd'))

    # ---------- 4. Wallet ----------
    pp(page, 'wallet')
    cia_row = page.locator('[data-wallet=cia]').count()
    page.click('[data-action=save-credential]'); page.wait_for_timeout(150)
    cr_err = page.locator('[data-panel=pp-wallet] .errsum:not([hidden]) li').count()
    page.select_option('#cr-type', 'professional_cert'); page.fill('#cr-name', 'Lead Auditor — Quality Management Systems'); page.fill('#cr-issuer', 'Example Certification Body')
    page.fill('#cr-issued', '2024-03-01'); page.fill('#cr-expires', '2027-02-28'); page.fill('#cr-verify_url', 'http://insecure.example/check'); page.click('[data-action=save-credential]'); page.wait_for_timeout(150)
    http_err = page.get_attribute('#cr-verify_url', 'aria-invalid') == 'true'
    page.fill('#cr-verify_url', 'https://issuer.example/verify/LA-123'); page.click('[data-action=save-credential]'); pp(page, 'wallet')
    s1 = page.get_attribute('[data-credential]', 'data-state')
    page.click('[data-action=edit-credential]'); page.fill('#cr-evidence_note', 'Certificate scan kept in my records'); page.click('[data-action=save-credential]'); pp(page, 'wallet')
    s2 = page.get_attribute('[data-credential]', 'data-state')
    page.click('[data-action=request-verification]'); pp(page, 'wallet')
    s3 = page.get_attribute('[data-credential]', 'data-state')
    link = page.get_attribute('[data-action=verify-at-issuer]', 'href'); rel = page.get_attribute('[data-action=verify-at-issuer]', 'rel')
    wallet_txt = page.inner_text('[data-panel=pp-wallet]')
    record('wallet: CIA certificate listed; empty save blocked; http verification link refused; Self-declared → Evidence added → Pending verification; "Verify at the issuer" opens the issuer\'s https page; no "verified by CIA" anywhere',
           cia_row == 1 and cr_err >= 4 and http_err and (s1, s2, s3) == ('self_declared', 'evidence_uploaded', 'pending_verification') and link == 'https://issuer.example/verify/LA-123' and 'noopener' in (rel or '')
           and 'verified by cia' not in wallet_txt.lower() and 'CIA never verifies' in wallet_txt, f'{cia_row} {cr_err} {http_err} {(s1, s2, s3)} {link} {rel}')

    # ---------- 5. Practice logs ----------
    pp(page, 'logs')
    page.click('[data-action=save-log-auditor]'); page.wait_for_timeout(150)
    lg_err = page.locator('[data-log-kind=auditor] .errsum:not([hidden]) li').count()
    page.select_option('#lg-auditor-audit_type', 'internal'); page.fill('#lg-auditor-standard', 'ISO 9001:2015'); page.select_option('#lg-auditor-role', 'lead'); page.fill('#lg-auditor-days', '2'); page.fill('#lg-auditor-findings', '3'); page.fill('#lg-auditor-date', '2026-10-01')
    page.click('[data-action=save-log-auditor]'); pp(page, 'logs')
    page.click('[data-log-kind=consultant] summary'); page.fill('#lg-consultant-project', 'QMS implementation — packaging plant'); page.select_option('#lg-consultant-role', 'lead'); page.fill('#lg-consultant-months', '6'); page.fill('#lg-consultant-date', '2026-09-01')
    page.fill('#lg-consultant-evidence_note', 'Client acceptance letter on file'); page.click('[data-action=save-log-consultant]'); pp(page, 'logs')
    page.click('[data-log-kind=trainer] summary'); page.fill('#lg-trainer-course', 'Internal auditor training'); page.fill('#lg-trainer-hours', '16'); page.fill('#lg-trainer-participants', '12'); page.fill('#lg-trainer-date', '2026-08-01')
    page.fill('#lg-trainer-evidence_url', 'https://example.org/attendance-list.pdf'); page.click('[data-action=save-log-trainer]'); pp(page, 'logs')
    logs_saved = store(page, 'practice_logs')
    states = sorted(page.eval_on_selector_all('[data-log]', 'els => els.map(e => e.dataset.state)'))
    record('practice logs: auditor entry needs its required fields; auditor, consultant and trainer entries saved; self-declared vs evidence added shown',
           lg_err >= 4 and len(logs_saved) == 3 and states == ['evidence_uploaded', 'evidence_uploaded', 'self_declared'], f'{lg_err} {len(logs_saved)} {states}')

    # ---------- 6. Reviewer: score the written lab task, verify a document, a credential, a log and a competency ----------
    as_reviewer(page)
    go(page, '/review', extra=''); rv_link = page.locator('[data-action=open-evidence-review]').count()
    go(page, '/review/evidence', extra='')
    limit = page.locator('[data-review-limit]').count() == 1
    pending0 = int(page.get_attribute('.pp-reviewer', 'data-pending-attempts'))
    w = next(t for t in LAB['tasks'] if t['type'] == 'free_text')
    page.fill('#ev-name', ''); page.fill(f'[data-review-attempt="{att["id"]}"] [data-score="{w["id"]}"]', str(w['weight']))
    page.click(f'[data-review-attempt="{att["id"]}"] [data-action=record-scores]'); page.wait_for_timeout(150)
    unnamed = page.get_attribute('#ev-name', 'aria-invalid') == 'true' and store(page, 'lab_attempts')[0]['pending_review'] == att['pending_review']
    page.fill('#ev-name', 'Sara Reviewer'); page.fill('#ev-role', 'Lead auditor'); page.fill('#ev-date', TODAY)
    page.fill(f'[data-review-attempt="{att["id"]}"] [data-score="{w["id"]}"]', str(w['weight'] + 5)); page.click(f'[data-review-attempt="{att["id"]}"] [data-action=record-scores]'); page.wait_for_timeout(150)
    over = store(page, 'lab_attempts')[0]['pending_review'] == att['pending_review']
    page.fill(f'[data-review-attempt="{att["id"]}"] [data-score="{w["id"]}"]', str(w['weight'])); page.click(f'[data-review-attempt="{att["id"]}"] [data-action=record-scores]'); settle(page)
    rev = store(page, 'lab_attempts')[0]
    ev_changed = rev['competency_breakdown'] != att['competency_breakdown'] or rev['max'] > att['max']
    reviewed_ok = rev['pending_review'] == 0 and rev['reviews'][w['id']]['reviewer'] == 'Sara Reviewer' and rev['reviews'][w['id']]['date'] == TODAY and rev['id'] == att['id'] and rev['submitted_at'] == att['submitted_at']
    def verify(key, method, decision='verified'):
        row = page.locator(f'[data-verify="{key}"]')
        row.locator('select[data-method]').select_option(method); row.locator('select[data-decision]').select_option(decision)
        row.locator('[data-action=record-verification]').click(); settle(page)
    verify(f'document:{doc["id"]}', 'document_review')
    cred = store(page, 'credentials')[0]
    verify(f'credential:{cred["id"]}', 'issuer_check')
    aud = next(x for x in logs_saved if x['kind'] == 'auditor')
    verify(f'log:{aud["id"]}', 'work_sample')
    trails = page.locator(f'[data-trail="{cred["id"]}"] li').count()
    record('reviewer screen (reviewer role, this device only): an unnamed or out-of-range score changes nothing; a named score with an ISO date reviews the written task, keeps the attempt and changes the competency evidence; document, credential and auditor-log decisions recorded; credential audit trail visible',
           rv_link == 1 and limit and pending0 == 1 and unnamed and over and reviewed_ok and ev_changed and len(store(page, 'passport_verifications')) == 3 and trails >= 4,
           f'{rv_link} {limit} {pending0} {unnamed} {over} {reviewed_ok} {ev_changed} {len(store(page, "passport_verifications"))} {trails}')
    # competency verification (needs a target role) — set the profile through storage, then confirm a level
    put(page, 'profile', [{'id': 'me', 'current_role': 'Quality Engineer', 'target_role': 'ROLE-IA', 'weekly_hours': '4', 'goal': 'standard', 'updated': '2026-11-12T08:00:00Z'}])
    go(page, '/review/evidence', extra='', reload=True)
    row = page.locator('[data-verify-comp="AUD-03"]'); row.locator('select[data-verify-level]').select_option('3'); row.locator('[data-action=verify-competency]').click(); settle(page)
    comp_v = any(v['target_kind'] == 'competency' and v['level'] == 3 for v in store(page, 'passport_verifications'))
    as_learner(page)
    pp(page, 'overview')
    st2 = {k: status_of(page, k) for k in [f'lab:{att["id"]}', f'document:{doc["id"]}', f'credential:{cred["id"]}', f'log:{aud["id"]}']}
    lab_txt = page.inner_text(f'[data-entry="lab:{att["id"]}"]')
    pp(page, 'wallet'); s4 = page.get_attribute('[data-credential]', 'data-state'); wtxt = page.inner_text(f'[data-credential="{cred["id"]}"]')
    pp(page, 'competencies'); crow = page.inner_text('[data-comp-row=AUD-03]').strip(); cst = page.locator('tr:has([data-comp-row=AUD-03]) .ev-badge').get_attribute('data-ev')
    record('after review the learner sees: lab entry with the written task scored by the named reviewer (no longer awaiting), document reviewer-verified, credential "issuer record checked" and externally certified (certified by the issuer, not CIA), auditor log reviewer-verified, AUD-03 reviewer-verified at level 3',
           comp_v and st2 == {f'lab:{att["id"]}': 'platform_assessed', f'document:{doc["id"]}': 'reviewer_verified', f'credential:{cred["id"]}': 'externally_certified', f'log:{aud["id"]}': 'reviewer_verified'}
           and 'Sara Reviewer' in lab_txt and 'awaiting' not in lab_txt and s4 == 'verified' and 'not by CIA' in wtxt and cst == 'reviewer_verified',
           f'{comp_v} {st2} {s4} {cst} {crow[:40]}')

    # ---------- 7. Competency record, radar and career roadmap ----------
    pp(page, 'competencies')
    radar = page.locator('[data-panel=pp-competencies] .radar svg').count() == 1
    rows = page.locator('[data-comp-row]').count()
    pp(page, 'career')
    ms = int(page.get_attribute('[data-roadmap=ready]', 'data-milestones') or 0)
    actions = page.locator('[data-milestone] [data-action=course] a, [data-milestone] [data-action=lab] a').count()
    one_route = 'not the only correct one' in page.inner_text('[data-panel=pp-career]')
    page.fill('#career-target', '2030-01-01'); fit = page.get_attribute('#career-target-note', 'data-fit')
    page.click('[data-action=save-career]'); page.wait_for_timeout(200)
    page.check('[data-milestone=M1] [data-action=milestone-done]'); settle(page)
    plan = store(page, 'career_plan')
    pp(page, 'career')
    m1_done = page.get_attribute('[data-milestone=M1]', 'data-done') == 'true'
    record('competency record with radar for the target role; career roadmap: current → target role, milestones with course and lab links, "one possible route", target date fits, plan saved, milestone marked done and kept after reload',
           radar and rows >= 4 and ms >= 1 and actions >= 1 and one_route and fit == 'true' and plan and plan[0]['target_date'] == '2030-01-01' and plan[0]['done'] == ['M1'] and m1_done,
           f'{radar} {rows} {ms} {actions} {one_route} {fit} {plan} {m1_done}')

    # ---------- 8. Print view ----------
    go(page, '/passport/print')
    n_entries = int(page.get_attribute('[data-passport-print]', 'data-passport-print'))
    pr_rows = page.locator('.pp-print table').first.locator('tbody tr').count()
    pr_ok = page.locator('h1').count() == 1 and 'not a certification' in page.inner_text('[data-passport-label]') and page.locator('[data-action=print-now]').count() == 1
    record('printable passport summary: one h1, honest label, every entry in the table, competency record, CPD, wallet, logs and roadmap sections, Print button', pr_ok and pr_rows == n_entries and page.locator('.pp-print section').count() >= 6, f'{pr_ok} {pr_rows} {n_entries}')

    # ---------- 8b. CV builder (ADD-12) ----------
    pp(page, 'cv')
    page.fill('#cv-name', ''); page.click('[data-action=save-cv]'); page.wait_for_timeout(150)
    cv_err = page.get_attribute('#cv-name', 'aria-invalid') == 'true' and not store(page, 'cv')
    page.fill('#cv-name', 'Test Learner'); page.fill('#cv-email', 'not-an-email'); page.click('[data-action=save-cv]'); page.wait_for_timeout(150)
    mail_err = page.get_attribute('#cv-email', 'aria-invalid') == 'true'
    page.fill('#cv-email', 'learner@example.org'); page.fill('#cv-summary', 'Quality engineer moving into internal auditing.'); page.click('[data-action=save-cv]'); page.wait_for_timeout(200)
    secs = page.eval_on_selector_all('[data-panel=pp-cv] [data-cv-section]', 'els => els.map(e => e.dataset.cvSection)')
    cv_txt = page.inner_text('[data-panel=pp-cv] .cv-sheet')
    with page.expect_download() as dl: page.click('[data-action=cv-word]')
    word = pathlib.Path(dl.value.path()).read_text(encoding='utf-8')
    with page.expect_download() as dl: page.click('[data-action=cv-text]')
    plain = pathlib.Path(dl.value.path()).read_text(encoding='utf-8-sig')
    page.uncheck('[data-panel=pp-cv] input[name=cv-inc][value=cpd]'); page.click('[data-action=save-cv]'); page.wait_for_timeout(200)
    no_cpd = 'cpd' not in page.eval_on_selector_all('[data-panel=pp-cv] [data-cv-section]', 'els => els.map(e => e.dataset.cvSection)')
    go(page, '/passport/cv'); cv_h1 = page.inner_text('h1') == 'Test Learner' and page.locator('.cv-sheet').count() == 1
    record('CV builder: name and email validated, saved on this device; sections from the passport (assessed competencies, practice, credentials with "issuer record checked", CIA completion, education); Word and plain-text downloads; a section can be left out; printable CV',
           cv_err and mail_err and {'competencies', 'practice', 'credentials', 'learning', 'cpd'} <= set(secs) and 'issuer record checked' in cv_txt and 'Certificate of completion (CIA internal course)' in cv_txt
           and 'verified by cia' not in cv_txt.lower() and '<h1>Test Learner</h1>' in word and plain.startswith('Test Learner') and no_cpd and cv_h1, f'{cv_err} {mail_err} {secs} {no_cpd} {cv_h1}')

    # ---------- 9. Export → import into a fresh browser; never overwrite ----------
    pp(page, 'export')
    with page.expect_download() as dl: page.click('[data-action=passport-json]')
    backup = pathlib.Path(dl.value.path()); bj = json.loads(backup.read_text(encoding='utf-8'))
    tampered = EVID / 'p12-backup-tampered.json'
    bj2 = json.loads(json.dumps(bj)); bj2['data']['verifications'] = store(page, 'passport_verifications'); bj2['data']['cpd'].append({'id': 'x-bad', 'title': '', 'category': 'none'})
    tampered.write_text(json.dumps(bj2), encoding='utf-8')
    c2 = b.new_context(viewport={'width': 1280, 'height': 900}); p2 = c2.new_page(); l2 = watch(p2)
    pp(p2, 'export'); p2.set_input_files('#pp-import', str(tampered)); p2.wait_for_selector('[data-import-result=ok]', timeout=10000)
    added = int(p2.get_attribute('[data-import-result]', 'data-added'))
    no_ver = len(store(p2, 'passport_verifications')) == 0
    p2.set_input_files('#pp-import', str(tampered)); p2.wait_for_timeout(1200); settle(p2)
    again = int(p2.get_attribute('[data-import-result]', 'data-added'))
    bad = EVID / 'p12-not-a-backup.json'; bad.write_text('{"app":"other"}', encoding='utf-8')
    p2.set_input_files('#pp-import', str(bad)); p2.wait_for_selector('[data-import-result=error]')
    pp(p2, 'wallet'); imp_state = p2.get_attribute('[data-credential]', 'data-state')
    record('backup: cia.passport.v1 with the honest label; imported into a fresh browser (CPD, credential, three logs, roadmap), verifications never imported, an invalid row skipped, a second import adds nothing, a foreign file is refused',
           bj['schema'] == 'cia.passport.v1' and 'not a certification' in bj['label'] and added == len(bj['data']['cpd']) + len(bj['data']['credentials']) + len(bj['data']['practice_logs']) and no_ver and again == 0
           and imp_state == 'pending_verification' and len(store(p2, 'career_plan')) == 1 and not l2, f'{added} {no_ver} {again} {imp_state} {l2[:3]}')
    c2.close()

    # ---------- 10. Arabic, storage, console ----------
    pp(page, 'overview', 'ar')
    rtl = page.evaluate('document.documentElement.dir') == 'rtl' and 'الجواز المهني' in page.inner_text('main')
    keys = page.evaluate('Object.keys(localStorage)')
    record('Arabic passport right-to-left; storage holds only cia:v1:* keys and the shared cia-lang', rtl and all(k.startswith('cia:v1:') or k == 'cia-lang' for k in keys), keys)
    record('no console errors or warnings during the Phase 12 journeys', not logs, logs[:5])
    snapshot = {k: page.evaluate(f'localStorage.getItem({json.dumps(k)})') for k in keys}
    (EVID / 'p12-learner-snapshot.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=1), encoding='utf-8')
    ctx.close()

    # ---------- 11. Responsive matrix (with the learner record above) ----------
    mx = []
    routes = ['/my?tab=passport&p=' + k for k in ['overview', 'competencies', 'cpd', 'wallet', 'logs', 'career', 'cv', 'export']] + ['/passport/print', '/passport/cv']
    def seeded(w, scheme='light'):
        cx = b.new_context(viewport={'width': w, 'height': 900}, color_scheme=scheme); pg = cx.new_page()
        pg.goto(BASE + '/academy/?dev=0#/'); pg.evaluate('s => { for (const [k, v] of Object.entries(s)) if (v !== null && k !== "cia:v1:session") localStorage.setItem(k, v); }', snapshot)
        return cx, pg
    for w in [390, 768, 1280, 1920]:
        for lang in ['ar', 'en']:
            cx, pg = seeded(w); lg = watch(pg)
            for r in routes:
                go(pg, r, lang)
                m = pg.evaluate('() => ({ h1: document.querySelectorAll("h1").length, over: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })')
                if m['h1'] != 1 or m['over']: mx.append(f'{lang}@{w}{r}: {m}')
                if w in (390, 1280) and lang == 'ar' and r.endswith(('overview', 'career')): pg.screenshot(path=str(EVID / f'p12-{lang}-{w}-{r.split("=")[-1]}.png'), full_page=True)
            pg.evaluate('localStorage.setItem("cia:v1:session", JSON.stringify({ roles: ["reviewer"] }))')
            go(pg, '/review/evidence', lang, extra='')
            m = pg.evaluate('() => ({ h1: document.querySelectorAll("h1").length, over: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })')
            if m['h1'] != 1 or m['over']:
                wide = pg.evaluate('''() => { const W = document.documentElement.clientWidth; const out = []; for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(); if (r.right > W + 1 || r.left < -1) { let s = e, sc = false; while ((s = s.parentElement)) { if (['auto', 'scroll', 'hidden'].includes(getComputedStyle(s).overflowX)) { sc = true; break; } } out.push((sc ? '[clipped] ' : '') + e.tagName + '.' + String(e.className?.baseVal ?? e.className) + ' ' + Math.round(r.left) + '..' + Math.round(r.right) + ' ' + (e.textContent || '').slice(0, 40)); } } return [document.documentElement.scrollWidth, out.filter(x => !x.startsWith('[clipped]')).slice(0, 4), out.slice(0, 3)]; }''')
                mx.append(f'{lang}@{w}/review/evidence: {m} {wide}')
            if lg: mx.append(f'{lang}@{w} console {lg[:3]}')
            cx.close()
    record(f'responsive: {len(routes) + 1} Phase 12 pages × 4 widths × AR/EN — one h1, no horizontal overflow, no console errors', not mx, mx[:5])

    # ---------- 12. Accessibility ----------
    ax = []
    for scheme in ['light', 'dark']:
        for w, lang in [(390, 'ar'), (1280, 'en')]:
            cx, pg = seeded(w, scheme)
            for r in routes:
                go(pg, r, lang); v = axe(pg)
                if v: ax.append(f'{scheme}/{w}/{lang}{r}: ' + json.dumps(v, ensure_ascii=False))
            go(pg, '/my?tab=passport&p=cpd', lang); pg.fill('#cpd-hours', '0'); pg.click('[data-action=save-cpd]'); pg.wait_for_timeout(150); v = axe(pg)
            if v: ax.append(f'{scheme}/{w}/{lang} cpd errors: ' + json.dumps(v, ensure_ascii=False))
            pg.evaluate('localStorage.setItem("cia:v1:session", JSON.stringify({ roles: ["reviewer"] }))')
            go(pg, '/review/evidence', lang, extra=''); v = axe(pg)
            if v: ax.append(f'{scheme}/{w}/{lang} review: ' + json.dumps(v, ensure_ascii=False))
            cx.close()
        cx = b.new_context(viewport={'width': 1280, 'height': 900}, color_scheme=scheme); pg = cx.new_page()
        go(pg, '/my?tab=passport&p=overview'); v = axe(pg)
        if v: ax.append(f'{scheme} empty passport: ' + json.dumps(v, ensure_ascii=False))
        cx.close()
    record('axe-core WCAG 2.1 A/AA + best practice: 0 violations on every passport section (filled and empty), CPD form errors, print view and the reviewer screen (AR@390, EN@1280, light + dark)', not ax, ' | '.join(ax[:3]))
    b.close()
finally:
    srv.terminate()

# ---------- 13. Hub and toolkit integrity ----------
base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = [f for h, f in (l.split(maxsplit=1) for l in base.read_text().splitlines()) if (PLATFORM / f).exists() and hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest() != h]
    record('integrity: hub and toolkit files byte-identical to the baseline apart from the D-08 and D-22 patches (index.html, sw.js)', set(changed) <= {'index.html', 'sw.js'}, changed)

# ---------- 14. Plan §5 measurements still within target ----------
r = subprocess.run([sys.executable, str(ACADEMY / 'tests' / 'e2e' / 'measure_phase10a.py'), '--label', 'phase12'], capture_output=True, text=True, timeout=600)
try:
    m = json.loads((ACADEMY / 'tests' / 'e2e' / 'out' / 'measure-phase12.json').read_text(encoding='utf-8'))
    ok = m['top_nav_items'] == 5 and m['home_height'] <= 2700 and m['assessments_screens_1440x900'] <= 4 and m['first_load_json_gzip'] <= 400_000 and m['phase_wording'] == 0 and m['empty_personal_pages'] == 0
    record('plan §5 measurements: 5 top items, home ≤ 2,700 px, assessments ≤ 4 screens, first load ≤ 0.4 MB compressed, no learner-visible "Phase", 0 empty personal pages', ok,
           {k: m[k] for k in ['top_nav_items', 'home_height', 'assessments_screens_1440x900', 'first_load_json_gzip', 'phase_wording', 'empty_personal_pages']})
except Exception as e:
    record('plan §5 measurements', False, f'{e} {r.stderr[-300:]}')

passed = sum(r['ok'] for r in results)
(EVID / 'e2e-phase12-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
