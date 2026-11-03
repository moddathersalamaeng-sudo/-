"""Phase 8 content helpers — PMI / PMO / P3O Academy curriculum.

Reuses the Phase 7 builders (tools/phase7/lib.py: lesson, module, course, rubric, question) so every course meets the same
completeness contract, then re-labels what is specific to this academy: category, ecosystem, professional body, status label,
source reference and change note. Author: مدثر سلامه.

Rules (CONTENT_GOVERNANCE.md, PHASE_08_PROMPT.md): original CIA wording only — no PMBOK® Guide text, no PMI exam questions,
no AXELOS/PeopleCert text. No accreditation, PDU, ATP or "PMI-approved" claim. Every record stays needs_review until a person
approves it through the review workflow.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "phase7"))
import lib  # noqa: E402

T, opt, lesson, module, rubric = lib.T, lib.opt, lib.lesson, lib.module, lib.rubric
VERSION = "0.9.0"
CHANGE_NOTE = "Phase 8 PMI / PMO / P3O curriculum draft (Nov 2026) — original CIA wording; awaiting review"
SRC = "SRC-CIA-PM"


def gov():
    return {"content_status": "needs_review", "content_source": "ai_draft", "version": VERSION,
            "reviewer": None, "review_date": None, "change_note": CHANGE_NOTE}


def question(qid, competency, prompt, options, correct, explanation, **kw):
    kw.setdefault("category", "project_management")
    return lib.question(qid, competency, prompt, options, correct, explanation, **kw)


def course(cid, slug, title, level, routes, audience, prerequisites, outcomes, overview, why, relevance, modules, practical, scenario_q,
           competencies, knowledge, tools, templates, sources, *, ecosystem="pmi", category="project_management", body="PMI",
           next_course=None, exam_prep=False, related_certification=None, guides=(), extra_final=()):
    c = lib.course(cid, slug, title, level, [], routes, audience, prerequisites, outcomes, overview, why, relevance, modules, practical,
                   scenario_q, competencies, knowledge, tools, templates, sources, next_course=next_course, extra_final=extra_final)
    c.update({"category": category, "ecosystem": ecosystem, "professional_body_reference": body, "version": VERSION, "governance": gov(),
              "status_label": "EXAM PREPARATION COURSE" if exam_prep else "CIA INTERNAL COURSE",
              "related_certification": related_certification, "related_guides": list(guides)})
    if exam_prep:
        c["passing_criteria"] = T(
            "Complete every lesson and score at least 70% in the final assessment. This is a CIA internal study course with an exam-preparation label: "
            "it does not award a PMI credential, PDUs or contact-hour certificates, and passing it does not predict an exam result.",
            "إكمال جميع الدروس والحصول على 70% على الأقل في التقييم الختامي. هذه دورة دراسية داخلية من CIA بوسم «إعداد للاختبار»: "
            "لا تمنح شهادة من PMI ولا وحدات PDU ولا شهادة ساعات تعليمية، واجتيازها لا يتنبأ بنتيجة الاختبار.")
    else:
        c["passing_criteria"] = T(
            "Complete every lesson and score at least 70% in the final assessment. The practical task is recorded only after human review. "
            "Completion earns a CIA certificate of completion — not a PMI, PeopleCert or ISO credential.",
            "إكمال جميع الدروس والحصول على 70% على الأقل في التقييم الختامي. لا تُسجَّل المهمة العملية إلا بعد مراجعة بشرية. "
            "الإكمال يمنح شهادة إكمال من CIA — وليس شهادة من PMI أو PeopleCert أو ISO.")
    return c


def finalize():
    """Apply Phase 8 labels to every question registered in lib (all of them belong to Phase 8 in this process)."""
    for q in lib.QUESTIONS:
        q["reference"] = SRC
        q["version"] = VERSION
        q["governance"] = gov()
        if q.get("category") == "iso":
            q["category"] = "project_management"
    return lib.COURSES, lib.QUESTIONS
