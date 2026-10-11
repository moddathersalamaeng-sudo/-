"""Shared helpers for the platform test suite (2026-10-10).
Serve the platform folder over http first, e.g.  python3 -m http.server 8802 --directory <platform>
and set CIA_BASE (default http://127.0.0.1:8802). The regression test also needs the previous
release served at CIA_ORIG (default http://127.0.0.1:8801)."""
import os, re, json, time
from playwright.sync_api import sync_playwright  # noqa: F401  (re-exported for the test files)

BASE = os.environ.get("CIA_BASE", "http://127.0.0.1:8802")
ORIG = os.environ.get("CIA_ORIG", "http://127.0.0.1:8801")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RES = os.path.join(os.path.dirname(__file__), "results")
os.makedirs(RES, exist_ok=True)
CHROME = "/opt/pw-browsers/chromium"
FONTS = re.compile(r"fonts\.(googleapis|gstatic)\.com")
BAD_WORDS = ["undefined", "NaN", "[object Object]"]


def modules():
    """All tools, or only those named in CIA_ONLY (comma-separated file names without .html)."""
    allm = sorted(f[:-5] for f in os.listdir(os.path.join(ROOT, "modules")) if f.endswith(".html"))
    only = [x for x in os.environ.get("CIA_ONLY", "").split(",") if x]
    return [m for m in allm if m in only] if only else allm


def launch(p):
    """Chromium from /opt/pw-browsers. CIA_CHROME=full uses the full browser; the default is Playwright's
    headless shell from the same folder (same engine, no background calls to Google services)."""
    if os.environ.get("CIA_CHROME") == "full" and os.path.exists(CHROME):
        try:
            return p.chromium.launch(executable_path=CHROME)
        except Exception:
            pass
    return p.chromium.launch()


def new_page(b, lang="ar", w=1280, h=900, tour_done=None, extra_init="", accept_dialogs=True):
    ctx = b.new_context(viewport={"width": w, "height": h})
    pg = ctx.new_page()
    errs = []
    pg.route(FONTS, lambda r: r.abort())
    init = "try{if(!sessionStorage.getItem('t-init')){sessionStorage.setItem('t-init','1');localStorage.setItem('cia-lang','%s');" % lang
    for t in (tour_done or []):
        init += "localStorage.setItem('cia-tour:m:%s','done');" % t
    init += "}}catch(e){}" + extra_init
    pg.add_init_script(init)
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)[:300]))

    def con(m):
        if m.type == "error":
            tx = m.text
            if "Failed to load resource" in tx or "fonts.g" in tx or "ERR_FAILED" in tx:
                return
            errs.append("console: " + tx[:300])
    pg.on("console", con)
    if accept_dialogs:
        pg.on("dialog", lambda d: d.accept())
    return ctx, pg, errs


# "undefined" is also an ordinary English word ("limits are undefined"); those uses are not code leaks
PLAIN = re.compile(r"\b(are|is|was|were|remain|remains|left|stay|stays|still)\s+$", re.I)


def bad_words(text):
    out = []
    for w in BAD_WORDS:
        for m in re.finditer(re.escape(w), text):
            if w == "undefined" and (PLAIN.search(text[max(0, m.start() - 12):m.start()]) or
                                     re.match(r" [a-z]{3,}", text[m.end():m.end() + 6])):  # "undefined inputs": an adjective
                continue
            out.append(w + " … " + text[max(0, m.start() - 40): m.end() + 40].replace("\n", " "))
    return out


class Report:
    def __init__(self, name):
        self.name = name
        self.rows = []
        self.t0 = time.time()

    def check(self, label, ok, detail=""):
        self.rows.append({"label": label, "ok": bool(ok), "detail": detail if not ok else ""})
        if not ok:
            print("  FAIL", label, str(detail)[:400], flush=True)
        return ok

    def save(self, extra=None):
        n = len(self.rows)
        f = sum(1 for r in self.rows if not r["ok"])
        out = {"name": self.name, "checks": n, "failed": f, "seconds": round(time.time() - self.t0, 1), "rows": self.rows}
        if extra:
            out.update(extra)
        json.dump(out, open(os.path.join(RES, self.name + ".json"), "w"), ensure_ascii=False, indent=1)
        print(f"== {self.name}: {n - f}/{n} passed ({out['seconds']}s)", flush=True)
        return f


EX_BUTTONS = """()=>{ let g={}; try{ const s=[...document.scripts].map(x=>x.textContent).find(t=>t.includes('var CFG={"file"'));
   g=JSON.parse(s.match(/var CFG=(\\{.*?\\});/)[1]).guard||{}; }catch(e){}
   const ids=Object.keys(g).filter(k=>g[k]!=='restore'); if(!ids.includes('pfEx')&&document.documentElement.innerHTML.includes('id="pfEx"')) ids.unshift('pfEx');
   ids.sort((a,b)=>(g[b]==='all')-(g[a]==='all')); return ids; }"""


def load_example(pg, wait=700):
    """Click the tool's example buttons (the tour guard lists them); dialogs are accepted by new_page.
    Buttons drawn inside a tab are found by opening the tabs one by one. Returns the ids clicked."""
    ids = pg.evaluate(EX_BUTTONS)
    tabs = pg.evaluate("[...new Set([...document.querySelectorAll('#side button[data-t], #side button[data-go]')].map(b=>b.dataset.t||b.dataset.go))]")
    done = []
    for bid in ids:
        has = lambda: pg.evaluate(f"!!document.getElementById('{bid}')")
        if not has():
            for t in tabs:
                pg.evaluate("(t)=>{const b=document.querySelector('#side button[data-t=\"'+t+'\"]')||document.querySelector('#side button[data-go=\"'+t+'\"]'); b&&b.click();}", t)
                pg.wait_for_timeout(60)
                if has(): break
        if has():
            pg.evaluate(f"document.getElementById('{bid}').click()"); pg.wait_for_timeout(wait); done.append(bid)
    return done
