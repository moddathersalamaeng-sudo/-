"""Phase 11 — smart guided templates (ADD-9, spec §19.1): Risk Register, Audit Checklist, NCR, CAPA, Quality Plan, Training Matrix.
Each template = sections + questions (structured Q&A) + one register table with typed columns and safe computed columns.
Original CIA structure and wording; no copied forms. Author: مدثر سلامه."""
from lib11 import T, gov

EXPORTS = ["csv", "xls", "doc", "print", "json"]


def q(qid, section, label, qtype="text", required=False, hint=None, options=None, **kw):
    x = {"id": qid, "section": section, "type": qtype, "label": label, "required": required}
    if hint:
        x["hint"] = hint
    if options:
        x["options"] = [{"value": v, "label": T(en, ar)} for v, en, ar in options]
    x.update(kw)
    return x


def col(cid, label, ctype="text", required=False, options=None, **kw):
    x = {"id": cid, "type": ctype, "label": label, "required": required}
    if options:
        x["options"] = [{"value": v, "label": T(en, ar)} for v, en, ar in options]
    x.update(kw)
    return x


def sec(sid, en, ar):
    return {"id": sid, "title": T(en, ar)}


SCALE5 = [(str(i), str(i), str(i)) for i in range(1, 6)]
LEVEL = [("0", "0 — not yet", "0 — ليس بعد"), ("1", "1 — under supervision", "1 — تحت الإشراف"), ("2", "2 — independent", "2 — مستقل"),
         ("3", "3 — can train others", "3 — يستطيع تدريب الآخرين"), ("4", "4 — expert", "4 — خبير")]
STATUS = [("open", "Open", "مفتوح"), ("doing", "In progress", "قيد التنفيذ"), ("done", "Done", "منجز")]


def tpl(tid, slug, academy, title, summary, doc_title, sections, questions, table, *, competencies=(), labs=(), courses=(), toolkits=(), icon="doc", motif="lines", guidance=()):
    return {"id": tid, "slug": slug, "academy": academy, "title": title, "summary": summary, "doc_title": doc_title, "sections": sections, "questions": questions,
            "table": table, "exports": EXPORTS, "competencies": list(competencies), "labs": list(labs), "courses": list(courses), "toolkits": list(toolkits),
            "guidance": list(guidance), "cover": {"motif": motif, "icon": icon}, "version": "0.11.0",
            "governance": gov("Phase 11 smart template draft (Nov 2026) — original CIA structure; generated documents are the learner's own data; awaiting review")}


RISK = tpl("TPL-RISK-REGISTER", "risk-register", "iso",
           T("Risk Register", "سجل المخاطر"), T("Answer a few questions about your context and criteria, then list risks with likelihood and consequence; the score and rating are calculated for you.",
                                                 "أجب عن أسئلة قليلة عن سياقك ومعاييرك، ثم سجّل المخاطر بالاحتمال والعاقبة؛ وتُحسب الدرجة والتصنيف تلقائيًا."),
           T("Risk register", "سجل المخاطر"),
           [sec("ctx", "Context", "السياق"), sec("crit", "Risk criteria", "معايير المخاطر")],
           [q("org", "ctx", T("Organisation, project or process", "المنظمة أو المشروع أو العملية"), required=True),
            q("scope", "ctx", T("Scope of this register", "نطاق هذا السجل"), "textarea", required=True, hint=T("What is in and out — sites, activities, period.", "ما الداخل وما الخارج — المواقع والأنشطة والفترة.")),
            q("owner", "ctx", T("Register owner", "مالك السجل"), required=True),
            q("date", "ctx", T("Date prepared", "تاريخ الإعداد"), "date", required=True),
            q("appetite", "crit", T("What level of risk needs a treatment plan?", "أي مستوى من الخطر يحتاج خطة معالجة؟"), "select", required=True,
              options=[("high", "High and above (score 10+)", "مرتفع فأعلى (الدرجة 10+)"), ("medium", "Medium and above (score 5+)", "متوسط فأعلى (الدرجة 5+)")]),
            q("review", "crit", T("How often is the register reviewed?", "كم مرة يُراجَع السجل؟"), "select", required=True,
              options=[("monthly", "Monthly", "شهريًا"), ("quarterly", "Quarterly", "ربع سنوي"), ("change", "At each significant change", "عند كل تغيير مهم")])],
           {"title": T("Risks", "المخاطر"), "min_rows": 1, "columns": [
               col("ref", T("Ref", "المرجع"), required=True, max_length=20),
               col("risk", T("Risk (cause → event → consequence)", "الخطر (سبب ← حدث ← عاقبة)"), "textarea", required=True),
               col("owner", T("Owner", "المالك"), required=True),
               col("l", T("Likelihood (1–5)", "الاحتمال (1–5)"), "select", required=True, options=SCALE5),
               col("c", T("Consequence (1–5)", "العاقبة (1–5)"), "select", required=True, options=SCALE5),
               col("score", T("Score", "الدرجة"), "computed", compute={"op": "product", "of": ["l", "c"]}),
               col("rating", T("Rating", "التصنيف"), "computed", compute={"op": "band", "of": "score", "bands": [
                   {"max": 4, "label": T("Low", "منخفض")}, {"max": 9, "label": T("Medium", "متوسط")}, {"max": 16, "label": T("High", "مرتفع")}, {"max": 25, "label": T("Very high", "مرتفع جدًا")}]}),
               col("treat", T("Treatment option", "خيار المعالجة"), "select", options=[("avoid", "Avoid", "تجنب"), ("likelihood", "Change likelihood", "تغيير الاحتمال"),
                   ("consequence", "Change consequence", "تغيير العاقبة"), ("share", "Share", "مشاركة"), ("retain", "Retain", "احتفاظ")]),
               col("action", T("Action", "الإجراء"), "textarea"),
               col("due", T("Due date", "الموعد"), "date"),
               col("status", T("Status", "الحالة"), "select", options=STATUS)]},
           competencies=["RSK-01", "RSK-02"], labs=["LAB-RISK", "LAB-PROJECT-RISK", "LAB-FMEA"], courses=["CRS-ISO-RISK", "CRS-G-31000", "CRS-PM-RISK"], toolkits=["iso31000"],
           icon="shield", motif="matrix",
           guidance=[T("Write each risk as cause → event → consequence.", "اكتب كل خطر: سبب ← حدث ← عاقبة."), T("Score = likelihood × consequence on 1–5 scales; bands 1–4, 5–9, 10–16, 17–25.", "الدرجة = الاحتمال × العاقبة على مقياس 1–5؛ والنطاقات 1–4، 5–9، 10–16، 17–25.")])

CHECKLIST = tpl("TPL-AUDIT-CHECKLIST", "audit-checklist", "iso",
                T("Audit Checklist", "قائمة تحقق التدقيق"), T("Set the audit's objective, scope and criteria, then build the questions with the evidence to look for; record results during the audit.",
                                                               "حدّد هدف التدقيق ونطاقه ومعاييره، ثم ابنِ الأسئلة مع الأدلة المطلوب البحث عنها؛ وسجّل النتائج أثناء التدقيق."),
                T("Audit checklist", "قائمة تحقق التدقيق"),
                [sec("plan", "Audit plan", "خطة التدقيق")],
                [q("title", "plan", T("Audit title", "عنوان التدقيق"), required=True),
                 q("criteria", "plan", T("Audit criteria (standard, procedures)", "معايير التدقيق (المعيار، الإجراءات)"), required=True, hint=T("Cite standards by number only, for example “ISO 9001 · procedure WH-03”.", "استشهد بالمعايير بالرقم فقط، مثل «ISO 9001 · الإجراء WH-03».")),
                 q("objective", "plan", T("Objective", "الهدف"), "textarea", required=True),
                 q("scope", "plan", T("Scope (processes, sites, shifts)", "النطاق (العمليات، المواقع، المناوبات)"), "textarea", required=True),
                 q("auditor", "plan", T("Auditor(s)", "المدقق/المدققون"), required=True),
                 q("date", "plan", T("Audit date", "تاريخ التدقيق"), "date", required=True)],
                {"title": T("Checklist", "قائمة التحقق"), "min_rows": 1, "columns": [
                    col("ref", T("Clause / ref", "البند / المرجع"), required=True, max_length=30),
                    col("question", T("Question to ask", "السؤال"), "textarea", required=True),
                    col("evidence", T("Evidence to look for", "الأدلة المطلوب البحث عنها"), "textarea", required=True),
                    col("result", T("Result", "النتيجة"), "select", options=[("c", "Conforming", "مطابق"), ("nc", "Nonconformity", "عدم مطابقة"), ("obs", "Observation", "ملاحظة"), ("na", "Not audited", "لم يُدقَّق")]),
                    col("notes", T("Notes and record references", "ملاحظات ومراجع السجلات"), "textarea")]},
                competencies=["AUD-01", "AUD-02"], labs=["LAB-AUDIT-SIM", "LAB-EVIDENCE", "LAB-AUDIT-PLAN"], courses=["CRS-ISO-AUD", "CRS-ISO-9001-AUD", "CRS-Q-AUDIT"], toolkits=["aud"],
                icon="clipboard", motif="rings",
                guidance=[T("One question per line; say what evidence would answer it.", "سؤال واحد لكل سطر؛ واذكر الدليل الذي يجيب عنه."), T("Record the record IDs you saw in the notes.", "سجّل مُعرِّفات السجلات التي رأيتها في الملاحظات.")])

NCR = tpl("TPL-NCR", "ncr", "iso",
          T("Nonconformity Report (NCR)", "تقرير عدم المطابقة"), T("Record a nonconformity the way an auditor would: requirement, evidence, statement and extent — then the correction and actions.",
                                                                  "سجّل عدم المطابقة كما يفعل المدقق: المتطلب والدليل والبيان والمدى — ثم التصحيح والإجراءات."),
          T("Nonconformity report", "تقرير عدم المطابقة"),
          [sec("id", "Identification", "التعريف"), sec("nc", "The nonconformity", "عدم المطابقة"), sec("react", "Immediate reaction", "التفاعل الفوري")],
          [q("number", "id", T("NCR number", "رقم التقرير"), required=True, max_length=30),
           q("date", "id", T("Date raised", "تاريخ الإصدار"), "date", required=True),
           q("area", "id", T("Process or area", "العملية أو المنطقة"), required=True),
           q("source", "id", T("Source", "المصدر"), "select", required=True, options=[("audit", "Internal audit", "تدقيق داخلي"), ("customer", "Customer complaint", "شكوى عميل"),
              ("inspection", "Inspection or test", "فحص أو اختبار"), ("supplier", "Supplier", "مورّد"), ("other", "Other", "أخرى")]),
           q("requirement", "nc", T("Requirement (what should be)", "المتطلب (ما ينبغي أن يكون)"), "textarea", required=True),
           q("evidence", "nc", T("Objective evidence (what was found, where, when, how many)", "الدليل الموضوعي (ما وُجد، وأين، ومتى، وكم)"), "textarea", required=True),
           q("statement", "nc", T("Statement of the nonconformity", "بيان عدم المطابقة"), "textarea", required=True),
           q("grade", "nc", T("Grade", "التصنيف"), "select", options=[("none", "Not graded (programme does not grade)", "غير مصنّف (البرنامج لا يصنّف)"),
              ("scheme_major", "Major — under the scheme in use", "رئيسية — وفق المخطط المعمول به"), ("scheme_minor", "Minor — under the scheme in use", "ثانوية — وفق المخطط المعمول به")]),
           q("correction", "react", T("Immediate correction and containment", "التصحيح والاحتواء الفوري"), "textarea"),
           q("owner", "react", T("Action owner", "مالك الإجراء"), required=True)],
          {"title": T("Actions", "الإجراءات"), "min_rows": 1, "columns": [
              col("action", T("Action", "الإجراء"), "textarea", required=True),
              col("type", T("Type", "النوع"), "select", required=True, options=[("correction", "Correction", "تصحيح"), ("corrective", "Corrective action", "إجراء تصحيحي")]),
              col("owner", T("Owner", "المالك"), required=True), col("due", T("Due", "الموعد"), "date", required=True), col("status", T("Status", "الحالة"), "select", options=STATUS)]},
          competencies=["AUD-03", "QM-03"], labs=["LAB-NC-WRITE", "LAB-AUDIT-SIM", "LAB-CAPA"], courses=["CRS-ISO-NC", "CRS-ISO-AUD"], toolkits=["capa", "aud"], icon="alert", motif="lines",
          guidance=[T("One requirement per NCR.", "متطلب واحد لكل تقرير."), T("Grade only if your programme or scheme defines grades.", "صنّف فقط إذا كان برنامجك أو مخططك يعرّف درجات.")])

CAPA = tpl("TPL-CAPA", "capa", "quality",
           T("CAPA Plan", "خطة الإجراء التصحيحي"), T("Plan a corrective action from problem to proof: containment, verified root cause, actions with owners, and an effectiveness criterion set in advance.",
                                                    "خطط إجراءً تصحيحيًا من المشكلة إلى الإثبات: الاحتواء، والسبب الجذري المتحقق منه، والإجراءات بمالكيها، ومعيار فعالية محدد مسبقًا."),
           T("Corrective action plan", "خطة الإجراء التصحيحي"),
           [sec("prob", "Problem", "المشكلة"), sec("cause", "Root cause", "السبب الجذري"), sec("eff", "Effectiveness", "الفعالية")],
           [q("number", "prob", T("CAPA number", "رقم الإجراء"), required=True, max_length=30),
            q("link", "prob", T("Linked NCR or complaint", "تقرير عدم المطابقة أو الشكوى المرتبطة"), required=True),
            q("problem", "prob", T("Problem description (with data)", "وصف المشكلة (بالبيانات)"), "textarea", required=True),
            q("containment", "prob", T("Containment and correction", "الاحتواء والتصحيح"), "textarea", required=True),
            q("method", "cause", T("Analysis method", "طريقة التحليل"), "select", required=True, options=[("why5", "5 Whys", "لماذا الخمس"), ("fish", "Fishbone", "عظم السمكة"), ("rca", "Investigation", "التحقيق"), ("other", "Other", "أخرى")]),
            q("root", "cause", T("Root cause", "السبب الجذري"), "textarea", required=True),
            q("verified", "cause", T("How the root cause was verified", "كيف تُحقق من السبب الجذري"), "textarea", required=True),
            q("criterion", "eff", T("Effectiveness criterion (set now)", "معيار الفعالية (يُحدد الآن)"), "textarea", required=True),
            q("check_date", "eff", T("Effectiveness check date", "تاريخ فحص الفعالية"), "date", required=True)],
           {"title": T("Actions", "الإجراءات"), "min_rows": 1, "columns": [
               col("action", T("Action", "الإجراء"), "textarea", required=True), col("owner", T("Owner", "المالك"), required=True),
               col("due", T("Due", "الموعد"), "date", required=True), col("status", T("Status", "الحالة"), "select", options=STATUS),
               col("proof", T("Evidence of completion", "دليل الإنجاز"), "textarea")]},
           competencies=["QM-03"], labs=["LAB-CAPA", "LAB-RCA"], courses=["CRS-Q-CAPA", "CRS-M-CAPA", "CRS-ISO-NC"], toolkits=["capa", "why5", "fish"], icon="refresh", motif="loop",
           guidance=[T("No “human error” as a root cause — ask why the process allowed it.", "لا «خطأ بشري» سببًا جذريًا — اسأل لماذا سمحت العملية به."), T("Close only when the effectiveness criterion is met.", "لا تُغلق إلا عند استيفاء معيار الفعالية.")])

QPLAN = tpl("TPL-QUALITY-PLAN", "quality-plan", "quality",
            T("Quality Plan", "خطة الجودة"), T("Describe how quality will be achieved for one product, project or contract: objectives, requirements, responsibilities, and the checks at each step.",
                                               "صِف كيف تتحقق الجودة لمنتج أو مشروع أو عقد واحد: الأهداف، والمتطلبات، والمسؤوليات، والفحوصات في كل خطوة."),
            T("Quality plan", "خطة الجودة"),
            [sec("scope", "Scope", "النطاق"), sec("manage", "Management", "الإدارة")],
            [q("subject", "scope", T("Product, project or contract", "المنتج أو المشروع أو العقد"), required=True),
             q("customer", "scope", T("Customer", "العميل"), required=True),
             q("requirements", "scope", T("Applicable requirements (contract, standards, regulations)", "المتطلبات المنطبقة (العقد، المعايير، الأنظمة)"), "textarea", required=True),
             q("objectives", "scope", T("Quality objectives for this plan", "أهداف الجودة لهذه الخطة"), "textarea", required=True),
             q("responsible", "manage", T("Who is responsible for quality", "من المسؤول عن الجودة"), required=True),
             q("documents", "manage", T("How documents and records are controlled", "كيف تُضبط الوثائق والسجلات"), "textarea"),
             q("changes", "manage", T("How changes are controlled", "كيف تُضبط التغييرات"), "textarea"),
             q("date", "manage", T("Date issued", "تاريخ الإصدار"), "date", required=True)],
            {"title": T("Inspection and test plan", "خطة الفحص والاختبار"), "min_rows": 1, "columns": [
                col("step", T("Process step", "خطوة العملية"), required=True), col("criteria", T("Acceptance criteria", "معايير القبول"), "textarea", required=True),
                col("method", T("Check method", "طريقة الفحص"), required=True), col("frequency", T("Frequency", "التكرار"), required=True),
                col("who", T("Responsibility", "المسؤولية"), required=True), col("record", T("Record", "السجل"))]},
            competencies=["QM-01", "ISO-02"], labs=["LAB-FMEA"], courses=["CRS-Q-CAPA"], toolkits=["iso9001"], icon="layers", motif="steps",
            guidance=[T("Each check has acceptance criteria, a method and a record.", "لكل فحص معايير قبول وطريقة وسجل."), T("Plan checks where the risk of failure is highest.", "خطط الفحوصات حيث يكون خطر الفشل أعلى.")])

TRAIN = tpl("TPL-TRAINING-MATRIX", "training-matrix", "iso",
            T("Training Matrix", "مصفوفة التدريب"), T("List people, the competences their role needs and their current level; the gap is calculated and you plan training against it.",
                                                     "سجّل الأشخاص والكفاءات التي يحتاجها دورهم ومستواهم الحالي؛ وتُحسب الفجوة وتخطط التدريب مقابلها."),
            T("Training matrix", "مصفوفة التدريب"),
            [sec("about", "About this matrix", "عن هذه المصفوفة")],
            [q("dept", "about", T("Department or team", "القسم أو الفريق"), required=True),
             q("prepared", "about", T("Prepared by", "أعدّه"), required=True),
             q("date", "about", T("Date", "التاريخ"), "date", required=True),
             q("review", "about", T("Review frequency", "تكرار المراجعة"), "select", required=True, options=[("6m", "Every 6 months", "كل 6 أشهر"), ("12m", "Every 12 months", "كل 12 شهرًا"), ("change", "When roles change", "عند تغيّر الأدوار")])],
            {"title": T("Competences", "الكفاءات"), "min_rows": 1, "columns": [
                col("person", T("Person", "الشخص"), required=True), col("role", T("Role", "الدور"), required=True),
                col("skill", T("Competence", "الكفاءة"), required=True),
                col("req", T("Required level", "المستوى المطلوب"), "select", required=True, options=LEVEL),
                col("cur", T("Current level", "المستوى الحالي"), "select", required=True, options=LEVEL),
                col("gap", T("Gap", "الفجوة"), "computed", compute={"op": "gap", "of": ["req", "cur"]}),
                col("plan", T("Planned training or action", "التدريب أو الإجراء المخطط")), col("due", T("Due", "الموعد"), "date"),
                col("evidence", T("Evidence of competence", "دليل الكفاءة"))]},
            competencies=["ISO-02", "LDR-01"], labs=["LAB-EVIDENCE"], courses=["CRS-ISO-9001-AUD"], toolkits=["iso9001"], icon="users", motif="grid",
            guidance=[T("Levels: 0 not yet · 1 under supervision · 2 independent · 3 can train others · 4 expert.", "المستويات: 0 ليس بعد · 1 تحت الإشراف · 2 مستقل · 3 يستطيع تدريب الآخرين · 4 خبير."),
                      T("Record evidence of competence, not just attendance.", "سجّل دليل الكفاءة، لا الحضور فقط.")])

TEMPLATES = [RISK, CHECKLIST, NCR, CAPA, QPLAN, TRAIN]
