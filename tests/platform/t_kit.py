"""Explain Kit in every tool, Arabic and English: every section and every item opens, every "Assess this" lands
(highlighted question on the assessment tab, or the target tab for section-level tools), every "Explain" back-link
opens its item, and switching language re-renders the open explain tab AR -> EN -> AR.
Usage: python3 t_kit.py [shard_index shard_count]"""
import os, sys, re
sys.path.insert(0, os.path.dirname(__file__))
from common import BASE, Report, modules, launch, new_page, bad_words, load_example, sync_playwright

k_, n_ = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (0, 1)
MODS = [m for i, m in enumerate(modules()) if i % n_ == k_]
R = Report("kit" + (f"-{k_}" if n_ > 1 else ""))
AR = re.compile(r"[؀-ۿ]")

TABS = """()=>{const f=id=>{const e=document.getElementById(id); const p=e&&e.closest('[data-tab]'); return p?p.dataset.tab:null};
  return {std:f('ex-std-box'), cl:f('ex-cl-box')}}"""
BUTTONS = """()=>{ let g={}; try{ const s=[...document.scripts].map(x=>x.textContent).find(t=>t.includes('var CFG={"file"'));
   g=JSON.parse(s.match(/var CFG=(\\{.*?\\});/)[1]).guard||{}; }catch(e){}
   const ids=Object.keys(g).filter(k=>g[k]!=='restore'); if(!ids.includes('pfEx')&&document.documentElement.innerHTML.includes('id="pfEx"')) ids.unshift('pfEx');
   ids.sort((a,b)=>(g[b]==='all')-(g[a]==='all')); return ids; }"""
SEC_ITEMS = """async ()=>{
  const X=CIAEX, out=[], wait=ms=>new Promise(r=>setTimeout(r,ms));
  for(const s of X.secs){
    X.open(s.id); await wait(15);
    const t=(document.getElementById('ex-d-title')||{}).innerText||'';
    const body=(document.getElementById('ex-d-body')||{}).innerText||'';
    out.push({k:'sec', id:s.id, ok:!!t.trim()&&body.trim().length>10, text:t+'\\n'+body});
    for(const it of (s.it||[])){
      X.open(it.c); await wait(8);
      const el=document.querySelector('#ex-d-body .ex-it.open[data-code="'+it.c+'"]');
      out.push({k:'item', id:it.c, ok:!!el&&el.innerText.trim().length>10, text:el?el.innerText:''});
    }
  }
  X.close&&X.close(); return out;
}"""
ASSESS_ONE = """async (a)=>{
  const [c, back]=a, X=CIAEX, wait=ms=>new Promise(r=>setTimeout(r,ms));
  if(location.hash!=='#'+back){ location.hash='#'+back; await wait(60); }
  X.open(c); await wait(20);
  const it=document.querySelector('#ex-d-body .ex-it.open[data-code="'+c+'"]');
  const b=it?it.querySelector('[data-ex-assess]'):document.querySelector('#ex-d-body [data-ex-assess]');
  if(!b){ const off=it&&it.querySelector('.ex-act-off'); return {none:true, off:!!off}; }
  const q=b.getAttribute('data-ex-assess'); b.click(); const hv=()=>[...document.querySelectorAll('.ex-hl')].some(x=>x.getClientRects().length); for(let i=0;i<10&&!hv();i++) await wait(60); await wait(60);
  const p=document.querySelector('.tabpane.on, .tabpane:not([hidden])');
  const vis=t=>{const e=document.querySelector('.tabpane[data-tab="'+t+'"]'); return !!(e&&e.getClientRects().length&&getComputedStyle(e).display!=='none');};
  return {q, hash:location.hash.slice(1), hl:hv(), assessVis:vis('assess'), qVis:vis(q)};
}"""
EXPLAIN_LINKS = """async ()=>{
  const X=CIAEX, out=[], wait=ms=>new Promise(r=>setTimeout(r,ms));
  const doms=(typeof AD==='function'&&typeof renderDomain==='function'&&typeof domIdx!=='undefined')?AD().length:1;
  for(let d=0; d<doms; d++){
    if(doms>1){ domIdx=d; renderDomTabs&&renderDomTabs(); renderDomain(); await wait(30); }
    const bs=[...document.querySelectorAll('.ex-qx[data-ex-q]')];
    for(const b of bs){ const c=b.getAttribute('data-ex-q'); b.click(); await wait(12);
      const el=document.querySelector('#ex-d-body .ex-it.open[data-code="'+c+'"]'); out.push([c, !!el]); X.close&&X.close(); }
  }
  return out;
}"""

with sync_playwright() as p:
    b = launch(p)
    for m in MODS:
        for lang in ("ar", "en"):
            ctx, pg, errs = new_page(b, lang, 1280, 900, tour_done=[m])
            pg.goto(f"{BASE}/modules/{m}.html", wait_until="load"); pg.wait_for_timeout(400)
            # with the tool's example loaded, so links that need data (a system, a role) can land
            exl = load_example(pg)
            pg.reload(wait_until="load"); pg.wait_for_timeout(400)
            tabs = pg.evaluate(TABS)
            tag = f"{m} {lang}"
            print("..", tag, flush=True)
            if not tabs["cl"]:
                R.check(f"{tag}: kit clause tab found", False, tabs); ctx.close(); continue
            pg.evaluate(f"location.hash='#{tabs['cl']}'"); pg.wait_for_timeout(300)
            info = pg.evaluate("({n:CIAEX.items.length, s:CIAEX.secs.length})")
            R.check(f"{tag}: kit indexed sections and items", info["n"] > 0 and info["s"] > 0, info)
            res = pg.evaluate(SEC_ITEMS)
            bad = [r["id"] for r in res if not r["ok"]]
            R.check(f"{tag}: all {info['s']} sections and {info['n']} items open", not bad, bad[:8])
            bw = [w for r in res for w in bad_words(r["text"])]
            R.check(f"{tag}: kit text has no undefined/NaN/[object Object]", not bw, bw[:3])
            # assess this, for every item that has a link
            items = pg.evaluate("CIAEX.items.filter(i=>i.q).map(i=>[i.c,i.q])")
            landed = wrong = offn = 0
            wrong_l = []
            for c, q in items:
                target = pg.evaluate("(k)=>(typeof URLS!=='undefined'&&URLS[k])||''", q[2:]) if str(q).startswith("u:") else ""
                try:
                    r = pg.evaluate(ASSESS_ONE, [c, tabs["cl"]])
                except Exception as ex:  # the link left the page: by design only for links to another tool ("u:")
                    pg.wait_for_load_state("load"); pg.wait_for_timeout(400)
                    if target and pg.url.split("#")[0].endswith(target.split("/")[-1]):
                        landed += 1
                    else:
                        wrong += 1; wrong_l.append((c, "navigation: " + pg.url + " " + str(ex)[:80]))
                    if not pg.url.split("#")[0].endswith(m + ".html"):
                        pg.goto(f"{BASE}/modules/{m}.html#{tabs['cl']}", wait_until="load"); pg.wait_for_timeout(400)
                    continue
                if r.get("none"):
                    offn += 1
                    if not r.get("off"): wrong_l.append((c, "no button and no note")); wrong += 1
                    continue
                okq = r["qVis"] or (r["hl"] and r["hash"] != tabs["cl"])  # its tab, or a highlighted element on the tab it opened
                if okq: landed += 1
                else: wrong += 1; wrong_l.append((c, r))
            R.check(f"{tag}: every 'Assess this' lands ({landed} landed, {offn} outside the assessment)", wrong == 0, wrong_l[:4])
            # explain back-links from the assessment
            has_assess = pg.evaluate("!!document.querySelector('.tabpane[data-tab=\"assess\"]')")
            if has_assess:
                pg.evaluate("location.hash='#assess'"); pg.wait_for_timeout(300)
                ex = pg.evaluate(EXPLAIN_LINKS)
                badx = [c for c, ok in ex if not ok]
                R.check(f"{tag}: every 'Explain' link on the assessment opens its item ({len(ex)} links)", not badx, badx[:6])
            # language switch re-renders the open explain tab, AR -> EN -> AR (run once, from Arabic)
            if lang == "ar":
                for t, box in ((tabs["cl"], "ex-cl-box"), (tabs["std"], "ex-std-box")):
                    if not t: continue
                    pg.evaluate(f"location.hash='#{t}'"); pg.wait_for_timeout(250)
                    a1 = pg.evaluate(f"document.getElementById('{box}').innerText")
                    pg.evaluate("document.getElementById('langBtn').click()"); pg.wait_for_timeout(350)
                    e1 = pg.evaluate(f"document.getElementById('{box}').innerText")
                    lang_now = pg.evaluate("document.documentElement.lang")
                    ar_share = len(AR.findall(e1)) / max(1, len(e1))
                    R.check(f"{m}: {t} re-renders in English", lang_now == "en" and e1 != a1 and ar_share < 0.05, [lang_now, round(ar_share, 3)])
                    pg.evaluate("document.getElementById('langBtn').click()"); pg.wait_for_timeout(350)
                    a2 = pg.evaluate(f"document.getElementById('{box}').innerText")
                    R.check(f"{m}: {t} re-renders back in Arabic, same text", a2 == a1, len(a1) - len(a2))
            R.check(f"{tag}: no errors", not errs, errs[:3])
            ctx.close()
    b.close()
R.save({"modules": MODS})
