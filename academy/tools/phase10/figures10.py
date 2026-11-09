"""Phase 10 explanatory figures (D-32 pattern): original CIA diagrams for every lesson of the seven Excellence Academy courses,
the course pages and the EFQM Assessment Lab. Criterion NAMES only (EFQM Model 2025); no EFQM artwork, diagrams or text. Numbers in
example charts are illustrative and say so. PLACEMENT maps a lesson id or "course:<id>" to figure ids. Author: مدثر سلامه."""
T = lambda en, ar: {"en": en, "ar": ar}  # noqa: E731
FIGS = []
PLACEMENT = {}
L = T


def fig(fid, template, caption, read, where=(), **params):
    f = {"id": fid, "template": template, "caption": T(*caption), "read": T(*read), **params}
    FIGS.append(f)
    for w in where:
        PLACEMENT.setdefault(w, []).append(fid)
    return fid


def st(en, ar, d=None, tag=None):
    x = {"t": T(en, ar)}
    if d:
        x["d"] = T(*d)
    if tag:
        x["tag"] = T(*tag) if isinstance(tag, tuple) else T(tag, tag)
    return x


# ---------------------------------------------------------------- CRS-EFQM-101
fig("FIG-EX-LENS", "table", ("Three lenses: compliance, a standard and an excellence model", "ثلاث عدسات: الامتثال والمعيار ونموذج التميز"),
    ("Read each row across. Compliance and a standard ask whether requirements are met; an excellence model asks how good the whole organisation is and whether it is improving. They work together.",
     "اقرأ كل صف أفقيًا. يسأل الامتثال والمعيار هل المتطلبات مستوفاة؛ ويسأل نموذج التميز ما مدى جودة المنظمة كلها وهل تتحسن. وهي تعمل معًا."),
    ["CRS-EFQM-101-L01"], cols=[L("Compliance", "الامتثال"), L("Standard", "المعيار"), L("Excellence", "التميز")],
    rows=[{"t": L("Question", "السؤال"), "cells": [L("Rules met?", "القواعد؟"), L("Requirements?", "المتطلبات؟"), L("How good?", "ما الجودة؟")]},
          {"t": L("Nature", "الطبيعة"), "cells": [L("Mandatory", "إلزامي"), L("Certifiable", "قابل للمنح"), L("Framework", "إطار")]},
          {"t": L("Scope", "النطاق"), "cells": [L("Legal duties", "الواجبات"), L("One system", "نظام واحد"), L("Whole body", "المنظمة كلها")]},
          {"t": L("Output", "المُخرَج"), "cells": [L("Pass / fail", "نجاح / إخفاق"), L("Certificate", "شهادة"), L("Priorities", "أولويات")]}])
fig("FIG-EX-STAKE", "hub", ("Purpose at the centre, stakeholders around it", "الغاية في المركز وأصحاب المصلحة حولها"),
    ("Each box is a stakeholder group. For each, leaders should be able to state the promise, the measure that shows it is kept, and the action where it is not.",
     "كل مربع فئة من أصحاب المصلحة. ولكلٍّ منها ينبغي أن يستطيع القادة ذكر الوعد، والمقياس الذي يُظهر الوفاء به، والإجراء حيث لا يُوفى به."),
    ["CRS-EFQM-101-L02"], center=L("Purpose", "الغاية"),
    spokes=[L("Customers", "العملاء"), L("People", "الموظفون"), L("Owners / funders", "الملاك / الممولون"), L("Partners & suppliers", "الشركاء والموردون"), L("Society", "المجتمع"), L("Regulators", "الجهات التنظيمية")])
fig("FIG-EX-DER", "flow", ("The chain: Direction, Execution, Results", "السلسلة: التوجه والتنفيذ والنتائج"),
    ("Read left to right, then follow the dashed arrow back: results tell leaders whether to keep, change or stop what they do. A gap anywhere breaks the chain.",
     "اقرأ من البداية إلى النهاية، ثم اتبع السهم المتقطع عائدًا: تخبر النتائج القادة هل يستمرون فيما يفعلون أو يغيّرونه أو يوقفونه. وأي فجوة في أي موضع تكسر السلسلة."),
    ["CRS-EFQM-101-L03"], steps=[st("Direction", "التوجه", ("Why, where to, culture", "لماذا وإلى أين والثقافة"), "1"), st("Execution", "التنفيذ", ("Stakeholders, value, change", "أصحاب المصلحة والقيمة والتغيير"), "2"),
                                 st("Results", "النتائج", ("Perceptions, performance", "التصورات والأداء"), "3")], highlight=2, loop=True)
fig("FIG-EX-MODEL", "tree", ("The seven criteria of the EFQM Model 2025 (shortened names)", "المعايير السبعة لنموذج EFQM 2025 (أسماء مختصرة)"),
    ("Two criteria set the direction, three describe execution and two show results. The names are EFQM's, shortened to fit (the full names are in the lesson and the recognition explorer); how each criterion is defined is in EFQM's own publication.",
     "معياران يحددان التوجه، وثلاثة تصف التنفيذ، واثنان يُظهران النتائج. والأسماء من EFQM مختصرةً لتتسع (الأسماء الكاملة في الدرس وفي مستكشف الاعتراف)؛ وتعريف كل معيار في إصدار EFQM نفسه."),
    ["CRS-EFQM-101-L04", "course:CRS-EFQM-101"], root=L("EFQM Model 2025", "نموذج EFQM 2025"),
    children=[{"t": L("Direction", "التوجه"), "children": [L("1 Purpose, Vision & Strategy", "1 الغاية والرؤية والاستراتيجية"), L("2 Culture & Leadership", "2 الثقافة والقيادة")]},
              {"t": L("Execution", "التنفيذ"), "children": [L("3 Engaging Stakeholders", "3 إشراك أصحاب المصلحة"), L("4 Sustainable Value", "4 القيمة المستدامة"), L("5 Performance & Transformation", "5 الأداء والتحول")]},
              {"t": L("Results", "النتائج"), "children": [L("6 Stakeholder Perceptions", "6 تصورات أصحاب المصلحة"), L("7 Strategic & Operational", "7 الاستراتيجي والتشغيلي")]}])

# ---------------------------------------------------------------- CRS-EX-RADAR
fig("FIG-EX-RADAR", "cycle", ("The RADAR loop, starting from the results you need", "حلقة RADAR بدءًا من النتائج التي تحتاجها"),
    ("Start at the top with required results, then move round: approaches are designed to deliver them, deployed where needed, then assessed and refined — which updates the results you aim for.",
     "ابدأ من الأعلى بالنتائج المطلوبة، ثم تقدّم في الدائرة: تُصمم الأساليب لتحقيقها، وتُطبق حيث تلزم، ثم تُقيَّم وتُحسَّن — فتتحدث النتائج التي تستهدفها."),
    ["CRS-EX-RADAR-L01", "course:CRS-EX-RADAR"], center=L("RADAR", "RADAR"),
    steps=[st("Results", "النتائج", ("Required, linked to strategy", "مطلوبة ومرتبطة بالاستراتيجية")), st("Approaches", "الأساليب", ("Planned and developed", "مخططة ومطوَّرة")),
           st("Deployment", "التطبيق", ("Systematic, where needed", "منهجي حيث يلزم")), st("Assess & refine", "التقييم والتحسين", ("Measure, learn, improve", "قِس وتعلّم وحسّن"))], highlight=0)
fig("FIG-EX-APPROACH", "triad", ("Three tests of an approach", "ثلاثة اختبارات للأسلوب"),
    ("A sound approach passes all three: a clear rationale focused on results, a design people can follow, and links to strategy and other approaches.",
     "الأسلوب السليم يجتاز الثلاثة: مبرر واضح يركز على النتائج، وتصميم يستطيع الناس اتباعه، وصلات بالاستراتيجية والأساليب الأخرى."),
    ["CRS-EX-RADAR-L02"], corners=[L("Rationale", "المبرر"), L("Design", "التصميم"), L("Integration", "التكامل")], center=L("Sound approach", "أسلوب سليم"))
fig("FIG-EX-DEPLOY", "matrix", ("A deployment matrix: approaches by unit", "مصفوفة التطبيق: الأساليب حسب الوحدة"),
    ("Each row is an approach and each column a unit. Ask for evidence in every cell, not one showcase; empty cells become interview questions. Example values are illustrative.",
     "كل صف أسلوب وكل عمود وحدة. اطلب دليلًا في كل خلية لا نموذجًا استعراضيًا واحدًا؛ والخلايا الفارغة تصبح أسئلة مقابلة. والقيم توضيحية."),
    ["CRS-EX-RADAR-L03"], rows=3, cols=3,
    cells=[[L("Full", "كامل"), L("Full", "كامل"), L("Partial", "جزئي")], [L("Full", "كامل"), L("Not shown", "لم يُعرض"), L("Partial", "جزئي")], [L("Partial", "جزئي"), L("Partial", "جزئي"), L("Not yet", "لم يبدأ")]],
    highlight=[[1, 1]], yLabel=L("Approaches", "الأساليب"), xLabel=L("Units: head office · region A · region B", "الوحدات: المقر · المنطقة أ · المنطقة ب"))
fig("FIG-EX-RESULTS", "scurve", ("A strong result: trend, target and comparison", "نتيجة قوية: اتجاه ومستهدف ومقارنة"),
    ("Follow the result line across four years and compare it with the target and a peer. Strong results improve, mostly meet targets, compare well and have an explained cause (the marked change). Values are illustrative.",
     "تتبّع خط النتيجة عبر أربع سنوات وقارنه بالمستهدف وبنظير. فالنتائج القوية تتحسن، وتحقق المستهدفات غالبًا، وتُقارن جيدًا، ولها سبب مفسَّر (التغيير المعلَّم). والقيم توضيحية."),
    ["CRS-EX-RADAR-L04"], series=[{"t": L("Result", "النتيجة"), "values": [71, 74, 79, 84]}, {"t": L("Target", "المستهدف"), "values": [72, 75, 78, 82]}, {"t": L("Peer", "النظير"), "values": [73, 74, 75, 77]}],
    now=1, nowLabel=L("New process", "عملية جديدة"), yLabel=L("Satisfaction %", "الرضا %"), xLabel=L("Years 1–4", "السنوات 1–4"))

# ---------------------------------------------------------------- CRS-EX-EVID
fig("FIG-EX-LADDER", "ladder", ("The evidence ladder", "سلّم الأدلة"),
    ("Read from the bottom up. Each rung is stronger evidence than the one below; good assessors climb with follow-up questions instead of stopping at a document.",
     "اقرأ من الأسفل إلى الأعلى. كل درجة دليل أقوى من التي تحتها؛ والمقيّم الجيد يصعد بأسئلة المتابعة بدل التوقف عند وثيقة."),
    ["CRS-EX-EVID-L01", "course:CRS-EX-EVID"],
    levels=[st("Sustained, linked results", "نتائج مستدامة مرتبطة", ("Trend + cause", "اتجاه + سبب")), st("Systematic and measured", "منهجي ومقاس", ("Across the scope", "عبر النطاق")),
            st("Records in some places", "سجلات في بعض المواضع", ("Partial practice", "ممارسة جزئية")), st("Document", "وثيقة", ("It should be done", "ينبغي أن يُفعل")), st("Assertion", "ادعاء", ("“We do this”", "«نحن نفعل هذا»"))], highlight=0)
fig("FIG-EX-MATURITY", "ladder", ("Five maturity stages (CIA scale, not an EFQM score)", "مراحل النضج الخمس (مقياس CIA، وليس درجة EFQM)"),
    ("Read from the bottom up. Place an approach by its weakest essential element; the next rung up is your next improvement step.",
     "اقرأ من الأسفل إلى الأعلى. ضع الأسلوب في المرحلة بحسب أضعف عنصر جوهري فيه؛ والدرجة التالية هي خطوة التحسين التالية."),
    ["CRS-EX-EVID-L02"],
    levels=[st("5 Leading", "5 رائد", ("Others learn from it", "يتعلم منه الآخرون")), st("4 Measured & refined", "4 مقاس ومحسَّن", ("Improved for reasons", "يُحسَّن لأسباب")),
            st("3 Deployed", "3 مطبق", ("Across the scope", "عبر النطاق")), st("2 Defined", "2 معرَّف", ("Designed, owned", "مصمم ومملوك")), st("1 Reactive", "1 تفاعلي", ("When pushed", "حين يُدفع"))], highlight=2)
fig("FIG-EX-STRENGTH", "flow", ("The four parts of a well-written strength", "الأجزاء الأربعة لنقطة قوة مكتوبة جيدًا"),
    ("A strength names what is done, where and since when, how it is reviewed, and the evidence of effect. Missing parts turn it into a compliment.",
     "تسمّي نقطة القوة ما يُفعل، وأين ومنذ متى، وكيف يُراجع، ودليل الأثر. والأجزاء الناقصة تحولها إلى مجاملة."),
    ["CRS-EX-EVID-L03"], steps=[st("Approach", "الأسلوب", ("What is done", "ماذا يُفعل")), st("Deployment", "التطبيق", ("Where, since when", "أين ومنذ متى")),
                                st("Review", "المراجعة", ("How it improves", "كيف يتحسن")), st("Effect", "الأثر", ("Evidence of results", "دليل النتائج"))], highlight=3)
fig("FIG-EX-AFI", "tiles", ("Four qualities of a useful area for improvement", "أربع صفات لمجال تحسين مفيد"),
    ("Check each AFI against the four tiles. If one is missing — for example it prescribes a solution — rewrite it before the report.",
     "افحص كل مجال تحسين مقابل المربعات الأربعة. وإن نقصت صفة — مثل أن يفرض حلًا — فأعد كتابته قبل التقرير."),
    ["CRS-EX-EVID-L04"], items=[{"icon": "target", "t": L("Specific: what gap", "محدد: أي فجوة")}, {"icon": "map", "t": L("Located: where", "مُحدَّد الموضع: أين")},
                                {"icon": "alert", "t": L("Consequential: why it matters", "مبيّن الأثر: لماذا يهم")}, {"icon": "puzzle", "t": L("Open: owners decide how", "مفتوح: المالكون يقررون الحل")}])

# ---------------------------------------------------------------- CRS-EX-SA
fig("FIG-EX-SAMODES", "spectrum", ("Self-assessment approaches from light to rigorous", "أساليب التقييم الذاتي من الخفيف إلى الصارم"),
    ("Moving right adds evidence and rigour but also cost. Most organisations start on the left and move one step right each cycle.",
     "التحرك يمينًا يضيف الأدلة والصرامة لكنه يضيف التكلفة أيضًا. وتبدأ معظم المنظمات من اليسار وتتقدم خطوة في كل دورة."),
    ["CRS-EX-SA-L01", "course:CRS-EX-SA"], **{"from": L("Light, quick", "خفيف وسريع"), "to": L("Rigorous, costly", "صارم ومكلف")},
    marks=[{"t": L("Questionnaire", "استبيان"), "d": L("Perceptions", "تصورات")}, {"t": L("Workshop", "ورشة"), "d": L("Leaders + data", "القادة + البيانات")},
           {"t": L("Pro-forma", "نموذج معد"), "d": L("Page per criterion", "صفحة لكل معيار")}, {"t": L("Simulation", "محاكاة"), "d": L("Document + visit", "وثيقة + زيارة")}])
fig("FIG-EX-SAPLAN", "flow", ("A self-assessment cycle in six steps", "دورة التقييم الذاتي في ست خطوات"),
    ("Read in order. The cycle ends with a leadership decision, not with the report; the decision feeds the improvement plan.",
     "اقرأ بالترتيب. تنتهي الدورة بقرار قيادي لا بالتقرير؛ والقرار يغذي خطة التحسين."),
    ["CRS-EX-SA-L02"], steps=[st("Brief", "الإحاطة", tag="1"), st("Evidence", "الأدلة", tag="2"), st("Review", "المراجعة", tag="3"),
                              st("Consensus", "الإجماع", tag="4"), st("Report", "التقرير", tag="5"), st("Decide", "القرار", tag="6")], highlight=5)
fig("FIG-EX-CONSENSUS", "funnel", ("Consensus: facts first, ratings last", "الإجماع: الوقائع أولًا والتقديرات أخيرًا"),
    ("Read from the top. Individual reviews narrow to agreed facts, then agreed findings, and only then agreed ratings. Skipping a layer turns consensus into negotiation.",
     "اقرأ من الأعلى. تضيق المراجعات الفردية إلى وقائع متفق عليها، ثم ملاحظات متفق عليها، وعندها فقط تقديرات متفق عليها. وتخطي طبقة يحوّل الإجماع إلى مساومة."),
    ["CRS-EX-SA-L03"], stages=[L("Individual reviews", "المراجعات الفردية"), L("Agreed facts (evidence)", "وقائع متفق عليها (الأدلة)"), L("Agreed findings", "ملاحظات متفق عليها"), L("Agreed ratings", "تقديرات متفق عليها")])
fig("FIG-EX-REPORT", "tiles", ("What a short self-assessment report contains", "محتوى تقرير التقييم الذاتي القصير"),
    ("Five parts, ending with recommended priorities. Self-ratings are labelled as internal and indicative — not an official score.",
     "خمسة أجزاء، تنتهي بالأولويات الموصى بها. وتُوسم التقديرات الذاتية بأنها داخلية واسترشادية — وليست درجة رسمية."),
    ["CRS-EX-SA-L04"], items=[{"icon": "chart", "t": L("Profile", "الملف")}, {"icon": "star", "t": L("Strengths", "نقاط القوة")}, {"icon": "layers", "t": L("AFI themes", "محاور التحسين")},
                              {"icon": "gauge", "t": L("Self-ratings (internal)", "تقديرات ذاتية (داخلية)")}, {"icon": "flag", "t": L("Priorities", "الأولويات")}], highlight=4)

# ---------------------------------------------------------------- CRS-EX-PLAN
fig("FIG-EX-CLUSTER", "funnel", ("From many findings to a few priorities", "من ملاحظات كثيرة إلى أولويات قليلة"),
    ("Read from the top: dozens of areas for improvement cluster into a handful of themes with causes, and only a few become funded priorities. Numbers are from the lesson example.",
     "اقرأ من الأعلى: عشرات من مجالات التحسين تتجمع في محاور قليلة بأسبابها، ولا يصبح إلا القليل منها أولويات ممولة. والأرقام من مثال الدرس."),
    ["CRS-EX-PLAN-L01", "course:CRS-EX-PLAN"], stages=[L("52 areas for improvement", "52 مجالًا للتحسين"), L("7 themes with causes", "7 محاور بأسبابها"), L("3 priorities, owned and funded", "3 أولويات مملوكة وممولة")])
fig("FIG-EX-PRIORITY", "matrix", ("The impact–ease prioritisation matrix", "مصفوفة ترتيب الأولويات حسب الأثر والسهولة"),
    ("Place each theme by impact (up) and ease (across). Top right: quick wins; top left: major projects to plan and resource; bottom right: fill-ins; bottom left: reconsider.",
     "ضع كل محور بحسب الأثر (إلى الأعلى) والسهولة (أفقيًا، من الأصعب يمينًا إلى الأسهل يسارًا). أعلى اليسار: مكاسب سريعة؛ وأعلى اليمين: مشاريع كبيرة تُخطط ويُوفَّر لها الموارد؛ وأسفل اليسار: مهام مكمّلة؛ وأسفل اليمين: أعد النظر."),
    ["CRS-EX-PLAN-L02"], rows=2, cols=2, cells=[[L("Major projects", "مشاريع كبيرة"), L("Quick wins", "مكاسب سريعة")], [L("Reconsider", "أعد النظر"), L("Fill-ins", "مهام مكمّلة")]],
    highlight=[[0, 1]], yLabel=L("Impact", "الأثر"), xLabel=L("Ease (harder → easier)", "السهولة (أصعب ← أسهل)"))
fig("FIG-EX-CHARTER", "hub", ("A one-page improvement charter", "ميثاق تحسين من صفحة واحدة"),
    ("Every priority needs all six parts. Without a baseline and target nobody can show it worked; without a named owner it drifts.",
     "كل أولوية تحتاج الأجزاء الستة. فدون خط أساس ومستهدف لا يستطيع أحد إثبات نجاحها؛ ودون مالك مسمّى تنجرف."),
    ["CRS-EX-PLAN-L03"], center=L("Charter", "الميثاق"),
    spokes=[L("Problem & evidence", "المشكلة والدليل"), L("Objective", "الهدف"), L("Baseline → target", "خط الأساس ← المستهدف"), L("Owner & sponsor", "المالك والراعي"), L("Scope & method", "النطاق والمنهجية"), L("Milestones & risks", "المعالم والمخاطر")])
fig("FIG-EX-ROADMAP", "flow", ("A 12-month improvement roadmap", "خارطة طريق تحسين لاثني عشر شهرًا"),
    ("Quick wins land in the first quarter, major projects run across several quarters, and the re-assessment at the end feeds the next cycle (dashed arrow).",
     "تقع المكاسب السريعة في الربع الأول، وتمتد المشاريع الكبيرة عبر أرباع عدة، وإعادة التقييم في النهاية تغذي الدورة التالية (السهم المتقطع)."),
    ["CRS-EX-PLAN-L04"], steps=[st("Quick wins", "مكاسب سريعة", ("First 90 days", "أول 90 يومًا"), "Q1"), st("Major project 1", "مشروع كبير 1", ("Phased milestones", "معالم مرحلية"), "Q1–Q3"),
                                st("Major project 2", "مشروع كبير 2", ("Phased milestones", "معالم مرحلية"), "Q2–Q4"), st("Re-assess", "إعادة التقييم", ("Same method", "المنهجية نفسها"), "Q4")], highlight=3, loop=True)

# ---------------------------------------------------------------- CRS-EX-AWARD
fig("FIG-EX-PATHWAYS", "table", ("EFQM's two assessment pathways (efqm.org, checked 6 Nov 2026)", "مسارا التقييم لدى EFQM (efqm.org، بالاطلاع في 6 نوفمبر 2026)"),
    ("Compare the rows. Rapid is a short first external view; Advanced is the full model with a submission document and a score out of 1,000. Check EFQM's current pages before planning.",
     "قارن الصفوف. التقييم السريع نظرة خارجية أولى قصيرة؛ والمتقدم هو النموذج كاملًا بوثيقة مشاركة ودرجة من 1000. وتحقق من صفحات EFQM الحالية قبل التخطيط."),
    ["CRS-EX-AWARD-L01", "course:CRS-EX-AWARD"], cols=[L("Rapid", "السريع"), L("Advanced", "المتقدم")],
    rows=[{"t": L("Model", "النموذج"), "cells": [L("Condensed", "مختصر"), L("Full", "كامل")]},
          {"t": L("Duration", "المدة"), "cells": [L("~1 week", "~أسبوع"), L("4–6 months", "4–6 أشهر")]},
          {"t": L("Preparation", "الإعداد"), "cells": [L("Minimal", "قليل"), L("Document", "وثيقة")]},
          {"t": L("Outcome", "المُخرَج"), "cells": [L("1–2 stars", "1–2 نجمة"), L("3+ stars", "3+ نجوم")]}])
fig("FIG-EX-READY", "tiles", ("Five readiness questions before applying", "خمسة أسئلة للجاهزية قبل التقدم"),
    ("Answer each tile with evidence. Several “no” answers suggest a lighter recognition step or another self-assessment cycle first.",
     "أجب عن كل مربع بالأدلة. وتعدد الإجابات بـ«لا» يوحي بخطوة اعتراف أخف أو دورة تقييم ذاتي أخرى أولًا."),
    ["CRS-EX-AWARD-L02"], items=[{"icon": "check", "t": L("Self-assessed and acted", "قيّمنا وتصرفنا")}, {"icon": "trend", "t": L("3+ years of trends", "اتجاهات 3 سنوات+")},
                                 {"icon": "layers", "t": L("Deployed across scope", "مطبق عبر النطاق")}, {"icon": "users", "t": L("Leaders sponsor", "القادة يرعون")}, {"icon": "clock", "t": L("Capacity to prepare", "طاقة للإعداد")}])
fig("FIG-EX-DOC", "flow", ("How each area of a submission document reads", "كيف يُقرأ كل مجال في وثيقة المشاركة"),
    ("Each area tells the same story: what is done and why, where it is used, how it is measured and improved, and the results it produces — all verifiable on site.",
     "كل مجال يروي القصة نفسها: ماذا يُفعل ولماذا، وأين يُستخدم، وكيف يُقاس ويُحسَّن، والنتائج التي يُنتجها — وكلها قابلة للتحقق في الموقع."),
    ["CRS-EX-AWARD-L03"], steps=[st("Approach", "الأسلوب", ("What and why", "ماذا ولماذا")), st("Deployment", "التطبيق", ("Where, since when", "أين ومنذ متى")),
                                 st("Refinement", "التحسين", ("Dated changes", "تغييرات مؤرخة")), st("Results", "النتائج", ("Trends, targets", "اتجاهات ومستهدفات"))], highlight=3)
fig("FIG-EX-VISIT", "cycle", ("Site visit and feedback as a learning cycle", "الزيارة الميدانية والتغذية الراجعة دورة تعلم"),
    ("Follow the cycle: honest briefing, the visit, the feedback report and the improvement plan, which leads to the next self-assessment. The award result sits outside the loop.",
     "تتبّع الدورة: إحاطة صادقة، ثم الزيارة، ثم تقرير التغذية الراجعة، ثم خطة التحسين التي تقود إلى التقييم الذاتي التالي. ونتيجة الجائزة خارج الحلقة."),
    ["CRS-EX-AWARD-L04"], center=L("Learning", "التعلم"),
    steps=[st("Brief people", "أحِط الناس", ("No scripts", "دون تلقين")), st("Site visit", "الزيارة", ("Verify, explore", "تحقق واستكشاف")), st("Feedback report", "تقرير التغذية", ("Strengths, AFIs", "قوة ومجالات تحسين")),
           st("Improvement plan", "خطة التحسين", ("Owned priorities", "أولويات مملوكة"))], highlight=2)

# ---------------------------------------------------------------- CRS-EX-SUSTAIN
fig("FIG-EX-ANNUAL", "cycle", ("Excellence inside the annual management cycle", "التميز داخل الدورة الإدارية السنوية"),
    ("Each step feeds the next: strategy sets objectives, self-assessment shows gaps against them, priorities enter the budget, delivery is reviewed in normal meetings, and results feed the next strategy review.",
     "كل خطوة تغذي التالية: الاستراتيجية تحدد الأهداف، والتقييم الذاتي يُظهر الفجوات مقابلها، والأولويات تدخل الميزانية، والتنفيذ يُراجع في الاجتماعات المعتادة، والنتائج تغذي مراجعة الاستراتيجية التالية."),
    ["CRS-EX-SUSTAIN-L01", "course:CRS-EX-SUSTAIN"], center=L("One cycle", "دورة واحدة"),
    steps=[st("Strategy review", "مراجعة الاستراتيجية", ("Objectives", "الأهداف")), st("Self-assessment", "التقييم الذاتي", ("Gaps", "الفجوات")),
           st("Prioritise & budget", "الترتيب والميزانية", ("Funded", "ممولة")), st("Deliver & review", "التنفيذ والمراجعة", ("Monthly, quarterly", "شهريًا وربع سنويًا"))], highlight=1)
fig("FIG-EX-BENCH", "flow", ("Benchmarking that changes something", "مقارنة مرجعية تغيّر شيئًا"),
    ("Read in order. Knowing your own process and data comes first; the visit is only useful with prepared questions, and the value comes from adapting and measuring.",
     "اقرأ بالترتيب. معرفة عمليتك وبياناتك تأتي أولًا؛ والزيارة لا تفيد إلا بأسئلة معدة، والقيمة تأتي من التكييف والقياس."),
    ["CRS-EX-SUSTAIN-L02"], steps=[st("Know yourself", "اعرف نفسك", tag="1"), st("Choose partner", "اختر الشريك", tag="2"), st("Visit with questions", "زُر بأسئلة", tag="3"),
                                   st("Adapt", "كيّف", tag="4"), st("Measure", "قِس", tag="5")], highlight=4)
fig("FIG-EX-CULTURE", "triad", ("Culture follows leaders' attention", "الثقافة تتبع اهتمام القادة"),
    ("What leaders pay attention to shapes behaviours; a few indicators make the culture visible so leaders can discuss and act on it.",
     "ما يهتم به القادة يشكّل السلوكيات؛ ومؤشرات قليلة تجعل الثقافة ظاهرة ليناقشها القادة ويتصرفوا بشأنها."),
    ["CRS-EX-SUSTAIN-L03"], corners=[L("Leaders' attention", "اهتمام القادة"), L("Behaviours", "السلوكيات"), L("Indicators", "المؤشرات")], center=L("Culture", "الثقافة"))
fig("FIG-EX-CHASE", "scurve", ("Warning sign: ratings rise while results stay flat", "علامة إنذار: التقديرات ترتفع والنتائج ثابتة"),
    ("Compare the two lines over four cycles. When internal ratings climb but the key result does not move, check method, team and writing before celebrating. Values are illustrative.",
     "قارن الخطين عبر أربع دورات. حين ترتفع التقديرات الداخلية ولا تتحرك النتيجة الرئيسية، تحقق من المنهجية والفريق والكتابة قبل الاحتفال. والقيم توضيحية."),
    ["CRS-EX-SUSTAIN-L04"], series=[{"t": L("Internal rating", "التقدير الداخلي"), "values": [38, 44, 53, 62]}, {"t": L("Key result", "النتيجة الرئيسية"), "values": [50, 51, 50, 51]}],
    now=2, nowLabel=L("New team", "فريق جديد"), yLabel=L("Index", "المؤشر"), xLabel=L("Assessment cycles 1–4", "دورات التقييم 1–4"))

# ---------------------------------------------------------------- EFQM Assessment Lab (shown on the Lab page)
fig("FIG-EX-LABFLOW", "flow", ("How the EFQM Assessment Lab works", "كيف يعمل مختبر تقييم EFQM"),
    ("Work left to right for each criterion: record evidence, write strengths and areas for improvement, self-rate with the guidance, then build and export the plan. It is a self-assessment aid, not an EFQM assessment.",
     "اعمل من البداية إلى النهاية لكل معيار: سجّل الأدلة، واكتب نقاط القوة ومجالات التحسين، وقدّر ذاتيًا بالإرشادات، ثم ابنِ الخطة وصدّرها. وهو أداة مساعدة للتقييم الذاتي، وليس تقييمًا من EFQM."),
    ["lab:efqm"], steps=[st("Evidence", "الأدلة", tag="1"), st("Findings", "الملاحظات", tag="2"), st("Self-rating", "التقدير الذاتي", tag="3"), st("Plan", "الخطة", tag="4"), st("Export", "التصدير", tag="5")], highlight=2)
