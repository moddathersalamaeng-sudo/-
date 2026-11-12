"""Phase 11 explanatory figures (governed data, owner_phase 11) — one per lab, rendered by src/ui/figures.js templates.
Placement key "lab:<slug>" (as Phase 10's "lab:efqm"). Original CIA diagrams; numbers are the lab scenario's own. Author: مدثر سلامه."""
from lib11 import T


def s(en, ar, den=None, dar=None):
    x = {"t": T(en, ar)}
    if den:
        x["d"] = T(den, dar)
    return x


FIGS = [
    {"id": "FIG-LAB-AUDITTRAIL", "template": "flow", "caption": T("Following an audit trail", "تتبّع مسار التدقيق"),
     "read": T("Start from what you see and follow it to what it affects: confirm the status in records, check whether it was used, find the extent, then compare with the criteria before writing anything.",
               "ابدأ مما تراه وتتبّعه إلى ما يؤثر فيه: أكّد الحالة من السجلات، وتحقق هل استُخدم، وحدّد المدى، ثم قارن بالمعايير قبل أن تكتب شيئًا."),
     "steps": [s("Observe", "الملاحظة"), s("Confirm status", "تأكيد الحالة"), s("Check use", "التحقق من الاستخدام"), s("Find extent", "تحديد المدى"), s("Compare with criteria", "المقارنة بالمعايير")], "highlight": 3},
    {"id": "FIG-LAB-NCPARTS", "template": "ladder", "caption": T("The three parts of a nonconformity", "الأجزاء الثلاثة لعدم المطابقة"),
     "read": T("A finding the auditee can act on rests on the requirement, is proved by objective evidence and ends in a clear statement of the gap.",
               "الملاحظة التي يستطيع المُدقَّق عليه التصرف بناءً عليها ترتكز على المتطلب، ويثبتها الدليل الموضوعي، وتنتهي ببيان واضح للفجوة."),
     "levels": [s("Statement of the gap", "بيان الفجوة", "What is missing", "ما الناقص"), s("Objective evidence", "الدليل الموضوعي", "Where, when, how many", "أين ومتى وكم"),
                s("Requirement", "المتطلب", "What should be", "ما ينبغي أن يكون")], "highlight": 1},
    {"id": "FIG-LAB-EVLADDER", "template": "ladder", "caption": T("How much can you trust a piece of evidence?", "إلى أي حد تثق بالدليل؟"),
     "read": T("Evidence grows stronger as you climb: a statement is a lead, a document shows intent, a record shows it happened, and corroboration from another source confirms it.",
               "يقوى الدليل كلما صعدت: الإفادة دليل مبدئي، والوثيقة تُظهر النية، والسجل يُظهر أنه حدث، والتعزيز من مصدر آخر يؤكده."),
     "levels": [s("Corroborated", "مُعزَّز", "Two sources agree", "مصدران يتفقان"), s("Record", "سجل", "It happened", "حدث فعلًا"),
                s("Document", "وثيقة", "It is planned", "مخطط له"), s("Statement", "إفادة", "Someone says so", "أحدهم يقول ذلك")], "highlight": 0},
    {"id": "FIG-LAB-RISKMATRIX", "template": "matrix", "caption": T("How risk bands rise across a matrix (simplified 3 × 3 view)", "كيف ترتفع نطاقات الخطر عبر المصفوفة (عرض مبسّط 3 × 3)"),
     "read": T("Likelihood rises up the side and consequence along the bottom; the score is their product. The lab uses a full 5 × 5 scale whose bands run from Low (1–4) through Medium (5–9) and High (10–16) to Very high (17–25); this view groups it into three steps each way.",
               "يرتفع الاحتمال على الجانب وتزداد العاقبة على القاعدة؛ والدرجة حاصل ضربهما. ويستخدم المختبر مقياسًا كاملًا 5 × 5 تتدرج نطاقاته من منخفض (1–4) إلى متوسط (5–9) ومرتفع (10–16) ثم مرتفع جدًا (17–25)؛ وهذا العرض يجمعه في ثلاث درجات لكل اتجاه."),
     "rows": 3, "cols": 3,
     "cells": [[T("Medium", "متوسط"), T("High", "مرتفع"), T("Very high", "مرتفع جدًا")], [T("Low", "منخفض"), T("Medium", "متوسط"), T("High", "مرتفع")], [T("Low", "منخفض"), T("Low", "منخفض"), T("Medium", "متوسط")]],
     "highlight": [[0, 1], [1, 2]], "yLabel": T("Likelihood ↑", "الاحتمال ↑"), "xLabel": T("Consequence →", "العاقبة ←")},
    {"id": "FIG-LAB-CAPAFLOW", "template": "flow", "caption": T("From complaint to closed CAPA", "من الشكوى إلى إغلاق الإجراء التصحيحي"),
     "read": T("React first, then find and verify the cause, act on it (and on similar cases), and close only when the effectiveness check shows the problem has gone.",
               "تفاعل أولًا، ثم حدّد السبب وتحقق منه، وعالجه (وعالج الحالات المماثلة)، ولا تُغلق إلا عندما يُظهر فحص الفعالية أن المشكلة زالت."),
     "steps": [s("Contain", "الاحتواء"), s("Find cause", "تحديد السبب"), s("Verify cause", "التحقق من السبب"), s("Act", "التنفيذ"), s("Check effect", "فحص الفعالية")], "highlight": 4},
    {"id": "FIG-LAB-WHYCHAIN", "template": "ladder", "caption": T("The 5 Whys chain on bottling line 2", "سلسلة «لماذا الخمس» على خط التعبئة 2"),
     "read": T("Read from the bottom: the symptom leads to a direct cause, which leads to the method and finally to the system cause — the one to remove.",
               "اقرأ من الأسفل: يقود العَرَض إلى سبب مباشر، فإلى الأسلوب، وأخيرًا إلى السبب النظامي — وهو ما يجب إزالته."),
     "levels": [s("Change not controlled", "تغيير غير مضبوط", "Root cause", "السبب الجذري"), s("Checklist out of date", "قائمة قديمة", "Why?", "لماذا؟"),
                s("4-hour cleaning", "تنظيف كل 4 ساعات", "Why?", "لماذا؟"), s("Clogged nozzles", "فوهات مسدودة", "Why?", "لماذا؟"), s("Underfilled bottles", "زجاجات ناقصة", "Symptom", "العَرَض")], "highlight": 0},
    {"id": "FIG-LAB-FMEARPN", "template": "bars", "caption": T("RPN before and after action (illustrative lab figures)", "رقم الأولوية قبل الإجراء وبعده (أرقام توضيحية من المختبر)"),
     "read": T("Illustrative lab figures. FM1 falls from 240 to 80 after crimp-force monitoring. FM2 has a low RPN of 54 but a severity of 9, so it is acted on anyway.",
               "أرقام توضيحية من المختبر. ينخفض FM1 من 240 إلى 80 بعد مراقبة قوة الكبس. ولـ FM2 رقم أولوية منخفض 54 لكن خطورته 9، فيُتصرَّف فيه على أي حال."),
     "bars": [{"t": T("FM1 before", "FM1 قبل"), "v": 240, "vLabel": T("240", "240")}, {"t": T("FM1 after", "FM1 بعد"), "v": 80, "vLabel": T("80", "80")},
              {"t": T("FM2 (S 9)", "FM2 (S 9)"), "v": 54, "vLabel": T("54", "54")}], "highlight": 2, "yLabel": T("RPN", "رقم الأولوية"), "xLabel": T("Failure modes", "أنماط الفشل")},
    {"id": "FIG-LAB-EMV", "template": "bars", "caption": T("Expected monetary value of three risks (lab figures, SAR)", "القيمة النقدية المتوقعة لثلاثة مخاطر (أرقام المختبر، بالريال)"),
     "read": T("Illustrative lab figures. Steel delay 60,000 and server room 20,000 add cost; the furniture discount saves 20,000. The contingency reserve for these identified risks is 60,000.",
               "أرقام توضيحية من المختبر. تأخر الحديد 60,000 وغرفة الخوادم 20,000 يضيفان تكلفة؛ وخصم الأثاث يوفر 20,000. واحتياطي الطوارئ لهذه المخاطر المحددة 60,000."),
     "bars": [{"t": T("Steel delay", "تأخر الحديد"), "v": 60, "vLabel": T("60k", "60 ألفًا")}, {"t": T("Server room", "غرفة الخوادم"), "v": 20, "vLabel": T("20k", "20 ألفًا")},
              {"t": T("Discount", "الخصم"), "v": 20, "vLabel": T("−20k", "−20 ألفًا")}, {"t": T("Reserve", "الاحتياطي"), "v": 60, "vLabel": T("60k", "60 ألفًا")}],
     "highlight": 3, "yLabel": T("SAR thousand", "ألف ريال"), "xLabel": T("Risk", "الخطر")},
    {"id": "FIG-LAB-AUDPLAN", "template": "flow", "caption": T("A risk-based audit day", "يوم تدقيق مبني على المخاطر"),
     "read": T("Open, audit the highest-risk process first, cover the rest and the second shift, then close with findings.", "افتتح، ودقق العملية الأعلى خطرًا أولًا، ثم غطِّ البقية والمناوبة الثانية، واختتم بالملاحظات."),
     "steps": [s("Opening", "الافتتاح"), s("Highest risk", "الخطر الأعلى"), s("Other processes", "العمليات الأخرى"), s("Second shift", "المناوبة الثانية"), s("Closing", "الختام")], "highlight": 1},
    {"id": "FIG-LAB-SUPPLIER", "template": "flow", "caption": T("How a requirement reaches the supplier's machine", "كيف يصل المتطلب إلى آلة المورّد"),
     "read": T("A requirement travels from the specification to the purchase order, the supplier's documents and finally the operator. A break anywhere shows up as defects.",
               "ينتقل المتطلب من المواصفة إلى أمر الشراء، فوثائق المورّد، وأخيرًا إلى المشغل. وأي انقطاع في أي موضع يظهر عيوبًا."),
     "steps": [s("Specification", "المواصفة"), s("Purchase order", "أمر الشراء"), s("Supplier documents", "وثائق المورّد"), s("Operator", "المشغل")], "highlight": 2},
    {"id": "FIG-LAB-MREVIEW", "template": "flow", "caption": T("Management review: from inputs to decisions", "مراجعة الإدارة: من المُدخلات إلى القرارات"),
     "read": T("Good inputs lead to analysis and then to decisions with owners, dates and resources — the record that matters.", "تقود المُدخلات الجيدة إلى التحليل ثم إلى قرارات بمالكين ومواعيد وموارد — وهذا هو السجل المهم."),
     "steps": [s("Inputs", "المُدخلات"), s("Analysis", "التحليل"), s("Decisions", "القرارات"), s("Owners and dates", "المالكون والمواعيد")], "highlight": 2},
    {"id": "FIG-LAB-PMOTYPES", "template": "ladder", "caption": T("PMO roles from support to direction", "أدوار مكتب إدارة المشاريع من الدعم إلى التوجيه"),
     "read": T("PMOs range from supportive (templates, advice) through controlling (standards, reporting) to directive (managing projects). Start where the problems are.",
               "تتدرج مكاتب إدارة المشاريع من الداعم (قوالب، مشورة) إلى الرقابي (معايير، تقارير) إلى التوجيهي (إدارة المشاريع). ابدأ حيث المشكلات."),
     "levels": [s("Directive", "توجيهي", "Runs projects", "يدير المشاريع"), s("Controlling", "رقابي", "Standards, reporting", "معايير وتقارير"), s("Supportive", "داعم", "Templates, advice", "قوالب ومشورة")], "highlight": 1},
    {"id": "FIG-LAB-KPICARD", "template": "tiles", "caption": T("What a KPI card needs", "ما تحتاجه بطاقة المؤشر"),
     "read": T("A KPI people can trust has a definition, a formula, a data source, a baseline, a target and an owner.", "المؤشر الذي يثق به الناس له تعريف، ومعادلة، ومصدر بيانات، وخط أساس، ومستهدف، ومالك."),
     "items": [{"icon": "book", "t": T("Definition", "التعريف")}, {"icon": "sigma", "t": T("Formula", "المعادلة")}, {"icon": "layers", "t": T("Data source", "مصدر البيانات")},
               {"icon": "flag", "t": T("Baseline", "خط الأساس")}, {"icon": "target", "t": T("Target", "المستهدف")}, {"icon": "user", "t": T("Owner", "المالك")}]},
]

PLACEMENT = {
    "lab:audit-simulator": ["FIG-LAB-AUDITTRAIL"], "lab:nonconformity-writing": ["FIG-LAB-NCPARTS"], "lab:evidence-review": ["FIG-LAB-EVLADDER"],
    "lab:risk-assessment": ["FIG-LAB-RISKMATRIX"], "lab:capa": ["FIG-LAB-CAPAFLOW"], "lab:root-cause-analysis": ["FIG-LAB-WHYCHAIN"], "lab:fmea": ["FIG-LAB-FMEARPN"],
    "lab:project-risk": ["FIG-LAB-EMV"], "lab:audit-planning": ["FIG-LAB-AUDPLAN"], "lab:supplier-audit": ["FIG-LAB-SUPPLIER"], "lab:management-review": ["FIG-LAB-MREVIEW"],
    "lab:pmo-design": ["FIG-LAB-PMOTYPES"], "lab:kpi-builder": ["FIG-LAB-KPICARD"],
}
