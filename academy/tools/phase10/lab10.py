"""Phase 10 — EFQM Assessment Lab definition (data/seed/excellence-lab.json).

The Lab is a self-assessment AID: the learner records real evidence for their own organisation, writes strengths and areas for
improvement, rates each criterion with RADAR-style guidance written by CIA, and builds a prioritised improvement plan. It is never
presented as an EFQM assessment, never produces an EFQM score (no 1,000-point total, no stars or diamonds) and stores nothing outside
the learner's own cia:v1:* records. Criterion NAMES are EFQM's (Model 2025); every question, element description and band text is
original CIA wording. Author: مدثر سلامه."""
from certs10 import CRITERIA

T = lambda en, ar: {"en": en, "ar": ar}  # noqa: E731

PROMPTS = {
    "C1": T("Do we know why we exist, for whom, and where we are going — and is the strategy built from evidence about stakeholders and the environment?",
            "هل نعرف لماذا نوجد ولمن وإلى أين نتجه — وهل بُنيت الاستراتيجية على أدلة عن أصحاب المصلحة والبيئة؟"),
    "C2": T("Do our culture and leadership behaviours make the strategy happen, and do leaders role-model, involve and empower people?",
            "هل تجعل ثقافتنا وسلوكيات قيادتنا الاستراتيجية تتحقق، وهل يكون القادة قدوة ويُشركون الناس ويمكّنونهم؟"),
    "C3": T("Do we understand the needs of customers, people, partners, owners and society, and involve them in what we do?",
            "هل نفهم احتياجات العملاء والموظفين والشركاء والملاك والمجتمع، ونُشركهم فيما نفعل؟"),
    "C4": T("Do we design, deliver and communicate value that stakeholders want, sustainably?",
            "هل نصمم القيمة التي يريدها أصحاب المصلحة ونقدمها ونتواصل بشأنها باستدامة؟"),
    "C5": T("Do we run today's operations well while managing risk, using data and technology, and transforming for the future?",
            "هل ندير عمليات اليوم جيدًا مع إدارة المخاطر واستخدام البيانات والتقنية والتحول للمستقبل؟"),
    "C6": T("What do our key stakeholders say about us — and do we act on it?", "ماذا يقول أصحاب المصلحة الرئيسيون عنا — وهل نتصرف بناءً عليه؟"),
    "C7": T("What do our own strategic and operational measures show over time?", "ماذا تُظهر مقاييسنا الاستراتيجية والتشغيلية عبر الزمن؟"),
}

B = lambda *xs: [T(*x) for x in xs]  # noqa: E731
ELEMENTS = {
    "enabler": [
        {"id": "approach", "name": T("Approach", "الأسلوب"),
         "ask": T("Is there a clear reason for the way we do this, a defined design, and links to strategy and other approaches?", "هل لطريقة عملنا سبب واضح وتصميم معرَّف وصلات بالاستراتيجية والأساليب الأخرى؟"),
         "bands": B(("No defined approach; things happen when someone pushes.", "لا أسلوب معرَّف؛ تحدث الأمور حين يدفع بها أحد."),
                    ("Some approaches exist but the rationale or design is unclear.", "توجد بعض الأساليب لكن المبرر أو التصميم غير واضح."),
                    ("Defined approaches with a rationale for most of the criterion.", "أساليب معرَّفة بمبرر لمعظم المعيار."),
                    ("Clear rationale, defined design and links to strategy and other approaches.", "مبرر واضح وتصميم معرَّف وصلات بالاستراتيجية والأساليب الأخرى."),
                    ("Approaches others learn from, fully integrated and focused on stakeholder needs.", "أساليب يتعلم منها الآخرون، متكاملة تمامًا ومركزة على احتياجات أصحاب المصلحة."))},
        {"id": "deployment", "name": T("Deployment", "التطبيق"),
         "ask": T("Is it used systematically where it should be, on time, and can we show it unit by unit?", "هل يُستخدم بمنهجية حيث ينبغي وفي وقته، وهل نستطيع إظهاره وحدةً وحدة؟"),
         "bands": B(("Not used, or no evidence of use.", "غير مستخدم أو لا دليل على استخدامه."),
                    ("Used in a few places (pilots, showcases).", "مستخدم في مواضع قليلة (تجارب، نماذج استعراضية)."),
                    ("Used in most relevant areas, with records.", "مستخدم في معظم المجالات ذات الصلة، بسجلات."),
                    ("Used systematically across the scope, with a deployment matrix.", "مستخدم بمنهجية عبر النطاق، بمصفوفة تطبيق."),
                    ("Fully deployed, timely and adapted to each area's needs.", "مطبق كليًا وفي وقته ومكيَّف لاحتياجات كل مجال."))},
        {"id": "refinement", "name": T("Assessment & refinement", "التقييم والتحسين"),
         "ask": T("Do we measure whether it works, learn from others and change it for reasons — with dated examples?", "هل نقيس هل يعمل، ونتعلم من الآخرين، ونغيّره لأسباب — بأمثلة مؤرخة؟"),
         "bands": B(("No measurement or review.", "لا قياس ولا مراجعة."),
                    ("Occasional review; few changes made.", "مراجعة متقطعة؛ وتغييرات قليلة."),
                    ("Regular measurement and some changes made as a result.", "قياس منتظم وبعض التغييرات نتيجة لذلك."),
                    ("Measured, benchmarked and improved, with a dated change log.", "مقاس ومقارَن ومحسَّن، بسجل تغييرات مؤرخ."),
                    ("Continuous learning and innovation that others adopt.", "تعلم وابتكار مستمران يتبناهما الآخرون."))},
    ],
    "results": [
        {"id": "relevance", "name": T("Relevance & usability", "الصلة وقابلية الاستخدام"),
         "ask": T("Do the measures cover what matters to strategy and stakeholders, segmented usefully, with reliable data?", "هل تغطي المقاييس ما يهم الاستراتيجية وأصحاب المصلحة، بتجزئة مفيدة وبيانات موثوقة؟"),
         "bands": B(("No relevant measures.", "لا مقاييس ذات صلة."),
                    ("A few measures; relevance or reliability unclear.", "مقاييس قليلة؛ والصلة أو الموثوقية غير واضحة."),
                    ("Relevant measures for most key areas.", "مقاييس ذات صلة لمعظم المجالات الرئيسية."),
                    ("A balanced, segmented set with defined, reliable data.", "مجموعة متوازنة ومجزأة ببيانات معرَّفة وموثوقة."),
                    ("A comprehensive set used to predict and steer performance.", "مجموعة شاملة تُستخدم للتنبؤ بالأداء وتوجيهه."))},
        {"id": "performance", "name": T("Performance", "الأداء"),
         "ask": T("Do results show positive trends, met targets, good comparisons and explained causes?", "هل تُظهر النتائج اتجاهات إيجابية ومستهدفات محققة ومقارنات جيدة وأسبابًا مفسَّرة؟"),
         "bands": B(("No results, or results worsening.", "لا نتائج، أو نتائج تتدهور."),
                    ("Some positive trends or met targets.", "بعض الاتجاهات الإيجابية أو المستهدفات المحققة."),
                    ("Positive trends and targets met in many areas.", "اتجاهات إيجابية ومستهدفات محققة في مجالات كثيرة."),
                    ("Sustained trends, targets met, favourable comparisons, causes understood.", "اتجاهات مستدامة ومستهدفات محققة ومقارنات إيجابية وأسباب مفهومة."),
                    ("Leading results sustained over years, with clear cause and effect.", "نتائج رائدة مستدامة لسنوات بسبب وأثر واضحين."))},
    ],
}

SCALE = [{"value": v, "label": T(*lab)} for v, lab in ((0, ("No evidence", "لا دليل")), (25, ("Some evidence", "بعض الأدلة")), (50, ("Evident", "واضح")),
                                                       (75, ("Clear and broad", "واضح وواسع")), (100, ("Comprehensive", "شامل")))]

LAB = {
    "id": "LAB-EFQM", "slug": "efqm-assessment-lab",
    "title": T("EFQM Assessment Lab", "مختبر تقييم EFQM"),
    "model": T("Structured with the seven criterion names of the EFQM Model 2025", "مبني على أسماء المعايير السبعة لنموذج EFQM 2025"),
    "label": T("Self-assessment aid — not an EFQM assessment", "أداة مساعدة للتقييم الذاتي — وليست تقييمًا من EFQM"),
    "disclaimer": T("This Lab helps you organise and analyse your own evidence. It is not an EFQM assessment, gives no EFQM score, star, diamond or recognition, and is not reviewed by EFQM or by CIA. Your records stay in this browser unless you export them.",
                    "يساعدك هذا المختبر على تنظيم أدلتك وتحليلها. وليس تقييمًا من EFQM، ولا يمنح درجة أو نجومًا أو ماسات أو اعترافًا من EFQM، ولا تراجعه EFQM ولا CIA. وتبقى سجلاتك في هذا المتصفح ما لم تصدّرها."),
    "groups": [{"id": "direction", "name": T("Direction", "التوجه")}, {"id": "execution", "name": T("Execution", "التنفيذ")}, {"id": "results", "name": T("Results", "النتائج")}],
    "criteria": [{"id": cid, "no": i + 1, "group": g, "name": T(en, ar), "prompt": PROMPTS[cid], "kind": "results" if g == "results" else "enabler"}
                 for i, (cid, g, en, ar) in enumerate(CRITERIA)],
    "elements": ELEMENTS, "scale": SCALE,
    "courses": ["CRS-EX-RADAR", "CRS-EX-EVID", "CRS-EX-SA", "CRS-EX-PLAN"],
    "source_ids": ["SRC-EFQM-MODEL2025", "SRC-CIA-EX"],
}
