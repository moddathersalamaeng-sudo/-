"""Hub home page v2 and Tool Advisor (2026-10-11). Serve the platform folder over http first (CIA_BASE, default
http://127.0.0.1:8802) and the previous release at CIA_ORIG / CIA_ORIG_DIR for the unchanged-files checks.
Covers: home and Advisor in AR/EN at 1280 and 390 (errors, undefined/NaN, overflow), counters against the data,
TOOLINFO completeness, every card / slide / wheel-panel item opening its tool in the overlay, carousel behaviour
(autoplay, hover/focus/touch pause, keyboard, swipe, reduced motion, lazy images), image budget, official references
markup, Advisor (questions, back/next, persistence, start again, three profiles, plan buttons, consultation pre-fill,
print and copy), first-visit tour, request forms unchanged, module files unchanged, page weight and first screen time.
CIA_ALLOWED_CHANGED: module files a later step may change or add (comma-separated file names)."""
import os, sys, re, json, gzip, io, time, hashlib, threading, subprocess, functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "platform"))
from common import BASE, ORIG, ROOT, Report, modules, launch, new_page, bad_words, sync_playwright

R = Report("hub-home")
ORIG_DIR = os.environ.get("CIA_ORIG_DIR", "/home/claude/orig")
ALLOWED = set(x for x in os.environ.get("CIA_ALLOWED_CHANGED", "").split(",") if x)
ALL = modules()
FRAME = "window.__e=[];addEventListener('error',function(e){window.__e.push(String(e.message))});"


def wait_frame(pg, k, tab=None, timeout=15000):
    pg.wait_for_function("""([k,t])=>{const f=document.getElementById('modFrame'); if(!f||f.dataset.k!==k||!f.contentDocument) return false;
        const d=f.contentDocument; if(d.readyState!=='complete'||!d.getElementById('ciaHomeBtn')) return false;
        if(!t) return true; const p=d.querySelector('.tabpane[data-tab="'+t+'"]'); return !!(p&&p.getClientRects().length);}""", arg=[k, tab], timeout=timeout)


def open_and_close(pg, sel_js, label, errs):
    """Click the element found by sel_js (must carry data-mod), check that the right tool opens on the right tab, then
    close the overlay with the tool's own home button."""
    info = pg.evaluate(f"(()=>{{const a={sel_js}; if(!a) return null; return {{k:a.dataset.mod, t:a.dataset.anchor||''}}; }})()")
    if not info:
        R.check(label + ": link found", False, "missing"); return
    pg.evaluate(f"(()=>{{const a={sel_js}; a.scrollIntoView({{block:'center'}}); a.click();}})()")
    try:
        wait_frame(pg, info["k"], info["t"] or None); ok = True
    except Exception:
        ok = False
    R.check(f"{label}: opens {info['k']}{('#'+info['t']) if info['t'] else ''} in the overlay", ok and pg.evaluate("document.getElementById('modOverlay').classList.contains('on')"))
    fe = pg.evaluate("(document.getElementById('modFrame').contentWindow||{}).__e||[]") if ok else []
    if fe or errs: R.check(f"{label}: no errors", False, (fe + errs)[:3])
    del errs[:]
    if ok:
        pg.evaluate("document.getElementById('modFrame').contentDocument.getElementById('ciaHomeBtn').click()"); pg.wait_for_timeout(200)
        R.check(f"{label}: the tool's home button closes the overlay", not pg.evaluate("document.getElementById('modOverlay').classList.contains('on')"))
    else:
        pg.evaluate("closeModule()"); pg.wait_for_timeout(150)


def node_data():
    """Question and template counts from the dashboard engine in index.html (the tools' own ids)."""
    js = r"""const fs=require('fs'); const s=fs.readFileSync(process.argv[1],'utf8');
    const a=s.indexOf('const CIADASH = (function(){'), b=s.indexOf('/* ===================== PERFORMANCE DASHBOARD');
    let code=s.slice(a,b).replace('const CIADASH =','var CIADASH =').replace('return {TOOLS, ML,','return {ISO, RM, TOOLS, ML,');
    global.localStorage={getItem:()=>null}; eval(code); const {ISO,RM}=CIADASH;
    const sum=(a,f)=>a.reduce((x,y)=>x+f(y),0);
    const out={}; for(const k in ISO) out[k]={q:ISO[k].qs.length, tpl:ISO[k].tplIds.length};
    out.ims={q:RM.ims.qs.length, tpl:RM.ims.docs.length}; out.exc={q:RM.exc.qs.length+sum(RM.exc.cr,c=>c.parts.length)};
    out.p3o={q:sum(RM.p3o.groups,g=>g.ps.length), tpl:RM.p3o.tpl.length}; out.iso21500={q:sum(RM.iso21500.stds,s=>sum(s.groups,g=>g.ps.length)), tpl:RM.iso21500.tpl.length};
    out.ccc={q:sum(RM.ccc.mat,m=>m.nq)}; out.iso42001={q:RM.iso42001.nMs+RM.iso42001.nAx, tpl:RM.iso42001.tpl.length};
    out.iso27701={q:RM.iso27701.nMs+RM.iso27701.nAx}; out.pmoexc={q:RM.pmoexc.doms.length*3, tpl:RM.pmoexc.tpl.length};
    out.pmo={q:RM.pmo.models.length*RM.pmo.persp.length*4}; out.kaqa={tpl:RM.kaqa.tpl.length};
    console.log(JSON.stringify(out));"""
    r = subprocess.run(["node", "-e", js, os.path.join(ROOT, "index.html")], capture_output=True, text=True)
    return json.loads(r.stdout)


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest() if os.path.exists(p) else None


# ---------------- static checks ----------------
shots = sorted(f for f in os.listdir(os.path.join(ROOT, "assets", "shots")) if f.endswith(".webp"))
sizes = {f: os.path.getsize(os.path.join(ROOT, "assets", "shots", f)) for f in shots}
R.check("screenshots: 10–14 screens in Arabic and English", 20 <= len(shots) <= 30 and all(f.replace("-ar.", "-en.") in sizes for f in shots if f.endswith("-ar.webp")), len(shots))
R.check("screenshots: each image at most 120 KB", all(v <= 120 * 1024 for v in sizes.values()), {k: v for k, v in sizes.items() if v > 120 * 1024})
R.check("screenshots: all images together at most 2.5 MB", sum(sizes.values()) <= 2.5 * 1024 * 1024, sum(sizes.values()))
new_assets = sorted(os.path.relpath(os.path.join(d, f), ROOT) for d, _, fs in os.walk(os.path.join(ROOT, "assets")) for f in fs
                    if not os.path.exists(os.path.join(ORIG_DIR, os.path.relpath(os.path.join(d, f), ROOT))))
R.check("no logo files added (new assets are screenshots and the share image only)",
        all(re.match(r"assets/(shots/[\w-]+-(ar|en)\.webp|og-home\.jpg)$", f) for f in new_assets) and not any("logo" in f.lower() for f in new_assets), new_assets)
mods_now = set(os.listdir(os.path.join(ROOT, "modules"))) | set(os.listdir(os.path.join(ORIG_DIR, "modules")))
changed = [m for m in sorted(mods_now) if sha(os.path.join(ROOT, "modules", m)) != sha(os.path.join(ORIG_DIR, "modules", m))]
R.check("module files: only the ones this step may change differ (checksum list)", set(changed) <= ALLOWED, changed)
for f in ["templates/explain-kit-template.html", "assets/cia-share.jpg", "assets/icon-192.png", "assets/favicon-32.png", "assets/apple-touch-icon.png"]:
    R.check(f"unchanged: {f}", sha(os.path.join(ROOT, f)) == sha(os.path.join(ORIG_DIR, f)))
nd = node_data()

with sync_playwright() as p:
    b = launch(p)
    # ---------------- data: TOOLINFO and counters ----------------
    ctx, pg, errs = new_page(b, "ar", 1280, 900, tour_done=ALL, extra_init=FRAME)
    pg.goto(BASE + "/index.html", wait_until="load"); pg.wait_for_timeout(700)
    miss = pg.evaluate("""Object.keys(URLS).flatMap(k=>{ const t=TOOLINFO[k]; if(!t) return [k+': no TOOLINFO'];
        const o=[]; ['brief','why','gain','time','startL'].forEach(f=>['ar','en'].forEach(l=>{ if(!t[f]||!String(t[f][l]||'').trim()) o.push(k+'.'+f+'.'+l); }));
        if(!t.start) o.push(k+'.start'); if(!Array.isArray(t.roles)||!t.roles.length) o.push(k+'.roles'); if(typeof t.q!=='number'||typeof t.tpl!=='number') o.push(k+'.counts'); return o; })""")
    R.check("TOOLINFO complete for every tool in both languages (brief, why, gain, who, time, start)", not miss, miss[:10])
    R.check("TOOLINFO has an entry for every live tool and nothing else", pg.evaluate("Object.keys(URLS).sort().join()===Object.keys(TOOLINFO).sort().join()"))
    for k, v in nd.items():
        ti = pg.evaluate(f"TOOLINFO['{k}']||null")
        if not ti: continue
        if "q" in v: R.check(f"{k}: question count matches the tool's data ({v['q']})", ti["q"] == v["q"], [ti["q"], v["q"]])
        if "tpl" in v: R.check(f"{k}: template count matches the tool's data ({v['tpl']})", ti["tpl"] == v["tpl"], [ti["tpl"], v["tpl"]])
    pg.evaluate("document.documentElement.style.scrollBehavior='auto'; document.getElementById('ctrs').scrollIntoView({block:'center'})"); pg.wait_for_timeout(1600)
    cnt = pg.evaluate("[...document.querySelectorAll('#ctrs b[data-n]')].map(b=>[b.dataset.k,+b.dataset.n,+b.textContent])")
    calc = pg.evaluate("""(()=>{ const ks=TOOLKITS.map(t=>t.k).filter(k=>URLS[k]);
        return {tools:new Set(SYSTEMS.flatMap(s=>s.mods.filter(m=>m.status==='live').map(m=>URLS[m.k]))).size, systems:SYSTEMS.length,
          q:ks.reduce((a,k)=>a+TOOLINFO[k].q,0), tpl:ks.reduce((a,k)=>a+TOOLINFO[k].tpl,0), std:COVER_N}; })()""")
    for k, n, shown in cnt:
        R.check(f"counter {k} = {calc[k]} (computed from the data)", n == calc[k] and shown == calc[k], [n, shown, calc[k]])
    R.check("counter tools equals the number of linked tools", calc["tools"] == len(pg.evaluate("Object.keys(URLS)")), calc["tools"])
    forms_new = pg.evaluate("JSON.stringify([RQ_FORMS, RQ_TO, Object.fromEntries(Object.entries(RQ).map(([l,o])=>[l,JSON.stringify(o)]))])")
    ctx.close()
    ctx, pg, errs = new_page(b, "ar", 1280, 900, tour_done=ALL)
    pg.goto(ORIG + "/index.html", wait_until="load"); pg.wait_for_timeout(500)
    forms_old = pg.evaluate("JSON.stringify([RQ_FORMS, RQ_TO, Object.fromEntries(Object.entries(RQ).map(([l,o])=>[l,JSON.stringify(o)]))])")
    R.check("request forms unchanged (fields, options, recipients, texts)", forms_new == forms_old)
    ctx.close()

    # ---------------- views AR/EN x 1280/390 ----------------
    for lang in ("ar", "en"):
        for w, h in ((1280, 900), (390, 844)):
            ctx, pg, errs = new_page(b, lang, w, h, tour_done=ALL)
            pg.goto(BASE + "/index.html", wait_until="load"); pg.wait_for_timeout(600)
            pg.evaluate("document.documentElement.style.scrollBehavior='auto'")
            for v in ["home", "advisor", "start", "dash", "tools", "systems", "learn", "faq", "request", "about"]:
                pg.evaluate(f"route('#{v}')"); pg.wait_for_timeout(150)
                hgt = pg.evaluate("document.body.scrollHeight")
                for y in range(0, hgt, 700):
                    pg.evaluate(f"scrollTo(0,{y})"); pg.wait_for_timeout(15)
                r = pg.evaluate("""(v)=>{const S=[...document.querySelectorAll('main [data-view="'+v+'"]')]; const t=S.map(e=>e.innerText).join('\\n');
                    const de=document.documentElement; return {vis:S.filter(e=>!e.hidden).length, len:t.trim().length, text:t, over:Math.max(de.scrollWidth,document.body.scrollWidth)-innerWidth,
                    hidden:[...document.querySelectorAll('main [data-view="'+v+'"] .rv:not(.in)')].length}}""", v)
                tag = f"{lang} {w} {v}"
                R.check(tag + ": shows", r["vis"] > 0 and r["len"] > 80, r["len"])
                R.check(tag + ": no undefined/NaN/[object Object]", not bad_words(r["text"]), bad_words(r["text"])[:3])
                R.check(tag + ": no horizontal overflow", r["over"] <= 1, r["over"])
                if v == "home": R.check(tag + ": every section revealed after scrolling", r["hidden"] == 0, r["hidden"])
            R.check(f"{lang} {w}: no console errors", not errs, errs[:3])
            if w == 390:
                pg.evaluate("route('#home')"); pg.wait_for_timeout(200)
                R.check(f"{lang} 390: sticky compact header", pg.evaluate("getComputedStyle(document.querySelector('.topbar')).position") == "sticky" and pg.evaluate("document.querySelector('.topbar').offsetHeight") <= 72)
                R.check(f"{lang} 390: hero frames not loaded on phones", pg.evaluate("document.querySelectorAll('#h2Stage img').length") == 0)
            else:
                R.check(f"{lang} 1280: header items fit without scrolling", pg.evaluate("(()=>{const n=document.getElementById('nav'); return n.scrollWidth<=n.clientWidth+1})()"))
            ctx.close()

    # ---------------- every card, slide, panel item and step opens its tool ----------------
    ctx, pg, errs = new_page(b, "ar", 1280, 900, tour_done=ALL, extra_init=FRAME)
    pg.goto(BASE + "/index.html", wait_until="load"); pg.wait_for_timeout(700)
    pg.evaluate("document.documentElement.style.scrollBehavior='auto'")
    n_cards = pg.evaluate("document.querySelectorAll('#glGroups .gc:not(.soon) a[data-mod]').length")
    R.check("tools at a glance: one card per live tool", n_cards == len(pg.evaluate("Object.keys(URLS)")), n_cards)
    R.check("tools at a glance: grouped by the seven systems", pg.evaluate("document.querySelectorAll('#glGroups .gl-grp').length") == 7)
    R.check("tools at a glance: tools being added shown as 'قيد الإضافة'", pg.evaluate("[...document.querySelectorAll('#glGroups .gc.soon .soon-b')].every(e=>e.textContent.trim()==='قيد الإضافة') && document.querySelectorAll('#glGroups .gc.soon').length===SOON.length"))
    for i in range(n_cards):
        open_and_close(pg, f"document.querySelectorAll('#glGroups .gc:not(.soon) a[data-mod]')[{i}]", f"card {i+1}", errs)
    pg.evaluate("document.querySelector('#glGroups .gc button[data-x]').click()"); pg.wait_for_timeout(100)
    R.check("card expands in place for the full brief", pg.evaluate("(()=>{const c=document.querySelector('#glGroups .gc'); return c.classList.contains('open') && c.querySelector('.gc-more').offsetHeight>40 && c.querySelector('button[data-x]').getAttribute('aria-expanded')==='true'})()"))
    src = pg.evaluate("[...document.querySelectorAll('#glGroups .gc-more .src a')].map(a=>a.getAttribute('href'))")
    R.check("every 'Official source' line links to a reference card that exists", src and all(pg.evaluate(f"!!document.getElementById('{h[1:]}')") for h in set(src)), sorted(set(src)))
    for role in pg.evaluate("Object.keys(ROLES)"):
        pg.evaluate(f"document.querySelector('#roles .chip[data-r=\"{role}\"]').click()"); pg.wait_for_timeout(60)
        vis = pg.evaluate("[...document.querySelectorAll('#glGroups .gc')].filter(c=>!c.hidden).map(c=>c.dataset.k)")
        want = pg.evaluate(f"Object.keys(TOOLINFO).filter(k=>TOOLINFO[k].roles.includes('{role}'))")
        R.check(f"role chip '{role}' filters the cards", sorted(vis) == sorted(want) and len(vis) > 0, [vis, want])
    pg.evaluate("document.querySelector('#roles .chip[data-r=\"all\"]').click()"); pg.wait_for_timeout(60)
    for i in range(pg.evaluate("SHOTS.length")):
        pg.evaluate(f"carShow({i})"); pg.wait_for_timeout(60)
        open_and_close(pg, "document.querySelector('#carCap a[data-mod]')", f"slide {i+1}", errs)
    for si in range(pg.evaluate("SYSTEMS.length")):
        pg.evaluate(f"wSelect({si}, true)"); pg.wait_for_timeout(60)
        n = pg.evaluate("document.querySelectorAll('#wpn .wpn-list a[data-mod]').length")
        exp = pg.evaluate(f"TOOLKITS.filter(t=>TK_SYS[t.k]===SYSTEMS[{si}].id && URLS[t.k]).length")
        R.check(f"wheel panel system {si+1}: lists its {exp} tools", n == exp, [n, exp])
        nums = pg.evaluate("[...document.querySelectorAll('#wpn .wpn-st b')].map(b=>+b.textContent)")
        calc = pg.evaluate(f"(()=>{{const ts=TOOLKITS.filter(t=>TK_SYS[t.k]===SYSTEMS[{si}].id && URLS[t.k]); return [ts.length, ts.reduce((a,t)=>a+TOOLINFO[t.k].q,0), ts.reduce((a,t)=>a+TOOLINFO[t.k].tpl,0)];}})()")
        R.check(f"wheel panel system {si+1}: tools, questions and templates added up from the data", nums == calc, [nums, calc])
        for j in range(n):
            open_and_close(pg, f"document.querySelectorAll('#wpn .wpn-list a[data-mod]')[{j}]", f"panel {si+1}.{j+1}", errs)
    pg.evaluate("document.querySelector('#wheel .wseg[data-i=\"3\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))"); pg.wait_for_timeout(80)
    R.check("clicking a wheel segment selects that system in the panel", pg.evaluate("wSel===3 && document.querySelector('#wheel .wseg[data-i=\"3\"]').classList.contains('sel') && !wAuto"))
    pg.evaluate("document.getElementById('wpnDet').click()"); pg.wait_for_timeout(450)
    R.check("'Details and your scores' opens the system drawer", pg.evaluate("sdI===3 && document.getElementById('sd').classList.contains('on')"))
    pg.evaluate("sdClose()"); pg.wait_for_timeout(300)
    R.check("wheel counts: sum of segments = linked tools", sum(pg.evaluate("[...document.querySelectorAll('#wheel .wseg .num')].map(e=>+e.textContent)")) == len(pg.evaluate("Object.keys(URLS)")))
    for i in range(6):
        open_and_close(pg, f"document.querySelectorAll('#howSteps a[data-mod]')[{i}]", f"journey step {i+1}", errs)
    for i in range(pg.evaluate("document.querySelectorAll('#nwBox a[data-mod]').length")):
        open_and_close(pg, f"document.querySelectorAll('#nwBox a[data-mod]')[{i}]", f"new on the platform {i+1}", errs)
    open_and_close(pg, "document.querySelector('#towBox a[data-mod]')", "tool of the week", errs)
    refs = pg.evaluate("[...document.querySelectorAll('#refGroups .rc')].map(c=>({id:c.id, links:[...c.querySelectorAll('.lnks a')].map(a=>[a.href,a.target,a.rel]), img:c.querySelectorAll('img').length}))")
    R.check("official references: one card per body (REFS)", len(refs) == pg.evaluate("REFS.length"), len(refs))
    for r in refs:
        R.check(f"{r['id']}: opens the official site in a new tab with rel=noopener, no logo", r["links"] and all(t == "_blank" and "noopener" in rel and h.startswith("https://") for h, t, rel in r["links"]) and r["img"] == 0, r)
    R.check("official references: the five groups are shown", pg.evaluate("document.querySelectorAll('#refGroups .ref-g').length") == 5)
    R.check("header has 'المراجع الرسمية'", pg.evaluate("[...document.querySelectorAll('#nav a')].some(a=>a.getAttribute('href')==='#refs' && a.textContent.trim()==='المراجع الرسمية')"))
    pg.evaluate("document.querySelector('#nav a[href=\"#refs\"]').click()"); pg.wait_for_timeout(900)
    R.check("header link scrolls to the references and highlights it", pg.evaluate("Math.abs(document.getElementById('refs').getBoundingClientRect().top)<160") and pg.evaluate("document.querySelector('#nav a[href=\"#refs\"]').getAttribute('aria-current')==='page'"))
    pg.keyboard.press("Control+k"); pg.wait_for_timeout(200)
    R.check("Ctrl+K opens the command search", pg.evaluate("document.getElementById('cmdk').open"))
    pg.keyboard.type("27701"); pg.wait_for_timeout(150)
    first = pg.evaluate("cmdItems.length && cmdItems[0].t")
    R.check("command search finds a tool by number", bool(first) and "خصوصية" in first, first)
    pg.keyboard.press("Enter")
    try: wait_frame(pg, "iso27701"); ok = True
    except Exception: ok = False
    R.check("Enter opens the tool in the overlay", ok)
    pg.evaluate("closeModule()"); pg.wait_for_timeout(250)
    pg.evaluate("cmdOpen()"); pg.wait_for_timeout(100); pg.keyboard.type("EFQM"); pg.wait_for_timeout(100)
    R.check("command search covers knowledge topics and references", pg.evaluate("cmdItems.some(x=>x.g==='know') && cmdItems.some(x=>x.g==='ref')"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    R.check("Escape closes the command search", not pg.evaluate("document.getElementById('cmdk').open"))
    pg.evaluate("scrollTo(0, 3000)"); pg.wait_for_timeout(300)
    R.check("back-to-top button appears after scrolling", pg.evaluate("document.getElementById('toTop').classList.contains('on')"))
    pg.evaluate("document.getElementById('toTop').click()"); pg.wait_for_timeout(900)
    R.check("back-to-top returns to the top", pg.evaluate("scrollY") < 5)
    R.check("no errors on the home page interactions", not errs, errs[:3])
    ctx.close()

    # ---------------- carousel behaviour ----------------
    NS = None
    for lang in ("en", "ar"):
        ctx, pg, errs = new_page(b, lang, 1280, 900, tour_done=ALL)
        pg.goto(BASE + "/index.html", wait_until="load"); pg.wait_for_timeout(600)
        NS = pg.evaluate("SHOTS.length")
        R.check(f"carousel {lang}: images not loaded before it comes into view", pg.evaluate("[...document.querySelectorAll('#carStage img')].filter(i=>i.getAttribute('src')).length") == 0)
        pg.evaluate("document.documentElement.style.scrollBehavior='auto'; document.getElementById('car').scrollIntoView({block:'center'})"); pg.wait_for_timeout(700)
        loaded = pg.evaluate("[...document.querySelectorAll('#carStage img')].filter(i=>i.getAttribute('src')).length")
        R.check(f"carousel {lang}: lazy — only the current and next screens load", 1 <= loaded <= 2, loaded)
        R.check(f"carousel {lang}: screens follow the page language", pg.evaluate(f"document.querySelector('#carStage .car-sl.on img').getAttribute('src').endsWith('-{lang}.webp')"))
        R.check(f"carousel {lang}: 'Illustrative example data' label", pg.evaluate("document.querySelector('#carStage .car-tag').textContent.trim().length>5"))
        R.check(f"carousel {lang}: alt text on every screen", pg.evaluate("[...document.querySelectorAll('#carStage img')].every(i=>i.alt.length>20)"))
        pg.mouse.move(5, 5)
        i0 = pg.evaluate("CAR.i"); pg.wait_for_timeout(5600)
        R.check(f"carousel {lang}: autoplay advances every 5 seconds", pg.evaluate("CAR.i") == (i0 + 1) % NS, [i0, pg.evaluate("CAR.i")])
        box = pg.evaluate("(()=>{const r=document.getElementById('carStage').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()")
        pg.mouse.move(*box); i1 = pg.evaluate("CAR.i"); pg.wait_for_timeout(6200)
        R.check(f"carousel {lang}: pauses on hover", pg.evaluate("CAR.i") == i1, [i1, pg.evaluate("CAR.i")])
        pg.mouse.move(5, 5); pg.wait_for_timeout(100)
        pg.evaluate("document.getElementById('car').focus()"); i2 = pg.evaluate("CAR.i"); pg.wait_for_timeout(6200)
        R.check(f"carousel {lang}: pauses on focus", pg.evaluate("CAR.i") == i2)
        nxt = "ArrowRight" if lang == "en" else "ArrowLeft"
        pg.keyboard.press(nxt); pg.wait_for_timeout(100)
        R.check(f"carousel {lang}: keyboard {nxt} shows the next screen", pg.evaluate("CAR.i") == (i2 + 1) % NS)
        pg.keyboard.press("ArrowLeft" if lang == "en" else "ArrowRight"); pg.wait_for_timeout(100)
        R.check(f"carousel {lang}: keyboard goes back", pg.evaluate("CAR.i") == i2)
        pg.evaluate("document.activeElement.blur()")
        x, y = box; dx = -90 if lang == "en" else 90
        pg.evaluate(f"(()=>{{const s=document.getElementById('carStage'); s.dispatchEvent(new PointerEvent('pointerdown',{{clientX:{x},clientY:{y},bubbles:true}})); s.dispatchEvent(new PointerEvent('pointerup',{{clientX:{x+dx},clientY:{y},bubbles:true}}));}})()")
        pg.wait_for_timeout(100)
        R.check(f"carousel {lang}: swipe shows the next screen", pg.evaluate("CAR.i") == (i2 + 1) % NS)
        pg.evaluate("document.getElementById('car').dispatchEvent(new TouchEvent('touchstart',{bubbles:true}))")
        R.check(f"carousel {lang}: pauses on touch", pg.evaluate("CAR.hold") is True)
        pg.evaluate("document.querySelector('#carDots button:nth-child(5)').click()"); pg.wait_for_timeout(80)
        R.check(f"carousel {lang}: dots jump to a screen", pg.evaluate("CAR.i") == 4 and pg.evaluate("document.querySelector('#carDots button:nth-child(5)').getAttribute('aria-current')") == "true")
        pg.evaluate("document.getElementById('carPlay').click()")
        R.check(f"carousel {lang}: pause button stops the slideshow", pg.evaluate("!carPlaying() && !document.getElementById('car').classList.contains('play')"))
        R.check(f"carousel {lang}: no errors", not errs, errs[:3])
        ctx.close()
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce"); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route(re.compile(r"fonts\.(googleapis|gstatic)\.com"), lambda r: r.abort())
    pg.add_init_script("try{localStorage.setItem('cia-lang','ar')}catch(e){}")
    pg.goto(BASE + "/index.html", wait_until="load"); pg.wait_for_timeout(500)
    pg.evaluate("document.getElementById('car').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300)
    i0 = pg.evaluate("CAR.i"); pg.wait_for_timeout(5600)
    R.check("reduced motion: no autoplay", pg.evaluate("CAR.i") == i0 and not pg.evaluate("document.getElementById('car').classList.contains('play')"))
    R.check("reduced motion: no drift in the hero", pg.evaluate("[...document.querySelectorAll('.h2-fr')].every(f=>getComputedStyle(f).animationName==='none')") and pg.evaluate("getComputedStyle(document.querySelector('.hero2'),'::before').animationName") == "none")
    R.check("reduced motion: counters show their values at once", pg.evaluate("[...document.querySelectorAll('#ctrs b')].every(b=>b.textContent===b.dataset.n)"))
    R.check("reduced motion: no wheel auto-tour", pg.evaluate("!document.getElementById('wAutoBtn')"))
    R.check("reduced motion: no errors", not errs, errs[:3])
    ctx.close()

    # ---------------- Advisor ----------------
    ctx, pg, errs = new_page(b, "ar", 1280, 900, tour_done=ALL, extra_init=FRAME)
    pg.goto(BASE + "/index.html", wait_until="load"); pg.wait_for_timeout(500)
    pg.evaluate("document.getElementById('heroAdv').click()"); pg.wait_for_timeout(300)
    R.check("hero button opens the Advisor view", pg.evaluate("curView") == "advisor" and pg.evaluate("location.hash") == "#advisor")
    R.check("Advisor has a header item 'المرشد'", pg.evaluate("[...document.querySelectorAll('#nav a')].some(a=>a.getAttribute('href')==='#advisor' && a.textContent.trim()==='المرشد')"))
    NQ = pg.evaluate("ADV_Q.length")
    R.check("Advisor: 12–15 questions", 12 <= NQ <= 15, NQ)
    R.check("Advisor: the note says it is general guidance", "إرشاد عام" in pg.evaluate("document.getElementById('advNote').textContent"))
    R.check("Advisor: progress bar and question counter", pg.evaluate("!!document.querySelector('#advBody .adv-prog .bar') && document.getElementById('advOf').textContent.includes('1')"))
    for i in range(NQ):
        R.check(f"question {i+1}: Next disabled until answered", pg.evaluate("document.getElementById('advNext').disabled"))
        nopt = pg.evaluate("document.querySelectorAll('#advBody .adv-opt').length")
        R.check(f"question {i+1}: shows its options", nopt >= 3, nopt)
        pg.evaluate("document.querySelectorAll('#advBody .adv-opt')[1].click()"); pg.wait_for_timeout(40)
        R.check(f"question {i+1}: answer is selected", pg.evaluate("document.querySelectorAll('#advBody .adv-opt')[1].getAttribute('aria-pressed')") == "true")
        if i == 3:
            pg.evaluate("document.getElementById('advBack').click()"); pg.wait_for_timeout(40)
            R.check("Back returns to the previous question with its answer", pg.evaluate("ADV.i") == 2 and pg.evaluate("document.querySelectorAll('#advBody .adv-opt[aria-pressed=\"true\"]').length") == 1)
            pg.evaluate("document.getElementById('advNext').click()"); pg.wait_for_timeout(40)
        if i == 6:
            pg.reload(wait_until="load"); pg.wait_for_timeout(500); pg.evaluate("route('#advisor')"); pg.wait_for_timeout(150)
            R.check("answers persist after reload (cia-advisor:v1)", pg.evaluate("ADV.i") == 6 and pg.evaluate("document.querySelectorAll('#advBody .adv-opt')[1].getAttribute('aria-pressed')") == "true" and pg.evaluate("!!localStorage.getItem('cia-advisor:v1')"))
        pg.evaluate("document.getElementById('advNext').click()"); pg.wait_for_timeout(40)
    R.check("finishing shows the results", pg.evaluate("ADV.done") and pg.evaluate("document.querySelectorAll('#advTop .ar').length") >= 1)
    pg.evaluate("document.getElementById('advReset').click()"); pg.wait_for_timeout(150)
    R.check("Start again clears the answers", pg.evaluate("!localStorage.getItem('cia-advisor:v1') && !ADV.done && ADV.i===0 && Object.keys(ADV.a).length===0"))
    PROFILES = {
        "contractor preparing for Aramco/SEC": ({"sector": "con", "size": "l", "sites": "few", "certs": ["c9001"], "goal": ["tender", "cert"], "pain": ["sup", "repeat"], "mat": "doc", "time": "t6", "team": "one", "budget": "mid", "ai": "no", "data": "std", "proj": "many", "board": "board"},
                                                lambda top: set(top[:2]) == {"oec", "iso9001"} and "iso45001" in top[:4] and "aud" in top),
        "government entity targeting KAQA": ({"sector": "gov", "size": "xl", "sites": "many", "certs": ["c9001"], "goal": ["kaqa"], "pain": ["view", "kpis"], "mat": "doc", "time": "t12", "team": "small", "budget": "mid", "ai": "use", "data": "std", "proj": "many", "board": "comm"},
                                             lambda top: top[0] == "kaqa" and "str" in top and "w8" in top and "iso37000" in top),
        "tech company using AI with personal data": ({"sector": "it", "size": "m", "sites": "one", "certs": ["c27001"], "goal": ["ai", "data"], "pain": ["obl"], "mat": "doc", "time": "t6", "team": "small", "budget": "mid", "ai": "dev", "data": "high", "proj": "few", "board": "board"},
                                                     lambda top: set(top[:2]) == {"iso27701", "iso42001"} and "aireg" in top[:4] and "iso42005" in top),
    }
    tops = {}
    for name, (ans, ok) in PROFILES.items():
        pg.evaluate("ADV={i:0,a:{},done:false,restored:false}; advSave(); renderAdvisor(); 0"); pg.wait_for_timeout(60)
        for qi in range(NQ):
            q = pg.evaluate(f"ADV_Q[{qi}].id"); vals = ans[q] if isinstance(ans[q], list) else [ans[q]]
            for v in vals:
                pg.evaluate(f"document.querySelector('#advBody .adv-opt[data-v=\"{v}\"]').click()"); pg.wait_for_timeout(20)
            pg.evaluate("document.getElementById('advNext').click()"); pg.wait_for_timeout(30)
        top = pg.evaluate("[...document.querySelectorAll('#advTop .ar')].map(a=>a.dataset.k)")
        tops[name] = top
        R.check(f"profile '{name}': sensible top tools {top}", ok(top) and 3 <= len(top) <= 5, top)
        R.check(f"profile '{name}': every tool shows its fit score and reasons", pg.evaluate("[...document.querySelectorAll('#advTop .ar')].every(a=>/\\d+%/.test(a.querySelector('.fit b').textContent) && a.querySelectorAll('ul li').length>0)"))
        R.check(f"profile '{name}': plan with start, three stages, outputs and people", pg.evaluate("document.querySelectorAll('#advPlan .adv-stage').length===3 && !!document.getElementById('advStartGo') && document.querySelectorAll('#advPlan .adv-who li').length>=3 && document.querySelectorAll('#advPlan .adv-stage .out').length>=2"))
    R.check("the three profiles give different results", len({tuple(t) for t in tops.values()}) == 3, tops)
    fit = pg.evaluate("advScore().top.map(x=>x.s)")
    R.check("scores are the sum of the rule rows (transparent)", fit == pg.evaluate("advScore().top.map(x=>x.why.reduce((a,r)=>a+r.w,0))"), fit)
    R.check("all scoring rules are listed on the page", pg.evaluate("document.querySelectorAll('.adv-rules tbody tr').length===ADVISOR_RULES.length"))
    open_and_close(pg, "document.getElementById('advStartGo')", "plan 'Open' (where to start)", errs)
    for i in range(pg.evaluate("document.querySelectorAll('#advTop a[data-mod]').length")):
        open_and_close(pg, f"document.querySelectorAll('#advTop a[data-mod]')[{i}]", f"recommended tool {i+1}", errs)
    pg.evaluate("window.__printed=0; window.print=function(){ window.__printed++; window.__cls=document.documentElement.className; dispatchEvent(new Event('afterprint')); }; 0")
    pg.evaluate("document.getElementById('advPrint').click()"); pg.wait_for_timeout(250)
    R.check("Print uses the print view (padv) and restores the page", pg.evaluate("window.__printed===1 && /padv/.test(window.__cls) && !document.documentElement.classList.contains('padv')"))
    pg.evaluate("window.__copied=''; navigator.clipboard.writeText=function(t){ window.__copied=t; return Promise.resolve(); }; 0")
    pg.evaluate("document.getElementById('advCopy').click()"); pg.wait_for_timeout(150)
    cp = pg.evaluate("window.__copied")
    R.check("Copy summary puts the recommendations and the plan on the clipboard", "ISO/IEC 27701" in cp and "1–30" in cp and "إرشاد عام" in cp, cp[:200])
    pg.evaluate("document.getElementById('advConsult').click()"); pg.wait_for_timeout(300)
    rq = pg.evaluate("""({view:curView, kind:rqKind, msg:document.querySelector('#rqForm textarea[name="msg"]').value,
        svc:[...document.querySelectorAll('#rqForm [data-f="services"] .rq-chip[aria-pressed="true"]')].map(b=>b.dataset.v),
        std:[...document.querySelectorAll('#rqForm [data-f="stds"] .rq-chip[aria-pressed="true"]')].map(b=>b.dataset.v),
        sector:document.querySelector('#rqForm select[name="sector"]').value})""")
    R.check("Request a consultation opens the consultation form", rq["view"] == "request" and rq["kind"] == "consult")
    R.check("consultation form pre-filled with the recommendations", "ISO/IEC 27701" in rq["msg"] and "pims" in rq["svc"] and "aims" in rq["svc"] and "ISO/IEC 42001" in rq["std"] and rq["sector"] == "it", rq)
    R.check("Advisor: no errors", not errs, errs[:3])
    pg.evaluate("document.getElementById('langBtn').click()"); pg.wait_for_timeout(300); pg.evaluate("route('#advisor')"); pg.wait_for_timeout(200)
    t = pg.evaluate("document.getElementById('advisor').innerText")
    R.check("Advisor results switch to English", "Your recommended tools" in t and not bad_words(t), bad_words(t)[:3])
    ctx.close()
    ctx, pg, errs = new_page(b, "ar", 390, 844, tour_done=ALL)
    pg.add_init_script("try{localStorage.setItem('cia-advisor:v1', JSON.stringify({v:1,i:13,done:true,a:%s}))}catch(e){}" % json.dumps(PROFILES["government entity targeting KAQA"][0]))
    pg.goto(BASE + "/index.html#advisor", wait_until="load"); pg.wait_for_timeout(600)
    R.check("Advisor results on a phone: no horizontal overflow", pg.evaluate("document.documentElement.scrollWidth-innerWidth") <= 1, pg.evaluate("document.documentElement.scrollWidth-innerWidth"))
    R.check("Advisor results on a phone: KAQA first", pg.evaluate("document.querySelector('#advTop .ar').dataset.k") == "kaqa")
    ctx.close()

    # ---------------- tour, dashboard ----------------
    ctx, pg, errs = new_page(b, "ar", 1280, 900, tour_done=ALL)
    pg.goto(BASE + "/index.html", wait_until="load"); pg.wait_for_timeout(500)
    pg.evaluate("route('#start')"); pg.wait_for_timeout(150); pg.evaluate("document.getElementById('tourBtn').click()"); pg.wait_for_timeout(500)
    n = pg.evaluate("tourSteps().length"); seen = []
    for i in range(n):
        seen.append(pg.evaluate("document.getElementById('tourT').textContent"))
        pg.evaluate("document.querySelector('.tour-card [data-a=\"next\"]').click()"); pg.wait_for_timeout(450)
    R.check("guided tour runs through every step, starting at the Advisor button", n >= 7 and all(seen) and pg.evaluate("tourI") == -1, [n, seen])
    pg.evaluate("route('#dash')"); pg.wait_for_timeout(300)
    R.check("performance dashboard still renders", pg.evaluate("document.querySelectorAll('#rose .wd').length") == pg.evaluate("CIADASH.TOOLS.length"))
    R.check("tour and dashboard: no errors", not errs, errs[:3])
    ctx.close()

    # ---------------- weight and first screen (gzip server, slow 4G, 4x CPU, 390 px) ----------------
    class GZ(SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
        def send_head(self):
            path = self.translate_path(self.path)
            if os.path.isfile(path) and path.endswith((".html", ".js", ".css")) and "gzip" in self.headers.get("Accept-Encoding", ""):
                data = gzip.compress(open(path, "rb").read(), 6)
                self.send_response(200); self.send_header("Content-Type", self.guess_type(path)); self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", str(len(data))); self.end_headers()
                return io.BytesIO(data)
            return super().send_head()
    srv = ThreadingHTTPServer(("127.0.0.1", 8803), functools.partial(GZ, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.route(re.compile(r"fonts\.(googleapis|gstatic)\.com"), lambda r: r.abort())
    cdp = ctx.new_cdp_session(pg)
    cdp.send("Network.enable"); cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 150, "downloadThroughput": 1.6 * 1024 * 1024 / 8, "uploadThroughput": 750 * 1024 / 8})
    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    pg.add_init_script("""window.__ready=null; window.__lcp=0; try{ new PerformanceObserver(l=>{ l.getEntries().forEach(e=>{ window.__lcp=Math.round(e.startTime); }); }).observe({type:'largest-contentful-paint', buffered:true}); }catch(e){}
      (function poll(){ const h=document.getElementById('h1'); if(h && h.textContent.trim() && h.getBoundingClientRect().height){ requestAnimationFrame(()=>{ window.__ready=Math.round(performance.now()); }); } else requestAnimationFrame(poll); })();""")
    pg.goto("http://127.0.0.1:8803/index.html", wait_until="load"); pg.wait_for_timeout(1500)
    perf = pg.evaluate("""(()=>{ const p=performance.getEntriesByType('paint').find(x=>x.name==='first-contentful-paint');
        const res=performance.getEntriesByType('resource'), nav=performance.getEntriesByType('navigation')[0];
        return {fcp:p?Math.round(p.startTime):null, ready:window.__ready, lcp:window.__lcp, load:nav?Math.round(nav.loadEventEnd):null, doc:nav?nav.transferSize:null, img:res.filter(r=>r.initiatorType==='img').map(r=>[r.name.split('/').pop(), r.transferSize])}; })()""")
    R.check(f"first screen readable within about 2 s (slow 4G, 4x CPU): hero text on screen at {perf['ready']} ms (first paint {perf['fcp']} ms, largest paint {perf['lcp']} ms)", perf["ready"] is not None and perf["ready"] <= 2300, perf)
    R.check(f"phone first screen loads no screenshot (images: {perf['img']})", not any(n.endswith(".webp") for n, _ in perf["img"]), perf["img"])
    srv.shutdown(); ctx.close()
    weight = {"index_html_bytes": os.path.getsize(os.path.join(ROOT, "index.html")),
              "index_html_gzip_bytes": len(gzip.compress(open(os.path.join(ROOT, "index.html"), "rb").read(), 9)),
              "screenshots_total_bytes": sum(sizes.values()), "screenshots": sizes,
              "og_home_jpg_bytes": os.path.getsize(os.path.join(ROOT, "assets", "og-home.jpg")),
              "phone_first_paint_ms": perf["fcp"], "phone_hero_text_ms": perf["ready"], "phone_largest_paint_ms": perf["lcp"], "phone_load_ms": perf["load"], "phone_document_transfer_bytes": perf["doc"]}
    b.close()
R.save({"weight": weight, "profiles": tops, "references": "links checked by web search on 2026-10-11; status per link in REFS[].chk in index.html"})
