#!/usr/bin/env python3
"""Phase 13 seed builder — AI Learning Coach and Interview Simulator (spec §16, §22.1, §23, §23.1 / ADD-12, ADD-20).

The coach itself is code (src/domain/coach.mjs) working on approved content and the learner's own records. This builder writes
only the governed and shared pieces:
  data/seed/coach.json            8 practice-scenario templates + 31 interview questions (schema cia.coach.v1, owner_phase "13")
  data/seed/figures.json          3 explanatory figures (owner_phase "13"), placed as coach:main / coach:labels / coach:interview
  data/seed/lesson-figures.json   their placement
  data/seed/navigation.json       the "coach" entry: active, merged into My space (no new top item)
  data/seed/build-status.json     Phase 13 in progress (a completed phase stays complete on rebuild)
  data/i18n/en.json, ar.json      the "coach13" UI strings
Every template, question and figure is validated before anything is written (bilingual text, slot parity, rubric shape,
competency ids in the framework, no number that could read as an official requirement, no authority / exam / hiring wording).

Run after build_phase12a.py and BEFORE build_phase10a.mjs:  … → build:phase12a → build:phase13 → build:phase10a
Idempotent; only Phase 13 ids are upserted; approvals of unchanged records are kept (tools/review_hash.py). New records are
needs_review; publication happens only through tools/apply_review_decisions.py on the owner's decision. Author: مدثر سلامه.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SEED = ROOT / "data" / "seed"
I18N = ROOT / "data" / "i18n"
sys.path.insert(0, str(HERE / "phase13"))
sys.path.insert(0, str(HERE))

import coach13  # noqa: E402
import i18n_coach  # noqa: E402
from review_hash import keep_approvals  # noqa: E402

PHASE = "13"
DROPPED = []
TEMPLATES = {"cycle", "flow", "ladder", "bars", "matrix"}
ACADEMIES = {"iso", "pmi", "quality", "excellence"}
# Wording a coach template may never contain (the same families the runtime guardrail checks).
FORBIDDEN = re.compile(r"\b(accredited|guarantee[sd]?|real exam|actual exam|exam question|will be hired|hire you|pass the exam|PDUs?|certified by)\b|معتمد من|نضمن|سؤال اختبار حقيقي|سيتم توظيفك", re.I)
NEGATED = re.compile(r"\b(no|not|never|without)\b[^.]{0,60}$|لا |ليس|بلا |دون ", re.I)


def load(name):
    return json.loads((SEED / f"{name}.json").read_text(encoding="utf-8"))


def save(name, doc):
    path = SEED / f"{name}.json"
    if path.exists() and isinstance(doc.get("items"), list) and all("governance" in x for x in doc["items"]):
        DROPPED.extend(f"{name}:{i}" for i in keep_approvals(json.loads(path.read_text(encoding="utf-8")).get("items", []), doc["items"]))
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def both(v):
    return isinstance(v, dict) and all(isinstance(v.get(k), str) and v[k].strip() for k in ("en", "ar"))


def texts(o):
    if isinstance(o, dict):
        if set(o) == {"en", "ar"} and all(isinstance(x, str) for x in o.values()):
            yield o
        else:
            for k, v in o.items():
                if k not in ("terms", "avoid", "governance"):
                    yield from texts(v)
    elif isinstance(o, list):
        for v in o:
            yield from texts(v)


def labels(o, lang):
    out = []
    if isinstance(o, dict):
        if set(o) == {"en", "ar"}:
            return [o[lang]]
        for k, v in o.items():
            if k not in ("caption", "read", "governance", "id"):
                out += labels(v, lang)
    elif isinstance(o, list):
        for v in o:
            out += labels(v, lang)
    return out


def clean(rec_id, o):
    for t in texts(o):
        for lang in ("en", "ar"):
            for m in FORBIDDEN.finditer(t[lang]):
                assert NEGATED.search(t[lang][max(0, m.start() - 70):m.start()]), (rec_id, "forbidden wording", t[lang][max(0, m.start() - 40):m.end() + 20])


COMPS = {c["id"] for c in json.loads((SEED / "competency" / "competencies.json").read_text(encoding="utf-8"))["items"]}

# ------------------------------------------------------------------ scenario templates
sids = [s["id"] for s in coach13.SCENARIOS]
assert len(set(sids)) == len(sids), "duplicate scenario id"
for s in coach13.SCENARIOS:
    sid = s["id"]
    assert re.match(r"^SCN-[A-Z0-9-]+$", sid), sid
    assert s.get("academy") in ACADEMIES, (sid, "academy")
    assert s["competencies"] and set(s["competencies"]) <= COMPS, (sid, "competencies")
    for k in ("title", "text", "task"):
        assert both(s[k]), (sid, k)
    for lang in ("en", "ar"):
        used = sorted(set(re.findall(r"\{(\w+)\}", s["text"][lang])))
        assert used == sorted(s["slots"]), (sid, "slots", lang, used)
    for name, opts in s["slots"].items():
        assert len(opts) >= 2 and all(both(o) for o in opts), (sid, "slot", name)
    assert len(s["rubric"]) >= 3, (sid, "rubric")
    for r in s["rubric"]:
        assert r["id"] and both(r["criterion"]) and both(r["hint"]), (sid, r.get("id"))
        n, m = len(r["terms"]["en"]), len(r["terms"]["ar"])
        assert (n == 0) == (m == 0), (sid, r["id"], "terms in one language only")
        if n == 0:
            assert s.get("avoid") and s["avoid"]["en"] and s["avoid"]["ar"], (sid, r["id"], "avoid list missing")
    clean(sid, s)

# ------------------------------------------------------------------ interview questions (one per competency)
qids = [q["id"] for q in coach13.INTERVIEW]
assert len(set(qids)) == len(qids), "duplicate interview question id"
assert {q["competency"] for q in coach13.INTERVIEW} == COMPS, ("interview bank must cover the framework", sorted(COMPS ^ {q["competency"] for q in coach13.INTERVIEW}))
for q in coach13.INTERVIEW:
    assert both(q["prompt"]) and both(q["follow_up"]), q["id"]
    assert len(q["key_points"]) == 3, (q["id"], "three key points")
    for p in q["key_points"]:
        assert both(p["t"]) and p["terms"]["en"] and p["terms"]["ar"], (q["id"], "key point")
    assert not re.search(r"\d", q["prompt"]["en"] + q["follow_up"]["en"]), (q["id"], "number in an interview question")
    clean(q["id"], q)

GOV = {"content_status": "needs_review", "content_source": "ai_draft", "version": "0.13.0", "reviewer": None, "review_date": None}
items = []
for s in coach13.SCENARIOS:
    items.append({**s, "kind": "scenario", "owner_phase": PHASE, "label": "generated_practice",
                  "governance": {**GOV, "change_note": "Phase 13 practice-scenario template (original CIA wording; generated practice, never an exam question); awaiting review."}})
for q in coach13.INTERVIEW:
    items.append({**q, "kind": "interview_question", "owner_phase": PHASE,
                  "governance": {**GOV, "change_note": "Phase 13 interview practice question (original CIA wording; practice feedback only, no hiring decision); awaiting review."}})
save("coach", {"schema": "cia.coach.v1", "note": "Governed coach content. kind: scenario | interview_question. Practice only: never an exam question, never evidence, never a hiring decision.", "items": items})

# ------------------------------------------------------------------ figures (governed) and placement
ids = [f["id"] for f in coach13.FIGS]
assert len(set(ids)) == len(ids), "duplicate figure id"
for f in coach13.FIGS:
    assert f["template"] in TEMPLATES, (f["id"], "template")
    for k in ("caption", "read"):
        assert both(f[k]), (f["id"], k)
    assert len(labels(f, "en")) == len(labels(f, "ar")) and all(labels(f, "ar")), (f["id"], "label parity")
    clean(f["id"], f)
    f["owner_phase"] = PHASE
    f["governance"] = {**GOV, "change_note": "Phase 13 explanatory figure (original CIA diagram, data-driven SVG; no figures or claims); awaiting review."}
for key, figs in coach13.PLACEMENT.items():
    assert key.startswith("coach:"), key
    assert all(x in ids for x in figs), key
fig_doc = load("figures")
fid = set(ids)
assert not fid & {x["id"] for x in fig_doc["items"] if x.get("owner_phase") != PHASE}, "figure id used by another phase"
fig_doc["items"] = [x for x in fig_doc["items"] if x.get("owner_phase") != PHASE or x["id"] in fid]
idx = {x["id"]: i for i, x in enumerate(fig_doc["items"])}
for f in coach13.FIGS:
    if f["id"] in idx:
        fig_doc["items"][idx[f["id"]]] = f
    else:
        fig_doc["items"].append(f)
save("figures", fig_doc)
lf_path = SEED / "lesson-figures.json"
lf = json.loads(lf_path.read_text(encoding="utf-8"))
placed = {e["id"]: [x for x in e.get("figures", []) if x not in fid] for e in lf["items"]}
for k, v in coach13.PLACEMENT.items():
    placed[k] = list(dict.fromkeys(placed.get(k, []) + v))
lf_path.write_text(json.dumps({"schema": "cia.lesson-figures.v1", "items": [{"id": k, "figures": v} for k, v in placed.items() if v]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ navigation: the coach lives in My space (no new top item)
nav_path = SEED / "navigation.json"
nav = json.loads(nav_path.read_text(encoding="utf-8"))
for e in nav["items"]:
    if e["id"] == "coach":
        e.update({"kind": "route", "phase": 13, "status": "active", "requiredTier": "free", "primary": False, "route": "/my?tab=coach", "placement": "hidden", "mergedInto": "mySpace"})
assert sum(1 for e in nav["items"] if e.get("placement") == "top") == 5, "the five-item structure must not change"
nav_path.write_text(json.dumps(nav, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ build status
bs = load("build-status")
for p in bs["phases"]:
    if str(p.get("id")) == PHASE and p.get("status") != "complete":
        p.pop("fraction", None)
        p.update({"status": "in_progress", "partial": None,
                  "note": "Learning coach built (17 Nov 2026): grounded answers with source labels, mistake explanation, weak-area practice, practice scenarios, plan my week and interview practice, all on the device; 39 coach templates and 3 figures await review / owner approval; the optional model adapter stays off (owner decision D-13-1)."})
bs["updated"] = "2026-11-17"
save("build-status", bs)


# ------------------------------------------------------------------ UI strings
def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v)
        else:
            dst[k] = v


def flat(o, p=""):
    return [x for k, v in o.items() for x in (flat(v, p + k + ".") if isinstance(v, dict) else [(p + k, v)])]


fe, fa = dict(flat(i18n_coach.EN)), dict(flat(i18n_coach.AR))
assert set(fe) == set(fa), ("coach13 keys differ", sorted(set(fe) ^ set(fa))[:10])
assert all(str(v).strip() for v in fa.values()) and all(str(v).strip() for v in fe.values()), "empty string"
ph = lambda s_: sorted(re.findall(r"\{(\w+)\}", s_))  # noqa: E731
bad = [k for k in fe if ph(fe[k]) != ph(fa[k])]
assert not bad, ("placeholders differ", bad[:10])
for lang, part, extra in (("en", i18n_coach.EN, i18n_coach.EXTRA_EN), ("ar", i18n_coach.AR, i18n_coach.EXTRA_AR)):
    p = I18N / f"{lang}.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    d.pop("coach13", None)
    merge(d, {"coach13": part})
    merge(d, extra)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(f"phase 13: scenario templates {len(coach13.SCENARIOS)}, interview questions {len(coach13.INTERVIEW)}, figures {len(coach13.FIGS)} "
      f"(placements {sum(len(v) for v in coach13.PLACEMENT.values())}), strings coach13 {len(fe)} per language")
if DROPPED:
    print("approvals dropped (content changed, needs review again):", ", ".join(DROPPED))
