#!/usr/bin/env python3
"""Phase 7 seed builder — ISO Academy curriculum integration.

Merges the authored ISO curriculum (tools/phase7/*.py) into data/seed/*.json:
courses, questions, assessments, iso-standards, sources, learning paths (six ISO routes),
recommendation catalog, typed relationships and the Library tool links (all hub toolkits).
Idempotent: run it again after editing content and the seed is rebuilt the same way.
Every new record stays content_status=needs_review / content_source=ai_draft; publication
happens only through tools/apply_review_decisions.py with a named human reviewer.
Author: مدثر سلامه. Usage: python3 tools/build_phase7.py
"""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SEED = ROOT / "data" / "seed"
sys.path.insert(0, str(HERE / "phase7"))

import lib  # noqa: E402
import diagnostics  # noqa: E402  (registers readiness + diagnostic items first)
sys.path.insert(0, str(HERE))
from review_hash import keep_approvals  # noqa: E402
import c_foundations, c_audit, c_risk_ims, c_9001, c_14001_45001, c_27001  # noqa: E402,F401

T, gov = lib.T, lib.gov
VERIFIED = "2026-10-25"


def load(name):
    return json.loads((SEED / f"{name}.json").read_text(encoding="utf-8"))


DROPPED_APPROVALS = []


def save(name, doc):
    """Write a seed file, keeping expert approvals for records whose content did not change (see review_hash.py)."""
    path = SEED / f"{name}.json"
    if path.exists() and isinstance(doc.get("items"), list):
        old_items = json.loads(path.read_text(encoding="utf-8")).get("items", [])
        DROPPED_APPROVALS.extend(f"{name}:{i}" for i in keep_approvals(old_items, doc["items"]))
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def upsert(items, new, key="id"):
    idx = {x[key]: i for i, x in enumerate(items)}
    for n in new:
        if n[key] in idx:
            items[idx[n[key]]] = n
        else:
            idx[n[key]] = len(items)
            items.append(n)
    return items


competencies = {c["id"]: c for c in json.loads((SEED / "competency" / "competencies.json").read_text())["items"]}
domain_of = lambda cid: competencies[cid]["domain"]  # noqa: E731

# ------------------------------------------------------------------ courses
courses_doc = load("courses")
iso_ids = {c["id"] for c in lib.COURSES}
for c in courses_doc["items"]:
    if c["id"] == "CRS-QMS-201":  # Phase 4 course: its prerequisite has always been enforced; make the flag say so
        for p in c["prerequisites"]:
            if p.get("course_id") == "CRS-ISO-101":
                p["required"] = True
order = [c["id"] for c in courses_doc["items"]]
by_id = {c["id"]: c for c in courses_doc["items"]}
for c in lib.COURSES:
    by_id[c["id"]] = c
    if c["id"] not in order:
        order.append(c["id"])
courses_doc["items"] = [by_id[i] for i in order]
courses_doc["schema"] = courses_doc.get("schema", "cia.course.v1")
save("courses", courses_doc)

# ------------------------------------------------------------------ questions
q_doc = load("questions")
practical_qs = []
for c in lib.COURSES:
    code = c["id"].replace("CRS-", "")
    practical_qs.append({
        "id": f"Q-{code}-PT", "category": "iso", "course_id": c["id"], "module_id": None,
        "competency": c["competency_mappings"][0]["competency"], "difficulty": "hard", "type": "practical_assignment",
        "format": "practical", "prompt": c["practical_task"]["brief"], "deliverable": c["practical_task"]["deliverable"],
        "rubric": c["practical_task"]["rubric"], "explanation": T(
            "Scored by a named human reviewer against the rubric. The result is recorded only after review.",
            "يقيّمه مراجع بشري مسمّى وفق معيار التقييم، ولا تُسجَّل النتيجة إلا بعد المراجعة."),
        "reference": "SRC-CIA-ISO", "weight": 4, "version": lib.VERSION, "status": "active", "governance": gov()})
upsert(q_doc["items"], lib.QUESTIONS + practical_qs)
save("questions", q_doc)
qmap = {q["id"]: q for q in q_doc["items"]}

# ------------------------------------------------------------------ assessments
a_doc = load("assessments")
a_items = a_doc["items"]
amap = {a["id"]: a for a in a_items}


def comps_of(ids):
    return sorted({qmap[i]["competency"] for i in ids})


def assessment(aid, slug, title, kind, course_id, qids, passing, minutes, desc, allow_unknown=False, show="after_submission"):
    return {"id": aid, "slug": slug, "title": title, "kind": kind, "course_id": course_id, "question_ids": qids,
            "competencies": comps_of(qids), "allow_unknown": allow_unknown, "estimated_minutes": minutes, "description": desc,
            "scoring": {"passing_score": passing, "method": "weighted_points", "manual_review_required_for_subjective": True},
            "integrity": {"randomize_questions": True, "randomize_options": False, "attempt_limit": None,
                          "time_limit_minutes": None, "show_answers": show},
            "feedback": {"show_domain_breakdown": True, "show_explanations": True}, "governance": gov()}


new_as = []
rd = amap["ASM-READY-ISO-001"]
rd_q = list(dict.fromkeys(rd["question_ids"] + diagnostics.READINESS))
new_as.append({**rd, "question_ids": rd_q, "competencies": comps_of(rd_q), "allow_unknown": True, "estimated_minutes": 20,
               "description": T("A short diagnostic across ISO fundamentals and auditing. Choose “I don’t know” rather than guessing — it makes your starting point more accurate. The result is not a professional qualification.",
                                "تقييم تشخيصي قصير في أساسيات ISO والتدقيق. اختر «لا أعرف» بدلًا من التخمين ليكون تحديد نقطة بدايتك أدق. والنتيجة ليست مؤهلًا مهنيًا."),
               "governance": {**rd["governance"], **gov()}})
for std, items in diagnostics.DIAG.items():
    aid = f"ASM-ISO-{std}-DIAG"
    base = amap[aid]
    qids = list(dict.fromkeys(base["question_ids"] + items))
    new_as.append({**base, "question_ids": qids, "competencies": comps_of(qids), "allow_unknown": True, "estimated_minutes": 15,
                   "description": T("Applied diagnostic for this standard. “I don’t know” is allowed and is treated as not yet demonstrated.",
                                    "تقييم تطبيقي لهذه المواصفة. يُسمح باختيار «لا أعرف»، ويُعامل على أنه لم يُثبت بعد."),
                   "governance": {**base["governance"], **gov()}})
for c in lib.COURSES:
    code = c["id"].replace("CRS-", "")
    checks = [l["check_question_id"] for m in c["modules"] for l in m["lessons"]]
    final_q = list(dict.fromkeys([c["scenario_question_id"]] + checks + c["extra_final_question_ids"]))
    missing = [q for q in final_q if q not in qmap]
    if missing:
        raise SystemExit(f"{c['id']}: unknown final questions {missing}")
    new_as.append(assessment(c["assessments"]["quiz"], c["slug"] + "-quiz", T(f"{c['title']['en']} — knowledge checks", f"{c['title']['ar']} — الاختبارات المعرفية"),
                             "knowledge_quiz", c["id"], checks, 70, 5 * len(checks),
                             T("The lesson checks of this course in one place, with explanations after each answer.", "الاختبارات القصيرة لدروس هذه الدورة في مكان واحد، مع شرح بعد كل إجابة.")))
    new_as.append(assessment(c["assessments"]["final"], c["slug"] + "-final", T(f"{c['title']['en']} — final assessment", f"{c['title']['ar']} — التقييم الختامي"),
                             "final", c["id"], final_q, 70, 30,
                             T("Objective and scenario items. 70% is required to complete the course. Completion is a CIA certificate of completion, not a professional certification.",
                               "أسئلة موضوعية وسيناريو. يلزم 70% لإكمال الدورة. والإكمال شهادة إكمال من CIA، وليس شهادة مهنية.")))
    new_as.append(assessment(c["assessments"]["practical"], c["slug"] + "-practical", T(f"{c['title']['en']} — practical task", f"{c['title']['ar']} — المهمة العملية"),
                             "practical", c["id"], [f"Q-{code}-PT"], 60, c["practical_task"]["minutes"],
                             T("Submit your work here. A named human reviewer scores it against the rubric; no automatic or AI marking is applied.",
                               "سلّم عملك هنا. يقيّمه مراجع بشري مسمّى وفق معيار التقييم، دون أي تصحيح آلي أو بالذكاء الاصطناعي.")))
upsert(a_items, new_as)
save("assessments", a_doc)
aids = {a["id"] for a in a_items}

# ------------------------------------------------------------------ sources
s_doc = load("sources")


def src(sid, org, title, url, area, verified=True, note=None, on=VERIFIED):
    return {"id": sid, "source_id": sid, "organization": org, "title": title, "official_url": url,
            "source_type": "official" if org.startswith("International") else ("owner" if org.startswith("Continual") else "secondary"),
            "accessed_date": on, "verified_date": on if verified else None,
            "verification_status": "verified_by_lookup" if verified else "pending", "verification_note": note,
            "content_area": area, "owner": "مدثر سلامه", "review_date": "2027-04-25", "governance": gov()}


ISO = "International Organization for Standardization"
new_src = [
    src("SRC-ISO-9001", ISO, "ISO 9001:2026 — Quality management systems — Requirements (catalogue page)", "https://www.iso.org/standard/9001", "Quality management",
        note="Edition label confirmed via ISO news release of 16 Sep 2026; catalogue page not reachable from this session."),
    src("SRC-ISO-9001-NEWS", ISO, "ISO launches update to world’s most widely used quality management standard (16 Sep 2026)", "https://www.iso.org/news/2026/09/ISO9001-2026", "Quality management",
        note="Publication 16 Sep 2026; emphasis on leadership, quality culture, ethical behaviour, risks and opportunities, latest harmonized structure."),
    src("SRC-LRQA-9001-TRANSITION", "LRQA (certification body)", "ISO 9001:2026 is live — the transition period has begun", "https://www.lrqa.com/en/latest-news/iso-9001-2026-live/", "Certification transition",
        note="Certification-body statement: three-year transition ending 30 Sep 2029. Not an accreditation-body source; confirm with your certification body."),
    src("SRC-ISO-14001", ISO, "ISO 14001:2026 — Environmental management systems — Requirements with guidance for use", "https://www.iso.org/standard/14001", "Environmental management",
        note="Edition 4, published 2026-04-15 (ISO catalogue)."),
    src("SRC-ISO-45001", ISO, "ISO 45001:2018 — Occupational health and safety management systems (with Amd 1:2024)", "https://www.iso.org/standard/45001/rev", "Occupational health and safety",
        note="Current: ISO 45001:2018 + Amd 1:2024. Revision ISO/DIS 45001 at stage 40.60 (close of voting 2026-09-09); intended to replace the 2018 edition in H1 2027."),
    src("SRC-ISO-45001-REV", ISO, "ISO/DIS 45001 — revision under development", "https://www.iso.org/standard/45001/rev", "Occupational health and safety",
        note="Recheck before publishing any edition-specific content; a new edition is expected in 2027."),
    src("SRC-ISO-27001", ISO, "ISO/IEC 27001:2022 — Information security management systems — Requirements", "https://www.iso.org/standard/27001", "Information security",
        note="Edition 2022 with Amd 1:2024; catalogue page not reachable from this session — amendment page used."),
    src("SRC-ISO-27001-AMD1", ISO, "ISO/IEC 27001:2022/Amd 1:2024 — Climate action changes", "https://www.iso.org/standard/88435.html", "Information security",
        note="Published 2024-02."),
    src("SRC-AMTIVO-27001", "Amtivo (certification body)", "ISO 27001:2022 published — revisions", "https://amtivo.com/us/resources/technical/iso-27001-revisions/", "Information security",
        note="Annex A: 93 controls in four themes; transition from 2013 edition ended 31 Oct 2025."),
    src("SRC-ISO-19011", "Chartered Quality Institute (CQI | IRCA)", "ISO 19011:2026 revision: guidance for management system auditing", "https://www.quality.org/article/iso-190112026-revision-guidance-management-system-auditing", "Auditing",
        note="Reports ISO 19011:2026 (4th edition) published May 2026, no transition period. Courses describe the audit approach in original wording and cite no clause text."),
    src("SRC-ISO-31000", ISO, "The new ISO 31000 keeps risk management simple (ISO 31000:2018)", "https://www.iso.org/news/ref2263.html", "Risk management",
        note="ISO 31000:2018 provides guidelines, not requirements; not for certification."),
    src("SRC-ISO-DIRECTIVES", "KAN (Commission for Occupational Health and Safety and Standardization)", "Standardized language in standards — ISO/IEC Directives Part 2 verbal forms", "https://www.kan.de/en/publications/kanbrief/the-normative-and-the-informative/standardized-language-in-standards", "Reading standards",
        note="Secondary source summarising Directives Part 2 Annex H: shall = requirement, should = recommendation, may = permission, can = possibility/capability."),
    src("SRC-CIA-ISO", "Continual Improvement Academy", "CIA original teaching synthesis — ISO Academy", "", "ISO Academy curriculum",
        note="Original CIA teaching content in independent wording; published only through the review workflow (see each record's governance)."),
    # Fact re-check before publication (3 Nov 2026): every page below was opened on that day.
    src("SRC-NSF-9001-2026", "NSF (certification body)", "ISO 9001:2026 published on September 16, 2026: what quality leaders need to know",
        "https://www.nsf.org/in/en/knowledge-library/iso-90012026-published-on-september-16-2026-what-quality-leaders-need-to-know", "Quality management",
        note="Confirms publication on 16 Sep 2026 and a three-year transition period (no exact end date on the page).", on="2026-11-03"),
    src("SRC-DNV-14001-2026", "DNV (certification body)", "New edition of ISO 14001 published", "https://www.dnv.com/news/2026/new-edition-of-iso-14001-published/",
        "Environmental management", note="Published 15 Apr 2026; three-year transition — ISO 14001:2015 certificates must move to the new edition before May 2029.", on="2026-11-03"),
    src("SRC-SQS-45001-REV", "SQS (certification body)", "Revision of ISO 45001:2027", "https://www.sqs.ch/en/services/products/iso-450012027",
        "Occupational health and safety", note="DIS consultation 16 Jun – 8 Sep 2026; FDIS expected no earlier than end of 2026; new edition expected no earlier than April 2027. ISO 45001:2018 + Amd 1:2024 remains current.", on="2026-11-03"),
    src("SRC-GENORMA-22301-CD", "Genorma (standards information service)", "ISO/CD 22301 — revision of ISO 22301", "https://genorma.com/en/standards/iso-cd-22301",
        "Business continuity", note="Revision at committee-draft stage (30.60, close of voting 10 May 2026). ISO 22301:2019 with Amd 1:2024 stays the edition in force until a new one is published.", on="2026-11-03"),
    src("SRC-ISO-TC262-31000", ISO, "ISO 31000 Risk Management Standard: time for an update? (ISO/TC 262)",
        "https://committee.iso.org/sites/tc262/home/news/content-left-area/news-and-events-within-iso-tc-26/iso-31000-risk-management-stan-2.html", "Risk management",
        note="TC 262 study group recommended revising ISO 31000; no new edition announced. ISO 31000:2018 remains current.", on="2026-11-03"),
    src("SRC-ANSI-37001-2025", "ANSI (national standards body)", "ISO 37001:2025 anti-bribery standard", "https://blog.ansi.org/ansi/iso-37001-2025-anti-bribery-standard/",
        "Anti-bribery", note="ISO 37001:2025 is the second edition, revising the 2016 original.", on="2026-11-03"),
    src("SRC-ISO-37301-AMD1", ISO, "ISO 37301:2021/Amd 1:2024 — Climate action changes", "https://committee.iso.org/standard/88422.html",
        "Compliance management", note="Amendment published 23 Feb 2024 (ISO/TC 309); current: ISO 37301:2021 + Amd 1:2024.", on="2026-11-03"),
]
upsert(s_doc["items"], new_src)
save("sources", s_doc)
src_ids = {s["id"] for s in s_doc["items"]}
for c in lib.COURSES:
    for s in c["source_references"]:
        assert s in src_ids, (c["id"], s)

# ------------------------------------------------------------------ ISO standards
std_doc = load("iso-standards")
smap = {s["id"]: s for s in std_doc["items"]}
EDITIONS = {
    "STD-9001": dict(label="ISO 9001:2026", status=T("Published 16 September 2026.", "نُشرت في 16 سبتمبر 2026."),
                     transition=T("Certification bodies announce a three-year transition from ISO 9001:2015 (LRQA: until 30 September 2029). Confirm the exact dates with your certification body.",
                                  "تعلن جهات منح الشهادات فترة انتقالية مدتها ثلاث سنوات من ISO 9001:2015 (وفق LRQA: حتى 30 سبتمبر 2029). تأكد من المواعيد الدقيقة مع جهة منح الشهادة."),
                     sources=["SRC-ISO-9001-NEWS", "SRC-LRQA-9001-TRANSITION", "SRC-ISO-9001"]),
    "STD-14001": dict(label="ISO 14001:2026", status=T("Edition 4, published 15 April 2026.", "الإصدار الرابع، نُشر في 15 أبريل 2026."),
                      transition=T("Certification bodies run a three-year transition; DNV states that ISO 14001:2015 certificates must move to the 2026 edition before May 2029. Confirm the dates with your certification body.",
                                   "تطبق جهات منح الشهادات فترة انتقالية مدتها ثلاث سنوات؛ وتذكر DNV أن شهادات ISO 14001:2015 يجب أن تنتقل إلى إصدار 2026 قبل مايو 2029. تأكد من المواعيد مع جهة منح الشهادة."),
                      sources=["SRC-ISO-14001", "SRC-DNV-14001-2026"]),
    "STD-45001": dict(label="ISO 45001:2018 + Amd 1:2024", status=T("Current edition 2018 with Amendment 1:2024. A revision (ISO/DIS 45001) closed its ballot on 9 September 2026 and is intended to replace the 2018 edition in the first half of 2027.",
                                                                  "الإصدار الحالي 2018 مع التعديل 1:2024. وأُغلق التصويت على مراجعة (ISO/DIS 45001) في 9 سبتمبر 2026، ويُعتزم أن تحل محل إصدار 2018 في النصف الأول من 2027."),
                      transition=T("No transition is running yet. Recheck this page when the new edition is published.", "لا توجد فترة انتقالية جارية بعد. أعد التحقق من هذه الصفحة عند نشر الإصدار الجديد."),
                      sources=["SRC-ISO-45001", "SRC-ISO-45001-REV"]),
    "STD-27001": dict(label="ISO/IEC 27001:2022 + Amd 1:2024", status=T("Current edition 2022 with Amendment 1:2024 (climate action changes). Annex A lists 93 controls in four themes.",
                                                                       "الإصدار الحالي 2022 مع التعديل 1:2024 (تغييرات العمل المناخي). ويسرد الملحق (أ) 93 ضابطًا في أربعة محاور."),
                      transition=T("The transition from the 2013 edition ended on 31 October 2025.", "انتهت الفترة الانتقالية من إصدار 2013 في 31 أكتوبر 2025."),
                      sources=["SRC-ISO-27001", "SRC-ISO-27001-AMD1", "SRC-AMTIVO-27001"]),
}
EXTRA = {
    "STD-9001": dict(audience=[T("Any organization that wants consistent products and services and satisfied customers", "أي منظمة تريد منتجات وخدمات متسقة وعملاء راضين"), T("Contractors and suppliers to utilities, energy and government", "المقاولون والموردون للمرافق والطاقة والجهات الحكومية")],
                     themes=[T("Customer focus and requirements", "التركيز على العميل والمتطلبات"), T("Process approach and operational control", "نهج العمليات والضبط التشغيلي"), T("Leadership and quality culture", "القيادة وثقافة الجودة"), T("Risks and opportunities", "المخاطر والفرص"), T("Measurement, audit and improvement", "القياس والتدقيق والتحسين")],
                     implementer="CRS-ISO-9001-IMP", auditor="CRS-ISO-9001-AUD", competencies=["ISO-01", "ISO-02", "QM-01", "QM-04", "AUD-02"],
                     related=["aud", "capa", "pdca", "iso10009"]),
    "STD-14001": dict(audience=[T("Sites with fuel, chemicals, waste, emissions or discharges", "المواقع التي تتعامل مع الوقود والكيماويات والنفايات والانبعاثات أو التصريفات"), T("Contractors required by clients to manage environmental obligations", "المقاولون الذين يطلب منهم العملاء إدارة الالتزامات البيئية")],
                      themes=[T("Environmental aspects and impacts", "الجوانب والآثار البيئية"), T("Compliance obligations", "الالتزامات الواجبة"), T("Life-cycle perspective", "منظور دورة الحياة"), T("Operational control and emergencies", "الضبط التشغيلي والطوارئ"), T("Environmental performance", "الأداء البيئي")],
                      implementer=None, auditor="CRS-ISO-14001-AUD", competencies=["ISO-01", "ISO-02", "CMP-01", "RSK-01", "AUD-02"], related=["ims"]),
    "STD-45001": dict(audience=[T("Organizations with construction, maintenance, operations or other high-risk work", "المنظمات التي لديها أعمال إنشاء أو صيانة أو تشغيل أو أعمال أخرى عالية الخطورة"), T("Principal contractors managing subcontractors", "المقاولون الرئيسيون الذين يديرون مقاولين من الباطن")],
                      themes=[T("Worker consultation and participation", "التشاور مع العاملين ومشاركتهم"), T("Hazard identification and OH&S risk", "تحديد المخاطر ومخاطر السلامة"), T("Hierarchy of controls", "التسلسل الهرمي للضوابط"), T("Management of change and contractors", "إدارة التغيير والمقاولون"), T("Incidents and learning", "الحوادث والتعلم")],
                      implementer=None, auditor="CRS-ISO-45001-AUD", competencies=["ISO-01", "RSK-01", "RSK-02", "LDR-01", "AUD-02"], related=["ims", "rca"]),
    "STD-27001": dict(audience=[T("Organizations that hold client, personal, financial or operational data", "المنظمات التي تحتفظ ببيانات العملاء أو البيانات الشخصية أو المالية أو التشغيلية"), T("IT service providers and suppliers with access to client systems", "مزودو خدمات تقنية المعلومات والموردون الذين يصلون إلى أنظمة العملاء")],
                      themes=[T("Confidentiality, integrity and availability", "السرية والسلامة والإتاحة"), T("Scope, assets and owners", "النطاق والأصول والملاك"), T("Risk assessment and treatment", "تقييم المخاطر ومعالجتها"), T("Statement of Applicability", "بيان قابلية التطبيق"), T("Incidents, monitoring and improvement", "الحوادث والرصد والتحسين")],
                      implementer=None, auditor="CRS-ISO-27001-AUD", competencies=["ISA-01", "ISA-02", "ISO-02", "RSK-01", "AUD-02"], related=["iso27701", "ims"]),
}
for sid, ed in EDITIONS.items():
    s, ex = smap[sid], EXTRA[sid]
    s.update({"name": T(ed["label"], ed["label"]), "edition": {"label": ed["label"], "status": ed["status"], "transition": ed["transition"], "verified_date": VERIFIED, "source_ids": ed["sources"]},
              "audience": ex["audience"], "themes": ex["themes"], "implementer_course_id": ex["implementer"], "auditor_course_id": ex["auditor"],
              "competencies": ex["competencies"], "related_toolkits": ex["related"], "route_ids": sorted({r for c in lib.COURSES if sid in c["standard_ids"] for r in c["route_ids"]}),
              "source_ids": ed["sources"], "knowledge_ids": ["KA-001", "KA-002", "KA-005", "KA-006", "KA-007", "KA-008", "KA-009", "KA-010"],
              "governance": {**s["governance"], **gov()}})
save("iso-standards", std_doc)

# ------------------------------------------------------------------ learning routes (Phase 6 path engine)
p_doc = load("learning-paths")
p_doc["items"] = [p for p in p_doc["items"] if p["id"] not in ("PATH-ISO-Q", "PATH-ISO-IMS")]  # superseded by ROUTE-IMPL / ROUTE-MR / ROUTE-IMS
course_by_id = {c["id"]: c for c in courses_doc["items"]}
FOUND = ["ISO-01", "ISO-02"]
AUDM = ["AUD-01", "AUD-02", "AUD-03"]


def step(n, kind, target, dep="recommended", skip_mastered=None):
    if kind in ("course",):
        c = course_by_id[target]; title, effort = c["title"], f"{c['training_hours']:g} h"
    elif kind in ("assessment", "practice", "final_assessment"):
        a = next(x for x in a_items if x["id"] == target); title, effort = a["title"], f"{a.get('estimated_minutes') or 30} min"
    else:
        title, effort = {"KA-001": T("What ISO is and how standards are developed", "ما هي ISO وكيف تُطوّر المواصفات"), "KA-005": T("How to read a management-system standard", "كيف تقرأ مواصفة نظام إدارة")}[target], "10 min"
    s = {"order": n, "type": kind, "target_id": target, "title": title, "dependency": dep, "effort": effort, "skip_if_completed": True}
    if skip_mastered:
        s["skip_if_mastered"] = skip_mastered
    return s


def route(rid, roles, title, goal, steps, standards=("STD-9001", "STD-14001", "STD-45001", "STD-27001")):
    return {"id": rid, "kind": "iso_route", "roles": roles, "standard_ids": list(standards), "title": title, "goal": goal,
            "steps": [step(i + 1, *s) for i, s in enumerate(steps)], "governance": gov()}


routes = [
    route("ROUTE-AWARE", [], T("ISO Awareness & Foundation", "مسار الوعي والأساسيات في ISO"), T("Understand ISO management systems and read requirements correctly.", "فهم نظم إدارة ISO وقراءة المتطلبات بدقة."),
          [("knowledge", "KA-001"), ("assessment", "ASM-READY-ISO-001"), ("course", "CRS-ISO-101", "recommended", FOUND), ("course", "CRS-ISO-READ", "recommended", ["ISO-01"]),
           ("course", "CRS-ISO-9001-F"), ("final_assessment", "ASM-ISO-101-FINAL", "recommended", FOUND)]),
    route("ROUTE-IMPL", ["ROLE-QE"], T("ISO Implementer", "مسار مطبق ISO"), T("Build or upgrade a working, auditable management system.", "بناء نظام إدارة يعمل وقابل للتدقيق أو تطويره."),
          [("assessment", "ASM-READY-ISO-001"), ("course", "CRS-ISO-101", "recommended", FOUND), ("course", "CRS-ISO-READ", "recommended", ["ISO-01"]), ("course", "CRS-ISO-RISK"),
           ("course", "CRS-ISO-9001-IMP", "required"), ("course", "CRS-ISO-NC"), ("practice", "ASM-ISO-9001-IMP-PRACT"), ("final_assessment", "ASM-ISO-9001-IMP-FINAL")], ("STD-9001",)),
    route("ROUTE-IA", ["ROLE-IA"], T("ISO Internal Auditor", "مسار المدقق الداخلي في ISO"), T("Plan and perform evidence-based internal audits.", "تخطيط تدقيق داخلي مبني على الأدلة وتنفيذه."),
          [("assessment", "ASM-READY-ISO-001"), ("course", "CRS-ISO-101", "recommended", FOUND), ("course", "CRS-ISO-READ", "recommended", ["ISO-01"]),
           ("course", "CRS-ISO-AUD", "required", AUDM), ("course", "CRS-ISO-9001-AUD", "required"), ("course", "CRS-ISO-NC"),
           ("practice", "ASM-ISO-9001-AUD-PRACT"), ("final_assessment", "ASM-ISO-9001-AUD-FINAL")]),
    route("ROUTE-LA", ["ROLE-LA"], T("Lead Auditor development (foundation)", "مسار تطوير رئيس فريق التدقيق (تأسيسي)"),
          T("Strengthen audit planning, evidence and reporting across standards. Lead-auditor certification needs a separate external course certified by an auditor certification body (for example CQI | IRCA).", "تعزيز تخطيط التدقيق والأدلة وإعداد التقارير عبر المواصفات. أما شهادة رئيس فريق التدقيق فتحتاج دورة خارجية منفصلة مسجلة لدى جهة لتسجيل المدققين (مثل CQI | IRCA)."),
          [("assessment", "ASM-READY-ISO-001"), ("course", "CRS-ISO-AUD", "recommended", AUDM), ("course", "CRS-ISO-9001-AUD", "required"),
           ("course", "CRS-ISO-45001-AUD"), ("course", "CRS-ISO-IMS"), ("practice", "ASM-ISO-AUD-PRACT"), ("final_assessment", "ASM-ISO-9001-AUD-FINAL")]),
    route("ROUTE-IMS", ["ROLE-HSEQM"], T("Integrated Management Systems", "مسار النظم المتكاملة"), T("Run quality, environment, OH&S and information security as one system.", "إدارة الجودة والبيئة والسلامة وأمن المعلومات كنظام واحد."),
          [("assessment", "ASM-READY-ISO-001"), ("course", "CRS-ISO-101", "recommended", FOUND), ("course", "CRS-ISO-RISK", "recommended", ["RSK-01", "RSK-02"]),
           ("course", "CRS-ISO-IMS", "required"), ("course", "CRS-ISO-45001-F"), ("course", "CRS-ISO-14001-F"), ("practice", "ASM-ISO-IMS-PRACT"), ("final_assessment", "ASM-ISO-IMS-FINAL")]),
    route("ROUTE-MR", ["ROLE-QMGR"], T("Manager / Management Representative", "مسار المدير وممثل الإدارة"), T("Lead a management system: objectives, risk, review and improvement.", "قيادة نظام الإدارة: الأهداف والمخاطر والمراجعة والتحسين."),
          [("assessment", "ASM-READY-ISO-001"), ("course", "CRS-ISO-101", "recommended", FOUND), ("course", "CRS-ISO-RISK"), ("course", "CRS-ISO-9001-IMP", "required"),
           ("course", "CRS-ISO-NC"), ("course", "CRS-ISO-IMS"), ("final_assessment", "ASM-ISO-9001-IMP-FINAL")], ("STD-9001",)),
]
upsert(p_doc["items"], routes)
save("learning-paths", p_doc)

# ------------------------------------------------------------------ recommendation catalog (Phase 6 engine)
r_doc = load("recommendation-catalog")
ROUTE_ROLES = {r["id"]: r["roles"] for r in routes}
SUPPRESS = {"CRS-ISO-101": FOUND, "CRS-ISO-READ": ["ISO-01"], "CRS-ISO-AUD": AUDM, "CRS-ISO-RISK": ["RSK-01", "RSK-02"]}
CERT_KW = {"STD-9001": ["ISO 9001", "9001"], "STD-14001": ["ISO 14001", "14001"], "STD-45001": ["ISO 45001", "45001"], "STD-27001": ["ISO 27001", "27001"]}
existing_by_target = {x["target_id"]: x for x in r_doc["items"]}
new_recs = []
for c in lib.COURSES:
    comps = [m["competency"] for m in c["competency_mappings"]]
    roles = sorted({r for rid in c["route_ids"] for r in ROUTE_ROLES.get(rid, [])})
    base = existing_by_target.get(c["id"], {"id": "REC-" + c["id"]})
    kw = sorted({k for s in c["standard_ids"] for k in CERT_KW[s]}) if len(c["standard_ids"]) == 1 else []
    rec = {**base, "recommendation_type": "course", "target_id": c["id"], "title": c["title"], "competencies": comps,
           "domains": sorted({domain_of(x) for x in comps}), "roles": roles, "level": c["level"], "estimated_effort": f"{c['training_hours']:g} h",
           "prerequisites": [{"target_id": p["course_id"], "required": True} for p in c["prerequisites"] if p.get("course_id") and p.get("required")],
           "interest_keywords": ["iso", "أيزو"] + (["audit", "تدقيق"] if "AUD" in c["id"] else []) + (["ims", "integrated", "متكامل"] if "IMS" in c["id"] else []),
           "certification_keywords": kw, "standard_ids": c["standard_ids"]}
    if c["id"] in SUPPRESS:
        rec["suppress_if_mastered"] = SUPPRESS[c["id"]]
    new_recs.append(rec)
for std in ("9001", "14001", "45001", "27001"):
    a = next(x for x in a_items if x["id"] == f"ASM-ISO-{std}-DIAG")
    new_recs.append({"id": f"REC-ASM-ISO-{std}-DIAG", "recommendation_type": "assessment", "target_id": a["id"], "title": a["title"], "competencies": a["competencies"],
                     "domains": sorted({domain_of(x) for x in a["competencies"]}), "roles": [], "level": 1, "estimated_effort": "15 min", "prerequisites": [],
                     "interest_keywords": ["iso", std], "certification_keywords": CERT_KW[f"STD-{std}"], "standard_ids": [f"STD-{std}"]})
upsert(r_doc["items"], new_recs)
save("recommendation-catalog", r_doc)

# ------------------------------------------------------------------ library tool links (all hub toolkits)
pm = load("platform-modules")["items"]
li_doc = load("library-items")
li = li_doc["items"]
by_link = {x.get("link"): x for x in li if x["kind"] == "tool"}
ECO = {"iso27701": "information-security", "iso42001": "iso", "iso42005": "iso", "aireg": "compliance", "iso21500": "pmi", "p3o": "p3o", "pmoexc": "pmo",
       "kaqa": "efqm", "swot": "performance", "pestle": "performance"}
next_n = 1 + max(int(x["id"].split("-")[-1]) for x in li if x["id"].startswith("LIB-TOOL-"))
for m in pm:
    link = m["href"]
    if link in by_link:
        x = by_link[link]
        x.update({"title": m["name"], "description": m["note"], "version": "hub-sync", "governance": m["governance"], "access": m.get("access", "open")})
        continue
    eco = ECO.get(m["id"], {"aud": "quality", "grc": "governance", "pmo": "pmo", "exc": "efqm", "str": "performance", "ai": "performance", "iso": "iso"}[m["system"]])
    li.append({"id": f"LIB-TOOL-{next_n:02d}", "kind": "tool", "title": m["name"], "description": m["note"], "domain": None, "ecosystem": eco,
               "standard_reference": None, "language": "ar-en", "access_tier": "free", "format": "html", "link": link, "related": [],
               "version": "hub-sync", "governance": m["governance"], "access": m.get("access", "open")})
    next_n += 1
li_doc["items"] = [x for x in li if x["kind"] != "tool" or x.get("link") in {m["href"] for m in pm}]
save("library-items", li_doc)

# ------------------------------------------------------------------ typed relationships (ADD-17)
rel_doc = load("relationships")
rel = rel_doc["items"]
keys = {(r["fromType"], r["fromId"], r["relation"], r["toType"], r["toId"]) for r in rel}


def link(ft, fid, relation, tt, tid):
    k = (ft, fid, relation, tt, tid)
    if k in keys or (ft == tt and fid == tid):
        return
    keys.add(k)
    rel.append({"id": "rel-" + hashlib.sha1("|".join(k).encode()).hexdigest()[:12], "fromType": ft, "fromId": fid, "relation": relation, "toType": tt, "toId": tid})


ECO_TOOL = {"iso27701": "information-security", "iso42001": "iso", "iso42005": "iso", "aireg": "compliance", "iso21500": "pmi", "p3o": "p3o", "pmoexc": "pmo", "kaqa": "efqm",
            "pdca": "quality", "capa": "quality", "why5": "quality", "fish": "quality", "pareto": "quality", "rca": "quality", "a3": "quality", "dmaic": "quality",
            "iso10009": "quality", "fmea": "risk", "lessons": "quality", "swot": "performance", "pestle": "performance", "stakeholders": "quality"}
for tid, eco in ECO_TOOL.items():
    link("ecosystem", eco, "links_to_tool", "platform_module", tid)
for s in std_doc["items"]:
    link("standard_family", s["id"], "links_to_tool", "platform_module", s["toolkit_id"])
    for t in s.get("related_toolkits", []):
        link("standard_family", s["id"], "links_to_tool", "platform_module", t)
    for k in s["knowledge_ids"]:
        link("standard_family", s["id"], "references", "article", k)
    for c in s["competencies"]:
        link("standard_family", s["id"], "develops", "competency", c)
for c in lib.COURSES:
    for s in c["standard_ids"]:
        link("course", c["id"], "part_of", "standard_family", s)
    for m in c["competency_mappings"]:
        link("course", c["id"], "develops", "competency", m["competency"])
    for k in c["related_knowledge_pages"]:
        link("course", c["id"], "references", "article", k)
        link("article", k, "leads_to_course", "course", c["id"])
    for t in c["tools"]:
        link("course", c["id"], "links_to_tool", "platform_module", t)
    for t in c["templates"]:
        link("course", c["id"], "references", "library_resource", t)
    for p in c["prerequisites"]:
        if p.get("course_id"):
            link("course", p["course_id"], "prerequisite_of", "course", c["id"])
    for kind in ("quiz", "final", "practical"):
        aid = c["assessments"][kind]
        link("assessment", aid, "part_of", "course", c["id"])
for a in a_items:
    if a["id"].startswith(("ASM-ISO-", "ASM-READY-ISO")):
        for comp in a.get("competencies", []):
            link("assessment", a["id"], "assesses", "competency", comp)
for r in routes:
    for s in r["steps"]:
        t = {"course": "course", "knowledge": "article"}.get(s["type"], "assessment")
        link(t, s["target_id"], "part_of", "learning_path", r["id"])
save("relationships", rel_doc)

# ------------------------------------------------------------------ build status (standing progress)
bs = load("build-status")
for p in bs["phases"]:
    if p["id"] == "7":
        p["status"], p["partial"], p["note"] = "complete", None, ("ISO Academy and the 23 toolkit guides published on 3 Nov 2026 on the owner's approval after an AI-assisted pre-review "
                                                                 "(not an independent expert review); 16 future-phase drafts remain for Phases 8–10")
bs["updated"] = "2026-11-03"
save("build-status", bs)

print(f"courses {len(courses_doc['items'])} (ISO {len(lib.COURSES)}), lessons {sum(len(m['lessons']) for c in lib.COURSES for m in c['modules'])}, "
      f"questions {len(q_doc['items'])}, assessments {len(a_items)}, sources {len(s_doc['items'])}, paths {len(p_doc['items'])}, "
      f"catalog {len(r_doc['items'])}, library {len(li_doc['items'])}, relationships {len(rel)}")
if DROPPED_APPROVALS:
    print("Approvals dropped because the content changed (review these again):", ", ".join(DROPPED_APPROVALS))
