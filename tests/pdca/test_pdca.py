import os, sys, json, traceback
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
URL="file://"+os.path.abspath(os.environ.get("PDCA_URL") or os.path.join(HERE,"..","..","modules","pdca.html"))
results=[]
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ")+name+(("  -- "+str(detail)) if detail and not cond else ""))

with sync_playwright() as p:
    b=p.chromium.launch()
    def page_new(lang="ar", w=1280, h=900):
        ctx=b.new_context(viewport={"width":w,"height":h}, accept_downloads=True)
        pg=ctx.new_page()
        errs=[]
        pg.on("pageerror", lambda e: errs.append("pageerror: "+str(e)))
        pg.on("console", lambda m: errs.append("console."+m.type+": "+m.text) if (m.type=="error" and "Failed to load resource" not in m.text) else None)
        pg.add_init_script("try{localStorage.setItem('cia-lang','%s');localStorage.setItem('cia-tour:m:pdca','done')}catch(e){}" % lang)
        pg.goto(URL)
        pg.wait_for_timeout(300)
        return ctx,pg,errs

    # ---- 1. load, Arabic default, no errors
    ctx,pg,errs=page_new("ar")
    check("loads in Arabic RTL", pg.evaluate("document.documentElement.dir")=="rtl")
    pg.click('#side button[data-go="explain-std"]'); pg.wait_for_timeout(150)
    check("kit renders standard guide when its tab opens", pg.evaluate("document.getElementById('ex-std-box').innerText.length")>200)
    pg.evaluate("location.hash='#explain-cl'"); pg.wait_for_timeout(200)
    check("clause guide index shows 4 stages", pg.evaluate("document.querySelectorAll('#ex-cl-box [data-ex-sec]').length")==4)
    pg.click('#ex-cl-box [data-ex-sec="P"]'); pg.wait_for_timeout(200)
    check("opening Plan shows PL1-PL3 (kit drawer)", pg.evaluate("['PL1','PL2','PL3'].every(c=>document.body.innerText.includes(c))"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("no JS errors on load (ar)", not errs, errs[:5])

    # ---- 2. tabs and sidebar selection
    for tab in ["home","explain-std","explain-cl","assess","tools","docs","audit","dash","report","ai"]:
        pg.click(f'#side button[data-go="{tab}"]'); pg.wait_for_timeout(60)
        on=pg.evaluate(f"document.querySelector('.tabpane[data-tab=\"{tab}\"]').classList.contains('on')")
        sel=pg.evaluate(f"document.querySelector('#side button[data-go=\"{tab}\"]').getAttribute('aria-selected')")
        check(f"tab {tab} shows and is selected", on and sel=="true")
    check("no JS errors after tab sweep", not errs, errs[:5])

    # ---- 3. language toggle
    pg.click("#langBtn"); pg.wait_for_timeout(120)
    check("toggle to English sets LTR", pg.evaluate("document.documentElement.dir")=="ltr")
    check("English brand text", "Continual Improvement Academy" in pg.inner_text("body"))
    check("kit re-renders in English", "Plan" in pg.evaluate("document.getElementById('ex-std-box').innerText"))
    pg.click("#langBtn"); pg.wait_for_timeout(120)
    check("toggle back to Arabic", pg.evaluate("document.documentElement.dir")=="rtl")

    # ---- 4. assessment
    pg.click('#side button[data-go="assess"]'); pg.wait_for_timeout(80)
    pg.check('input[name="as-PL1"][value="2"]'); pg.check('input[name="as-PL2"][value="1"]')
    pg.wait_for_timeout(120)
    stored=pg.evaluate("JSON.parse(localStorage.getItem('cia-pdca:v1')).assess")
    check("assessment answers persisted", stored.get("PL1")==2 and stored.get("PL2")==1, stored)
    pct=pg.inner_text("#asPct")
    check("gauge value correct (15%)", pct=="15%", pct)

    # ---- 5. record validation
    pg.click('#side button[data-go="tools"]'); pg.wait_for_timeout(80)
    pg.click("#saveBtn"); pg.wait_for_timeout(80)
    check("empty save is refused", "عنوان" in pg.inner_text("#recErr") or pg.inner_text("#recErr")!="" , pg.inner_text("#recErr"))
    pg.fill("#h-title","تحسين اعتماد الاعتمادات الفنية")
    pg.click("#saveBtn"); pg.wait_for_timeout(60)
    check("missing reference refused", pg.inner_text("#recErr")!="" )
    pg.fill("#h-linkRef","NCR-2026-014"); pg.fill("#h-owner","مدير الهندسة")
    pg.fill("#h-due","2026-11-30"); pg.fill("#h-start","2026-10-01")
    pg.fill("#fld-plan-problem","تأخر إرجاع الاعتمادات الفنية عن الموعد المتفق عليه")
    pg.fill("#fld-plan-objective","تقليل التأخير")
    pg.fill("#fld-plan-baseline","يُحسب من سجل الاعتمادات للربع الأخير")
    pg.fill("#fld-plan-target","أقل من 10% خلال 30 يوماً")
    pg.fill("#fld-plan-actions","تدريب المراجعين على النموذج الجديد — مدير الهندسة — 2026-10-15")
    pg.click("#saveBtn"); pg.wait_for_timeout(80)
    check("valid plan saves with id", pg.inner_text("#recOk").startswith("تم حفظ") or "PD-" in pg.inner_text("#recOk"), pg.inner_text("#recOk"))
    check("stage badge is Plan", "تخطيط" in pg.inner_text("#curStage"), pg.inner_text("#curStage"))
    # result without target met -> refused
    pg.fill("#fld-check-result","تأخر 12%")
    pg.click("#saveBtn"); pg.wait_for_timeout(60)
    check("result without 'target met' refused", pg.inner_text("#recErr")!="", pg.inner_text("#recErr"))
    pg.select_option("#fld-check-targetMet","no")
    pg.select_option("#fld-act-decision","close")
    pg.click("#saveBtn"); pg.wait_for_timeout(60)
    check("closing a missed-target cycle is refused", pg.inner_text("#recErr")!="" and "تعديل" in pg.inner_text("#recErr"), pg.inner_text("#recErr"))
    pg.select_option("#fld-act-decision","adjust"); pg.click("#saveBtn"); pg.wait_for_timeout(60)
    check("adjust decision saves; stage becomes Act", pg.inner_text("#recErr")=="" and "تصرّف" in pg.inner_text("#curStage"), pg.inner_text("#curStage"))
    pg.select_option("#fld-check-targetMet","yes"); pg.select_option("#fld-act-decision","close")
    pg.fill("#fld-act-standard","إضافة بند «مراجعة الاعتماد خلال 5 أيام عمل» إلى إجراء المراجعة")
    pg.click("#saveBtn"); pg.wait_for_timeout(60)
    check("closing a met-target cycle saves", pg.inner_text("#recErr")=="", pg.inner_text("#recErr"))
    check("closed stage badge", "مغلقة" in pg.inner_text("#curStage"), pg.inner_text("#curStage"))
    check("no JS errors after save", not errs, errs[:5])

    # ---- 6. docs and open / delete
    pg.click('#side button[data-go="docs"]'); pg.wait_for_timeout(80)
    check("record appears in Documents", "NCR-2026-014" in pg.inner_text("#docsBox"))
    check("sidebar count badge is 1", pg.inner_text("#cntDocs")=="1", pg.inner_text("#cntDocs"))
    pg.click("[data-open]"); pg.wait_for_timeout(80)
    check("open loads record into tool", pg.input_value("#h-title")=="تحسين اعتماد الاعتمادات الفنية")

    # ---- 7. audit and dashboard
    pg.click('#side button[data-go="audit"]'); pg.wait_for_timeout(80)
    check("audit table lists the record", "NCR-2026-014" in pg.inner_text("#auBox"))
    check("audit KPI tiles present", pg.evaluate("document.querySelectorAll('#auKpis .pd-kpi').length")==4)
    pg.click('#side button[data-go="dash"]'); pg.wait_for_timeout(80)
    check("dashboard has 7 KPI tiles", pg.evaluate("document.querySelectorAll('#dKpis .pd-kpi').length")==7)

    # ---- 8. report downloads
    pg.click('#side button[data-go="report"]'); pg.wait_for_timeout(80)
    with pg.expect_download() as d:
        pg.click("#rpHtml")
    dl=d.value; path=dl.path()
    html=open(path,encoding="utf-8").read()
    check("HTML report named PDCA-report-*.html", dl.suggested_filename.startswith("PDCA-report-") and dl.suggested_filename.endswith(".html"), dl.suggested_filename)
    check("report carries author name مدثر سلامه", "مدثر سلامه" in html)
    check("report includes record and source line", "NCR-2026-014" in html and "0.3.2" in html and "10.2" in html)
    with pg.expect_download() as d2:
        pg.click("#rpCsv")
    csv=open(d2.value.path(),encoding="utf-8-sig").read()
    check("CSV has header and record row", csv.splitlines()[0].startswith("id,title") and "NCR-2026-014" in csv)

    # ---- 9. persistence across reload
    pg.reload(wait_until="load")
    pg.wait_for_function("typeof go==='function' && !!document.querySelector('#side button[data-go=\"docs\"]')", timeout=10000)
    pg.click('#side button[data-go="docs"]')
    pg.wait_for_function("document.querySelector('.tabpane[data-tab=\"docs\"]').classList.contains('on') && !!document.querySelector('#docsBox table') && document.getElementById('docsBox').innerText.indexOf('NCR-2026-014')>=0", timeout=10000)
    dtxt=pg.inner_text("#docsBox")
    check("record persists after reload", "NCR-2026-014" in dtxt, dtxt[:200])
    # delete (two-step)
    pg.click('[data-del]'); pg.wait_for_timeout(40)
    check("first delete click arms confirmation", "تأكيد" in pg.inner_text("#docsBox"))
    pg.click('[data-del]'); pg.wait_for_timeout(60)
    check("second click deletes", "لا توجد دورات" in pg.inner_text("#docsBox"))
    check("no JS errors through full flow", not errs, errs[:5])
    ctx.close()

    # ---- 9b. platform identity, example data, clear all, robustness and tour (added 2026-10-10)
    ctx,pg,errs=page_new("ar")
    check("home button back to the hub is present", pg.evaluate("!!document.getElementById('ciaHomeBtn')"))
    check("Arabic brand line in AR", "أكاديمية التحسين المستمر" in pg.inner_text("#brandBy"), pg.inner_text("#brandBy"))
    check("language button reads English in AR", pg.inner_text("#langLabel")=="English", pg.inner_text("#langLabel"))
    check("sidebar uses SVG icons", pg.evaluate("document.querySelectorAll('#side button[data-t] .ic svg').length")==10)
    check("launch grid has 9 tiles", pg.evaluate("document.querySelectorAll('#launchGrid a').length")==9)
    check("related tools strip has 4 links", pg.evaluate("document.querySelectorAll('#homeStd a.hs').length")==4)
    pg.on("dialog", lambda d: d.accept())
    pg.click('#side button[data-go="docs"]'); pg.wait_for_timeout(60)
    pg.click("#pfEx"); pg.wait_for_function("document.querySelectorAll('#docsBox tbody tr').length===3", timeout=5000)
    st=pg.evaluate("JSON.parse(localStorage.getItem('cia-pdca:v1'))")
    check("example loads 3 linked cycles", len(st["records"])==3 and all(r["linkRef"] for r in st["records"]), len(st["records"]))
    check("example stages: closed, check, act", pg.evaluate("DB.records.map(stageOf).join(',')")=="closed,check,act", pg.evaluate("DB.records.map(stageOf).join(',')"))
    check("example self-assessment is 65%", pg.evaluate("assessScore()")==65, pg.evaluate("assessScore()"))
    for tab in ["home","explain-std","explain-cl","assess","tools","docs","audit","dash","report","ai"]:
        pg.evaluate(f"go('{tab}')"); pg.wait_for_timeout(40)
    check("no errors with example data on every tab", not errs, errs[:5])
    pg.click('#side button[data-go="docs"]'); pg.wait_for_timeout(60)
    pg.click("#pfReset"); pg.wait_for_timeout(80)
    check("clear all removes the stored data", pg.evaluate("localStorage.getItem('cia-pdca:v1')") is None and "لا توجد دورات" in pg.inner_text("#docsBox"))
    pg.evaluate("localStorage.setItem('cia-pdca:v1', JSON.stringify({records:[{id:'PD-X',title:'t',linkType:'ncr',linkRef:'R-1'}],assess:{}}))")
    pg.reload(wait_until="load"); pg.wait_for_function("typeof go==='function'", timeout=10000)
    for tab in ["docs","audit","dash","report"]:
        pg.evaluate(f"go('{tab}')"); pg.wait_for_timeout(40)
    pg.evaluate("go('docs')"); pg.wait_for_timeout(60)
    dtx=pg.evaluate("document.getElementById('docsBox').innerText")
    check("a record without stage objects renders without errors", (not errs) and "R-1" in dtx, [errs[:5], dtx[:120]])
    pg.evaluate("localStorage.removeItem('cia-pdca:v1')")
    pg.evaluate("ciaTour.start('full')"); pg.wait_for_timeout(200)
    seen=set(); n=0
    while pg.evaluate("ciaTour.state().active") and n<80:
        s=pg.evaluate("ciaTour.state()")
        check_title = s["title"].strip()
        if not check_title: errs.append("empty tour title at step %d" % s["i"])
        seen.add(pg.evaluate("(document.querySelector('.tabpane.on')||{}).getAttribute ? document.querySelector('.tabpane.on').getAttribute('data-tab') : ''"))
        pg.evaluate("ciaTour.next()"); pg.wait_for_timeout(230); n+=1
    check("full tour covers all 9 sections after home", {"explain-std","explain-cl","assess","tools","docs","audit","dash","report","ai"}<=seen, sorted(seen))
    check("tour has no empty titles and no errors", not errs, errs[:5])
    ctx.close()

    # ---- 10. English run + keyboard navigation + mobile width
    ctx,pg,errs=page_new("en",390,844)
    check("English loads LTR", pg.evaluate("document.documentElement.dir")=="ltr")
    pg.focus('#side button[data-go="home"]'); pg.keyboard.press("Tab"); pg.keyboard.press("Enter"); pg.wait_for_timeout(80)
    check("keyboard can switch tabs (focus next + Enter)", pg.evaluate("curTab")!="home", pg.evaluate("curTab"))
    for tab in ["home","explain-std","explain-cl","assess","tools","docs","audit","dash","report","ai"]:
        pg.evaluate(f"go('{tab}')"); pg.wait_for_timeout(60)
        sw=pg.evaluate("document.documentElement.scrollWidth")
        check(f"no horizontal scroll at 390px on {tab} (sw={sw})", sw<=390, sw)
    check("no JS errors in English/mobile run", not errs, errs[:5])
    ctx.close()
    b.close()

failed=[r for r in results if not r[1]]
print(f"\n{len(results)-len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
