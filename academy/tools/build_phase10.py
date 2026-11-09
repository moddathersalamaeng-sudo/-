#!/usr/bin/env python3
"""Phase 10 seed builder — Excellence (EFQM-informed) Academy and the EFQM Assessment Lab.

Merges the authored curriculum (tools/phase10/*.py) into data/seed/*.json the way build_phase9.py does: seven courses (CRS-EFQM-101
replaces the Phase 4 shell), questions, assessments (per course, excellence readiness, four route diagnostics), EFQM and King
Abdulaziz Quality Award sources, five EFQM recognition records (added to data/seed/certifications.json next to PMI and ASQ), four
learning routes, catalog entries with suppress_if_mastered, the Organisational Excellence Lead role (framework gap), the Excellence
Academy navigation entry, the Lab definition (data/seed/excellence-lab.json), typed relationships, the reworked Phase 5 demo item
Q-EFQM-001, explanatory figures (owner_phase 10) and their placement, and the UI strings.

Run after the earlier builders (each keeps the others' records and approvals, D-38):
  python3 tools/build_toolkit_courses.py && python3 tools/build_phase8.py && python3 tools/build_phase9.py && python3 tools/build_phase10.py
Idempotent; only Phase 10 ids are upserted; approvals of unchanged records are kept (tools/review_hash.py). Every new record is
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
sys.path.insert(0, str(HERE / "phase10"))
sys.path.insert(0, str(HERE))

import lib10  # noqa: E402
import diagnostics10  # noqa: E402  (registers readiness and route items first)
import c_ex_found, c_ex_apply  # noqa: E402,F401
import certs10  # noqa: E402
import figures10  # noqa: E402
import lab10  # noqa: E402
import i18n_ex  # noqa: E402
from review_hash import keep_approvals  # noqa: E402

T, gov = lib10.T, lib10.gov
COURSES, QUESTIONS = lib10.finalize()
DROPPED = []
PHASE = 10


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
module_ids = {m["id"] for m in load("platform-modules")["items"]}

# ------------------------------------------------------------------ courses
courses_doc = load("courses")
upsert(courses_doc["items"], COURSES)
save("courses", courses_doc)
course_by_id = {c["id"]: c for c in courses_doc["items"]}
for c in COURSES:
    assert c["recommended_next_course"] in (None, *course_by_id), (c["id"], c["recommended_next_course"])
    for p in c["prerequisites"]:
        assert not p.get("course_id") or p["course_id"] in course_by_id, (c["id"], p)
    for t in c["tools"]:
        assert t in module_ids, (c["id"], "unknown toolkit", t)

# ------------------------------------------------------------------ questions
q_doc = load("questions")
practical = []
for c in COURSES:
    code = c["id"].replace("CRS-", "")
    practical.append({
        "id": f"Q-{code}-PT", "category": "excellence", "course_id": c["id"], "module_id": None,
        "competency": c["competency_mappings"][0]["competency"], "difficulty": "hard", "type": "practical_assignment", "format": "practical",
        "prompt": c["practical_task"]["brief"], "deliverable": c["practical_task"]["deliverable"], "rubric": c["practical_task"]["rubric"],
        "explanation": T("Scored by a named human reviewer against the rubric. The result is recorded only after review; nothing is marked by AI.",
                         "يقيّمه مراجع بشري مسمّى وفق معيار التقييم، ولا تُسجَّل النتيجة إلا بعد المراجعة؛ ولا يُصحَّح شيء بالذكاء الاصطناعي."),
        "reference": lib10.SRC, "weight": 4, "version": lib10.VERSION, "status": "active", "governance": gov()})
upsert(q_doc["items"], QUESTIONS + practical)
for q in q_doc["items"]:  # Phase 5 type example kept (human-reviewed evidence review), now part of the Excellence Academy
    if q["id"] == "Q-EFQM-001":
        q.pop("planned_phase", None)
        q.update({"competency": "OE-01", "course_id": "CRS-EX-EVID", "category": "excellence", "auto_scored_twin": "Q-EX-RD-03",
                  "explanation": T("Strong evidence for an improvement claim combines a sustained trend in the result, records showing the approach was deployed where it should be, and a credible link between the change and the result. A slide alone is an assertion.",
                                   "الدليل القوي على ادعاء تحسين يجمع اتجاهًا مستدامًا في النتيجة، وسجلات تُظهر تطبيق الأسلوب حيث ينبغي، وصلة مقنعة بين التغيير والنتيجة. والشريحة وحدها ادعاء.")})
        q["reference"] = lib10.SRC
        q["governance"]["change_note"] = (f"Phase 5 example of the '{q['type']}' type, reworked in Phase 10: competency OE-01, linked to CRS-EX-EVID (the evidence ladder); scored only by a named human "
                                          "reviewer (the engine never auto- or AI-marks this type). Its auto-scored twin for diagnostics is Q-EX-RD-03. Draft until reviewed.")
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
                            T("Objective and scenario items written by CIA (not EFQM material). 70% completes the course; completion is a CIA certificate of completion, not an EFQM recognition or assessor qualification.",
                              "أسئلة موضوعية وسيناريو كتبتها CIA (وليست مادة من EFQM). يلزم 70% لإكمال الدورة؛ والإكمال شهادة إكمال من CIA وليس اعترافًا من EFQM ولا تأهيلًا كمقيّم.")))
    new_a.append(assessment(c["assessments"]["practical"], c["slug"] + "-practical", T(f"{c['title']['en']} — practical task", f"{c['title']['ar']} — المهمة العملية"),
                            "practical", c["id"], [f"Q-{code}-PT"], 60, c["practical_task"]["minutes"],
                            T("Submit your work here. A named human reviewer scores it against the rubric; no automatic or AI marking is applied.",
                              "سلّم عملك هنا. يقيّمه مراجع بشري مسمّى وفق معيار التقييم، دون أي تصحيح آلي أو بالذكاء الاصطناعي.")))

new_a.append(assessment("ASM-READY-EX-001", "excellence-readiness", T("Excellence readiness diagnostic", "التقييم التشخيصي لجاهزية التميز"), "diagnostic", None, list(diagnostics10.READINESS), 70, 20,
                        T("Twelve original CIA items on excellence logic, evidence, RADAR, findings, prioritisation, leadership and measurement. Choose “I don't know” rather than guessing — it makes your starting point more accurate. The result is not a professional qualification, not an EFQM assessment, and years of experience are not used as evidence.",
                          "اثنا عشر سؤالًا أصليًا من CIA في منطق التميز والأدلة وRADAR والملاحظات والترتيب والقيادة والقياس. اختر «لا أعرف» بدل التخمين لتكون نقطة بدايتك أدق. والنتيجة ليست مؤهلًا مهنيًا ولا تقييمًا من EFQM، ولا تُستخدم سنوات الخبرة دليلًا."), True))
ROUTE_COURSES = {"FOUND": ["CRS-EFQM-101", "CRS-EX-RADAR", "CRS-EX-EVID"], "SA": ["CRS-EFQM-101", "CRS-EX-RADAR", "CRS-EX-EVID", "CRS-EX-SA"],
                 "AWARD": ["CRS-EFQM-101", "CRS-EX-RADAR", "CRS-EX-EVID", "CRS-EX-SA", "CRS-EX-AWARD"], "PLAN": ["CRS-EX-EVID", "CRS-EX-PLAN", "CRS-EX-SUSTAIN"]}
ROUTE_TITLES = {"FOUND": T("Excellence foundations", "أساسيات التميز"), "SA": T("Self-assessment lead", "قائد التقييم الذاتي"),
                "AWARD": T("Award and recognition preparation", "الاستعداد للجوائز والاعتراف"), "PLAN": T("Improvement planning", "تخطيط التحسين")}
for key, cids in ROUTE_COURSES.items():
    own = list(diagnostics10.ROUTE.get(key, []))
    firsts = [m["lessons"][0]["check_question_id"] for cid in cids for m in course_by_id[cid]["modules"]]
    qids = list(dict.fromkeys(own + firsts))[:10]
    new_a.append(assessment(f"ASM-EX-{key}-DIAG", f"excellence-route-{key.lower()}-diagnostic", T(f"Route diagnostic — {ROUTE_TITLES[key]['en']}", f"التقييم التشخيصي للمسار — {ROUTE_TITLES[key]['ar']}"),
                            "diagnostic", None, qids, 70, 15,
                            T("Applied diagnostic for this route. “I don't know” is allowed and is treated as not yet demonstrated; what you demonstrate here lets the route skip content.",
                              "تقييم تطبيقي لهذا المسار. يُسمح باختيار «لا أعرف» ويُعامل على أنه لم يُثبت بعد؛ وما تثبته هنا يتيح للمسار تجاوز المحتوى."), True))
upsert(a_items, new_a)
save("assessments", a_doc)
amap = {a["id"]: a for a in a_items}

# ------------------------------------------------------------------ sources and certifications (EFQM recognition explorer)
s_doc = load("sources")
upsert(s_doc["items"], [{**s, "governance": {"content_status": "needs_review", "content_source": "external_public" if s["source_type"] != "owner" else "owner",
                                                 "version": "1.0.0", "reviewer": None, "review_date": None,
                                                 "change_note": "Phase 10 source, opened and checked on 6 Nov 2026."}} for s in certs10.SOURCES])
save("sources", s_doc)
src_ids = {s["id"] for s in s_doc["items"]}
for c in COURSES:
    for s in c["source_references"]:
        assert s in src_ids, (c["id"], s)
cert_doc = load("certifications")
for x in certs10.CERTS:
    for s in x["source_ids"]:
        assert s in src_ids, (x["id"], s)
    for cid in x["cia_courses"]:
        assert cid in course_by_id, (x["id"], cid)
    for t in x["toolkits"]:
        assert t in module_ids, (x["id"], t)
upsert(cert_doc["items"], certs10.CERTS)
save("certifications", cert_doc)
cert_ids = {x["id"] for x in cert_doc["items"]}
for x in certs10.CERTS:
    for n in x["next"]:
        assert n in cert_ids, (x["id"], n)
for c in COURSES:
    if c.get("related_certification"):
        assert c["related_certification"] in cert_ids, c["id"]

# ------------------------------------------------------------------ target role: Organisational Excellence Lead (framework gap)
roles_path = SEED / "competency" / "target-roles.json"
roles_doc = json.loads(roles_path.read_text(encoding="utf-8"))
targets = {c["id"]: 0 for c in comp_doc["items"]}
targets.update({"OE-01": 4, "OE-02": 4, "LDR-01": 3, "LDR-02": 3, "PERF-01": 3, "PERF-02": 3, "GOV-01": 2, "QM-01": 2, "QM-03": 2, "RSK-01": 1, "ISO-01": 1})
role = {"type": "target_role", "id": "ROLE-OEL", "name": T("Organisational Excellence Lead", "قائد التميز المؤسسي"),
        "description": T("Leads the organisation's excellence and self-assessment cycle: facilitates assessments, turns findings into owned priorities, prepares for external recognition and embeds improvement in the management cycle.",
                         "يقود دورة التميز والتقييم الذاتي في المنظمة: ييسّر التقييمات، ويحوّل الملاحظات إلى أولويات مملوكة، ويستعد للاعتراف الخارجي، ويدمج التحسين في الدورة الإدارية."),
        "targets": targets,
        "governance": {"content_status": "needs_review", "content_source": "ai_draft", "version": "0.10.0", "reviewer": None, "review_date": None,
                       "change_note": "Phase 10: the framework had no organisational-excellence role although the Excellence Academy's self-assessment route targets it (genuine gap). Draft for review; its name is usable as a label meanwhile (D-10)."}}
old_roles = json.loads(json.dumps(roles_doc["items"]))
upsert(roles_doc["items"], [role])
DROPPED.extend(f"target-roles:{i}" for i in keep_approvals(old_roles, roles_doc["items"]))
roles_path.write_text(json.dumps(roles_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ learning routes
p_doc = load("learning-paths")
KA_TITLES = {"KA-019": T("Excellence vs quality", "التميز والجودة"), "KA-020": T("Direction, execution and results logic", "منطق التوجه والتنفيذ والنتائج"),
             "KA-021": T("RADAR as a management concept", "RADAR مفهومًا إداريًا")}


def step(n, kind, target, dep="recommended", skip_mastered=None):
    if kind == "course":
        c = course_by_id[target]; title, effort = c["title"], f"{c['training_hours']:g} h"
    elif kind == "knowledge":
        title, effort = KA_TITLES[target], "10 min"
    else:
        a = amap[target]; title, effort = a["title"], f"{a.get('estimated_minutes') or 30} min"
    s = {"order": n, "type": kind, "target_id": target, "title": title, "dependency": dep, "effort": effort, "skip_if_completed": True}
    if skip_mastered:
        s["skip_if_mastered"] = skip_mastered
    return s


def route(rid, roles, title, goal, steps, certs_=()):
    return {"id": rid, "kind": "excellence_route", "roles": roles, "certification_ids": list(certs_), "title": title, "goal": goal,
            "steps": [step(i + 1, *s) for i, s in enumerate(steps)], "governance": gov()}


ROUTES = [
    route("ROUTE-EX-FOUND", [], T("Excellence foundations", "مسار أساسيات التميز"),
          T("Understand what an excellence model adds, read an organisation through Direction, Execution and Results, judge with RADAR and write findings people can act on.",
            "فهم ما يضيفه نموذج التميز، وقراءة المنظمة عبر التوجه والتنفيذ والنتائج، والحكم بمنطق RADAR، وكتابة ملاحظات يمكن التصرف بناءً عليها."),
          [("knowledge", "KA-019"), ("assessment", "ASM-READY-EX-001"), ("course", "CRS-EFQM-101", "recommended", ["OE-01"]), ("course", "CRS-EX-RADAR", "recommended", ["OE-01", "PERF-02"]),
           ("course", "CRS-EX-EVID", "required"), ("final_assessment", "ASM-EX-EVID-FINAL")], ["CERT-EFQM-RAPID"]),
    route("ROUTE-EX-SA", ["ROLE-OEL"], T("Self-assessment lead", "مسار قائد التقييم الذاتي"),
          T("Plan and facilitate an evidence-based self-assessment, reach consensus on facts, findings and ratings, and turn the report into owned priorities — using the EFQM Assessment Lab.",
            "تخطيط تقييم ذاتي قائم على الأدلة وتيسيره، والوصول إلى إجماع على الوقائع والملاحظات والتقديرات، وتحويل التقرير إلى أولويات مملوكة — باستخدام مختبر تقييم EFQM."),
          [("assessment", "ASM-EX-SA-DIAG"), ("course", "CRS-EFQM-101", "recommended", ["OE-01"]), ("course", "CRS-EX-RADAR", "recommended", ["OE-01", "PERF-02"]),
           ("course", "CRS-EX-EVID", "recommended", ["OE-01", "OE-02"]), ("course", "CRS-EX-SA", "required"), ("course", "CRS-EX-PLAN", "recommended", ["OE-02"]), ("practice", "ASM-EX-SA-PRACT")],
          ["CERT-EFQM-ADV", "CERT-EFQM-ASSESSOR"]),
    route("ROUTE-EX-AWARD", [], T("Award and recognition preparation", "مسار الاستعداد للجوائز والاعتراف"),
          T("Decide with evidence whether and when to apply, write a verifiable submission document, prepare people honestly for the site visit and use the feedback.",
            "تقرير التقدم وتوقيته بالأدلة، وكتابة وثيقة مشاركة قابلة للتحقق، وإعداد الناس بصدق للزيارة الميدانية، والاستفادة من التغذية الراجعة."),
          [("assessment", "ASM-EX-AWARD-DIAG"), ("course", "CRS-EFQM-101", "recommended", ["OE-01"]), ("course", "CRS-EX-RADAR", "recommended", ["OE-01", "PERF-02"]),
           ("course", "CRS-EX-EVID", "recommended", ["OE-01", "OE-02"]), ("course", "CRS-EX-SA", "recommended", ["OE-01", "LDR-01"]), ("course", "CRS-EX-AWARD", "required"),
           ("final_assessment", "ASM-EX-AWARD-FINAL")], ["CERT-EFQM-RAPID", "CERT-EFQM-ADV", "CERT-EFQM-GA"]),
    route("ROUTE-EX-PLAN", [], T("Improvement planning", "مسار تخطيط التحسين"),
          T("Turn assessment findings into a few owned, funded priorities with charters and a roadmap, and keep improvement going in the normal management cycle.",
            "تحويل ملاحظات التقييم إلى أولويات قليلة مملوكة وممولة بمواثيق وخارطة طريق، ومواصلة التحسين في الدورة الإدارية المعتادة."),
          [("assessment", "ASM-EX-PLAN-DIAG"), ("course", "CRS-EX-EVID", "recommended", ["OE-01"]), ("course", "CRS-EX-PLAN", "required"), ("course", "CRS-M-A3"),
           ("course", "CRS-EX-SUSTAIN", "recommended", ["LDR-01", "LDR-02"]), ("final_assessment", "ASM-EX-PLAN-FINAL")], ["CERT-EFQM-VALID"]),
]
for r in ROUTES:
    for s in r["steps"]:
        assert s["target_id"] in course_by_id or s["target_id"] in amap or s["target_id"].startswith("KA-"), (r["id"], s["target_id"])
    for cid in r["certification_ids"]:
        assert cid in cert_ids, (r["id"], cid)
upsert(p_doc["items"], ROUTES)
save("learning-paths", p_doc)
route_roles = {r["id"]: r["roles"] for r in ROUTES}

# ------------------------------------------------------------------ recommendation catalog
r_doc = load("recommendation-catalog")
SUPPRESS = {"CRS-EFQM-101": ["OE-01"], "CRS-EX-RADAR": ["OE-01", "PERF-02"], "CRS-EX-EVID": ["OE-01", "OE-02"], "CRS-EX-PLAN": ["OE-02", "PERF-01"]}
CERT_KW = {"CRS-EFQM-101": ["EFQM", "excellence"], "CRS-EX-RADAR": ["RADAR", "EFQM", "assessor"], "CRS-EX-EVID": ["EFQM", "assessor"], "CRS-EX-SA": ["EFQM", "self-assessment", "assessor"],
           "CRS-EX-PLAN": ["EFQM"], "CRS-EX-AWARD": ["EFQM", "award", "KAQA", "King Abdulaziz"], "CRS-EX-SUSTAIN": ["EFQM", "excellence"]}
INTEREST = ["excellence", "efqm", "تميز", "التميز", "self-assessment", "تقييم ذاتي"]
legacy = {r["target_id"]: r["id"] for r in r_doc["items"] if not r["id"].startswith("REC-CRS-") and r.get("recommendation_type") == "course"}
r_doc["items"] = [r for r in r_doc["items"] if not (r["id"].startswith("REC-CRS-") and r["target_id"] in legacy)]
recs = []
for c in COURSES:
    comps = [m["competency"] for m in c["competency_mappings"]]
    rec = {"id": legacy.get(c["id"], "REC-" + c["id"]), "recommendation_type": "course", "target_id": c["id"], "title": c["title"], "competencies": comps,
           "domains": sorted({domain_of[x] for x in comps}), "roles": sorted({r for rid in c["route_ids"] for r in route_roles.get(rid, [])}),
           "level": c["level"], "estimated_effort": f"{c['training_hours']:g} h",
           "prerequisites": [{"target_id": p["course_id"], "required": True} for p in c["prerequisites"] if p.get("course_id") and p.get("required")],
           "interest_keywords": INTEREST + (["award", "جائزة", "kaqa"] if "AWARD" in c["id"] else []) + (["improvement plan", "خطة تحسين", "prioriti"] if "PLAN" in c["id"] else []),
           "certification_keywords": CERT_KW.get(c["id"], []), "standard_ids": []}
    if c["id"] in SUPPRESS:
        rec["suppress_if_mastered"] = SUPPRESS[c["id"]]
    recs.append(rec)
for aid in ["ASM-READY-EX-001"] + [f"ASM-EX-{k}-DIAG" for k in ROUTE_COURSES]:
    a = amap[aid]
    recs.append({"id": "REC-" + aid, "recommendation_type": "assessment", "target_id": aid, "title": a["title"], "competencies": a["competencies"],
                 "domains": sorted({domain_of[x] for x in a["competencies"]}), "roles": [], "level": 1, "estimated_effort": f"{a['estimated_minutes']} min",
                 "prerequisites": [], "interest_keywords": INTEREST, "certification_keywords": ["EFQM"] if aid == "ASM-READY-EX-001" else [], "standard_ids": []})
upsert(r_doc["items"], recs)
for r in r_doc["items"]:
    if r["target_id"] in SUPPRESS and not r["id"].startswith("REC-CRS-"):
        r["suppress_if_mastered"] = SUPPRESS[r["target_id"]]
save("recommendation-catalog", r_doc)

# ------------------------------------------------------------------ navigation
nav_doc = load("navigation")
nav = nav_doc["items"]
if not any(n["id"] == "excellenceAcademy" for n in nav):
    i = next(k for k, n in enumerate(nav) if n["id"] == "qualityAcademy") + 1
    nav.insert(i, {"id": "excellenceAcademy", "labelKey": "nav.items.excellenceAcademy", "group": "learn", "kind": "route", "phase": 10, "status": "active",
                   "roles": ["learner", "instructor", "reviewer", "admin", "company_admin"], "requiredTier": "free", "primary": False, "route": "/academy/excellence"})
save("navigation", nav_doc)

# ------------------------------------------------------------------ the Lab definition (governed)
lab = {**lab10.LAB, "governance": {"content_status": "needs_review", "content_source": "ai_draft", "version": "0.10.0", "reviewer": None, "review_date": None,
                                   "change_note": "Phase 10 EFQM Assessment Lab definition: criterion names (EFQM Model 2025) with original CIA guiding questions, RADAR-style element descriptions and rating bands; awaiting review."}}
for s in lab["source_ids"]:
    assert s in src_ids, s
for cid in lab["courses"]:
    assert cid in course_by_id, cid
kaqa = {"id": "REG-KAQA", "kind": "regional_award", **certs10.KAQA,
        "governance": {"content_status": "needs_review", "content_source": "external_public", "version": "1.0.0", "reviewer": None, "review_date": None,
                       "change_note": "Phase 10: dated King Abdulaziz Quality Award facts from official Saudi government pages (6 Nov 2026), shown on the Excellence Academy landing."}}
for f in kaqa["facts"]:
    assert f["source"] in src_ids, f["source"]
save("excellence-lab", {"schema": "cia.excellence-lab.v1", "items": [lab, kaqa]})

# ------------------------------------------------------------------ figures (governed, owner_phase 10) and placement
for f in figures10.FIGS:
    f["owner_phase"] = PHASE
    f["governance"] = {"content_status": "needs_review", "content_source": "ai_draft", "version": "0.10.0", "reviewer": None, "review_date": None,
                       "change_note": "Phase 10 explanatory figure (original CIA diagram, data-driven SVG; EFQM criterion names only); awaiting review."}
ids = {f["id"] for f in figures10.FIGS}
assert len(ids) == len(figures10.FIGS), "duplicate figure id"
fig_path = SEED / "figures.json"
fig_doc = json.loads(fig_path.read_text(encoding="utf-8"))
fig_doc["items"] = [x for x in fig_doc["items"] if x.get("owner_phase") != PHASE or x["id"] in ids]
assert not ids & {x["id"] for x in fig_doc["items"] if x.get("owner_phase") != PHASE}, "figure id used by another phase"
upsert(fig_doc["items"], figures10.FIGS)
save("figures", fig_doc)
lesson_ids = {l["id"] for c in courses_doc["items"] for m in c.get("modules", []) for l in m.get("lessons", [])}
for key in figures10.PLACEMENT:
    kind, _, k = key.partition(":") if ":" in key else ("lesson", "", key)
    ok = (k in lesson_ids) if kind == "lesson" else (k in course_by_id) if kind == "course" else (kind == "lab")
    assert ok, f"figure placement points at unknown {kind}: {key}"
for c in COURSES:  # every Phase 10 lesson has at least one figure
    for l in (l for m in c["modules"] for l in m["lessons"]):
        assert figures10.PLACEMENT.get(l["id"]), f"lesson without a figure: {l['id']}"
lf_path = SEED / "lesson-figures.json"
lf = json.loads(lf_path.read_text(encoding="utf-8"))
placed = {e["id"]: [f for f in e.get("figures", []) if f not in ids] for e in lf["items"]}
for k, v in figures10.PLACEMENT.items():
    placed[k] = list(dict.fromkeys(placed.get(k, []) + v))
lf_path.write_text(json.dumps({"schema": "cia.lesson-figures.v1", "items": [{"id": k, "figures": v} for k, v in placed.items() if v]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

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
for x in certs10.CERTS:
    for cid in x["cia_courses"]:
        link("course", cid, "related_to", "certification", x["id"])
    for comp in x["competencies"]:
        link("certification", x["id"], "related_to", "competency", comp)
    for t in x["toolkits"]:
        link("certification", x["id"], "links_to_tool", "platform_module", t)
for aid in ["ASM-READY-EX-001"] + [f"ASM-EX-{k}-DIAG" for k in ROUTE_COURSES]:
    for comp in amap[aid]["competencies"]:
        link("assessment", aid, "assesses", "competency", comp)
for r in ROUTES:
    for s in r["steps"]:
        link({"course": "course", "knowledge": "article"}.get(s["type"], "assessment"), s["target_id"], "part_of", "learning_path", r["id"])
save("relationships", rel_doc)

# ------------------------------------------------------------------ build status
bs = load("build-status")
for p in bs["phases"]:
    if str(p.get("id")) == "10" and p.get("status") != "complete":  # a published phase stays complete on rebuild
        p.pop("fraction", None)
        p.update({"status": "in_progress", "partial": None,
                  "note": "Excellence (EFQM-informed) Academy built (6 Nov 2026): 7 courses, EFQM recognition explorer (5 options), EFQM Assessment Lab, 4 routes, 29 figures. Content awaits review / owner approval."})
bs["updated"] = "2026-11-06"
save("build-status", bs)

# ------------------------------------------------------------------ UI strings


def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v)
        else:
            dst[k] = v


for lang, part in (("en", i18n_ex.EN), ("ar", i18n_ex.AR)):
    p = I18N / f"{lang}.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    merge(d, part)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

n_lessons = sum(len(m["lessons"]) for c in COURSES for m in c["modules"])
print(f"phase 10: courses {len(COURSES)} ({n_lessons} lessons, {sum(c['training_hours'] for c in COURSES):g} h), questions {len(QUESTIONS) + len(practical)}, "
      f"assessments {len(new_a)}, recognition options {len(certs10.CERTS)}, routes {len(ROUTES)}, catalog {len(recs)}, sources {len(certs10.SOURCES)}, "
      f"figures {len(figures10.FIGS)} placed on {len(figures10.PLACEMENT)} targets")
if DROPPED:
    print("approvals dropped because content changed:", ", ".join(DROPPED))
