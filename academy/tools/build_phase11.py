#!/usr/bin/env python3
"""Phase 11 seed builder — Practice Labs and smart guided templates.

Writes, from the authored content in tools/phase11/*.py:
  data/seed/labs.json             13 lab definitions (cia.lab.v1): 8 complete labs + 5 governed drafts (`draft: true`)
  data/seed/smart-templates.json  6 smart templates (cia.smart-template.v1): Risk Register, Audit Checklist, NCR, CAPA, Quality Plan, Training Matrix
  data/seed/figures.json          13 explanatory figures (owner_phase 11) and their placement "lab:<slug>" in lesson-figures.json
  data/seed/relationships.json    lab practices competency · lab related_to course · lab links_to_tool toolkit · template related_to lab
  data/seed/build-status.json     Phase 11 in progress (a completed phase stays complete on rebuild)
  data/i18n/en.json, ar.json      the "lab11" and "tpl11" UI strings
Every reference is checked before anything is written: competencies, courses, lessons, toolkits, figure ids, templates, and
every clause cited (`refs`) must exist as an item of the owner's requirement guide (data/guides/<slug>.json).

Run after the earlier builders and BEFORE build_phase10a.mjs (which splits labs.json per academy and adds labs and templates to
the search index):  … → build:phase10 → build:phase11 → build:phase10a
Idempotent; only Phase 11 ids are upserted; approvals of unchanged records are kept (tools/review_hash.py). Every new record is
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
sys.path.insert(0, str(HERE / "phase11"))
sys.path.insert(0, str(HERE))

import labs_iso  # noqa: E402
import labs_quality_pm  # noqa: E402
import labs_drafts  # noqa: E402
import templates11  # noqa: E402
import figures11  # noqa: E402
import i18n_lab  # noqa: E402
from review_hash import keep_approvals  # noqa: E402

PHASE = 11
DROPPED = []
LABS = labs_iso.LABS + labs_quality_pm.LABS + labs_drafts.LABS
TEMPLATES = templates11.TEMPLATES


def load(name):
    return json.loads((SEED / f"{name}.json").read_text(encoding="utf-8"))


def save(name, doc):
    path = SEED / f"{name}.json"
    if path.exists() and isinstance(doc.get("items"), list):
        DROPPED.extend(f"{name}:{i}" for i in keep_approvals(json.loads(path.read_text(encoding="utf-8")).get("items", []), doc["items"]))
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


# ------------------------------------------------------------------ reference checks
comps = {c["id"] for c in json.loads((SEED / "competency" / "competencies.json").read_text(encoding="utf-8"))["items"]}
courses = load("courses")["items"]
course_ids = {c["id"] for c in courses}
lesson_ids = {l["id"] for c in courses for m in c.get("modules", []) for l in m.get("lessons", [])}
module_ids = {m["id"] for m in load("platform-modules")["items"]}
guide_refs = set()
for g in json.loads((ROOT / "data" / "guides" / "index.json").read_text(encoding="utf-8"))["items"]:
    gd = json.loads((ROOT / "data" / "guides" / f"{g['slug']}.json").read_text(encoding="utf-8"))["guide"]
    guide_refs |= {f"{g['slug']}#{it['ref']}" for cl in gd.get("clauses", []) for it in cl.get("items", [])}
fig_ids = {f["id"] for f in figures11.FIGS}
tpl_ids = {t["id"] for t in TEMPLATES}
lab_ids = {l["id"] for l in LABS}

assert len(lab_ids) == len(LABS), "duplicate lab id"
assert len({l["slug"] for l in LABS}) == len(LABS), "duplicate lab slug"
for l in LABS:
    for c in l["competencies"]:
        assert c in comps, (l["id"], "unknown competency", c)
    for t in l["tasks"]:
        assert t["competency"] in l["competencies"], (l["id"], t["id"], "task competency not in lab")
    for c in l["courses"]:
        assert c in course_ids, (l["id"], "unknown course", c)
    for x in l["lessons"]:
        assert x in lesson_ids, (l["id"], "unknown lesson", x)
    for m in l["toolkits"]:
        assert m in module_ids, (l["id"], "unknown toolkit", m)
    for f in l["figures"]:
        assert f in fig_ids, (l["id"], "unknown figure", f)
    for t in l["templates"]:
        assert t in tpl_ids, (l["id"], "unknown template", t)
    for r in l["refs"]:
        assert f"{r['guide']}#{r['ref']}" in guide_refs, (l["id"], "clause not in the requirement guide", r)
for t in TEMPLATES:
    for x in t["labs"]:
        assert x in lab_ids, (t["id"], "unknown lab", x)
    for c in t["courses"]:
        assert c in course_ids, (t["id"], "unknown course", c)
    for m in t["toolkits"]:
        assert m in module_ids, (t["id"], "unknown toolkit", m)
    for c in t["competencies"]:
        assert c in comps, (t["id"], "unknown competency", c)

# ------------------------------------------------------------------ labs and templates (governed masters)
labs_path = SEED / "labs.json"
labs_doc = json.loads(labs_path.read_text(encoding="utf-8")) if labs_path.exists() else {"schema": "cia.lab.v1", "items": []}
labs_doc["schema"] = "cia.lab.v1"
labs_doc["note"] = "Master file (approvals live here). build_phase10a.mjs splits it into data/seed/split/labs-index.json and labs-<academy>.json; never edit the split by hand."
labs_doc["items"] = upsert([x for x in labs_doc["items"] if x["id"] in lab_ids], LABS)
save("labs", labs_doc)

tpl_path = SEED / "smart-templates.json"
tpl_doc = json.loads(tpl_path.read_text(encoding="utf-8")) if tpl_path.exists() else {"schema": "cia.smart-template.v1", "items": []}
tpl_doc["schema"] = "cia.smart-template.v1"
tpl_doc["items"] = upsert([x for x in tpl_doc["items"] if x["id"] in tpl_ids], TEMPLATES)
save("smart-templates", tpl_doc)

# ------------------------------------------------------------------ figures (governed, owner_phase 11) and placement
for f in figures11.FIGS:
    f["owner_phase"] = PHASE
    f["governance"] = {"content_status": "needs_review", "content_source": "ai_draft", "version": "0.11.0", "reviewer": None, "review_date": None,
                       "change_note": "Phase 11 explanatory figure (original CIA diagram, data-driven SVG; lab scenario numbers); awaiting review."}
fig_doc = load("figures")
fig_doc["items"] = [x for x in fig_doc["items"] if x.get("owner_phase") != PHASE or x["id"] in fig_ids]
assert not fig_ids & {x["id"] for x in fig_doc["items"] if x.get("owner_phase") != PHASE}, "figure id used by another phase"
upsert(fig_doc["items"], figures11.FIGS)
save("figures", fig_doc)
slugs = {l["slug"] for l in LABS}
for key in figures11.PLACEMENT:
    assert key.startswith("lab:") and key[4:] in slugs, f"figure placement points at an unknown lab: {key}"
for l in LABS:
    assert figures11.PLACEMENT.get("lab:" + l["slug"]), f"lab without a figure placement: {l['id']}"
lf_path = SEED / "lesson-figures.json"
lf = json.loads(lf_path.read_text(encoding="utf-8"))
placed = {e["id"]: [f for f in e.get("figures", []) if f not in fig_ids] for e in lf["items"]}
for k, v in figures11.PLACEMENT.items():
    placed[k] = list(dict.fromkeys(placed.get(k, []) + v))
lf_path.write_text(json.dumps({"schema": "cia.lesson-figures.v1", "items": [{"id": k, "figures": v} for k, v in placed.items() if v]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ relationships
rel_doc = load("relationships")
rel = rel_doc["items"]
keys = {(r["fromType"], r["fromId"], r["relation"], r["toType"], r["toId"]) for r in rel}


def link(ft, fid, relation, tt, tid):
    k = (ft, fid, relation, tt, tid)
    if k in keys:
        return
    keys.add(k)
    rel.append({"id": "rel-" + hashlib.sha1("|".join(k).encode()).hexdigest()[:12], "fromType": ft, "fromId": fid, "relation": relation, "toType": tt, "toId": tid})


for l in LABS:
    for c in l["competencies"]:
        link("lab", l["id"], "practices", "competency", c)
    for c in l["courses"]:
        link("lab", l["id"], "related_to", "course", c)
    for m in l["toolkits"]:
        link("lab", l["id"], "links_to_tool", "platform_module", m)
for t in TEMPLATES:
    for x in t["labs"]:
        link("template", t["id"], "related_to", "lab", x)
    for c in t["competencies"]:
        link("template", t["id"], "develops", "competency", c)
save("relationships", rel_doc)

# ------------------------------------------------------------------ build status
bs = load("build-status")
for p in bs["phases"]:
    if str(p.get("id")) == "11" and p.get("status") != "complete":
        p.pop("fraction", None)
        p.update({"status": "in_progress", "partial": None,
                  "note": f"Practice Labs & smart templates built (12 Nov 2026): {sum(1 for l in LABS if not l['draft'])} labs + {sum(1 for l in LABS if l['draft'])} governed drafts, 6 smart templates, {len(figures11.FIGS)} figures. Content awaits review / owner approval."})
bs["updated"] = "2026-11-12"
save("build-status", bs)


# ------------------------------------------------------------------ UI strings
def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v)
        else:
            dst[k] = v


for lang, part in (("en", i18n_lab.EN), ("ar", i18n_lab.AR)):
    p = I18N / f"{lang}.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    merge(d, part)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

n_tasks = sum(len(l["tasks"]) for l in LABS)
print(f"phase 11: labs {len(LABS)} ({sum(1 for l in LABS if not l['draft'])} complete, {sum(1 for l in LABS if l['draft'])} drafts, {n_tasks} tasks), "
      f"templates {len(TEMPLATES)}, figures {len(figures11.FIGS)}, relationships {len(rel)}")
if DROPPED:
    print("approvals dropped (content changed, needs review again):", ", ".join(DROPPED))
