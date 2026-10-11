"""Regression against the previous release (served at CIA_ORIG) with Date and Math.random frozen:
- the stored state after loading each tool, and after loading its example data, must match exactly;
- the hub reads the same snapshot from the same data (every tool that existed before);
- the visible text of every tab is compared in Arabic and English: tools whose file did not change must be
  identical; for changed tools the differences are listed in results/text-diff.json.
Usage: python3 t_regress.py [shard_index shard_count] | python3 t_regress.py hub"""
import os, sys, json, difflib, hashlib
sys.path.insert(0, os.path.dirname(__file__))
from common import BASE, ORIG, ROOT, RES, Report, modules, launch, new_page, sync_playwright

ORIG_DIR = os.environ.get("CIA_ORIG_DIR", "/home/claude/orig")
FREEZE = """(function(){ var T=Date.UTC(2026,9,10,9,0,0), OD=Date;
 function FD(){ if(!(this instanceof FD)) return new OD(T).toString(); var a=[].slice.call(arguments);
   return a.length? new (Function.prototype.bind.apply(OD,[null].concat(a)))() : new OD(T); }
 FD.prototype=OD.prototype; FD.now=function(){ return T; }; FD.UTC=OD.UTC; FD.parse=OD.parse; window.Date=FD;
 var s=20261010; Math.random=function(){ s=(s*16807)%2147483647; return (s-1)/2147483646; }; })();"""
DUMP = "()=>{const o={}; Object.keys(localStorage).sort().forEach(k=>{ if(!/^cia-(tour|lang)/.test(k)) o[k]=localStorage.getItem(k); }); return o;}"
BUTTONS = """()=>{ let g={}; try{ const s=[...document.scripts].map(x=>x.textContent).find(t=>t.includes('var CFG={"file"'));
   g=JSON.parse(s.match(/var CFG=(\\{.*?\\});/)[1]).guard||{}; }catch(e){}
   const ids=Object.keys(g).filter(k=>g[k]!=='restore'); if(!ids.includes('pfEx')&&document.documentElement.innerHTML.includes('id="pfEx"')) ids.unshift('pfEx');
   ids.sort((a,b)=>(g[b]==='all')-(g[a]==='all')); return ids; }"""
SWITCH = """async (t)=>{ const b=document.querySelector('#side button[data-t="'+t+'"]')||document.querySelector('#side button[data-go="'+t+'"]'); b&&b.click();
  await new Promise(r=>setTimeout(r,90)); const e=document.querySelector('.tabpane[data-tab="'+t+'"]'); return e?e.innerText:null; }"""


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest() if os.path.exists(p) else None


def run_tool(b, base, m, ids=None):
    """Fresh browser profile: state on load, then example buttons, then every tab's text in AR and EN."""
    ctx, pg, errs = new_page(b, "ar", 1280, 900, tour_done=[m], extra_init=FREEZE)
    pg.goto(f"{base}/modules/{m}.html", wait_until="load"); pg.wait_for_timeout(450)
    s0 = pg.evaluate(DUMP)
    if ids is None:
        ids = pg.evaluate(BUTTONS)
    if m == "pdca":
        ids = []  # the previous PDCA had no example: compare a seeded state instead
        seed = json.load(open(os.path.join(os.path.dirname(__file__), "pdca_seed.json"), encoding="utf-8"))
        pg.evaluate("(s)=>localStorage.setItem('cia-pdca:v1', JSON.stringify(s))", seed)
        pg.reload(wait_until="load"); pg.wait_for_timeout(400)
    tabs = pg.evaluate("[...new Set([...document.querySelectorAll('#side button[data-t], #side button[data-go]')].map(b=>b.dataset.t||b.dataset.go))]")
    for bid in ids:
        if not pg.evaluate(f"!!document.getElementById('{bid}')"):
            for t in tabs:
                pg.evaluate(SWITCH, t)
                if pg.evaluate(f"!!document.getElementById('{bid}')"): break
        if pg.evaluate(f"!!document.getElementById('{bid}')"):
            pg.evaluate(f"document.getElementById('{bid}').click()"); pg.wait_for_timeout(700)
    s1 = pg.evaluate(DUMP)
    texts = {}
    for lang in ("ar", "en"):
        pg.evaluate(f"localStorage.setItem('cia-lang','{lang}')")
        pg.goto(f"{base}/modules/{m}.html", wait_until="load"); pg.wait_for_timeout(350)
        for t in tabs:
            texts[f"{lang}:{t}"] = pg.evaluate(SWITCH, t)
    s2 = pg.evaluate(DUMP)
    ctx.close()
    return {"load": s0, "example": s1, "after_tabs": s2, "texts": texts, "ids": ids, "errs": errs}


def first_diff(a, b):
    if a == b: return ""
    i = next((k for k in range(min(len(a), len(b))) if a[k] != b[k]), min(len(a), len(b)))
    return f"at {i}: old …{a[max(0, i - 60):i + 60]!r} | new …{b[max(0, i - 60):i + 60]!r}"


if len(sys.argv) > 1 and sys.argv[1] == "hub":
    R = Report("regress-hub")
    snaps = {}
    with sync_playwright() as p:
        b = launch(p)
        for name, base in (("old", ORIG), ("new", BASE)):
            ctx, pg, errs = new_page(b, "ar", 1280, 900, tour_done=modules(), extra_init=FREEZE)
            for m in modules():
                if m == "pdca" or not os.path.exists(os.path.join(ORIG_DIR, "modules", m + ".html")): continue  # tools new in this release have no old data to compare
                pg.goto(f"{base}/modules/{m}.html", wait_until="load"); pg.wait_for_timeout(350)
                for bid in pg.evaluate(BUTTONS):
                    if pg.evaluate(f"!!document.getElementById('{bid}')"):
                        pg.evaluate(f"document.getElementById('{bid}').click()"); pg.wait_for_timeout(700)
            pg.goto(f"{base}/index.html", wait_until="load"); pg.wait_for_timeout(500)
            snaps[name] = pg.evaluate("JSON.parse(JSON.stringify(CIADASH.evalAll()))")
            snaps[name + "_store"] = pg.evaluate(DUMP)
            ctx.close()
        b.close()
    R.check("same stored data in both releases before reading", snaps["old_store"] == snaps["new_store"],
            [k for k in set(snaps["old_store"]) | set(snaps["new_store"]) if snaps["old_store"].get(k) != snaps["new_store"].get(k)])
    for k in snaps["old"]:
        R.check(f"hub reads the same snapshot for {k}", snaps["old"][k] == snaps["new"].get(k), first_diff(json.dumps(snaps["old"][k]), json.dumps(snaps["new"].get(k))))
    NEW_TOOLS = sorted(x for x in os.environ.get("CIA_NEW_TOOLS", "").split(",") if x)   # tools this release adds to the hub (empty: none)
    R.check(f"new hub adds exactly: {', '.join(NEW_TOOLS) or 'no tool'}", sorted(set(snaps["new"]) - set(snaps["old"])) == NEW_TOOLS, sorted(set(snaps["new"]) - set(snaps["old"])))
    R.save()
    sys.exit(0)

k_, n_ = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (0, 1)
MODS = [m for i, m in enumerate(modules()) if i % n_ == k_]
R = Report("regress" + (f"-{k_}" if n_ > 1 else ""))
diffs = {}
with sync_playwright() as p:
    b = launch(p)
    for m in MODS:
        if not os.path.exists(os.path.join(ORIG_DIR, "modules", m + ".html")):
            R.check(f"{m}: present in the previous release", False); continue
        new = run_tool(b, BASE, m)
        old = run_tool(b, ORIG, m, ids=new["ids"])
        same_file = sha(os.path.join(ORIG_DIR, "modules", m + ".html")) == sha(os.path.join(ROOT, "modules", m + ".html"))
        R.check(f"{m}: stored state on first load matches", old["load"] == new["load"], first_diff(json.dumps(old["load"]), json.dumps(new["load"])))
        R.check(f"{m}: stored state after the example ({', '.join(new['ids']) or 'seeded'}) matches exactly",
                old["example"] == new["example"] and len(new["example"]) > 0, first_diff(json.dumps(old["example"]), json.dumps(new["example"])))
        R.check(f"{m}: stored state after visiting every tab matches", old["after_tabs"] == new["after_tabs"],
                first_diff(json.dumps(old["after_tabs"]), json.dumps(new["after_tabs"])))
        R.check(f"{m}: no errors (new)", not new["errs"], new["errs"][:3])
        # text
        tdiff = {}
        for key in sorted(set(old["texts"]) | set(new["texts"])):
            a, c = old["texts"].get(key), new["texts"].get(key)
            if a == c: continue
            if a is None: tdiff[key] = {"new_tab": True, "lines": len((c or "").splitlines())}; continue
            if c is None: tdiff[key] = {"removed_tab": True}; continue
            al, cl = a.splitlines(), c.splitlines()
            sm = difflib.SequenceMatcher(None, al, cl)
            add = [l for op, i1, i2, j1, j2 in sm.get_opcodes() if op in ("insert", "replace") for l in cl[j1:j2]]
            rem = [l for op, i1, i2, j1, j2 in sm.get_opcodes() if op in ("delete", "replace") for l in al[i1:i2]]
            tdiff[key] = {"added": len(add), "removed": len(rem), "added_sample": add[:6], "removed_sample": rem[:6]}
        diffs[m] = {"file_changed": not same_file, "tabs": tdiff}
        if same_file:
            R.check(f"{m}: unchanged file shows identical text on every tab (AR/EN)", not tdiff, list(tdiff)[:5])
        else:
            removed = {k: v for k, v in tdiff.items() if v.get("removed") or v.get("removed_tab")}
            print(f"  {m}: text differences on {len(tdiff)} tab views; with removed lines: {len(removed)}", flush=True)
    b.close()
json.dump(diffs, open(os.path.join(RES, "text-diff" + (f"-{k_}" if n_ > 1 else "") + ".json"), "w"), ensure_ascii=False, indent=1)
R.save({"modules": MODS})
