"""Phase 10 content helpers — Excellence (EFQM-informed) Academy curriculum.

Reuses the Phase 7 builders (tools/phase7/lib.py) on the lib8 / lib9 pattern, so every course meets the completeness contract,
and re-labels what is specific to this academy: category, ecosystem, professional body, status label, source reference and
change note. Author: مدثر سلامه.

Rules (CONTENT_GOVERNANCE.md, PHASE_09 next prompt): original CIA wording only — no EFQM Model text, no criterion or
criterion-part wording, no RADAR attribute text and no assessor-training material. Criterion NAMES are used only to identify
them. No "EFQM-approved", licensed-assessor, accreditation or CPD claim. Every record stays needs_review until a person approves it.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "phase7"))
import lib  # noqa: E402

T, opt, lesson, module, rubric = lib.T, lib.opt, lib.lesson, lib.module, lib.rubric
VERSION = "0.10.0"
CHANGE_NOTE = "Phase 10 Excellence (EFQM-informed) curriculum draft (Nov 2026) — original CIA wording; awaiting review"
SRC = "SRC-CIA-EX"


def gov():
    return {"content_status": "needs_review", "content_source": "ai_draft", "version": VERSION,
            "reviewer": None, "review_date": None, "change_note": CHANGE_NOTE}


def question(qid, competency, prompt, options, correct, explanation, **kw):
    kw.setdefault("category", "excellence")
    return lib.question(qid, competency, prompt, options, correct, explanation, **kw)


def course(cid, slug, title, level, routes, audience, prerequisites, outcomes, overview, why, relevance, modules, practical, scenario_q,
           competencies, knowledge, tools, templates, sources, *, next_course=None, related_certification=None, guides=(),
           extra_final=(), cover_topic=None):
    c = lib.course(cid, slug, title, level, [], routes, audience, prerequisites, outcomes, overview, why, relevance, modules, practical,
                   scenario_q, competencies, knowledge, tools, templates, sources, next_course=next_course, extra_final=extra_final)
    c.update({"category": "efqm", "ecosystem": "efqm", "professional_body_reference": "EFQM", "version": VERSION, "governance": gov(),
              "status_label": "CIA INTERNAL COURSE", "related_certification": related_certification, "related_guides": list(guides)})
    if cover_topic:
        c["cover_topic"] = cover_topic
    c["passing_criteria"] = T(
        "Complete every lesson and score at least 70% in the final assessment. The practical task is recorded only after human review. "
        "Completion earns a CIA certificate of completion — not an EFQM recognition, an assessor qualification or an award result.",
        "إكمال جميع الدروس والحصول على 70% على الأقل في التقييم الختامي. لا تُسجَّل المهمة العملية إلا بعد مراجعة بشرية. "
        "الإكمال يمنح شهادة إكمال من CIA — وليس اعترافًا من EFQM ولا تأهيلًا كمقيّم ولا نتيجة في جائزة.")
    return c


def finalize():
    """Phase 10 questions only: lib.QUESTIONS is shared with nothing else in this process."""
    for q in lib.QUESTIONS:
        q["reference"] = SRC
        q["version"] = VERSION
        q["governance"] = gov()
        if q.get("category") == "iso":
            q["category"] = "excellence"
    return lib.COURSES, lib.QUESTIONS
