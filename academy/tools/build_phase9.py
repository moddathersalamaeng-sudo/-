#!/usr/bin/env python3
"""Phase 9 seed builder — Quality (ASQ-informed) Academy and the Academy-wide visual layer.

Merges the authored curriculum (tools/phase9/*.py) into data/seed/*.json the way build_phase8.py does: nine courses (CRS-QMS-201
replaces the Phase 4 shell), questions, assessments (per course, quality readiness, five route diagnostics, the CMQ/OE Center
diagnostic tagged by Body of Knowledge area), ASQ sources and certifications (added to data/seed/certifications.json next to PMI),
five learning routes, catalog entries with suppress_if_mastered, the Continuous Improvement Specialist role (framework gap),
the Quality Academy navigation entry, typed relationships, the reworked Phase 5 demo item Q-QMS-001 and the programme decision.
It also writes the explanatory figures (data/seed/figures.json, governed) and where they appear (data/seed/lesson-figures.json).

Run after the toolkit and Phase 8 builders:
  python3 tools/build_toolkit_courses.py && python3 tools/build_phase8.py && python3 tools/build_phase9.py
Idempotent; only Phase 9 ids are upserted; approvals of unchanged records are kept (tools/review_hash.py). Every new record is
needs_review; publication happens only through tools/apply_review_decisions.py. Author: مدثر سلامه.
"""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SEED = ROOT / "data" / "seed"
I18N = ROOT / "data" / "i18n"
sys.path.insert(0, str(HERE / "phase9"))
sys.path.insert(0, str(HERE))

import lib9  # noqa: E402
import diagnostics9  # noqa: E402  (registers readiness, route and CMQ/OE items first)
import c_q_found, c_q_eng, c_q_mgmt  # noqa: E402,F401
import certs9  # noqa: E402
import figures9  # noqa: E402
import i18n_q  # noqa: E402
from review_hash import keep_approvals  # noqa: E402

T, gov = lib9.T, lib9.gov
COURSES, QUESTIONS = lib9.finalize()
DROPPED = []


def load(name):
    return json.loads((SEED / f"{name}.json").read_text(encoding="utf-8"))


def save(name, doc):
    path = SEED / f"{name}.json"
    if path.exists() and isinstance(doc.get("items"), list):
        DROPPED.extend(f"{name}:{i}" for i in keep_approvals(json.loads(path.read_text(encoding="utf-8")).get("items", []), doc["items"]))
    path.parent.mkdir(parents=True, exist_ok=True)
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


comp_doc = json.loads((SEED / "competency" / "competencies.json").read_text(encoding="utf-8"))
domain_of = {c["id"]: c["domain"] for c in comp_doc["items"]}

# ------------------------------------------------------------------ courses
courses_doc = load("courses")
upsert(courses_doc["items"], COURSES)
save("courses", courses_doc)
course_by_id = {c["id"]: c for c in courses_doc["items"]}
for c in COURSES:
    assert c["recommended_next_course"] in (None, *course_by_id), (c["id"], c["recommended_next_course"])
    for p in c["prerequisites"]:
        assert not p.get("course_id") or p["course_id"] in course_by_id, (c["id"], p)

# ------------------------------------------------------------------ questions
q_doc = load("questions")
practical = []
for c in COURSES:
    code = c["id"].replace("CRS-", "")
    practical.append({
        "id": f"Q-{code}-PT", "category": "quality", "course_id": c["id"], "module_id": None,
        "competency": c["competency_mappings"][0]["competency"], "difficulty": "hard", "type": "practical_assignment", "format": "practical",
        "prompt": c["practical_task"]["brief"], "deliverable": c["practical_task"]["deliverable"], "rubric": c["practical_task"]["rubric"],
        "explanation": T("Scored by a named human reviewer against the rubric. The result is recorded only after review; nothing is marked by AI.",
                         "يقيّمه مراجع بشري مسمّى وفق معيار التقييم، ولا تُسجَّل النتيجة إلا بعد المراجعة؛ ولا يُصحَّح شيء بالذكاء الاصطناعي."),
        "reference": lib9.SRC, "weight": 4, "version": lib9.VERSION, "status": "active", "governance": gov()})
upsert(q_doc["items"], QUESTIONS + practical)
for q in q_doc["items"]:  # Phase 5 type example kept (human-reviewed subjective type), now part of the Quality Academy
    if q["id"] == "Q-QMS-001":
        q.pop("planned_phase", None)
        q.update({"competency": "QM-03", "course_id": "CRS-QMS-201", "category": "quality", "auto_scored_twin": "Q-Q-RD-03"})
        q["governance"]["change_note"] = (f"Phase 5 example of the '{q['type']}' type, reworked in Phase 9: competency QM-03, linked to CRS-QMS-201; scored only by a named human "
                                          "reviewer (the engine never auto- or AI-marks this type). Its auto-scored twin for diagnostics is Q-Q-RD-03. Draft until reviewed.")
save("questions", q_doc)
qmap = {q["id"]: q for q in q_doc["items"]}

# ------------------------------------------------------------------ assessments
a_doc = load("assessments")
a_items = a_doc["items"]


def comps_of(ids):
    return sorted({qmap[i]["competency"] for i in ids})


def assessment(aid, slug, title, kind, course_id, qids, passing, minutes, desc, allow_unknown=False, **extra):
    missing = [q for q in qids if q not in qmap]
    if missing:
        raise SystemExit(f"{aid}: unknown questions {missing}")
    a = {"id": aid, "slug": slug, "title": title, "kind": kind, "course_id": course_id, "question_ids": qids, "competencies": comps_of(qids),
         "allow_unknown": allow_unknown, "estimated_minutes": minutes, "description": desc,
         "scoring": {"passing_score": passing, "method": "weighted_points", "manual_review_required_for_subjective": True},
         "integrity": {"randomize_questions": True, "randomize_options": False, "attempt_limit": None, "time_limit_minutes": None, "show_answers": "after_submission"},
         "feedback": {"show_domain_breakdown": True, "show_explanations": True}, "governance": gov()}
    a.update(extra)
    return a


new_a = []
for c in COURSES:
    code = c["id"].replace("CRS-", "")
    checks = [l["check_question_id"] for m in c["modules"] for l in m["lessons"]]
    final_q = list(dict.fromkeys([c["scenario_question_id"]] + checks + c["extra_final_question_ids"]))
    new_a.append(assessment(c["assessments"]["quiz"], c["slug"] + "-quiz", T(f"{c['title']['en']} — knowledge checks", f"{c['title']['ar']} — الاختبارات المعرفية"),
                            "knowledge_quiz", c["id"], checks, 70, 5 * len(checks),
                            T("The lesson checks of this course in one place, with explanations after each answer.", "الاختبارات القصيرة لدروس هذه الدورة في مكان واحد، مع شرح بعد كل إجابة."), True))
    new_a.append(assessment(c["assessments"]["final"], c["slug"] + "-final", T(f"{c['title']['en']} — final assessment", f"{c['title']['ar']} — التقييم الختامي"),
                            "final", c["id"], final_q, 70, 30,
                            T("Objective and scenario items written by CIA (not ASQ exam questions). 70% completes the course; completion is a CIA certificate of completion, not a professional certification.",
                              "أسئلة موضوعية وسيناريو كتبتها CIA (وليست أسئلة من اختبارات ASQ). يلزم 70% لإكمال الدورة؛ والإكمال شهادة إكمال من CIA وليس شهادة مهنية.")))
    new_a.append(assessment(c["assessments"]["practical"], c["slug"] + "-practical", T(f"{c['title']['en']} — practical task", f"{c['title']['ar']} — المهمة العملية"),
                            "practical", c["id"], [f"Q-{code}-PT"], 60, c["practical_task"]["minutes"],
                            T("Submit your work here. A named human reviewer scores it against the rubric; no automatic or AI marking is applied.",
                              "سلّم عملك هنا. يقيّمه مراجع بشري مسمّى وفق معيار التقييم، دون أي تصحيح آلي أو بالذكاء الاصطناعي.")))

new_a.append(assessment("ASM-READY-Q-001", "quality-readiness", T("Quality readiness diagnostic", "التقييم التشخيصي لجاهزية الجودة"), "diagnostic", None, list(diagnostics9.READINESS), 70, 20,
                        T("Twelve original CIA items across quality foundations, tools, problem solving, auditing, cost and suppliers. Choose “I don't know” rather than guessing — it makes your starting point more accurate. The result is not a professional qualification and years of experience are not used as evidence.",
                          "اثنا عشر سؤالًا أصليًا من CIA في أسس الجودة وأدواتها وحل المشكلات والتدقيق والتكلفة والموردين. اختر «لا أعرف» بدل التخمين لتكون نقطة بدايتك أدق. والنتيجة ليست مؤهلًا مهنيًا، ولا تُستخدم سنوات الخبرة دليلًا."), True))
ROUTE_COURSES = {"FOUND": ["CRS-QMS-201", "CRS-Q-TOOLS", "CRS-Q-CAPA", "CRS-Q-COQ"], "ENGINEER": ["CRS-QMS-201", "CRS-Q-TOOLS", "CRS-Q-SPC", "CRS-Q-CAPA", "CRS-Q-SUPPLIER"],
                 "AUDITOR": ["CRS-QMS-201", "CRS-Q-AUDIT", "CRS-Q-SUPPLIER"], "SSGB": ["CRS-Q-TOOLS", "CRS-Q-SPC", "CRS-LSS-GB", "CRS-Q-CAPA"],
                 "CMQOE": ["CRS-QMS-201", "CRS-Q-COQ", "CRS-Q-SUPPLIER", "CRS-CMQOE-PREP"]}
ROUTE_TITLES = {"FOUND": T("Quality foundations", "أساسيات الجودة"), "ENGINEER": T("Quality engineer", "مهندس الجودة"), "AUDITOR": T("Quality auditor (ASQ-informed)", "مدقق الجودة (مستنير بمنهج ASQ)"),
                "SSGB": T("Six Sigma Green Belt", "الحزام الأخضر في ستة سيجما"), "CMQOE": T("Quality manager (CMQ/OE preparation)", "مدير الجودة (إعداد لشهادة CMQ/OE)")}
for key, cids in ROUTE_COURSES.items():
    own = list(diagnostics9.ROUTE.get(key, []))
    firsts = [m["lessons"][0]["check_question_id"] for cid in cids for m in course_by_id[cid]["modules"]]
    qids = list(dict.fromkeys(own + firsts))[:10]
    new_a.append(assessment(f"ASM-Q-{key}-DIAG", f"quality-route-{key.lower()}-diagnostic", T(f"Route diagnostic — {ROUTE_TITLES[key]['en']}", f"التقييم التشخيصي للمسار — {ROUTE_TITLES[key]['ar']}"),
                            "diagnostic", None, qids, 70, 15,
                            T("Applied diagnostic for this route. “I don't know” is allowed and is treated as not yet demonstrated; what you demonstrate here lets the route skip content.",
                              "تقييم تطبيقي لهذا المسار. يُسمح باختيار «لا أعرف» ويُعامل على أنه لم يُثبت بعد؛ وما تثبته هنا يتيح للمسار تجاوز المحتوى."), True))
cmq_ids = [q for _, q in diagnostics9.CMQOE]
new_a.append(assessment("ASM-CMQOE-DIAG", "cmqoe-center-diagnostic", T("CMQ/OE Center diagnostic", "التقييم التشخيصي لمركز CMQ/OE"), "diagnostic", None, cmq_ids, 70, 25,
                        T("Fourteen original CIA items, two for each major area of the CMQ/OE Body of Knowledge (area names from ASQ; no BoK text and no ASQ exam questions). Results show your weak areas in the CMQ/OE Center. It is a study signal, not a prediction of an exam result.",
                          "أربعة عشر سؤالًا أصليًا من CIA، سؤالان لكل مجال رئيسي من مجالات معرفة CMQ/OE (أسماء المجالات من ASQ؛ دون نص المجالات ودون أسئلة اختبارات ASQ). وتُظهر النتائج مواطن ضعفك في مركز CMQ/OE. وهي إشارة للمذاكرة لا تنبؤ بنتيجة الاختبار."),
                        True, certification_id="CERT-CMQOE", bok_areas=diagnostics9.CMQOE_AREA))
upsert(a_items, new_a)
save("assessments", a_doc)
amap = {a["id"]: a for a in a_items}

# ------------------------------------------------------------------ sources and certifications
s_doc = load("sources")
upsert(s_doc["items"], [{**s, "governance": {"content_status": "needs_review", "content_source": "external_public" if s["source_type"] != "owner" else "owner",
                                                 "version": "1.0.0", "reviewer": None, "review_date": None,
                                                 "change_note": "Phase 9 source, opened and checked on 4 Nov 2026."}} for s in certs9.SOURCES])
save("sources", s_doc)
src_ids = {s["id"] for s in s_doc["items"]}
for c in COURSES:
    for s in c["source_references"]:
        assert s in src_ids, (c["id"], s)
cert_doc = load("certifications")
for x in certs9.CERTS:
    for s in x["source_ids"]:
        assert s in src_ids, (x["id"], s)
    for cid in x["cia_courses"]:
        assert cid in course_by_id, (x["id"], cid)
upsert(cert_doc["items"], certs9.CERTS)
save("certifications", cert_doc)
cert_ids = {x["id"] for x in cert_doc["items"]}
for x in certs9.CERTS:
    for n in x["next"]:
        assert n in cert_ids, (x["id"], n)
for c in COURSES:
    if c.get("related_certification"):
        assert c["related_certification"] in cert_ids, c["id"]

# ------------------------------------------------------------------ target role: Continuous Improvement Specialist (framework gap)
roles_path = SEED / "competency" / "target-roles.json"
roles_doc = json.loads(roles_path.read_text(encoding="utf-8"))
targets = {c["id"]: 0 for c in comp_doc["items"]}
targets.update({"QM-01": 2, "QM-02": 4, "QM-03": 4, "QM-04": 2, "OE-01": 2, "OE-02": 3, "PERF-01": 3, "PERF-02": 2, "LDR-01": 2, "PM-01": 2, "PM-02": 2, "RSK-01": 2, "ISO-01": 1})
role = {"type": "target_role", "id": "ROLE-CIS", "name": T("Continuous Improvement Specialist (Lean Six Sigma)", "أخصائي التحسين المستمر (لين ستة سيجما)"),
        "description": T("Leads data-driven improvement projects with Lean and DMAIC, coaches teams and sustains results with control plans.",
                         "يقود مشاريع تحسين قائمة على البيانات بمنهجي اللين وDMAIC، ويدرّب الفرق، ويستديم النتائج بخطط الضبط."),
        "targets": targets,
        "governance": {"content_status": "needs_review", "content_source": "ai_draft", "version": "0.9.0", "reviewer": None, "review_date": None,
                       "change_note": "Phase 9: the framework had no continuous-improvement / Lean Six Sigma role although the Quality Academy's Green Belt route targets it (genuine gap). Draft for review; its name is usable as a label meanwhile (D-10)."}}
old_roles = json.loads(json.dumps(roles_doc["items"]))
upsert(roles_doc["items"], [role])
DROPPED.extend(f"target-roles:{i}" for i in keep_approvals(old_roles, roles_doc["items"]))
roles_path.write_text(json.dumps(roles_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ learning routes
p_doc = load("learning-paths")


def step(n, kind, target, dep="recommended", skip_mastered=None):
    if kind == "course":
        c = course_by_id[target]; title, effort = c["title"], f"{c['training_hours']:g} h"
    elif kind == "knowledge":
        title, effort = {"KA-015": T("Quality, QA and QC", "الجودة وضمانها وضبطها"), "KA-016": T("The seven quality tools", "أدوات الجودة السبع"),
                         "KA-017": T("Cost of quality", "تكلفة الجودة")}[target], "10 min"
    else:
        a = amap[target]; title, effort = a["title"], f"{a.get('estimated_minutes') or 30} min"
    s = {"order": n, "type": kind, "target_id": target, "title": title, "dependency": dep, "effort": effort, "skip_if_completed": True}
    if skip_mastered:
        s["skip_if_mastered"] = skip_mastered
    return s


def route(rid, roles, title, goal, steps, certs_=()):
    return {"id": rid, "kind": "quality_route", "roles": roles, "certification_ids": list(certs_), "title": title, "goal": goal,
            "steps": [step(i + 1, *s) for i, s in enumerate(steps)], "governance": gov()}


QF = ["QM-01", "QM-02", "QM-03"]
ROUTES = [
    route("ROUTE-Q-FOUND", [], T("Quality foundations", "مسار أساسيات الجودة"), T("Speak the language of quality, use the basic tools with data, solve problems so they stay solved and put a number on poor quality.", "التحدث بلغة الجودة، واستخدام الأدوات الأساسية بالبيانات، وحل المشكلات بحيث تبقى محلولة، ووضع رقم لضعف الجودة."),
          [("knowledge", "KA-015"), ("assessment", "ASM-READY-Q-001"), ("course", "CRS-QMS-201", "recommended", ["QM-01"]), ("course", "CRS-Q-TOOLS", "recommended", ["QM-02"]),
           ("course", "CRS-Q-CAPA", "recommended", ["QM-03"]), ("course", "CRS-Q-COQ", "recommended", ["PERF-01"]), ("course", "CRS-M-PDCA"), ("final_assessment", "ASM-Q-CAPA-FINAL")], ["CERT-CQIA", "CERT-CQI"]),
    route("ROUTE-Q-ENGINEER", ["ROLE-QE"], T("Quality engineer", "مسار مهندس الجودة"), T("Control processes with data: tools, SPC and capability, verified root causes, risk with FMEA and supplier quality.", "ضبط العمليات بالبيانات: الأدوات والضبط الإحصائي والقدرة، والأسباب الجذرية المتحقق منها، والمخاطر بتحليل FMEA، وجودة الموردين."),
          [("assessment", "ASM-Q-ENGINEER-DIAG"), ("course", "CRS-QMS-201", "recommended", ["QM-01"]), ("course", "CRS-Q-TOOLS", "recommended", ["QM-02"]), ("course", "CRS-Q-SPC", "required"),
           ("course", "CRS-Q-CAPA", "recommended", ["QM-03"]), ("course", "CRS-M-FMEA"), ("course", "CRS-Q-SUPPLIER", "recommended", ["QM-04"]), ("final_assessment", "ASM-Q-SPC-FINAL")], ["CERT-CQE", "CERT-CQT"]),
    route("ROUTE-Q-AUDITOR", [], T("Quality auditor (ASQ-informed)", "مسار مدقق الجودة (مستنير بمنهج ASQ)"), T("Audit processes, products and systems with evidence that stands up, and report findings that management acts on.", "تدقيق العمليات والمنتجات والأنظمة بأدلة متماسكة، ورفع ملاحظات تتصرف بناءً عليها الإدارة."),
          [("assessment", "ASM-Q-AUDITOR-DIAG"), ("course", "CRS-QMS-201", "recommended", ["QM-01"]), ("course", "CRS-ISO-AUD", "recommended", ["AUD-01"]), ("course", "CRS-Q-AUDIT", "required"),
           ("course", "CRS-ISO-9001-AUD"), ("course", "CRS-Q-SUPPLIER", "recommended", ["QM-04"]), ("practice", "ASM-Q-AUDIT-PRACT")], ["CERT-CQA"]),
    route("ROUTE-Q-SSGB", ["ROLE-CIS"], T("Six Sigma Green Belt", "مسار الحزام الأخضر في ستة سيجما"), T("Lead data-driven improvement projects: tools, SPC, DMAIC with trusted measurement and verified causes, and control plans that last.", "قيادة مشاريع تحسين قائمة على البيانات: الأدوات والضبط الإحصائي وDMAIC بقياس موثوق وأسباب متحقق منها، وخطط ضبط تدوم."),
          [("assessment", "ASM-Q-SSGB-DIAG"), ("course", "CRS-Q-TOOLS", "recommended", ["QM-02"]), ("course", "CRS-Q-SPC", "recommended", ["PERF-01"]), ("course", "CRS-LSS-GB", "required"),
           ("course", "CRS-M-DMAIC"), ("course", "CRS-Q-CAPA", "recommended", ["QM-03"]), ("final_assessment", "ASM-LSS-GB-FINAL")], ["CERT-CSSGB", "CERT-CSSBB"]),
    route("ROUTE-Q-CMQOE", ["ROLE-QMGR"], T("Quality manager (CMQ/OE preparation)", "مسار مدير الجودة (إعداد لشهادة CMQ/OE)"), T("Lead quality and organisational excellence: the financial case, suppliers, strategy, leadership and a CMQ/OE study plan from your own diagnostic. CIA internal route; exam-preparation label only.", "قيادة الجودة والتميز المؤسسي: الحالة المالية والموردون والاستراتيجية والقيادة وخطة مذاكرة لشهادة CMQ/OE من تقييمك التشخيصي. مسار داخلي من CIA؛ بوسم إعداد للاختبار فقط."),
          [("assessment", "ASM-CMQOE-DIAG"), ("course", "CRS-QMS-201", "recommended", ["QM-01"]), ("course", "CRS-Q-TOOLS", "recommended", ["QM-02"]), ("course", "CRS-Q-COQ", "recommended", ["PERF-01"]),
           ("course", "CRS-Q-SUPPLIER", "recommended", ["QM-04"]), ("course", "CRS-CMQOE-PREP", "required"), ("final_assessment", "ASM-CMQOE-PREP-FINAL")], ["CERT-CMQOE", "CERT-CCQM"]),
]
for r in ROUTES:
    for s in r["steps"]:
        assert s["target_id"] in course_by_id or s["target_id"] in amap or s["target_id"].startswith("KA-"), (r["id"], s["target_id"])
upsert(p_doc["items"], ROUTES)
save("learning-paths", p_doc)
route_roles = {r["id"]: r["roles"] for r in ROUTES}

# ------------------------------------------------------------------ recommendation catalog
r_doc = load("recommendation-catalog")
SUPPRESS = {"CRS-QMS-201": ["QM-01"], "CRS-Q-TOOLS": ["QM-02"], "CRS-Q-CAPA": ["QM-03"], "CRS-Q-SPC": ["QM-02", "PERF-01"], "CRS-Q-AUDIT": ["AUD-01", "AUD-02", "AUD-03"],
            "CRS-Q-COQ": ["PERF-01"], "CRS-Q-SUPPLIER": ["QM-04"], "CRS-LSS-GB": ["QM-02", "QM-03", "OE-02"]}
CERT_KW = {"CRS-CMQOE-PREP": ["CMQ/OE", "CMQ", "quality manager"], "CRS-Q-AUDIT": ["CQA", "auditor"], "CRS-Q-SPC": ["CQE", "CQT", "SPC"], "CRS-LSS-GB": ["CSSGB", "Green Belt", "Six Sigma", "CSSBB"],
           "CRS-QMS-201": ["CQIA", "CQI"], "CRS-Q-TOOLS": ["CQIA", "CQT", "CSSGB"], "CRS-Q-CAPA": ["CQE", "CQA"], "CRS-Q-COQ": ["CMQ/OE"], "CRS-Q-SUPPLIER": ["CQE", "CSQP"]}
INTEREST = ["quality", "جودة", "asq", "الجودة"]
legacy = {r["target_id"]: r["id"] for r in r_doc["items"] if not r["id"].startswith("REC-CRS-") and r.get("recommendation_type") == "course"}
r_doc["items"] = [r for r in r_doc["items"] if not (r["id"].startswith("REC-CRS-") and r["target_id"] in legacy)]
recs = []
for c in COURSES:
    comps = [m["competency"] for m in c["competency_mappings"]]
    rec = {"id": legacy.get(c["id"], "REC-" + c["id"]), "recommendation_type": "course", "target_id": c["id"], "title": c["title"], "competencies": comps,
           "domains": sorted({domain_of[x] for x in comps}), "roles": sorted({r for rid in c["route_ids"] for r in route_roles.get(rid, [])}),
           "level": c["level"], "estimated_effort": f"{c['training_hours']:g} h",
           "prerequisites": [{"target_id": p["course_id"], "required": True} for p in c["prerequisites"] if p.get("course_id") and p.get("required")],
           "interest_keywords": INTEREST + (["six sigma", "lean", "سيجما"] if "LSS" in c["id"] else []) + (["audit", "تدقيق"] if "AUDIT" in c["id"] else []) + (["supplier", "مورد"] if "SUPPLIER" in c["id"] else []),
           "certification_keywords": CERT_KW.get(c["id"], []), "standard_ids": []}
    if c["id"] in SUPPRESS:
        rec["suppress_if_mastered"] = SUPPRESS[c["id"]]
    recs.append(rec)
for aid in ["ASM-READY-Q-001", "ASM-CMQOE-DIAG"] + [f"ASM-Q-{k}-DIAG" for k in ROUTE_COURSES]:
    a = amap[aid]
    recs.append({"id": "REC-" + aid, "recommendation_type": "assessment", "target_id": aid, "title": a["title"], "competencies": a["competencies"],
                 "domains": sorted({domain_of[x] for x in a["competencies"]}), "roles": [], "level": 1, "estimated_effort": f"{a['estimated_minutes']} min",
                 "prerequisites": [], "interest_keywords": INTEREST, "certification_keywords": ["CMQ/OE"] if aid == "ASM-CMQOE-DIAG" else (["CQIA", "CQE", "CQA"] if aid == "ASM-READY-Q-001" else []), "standard_ids": []})
upsert(r_doc["items"], recs)
for r in r_doc["items"]:
    if r["target_id"] in SUPPRESS and not r["id"].startswith("REC-CRS-"):
        r["suppress_if_mastered"] = SUPPRESS[r["target_id"]]
save("recommendation-catalog", r_doc)

# ------------------------------------------------------------------ programme decision
pr_doc = load("programs")
for p in pr_doc["items"]:
    if p["id"] == "PRG-CIA-FOUNDATIONS":
        p["stages"] = [{"order": 1, "course_id": "CRS-ISO-101"}, {"order": 2, "course_id": "CRS-QMS-201"}, {"order": 3, "course_id": "CRS-PM-101"}, {"order": 4, "course_id": "CRS-ISO-RISK"}]
        p.pop("planned_phase", None)
        p["governance"].update({"content_status": "needs_review", "version": "1.0.0", "change_note":
                                "Phase 9 decision: completed with Quality Management Foundations — ISO foundations → Quality Management Foundations → Project Management Foundations → Risk-based thinking. Ready for review; no longer waiting for a future phase."})
save("programs", pr_doc)

# ------------------------------------------------------------------ navigation
nav_doc = load("navigation")
nav = nav_doc["items"]
if not any(n["id"] == "qualityAcademy" for n in nav):
    i = next(k for k, n in enumerate(nav) if n["id"] == "pmiAcademy") + 1
    nav.insert(i, {"id": "qualityAcademy", "labelKey": "nav.items.qualityAcademy", "group": "learn", "kind": "route", "phase": 9, "status": "active",
                   "roles": ["learner", "instructor", "reviewer", "admin", "company_admin"], "requiredTier": "free", "primary": False, "route": "/academy/quality"})
save("navigation", nav_doc)

# ------------------------------------------------------------------ figures (governed) and placement
for f in figures9.FIGS:
    f["governance"] = {"content_status": "needs_review", "content_source": "ai_draft", "version": "0.9.0", "reviewer": None, "review_date": None,
                       "change_note": "Phase 9 explanatory figure (original CIA diagram, data-driven SVG); awaiting review."}
ids = [f["id"] for f in figures9.FIGS]
assert len(ids) == len(set(ids)), "duplicate figure id"
fig_path = SEED / "figures.json"
fig_doc = json.loads(fig_path.read_text(encoding="utf-8")) if fig_path.exists() else {"schema": "cia.figure.v1", "items": []}
fig_doc["items"] = [x for x in fig_doc["items"] if x["id"] in set(ids)]
upsert(fig_doc["items"], figures9.FIGS)
save("figures", fig_doc)
lesson_ids = {l["id"] for c in courses_doc["items"] for m in c.get("modules", []) for l in m.get("lessons", [])}
guide_slugs = {c.get("guide") for c in courses_doc["items"] if c.get("guide")}
for key in figures9.PLACEMENT:
    kind, _, k = key.partition(":") if ":" in key else ("lesson", "", key)
    ok = (k in lesson_ids) if kind == "lesson" else (k in course_by_id) if kind == "course" else (k in guide_slugs)
    assert ok, f"figure placement points at unknown {kind}: {key}"
(SEED / "lesson-figures.json").write_text(json.dumps({"schema": "cia.lesson-figures.v1", "items": [{"id": k, "figures": v} for k, v in figures9.PLACEMENT.items()]},
                                                     ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ relationships
rel_doc = load("relationships")
rel = rel_doc["items"]
keys = {(r["fromType"], r["fromId"], r["relation"], r["toType"], r["toId"]) for r in rel}


def link(ft, fid, relation, tt, tid):
    k = (ft, fid, relation, tt, tid)
    if k in keys or (ft == tt and fid == tid):
        return
    keys.add(k)
    rel.append({"id": "rel-" + hashlib.sha1("|".join(k).encode()).hexdigest()[:12], "fromType": ft, "fromId": fid, "relation": relation, "toType": tt, "toId": tid})


for c in COURSES:
    for m in c["competency_mappings"]:
        link("course", c["id"], "develops", "competency", m["competency"])
    for k in c["related_knowledge_pages"]:
        link("course", c["id"], "references", "article", k)
        link("article", k, "leads_to_course", "course", c["id"])
    for t in c["tools"]:
        link("course", c["id"], "links_to_tool", "platform_module", t)
    for p in c["prerequisites"]:
        if p.get("course_id"):
            link("course", p["course_id"], "prerequisite_of", "course", c["id"])
    for kind in ("quiz", "final", "practical"):
        link("assessment", c["assessments"][kind], "part_of", "course", c["id"])
    if c.get("related_certification"):
        link("course", c["id"], "prepares_for", "certification", c["related_certification"])
for x in certs9.CERTS:
    for cid in x["cia_courses"]:
        link("course", cid, "related_to", "certification", x["id"])
    for comp in x["competencies"]:
        link("certification", x["id"], "related_to", "competency", comp)
    for t in x["toolkits"]:
        link("certification", x["id"], "links_to_tool", "platform_module", t)
for aid in ["ASM-READY-Q-001", "ASM-CMQOE-DIAG"] + [f"ASM-Q-{k}-DIAG" for k in ROUTE_COURSES]:
    for comp in amap[aid]["competencies"]:
        link("assessment", aid, "assesses", "competency", comp)
for r in ROUTES:
    for s in r["steps"]:
        link({"course": "course", "knowledge": "article"}.get(s["type"], "assessment"), s["target_id"], "part_of", "learning_path", r["id"])
save("relationships", rel_doc)

# ------------------------------------------------------------------ build status
bs = load("build-status")
for p in bs["phases"]:
    if str(p.get("id")) == "9":
        p.pop("fraction", None)
        p.update({"status": "in_progress", "partial": None,
                  "note": "Quality (ASQ-informed) Academy built (4 Nov 2026): 9 courses, explorer of 9 ASQ certifications, CMQ/OE Center, 5 routes; explanatory figures and course covers for the whole Academy. Content awaits review / owner approval."})
bs["updated"] = "2026-11-04"
save("build-status", bs)

# ------------------------------------------------------------------ UI strings


def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v)
        else:
            dst[k] = v


for lang, part in (("en", i18n_q.EN), ("ar", i18n_q.AR)):
    p = I18N / f"{lang}.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    merge(d, part)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

n_lessons = sum(len(m["lessons"]) for c in COURSES for m in c["modules"])
print(f"phase 9: courses {len(COURSES)} ({n_lessons} lessons, {sum(c['training_hours'] for c in COURSES):g} h), questions {len(QUESTIONS) + len(practical)}, "
      f"assessments {len(new_a)}, certifications {len(certs9.CERTS)}, routes {len(ROUTES)}, catalog {len(recs)}, sources {len(certs9.SOURCES)}, "
      f"figures {len(figures9.FIGS)} placed on {len(figures9.PLACEMENT)} targets")
if DROPPED:
    print("approvals dropped because content changed:", ", ".join(DROPPED))
