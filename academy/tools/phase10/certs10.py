"""Phase 10 recognition explorer — EFQM recognition levels, the EFQM Global Award and EFQM assessor training.

Facts are taken only from EFQM's own pages (efqm.org, shop.efqm.org), opened on 6 Nov 2026. Each fact group has its own state:
  "verified" — seen on the cited EFQM page that day;
  "pending"  — the page did not state it, could not be read, or two EFQM pages disagree: no figures are stored and learners are
               sent to EFQM.
EFQM fact groups map onto the explorer's groups as: eligibility = who can apply; exam = how the assessment works (label/value rows);
fee = published fees (none are published — always pending); renewal = how long a recognition is valid; domains = what is
assessed (names only: the three dimensions or the seven criterion NAMES of the EFQM Model 2025 — never criterion text).
King Abdulaziz Quality Award facts (official Saudi government pages) are used in CRS-EX-AWARD and on the landing page only.
CIA is not an EFQM partner, does not train or license assessors, gives no recognition or award result and makes no "EFQM-approved"
claim. EFQM, "Recognised by EFQM", "Validated by EFQM" and "EFQM Global Award" are EFQM's names, used only to identify them.
Author: مدثر سلامه."""
T = lambda en, ar: {"en": en, "ar": ar}  # noqa: E731
CHECKED = "2026-11-06"
EFQM = "EFQM"
V, P = "verified", "pending"


def src(sid, title, url, area, note, org=EFQM, kind="official"):
    return {"id": sid, "source_id": sid, "organization": org, "title": title, "official_url": url, "source_type": kind,
            "accessed_date": CHECKED, "verified_date": CHECKED, "verification_status": "verified_by_lookup", "verification_note": note,
            "content_area": area, "owner": "مدثر سلامه", "review_date": "2027-02-06"}


SOURCES = [
    src("SRC-EFQM-ASSESS", "EFQM Assessment page (Rapid and Advanced pathways)", "https://efqm.org/assess/", "EFQM recognition",
        "Opened 6 Nov 2026: two pathways — Rapid (condensed model, rapid diagnostic workshop, leadership interviews and focus groups, completable within one week, 1–2 stars; "
        "the page states a 100-point scale) and Advanced (full model at 29 criterion-parts, submission document prepared in advance, on-site independent assessors, "
        "4–6 month process, scored out of 1,000, 3–8 stars; above 7 stars = world-leading and Global Award eligibility). Open to any organisation. Assesses Direction, Execution and Results. No fees published."),
    src("SRC-EFQM-RAPID", "EFQM Rapid Assessment page", "https://efqm.org/rapid/", "EFQM Rapid",
        "Opened 6 Nov 2026: 'Rapid Recognised by EFQM' at 1 or 2 stars; full results in 5 working days; steps — discover and prepare (rapid diagnostic workshop), interviews and focus groups, "
        "feedback report, recognition; analysis across Direction, Execution and Results using RADAR logic; AI-supported platform. No scale, validity or price stated."),
    src("SRC-EFQM-GA2027", "EFQM Global Award 2027 page", "https://efqm.org/globalaward/", "EFQM Global Award",
        "Opened 6 Nov 2026: open to global and local, public and private, educational and charitable organisations; eligibility discussed with EFQM. Timeline — applications Nov 2025–Sep 2026; "
        "on-site assessments Jan 2026–Feb 2027; independent jury April 2027; gala June 2027. Week-long on-site assessment and feedback report. Ratings 5–7 Diamonds by score out of 1,000 "
        "(7 Diamonds over 701 points); Global Award Winner selected by the jury from 7 Diamond recipients; Outstanding Achievement possible. The page describes Rapid as scored out of 200 — "
        "differs from the assessment page (100). 2025 cycle recognised 14 organisations."),
    src("SRC-EFQM-RECOG", "EFQM Recognition page", "https://efqm.org/recognition/", "EFQM recognition",
        "Opened 6 Nov 2026: names 'Validated by EFQM' (entry level), a '7 star Recognised by EFQM' level and the EFQM Global Award; recognition carried out by independent EFQM assessors; "
        "open to any organisation. Mentions four recognition categories but the page text lists only these; no durations, validity or fees."),
    src("SRC-EFQM-MODEL2025", "The EFQM Model 2025 (EFQM webshop publication page)", "https://shop.efqm.org/publications/the-efqm-model-2025", "EFQM Model 2025",
        "Opened 6 Nov 2026: 72-page publication. Contents list the seven criteria by name (Purpose, Vision & Strategy; Organisational Culture & Leadership; Engaging Stakeholders; "
        "Creating Sustainable Value; Driving Performance & Transformation; Stakeholder Perceptions; Strategic & Operational Performances), RADAR, scoring analysis and glossary. "
        "Only the criterion names are used by CIA. Price not shown."),
    src("SRC-EFQM-BROCHURE", "EFQM Recognition brochure (© 2021, hosted on efqm.org)", "https://efqm.org/wp-content/uploads/2022/06/EFQM_Recognition_brochure.pdf", "EFQM recognition (2021)",
        "Opened 6 Nov 2026; dated © 2021. Describes Validated, Qualified and Recognised by EFQM (3–7 stars) and the Global Award; recognitions valid 3 years; Validated by EFQM = "
        "self-assessment, top three improvement projects and a 1-day validator visit. Older than the current Rapid/Advanced pathways — used only as a dated note, never as a verified fact."),
    src("SRC-EFQM-TRAINING", "EFQM Assessor Training (EFQM webshop)", "https://shop.efqm.org/trainings/efqm-assessor-training/", "EFQM assessor training",
        "Opened 6 Nov 2026: the training pages (EFQM Assessor Training; EFQM Certified Assessor Training; EFQM Certified Assessor Training Upgrade 2025, one day) redirect to the webshop home page "
        "from this session, so no content, duration, fee or certification rule could be read. All facts pending."),
    src("SRC-KAQA-SPA-2025", "Saudi Press Agency — winners of the seventh King Abdulaziz Quality Award honoured (23 June 2025)", "https://www.spa.gov.sa/en/N2344728", "King Abdulaziz Quality Award",
        "Opened 6 Nov 2026: seventh edition; ceremony in Riyadh in June 2025 under royal patronage; 63 establishments honoured at gold, silver and bronze levels.", org="Saudi Press Agency (official)"),
    src("SRC-KAQA-SASO-2015", "SASO — Excellence Model of the King Abdulaziz Quality Award (news, 10 Nov 2015)", "https://saso.gov.sa/en/mediacenter/news/Pages/saso_news_5039.aspx", "King Abdulaziz Quality Award",
        "Opened 6 Nov 2026: the award was approved in 2000 (1420 AH); a unified excellence model was issued in 2015 with core principles, eight institutional standards in two parts "
        "('possibilities' and 'results') and its own assessment mechanism. A 2015 news item — later editions of the model may differ.", org="Saudi Standards, Metrology and Quality Organization (SASO)"),
    src("SRC-KAQA-SIDF-2023", "SIDF — gold level in the sixth King Abdulaziz Quality Award (17 Jan 2023)", "https://www.sidf.gov.sa/News/SIDF-Wins-the-Gold-Level-of-King-Abdulaziz-Award-for-Quality-Over-300-Competing-Facilities", "King Abdulaziz Quality Award",
        "Opened 6 Nov 2026: sixth edition; more than 300 governmental, private and non-profit organisations competed; gold level in the category of entities affiliated with ministries.",
        org="Saudi Industrial Development Fund (official)"),
    {"id": "SRC-CIA-EX", "source_id": "SRC-CIA-EX", "organization": "Continual Improvement Academy", "title": "CIA original teaching synthesis — Excellence (EFQM-informed) Academy",
     "official_url": "", "source_type": "owner", "accessed_date": CHECKED, "verified_date": CHECKED, "verification_status": "owner_publication",
     "verification_note": "Original CIA teaching content in independent wording; no EFQM Model text, criterion-part wording, RADAR attribute text, assessor-training or award material is reproduced.",
     "content_area": "Excellence Academy curriculum", "owner": "مدثر سلامه", "review_date": "2027-05-06"},
]

CLAIMS = T("CIA is not an EFQM partner and its courses and tools are not EFQM-approved. CIA does not train, certify or license EFQM assessors, does not carry out EFQM assessments and gives no recognition, star, diamond or award result. "
           "Self-ratings in the EFQM Assessment Lab are an internal self-assessment aid, not an EFQM assessment or score. Always confirm the current scheme on EFQM's site.",
           "CIA ليست شريكًا لـ EFQM، ودوراتها وأدواتها ليست معتمدة من EFQM. ولا تدرّب CIA مقيّمي EFQM ولا تعتمدهم ولا ترخّص لهم، ولا تجري تقييمات EFQM، ولا تمنح أي اعتراف أو نجوم أو ماسات أو نتيجة جائزة. "
           "والتقديرات الذاتية في مختبر تقييم EFQM أداة مساعدة داخلية للتقييم الذاتي، وليست تقييمًا ولا درجة من EFQM. تحقق دائمًا من المخطط الحالي على موقع EFQM.")

DIMENSIONS = [{"name": T("Direction", "التوجه")}, {"name": T("Execution", "التنفيذ")}, {"name": T("Results", "النتائج")}]
# Criterion NAMES of the EFQM Model 2025 (from EFQM's publication page) — names only, used to identify them.
CRITERIA = [
    ("C1", "direction", "Purpose, Vision & Strategy", "الغاية والرؤية والاستراتيجية"),
    ("C2", "direction", "Organisational Culture & Leadership", "الثقافة المؤسسية والقيادة"),
    ("C3", "execution", "Engaging Stakeholders", "إشراك أصحاب المصلحة"),
    ("C4", "execution", "Creating Sustainable Value", "صنع قيمة مستدامة"),
    ("C5", "execution", "Driving Performance & Transformation", "قيادة الأداء والتحول"),
    ("C6", "results", "Stakeholder Perceptions", "تصورات أصحاب المصلحة"),
    ("C7", "results", "Strategic & Operational Performance", "الأداء الاستراتيجي والتشغيلي"),
]


def row(en_l, ar_l, en_v, ar_v):
    return {"label": T(en_l, ar_l), "value": T(en_v, ar_v)}


def elig(*opts):
    return [{"label": T(*o[0]), "items": [T(*x) for x in o[1:]]} for o in opts]


def cert(cid, slug, code, name, stage, area, summary, who, *, eligibility=None, rows=None, rows_note=None, domains=None, extra=None, status, sources, url,
         routes, courses, competencies, toolkits, next_certs, prepare):
    return {"id": cid, "slug": slug, "code": code, "body": "EFQM", "name": T(*name), "stage": stage, "area": area,
            "summary": T(*summary), "who": T(*who), "eligibility": eligibility or [],
            "exam": ({"rows": rows, "note": T(*rows_note) if rows_note else None} if rows else None), "fee": None, "renewal": None,
            "domains": domains or [], "domain_unit": "names", "bok_version": None, "languages": None,
            "extra": [T(*x) for x in (extra or [])], "facts_status": status, "verified_date": CHECKED, "source_ids": sources, "official_url": url,
            "cia_routes": routes, "cia_courses": courses, "competencies": competencies, "toolkits": toolkits, "next": next_certs,
            "prepare": [{"title": T(*p[0]), "text": T(*p[1])} for p in prepare], "study_plan": None, "claims": CLAIMS,
            "governance": {"content_status": "needs_review", "content_source": "external_public", "version": "1.0.0", "reviewer": None, "review_date": None,
                           "change_note": "Phase 10 recognition explorer (6 Nov 2026): facts from EFQM's own pages opened that day; pending where a page was silent, unreadable or contradicted by another EFQM page; descriptions and preparation guidance are original CIA wording."}}


OPEN_ALL = (("Who can apply", "من يحق له التقدم"), ("Businesses, public bodies, education institutions and non-profits of any size, sector or location", "الشركات والجهات العامة ومؤسسات التعليم والمنظمات غير الربحية من أي حجم أو قطاع أو موقع"))
FEES_NOTE = ("EFQM does not publish assessment or recognition fees on these pages; ask EFQM or its authorised partner for a quotation.", "لا تنشر EFQM رسوم التقييم أو الاعتراف في هذه الصفحات؛ فاطلب عرض سعر من EFQM أو شريكها المخوّل.")

CERTS = [
    cert("CERT-EFQM-RAPID", "rapid-recognised", "Rapid", ("Rapid Recognised by EFQM (Rapid Assessment)", "الاعتراف السريع من EFQM (التقييم السريع)"), "entry", "recognition",
         ("EFQM's short external assessment: a condensed version of the model, a diagnostic workshop, leadership interviews and focus groups, a feedback report and a 1- or 2-star recognition.",
          "التقييم الخارجي القصير لدى EFQM: نسخة مختصرة من النموذج، وورشة تشخيصية، ومقابلات مع القيادة، ومجموعات تركيز، وتقرير تغذية راجعة، واعتراف بنجمة أو نجمتين."),
         ("Organisations starting their excellence journey, or with limited time and resources, that want a first independent view.", "المنظمات التي تبدأ مسيرة التميز، أو ذات الوقت والموارد المحدودة، والتي تريد أول نظرة مستقلة."),
         eligibility=elig(OPEN_ALL, (("Suits", "يناسب"), ("Organisations starting their excellence journey", "المنظمات التي تبدأ مسيرة التميز"), ("Limited time and resources; no advance preparation required", "الوقت والموارد المحدودة؛ ولا يلزم إعداد مسبق"))),
         rows=[row("Pathway", "المسار", "Rapid Assessment (condensed model)", "التقييم السريع (نموذج مختصر)"),
               row("Duration", "المدة", "Full results in 5 working days", "النتائج كاملة خلال 5 أيام عمل"),
               row("Process", "الإجراءات", "Rapid diagnostic workshop; leadership interviews and focus groups; feedback report", "ورشة تشخيصية سريعة؛ ومقابلات القيادة ومجموعات تركيز؛ وتقرير تغذية راجعة"),
               row("Outcome", "المُخرَج", "Rapid Recognised by EFQM at 1 or 2 stars", "الاعتراف السريع من EFQM بنجمة أو نجمتين"),
               row("Analysis", "التحليل", "Direction, Execution and Results, with RADAR logic", "التوجه والتنفيذ والنتائج، بمنطق RADAR")],
         rows_note=("EFQM's pages differ on the points scale of the Rapid review (100 on the assessment page, 200 on the Global Award page), so no scale is shown here — check EFQM.",
                    "تختلف صفحات EFQM في مقياس نقاط التقييم السريع (100 في صفحة التقييم، و200 في صفحة الجائزة العالمية)، لذا لا يُعرض مقياس هنا — تحقق لدى EFQM."),
         domains=DIMENSIONS, status={"eligibility": V, "exam": V, "fee": P, "renewal": P, "domains": V},
         sources=["SRC-EFQM-RAPID", "SRC-EFQM-ASSESS"], url="https://efqm.org/rapid/",
         routes=["ROUTE-EX-AWARD", "ROUTE-EX-FOUND"], courses=["CRS-EFQM-101", "CRS-EX-RADAR", "CRS-EX-AWARD"], competencies=["OE-01", "OE-02"], toolkits=["exc"],
         next_certs=["CERT-EFQM-ADV"],
         prepare=[(("Self-assess first", "قيّم نفسك أولًا"), ("Run at least one honest self-assessment (the EFQM Assessment Lab helps you organise evidence) so the external feedback adds something new.", "أجرِ تقييمًا ذاتيًا صادقًا واحدًا على الأقل (ويساعدك مختبر تقييم EFQM على تنظيم الأدلة) لتضيف التغذية الراجعة الخارجية شيئًا جديدًا.")),
                  (("Prepare your leaders", "أعدّ قادتك"), ("Leaders should be able to explain purpose, strategy and the main approaches in their own words — the review relies on interviews.", "ينبغي أن يستطيع القادة شرح الغاية والاستراتيجية والأساليب الرئيسية بكلماتهم — فالتقييم يعتمد على المقابلات.")),
                  (("Use the feedback", "استفد من التغذية الراجعة"), ("Feed the report's findings into your improvement plan; that is where the value lies.", "أدخل ملاحظات التقرير في خطة التحسين؛ ففيها القيمة."))]),
    cert("CERT-EFQM-ADV", "advanced-recognised", "Advanced", ("Recognised by EFQM (Advanced Assessment)", "الاعتراف من EFQM (التقييم المتقدم)"), "advanced", "recognition",
         ("EFQM's full external assessment on the whole model: a submission document prepared in advance, an on-site team of independent assessors, a score out of 1,000 points and a star rating.",
          "التقييم الخارجي الكامل لدى EFQM على النموذج كله: وثيقة مشاركة تُعدّ مسبقًا، وفريق مقيّمين مستقلين في الموقع، ودرجة من 1000 نقطة، وتصنيف بالنجوم."),
         ("Organisations with a mature management system that want deep strategic feedback and a recognised level.", "المنظمات ذات نظام الإدارة الناضج التي تريد تغذية راجعة استراتيجية عميقة ومستوى معترفًا به."),
         eligibility=elig(OPEN_ALL, (("Suits", "يناسب"), ("Organisations seeking deep strategic insight and a recognised mark of performance", "المنظمات الساعية إلى رؤية استراتيجية عميقة وعلامة أداء معترف بها"), ("Can be delivered through accredited partner organisations in a region and language", "يمكن تقديمه عبر منظمات شريكة معتمدة في منطقة ولغة محددتين"))),
         rows=[row("Pathway", "المسار", "Advanced Assessment (full model, 29 criterion-parts)", "التقييم المتقدم (النموذج كاملًا، 29 جزءًا من أجزاء المعايير)"),
               row("Preparation", "الإعداد", "Submission document prepared in advance", "وثيقة مشاركة تُعدّ مسبقًا"),
               row("Assessment", "التقييم", "On-site team of independent, internationally certified assessors", "فريق في الموقع من مقيّمين مستقلين معتمدين دوليًا"),
               row("Duration", "المدة", "A 4–6 month process", "عملية من 4 إلى 6 أشهر"),
               row("Score", "الدرجة", "Out of 1,000 points", "من 1000 نقطة"),
               row("Outcome", "المُخرَج", "Star rating (3–8 stars on EFQM's assessment page); above 7 stars = world-leading and Global Award eligibility", "تصنيف بالنجوم (3 إلى 8 نجوم في صفحة التقييم لدى EFQM)؛ وما فوق 7 نجوم = أداء رائد عالميًا وأهلية للجائزة العالمية")],
         rows_note=("Score bands per star level are not published on these pages.", "حدود الدرجات لكل مستوى من النجوم غير منشورة في هذه الصفحات."),
         domains=[{"name": T(en, ar), "group": g} for _, g, en, ar in CRITERIA], status={"eligibility": V, "exam": V, "fee": P, "renewal": P, "domains": V},
         sources=["SRC-EFQM-ASSESS", "SRC-EFQM-RECOG", "SRC-EFQM-MODEL2025"], url="https://efqm.org/assess/",
         routes=["ROUTE-EX-AWARD", "ROUTE-EX-SA"], courses=["CRS-EX-RADAR", "CRS-EX-EVID", "CRS-EX-SA", "CRS-EX-AWARD"], competencies=["OE-01", "OE-02", "LDR-01", "PERF-02"], toolkits=["exc", "kaqa"],
         next_certs=["CERT-EFQM-GA"],
         extra=[("EFQM's recognition page also names a “7 star Recognised by EFQM” level.", "تذكر صفحة الاعتراف لدى EFQM أيضًا مستوى «الاعتراف من EFQM بسبع نجوم».")],
         prepare=[(("Check readiness honestly", "افحص الجاهزية بصدق"), ("Key results should have trends over several years, targets and comparisons; key approaches should be deployed across the scope.", "ينبغي أن تكون للنتائج الرئيسية اتجاهات عبر سنوات عدة ومستهدفات ومقارنات؛ وأن تكون الأساليب الرئيسية مطبقة عبر النطاق.")),
                  (("Write an evidence-led document", "اكتب وثيقة قائمة على الأدلة"), ("Facts, dates and results, in your own words, that assessors can verify on site (CRS-EX-AWARD).", "وقائع وتواريخ ونتائج بكلماتك يستطيع المقيّمون التحقق منها في الموقع (CRS-EX-AWARD).")),
                  (("Plan the time", "خطط للوقت"), ("Allow for a 4–6 month process alongside normal work; agree the scope and partner with EFQM early.", "خصص وقتًا لعملية من 4 إلى 6 أشهر إلى جانب العمل المعتاد؛ واتفق على النطاق والشريك مع EFQM مبكرًا."))]),
    cert("CERT-EFQM-GA", "global-award", "Global Award", ("EFQM Global Award (2027 cycle)", "جائزة EFQM العالمية (دورة 2027)"), "top", "award",
         ("EFQM's highest recognition: a week-long on-site assessment with a feedback report, a Diamond rating by score, and selection of winners by an independent jury.",
          "أعلى اعتراف لدى EFQM: تقييم ميداني لمدة أسبوع مع تقرير تغذية راجعة، وتصنيف بالماسات حسب الدرجة، واختيار الفائزين من لجنة تحكيم مستقلة."),
         ("Organisations with world-leading performance; EFQM describes the Advanced Assessment as the natural pathway to it.", "المنظمات ذات الأداء الرائد عالميًا؛ وتصف EFQM التقييم المتقدم بأنه المسار الطبيعي إليها."),
         eligibility=elig((("Who can apply", "من يحق له التقدم"), ("Global and local, public and private, educational and charitable organisations", "المنظمات العالمية والمحلية، العامة والخاصة، التعليمية والخيرية"),
                           ("Eligibility is discussed with EFQM in a meeting before applying", "تُناقش الأهلية مع EFQM في اجتماع قبل التقدم"))),
         rows=[row("Applications", "التقدم", "November 2025 – September 2026", "نوفمبر 2025 – سبتمبر 2026"),
               row("On-site assessments", "التقييمات الميدانية", "January 2026 – February 2027 (one week on site)", "يناير 2026 – فبراير 2027 (أسبوع في الموقع)"),
               row("Jury", "لجنة التحكيم", "Independent jury review, April 2027", "مراجعة لجنة تحكيم مستقلة، أبريل 2027"),
               row("Gala", "الحفل", "June 2027", "يونيو 2027"),
               row("Ratings", "التصنيفات", "5 to 7 Diamonds by score out of 1,000 (7 Diamonds: over 701 points)", "من 5 إلى 7 ماسات حسب الدرجة من 1000 (7 ماسات: أكثر من 701 نقطة)"),
               row("Awards", "الجوائز", "Global Award Winner(s) chosen by the jury from 7 Diamond recipients; Outstanding Achievement in a specific area", "الفائز (أو الفائزون) بالجائزة العالمية تختارهم لجنة التحكيم من حاملي 7 ماسات؛ وإنجاز متميز في مجال محدد")],
         rows_note=("EFQM's award page rates in Diamonds while its assessment page rates in stars; read the current applicant guide for how the two relate.", "تصنّف صفحة الجائزة لدى EFQM بالماسات بينما تصنّف صفحة التقييم بالنجوم؛ فاقرأ دليل المتقدمين الحالي لمعرفة العلاقة بينهما."),
         status={"eligibility": V, "exam": V, "fee": P, "renewal": P, "domains": P},
         sources=["SRC-EFQM-GA2027", "SRC-EFQM-ASSESS"], url="https://efqm.org/globalaward/",
         routes=["ROUTE-EX-AWARD"], courses=["CRS-EX-AWARD", "CRS-EX-SUSTAIN"], competencies=["OE-01", "OE-02", "LDR-01", "LDR-02"], toolkits=["exc"], next_certs=[],
         extra=[("The 2025 cycle recognised 14 organisations (EFQM award page).", "كرّمت دورة 2025 أربع عشرة منظمة (صفحة الجائزة لدى EFQM).")],
         prepare=[(("Build on Advanced Assessment results", "ابنِ على نتائج التقييم المتقدم"), ("Use recent feedback and sustained results; an award application is the end of a long journey, not its start.", "استخدم التغذية الراجعة الحديثة والنتائج المستدامة؛ فطلب الجائزة نهاية رحلة طويلة لا بدايتها.")),
                  (("Book the eligibility meeting", "احجز اجتماع الأهلية"), ("Discuss eligibility and timing with EFQM well before the application window closes.", "ناقش الأهلية والتوقيت مع EFQM قبل إغلاق نافذة التقدم بوقت كافٍ.")),
                  (("Keep the learning", "حافظ على التعلم"), ("Whatever the rating, the feedback report should drive the next improvement cycle (CRS-EX-SUSTAIN).", "أيًا كان التصنيف، ينبغي أن يقود تقرير التغذية الراجعة دورة التحسين التالية (CRS-EX-SUSTAIN)."))]),
    cert("CERT-EFQM-VALID", "validated-by-efqm", "Validated", ("Validated by EFQM", "التحقق من EFQM"), "entry", "recognition",
         ("Named on EFQM's recognition page as its entry-level recognition. The current process is not described on EFQM's pages opened today.",
          "تذكرها صفحة الاعتراف لدى EFQM بوصفها مستوى الاعتراف المبتدئ. ولا تصف صفحات EFQM التي اطُّلع عليها اليوم الإجراءات الحالية."),
         ("Organisations just starting to improve their approach.", "المنظمات التي بدأت للتو تحسين أسلوبها."),
         status={"eligibility": P, "exam": P, "fee": P, "renewal": P, "domains": P},
         sources=["SRC-EFQM-RECOG", "SRC-EFQM-BROCHURE"], url="https://efqm.org/recognition/",
         routes=["ROUTE-EX-PLAN"], courses=["CRS-EX-EVID", "CRS-EX-PLAN"], competencies=["OE-01", "OE-02"], toolkits=["exc"], next_certs=["CERT-EFQM-RAPID"],
         extra=[("Dated note — EFQM's recognition brochure (© 2021) described this level as a self-assessment, three improvement projects and a one-day validator visit, with recognitions valid for three years. These details are not confirmed on EFQM's current pages: check EFQM before relying on them.",
                 "ملاحظة مؤرخة — وصف كتيب الاعتراف لدى EFQM (© 2021) هذا المستوى بتقييم ذاتي وثلاثة مشاريع تحسين وزيارة تحقق ليوم واحد، مع صلاحية الاعتراف ثلاث سنوات. وهذه التفاصيل غير مؤكدة في صفحات EFQM الحالية: تحقق لدى EFQM قبل الاعتماد عليها.")],
         prepare=[(("Start with a self-assessment", "ابدأ بتقييم ذاتي"), ("Identify and prioritise improvement opportunities with the EFQM Assessment Lab and CRS-EX-PLAN.", "حدد فرص التحسين ورتّبها بمختبر تقييم EFQM ودورة CRS-EX-PLAN.")),
                  (("Confirm the current scheme", "تأكد من المخطط الحالي"), ("Ask EFQM which entry-level option fits you today.", "اسأل EFQM أي خيار مبتدئ يناسبك اليوم."))]),
    cert("CERT-EFQM-ASSESSOR", "efqm-assessor-training", "Assessor", ("EFQM assessor training", "تدريب مقيّمي EFQM"), "professional", "assessor",
         ("EFQM lists assessor trainings in its webshop — for example “EFQM Assessor Training”, “EFQM Certified Assessor Training” and a one-day upgrade to the 2025 model. Their pages could not be read in this session, so content, duration, fees and the rules for becoming a certified assessor must be checked on EFQM.",
          "تدرج EFQM تدريبات للمقيّمين في متجرها الإلكتروني — مثل «تدريب مقيّمي EFQM» و«تدريب المقيّم المعتمد من EFQM» وترقية ليوم واحد إلى نموذج 2025. وتعذّرت قراءة صفحاتها في هذه الجلسة، لذا يجب التحقق لدى EFQM من المحتوى والمدة والرسوم وقواعد أن تصبح مقيّمًا معتمدًا."),
         ("Professionals who want to assess for EFQM recognition or national award schemes.", "المهنيون الذين يريدون العمل مقيّمين لاعتراف EFQM أو لمخططات الجوائز الوطنية."),
         status={"eligibility": P, "exam": P, "fee": P, "renewal": P, "domains": P},
         sources=["SRC-EFQM-TRAINING"], url="https://shop.efqm.org/trainings/efqm-assessor-training/",
         routes=["ROUTE-EX-SA"], courses=["CRS-EX-RADAR", "CRS-EX-EVID", "CRS-EX-SA"], competencies=["OE-01", "LDR-01"], toolkits=["exc", "kaqa"], next_certs=[],
         extra=[("CIA's courses build self-assessment skills; they are not EFQM assessor training and do not lead to EFQM assessor certification or a licence.", "تبني دورات CIA مهارات التقييم الذاتي؛ وليست تدريبًا لمقيّمي EFQM ولا تؤدي إلى اعتماد مقيّم من EFQM ولا إلى ترخيص.")],
         prepare=[(("Practise the logic", "مارس المنطق"), ("RADAR, evidence and findings (CRS-EX-RADAR, CRS-EX-EVID) are the core skills any assessor uses.", "منطق RADAR والأدلة والملاحظات (CRS-EX-RADAR وCRS-EX-EVID) هي المهارات الأساسية التي يستخدمها كل مقيّم.")),
                  (("Gain internal experience", "اكتسب خبرة داخلية"), ("Lead a criterion team in your organisation's self-assessment (CRS-EX-SA).", "قُد فريق معيار في التقييم الذاتي لمنظمتك (CRS-EX-SA).")),
                  (("Check EFQM's training rules", "تحقق من قواعد التدريب لدى EFQM"), ("Read EFQM's current training pages for prerequisites and certification steps.", "اقرأ صفحات التدريب الحالية لدى EFQM لمعرفة المتطلبات المسبقة وخطوات الاعتماد."))]),
]

# KAQA facts shown on the landing page (dated, official Saudi sources).
KAQA = {"name": T("King Abdulaziz Quality Award", "جائزة الملك عبدالعزيز للجودة"), "checked": CHECKED,
        "facts": [{"text": T("Seventh edition: 63 establishments honoured at gold, silver and bronze levels in Riyadh, June 2025.", "الدورة السابعة: تكريم 63 منشأة بالمستويات الذهبي والفضي والبرونزي في الرياض، يونيو 2025."), "source": "SRC-KAQA-SPA-2025"},
                  {"text": T("Sixth edition: more than 300 governmental, private and non-profit organisations competed.", "الدورة السادسة: تنافست أكثر من 300 منظمة حكومية وخاصة وغير ربحية."), "source": "SRC-KAQA-SIDF-2023"},
                  {"text": T("Approved in 2000; a unified excellence model was issued by SASO in 2015 (later editions may differ).", "أُقرّت في عام 2000؛ وأصدرت الهيئة السعودية للمواصفات والمقاييس والجودة نموذجًا موحدًا للتميز في 2015 (وقد تختلف الإصدارات اللاحقة)."), "source": "SRC-KAQA-SASO-2015"}],
        "note": T("Application rules, categories and the current model edition are not confirmed here — check the award's official channels before planning.", "قواعد التقدم والفئات وإصدار النموذج الحالي غير مؤكدة هنا — تحقق من القنوات الرسمية للجائزة قبل التخطيط.")}
