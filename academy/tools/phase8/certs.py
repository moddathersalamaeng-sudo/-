"""Phase 8 certification explorer — PMI certifications.

Facts (eligibility, exam format, fees, renewal, domains) are taken only from PMI's official pages, opened on 3 Nov 2026, each
fact group carrying its own verification state: "verified" (seen on the cited page that day) or "pending" (the page was not
reachable or did not state it — the explorer then sends learners to PMI and states nothing). Descriptions, study guidance and the
mapping to CIA courses are original CIA wording. CIA is not a PMI Authorized Training Partner and awards no PDUs.
PMP®, CAPM®, PMI-ACP®, PMI-RMP®, PgMP®, PfMP® and PMI-PBA® are registered marks of the Project Management Institute, Inc.
Author: مدثر سلامه."""
T = lambda en, ar: {"en": en, "ar": ar}  # noqa: E731
CHECKED = "2026-11-03"
PMI = "Project Management Institute (PMI)"


def src(sid, title, url, area, note, org=PMI, kind="official"):
    return {"id": sid, "source_id": sid, "organization": org, "title": title, "official_url": url, "source_type": kind,
            "accessed_date": CHECKED, "verified_date": CHECKED, "verification_status": "verified_by_lookup", "verification_note": note,
            "content_area": area, "owner": "مدثر سلامه", "review_date": "2027-02-03"}


SOURCES = [
    src("SRC-PMI-PMP", "Project Management Professional (PMP)® certification page", "https://www.pmi.org/certifications/project-management-pmp", "PMP",
        "Opened 3 Nov 2026: eligibility (two options), 180 questions, exam fee USD 405 member / USD 555 non-member. Renewal not stated on this page."),
    src("SRC-PMI-PMP-NEW", "What's new in the updated PMP® exam?", "https://www.pmi.org/certifications/project-management-pmp/new-exam", "PMP",
        "Opened 3 Nov 2026: exam updated July 2026; domain weights People 42%→33%, Process 50%→41%, Business Environment 8%→26%; AI, sustainability and stakeholder engagement in scenarios."),
    src("SRC-PMI-PMP-ECO-2026", "PMP® Examination Content Outline — July 2026 (copy hosted by a training provider)", "https://backend.kayenta.de/fileadmin/kayenta/Bilder_2026/PMP-Examination-Content-Outline-2026.pdf", "PMP",
        "PMI document (publisher: Project Management Institute) opened 3 Nov 2026 from a provider's copy because pmi.org did not serve it to this session: 180 questions (170 scored, 10 pretest), 240 minutes, two 10-minute breaks, 8 + 10 + 8 tasks. Download the outline from PMI before relying on it.",
        kind="secondary_copy_of_official"),
    src("SRC-PMI-CAPM", "Certified Associate in Project Management (CAPM)® page", "https://www.pmi.org/capm", "CAPM",
        "Opened 3 Nov 2026: secondary degree + 23 hours of PM education; 150 questions (135 scored), 180 minutes; 15 PDUs per 3-year cycle; four domains with weights. Fee not stated."),
    src("SRC-PMI-RMP", "PMI Risk Management Professional (PMI-RMP)® page", "https://www.pmi.org/certifications/risk-management-rmp", "PMI-RMP",
        "Opened 3 Nov 2026: three eligibility sets, 115 questions, 150 minutes, 30 PDUs per 3-year cycle, five domains with weights. Fee not stated."),
    src("SRC-PMI-ACP-ECO", "PMI Agile Certified Practitioner (PMI-ACP)® Examination Content Outline", "https://www.pmi.org/-/media/pmi/documents/public/pdf/certifications/agile-certified-exam-outline.pdf", "PMI-ACP",
        "Opened 3 Nov 2026: 120 questions (100 scored), 180 minutes with a 10-minute break; domains Mindset 28%, Leadership 25%, Product 19%, Delivery 28%; eligibility options. Fee and renewal not in this document."),
    src("SRC-PMI-PMOCP", "PMI PMO Certified Professional (PMI-PMOCP) page", "https://www.pmi.org/certifications/pmo-certified-professional-pmi-pmocp", "PMI-PMOCP",
        "Opened 3 Nov 2026: secondary degree, 3 years of project-related experience in 8 years or an active PMP, 10 hours of PMO education; 120 questions, 165 minutes; 30 PDUs per 3-year cycle; six domains with weights. Fee not stated. The page lists Arabic among exam languages."),
    src("SRC-PMI-PGMP", "Program Management Professional (PgMP)® page", "https://www.pmi.org/certifications/program-management-pgmp", "PgMP",
        "Opened 3 Nov 2026: only the renewal rule was readable (60 PDUs per 3-year cycle). Eligibility, exam format and fee were not captured — check PMI before relying on any figure."),
    src("SRC-PMI-PGMP-PREP", "PgMP® exam preparation page", "https://www.pmi.org/certifications/program-management-pgmp/exam-prep", "PgMP",
        "Opened 3 Nov 2026: exam available in English only; PMI does not endorse review courses; reference list includes The Standard for Program Management (5th ed.)."),
    src("SRC-PMI-PFMP", "Portfolio Management Professional (PfMP)® page", "https://www.pmi.org/certifications/portfolio-management-pfmp", "PfMP",
        "Opened 3 Nov 2026: three eligibility sets, panel review assessment, 170 questions, 240 minutes, English only, 60 PDUs per 3-year cycle, five domains with weights. Fee not stated."),
    src("SRC-PMI-PBA", "PMI Professional in Business Analysis (PMI-PBA)® page", "https://www.pmi.org/certifications/business-analysis-pba", "PMI-PBA",
        "Opened 3 Nov 2026: three eligibility sets, 200 questions, 240 minutes, 60 PDUs per 3-year cycle, five domains with weights. Fee not stated."),
    {"id": "SRC-CIA-PM", "source_id": "SRC-CIA-PM", "organization": "Continual Improvement Academy", "title": "CIA original teaching synthesis — PMI / PMO / P3O Academy",
     "official_url": "", "source_type": "owner", "accessed_date": CHECKED, "verified_date": CHECKED, "verification_status": "owner_publication",
     "verification_note": "Original CIA teaching content in independent wording; no PMBOK® Guide, PMI exam, AXELOS or PeopleCert text is reproduced.",
     "content_area": "PMI / PMO / P3O Academy curriculum", "owner": "مدثر سلامه", "review_date": "2027-05-03"},
]

V, P = "verified", "pending"


def elig(*opts):
    return [{"label": T(*o[0]), "items": [T(*x) for x in o[1:]]} for o in opts]


def dom(*xs):
    return [{"name": T(en, ar), "weight": w} for en, ar, w in xs]


def cert(cid, slug, code, name, stage, area, summary, who, *, eligibility=None, exam=None, fee=None, renewal=None, domains=None, languages=None,
         extra=None, status, sources, url, routes, courses, competencies, toolkits, next_certs, prepare, study=None):
    return {"id": cid, "slug": slug, "code": code, "body": "PMI", "name": T(*name), "stage": stage, "area": area,
            "summary": T(*summary), "who": T(*who), "eligibility": eligibility or [], "exam": exam, "fee": fee, "renewal": renewal,
            "domains": domains or [], "languages": T(*languages) if languages else None, "extra": [T(*x) for x in (extra or [])],
            "facts_status": status, "verified_date": CHECKED, "source_ids": sources, "official_url": url,
            "cia_routes": routes, "cia_courses": courses, "competencies": competencies, "toolkits": toolkits, "next": next_certs,
            "prepare": [{"title": T(*p[0]), "text": T(*p[1])} for p in prepare], "study_plan": study,
            "claims": T("CIA is not a PMI Authorized Training Partner. CIA courses do not award PDUs or PMI contact-hour certificates, and completing them does not guarantee eligibility or an exam result. Always confirm requirements on PMI's site before applying.",
                        "CIA ليست شريك تدريب معتمدًا من PMI. ولا تمنح دورات CIA وحدات PDU ولا شهادات ساعات تعليمية من PMI، وإكمالها لا يضمن الأهلية ولا نتيجة الاختبار. تحقق دائمًا من المتطلبات على موقع PMI قبل التقديم."),
            "governance": {"content_status": "needs_review", "content_source": "external_public", "version": "1.0.0", "reviewer": None, "review_date": None,
                           "change_note": "Phase 8 certification explorer (3 Nov 2026): facts from PMI's official pages opened that day; descriptions and study guidance are original CIA wording."}}


PMP_STUDY = {
    "weeks": 10, "hours_per_week": 10,
    "phases": [
        {"weeks": "1", "title": T("Diagnose and plan", "التشخيص والتخطيط"), "text": T("Take the PM readiness diagnostic and the PMP® route diagnostic; download the current outline from PMI; fix your exam window and weekly hours.", "أدِّ التقييم التشخيصي للجاهزية وتقييم مسار PMP®؛ ونزّل المخطط الحالي من PMI؛ وحدّد نافذة الاختبار وساعاتك الأسبوعية."), "courses": ["CRS-PMP-PREP"], "domain": None},
        {"weeks": "2–3", "title": T("People (33%)", "الأفراد (33%)"), "text": T("Stakeholders, communication, conflict, team leadership. Practise scenario reasoning daily.", "أصحاب المصلحة والتواصل والنزاع وقيادة الفريق. وتدرّب يوميًا على التفكير في السيناريوهات."), "courses": ["CRS-PM-STAKE", "CRS-PM-101"], "domain": 0},
        {"weeks": "4–6", "title": T("Process (41%)", "العمليات (41%)"), "text": T("Scope, schedule, cost, earned value, quality, resources, procurement and closure; predictive and agile delivery side by side.", "النطاق والجدول والتكلفة والقيمة المكتسبة والجودة والموارد والمشتريات والإغلاق؛ والتسليم التنبؤي والرشيق جنبًا إلى جنب."), "courses": ["CRS-PM-SSC", "CRS-PM-AGILE"], "domain": 1},
        {"weeks": "7–8", "title": T("Business Environment (26%)", "بيئة الأعمال (26%)"), "text": T("Governance, compliance, change control, risk, organisational change and external factors.", "الحوكمة والامتثال وضبط التغيير والمخاطر والتغيير المؤسسي والعوامل الخارجية."), "courses": ["CRS-PM-RISK", "CRS-P-21500"], "domain": 2},
        {"weeks": "9", "title": T("Mixed timed practice", "تدريب موقوت مختلط"), "text": T("Timed mixed sets; review every error in your log; re-study the weakest domain.", "مجموعات موقوتة مختلطة؛ ومراجعة كل خطأ في سجلك؛ وإعادة مذاكرة المجال الأضعف."), "courses": ["CRS-PMP-PREP"], "domain": None},
        {"weeks": "10", "title": T("Full rehearsal and rest", "بروفة كاملة وراحة"), "text": T("One full-length timed practice in exam conditions, final error-log review, rest the day before.", "اختبار تجريبي كامل موقوت في ظروف الاختبار، ومراجعة نهائية لسجل الأخطاء، وراحة في اليوم السابق."), "courses": [], "domain": None},
    ]}

CERTS = [
    cert("CERT-CAPM", "capm", "CAPM®", ("Certified Associate in Project Management", "مشارك معتمد في إدارة المشاريع"), "entry", "project",
         ("An entry-level credential for people starting a project career. It tests fundamentals, predictive and agile methods and business-analysis basics; no project experience is required.",
          "شهادة للمبتدئين في مسار المشاريع. تختبر الأساسيات والمنهجيات التنبؤية والرشيقة وأساسيات تحليل الأعمال؛ ولا تتطلب خبرة في المشاريع."),
         ("Students, graduates, coordinators and team members without the experience PMP® needs.", "الطلاب والخريجون والمنسقون وأعضاء الفرق الذين لا يملكون الخبرة التي تتطلبها PMP®."),
         eligibility=elig((("Requirement", "المتطلب"), ("A secondary degree (high school diploma, GED or global equivalent)", "شهادة ثانوية (أو ما يعادلها دوليًا)"), ("23 hours of project-management education before the exam", "23 ساعة من تعليم إدارة المشاريع قبل الاختبار"))),
         exam={"questions": 150, "scored": 135, "minutes": 180, "note": None},
         renewal={"pdus": 15, "years": 3},
         domains=dom(("Project Management Fundamentals and Core Concepts", "أساسيات إدارة المشاريع ومفاهيمها الجوهرية", 36), ("Predictive, Plan-Based Methodologies", "المنهجيات التنبؤية القائمة على الخطة", 17),
                     ("Agile Frameworks/Methodologies", "الأطر والمنهجيات الرشيقة", 20), ("Business Analysis Frameworks", "أطر تحليل الأعمال", 27)),
         status={"eligibility": V, "exam": V, "fee": P, "renewal": V, "domains": V}, sources=["SRC-PMI-CAPM"], url="https://www.pmi.org/capm",
         routes=["ROUTE-PM-FOUND"], courses=["CRS-PM-101", "CRS-PM-SSC", "CRS-PM-AGILE", "CRS-PM-STAKE"], competencies=["PM-01", "PM-02", "PM-03"], toolkits=["iso21500"], next_certs=["CERT-PMP"],
         prepare=[(("Start with the foundations", "ابدأ بالأساسيات"), ("Complete Project Management Foundations, then Scope-Schedule-Cost Integration and Agile and Hybrid Delivery.", "أكمل أساسيات إدارة المشاريع، ثم تكامل النطاق والجدول والتكلفة، والتسليم الرشيق والهجين.")),
                  (("Cover business analysis", "غطِّ تحليل الأعمال"), ("Business analysis carries about a quarter of the weight; study requirements, stakeholders and value.", "يحمل تحليل الأعمال نحو ربع الوزن؛ فذاكر المتطلبات وأصحاب المصلحة والقيمة.")),
                  (("Document your 23 hours", "وثّق ساعاتك الـ 23"), ("PMI decides which education counts; keep certificates and syllabi.", "PMI تحدد التعليم المحتسب؛ فاحتفظ بالشهادات والمناهج."))]),
    cert("CERT-PMP", "pmp", "PMP®", ("Project Management Professional", "محترف إدارة المشاريع"), "practitioner", "project",
         ("The best-known project-management credential. It tests leading people, running the process with predictive, agile and hybrid approaches, and managing the business environment of a project. The exam was updated in July 2026, with much more weight on the business environment.",
          "أشهر شهادات إدارة المشاريع. تختبر قيادة الأفراد وإدارة العمليات بالنُّهج التنبؤية والرشيقة والهجينة وإدارة بيئة الأعمال المحيطة بالمشروع. وحُدِّث الاختبار في يوليو 2026 مع وزن أكبر بكثير لبيئة الأعمال."),
         ("Practitioners who already lead projects and can show the required months of experience.", "الممارسون الذين يقودون المشاريع بالفعل ويستطيعون إثبات أشهر الخبرة المطلوبة."),
         eligibility=elig((("Option 1", "الخيار 1"), ("Four-year degree", "شهادة جامعية من أربع سنوات"), ("36 months of experience leading projects within the past eight years", "36 شهرًا من الخبرة في قيادة المشاريع خلال السنوات الثماني الماضية"), ("35 hours of project-management education or training, or a CAPM® certification", "35 ساعة من تعليم أو تدريب إدارة المشاريع، أو شهادة CAPM®")),
                          (("Option 2", "الخيار 2"), ("High school diploma or associate's degree", "شهادة ثانوية أو دبلوم مشارك"), ("60 months of experience leading projects within the past eight years", "60 شهرًا من الخبرة في قيادة المشاريع خلال السنوات الثماني الماضية"), ("35 hours of project-management education or training, or a CAPM® certification", "35 ساعة من تعليم أو تدريب إدارة المشاريع، أو شهادة CAPM®"))),
         exam={"questions": 180, "scored": 170, "minutes": 240, "note": T("Two 10-minute breaks; question types include case or scenario, multiple-response, matching, graphic-based and point-and-click items (July 2026 outline).",
                                                                        "استراحتان كل منهما 10 دقائق؛ وتشمل أنواع الأسئلة الحالة أو السيناريو، والإجابات المتعددة، والمطابقة، والأسئلة المعتمدة على الرسوم، والنقر على الموضع (مخطط يوليو 2026).")},
         fee={"member": 405, "non_member": 555, "currency": "USD", "note": T("Bundling the exam with PMI membership reduces the exam fee (PMI page).", "دمج الاختبار مع عضوية PMI يخفض رسوم الاختبار (صفحة PMI).")},
         domains=dom(("People", "الأفراد", 33), ("Process", "العمليات", 41), ("Business Environment", "بيئة الأعمال", 26)),
         extra=[("Previous weights (before July 2026): People 42%, Process 50%, Business Environment 8%.", "الأوزان السابقة (قبل يوليو 2026): الأفراد 42%، والعمليات 50%، وبيئة الأعمال 8%."),
                ("The July 2026 outline lists 8 tasks in People, 10 in Process and 8 in Business Environment; read their wording in the official outline.", "يذكر مخطط يوليو 2026 ثماني مهام في الأفراد وعشرًا في العمليات وثماني في بيئة الأعمال؛ فاقرأ صياغتها في المخطط الرسمي.")],
         status={"eligibility": V, "exam": V, "fee": V, "renewal": P, "domains": V}, sources=["SRC-PMI-PMP", "SRC-PMI-PMP-NEW", "SRC-PMI-PMP-ECO-2026"],
         url="https://www.pmi.org/certifications/project-management-pmp",
         routes=["ROUTE-PMP"], courses=["CRS-PM-101", "CRS-PM-SSC", "CRS-PM-RISK", "CRS-PM-STAKE", "CRS-PM-AGILE", "CRS-PMP-PREP", "CRS-P-21500"],
         competencies=["PM-01", "PM-02", "PM-03", "RSK-01", "RSK-02", "GOV-01"], toolkits=["iso21500", "stakeholders", "fmea"], next_certs=["CERT-PMI-RMP", "CERT-PGMP", "CERT-PMI-PMOCP"],
         prepare=[(("Check eligibility first", "تحقق من الأهلية أولًا"), ("Count calendar months of project leadership (overlaps count once) and gather evidence for the 35 hours before you apply.", "احسب الأشهر التقويمية لقيادة المشاريع (التداخل يُحتسب مرة واحدة) واجمع أدلة الساعات الخمس والثلاثين قبل التقديم.")),
                  (("Plan by weight", "خطط حسب الوزن"), ("Use the outline's weights and your diagnostic to split study hours; Business Environment now needs real time.", "استخدم أوزان المخطط وتقييمك التشخيصي لتوزيع ساعات المذاكرة؛ وبيئة الأعمال تحتاج الآن إلى وقت حقيقي.")),
                  (("Practise reasoning, not recall", "تدرّب على التفكير لا الحفظ"), ("Most items describe a situation. Use the five-step method of the PMP Preparation course and keep an error log.", "معظم الأسئلة تصف موقفًا. استخدم منهج الخطوات الخمس في دورة الإعداد لـ PMP واحتفظ بسجل أخطاء.")),
                  (("Book when stable", "احجز عند الاستقرار"), ("Book the exam when timed practice results are stable across two or three attempts, not on a fixed hope date.", "احجز الاختبار عندما تستقر نتائج التدريب الموقوت عبر محاولتين أو ثلاث، لا في موعد قائم على الأمل."))],
         study=PMP_STUDY),
    cert("CERT-PMI-ACP", "pmi-acp", "PMI-ACP®", ("PMI Agile Certified Practitioner", "ممارس رشيق معتمد من PMI"), "specialist", "agile",
         ("A credential for agile practitioners across frameworks: mindset, leadership, product and delivery. The current outline dates from November 2024.", "شهادة للممارسين الرشيقين عبر الأطر: العقلية والقيادة والمنتج والتسليم. ويعود المخطط الحالي إلى نوفمبر 2024."),
         ("Scrum Masters, product owners, agile team leads and project managers working in agile or hybrid settings.", "Scrum Masters ومالكو المنتجات وقادة الفرق الرشيقة ومديرو المشاريع في البيئات الرشيقة أو الهجينة."),
         eligibility=elig((("Requirements", "المتطلبات"), ("A secondary diploma or global equivalent", "شهادة ثانوية أو ما يعادلها دوليًا"), ("21 hours of agile training completed before applying", "21 ساعة تدريب رشيق قبل التقديم"),
                           ("Experience: 2 years of agile experience within the past 5 years; or 1 year with a GAC-accredited degree; or 1 year with a current third-party agile certification held for more than a year; or an active PMP®", "الخبرة: سنتان من الخبرة الرشيقة خلال السنوات الخمس الماضية؛ أو سنة مع شهادة جامعية من برنامج معتمد من GAC؛ أو سنة مع شهادة رشيقة سارية من جهة أخرى مضى عليها أكثر من سنة؛ أو شهادة PMP® سارية"))),
         exam={"questions": 120, "scored": 100, "minutes": 180, "note": T("One 10-minute break after the first 60 items (exam outline).", "استراحة واحدة 10 دقائق بعد أول 60 سؤالًا (مخطط الاختبار).")},
         domains=dom(("Mindset", "العقلية", 28), ("Leadership", "القيادة", 25), ("Product", "المنتج", 19), ("Delivery", "التسليم", 28)),
         status={"eligibility": V, "exam": V, "fee": P, "renewal": P, "domains": V}, sources=["SRC-PMI-ACP-ECO"], url="https://www.pmi.org/certifications/agile-acp",
         routes=["ROUTE-AGILE"], courses=["CRS-PM-AGILE", "CRS-PM-STAKE", "CRS-PM-RISK"], competencies=["PM-03", "PM-02", "LDR-01"], toolkits=["lessons", "stakeholders"], next_certs=["CERT-PMP"],
         prepare=[(("Build hands-on experience", "ابنِ خبرة عملية"), ("The exam assumes real agile work; join or run sprints and keep evidence.", "يفترض الاختبار عملًا رشيقًا حقيقيًا؛ شارك في الدورات أو أدرها واحتفظ بالأدلة.")),
                  (("Study across frameworks", "ذاكر عبر الأطر"), ("Scrum, Kanban, lean and hybrid tailoring all appear; the Agile and Hybrid Delivery course is the starting point.", "يظهر Scrum وKanban واللين والتكييف الهجين؛ ودورة التسليم الرشيق والهجين نقطة البداية."))]),
    cert("CERT-PMI-RMP", "pmi-rmp", "PMI-RMP®", ("PMI Risk Management Professional", "محترف إدارة المخاطر من PMI"), "specialist", "risk",
         ("A specialist credential for people who lead project risk management: strategy, identification, analysis, response and monitoring.", "شهادة تخصصية لمن يقودون إدارة مخاطر المشاريع: الاستراتيجية والتحديد والتحليل والاستجابة والمتابعة."),
         ("Risk managers and analysts, project controls staff, and project managers in high-risk sectors.", "مديرو ومحللو المخاطر، وموظفو ضبط المشاريع، ومديرو المشاريع في القطاعات عالية المخاطر."),
         eligibility=elig((("Set A", "المجموعة أ"), ("Secondary diploma or global equivalent", "شهادة ثانوية أو ما يعادلها"), ("36 months of project risk management experience within the last 5 years", "36 شهرًا من الخبرة في إدارة مخاطر المشاريع خلال السنوات الخمس الماضية"), ("40 hours of project risk management education", "40 ساعة من تعليم إدارة مخاطر المشاريع")),
                          (("Set B", "المجموعة ب"), ("Bachelor's degree or higher", "بكالوريوس أو أعلى"), ("24 months of experience within the last 5 years", "24 شهرًا من الخبرة خلال السنوات الخمس الماضية"), ("30 hours of education", "30 ساعة من التعليم")),
                          (("Set C", "المجموعة ج"), ("Bachelor's degree or higher from a GAC-accredited programme", "بكالوريوس أو أعلى من برنامج معتمد من GAC"), ("12 months of experience within the past 5 years", "12 شهرًا من الخبرة خلال السنوات الخمس الماضية"), ("30 hours of education", "30 ساعة من التعليم"))),
         exam={"questions": 115, "scored": None, "minutes": 150, "note": None}, renewal={"pdus": 30, "years": 3},
         domains=dom(("Risk Strategy and Planning", "استراتيجية المخاطر وتخطيطها", 22), ("Risk Identification", "تحديد المخاطر", 23), ("Risk Analysis", "تحليل المخاطر", 23), ("Risk Response", "الاستجابة للمخاطر", 13), ("Monitor and Close Risk", "متابعة المخاطر وإغلاقها", 19)),
         status={"eligibility": V, "exam": V, "fee": P, "renewal": V, "domains": V}, sources=["SRC-PMI-RMP"], url="https://www.pmi.org/certifications/risk-management-rmp",
         routes=["ROUTE-PM-FOUND"], courses=["CRS-PM-RISK", "CRS-ISO-RISK"], competencies=["RSK-01", "RSK-02"], toolkits=["fmea", "iso31000"], next_certs=["CERT-PMP"],
         prepare=[(("Deepen quantitative risk", "عمّق تحليل المخاطر الكمي"), ("Expected value, simulation and reserves are core; Risk in Projects is the starting course, ISO 31000 guides add the enterprise view.", "القيمة المتوقعة والمحاكاة والاحتياطيات جوهرية؛ ودورة المخاطر في المشاريع هي البداية، وتضيف أدلة ISO 31000 المنظور المؤسسي."))]),
    cert("CERT-PMI-PMOCP", "pmi-pmocp", "PMI-PMOCP", ("PMI PMO Certified Professional", "محترف مكاتب إدارة المشاريع المعتمد من PMI"), "specialist", "pmo",
         ("A credential for PMO professionals: aligning the PMO with the organisation, its strategy, design, operation, improvement and people. One of the few PMI exams offered in Arabic.",
          "شهادة لمحترفي مكاتب المشاريع: مواءمة المكتب مع المنظمة واستراتيجيته وتصميمه وتشغيله وتحسينه وأفراده. وهي من اختبارات PMI القليلة المتاحة بالعربية."),
         ("PMO analysts, officers and heads, and project managers who support portfolios.", "محللو مكاتب المشاريع وموظفوها ورؤساؤها، ومديرو المشاريع الذين يدعمون المحافظ."),
         eligibility=elig((("Requirements", "المتطلبات"), ("A secondary degree (high school diploma, GED or global equivalent)", "شهادة ثانوية (أو ما يعادلها دوليًا)"), ("3 years of project-related experience within the last 8 years, or a PMP® in good standing", "3 سنوات من الخبرة المتعلقة بالمشاريع خلال السنوات الثماني الماضية، أو شهادة PMP® سارية"), ("10 hours of PMO education", "10 ساعات من تعليم مكاتب المشاريع"))),
         exam={"questions": 120, "scored": None, "minutes": 165, "note": None}, renewal={"pdus": 30, "years": 3},
         domains=dom(("Organizational Development and Alignment", "التطوير والمواءمة المؤسسية", 16), ("PMO Strategic Elements", "العناصر الاستراتيجية للمكتب", 18), ("PMO Design and Structuring", "تصميم المكتب وهيكلته", 18),
                     ("PMO Operation and Performance", "تشغيل المكتب وأداؤه", 15), ("PMO Enhancement and Effectiveness", "تحسين المكتب وفاعليته", 18), ("People", "الأفراد", 15)),
         languages=("The PMI page lists English, Brazilian Portuguese, Chinese (Simplified and Traditional), Spanish, Arabic, French, German, Japanese and Korean, but its summary says “4 languages” — confirm your language when booking.",
                    "تذكر صفحة PMI الإنجليزية والبرتغالية البرازيلية والصينية (المبسطة والتقليدية) والإسبانية والعربية والفرنسية والألمانية واليابانية والكورية، لكن ملخصها يقول «4 لغات» — تأكد من لغتك عند الحجز."),
         status={"eligibility": V, "exam": V, "fee": P, "renewal": V, "domains": V}, sources=["SRC-PMI-PMOCP"], url="https://www.pmi.org/certifications/pmo-certified-professional-pmi-pmocp",
         routes=["ROUTE-PMO"], courses=["CRS-PMO-DESIGN", "CRS-PMO-KPI", "CRS-P3O-101", "CRS-PFM-PRIOR", "CRS-P-P3O", "CRS-P-PMX"], competencies=["PMO-01", "PMO-02", "GOV-01", "PERF-01"],
         toolkits=["p3o", "pmo", "pmoexc"], next_certs=["CERT-PFMP"],
         prepare=[(("Design before you operate", "صمّم قبل أن تشغّل"), ("Start with PMO Design and Services, then Maturity and KPIs; use the P3O and PMO Excellence toolkits on a real office.", "ابدأ بتصميم المكتب وخدماته ثم النضج والمؤشرات؛ واستخدم أداتي P3O وتميّز مكاتب المشاريع على مكتب حقيقي.")),
                  (("Use your Arabic advantage", "استفد من ميزة العربية"), ("If you sit the exam in Arabic, study the Academy's bilingual terms side by side so both vocabularies are familiar.", "إن أديت الاختبار بالعربية، فذاكر مصطلحات الأكاديمية ثنائية اللغة جنبًا إلى جنب لتألف المفردتين."))]),
    cert("CERT-PGMP", "pgmp", "PgMP®", ("Program Management Professional", "محترف إدارة البرامج"), "senior", "programme",
         ("A senior credential for people who lead programmes of related projects to deliver benefits. Its full eligibility and exam details could not be read on 3 November 2026; the explorer shows only what was verified.",
          "شهادة متقدمة لمن يقودون برامج من المشاريع المترابطة لتحقيق المنافع. ولم تُقرأ تفاصيل أهليتها واختبارها كاملة في 3 نوفمبر 2026؛ ويعرض المستكشف ما تم التحقق منه فقط."),
         ("Experienced programme managers and senior project managers coordinating several projects.", "مديرو البرامج ذوو الخبرة وكبار مديري المشاريع الذين ينسقون عدة مشاريع."),
         renewal={"pdus": 60, "years": 3},
         extra=[("PMI states the exam is available in English only and that it does not endorse specific review courses; its reference list includes The Standard for Program Management (Fifth Edition).",
                 "تذكر PMI أن الاختبار متاح بالإنجليزية فقط وأنها لا تعتمد دورات مراجعة بعينها؛ وتتضمن قائمة مراجعها «معيار إدارة البرامج» (الإصدار الخامس).")],
         status={"eligibility": P, "exam": P, "fee": P, "renewal": V, "domains": P}, sources=["SRC-PMI-PGMP", "SRC-PMI-PGMP-PREP"], url="https://www.pmi.org/certifications/program-management-pgmp",
         routes=["ROUTE-PORTFOLIO"], courses=["CRS-PM-101", "CRS-PFM-PRIOR", "CRS-P-21500", "CRS-PM-STAKE"], competencies=["PM-02", "GOV-01", "PMO-02", "LDR-02"], toolkits=["iso21500"], next_certs=["CERT-PFMP"],
         prepare=[(("Think benefits, not deliverables", "فكّر بالمنافع لا المخرجات"), ("Programmes exist for benefits; the business-case and benefits lessons and the ISO 21503 practices of the ISO 21500 guide are the base.", "توجد البرامج من أجل المنافع؛ ودروس دراسة الجدوى والمنافع وممارسات ISO 21503 في دليل ISO 21500 هي الأساس."))]),
    cert("CERT-PFMP", "pfmp", "PfMP®", ("Portfolio Management Professional", "محترف إدارة المحافظ"), "senior", "portfolio",
         ("A senior credential for portfolio managers who align investment in change with strategy, govern it and manage portfolio performance and risk. Eligibility is reviewed by a panel of experts before the exam.",
          "شهادة متقدمة لمديري المحافظ الذين يوائمون الاستثمار في التغيير مع الاستراتيجية ويحوكمونه ويديرون أداء المحفظة ومخاطرها. وتُراجع الأهلية من لجنة خبراء قبل الاختبار."),
         ("Portfolio managers, heads of portfolio offices and strategy executives with long portfolio experience.", "مديرو المحافظ ورؤساء مكاتبها وتنفيذيو الاستراتيجية ذوو الخبرة الطويلة في المحافظ."),
         eligibility=elig((("Set A", "المجموعة أ"), ("Secondary diploma or global equivalent", "شهادة ثانوية أو ما يعادلها"), ("96 months of professional business experience within the past 15 years", "96 شهرًا من الخبرة المهنية في الأعمال خلال السنوات الخمس عشرة الماضية"), ("84 months of portfolio management experience within the past 15 years", "84 شهرًا من الخبرة في إدارة المحافظ خلال السنوات الخمس عشرة الماضية")),
                          (("Set B", "المجموعة ب"), ("Bachelor's degree or higher", "بكالوريوس أو أعلى"), ("96 months of professional business experience within the past 15 years", "96 شهرًا من الخبرة المهنية في الأعمال خلال السنوات الخمس عشرة الماضية"), ("48 months of portfolio management experience within the past 15 years", "48 شهرًا من الخبرة في إدارة المحافظ خلال السنوات الخمس عشرة الماضية")),
                          (("Set C", "المجموعة ج"), ("Bachelor's degree or higher from a GAC-accredited programme", "بكالوريوس أو أعلى من برنامج معتمد من GAC"), ("96 months of professional business experience within the past 15 years", "96 شهرًا من الخبرة المهنية في الأعمال خلال السنوات الخمس عشرة الماضية"), ("36 months of portfolio management experience within the past 15 years", "36 شهرًا من الخبرة في إدارة المحافظ خلال السنوات الخمس عشرة الماضية"))),
         exam={"questions": 170, "scored": None, "minutes": 240, "note": T("A panel of portfolio-management experts reviews your experience after you pay the fee; you schedule the exam after passing the panel review. English only.", "تراجع لجنة من خبراء إدارة المحافظ خبرتك بعد دفع الرسوم؛ وتجدول الاختبار بعد اجتياز مراجعة اللجنة. بالإنجليزية فقط.")},
         renewal={"pdus": 60, "years": 3},
         domains=dom(("Strategic Alignment", "المواءمة الاستراتيجية", 25), ("Governance", "الحوكمة", 20), ("Portfolio Performance", "أداء المحفظة", 25), ("Portfolio Risk Management", "إدارة مخاطر المحفظة", 15), ("Communications Management", "إدارة الاتصالات", 15)),
         status={"eligibility": V, "exam": V, "fee": P, "renewal": V, "domains": V}, sources=["SRC-PMI-PFMP"], url="https://www.pmi.org/certifications/portfolio-management-pfmp",
         routes=["ROUTE-PORTFOLIO"], courses=["CRS-PFM-PRIOR", "CRS-P3O-101", "CRS-P-21500", "CRS-PMO-KPI"], competencies=["PMO-02", "LDR-02", "GOV-01", "PERF-02"], toolkits=["iso21500", "pmoexc", "str"], next_certs=[],
         prepare=[(("Write your experience as decisions", "اكتب خبرتك كقرارات"), ("The panel looks for portfolio-level work: selection, balancing, governance and performance. Describe decisions you led and their effect.", "تبحث اللجنة عن عمل على مستوى المحفظة: الاختيار والموازنة والحوكمة والأداء. صف القرارات التي قدتها وأثرها."))]),
    cert("CERT-PMI-PBA", "pmi-pba", "PMI-PBA®", ("PMI Professional in Business Analysis", "محترف تحليل الأعمال من PMI"), "specialist", "analysis",
         ("A credential for business analysts working with projects and programmes: needs assessment, planning, analysis, traceability and evaluation.", "شهادة لمحللي الأعمال العاملين مع المشاريع والبرامج: تقييم الاحتياجات والتخطيط والتحليل والتتبع والتقييم."),
         ("Business analysts, product and requirements specialists, and project managers who own requirements.", "محللو الأعمال ومتخصصو المنتجات والمتطلبات، ومديرو المشاريع الذين يملكون المتطلبات."),
         eligibility=elig((("Set A", "المجموعة أ"), ("Secondary degree (high school diploma, associate's or equivalent)", "شهادة ثانوية (أو دبلوم مشارك أو ما يعادله)"), ("60 months of business analysis experience earned in the last 8 years", "60 شهرًا من الخبرة في تحليل الأعمال خلال السنوات الثماني الماضية"), ("35 contact hours in business analysis practices", "35 ساعة تعليمية في ممارسات تحليل الأعمال")),
                          (("Set B", "المجموعة ب"), ("Bachelor's or higher degree", "بكالوريوس أو أعلى"), ("36 months of business analysis experience earned in the last 8 years", "36 شهرًا من الخبرة في تحليل الأعمال خلال السنوات الثماني الماضية"), ("35 contact hours in business analysis practices", "35 ساعة تعليمية في ممارسات تحليل الأعمال")),
                          (("Set C", "المجموعة ج"), ("Bachelor's or postgraduate degree from a GAC-accredited programme", "بكالوريوس أو دراسات عليا من برنامج معتمد من GAC"), ("24 months of unique, non-overlapping business analysis experience", "24 شهرًا من الخبرة الفريدة غير المتداخلة في تحليل الأعمال"), ("35 contact hours of formal education", "35 ساعة تعليمية رسمية"))),
         exam={"questions": 200, "scored": None, "minutes": 240, "note": None}, renewal={"pdus": 60, "years": 3},
         domains=dom(("Needs Assessment", "تقييم الاحتياجات", 18), ("Planning", "التخطيط", 22), ("Analysis", "التحليل", 35), ("Traceability and Monitoring", "التتبع والمتابعة", 15), ("Evaluation", "التقييم", 10)),
         status={"eligibility": V, "exam": V, "fee": P, "renewal": V, "domains": V}, sources=["SRC-PMI-PBA"], url="https://www.pmi.org/certifications/business-analysis-pba",
         routes=["ROUTE-PM-FOUND"], courses=["CRS-PM-101", "CRS-PM-STAKE", "CRS-PM-AGILE"], competencies=["PM-02", "PM-01"], toolkits=["stakeholders"], next_certs=["CERT-PMP"],
         prepare=[(("Connect requirements to value", "اربط المتطلبات بالقيمة"), ("The business-case, benefits and stakeholder lessons give the base; analysis carries over a third of the weight.", "تعطي دروس دراسة الجدوى والمنافع وأصحاب المصلحة الأساس؛ ويحمل التحليل أكثر من ثلث الوزن."))]),
]
