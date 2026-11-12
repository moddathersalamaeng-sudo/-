"""Phase 11 — governed draft labs (spec §19 labs 4, 9, 10, 12, 13): Audit Planning, Supplier Audit, Management Review,
PMO Design and KPI Builder. Complete and valid, but kept as drafts (`draft: true`, needs_review) for a later decision; reviewers
see them in preview. Original CIA scenarios. Author: مدثر سلامه."""
from lib11 import T, single, multi, order, classify, numeric, written, lab

PLAN = lab(
    "LAB-AUDIT-PLAN", "audit-planning", "iso", "builder", "AUD-PLAN",
    T("Audit Planning Lab", "مختبر تخطيط التدقيق"),
    T("Build a risk-based internal audit plan for one site: set objectives, scope and criteria, decide where to spend audit time, and sequence the day.",
      "ابنِ خطة تدقيق داخلي مبنية على المخاطر لموقع واحد: حدّد الأهداف والنطاق والمعايير، وقرّر أين تقضي وقت التدقيق، ورتّب اليوم."),
    25, 2, ["AUD-01"],
    {"title": T("One-day QMS audit of a spare-parts warehouse", "تدقيق ليوم واحد لنظام إدارة الجودة في مستودع قطع غيار"),
     "context": [T("The warehouse had two customer complaints about wrong parts and a new WMS went live last month. Receiving, storage, picking and dispatch run on two shifts.",
                   "تلقى المستودع شكويين من العملاء بشأن قطع خاطئة، وبدأ تشغيل نظام جديد لإدارة المستودع الشهر الماضي. وتعمل الاستلام والتخزين والتجهيز والإرسال على مناوبتين.")],
     "facts": [], "exhibits": []},
    [
        multi("T1", "AUD-01", T("Which belong in the audit plan? Choose all that apply.", "ما الذي ينتمي إلى خطة التدقيق؟ اختر كل ما ينطبق."), [
            ("a", "Objectives, scope and criteria", "الأهداف والنطاق والمعايير", True, "They define what the audit is for.", "تحدد الغرض من التدقيق."),
            ("b", "Time for picking and the new WMS, where the risk is", "وقت للتجهيز وللنظام الجديد، حيث الخطر", True, "Risk-based allocation.", "توزيع مبني على المخاطر."),
            ("c", "Both shifts", "المناوبتان كلتاهما", True, "Complaints may be shift-related.", "قد ترتبط الشكاوى بالمناوبة."),
            ("d", "The findings you expect to raise", "الملاحظات التي تتوقع إصدارها", False, "Findings come from evidence, not the plan.", "تأتي الملاحظات من الدليل، لا من الخطة.")],
            T("a, b and c.", "أ وب وج."), T("A plan states purpose and spends time where risk is highest.", "تذكر الخطة الغرض وتنفق الوقت حيث الخطر أعلى.")),
        order("T2", "AUD-01", T("Sequence the audit day.", "رتّب يوم التدقيق."), [
            ("d1", "Opening meeting", "الاجتماع الافتتاحي"), ("d2", "Picking and WMS (highest risk) on the day shift", "التجهيز والنظام (الخطر الأعلى) في المناوبة النهارية"),
            ("d3", "Receiving and storage", "الاستلام والتخزين"), ("d4", "Picking on the evening shift", "التجهيز في المناوبة المسائية"), ("d5", "Closing meeting", "الاجتماع الختامي")],
            T("Open → highest risk first → other processes → second shift → close.", "الافتتاح ← الخطر الأعلى أولًا ← العمليات الأخرى ← المناوبة الثانية ← الختام."),
            T("Audit the highest risk while you are fresh and time remains to follow trails.", "دقق الخطر الأعلى وأنت في نشاطك ولديك وقت لتتبع المسارات.")),
        written("T3", "AUD-01", T("Write the audit objective and scope in two sentences.", "اكتب هدف التدقيق ونطاقه في جملتين."), [
            ("Objective linked to the complaints and the WMS change", "هدف مرتبط بالشكاوى وتغيير النظام", 1), ("Scope names processes, site and shifts", "نطاق يسمّي العمليات والموقع والمناوبات", 1)],
            T("Model: “Objective: determine whether picking and dispatch controls, including the new WMS, prevent wrong-part deliveries. Scope: receiving, storage, picking and dispatch at the main warehouse, both shifts.”",
              "نموذج: «الهدف: تحديد هل تمنع ضوابط التجهيز والإرسال، بما فيها النظام الجديد، تسليم قطع خاطئة. النطاق: الاستلام والتخزين والتجهيز والإرسال في المستودع الرئيس، بالمناوبتين.»"),
            T("Reviewed by a person before it counts.", "يراجعه شخص قبل أن يُحسب."), min_chars=60)],
    courses=["CRS-ISO-AUD", "CRS-ISO-9001-AUD"], lessons=["CRS-ISO-AUD-L02", "CRS-ISO-9001-AUD-L01"], toolkits=["aud"], templates=["TPL-AUDIT-CHECKLIST"],
    refs=[("iso-9001", "9.2.2")], figures=["FIG-LAB-AUDPLAN"], cover={"motif": "gantt", "icon": "calendar"}, draft=True)

SUPPLIER = lab(
    "LAB-SUPPLIER-AUDIT", "supplier-audit", "iso", "simulator", "SUP-AUD",
    T("Supplier Audit Simulator", "محاكي تدقيق الموردين"),
    T("Audit a packaging supplier after a run of print defects: check how requirements flow down, how the supplier controls its own process, and what follow-up to request.",
      "دقق مورّد تغليف بعد سلسلة من عيوب الطباعة: تحقق من انتقال المتطلبات، ومن ضبط المورّد لعمليته، ومن المتابعة التي تطلبها."),
    25, 2, ["QM-04", "AUD-02"],
    {"title": T("Second-party audit — carton printer", "تدقيق طرف ثانٍ — مطبعة الكراتين"),
     "context": [T("Your company rejected 6 of the last 20 lots for colour variation. The purchase order references specification SP-14, which sets colour tolerances; the supplier's press operators work from a different, older artwork file.",
                   "رفضت شركتك 6 من آخر 20 دفعة بسبب تفاوت اللون. ويشير أمر الشراء إلى المواصفة SP-14 التي تحدد تفاوتات اللون؛ ويعمل مشغلو المطبعة لدى المورّد من ملف تصميم مختلف وأقدم.")],
     "facts": [], "exhibits": []},
    [
        multi("T1", "QM-04", T("What do you check first at the supplier? Choose all that apply.", "ما الذي تتحقق منه أولًا لدى المورّد؟ اختر كل ما ينطبق."), [
            ("a", "Whether SP-14 reached the press floor", "هل وصلت SP-14 إلى قاعة المطبعة", True, "Flow-down of requirements.", "انتقال المتطلبات."),
            ("b", "How artwork versions are controlled", "كيف تُضبط إصدارات التصاميم", True, "The older file suggests a document-control gap.", "الملف الأقدم يشير إلى فجوة في ضبط الوثائق."),
            ("c", "Colour checks and their records", "فحوصات اللون وسجلاتها", True, "How the supplier detects variation.", "كيف يكشف المورّد التفاوت."),
            ("d", "The supplier's office cleaning schedule", "جدول تنظيف مكاتب المورّد", False, "Not related to the defect.", "لا علاقة له بالعيب.")],
            T("a, b and c.", "أ وب وج."), T("Follow the requirement from your purchase order to the supplier's press.", "تتبّع المتطلب من أمر الشراء إلى مطبعة المورّد.")),
        numeric("T2", "QM-04", T("6 of 20 lots were rejected. What is the lot rejection rate?", "رُفضت 6 من 20 دفعة. ما معدل رفض الدفعات؟"), 30, 0.5, T("%", "%"),
                T("6 ÷ 20 = 30 %.", "6 ÷ 20 = 30 %."), T("The rate shows the supplier's performance in a way both sides can track.", "يُظهر المعدل أداء المورّد بطريقة يستطيع الطرفان متابعتها.")),
        written("T3", "AUD-02", T("Write the supplier finding and the follow-up you request.", "اكتب ملاحظة المورّد والمتابعة التي تطلبها."), [
            ("Cites SP-14 and the purchase order", "يستشهد بالمواصفة SP-14 وأمر الشراء", 1), ("Evidence: older artwork in use, 6 of 20 lots rejected", "الدليل: تصميم أقدم قيد الاستخدام، و6 من 20 دفعة مرفوضة", 1),
            ("Requests a supplier corrective action with evidence of effectiveness", "يطلب إجراءً تصحيحيًا من المورّد مع دليل على الفعالية", 1)],
            T("Model: “The purchase order requires printing to SP-14. Press operators were using artwork file v2 (SP-14 requires v4); 6 of the last 20 lots were rejected for colour. Request: supplier corrective action within 30 days, with colour-check records for the next 5 lots.”",
              "نموذج: «يشترط أمر الشراء الطباعة وفق SP-14. وكان مشغلو المطبعة يستخدمون ملف التصميم الإصدار 2 (تشترط SP-14 الإصدار 4)؛ ورُفضت 6 من آخر 20 دفعة بسبب اللون. المطلوب: إجراء تصحيحي من المورّد خلال 30 يومًا، مع سجلات فحص اللون للدفعات الخمس التالية.»"),
            T("Reviewed by a person before it counts.", "يراجعه شخص قبل أن يُحسب."), min_chars=80)],
    courses=["CRS-Q-SUPPLIER"], lessons=["CRS-Q-SUPPLIER-L02", "CRS-Q-SUPPLIER-L04"], toolkits=["aud"], templates=["TPL-AUDIT-CHECKLIST", "TPL-CAPA"],
    refs=[("iso-9001", "8.4.2"), ("iso-9001", "8.4.3")], figures=["FIG-LAB-SUPPLIER"], cover={"motif": "chain", "icon": "truck"}, draft=True)

MREVIEW = lab(
    "LAB-MGMT-REVIEW", "management-review", "iso", "simulator", "MGT-REV",
    T("Management Review Simulator", "محاكي مراجعة الإدارة"),
    T("Prepare and run a management review: choose the inputs that matter, read the performance data, and record decisions with owners rather than a list of reports.",
      "حضّر مراجعة الإدارة ونفّذها: اختر المُدخلات المهمة، واقرأ بيانات الأداء، وسجّل القرارات بمالكيها بدل قائمة تقارير."),
    25, 2, ["PERF-02", "ISO-01"],
    {"title": T("Annual management review of a QMS", "المراجعة السنوية لنظام إدارة الجودة"),
     "context": [T("On-time delivery fell from 96 % to 89 %, complaints doubled, and two internal audit findings are still open after six months.",
                   "انخفض التسليم في الموعد من 96 % إلى 89 %، وتضاعفت الشكاوى، ولا تزال ملاحظتان من التدقيق الداخلي مفتوحتين بعد ستة أشهر.")],
     "facts": [], "exhibits": []},
    [
        multi("T1", "PERF-02", T("Which inputs must be on the agenda? Choose all that apply.", "أي المُدخلات يجب أن تكون على جدول الأعمال؟ اختر كل ما ينطبق."), [
            ("a", "Performance trends (delivery, complaints)", "اتجاهات الأداء (التسليم، الشكاوى)", True, "Core evidence of effectiveness.", "دليل أساسي على الفعالية."),
            ("b", "Status of audit findings and corrective actions", "حالة ملاحظات التدقيق والإجراءات التصحيحية", True, "Open findings need a decision.", "الملاحظات المفتوحة تحتاج قرارًا."),
            ("c", "Actions from the previous review", "إجراءات المراجعة السابقة", True, "Closes the loop.", "يُغلق الحلقة."),
            ("d", "The office party budget", "ميزانية حفل المكتب", False, "Not a QMS input.", "ليس مُدخلًا لنظام الجودة.")],
            T("a, b and c.", "أ وب وج."), T("Inputs are chosen to support decisions about the system.", "تُختار المُدخلات لدعم القرارات بشأن النظام.")),
        single("T2", "PERF-02", T("Which is a proper management review output?", "أيها مُخرَج صحيح لمراجعة الإدارة؟"), [
            ("a", "“The quality report was presented.”", "«عُرض تقرير الجودة.»", "Presentation is not a decision.", "العرض ليس قرارًا."),
            ("b", "“Approve a second dispatch shift to restore on-time delivery to 95 % by Q3 — owner: operations director.”", "«اعتماد مناوبة إرسال ثانية لإعادة التسليم في الموعد إلى 95 % بحلول الربع الثالث — المالك: مدير العمليات.»",
             "A decision with a target, resources and an owner.", "قرار بمستهدف وموارد ومالك."),
            ("c", "“Everyone should try harder.”", "«على الجميع بذل جهد أكبر.»", "No owner, no action.", "بلا مالك ولا إجراء."),
            ("d", "“Complaints were noted.”", "«أُحيط علمًا بالشكاوى.»", "Noting is not deciding.", "الإحاطة ليست قرارًا.")],
            "b", T("Option b.", "الخيار ب."), T("Outputs are decisions and actions on improvement, changes and resources.", "المُخرجات قرارات وإجراءات بشأن التحسين والتغييرات والموارد.")),
        written("T3", "PERF-02", T("Write two decisions for the minutes, each with an owner and a date.", "اكتب قرارين للمحضر، لكلٍّ منهما مالك وموعد."), [
            ("Decisions respond to the data in the scenario", "القرارات تستجيب لبيانات السيناريو", 1), ("Each has an owner, a date and a measurable target", "لكل قرار مالك وموعد ومستهدف قابل للقياس", 1)],
            T("Model: “1. Escalate the two overdue audit findings; close by 31 July (quality manager). 2. Fund a complaint-analysis project to halve complaints by year end (customer service lead).”",
              "نموذج: «1. تصعيد ملاحظتي التدقيق المتأخرتين وإغلاقهما بحلول 31 يوليو (مدير الجودة). 2. تمويل مشروع لتحليل الشكاوى لخفضها إلى النصف بنهاية العام (قائد خدمة العملاء).»"),
            T("Reviewed by a person before it counts.", "يراجعه شخص قبل أن يُحسب."), min_chars=80)],
    courses=["CRS-ISO-9001-AUD"], lessons=[], toolkits=["iso9001", "str"], templates=["TPL-QUALITY-PLAN"],
    refs=[("iso-9001", "9.3.2"), ("iso-9001", "9.3.3")], figures=["FIG-LAB-MREVIEW"], cover={"motif": "steps", "icon": "users"}, draft=True)

PMO = lab(
    "LAB-PMO-DESIGN", "pmo-design", "pmi", "builder", "PMO-DES",
    T("PMO Design Lab", "مختبر تصميم مكتب إدارة المشاريع"),
    T("Design a first PMO for a growing engineering firm: match the PMO type to the problems, choose services worth offering first, and define how its value will be measured.",
      "صمّم أول مكتب لإدارة المشاريع لشركة هندسية نامية: طابِق نوع المكتب مع المشكلات، واختر الخدمات الأجدر بالبدء، وحدّد كيف تُقاس قيمته."),
    25, 2, ["PMO-01", "PMO-02"],
    {"title": T("An engineering firm with 35 concurrent projects", "شركة هندسية لديها 35 مشروعًا متزامنًا"),
     "context": [T("Executives cannot see which projects are late; each project manager reports differently; two projects overran by 40 %.",
                   "لا يستطيع التنفيذيون معرفة المشاريع المتأخرة؛ ويقدّم كل مدير مشروع تقاريره بطريقة مختلفة؛ وتجاوز مشروعان التكلفة بنسبة 40 %.")],
     "facts": [], "exhibits": []},
    [
        single("T1", "PMO-01", T("Which PMO role fits first?", "أي دور لمكتب إدارة المشاريع يناسب أولًا؟"), [
            ("a", "Directive — the PMO runs every project", "توجيهي — يدير المكتب كل مشروع", "Too big a change without the basics.", "تغيير كبير جدًا دون الأساسيات."),
            ("b", "Supportive-to-controlling — common reporting, templates and a portfolio view", "داعم إلى رقابي — تقارير موحّدة وقوالب ورؤية للمحفظة", "Fits the visibility problem.", "يناسب مشكلة الرؤية."),
            ("c", "No PMO — let each manager decide", "لا مكتب — يقرر كل مدير", "The current pain says otherwise.", "الألم الحالي يقول غير ذلك.")],
            "b", T("A supportive-to-controlling PMO.", "مكتب داعم إلى رقابي."), T("Start with the services that solve the stated problems.", "ابدأ بالخدمات التي تحل المشكلات المذكورة.")),
        multi("T2", "PMO-02", T("Which services come first? Choose all that apply.", "أي الخدمات تأتي أولًا؟ اختر كل ما ينطبق."), [
            ("a", "One status report format", "صيغة واحدة لتقارير الحالة", True, "Comparable reporting.", "تقارير قابلة للمقارنة."),
            ("b", "A portfolio dashboard for executives", "لوحة محفظة للتنفيذيين", True, "Visibility of late projects.", "رؤية المشاريع المتأخرة."),
            ("c", "Stage-gate cost reviews", "مراجعات تكلفة عند البوابات المرحلية", True, "Early warning on overruns.", "إنذار مبكر بالتجاوزات."),
            ("d", "A new office fit-out for the PMO", "تجهيز مكتب جديد للمكتب", False, "Not a service.", "ليس خدمة.")],
            T("a, b and c.", "أ وب وج."), T("Pick services that deliver visible value in the first months.", "اختر خدمات تحقق قيمة مرئية في الأشهر الأولى.")),
        written("T3", "PMO-02", T("Name three KPIs that will show the PMO is adding value, with a target for each.", "سمِّ ثلاثة مؤشرات أداء تُظهر أن المكتب يضيف قيمة، مع مستهدف لكلٍّ منها."), [
            ("KPIs measure outcomes, not PMO activity", "المؤشرات تقيس النتائج، لا نشاط المكتب", 1), ("Each has a target and a baseline", "لكل مؤشر مستهدف وخط أساس", 1)],
            T("Model: “Share of projects reporting on the common format (100 % by month 3); projects within 10 % of budget (from 60 % to 80 % in a year); executive-reported decision time on change requests (under 10 days).”",
              "نموذج: «نسبة المشاريع التي ترفع تقاريرها بالصيغة الموحدة (100 % بحلول الشهر 3)؛ والمشاريع ضمن 10 % من الميزانية (من 60 % إلى 80 % خلال سنة)؛ وزمن القرار في طلبات التغيير كما يُبلغ التنفيذيون (أقل من 10 أيام).»"),
            T("Reviewed by a person before it counts.", "يراجعه شخص قبل أن يُحسب."), min_chars=80)],
    courses=["CRS-PMO-DESIGN", "CRS-PMO-KPI"], lessons=["CRS-PMO-KPI-L02"], toolkits=["pmo", "pmoexc", "p3o"], templates=[],
    refs=[], figures=["FIG-LAB-PMOTYPES"], cover={"motif": "grid", "icon": "briefcase"}, draft=True)

KPI = lab(
    "LAB-KPI-BUILDER", "kpi-builder", "quality", "builder", "KPI-BLD",
    T("KPI Builder", "منشئ مؤشرات الأداء"),
    T("Turn a vague objective into a KPI people can trust: definition, formula, data source, baseline, target and owner — and calculate it.",
      "حوّل هدفًا مبهمًا إلى مؤشر أداء يثق به الناس: التعريف، والمعادلة، ومصدر البيانات، وخط الأساس، والمستهدف، والمالك — ثم احسبه."),
    20, 1, ["PERF-01"],
    {"title": T("“Improve delivery” at a distribution centre", "«تحسين التسليم» في مركز توزيع"),
     "context": [T("Last month the centre shipped 200 orders; 188 arrived on or before the promised date. Management's objective is simply “improve delivery”.",
                   "شحن المركز الشهر الماضي 200 طلب؛ وصل منها 188 في الموعد الموعود أو قبله. وهدف الإدارة ببساطة «تحسين التسليم».")],
     "facts": [], "exhibits": []},
    [
        numeric("T1", "PERF-01", T("On-time delivery last month = ?", "التسليم في الموعد الشهر الماضي = ؟"), 94, 0.5, T("%", "%"),
                T("188 ÷ 200 = 94 %.", "188 ÷ 200 = 94 %."), T("A KPI needs a formula everyone computes the same way.", "يحتاج المؤشر معادلة يحسبها الجميع بالطريقة نفسها.")),
        multi("T2", "PERF-01", T("What must the KPI definition include? Choose all that apply.", "ما الذي يجب أن يتضمنه تعريف المؤشر؟ اختر كل ما ينطبق."), [
            ("a", "What counts as on time (promised date, customer's receipt)", "ما الذي يُعد في الموعد (التاريخ الموعود، استلام العميل)", True, "Removes ambiguity.", "يزيل الغموض."),
            ("b", "Data source and frequency", "مصدر البيانات وتكرار القياس", True, "Makes it repeatable.", "يجعله قابلًا للتكرار."),
            ("c", "Baseline, target and owner", "خط الأساس والمستهدف والمالك", True, "Makes it actionable.", "يجعله قابلًا للتنفيذ."),
            ("d", "A colour for the dashboard", "لون للوحة المؤشرات", False, "Presentation, not definition.", "عرض، لا تعريف.")],
            T("a, b and c.", "أ وب وج."), T("A defined KPI can be audited.", "المؤشر المعرَّف يمكن تدقيقه.")),
        written("T3", "PERF-01", T("Write the full KPI card for on-time delivery.", "اكتب بطاقة المؤشر الكاملة للتسليم في الموعد."), [
            ("Definition and formula", "التعريف والمعادلة", 1), ("Source, frequency, baseline (94 %), target and owner", "المصدر والتكرار وخط الأساس (94 %) والمستهدف والمالك", 1)],
            T("Model: “On-time delivery = orders received by the customer on or before the promised date ÷ orders shipped, monthly, from the transport system. Baseline 94 %; target 97 % by December; owner: logistics manager.”",
              "نموذج: «التسليم في الموعد = الطلبات التي استلمها العميل في التاريخ الموعود أو قبله ÷ الطلبات المشحونة، شهريًا، من نظام النقل. خط الأساس 94 %؛ والمستهدف 97 % بحلول ديسمبر؛ والمالك: مدير اللوجستيات.»"),
            T("Reviewed by a person before it counts.", "يراجعه شخص قبل أن يُحسب."), min_chars=80)],
    courses=["CRS-PMO-KPI"], lessons=[], toolkits=["str", "oec"], templates=["TPL-QUALITY-PLAN"],
    refs=[("iso-9001", "9.1.1"), ("iso-9001", "6.2.2")], figures=["FIG-LAB-KPICARD"], cover={"motif": "bars", "icon": "chart"}, draft=True)

LABS = [PLAN, SUPPLIER, MREVIEW, PMO, KPI]
