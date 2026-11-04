"""Phase 9 explanatory figures (D-32): original CIA diagrams for the lessons of every hand-authored course and every method guide.

A figure is data — a template (src/ui/figures.js), bilingual labels and numbers, a caption and a "how to read it" text — so
diagrams are reviewed like any other content (needs_review until approved) and never contain copied artwork. Numbers in
example charts are illustrative and say so. PLACEMENT maps a lesson id, "course:<id>" or "guide:<slug>" to figure ids.
Author: مدثر سلامه."""
T = lambda en, ar: {"en": en, "ar": ar}  # noqa: E731
FIGS = []
PLACEMENT = {}
ILL = (" Values are illustrative.", " القيم توضيحية.")


def L(en, ar):
    return T(en, ar)


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


# ================================================================== QUALITY (Phase 9 courses and method guides)
fig("FIG-Q-QAQC", "table", ("Quality assurance and quality control side by side", "ضمان الجودة وضبط الجودة جنبًا إلى جنب"),
    ("Read each row across: QA works on the system before output exists; QC checks the output itself. Both are needed; QA reduces what QC must find.",
     "اقرأ كل صف أفقيًا: يعمل الضمان على النظام قبل وجود المُخرَج؛ ويفحص الضبط المُخرَج نفسه. وكلاهما مطلوب؛ والضمان يقلل ما يجب أن يكتشفه الضبط."),
    ["CRS-QMS-201-L01"], cols=[L("Assurance (QA)", "الضمان"), L("Control (QC)", "الضبط")],
    rows=[{"t": L("Purpose", "الغرض"), "cells": [L("Prevent", "يمنع"), L("Detect", "يكتشف")]},
          {"t": L("Acts on", "يعمل على"), "cells": [L("System", "النظام"), L("Output", "المُخرَج")]},
          {"t": L("When", "متى"), "cells": [L("Before", "قبل"), L("After", "بعد")]},
          {"t": L("Examples", "أمثلة"), "cells": [L("Audit, training", "تدقيق، تدريب"), L("Inspect, test", "فحص، اختبار")]}])
fig("FIG-Q-SIPOC", "flow", ("SIPOC: a process on one line", "نموذج SIPOC: العملية في سطر واحد"),
    ("Start at the customer on the far side and work back: the output they need, the steps that make it, the inputs and who supplies them. Each arrow is an interface where requirements are agreed.",
     "ابدأ بالعميل في الطرف الآخر واعمل إلى الخلف: المُخرَج الذي يحتاجه، والخطوات التي تصنعه، والمدخلات ومن يوردها. وكل سهم واجهة يُتفق فيها على المتطلبات."),
    ["CRS-QMS-201-L02", "CRS-LSS-GB-L02"], steps=[st("Suppliers", "الموردون", tag="S"), st("Inputs", "المدخلات", tag="I"), st("Process", "العملية", tag="P"), st("Outputs", "المخرجات", tag="O"), st("Customers", "العملاء", tag="C")], highlight=4)
fig("FIG-Q-KANO", "table", ("The Kano view of customer needs", "منظور كانو لاحتياجات العملاء"),
    ("Compare how customers react when each kind of need is missing and when it is met. Fix basic needs first; then compete on performance; delighters create loyalty but become basic over time.",
     "قارن رد فعل العملاء عند غياب كل نوع من الاحتياجات وعند الوفاء به. أصلح الاحتياجات الأساسية أولًا؛ ثم نافس في الأداء؛ والمبهِجات تصنع الولاء لكنها تصبح أساسية مع الوقت."),
    ["CRS-QMS-201-L03", "CRS-CMQOE-PREP-L03"], cols=[L("If missing", "عند الغياب"), L("If met", "عند الوفاء")],
    rows=[{"t": L("Basic", "أساسي"), "cells": [L("Angry", "استياء شديد"), L("Neutral", "حياد")]},
          {"t": L("Performance", "أداء"), "cells": [L("Unhappy", "عدم رضا"), L("Happier", "رضا أكبر")]},
          {"t": L("Delighter", "مُبهِج"), "cells": [L("Neutral", "حياد"), L("Delight", "بهجة")]}])
fig("FIG-Q-OBJ", "ladder", ("From policy to action: the objective chain", "من السياسة إلى الإجراء: سلسلة الأهداف"),
    ("Read from the bottom up: each level answers “how?” for the level above it and “why?” for the level below. An objective without a measure, target and owner breaks the chain.",
     "اقرأ من الأسفل إلى الأعلى: كل مستوى يجيب عن «كيف؟» للمستوى الذي فوقه وعن «لماذا؟» للمستوى الذي تحته. والهدف بلا مقياس ومستهدف ومالك يكسر السلسلة."),
    ["CRS-QMS-201-L04", "CRS-ISO-9001-IMP-L04"],
    levels=[st("Action plan", "خطة الإجراءات", ("Owner, dates, resources", "المالك والمواعيد والموارد")), st("Target and date", "المستهدف والموعد", ("From a baseline", "من خط أساس")),
            st("Measure (KPI)", "المقياس (مؤشر أداء)", ("Defined and owned", "معرّف ومملوك")), st("Quality objective", "هدف الجودة", ("Result to achieve", "نتيجة مطلوبة")), st("Quality policy", "سياسة الجودة", ("Direction", "الاتجاه"))], highlight=3)
fig("FIG-Q-7TOOLS", "tiles", ("The seven basic quality tools and the question each answers", "أدوات الجودة الأساسية السبع والسؤال الذي تجيب عنه كلٌّ منها"),
    ("Pick the tile whose question matches yours. Each tool answers one question well; most investigations use two or three in sequence.",
     "اختر المربع الذي يطابق سؤاله سؤالك. تجيب كل أداة عن سؤال واحد جيدًا؛ ومعظم التحقيقات تستخدم اثنتين أو ثلاثًا بالتتابع."),
    ["CRS-Q-TOOLS-L01", "CRS-QMS-201-L03", "guide:iso-10009"],
    items=[{"icon": "clipboard", "t": L("Check sheet: how often?", "ورقة التحقق: كم مرة؟")}, {"icon": "chart", "t": L("Pareto: which few?", "باريتو: أي القلة؟")},
           {"icon": "fish", "t": L("Fishbone: what causes?", "عظم السمكة: ما الأسباب؟")}, {"icon": "pie", "t": L("Histogram: what spread?", "المدرج: أي انتشار؟")},
           {"icon": "trend", "t": L("Scatter: related?", "الانتشار: هل مرتبطان؟")}, {"icon": "control", "t": L("Control chart: stable?", "خريطة الضبط: مستقرة؟")},
           {"icon": "route", "t": L("Flowchart: where?", "مخطط التدفق: أين؟")}, {"icon": "layers", "t": L("Stratify: which group?", "التقسيم: أي مجموعة؟")}])
fig("FIG-Q-PARETO", "pareto", ("Pareto chart of cable defects over four weeks", "مخطط باريتو لعيوب الكابلات خلال أربعة أسابيع"),
    ("Bars are sorted from largest to smallest; the gold line is the cumulative share. Dark bars are the vital few — together they reach about 80% of all defects.",
     "الأعمدة مرتبة من الأكبر إلى الأصغر؛ والخط الذهبي هو الحصة التراكمية. والأعمدة الداكنة هي القلة الحيوية — تصل معًا إلى نحو 80% من كل العيوب."),
    ["CRS-Q-TOOLS-L02", "guide:pareto", "CRS-Q-COQ-L04"],
    bars=[{"t": L("Scratches", "خدوش"), "v": 168}, {"t": L("Length", "الطول"), "v": 94}, {"t": L("Print", "الطباعة"), "v": 71}, {"t": L("Cut end", "طرف القطع"), "v": 48}, {"t": L("Other", "أخرى"), "v": 31}],
    yLabel=L("Count", "العدد"), xLabel=L("Defect type (lesson example, 412 defects)", "نوع العيب (مثال الدرس، 412 عيبًا)"))
fig("FIG-Q-HIST", "histogram", ("Histogram with specification limits — two peaks", "مدرج تكراري بحدود المواصفة — قمتان"),
    ("Red dashed lines are the specification limits; the gold line is the target. Two peaks usually mean two sources mixed together (machines, heads, shifts): stratify before you act." + ILL[0],
     "الخطان الأحمران المتقطعان حدّا المواصفة؛ والخط الذهبي هو المستهدف. والقمتان تعنيان عادةً مصدرين مختلطين (آلات أو رؤوس أو ورديات): قسّم طبقيًا قبل التصرف." + ILL[1]),
    ["CRS-Q-TOOLS-L03"], bins=[2, 5, 11, 17, 12, 6, 7, 14, 18, 10, 4, 1], lsl=0.06, usl=0.94, target=0.5,
    labels={"lsl": L("LSL", "الحد الأدنى"), "usl": L("USL", "الحد الأعلى"), "target": L("Target", "المستهدف")}, xLabel=L("Fill weight", "وزن التعبئة"), yLabel=L("Count", "العدد"))
fig("FIG-Q-SCATTER", "scatter", ("Scatter diagram: a relationship, not proof of cause", "مخطط الانتشار: علاقة لا دليل على السببية"),
    ("Each dot is one pair of values. The dashed line shows the trend. A pattern suggests a relationship — check for a third factor and confirm with a test before changing the process." + ILL[0],
     "كل نقطة زوج من القيم. ويُظهر الخط المتقطع الاتجاه. والنمط يوحي بعلاقة — تحقق من وجود عامل ثالث وأكّد باختبار قبل تغيير العملية." + ILL[1]),
    ["CRS-Q-TOOLS-L03"], points=[[0.08, 0.2], [0.14, 0.28], [0.2, 0.24], [0.27, 0.38], [0.33, 0.35], [0.4, 0.47], [0.46, 0.44], [0.52, 0.58], [0.58, 0.52], [0.63, 0.66],
                                  [0.7, 0.62], [0.76, 0.74], [0.82, 0.72], [0.88, 0.83], [0.93, 0.86]], trend=[0.2, 0.86],
    xLabel=L("Coating thickness", "سماكة الطبقة"), yLabel=L("Service life", "عمر الخدمة"))
fig("FIG-Q-STRATA", "bars", ("Stratification: the average hid one region", "التقسيم الطبقي: المتوسط أخفى منطقة واحدة"),
    ("The national rate looked flat at 1.8%. Split by region, East stands out at 3.4% while the others improved. Always look inside the average." + ILL[0],
     "بدا المعدل الوطني ثابتًا عند 1.8%. وبالتقسيم حسب المنطقة تبرز الشرقية عند 3.4% بينما تحسنت المناطق الأخرى. انظر دائمًا داخل المتوسط." + ILL[1]),
    ["CRS-Q-TOOLS-L04"], bars=[{"t": L("Central", "الوسطى"), "v": 1.4, "vLabel": L("1.4%", "1.4%")}, {"t": L("West", "الغربية"), "v": 1.3, "vLabel": L("1.3%", "1.3%")},
                              {"t": L("East", "الشرقية"), "v": 3.4, "vLabel": L("3.4%", "3.4%")}, {"t": L("North", "الشمالية"), "v": 1.2, "vLabel": L("1.2%", "1.2%")}, {"t": L("South", "الجنوبية"), "v": 1.5, "vLabel": L("1.5%", "1.5%")}],
    highlight=2, yLabel=L("Complaints", "الشكاوى"), xLabel=L("Complaint rate by region", "معدل الشكاوى حسب المنطقة"))
fig("FIG-Q-ISNOT", "table", ("Is / is-not: let the contrast point to the cause", "هو / ليس هو: دع التباين يشير إلى السبب"),
    ("For each question, compare where the problem is with where it could be but is not. Whatever differs between the two columns is a lead for the cause.",
     "لكل سؤال قارن موضع وجود المشكلة بموضع يمكن أن تكون فيه لكنها ليست فيه. وأي اختلاف بين العمودين خيط يقود إلى السبب."),
    ["CRS-Q-CAPA-L01"], cols=[L("Is", "هو"), L("Is not", "ليس هو")],
    rows=[{"t": L("What", "ماذا"), "cells": [L("Weld leak", "تسرب اللحام"), L("Body leak", "تسرب الجسم")]},
          {"t": L("Where", "أين"), "cells": [L("Line 2", "الخط 2"), L("Line 1", "الخط 1")]},
          {"t": L("When", "متى"), "cells": [L("Since 14 Sep", "منذ 14 سبتمبر"), L("Before", "قبل ذلك")]},
          {"t": L("How many", "كم"), "cells": [L("3.1%", "3.1%"), L("0.2%", "0.2%")]}])
fig("FIG-Q-FISH", "fishbone", ("Fishbone (cause-and-effect) diagram", "مخطط عظم السمكة (السبب والأثر)"),
    ("The effect sits at the head. Each bone is a category of possible causes, with examples on the small lines. It lists hypotheses to test — not answers.",
     "الأثر في الرأس. وكل عظمة فئة من الأسباب المحتملة، مع أمثلة على الخطوط الصغيرة. وهو يسرد فرضيات للاختبار — لا إجابات."),
    ["CRS-Q-CAPA-L02", "guide:fishbone", "CRS-ISO-NC-L03"], effect=L("Weld leaks on line 2", "تسرب اللحام في الخط 2"),
    bones=[{"t": L("People", "الأفراد"), "causes": [L("New welder", "لحّام جديد"), L("Training", "التدريب")]}, {"t": L("Method", "الأسلوب"), "causes": [L("Torch angle", "زاوية الشعلة"), L("Sequence", "التسلسل")]},
           {"t": L("Machine", "الآلة"), "causes": [L("New fixture", "مثبّت جديد"), L("Wire feed", "تغذية السلك")]}, {"t": L("Material", "المادة"), "causes": [L("Body lot", "دفعة الأجسام"), L("Filler", "مادة الحشو")]},
           {"t": L("Measurement", "القياس"), "causes": [L("Test gauge", "مقياس الاختبار"), L("Pressure", "الضغط")]}, {"t": L("Environment", "البيئة"), "causes": [L("Humidity", "الرطوبة"), L("Draught", "تيار الهواء")]}])
fig("FIG-Q-5WHY", "flow", ("5 Whys: from symptom to a system cause", "الأسئلة الخمسة: من العَرَض إلى سبب نظامي"),
    ("Read top to bottom: each answer becomes the next question. Stop at a cause the organisation can change (here, a missing check on fixture design) — then verify it.",
     "اقرأ من الأعلى إلى الأسفل: كل إجابة تصبح السؤال التالي. وتوقف عند سبب تستطيع المنظمة تغييره (هنا فحص غائب لتصميم المثبّت) — ثم تحقق منه."),
    ["CRS-Q-CAPA-L02", "guide:five-whys"], dir="v", indent=True, highlight=4,
    steps=[st("Welds leak at the threshold", "اللحام يتسرب عند العتبة", tag=("1", "1")), st("Fusion is incomplete there", "الاندماج غير كامل هناك", tag=("2", "2")), st("Torch angle is wrong at that point", "زاوية الشعلة خاطئة عند تلك النقطة", tag=("3", "3")),
           st("New fixture holds the body rotated 8°", "المثبّت الجديد يُمسك الجسم مدورًا 8°", tag=("4", "4")), st("Fixture designs skip the drawing-revision check", "تصاميم المثبّتات لا تمر بفحص مراجعة الرسومات", tag=("5", "5"))])
fig("FIG-Q-CAPA", "flow", ("From detection to proof: the CAPA sequence", "من الاكتشاف إلى الإثبات: تسلسل الإجراء التصحيحي"),
    ("Containment and correction deal with the output; corrective and preventive action deal with the cause. The loop closes only when the effectiveness check passes.",
     "يتعامل الاحتواء والتصحيح مع المُخرَج؛ ويتعامل الإجراء التصحيحي والوقائي مع السبب. ولا تُغلق الحلقة إلا عند اجتياز فحص الفاعلية."),
    ["CRS-Q-CAPA-L03", "guide:capa", "CRS-ISO-NC-L01", "CRS-ISO-NC-L02", "CRS-QMS-201-L04"], highlight=3, loop=True,
    steps=[st("Contain", "الاحتواء", ("Protect the customer", "احمِ العميل")), st("Correct", "التصحيح", ("Fix the output", "أصلح المُخرَج")), st("Root cause", "السبب الجذري", ("Verify it", "تحقق منه")),
           st("Corrective action", "الإجراء التصحيحي", ("Remove the cause", "أزل السبب")), st("Prevent", "الوقاية", ("Same cause elsewhere", "السبب نفسه في مواضع أخرى")), st("Check effect", "فحص الأثر", ("Criterion met?", "تحقق المعيار؟"))])
fig("FIG-Q-EFFECT", "scurve", ("Effectiveness: did the defect rate stay down?", "الفاعلية: هل بقي معدل العيوب منخفضًا؟"),
    ("The vertical line marks when the action was taken. A CAPA closes when the rate stays below the agreed criterion over the agreed period — not on the day the action is done." + ILL[0],
     "يُحدد الخط العمودي وقت تنفيذ الإجراء. ويُغلق الإجراء التصحيحي عندما يبقى المعدل دون المعيار المتفق عليه خلال الفترة المتفق عليها — لا يوم تنفيذ الإجراء." + ILL[1]),
    ["CRS-Q-CAPA-L04", "CRS-ISO-NC-L04"], series=[{"t": L("Defect rate", "معدل العيوب"), "values": [3.1, 3.3, 2.9, 3.2, 3.0, 1.0, 0.6, 0.4, 0.3, 0.3, 0.2, 0.2]},
                               {"t": L("Criterion", "المعيار"), "values": [0.5] * 12}], now=5, nowLabel=L("Action", "الإجراء"), yLabel=L("%", "%"), xLabel=L("Weeks", "الأسابيع"))
fig("FIG-Q-VARIATION", "table", ("Common and special causes need different responses", "الأسباب العامة والخاصة تحتاج إلى استجابات مختلفة"),
    ("Decide first which kind of variation you see; the response follows. Treating common causes as special (adjusting after every point) makes variation worse.",
     "حدد أولًا نوع التباين الذي تراه؛ ثم تتبع الاستجابة. ومعاملة الأسباب العامة كأنها خاصة (التعديل بعد كل نقطة) تزيد التباين."),
    ["CRS-Q-SPC-L01"], cols=[L("Pattern", "النمط"), L("Who acts", "من يتصرف"), L("Action", "الإجراء")],
    rows=[{"t": L("Common cause", "سبب عام"), "cells": [L("Within limits", "داخل الحدود"), L("Management", "الإدارة"), L("Change system", "غيّر النظام")]},
          {"t": L("Special cause", "سبب خاص"), "cells": [L("Signal", "إشارة"), L("Process team", "فريق العملية"), L("Find, remove", "اكتشف وأزل")]}])
fig("FIG-Q-CTRL", "control", ("Control chart with a signal", "خريطة ضبط بإشارة"),
    ("Points are plotted in time order. UCL and LCL come from the process's own data — not from the specification. The red point is beyond a limit: something changed; find it now." + ILL[0],
     "تُرسم النقاط بترتيبها الزمني. ويأتي الحدان الأعلى والأدنى من بيانات العملية نفسها — لا من المواصفة. والنقطة الحمراء خارج حد: تغيّر شيء؛ فابحث عنه الآن." + ILL[1]),
    ["CRS-Q-SPC-L02", "CRS-Q-SPC-L03"], points=[10.1, 9.8, 10.3, 10.0, 9.7, 10.2, 10.4, 9.9, 10.1, 10.0, 9.6, 10.2, 11.6, 10.1, 9.9, 10.3, 10.0, 9.8],
    ucl=11.2, cl=10.0, lcl=8.8, min=8.4, max=12.0, flags=[12], yLabel=L("Value", "القيمة"), xLabel=L("Subgroup (time order)", "المجموعة الفرعية (الترتيب الزمني)"))
fig("FIG-Q-CHARTPICK", "tree", ("Choosing a control chart", "اختيار خريطة الضبط"),
    ("Start at the top with your data type, then follow the branch that describes how you collect it. The chart at the end of the branch fits your data.",
     "ابدأ من الأعلى بنوع بياناتك، ثم اتبع الفرع الذي يصف طريقة جمعها. والخريطة في نهاية الفرع تناسب بياناتك."),
    ["CRS-Q-SPC-L02"], root=L("What kind of data?", "أي نوع من البيانات؟"),
    children=[{"t": L("Measured, subgroups", "مقاسة، مجموعات"), "children": [L("X̄-R chart", "خريطة X̄-R")]}, {"t": L("Measured, single values", "مقاسة، قيم فردية"), "children": [L("I-MR chart", "خريطة I-MR")]},
              {"t": L("Defectives (%)", "المعيب (%)"), "children": [L("p chart (any n)", "خريطة p (أي حجم)"), L("np chart (fixed n)", "خريطة np (حجم ثابت)")]},
              {"t": L("Defects (count)", "العيوب (عدد)"), "children": [L("c chart (fixed area)", "خريطة c (مساحة ثابتة)"), L("u chart (varying)", "خريطة u (متغيرة)")]}])
fig("FIG-Q-CAP", "histogram", ("Process capability: spread and centring against the tolerance", "قدرة العملية: الانتشار والتمركز مقابل حد السماح"),
    ("The curve is the stable process; red lines are the specification. Cp compares the tolerance width with the spread; Cpk also looks at how close the mean sits to the nearer limit. Here the spread fits but the process sits off centre, so Cpk is lower than Cp." + ILL[0],
     "المنحنى هو العملية المستقرة؛ والخطان الأحمران المواصفة. يقارن Cp عرض حد السماح بالانتشار؛ وينظر Cpk كذلك إلى قرب المتوسط من الحد الأقرب. وهنا يناسب الانتشار لكن العملية بعيدة عن المركز، فيكون Cpk أقل من Cp." + ILL[1]),
    ["CRS-Q-SPC-L04"], bins=[0, 0, 1, 3, 7, 13, 18, 16, 10, 5, 2, 0], lsl=0.12, usl=0.82, target=0.47, curve={"mean": 0.57, "sd": 0.1},
    labels={"lsl": L("LSL", "الحد الأدنى"), "usl": L("USL", "الحد الأعلى"), "target": L("Nominal", "الاسمي")}, xLabel=L("Diameter", "القطر"), yLabel=L("Count", "العدد"))
fig("FIG-Q-AUDTYPES", "matrix", ("Kinds of audit: who audits and what is audited", "أنواع التدقيق: من يدقق وما الذي يُدقق"),
    ("Rows are who audits; columns are what is audited. Choose the cell that fits the purpose and the risk — a recurring product defect needs product and process audits, not only system audits.",
     "الصفوف من يدقق؛ والأعمدة ما الذي يُدقق. واختر الخلية التي تناسب الغرض والمخاطر — فالعيب المتكرر في منتج يحتاج إلى تدقيق منتج وعملية، لا تدقيق نظام فقط."),
    ["CRS-Q-AUDIT-L01"], rows=3, cols=3, cells=[[L("Internal product check", "فحص منتج داخلي"), L("Internal process audit", "تدقيق عملية داخلي"), L("Internal system audit", "تدقيق نظام داخلي")],
                                                [L("Customer checks product", "العميل يفحص المنتج"), L("Supplier process audit", "تدقيق عملية لدى المورد"), L("Supplier system audit", "تدقيق نظام لدى المورد")],
                                                [L("Independent product test", "اختبار منتج مستقل"), L("Independent process audit", "تدقيق عملية مستقل"), L("Certification audit", "تدقيق لغرض المنح")]],
    highlight=[[0, 1], [1, 1]], yLabel=L("1st · 2nd · 3rd party", "طرف أول · ثانٍ · ثالث"), xLabel=L("Product · Process · System", "منتج · عملية · نظام"))
fig("FIG-Q-TURTLE", "hub", ("Turtle diagram for planning a process audit", "مخطط السلحفاة لتخطيط تدقيق عملية"),
    ("The process sits in the centre; the six legs are what you will ask about. Prepare questions and the evidence you expect for each leg, then follow the trail across interfaces.",
     "العملية في المركز؛ والأرجل الست ما ستسأل عنه. وحضّر أسئلة والأدلة التي تتوقعها لكل رِجل، ثم اتبع المسار عبر الواجهات."),
    ["CRS-Q-AUDIT-L02"], center=L("Process", "العملية"),
    spokes=[L("Inputs", "المدخلات"), L("With what?", "بماذا؟"), L("With whom?", "مع من؟"), L("Outputs", "المخرجات"), L("Results?", "بأي نتائج؟"), L("How?", "كيف؟")])
fig("FIG-Q-EVID", "triad", ("Three sources of audit evidence", "ثلاثة مصادر لأدلة التدقيق"),
    ("Evidence is strongest where the three sources agree. When they disagree, follow the difference — it is often where the finding is.",
     "يكون الدليل أقوى حيث تتفق المصادر الثلاثة. وعند اختلافها، تتبّع الفرق — فغالبًا ما توجد الملاحظة هناك."),
    ["CRS-Q-AUDIT-L03", "CRS-ISO-AUD-L03"], corners=[L("Interviews", "المقابلات"), L("Observation", "المشاهدة"), L("Records", "السجلات")], center=L("Triangulate", "قاطِع الأدلة"))
fig("FIG-Q-FINDING", "flow", ("A finding someone else can verify", "ملاحظة يستطيع غيرك التحقق منها"),
    ("A finding has three parts in this order. If a reader who was not there cannot find the same evidence from what you wrote, the finding is not complete.",
     "للملاحظة ثلاثة أجزاء بهذا الترتيب. فإن لم يستطع قارئ لم يحضر إيجاد الدليل نفسه مما كتبته، فالملاحظة غير مكتملة."),
    ["CRS-Q-AUDIT-L04", "CRS-ISO-AUD-L05"], steps=[st("Requirement", "المتطلب", ("What should be", "ما يجب أن يكون")), st("Evidence", "الدليل", ("What is, with identifiers", "ما هو كائن بالمعرّفات")), st("Statement", "العبارة", ("Nonconformity or OFI", "عدم مطابقة أو فرصة تحسين"))], highlight=1)
fig("FIG-Q-WASTE", "tiles", ("Eight forms of waste", "أشكال الهدر الثمانية"),
    ("Walk the process and look for each tile. Waste is anything the customer would not pay for; waiting is usually the largest share of lead time.",
     "سِر في العملية وابحث عن كل مربع. والهدر أي شيء لا يدفع العميل ثمنه؛ والانتظار عادةً الحصة الأكبر من زمن الدورة."),
    ["CRS-LSS-GB-L01"], items=[{"icon": "alert", "t": L("Defects", "العيوب")}, {"icon": "layers", "t": L("Overproduction", "الإنتاج الزائد")}, {"icon": "clock", "t": L("Waiting", "الانتظار")},
                               {"icon": "users", "t": L("Unused talent", "المواهب غير المستغلة")}, {"icon": "truck", "t": L("Transport", "النقل")}, {"icon": "grid", "t": L("Inventory", "المخزون")},
                               {"icon": "route", "t": L("Motion", "الحركة")}, {"icon": "cog", "t": L("Extra processing", "المعالجة الزائدة")}], highlight=2)
fig("FIG-Q-VSM", "bars", ("Value-adding time is a small part of lead time", "زمن إضافة القيمة جزء صغير من زمن الدورة"),
    ("Compare the bars: actual review work was about 6 hours, while the permit spent most of its 34 days waiting in queues and rework loops." + ILL[0],
     "قارن الأعمدة: كان عمل المراجعة الفعلي نحو 6 ساعات، بينما قضى التصريح معظم أيامه الأربعة والثلاثين في الطوابير ودورات إعادة العمل." + ILL[1]),
    ["CRS-LSS-GB-L01"], bars=[{"t": L("Working", "عمل فعلي"), "v": 1, "vLabel": L("6 h", "6 ساعات")}, {"t": L("Queues", "طوابير"), "v": 24, "vLabel": L("24 d", "24 يومًا")},
                              {"t": L("Rework loops", "دورات إعادة العمل"), "v": 9, "vLabel": L("9 d", "9 أيام")}], highlight=1, yLabel=L("Time", "الوقت"), xLabel=L("Where the 34 days went", "أين ذهبت الأيام الأربعة والثلاثون"))
fig("FIG-Q-DMAIC", "flow", ("DMAIC: five phases of an improvement project", "DMAIC: مراحل مشروع التحسين الخمس"),
    ("Each phase ends with a gate review before the next starts. Most failed projects skipped Measure (untrusted data) or Control (gains faded).",
     "تنتهي كل مرحلة بمراجعة بوابة قبل بدء التالية. ومعظم المشاريع الفاشلة تجاوزت القياس (بيانات غير موثوقة) أو التحكم (تلاشت المكاسب)."),
    ["CRS-LSS-GB-L02", "guide:dmaic", "course:CRS-LSS-GB"], gates=True,
    steps=[st("Define", "التعريف", ("Charter, SIPOC, CTQ", "الميثاق وSIPOC والخصائص الحرجة"), "D"), st("Measure", "القياس", ("MSA, baseline", "نظام القياس وخط الأساس"), "M"),
           st("Analyse", "التحليل", ("Verified causes", "أسباب متحقق منها"), "A"), st("Improve", "التحسين", ("Pilot, FMEA", "تجربة وFMEA"), "I"), st("Control", "التحكم", ("Control plan", "خطة الضبط"), "C")])
fig("FIG-Q-SIGMA", "ladder", ("Sigma level and defects per million opportunities", "مستوى سيجما والعيوب لكل مليون فرصة"),
    ("Each step up the ladder cuts defects sharply. Figures follow the usual convention with a 1.5-sigma long-term shift; they are only meaningful if opportunities are defined honestly.",
     "كل درجة أعلى في السلم تخفض العيوب بشدة. وتتبع الأرقام الاصطلاح المعتاد بانزياح طويل المدى قدره 1.5 سيجما؛ ولا معنى لها إلا إذا عُرّفت الفرص بأمانة."),
    ["CRS-LSS-GB-L04"], levels=[st("2 sigma", "2 سيجما", ("≈ 308,500 DPMO", "≈ 308,500 عيب لكل مليون")), st("3 sigma", "3 سيجما", ("≈ 66,800 DPMO", "≈ 66,800 عيب لكل مليون")),
                                st("4 sigma", "4 سيجما", ("≈ 6,210 DPMO", "≈ 6,210 عيب لكل مليون")), st("5 sigma", "5 سيجما", ("≈ 233 DPMO", "≈ 233 عيبًا لكل مليون")), st("6 sigma", "6 سيجما", ("≈ 3.4 DPMO", "≈ 3.4 عيب لكل مليون"))])
fig("FIG-Q-PILOT", "flow", ("From verified cause to rollout", "من السبب المتحقق منه إلى التعميم"),
    ("Never jump from a brainstorm to rollout. Each box is a check that protects the project from a plausible but wrong solution.",
     "لا تقفز أبدًا من العصف الذهني إلى التعميم. فكل مربع فحص يحمي المشروع من حل معقول لكنه خاطئ."),
    ["CRS-LSS-GB-L03"], steps=[st("Candidate causes", "أسباب مرشحة"), st("Test with data", "اختبار بالبيانات"), st("Pilot small", "تجربة صغيرة"), st("FMEA of the fix", "FMEA للحل"), st("Roll out", "التعميم")], highlight=2)
fig("FIG-Q-SITLEAD", "spectrum", ("Leadership style follows readiness", "يتبع أسلوب القيادة الجاهزية"),
    ("Move along the line as the team's skill and commitment grow. The same leader uses different styles with different teams — and with the same team over time.",
     "تحرك على الخط مع نمو مهارة الفريق والتزامه. ويستخدم القائد نفسه أساليب مختلفة مع فرق مختلفة — ومع الفريق نفسه بمرور الوقت."),
    ["CRS-CMQOE-PREP-L01"], **{"from": L("New to the task", "جديد على المهمة"), "to": L("Ready and willing", "جاهز وراغب")},
    marks=[st("Directing", "التوجيه", ("Clear instructions", "تعليمات واضحة")), st("Coaching", "التدريب", ("Explain and support", "اشرح وادعم")), st("Participating", "المشاركة", ("Decide together", "قرر معًا")), st("Delegating", "التفويض", ("Goals and trust", "أهداف وثقة"))])
fig("FIG-Q-HOSHIN", "flow", ("Strategy deployment cascade (hoshin style)", "تسلسل نشر الاستراتيجية (بأسلوب هوشين)"),
    ("Read down the cascade: each level is agreed with the level below through discussion (catchball), not handed down. Measures at the bottom tell you whether the top is moving.",
     "اقرأ نزولًا في التسلسل: يُتفق على كل مستوى مع المستوى الأدنى بالنقاش (تمرير الكرة) لا بالتسليم. والمقاييس في الأسفل تخبرك هل يتحرك الأعلى."),
    ["CRS-CMQOE-PREP-L02"], dir="v", indent=True,
    steps=[st("Vision and environment scan", "الرؤية ومسح البيئة"), st("Breakthrough objectives (3–5 years)", "الأهداف الاختراقية (3–5 سنوات)"), st("Annual objectives", "الأهداف السنوية"),
           st("Improvement priorities by function", "أولويات التحسين لكل وظيفة"), st("Measures, targets and owners", "المقاييس والمستهدفات والمالكون")], highlight=1)
fig("FIG-Q-BSC", "tiles", ("Four balanced perspectives of performance", "أربعة منظورات متوازنة للأداء"),
    ("Choose one or two measures in each tile. If all your measures sit in one tile, you can improve it while damaging the others.",
     "اختر مقياسًا أو اثنين في كل مربع. فإن كانت كل مقاييسك في مربع واحد، فقد تحسنه وتضر بالبقية."),
    ["CRS-CMQOE-PREP-L02"], items=[{"icon": "coins", "t": L("Financial", "المالي")}, {"icon": "users", "t": L("Customer", "العميل")}, {"icon": "cog", "t": L("Internal process", "العمليات الداخلية")}, {"icon": "bulb", "t": L("Learning and growth", "التعلم والنمو")}])
fig("FIG-Q-VOC", "cycle", ("The closed customer loop", "حلقة العميل المغلقة"),
    ("Follow the loop clockwise. A complaint is closed only when its cause has fed an improvement — otherwise the same complaint returns.",
     "اتبع الحلقة باتجاه عقارب الساعة. ولا تُغلق الشكوى إلا عندما يغذي سببها تحسينًا — وإلا عادت الشكوى نفسها."),
    ["CRS-CMQOE-PREP-L03"], center=L("Customer", "العميل"),
    steps=[st("Listen", "الاستماع", ("Many channels", "قنوات عدة")), st("Resolve", "الحل", ("Each case", "كل حالة")), st("Analyse", "التحليل", ("Causes, segments", "الأسباب والشرائح")), st("Improve", "التحسين", ("Fix the system", "أصلح النظام")), st("Measure loyalty", "قياس الولاء", ("Retention, share", "الاحتفاظ والحصة"))])
fig("FIG-Q-TRAIN", "ladder", ("Four levels of training evaluation", "أربعة مستويات لتقييم التدريب"),
    ("Each level up is harder to measure and worth more. Attendance and reaction alone say nothing about whether work changed.",
     "كل مستوى أعلى أصعب قياسًا وأعلى قيمة. والحضور ورد الفعل وحدهما لا يقولان شيئًا عن تغير العمل."),
    ["CRS-CMQOE-PREP-L04"], levels=[st("Reaction", "رد الفعل", ("Did they like it?", "هل أعجبهم؟")), st("Learning", "التعلم", ("Did they learn?", "هل تعلموا؟")),
                                    st("Behaviour", "السلوك", ("Do they apply it?", "هل يطبقونه؟")), st("Results", "النتائج", ("Did performance change?", "هل تغير الأداء؟"))], highlight=2)
fig("FIG-Q-CMQBOK", "bars", ("CMQ/OE 2026 Body of Knowledge: questions per major area", "مجالات معرفة CMQ/OE لعام 2026: الأسئلة لكل مجال رئيسي"),
    ("Taller bars carry more questions (165 scored in total). Plan hours by these weights and by your own weak areas. Counts are from a training provider's summary of ASQ's BoK — confirm them in ASQ's download.",
     "الأعمدة الأطول تحمل أسئلة أكثر (165 سؤالًا محتسبًا إجمالًا). خطط الساعات بهذه الأوزان وبمواطن ضعفك. والأعداد من ملخص مزود تدريب لمجالات معرفة ASQ — فأكّدها في ملف ASQ."),
    ["CRS-CMQOE-PREP-L04", "course:CRS-CMQOE-PREP"], bars=[{"t": L("Leadership", "القيادة"), "v": 28}, {"t": L("Strategy", "الاستراتيجية"), "v": 23}, {"t": L("Mgmt methods", "أساليب الإدارة"), "v": 26},
                                                         {"t": L("Q tools", "أدوات الجودة"), "v": 31}, {"t": L("Customers", "العملاء"), "v": 22}, {"t": L("Supply chain", "سلسلة الإمداد"), "v": 19}, {"t": L("Training", "التدريب"), "v": 16}],
    highlight=3, yLabel=L("Questions", "الأسئلة"), xLabel=L("Major area (2026 BoK)", "المجال الرئيسي (مجالات 2026)"))
fig("FIG-Q-PAF", "bars", ("Cost of quality by category: failure dominates", "تكلفة الجودة حسب الفئة: الإخفاق هو الغالب"),
    ("Prevention is small, failure is large. Moving money into prevention usually lowers failure by much more than it costs. Figures are from the lesson example (SAR millions).",
     "الوقاية صغيرة والإخفاق كبير. ونقل المال إلى الوقاية يخفض الإخفاق عادةً بأكثر بكثير مما يكلف. والأرقام من مثال الدرس (بملايين الريالات)."),
    ["CRS-Q-COQ-L01", "course:CRS-Q-COQ"], bars=[{"t": L("Prevention", "الوقاية"), "v": 0.4}, {"t": L("Appraisal", "التقييم"), "v": 1.6}, {"t": L("Internal failure", "إخفاق داخلي"), "v": 3.1}, {"t": L("External failure", "إخفاق خارجي"), "v": 2.2}],
    highlight=2, yLabel=L("SAR M", "مليون ريال"), xLabel=L("Total 7.3 M ≈ 9% of sales", "الإجمالي 7.3 مليون ≈ 9% من المبيعات"))
fig("FIG-Q-COQDATA", "flow", ("Where cost-of-quality data lives", "أين توجد بيانات تكلفة الجودة"),
    ("Most data already exists in these systems. Agree definitions and rates with finance first, then collect for one area and one quarter.",
     "معظم البيانات موجودة في هذه الأنظمة. اتفق أولًا مع المالية على التعريفات والمعدلات، ثم اجمع لمجال واحد وربع سنة واحد."),
    ["CRS-Q-COQ-L02"], steps=[st("Ledger", "الأستاذ العام", ("Scrap, warranty", "الخردة والضمان")), st("Production", "الإنتاج", ("Rework hours", "ساعات إعادة العمل")), st("Maintenance", "الصيانة", ("Downtime", "التوقف")),
                              st("Payroll", "الرواتب", ("Inspection time", "وقت الفحص")), st("Customer service", "خدمة العملاء", ("Complaint time", "وقت الشكاوى"))])
fig("FIG-Q-ICEBERG", "iceberg", ("The cost-of-quality iceberg", "جبل جليد تكلفة الجودة"),
    ("Above the waterline: costs the accounts show. Below: costs that are real but rarely recorded. Estimate the main hidden ones with clear assumptions and report them separately.",
     "فوق خط الماء: تكاليف تُظهرها الحسابات. وتحته: تكاليف حقيقية نادرًا ما تُسجل. قدّر أهم التكاليف الخفية بافتراضات واضحة وارفعها منفصلة."),
    ["CRS-Q-COQ-L03", "CRS-QMS-201-L01"], aboveLabel=L("Visible", "ظاهرة"), belowLabel=L("Hidden", "خفية"),
    above=[L("Scrap", "الخردة"), L("Rework", "إعادة العمل"), L("Warranty", "الضمان")],
    below=[L("Overtime to recover", "عمل إضافي للتعويض"), L("Extra stock", "مخزون إضافي"), L("Firefighting time", "وقت إطفاء الحرائق"), L("Lost capacity", "طاقة مفقودة"), L("Lost customers", "عملاء مفقودون"), L("Reputation", "السمعة")])
fig("FIG-Q-SUPSEG", "matrix", ("Segmenting purchased items by effect and supply risk", "تقسيم المشتريات حسب الأثر ومخاطر التوريد"),
    ("Place each category in a cell. Top right (critical) needs deep qualification and partnership; bottom left (routine) needs simple controls.",
     "ضع كل فئة في خلية. الأعلى يمينًا (حرجة) تحتاج إلى تأهيل عميق وشراكة؛ والأسفل يسارًا (روتينية) تحتاج إلى ضوابط بسيطة."),
    ["CRS-Q-SUPPLIER-L01"], rows=2, cols=2, cells=[[L("Leverage", "رافعة"), L("Critical: partner", "حرجة: شراكة")], [L("Routine: simple", "روتينية: بسيطة"), L("Bottleneck: secure", "عنق زجاجة: أمّن")]],
    highlight=[[0, 1]], yLabel=L("Effect on product", "الأثر على المنتج"), xLabel=L("Supply risk", "مخاطر التوريد"))
fig("FIG-Q-SUPLIFE", "cycle", ("The supplier-quality life cycle", "دورة حياة جودة الموردين"),
    ("Suppliers move round the cycle; performance data decides whether they are developed, kept or re-qualified. Major changes at the supplier send it back to qualification.",
     "يتحرك الموردون حول الدورة؛ وبيانات الأداء تقرر هل يُطوَّرون أو يُبقى عليهم أو يُعاد تأهيلهم. والتغييرات الكبيرة لدى المورد تعيده إلى التأهيل."),
    ["CRS-Q-SUPPLIER-L01", "course:CRS-Q-SUPPLIER"], center=L("Supplier", "المورد"),
    steps=[st("Select", "الاختيار", ("By risk", "حسب المخاطر")), st("Qualify", "التأهيل", ("Evidence, scope", "الأدلة والنطاق")), st("Specify", "التحديد", ("PO flow-down", "تمرير أمر الشراء")),
           st("Monitor", "المتابعة", ("Scorecard", "بطاقة الأداء")), st("Improve", "التحسين", ("SCAR, develop", "إجراء تصحيحي وتطوير"))])
fig("FIG-Q-INSPECT", "spectrum", ("Incoming inspection follows the evidence", "يتبع الفحص عند الاستلام الأدلة"),
    ("Start tightened for new or critical suppliers; move to normal and then reduced inspection on a proven record; switch back at the first sign of trouble.",
     "ابدأ مشددًا للموردين الجدد أو الحرجين؛ وانتقل إلى العادي ثم المخفف مع سجل مثبت؛ وعُد عند أول علامة مشكلة."),
    ["CRS-Q-SUPPLIER-L02"], **{"from": L("New or critical", "جديد أو حرج"), "to": L("Proven record", "سجل مثبت")},
    marks=[st("Tightened", "مشدد", ("More samples", "عينات أكثر")), st("Normal", "عادي", ("Standard plan", "خطة قياسية")), st("Reduced", "مخفف", ("Fewer samples", "عينات أقل")), st("Certificates", "الشهادات", ("Review records", "مراجعة السجلات"))])
fig("FIG-Q-SCORE", "bars", ("A weighted supplier scorecard", "بطاقة أداء موردين موزونة"),
    ("Each bar is one dimension's weight in the total score. Add a rule that any critical event triggers a review whatever the average says.",
     "كل عمود وزن بُعد واحد في الدرجة الإجمالية. وأضف قاعدة بأن أي حدث حرج يُطلق مراجعة أيًّا كان المتوسط."),
    ["CRS-Q-SUPPLIER-L03"], bars=[{"t": L("Quality", "الجودة"), "v": 40, "vLabel": L("40%", "40%")}, {"t": L("On time, in full", "في الموعد وكاملًا"), "v": 30, "vLabel": L("30%", "30%")},
                                  {"t": L("Responsiveness", "الاستجابة"), "v": 20, "vLabel": L("20%", "20%")}, {"t": L("Documents", "المستندات"), "v": 10, "vLabel": L("10%", "10%")}], highlight=0, yLabel=L("Weight", "الوزن"), xLabel=L("Lesson example", "مثال الدرس"))
fig("FIG-Q-SCAR", "flow", ("Supplier corrective action (SCAR) — judge the response, not the speed", "الإجراء التصحيحي لدى المورد — احكم على مضمون الرد لا سرعته"),
    ("The same discipline as an internal CAPA. A reply that stops at “human error” goes back to the supplier for a verified system cause.",
     "الانضباط نفسه كالإجراء التصحيحي الداخلي. والرد الذي يتوقف عند «خطأ بشري» يُعاد إلى المورد لتقديم سبب نظامي متحقق منه."),
    ["CRS-Q-SUPPLIER-L04"], steps=[st("Facts + requirement", "الحقائق + المتطلب"), st("Contain in days", "احتواء خلال أيام"), st("Verified cause", "سبب متحقق منه"), st("Actions", "الإجراءات"), st("Effectiveness", "الفاعلية")], highlight=2)

# method guides (quality family)
fig("FIG-M-PDCA", "cycle", ("PDCA: Plan, Do, Check, Act", "دورة PDCA: خطط، نفّذ، افحص، صحّح"),
    ("Go round the cycle: plan a change and how you will judge it, try it on a small scale, check the result against the plan, then standardise or adjust and go round again.",
     "دُر حول الدورة: خطط لتغيير وكيف ستحكم عليه، وجرّبه على نطاق صغير، وافحص النتيجة مقابل الخطة، ثم اعتمده معيارًا أو عدّله ودُر مرة أخرى."),
    ["guide:pdca", "course:CRS-QMS-201"], center=L("Improve", "التحسين"),
    steps=[st("Plan", "خطط", ("Aim, measure, change", "الغاية والمقياس والتغيير")), st("Do", "نفّذ", ("Try it small", "جرّبه صغيرًا")), st("Check", "افحص", ("Result vs plan", "النتيجة مقابل الخطة")), st("Act", "صحّح", ("Standardise or adjust", "اعتمد أو عدّل"))])
fig("FIG-M-RCA", "funnel", ("Root cause analysis narrows from many causes to one verified cause", "تحليل السبب الجذري يضيّق من أسباب كثيرة إلى سبب واحد متحقق منه"),
    ("Each stage keeps fewer, better-supported causes. Only the bottom of the funnel — a verified cause — justifies a corrective action.",
     "تُبقي كل مرحلة أسبابًا أقل وأفضل دعمًا. ولا يبرر الإجراء التصحيحي إلا قاع القمع — السبب المتحقق منه."),
    ["guide:rca"], stages=[L("Possible causes (brainstorm, fishbone)", "أسباب محتملة (عصف ذهني، عظم السمكة)"), L("Likely causes (data, is / is-not)", "أسباب مرجحة (بيانات، هو / ليس هو)"), L("Tested causes (trials)", "أسباب مختبرة (تجارب)"), L("Verified root cause", "سبب جذري متحقق منه")])
fig("FIG-M-A3", "tiles", ("The A3 report on one sheet", "تقرير A3 في ورقة واحدة"),
    ("Read the left side (the problem) before the right side (the solution). If the root-cause box is weak, the countermeasures will be guesses.",
     "اقرأ الجانب الأيسر (المشكلة) قبل الأيمن (الحل). فإن كان مربع السبب الجذري ضعيفًا كانت الإجراءات المضادة تخمينات."),
    ["guide:a3"], items=[{"icon": "info", "t": L("Background", "الخلفية")}, {"icon": "chart", "t": L("Current condition", "الوضع الحالي")}, {"icon": "target", "t": L("Goal", "الهدف")},
                         {"icon": "fish", "t": L("Root cause", "السبب الجذري")}, {"icon": "bulb", "t": L("Countermeasures", "الإجراءات المضادة")}, {"icon": "calendar", "t": L("Plan", "الخطة")}, {"icon": "check", "t": L("Follow-up", "المتابعة")}], highlight=3)
fig("FIG-M-FMEA", "table", ("FMEA: rating a failure mode", "تحليل FMEA: تقييم نمط إخفاق"),
    ("Rate each failure mode for severity, occurrence and detection, then decide the action priority. Act first on high severity, whatever the other ratings say." + ILL[0],
     "قيّم كل نمط إخفاق من حيث الشدة والحدوث والاكتشاف، ثم حدد أولوية الإجراء. وتصرف أولًا في الشدة العالية أيًّا كانت التقييمات الأخرى." + ILL[1]),
    ["guide:fmea"], cols=[L("Severity", "الشدة"), L("Occurrence", "الحدوث"), L("Detection", "الاكتشاف"), L("Priority", "الأولوية")],
    rows=[{"t": L("Seal leaks", "تسرب الحشوة"), "cells": [L("9", "9"), L("4", "4"), L("6", "6"), L("High", "عالية")]}, {"t": L("Label missing", "ملصق مفقود"), "cells": [L("4", "4"), L("3", "3"), L("2", "2"), L("Low", "منخفضة")]},
          {"t": L("Wrong torque", "عزم خاطئ"), "cells": [L("8", "8"), L("5", "5"), L("7", "7"), L("High", "عالية")]}])
fig("FIG-M-SWOT", "matrix", ("SWOT: internal and external, helpful and harmful", "SWOT: داخلي وخارجي، مفيد وضار"),
    ("Top row is internal (you control it), bottom row external (you respond to it). Strategy pairs cells: use strengths on opportunities, fix weaknesses that threats would exploit.",
     "الصف الأعلى داخلي (تتحكم فيه)، والأسفل خارجي (تستجيب له). والاستراتيجية تقرن الخلايا: استخدم نقاط القوة في الفرص، وأصلح نقاط الضعف التي تستغلها التهديدات."),
    ["guide:swot"], rows=2, cols=2, cells=[[L("Strengths", "نقاط القوة"), L("Weaknesses", "نقاط الضعف")], [L("Opportunities", "الفرص"), L("Threats", "التهديدات")]],
    yLabel=L("Internal · External", "داخلي · خارجي"), xLabel=L("Helpful · Harmful", "مفيد · ضار"))
fig("FIG-M-PESTLE", "tiles", ("PESTLE: six external lenses", "PESTLE: ست عدسات خارجية"),
    ("Scan each lens for changes that matter to your organisation in the planning horizon; keep only those that create a real opportunity or threat.",
     "امسح كل عدسة بحثًا عن التغيرات المهمة لمنظمتك في أفق التخطيط؛ وأبقِ فقط ما يخلق فرصة أو تهديدًا حقيقيًا."),
    ["guide:pestle"], items=[{"icon": "flag", "t": L("Political", "سياسي")}, {"icon": "coins", "t": L("Economic", "اقتصادي")}, {"icon": "users", "t": L("Social", "اجتماعي")},
                             {"icon": "cog", "t": L("Technological", "تقني")}, {"icon": "scale", "t": L("Legal", "قانوني")}, {"icon": "globe", "t": L("Environmental", "بيئي")}])
fig("FIG-M-LESSONS", "cycle", ("A lessons-learned loop that changes practice", "حلقة دروس مستفادة تغيّر الممارسة"),
    ("A lesson is learned only when practice changes and the change is checked. Capturing and filing alone is a lessons-recorded system.",
     "لا يُتعلم الدرس إلا عندما تتغير الممارسة ويُفحص التغيير. والتسجيل والحفظ وحدهما نظام دروس مسجلة."),
    ["guide:lessons-learned"], center=L("Learn", "التعلم"),
    steps=[st("Capture", "التسجيل"), st("Analyse", "التحليل"), st("Share", "المشاركة"), st("Apply", "التطبيق"), st("Verify", "التحقق")])
fig("FIG-PM-STAKE", "matrix", ("Power–interest grid", "شبكة النفوذ والاهتمام"),
    ("Place each stakeholder by power (vertical) and interest (horizontal). The cell tells you the engagement approach; people move between cells as the project changes.",
     "ضع كل صاحب مصلحة حسب النفوذ (رأسيًا) والاهتمام (أفقيًا). وتخبرك الخلية بنهج الإشراك؛ وينتقل الناس بين الخلايا مع تغير المشروع."),
    ["CRS-PM-STAKE-L01", "guide:stakeholders"], rows=2, cols=2, cells=[[L("Keep satisfied", "حافظ على رضاهم"), L("Manage closely", "أدِرهم عن قرب")], [L("Monitor", "راقب"), L("Keep informed", "أبقِهم على اطلاع")]],
    highlight=[[0, 1]], yLabel=L("Power", "النفوذ"), xLabel=L("Interest", "الاهتمام"))

# ================================================================== ISO (Phase 7 courses)
fig("FIG-ISO-CHAIN", "flow", ("Standard, system, certification and accreditation", "المعيار والنظام والمنح والاعتماد"),
    ("Read left to right: a standard is written, an organisation builds its system, a certification body audits it, and an accreditation body checks the certification body. Each link is done by a different party.",
     "اقرأ بالترتيب: يُكتب المعيار، وتبني المنظمة نظامها، وتدققه جهة منح، وتفحص جهة الاعتماد جهة المنح. وكل حلقة يؤديها طرف مختلف."),
    ["CRS-ISO-101-L01"], steps=[st("Standard", "المعيار", ("ISO publishes", "تنشره ISO")), st("Management system", "نظام الإدارة", ("You build it", "تبنيه أنت")),
                               st("Certification", "المنح", ("A body audits you", "جهة تدققك")), st("Accreditation", "الاعتماد", ("A body checks the auditor", "جهة تفحص المدقق"))], highlight=1)
fig("FIG-ISO-ROLES", "hub", ("Who does what around a management system", "من يفعل ماذا حول نظام الإدارة"),
    ("The organisation in the centre owns its system. Every other party has a separate role — a consultant who advises should not also certify.",
     "المنظمة في المركز تملك نظامها. ولكل طرف آخر دور منفصل — فالمستشار الذي ينصح لا يجوز أن يمنح أيضًا."),
    ["CRS-ISO-101-L02"], center=L("Organisation", "المنظمة"), dashed=True,
    spokes=[L("Consultant: advises", "المستشار: ينصح"), L("Internal auditor: checks", "المدقق الداخلي: يفحص"), L("Certification body: certifies", "جهة المنح: تمنح"),
            L("Accreditation body: oversees", "جهة الاعتماد: تشرف"), L("Customers and regulators", "العملاء والجهات التنظيمية")])
fig("FIG-ISO-HLS", "cycle", ("The harmonized structure (clauses 4–10) on the PDCA cycle", "الهيكل الموحد (البنود 4–10) على دورة PDCA"),
    ("Each quarter of the cycle groups the clauses of every ISO management-system standard. Context and leadership (4–5) drive the whole cycle.",
     "يجمع كل ربع من الدورة بنود كل معيار من معايير أنظمة إدارة ISO. ويقود السياق والقيادة (4–5) الدورة كلها."),
    ["CRS-ISO-101-L03", "CRS-ISO-IMS-L01", "CRS-ISO-9001-F-L01", "course:CRS-ISO-101"], center=L("4–5 Context, leadership", "4–5 السياق والقيادة"),
    steps=[st("Plan", "خطط", ("6 Planning · 7 Support", "6 التخطيط · 7 الدعم")), st("Do", "نفّذ", ("8 Operation", "8 التشغيل")), st("Check", "افحص", ("9 Performance evaluation", "9 تقييم الأداء")), st("Act", "صحّح", ("10 Improvement", "10 التحسين"))])
fig("FIG-ISO-CONTEXT", "funnel", ("From context to scope to processes", "من السياق إلى النطاق إلى العمليات"),
    ("Each stage narrows the one above: what is happening around you and who cares shapes what you must deliver, which sets the scope and then the processes.",
     "تضيّق كل مرحلة ما فوقها: ما يجري حولك ومن يهتم يشكّل ما يجب أن تقدمه، وذلك يحدد النطاق ثم العمليات."),
    ["CRS-ISO-101-L04", "CRS-ISO-9001-IMP-L02"], stages=[L("Issues and interested parties", "القضايا والأطراف المعنية"), L("Their relevant requirements", "متطلباتهم ذات الصلة"), L("Scope of the system", "نطاق النظام"), L("Processes and interactions", "العمليات وتفاعلاتها")])
fig("FIG-ISO-IMPROVE", "flow", ("The improvement loop of clauses 9 and 10", "حلقة التحسين في البندين 9 و10"),
    ("Monitoring feeds analysis and evaluation; audits and management review decide; improvement closes the loop and feeds the next round of monitoring.",
     "تغذي المتابعة التحليل والتقييم؛ ويقرر التدقيق ومراجعة الإدارة؛ ويغلق التحسين الحلقة ويغذي الجولة التالية من المتابعة."),
    ["CRS-ISO-101-L06", "CRS-ISO-9001-F-L04"], loop=True, steps=[st("Monitor", "تابع"), st("Analyse", "حلّل"), st("Audit", "دقّق"), st("Review", "راجِع"), st("Improve", "حسّن")], highlight=3)
fig("FIG-ISO-ANATOMY", "tree", ("Anatomy of an ISO management-system standard", "تشريح معيار أنظمة الإدارة من ISO"),
    ("Requirements live in clauses 4–10. Notes explain but add no requirements; annexes may be normative or informative — the annex title says which.",
     "توجد المتطلبات في البنود 4–10. والملاحظات تشرح ولا تضيف متطلبات؛ والملاحق قد تكون إلزامية أو إرشادية — وعنوان الملحق يبين ذلك."),
    ["CRS-ISO-READ-L01", "CRS-ISO-READ-L02"], root=L("The standard", "المعيار"),
    children=[{"t": L("Front matter", "المقدمات"), "children": [L("Foreword", "التمهيد"), L("Introduction", "المقدمة")]}, {"t": L("Clauses 1–3", "البنود 1–3"), "children": [L("Scope", "النطاق"), L("References, terms", "المراجع والمصطلحات")]},
              {"t": L("Clauses 4–10", "البنود 4–10"), "children": [L("Requirements", "المتطلبات"), L("Notes (no new req.)", "ملاحظات (بلا متطلب)")]}, {"t": L("Annexes", "الملاحق"), "children": [L("Normative", "إلزامية"), L("Informative", "إرشادية")]}])
fig("FIG-ISO-VERBS", "ladder", ("Verbal forms: what each word obliges", "الصيغ اللفظية: ما يُلزم به كل لفظ"),
    ("Only “shall” states a requirement you will be audited against. “Should” recommends, “may” permits and “can” states a possibility.",
     "لا يذكر متطلبًا ستُدقَّق مقابله إلا «يجب» (shall). أما «ينبغي» (should) فتوصي، و«يجوز» (may) تسمح، و«يمكن» (can) تذكر إمكانية."),
    ["CRS-ISO-READ-L03"], levels=[st("can", "يمكن (can)", ("Possibility", "إمكانية")), st("may", "يجوز (may)", ("Permission", "إذن")), st("should", "ينبغي (should)", ("Recommendation", "توصية")), st("shall", "يجب (shall)", ("Requirement", "متطلب"))], highlight=3)
fig("FIG-ISO-EVIDCHAIN", "flow", ("From requirement to objective evidence", "من المتطلب إلى الدليل الموضوعي"),
    ("Each requirement is met by a process, shown by information, and proven by evidence an auditor can verify. Break the chain anywhere and conformity cannot be shown.",
     "يُستوفى كل متطلب بعملية، وتُظهره المعلومات، ويثبته دليل يستطيع المدقق التحقق منه. وأي كسر في السلسلة يمنع إثبات المطابقة."),
    ["CRS-ISO-READ-L04", "CRS-ISO-9001-IMP-L03"], steps=[st("Requirement", "المتطلب"), st("Your process", "عمليتك"), st("Documented information", "المعلومات الموثقة"), st("Objective evidence", "الدليل الموضوعي"), st("Conformity", "المطابقة")], highlight=3)
fig("FIG-ISO-AUDCYCLE", "cycle", ("The audit cycle", "دورة التدقيق"),
    ("The programme sets which audits happen and why; each audit is planned, conducted, reported and followed up; results feed the next programme.",
     "يحدد البرنامج أي عمليات تدقيق تُجرى ولماذا؛ ويُخطط لكل تدقيق ويُنفذ ويُرفع تقريره ويُتابع؛ وتغذي النتائج البرنامج التالي."),
    ["CRS-ISO-AUD-L01", "CRS-ISO-9001-AUD-L01", "CRS-ISO-14001-AUD-L01", "CRS-ISO-45001-AUD-L01", "CRS-ISO-27001-AUD-L01", "course:CRS-Q-AUDIT", "course:CRS-ISO-AUD"], center=L("Audit programme", "برنامج التدقيق"),
    steps=[st("Plan", "التخطيط", ("Scope, criteria, team", "النطاق والمعايير والفريق")), st("Conduct", "التنفيذ", ("Evidence, trails", "الأدلة والمسارات")), st("Report", "التقرير", ("Findings, conclusion", "الملاحظات والاستنتاج")), st("Follow up", "المتابعة", ("Actions, effectiveness", "الإجراءات والفاعلية"))])
fig("FIG-ISO-PLAN1", "flow", ("Planning one audit", "تخطيط تدقيق واحد"),
    ("Each step feeds the next: objectives and criteria decide the scope, the scope decides the team and time, and the checklist turns risks into questions.",
     "تغذي كل خطوة التالية: الأهداف والمعايير تحدد النطاق، والنطاق يحدد الفريق والوقت، وقائمة التحقق تحوّل المخاطر إلى أسئلة."),
    ["CRS-ISO-AUD-L02"], steps=[st("Objectives", "الأهداف"), st("Criteria", "المعايير"), st("Scope", "النطاق"), st("Team and time", "الفريق والوقت"), st("Risk-based checklist", "قائمة تحقق قائمة على المخاطر")])
fig("FIG-ISO-SAMPLE", "funnel", ("Sampling and audit trails", "المعاينة ومسارات التدقيق"),
    ("Start from the whole population, take a risk-based sample, follow each item along its trail, and record what you find with identifiers.",
     "ابدأ من المجتمع كله، وخذ عينة قائمة على المخاطر، وتتبّع كل عنصر في مساره، وسجّل ما تجده بالمعرّفات."),
    ["CRS-ISO-AUD-L04", "CRS-ISO-9001-AUD-L02"], stages=[L("Population (all records)", "المجتمع (كل السجلات)"), L("Risk-based sample", "عينة قائمة على المخاطر"), L("Trail across processes", "مسار عبر العمليات"), L("Evidence with identifiers", "أدلة بالمعرّفات")])
fig("FIG-ISO-CLOSE", "flow", ("Closing meeting to closed finding", "من الاجتماع الختامي إلى الملاحظة المغلقة"),
    ("A finding is closed only after its action has been verified as effective — the report is the start of follow-up, not the end of the audit's value.",
     "لا تُغلق الملاحظة إلا بعد التحقق من فاعلية إجرائها — فالتقرير بداية المتابعة لا نهاية قيمة التدقيق."),
    ["CRS-ISO-AUD-L06", "CRS-ISO-9001-AUD-L04"], steps=[st("Closing meeting", "الاجتماع الختامي"), st("Report", "التقرير"), st("Action plan", "خطة الإجراءات"), st("Verify", "التحقق"), st("Close", "الإغلاق")], highlight=3)
fig("FIG-ISO-RISKMAT", "matrix", ("A 3×3 risk matrix", "مصفوفة مخاطر 3×3"),
    ("Rate likelihood (vertical) and consequence (horizontal); the colour shows the level. Define the scales in words first, so two people rate the same risk the same way.",
     "قيّم الاحتمال (رأسيًا) والعاقبة (أفقيًا)؛ ويُظهر اللون المستوى. وعرّف المقاييس بالكلمات أولًا، ليقيّم شخصان الخطر نفسه بالطريقة نفسها."),
    ["CRS-ISO-RISK-L02", "CRS-PM-RISK-L02", "CRS-ISO-45001-F-L02", "guide:iso-31000"], rows=3, cols=3, heat=True,
    cells=[[L("Medium", "متوسط"), L("High", "مرتفع"), L("Very high", "مرتفع جدًا")], [L("Low", "منخفض"), L("Medium", "متوسط"), L("High", "مرتفع")], [L("Very low", "منخفض جدًا"), L("Low", "منخفض"), L("Medium", "متوسط")]],
    yLabel=L("Likelihood", "الاحتمال"), xLabel=L("Consequence", "العاقبة"))
fig("FIG-ISO-RISKACT", "spectrum", ("Proportionate responses to risk", "استجابات متناسبة للمخاطر"),
    ("Effort should rise with the level of risk. Low risks are accepted and watched; high risks get treatment with owners and dates.",
     "يجب أن يرتفع الجهد مع مستوى المخاطر. فالمخاطر المنخفضة تُقبل وتُراقب؛ والمرتفعة تُعالج بمالكين ومواعيد."),
    ["CRS-ISO-RISK-L03", "CRS-PM-RISK-L03"], **{"from": L("Low risk", "خطر منخفض"), "to": L("High risk", "خطر مرتفع")},
    marks=[st("Accept, monitor", "اقبل وراقب"), st("Reduce likelihood", "قلّل الاحتمال"), st("Reduce impact", "قلّل الأثر"), st("Avoid or transfer", "تجنّب أو انقل")])
fig("FIG-ISO-RISKINT", "flow", ("Integrating risk actions into the system", "دمج إجراءات المخاطر في النظام"),
    ("A risk action belongs in the process where the risk lives; effectiveness is then checked through the normal monitoring, audit and review.",
     "ينتمي إجراء المخاطر إلى العملية التي يوجد فيها الخطر؛ ثم تُفحص الفاعلية عبر المتابعة والتدقيق والمراجعة المعتادة."),
    ["CRS-ISO-RISK-L04", "CRS-ISO-RISK-L01", "CRS-ISO-101-L05"], steps=[st("Risk register", "سجل المخاطر"), st("Action in the process", "إجراء في العملية"), st("Monitoring", "المتابعة"), st("Audit and review", "التدقيق والمراجعة")], highlight=1)
fig("FIG-ISO-IMS", "nested", ("What integrates in an IMS", "ما الذي يندمج في نظام الإدارة المتكامل"),
    ("The common core is shared once; discipline-specific requirements stay separate around it. Integrate the core, not the technical controls.",
     "يُشارك الجوهر المشترك مرة واحدة؛ وتبقى المتطلبات الخاصة بكل مجال منفصلة حوله. ادمج الجوهر لا الضوابط الفنية."),
    ["CRS-ISO-IMS-L01", "CRS-ISO-IMS-L02", "CRS-ISO-IMS-L03", "course:CRS-ISO-IMS"],
    rings=[st("Discipline-specific: aspects, hazards, security controls", "الخاص بكل مجال: الجوانب والمخاطر وضوابط الأمن"), st("Shared processes: documents, competence, audit", "عمليات مشتركة: الوثائق والكفاءة والتدقيق"), st("Common core: policy, objectives, review", "الجوهر المشترك: السياسة والأهداف والمراجعة")])
fig("FIG-ISO-IMSROAD", "flow", ("An integration roadmap", "خارطة طريق للدمج"),
    ("Integrate in this order; each gate checks that the previous step works before adding more.",
     "ادمج بهذا الترتيب؛ وتفحص كل بوابة أن الخطوة السابقة تعمل قبل إضافة المزيد."),
    ["CRS-ISO-IMS-L04"], gates=True, steps=[st("Map overlaps", "ارسم التداخلات"), st("One process map", "خريطة عمليات واحدة"), st("One document set", "مجموعة وثائق واحدة"), st("Joint audit", "تدقيق مشترك"), st("Joint review", "مراجعة مشتركة")])
fig("FIG-9001-CUST", "flow", ("The customer thread through ISO 9001", "خيط العميل عبر ISO 9001"),
    ("Follow the customer from requirements to satisfaction and back: what you learn at the end feeds the next requirements review.",
     "تتبّع العميل من المتطلبات إلى الرضا والعودة: ما تتعلمه في النهاية يغذي مراجعة المتطلبات التالية."),
    ["CRS-ISO-9001-F-L02", "CRS-ISO-9001-F-L03", "CRS-ISO-9001-AUD-L03"], loop=True,
    steps=[st("Requirements", "المتطلبات"), st("Review before accepting", "المراجعة قبل القبول"), st("Controlled delivery", "تسليم مضبوط"), st("Release", "الإفراج"), st("Satisfaction", "الرضا")], highlight=1)
fig("FIG-9001-IMP", "flow", ("ISO 9001 implementation in stages", "تطبيق ISO 9001 على مراحل"),
    ("Each diamond is a gate where management decides whether the system is ready for the next stage. The internal audit and management review come before certification, not after.",
     "كل معين بوابة تقرر فيها الإدارة هل النظام جاهز للمرحلة التالية. ويأتي التدقيق الداخلي ومراجعة الإدارة قبل المنح لا بعده."),
    ["CRS-ISO-9001-IMP-L01", "CRS-ISO-9001-IMP-L05", "CRS-ISO-9001-IMP-L06", "course:CRS-ISO-9001-IMP"], gates=True,
    steps=[st("Gap analysis", "تحليل الفجوات"), st("Design", "التصميم"), st("Implement", "التطبيق"), st("Internal audit", "التدقيق الداخلي"), st("Management review", "مراجعة الإدارة")])
fig("FIG-14001-ASP", "flow", ("From activity to control: aspects and impacts", "من النشاط إلى الضابط: الجوانب والآثار"),
    ("An activity has aspects (how it interacts with the environment); aspects cause impacts; significant aspects get operational controls and objectives.",
     "للنشاط جوانب (كيف يتفاعل مع البيئة)؛ والجوانب تسبب آثارًا؛ والجوانب المهمة تحصل على ضوابط تشغيلية وأهداف."),
    ["CRS-ISO-14001-F-L02", "CRS-ISO-14001-AUD-L02", "course:CRS-ISO-14001-F"],
    steps=[st("Activity", "النشاط", ("Painting", "الطلاء")), st("Aspect", "الجانب", ("Solvent emissions", "انبعاثات المذيبات")), st("Impact", "الأثر", ("Air quality", "جودة الهواء")), st("Significance", "الأهمية", ("Criteria", "المعايير")), st("Control", "الضابط", ("Low-VOC paint, extraction", "طلاء منخفض المركبات وشفط"))], highlight=3)
fig("FIG-14001-COMP", "cycle", ("Compliance obligations cycle", "دورة الالتزامات الواجبة"),
    ("Identify what applies, make it part of operation, evaluate compliance at planned intervals and act on gaps — then repeat when obligations change.",
     "حدد ما ينطبق، واجعله جزءًا من التشغيل، وقيّم الامتثال على فترات مخططة، وتصرف في الفجوات — ثم كرر عند تغير الالتزامات."),
    ["CRS-ISO-14001-F-L03", "CRS-ISO-14001-AUD-L03", "CRS-ISO-14001-F-L04", "CRS-ISO-14001-AUD-L04"], center=L("Obligations", "الالتزامات"),
    steps=[st("Identify", "التحديد"), st("Integrate", "الدمج"), st("Evaluate", "التقييم"), st("Act", "التصرف")])
fig("FIG-14001-ED", "flow", ("ISO 14001: from purpose to performance", "ISO 14001: من الغاية إلى الأداء"),
    ("An environmental management system starts from context and obligations and ends in measured environmental performance.",
     "يبدأ نظام الإدارة البيئية من السياق والالتزامات وينتهي بأداء بيئي مقيس."),
    ["CRS-ISO-14001-F-L01"], steps=[st("Context", "السياق"), st("Aspects and obligations", "الجوانب والالتزامات"), st("Objectives", "الأهداف"), st("Controls", "الضوابط"), st("Performance", "الأداء")])
fig("FIG-45001-HOC", "ladder", ("The hierarchy of controls", "تسلسل الضوابط الهرمي"),
    ("The top of the ladder is the most effective. Work down only when a higher control is not reasonably practicable; PPE is the last line, never the first.",
     "أعلى السلم هو الأكثر فاعلية. ولا تنزل إلا عندما يتعذر عمليًا الضابط الأعلى؛ ومعدات الوقاية الشخصية خط أخير لا أول."),
    ["CRS-ISO-45001-F-L03", "CRS-ISO-45001-AUD-L02", "course:CRS-ISO-45001-F"],
    levels=[st("PPE", "معدات الوقاية الشخصية", ("Last line", "الخط الأخير")), st("Administrative", "إدارية", ("Procedures, training", "إجراءات وتدريب")), st("Engineering", "هندسية", ("Guards, ventilation", "حواجز وتهوية")),
            st("Substitution", "الاستبدال", ("Less hazardous", "أقل خطورة")), st("Elimination", "الإزالة", ("Remove the hazard", "أزل الخطر"))], highlight=4)
fig("FIG-45001-PART", "hub", ("Worker participation and consultation in OH&S", "مشاركة العاملين واستشارتهم في السلامة والصحة المهنية"),
    ("Workers are at the centre of the system. Each spoke is a decision where they must be consulted or take part — and where an auditor looks for evidence.",
     "العاملون في مركز النظام. وكل شعاع قرار يجب أن يُستشاروا فيه أو يشاركوا — وحيث يبحث المدقق عن الأدلة."),
    ["CRS-ISO-45001-F-L01", "CRS-ISO-45001-AUD-L03"], center=L("Workers", "العاملون"),
    spokes=[L("Hazard identification", "تحديد المخاطر"), L("Controls", "الضوابط"), L("Incident investigation", "التحقيق في الحوادث"), L("Competence needs", "احتياجات الكفاءة"), L("Contractors", "المقاولون"), L("Objectives", "الأهداف")])
fig("FIG-45001-INC", "flow", ("From incident to learning", "من الحادث إلى التعلم"),
    ("Report without blame, respond, investigate to causes, act on the system and share the learning — the sequence turns an incident into prevention.",
     "أبلغ دون لوم، واستجب، وحقق حتى الأسباب، وتصرف على النظام، وشارك التعلم — فالتسلسل يحوّل الحادث إلى وقاية."),
    ["CRS-ISO-45001-F-L04", "CRS-ISO-45001-AUD-L04"], steps=[st("Report", "الإبلاغ"), st("Respond", "الاستجابة"), st("Investigate", "التحقيق"), st("Act", "التصرف"), st("Share", "المشاركة")], highlight=2)
fig("FIG-27001-CIA", "triad", ("The CIA triad of information security", "ثلاثية أمن المعلومات"),
    ("Every information-security risk threatens one or more corners. Controls are chosen for the corner at risk.",
     "كل خطر على أمن المعلومات يهدد ركنًا أو أكثر. وتُختار الضوابط للركن المعرض للخطر."),
    ["CRS-ISO-27001-F-L01", "course:CRS-ISO-27001-F"], corners=[L("Confidentiality", "السرية"), L("Integrity", "السلامة"), L("Availability", "الإتاحة")], center=L("Information", "المعلومات"))
fig("FIG-27001-RISK", "flow", ("ISMS risk: from assets to the Statement of Applicability", "مخاطر نظام أمن المعلومات: من الأصول إلى بيان قابلية التطبيق"),
    ("Assets and threats define risks; treatment decisions select controls; the SoA records every Annex A control as applied or excluded, with the reason.",
     "تحدد الأصول والتهديدات المخاطر؛ وتختار قرارات المعالجة الضوابط؛ ويسجل بيان قابلية التطبيق كل ضابط من الملحق (أ) مطبقًا أو مستثنى مع السبب."),
    ["CRS-ISO-27001-F-L02", "CRS-ISO-27001-F-L03", "CRS-ISO-27001-AUD-L02"], steps=[st("Assets", "الأصول"), st("Threats, vulnerabilities", "التهديدات ونقاط الضعف"), st("Risk", "الخطر"), st("Treatment", "المعالجة"), st("SoA", "بيان قابلية التطبيق")], highlight=4)
fig("FIG-27001-OPS", "tiles", ("Four families of operating controls", "أربع عائلات من الضوابط التشغيلية"),
    ("Annex A groups controls into four themes. An audit tests each theme in practice, not only on paper.",
     "يجمع الملحق (أ) الضوابط في أربعة محاور. ويختبر التدقيق كل محور عمليًا لا على الورق فقط."),
    ["CRS-ISO-27001-F-L04", "CRS-ISO-27001-AUD-L03", "CRS-ISO-27001-AUD-L04"], items=[{"icon": "layers", "t": L("Organisational", "تنظيمية")}, {"icon": "users", "t": L("People", "الأفراد")}, {"icon": "lock", "t": L("Physical", "مادية")}, {"icon": "cog", "t": L("Technological", "تقنية")}])

# ================================================================== PMI / PMO (Phase 8 courses)
fig("FIG-PM-PPP", "nested", ("Portfolio, programme and project", "المحفظة والبرنامج والمشروع"),
    ("Projects sit inside programmes when they share benefits; programmes and projects sit inside a portfolio chosen to meet strategy.",
     "تقع المشاريع داخل البرامج عندما تتشارك المنافع؛ وتقع البرامج والمشاريع داخل محفظة تُختار لتحقيق الاستراتيجية."),
    ["CRS-PM-101-L01", "course:CRS-PM-101", "CRS-P3O-101-L01"], rings=[st("Portfolio: chooses and balances", "المحفظة: تختار وتوازن"), st("Programme: coordinates benefits", "البرنامج: ينسق المنافع"), st("Project: delivers", "المشروع: يسلّم")])
fig("FIG-PM-GOV", "tree", ("Project governance: who decides what", "حوكمة المشروع: من يقرر ماذا"),
    ("Decisions move up when they exceed tolerances. The sponsor owns the business case; the board decides above the project manager's authority.",
     "تنتقل القرارات إلى أعلى عندما تتجاوز حدود التحمّل. ويملك الراعي دراسة الجدوى؛ ويقرر المجلس فيما يتجاوز صلاحية مدير المشروع."),
    ["CRS-PM-101-L02"], root=L("Sponsor and board", "الراعي والمجلس"),
    children=[{"t": L("Project manager", "مدير المشروع"), "children": [L("Plans, controls", "يخطط ويضبط"), L("Within tolerance", "ضمن حدود التحمّل")]}, {"t": L("Team", "الفريق"), "children": [L("Delivers outputs", "يسلّم المخرجات")]},
              {"t": L("Assurance", "الضمان"), "children": [L("Independent check", "فحص مستقل")]}])
fig("FIG-PM-LIFE", "flow", ("Life cycle with decision gates", "دورة الحياة مع بوابات القرار"),
    ("Each diamond is a gate where the sponsor confirms the project is still worth doing and authorises the next phase.",
     "كل معين بوابة يؤكد فيها الراعي أن المشروع ما زال يستحق التنفيذ ويأذن بالمرحلة التالية."),
    ["CRS-PM-101-L03", "CRS-PFM-PRIOR-L04"], gates=True, steps=[st("Concept", "الفكرة"), st("Feasibility", "الجدوى"), st("Design", "التصميم"), st("Delivery", "التنفيذ"), st("Handover", "التسليم")])
fig("FIG-PM-BEN", "flow", ("From outputs to benefits", "من المخرجات إلى المنافع"),
    ("Projects deliver outputs; benefits appear only when outputs are used. Each step has a different owner — the benefit owner sits in the business.",
     "تسلّم المشاريع مخرجات؛ ولا تظهر المنافع إلا عند استخدامها. ولكل خطوة مالك مختلف — ومالك المنفعة في الأعمال."),
    ["CRS-PM-101-L04", "CRS-P3O-101-L04"], steps=[st("Output", "المُخرَج"), st("Capability", "القدرة"), st("Outcome", "النتيجة"), st("Benefit", "المنفعة"), st("Strategic objective", "الهدف الاستراتيجي")], highlight=3)
fig("FIG-PM-WBS", "tree", ("A deliverable-oriented work breakdown structure", "هيكل تجزئة عمل موجه بالمخرجات"),
    ("Decompose by deliverables, not by departments; the children of each box add up to 100% of their parent. Work packages at the bottom are owned and estimable.",
     "جزّئ حسب المخرجات لا حسب الإدارات؛ ومجموع أبناء كل مربع يساوي 100% من أصله. وحزم العمل في الأسفل مملوكة وقابلة للتقدير."),
    ["CRS-PM-SSC-L01", "course:CRS-PM-SSC"], root=L("Solar plant 50 MW", "محطة شمسية 50 ميجاواط"),
    children=[{"t": L("Civil works", "الأعمال المدنية"), "children": [L("Site prep", "تجهيز الموقع"), L("Foundations", "الأساسات")]}, {"t": L("PV field", "الحقل الشمسي"), "children": [L("Structures", "الهياكل"), L("Modules", "الألواح")]},
              {"t": L("Electrical", "الكهربائية"), "children": [L("Inverters", "العاكسات"), L("Substation", "المحطة الفرعية")]}, {"t": L("Commissioning", "التشغيل"), "children": [L("Tests", "الاختبارات")]}])
fig("FIG-PM-CPM", "flow", ("The critical path is the longest chain", "المسار الحرج هو أطول سلسلة"),
    ("Tags show durations in days. The highlighted chain has no float: any delay on it moves the finish date." + ILL[0],
     "تُظهر الوسوم المدد بالأيام. والسلسلة المميزة بلا فائض: أي تأخير عليها يحرك موعد الانتهاء." + ILL[1]),
    ["CRS-PM-SSC-L02"], steps=[st("Design", "التصميم", tag=("20 d", "20 يومًا")), st("Procure", "التوريد", tag=("45 d", "45 يومًا")), st("Install", "التركيب", tag=("30 d", "30 يومًا")), st("Test", "الاختبار", tag=("10 d", "10 أيام"))], highlight=1,
    sub=L("Critical path: 105 days", "المسار الحرج: 105 أيام"))
fig("FIG-PM-RES", "ladder", ("Building a budget with reserves", "بناء الميزانية مع الاحتياطيات"),
    ("Read from the bottom: estimates add up to the base; contingency covers identified risks; management reserve covers the unknown and is released by the sponsor.",
     "اقرأ من الأسفل: تتجمع التقديرات في الأساس؛ ويغطي الاحتياطي الطارئ المخاطر المحددة؛ ويغطي احتياطي الإدارة المجهول ويُفرج عنه الراعي."),
    ["CRS-PM-SSC-L03"], levels=[st("Work-package estimates", "تقديرات حزم العمل"), st("Cost baseline", "خط أساس التكلفة"), st("+ Contingency reserve", "+ الاحتياطي الطارئ"), st("+ Management reserve", "+ احتياطي الإدارة"), st("Project budget", "ميزانية المشروع")], highlight=4)
fig("FIG-PM-EVM", "scurve", ("Earned value: planned, earned and actual", "القيمة المكتسبة: المخطط والمكتسب والفعلي"),
    ("At the status date, EV below PV means behind schedule; AC above EV means over cost. The gaps are the schedule and cost variances." + ILL[0],
     "عند تاريخ الحالة، EV دون PV يعني تأخرًا عن الجدول؛ وAC فوق EV يعني تجاوزًا للتكلفة. والفجوات هي فروق الجدول والتكلفة." + ILL[1]),
    ["CRS-PM-SSC-L04", "course:CRS-PM-SSC"], series=[{"t": L("PV", "PV"), "values": [0, 5, 12, 22, 35, 50, 64, 76, 86, 94, 100]}, {"t": L("EV", "EV"), "values": [0, 4, 10, 18, 28, 40]}, {"t": L("AC", "AC"), "values": [0, 5, 12, 21, 33, 47]}],
    now=5, nowLabel=L("Status date", "تاريخ الحالة"), yLabel=L("Value", "القيمة"), xLabel=L("Time", "الزمن"))
fig("FIG-PM-RISKST", "flow", ("Writing a risk: cause, event, effect", "كتابة الخطر: سبب، حدث، أثر"),
    ("A good risk statement has all three parts. The cause is a fact today; the event is uncertain; the effect is on an objective.",
     "لعبارة الخطر الجيدة الأجزاء الثلاثة. السبب حقيقة اليوم؛ والحدث غير مؤكد؛ والأثر على هدف."),
    ["CRS-PM-RISK-L01", "course:CRS-PM-RISK"], steps=[st("Cause", "السبب", ("Single supplier", "مورد واحد")), st("Event", "الحدث", ("May deliver late", "قد يتأخر في التوريد")), st("Effect", "الأثر", ("Energisation slips", "تأخر التشغيل"))], highlight=1)
fig("FIG-PM-RREV", "cycle", ("Risk reviews that change decisions", "مراجعات المخاطر التي تغير القرارات"),
    ("A review is useful only if something changes: a response, an owner, a reserve or a decision. Otherwise it is a reading of the register.",
     "لا تفيد المراجعة إلا إذا تغير شيء: استجابة أو مالك أو احتياطي أو قرار. وإلا فهي قراءة للسجل."),
    ["CRS-PM-RISK-L04"], center=L("Risk register", "سجل المخاطر"), steps=[st("Identify", "التحديد"), st("Assess", "التقييم"), st("Respond", "الاستجابة"), st("Monitor", "المتابعة")])
fig("FIG-PM-ENGAGE", "spectrum", ("Stakeholder engagement levels", "مستويات إشراك أصحاب المصلحة"),
    ("Mark where each stakeholder is now and where the project needs them; the gap drives the engagement plan.",
     "حدد موضع كل صاحب مصلحة الآن وأين يحتاجه المشروع؛ والفجوة تقود خطة الإشراك."),
    ["CRS-PM-STAKE-L02", "CRS-PM-STAKE-L04"], **{"from": L("Unaware", "غير مدرك"), "to": L("Leading", "قائد")},
    marks=[st("Resistant", "مقاوم"), st("Neutral", "محايد"), st("Supportive", "داعم"), st("Leading", "قائد")])
fig("FIG-PM-RACI", "table", ("A RACI matrix", "مصفوفة RACI"),
    ("One A per row: one person is accountable for each deliverable. R does the work, C is consulted before, I is informed after.",
     "حرف A واحد لكل صف: شخص واحد مساءل عن كل مُخرَج. ويؤدي R العمل، ويُستشار C قبله، ويُبلَّغ I بعده."),
    ["CRS-PM-STAKE-L03", "CRS-PMO-DESIGN-L03"], cols=[L("Sponsor", "الراعي"), L("PM", "مدير المشروع"), L("Engineer", "المهندس"), L("PMO", "المكتب")],
    rows=[{"t": L("Charter", "الميثاق"), "cells": [L("A", "A"), L("R", "R"), L("C", "C"), L("I", "I")]}, {"t": L("Schedule", "الجدول"), "cells": [L("I", "I"), L("A", "A"), L("R", "R"), L("C", "C")]},
          {"t": L("Status report", "تقرير الحالة"), "cells": [L("I", "I"), L("A", "A"), None, L("R", "R")]}])
fig("FIG-PMO-TYPES", "spectrum", ("PMO types from supportive to directive", "أنواع مكاتب المشاريع من الداعم إلى التوجيهي"),
    ("Moving right, the PMO's control over projects grows. Choose the point that solves your organisation's problems, not the one others use.",
     "كلما اتجهت يمينًا زادت سيطرة المكتب على المشاريع. واختر النقطة التي تحل مشكلات منظمتك، لا التي يستخدمها الآخرون."),
    ["CRS-PMO-DESIGN-L01", "course:CRS-PMO-DESIGN"], **{"from": L("Low control", "سيطرة منخفضة"), "to": L("High control", "سيطرة عالية")},
    marks=[st("Supportive", "داعم", ("Templates, advice", "نماذج ونصح")), st("Controlling", "ضابط", ("Standards, reviews", "معايير ومراجعات")), st("Directive", "توجيهي", ("Manages projects", "يدير المشاريع"))])
fig("FIG-PMO-CHARTER", "flow", ("From problems to a PMO charter", "من المشكلات إلى ميثاق مكتب المشاريع"),
    ("The charter starts from the problems the sponsor wants solved; services and measures follow from them.",
     "يبدأ الميثاق من المشكلات التي يريد الراعي حلها؛ وتُشتق الخدمات والمقاييس منها."),
    ["CRS-PMO-DESIGN-L02", "CRS-PMO-DESIGN-L04"], steps=[st("Problems", "المشكلات"), st("Mandate", "التفويض"), st("Services", "الخدمات"), st("Measures", "المقاييس"), st("Sponsor sign-off", "توقيع الراعي")])
fig("FIG-P3O-HUB", "hub", ("Hub-and-spoke office model", "نموذج المكتب المحوري"),
    ("A central portfolio office (hub) sets standards; programme and project offices (spokes) serve delivery close to the work.",
     "يضع مكتب المحفظة المركزي (المحور) المعايير؛ وتخدم مكاتب البرامج والمشاريع (الأشعة) التسليم قريبًا من العمل."),
    ["CRS-P3O-101-L02", "CRS-P3O-101-L03", "guide:p3o", "course:CRS-P3O-101"], center=L("Portfolio office", "مكتب المحفظة"),
    spokes=[L("Programme office A", "مكتب البرنامج أ"), L("Programme office B", "مكتب البرنامج ب"), L("Project office", "مكتب مشروع"), L("Centre of excellence", "مركز التميز"), L("Business unit office", "مكتب وحدة أعمال")])
fig("FIG-PMO-MAT", "ladder", ("Five maturity levels", "مستويات النضج الخمسة"),
    ("Each level builds on the one below. Plan one level up at a time, backed by evidence that the current level is really in place.",
     "يبني كل مستوى على الذي تحته. وخطط لرفع مستوى واحد في كل مرة، مدعومًا بأدلة على أن المستوى الحالي قائم فعلًا."),
    ["CRS-PMO-KPI-L01", "CRS-PMO-KPI-L04", "guide:p3m3", "course:CRS-PMO-KPI"],
    levels=[st("Awareness", "الإدراك"), st("Repeatable", "قابل للتكرار"), st("Defined", "محدد"), st("Managed", "مُدار"), st("Optimised", "محسَّن")], highlight=2)
fig("FIG-PMO-KPI", "matrix", ("PMO value matrix: effort and value of each service", "مصفوفة قيمة المكتب: الجهد والقيمة لكل خدمة"),
    ("Place each PMO service by the value customers see and the effort it takes. Grow the top-left, fix or stop the bottom-right.",
     "ضع كل خدمة من خدمات المكتب حسب القيمة التي يراها العملاء والجهد الذي تتطلبه. نمِّ الأعلى يسارًا، وأصلح الأسفل يمينًا أو أوقفه."),
    ["CRS-PMO-KPI-L02", "CRS-PMO-KPI-L03"], rows=2, cols=2, cells=[[L("Quick wins", "مكاسب سريعة"), L("Invest", "استثمر")], [L("Simplify", "بسّط"), L("Stop or redesign", "أوقف أو أعد التصميم")]],
    highlight=[[0, 0]], yLabel=L("Value", "القيمة"), xLabel=L("Effort", "الجهد"))
fig("FIG-PFM-FUN", "funnel", ("The portfolio funnel", "قمع المحفظة"),
    ("Many ideas enter; criteria and gates let fewer through. Stopping an initiative at a gate is the portfolio working, not failing.",
     "تدخل أفكار كثيرة؛ وتسمح المعايير والبوابات بمرور أقل. وإيقاف مبادرة عند بوابة يعني أن المحفظة تعمل لا أنها تفشل."),
    ["CRS-PFM-PRIOR-L01", "course:CRS-PFM-PRIOR"], stages=[L("Ideas", "الأفكار"), L("Screened", "المفحوصة"), L("Business cases", "دراسات الجدوى"), L("Approved", "المعتمدة"), L("In delivery", "قيد التنفيذ")])
fig("FIG-PFM-SCORE", "bars", ("Weighted scoring of candidate initiatives", "التقييم الموزون للمبادرات المرشحة"),
    ("Each bar is a weighted score from criteria agreed before scoring. Use the ranking to start the discussion about capacity and dependencies, not to end it." + ILL[0],
     "كل عمود درجة موزونة من معايير متفق عليها قبل التقييم. واستخدم الترتيب لبدء النقاش حول الطاقة والاعتماديات لا لإنهائه." + ILL[1]),
    ["CRS-PFM-PRIOR-L02", "CRS-PFM-PRIOR-L03"], bars=[{"t": L("Grid automation", "أتمتة الشبكة"), "v": 82}, {"t": L("ERP upgrade", "ترقية ERP"), "v": 64}, {"t": L("New depot", "مستودع جديد"), "v": 58},
                                                      {"t": L("Training academy", "أكاديمية تدريب"), "v": 71}, {"t": L("Fleet renewal", "تجديد الأسطول"), "v": 45}], highlight=0, yLabel=L("Score", "الدرجة"), xLabel=L("Candidate initiatives", "المبادرات المرشحة"))
fig("FIG-AGL-APPROACH", "spectrum", ("Choosing the delivery approach", "اختيار نهج التسليم"),
    ("Move right as requirements become less certain and feedback becomes more valuable. Many projects sit in the middle, mixing both.",
     "اتجه يمينًا كلما قلّ يقين المتطلبات وزادت قيمة التغذية الراجعة. وتقع مشاريع كثيرة في الوسط، تمزج بين الاثنين."),
    ["CRS-PM-AGILE-L01", "CRS-PM-AGILE-L03", "course:CRS-PM-AGILE"], **{"from": L("Stable requirements", "متطلبات مستقرة"), "to": L("Uncertain requirements", "متطلبات غير مؤكدة")},
    marks=[st("Predictive", "تنبؤي", ("Plan, then build", "خطط ثم ابنِ")), st("Hybrid", "هجين", ("Mix by component", "امزج حسب المكوّن")), st("Agile", "رشيق", ("Short iterations", "دورات قصيرة"))])
fig("FIG-AGL-SCRUM", "cycle", ("A Scrum sprint", "دورة Scrum"),
    ("Each sprint is short and fixed in length. The review inspects the product with stakeholders; the retrospective inspects how the team works.",
     "كل دورة قصيرة وثابتة الطول. وتفحص المراجعة المنتج مع أصحاب المصلحة؛ ويفحص الاستعراض طريقة عمل الفريق."),
    ["CRS-PM-AGILE-L02"], center=L("Sprint", "الدورة"), steps=[st("Planning", "التخطيط"), st("Daily scrum", "الاجتماع اليومي"), st("Review", "المراجعة"), st("Retrospective", "الاستعراض")])
fig("FIG-AGL-KANBAN", "kanban", ("A Kanban board with work-in-progress limits", "لوحة كانبان بحدود العمل الجاري"),
    ("Cards flow left to right. WIP limits stop a column from filling up; when a column is full, help finish work rather than start new work.",
     "تتدفق البطاقات من اليسار إلى اليمين. وتمنع حدود العمل الجاري امتلاء العمود؛ وعند امتلائه، ساعد على إنهاء العمل بدل بدء عمل جديد."),
    ["CRS-PM-AGILE-L02", "CRS-PM-AGILE-L04"], cols=[{"t": L("To do", "للتنفيذ"), "cards": 4}, {"t": L("Doing", "قيد التنفيذ"), "wip": L("WIP ≤ 3", "الحد ≤ 3"), "cards": 3, "hot": True},
                                                  {"t": L("Review", "المراجعة"), "wip": L("WIP ≤ 2", "الحد ≤ 2"), "cards": 2}, {"t": L("Done", "منجز"), "cards": 5}])
fig("FIG-PMP-DOM", "bars", ("PMP® exam domains (July 2026 outline)", "مجالات اختبار PMP® (مخطط يوليو 2026)"),
    ("Bars show the share of the exam per domain as published by PMI (verified 3 November 2026). Business Environment now carries far more weight than before.",
     "تُظهر الأعمدة حصة كل مجال من الاختبار كما نشرتها PMI (تم التحقق في 3 نوفمبر 2026). ويحمل مجال بيئة الأعمال الآن وزنًا أكبر بكثير من قبل."),
    ["CRS-PMP-PREP-L01", "course:CRS-PMP-PREP"], bars=[{"t": L("People", "الأفراد"), "v": 33, "vLabel": L("33%", "33%")}, {"t": L("Process", "العمليات"), "v": 41, "vLabel": L("41%", "41%")}, {"t": L("Business Environment", "بيئة الأعمال"), "v": 26, "vLabel": L("26%", "26%")}],
    highlight=1, yLabel=L("Weight", "الوزن"), xLabel=L("Domain", "المجال"))
fig("FIG-PMP-PLAN", "flow", ("A study plan that works", "خطة مذاكرة ناجحة"),
    ("Diagnose first, study by weight and weakness, practise, then rehearse under exam conditions — and book when results are stable.",
     "شخّص أولًا، وذاكر حسب الوزن والضعف، وتدرّب، ثم أجرِ بروفة في ظروف الاختبار — واحجز عند استقرار النتائج."),
    ["CRS-PMP-PREP-L03", "CRS-PMP-PREP-L02"], steps=[st("Diagnose", "شخّص"), st("Study by weight", "ذاكر حسب الوزن"), st("Practise daily", "تدرّب يوميًا"), st("Timed mixed sets", "مجموعات موقوتة مختلطة"), st("Rehearse", "بروفة")], highlight=0)
fig("FIG-PMP-REASON", "flow", ("Reasoning through a scenario question", "التفكير في سؤال السيناريو"),
    ("Work down the steps for every scenario item. Most wrong answers skip step 2 — they solve a symptom, not the real problem.",
     "اعمل بالخطوات نزولًا لكل سؤال سيناريو. ومعظم الإجابات الخاطئة تتجاوز الخطوة 2 — فتحل عَرَضًا لا المشكلة الحقيقية."),
    ["CRS-PMP-PREP-L04"], dir="v", steps=[st("Who am I in this scenario?", "من أنا في هذا السيناريو؟", tag=("1", "1")), st("What is the real problem?", "ما المشكلة الحقيقية؟", tag=("2", "2")), st("What does the approach (predictive / agile) imply?", "ماذا يقتضي النهج (تنبؤي / رشيق)؟", tag=("3", "3")),
                                       st("Which option acts first and within my authority?", "أي خيار يتصرف أولًا وضمن صلاحيتي؟", tag=("4", "4")), st("Check it against the others", "قارنه بالخيارات الأخرى", tag=("5", "5"))], highlight=1)
