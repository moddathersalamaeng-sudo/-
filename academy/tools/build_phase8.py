#!/usr/bin/env python3
"""Phase 8 seed builder — PMI / PMO / P3O Academy.

Merges the authored curriculum (tools/phase8/*.py) into data/seed/*.json, the way build_phase7.py does for ISO:
courses (10, two of them replacing the Phase 4 shells CRS-PM-101 and CRS-P3O-101), questions, assessments (per course,
PM readiness diagnostic, five route diagnostics), sources, the certification explorer (data/seed/certifications.json),
five learning routes, recommendation catalog entries with suppress_if_mastered, the Project Manager target role
(framework gap, needs_review), navigation (Certification + PMI Academy), typed relationships, the reworked Phase 5 demo items
and the UI strings (data/i18n). It only upserts Phase 8 ids and never rewrites Phase 7 records.

Run after tools/build_toolkit_courses.py (which builds the practice guides, their generated courses and the lesson → guide map):
  python3 tools/build_toolkit_courses.py && python3 tools/build_phase8.py
Idempotent; approvals of unchanged records are kept (tools/review_hash.py). Every new record is needs_review; publication
happens only through tools/apply_review_decisions.py. Author: مدثر سلامه.
"""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SEED = ROOT / "data" / "seed"
I18N = ROOT / "data" / "i18n"
sys.path.insert(0, str(HERE / "phase8"))
sys.path.insert(0, str(HERE))

import lib8  # noqa: E402
import diagnostics8  # noqa: E402  (registers readiness + route items first)
import c_pm, c_pmo, c_agile_pmp  # noqa: E402,F401
import certs  # noqa: E402
import i18n_gd, i18n_pmi  # noqa: E402
from review_hash import keep_approvals  # noqa: E402

T, gov = lib8.T, lib8.gov
COURSES, QUESTIONS = lib8.finalize()
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
for c in courses_doc["items"]:
    if c["id"] == "CRS-EFQM-101":  # future-phase shell: say so in the record (CRS-QMS-201 is a full course since Phase 9)
        c["planned_phase"] = 9 if c["id"] == "CRS-QMS-201" else 10
        c["governance"]["change_note"] = (f"Phase 4 shell kept as a draft for Phase {c['planned_phase']} "
                                          f"({'ASQ / Quality' if c['planned_phase'] == 9 else 'EFQM / Excellence'}); not shown to learners.")
save("courses", courses_doc)
course_by_id = {c["id"]: c for c in courses_doc["items"]}

# ------------------------------------------------------------------ questions
q_doc = load("questions")
practical = []
for c in COURSES:
    code = c["id"].replace("CRS-", "")
    practical.append({
        "id": f"Q-{code}-PT", "category": c["category"], "course_id": c["id"], "module_id": None,
        "competency": c["competency_mappings"][0]["competency"], "difficulty": "hard", "type": "practical_assignment", "format": "practical",
        "prompt": c["practical_task"]["brief"], "deliverable": c["practical_task"]["deliverable"], "rubric": c["practical_task"]["rubric"],
        "explanation": T("Scored by a named human reviewer against the rubric. The result is recorded only after review; nothing is marked by AI.",
                         "يقيّمه مراجع بشري مسمّى وفق معيار التقييم، ولا تُسجَّل النتيجة إلا بعد المراجعة؛ ولا يُصحَّح شيء بالذكاء الاصطناعي."),
        "reference": lib8.SRC, "weight": 4, "version": lib8.VERSION, "status": "active", "governance": gov()})
upsert(q_doc["items"], QUESTIONS + practical)
DEMO_REWORK = {  # Phase 5 type examples (human-reviewed subjective types): valid competency, the Phase 8 course they belong to, an honest note
    "Q-PM-001": ("PM-01", "CRS-PM-101", "Q-PM-RD-01"), "Q-PMO-001": ("PMO-01", "CRS-PMO-DESIGN", "Q-PM-RD-02"), "Q-RISK-001": ("RSK-02", "CRS-PM-RISK", "Q-PM-RD-03"),
    "Q-GOV-001": ("GOV-02", "CRS-PMO-DESIGN", "Q-PMO-RD-01"), "Q-AI-001": ("PM-02", "CRS-PM-STAKE", "Q-PM-FOUND-RD-01")}
for q in q_doc["items"]:
    if q["id"] in DEMO_REWORK:
        comp, cid, twin = DEMO_REWORK[q["id"]]
        q.update({"competency": comp, "course_id": cid, "category": "project_management", "auto_scored_twin": twin})
        q["governance"]["change_note"] = (f"Phase 5 example of the '{q['type']}' type, reworked in Phase 8: competency {comp}, linked to {cid}; scored only by a named human reviewer "
                                          f"(the engine never auto- or AI-marks this type). Its auto-scored twin for diagnostics is {twin}. Draft until reviewed.")
for q in q_doc["items"]:  # future-phase demo items: valid competency ids and an explicit phase
    if q["id"] == "Q-QMS-001" and q.get("course_id") != "CRS-QMS-201":  # Phase 9 owns this item once tools/build_phase9.py has run
        q.update({"competency": "QM-03", "planned_phase": 9})
        q["governance"]["change_note"] = "Phase 5 demo item kept as a draft for Phase 9 (ASQ / Quality); competency id corrected to QM-03."
    if q["id"] == "Q-EFQM-001":
        q.update({"competency": "OE-01", "planned_phase": 10})
        q["governance"]["change_note"] = "Phase 5 demo item kept as a draft for Phase 10 (EFQM); competency id corrected to OE-01."
save("questions", q_doc)
qmap = {q["id"]: q for q in q_doc["items"]}

# ------------------------------------------------------------------ assessments
a_doc = load("assessments")
a_items = a_doc["items"]


def comps_of(ids):
    return sorted({qmap[i]["competency"] for i in ids})


def assessment(aid, slug, title, kind, course_id, qids, passing, minutes, desc, allow_unknown=False):
    missing = [q for q in qids if q not in qmap]
    if missing:
        raise SystemExit(f"{aid}: unknown questions {missing}")
    return {"id": aid, "slug": slug, "title": title, "kind": kind, "course_id": course_id, "question_ids": qids, "competencies": comps_of(qids),
            "allow_unknown": allow_unknown, "estimated_minutes": minutes, "description": desc,
            "scoring": {"passing_score": passing, "method": "weighted_points", "manual_review_required_for_subjective": True},
            "integrity": {"randomize_questions": True, "randomize_options": False, "attempt_limit": None, "time_limit_minutes": None, "show_answers": "after_submission"},
            "feedback": {"show_domain_breakdown": True, "show_explanations": True}, "governance": gov()}


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
                            T("Objective and scenario items written by CIA (not PMI exam questions). 70% completes the course; completion is a CIA certificate of completion, not a professional certification.",
                              "أسئلة موضوعية وسيناريو كتبتها CIA (وليست أسئلة من اختبار PMI). يلزم 70% لإكمال الدورة؛ والإكمال شهادة إكمال من CIA وليس شهادة مهنية.")))
    new_a.append(assessment(c["assessments"]["practical"], c["slug"] + "-practical", T(f"{c['title']['en']} — practical task", f"{c['title']['ar']} — المهمة العملية"),
                            "practical", c["id"], [f"Q-{code}-PT"], 60, c["practical_task"]["minutes"],
                            T("Submit your work here. A named human reviewer scores it against the rubric; no automatic or AI marking is applied.",
                              "سلّم عملك هنا. يقيّمه مراجع بشري مسمّى وفق معيار التقييم، دون أي تصحيح آلي أو بالذكاء الاصطناعي.")))

ready_ids = list(diagnostics8.READINESS)
new_a.append(assessment("ASM-READY-PM-001", "pm-readiness", T("Project management readiness diagnostic", "التقييم التشخيصي لجاهزية إدارة المشاريع"), "diagnostic", None, ready_ids, 70, 20,
                        T("Twelve original CIA items across projects, risk, governance and PMOs. Choose “I don't know” rather than guessing — it makes your starting point more accurate. The result is not a professional qualification and years of experience are not used as evidence.",
                          "اثنا عشر سؤالًا أصليًا من CIA في المشاريع والمخاطر والحوكمة ومكاتب المشاريع. اختر «لا أعرف» بدل التخمين لتكون نقطة بدايتك أدق. والنتيجة ليست مؤهلًا مهنيًا، ولا تُستخدم سنوات الخبرة دليلًا."), True))
ROUTE_COURSES = {"FOUND": ["CRS-PM-101", "CRS-PM-SSC", "CRS-PM-RISK", "CRS-PM-STAKE"], "PMP": ["CRS-PM-SSC", "CRS-PM-RISK", "CRS-PM-STAKE", "CRS-PM-AGILE", "CRS-PMP-PREP"],
                 "PMO": ["CRS-PMO-DESIGN", "CRS-PMO-KPI", "CRS-P3O-101"], "PORTFOLIO": ["CRS-PFM-PRIOR", "CRS-P3O-101"], "AGILE": ["CRS-PM-AGILE", "CRS-PM-STAKE"]}
ROUTE_TITLES = {"FOUND": T("Project foundations", "أساسيات المشاريع"), "PMP": T("PMP® preparation", "الإعداد لـ PMP®"), "PMO": T("PMO set-up and maturity", "إنشاء مكتب المشاريع ونضجه"),
                "PORTFOLIO": T("Portfolio and programme", "المحافظ والبرامج"), "AGILE": T("Agile delivery foundations", "أساسيات التسليم الرشيق")}
for key, cids in ROUTE_COURSES.items():
    own = list(diagnostics8.ROUTE.get(key, []))
    firsts = [m["lessons"][0]["check_question_id"] for cid in cids for m in course_by_id[cid]["modules"]]
    qids = list(dict.fromkeys(own + firsts))[:10]
    new_a.append(assessment(f"ASM-PM-{key}-DIAG", f"pm-route-{key.lower()}-diagnostic", T(f"Route diagnostic — {ROUTE_TITLES[key]['en']}", f"التقييم التشخيصي للمسار — {ROUTE_TITLES[key]['ar']}"),
                            "diagnostic", None, qids, 70, 15,
                            T("Applied diagnostic for this route. “I don't know” is allowed and is treated as not yet demonstrated; what you demonstrate here lets the route skip content.",
                              "تقييم تطبيقي لهذا المسار. يُسمح باختيار «لا أعرف» ويُعامل على أنه لم يُثبت بعد؛ وما تثبته هنا يتيح للمسار تجاوز المحتوى."), True))
for a in a_items:  # Phase 5 demo assessments: kept as drafts, with the phase that will decide them
    if a["id"] in ("ASM-DIAG-001", "ASM-QUIZ-001", "ASM-SCEN-001", "ASM-PRACT-001"):
        a["planned_phase"] = 12
        a["governance"]["change_note"] = ("Phase 5 demo assessment kept as a draft: its PMI items were rewritten in Phase 8 and are now used by the PM readiness and route "
                                          "diagnostics; the cross-domain demo itself is reconsidered with the career diagnostic in Phase 12. Not shown to learners.")
upsert(a_items, new_a)
save("assessments", a_doc)
amap = {a["id"]: a for a in a_items}

# ------------------------------------------------------------------ sources and certifications
s_doc = load("sources")
upsert(s_doc["items"], [{**s, "governance": {"content_status": "needs_review", "content_source": "external_public" if s["source_type"] != "owner" else "owner",
                                                 "version": "1.0.0", "reviewer": None, "review_date": None,
                                                 "change_note": "Phase 8 source, opened and checked on 3 Nov 2026."}} for s in certs.SOURCES])
save("sources", s_doc)
src_ids = {s["id"] for s in s_doc["items"]}
for c in COURSES:
    for s in c["source_references"]:
        assert s in src_ids, (c["id"], s)
cert_doc = load("certifications") if (SEED / "certifications.json").exists() else {"schema": "cia.certification.v1", "items": []}
upsert(cert_doc["items"], certs.CERTS)  # Phase 9 adds ASQ records to the same collection: never drop them
for x in certs.CERTS:
    for s in x["source_ids"]:
        assert s in src_ids, (x["id"], s)
    for cid in x["cia_courses"]:
        assert cid in course_by_id, (x["id"], cid)
save("certifications", cert_doc)
for c in courses_doc["items"]:
    if c.get("related_certification"):
        assert any(x["id"] == c["related_certification"] for x in cert_doc["items"]), c["id"]

# ------------------------------------------------------------------ target role: Project Manager (framework gap)
roles_path = SEED / "competency" / "target-roles.json"
roles_doc = json.loads(roles_path.read_text(encoding="utf-8"))
base_targets = {c["id"]: 0 for c in comp_doc["items"]}
base_targets.update({"PM-01": 4, "PM-02": 4, "PM-03": 3, "RSK-01": 3, "RSK-02": 3, "GOV-01": 2, "PMO-02": 2, "LDR-01": 3, "LDR-02": 2, "PERF-01": 2, "PERF-02": 2,
                     "QM-01": 1, "ISO-01": 1, "CMP-01": 1})
role_pm = {"type": "target_role", "id": "ROLE-PM", "name": T("Project Manager", "مدير مشروع"),
           "description": T("Leads projects end to end: scope, schedule, cost, risk, stakeholders and delivery approach.", "يقود المشاريع من البداية إلى النهاية: النطاق والجدول والتكلفة والمخاطر وأصحاب المصلحة ونهج التسليم."),
           "targets": base_targets,
           "governance": {"content_status": "needs_review", "content_source": "ai_draft", "version": "0.9.0", "reviewer": None, "review_date": None,
                          "change_note": "Phase 8: the framework had no project-manager role although the PMI Academy targets it (genuine gap). Draft for review; its name is usable as a label meanwhile (D-10)."}}
old_roles = json.loads(json.dumps(roles_doc["items"]))
upsert(roles_doc["items"], [role_pm])
DROPPED.extend(f"target-roles:{i}" for i in keep_approvals(old_roles, roles_doc["items"]))  # keep an approval while the record is unchanged
roles_path.write_text(json.dumps(roles_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ learning routes
p_doc = load("learning-paths")
for p in p_doc["items"]:  # Phase 6 PMO path: kept for its tests and history, hidden from the route picker
    if p["id"] == "PATH-PMO":
        p["superseded_by"] = "ROUTE-PMO"


def step(n, kind, target, dep="recommended", skip_mastered=None):
    if kind == "course":
        c = course_by_id[target]; title, effort = c["title"], f"{c['training_hours']:g} h"
    elif kind == "knowledge":
        title, effort = {"KA-011": T("Project vs programme vs portfolio", "المشروع والبرنامج والمحفظة"), "KA-012": T("PMO types", "أنواع مكاتب المشاريع"),
                         "KA-013": T("Predictive, agile and hybrid", "التنبؤي والرشيق والهجين")}[target], "10 min"
    else:
        a = amap[target]; title, effort = a["title"], f"{a.get('estimated_minutes') or 30} min"
    s = {"order": n, "type": kind, "target_id": target, "title": title, "dependency": dep, "effort": effort, "skip_if_completed": True}
    if skip_mastered:
        s["skip_if_mastered"] = skip_mastered
    return s


def route(rid, roles, title, goal, steps, certs_=()):
    return {"id": rid, "kind": "pm_route", "roles": roles, "certification_ids": list(certs_), "title": title, "goal": goal,
            "steps": [step(i + 1, *s) for i, s in enumerate(steps)], "governance": gov()}


PMF = ["PM-01", "PM-02", "PM-03"]
ROUTES = [
    route("ROUTE-PM-FOUND", [], T("Project foundations", "مسار أساسيات المشاريع"), T("Understand how projects are governed and planned, and deliver with risk and stakeholders under control.", "فهم كيف تُحوكم المشاريع وتُخطط، والتسليم مع ضبط المخاطر وأصحاب المصلحة."),
          [("knowledge", "KA-011"), ("assessment", "ASM-READY-PM-001"), ("course", "CRS-PM-101", "recommended", PMF), ("course", "CRS-PM-SSC", "recommended", ["PM-01"]),
           ("course", "CRS-PM-RISK", "recommended", ["RSK-01", "RSK-02"]), ("course", "CRS-PM-STAKE", "recommended", ["PM-02"]), ("course", "CRS-P-21500"), ("final_assessment", "ASM-PM-SSC-FINAL")], ["CERT-CAPM"]),
    route("ROUTE-PMP", ["ROLE-PM"], T("PMP® preparation", "مسار الإعداد لـ PMP®"), T("Close your gaps across People, Process and Business Environment, then prepare the application and the exam with a study plan. CIA internal route; exam-preparation label only.", "سد فجواتك في الأفراد والعمليات وبيئة الأعمال، ثم إعداد الطلب والاختبار بخطة مذاكرة. مسار داخلي من CIA؛ بوسم إعداد للاختبار فقط."),
          [("assessment", "ASM-PM-PMP-DIAG"), ("course", "CRS-PM-101", "recommended", PMF), ("course", "CRS-PM-SSC", "recommended", ["PM-01"]), ("course", "CRS-PM-RISK", "recommended", ["RSK-01", "RSK-02"]),
           ("course", "CRS-PM-STAKE", "recommended", ["PM-02"]), ("course", "CRS-PM-AGILE", "recommended", ["PM-03"]), ("course", "CRS-PMP-PREP", "required"), ("final_assessment", "ASM-PMP-PREP-FINAL")], ["CERT-PMP"]),
    route("ROUTE-PMO", ["ROLE-PMOA"], T("PMO set-up and maturity", "مسار إنشاء مكتب المشاريع ونضجه"), T("Design a PMO that customers use, measure its maturity and value honestly, and plan the next level.", "تصميم مكتب مشاريع يستخدمه العملاء، وقياس نضجه وقيمته بصدق، وتخطيط المستوى التالي."),
          [("assessment", "ASM-PM-PMO-DIAG"), ("course", "CRS-PM-101", "recommended", PMF), ("course", "CRS-PMO-DESIGN", "required", ["PMO-01"]), ("course", "CRS-PMO-KPI", "recommended", ["PMO-02", "OE-01"]),
           ("course", "CRS-P3O-101"), ("course", "CRS-P-P3M3"), ("course", "CRS-P-PMX"), ("practice", "ASM-PMO-KPI-PRACT")], ["CERT-PMI-PMOCP"]),
    route("ROUTE-PORTFOLIO", [], T("Portfolio and programme (P3O-informed)", "مسار المحافظ والبرامج (مستنير بـ P3O)"), T("Choose and balance the right initiatives, govern them through gates and track the benefits they deliver.", "اختيار المبادرات الصحيحة وموازنتها، وحوكمتها عبر البوابات، ومتابعة المنافع التي تحققها."),
          [("assessment", "ASM-PM-PORTFOLIO-DIAG"), ("course", "CRS-PM-101", "recommended", PMF), ("course", "CRS-PFM-PRIOR", "required"), ("course", "CRS-P3O-101", "recommended", ["PMO-01"]),
           ("course", "CRS-P-21500"), ("final_assessment", "ASM-PFM-PRIOR-FINAL")], ["CERT-PFMP", "CERT-PGMP"]),
    route("ROUTE-AGILE", [], T("Agile delivery foundations", "مسار أساسيات التسليم الرشيق"), T("Choose the right delivery approach, run Scrum or Kanban well, tailor hybrid plans and govern agile work by outcomes.", "اختيار نهج التسليم المناسب، وإدارة Scrum أو Kanban جيدًا، وتكييف الخطط الهجينة، وحوكمة العمل الرشيق بالنتائج."),
          [("knowledge", "KA-013"), ("assessment", "ASM-PM-AGILE-DIAG"), ("course", "CRS-PM-101", "recommended", PMF), ("course", "CRS-PM-AGILE", "required", ["PM-03"]),
           ("course", "CRS-PM-STAKE", "recommended", ["PM-02"]), ("course", "CRS-PM-RISK", "recommended", ["RSK-01", "RSK-02"]), ("final_assessment", "ASM-PM-AGILE-FINAL")], ["CERT-PMI-ACP"]),
]
upsert(p_doc["items"], ROUTES)
save("learning-paths", p_doc)
route_roles = {r["id"]: r["roles"] for r in ROUTES}

# ------------------------------------------------------------------ recommendation catalog
r_doc = load("recommendation-catalog")
SUPPRESS = {"CRS-PM-101": PMF, "CRS-PM-SSC": ["PM-01"], "CRS-PM-RISK": ["RSK-01", "RSK-02"], "CRS-PM-STAKE": ["PM-02"], "CRS-PM-AGILE": ["PM-03"],
            "CRS-PMO-DESIGN": ["PMO-01"], "CRS-PMO-KPI": ["PMO-02", "OE-01"], "CRS-P3O-101": ["PMO-01", "PMO-02"]}
CERT_KW = {"CRS-PMP-PREP": ["PMP", "بي إم بي"], "CRS-PM-AGILE": ["PMI-ACP", "ACP", "agile"], "CRS-PM-RISK": ["PMI-RMP", "RMP"], "CRS-PMO-DESIGN": ["PMOCP", "PMO"],
           "CRS-PMO-KPI": ["PMOCP", "P3M3"], "CRS-P3O-101": ["P3O"], "CRS-PFM-PRIOR": ["PfMP", "portfolio"], "CRS-PM-101": ["CAPM", "PMP"], "CRS-PM-SSC": ["PMP", "CAPM"], "CRS-PM-STAKE": ["PMP"]}
INTEREST = {"pmi": ["project", "pmi", "مشروع", "مشاريع"], "pmo": ["pmo", "مكتب", "portfolio", "محفظة"], "p3o": ["p3o", "pmo", "مكتب"]}
recs = []
legacy = {r["target_id"]: r["id"] for r in r_doc["items"] if not r["id"].startswith("REC-CRS-") and r.get("recommendation_type") == "course"}
r_doc["items"] = [r for r in r_doc["items"] if not (r["id"].startswith("REC-CRS-") and r["target_id"] in legacy)]  # one entry per course
for c in COURSES:
    comps = [m["competency"] for m in c["competency_mappings"]]
    rec = {"id": legacy.get(c["id"], "REC-" + c["id"]), "recommendation_type": "course", "target_id": c["id"], "title": c["title"], "competencies": comps,
           "domains": sorted({domain_of[x] for x in comps}), "roles": sorted({r for rid in c["route_ids"] for r in route_roles.get(rid, [])}),
           "level": c["level"], "estimated_effort": f"{c['training_hours']:g} h",
           "prerequisites": [{"target_id": p["course_id"], "required": True} for p in c["prerequisites"] if p.get("course_id") and p.get("required")],
           "interest_keywords": INTEREST.get(c["ecosystem"], []) + (["agile", "رشيق", "scrum"] if "AGILE" in c["id"] else []) + (["risk", "مخاطر"] if "RISK" in c["id"] else []),
           "certification_keywords": CERT_KW.get(c["id"], []), "standard_ids": []}
    if c["id"] in SUPPRESS:
        rec["suppress_if_mastered"] = SUPPRESS[c["id"]]
    recs.append(rec)
for aid in ["ASM-READY-PM-001"] + [f"ASM-PM-{k}-DIAG" for k in ROUTE_COURSES]:
    a = amap[aid]
    recs.append({"id": "REC-" + aid, "recommendation_type": "assessment", "target_id": aid, "title": a["title"], "competencies": a["competencies"],
                 "domains": sorted({domain_of[x] for x in a["competencies"]}), "roles": [], "level": 1, "estimated_effort": f"{a['estimated_minutes']} min",
                 "prerequisites": [], "interest_keywords": ["project", "pmi", "pmo", "مشاريع"], "certification_keywords": ["PMP", "CAPM", "PMOCP"] if aid == "ASM-READY-PM-001" else [], "standard_ids": []})
upsert(r_doc["items"], recs)
for r in r_doc["items"]:  # older (Phase 6) entries that point at the same courses get the same suppression rule
    if r["target_id"] in SUPPRESS and not r["id"].startswith("REC-CRS-"):
        r["suppress_if_mastered"] = SUPPRESS[r["target_id"]]
save("recommendation-catalog", r_doc)

# ------------------------------------------------------------------ programme decision
pr_doc = load("programs")
for p in pr_doc["items"]:
    if p["id"] == "PRG-CIA-FOUNDATIONS" and not any(st.get("course_id") == "CRS-QMS-201" for st in p.get("stages", [])):  # Phase 9 completed it
        p["stages"] = [{"order": 1, "course_id": "CRS-ISO-101"}, {"order": 2, "course_id": "CRS-PM-101"}, {"order": 3, "course_id": "CRS-ISO-RISK"}]
        p["governance"].update({"content_status": "needs_review", "version": "0.9.0", "change_note":
                                "Phase 8 decision: restaged to ISO foundations → Project Management Foundations → Risk-based thinking (CRS-QMS-201 waits for Phase 9). Draft until reviewed."})
save("programs", pr_doc)

# ------------------------------------------------------------------ navigation
nav_doc = load("navigation")
nav = nav_doc["items"]
for n in nav:
    if n["id"] == "certification":
        n.update({"status": "active", "kind": "route", "route": "/academy/pmi/certifications", "primary": False})
        n.pop("href", None)
if not any(n["id"] == "pmiAcademy" for n in nav):
    i = next(k for k, n in enumerate(nav) if n["id"] == "isoAcademy") + 1
    nav.insert(i, {"id": "pmiAcademy", "labelKey": "nav.items.pmiAcademy", "group": "learn", "kind": "route", "phase": 8, "status": "active",
                   "roles": ["learner", "instructor", "reviewer", "admin", "company_admin"], "requiredTier": "free", "primary": False, "route": "/academy/pmi"})
save("navigation", nav_doc)

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
    for t in c["templates"]:
        link("course", c["id"], "references", "library_resource", t)
    for p in c["prerequisites"]:
        if p.get("course_id"):
            link("course", p["course_id"], "prerequisite_of", "course", c["id"])
    for kind in ("quiz", "final", "practical"):
        link("assessment", c["assessments"][kind], "part_of", "course", c["id"])
    if c.get("related_certification"):
        link("course", c["id"], "prepares_for", "certification", c["related_certification"])
for x in certs.CERTS:
    for cid in x["cia_courses"]:
        link("course", cid, "related_to", "certification", x["id"])
    for comp in x["competencies"]:
        link("certification", x["id"], "related_to", "competency", comp)
    for t in x["toolkits"]:
        link("certification", x["id"], "links_to_tool", "platform_module", t)
for aid in ["ASM-READY-PM-001"] + [f"ASM-PM-{k}-DIAG" for k in ROUTE_COURSES]:
    for comp in amap[aid]["competencies"]:
        link("assessment", aid, "assesses", "competency", comp)
for r in ROUTES:
    for s in r["steps"]:
        link({"course": "course", "knowledge": "article"}.get(s["type"], "assessment"), s["target_id"], "part_of", "learning_path", r["id"])
save("relationships", rel_doc)

# ------------------------------------------------------------------ build status
bs = load("build-status")
for p in bs["phases"]:
    if str(p.get("id")) == "8":
        p.pop("fraction", None)
        p.update({"status": "in_progress", "partial": None,
                  "note": "PMI / PMO / P3O Academy built (3 Nov 2026): 4 practice guides, 14 courses, explorer of 8 PMI certifications, 5 routes. Content awaits review / owner approval."})
bs["updated"] = "2026-11-03"
save("build-status", bs)

# ------------------------------------------------------------------ UI strings


def merge(dst, src, path=""):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v, path + k + ".")
        else:
            dst[k] = v


for lang, parts in (("en", (i18n_gd.EN, i18n_pmi.EN)), ("ar", (i18n_gd.AR, i18n_pmi.AR))):
    p = I18N / f"{lang}.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    for part in parts:
        merge(d, part)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

n_lessons = sum(len(m["lessons"]) for c in COURSES for m in c["modules"])
print(f"phase 8: courses {len(COURSES)} ({n_lessons} lessons, {sum(c['training_hours'] for c in COURSES):g} h), questions {len(QUESTIONS) + len(practical)}, "
      f"assessments {len(new_a)}, certifications {len(certs.CERTS)}, routes {len(ROUTES)}, catalog {len(recs)}, sources {len(certs.SOURCES)}")
if DROPPED:
    print("approvals dropped because content changed:", ", ".join(DROPPED))
