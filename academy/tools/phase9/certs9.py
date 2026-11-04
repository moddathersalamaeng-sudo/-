"""Phase 9 certification explorer — ASQ certifications.

Facts (eligibility, exam format, fees, recertification) are taken only from ASQ's official pages (asq.org), opened on 4 Nov 2026.
Each fact group carries its own state:
  "verified"  — seen on the cited ASQ page that day;
  "secondary" — domains only: the question counts per Body of Knowledge area come from a training provider's published summary,
                because ASQ serves the BoK as a PDF that this session could not open; learners are told to confirm on ASQ;
  "pending"   — the page did not state it, or two ASQ pages disagree: no figures are stored and learners are sent to ASQ.
Only the NAMES of Body of Knowledge major areas and their question counts are stored — never BoK text and never exam questions.
Descriptions, study guidance and the mapping to CIA courses are original CIA wording. CIA is not an ASQ partner, awards no
recertification units (RUs) and makes no ASQ approval claim. CMQ/OE, CQA, CQE, CSSGB, CSSBB, CQIA, CCQM, CQT and CQI are ASQ
certification names, used only to identify them. Author: مدثر سلامه."""
T = lambda en, ar: {"en": en, "ar": ar}  # noqa: E731
CHECKED = "2026-11-04"
ASQ = "American Society for Quality (ASQ)"
V, S, P = "verified", "secondary", "pending"


def src(sid, title, url, area, note, org=ASQ, kind="official"):
    return {"id": sid, "source_id": sid, "organization": org, "title": title, "official_url": url, "source_type": kind,
            "accessed_date": CHECKED, "verified_date": CHECKED, "verification_status": "verified_by_lookup", "verification_note": note,
            "content_area": area, "owner": "مدثر سلامه", "review_date": "2027-02-04"}


SOURCES = [
    src("SRC-ASQ-CMQOE", "Manager of Quality/Organizational Excellence Certification (CMQ/OE) page", "https://www.asq.org/cert/manager-of-quality", "CMQ/OE",
        "Opened 4 Nov 2026: 10 years' experience (5 in a decision-making role), one education waiver (1–5 years); CBT 180 questions (165 scored), exam time 4 h 18 min, English; open book; fee $585, retake $385, members save $100 on the initial fee; 2026 BoK tested from the July 2026 window."),
    src("SRC-ASQ-CQA", "Quality Auditor Certification (CQA) page", "https://asq.org/cert/quality-auditor", "CQA",
        "Opened 4 Nov 2026: 8 years' experience (3 decision-making), one education waiver; CBT 165 questions (150 scored), exam time 5 h 18 min, English; open book; case studies about 10–15% of the test; fee $550, retake $350; 2026 BoK tested from the April 2026 window."),
    src("SRC-ASQ-CQE", "Quality Engineer Certification (CQE) page", "https://www.asq.org/cert/quality-engineer", "CQE",
        "Opened 4 Nov 2026: 8 years' experience (3 decision-making), one education waiver; CBT 175 questions (160 scored), exam time 5 h 18 min; English and several bilingual forms; open book; fee $550, retake $350."),
    src("SRC-ASQ-CSSGB", "Six Sigma Green Belt Certification (CSSGB) page", "https://www.asq.org/cert/six-sigma-green-belt", "CSSGB",
        "Opened 4 Nov 2026: 3 years' experience in the BoK, no education waivers; CBT 110 questions (100 scored), exam time 4 h 18 min, English; open book; fee $483, retake $283."),
    src("SRC-ASQ-CSSBB", "Six Sigma Black Belt Certification (CSSBB) page", "https://www.asq.org/cert/six-sigma-black-belt", "CSSBB",
        "Opened 4 Nov 2026: completed Six Sigma project(s) with signed affidavit and years of experience in the BoK (requirements table); CBT 165 questions (150 scored), exam time 4 h 18 min, English; open book; fee $585, retake $385."),
    src("SRC-ASQ-CCQM", "Construction Quality Manager (CCQM) page", "https://www.asq.org/cert/construction-quality", "CCQM",
        "Opened 4 Nov 2026: 8 years' experience (3 decision-making; up to 1 year from internship or apprenticeship), one education waiver; 165 questions (150 scored), exam time 4 h 18 min; open book; fee $550, retake $350. BoK area counts not listed on the page."),
    src("SRC-ASQ-CQIA", "Quality Improvement Associate Certification (CQIA) page", "https://asq.org/cert/quality-improvement-associate", "CQIA",
        "Opened 4 Nov 2026: two years of work experience, or an associate degree or two years of equivalent higher education; CBT 110 questions (100 scored), exam time 3 h 18 min, English; open book. Fees on this page ($294 members / $394 non-members, retake $184) differ from ASQ's fees page ($434) — fee left unconfirmed."),
    src("SRC-ASQ-CQT", "Quality Technician Certification (CQT) page", "https://www.asq.org/cert/quality-technician", "CQT",
        "Opened 4 Nov 2026: 4 years' experience, one education waiver (1–3 years); CBT 110 questions (100 scored), exam time 4 h 18 min, English; open book; fee $460, retake $260; 2024 CQT BoK."),
    src("SRC-ASQ-CQI", "Quality Inspector Certification (CQI) page", "https://www.asq.org/cert/quality-inspector", "CQI",
        "Opened 4 Nov 2026: 3 years' experience, a diploma or degree waives 2 years (one waiver); CBT 110 questions (100 scored), exam time 4 h 18 min, English; open book; fee $460, retake $260; 2025 CQI BoK."),
    src("SRC-ASQ-RECERT", "ASQ recertification page", "https://www.asq.org/cert/recertification", "ASQ recertification",
        "Opened 4 Nov 2026: 18 recertification units (RUs) in each three-year period (or retake the exam) for CMQ/OE, CQA, CQE, CSSBB, CCQM and others; CQIA, CQI, CQT, CSSGB, CQPA and CSSYB are lifetime certifications with no recertification requirement."),
    src("SRC-ASQ-FEES", "ASQ certification fees page", "https://asq.org/cert/fees", "ASQ fees",
        "Opened 4 Nov 2026: listed exam fees (for example CMQ/OE $585, CQA $550, CQE $550, CSSBB $585, CSSGB $483, CQIA $434, CQT $460, CQI $460, CCQM $550); ASQ members save $100 on initial exam fees; prices subject to change."),
    src("SRC-QG-CMQOE-2026", "CMQ/OE Body of Knowledge 2026 — what is new (training provider summary)", "https://www.qualitygurus.com/?p=516421", "CMQ/OE",
        "Provider's summary opened 4 Nov 2026: question counts per major area for the 2026 BoK (total 165). Used only for area names and counts; confirm in ASQ's BoK download.", org="Quality Gurus (training provider)", kind="secondary_summary_of_official"),
    src("SRC-QG-CQA-2026", "CQA Body of Knowledge 2026 — what is new (training provider summary)", "https://www.qualitygurus.com/?p=516328", "CQA",
        "Provider's summary opened 4 Nov 2026: question counts per major area for the 2026 BoK (total 150). Confirm in ASQ's BoK download.", org="Quality Gurus (training provider)", kind="secondary_summary_of_official"),
    src("SRC-QG-CQE-2022", "CQE Body of Knowledge 2022 — what is new (training provider summary)", "https://www.qualitygurus.com/?p=7954", "CQE",
        "Provider's summary opened 4 Nov 2026: question counts per major area of the 2022 BoK (tested from October 2022; total 160). Confirm the current BoK version on ASQ.", org="Quality Gurus (training provider)", kind="secondary_summary_of_official"),
    src("SRC-QG-CSSGB-2022", "CSSGB Body of Knowledge 2022 — what is new (training provider summary)", "https://www.qualitygurus.com/asq-cssgb-body-of-knowledge-2022-what-is-new/", "CSSGB",
        "Provider's summary opened 4 Nov 2026: question counts per major area of the 2022 BoK (tested from August 2022; total 100). Confirm the current BoK version on ASQ.", org="Quality Gurus (training provider)", kind="secondary_summary_of_official"),
    src("SRC-QG-CSSBB-2022", "CSSBB Body of Knowledge 2022 — what is new (training provider summary)", "https://www.qualitygurus.com/?p=8774", "CSSBB",
        "Provider's summary opened 4 Nov 2026: question counts per major area of the 2022 BoK (tested from September 2022; total 150). Confirm the current BoK version on ASQ.", org="Quality Gurus (training provider)", kind="secondary_summary_of_official"),
    {"id": "SRC-CIA-Q", "source_id": "SRC-CIA-Q", "organization": "Continual Improvement Academy", "title": "CIA original teaching synthesis — Quality (ASQ-informed) Academy",
     "official_url": "", "source_type": "owner", "accessed_date": CHECKED, "verified_date": CHECKED, "verification_status": "owner_publication",
     "verification_note": "Original CIA teaching content in independent wording; no ASQ Body of Knowledge text and no ASQ exam questions are reproduced.",
     "content_area": "Quality Academy curriculum", "owner": "مدثر سلامه", "review_date": "2027-05-04"},
]

WAIVERS = (("Education waivers (one only)", "إعفاءات التعليم (واحد فقط)"),
           ("Technical or trade school diploma: 1 year", "دبلوم مدرسة فنية أو مهنية: سنة واحدة"), ("Associate degree: 2 years", "دبلوم مشارك: سنتان"),
           ("Bachelor's degree: 4 years", "بكالوريوس: 4 سنوات"), ("Master's or doctorate: 5 years", "ماجستير أو دكتوراه: 5 سنوات"))
OPEN_BOOK = ("All ASQ exams are open book; bring bound references.", "جميع اختبارات ASQ بكتاب مفتوح؛ أحضر مراجع مجلدة.")


def elig(*opts):
    return [{"label": T(*o[0]), "items": [T(*x) for x in o[1:]]} for o in opts]


def bok(year, *xs):
    total = sum(n for _, _, n in xs)
    return {"version": year, "areas": [{"name": T(en, ar), "questions": n, "weight": round(100 * n / total, 1)} for en, ar, n in xs]}


def exam(q, scored, minutes, note=None):
    return {"questions": q, "scored": scored, "minutes": minutes, "note": T(*note) if note else T(*OPEN_BOOK)}


def fee(full, retake):
    return {"member": full - 100, "non_member": full, "retake": retake, "currency": "USD",
            "note": T("ASQ members save $100 on the initial exam fee; the retake rate applies within two years of an attempt. Prices are subject to change.",
                      "يوفر أعضاء ASQ مئة دولار من رسوم الاختبار الأول؛ وتنطبق رسوم الإعادة خلال سنتين من المحاولة. والأسعار عرضة للتغيير.")}


RU = {"units": 18, "unit": "RU", "years": 3}
LIFE = {"lifetime": True}


def cert(cid, slug, code, name, stage, area, summary, who, *, eligibility=None, exam_=None, fee_=None, renewal=None, domains=None, languages=None,
         extra=None, status, sources, url, routes, courses, competencies, toolkits, next_certs, prepare, study=None):
    d = domains or {"version": None, "areas": []}
    return {"id": cid, "slug": slug, "code": code, "body": "ASQ", "name": T(*name), "stage": stage, "area": area,
            "summary": T(*summary), "who": T(*who), "eligibility": eligibility or [], "exam": exam_, "fee": fee_, "renewal": renewal,
            "domains": d["areas"], "domain_unit": "questions", "bok_version": d["version"], "languages": T(*languages) if languages else None,
            "extra": [T(*x) for x in (extra or [])], "facts_status": status, "verified_date": CHECKED, "source_ids": sources, "official_url": url,
            "cia_routes": routes, "cia_courses": courses, "competencies": competencies, "toolkits": toolkits, "next": next_certs,
            "prepare": [{"title": T(*p[0]), "text": T(*p[1])} for p in prepare], "study_plan": study,
            "claims": T("CIA is not an ASQ partner and its courses are not ASQ-approved. CIA courses award no recertification units (RUs), do not reproduce the ASQ Body of Knowledge or exam questions, and do not guarantee eligibility or an exam result. Always confirm requirements on ASQ's site before applying.",
                        "CIA ليست شريكًا لـ ASQ، ودوراتها ليست معتمدة من ASQ. ولا تمنح دورات CIA وحدات إعادة اعتماد (RUs)، ولا تستنسخ مجالات المعرفة الخاصة بـ ASQ أو أسئلة اختباراتها، ولا تضمن الأهلية ولا نتيجة الاختبار. تحقق دائمًا من المتطلبات على موقع ASQ قبل التقديم."),
            "governance": {"content_status": "needs_review", "content_source": "external_public", "version": "1.0.0", "reviewer": None, "review_date": None,
                           "change_note": "Phase 9 certification explorer (4 Nov 2026): facts from ASQ's official pages opened that day; BoK area counts from dated provider summaries where marked; descriptions and study guidance are original CIA wording."}}


CMQOE_BOK = bok("2026", ("Leadership", "القيادة", 28), ("Strategic Plan Development and Deployment", "وضع الخطة الاستراتيجية ونشرها", 23),
                ("Management Elements and Methods", "عناصر الإدارة وأساليبها", 26), ("Quality Management Tools", "أدوات إدارة الجودة", 31),
                ("Customer-Focused Organizations", "المنظمات المتمحورة حول العميل", 22), ("Supply Chain Management", "إدارة سلسلة الإمداد", 19),
                ("Training and Development", "التدريب والتطوير", 16))

CMQOE_STUDY = {
    "weeks": 12, "hours_per_week": 8,
    "phases": [
        {"weeks": "1", "title": T("Diagnose and plan", "التشخيص والتخطيط"), "text": T("Take the CMQ/OE Center diagnostic, download the current BoK from ASQ, choose your testing window and fix weekly hours.", "أدِّ تقييم مركز CMQ/OE التشخيصي، ونزّل مجالات المعرفة الحالية من ASQ، واختر نافذة الاختبار وحدّد ساعاتك الأسبوعية."), "courses": ["CRS-CMQOE-PREP"], "domain": None},
        {"weeks": "2–3", "title": T("Leadership; training and development", "القيادة؛ والتدريب والتطوير"), "text": T("Leadership styles, change, teams, and training needs and evaluation.", "أساليب القيادة والتغيير والفرق، واحتياجات التدريب وتقييمه."), "courses": ["CRS-CMQOE-PREP"], "domain": 0},
        {"weeks": "4–5", "title": T("Strategy and management methods", "الاستراتيجية وأساليب الإدارة"), "text": T("Environmental analysis, deployment, balanced measures; project and process management and the financial case.", "تحليل البيئة والنشر والمقاييس المتوازنة؛ وإدارة المشاريع والعمليات والحالة المالية."), "courses": ["CRS-CMQOE-PREP", "CRS-Q-COQ", "CRS-PM-101"], "domain": 1},
        {"weeks": "6–7", "title": T("Quality management tools", "أدوات إدارة الجودة"), "text": T("Basic and management tools, problem solving, SPC basics and improvement methods — the largest area by question count.", "الأدوات الأساسية والإدارية وحل المشكلات وأساسيات الضبط الإحصائي وأساليب التحسين — أكبر مجال من حيث عدد الأسئلة."), "courses": ["CRS-Q-TOOLS", "CRS-Q-CAPA", "CRS-Q-SPC"], "domain": 3},
        {"weeks": "8–9", "title": T("Customers and supply chain", "العملاء وسلسلة الإمداد"), "text": T("Voice of the customer, complaints and loyalty; supplier selection, performance and development.", "صوت العميل والشكاوى والولاء؛ واختيار الموردين وأداؤهم وتطويرهم."), "courses": ["CRS-QMS-201", "CRS-Q-SUPPLIER"], "domain": 4},
        {"weeks": "10–11", "title": T("Mixed timed practice", "تدريب موقوت مختلط"), "text": T("Timed mixed sets with your indexed references; review every error and re-study the weakest area from the Center.", "مجموعات موقوتة مختلطة مع مراجعك المفهرسة؛ وراجع كل خطأ وأعد مذاكرة أضعف مجال من المركز."), "courses": [], "domain": None},
        {"weeks": "12", "title": T("Rehearsal and rest", "بروفة وراحة"), "text": T("One full-length timed rehearsal in exam conditions, final error-log review, rest the day before.", "بروفة كاملة موقوتة في ظروف الاختبار، ومراجعة نهائية لسجل الأخطاء، وراحة في اليوم السابق."), "courses": [], "domain": None},
    ]}

CERTS = [
    cert("CERT-CMQOE", "cmq-oe", "CMQ/OE", ("Certified Manager of Quality/Organizational Excellence", "مدير معتمد للجودة/التميز المؤسسي"), "senior", "management",
         ("ASQ's credential for leaders of quality and organisational excellence: leadership, strategy, management methods, quality tools, customers, the supply chain and training. A new Body of Knowledge has been tested since July 2026.",
          "شهادة ASQ لقادة الجودة والتميز المؤسسي: القيادة والاستراتيجية وأساليب الإدارة وأدوات الجودة والعملاء وسلسلة الإمداد والتدريب. ويُختبر بمجالات معرفة جديدة منذ يوليو 2026."),
         ("Quality managers, heads of excellence and senior professionals with long experience in decision-making roles.", "مديرو الجودة ورؤساء التميز والمحترفون الكبار ذوو الخبرة الطويلة في أدوار صنع القرار."),
         eligibility=elig((("Experience", "الخبرة"), ("10 years of on-the-job experience in one or more areas of the BoK", "10 سنوات من الخبرة العملية في مجال أو أكثر من مجالات المعرفة"), ("5 of those years in a decision-making position", "5 سنوات منها في موقع صنع قرار"), ("Full-time, paid role", "دور بدوام كامل مدفوع الأجر")), WAIVERS),
         exam_=exam(180, 165, 258, ("Computer-based, English, one part; 4.5-hour appointment. Open book; an on-screen calculator is provided.", "حاسوبي، بالإنجليزية، جزء واحد؛ ومدة الموعد 4.5 ساعات. بكتاب مفتوح؛ وتُوفر آلة حاسبة على الشاشة.")),
         fee_=fee(585, 385), renewal=RU, domains=CMQOE_BOK,
         extra=[("A paper-based version (165 questions, 4 hours) is offered in certain locations, also in Mandarin.", "تُقدم نسخة ورقية (165 سؤالًا، 4 ساعات) في مواقع معينة، وبالماندرين أيضًا.")],
         status={"eligibility": V, "exam": V, "fee": V, "renewal": V, "domains": S}, sources=["SRC-ASQ-CMQOE", "SRC-ASQ-RECERT", "SRC-ASQ-FEES", "SRC-QG-CMQOE-2026"],
         url="https://www.asq.org/cert/manager-of-quality",
         routes=["ROUTE-Q-CMQOE"], courses=["CRS-CMQOE-PREP", "CRS-QMS-201", "CRS-Q-TOOLS", "CRS-Q-COQ", "CRS-Q-SUPPLIER", "CRS-Q-CAPA"],
         competencies=["LDR-01", "LDR-02", "QM-01", "QM-02", "QM-04", "OE-02", "PERF-01"], toolkits=["swot", "pestle", "stakeholders", "exc"], next_certs=[],
         prepare=[(("Check your experience honestly", "تحقق من خبرتك بأمانة"), ("Count decision-making years separately and apply only one education waiver; keep evidence of each role.", "احسب سنوات صنع القرار منفصلة وطبّق إعفاء تعليم واحدًا فقط؛ واحتفظ بأدلة كل دور.")),
                  (("Use the CMQ/OE Center", "استخدم مركز CMQ/OE"), ("Take the Center's diagnostic; it shows your weak areas against the seven major BoK areas.", "أدِّ تقييم المركز التشخيصي؛ فهو يُظهر مواطن ضعفك مقابل المجالات الرئيسية السبعة.")),
                  (("Plan by weight and weakness", "خطط حسب الوزن والضعف"), ("Quality management tools carry the most questions; but your weakest areas need extra time.", "تحمل أدوات إدارة الجودة أكثر الأسئلة؛ لكن أضعف مجالاتك تحتاج إلى وقت إضافي.")),
                  (("Prepare your references", "حضّر مراجعك"), ("Open book means a few well-indexed references, not many; practise finding answers fast.", "الكتاب المفتوح يعني مراجع قليلة مفهرسة جيدًا، لا كثيرة؛ وتدرّب على إيجاد الإجابات بسرعة."))],
         study=CMQOE_STUDY),
    cert("CERT-CQA", "cqa", "CQA", ("Certified Quality Auditor", "مدقق جودة معتمد"), "practitioner", "auditing",
         ("ASQ's credential for professional auditors: auditing fundamentals, the audit process, auditor competencies, audit programme management and quality tools. A new Body of Knowledge has been tested since April 2026.",
          "شهادة ASQ للمدققين المحترفين: أساسيات التدقيق وعملية التدقيق وكفاءات المدقق وإدارة برنامج التدقيق وأدوات الجودة. ويُختبر بمجالات معرفة جديدة منذ أبريل 2026."),
         ("Internal, supplier and lead auditors who want an auditing credential beyond a single standard.", "المدققون الداخليون ومدققو الموردين والمدققون الرئيسيون الذين يريدون شهادة تدقيق تتجاوز معيارًا واحدًا."),
         eligibility=elig((("Experience", "الخبرة"), ("8 years of on-the-job experience in one or more areas of the BoK", "8 سنوات من الخبرة العملية في مجال أو أكثر من مجالات المعرفة"), ("3 of those years in a decision-making position", "3 سنوات منها في موقع صنع قرار"), ("Full-time, paid role", "دور بدوام كامل مدفوع الأجر")), WAIVERS),
         exam_=exam(165, 150, 318, ("Computer-based, English, one part; 5.5-hour appointment. Open book; case studies are about 10–15% of the test.", "حاسوبي، بالإنجليزية، جزء واحد؛ ومدة الموعد 5.5 ساعات. بكتاب مفتوح؛ ودراسات الحالة نحو 10–15% من الاختبار.")),
         fee_=fee(550, 350), renewal=RU,
         domains=bok("2026", ("Auditing Fundamentals", "أساسيات التدقيق", 37), ("Audit Process", "عملية التدقيق", 45), ("Auditor Competencies", "كفاءات المدقق", 30),
                     ("Audit Program Management and Business Applications", "إدارة برنامج التدقيق وتطبيقاته في الأعمال", 23), ("Quality Tools and Techniques", "أدوات الجودة وتقنياتها", 15)),
         status={"eligibility": V, "exam": V, "fee": V, "renewal": V, "domains": S}, sources=["SRC-ASQ-CQA", "SRC-ASQ-RECERT", "SRC-ASQ-FEES", "SRC-QG-CQA-2026"],
         url="https://asq.org/cert/quality-auditor",
         routes=["ROUTE-Q-AUDITOR"], courses=["CRS-Q-AUDIT", "CRS-ISO-AUD", "CRS-ISO-9001-AUD", "CRS-Q-SUPPLIER", "CRS-Q-TOOLS"],
         competencies=["AUD-01", "AUD-02", "AUD-03", "QM-03"], toolkits=["aud", "oec", "capa"], next_certs=["CERT-CMQOE"],
         prepare=[(("Combine ISO and ASQ views", "اجمع منظوري ISO وASQ"), ("Take the Quality Auditing course with the ISO auditing fundamentals course: process, product and system audits, evidence and reporting.", "خذ دورة تدقيق الجودة مع دورة أساسيات التدقيق في أكاديمية ISO: تدقيق العمليات والمنتجات والأنظمة والأدلة والتقارير.")),
                  (("Practise case studies", "تدرّب على دراسات الحالة"), ("Case studies are a share of the exam; practise reading a situation and choosing the auditor's correct action.", "دراسات الحالة جزء من الاختبار؛ فتدرّب على قراءة الموقف واختيار الإجراء الصحيح للمدقق."))]),
    cert("CERT-CQE", "cqe", "CQE", ("Certified Quality Engineer", "مهندس جودة معتمد"), "practitioner", "engineering",
         ("ASQ's credential for quality engineers: management and leadership, the quality system, product and process design, process control, continuous improvement, quantitative methods and risk management.",
          "شهادة ASQ لمهندسي الجودة: الإدارة والقيادة، ونظام الجودة، وتصميم المنتجات والعمليات، وضبط العمليات، والتحسين المستمر، والأساليب الكمية، وإدارة المخاطر."),
         ("Quality and process engineers with several years of hands-on experience.", "مهندسو الجودة والعمليات ذوو سنوات من الخبرة العملية."),
         eligibility=elig((("Experience", "الخبرة"), ("8 years of on-the-job experience in one or more areas of the BoK", "8 سنوات من الخبرة العملية في مجال أو أكثر من مجالات المعرفة"), ("3 of those years in a decision-making position", "3 سنوات منها في موقع صنع قرار"), ("Full-time, paid role", "دور بدوام كامل مدفوع الأجر")), WAIVERS),
         exam_=exam(175, 160, 318, ("Computer-based, one part; 5.5-hour appointment. English and bilingual forms (English with German, Spanish, Mandarin, Polish, Czech or Slovak). Open book.", "حاسوبي، جزء واحد؛ ومدة الموعد 5.5 ساعات. بالإنجليزية ونماذج ثنائية اللغة (الإنجليزية مع الألمانية أو الإسبانية أو الماندرين أو البولندية أو التشيكية أو السلوفاكية). بكتاب مفتوح.")),
         fee_=fee(550, 350), renewal=RU,
         domains=bok("2022", ("Management and Leadership", "الإدارة والقيادة", 17), ("The Quality System", "نظام الجودة", 18), ("Product, Process, and Service Design", "تصميم المنتجات والعمليات والخدمات", 21),
                     ("Product and Process Control", "ضبط المنتجات والعمليات", 23), ("Continuous Improvement", "التحسين المستمر", 26), ("Quantitative Methods and Tools", "الأساليب والأدوات الكمية", 34), ("Risk Management", "إدارة المخاطر", 21)),
         status={"eligibility": V, "exam": V, "fee": V, "renewal": V, "domains": S}, sources=["SRC-ASQ-CQE", "SRC-ASQ-RECERT", "SRC-ASQ-FEES", "SRC-QG-CQE-2022"],
         url="https://www.asq.org/cert/quality-engineer",
         routes=["ROUTE-Q-ENGINEER"], courses=["CRS-QMS-201", "CRS-Q-TOOLS", "CRS-Q-SPC", "CRS-Q-CAPA", "CRS-Q-SUPPLIER", "CRS-M-FMEA", "CRS-ISO-RISK"],
         competencies=["QM-02", "QM-03", "QM-04", "RSK-01", "PERF-01"], toolkits=["fmea", "dmaic", "iso10009"], next_certs=["CERT-CSSBB", "CERT-CMQOE"],
         prepare=[(("Quantitative methods first", "الأساليب الكمية أولًا"), ("Quantitative methods carry the most questions; the SPC and Quality Tools courses are the base, then deeper statistics.", "تحمل الأساليب الكمية أكثر الأسئلة؛ ودورتا الضبط الإحصائي وأدوات الجودة الأساس، ثم إحصاء أعمق.")),
                  (("Practise calculations with your calculator", "تدرّب على الحسابات بآلتك الحاسبة"), ("Many items need calculation; practise with the calculator type you will use.", "تحتاج أسئلة كثيرة إلى حساب؛ فتدرّب بنوع الآلة الحاسبة الذي ستستخدمه."))]),
    cert("CERT-CSSGB", "cssgb", "CSSGB", ("Certified Six Sigma Green Belt", "حزام أخضر معتمد في ستة سيجما"), "practitioner", "improvement",
         ("ASQ's Green Belt credential: the DMAIC phases and Six Sigma's place in the organisation. It is a lifetime certification with no recertification requirement.",
          "شهادة الحزام الأخضر من ASQ: مراحل DMAIC ومكانة ستة سيجما في المنظمة. وهي شهادة مدى الحياة بلا متطلب لإعادة الاعتماد."),
         ("Engineers, analysts and team leaders who work on or lead improvement projects.", "المهندسون والمحللون وقادة الفرق الذين يعملون في مشاريع التحسين أو يقودونها."),
         eligibility=elig((("Experience", "الخبرة"), ("3 years of on-the-job experience in one or more areas of the BoK", "3 سنوات من الخبرة العملية في مجال أو أكثر من مجالات المعرفة"), ("Full-time, paid role", "دور بدوام كامل مدفوع الأجر"), ("No education waivers for this exam", "لا إعفاءات تعليمية لهذا الاختبار"))),
         exam_=exam(110, 100, 258, ("Computer-based, English, one part; 4.5-hour appointment. Open book.", "حاسوبي، بالإنجليزية، جزء واحد؛ ومدة الموعد 4.5 ساعات. بكتاب مفتوح.")),
         fee_=fee(483, 283), renewal=LIFE,
         domains=bok("2022", ("Overview: Six Sigma and the Organization", "نظرة عامة: ستة سيجما والمنظمة", 11), ("Define Phase", "مرحلة التعريف", 20), ("Measure Phase", "مرحلة القياس", 20),
                     ("Analyze Phase", "مرحلة التحليل", 18), ("Improve Phase", "مرحلة التحسين", 16), ("Control Phase", "مرحلة التحكم", 15)),
         status={"eligibility": V, "exam": V, "fee": V, "renewal": V, "domains": S}, sources=["SRC-ASQ-CSSGB", "SRC-ASQ-RECERT", "SRC-ASQ-FEES", "SRC-QG-CSSGB-2022"],
         url="https://www.asq.org/cert/six-sigma-green-belt",
         routes=["ROUTE-Q-SSGB"], courses=["CRS-LSS-GB", "CRS-Q-TOOLS", "CRS-Q-SPC", "CRS-Q-CAPA", "CRS-M-DMAIC"],
         competencies=["QM-02", "QM-03", "OE-02"], toolkits=["dmaic", "a3", "fmea"], next_certs=["CERT-CSSBB"],
         prepare=[(("Follow DMAIC end to end", "تتبّع DMAIC من البداية إلى النهاية"), ("Take the Green Belt Foundations course and run one small project with the platform's DMAIC toolkit.", "خذ دورة أساسيات الحزام الأخضر ونفّذ مشروعًا صغيرًا بأداة DMAIC في المنصة.")),
                  (("Measure and Define carry the most", "التعريف والقياس يحملان أكثر"), ("Define and Measure together are 40 of 100 scored items in the 2022 BoK counts; check the current BoK on ASQ.", "التعريف والقياس معًا 40 من 100 سؤال محتسب في أعداد مجالات 2022؛ وتحقق من المجالات الحالية على ASQ."))]),
    cert("CERT-CSSBB", "cssbb", "CSSBB", ("Certified Six Sigma Black Belt", "حزام أسود معتمد في ستة سيجما"), "senior", "improvement",
         ("ASQ's Black Belt credential for people who lead improvement projects and teams: deployment, process management, team management, DMAIC in depth and design for Six Sigma. A completed project with a signed affidavit is required.",
          "شهادة الحزام الأسود من ASQ لمن يقودون مشاريع التحسين وفرقها: النشر وإدارة العمليات وإدارة الفرق وDMAIC بعمق والتصميم لستة سيجما. ويُشترط مشروع مكتمل بإقرار موقّع."),
         ("Green Belts and improvement leads who have completed real projects.", "أصحاب الحزام الأخضر وقادة التحسين الذين أكملوا مشاريع حقيقية."),
         eligibility=elig((("Option 1", "الخيار 1"), ("Two completed Six Sigma projects with signed affidavits", "مشروعان مكتملان في ستة سيجما بإقرارات موقّعة")),
                          (("Option 2", "الخيار 2"), ("One completed Six Sigma project with a signed affidavit", "مشروع مكتمل واحد في ستة سيجما بإقرار موقّع"), ("3 years of on-the-job experience in one or more areas of the BoK", "3 سنوات من الخبرة العملية في مجال أو أكثر من مجالات المعرفة")),
                          (("For both", "للخيارين"), ("Full-time, paid role", "دور بدوام كامل مدفوع الأجر"))),
         exam_=exam(165, 150, 258, ("Computer-based, English, one part; 4.5-hour appointment. Open book; programmable calculators are not allowed.", "حاسوبي، بالإنجليزية، جزء واحد؛ ومدة الموعد 4.5 ساعات. بكتاب مفتوح؛ ولا يُسمح بالآلات الحاسبة القابلة للبرمجة.")),
         fee_=fee(585, 385), renewal=RU,
         domains=bok("2022", ("Organization-wide Planning and Deployment", "التخطيط والنشر على مستوى المنظمة", 12), ("Organizational Process Management and Measures", "إدارة العمليات المؤسسية ومقاييسها", 12),
                     ("Team Management", "إدارة الفرق", 15), ("Define Phase", "مرحلة التعريف", 20), ("Measure Phase", "مرحلة القياس", 25), ("Analyze Phase", "مرحلة التحليل", 22),
                     ("Improve Phase", "مرحلة التحسين", 21), ("Control Phase", "مرحلة التحكم", 17), ("Design for Six Sigma (DFSS) Framework and Methodologies", "إطار التصميم لستة سيجما وأساليبه", 6)),
         extra=[("ASQ's requirements table pairs the number of completed projects with the experience requirement; read it on the page before applying.", "يقرن جدول متطلبات ASQ عدد المشاريع المكتملة بمتطلب الخبرة؛ فاقرأه على الصفحة قبل التقديم.")],
         status={"eligibility": V, "exam": V, "fee": V, "renewal": V, "domains": S}, sources=["SRC-ASQ-CSSBB", "SRC-ASQ-RECERT", "SRC-ASQ-FEES", "SRC-QG-CSSBB-2022"],
         url="https://www.asq.org/cert/six-sigma-black-belt",
         routes=["ROUTE-Q-SSGB"], courses=["CRS-LSS-GB", "CRS-Q-SPC", "CRS-M-DMAIC", "CRS-M-FMEA", "CRS-CMQOE-PREP"],
         competencies=["QM-02", "QM-03", "OE-02", "LDR-01"], toolkits=["dmaic", "fmea", "a3"], next_certs=["CERT-CMQOE"],
         prepare=[(("Document your projects", "وثّق مشاريعك"), ("Write each project as a DMAIC storyboard with data and a signed affidavit from the sponsor.", "اكتب كل مشروع لوحة قصة DMAIC بالبيانات وإقرار موقّع من الراعي.")),
                  (("Deepen Measure and Analyze", "عمّق القياس والتحليل"), ("Measure and Analyze carry the most items in the 2022 counts; statistics needs real practice.", "يحمل القياس والتحليل أكثر الأسئلة في أعداد 2022؛ والإحصاء يحتاج إلى تدريب حقيقي."))]),
    cert("CERT-CCQM", "ccqm", "CCQM", ("Certified Construction Quality Manager", "مدير جودة إنشاءات معتمد"), "practitioner", "construction",
         ("ASQ's credential for quality managers in design and construction projects.", "شهادة ASQ لمديري الجودة في مشاريع التصميم والإنشاء."),
         ("Quality managers and engineers on construction, infrastructure and EPC projects — common in Saudi giga-projects and utilities.", "مديرو الجودة ومهندسوها في مشاريع الإنشاءات والبنية التحتية ومشاريع الهندسة والتوريد والإنشاء — الشائعة في المشاريع السعودية الكبرى والمرافق."),
         eligibility=elig((("Experience", "الخبرة"), ("8 years of on-the-job experience in one or more areas of the BoK", "8 سنوات من الخبرة العملية في مجال أو أكثر من مجالات المعرفة"), ("3 of those years in a decision-making position", "3 سنوات منها في موقع صنع قرار"), ("Up to 1 year may come from an internship or apprenticeship", "يمكن أن تأتي سنة واحدة كحد أقصى من تدريب داخلي أو تلمذة مهنية"), ("Full-time, paid role", "دور بدوام كامل مدفوع الأجر")), WAIVERS),
         exam_=exam(165, 150, 258, ("Computer-based, English, one part; 4.5-hour appointment. Open book.", "حاسوبي، بالإنجليزية، جزء واحد؛ ومدة الموعد 4.5 ساعات. بكتاب مفتوح.")),
         fee_=fee(550, 350), renewal=RU,
         status={"eligibility": V, "exam": V, "fee": V, "renewal": V, "domains": P}, sources=["SRC-ASQ-CCQM", "SRC-ASQ-RECERT", "SRC-ASQ-FEES"],
         url="https://www.asq.org/cert/construction-quality",
         routes=["ROUTE-Q-CMQOE"], courses=["CRS-QMS-201", "CRS-Q-AUDIT", "CRS-Q-SUPPLIER", "CRS-Q-CAPA", "CRS-Q-COQ"],
         competencies=["QM-01", "QM-03", "QM-04", "AUD-02"], toolkits=["capa", "iso9001"], next_certs=["CERT-CMQOE"],
         prepare=[(("Map the BoK to your project", "اربط مجالات المعرفة بمشروعك"), ("Download the CCQM BoK from ASQ and map each area to your project's quality plan, inspections and supplier controls.", "نزّل مجالات معرفة CCQM من ASQ واربط كل مجال بخطة جودة مشروعك وعمليات الفحص وضوابط الموردين."))]),
    cert("CERT-CQIA", "cqia", "CQIA", ("Certified Quality Improvement Associate", "مشارك معتمد في تحسين الجودة"), "entry", "foundations",
         ("ASQ's entry-level credential in quality basics, teams and continuous-improvement tools. It is a lifetime certification with no recertification requirement.",
          "شهادة ASQ للمبتدئين في أساسيات الجودة والفرق وأدوات التحسين المستمر. وهي شهادة مدى الحياة بلا متطلب لإعادة الاعتماد."),
         ("Team members, coordinators and graduates starting in quality.", "أعضاء الفرق والمنسقون والخريجون المبتدئون في الجودة."),
         eligibility=elig((("Requirement", "المتطلب"), ("Two years of work experience, or an associate degree, or two years of equivalent higher education", "سنتان من الخبرة العملية، أو دبلوم مشارك، أو سنتان من التعليم العالي المكافئ"))),
         exam_=exam(110, 100, 198, ("Computer-based, English, one part; 3.5-hour appointment. Open book.", "حاسوبي، بالإنجليزية، جزء واحد؛ ومدة الموعد 3.5 ساعات. بكتاب مفتوح.")),
         renewal=LIFE,
         extra=[("Two ASQ pages showed different CQIA fees on 4 November 2026, so the fee is not stated here — check ASQ.", "أظهرت صفحتان من ASQ رسومًا مختلفة لـ CQIA في 4 نوفمبر 2026، لذا لا تُذكر الرسوم هنا — تحقق من ASQ.")],
         status={"eligibility": V, "exam": V, "fee": P, "renewal": V, "domains": P}, sources=["SRC-ASQ-CQIA", "SRC-ASQ-RECERT", "SRC-ASQ-FEES"],
         url="https://asq.org/cert/quality-improvement-associate",
         routes=["ROUTE-Q-FOUND"], courses=["CRS-QMS-201", "CRS-Q-TOOLS", "CRS-Q-CAPA", "CRS-M-PDCA"],
         competencies=["QM-01", "QM-02", "QM-03"], toolkits=["pdca", "pareto", "fish"], next_certs=["CERT-CSSGB", "CERT-CQT"],
         prepare=[(("Start with the foundations route", "ابدأ بمسار الأساسيات"), ("Quality Management Foundations, Quality Tools and Problem Solving cover most of what a first credential needs.", "تغطي أساسيات إدارة الجودة وأدوات الجودة وحل المشكلات معظم ما تحتاجه أول شهادة."))]),
    cert("CERT-CQT", "cqt", "CQT", ("Certified Quality Technician", "فني جودة معتمد"), "entry", "inspection",
         ("ASQ's credential for quality technicians who analyse problems, prepare inspection plans, support audits and apply statistical process control. Lifetime certification.",
          "شهادة ASQ لفنيي الجودة الذين يحللون المشكلات ويعدّون خطط الفحص ويدعمون التدقيق ويطبقون الضبط الإحصائي. شهادة مدى الحياة."),
         ("Quality technicians and senior inspectors.", "فنيو الجودة وكبار المفتشين."),
         eligibility=elig((("Experience", "الخبرة"), ("4 years of on-the-job experience in one or more areas of the BoK", "4 سنوات من الخبرة العملية في مجال أو أكثر من مجالات المعرفة"), ("Full-time, paid role", "دور بدوام كامل مدفوع الأجر")),
                          (("Education waivers (one only)", "إعفاءات التعليم (واحد فقط)"), ("Quality technology certificate: 1 year", "شهادة في تقنية الجودة: سنة واحدة"), ("Associate degree: 2 years", "دبلوم مشارك: سنتان"), ("Bachelor's, master's or doctorate: 3 years", "بكالوريوس أو ماجستير أو دكتوراه: 3 سنوات"))),
         exam_=exam(110, 100, 258, ("Computer-based, English, one part; 4.5-hour appointment. Open book.", "حاسوبي، بالإنجليزية، جزء واحد؛ ومدة الموعد 4.5 ساعات. بكتاب مفتوح.")),
         fee_=fee(460, 260), renewal=LIFE,
         status={"eligibility": V, "exam": V, "fee": V, "renewal": V, "domains": P}, sources=["SRC-ASQ-CQT", "SRC-ASQ-RECERT", "SRC-ASQ-FEES"],
         url="https://www.asq.org/cert/quality-technician",
         routes=["ROUTE-Q-ENGINEER"], courses=["CRS-Q-TOOLS", "CRS-Q-SPC", "CRS-Q-CAPA", "CRS-Q-SUPPLIER"],
         competencies=["QM-02", "QM-03"], toolkits=["pareto", "iso10009"], next_certs=["CERT-CQE"],
         prepare=[(("Tools and SPC", "الأدوات والضبط الإحصائي"), ("Quality Tools and SPC Basics are the core; practise reading charts and calculating with your calculator.", "أدوات الجودة وأساسيات الضبط الإحصائي هي الجوهر؛ وتدرّب على قراءة الخرائط والحساب بآلتك الحاسبة."))]),
    cert("CERT-CQI", "cqi", "CQI", ("Certified Quality Inspector", "مفتش جودة معتمد"), "entry", "inspection",
         ("ASQ's credential for inspectors who check products and documentation, measure process performance and report results. Lifetime certification.",
          "شهادة ASQ للمفتشين الذين يفحصون المنتجات والمستندات ويقيسون أداء العمليات ويرفعون النتائج. شهادة مدى الحياة."),
         ("Inspectors and test technicians in manufacturing and construction.", "المفتشون وفنيو الاختبار في الصناعة والإنشاءات."),
         eligibility=elig((("Experience", "الخبرة"), ("3 years of on-the-job experience in one or more areas of the BoK", "3 سنوات من الخبرة العملية في مجال أو أكثر من مجالات المعرفة"), ("Full-time, paid role", "دور بدوام كامل مدفوع الأجر"), ("A technical, military or trade diploma, or a degree, waives 2 years (one waiver)", "دبلوم فني أو عسكري أو مهني، أو شهادة جامعية، يعفي من سنتين (إعفاء واحد)"))),
         exam_=exam(110, 100, 258, ("Computer-based, English, one part; 4.5-hour appointment. Open book.", "حاسوبي، بالإنجليزية، جزء واحد؛ ومدة الموعد 4.5 ساعات. بكتاب مفتوح.")),
         fee_=fee(460, 260), renewal=LIFE,
         status={"eligibility": V, "exam": V, "fee": V, "renewal": V, "domains": P}, sources=["SRC-ASQ-CQI", "SRC-ASQ-RECERT", "SRC-ASQ-FEES"],
         url="https://www.asq.org/cert/quality-inspector",
         routes=["ROUTE-Q-FOUND"], courses=["CRS-QMS-201", "CRS-Q-TOOLS", "CRS-Q-SUPPLIER"],
         competencies=["QM-02", "QM-04"], toolkits=["pareto"], next_certs=["CERT-CQT"],
         prepare=[(("Measurement and sampling", "القياس والمعاينة"), ("Focus on measurement, sampling and inspection planning; the Supplier Quality course covers incoming inspection.", "ركّز على القياس والمعاينة وتخطيط الفحص؛ وتغطي دورة جودة الموردين الفحص عند الاستلام."))]),
]
