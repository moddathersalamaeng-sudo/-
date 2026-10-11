"""Example data in every tool: load it (confirming the replace prompts), then every tab in Arabic and English
shows no error, no "undefined" / "NaN" / "[object Object]" and no empty pane; then the hub dashboard reads
every tool's example (status "ok" with an index) and the executive cockpit picks the tools up."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import BASE, Report, modules, launch, new_page, bad_words, sync_playwright

R = Report("example")
BUTTONS = """()=>{ let g={}; try{ const s=[...document.scripts].map(x=>x.textContent).find(t=>t.includes('var CFG={"file"'));
   g=JSON.parse(s.match(/var CFG=(\\{.*?\\});/)[1]).guard||{}; }catch(e){}
   const ids=Object.keys(g).filter(k=>g[k]!=='restore'); if(!ids.includes('pfEx')&&document.documentElement.innerHTML.includes('id="pfEx"')) ids.unshift('pfEx');
   ids.sort((a,b)=>(g[b]==='all')-(g[a]==='all')); return ids; }"""
SWITCH = """async (t)=>{ const b=document.querySelector('#side button[data-t="'+t+'"]'); b&&b.click();
  await new Promise(r=>setTimeout(r,90)); const e=document.querySelector('.tabpane[data-tab="'+t+'"]');
  return {len:e?e.innerText.trim().length:0, text:e?e.innerText:''}; }"""

with sync_playwright() as p:
    b = launch(p)
    ALL = modules()
    ctx, pg, errs = new_page(b, "ar", 1280, 900, tour_done=ALL)
    pg.goto(f"{BASE}/index.html", wait_until="load"); pg.wait_for_timeout(300)
    KEYS = dict(pg.evaluate("CIADASH.TOOLS.map(t=>[URLS[t.k].split('/').pop().replace('.html',''), t.key])"))
    loaded = {}
    for m in ALL:
        pg.goto(f"{BASE}/modules/{m}.html", wait_until="load"); pg.wait_for_timeout(400)
        before = pg.evaluate("Object.keys(localStorage).filter(k=>!/^cia-(tour|lang)/.test(k)).map(k=>k+'='+localStorage.getItem(k).length)")
        ids = pg.evaluate(BUTTONS)
        tabs = pg.evaluate("[...document.querySelectorAll('#side button[data-t]')].map(b=>b.dataset.t)")
        clicked = []
        for bid in ids:
            if not pg.evaluate(f"!!document.getElementById('{bid}')"):
                for t in tabs:  # some buttons only exist once their tab has been drawn
                    pg.evaluate(SWITCH, t)
                    if pg.evaluate(f"!!document.getElementById('{bid}')"): break
            if pg.evaluate(f"!!document.getElementById('{bid}')"):
                pg.evaluate(f"document.getElementById('{bid}').click()"); pg.wait_for_timeout(700); clicked.append(bid)
        after = pg.evaluate("Object.keys(localStorage).filter(k=>!/^cia-(tour|lang)/.test(k)).map(k=>k+'='+localStorage.getItem(k).length)")
        loaded[m] = clicked
        if m == "executive-cockpit-workspace":
            R.check(f"{m}: has no example of its own (it reads the other tools)", not ids, ids)
        else:
            key = KEYS.get(m)
            val = pg.evaluate(f"localStorage.getItem({key!r})") if key else None
            R.check(f"{m}: example loads ({', '.join(clicked)}) into {key}", clicked and val and len(val) > 50, [ids, key, (val or '')[:80]])
        R.check(f"{m}: no errors while loading the example", not errs, errs[:3]); del errs[:]
    # every tab with data, both languages
    for lang in ("ar", "en"):
        pg.evaluate(f"localStorage.setItem('cia-lang','{lang}')")
        for m in ALL:
            pg.goto(f"{BASE}/modules/{m}.html", wait_until="load"); pg.wait_for_timeout(350)
            tabs = pg.evaluate("[...document.querySelectorAll('#side button[data-t]')].map(b=>b.dataset.t)")
            empty, bw = [], []
            for t in tabs:
                r = pg.evaluate(SWITCH, t)
                if r["len"] < 20: empty.append(t)
                bw += bad_words(r["text"])
            R.check(f"{m} {lang}: every tab with example data has content", not empty, empty)
            R.check(f"{m} {lang}: no undefined/NaN/[object Object] with example data", not bw, bw[:3])
            R.check(f"{m} {lang}: no errors with example data", not errs, errs[:3]); del errs[:]
    # hub dashboard reads every example
    pg.evaluate("localStorage.setItem('cia-lang','ar')")
    pg.goto(f"{BASE}/index.html", wait_until="load"); pg.wait_for_timeout(600)
    res = pg.evaluate("""()=>{const R=CIADASH.evalAll(); return CIADASH.TOOLS.map(t=>[t.k, URLS[t.k], R[t.k].st, R[t.k].idx, (R[t.k].m||[]).length])}""")
    for k, url, st, idx, nm in res:
        R.check(f"hub dashboard reads {k} ({url.split('/')[-1]})", st == "ok" and nm > 0, [st, idx, nm])
    pdca = [x for x in res if x[0] == "pdca"]
    R.check("hub reads PDCA: self-assessment 65% and 3 cycles", pdca and pdca[0][2] == "ok", pdca)
    pdm = pg.evaluate("CIADASH.evalAll().pdca.m.map(x=>[x.k,Math.round(x.v),x.d])")
    R.check("PDCA metrics on the hub: 65% assessed, 1/3 closed", ["pdAs", 65, "65%"] in pdm and any(x[0] == "pdCl" and x[2] == "1/3" for x in pdm), pdm)
    pg.evaluate("showView('dash')"); pg.wait_for_timeout(400)
    dtx = pg.evaluate("document.getElementById('dash').innerText")
    R.check("hub dashboard view has no undefined/NaN/[object Object]", not bad_words(dtx), bad_words(dtx)[:3])
    R.check("hub dashboard lists PDCA", "PDCA" in dtx)
    R.check("hub: no errors", not errs, errs[:3]); del errs[:]
    # executive cockpit sees the tools
    pg.goto(f"{BASE}/modules/executive-cockpit-workspace.html#modreg", wait_until="load"); pg.wait_for_timeout(600)
    reg = pg.evaluate("(document.querySelector('.tabpane[data-tab=\"modreg\"]')||{}).innerText||''")
    R.check("executive cockpit registry shows tools with data", len(reg) > 200 and not bad_words(reg), [len(reg), bad_words(reg)[:2]])
    R.check("executive cockpit: no errors", not errs, errs[:3])
    ctx.close(); b.close()
R.save({"loaded": loaded})
