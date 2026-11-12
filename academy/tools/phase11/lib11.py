"""Phase 11 content helpers — Practice Labs and smart templates (original CIA wording, bilingual).

Rules (CONTENT_GOVERNANCE.md, PHASE_11 prompt): original scenarios only; no standard text; criteria are cited by clause
number and name only, through the owner's requirement guides (refs → data/guides/<slug>.json), so the name shown is the
guide's own heading. No accreditation, RU, PDU, CPD, EFQM-assessment or audit-certification claim. Lab results are practice
evidence, not a certification. Every record stays needs_review until a person approves it. Author: مدثر سلامه.
"""

VERSION = "0.11.0"
CHANGE_NOTE = "Phase 11 Practice Labs & smart templates draft (Nov 2026) — original CIA scenarios and wording; awaiting review"
LABEL = {"en": "Practice lab — your result is practice evidence, not a certification",
         "ar": "مختبر تطبيقي — نتيجتك دليل تدريب، وليست شهادة"}


def T(en, ar):
    return {"en": en, "ar": ar}


def gov(note=CHANGE_NOTE):
    return {"content_status": "needs_review", "content_source": "ai_draft", "version": VERSION, "reviewer": None, "review_date": None, "change_note": note}


def _opts(options, keyed=False):
    out = []
    for o in options:
        if keyed:
            oid, en, ar, ok, wen, war = o
            out.append({"id": oid, "text": T(en, ar), "correct": ok, "why": T(wen, war)})
        else:
            oid, en, ar, wen, war = o
            out.append({"id": oid, "text": T(en, ar), "why": T(wen, war)})
    return out


def single(tid, comp, prompt, options, correct, model, reasoning, weight=2, hint=None):
    t = {"id": tid, "type": "single_choice", "competency": comp, "weight": weight, "prompt": prompt, "options": _opts(options), "correct": correct,
         "model_answer": model, "reasoning": reasoning}
    if hint:
        t["hint"] = hint
    return t


def multi(tid, comp, prompt, options, model, reasoning, weight=3, hint=None):
    t = {"id": tid, "type": "multi_select", "competency": comp, "weight": weight, "prompt": prompt, "options": _opts(options, keyed=True),
         "model_answer": model, "reasoning": reasoning}
    if hint:
        t["hint"] = hint
    return t


def order(tid, comp, prompt, items, model, reasoning, weight=2, hint=None):
    t = {"id": tid, "type": "ordering", "competency": comp, "weight": weight, "prompt": prompt,
         "items": [{"id": i, "text": T(en, ar)} for i, en, ar in items], "model_answer": model, "reasoning": reasoning}
    if hint:
        t["hint"] = hint
    return t


def classify(tid, comp, prompt, categories, items, model, reasoning, weight=3, hint=None):
    t = {"id": tid, "type": "classify", "competency": comp, "weight": weight, "prompt": prompt,
         "categories": [{"id": c, "label": T(en, ar)} for c, en, ar in categories],
         "items": [{"id": i, "text": T(en, ar), "category": cat, "why": T(wen, war)} for i, en, ar, cat, wen, war in items],
         "model_answer": model, "reasoning": reasoning}
    if hint:
        t["hint"] = hint
    return t


def numeric(tid, comp, prompt, answer, tolerance, unit, model, reasoning, weight=1, hint=None):
    t = {"id": tid, "type": "numeric", "competency": comp, "weight": weight, "prompt": prompt, "answer": answer, "tolerance": tolerance,
         "unit": unit, "model_answer": model, "reasoning": reasoning}
    if hint:
        t["hint"] = hint
    return t


def written(tid, comp, prompt, rubric, model, reasoning, weight=4, min_chars=80, hint=None):
    t = {"id": tid, "type": "free_text", "competency": comp, "weight": weight, "prompt": prompt, "review": "human", "min_chars": min_chars,
         "rubric": [{"id": f"R{i + 1}", "text": T(en, ar), "weight": w} for i, (en, ar, w) in enumerate(rubric)],
         "model_answer": model, "reasoning": reasoning}
    if hint:
        t["hint"] = hint
    return t


def exhibit(xid, title, *, text=None, columns=None, rows=None, note=None):
    x = {"id": xid, "title": title}
    if text:
        x["text"] = text
    if columns:
        x["columns"] = columns
        x["rows"] = rows
    if note:
        x["note"] = note
    return x


def lab(lid, slug, academy, kind, code, title, summary, minutes, level, competencies, scenario, tasks, *, courses=(), lessons=(), toolkits=(),
        templates=(), refs=(), figures=(), cover=None, pass_mark=70, draft=False, objectives=()):
    return {"id": lid, "slug": slug, "academy": academy, "kind": kind, "code": code, "title": title, "summary": summary, "label": LABEL,
            "minutes": minutes, "level": level, "competencies": list(competencies), "objectives": list(objectives), "scenario": scenario,
            "tasks": tasks, "pass_mark": pass_mark, "courses": list(courses), "lessons": list(lessons), "toolkits": list(toolkits),
            "templates": list(templates), "refs": [{"guide": g, "ref": r} for g, r in refs], "figures": list(figures), "cover": cover,
            "draft": draft, "version": VERSION, "governance": gov()}
