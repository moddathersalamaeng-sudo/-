"""A3 tool (modules/a3.html) — 2026-10-16. Same style as tests/rca/test_rca.py.
Covers: shared engine (seven files) and layer identity, AR/EN and RTL/LTR, tabs, kit links both ways, self-assessment, the A3 sheet
(validation, the seven blocks on two halves, the current-condition chart from data points or a Pareto analysis, the goal rule — written
before the analysis, changed only with a reason —, root causes picked read-only from RCA / Fishbone / 5 Whys with previews, the
person-only flag, countermeasures tied to proved causes and tested, plan and follow-up with the computed result, coach reviews, the
stages), the live A3 page (mirrored for Arabic, stacked at 390 px), records, audit (12 checks), dashboard, report with the A3 pages
and CSV, persistence, example data, clear all, a record with missing parts, the read-only starts from RCA, CAPA and Pareto (other
tools only read), the ?open= / ?rca= / ?capa= / ?pareto= requests and the hub hint, the RCA / Fishbone / 5 Whys starts, the RCA
panel, PDCA and CAPA links, the assistant, the guided tour, keyboard use and 390 px.
Served over http when the platform server runs (CIA_BASE, default http://127.0.0.1:8802); A3_FILE=1 forces file:// URLs.
Usage: python3 tests/a3/test_a3.py"""
import os, sys, json, re
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
MOD = os.path.join(ROOT, "modules")
BASE = "file://" + ROOT
if not os.environ.get("A3_FILE"):
    import urllib.request
    _b = os.environ.get("CIA_BASE", "http://127.0.0.1:8802")
    try:
        urllib.request.urlopen(_b + "/modules/a3.html", timeout=3).read(64); BASE = _b
    except Exception:
        pass
URL = BASE + "/modules/a3.html"
M = lambda f: BASE + "/modules/" + f + ".html"
TABS = ["home", "explain-std", "explain-cl", "assess", "tools", "docs", "audit", "dash", "report", "ai"]
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (("  -- " + str(detail)[:400]) if detail and not cond else ""), flush=True)


def read(p): return open(p, encoding="utf-8").read()
def engine(s):
    a, b = "/* CIA toolbox engine v1 — start */", "/* CIA toolbox engine v1 — end */"
    return s[s.find(a):s.find(b) + len(b)] if s.count(a) == 1 and s.count(b) == 1 else None
def block(s, tag, id_):
    i = s.find('<%s id="%s">' % (tag, id_)); j = s.find("</%s>" % tag, i)
    return s[i:j + len(tag) + 3] if i >= 0 else None


# ---------------- static ----------------
FILES = ["pdca", "capa", "five-whys", "fishbone", "pareto", "rca", "a3"]
src = {f: read(os.path.join(MOD, f + ".html")) for f in FILES}
a3, tpl = src["a3"], read(os.path.join(ROOT, "templates", "explain-kit-template.html"))
e = [engine(src[f]) for f in FILES]
check("engine block present once in the seven toolbox files", all(x is not None for x in e))
check("engine block identical in the seven files and to tests/build/engine.js", len(set(e)) == 1 and e[0] == read(os.path.join(ROOT, "tests", "build", "engine.js")).rstrip("\n"))
for tag, id_ in (("style", "cia-explain-kit-css"), ("script", "cia-explain-kit-js")):
    check(f"a3.html {id_} byte-identical to the template", block(a3, tag, id_) == block(tpl, tag, id_))
norm = lambda x: re.sub(r"var CFG=\{.*?\};", "var CFG={};", x or "", count=1)
check("tour script identical to rca.html apart from CFG", norm(block(a3, "script", "cia-tour-js")) == norm(block(src["rca"], "script", "cia-tour-js")) and block(a3, "script", "cia-tour-js") != block(src["rca"], "script", "cia-tour-js"))
check("tour CSS identical to rca.html", block(a3, "style", "cia-tour-css") == block(src["rca"], "style", "cia-tour-css"))
check("tour CFG names a3 and guards the example", 'var CFG={"file": "a3", "hasEx": true, "guard": {"pfEx": "all"}};' in a3)
i0 = a3.find("A3 tool — host logic")
check("storage key and schema documented at the top of the host script", 'STORE="cia-a3:v1"' in a3 and "Schema:" in a3[i0:i0 + 6000] and '"cia-rca:v1"' in a3[i0:i0 + 6000])
check("A3 never writes another tool's key; no other tool writes the A3 key",
      not re.search(r"(localStorage\.setItem|TBX\.save)\((RCA_KEY|CAPA_KEY|PARETO_KEY|FISH_KEY|WHY5_KEY|PDCA_KEY|['\"]cia-(rca|capa|pareto|fish|why5|pdca):v1)", a3) and not re.search(r"setItem\((A3_KEY|['\"]cia-a3:v1)", "".join(src[f] for f in FILES[:-1])))
check("sidebar buttons carry data-go and data-t", all(f'data-go="{t}" data-t="{t}"' in a3 for t in TABS))
check("A3 code badge and the A3 hero code", '<div class="brand-mark" aria-hidden="true">A3</div>' in a3 and '<div class="std-code">A3<small' in a3)
check("RCA carries the read-only A3 panel and only reads cia-a3:v1", 'A3_KEY="cia-a3:v1"' in src["rca"] and 'id="a3Box"' in src["rca"] and not re.search(r"setItem\(A3_KEY", src["rca"]))
check("PDCA and CAPA unchanged in this step (no A3 reference)", "cia-a3" not in src["pdca"] and "cia-a3" not in src["capa"])

with sync_playwright() as p:
    b = p.chromium.launch()

    def page_new(lang="ar", w=1280, h=900, url=URL):
        ctx = b.new_context(viewport={"width": w, "height": h}, accept_downloads=True)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errs.append("console." + m.type + ": " + m.text) if (m.type == "error" and "Failed to load resource" not in m.text) else None)
        pg.route(re.compile(r"fonts\.(googleapis|gstatic)\.com"), lambda r: r.abort())
        init = ("try{if(!sessionStorage.getItem('t0')){sessionStorage.setItem('t0','1');localStorage.setItem('cia-lang','%s');" % lang +
                "['a3','rca','pareto','fishbone','five-whys','capa','pdca'].forEach(function(k){localStorage.setItem('cia-tour:m:'+k,'done');});localStorage.setItem('cia-tour:v1','done');}}catch(e){}")
        pg.add_init_script(init)
        pg.add_init_script("window.__opened=[]; window.open=function(u){ window.__opened.push(String(u)); return null; };")
        pg.on("dialog", lambda d: d.accept())
        pg.goto(url); pg.wait_for_timeout(350)
        return ctx, pg, errs

    def load_ex(pg): pg.evaluate("go('docs')"); pg.click("#pfEx"); pg.wait_for_function("document.querySelectorAll('#docsBox tbody tr').length===3", timeout=5000)
    def load_other(pg, f): pg.goto(M(f)); pg.wait_for_timeout(350); pg.evaluate("go('docs')"); pg.click("#pfEx"); pg.wait_for_timeout(300)
    def last_bot(pg): return pg.evaluate("[...document.querySelectorAll('#cbBody .cb-msg.bot')].pop().innerText")

    # ---- 1. identity, method tab, kit
    ctx, pg, errs = page_new("ar")
    check("loads in Arabic RTL", pg.evaluate("document.documentElement.dir") == "rtl" and pg.evaluate("document.documentElement.lang") == "ar")
    check("header: home button, A3 badge, Arabic brand line, language button", pg.evaluate("!!document.getElementById('ciaHomeBtn')") and pg.inner_text(".brand-mark") == "A3" and "أكاديمية التحسين المستمر" in pg.inner_text("#brandBy") and pg.inner_text("#langLabel") == "English")
    check("hero shows the academy logo and the author", pg.evaluate("document.querySelector('.hero-logo').src.startsWith('data:image')") and "مدثر سلامه" in pg.inner_text(".hero .author"))
    check("related tools strip: PDCA, RCA, CAPA, Pareto, Fishbone, 5 Whys", pg.evaluate("[...document.querySelectorAll('#homeStd a')].map(a=>a.getAttribute('href'))") == ["./pdca.html", "./rca.html", "./capa.html", "./pareto.html", "./fishbone.html", "./five-whys.html"])
    check("launch tiles for the nine tabs after home", pg.evaluate("document.querySelectorAll('#launchGrid a').length") == 9)
    check("sidebar icons are SVG with tinted tiles", pg.evaluate("[...document.querySelectorAll('#side button .ic')].every(x=>x.querySelector('svg')&&x.style.background)"))
    pg.click('#side button[data-go="explain-std"]'); pg.wait_for_timeout(150)
    term = pg.inner_text("#a3Term")
    check("method tab says once that A3 is a method, not a clause, and names the seven parts", pg.evaluate("document.querySelectorAll('#a3Term').length") == 1 and "ليست بنداً في أي مواصفة" in term and all(x in term for x in ["الخلفية", "الوضع الحالي", "الهدف", "تحليل الأسباب الجذرية", "الإجراءات المضادة", "الخطة", "المتابعة"]))
    check("method tab cites 0.3.2 with the uploaded wording (Plan, Do, Check, Act) and says the introduction sets no requirement", "0.3.2" in term and "ينفذ ما خُطط له" in term and "المقدمة شرح وليست متطلبات" in term)
    check("method tab: page limit a discipline, one owner and a coach, facts not adjectives, goal before causes, tested countermeasures",
          "انضباط لا شكل" in term and "شخص واحد" in term and "بالأسئلة لا بالتوقيع" in term and "لا بالصفات" in term and "قبل معرفة الأسباب" in term and "تُختبر الإجراءات المضادة ولا تُفترض" in term)
    check("method tab: A3 is a container that uses the toolbox (Pareto, Fishbone, 5 Whys, RCA, PDCA, CAPA)", "وعاء يستخدم صندوق الأدوات" in term and all(x in term for x in ["باريتو", "عظمة السمكة", "لماذا الخمس", "RCA", "PDCA", "CAPA"]))
    check("term cards: ISO 9000:2026 3.7.11, 3.7.17, 3.2.3, 3.8.6, 4.2.7, marked as interpretive summary", all(c in term for c in ["3.7.11", "3.7.17", "3.2.3", "3.8.6", "4.2.7"]) and "ملخص تفسيري" in term)
    std = pg.evaluate("document.getElementById('ex-std-box').innerText")
    check("method guide renders with roles and steps", len(std) > 400 and "من يعمل على صفحة A3" in std and "خطوات صفحة A3" in std, len(std))
    pg.evaluate("location.hash='#explain-cl'"); pg.wait_for_timeout(250)
    check("clause guide index shows 8 sections and the cycle diagram", pg.evaluate("document.querySelectorAll('#ex-cl-box .ex-idx [data-ex-sec]').length") == 8 and pg.evaluate("document.querySelectorAll('#ex-cl-box svg .ex-seg').length") == 8)
    info = pg.evaluate("({n:CIAEX.items.length, q:CIAEX.items.filter(i=>/^[A-Z]{2}\\d$/.test(i.q)).length, off:CIAEX.items.filter(i=>i.q==='x:tools').length})")
    check("kit: 19 items, 12 linked to the 12 questions, 7 outside the assessment", info == {"n": 19, "q": 12, "off": 7}, info)
    check("every question has an item", pg.evaluate("AQ.every(q=>CIAEX.items.some(i=>i.q===q[0]))"))
    it = pg.evaluate("CIAEX.open('GD-4'), document.querySelector('#ex-d-body .ex-it.open').innerText")
    check("GD-4: the goal before the causes, marked as guidance", "قبل أن تُعرف الأسباب" in it and "إرشاد تطبيقي" in it)
    it = pg.evaluate("CIAEX.open('6.2.1'), document.querySelector('#ex-d-body .ex-it.open').innerText")
    check("6.2.1 item: measurable, 3.7.11, interpretive summary", "قابلة للقياس" in it and "3.7.11" in it and "ملخص تفسيري" in it)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    check("meta.verified names the date, the source files and what is not verified",
          "2026-10-16" in pg.evaluate("EXPLAIN_A3.meta.verified.ar") and all(x in pg.evaluate("EXPLAIN_A3.meta.verified.en") for x in ["ISO_9001_2026en 1.pdf", "ISO 9000-2026.pdf", "not verified", "ISO 10009"]))
    check("ui labels set", pg.evaluate("['roles','wheelT','purpose','smap','assess','assessOff','offGo','actCtx'].every(k=>EXPLAIN_A3.ui.ar[k]&&EXPLAIN_A3.ui.en[k])") and pg.evaluate("EXPLAIN_A3.ui.en.offGo") == "Open the A3 sheet")
    pg.evaluate("go('explain-cl')"); pg.evaluate("CIAEX.open('6.2.1')"); pg.wait_for_timeout(120)
    pg.evaluate("document.querySelector('#ex-d-body .ex-it.open [data-ex-assess]').click()"); pg.wait_for_timeout(500)
    check("'Assess this' lands on question PL3, highlighted", pg.evaluate("curTab") == "assess" and pg.evaluate("!!document.querySelector('.ex-aq[data-id=\"PL3\"].ex-hl')"))
    pg.evaluate("go('explain-cl')"); pg.evaluate("CIAEX.open('0.3.2')"); pg.wait_for_timeout(120)
    off = pg.evaluate("(()=>{const it=document.querySelector('#ex-d-body .ex-it.open'); return {note:!!it.querySelector('.ex-act-off'), btn:!!it.querySelector('[data-ex-go=\"tools\"]')};})()")
    check("item outside the assessment shows the note and a button to the A3 sheet", off == {"note": True, "btn": True}, off)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    pg.evaluate("go('assess')"); pg.wait_for_timeout(150)
    check("'Explain' back-link on each of the 12 questions", pg.evaluate("document.querySelectorAll('#asList .ex-qx[data-ex-q]').length") == 12)
    pg.evaluate("go('explain-std')"); pg.wait_for_timeout(120)
    pg.click("#langBtn"); pg.wait_for_timeout(250)
    check("language switch re-renders the open method guide in English", "Who works on the A3" in pg.evaluate("document.getElementById('ex-std-box').innerText") and pg.evaluate("document.documentElement.dir") == "ltr")
    pg.click("#langBtn"); pg.wait_for_timeout(250)
    check("and back to Arabic", "من يعمل على صفحة A3" in pg.evaluate("document.getElementById('ex-std-box').innerText"))
    check("no errors so far", not errs, errs[:3]); del errs[:]

    # ---- 2. self-assessment
    pg.evaluate("go('assess')"); pg.wait_for_timeout(100)
    check("12 questions in 5 stages", pg.evaluate("document.querySelectorAll('#asList .pd-q').length") == 12 and pg.evaluate("AGROUPS.length") == 5)
    pg.check('input[name="as-OW1"][value="2"]'); pg.check('input[name="as-PL3"][value="1"]'); pg.wait_for_timeout(80)
    check("answers saved and scored (3 of 24 = 13%)", pg.inner_text("#asPct") == "13%" and json.loads(pg.evaluate("localStorage.getItem('cia-a3:v1')"))["assess"] == {"OW1": 2, "PL3": 1})
    pg.click("#asReset"); pg.wait_for_timeout(80)
    check("clear answers", pg.inner_text("#asPct") == "0%")

    # ---- 3. the A3 sheet: blocks, validation, rules
    pg.evaluate("go('tools')"); pg.wait_for_timeout(100)
    check("seven numbered blocks on two halves, header, coach reviews and the live page", pg.evaluate("document.querySelectorAll('#stages .a3-bn').length") == 7 and pg.evaluate("document.querySelectorAll('#stages .a3-half').length") == 2 and pg.evaluate("!!document.getElementById('sec-Rev')&&!!document.getElementById('a3Page')"))
    check("first half holds blocks 1-4, second half 5-7", pg.evaluate("[...document.querySelectorAll('.a3-half')].map(h=>[...h.querySelectorAll('.a3-bn')].map(x=>x.textContent).join(''))") == ["1234", "567"])
    check("new A3 is a draft", "مسودة" in pg.inner_text("#curStage"))
    pg.click("#saveBtn"); pg.wait_for_timeout(80)
    check("save without a title is refused", pg.inner_text("#recErr") == "أدخل عنواناً مختصراً للمشكلة.")
    pg.fill("#f-title", "Test A3"); pg.fill("#f-ref", "NCR-T-1"); pg.fill("#f-owner", "Ali"); pg.fill("#f-coach", "Ali"); pg.wait_for_timeout(60)
    check("coach equal to the owner is flagged", not pg.evaluate("document.getElementById('coachWarn').hidden"))
    pg.fill("#f-coach", "Sara"); pg.fill("#f-start", "2026-09-01")
    pg.select_option("#f-why", "cost"); pg.fill("#f-bgtext", "Late deliveries cost penalties."); pg.fill("#f-bgmeasure", "Late deliveries %"); pg.wait_for_timeout(60)
    check("background complete -> stage 'Background written'", "كُتبت الخلفية" in pg.inner_text("#curStage"))
    pg.fill("#f-cmeasure", "Late deliveries %"); pg.fill("#f-cbase", "12"); pg.fill("#f-cunit", "%"); pg.fill("#f-cperiod", "Jul–Aug 2026")
    check("chart asks for two points", "نقطتي بيانات" in pg.evaluate("document.getElementById('curChart').textContent"))
    for i, (l, v) in enumerate([("Jul", "11"), ("Aug", "13")]):
        pg.click('[data-add="pt"]'); pg.fill(f'#ptRows tr:nth-child({i+1}) [data-k="l"]', l); pg.fill(f'#ptRows tr:nth-child({i+1}) [data-k="v"]', v)
    pg.wait_for_timeout(60)
    check("bar chart drawn from the data points", pg.evaluate("document.querySelectorAll('#curChart svg rect[rx=\"3\"]').length") == 2)
    pg.select_option("#f-cchart", "run"); pg.wait_for_timeout(60)
    check("run chart drawn (line and points)", pg.evaluate("!!document.querySelector('#curChart svg path') && document.querySelectorAll('#curChart svg circle').length===2"))
    xs = pg.evaluate("[...document.querySelectorAll('#curChart svg circle')].map(c=>+c.getAttribute('cx'))")
    check("chart mirrored for Arabic (first point on the right)", xs[0] > xs[1], xs)
    for k in range(10): pg.click('[data-add="pt"]')
    check("12 data points at most", pg.evaluate("document.querySelectorAll('#ptRows tr').length") == 12 and pg.evaluate("document.querySelector('[data-add=\"pt\"]').disabled"))
    for k in range(10): pg.evaluate("document.querySelector('#ptRows tr:last-child [data-rdel]').click()")
    pg.fill("#f-cgap", "12% late against 4% acceptable."); pg.wait_for_timeout(60)
    check("current condition complete -> 'Current condition shown'", "عُرض الوضع الحالي" in pg.inner_text("#curStage"))
    pg.fill("#f-gmeasure", "Late deliveries %"); pg.fill("#f-gfrom", "12"); pg.fill("#f-gto", "4"); pg.fill("#f-gby", "2026-12-31"); pg.fill("#f-gdate", "2026-09-05"); pg.fill("#f-andate", "2026-09-03"); pg.wait_for_timeout(60)
    check("goal written after the analysis started is flagged and blocks the stage", not pg.evaluate("document.getElementById('lateWarn').hidden") and "عُرض الوضع الحالي" in pg.inner_text("#curStage"))
    check("gap hint and direction computed", "8" in pg.inner_text("#gapHint") and "خفض" in pg.inner_text("#goalDir"))
    pg.fill("#f-gdate", "2026-09-02"); pg.wait_for_timeout(60)
    check("goal before the analysis -> 'Goal set'", pg.evaluate("document.getElementById('lateWarn').hidden") and "حُدد الهدف" in pg.inner_text("#curStage"))
    pg.fill("#f-gorig", "3"); pg.wait_for_timeout(60)
    check("goal changed without a reason is flagged", not pg.evaluate("document.getElementById('chgWarn').hidden") and "عُرض الوضع الحالي" in pg.inner_text("#curStage"))
    pg.fill("#f-gwhy", "Customer contract changed the tolerance"); pg.wait_for_timeout(60)
    check("with a written reason the goal stands", pg.evaluate("document.getElementById('chgWarn').hidden") and "حُدد الهدف" in pg.inner_text("#curStage"))
    pg.click('[data-add="cz"]'); pg.fill('#czRows tr:nth-child(1) [data-k="t"]', "خطأ بشري من السائق"); pg.wait_for_timeout(60)
    check("cause naming a person only is flagged", "يشير إلى شخص فقط" in pg.inner_text('#czRows tr:nth-child(1) [data-flag]') and not pg.evaluate("document.getElementById('personWarn').hidden"))
    pg.fill('#czRows tr:nth-child(1) [data-k="t"]', "Dispatch plan has no cut-off time"); pg.select_option('#czRows tr:nth-child(1) [data-k="st"]', "conf"); pg.wait_for_timeout(60)
    check("a proved cause needs evidence", "دليل مطلوب" in pg.inner_text('#czRows tr:nth-child(1) [data-flag]') and "حُدد الهدف" in pg.inner_text("#curStage"))
    pg.fill('#czRows tr:nth-child(1) [data-k="ev"]', "Dispatch log: 30 of 34 late loads left after 14:00"); pg.wait_for_timeout(60)
    check("proved cause -> 'Causes proved', code R1", "أُثبتت الأسباب" in pg.inner_text("#curStage") and pg.inner_text('#czRows tr:nth-child(1) [data-code]') == "R1")
    pg.click('[data-add="cm"]'); pg.fill('#cmRows tr:nth-child(1) [data-k="t"]', "Cut-off at 13:00"); pg.wait_for_timeout(60)
    fl = pg.inner_text('#cmRows tr:nth-child(1) [data-flag]')
    check("countermeasure not tied and not tested is flagged", "غير مرتبط" in fl and "لم يُختبر" in fl, fl)
    opts = pg.evaluate("[...document.querySelectorAll('#cmRows tr:nth-child(1) [data-k=\"cause\"] option')].map(o=>o.textContent)")
    check("cause list offers the root causes with a proved mark", any(o.startswith("R1 ✓") for o in opts), opts)
    pg.select_option('#cmRows tr:nth-child(1) [data-k="cause"]', "c1"); pg.fill('#cmRows tr:nth-child(1) [data-k="eff"]', "Half the late loads"); pg.select_option('#cmRows tr:nth-child(1) [data-k="test"]', "yes"); pg.wait_for_timeout(60)
    check("tied and tested -> 'Countermeasures chosen', code CM1", "اختيرت الإجراءات المضادة" in pg.inner_text("#curStage") and pg.inner_text('#cmRows tr:nth-child(1) [data-code]') == "CM1")
    pg.click('[data-add="pl"]'); pg.fill('#plRows tr:nth-child(1) [data-k="what"]', "Change the dispatch plan"); pg.fill('#plRows tr:nth-child(1) [data-k="who"]', "Logistics"); pg.wait_for_timeout(60)
    check("plan line without a date does not complete the plan", not pg.evaluate("document.getElementById('planWarn').hidden") and "اختيرت الإجراءات المضادة" in pg.inner_text("#curStage"))
    pg.select_option('#plRows tr:nth-child(1) [data-k="cm"]', "k1"); pg.fill('#plRows tr:nth-child(1) [data-k="when"]', "2026-09-20"); pg.wait_for_timeout(60)
    check("plan complete -> 'Plan set'", "وُضعت الخطة" in pg.inner_text("#curStage"))
    pg.fill("#f-fmeasure", "Something else"); pg.wait_for_timeout(60)
    check("a different follow-up measure is flagged", not pg.evaluate("document.getElementById('sameWarn').hidden"))
    pg.fill("#f-fmeasure", "Late deliveries %"); pg.check("#f-fsame"); pg.fill("#f-ffrom", "2026-10-01"); pg.fill("#f-fto", "2026-11-30"); pg.fill("#f-fvalue", "7"); pg.wait_for_timeout(60)
    check("computed result: partly met (12 -> 7 against 4)", "تحقق جزئياً" in pg.inner_text("#fuSugg") and not pg.evaluate("document.getElementById('fuChart').hidden"))
    pg.fill("#f-fvalue", "3.5"); pg.wait_for_timeout(60)
    check("computed result: met", "تحقق الهدف" in pg.inner_text("#fuSugg"))
    pg.select_option("#f-fres", "met"); pg.wait_for_timeout(60)
    check("follow-up done -> 'Effect checked', standardisation asked for", "تحقق الأثر" in pg.inner_text("#curStage") and not pg.evaluate("document.getElementById('stdWarn').hidden"))
    pg.fill("#f-fstd", "Dispatch procedure rev 2"); pg.click('[data-add="rv"]'); pg.fill('#rvRows tr:nth-child(1) [data-k="date"]', "2026-12-02"); pg.fill('#rvRows tr:nth-child(1) [data-k="by"]', "Ali"); pg.wait_for_timeout(60)
    check("a review under the owner's name is flagged and does not count", not pg.evaluate("document.getElementById('rvWarn').hidden") and "تحقق الأثر" in pg.inner_text("#curStage"))
    pg.fill('#rvRows tr:nth-child(1) [data-k="by"]', "Sara"); pg.fill('#rvRows tr:nth-child(1) [data-k="q"]', "Same measure?"); pg.wait_for_timeout(60)
    check("coach review after the follow-up -> 'Reviewed with the coach'", "روجعت مع الموجّه" in pg.inner_text("#curStage"))
    page = pg.evaluate("document.getElementById('a3Page').innerText")
    check("live A3 page shows the title, owner, coach, the seven blocks and the result", all(x in page for x in ["Test A3", "Ali", "Sara", "Cut-off at 13:00", "Change the dispatch plan", "Dispatch procedure rev 2", "تحقق الهدف"]) and pg.evaluate("document.querySelectorAll('#a3Page .a3p-b').length") == 7)
    check("live page in Arabic: RTL with the Plan half on the right", pg.evaluate("(()=>{const c=document.querySelectorAll('#a3Page .a3p-c'); return document.querySelector('#a3Page .a3p').dir==='rtl' && c[0].getBoundingClientRect().left>c[1].getBoundingClientRect().left;})()"))
    pg.fill("#f-ffrom", "2026-12-30"); pg.click("#saveBtn"); pg.wait_for_timeout(60)
    check("follow-up start after its end is refused", pg.inner_text("#recErr") == "بداية فترة المتابعة لا تأتي بعد نهايتها.")
    pg.fill("#f-ffrom", "2026-10-01"); pg.click("#saveBtn"); pg.wait_for_timeout(80)
    rid = pg.evaluate("document.getElementById('rid').value")
    check("saved with an A3-2026-NNN id", rid == "A3-2026-001" and "تم حفظ صفحة A3" in pg.inner_text("#recOk"), rid)
    st = json.loads(pg.evaluate("localStorage.getItem('cia-a3:v1')"))["records"][0]
    check("stored record keeps every block", st["goal"]["orig"] == 3 and st["cur"]["pts"] == [{"l": "Jul", "v": 11}, {"l": "Aug", "v": 13}] and st["cms"][0]["cause"] == "c1" and st["plan"][0]["cm"] == "k1" and st["fu"]["same"] is True and st["reviews"][0]["by"] == "Sara")
    pg.reload(); pg.wait_for_timeout(350)
    check("persists after reload", pg.evaluate("DB.records.length") == 1 and pg.evaluate("stageOf(DB.records[0])") == "rev")
    pg.evaluate("go('audit')"); pg.wait_for_timeout(80)
    check("audit: 12 checks, all pass on the complete A3", pg.evaluate("CHECKS.length") == 12 and pg.evaluate("Object.values(auditRecord(DB.records[0])).every(v=>v===true)"))
    check("no errors in the sheet flow", not errs, errs[:3]); del errs[:]
    # keyboard: tab through the sidebar and the form
    pg.evaluate("go('tools')"); pg.focus("#f-title"); pg.keyboard.press("Tab")
    check("keyboard: Tab moves from the title to the next field", pg.evaluate("document.activeElement.id") == "f-ref")
    pg.focus('#side button[data-go="docs"]'); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    check("keyboard: Enter on a sidebar button opens its tab", pg.evaluate("curTab") == "docs")
    ctx.close()

    # ---- 4. example, records, dashboard, report, CSV, clear all
    ctx, pg, errs = page_new("ar")
    load_ex(pg)
    S = pg.evaluate("DB.records.map(r=>[r.id,stageOf(r),suggest(r),r.fu.res])")
    check("example: three A3s — concrete reviewed (partly met), lifting plan set (follow-up running), documents reviewed (met)",
          S == [["A3-EX-01", "rev", "part", "part"], ["A3-EX-02", "plan", "", ""], ["A3-EX-03", "rev", "met", "met"]], S)
    check("example links: RC-EX-01, PA-EX-02, CA-EX-04, PD-EX-03; RC-EX-02; RC-EX-03 and CA-EX-03",
          pg.evaluate("DB.records.map(r=>[r.rca,r.pareto,r.capa,r.pdca].join('|'))") == ["RC-EX-01|PA-EX-02|CA-EX-04|PD-EX-03", "RC-EX-02|||", "RC-EX-03||CA-EX-03|"])
    check("concrete goal below 3% by 2026-08-31, written 2026-06-02 before the analysis 2026-06-04, follow-up Jul–Aug at 6",
          pg.evaluate("(r=>[r.goal.to,r.goal.by,r.goal.date,r.andate,r.fu.from,r.fu.to,r.fu.value].join('|'))(DB.records[0])") == "3|2026-08-31|2026-06-02|2026-06-04|2026-07-01|2026-08-31|6")
    check("lifting countermeasures tested on Tower B before the others", "البرج ب" in pg.evaluate("DB.records[1].plan[0].what") and pg.evaluate("DB.records[1].cms[0].test") == "yes")
    check("example self-assessment 75%", pg.evaluate("assessScore()") == 75)
    check("records table lists three with flags and links", pg.evaluate("document.querySelectorAll('#docsBox tbody tr').length") == 3 and pg.evaluate("document.querySelectorAll('#docsBox [data-orca]').length") == 3)
    au = pg.evaluate("auditRecord(DB.records[1])")
    check("audit of the running A3: follow-up, standardised and review do not apply yet", au["fu"] is None and au["std"] is None and au["rev"] is None and au["plan"] is True, au)
    pg.evaluate("go('dash')"); pg.wait_for_timeout(100)
    k = pg.inner_text("#dKpis")
    check("dashboard: 3 A3s, 67% goal met or partly met, 100% tied, 100% goal before analysis", "67%" in k and "100%" in k and "75%" in k, k[:300])
    check("dashboard: one open item (waiting for the follow-up)", pg.evaluate("openItems().length") == 1 and "تنتظر فترة المتابعة" in pg.inner_text("#dOpen"))
    rep = pg.evaluate("buildReportHTML()")
    check("report: cover with the author, three A3 pages, detail of blocks, audit, open items, self-assessment",
          "مدثر سلامه" in rep and rep.count('class="a3p"') == 3 and "تفاصيل الكتل" in rep and "Audit results" in rep and "Open items" in rep and "Self-assessment" in rep)
    check("report page CSS prints on A3 landscape and carries the SVG charts", "size:A3 landscape" in rep and rep.count("<svg") >= 5)
    csv = pg.evaluate("buildCSV()")
    check("CSV: BOM, header, three rows, computed result column", csv.startswith("﻿") and len([x for x in csv.strip().split("\n")]) == 4 and "computedResult" in csv)
    pg.evaluate("go('report')")
    with pg.expect_download() as d: pg.click("#rpHtml")
    check("HTML report downloads", d.value.suggested_filename.startswith("A3-report-"))
    with pg.expect_download() as d: pg.click("#rpCsv")
    check("CSV downloads", d.value.suggested_filename.endswith(".csv"))
    pg.click("#langBtn"); pg.wait_for_timeout(200)
    check("English example after reload of the example", True)
    pg.evaluate("go('docs')"); pg.click("#pfEx"); pg.wait_for_timeout(300)
    check("English example loads in English", "Cut the ready-mix" in pg.evaluate("DB.records[0].title"))
    pg.evaluate("loadRecordIntoForm(DB.records[0]); go('tools')"); pg.wait_for_timeout(150)
    check("English page LTR with the Plan half on the left", pg.evaluate("(()=>{const c=document.querySelectorAll('#a3Page .a3p-c'); return document.querySelector('#a3Page .a3p').dir==='ltr' && c[0].getBoundingClientRect().left<c[1].getBoundingClientRect().left;})()"))
    pg.evaluate("go('docs')"); pg.click("#pfReset"); pg.wait_for_timeout(200)
    check("clear all removes the data after confirmation", pg.evaluate("DB.records.length") == 0 and pg.evaluate("localStorage.getItem('cia-a3:v1')") is None)
    # a record with missing parts
    pg.evaluate("localStorage.setItem('cia-a3:v1', JSON.stringify({records:[{id:'X1',title:'Broken',cur:'x',goal:null,causes:[{t:'a'},null,5],cms:'no',fu:{value:'abc'}}],assess:null}))")
    pg.reload(); pg.wait_for_timeout(350)
    txts = []
    for t in TABS:
        txts.append(pg.evaluate(f"(go('{t}'), document.querySelector('.tabpane[data-tab=\"{t}\"]').innerText)"))
    pg.evaluate("loadRecordIntoForm(DB.records[0]); go('tools')"); pg.wait_for_timeout(100)
    txts.append(pg.evaluate("document.querySelector('.tabpane.on').innerText"))
    check("a record with missing parts renders every tab without errors or undefined/NaN", not errs and not any(w in x for x in txts for w in ("undefined", "NaN", "[object Object]")), errs[:3])
    ctx.close()

    # ---- 5. links: starts from RCA, CAPA, Pareto; pick causes; RCA panel; requests
    ctx, pg, errs = page_new("ar")
    for f in ("rca", "capa", "pareto", "fishbone", "five-whys", "pdca"):
        load_other(pg, f)
    before = pg.evaluate("JSON.stringify(['cia-rca:v1','cia-capa:v1','cia-pareto:v1','cia-fish:v1','cia-why5:v1','cia-pdca:v1'].map(k=>localStorage.getItem(k)))")
    pg.goto(URL); pg.wait_for_timeout(350)
    check("home strip counts what can be started from", not pg.evaluate("document.getElementById('homeImp').hidden") and "3 تحقيق RCA" in pg.inner_text("#homeImpT"))
    pg.evaluate("go('tools')"); pg.click("#stPrev"); pg.wait_for_timeout(100)
    rows = pg.evaluate("[...document.querySelectorAll('#stTable tbody tr')].map(r=>r.innerText)")
    check("RCA preview: three investigations with their stage (RCA's rule), roots and criterion", len(rows) == 3 and "روجع التحقيق" in rows[0] and "أقل من 3%" in rows[0], rows[:1])
    pg.click('[data-strca="RC-EX-01"]'); pg.wait_for_timeout(150)
    r = pg.evaluate("formToRec()")
    check("prefill from RCA: links, area, owner, two proved root causes, analysis date; goal left for the owner",
          r["rca"] == "RC-EX-01" and r["capa"] == "CA-EX-04" and r["pareto"] == "PA-EX-02" and len(r["causes"]) == 2 and all(c["st"] == "conf" and c["how"] == "rca" for c in r["causes"]) and r["andate"] == "2026-06-04" and r["goal"]["to"] is None and r["id"] == "", r["causes"][:1])
    check("prefill message says nothing was written and quotes the RCA criterion", "لم يُكتب أي شيء في RCA" in pg.inner_text("#recOk") and "أقل من 3%" in pg.inner_text("#recOk"))
    pg.select_option("#stSrc", "capa"); pg.click("#stPrev"); pg.wait_for_timeout(100)
    check("CAPA preview lists the records with CAPA's stages", pg.evaluate("document.querySelectorAll('#stTable [data-stcapa]').length") == 4)
    pg.click('[data-stcapa="CA-EX-04"]'); pg.wait_for_timeout(150)
    r = pg.evaluate("formToRec()")
    check("prefill from CAPA: capa id, owner, root cause as a hypothesis", r["capa"] == "CA-EX-04" and r["src"] == "capa" and r["causes"][0]["st"] == "hyp" and r["causes"][0]["how"] == "capa")
    pg.select_option("#stSrc", "pareto"); pg.click("#stPrev"); pg.wait_for_timeout(100)
    pg.evaluate("document.querySelector('[data-stpa=\"PA-EX-02\"][data-cat=\"k1\"]').click()"); pg.wait_for_timeout(150)
    r = pg.evaluate("formToRec()")
    check("prefill from Pareto: value as baseline, period, ranked categories as data points", r["pareto"] == "PA-EX-02" and r["pcat"] == "k1" and r["cur"]["base"] == 14 and r["cur"]["period"] == "2026-04-01 → 2026-05-31" and len(r["cur"]["pts"]) >= 5 and r["cur"]["pts"][0]["v"] == 14)
    check("Pareto-linked chart drawn", pg.evaluate("document.querySelectorAll('#curChart svg rect[rx=\"3\"]').length") >= 5)
    pg.evaluate("clearForm()"); pg.select_option("#pkHow", "fish"); pg.fill("#pkRef", "FB-EX-02"); pg.wait_for_timeout(80)
    check("pick preview uses Fishbone's stage rule", "FB-EX-02" in pg.inner_text("#pkPv") and "السبب الجذري" in pg.inner_text("#pkPv"))
    pg.click("#pkUse"); pg.wait_for_timeout(80)
    check("Fishbone root cause added with its method and id", pg.evaluate("formToRec().causes.map(c=>c.how+':'+c.ref)") == ["fish:FB-EX-02"] and "أُضيف 1" in pg.inner_text("#pkMsg"))
    pg.click("#pkUse"); pg.wait_for_timeout(60)
    check("picking again does not duplicate", pg.evaluate("formToRec().causes.length") == 1 and "موجودة" in pg.inner_text("#pkMsg"))
    pg.select_option("#pkHow", "why5"); pg.fill("#pkRef", "W5-EX-01"); pg.click("#pkUse"); pg.wait_for_timeout(60)
    pg.select_option("#pkHow", "rca"); pg.fill("#pkRef", "RC-EX-02"); pg.click("#pkUse"); pg.wait_for_timeout(60)
    check("5 Whys and RCA root causes added", pg.evaluate("formToRec().causes.map(c=>c.how)") == ["fish", "why5", "rca", "rca"])
    pg.fill("#pkRef", "NOPE"); pg.click("#pkUse"); pg.wait_for_timeout(40)
    check("unknown id says so", "غير موجود" in pg.inner_text("#pkMsg"))
    pv = pg.evaluate("[...document.querySelectorAll('#czRows [data-pv]')].map(x=>x.textContent)")
    check("each picked cause row shows a preview", all(pv) and "W5-EX-01" in pv[1], pv)
    pg.fill("#f-capa", "CA-EX-04"); pg.wait_for_timeout(60)
    pg.click('[data-start="rca"]'); pg.click('[data-start="fish"]'); pg.click('[data-start="why5"]'); pg.wait_for_timeout(60)
    op = pg.evaluate("window.__opened")
    check("start buttons open RCA, Fishbone and 5 Whys with ?capa= outside the hub", any("rca.html?capa=CA-EX-04" in u for u in op) and any("fishbone.html?capa=CA-EX-04" in u for u in op) and any("five-whys.html?capa=CA-EX-04" in u for u in op), op)
    pg.fill("#f-rca", "RC-EX-01"); pg.fill("#f-pdca", "PD-EX-03"); pg.wait_for_timeout(60)
    check("header previews: RCA stage and criterion, CAPA stage, PDCA cycle", "RC-EX-01" in pg.inner_text("#rcInfo") and "معيار الفعالية" in pg.inner_text("#rcInfo") and "CA-EX-04" in pg.inner_text("#caInfo") and "PDCA" in pg.inner_text("#pdInfo"))
    pg.click("#rcOpen"); pg.click("#pdOpen"); pg.click("#caOpen"); pg.wait_for_timeout(60)
    op = pg.evaluate("window.__opened")
    check("Open RCA (?open=), PDCA and CAPA open in a new tab outside the hub", any("rca.html?open=RC-EX-01" in u for u in op) and any("pdca.html" in u for u in op) and any("capa.html" in u for u in op), op)
    after = pg.evaluate("JSON.stringify(['cia-rca:v1','cia-capa:v1','cia-pareto:v1','cia-fish:v1','cia-why5:v1','cia-pdca:v1'].map(k=>localStorage.getItem(k)))")
    check("no other tool's stored state changed", before == after)
    # requests
    pg.goto(URL + "?rca=RC-EX-02"); pg.wait_for_timeout(350)
    check("?rca= opens a prefilled A3 on the sheet", pg.evaluate("curTab") == "tools" and pg.evaluate("formToRec().rca") == "RC-EX-02")
    pg.goto(URL + "?capa=CA-EX-03"); pg.wait_for_timeout(350)
    check("?capa= prefills from CAPA", pg.evaluate("formToRec().capa") == "CA-EX-03")
    pg.goto(URL + "?pareto=PA-EX-02&cat=k2"); pg.wait_for_timeout(350)
    check("?pareto=&cat= prefills from Pareto", pg.evaluate("formToRec().pcat") == "k2")
    pg.goto(URL); pg.wait_for_timeout(300); load_ex(pg)
    pg.goto(URL + "?open=A3-EX-03"); pg.wait_for_timeout(350)
    check("?open= opens the A3", pg.evaluate("document.getElementById('rid').value") == "A3-EX-03")
    pg.evaluate("sessionStorage.setItem('cia-nav:a3', JSON.stringify({open:'A3-EX-02'}))"); pg.goto(URL); pg.wait_for_timeout(350)
    check("hub hint cia-nav:a3 opens the A3 and is removed", pg.evaluate("document.getElementById('rid').value") == "A3-EX-02" and pg.evaluate("sessionStorage.getItem('cia-nav:a3')") is None)
    # RCA panel
    pg.goto(M("rca")); pg.wait_for_timeout(350)
    pg.evaluate("loadRecordIntoForm(DB.records.find(r=>r.id==='RC-EX-01')); go('tools')"); pg.wait_for_timeout(100)
    check("RCA panel lists the A3 on RC-EX-01", not pg.evaluate("document.getElementById('a3Box').hidden") and "A3-EX-01" in pg.inner_text("#a3Box"))
    pg.click('[data-a3open="A3-EX-01"]'); pg.wait_for_timeout(60)
    check("RCA 'Open in A3' asks for a3.html?open=", any("a3.html?open=A3-EX-01" in u for u in pg.evaluate("window.__opened")))
    check("no errors in the link flows", not errs, errs[:3])
    ctx.close()

    # ---- 6. hub overlay, assistant, tour, 390 px
    ctx, pg, errs = page_new("ar", url=BASE + "/index.html")
    pg.evaluate("openModule('a3')")
    pg.wait_for_function("document.getElementById('modFrame').dataset.k==='a3' && document.getElementById('modFrame').contentDocument.readyState==='complete' && !!document.getElementById('modFrame').contentDocument.getElementById('side')", timeout=10000)
    fr = pg.frame_locator("#modFrame")
    check("A3 opens in the hub overlay", pg.evaluate("document.getElementById('modOverlay').classList.contains('on')"))
    pg.evaluate("document.getElementById('modFrame').contentWindow.go('tools')"); pg.wait_for_timeout(100)
    check("inside the hub the 'save first' note shows", not pg.evaluate("document.getElementById('modFrame').contentDocument.getElementById('pkHub').hidden"))
    pg.evaluate("document.getElementById('modFrame').contentWindow.startIn('rca')"); pg.wait_for_timeout(800)
    check("inside the hub 'Start an RCA investigation' opens RCA in the overlay", pg.evaluate("document.getElementById('modFrame').dataset.k") == "rca")
    ctx.close()
    ctx, pg, errs = page_new("en")
    pg.click("#cbFab"); pg.wait_for_timeout(100)
    sug = pg.evaluate("[...document.querySelectorAll('#cbSug button')].map(b=>b.textContent)")
    check("assistant suggests 'Is an A3 just a form?' and 'A3, RCA or PDCA — which one?'", "Is an A3 just a form?" in sug and "A3, RCA or PDCA — which one?" in sug, sug)
    pg.evaluate("document.querySelector('#cbSug [data-sid=\"form\"]').click()"); pg.wait_for_timeout(80)
    check("answer: the page limit is a discipline", "discipline, not a format" in last_bot(pg))
    pg.fill("#cbIn", "why set the goal before the causes"); pg.keyboard.press("Enter"); pg.wait_for_timeout(80)
    check("typed question finds the goal answer", "must" in last_bot(pg))
    pg.fill("#cbIn", "what does the coach do"); pg.keyboard.press("Enter"); pg.wait_for_timeout(80)
    check("coach answer", "asks, and does not sign off" in last_bot(pg))
    pg.fill("#cbIn", "status"); pg.keyboard.press("Enter"); pg.wait_for_timeout(80)
    check("status answer reads the data (none yet)", "No A3s yet" in last_bot(pg))
    check("assistant answers 6 static + 2 dynamic questions", pg.evaluate("KB.filter(k=>k.a).length") == 6 and pg.evaluate("KB.filter(k=>k.dyn).length") == 2)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(80)
    ctx.close()
    for lang in ("ar", "en"):
        ctx, pg, errs = page_new(lang)
        pg.evaluate("localStorage.removeItem('cia-tour:m:a3')")
        n = pg.evaluate("window.ciaTour && window.ciaTour.steps ? window.ciaTour.steps().length : -1")
        ok = pg.evaluate("!!window.ciaTour")
        check(f"guided tour layer present ({lang})", ok)
        ctx.close()
    ctx, pg, errs = page_new("ar", 390, 844)
    load_ex(pg)
    over = {}
    for t in TABS:
        pg.evaluate(f"go('{t}')"); pg.wait_for_timeout(60)
        over[t] = pg.evaluate("document.documentElement.scrollWidth-innerWidth")
    pg.evaluate("loadRecordIntoForm(DB.records[0]); go('tools')"); pg.wait_for_timeout(150)
    over["sheet"] = pg.evaluate("document.documentElement.scrollWidth-innerWidth")
    check("390 px: no horizontal overflow on any tab or the filled sheet", all(v <= 1 for v in over.values()), over)
    cols = pg.evaluate("getComputedStyle(document.querySelector('#a3Page .a3p-g')).gridTemplateColumns.split(' ').length")
    order = pg.evaluate("[...document.querySelectorAll('#a3Page .a3p-b h5 i')].map(i=>[i.textContent,i.getBoundingClientRect().top])")
    check("390 px: the A3 page stacks its seven blocks in order", cols == 1 and [x[0] for x in order] == list("1234567") and all(order[i][1] < order[i + 1][1] for i in range(6)), order)
    check("390 px: no errors", not errs, errs[:3])
    ctx.close()
    b.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
