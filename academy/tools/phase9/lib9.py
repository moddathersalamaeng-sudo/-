"""Phase 9 content helpers — Quality (ASQ-informed) Academy curriculum.

Reuses the Phase 7 builders (tools/phase7/lib.py) through the same pattern as tools/phase8/lib8.py, so every course meets the
completeness contract, and re-labels what is specific to this academy: category, ecosystem, professional body, status label,
source reference and change note. Author: مدثر سلامه.

Rules (CONTENT_GOVERNANCE.md, PHASE_09 prompt): original CIA wording only — no ASQ Body of Knowledge text and no ASQ exam
questions. No accreditation, RU, CPD or "ASQ-approved" claim. Every record stays needs_review until a person approves it.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "phase7"))
import lib  # noqa: E402

T, opt, lesson, module, rubric = lib.T, lib.opt, lib.lesson, lib.module, lib.rubric
VERSION = "0.9.0"
CHANGE_NOTE = "Phase 9 Quality (ASQ-informed) curriculum draft (Nov 2026) — original CIA wording; awaiting review"
SRC = "SRC-CIA-Q"


def gov():
    return {"content_status": "needs_review", "content_source": "ai_draft", "version": VERSION,
            "reviewer": None, "review_date": None, "change_note": CHANGE_NOTE}


def question(qid, competency, prompt, options, correct, explanation, **kw):
    kw.setdefault("category", "quality")
    return lib.question(qid, competency, prompt, options, correct, explanation, **kw)


def course(cid, slug, title, level, routes, audience, prerequisites, outcomes, overview, why, relevance, modules, practical, scenario_q,
           competencies, knowledge, tools, templates, sources, *, next_course=None, exam_prep=False, related_certification=None, guides=(),
           extra_final=(), cover_topic=None):
    c = lib.course(cid, slug, title, level, [], routes, audience, prerequisites, outcomes, overview, why, relevance, modules, practical,
                   scenario_q, competencies, knowledge, tools, templates, sources, next_course=next_course, extra_final=extra_final)
    c.update({"category": "quality", "ecosystem": "quality", "professional_body_reference": "ASQ", "version": VERSION, "governance": gov(),
              "status_label": "EXAM PREPARATION COURSE" if exam_prep else "CIA INTERNAL COURSE",
              "related_certification": related_certification, "related_guides": list(guides)})
    if cover_topic:
        c["cover_topic"] = cover_topic
    if exam_prep:
        c["passing_criteria"] = T(
            "Complete every lesson and score at least 70% in the final assessment. This is a CIA internal study course with an exam-preparation label: "
            "it does not award an ASQ certification or recertification units, and passing it does not predict an exam result.",
            "إكمال جميع الدروس والحصول على 70% على الأقل في التقييم الختامي. هذه دورة دراسية داخلية من CIA بوسم «إعداد للاختبار»: "
            "لا تمنح شهادة من ASQ ولا وحدات إعادة اعتماد، واجتيازها لا يتنبأ بنتيجة الاختبار.")
    else:
        c["passing_criteria"] = T(
            "Complete every lesson and score at least 70% in the final assessment. The practical task is recorded only after human review. "
            "Completion earns a CIA certificate of completion — not an ASQ or ISO credential.",
            "إكمال جميع الدروس والحصول على 70% على الأقل في التقييم الختامي. لا تُسجَّل المهمة العملية إلا بعد مراجعة بشرية. "
            "الإكمال يمنح شهادة إكمال من CIA — وليس شهادة من ASQ أو ISO.")
    return c


def finalize():
    for q in lib.QUESTIONS:
        q["reference"] = SRC
        q["version"] = VERSION
        q["governance"] = gov()
        if q.get("category") == "iso":
            q["category"] = "quality"
    return lib.COURSES, lib.QUESTIONS
