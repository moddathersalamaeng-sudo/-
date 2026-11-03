#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 7 end-to-end suite (Playwright + axe-core).

Real browser, real static server over the whole platform root. Covers the ISO Academy learner journey:
governance gating for learners, profile validation + persistence, readiness assessment with "I don't know",
evidence-driven starting point, route skipping, lesson player, catalog filters in the URL, self-levels,
recommendations, the expert review queue + export, storage isolation, responsive matrix, axe and console.
Usage: python3 tests/e2e/run_e2e_phase7.py [--evidence DIR]
Results: <evidence>/e2e-phase7-results.json (only executed checks are recorded).
"""
import json, sys, time, socket, subprocess, pathlib, urllib.request
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
AXE = (ACADEMY / 'tests' / 'vendor' / 'axe.min.js').read_text(encoding='utf-8')
SEED = lambda f: json.loads((ACADEMY / 'data' / 'seed' / f).read_text(encoding='utf-8'))['items']
QUESTIONS = {q['id']: q for q in SEED('questions.json')}
READY = next(a for a in SEED('assessments.json') if a['id'] == 'ASM-READY-ISO-001')
DIAG_SLUG = next(a for a in SEED('assessments.json') if a['id'] == 'ASM-DIAG-001')['slug']  # a future-phase draft
EXPECTED_UNKNOWN = sum(1 for i in READY['question_ids'] if QUESTIONS[i]['type'] in ('single_choice', 'true_false', 'multiple_choice', 'matching') and QUESTIONS[i]['competency'] not in ('ISO-01', 'ISO-02'))
NEW_ROUTES = ['/academy/iso', '/academy/iso/9001', '/academy/courses', '/academy/courses/iso-foundations', '/academy/courses/iso-foundations/L01',
              '/assessments', '/assessments/iso-readiness', '/learning-path?route=ROUTE-IA', '/recommendations', '/profile', '/profile/competencies', '/review', '/knowledge/iso/what-is-iso']

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
    page.wait_for_timeout(400)

def set_roles(page, roles):
    page.goto(BASE + '/academy/'); page.wait_for_selector('html[data-ready]')
    page.evaluate('r => localStorage.setItem("cia:v1:session", JSON.stringify({roles: r}))', roles)

def store(page, collection):
    return page.evaluate('c => { const v = localStorage.getItem("cia:v1:local:" + c); return v ? JSON.parse(v).items : []; }', collection)

def axe(page):
    page.add_script_tag(content=AXE)
    return page.evaluate("async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- A. Learner: governance gating ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = watch(page)
    go(page, '/academy/iso')
    start = page.get_attribute('[data-start]', 'data-start'); cta = page.get_attribute('[data-action=start-point]', 'href')
    record('learner without profile: ISO starting point is "explore" and links to a published article', start == 'explore' and cta == '#/knowledge/iso/what-is-iso', f'{start} {cta}')
    # After the Phase 7 closure the ISO slice is published; future-phase drafts (Phase 8 published the PMI courses; CRS-QMS-201 stays a draft) stay hidden.
    go(page, '/academy/courses')
    published_courses = page.locator('#course-list [data-course]').count() > 0 and page.locator('#course-list [data-course="CRS-QMS-201"]').count() == 0
    go(page, '/academy/courses/' + next(c['slug'] for c in SEED('courses.json') if c['id'] == 'CRS-QMS-201'))
    unavailable = page.locator('[data-unavailable]').count() == 1 and page.locator('main h1').count() == 1
    go(page, '/assessments/' + DIAG_SLUG); asm_hidden = page.locator('[data-unavailable]').count() == 1
    go(page, '/review'); review_forbidden = page.evaluate('document.querySelector("[data-status]")?.dataset.status') == '403'
    record('learner sees published courses but no unreviewed draft (honest "not published yet" pages with one h1) and gets 403 on the review queue', published_courses and unavailable and asm_hidden and review_forbidden, f'{published_courses} {unavailable} {asm_hidden} {review_forbidden}')

    # Profile validation + persistence (learner)
    go(page, '/profile')
    page.click('[data-action=save-profile]'); page.wait_for_timeout(150)
    inv = page.eval_on_selector_all('[data-form=profile] [aria-invalid=true]', 'els => els.map(e => e.name)')
    summary_focused = page.evaluate('document.activeElement.classList.contains("errsum")')
    page.fill('input[name=current_role]', 'Quality engineer'); page.select_option('select[name=target_role]', 'ROLE-IA')
    page.fill('input[name=years_experience]', '99'); page.click('[data-action=save-profile]'); page.wait_for_timeout(150)
    range_err = 'years_experience' in page.eval_on_selector_all('[data-form=profile] [aria-invalid=true]', 'els => els.map(e => e.name)')
    page.fill('input[name=years_experience]', '12'); page.check('input[name=languages][value=ar]'); page.select_option('select[name=exp_audit]', '5to10')
    page.click('[data-action=save-profile]'); page.wait_for_timeout(250)
    saved_ok = page.locator('.oksum').count() == 1
    go(page, '/profile')
    persisted = page.input_value('input[name=current_role]') == 'Quality engineer' and page.input_value('select[name=target_role]') == 'ROLE-IA' and page.is_checked('input[name=languages][value=ar]') and page.input_value('select[name=exp_audit]') == '5to10'
    record('profile: required + range validation with aria-invalid and focused error summary; save persists every field', set(inv) >= {'current_role', 'target_role'} and summary_focused and range_err and saved_ok and persisted, f'{inv} {summary_focused} {range_err} {saved_ok} {persisted}')
    go(page, '/profile/competencies')
    record('learner: competency gap view shows the published framework for the chosen target role', page.locator('main .state.empty').count() == 0 and page.locator('[data-self]').count() > 0)
    go(page, '/academy/iso')
    sp = page.get_attribute('[data-start]', 'data-start'); href = page.get_attribute('[data-action=start-point]', 'href')
    record('learner with profile but no evidence: starting point "assess" links to the published readiness check', sp == 'assess' and href == '#/assessments/iso-readiness', f'{sp} {href}')
    record('no console errors in learner flows', not logs, logs[:3])
    ctx.close()

    # ---------- B. Reviewer: full journey ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True); page = ctx.new_page(); logs = watch(page)
    set_roles(page, ['reviewer'])
    go(page, '/profile'); page.fill('input[name=current_role]', 'Quality engineer'); page.select_option('select[name=target_role]', 'ROLE-IA'); page.click('[data-action=save-profile]'); page.wait_for_timeout(200)
    go(page, '/academy/iso')
    sp = page.get_attribute('[data-start]', 'data-start'); href = page.get_attribute('[data-action=start-point]', 'href')
    no_banner = page.locator('[data-preview]').count() == 0
    go(page, '/academy/courses/' + next(c['slug'] for c in SEED('courses.json') if c['id'] == 'CRS-QMS-201')); banner = page.locator('[data-preview]').count() == 1  # Phase 9 shell (still a draft)
    go(page, '/academy/iso')
    record('reviewer: no preview banner where everything is published, a preview banner on a future-phase draft; starting point "assess" links to the readiness check', sp == 'assess' and href == '#/assessments/iso-readiness' and no_banner and banner, f'{sp} {href} {no_banner} {banner}')

    # Readiness assessment with "I don't know"
    go(page, '/assessments/iso-readiness')
    page.click('[data-action=submit-assessment]'); page.wait_for_timeout(150)
    unanswered = page.locator('.asm-form .errsum li').count(); sum_focus = page.evaluate('document.activeElement.classList.contains("errsum")')
    for qid in READY['question_ids']:
        q = QUESTIONS[qid]
        if q['competency'] in ('ISO-01', 'ISO-02') and q['type'] in ('single_choice', 'true_false'):
            page.check(f'input[name="q-{qid}"][value="{str(q["correct_answer"]).lower() if isinstance(q["correct_answer"], bool) else q["correct_answer"]}"]')
        elif q['type'] in ('single_choice', 'true_false', 'multiple_choice', 'matching'):
            page.check(f'[data-unknown="{qid}"]')
        else:
            page.fill(f'#q-{qid}', 'I would check the calibration record, the equipment ID and which lots were inspected with it.')
    disabled_after_unknown = page.is_disabled(f'input[name="q-Q-RD-05"][value="a"]')
    page.click('[data-action=submit-assessment]'); page.wait_for_timeout(400)
    res = page.locator('#asm-result [data-result]').count() == 1
    att = store(page, 'assessment_attempts')
    a0 = att[-1] if att else {}
    cb = a0.get('competency_breakdown', {})
    ok_ev = cb.get('ISO-01', {}).get('percent') == 100 and cb.get('ISO-02', {}).get('percent') == 100 and cb.get('AUD-01', {}).get('percent') == 0 and cb.get('AUD-01', {}).get('unknown', 0) >= 1
    record(f'readiness: {unanswered} unanswered items listed and focused; "I don\'t know" disables options, scores zero and is counted; manual item pending; per-competency evidence saved',
           unanswered == len(READY['question_ids']) and sum_focus and disabled_after_unknown and res and ok_ev and a0.get('pending_review') == 1 and a0.get('unknown') == EXPECTED_UNKNOWN and a0.get('passed') is False,
           f'{unanswered} {sum_focus} {disabled_after_unknown} {res} {cb} {a0.get("pending_review")} {a0.get("unknown")}')
    explained = page.locator('#asm-result .rv').count() == len(READY['question_ids'])
    record('result explains every answer (verdict, chosen-option rationale, correct answer)', explained)

    go(page, '/academy/iso')
    sp = page.get_attribute('[data-start]', 'data-start'); tgt = page.get_attribute('[data-start]', 'data-target')
    record('evidence changes the starting point: foundations demonstrated (100%) and audit gaps → "audit" (CRS-ISO-AUD), no beginner repeat', sp == 'audit' and tgt == 'CRS-ISO-AUD', f'{sp} {tgt}')
    go(page, '/learning-path?route=ROUTE-IA')
    st101 = page.get_attribute('[data-step="CRS-ISO-101"]', 'data-status'); sel = page.input_value('#route-pick')
    record('route ROUTE-IA: the foundations course is Skipped because ISO-01/ISO-02 were demonstrated; route picker reflects ?route=', st101 == 'skipped' and sel == 'ROUTE-IA', f'{st101} {sel}')
    page.select_option('#route-pick', 'ROUTE-LA'); page.wait_for_timeout(400)
    record('route picker updates the URL (?route=) and re-renders without a page reload', 'route=ROUTE-LA' in page.url and page.get_attribute('[data-path]', 'data-path') == 'ROUTE-LA', page.url)

    # Lesson player
    go(page, '/academy/courses/iso-foundations/L01')
    blocks = page.eval_on_selector_all('[data-block]', 'els => els.map(e => e.dataset.block)')
    page.click('[data-action=reveal-answer]'); revealed = page.get_attribute('[data-action=reveal-answer]', 'aria-expanded') == 'true' and page.is_visible('#ex-answer')
    page.fill('#ex-notes', 'Certified to ISO 9001 for scope X by body Y'); page.wait_for_timeout(700)
    page.click('[data-action=check-answer]'); need_choice = page.locator('.kc .errsum').count() == 1
    page.check('.kc input[value="b"]'); page.click('[data-action=check-answer]'); right = page.locator('.kc .oksum').count() == 1
    page.click('[data-action=toggle-complete]'); page.wait_for_timeout(200)
    pressed = page.get_attribute('[data-action=toggle-complete]', 'aria-pressed') == 'true'
    prog = store(page, 'course_progress')
    go(page, '/academy/courses/iso-foundations/L01')
    still = page.get_attribute('[data-action=toggle-complete]', 'aria-pressed') == 'true' and page.input_value('#ex-notes').startswith('Certified')
    page.click('[data-action=next-lesson]'); page.wait_for_timeout(400)
    nxt = page.url.endswith('/L02') and page.locator('[data-lesson="CRS-ISO-101-L02"]').count() == 1
    record('lesson player: 5 blocks in order, model-answer reveal (aria-expanded), notes autosave, knowledge check feedback, complete toggle (aria-pressed) persists without reload, next lesson',
           blocks == ['concept', 'worked_example', 'scenario', 'common_mistake', 'evidence'] and revealed and need_choice and right and pressed and prog and 'CRS-ISO-101-L01' in prog[0]['completed_lessons'] and still and nxt,
           f'{blocks} {revealed} {need_choice} {right} {pressed} {still} {nxt}')

    # Course detail + catalog filters
    go(page, '/academy/courses/iso-foundations')
    sections = page.eval_on_selector_all('main section[aria-labelledby]', 'els => els.map(e => e.getAttribute("aria-labelledby"))')
    need = {'c-aud', 'c-pre', 'c-out', 'c-comp', 'c-cur', 'c-day', 'c-asm', 'c-pt', 'c-res', 'c-src', 'c-next'}
    rubric_rows = page.locator('section[aria-labelledby=c-pt] tbody tr').count()
    record('course page renders every promised part (audience, prerequisites, outcomes, competencies, curriculum, day plan, assessments, practical rubric, resources, sources, next course)', need <= set(sections) and rubric_rows >= 3, f'{sorted(need - set(sections))} {rubric_rows}')
    go(page, '/academy/courses')
    total = page.locator('#course-list [data-course]').count()
    page.select_option('#cf-level', '2'); page.wait_for_timeout(200)
    lvl2 = page.locator('#course-list [data-course]').count(); url_ok = 'level=2' in page.url
    page.fill('#cf-q', 'audit'); page.wait_for_timeout(200); q_count = page.locator('#course-list [data-course]').count()
    kept_url = page.url
    page.goto(kept_url); page.wait_for_selector('html[data-ready]'); page.wait_for_timeout(400)
    restored = page.input_value('#cf-level') == '2' and page.input_value('#cf-q') == 'audit' and page.locator('#course-list [data-course]').count() == q_count
    record(f'catalog filters: {total} courses → level 2 ({lvl2}) → "audit" ({q_count}); filters live in the URL and survive reload', 0 < q_count < lvl2 < total and url_ok and restored, f'{total} {lvl2} {q_count} {url_ok} {restored}')

    # Self-levels on my competencies (reviewer sees the draft framework)
    go(page, '/profile/competencies')
    first = page.get_attribute('[data-self]', 'data-self')
    page.select_option(f'[data-self="{first}"]', '3'); page.wait_for_timeout(500)
    lv = store(page, 'self_levels'); refocus = page.evaluate('document.activeElement?.dataset?.self') == first
    radar = page.locator('figure.radar svg[role=img] title').count() == 1
    record('my competencies: radar (titled SVG + data table); self-level saved, re-rendered in place, focus kept', any(x['id'] == first and x['level'] == 3 for x in lv) and refocus and radar, f'{lv} {refocus} {radar}')

    # Recommendations
    go(page, '/recommendations')
    n_before = page.locator('[data-rec]').count()
    first_rec = page.get_attribute('[data-rec]', 'data-rec')
    why_rows = page.locator('[data-rec] details .contrib li').count()
    page.locator('[data-rec] [data-action=dismiss]').first.click(); page.wait_for_timeout(400)
    gone = page.locator(f'[data-rec="{first_rec}"]').count() == 0
    fb = store(page, 'recommendation_feedback')
    demonstrated_suppressed = page.locator('[data-rec][data-target="CRS-ISO-101"]').count() == 0
    record('recommendations: cards with a 7-factor "why" breakdown; dismiss removes the card and is stored', n_before > 0 and why_rows >= 7 and gone and any(f['recommendation_id'] == first_rec for f in fb), f'{n_before} {first_rec} {why_rows} {gone}')
    record('recommendation for the foundations course is suppressed once ISO-01/ISO-02 are demonstrated', demonstrated_suppressed)

    # Review queue + export
    go(page, '/review?collection=questions')  # the remaining drafts after the Phase 7 closure are future-phase items
    card = page.locator('details.rv').first; card.locator('summary').click()
    card.locator('input[type=radio][value=approve]').check(); card.locator('[data-action=save-decision]').click(); page.wait_for_timeout(150)
    name_err = page.inner_text('#rv-name-err').strip() != '' and page.get_attribute('#rv-name', 'aria-invalid') == 'true'
    default_empty = page.input_value('#rv-name') == ''
    page.fill('#rv-name', 'E2E automated test'); page.dispatch_event('#rv-name', 'change')
    card.locator('[data-action=save-decision]').click(); page.wait_for_timeout(150)
    need_checks = card.locator('.err').inner_text().strip() != ''
    rid = card.get_attribute('data-review')
    for cb_ in card.locator('input[type=checkbox][name^=chk-]').all(): cb_.check()
    card.locator('[data-action=save-decision]').click(); page.wait_for_timeout(400)
    decisions = store(page, 'review_decisions')
    with page.expect_download() as dl: page.click('[data-action=export-decisions]')
    path = EVID / 'review-decisions-sample.json'; dl.value.save_as(str(path)); exported = json.loads(path.read_text())
    rec_id = rid.split(':', 1)[1] if rid else ''
    gov_unchanged = next(x for x in SEED('questions.json') if x['id'] == rec_id)['governance']['content_status'] == 'needs_review'
    record('review queue: reviewer name is empty by default and required; approve needs the full checklist; decision saved; export is cia.review-decisions.v1 with reviewer + version; seed data unchanged',
           default_empty and name_err and need_checks and any(d['id'] == rid for d in decisions) and exported['schema'] == 'cia.review-decisions.v1' and exported['reviewer']['name'] == 'E2E automated test' and all('version' in d for d in exported['decisions']) and gov_unchanged,
           f'{default_empty} {name_err} {need_checks} {rid} {len(decisions)} {exported.get("schema")}')

    # Storage isolation
    keys = page.evaluate('Object.keys(localStorage)')
    record('storage: the Academy writes only cia:v1:* keys (plus the shared cia-lang)', all(k.startswith('cia:v1:') or k == 'cia-lang' for k in keys), keys)
    record('no console errors in reviewer journey', not logs, logs[:3])
    ctx.close()

    # ---------- C. Responsive + language matrix on new routes ----------
    fails = []; n = 0
    for lang in ['ar', 'en']:
        for w in [360, 390, 768, 1440]:
            ctx = b.new_context(viewport={'width': w, 'height': 900}); page = ctx.new_page(); logs = watch(page)
            set_roles(page, ['reviewer'])
            for r in NEW_ROUTES:
                go(page, r, lang); n += 1
                d = page.evaluate('[document.documentElement.lang, document.documentElement.dir, document.documentElement.scrollWidth - document.documentElement.clientWidth, document.querySelectorAll("main h1").length]')
                if d[0] != lang or d[1] != ('rtl' if lang == 'ar' else 'ltr') or d[2] > 0 or d[3] != 1: fails.append(f'{lang}@{w}{r}: {d}')
                if w in (390, 1440) and r in ('/academy/iso', '/academy/courses/iso-foundations/L01', '/assessments/iso-readiness', '/review', '/learning-path?route=ROUTE-IA'):
                    page.screenshot(path=str(EVID / f'p7-{lang}-{w}{r.replace("/", "_").replace("?", "_")}.png'), full_page=True)
            if logs: fails.append(f'{lang}@{w} console: {logs[:2]}')
            ctx.close()
    record(f'responsive matrix: {n} loads (13 Phase 7 routes × 4 widths × AR/EN) — lang/dir, one h1, no horizontal overflow, no console errors', not fails, '; '.join(fails[:5]))

    # ---------- D. Accessibility (axe) on new routes ----------
    ax = []
    for scheme in ['light', 'dark']:
        for lang in ['ar', 'en']:
            ctx = b.new_context(viewport={'width': 390 if lang == 'ar' else 1280, 'height': 900}, color_scheme=scheme); page = ctx.new_page()
            set_roles(page, ['reviewer'])
            for r in NEW_ROUTES:
                go(page, r, lang)
                v = axe(page)
                if v: ax.append(f'{scheme}/{lang}{r}: ' + json.dumps(v, ensure_ascii=False))
            ctx.close()
    record('axe-core WCAG 2.1 A/AA + best practice: 0 violations on 13 Phase 7 routes (AR@390, EN@1280, light + dark)', not ax, ' | '.join(ax[:3]))

    # ---------- E. Keyboard: lesson player operable without a mouse ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page()
    set_roles(page, ['reviewer']); go(page, '/academy/courses/iso-foundations/L02')
    page.focus('[data-action=reveal-answer]'); page.keyboard.press('Enter'); kb1 = page.get_attribute('[data-action=reveal-answer]', 'aria-expanded') == 'true'
    page.focus('[data-action=toggle-complete]'); page.keyboard.press('Space'); page.wait_for_timeout(200); kb2 = page.get_attribute('[data-action=toggle-complete]', 'aria-pressed') == 'true'
    record('keyboard: model answer and complete toggle work with Enter/Space', kb1 and kb2, f'{kb1} {kb2}')
    ctx.close()
    b.close()

srv.terminate()
passed = sum(r['ok'] for r in results)
(EVID / 'e2e-phase7-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
