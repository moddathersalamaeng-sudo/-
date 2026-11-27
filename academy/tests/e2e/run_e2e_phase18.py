#!/usr/bin/env python3
"""Continual Improvement Academy — Phase 18 suite (the owner's videos). Playwright + axe-core.
Library (series, search, filters, watched counts), lesson and course placements, playback, resume, "watched", worksheet and
transcript, video page (used in, previous / next), not-found, a broken file, the Library door; responsive; axe; console; CSP.
Uses the real video folder when platform/cia-videos exists (local preview), otherwise a generated fixture (CI).
Usage: python3 tests/e2e/run_e2e_phase18.py [--evidence DIR]
"""
import json, sys, time, socket, shutil, subprocess, pathlib, urllib.request, hashlib
from playwright.sync_api import sync_playwright

ACADEMY = pathlib.Path(__file__).resolve().parents[2]
PLATFORM = ACADEMY.parent
EVID = pathlib.Path(sys.argv[sys.argv.index('--evidence') + 1]) if '--evidence' in sys.argv else ACADEMY / 'tests' / 'e2e' / 'out'
EVID.mkdir(parents=True, exist_ok=True)
VIDEOS = json.loads((ACADEMY / 'data' / 'seed' / 'videos.json').read_text(encoding='utf-8'))['items']
COURSES = {c['id']: c for c in json.loads((ACADEMY / 'data' / 'seed' / 'courses.json').read_text(encoding='utf-8'))['items']}
VDIR = PLATFORM / 'cia-videos'
FIXTURE = not VDIR.exists()
subprocess.run([sys.executable, str(ACADEMY / 'tests' / 'e2e' / 'video_fixture.py')], check=True)

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
PORT = free_port()
# A static server that answers HTTP Range requests (like GitHub Pages) — seeking a video needs it; python -m http.server does not.
RANGE_SERVER = r'''
import http.server, os, re, sys
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def send_head(self):
        rng = self.headers.get('Range'); path = self.translate_path(self.path)
        if not rng or not os.path.isfile(path): return super().send_head()
        m = re.match(r'bytes=(\d*)-(\d*)', rng); size = os.path.getsize(path)
        start = int(m.group(1)) if m.group(1) else size - int(m.group(2)); end = int(m.group(2)) if m.group(1) and m.group(2) else size - 1
        end = min(end, size - 1); f = open(path, 'rb'); f.seek(start); self._len = end - start + 1
        self.send_response(206); self.send_header('Content-Type', self.guess_type(path)); self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}'); self.send_header('Content-Length', str(self._len)); self.end_headers()
        return f
    def copyfile(self, src, dst):
        n = getattr(self, '_len', None)
        if n is None: return super().copyfile(src, dst)
        while n > 0:
            b = src.read(min(65536, n))
            if not b: break
            dst.write(b); n -= len(b)
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
'''
srv = subprocess.Popen([sys.executable, '-c', RANGE_SERVER, str(PORT)], cwd=PLATFORM, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
BASE = f'http://127.0.0.1:{PORT}'
for _ in range(50):
    try: urllib.request.urlopen(BASE + '/academy/'); break
    except Exception: time.sleep(0.1)
results = []
def record(name, ok, detail=''):
    results.append({'test': name, 'ok': bool(ok), 'detail': str(detail)[:900]})
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail and not ok else ''))
CSP_INIT = "window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))"
EXPECT = {'on': False}
def watch(page, logs):
    page.add_init_script(CSP_INIT)
    page.on('console', lambda m: None if EXPECT['on'] else (logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None))
    page.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
def settle(page):
    page.wait_for_selector('html[data-ready]'); page.wait_for_function('() => !document.querySelector("main [aria-busy=true]")', timeout=20000); page.wait_for_timeout(600)
def go(page, route, lang='en'):
    page.goto(f'{BASE}/academy/?lang={lang}&dev=0#{route}'); page.reload(); settle(page)
def axe(page):
    page.add_script_tag(url=BASE + '/academy/tests/vendor/axe.min.js')
    return page.evaluate("async () => { const r = await axe.run(document, { preload: false, runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }); return r.violations.map(v => ({id: v.id, n: v.nodes.length, t: v.nodes.slice(0,2).map(n => n.target.join(' '))})); }")
def store(page, key):
    raw = page.evaluate(f'localStorage.getItem("cia:v1:local:{key}")'); return (json.loads(raw) if raw else {'items': []})['items']
def lkey(cid, lid): return lid[len(cid) + 1:] if lid.startswith(cid + '-') else lid

G = COURSES['CRS-G-9001']; L17 = next(l for m in G['modules'] for l in m['lessons'] if l['id'] == 'CRS-G-9001-L17')
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); ctx = b.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); logs = []; watch(page, logs)
        # ---------- library
        go(page, '/videos', 'ar')
        cards = page.locator('[data-video-card]').count(); groups = page.eval_on_selector_all('[data-series]', 'els => els.map(e => e.dataset.series)')
        record('video library: all 73 videos as cards in 5 series (start, ISO 9001:2026 by clause, Quality in a minute, Excellence evening, shorts) with totals',
               cards == len(VIDEOS) == 73 and groups == ['iso9001-start', 'iso9001-2026', 'joda', 'masaa', 'shorts'] and '73' in page.inner_text('.vd-total'), [cards, groups])
        page.screenshot(path=str(EVID / 'p18-library-ar.png'))
        page.fill('#vd-q', '7.1'); page.wait_for_timeout(200); s1 = page.eval_on_selector_all('[data-video-card]', 'els => els.map(e => e.dataset.videoCard)')
        page.fill('#vd-q', 'باريتو'); page.wait_for_timeout(200); s2 = page.eval_on_selector_all('[data-video-card]', 'els => els.map(e => e.dataset.videoCard)')
        page.fill('#vd-q', 'zzzz'); page.wait_for_timeout(200); s3 = page.locator('[data-empty=videos]').count()
        page.fill('#vd-q', ''); page.select_option('#vd-series', 'masaa'); page.wait_for_timeout(200); s4 = page.locator('[data-video-card]').count(); url = page.url
        record('search (clause number, Arabic word), no-match message, series filter kept in the address', s1 == ['iso26-7-1'] and s2 == ['joda-ep05'] and s3 == 1 and s4 == 16 and 'series=masaa' in url, [s1, s2, s3, s4, url[-40:]])
        # ---------- door from Library
        go(page, '/library', 'en'); door = page.locator('[data-action=open-videos]'); page.wait_for_timeout(400)
        record('Library shows a door to the video library with the count', door.count() == 1 and '73' in door.inner_text(), door.inner_text() if door.count() else '')
        # ---------- lesson placement and playback
        go(page, f'/academy/courses/{G["slug"]}/{lkey(G["id"], L17["id"])}', 'ar')
        page.wait_for_selector('.vd-lesson:not([hidden])')
        n = page.get_attribute('.vd-lesson', 'data-lesson-videos'); vid = page.get_attribute('.vd-video', 'data-video'); poster = page.get_attribute('.vd-video', 'poster')
        before_deck = page.evaluate('(() => { const a = document.querySelector(".vd-lesson"), b = document.querySelector(".deck"); return !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)); })()')
        record('lesson 7.1.1 of the ISO 9001 requirements course shows the clause 7.1 video above the slide deck, with its poster', n == '1' and vid == 'iso26-7-1' and poster.endswith('/cia-videos/p/iso26-7-1.jpg') and before_deck, [n, vid, poster[-40:], before_deck])
        page.screenshot(path=str(EVID / 'p18-lesson-ar.png'))
        page.evaluate('(() => { const v = document.querySelector(".vd-video"); v.muted = true; return v.play(); })()'); page.wait_for_timeout(2500)
        t1 = page.evaluate('document.querySelector(".vd-video").currentTime')
        page.evaluate('(() => { const v = document.querySelector(".vd-video"); v.pause(); v.currentTime = Math.min(v.duration * 0.5, 60); })()'); page.wait_for_timeout(800); page.evaluate('document.querySelector(".vd-video").dispatchEvent(new Event("pause"))'); page.wait_for_timeout(800)
        pr = {x['id']: x for x in store(page, 'video_progress')}.get('iso26-7-1')
        record('the video plays (time advances) and pausing saves the position to the learner\'s own records', t1 > 0.5 and pr and pr['position'] > 0 and not pr['watched'], [t1, pr])
        go(page, f'/academy/courses/{G["slug"]}/{lkey(G["id"], L17["id"])}', 'en'); page.wait_for_selector('.vd-lesson:not([hidden])')
        resume_txt = page.inner_text('.vd-meta')
        page.evaluate('(() => { const v = document.querySelector(".vd-video"); v.muted = true; v.preload = "metadata"; v.load(); })()'); page.wait_for_timeout(1500)
        t2 = page.evaluate('document.querySelector(".vd-video").currentTime')
        record('back on the lesson: "Continue from m:ss" is shown and the video starts from the saved position', 'Continue from' in resume_txt and abs(t2 - pr['position']) <= 2, [resume_txt[-40:], t2, pr['position']])
        page.evaluate('(() => { const v = document.querySelector(".vd-video"); v.currentTime = v.duration - 0.3; return v.play(); })()'); page.wait_for_timeout(2500)
        pr2 = {x['id']: x for x in store(page, 'video_progress')}.get('iso26-7-1')
        record('playing to the end marks the video watched and shows the badge', pr2 and pr2['watched'] and page.locator('.vd-watched:not([hidden])').count() == 1, pr2)
        sheet = page.get_attribute('[data-action=vd-sheet]', 'href'); tgt = page.get_attribute('[data-action=vd-sheet]', 'target')
        page.click('.vd-trbox summary'); page.wait_for_function('() => document.querySelector(".vd-tr p")', timeout=5000)
        tr = page.inner_text('.vd-tr')
        record('worksheet opens in a new tab from the video folder; the transcript loads on demand', sheet.endswith('/cia-videos/s/iso26-7-1.html') and tgt == '_blank' and len(tr) > 10 and urllib.request.urlopen(sheet).status == 200, [sheet[-35:], tr[:40]])
        # ---------- broken file
        EXPECT['on'] = True
        page.route('**/v/iso26-7-2.mp4', lambda r: r.abort())
        L24 = next(l for m in G['modules'] for l in m['lessons'] if (l.get('source') or {}).get('ref') == '7.2')
        go(page, f'/academy/courses/{G["slug"]}/{lkey(G["id"], L24["id"])}', 'en'); page.wait_for_selector('.vd-lesson:not([hidden])')
        page.evaluate('(() => { const v = document.querySelector(".vd-video"); v.load(); })()'); page.wait_for_timeout(1500)
        broke = page.locator('.vd-err:not([hidden])').count() == 1
        page.unroute('**/v/iso26-7-2.mp4'); EXPECT['on'] = False
        record('a file that cannot be loaded shows a clear message instead of a blank player', broke)
        # ---------- lessons without a video, course page
        first = COURSES['CRS-ISO-101']; go(page, f'/academy/courses/{first["slug"]}/L02', 'en'); page.wait_for_timeout(800)
        none = page.locator('.vd-lesson[hidden]').count() == 1
        imp = COURSES['CRS-ISO-9001-IMP']; go(page, f'/academy/courses/{imp["slug"]}', 'en'); page.wait_for_selector('.vd-course:not([hidden])')
        want = sorted({v['id'] for v in VIDEOS if any(p['course_id'] == imp['id'] for p in v['placements'])}); got = sorted(page.eval_on_selector_all('.vd-course [data-video-card]', 'els => els.map(e => e.dataset.videoCard)'))
        record('a lesson with no video shows nothing; the ISO 9001 implementer course page lists every video placed in it', none and got == want and len(got) >= 8, [none, len(got), len(want)])
        # ---------- video page
        go(page, '/videos/iso26-7-1', 'en')
        used = page.locator('[data-used-in]').count(); want_used = len(next(v for v in VIDEOS if v['id'] == 'iso26-7-1')['placements'])
        nxt = page.get_attribute('[data-action=vd-next]', 'href'); prv = page.get_attribute('[data-action=vd-prev]', 'href'); h1 = page.locator('main h1').count()
        page.click('[data-used-in]'); settle(page); went = '/academy/courses/' in page.url
        record('video page: one h1, "used in" lists every lesson (links work), previous / next in the series', used == want_used and nxt == '#/videos/iso26-7-2' and prv == '#/videos/iso26-6-3' and h1 == 1 and went, [used, want_used, nxt, prv])
        go(page, '/videos/nope', 'en'); nf = page.locator('[data-unavailable]').count() == 1
        go(page, '/videos?show=unwatched', 'en'); unw = page.locator('[data-video-card]').count()
        record('unknown video → honest "not found" page; "not watched yet" filter hides the watched video', nf and unw == 72, [nf, unw])
        # ---------- D-126: installed users run the platform's service worker; videos must still play through it
        sctx = b.new_context(viewport={'width': 1280, 'height': 900}); sp = sctx.new_page(); slogs = []; watch(sp, slogs)
        sp.goto(BASE + '/'); sp.wait_for_function('() => navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true)', timeout=15000)
        sp.reload(); sp.wait_for_function('() => !!navigator.serviceWorker.controller', timeout=15000)
        slogs.clear()   # the hub page itself is outside this check (it asks for web fonts the test machine may refuse)
        sp.goto(f'{BASE}/academy/?lang=en&dev=0#/academy/courses/{G["slug"]}/{lkey(G["id"], L17["id"])}'); settle(sp); sp.wait_for_selector('.vd-lesson:not([hidden])')
        ctrl = sp.evaluate('!!navigator.serviceWorker.controller')
        sp.evaluate('(() => { const v = document.querySelector(".vd-video"); v.muted = true; return v.play(); })()'); sp.wait_for_timeout(3000)
        st = sp.evaluate('(() => { const v = document.querySelector(".vd-video"); return [v.currentTime, v.readyState, !document.querySelector(".vd-err").hidden]; })()')
        sp.evaluate('(() => { const v = document.querySelector(".vd-video"); v.currentTime = 20; })()'); sp.wait_for_timeout(1500)
        seek = sp.evaluate('document.querySelector(".vd-video").currentTime')
        cached = sp.evaluate('caches.keys().then(async ks => { let n = 0; for (const k of ks) { const c = await caches.open(k); n += (await c.keys()).filter(r => r.url.includes("/cia-videos/")).length; } return n; })')
        record('with the platform\'s service worker controlling the page (as on an installed or returning device), the video plays and seeks, and no video is put in the cache',
               ctrl and st[0] > 0.5 and not st[2] and abs(seek - 20) < 2 and cached == 0 and not slogs, [ctrl, st, seek, cached, slogs[:2]])
        sctx.close()
        # ---------- responsive, axe, console, CSP
        over, ax = [], []
        for w in (390, 768, 1280, 1920):
            for lang in ('ar', 'en'):
                page.set_viewport_size({'width': w, 'height': 900})
                for route in ('/videos', '/videos/masaa-ep12', f'/academy/courses/{G["slug"]}/{lkey(G["id"], L17["id"])}'):
                    go(page, route, lang)
                    if page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1'): over.append(f'{route[:22]}@{w}/{lang}')
                    if w in (390, 1280) and lang == 'en':
                        for theme in ('light', 'dark'):
                            page.evaluate(f'document.documentElement.dataset.theme = "{theme}"'); page.wait_for_timeout(80); ax += [f'{route[:22]}@{w}/{theme}: {v["id"]} {v["t"][:1]}' for v in axe(page)]
                if w == 390 and lang == 'ar': go(page, '/videos/masaa-ep12', 'ar'); page.screenshot(path=str(EVID / 'p18-phone-ar.png'), full_page=True)
        record('responsive: library, video page and lesson at 390 / 768 / 1280 / 1920 × AR / EN — no horizontal overflow', not over, over[:6])
        record('accessibility: axe (WCAG 2.1 A/AA + best practice) on library, video page and lesson with video, light and dark — 0 violations', not ax, ax[:6])
        record('no console errors or warnings; Content-Security-Policy: 0 violations (videos come from the same origin)', not logs and not page.evaluate('window.__csp.length'), logs[:4])
        b.close()
finally:
    srv.terminate()
    if FIXTURE: subprocess.run([sys.executable, str(ACADEMY / 'tests' / 'e2e' / 'video_fixture.py'), '--remove'])
base = PLATFORM.parent / 'baseline.sha256'
if base.exists():
    changed = [f for h, f in (l.split(maxsplit=1) for l in base.read_text().splitlines()) if (PLATFORM / f).exists() and hashlib.sha256((PLATFORM / f).read_bytes()).hexdigest() != h]
    record('integrity: hub and toolkit files byte-identical to the baseline apart from the D-08 and D-22 patches', set(changed) <= {'index.html', 'sw.js'}, changed)
r = subprocess.run([sys.executable, str(ACADEMY / 'tests' / 'e2e' / 'measure_phase10a.py'), '--label', 'phase18'], capture_output=True, text=True, timeout=900)
try:
    m = json.loads((ACADEMY / 'tests' / 'e2e' / 'out' / 'measure-phase18.json').read_text(encoding='utf-8'))
    record('plan §5 measurements: 5 top items, home ≤ 2,700 px, assessments ≤ 4 screens, first load ≤ 0.4 MB compressed, no learner-visible "Phase", 0 empty personal pages',
           m['top_nav_items'] == 5 and m['home_height'] <= 2700 and m['assessments_screens_1440x900'] <= 4 and m['first_load_json_gzip'] <= 400_000 and m['phase_wording'] == 0 and m['empty_personal_pages'] == 0,
           {k: m[k] for k in ['top_nav_items', 'home_height', 'assessments_screens_1440x900', 'first_load_json_gzip', 'phase_wording', 'empty_personal_pages']})
except Exception as e:
    record('plan §5 measurements', False, f'{e} {r.stderr[-300:]}')
passed = sum(x['ok'] for x in results)
(EVID / 'e2e-phase18-results.json').write_text(json.dumps({'passed': passed, 'total': len(results), 'results': results}, ensure_ascii=False, indent=2))
print(f'\n{passed}/{len(results)} passed')
sys.exit(0 if passed == len(results) else 1)
