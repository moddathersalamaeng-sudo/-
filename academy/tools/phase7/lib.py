"""Phase 7 content builder helpers — ISO Academy curriculum.
Author: مدثر سلامه. Every record is an original CIA teaching draft (content_source ai_draft,
content_status needs_review) until a named human SME approves it through the review gate.
No ISO clause text, no exam questions, no proprietary body-of-knowledge text is reproduced."""
import math

VERSION = "0.8.0"
CHANGE_NOTE = "Phase 7 curriculum draft (Oct 2026) — awaiting named SME review"
QUESTIONS, COURSES = [], []


def T(en, ar):
    return {"en": en, "ar": ar}


def gov(version=VERSION):
    return {"content_status": "needs_review", "content_source": "ai_draft", "version": version,
            "reviewer": None, "review_date": None, "change_note": CHANGE_NOTE}


def question(qid, competency, prompt, options, correct, explanation, *, course_id=None, difficulty="medium",
             fmt="knowledge", scenario=None, category="iso"):
    """options: list of (en, ar, why_en, why_ar); correct: index into options."""
    if any(q["id"] == qid for q in QUESTIONS):
        raise ValueError("duplicate question id " + qid)
    opts = [{"id": "abcdefgh"[i], "text": T(o[0], o[1]), "why": T(o[2], o[3])} for i, o in enumerate(options)]
    q = {"id": qid, "category": category, "course_id": course_id, "module_id": None, "competency": competency,
         "difficulty": difficulty, "type": "single_choice", "format": fmt, "prompt": T(*prompt), "options": opts,
         "correct_answer": "abcdefgh"[correct], "explanation": T(*explanation), "reference": "SRC-CIA-ISO",
         "weight": 1, "version": VERSION, "status": "active", "governance": gov()}
    if scenario:
        q["scenario"] = T(*scenario)
    QUESTIONS.append(q)
    return qid


def lesson(lid, title, minutes, competencies, resources, concept, example, scenario, mistake, evidence,
           exercise, model_answer, check, objective, template=None):
    """Each text argument is an (en, ar) tuple; `check` is a dict for the lesson's knowledge check."""
    qid = question(lid.replace("CRS-", "Q-"), check.get("competency", competencies[0]), check["prompt"],
                   check["options"], check["correct"], check["explanation"], difficulty=check.get("difficulty", "medium"))
    ev = {"type": "evidence", "text": T(*evidence)}
    if template:
        ev["template_id"] = template
    return {"id": lid, "title": T(*title), "estimated_minutes": minutes, "objectives": [T(*objective)],
            "content_blocks": [{"type": "concept", "text": T(*concept)}, {"type": "worked_example", "text": T(*example)},
                               {"type": "scenario", "text": T(*scenario)}, {"type": "common_mistake", "text": T(*mistake)}, ev],
            "exercise": {"prompt": T(*exercise), "model_answer": T(*model_answer)},
            "check_question_id": qid, "resources": resources, "competencies": competencies}


def module(mid, title, summary, lessons):
    return {"id": mid, "title": T(*title), "summary": T(*summary), "lessons": lessons}


def rubric(*criteria):
    """criteria: (en, ar, weight, meets_en, meets_ar, partial_en, partial_ar, not_en, not_ar)"""
    return [{"criterion": T(c[0], c[1]), "weight": c[2],
             "levels": {"meets": T(c[3], c[4]), "partial": T(c[5], c[6]), "not_yet": T(c[7], c[8])}} for c in criteria]


EXERCISE_MIN, CHECK_MIN, FINAL_MIN = 15, 5, 30


def _day_plan(modules, practical_min, practical_title):
    """Distribute modules over days of at most ~6.5 contact hours; last day carries practical + final."""
    sessions_by_module = []
    for m in modules:
        s = []
        for l in m["lessons"]:
            s.append({"kind": "lesson", "ref": l["id"], "title": l["title"], "minutes": l["estimated_minutes"]})
            s.append({"kind": "exercise", "ref": l["id"], "title": T("Exercise and knowledge check", "تمرين واختبار معرفي قصير"),
                      "minutes": EXERCISE_MIN + CHECK_MIN})
        sessions_by_module.append((m, s))
    tail = [{"kind": "practical", "ref": "practical", "title": practical_title, "minutes": practical_min},
            {"kind": "assessment", "ref": "final", "title": T("Final assessment", "التقييم الختامي"), "minutes": FINAL_MIN}]
    total = sum(x["minutes"] for _, s in sessions_by_module for x in s) + sum(x["minutes"] for x in tail)
    days = max(1, math.ceil(total / 390))
    per_day = total / days
    plan, cur, acc = [], [], 0
    for m, s in sessions_by_module:
        mins = sum(x["minutes"] for x in s)
        if cur and acc + mins > per_day + 30 and len(plan) < days - 1:
            plan.append(cur); cur, acc = [], 0
        cur.append((m, s)); acc += mins
    plan.append(cur)
    out = []
    for i, day in enumerate(plan, 1):
        sessions = [x for _, s in day for x in s]
        if i == len(plan):
            sessions += tail
        out.append({"day": i, "focus": [m["id"] for m, _ in day], "focus_titles": [m["title"] for m, _ in day],
                    "sessions": sessions, "minutes": sum(x["minutes"] for x in sessions)})
    return out, total


def course(cid, slug, title, level, standards, routes, audience, prerequisites, outcomes, overview, why, relevance,
           modules, practical, scenario_q, competencies, knowledge, tools, templates, sources,
           next_course=None, delivery=("self_paced", "instructor_led"), extra_final=()):
    for i, m in enumerate(modules, 1):
        m["order"] = i
        for j, l in enumerate(m["lessons"], 1):
            l["order"] = j
            for q in QUESTIONS:
                if q["id"] == l["check_question_id"]:
                    q["course_id"], q["module_id"] = cid, m["id"]
    code = cid.replace("CRS-", "")
    sq = question(f"Q-{code}-SCN", scenario_q["competency"], scenario_q["prompt"], scenario_q["options"],
                  scenario_q["correct"], scenario_q["explanation"], course_id=cid, difficulty="hard",
                  fmt="scenario", scenario=scenario_q["scenario"])
    practical_min = practical.get("minutes", 90)
    plan, total = _day_plan(modules, practical_min, T("Practical task (human-reviewed)", "المهمة العملية (بمراجعة بشرية)"))
    hours = math.ceil(total / 30) / 2
    c = {
        "id": cid, "code": cid, "slug": slug, "title": T(*title), "category": "iso", "ecosystem": "iso",
        "professional_body_reference": "ISO", "standard_ids": standards, "route_ids": routes, "level": level,
        "duration": f"{len(plan)} day(s) · {hours:g} h", "duration_days": len(plan), "training_hours": hours,
        "delivery_modes": list(delivery), "languages": ["ar", "en"], "target_audience": [T(*a) for a in audience],
        "prerequisites": prerequisites, "learning_outcomes": [T(*o) for o in outcomes], "overview": T(*overview),
        "why_it_matters": T(*why), "professional_relevance": T(*relevance), "status_label": "CIA INTERNAL COURSE",
        "certificate_type": "completion", "external_accreditation_status": "not_claimed", "cpd_status": "not_claimed",
        "assessment_methodology": T(
            "A knowledge check after every lesson, a final assessment (objective and scenario items, 70% to pass) and a practical task scored by a named human reviewer against the rubric. Nothing is marked by AI.",
            "اختبار معرفي قصير بعد كل درس، وتقييم ختامي (أسئلة موضوعية وسيناريو، النجاح من 70%)، ومهمة عملية يقيّمها مراجع بشري مسمّى وفق معيار التقييم. لا يُصحَّح شيء بالذكاء الاصطناعي."),
        "passing_criteria": T(
            "Complete every lesson and score at least 70% in the final assessment. The practical task is recorded only after human review. Completion earns a CIA certificate of completion, not a professional certification or an ISO credential.",
            "إكمال جميع الدروس والحصول على 70% على الأقل في التقييم الختامي. لا تُسجَّل المهمة العملية إلا بعد مراجعة بشرية. الإكمال يمنح شهادة إكمال من CIA، وليس شهادة مهنية ولا اعتمادًا من ISO."),
        "assessments": {"quiz": f"ASM-{code}-QUIZ", "final": f"ASM-{code}-FINAL", "practical": f"ASM-{code}-PRACT"},
        "final_assessment": f"ASM-{code}-FINAL", "scenario_question_id": sq, "extra_final_question_ids": list(extra_final),
        "materials": [], "tools": tools, "templates": templates, "case_studies": [], "exercises": [],
        "modules": modules, "daily_schedule": plan,
        "practical_task": {"id": f"PT-{code}", "brief": T(*practical["brief"]), "deliverable": T(*practical["deliverable"]),
                           "minutes": practical_min, "rubric": practical["rubric"], "review": "human"},
        "recommended_next_course": next_course, "related_certification": None, "related_knowledge_pages": knowledge,
        "competency_mappings": competencies, "version": VERSION, "content_owner": "مدثر سلامه", "reviewer": None,
        "source_references": sources, "review_date": None, "governance": gov(),
    }
    COURSES.append(c)
    return c


def opt(en, ar, wen, war):
    return (en, ar, wen, war)
